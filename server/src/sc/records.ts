// Slice 1 write paths (05 §2, 04 §5): Send for work, Got back from work, the receiver's figure, and Undo.
// Single-player: the counterparty is an off-platform contact. Two-sided records arrive in slice 2.
import { Router } from 'express';
import type { ClientSession } from 'mongodb';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import { requireOwner, type Ctx, type ScRequest } from './flag.js';
import { holdingId, newId, post } from './repo.js';
import { DEFAULT_TERMS } from './setup.js';
import { postReceipt, postSend, postSettleLine, postOutput, real, reverse, type Goods } from '../../../shared/sc/postings.js';
import { classify } from '../../../shared/sc/tolerance.js';
import { toBase } from '../../../shared/sc/units.js';
import { addWorkingDays, todayIST } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { Assertion, Dimension, MaterialClass, PartyRef, Posting } from '../../../shared/sc/types.js';

const router = Router();
export const UNDO_MS = 10 * 60_000; // D4

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};
const me = (ctx: Ctx): PartyRef => ({ k: 'b', id: ctx.businessId });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export interface SpecInfo { id: string; label_en: string; dim: Dimension; cls: MaterialClass; units: string[]; mtKey: string }

export async function specInfo(specId: string): Promise<SpecInfo> {
  const sp = await col('sc_specs').findOne({ _id: specId } as any);
  if (!sp) throw new HttpError(400, 'Please pick the material again.');
  const mt = await col('sc_material_types').findOne({ _id: sp.material_type_id } as any);
  if (!mt) throw new HttpError(400, 'Please pick the material again.');
  return { id: specId, label_en: sp.label_en, dim: mt.base_dimension, cls: mt.material_class_key, units: mt.allowed_units, mtKey: mt.key };
}

async function myContact(ctx: Ctx, id: string) {
  const c = await col('sc_contacts').findOne({ _id: id, owner_business_id: ctx.businessId } as any);
  if (!c) throw new HttpError(404, 'Not found');
  return c;
}

export async function termsFor(ctx: Ctx, party: PartyRef) {
  const rel = await col('sc_relationships').findOne({ _id: `rel_${ctx.businessId}_${party.k}_${party.id}` } as any);
  return { ...DEFAULT_TERMS, ...(rel?.terms ?? {}) } as typeof DEFAULT_TERMS;
}

function qtyBase(value: number, unit: string, info: SpecInfo, factor?: number): { base: number; approx: boolean } {
  const r = toBase(value, unit, info.dim, factor);
  if (!r.ok) {
    const msg = r.reason === 'wrong_dimension' ? `${info.label_en} is counted in ${info.units.join(' or ')}, not ${unit}.` : r.reason === 'needs_factor' ? `How much is one ${unit}? Enter the weight per ${unit}, or use ${info.units[0]}.` : 'Please check the quantity.';
    throw new HttpError(400, msg);
  }
  if (r.base <= 0) throw new HttpError(400, 'Please enter a quantity.');
  return { base: r.base, approx: r.approx };
}

const assertion = (ctx: Ctx, base: number, evidence: Assertion['evidence'], businessDate: string, extra: Partial<Assertion> = {}): Assertion => ({
  a_id: newId('as'), base_qty: base, final: false, evidence, by: { business_id: ctx.businessId, user_id: ctx.userId }, business_date: businessDate, recorded_at: Date.now(), ...extra,
});

/** Who bears a weighing difference under the terms (job-work default: the owner). */
const bearerOf = (t: typeof DEFAULT_TERMS, roles: { owner: PartyRef; sender: PartyRef; receiver: PartyRef; performer: PartyRef }) =>
  t.weighing_loss_bearer === 'performer' ? roles.performer : t.weighing_loss_bearer === 'sender' ? roles.sender : t.weighing_loss_bearer === 'receiver' ? roles.receiver : roles.owner;

/**
 * Settles a final line (04 §5.6.4): within tolerance → weighing loss; beyond / over → an open discrepancy that holds
 * the difference (resolved in slice 2). Returns the postings and the discrepancy to insert, if any.
 */
function settle(goods: Goods, cls: MaterialClass, sent: number, received: number, ctx: { owner: PartyRef; movementId: string; transitCustodian: PartyRef; receiver: PartyRef; bearer: PartyRef; tol: { weighedPct: number; countedAbs: number } }) {
  const c = classify(sent, received, cls, ctx.tol);
  if (c.outcome === 'exact') return { postings: [] as Posting[], outcome: c, discrepancy: null as null | Record<string, unknown> };
  const disputeId = c.outcome === 'within' ? undefined : newId('dq');
  const postings = postSettleLine({ goods, owner: ctx.owner, movementId: ctx.movementId, transitCustodian: ctx.transitCustodian, receiver: ctx.receiver, difference: c.difference, outcome: c.outcome as 'within' | 'beyond' | 'over', weighingBearer: ctx.bearer, disputeId });
  return { postings, outcome: c, discrepancy: disputeId ? { _id: disputeId, id: disputeId, kind: 'qty_mismatch', difference: c.difference, pct: c.pct, allowed: c.allowed } : null };
}

// ── Send for work ────────────────────────────────────────────────────────────────────────────────

const sendBody = z.object({
  to: z.object({ k: z.enum(['b', 'c']), id: z.string().min(1).max(64) }),
  process_key: z.string().max(40),
  lines: z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(), lot: z.string().trim().max(30).optional(), they_got: z.number().positive().optional() })).min(1).max(20),
  from_place_id: z.string().max(40).optional(),
  expected_at: date.optional(),
  business_date: date.optional(),
  dc_no: z.string().trim().max(30).optional(),
  rate_paise: z.number().int().min(0).max(100_000_000).optional(),
  note: z.string().trim().max(300).optional(),
  client_id: z.string().min(8).max(40),
  allow_untracked: z.boolean().optional(),
  untracked_reason: z.string().trim().max(120).optional(),
});

router.post(
  '/sc/movements/send',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(sendBody, req.body);
    if (b.to.k === 'b') return res.status(400).json({ error: 'Two-sided records with businesses on CLAIRE come in the next update. Add them as a contact for now.', code: 'two_sided_soon' });
    const contact = await myContact(ctx, b.to.id);
    const proc = await col('sc_process_types').findOne({ key: b.process_key, owner_business_id: { $in: [null, ctx.businessId] } } as any);
    if (!proc) throw new HttpError(400, 'Please pick the work.');
    if (b.allow_untracked && ctx.role !== 'owner') return res.status(403).json({ error: 'Only the owner can record stock you never entered.', code: 'needs_owner' });
    if (b.rate_paise !== undefined && ctx.role !== 'owner') return res.status(403).json({ error: 'Only the owner can set rates.', code: 'needs_owner' });

    const businessDate = b.business_date ?? todayIST();
    const owner = me(ctx);
    const performer: PartyRef = { k: 'c', id: contact._id };
    const terms = await termsFor(ctx, performer);
    const tol = { weighedPct: terms.tolerance.weighed_pct, countedAbs: terms.tolerance.counted_abs };
    const movementId = newId('mv');
    const jobId = newId('jb');
    const place = b.from_place_id ?? null;

    // Resolve lines and check stock (never negative, model §5.4).
    const lines = [];
    const short: { index: number; available: number; needed: number; dim: Dimension }[] = [];
    for (const [i, l] of b.lines.entries()) {
      const info = await specInfo(l.spec_id);
      const q = qtyBase(l.qty, l.unit, info, l.factor);
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: 'A', dim: info.dim };
      const h0 = await col('sc_holdings').findOne({ _id: holdingId(real(goods, owner, owner, { s: 'available' }, { place }), info.dim) } as any);
      const available = Math.max(0, h0?.qty_base ?? 0);
      if (available < q.base) short.push({ index: i, available, needed: q.base, dim: info.dim });
      lines.push({ l, info, q, goods, available, theyGot: l.they_got !== undefined ? qtyBase(l.they_got, l.unit, info, l.factor).base : null });
    }
    if (short.length && !b.allow_untracked) {
      return res.status(409).json({ error: 'You have less of this in stock than you are sending.', code: 'negative', lines: short });
    }

    const postings: Posting[] = [];
    const discrepancies: Record<string, unknown>[] = [];
    const movLines = [];
    for (const x of lines) {
      const lineId = newId('ln');
      const fromStock = Math.min(x.available, x.q.base);
      if (fromStock > 0) postings.push(...postSend({ goods: x.goods, qty: fromStock, owner, from: { party: owner, place }, movementId }));
      if (x.q.base > fromStock) postings.push(...postSend({ goods: x.goods, qty: x.q.base - fromStock, owner, from: { party: owner, external: true }, movementId }));
      // Off-platform receiver: their receipt is our own figure until they (or we, on their behalf) say otherwise (04 §5.6.8).
      const received = x.theyGot ?? x.q.base;
      postings.push(...postReceipt({ goods: x.goods, owner, movementId, transitCustodian: owner, to: { party: performer, state: { s: 'allocated', ref: jobId } }, delta: Math.min(received, x.q.base) }));
      let settled: unknown = null;
      if (x.theyGot !== null) {
        const st = settle(x.goods, x.info.cls, x.q.base, x.theyGot, { owner, movementId, transitCustodian: owner, receiver: performer, bearer: bearerOf(terms, { owner, sender: owner, receiver: performer, performer }), tol });
        postings.push(...st.postings);
        if (st.discrepancy) discrepancies.push({ ...st.discrepancy, refs: { movement_id: movementId, line_id: lineId, job_id: jobId }, parties: [ctx.businessId], figures: { sent: x.q.base, received: x.theyGot }, state: 'open', opened_at: Date.now() });
        settled = { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct };
      }
      movLines.push({
        line_id: lineId, spec_id: x.info.id, label_en: x.info.label_en, lot: x.goods.lot, grade: 'A', dim: x.info.dim, class: x.info.cls,
        entered: { value: x.l.qty, unit: x.l.unit, factor: x.l.factor ?? null, approx: x.q.approx }, owner_before: owner, owner_after: owner, job_id: jobId, line_kind: 'goods',
        from_untracked: x.q.base - fromStock, viewer_business_ids: [ctx.businessId],
        sent: [assertion(ctx, x.q.base, 'self', businessDate, { final: true })],
        received: [x.theyGot !== null ? assertion(ctx, x.theyGot, 'on_behalf', businessDate, { final: true }) : assertion(ctx, x.q.base, 'self', businessDate, { reason: 'based_on_sent' })],
        settled,
      });
    }

    const expected = b.expected_at ?? addWorkingDays(businessDate, proc.default_turnaround_days);
    const now = Date.now();
    const movement = {
      _id: movementId, id: movementId, client_id: b.client_id, action: 'send_for_work', purpose: 'job_work_out',
      from: { party: owner, place_id: place }, to: { party: performer }, lines: movLines,
      terms_snapshot: terms, dc_no: b.dc_no ?? null, note: b.note ?? null, untracked_reason: b.allow_untracked ? b.untracked_reason ?? null : null,
      business_date: businessDate, recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId,
      visible_at: now + UNDO_MS, cancelled_at: null, party_business_ids: [ctx.businessId], version: 1,
    };
    const job = {
      _id: jobId, id: jobId, process_key: proc.key, process_type_id: proc._id, conservation_kind: proc.conservation_kind, loss_norm_pct: proc.loss_norm_pct, rate_basis: proc.rate_basis,
      owner_party: owner, client_party: owner, performer_party: performer, status: 'issued',
      inputs: movLines.map((l) => ({ movement_id: movementId, line_id: l.line_id, spec_id: l.spec_id, dim: l.dim, lot: l.lot })),
      outputs: [] as unknown[], returns: [] as string[], promised_at: null, expected_at: expected, business_date: businessDate, pauses: [],
      party_business_ids: [ctx.businessId], created_at: now, version: 1,
    };
    const result = await post(ctx, { type: 'send_for_work', ref: { kind: 'movement', id: movementId }, payload: { job_id: jobId }, business_date: businessDate, client_id: b.client_id, visible_at: now + UNDO_MS }, postings, async (session) => {
      await col('sc_movements').insertOne(movement as any, { session });
      await col('sc_jobs').insertOne(job as any, { session });
      if (b.rate_paise !== undefined) {
        const pid = newId('pr');
        await col('sc_prices').insertOne({ _id: pid, id: pid, record: { kind: 'job', id: jobId }, parties: [ctx.businessId], basis: proc.rate_basis, value_paise: b.rate_paise, status: 'unilateral', created_at: now } as any, { session });
      }
      if (discrepancies.length) await col('sc_discrepancies').insertMany(discrepancies as any[], { session });
    });
    if (result.duplicate) {
      const existing = await col('sc_movements').findOne({ recorder_business_id: ctx.businessId, client_id: b.client_id } as any);
      return res.json({ movement: existing, duplicate: true });
    }
    res.status(201).json({ movement, job, undo_until: movement.visible_at });
  }),
);

// ── The receiver's figure ("They told me they got …") ───────────────────────────────────────────

/** Posts the change between the old and the new winning receipt, then (re)settles the line (04 §5.2, §5.6.4). */
async function applyReceiverFigure(ctx: Ctx, movementId: string, lineId: string, base: number, businessDate: string) {
  const m = await col('sc_movements').findOne({ _id: movementId, recorder_business_id: ctx.businessId, cancelled_at: null } as any);
  if (!m) throw new HttpError(404, 'Not found');
  const line = (m.lines as any[]).find((l) => l.line_id === lineId);
  if (!line) throw new HttpError(404, 'Not found');
  const job = await col('sc_jobs').findOne({ _id: line.job_id } as any);
  if (!job || job.status === 'closed') throw new HttpError(409, 'This job is closed.');
  const sent = winningAssertion(line.sent)!.base_qty;
  const oldRecv = winningAssertion(line.received)!.base_qty;
  const owner = me(ctx);
  const performer = m.to.party as PartyRef;
  const goods: Goods = { spec: line.spec_id, lot: line.lot, grade: 'A', dim: line.dim };
  const terms = { ...DEFAULT_TERMS, ...(m.terms_snapshot ?? {}) };
  const tol = { weighedPct: terms.tolerance.weighed_pct, countedAbs: terms.tolerance.counted_abs };
  const settleCtx = { owner, movementId, transitCustodian: owner, receiver: performer, bearer: bearerOf(terms, { owner, sender: owner, receiver: performer, performer }), tol };
  const postings: Posting[] = [];
  // Undo the previous settlement, if any, then move the receipt by the change, then settle again.
  if (line.settled) {
    const prev = settle(goods, line.class, sent, oldRecv, settleCtx);
    postings.push(...reverse(prev.postings));
  }
  postings.push(...postReceipt({ goods, owner, movementId, transitCustodian: owner, to: { party: performer, state: { s: 'allocated', ref: line.job_id } }, delta: Math.min(base, sent) - Math.min(oldRecv, sent) }));
  const st = settle(goods, line.class, sent, base, settleCtx);
  postings.push(...st.postings);
  const a = assertion(ctx, base, 'on_behalf', businessDate, { final: true });
  await post(ctx, { type: 'receiver_figure', ref: { kind: 'movement', id: movementId }, payload: { line_id: lineId, base }, business_date: businessDate }, postings, async (session: ClientSession) => {
    await col('sc_movements').updateOne({ _id: movementId, 'lines.line_id': lineId } as any, { $push: { 'lines.$.received': a } as any, $set: { 'lines.$.settled': { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct } } }, { session });
    if (st.discrepancy) await col('sc_discrepancies').insertOne({ ...st.discrepancy, refs: { movement_id: movementId, line_id: lineId, job_id: line.job_id }, parties: [ctx.businessId], figures: { sent, received: base }, state: 'open', opened_at: Date.now() } as any, { session });
  });
  return { outcome: st.outcome };
}

router.post(
  '/sc/movements/:id/their-figure',
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ line_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(), business_date: date.optional() }), req.body);
    const m = await col('sc_movements').findOne({ _id: req.params.id, recorder_business_id: req.ctx.businessId } as any, { projection: { lines: 1 } });
    const line = (m?.lines as any[] | undefined)?.find((l) => l.line_id === b.line_id);
    if (!line) throw new HttpError(404, 'Not found');
    const info = await specInfo(line.spec_id);
    const r = await applyReceiverFigure(req.ctx, req.params.id, b.line_id, qtyBase(b.qty, b.unit, info, b.factor).base, b.business_date ?? todayIST());
    res.json(r);
  }),
);

// ── Got back from work ───────────────────────────────────────────────────────────────────────────

const returnBody = z.object({
  lines: z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(), grade: z.enum(['A', 'B', 'rework', 'reject', 'scrap']).default('A'), lot: z.string().trim().max(30).optional(), rolls: z.number().int().min(0).max(10000).optional(), they_sent: z.number().positive().optional(), unprocessed: z.boolean().optional() })).min(1).max(20),
  to_place_id: z.string().max(40).optional(),
  business_date: date.optional(),
  last: z.boolean().optional(),
  client_id: z.string().min(8).max(40),
  dc_no: z.string().trim().max(30).optional(),
});

router.post(
  '/sc/jobs/:id/return',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(returnBody, req.body);
    const job = await col('sc_jobs').findOne({ _id: req.params.id, 'owner_party.k': 'b', 'owner_party.id': ctx.businessId } as any);
    if (!job) throw new HttpError(404, 'Not found');
    if (['closed', 'cancelled'].includes(job.status)) throw new HttpError(409, 'This job is already closed.');
    if (job.performer_party.k !== 'c') return res.status(400).json({ error: 'Returns from businesses on CLAIRE come in the next update.', code: 'two_sided_soon' });
    const businessDate = b.business_date ?? todayIST();
    const owner = me(ctx);
    const performer = job.performer_party as PartyRef;
    const terms = await termsFor(ctx, performer);
    const tol = { weighedPct: terms.tolerance.weighed_pct, countedAbs: terms.tolerance.counted_abs };
    const movementId = newId('mv');
    const place = b.to_place_id ?? null;
    const postings: Posting[] = [];
    const discrepancies: Record<string, unknown>[] = [];
    const movLines = [];
    const outputs: Record<string, unknown>[] = [];
    for (const l of b.lines) {
      const info = await specInfo(l.spec_id);
      const received = qtyBase(l.qty, l.unit, info, l.factor).base;
      // P6: output = what the performer declared; for an off-platform performer with no figure, what came back.
      const declared = l.they_sent !== undefined ? qtyBase(l.they_sent, l.unit, info, l.factor).base : received;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: l.grade, dim: info.dim };
      const lineId = newId('ln');
      if (!l.unprocessed) {
        postings.push(...postOutput({ goods, qty: declared, owner, performer, jobId: job._id }));
        outputs.push({ movement_id: movementId, line_id: lineId, spec_id: info.id, grade: l.grade, lot: goods.lot, dim: info.dim, qty: declared, business_date: businessDate });
      }
      const fromState = l.unprocessed ? { s: 'allocated' as const, ref: job._id } : { s: 'available' as const };
      postings.push(...postSend({ goods, qty: declared, owner, from: { party: performer, state: fromState }, movementId, transitCustodian: performer }));
      postings.push(...postReceipt({ goods, owner, movementId, transitCustodian: performer, to: { party: owner, place }, delta: Math.min(received, declared) }));
      let settled: unknown = null;
      if (declared !== received) {
        const st = settle(goods, info.cls, declared, received, { owner, movementId, transitCustodian: performer, receiver: owner, bearer: bearerOf(terms, { owner, sender: performer, receiver: owner, performer }), tol });
        postings.push(...st.postings);
        if (st.discrepancy) discrepancies.push({ ...st.discrepancy, refs: { movement_id: movementId, line_id: lineId, job_id: job._id }, parties: [ctx.businessId], figures: { sent: declared, received }, state: 'open', opened_at: Date.now() });
        settled = { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct };
      }
      movLines.push({
        line_id: lineId, spec_id: info.id, label_en: info.label_en, lot: goods.lot, grade: l.grade, dim: info.dim, class: info.cls, rolls: l.rolls ?? null,
        entered: { value: l.qty, unit: l.unit, factor: l.factor ?? null }, owner_before: owner, owner_after: owner, job_id: job._id,
        line_kind: l.unprocessed ? 'unprocessed_return' : 'goods', viewer_business_ids: [ctx.businessId],
        sent: [assertion(ctx, declared, l.they_sent !== undefined ? 'on_behalf' : 'implied', businessDate, { final: true })],
        received: [assertion(ctx, received, 'self', businessDate, { final: true })],
        settled,
      });
    }
    const now = Date.now();
    const movement = {
      _id: movementId, id: movementId, client_id: b.client_id, action: 'return_from_work', purpose: 'job_work_return',
      from: { party: performer }, to: { party: owner, place_id: place }, lines: movLines, terms_snapshot: terms, dc_no: b.dc_no ?? null,
      business_date: businessDate, recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId,
      visible_at: now + UNDO_MS, cancelled_at: null, party_business_ids: [ctx.businessId], version: 1,
    };
    const result = await post(ctx, { type: 'return_from_work', ref: { kind: 'movement', id: movementId }, payload: { job_id: job._id }, business_date: businessDate, client_id: b.client_id }, postings, async (session) => {
      await col('sc_movements').insertOne(movement as any, { session });
      await col('sc_jobs').updateOne(
        { _id: job._id } as any,
        { $push: { outputs: { $each: outputs }, returns: movementId } as any, $set: { status: b.last ? 'completed' : 'in_progress', ...(b.last ? { completed_at: now } : {}) }, $inc: { version: 1 } },
        { session },
      );
      if (discrepancies.length) await col('sc_discrepancies').insertMany(discrepancies as any[], { session });
    });
    if (result.duplicate) return res.json({ duplicate: true });
    res.status(201).json({ movement, undo_until: movement.visible_at });
  }),
);

/** "No, this was the last" / "More coming" after a return (03 S5). */
router.post(
  '/sc/jobs/:id/complete',
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ last: z.boolean() }), req.body);
    const r = await col('sc_jobs').findOneAndUpdate(
      { _id: req.params.id, 'owner_party.id': req.ctx.businessId, status: { $in: ['issued', 'in_progress', 'completed'] } } as any,
      { $set: { status: b.last ? 'completed' : 'in_progress', ...(b.last ? { completed_at: Date.now() } : { completed_at: null }) }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    if (!r) throw new HttpError(404, 'Not found');
    res.json({ status: r.status });
  }),
);

// ── Undo (D4: 10 minutes, before the counterparty sees it) ───────────────────────────────────────

router.post(
  '/sc/movements/:id/undo',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const m = await col('sc_movements').findOne({ _id: req.params.id, recorder_business_id: ctx.businessId } as any);
    if (!m) throw new HttpError(404, 'Not found');
    if (m.cancelled_at) return res.json({ undone: true });
    if (Date.now() > m.recorded_at + UNDO_MS) return res.status(409).json({ error: 'The 10 minutes to undo have passed. Record a correction instead.', code: 'window_closed' });
    const jobId = m.lines?.[0]?.job_id as string | undefined;
    if (m.action === 'send_for_work' && jobId) {
      const job = await col('sc_jobs').findOne({ _id: jobId } as any);
      if (job?.returns?.length) return res.status(409).json({ error: 'Undo the goods that came back first.', code: 'has_returns' });
    }
    const events = await col('sc_events').find({ 'ref.kind': 'movement', 'ref.id': m._id, type: { $ne: 'undo' } } as any).toArray();
    const rows = await col('sc_postings').find({ event_id: { $in: events.map((e) => e._id) } } as any).toArray();
    const postings: Posting[] = reverse(rows.map((r: any) => ({ key: r.key, delta: r.delta_base, dim: r.dimension })));
    await post(ctx, { type: 'undo', ref: { kind: 'movement', id: m._id }, business_date: m.business_date }, postings, async (session) => {
      await col('sc_movements').updateOne({ _id: m._id } as any, { $set: { cancelled_at: Date.now() }, $inc: { version: 1 } }, { session });
      await col('sc_discrepancies').updateMany({ 'refs.movement_id': m._id, state: 'open' } as any, { $set: { state: 'cancelled' } }, { session });
      if (m.action === 'send_for_work' && jobId) await col('sc_jobs').updateOne({ _id: jobId } as any, { $set: { status: 'cancelled' }, $inc: { version: 1 } }, { session });
      if (m.action === 'return_from_work' && jobId) {
        await col('sc_jobs').updateOne({ _id: jobId } as any, { $pull: { outputs: { movement_id: m._id }, returns: m._id } as any, $set: { status: 'in_progress', completed_at: null }, $inc: { version: 1 } }, { session });
      }
    });
    res.json({ undone: true });
  }),
);

export { requireOwner };
export default router;
