// Slice 4.5: the other record forms. Sell, return to supplier, give a sample (returnable or not), buy, buyer returned
// goods, collect my goods, move between my places; and selling part of goods allocated to an open job (04 §5.6.6).
//
// Who records: whoever has the goods. Outgoing records draw from my stock (never-negative, owner override); a business
// on CLAIRE confirms what arrived and title passes on receipt. Incoming records (buy, buyer returned) are for parties
// that are not on CLAIRE; a business on CLAIRE records its own sale or return and I confirm it.
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { holdingId, newId, post } from './repo.js';
import { UNDO_MS, assertion, me, qtyBase, sameParty, specInfo, termsFor, settleLine, settleCtxFor, goodsOf, discrepancyDoc } from './ledgerOps.js';
import { bizIds, counterparty } from './records.js';
import { enqueueCard } from './goodsChat.js';
import { partyNames } from './views.js';
import { postReceipt, postSend, pseudo, real, type Goods } from '../../../shared/sc/postings.js';
import { todayIST } from '../../../shared/sc/dates.js';
import type { Dimension, PartyRef, Posting, RealKey } from '../../../shared/sc/types.js';

const router = Router();
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const partyRef = z.object({ k: z.enum(['b', 'c']), id: z.string().min(1).max(64) });
const grade = z.enum(['A', 'B', 'rework', 'reject', 'scrap']);

export const TRADE_KINDS = ['sell', 'return_to_supplier', 'sample', 'returnable_sample', 'buy', 'buyer_returned', 'collect', 'move'] as const;
type Kind = (typeof TRADE_KINDS)[number];
const OUTGOING: Kind[] = ['sell', 'return_to_supplier', 'sample', 'returnable_sample', 'move'];
const TITLE_PASSES: Kind[] = ['sell', 'return_to_supplier', 'sample'];

const tradeBody = z.object({
  kind: z.enum(TRADE_KINDS),
  party: partyRef.optional(),
  lines: z.array(z.object({
    spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(),
    lot: z.string().trim().max(30).optional(), grade: grade.default('A'), they_sent: z.number().positive().optional(), holding_id: z.string().max(80).optional(),
  })).min(1).max(30),
  from_place_id: z.string().max(40).optional(),
  to_place_id: z.string().max(40).optional(),
  /** Sell from goods of mine held at someone else's unit (AA), or collect them. */
  from_party: partyRef.optional(),
  /** buy: kept at the seller (N). sell: kept for the buyer at my unit. No goods move. */
  in_place: z.boolean().optional(),
  returnable_until: date.optional(),
  business_date: date.optional(),
  dc_no: z.string().trim().max(30).optional(),
  note: z.string().trim().max(300).optional(),
  rate_paise: z.number().int().min(0).max(100_000_000).optional(),
  client_id: z.string().min(8).max(40),
  allow_untracked: z.boolean().optional(),
  untracked_reason: z.string().trim().max(120).optional(),
});

/** A holding row of mine to draw from: the one picked, or the matching available row at the holder. */
async function sourceKey(ctx: Ctx, goods: Goods, holder: PartyRef, place: string | null, holdingIdIn?: string): Promise<{ key: RealKey; have: number }> {
  const self = me(ctx);
  if (holdingIdIn) {
    const h0: any = await col('sc_holdings').findOne({ _id: holdingIdIn, t: 'real' } as any);
    const k = h0?.key as RealKey | undefined;
    if (!k || !sameParty(k.owner, self) || !['available', 'ready'].includes(k.state.s) || k.spec !== goods.spec) throw new HttpError(400, 'Please pick the goods again.');
    return { key: k, have: Math.max(0, h0.qty_base) };
  }
  const key = real(goods, self, holder, { s: 'available' }, { place });
  const h0: any = await col('sc_holdings').findOne({ _id: holdingId(key, goods.dim) } as any);
  return { key, have: Math.max(0, h0?.qty_base ?? 0) };
}

router.post(
  '/sc/movements/trade',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(tradeBody, req.body);
    const self = me(ctx);
    const kind = b.kind;
    if (b.allow_untracked && ctx.role !== 'owner') return res.status(403).json({ error: 'Only the owner can record stock you never entered.', code: 'needs_owner' });
    if (kind === 'move') {
      if (!b.to_place_id || b.to_place_id === (b.from_place_id ?? null)) throw new HttpError(400, 'Pick where the goods went.');
      if (!(await col('sc_places').findOne({ _id: b.to_place_id, business_id: ctx.businessId } as any))) throw new HttpError(404, 'Not found');
    } else if (!b.party) throw new HttpError(400, 'Please pick who it is with.');
    const cp = b.party ? await counterparty(ctx, b.party) : { party: self, onPlatform: false };
    const party = cp.party;
    // Incoming records are for parties not on CLAIRE: a business on CLAIRE records its own side (03 §6).
    if ((kind === 'buy' || kind === 'buyer_returned' || kind === 'collect') && cp.onPlatform) return res.status(409).json({ error: 'They are on CLAIRE: they record it and you confirm it.', code: 'they_record' });
    if (b.in_place && !['buy', 'sell'].includes(kind)) throw new HttpError(400, 'Please check the details and try again.');
    const holder: PartyRef = kind === 'collect' ? party : b.from_party ?? self;
    if (b.from_party && !sameParty(b.from_party, self)) await counterparty(ctx, b.from_party);
    const businessDate = b.business_date ?? todayIST();
    const movementId = newId('mv');
    const now = Date.now();
    const terms = await termsFor(ctx, kind === 'move' ? self : party);
    const fromPlace = sameParty(holder, self) ? b.from_place_id ?? null : null;
    const toPlace = b.to_place_id ?? null;
    const shared = kind !== 'move' && cp.onPlatform && !b.in_place;
    const viewers = bizIds(self, ...(kind === 'move' ? [] : [party]), ...(sameParty(holder, self) || kind === 'collect' ? [] : [holder]));
    const short: { index: number; available: number; needed: number; dim: Dimension }[] = [];
    const postings: Posting[] = [];
    const lines: any[] = [];
    const settleQueue: { line: any; sent: number; received: number }[] = [];
    const transitCustodian = kind === 'buy' || kind === 'buyer_returned' || kind === 'collect' ? party : holder;

    for (const [i, l] of b.lines.entries()) {
      const info = await specInfo(l.spec_id);
      const q = qtyBase(l.qty, l.unit, info, l.factor).base;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: l.grade, dim: info.dim };
      const lineId = newId('ln');
      const ownerAfter: PartyRef = TITLE_PASSES.includes(kind) ? party : self;
      // Where the goods come from.
      let fromUntracked = 0;
      let src: RealKey | null = null;
      if (OUTGOING.includes(kind) || kind === 'collect') {
        const s0 = await sourceKey(ctx, goods, holder, fromPlace, l.holding_id);
        src = s0.key;
        if (s0.have < q) short.push({ index: i, available: s0.have, needed: q, dim: info.dim });
        fromUntracked = Math.max(0, q - s0.have);
      }
      const g: Goods = src ? { spec: src.spec, lot: src.lot, grade: src.grade, dim: info.dim } : goods;
      const drawFrom = (qty: number): Posting[] => {
        const out: Posting[] = [];
        const fromStock = qty - fromUntracked;
        if (src && fromStock > 0) out.push({ key: src, delta: -fromStock, dim: info.dim });
        if (src && fromUntracked > 0) out.push({ key: pseudo(g, 'EXTERNAL', `b:${ctx.businessId}`, self), delta: -fromUntracked, dim: info.dim });
        if (!src) out.push({ key: pseudo(g, 'EXTERNAL', `${party.k}:${party.id}`, self), delta: -qty, dim: info.dim });
        return out;
      };
      const line: any = {
        line_id: lineId, spec_id: info.id, label_en: info.label_en, role: info.role, lot: g.lot, grade: g.grade, dim: info.dim, class: info.cls,
        entered: { value: l.qty, unit: l.unit, factor: l.factor ?? null }, owner_before: self, owner_after: ownerAfter, dest_external: false, job_id: null, line_kind: 'goods',
        from_untracked: fromUntracked, viewer_business_ids: viewers, sent: [] as any[], received: [] as any[], settled: null,
      };

      if (kind === 'move') {
        // Between my own places: no transit, nothing to confirm.
        postings.push(...drawFrom(q), { key: real(g, self, self, { s: 'available' }, { place: toPlace }), delta: q, dim: info.dim });
        line.sent.push(assertion(ctx, q, 'account', businessDate, { final: true }));
        line.received.push(assertion(ctx, q, 'account', businessDate, { final: true }));
      } else if (b.in_place) {
        // N (bought, kept at the seller) / sold, kept for the buyer at my unit: the owner changes, the goods stay.
        const custodian = kind === 'buy' ? party : self;
        const owner = kind === 'buy' ? self : party;
        postings.push(...drawFrom(q));
        if (kind === 'sell') postings.push({ key: pseudo(g, 'EXTERNAL', `${party.k}:${party.id}`, self), delta: q, dim: info.dim }, { key: pseudo(g, 'EXTERNAL', `b:${ctx.businessId}`, owner), delta: -q, dim: info.dim });
        postings.push({ key: real(g, owner, custodian, { s: 'available' }, { place: kind === 'sell' ? fromPlace : null }), delta: q, dim: info.dim });
        line.owner_after = owner;
        line.sent.push(assertion(ctx, q, 'account', businessDate, { final: true }));
        line.received.push(assertion(ctx, q, 'account', businessDate, { final: true, reason: 'in_place' }));
      } else {
        // Through transit: sent now; received now when I'm the receiver or they are not on CLAIRE, else on their confirm.
        const declared = l.they_sent !== undefined ? qtyBase(l.they_sent, l.unit, info, l.factor).base : q;
        const sent = kind === 'buy' || kind === 'buyer_returned' ? declared : q;
        postings.push(...drawFrom(sent));
        postings.push({ key: real(g, self, transitCustodian, { s: 'in_transit', ref: movementId }), delta: sent, dim: info.dim });
        line.sent.push(assertion(ctx, sent, kind === 'buy' || kind === 'buyer_returned' ? (l.they_sent !== undefined ? 'on_behalf' : 'implied') : 'account', businessDate, { final: true }));
        const iReceive = kind === 'buy' || kind === 'buyer_returned' || kind === 'collect';
        line.dest_external = !iReceive && !cp.onPlatform && kind !== 'returnable_sample';
        if (iReceive || !cp.onPlatform) {
          const received = iReceive ? q : sent;
          const dest = iReceive ? { party: self, place: toPlace } : { party, external: line.dest_external };
          postings.push(...postReceipt({ goods: g, owner: self, movementId, transitCustodian, to: dest, delta: Math.min(received, sent), ...(line.dest_external || sameParty(line.owner_after, self) ? {} : { ownerAfter: line.owner_after }) }));
          line.received.push(assertion(ctx, received, iReceive ? 'account' : 'self', businessDate, { final: true, ...(iReceive ? {} : { reason: 'based_on_sent' }) }));
          if (received !== sent) settleQueue.push({ line, sent, received });
        }
      }
      lines.push(line);
    }
    if (short.length && !b.allow_untracked) return res.status(409).json({ error: 'You have less of this than you are recording.', code: 'negative', lines: short });

    const movement: any = {
      _id: movementId, id: movementId, client_id: b.client_id, action: kind, purpose: b.in_place ? `${kind}_in_place` : kind,
      from: { party: kind === 'buy' || kind === 'buyer_returned' || kind === 'collect' ? party : holder, place_id: fromPlace },
      to: { party: kind === 'move' || kind === 'buy' || kind === 'buyer_returned' || kind === 'collect' ? self : party, place_id: toPlace },
      transit_custodian: transitCustodian, lines, terms_snapshot: terms, dc_no: b.dc_no ?? null, note: b.note ?? null, returnable_until: b.returnable_until ?? null,
      untracked_reason: b.allow_untracked ? b.untracked_reason ?? null : null,
      business_date: businessDate, recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId,
      visible_at: shared ? now + UNDO_MS : now, cancelled_at: null, party_business_ids: viewers, version: 1,
    };
    const discrepancies: any[] = [];
    for (const x of settleQueue) {
      const c = settleCtxFor(movement, x.line);
      const st = settleLine(goodsOf(x.line), x.line.class, x.sent, x.received, c);
      postings.push(...st.postings);
      x.line.settled = { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct };
      if (st.disputeId) discrepancies.push(discrepancyDoc(st.disputeId, movement, x.line, c, x.sent, x.received, st.outcome));
    }
    const result = await post(ctx, { type: kind, ref: { kind: 'movement', id: movementId }, payload: { in_place: !!b.in_place }, business_date: businessDate, client_id: b.client_id, visible_at: movement.visible_at }, postings, async (session) => {
      await col('sc_movements').insertOne(movement, { session });
      if (discrepancies.length) await col('sc_discrepancies').insertMany(discrepancies, { session });
      if (b.rate_paise && ctx.role === 'owner') {
        await col('sc_prices').insertOne({ _id: newId('pr'), business_id: ctx.businessId, movement_id: movementId, kind, rate_paise: b.rate_paise, unit: b.lines[0].unit, created_at: now } as any, { session });
      }
    });
    if (result.duplicate) return res.json({ duplicate: true });
    if (shared) await enqueueCard('movement', movementId, 'sent', movement.visible_at);
    res.status(201).json({ movement: { id: movementId, lines: lines.map((l) => ({ line_id: l.line_id, settled: l.settled })) }, undo_until: shared ? movement.visible_at : null });
  }),
);

/** My goods that can be sold, sampled, moved, adjusted: at my unit and at others' (not allocated to a job). */
router.get(
  '/sc/stock',
  h(async (req: ScRequest, res) => {
    const rows = (await col('sc_holdings').find({ t: 'real', 'key.owner.k': 'b', 'key.owner.id': req.ctx.businessId, 'key.state.s': { $in: ['available', 'ready'] }, qty_base: { $gt: 0 } } as any).limit(400).toArray()) as any[];
    const specs = await col('sc_specs').find({ _id: { $in: [...new Set(rows.map((r) => r.key.spec))] } } as any).toArray();
    const mts = await col('sc_material_types').find({ _id: { $in: [...new Set(specs.map((s: any) => s.material_type_id))] } } as any).toArray();
    const mtBy = new Map(mts.map((m: any) => [m._id, m]));
    const specBy = new Map(specs.map((s: any) => [s._id, s]));
    const places = new Map((await col('sc_places').find({ business_id: req.ctx.businessId } as any).toArray()).map((p: any) => [p._id, p.name]));
    const names = await partyNames(req.ctx, rows.map((r) => r.key.custodian));
    res.json({
      rows: rows.map((r) => {
        const k = r.key as RealKey;
        const sp: any = specBy.get(k.spec);
        const mt: any = mtBy.get(sp?.material_type_id);
        const atMe = k.custodian.k === 'b' && k.custodian.id === req.ctx.businessId;
        return {
          id: r._id, spec: sp ? { id: sp._id, material_type_id: sp.material_type_id, attrs: sp.attrs, label_en: sp.label_en, family_key: sp.family_key } : null, dimension: mt?.base_dimension, units: mt?.allowed_units ?? [], class: mt?.material_class_key,
          lot: k.lot, grade: k.grade, state: k.state.s, place_id: k.place, place: k.place ? places.get(k.place) ?? null : null, qty: r.qty_base,
          with: atMe ? null : { party: k.custodian, name: names.get(`${k.custodian.k}:${k.custodian.id}`)?.name ?? '—' },
        };
      }),
    });
  }),
);

// ── Sale in place of allocated goods (04 §5.6.6) ────────────────────────────────────────────────

/**
 * Selling part of goods allocated to an open job splits off a child job for the buyer's share: owner = buyer, client
 * = buyer, same performer. The parent's allocation shrinks; the buyer sees the child job and the sold lines only.
 */
router.post(
  '/sc/jobs/:id/sell-part',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can sell goods.');
    const b = parse(z.object({ to: partyRef, lines: z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), lot: z.string().trim().max(30).optional() })).min(1).max(20), business_date: date.optional(), client_id: z.string().min(8).max(40), rate_paise: z.number().int().min(0).optional() }), req.body);
    const j: any = await col('sc_jobs').findOne({ _id: req.params.id, 'owner_party.k': 'b', 'owner_party.id': ctx.businessId, 'client_party.k': 'b', 'client_party.id': ctx.businessId, status: { $in: ['issued', 'in_progress', 'completed'] } } as any);
    if (!j) throw new HttpError(404, 'Not found');
    const cp = await counterparty(ctx, b.to);
    if (sameParty(cp.party, j.performer_party)) throw new HttpError(400, 'To sell to the job worker, record it as kept and adjusted when you close the job.');
    const buyer = cp.party;
    const self = me(ctx);
    const businessDate = b.business_date ?? todayIST();
    const movementId = newId('mv');
    const childId = newId('jb');
    const now = Date.now();
    const performer = j.performer_party as PartyRef;
    const via = (j.via ?? null) as PartyRef | null;
    const viewers = bizIds(self, buyer, performer);
    const postings: Posting[] = [];
    const lines: any[] = [];
    let sold = 0;
    for (const l of b.lines) {
      const info = await specInfo(l.spec_id);
      const q = qtyBase(l.qty, l.unit, info).base;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: 'A', dim: info.dim };
      const key = real(goods, self, performer, { s: 'allocated', ref: j._id }, { via });
      const h0: any = await col('sc_holdings').findOne({ _id: holdingId(key, info.dim) } as any);
      if ((h0?.qty_base ?? 0) < q) return res.status(409).json({ error: 'That is more than is at the job worker for this job.', code: 'negative', lines: [{ available: Math.max(0, h0?.qty_base ?? 0), needed: q, dim: info.dim }] });
      if (info.role !== 'secondary') sold += q;
      postings.push(
        { key, delta: -q, dim: info.dim },
        { key: pseudo(goods, 'EXTERNAL', `${buyer.k}:${buyer.id}`, self), delta: q, dim: info.dim },
        { key: pseudo(goods, 'EXTERNAL', `b:${ctx.businessId}`, buyer), delta: -q, dim: info.dim },
        { key: real(goods, buyer, performer, { s: 'allocated', ref: childId }, { via }), delta: q, dim: info.dim },
      );
      lines.push({
        line_id: newId('ln'), spec_id: info.id, label_en: info.label_en, role: info.role, lot: goods.lot, grade: 'A', dim: info.dim, class: info.cls,
        entered: { value: l.qty, unit: l.unit }, owner_before: self, owner_after: buyer, dest_external: false, job_id: childId, line_kind: 'goods', viewer_business_ids: viewers,
        sent: [assertion(ctx, q, 'account', businessDate, { final: true })], received: [assertion(ctx, q, 'account', businessDate, { final: true, reason: 'in_place' })], settled: null,
      });
    }
    const movement: any = {
      _id: movementId, id: movementId, client_id: b.client_id, action: 'sell', purpose: 'sale_allocated', from: { party: self, place_id: null }, to: { party: buyer, place_id: null },
      transit_custodian: performer, at_party: performer, parent_job_id: j._id, lines, terms_snapshot: await termsFor(ctx, buyer), business_date: businessDate,
      recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId, visible_at: now, cancelled_at: null, party_business_ids: viewers, version: 1,
    };
    const child = {
      _id: childId, id: childId, process_key: j.process_key, process_type_id: j.process_type_id, conservation_kind: j.conservation_kind, loss_norm_pct: j.loss_norm_pct, rate_basis: j.rate_basis,
      owner_party: buyer, client_party: buyer, performer_party: performer, via, parent_job_id: null, split_from_job_id: j._id, status: j.status === 'completed' ? 'in_progress' : j.status,
      inputs: lines.map((l) => ({ movement_id: movementId, line_id: l.line_id, spec_id: l.spec_id, dim: l.dim, lot: l.lot, role: l.role ?? 'primary' })), issued_sent: sold, sent_inputs: sold, sent_outputs: 0,
      outputs: [], returns: [], promised_at: null, expected_at: j.expected_at, business_date: businessDate, pauses: [], party_business_ids: bizIds(buyer, performer), created_at: now, version: 1,
    };
    const r = await post(ctx, { type: 'sale_allocated', ref: { kind: 'movement', id: movementId }, payload: { job_id: j._id, child_job_id: childId }, business_date: businessDate, client_id: b.client_id }, postings, async (session) => {
      await col('sc_movements').insertOne(movement, { session });
      await col('sc_jobs').insertOne(child as any, { session });
      await col('sc_jobs').updateOne({ _id: j._id } as any, { $push: { splits: { movement_id: movementId, child_job_id: childId, buyer } } as any, $inc: { version: 1 } }, { session });
    });
    if (r.duplicate) return res.json({ duplicate: true });
    if (buyer.k === 'b') await enqueueCard('movement', movementId, 'sent', now);
    res.status(201).json({ movement: { id: movementId }, job: { id: childId } });
  }),
);

export default router;
