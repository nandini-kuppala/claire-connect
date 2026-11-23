// The only place that reads and writes supply-chain data (04 §1 A5, §5, §6.1b). Every function takes a Ctx built
// from the auth token; scope filters are added here, never by callers.
import crypto from 'node:crypto';
import type { ClientSession } from 'mongodb';
import { col, withTx } from '../db/index.js';
import { HttpError } from '../util.js';
import { assertBalanced, compact } from '../../../shared/sc/postings.js';
import type { HoldingKey, PartyRef, Posting } from '../../../shared/sc/types.js';
import { counterpartyFor } from '../../../shared/sc/mask.js';
import type { Ctx } from './flag.js';

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;

/** Canonical JSON (sorted keys) so the same key always hashes to the same holding id. */
function canon(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
}

export const holdingId = (key: HoldingKey, dim: string) => `h_${crypto.createHash('sha1').update(`${dim}|${canon(key)}`).digest('base64url')}`;

/**
 * A retry of a record that already went through (same client id): checked before any stock check, so an offline
 * re-send after a lost reply answers "duplicate" instead of "not enough stock" (the first send used that stock).
 */
export async function alreadyRecorded(ctx: Ctx, clientId: string | undefined): Promise<boolean> {
  if (!clientId) return false;
  return !!(await col('sc_events').findOne({ business_id: ctx.businessId, client_id: clientId } as any, { projection: { _id: 1 } }));
}

/**
 * No lot typed: when the lot-less stock row is short, take the goods from one lot of the same material at the same
 * place that covers the whole amount (the smallest such lot). Without this, stock bought with a lot reads as 0 and the
 * owner's "record anyway" would add untracked stock beside it.
 */
export async function lotForUntyped(me: PartyRef, spec: string, place: string | null, need: number): Promise<{ lot: string; qty: number } | null> {
  const row = (await col('sc_holdings')
    .find({ t: 'real', 'key.spec': spec, 'key.grade': 'A', 'key.owner.k': me.k, 'key.owner.id': me.id, 'key.custodian.k': me.k, 'key.custodian.id': me.id, 'key.via': null, 'key.place': place, 'key.state.s': 'available', 'key.lot': { $type: 'string' }, qty_base: { $gte: need } } as any, { projection: { key: 1, qty_base: 1 } })
    .sort({ qty_base: 1 }).limit(1).toArray()) as any[];
  return row[0] ? { lot: row[0].key.lot as string, qty: row[0].qty_base as number } : null;
}

const bizOf = (p: PartyRef | null | undefined) => (p && p.k === 'b' ? [p.id] : []);

/** Businesses allowed to see a holding row (owner, custodian, via). Contacts are seen through their owning business. */
export function viewersOf(key: HoldingKey, contactOwners: Map<string, string>): string[] {
  const parties: (PartyRef | null | undefined)[] = key.t === 'real' ? [key.owner, key.custodian, key.via] : [key.owner];
  const ids = new Set<string>();
  for (const party of parties) {
    if (!party) continue;
    if (party.k === 'b') ids.add(party.id);
    else {
      const owner = contactOwners.get(party.id);
      if (owner) ids.add(owner);
    }
  }
  return [...ids];
}

/** Resolves a linked contact to its business (04 §5.6.1). Unlinked contacts stay contacts. */
export async function canonicalParty(p: PartyRef, session?: ClientSession): Promise<PartyRef> {
  if (p.k !== 'c') return p;
  const c = await col('sc_contacts').findOne({ _id: p.id } as any, { session, projection: { linked_business_id: 1, link_state: 1 } });
  return c?.link_state === 'linked' && c.linked_business_id ? { k: 'b', id: c.linked_business_id } : p;
}

export interface EventInput {
  type: string;
  ref: { kind: string; id: string };
  payload?: Record<string, unknown>;
  business_date: string;
  client_id?: string;
  /** Hidden from the counterparty until this time (undo window, 04 §5.3). */
  visible_at?: number;
}

export interface PostResult {
  eventId: string;
  duplicate: boolean;
}

/**
 * One write = one transaction (04 §5.1): the event, its postings and the materialized holdings, all or nothing.
 * Postings must balance per dimension; a real holding that would go negative aborts the write (model §5.4).
 * `extra` runs inside the same transaction for record documents (movements, jobs, notify rows).
 */
export async function post(ctx: Ctx, ev: EventInput, postings: Posting[], extra?: (session: ClientSession, eventId: string) => Promise<void>): Promise<PostResult> {
  assertBalanced(postings);
  const rows = compact(postings, (k) => canon(k));
  return withTx(async (session) => {
    if (ev.client_id) {
      const dup = await col('sc_events').findOne({ business_id: ctx.businessId, client_id: ev.client_id } as any, { session });
      if (dup) return { eventId: dup.id as string, duplicate: true };
    }
    const eventId = newId('ev');
    const now = Date.now();
    await col('sc_events').insertOne(
      { _id: eventId, id: eventId, type: ev.type, business_id: ctx.businessId, user_id: ctx.userId, ref: ev.ref, payload: ev.payload ?? {}, business_date: ev.business_date, recorded_at: now, ...(ev.client_id ? { client_id: ev.client_id } : {}) } as any,
      { session },
    );
    if (rows.length) {
      const contactIds = [...new Set(rows.flatMap((r) => (r.key.t === 'real' ? [r.key.owner, r.key.custodian, r.key.via] : [r.key.owner])).filter((x): x is PartyRef => !!x && x.k === 'c').map((x) => x.id))];
      const contactOwners = new Map<string, string>();
      if (contactIds.length) {
        for (const c of await col('sc_contacts').find({ _id: { $in: contactIds } } as any, { session, projection: { owner_business_id: 1 } }).toArray()) contactOwners.set(c._id as unknown as string, c.owner_business_id);
      }
      await col('sc_postings').insertMany(
        rows.map((r) => {
          const id = newId('po');
          return { _id: id, id, event_id: eventId, key: r.key, dimension: r.dim, delta_base: r.delta, business_date: ev.business_date, recorded_at: now } as any;
        }),
        { session },
      );
      for (const r of rows) {
        const _id = holdingId(r.key, r.dim);
        const after = await col('sc_holdings').findOneAndUpdate(
          { _id } as any,
          {
            $inc: { qty_base: r.delta },
            $set: { last_event_id: eventId, updated_at: now, ...(ev.visible_at && r.key.t === 'real' && r.key.state.s === 'in_transit' ? { visible_at: ev.visible_at } : {}) },
            $setOnInsert: { id: _id, key: r.key, dimension: r.dim, t: r.key.t, viewer_business_ids: viewersOf(r.key, contactOwners), created_at: now },
          },
          { upsert: true, returnDocument: 'after', session },
        );
        if (r.key.t === 'real' && (after?.qty_base ?? 0) < 0) {
          throw new HttpError(409, 'There is not enough of this in stock for that.');
        }
      }
    }
    if (extra) await extra(session, eventId);
    return { eventId, duplicate: false };
  });
}

export interface PositionRow {
  id: string;
  key: HoldingKey;
  dimension: string;
  qty_base: number;
  /** Who this row is "with" (owner's view) or "for" (custodian's view), after the sub-contract mask. */
  counterparty: PartyRef | null;
  mine: boolean;
}

/**
 * The single read path for goods (04 §6.1b): visible, non-zero real holdings for this business, grouped by the
 * masked counterparty. Hides in-transit rows still inside someone else's undo window and unmatched provisional rows.
 * (Slice 1 replaces allocated(J) rows with the read-time approx. pending.)
 */
export async function positions(ctx: Ctx, filter: { tab?: 'out' | 'in' } = {}): Promise<PositionRow[]> {
  const me: PartyRef = { k: 'b', id: ctx.businessId };
  const now = Date.now();
  const rows = await col('sc_holdings')
    .find({ viewer_business_ids: ctx.businessId, t: 'real', qty_base: { $ne: 0 } } as any)
    .limit(500)
    .toArray();
  const out: PositionRow[] = [];
  for (const r of rows as any[]) {
    const key = r.key as HoldingKey;
    if (key.t !== 'real') continue;
    if (r.provisional_by && r.provisional_by !== ctx.businessId) continue;
    const mine = key.owner.k === 'b' && key.owner.id === ctx.businessId;
    if (!mine && r.visible_at && r.visible_at > now) continue;
    const cp = counterpartyFor(me, key);
    const atMe = key.custodian.k === 'b' && key.custodian.id === ctx.businessId;
    if (filter.tab === 'out' && (!mine || atMe)) continue;
    if (filter.tab === 'in' && !atMe) continue;
    out.push({ id: r._id, key, dimension: r.dimension, qty_base: r.qty_base, counterparty: cp?.party ?? null, mine });
  }
  return out;
}
