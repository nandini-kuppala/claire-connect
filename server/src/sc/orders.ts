// Slice 8b: orders ↔ goods (04 §11, 03 J8/J15/S18). When both businesses use Goods, an order's deliveries are movements
// (partial receipts add up), returns are movements back, and a job-work order links to the jobs sent for it. When the
// receipts (or the work back) cover the order, the order is marked delivered through the existing order flow, so the
// balance-due notice, the rating card and Trade Desk's overdue checks keep working unchanged.
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { recordTrade } from './trade.js';
import { sendForWork } from './records.js';
import { partyNames } from './views.js';
import { orderEvent } from '../deals.js';
import { todayIST, workingDaysBetween } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import { toBase } from '../../../shared/sc/units.js';
import type { Dimension, PartyRef } from '../../../shared/sc/types.js';

const router = Router();

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};
const FLOW = ['confirmed', 'advance_paid', 'in_production', 'dispatched', 'delivered', 'balance_paid', 'closed'];

/** The order's unit as a Goods unit: "piece" → pcs, "metre" → m. */
const UNIT_MAP: Record<string, { unit: string; dim: Dimension }> = {
  piece: { unit: 'pcs', dim: 'count' }, pieces: { unit: 'pcs', dim: 'count' }, pcs: { unit: 'pcs', dim: 'count' }, pc: { unit: 'pcs', dim: 'count' },
  dozen: { unit: 'dozen', dim: 'count' }, set: { unit: 'pcs', dim: 'count' }, sets: { unit: 'pcs', dim: 'count' },
  kg: { unit: 'kg', dim: 'mass' }, kgs: { unit: 'kg', dim: 'mass' }, metre: { unit: 'm', dim: 'length' }, meter: { unit: 'm', dim: 'length' }, m: { unit: 'm', dim: 'length' }, metres: { unit: 'm', dim: 'length' },
};
export function orderUnit(o: any): { unit: string; dim: Dimension; perUnitBase: number } {
  const u = UNIT_MAP[String(o.unit ?? 'piece').toLowerCase()] ?? UNIT_MAP.piece;
  const one = toBase(1, u.unit, u.dim);
  return { ...u, perUnitBase: one.ok ? one.base : 1 };
}

async function bothOnGoods(o: any): Promise<boolean> {
  const n = await col('businesses').countDocuments({ _id: { $in: [o.buyer_business_id, o.seller_business_id] }, 'flags.sc': true } as any);
  return n === 2;
}

async function myOrder(ctx: Ctx, id: string) {
  const o: any = await col('orders').findOne({ _id: id, $or: [{ buyer_business_id: ctx.businessId }, { seller_business_id: ctx.businessId }] } as any);
  if (!o) throw new HttpError(404, 'Not found');
  return o;
}

export interface OrderProgress {
  ordered: number; dim: Dimension; sent: number; received: number; on_the_way: number; returned: number; done: number; opening: number;
  deliveries: { movement_id: string; sent: number; received: number | null; sent_on: string; state: 'on_the_way' | 'received' | 'different'; dc_no: string | null; items: { spec_id: string; label: string; qty: number }[] }[];
  returns: { movement_id: string; qty: number; on: string; reason: string | null }[];
  jobs: { id: string; status: string; back: number }[];
}

/** Everything recorded against an order, seen by one of its two businesses (the other's undo window respected). */
export async function orderProgress(o: any, viewer?: string): Promise<OrderProgress> {
  const u = orderUnit(o);
  const ordered = Math.round(o.qty * u.perUnitBase);
  const now = Date.now();
  const movs = ((await col('sc_movements').find({ order_id: o._id, cancelled_at: null } as any).sort({ recorded_at: 1 }).toArray()) as any[])
    .filter((m) => !viewer || m.recorder_business_id === viewer || m.visible_at <= now);
  const p: OrderProgress = { ordered, dim: u.dim, sent: 0, received: 0, on_the_way: 0, returned: 0, done: 0, opening: 0, deliveries: [], returns: [], jobs: [] };
  for (const m of movs) {
    const lines = (m.lines as any[]).filter((l) => l.dim === u.dim);
    if (m.action === 'sell' && m.from.party.id === o.seller_business_id) {
      let sent = 0, got = 0, any = false, differs = false;
      for (const l of lines) {
        const s = winningAssertion(l.sent)?.base_qty ?? 0;
        const r = l.resolved_received ?? winningAssertion((l.received as any[]).filter((a) => a.evidence !== 'implied'))?.base_qty;
        sent += s;
        if (r !== undefined && r !== null) { any = true; got += r; if (r !== s) differs = true; }
      }
      p.sent += sent;
      p.received += got;
      if (!any) p.on_the_way += sent;
      p.deliveries.push({ movement_id: m._id, sent, received: any ? got : null, sent_on: m.business_date, state: !any ? 'on_the_way' : differs ? 'different' : 'received', dc_no: m.dc_no ?? null, items: lines.map((l) => ({ spec_id: l.spec_id, label: l.label_en ?? '', qty: winningAssertion(l.sent)?.base_qty ?? 0 })) });
    } else if (m.action === 'return_to_supplier' && m.from.party.id === o.buyer_business_id) {
      const q = lines.reduce((a, l) => a + (winningAssertion(l.sent)?.base_qty ?? 0), 0);
      p.returned += q;
      p.returns.push({ movement_id: m._id, qty: q, on: m.business_date, reason: m.note ?? null });
    }
  }
  if (o.kind === 'job_work') {
    const jobs = (await col('sc_jobs').find({ order_id: o._id, status: { $ne: 'cancelled' } } as any, { projection: { status: 1, outputs: 1 } }).toArray()) as any[];
    for (const j of jobs) {
      const back = (j.outputs as any[]).filter((x) => x.dim === u.dim || u.dim === 'count').reduce((a, x) => a + x.qty, 0);
      p.jobs.push({ id: j._id, status: j.status, back });
    }
    const opening: any = await col('sc_order_openings').findOne({ _id: o._id } as any);
    p.opening = opening ? Math.round(opening.qty_done * u.perUnitBase) : 0;
    p.done = p.opening + p.jobs.reduce((a, j) => a + j.back, 0);
  } else {
    p.done = p.received;
  }
  return p;
}

async function ownerUser(bizId: string): Promise<any> {
  return col('users').findOne({ business_id: bizId, role: { $nin: ['staff', 'agent', 'supervisor'] } } as any);
}
const asUser = (u: any) => ({ ...u, id: u.id ?? u._id });

/**
 * When the goods (or the work back) cover the order, mark it delivered through the existing order flow once. That one
 * transaction sets delivered_at and the balance due date, posts the rating card and feeds Trade Desk's overdue checks.
 */
export async function orderCoverage(orderId: string): Promise<boolean> {
  const o: any = await col('orders').findOne({ _id: orderId } as any);
  if (!o || o.delivered_at || ['cancelled', 'closed', 'delivered', 'balance_paid'].includes(o.status)) return false;
  if (!(await bothOnGoods(o))) return false;
  const p = await orderProgress(o);
  if (p.done < p.ordered) return false;
  const buyer = await ownerUser(o.buyer_business_id);
  if (!buyer) return false;
  // A claim so two receipts landing together mark it once.
  const claim = await col('orders').updateOne({ _id: o._id, delivered_at: { $in: [null, undefined] }, sc_delivering: { $ne: true } } as any, { $set: { sc_delivering: true } });
  if (!claim.modifiedCount) return false;
  try {
    await orderEvent(asUser(buyer), o._id, 'delivered', { via: 'goods', received: p.done });
    return true;
  } finally {
    await col('orders').updateOne({ _id: o._id } as any, { $unset: { sc_delivering: '' } });
  }
}

const views = async (ctx: Ctx, o: any) => {
  const side = o.buyer_business_id === ctx.businessId ? 'buyer' : 'seller';
  const names = await partyNames(ctx, [{ k: 'b', id: o.buyer_business_id }, { k: 'b', id: o.seller_business_id }]);
  return { side, buyer: names.get(`b:${o.buyer_business_id}`)?.name ?? '', seller: names.get(`b:${o.seller_business_id}`)?.name ?? '' };
};

router.get(
  '/sc/orders/:id/goods',
  h(async (req: ScRequest, res) => {
    const o = await myOrder(req.ctx, req.params.id);
    const on = await bothOnGoods(o);
    const v = await views(req.ctx, o);
    const u = orderUnit(o);
    const base = { id: o._id, code: o.code, kind: o.kind, buyer_id: o.buyer_business_id, seller_id: o.seller_business_id, title: o.title, qty: o.qty, unit: o.unit, status: o.status, delivered_at: o.delivered_at ?? null, ...v, dim: u.dim, on_goods: on };
    if (!on) return res.json({ order: base, progress: null });
    const p = await orderProgress(o, req.ctx.businessId);
    const open = !['cancelled', 'closed'].includes(o.status);
    res.json({
      order: base, progress: p,
      can: { dispatch: open && v.side === 'seller' && o.kind !== 'job_work', return: v.side === 'buyer' && o.kind !== 'job_work' && p.received - p.returned > 0, send_material: open && v.side === 'buyer' && o.kind === 'job_work' && req.ctx.role === 'owner' },
    });
  }),
);

/** For the Orders tab (J8): each of my orders that has goods recorded, with what came and what is on the way. */
router.get(
  '/sc/orders/goods-summary',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const orders = (await col('orders').find({ $or: [{ buyer_business_id: ctx.businessId }, { seller_business_id: ctx.businessId }] } as any).sort({ created_at: -1 }).limit(100).toArray()) as any[];
    const ids = orders.map((o) => o._id);
    const linked = new Set<string>([
      ...((await col('sc_movements').distinct('order_id', { order_id: { $in: ids } } as any)) as string[]),
      ...((await col('sc_jobs').distinct('order_id', { order_id: { $in: ids } } as any)) as string[]),
      ...((await col('sc_order_openings').distinct('_id', { _id: { $in: ids } } as any)) as string[]),
    ]);
    const out: Record<string, { ordered: number; received: number; on_the_way: number; returned: number; done: number; dim: Dimension; kind: string; last_sent_on: string | null }> = {};
    for (const o of orders.filter((x) => linked.has(x._id))) {
      const p = await orderProgress(o, ctx.businessId);
      out[o._id] = { ordered: p.ordered, received: p.received, on_the_way: p.on_the_way, returned: p.returned, done: p.done, dim: p.dim, kind: o.kind, last_sent_on: p.deliveries.at(-1)?.sent_on ?? null };
    }
    res.json({ orders: out });
  }),
);

const goodsLines = z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), lot: z.string().trim().max(30).optional(), grade: z.enum(['A', 'B', 'rework', 'reject', 'scrap']).optional() })).min(1).max(30);

/** The seller sends (part of) the order: a sale movement linked to it. The buyer confirms it like any other record. */
router.post(
  '/sc/orders/:id/dispatch',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ lines: goodsLines, dc_no: z.string().trim().max(30).optional(), business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), client_id: z.string().min(8).max(40), from_place_id: z.string().max(40).optional(), allow_untracked: z.boolean().optional(), untracked_reason: z.string().trim().max(120).optional() }), req.body);
    const o = await myOrder(ctx, req.params.id);
    if (o.seller_business_id !== ctx.businessId) throw new HttpError(403, 'Only the seller sends the goods.');
    if (o.kind === 'job_work') throw new HttpError(400, 'For job work, the goods come back as the work is done.');
    if (['cancelled', 'closed'].includes(o.status)) throw new HttpError(409, 'This order is closed.');
    if (!(await bothOnGoods(o))) throw new HttpError(409, 'The buyer does not use Goods yet. Use the order buttons.');
    const r = await recordTrade(ctx, { kind: 'sell', party: { k: 'b', id: o.buyer_business_id }, lines: b.lines, dc_no: b.dc_no, business_date: b.business_date, client_id: b.client_id, from_place_id: b.from_place_id, allow_untracked: b.allow_untracked, untracked_reason: b.untracked_reason, note: `Order ${o.code}` }, { order_id: o._id });
    // The first dispatch moves the order to "dispatched" (once); later ones are partial deliveries on the same order.
    if (r.status === 201 && o.status !== 'disputed' && FLOW.indexOf(o.status) < FLOW.indexOf('dispatched')) {
      const u: any = await col('users').findOne({ $or: [{ _id: ctx.userId }, { id: ctx.userId }] } as any);
      // In the background: the order's chat card and notices can take seconds; the record is already saved.
      if (u) void orderEvent(asUser(u), o._id, 'dispatched', { ...(b.dc_no ? { lr: b.dc_no } : {}), via: 'goods' }).catch((e) => console.warn('[sc] order dispatched', (e as Error).message));
    }
    res.status(r.status).json(r.body);
  }),
);

/** The buyer returns some (J8): wrong size, a defect, or another reason. A movement back to the seller, linked to the order. */
router.post(
  '/sc/orders/:id/return',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ lines: goodsLines, reason: z.enum(['wrong_size', 'defect', 'other']), note: z.string().trim().max(200).optional(), business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), client_id: z.string().min(8).max(40) }), req.body);
    const o = await myOrder(ctx, req.params.id);
    if (o.buyer_business_id !== ctx.businessId) throw new HttpError(403, 'Only the buyer returns goods.');
    if (!(await bothOnGoods(o))) throw new HttpError(409, 'The seller does not use Goods yet.');
    const reason = { wrong_size: 'Wrong size', defect: 'Defect', other: 'Other' }[b.reason];
    const r = await recordTrade(ctx, { kind: 'return_to_supplier', party: { k: 'b', id: o.seller_business_id }, lines: b.lines, business_date: b.business_date, client_id: b.client_id, note: [reason, b.note].filter(Boolean).join(': ') }, { order_id: o._id });
    res.status(r.status).json(r.body);
  }),
);

/** J15: "Send material" on an accepted job-work order: the usual send, to the order's seller, linked to the order. */
router.post(
  '/sc/orders/:id/send-material',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const o = await myOrder(ctx, req.params.id);
    if (o.kind !== 'job_work' || o.buyer_business_id !== ctx.businessId) throw new HttpError(403, 'Only the one who gave the work sends material for it.');
    if (['cancelled', 'closed'].includes(o.status)) throw new HttpError(409, 'This order is closed.');
    if (!(await bothOnGoods(o))) throw new HttpError(409, 'They do not use Goods yet.');
    const body = { ...(req.body ?? {}), to: { k: 'b', id: o.seller_business_id } };
    const r = await sendForWork(ctx, body, { order_id: o._id });
    res.status(r.status).json(r.body);
  }),
);

// ── "Your history with them" (J15): private, from my own closed and open jobs ──────────────────
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

export async function historyWith(ctx: Ctx, ids: string[]) {
  const jobs = (await col('sc_jobs').find({ 'client_party.id': ctx.businessId, 'performer_party.k': 'b', 'performer_party.id': { $in: ids }, status: { $ne: 'cancelled' }, in_house: { $ne: true } } as any,
    { projection: { performer_party: 1, process_key: 1, status: 1, business_date: 1, outputs: 1, pauses: 1, 'closure.business_date': 1, 'closure.loss_pct': 1 } }).limit(3000).toArray()) as any[];
  const out: Record<string, { jobs: number; usual_days: number | null; loss_pct: number | null; processes: string[] }> = {};
  for (const id of ids) {
    const js = jobs.filter((j) => j.performer_party.id === id);
    if (!js.length) continue;
    const days: number[] = [];
    const loss: number[] = [];
    for (const j of js) {
      const end = j.closure?.business_date ?? (['completed', 'closed'].includes(j.status) ? j.outputs?.at(-1)?.business_date : null);
      if (end) days.push(Math.max(0, workingDaysBetween(j.business_date, end) - (j.pauses ?? []).reduce((a: number, p: any) => a + workingDaysBetween(p.from, p.to ?? end), 0)));
      if (typeof j.closure?.loss_pct === 'number') loss.push(j.closure.loss_pct);
    }
    const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
    out[id] = { jobs: js.length, usual_days: days.length >= 2 ? r1(median(days)) : null, loss_pct: loss.length >= 2 ? r1(median(loss)) : null, processes: [...new Set(js.map((j) => j.process_key))] };
  }
  return out;
}

router.get(
  '/sc/history',
  h(async (req: ScRequest, res) => {
    const ids = String(req.query.ids ?? '').split(',').map((s) => s.trim()).filter((s) => /^[\w-]{1,64}$/.test(s)).slice(0, 50);
    res.json({ history: ids.length ? await historyWith(req.ctx, ids) : {} });
  }),
);

// ── S18: "What work does your unit do?" (one-time card on Goods; also asked in onboarding) ─────
export const WORK_KEYS = ['knitting', 'dyeing', 'printing', 'embroidery', 'cutting', 'stitching', 'checking_packing', 'fabric_shop', 'trims_shop', 'yarn', 'transport', 'selling_garments'] as const;

router.get(
  '/sc/profile/work',
  h(async (req: ScRequest, res) => {
    const b: any = await col('businesses').findOne({ _id: req.ctx.businessId } as any, { projection: { sc_work: 1 } });
    res.json({ work: b?.sc_work ?? null, keys: WORK_KEYS });
  }),
);

router.post(
  '/sc/profile/work',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can change this.');
    const b = parse(z.object({
      processes: z.array(z.enum(WORK_KEYS)).max(WORK_KEYS.length),
      capacity: z.string().trim().max(60).optional(),
      turnaround_days: z.number().int().min(0).max(90).optional(),
      sends_work: z.boolean().optional(),
      skipped: z.boolean().optional(),
    }), req.body);
    const work = { processes: b.processes, capacity: b.capacity ?? null, turnaround_days: b.turnaround_days ?? null, sends_work: b.sends_work ?? null, skipped: !!b.skipped, at: Date.now() };
    await col('businesses').updateOne({ _id: req.ctx.businessId } as any, { $set: { sc_work: work } });
    res.json({ work });
  }),
);

// ── Migration (04 §11): open job-work orders get an opening position from qty_done ────────────
/**
 * For each open job-work order where both businesses use Goods and nothing is linked yet, record what was already done
 * (`qty_done`) as an opening position in `sc_order_openings`. Work recorded later adds to it, so the pieces already
 * counted are never counted again. The order itself is never changed (qty_done is only read). Idempotent by order id;
 * a dry run by default.
 */
export async function migrateOpenings(opts: { apply: boolean }) {
  const flagged = ((await col('businesses').find({ 'flags.sc': true } as any, { projection: { _id: 1 } }).toArray()) as any[]).map((b) => b._id);
  const orders = (await col('orders').find({ kind: 'job_work', status: { $nin: ['cancelled', 'closed', 'delivered', 'balance_paid'] }, buyer_business_id: { $in: flagged }, seller_business_id: { $in: flagged } } as any).toArray()) as any[];
  const plan: { order_id: string; code: string; qty: number; qty_done: number; action: 'create' | 'exists' | 'linked' }[] = [];
  for (const o of orders) {
    const exists = await col('sc_order_openings').findOne({ _id: o._id } as any);
    const linked = await col('sc_jobs').countDocuments({ order_id: o._id } as any);
    const action = exists ? 'exists' : linked ? 'linked' : 'create';
    plan.push({ order_id: o._id, code: o.code, qty: o.qty, qty_done: o.qty_done ?? 0, action });
    if (opts.apply && action === 'create') {
      await col('sc_order_openings').updateOne({ _id: o._id } as any, { $setOnInsert: { _id: o._id, order_id: o._id, qty_done: o.qty_done ?? 0, unit: o.unit, business_date: todayIST(), created_at: Date.now(), migrated: true } }, { upsert: true });
    }
  }
  return plan;
}

export default router;
