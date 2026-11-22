// Contact linking (model §6.4, 04 §5.6.1). When a business joins with a phone that other businesses saved as a
// contact, it sees only "N businesses have records with your number" (no names, no data). It may ask to link; each
// recorder approves explicitly (silence never approves). Approval writes ONE link_rekey event that moves every holding
// keyed on the contact to the business (−q old, +q new, history intact), re-points that recorder's records to the
// business, merges duplicate contacts, and retires the statement link.
import { Router } from 'express';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { post } from './repo.js';
import type { HoldingKey, PartyRef, Posting } from '../../../shared/sc/types.js';

const router = Router();
const ten = (p: string | null | undefined) => String(p ?? '').replace(/\D/g, '').slice(-10);
const OPEN_STATES = [null, undefined, 'unlinked', 'suggested'];

/** This business's verified phones (its owners' logins). */
async function myPhones(ctx: Ctx): Promise<string[]> {
  const users = await col('users').find({ business_id: ctx.businessId, role: { $ne: 'staff' } } as any, { projection: { phone: 1 } }).toArray();
  return [...new Set(users.map((u: any) => ten(u.phone)).filter((p) => p.length === 10))];
}

async function matchingContacts(ctx: Ctx) {
  const phones = await myPhones(ctx);
  if (!phones.length) return [];
  const all = await col('sc_contacts').find({ owner_business_id: { $ne: ctx.businessId }, archived_at: { $exists: false }, link_state: { $nin: ['linked', 'declined'] } } as any, { projection: { phones: 1, link_state: 1, link_requested_by: 1, owner_business_id: 1 } }).limit(2000).toArray();
  return (all as any[]).filter((c) => (c.phones ?? []).some((p: string) => phones.includes(ten(p))));
}

/** What the joining business may see: a count, never who or what. */
router.get(
  '/sc/linking/suggestions',
  h(async (req: ScRequest, res) => {
    const m = await matchingContacts(req.ctx);
    const pending = m.filter((c) => c.link_state === 'pending_recorder' && c.link_requested_by === req.ctx.businessId).length;
    res.json({ count: m.length - pending, pending });
  }),
);

router.post(
  '/sc/linking/request',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can ask to link.');
    const m = (await matchingContacts(req.ctx)).filter((c) => OPEN_STATES.includes(c.link_state));
    if (m.length) await col('sc_contacts').updateMany({ _id: { $in: m.map((c) => c._id) } } as any, { $set: { link_state: 'pending_recorder', link_requested_by: req.ctx.businessId, link_requested_at: Date.now() } });
    res.json({ requested: m.length });
  }),
);

/** The recorder's side: who asked to link to which of my contacts. */
router.get(
  '/sc/linking/requests',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') return res.json({ requests: [] }); // owner-only: names and phones of who asked
    const rows = await col('sc_contacts').find({ owner_business_id: req.ctx.businessId, link_state: 'pending_recorder' } as any).toArray();
    const bizs = new Map((await col('businesses').find({ _id: { $in: rows.map((r: any) => r.link_requested_by) } } as any, { projection: { name: 1, city: 1, area: 1, role_label: 1 } }).toArray()).map((b: any) => [b._id, b]));
    res.json({
      requests: rows.map((r: any) => {
        const b: any = bizs.get(r.link_requested_by);
        return { contact_id: r._id, contact_name: r.name, phone: r.phones?.[0] ?? null, business: { id: r.link_requested_by, name: b?.name ?? '—', sub: [b?.role_label, b?.area || b?.city].filter(Boolean).join(' · ') }, at: r.link_requested_at };
      }),
    });
  }),
);

const swap = (p: PartyRef | null | undefined, from: PartyRef, to: PartyRef) => (p && p.k === from.k && p.id === from.id ? to : p);

/** One transaction: holdings re-keyed, records re-pointed, duplicates merged, statement link retired. */
export async function linkRekey(ctx: Ctx, contactId: string) {
  const c: any = await col('sc_contacts').findOne({ _id: contactId, owner_business_id: ctx.businessId } as any);
  if (!c || c.link_state !== 'pending_recorder' || !c.link_requested_by) throw new HttpError(409, 'There is no request to approve.');
  const from: PartyRef = { k: 'c', id: contactId };
  const to: PartyRef = { k: 'b', id: c.link_requested_by };
  const rows = (await col('sc_holdings').find({ qty_base: { $ne: 0 }, $or: [{ 'key.owner.k': 'c', 'key.owner.id': contactId }, { 'key.custodian.k': 'c', 'key.custodian.id': contactId }, { 'key.via.k': 'c', 'key.via.id': contactId }, { 'key.attributedTo.k': 'c', 'key.attributedTo.id': contactId }] } as any).toArray()) as any[];
  const postings: Posting[] = [];
  for (const r of rows) {
    const k = r.key as HoldingKey;
    const nk: HoldingKey = k.t === 'real'
      ? { ...k, owner: swap(k.owner, from, to)!, custodian: swap(k.custodian, from, to)!, via: swap(k.via, from, to) ?? null }
      : { ...k, owner: swap(k.owner, from, to)!, ...(k.attributedTo !== undefined ? { attributedTo: swap(k.attributedTo, from, to) ?? null } : {}) };
    postings.push({ key: k, delta: -r.qty_base, dim: r.dimension }, { key: nk, delta: r.qty_base, dim: r.dimension });
  }
  const dupes = await col('sc_contacts').find({ owner_business_id: ctx.businessId, _id: { $ne: contactId }, phones: { $in: c.phones ?? [] }, archived_at: { $exists: false } } as any, { projection: { _id: 1 } }).toArray();
  const now = Date.now();
  await post(ctx, { type: 'link_rekey', ref: { kind: 'contact', id: contactId }, payload: { business_id: to.id, holdings: rows.length }, business_date: new Date(now + 5.5 * 3600e3).toISOString().slice(0, 10) }, postings, async (session) => {
    for (const side of ['from', 'to'] as const) {
      await col('sc_movements').updateMany(
        { recorder_business_id: ctx.businessId, [`${side}.party.k`]: 'c', [`${side}.party.id`]: contactId } as any,
        { $set: { [`${side}.party`]: to, [`${side}.linked_from`]: from }, $addToSet: { party_business_ids: to.id, 'lines.$[].viewer_business_ids': to.id } } as any,
        { session },
      );
    }
    for (const f of ['performer_party', 'client_party', 'owner_party', 'via'] as const) {
      await col('sc_jobs').updateMany({ party_business_ids: ctx.businessId, [`${f}.k`]: 'c', [`${f}.id`]: contactId } as any, { $set: { [f]: to, [`${f}_linked_from`]: from }, $addToSet: { party_business_ids: to.id } } as any, { session });
    }
    await col('sc_discrepancies').updateMany({ parties: ctx.businessId, $or: [{ 'posting.sender.id': contactId }, { 'posting.receiver.id': contactId }] } as any, { $addToSet: { parties: to.id } } as any, { session });
    // Money and terms follow the party too, so Bills keeps one row and the rate card still prices its jobs.
    await col('sc_settlements').updateMany({ recorder_business_id: ctx.businessId, 'party.k': 'c', 'party.id': contactId } as any, { $set: { party: to, party_linked_from: from }, $addToSet: { parties: to.id } } as any, { session });
    await col('sc_rate_cards').updateMany({ business_id: ctx.businessId, 'party.k': 'c', 'party.id': contactId } as any, { $set: { party: to, party_linked_from: from } } as any, { session });
    const oldRel: any = await col('sc_relationships').findOne({ _id: `rel_${ctx.businessId}_c_${contactId}` } as any, { session });
    if (oldRel && !(await col('sc_relationships').findOne({ _id: `rel_${ctx.businessId}_b_${to.id}` } as any, { session }))) {
      const { _id: _old, ...rest } = oldRel;
      await col('sc_relationships').insertOne({ ...rest, _id: `rel_${ctx.businessId}_b_${to.id}`, party: to, linked_from: from, updated_at: now } as any, { session });
    }
    await col('sc_contacts').updateOne({ _id: contactId } as any, { $set: { link_state: 'linked', linked_business_id: to.id, linked_at: now } }, { session });
    if (dupes.length) await col('sc_contacts').updateMany({ _id: { $in: dupes.map((d: any) => d._id) } } as any, { $set: { merged_into: to, archived_at: now } }, { session });
    // Both sides use accounts now: the statement link retires (model §6.4).
    await col('sc_statement_links').updateMany({ recorder_business_id: ctx.businessId, 'party.k': 'c', 'party.id': contactId, stopped_at: null } as any, { $set: { stopped_at: now, stopped_by: 'linked' } }, { session });
  });
  return { business: to, holdings: rows.length, merged: dupes.length };
}

router.post(
  '/sc/linking/:contactId/:verb(approve|decline)',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can approve a link.');
    if (req.params.verb === 'decline') {
      const r = await col('sc_contacts').updateOne({ _id: req.params.contactId, owner_business_id: req.ctx.businessId, link_state: 'pending_recorder' } as any, { $set: { link_state: 'declined', link_declined_at: Date.now() } });
      if (!r.matchedCount) throw new HttpError(404, 'Not found');
      return res.json({ declined: true });
    }
    res.json(await linkRekey(req.ctx, req.params.contactId));
  }),
);

export default router;
