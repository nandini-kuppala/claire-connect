// Slice 4.5 adjustments (model §3.6): change grade, change material (respec, E2), change or split a lot, found, write
// off, count; and casualty (fire, theft, flood) at my unit, which opens one difference per owner whose goods were lost.
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { alreadyRecorded, holdingId, newId, post } from './repo.js';
import { me, qtyBase, sameParty, specInfo } from './ledgerOps.js';
import { enqueueCard } from './goodsChat.js';
import { COUNT_THRESHOLD } from './staff.js';
import { postCount, postRegrade, postRespec, pseudo, real, type Goods } from '../../../shared/sc/postings.js';
import { todayIST } from '../../../shared/sc/dates.js';
import type { Dimension, PartyRef, Posting, RealKey } from '../../../shared/sc/types.js';

const router = Router();
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const OWNER_ONLY = ['respec', 'found', 'write_off'];

async function myHolding(ctx: Ctx, id: string) {
  const h0: any = await col('sc_holdings').findOne({ _id: id, t: 'real' } as any);
  const k = h0?.key as RealKey | undefined;
  if (!k || !sameParty(k.owner, me(ctx)) || !['available', 'ready'].includes(k.state.s)) throw new HttpError(404, 'Not found');
  return { key: k, dim: h0.dimension as Dimension, qty: h0.qty_base as number };
}

router.post(
  '/sc/adjust',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(
      z.object({
        op: z.enum(['regrade', 'respec', 'relot', 'found', 'write_off', 'count']),
        holding_id: z.string().max(80).optional(),
        spec_id: z.string().optional(), // found: what was found, when it isn't in an existing row
        place_id: z.string().max(40).optional(),
        qty: z.number().positive().optional(), unit: z.string().max(10).optional(),
        to_grade: z.enum(['A', 'B', 'rework', 'reject', 'scrap']).optional(), to_spec_id: z.string().optional(), to_lot: z.string().trim().max(30).optional(), lot: z.string().trim().max(30).optional(),
        reason: z.string().trim().max(200).optional(), business_date: date.optional(), client_id: z.string().min(8).max(40),
      }),
      req.body,
    );
    if (OWNER_ONLY.includes(b.op) && ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can do this.');
    if (await alreadyRecorded(ctx, b.client_id)) return res.json({ duplicate: true });
    const self = me(ctx);
    const businessDate = b.business_date ?? todayIST();
    const postings: Posting[] = [];
    let key: RealKey;
    let dim: Dimension;
    let have = 0;
    if (b.op === 'found' && !b.holding_id) {
      if (!b.spec_id) throw new HttpError(400, 'Please pick what you found.');
      const info = await specInfo(b.spec_id);
      key = real({ spec: info.id, lot: b.lot || null, grade: 'A', dim: info.dim }, self, self, { s: 'available' }, { place: b.place_id ?? null });
      dim = info.dim;
    } else {
      if (!b.holding_id) throw new HttpError(400, 'Please pick the goods.');
      const hd = await myHolding(ctx, b.holding_id);
      key = hd.key; dim = hd.dim; have = hd.qty;
    }
    // Counts and found goods are about what is physically at my own unit.
    if ((b.op === 'count' || b.op === 'found') && !sameParty(key.custodian, self)) throw new HttpError(400, 'Count goods at your own unit; for goods with others, ask them.');
    const info = await specInfo(key.spec);
    const q = b.qty !== undefined ? qtyBase(b.qty, b.unit ?? info.units[0], info).base : have;
    const g: Goods = { spec: key.spec, lot: key.lot, grade: key.grade, dim };
    if (b.op !== 'count' && b.op !== 'found' && (q <= 0 || q > have)) throw new HttpError(400, 'That is more than you have here.');
    switch (b.op) {
      case 'regrade':
        if (!b.to_grade || b.to_grade === key.grade) throw new HttpError(400, 'Pick the new grade.');
        postings.push(...postRegrade(key, dim, q, b.to_grade));
        break;
      case 'respec': {
        if (!b.to_spec_id || b.to_spec_id === key.spec) throw new HttpError(400, 'Pick the right material.');
        const to = await specInfo(b.to_spec_id);
        if (to.dim !== dim) throw new HttpError(400, `${to.label_en} is measured differently; record it as a new material instead.`);
        postings.push(...postRespec(key, dim, q, to.id));
        break;
      }
      case 'relot':
        if ((b.to_lot || null) === key.lot) throw new HttpError(400, 'Type the new lot.');
        postings.push({ key, delta: -q, dim }, { key: { ...key, lot: b.to_lot || null }, delta: q, dim });
        break;
      case 'found':
        if (!(q > 0)) throw new HttpError(400, 'Please enter a quantity.');
        postings.push({ key, delta: q, dim }, { key: pseudo(g, 'ADJUSTMENT', 'found', self), delta: -q, dim });
        break;
      case 'write_off':
        if (!b.reason || b.reason.length < 2) throw new HttpError(400, 'Say why it is written off.');
        postings.push({ key, delta: -q, dim }, { key: pseudo(g, 'WRITTEN_OFF', 'write_off', self), delta: q, dim });
        break;
      case 'count': {
        if (b.qty === undefined) throw new HttpError(400, 'Enter what you counted.');
        // D5: a staff count that differs from the book by more than 5 pcs / 2 kg waits for the owner; nothing posts yet.
        if (ctx.role === 'staff' && Math.abs(q - have) > COUNT_THRESHOLD[dim]) {
          const pid = newId('aj');
          // An offline retry of the same count must not ask the owner twice.
          const again: any = await col('sc_adjustments').findOne({ business_id: ctx.businessId, client_id: b.client_id } as any);
          if (again) return res.status(202).json({ adjustment: { id: again._id, op: 'count', qty: again.qty, difference: again.qty - again.book, pending: again.state === 'pending' }, duplicate: true });
          await col('sc_adjustments').insertOne({ _id: pid, id: pid, business_id: ctx.businessId, client_id: b.client_id, op: 'count', state: 'pending', key, dim, qty: q, book: have, to: {}, reason: b.reason ?? null, business_date: businessDate, by: ctx.userId, at: Date.now() } as any);
          return res.status(202).json({ adjustment: { id: pid, op: 'count', qty: q, difference: q - have, pending: true } });
        }
        postings.push(...postCount(key, dim, have, q, 'count'));
        break;
      }
    }
    const id = newId('aj');
    const result = await post(ctx, { type: `adjust_${b.op}`, ref: { kind: 'adjustment', id }, payload: { op: b.op }, business_date: businessDate, client_id: b.client_id }, postings, async (session) => {
      // A count sets the book to what was counted: if another count or record moved it meanwhile, the difference
      // computed above is stale, so refuse rather than apply it twice.
      if (b.op === 'count') {
        const hdoc: any = await col('sc_holdings').findOne({ _id: holdingId(key, dim) } as any, { session });
        if ((hdoc?.qty_base ?? 0) !== q) throw new HttpError(409, 'The stock changed while you were counting. Please count again.');
      }
      await col('sc_adjustments').insertOne({ _id: id, id, business_id: ctx.businessId, op: b.op, key, dim, qty: q, book: have, to: { grade: b.to_grade ?? null, spec_id: b.to_spec_id ?? null, lot: b.to_lot ?? null }, reason: b.reason ?? null, business_date: businessDate, by: ctx.userId, at: Date.now() } as any, { session });
    });
    if ((result as { duplicate?: boolean } | undefined)?.duplicate) return res.json({ duplicate: true });
    res.status(201).json({ adjustment: { id, op: b.op, qty: q, difference: b.op === 'count' ? q - have : null } });
  }),
);

/** Adjustment history for my goods, newest first. */
router.get(
  '/sc/adjust',
  h(async (req: ScRequest, res) => {
    const rows = await col('sc_adjustments').find({ business_id: req.ctx.businessId } as any).sort({ at: -1 }).limit(50).toArray();
    const specs = new Map((await col('sc_specs').find({ _id: { $in: [...new Set(rows.flatMap((r: any) => [r.key.spec, r.to?.spec_id].filter(Boolean)))] } } as any).toArray()).map((s: any) => [s._id, s.label_en]));
    res.json({ adjustments: rows.map((r: any) => ({ id: r._id, op: r.op, label: specs.get(r.key.spec) ?? '', to_label: r.to?.spec_id ? specs.get(r.to.spec_id) ?? '' : null, lot: r.key.lot, grade: r.key.grade, to: r.to, qty: r.qty, book: r.book, dim: r.dim, reason: r.reason, business_date: r.business_date })) });
  }),
);

// ── Casualty (model §3.6) ───────────────────────────────────────────────────────────────────────

/** Everything physically at my unit, mine and others', for the casualty form (others' goods: their owner's name). */
router.get(
  '/sc/adjust/at-my-unit',
  h(async (req: ScRequest, res) => {
    const rows = (await col('sc_holdings').find({ t: 'real', 'key.custodian.k': 'b', 'key.custodian.id': req.ctx.businessId, 'key.state.s': { $in: ['available', 'ready', 'allocated'] }, qty_base: { $gt: 0 } } as any).limit(400).toArray()) as any[];
    const specs = new Map((await col('sc_specs').find({ _id: { $in: [...new Set(rows.map((r) => r.key.spec))] } } as any).toArray()).map((s: any) => [s._id, s.label_en]));
    const { partyNames } = await import('./views.js');
    const names = await partyNames(req.ctx, rows.map((r) => r.key.via ?? r.key.owner));
    res.json({
      rows: rows.map((r) => {
        const k = r.key as RealKey;
        const mine = sameParty(k.owner, me(req.ctx));
        // A sub-contractor sees whom it works for (via), never the owner behind it (mask, 03 §8).
        const shown = (k.via ?? k.owner) as PartyRef;
        return { id: r._id, label: specs.get(k.spec) ?? '', lot: k.lot, grade: k.grade, dim: r.dimension, qty: r.qty_base, state: k.state.s, job_id: k.state.s === 'allocated' ? k.state.ref ?? null : null, mine, for: mine ? null : names.get(`${shown.k}:${shown.id}`)?.name ?? '—' };
      }),
    });
  }),
);

router.post(
  '/sc/adjust/casualty',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can do this.');
    const b = parse(z.object({ cause: z.enum(['fire', 'theft', 'flood', 'other']), note: z.string().trim().max(300).optional(), items: z.array(z.object({ holding_id: z.string().max(80), qty: z.number().positive(), unit: z.string().max(10) })).min(1).max(60), business_date: date.optional(), client_id: z.string().min(8).max(40) }), req.body);
    const self = me(ctx);
    const businessDate = b.business_date ?? todayIST();
    const postings: Posting[] = [];
    const byOwner = new Map<string, { owner: PartyRef; shown: PartyRef; dqId: string; items: any[]; jobs: Set<string> }>();
    for (const it of b.items) {
      const h0: any = await col('sc_holdings').findOne({ _id: it.holding_id, t: 'real' } as any);
      const k = h0?.key as RealKey | undefined;
      if (!k || !sameParty(k.custodian, self) || !['available', 'ready', 'allocated'].includes(k.state.s)) throw new HttpError(404, 'Not found');
      const info = await specInfo(k.spec);
      const q = qtyBase(it.qty, it.unit, info).base;
      if (q > h0.qty_base) throw new HttpError(400, 'That is more than was here.');
      const g: Goods = { spec: k.spec, lot: k.lot, grade: k.grade, dim: h0.dimension };
      if (sameParty(k.owner, self)) {
        postings.push({ key: k, delta: -q, dim: h0.dimension }, { key: pseudo(g, 'WRITTEN_OFF', `casualty_${b.cause}`, self), delta: q, dim: h0.dimension });
        continue;
      }
      // Someone else's goods: held at my unit until their owner settles it, one difference per owner (or per client I
      // work for under a sub-contract: I never learn the owner behind it).
      const shown = (k.via ?? k.owner) as PartyRef;
      const gk = `${k.owner.k}:${k.owner.id}|${shown.k}:${shown.id}`;
      if (!byOwner.has(gk)) byOwner.set(gk, { owner: k.owner, shown, dqId: newId('dq'), items: [], jobs: new Set() });
      const grp = byOwner.get(gk)!;
      const held: RealKey = { ...k, state: { s: 'held', reason: 'casualty', ref: grp.dqId } };
      postings.push({ key: k, delta: -q, dim: h0.dimension }, { key: held, delta: q, dim: h0.dimension });
      grp.items.push({ key: k, held, dim: h0.dimension, qty: q, label: info.label_en, class: info.cls });
      if (k.state.s === 'allocated' && k.state.ref) grp.jobs.add(k.state.ref);
    }
    const id = newId('aj');
    const docs = [...byOwner.values()].map((g) => {
      const total = g.items.reduce((a, x) => a + x.qty, 0);
      const parties = [...new Set([ctx.businessId, ...(g.shown.k === 'b' ? [g.shown.id] : [])])];
      return {
        _id: g.dqId, id: g.dqId, kind: 'casualty', cause: b.cause, note: b.note ?? null, refs: { movement_id: null, line_id: null, job_id: [...g.jobs][0] ?? null, job_ids: [...g.jobs], adjustment_id: id },
        parties, sent_by: g.shown.k === 'b' ? g.shown.id : null, received_by: ctx.businessId, owner: g.owner,
        line_label: g.items.length === 1 ? g.items[0].label : `${g.items[0].label} +${g.items.length - 1}`, dim: g.items[0].dim, class: g.items[0].class,
        figures: { sent: total, received: 0 }, difference: total, pct: 100, allowed: 0, items: g.items,
        posting: { custodian: self, sender: g.shown, receiver: self, counted: g.items[0].class === 'counted' }, state: 'open', proposals: [] as unknown[], resolution: null, opened_at: Date.now(),
      };
    });
    await post(ctx, { type: 'casualty', ref: { kind: 'adjustment', id }, payload: { cause: b.cause }, business_date: businessDate, client_id: b.client_id }, postings, async (session) => {
      await col('sc_adjustments').insertOne({ _id: id, id, business_id: ctx.businessId, op: 'casualty', cause: b.cause, note: b.note ?? null, items: b.items, business_date: businessDate, by: ctx.userId, at: Date.now(), key: { spec: '' } } as any, { session });
      if (docs.length) await col('sc_discrepancies').insertMany(docs as any[], { session });
    });
    for (const d of docs) if (d.parties.length > 1) await enqueueCard('dispute', d._id, 'opened', Date.now());
    res.status(201).json({ adjustment: { id }, disputes: docs.map((d) => ({ id: d._id, for: d.sent_by, qty: d.difference, dim: d.dim })) });
  }),
);

/** Casualty outcomes (model §3.6): accept the loss (written off, against the unit where it happened), or not lost. */
export function casualtyPostings(d: any, outcome: 'sent' | 'received' | 'split' | 'credit'): Posting[] {
  const out: Posting[] = [];
  for (const it of d.items as any[]) {
    const g: Goods = { spec: it.key.spec, lot: it.key.lot, grade: it.key.grade, dim: it.dim };
    const back = outcome === 'sent' ? it.qty : outcome === 'split' ? Math.floor(it.qty / 2) : 0;
    const lost = it.qty - back;
    out.push({ key: it.held, delta: -it.qty, dim: it.dim });
    if (back) out.push({ key: it.key, delta: back, dim: it.dim });
    if (lost) out.push({ key: pseudo(g, 'WRITTEN_OFF', `casualty_${d.cause}`, it.key.owner, d.posting.custodian), delta: lost, dim: it.dim });
  }
  return out;
}

export default router;
