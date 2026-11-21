// Movement write paths (04 §5): Send for work, Got back from work, receiver confirmation (two-sided), the sender's
// own figure, receiver-first entries with matching, Share now and Undo. Counterparties may be off-platform contacts
// (single-player, slice 1) or businesses on CLAIRE (two-sided, slice 2).
import { Router } from 'express';
import type { ClientSession } from 'mongodb';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { holdingId, newId, post } from './repo.js';
import {
  UNDO_MS, applyReceipt, applySenderFigure, assertion, discrepancyDoc, goodsOf, me, qtyBase, sameParty, settleCtxFor, settleLine, specInfo, termsFor,
} from './ledgerOps.js';
import { cancelCards, dueNow, enqueueCard, processDueCards } from './goodsChat.js';
import { postOutput, postReceipt, postSend, real, reverse, pseudo, type Goods } from '../../../shared/sc/postings.js';
import { addWorkingDays, todayIST } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { Dimension, PartyRef, Posting } from '../../../shared/sc/types.js';
import { reply, type Reply } from './reply.js';

export { UNDO_MS };
const router = Router();

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const partyRef = z.object({ k: z.enum(['b', 'c']), id: z.string().min(1).max(64) });

/** A counterparty this business may record with: its own contact, or another business on the platform. */
export async function counterparty(ctx: Ctx, p: PartyRef) {
  if (p.k === 'c') {
    const c = await col('sc_contacts').findOne({ _id: p.id, owner_business_id: ctx.businessId } as any);
    if (!c) throw new HttpError(404, 'Not found');
    return { party: p, onPlatform: false };
  }
  if (p.id === ctx.businessId) throw new HttpError(400, 'Pick another business, not your own.');
  const b = await col('businesses').findOne({ _id: p.id } as any, { projection: { _id: 1 } });
  if (!b) throw new HttpError(404, 'Not found');
  return { party: p, onPlatform: true };
}

export const bizIds = (...ps: PartyRef[]) => [...new Set(ps.filter((p) => p.k === 'b').map((p) => p.id))];

// ── Send for work ────────────────────────────────────────────────────────────────────────────────

const sendBody = z.object({
  to: partyRef,
  process_key: z.string().max(40),
  lines: z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(), lot: z.string().trim().max(30).optional(), they_got: z.number().positive().optional() })).min(1).max(20),
  from_place_id: z.string().max(40).optional(),
  expected_at: date.optional(),
  business_date: date.optional(),
  dc_no: z.string().trim().max(30).optional(),
  photo_ids: z.array(z.string().max(40)).max(4).optional(),
  rate_paise: z.number().int().min(0).max(100_000_000).optional(),
  note: z.string().trim().max(300).optional(),
  client_id: z.string().min(8).max(40),
  allow_untracked: z.boolean().optional(),
  untracked_reason: z.string().trim().max(120).optional(),
  /** Rework of an earlier job (O): the new job links back, the earlier one is never edited. */
  rework_of: z.string().max(40).optional(),
});

export async function sendForWork(ctx: Ctx, raw: unknown, extra: { order_id?: string } = {}): Promise<Reply> {
    const b = parse(sendBody, raw);
    const cp = await counterparty(ctx, b.to);
    const proc = await col('sc_process_types').findOne({ key: b.process_key, owner_business_id: { $in: [null, ctx.businessId] } } as any);
    if (!proc) throw new HttpError(400, 'Please pick the work.');
    if (b.allow_untracked && ctx.role !== 'owner') return reply(403, { error: 'Only the owner can record stock you never entered.', code: 'needs_owner' });
    if (b.rate_paise !== undefined && ctx.role !== 'owner') return reply(403, { error: 'Only the owner can set rates.', code: 'needs_owner' });

    const businessDate = b.business_date ?? todayIST();
    const owner = me(ctx);
    const performer = cp.party;
    const terms = await termsFor(ctx, performer);
    const tol = { weighedPct: terms.tolerance.weighed_pct, countedAbs: terms.tolerance.counted_abs };
    const movementId = newId('mv');
    const jobId = newId('jb');
    const place = b.from_place_id ?? null;
    const now = Date.now();
    const visibleAt = now + UNDO_MS;

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
    if (short.length && !b.allow_untracked) return reply(409, { error: 'You have less of this in stock than you are sending.', code: 'negative', lines: short });

    const parties = bizIds(owner, performer);
    const postings: Posting[] = [];
    const movLines: any[] = [];
    const settleQueue: { line: any; received: number }[] = [];
    for (const x of lines) {
      const lineId = newId('ln');
      const fromStock = Math.min(x.available, x.q.base);
      if (fromStock > 0) postings.push(...postSend({ goods: x.goods, qty: fromStock, owner, from: { party: owner, place }, movementId }));
      if (x.q.base > fromStock) postings.push(...postSend({ goods: x.goods, qty: x.q.base - fromStock, owner, from: { party: owner, external: true }, movementId }));
      // Receipt: an off-platform receiver's is our own figure until someone says otherwise (04 §5.6.8); a business on
      // CLAIRE confirms its own receipt, so nothing is received yet unless we typed their figure (on behalf).
      const received = x.theyGot ?? (cp.onPlatform ? null : x.q.base);
      if (received !== null) postings.push(...postReceipt({ goods: x.goods, owner, movementId, transitCustodian: owner, to: { party: performer, state: { s: 'allocated', ref: jobId } }, delta: Math.min(received, x.q.base) }));
      const line = {
        line_id: lineId, spec_id: x.info.id, label_en: x.info.label_en, role: x.info.role, lot: x.goods.lot, grade: 'A', dim: x.info.dim, class: x.info.cls,
        entered: { value: x.l.qty, unit: x.l.unit, factor: x.l.factor ?? null, approx: x.q.approx }, owner_before: owner, owner_after: owner, job_id: jobId, line_kind: 'goods',
        from_untracked: x.q.base - fromStock, viewer_business_ids: parties,
        sent: [assertion(ctx, x.q.base, 'self', businessDate, { final: true })],
        received: received === null ? [] : [x.theyGot !== null ? assertion(ctx, x.theyGot, 'on_behalf', businessDate, { final: true }) : assertion(ctx, x.q.base, 'self', businessDate, { reason: 'based_on_sent' })],
        settled: null as any,
      };
      movLines.push(line);
      if (x.theyGot !== null) settleQueue.push({ line, received: x.theyGot });
    }

    const expected = b.expected_at ?? addWorkingDays(businessDate, proc.default_turnaround_days);
    const movement: any = {
      _id: movementId, id: movementId, client_id: b.client_id, action: 'send_for_work', purpose: 'job_work_out', process_key: proc.key,
      from: { party: owner, place_id: place }, to: { party: performer }, transit_custodian: owner, lines: movLines,
      terms_snapshot: terms, dc_no: b.dc_no ?? null, photo_ids: b.photo_ids ?? [], note: b.note ?? null, untracked_reason: b.allow_untracked ? b.untracked_reason ?? null : null,
      business_date: businessDate, recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId,
      visible_at: visibleAt, cancelled_at: null, party_business_ids: parties, version: 1,

      ...(extra.order_id ? { order_id: extra.order_id } : {}),
    };
    const discrepancies: any[] = [];
    for (const s of settleQueue) {
      const c = settleCtxFor(movement, s.line);
      const st = settleLine(goodsOf(s.line), s.line.class, s.line.sent[0].base_qty, s.received, c);
      postings.push(...st.postings);
      s.line.settled = { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct };
      if (st.disputeId) discrepancies.push(discrepancyDoc(st.disputeId, movement, s.line, c, s.line.sent[0].base_qty, s.received, st.outcome));
    }
    const reworkOf = b.rework_of && (await col('sc_jobs').findOne({ _id: b.rework_of, 'owner_party.k': 'b', 'owner_party.id': ctx.businessId } as any, { projection: { _id: 1 } })) ? b.rework_of : null;
    const job = {
      _id: jobId, id: jobId, process_key: proc.key, process_type_id: proc._id, conservation_kind: proc.conservation_kind, loss_norm_pct: proc.loss_norm_pct, rate_basis: proc.rate_basis,
      owner_party: owner, client_party: owner, performer_party: performer, status: 'issued', rework_of: reworkOf,
      inputs: movLines.map((l) => ({ movement_id: movementId, line_id: l.line_id, spec_id: l.spec_id, dim: l.dim, lot: l.lot, role: l.role ?? 'primary' })),
      outputs: [] as unknown[], returns: [] as string[], promised_at: null, expected_at: expected, business_date: businessDate, pauses: [], ...(extra.order_id ? { order_id: extra.order_id } : {}),
      party_business_ids: parties, created_at: now, version: 1,
    };
    const result = await post(ctx, { type: 'send_for_work', ref: { kind: 'movement', id: movementId }, payload: { job_id: jobId }, business_date: businessDate, client_id: b.client_id, visible_at: visibleAt }, postings, async (session) => {
      await col('sc_movements').insertOne(movement, { session });
      await col('sc_jobs').insertOne(job as any, { session });
      if (b.rate_paise !== undefined) {
        const pid = newId('pr');
        // Prices are separate (04 A3): the client and the performer of the job may see this rate; staff never do.
        await col('sc_prices').insertOne({ _id: pid, id: pid, record: { kind: 'job', id: jobId }, parties, basis: proc.rate_basis, value_paise: b.rate_paise, status: cp.onPlatform ? 'proposed' : 'unilateral', created_at: now } as any, { session });
      }
      if (discrepancies.length) await col('sc_discrepancies').insertMany(discrepancies, { session });
      // The DC photo is the shared document of the movement (model §7): both businesses may see it.
      if (b.photo_ids?.length) await col('sc_documents').updateMany({ _id: { $in: b.photo_ids }, business_id: ctx.businessId } as any, { $set: { record: { kind: 'movement', id: movementId }, shared_with: parties } }, { session });
    });
    if (result.duplicate) return reply(200, { movement: await col('sc_movements').findOne({ recorder_business_id: ctx.businessId, client_id: b.client_id } as any), duplicate: true });
    if (cp.onPlatform) await enqueueCard('movement', movementId, 'sent', visibleAt);
    return reply(201, { movement, job, undo_until: visibleAt });
}

router.post(
  '/sc/movements/send',
  h(async (req: ScRequest, res) => {
    const r = await sendForWork(req.ctx, req.body);
    res.status(r.status).json(r.body);
  }),
);

// ── Got back from work (recorded by the owner) ───────────────────────────────────────────────────

const returnBody = z.object({
  lines: z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(), grade: z.enum(['A', 'B', 'rework', 'reject', 'scrap']).default('A'), lot: z.string().trim().max(30).optional(), rolls: z.number().int().min(0).max(10000).optional(), they_sent: z.number().positive().optional(), unprocessed: z.boolean().optional() })).min(1).max(20),
  to_place_id: z.string().max(40).optional(),
  business_date: date.optional(),
  last: z.boolean().optional(),
  client_id: z.string().min(8).max(40),
  dc_no: z.string().trim().max(30).optional(),
});

export async function gotBack(ctx: Ctx, raw: unknown, jobId: string): Promise<Reply> {
    const b = parse(returnBody, raw);
    // The job's client records what came back: the owner for a direct job, the intermediary for a sub-contract.
    const job = await col('sc_jobs').findOne({ _id: jobId, 'client_party.k': 'b', 'client_party.id': ctx.businessId } as any);
    if (!job) throw new HttpError(404, 'Not found');
    if (['closed', 'cancelled'].includes(job.status)) throw new HttpError(409, 'This job is already closed.');
    const businessDate = b.business_date ?? todayIST();
    const client = me(ctx);
    const owner = job.owner_party as PartyRef;
    const performer = job.performer_party as PartyRef;
    const via = (job.via ?? null) as PartyRef | null;
    const onPlatform = performer.k === 'b';
    const terms = await termsFor(ctx, performer);
    const movementId = newId('mv');
    const place = b.to_place_id ?? null;
    const now = Date.now();
    const parties = bizIds(client, performer);
    const postings: Posting[] = [];
    const movLines: any[] = [];
    const outputs: Record<string, unknown>[] = [];
    for (const l of b.lines) {
      const info = await specInfo(l.spec_id);
      const received = qtyBase(l.qty, l.unit, info, l.factor).base;
      // P6: output = the performer's declared figure; until they give it, what came back (evidence implied).
      const declared = l.they_sent !== undefined ? qtyBase(l.they_sent, l.unit, info, l.factor).base : received;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: l.grade, dim: info.dim };
      const lineId = newId('ln');
      if (!l.unprocessed) {
        postings.push(...postOutput({ goods, qty: declared, owner, performer, via, jobId: job._id }));
        outputs.push({ movement_id: movementId, line_id: lineId, spec_id: info.id, grade: l.grade, lot: goods.lot, dim: info.dim, qty: declared, business_date: businessDate });
      }
      postings.push(...postSend({ goods, qty: declared, owner, from: { party: performer, via, state: l.unprocessed ? { s: 'allocated', ref: job._id } : { s: 'available' } }, movementId, transitCustodian: performer }));
      // Unprocessed goods from a sub-contractor go back into the parent job's allocation (model §3.5 roll-up).
      const back = l.unprocessed && job.parent_job_id ? { s: 'allocated' as const, ref: job.parent_job_id as string } : { s: 'available' as const };
      postings.push(...postReceipt({ goods, owner, movementId, transitCustodian: performer, to: { party: client, place: back.s === 'available' ? place : null, state: back }, delta: Math.min(received, declared) }));
      movLines.push({
        line_id: lineId, spec_id: info.id, label_en: info.label_en, lot: goods.lot, grade: l.grade, dim: info.dim, class: info.cls, rolls: l.rolls ?? null,
        entered: { value: l.qty, unit: l.unit, factor: l.factor ?? null }, owner_before: owner, owner_after: owner, job_id: job._id,
        line_kind: l.unprocessed ? 'unprocessed_return' : 'goods', viewer_business_ids: parties,
        sent: [assertion(ctx, declared, l.they_sent !== undefined ? 'on_behalf' : 'implied', businessDate, { final: true })],
        received: [assertion(ctx, received, onPlatform ? 'account' : 'self', businessDate, { final: true })],
        settled: null as any,
      });
    }
    const movement: any = {
      _id: movementId, id: movementId, client_id: b.client_id, action: 'return_from_work', purpose: job.parent_job_id ? 'subcontract_return' : 'job_work_return', process_key: job.process_key,
      from: { party: performer }, to: { party: client, place_id: place }, transit_custodian: performer, via, lines: movLines, terms_snapshot: terms, dc_no: b.dc_no ?? null,
      business_date: businessDate, recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId,
      visible_at: now + UNDO_MS, cancelled_at: null, party_business_ids: parties, version: 1,
    };
    const discrepancies: any[] = [];
    for (const line of movLines) {
      const declared = line.sent[0].base_qty;
      const received = line.received[0].base_qty;
      if (declared === received) continue;
      const c = settleCtxFor(movement, line);
      const st = settleLine(goodsOf(line), line.class, declared, received, c);
      postings.push(...st.postings);
      line.settled = { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct };
      if (st.disputeId) discrepancies.push(discrepancyDoc(st.disputeId, movement, line, c, declared, received, st.outcome));
    }
    const result = await post(ctx, { type: 'return_from_work', ref: { kind: 'movement', id: movementId }, payload: { job_id: job._id }, business_date: businessDate, client_id: b.client_id }, postings, async (session) => {
      await col('sc_movements').insertOne(movement, { session });
      await col('sc_jobs').updateOne(
        { _id: job._id } as any,
        { $push: { outputs: { $each: outputs }, returns: movementId } as any, $set: { status: b.last ? 'completed' : 'in_progress', ...(b.last ? { completed_at: now } : {}) }, $inc: { version: 1, unprocessed_back: movLines.filter((l: any) => l.line_kind === 'unprocessed_return' && ((job.inputs as any[]).find((i) => i.spec_id === l.spec_id)?.role ?? 'primary') !== 'secondary').reduce((a: number, l: any) => a + l.sent[0].base_qty, 0) } },
        { session },
      );
      // Roll-up: a sub-contractor's outputs count for the parent job the owner sees (with the intermediary).
      if (job.parent_job_id && outputs.length) {
        await col('sc_jobs').updateOne({ _id: job.parent_job_id } as any, { $push: { outputs: { $each: outputs.map((o) => ({ ...o, source: 'child', child_job_id: job._id })) } } as any, $set: { status: 'in_progress' } }, { session });
      }
      if (discrepancies.length) await col('sc_discrepancies').insertMany(discrepancies, { session });
    });
    if (result.duplicate) return reply(200, { duplicate: true });
    if (onPlatform) await enqueueCard('movement', movementId, 'sent', movement.visible_at);
    if (job.order_id) void import('./orders.js').then((o) => o.orderCoverage(job.order_id)).catch((e) => console.warn('[sc] order coverage', (e as Error).message));
    return reply(201, { movement, undo_until: movement.visible_at });
}

router.post(
  '/sc/jobs/:id/return',
  h(async (req: ScRequest, res) => {
    const r = await gotBack(req.ctx, req.body, req.params.id);
    res.status(r.status).json(r.body);
  }),
);

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

// ── Receiver and sender figures ──────────────────────────────────────────────────────────────────

const figureLines = z.array(z.object({ line_id: z.string(), qty: z.number().positive().optional(), unit: z.string().max(10).optional(), factor: z.number().positive().optional() })).min(1).max(20);

async function visibleMovement(ctx: Ctx, id: string) {
  const m = await col('sc_movements').findOne({ _id: id, party_business_ids: ctx.businessId, cancelled_at: null } as any);
  if (!m) throw new HttpError(404, 'Not found');
  if (m.recorder_business_id !== ctx.businessId && m.visible_at > Date.now()) throw new HttpError(404, 'Not found');
  return m;
}

/** The receiver (a business on CLAIRE) confirms or gives its own figure per line: "All correct" / "Different number". */
router.post(
  '/sc/movements/:id/confirm',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ lines: figureLines, business_date: date.optional() }), req.body);
    const m = await visibleMovement(ctx, req.params.id);
    if (!sameParty(m.to.party, me(ctx))) throw new HttpError(403, 'Only the receiver can confirm what arrived.');
    const results = [];
    for (const l of b.lines) {
      const line = (m.lines as any[]).find((x) => x.line_id === l.line_id);
      if (!line || !line.viewer_business_ids?.includes(ctx.businessId)) throw new HttpError(404, 'Not found');
      const info = await specInfo(line.spec_id);
      const base = l.qty !== undefined ? qtyBase(l.qty, l.unit ?? info.units[0], info, l.factor).base : winningAssertion(line.sent)!.base_qty;
      const mine = (line.received as any[]).find((a) => a.evidence === 'account' && a.by?.business_id === ctx.businessId && a.base_qty === base);
      if (mine) { results.push({ line_id: l.line_id, unchanged: true, disputeId: null }); continue; } // a second tap or a second staff member
      results.push({ line_id: l.line_id, ...(await applyReceipt(ctx, m._id, l.line_id, base, 'account', b.business_date ?? todayIST())) });
    }
    await afterChange(m._id, results);
    res.json({ results });
  }),
);

/** The sender of a return the owner recorded gives its own figure (P6: the performer's declared output). */
router.post(
  '/sc/movements/:id/sender-figure',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ lines: figureLines, business_date: date.optional() }), req.body);
    const m = await visibleMovement(ctx, req.params.id);
    if (!sameParty(m.from.party, me(ctx))) throw new HttpError(403, 'Only the sender can give its figure.');
    const results = [];
    for (const l of b.lines) {
      const line = (m.lines as any[]).find((x) => x.line_id === l.line_id);
      if (!line) throw new HttpError(404, 'Not found');
      const info = await specInfo(line.spec_id);
      const base = l.qty !== undefined ? qtyBase(l.qty, l.unit ?? info.units[0], info, l.factor).base : winningAssertion(line.sent)!.base_qty;
      results.push({ line_id: l.line_id, ...(await applySenderFigure(ctx, m._id, l.line_id, base, b.business_date ?? todayIST())) });
    }
    await afterChange(m._id, results);
    res.json({ results });
  }),
);

/** The recorder types the other side's figure (off-platform, or told by phone): an on-behalf assertion. */
router.post(
  '/sc/movements/:id/their-figure',
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ line_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(), business_date: date.optional() }), req.body);
    const m = await col('sc_movements').findOne({ _id: req.params.id, recorder_business_id: req.ctx.businessId, action: 'send_for_work' } as any, { projection: { lines: 1 } });
    const line = (m?.lines as any[] | undefined)?.find((l) => l.line_id === b.line_id);
    if (!line) throw new HttpError(404, 'Not found');
    const info = await specInfo(line.spec_id);
    const r = await applyReceipt(req.ctx, req.params.id, b.line_id, qtyBase(b.qty, b.unit, info, b.factor).base, 'on_behalf', b.business_date ?? todayIST());
    await afterChange(req.params.id, [r]);
    res.json(r);
  }),
);

/** After a confirmation or figure: refresh the movement card and post any new dispute card now. */
async function afterChange(movementId: string, results: { disputeId?: string | null }[]) {
  const m = await col('sc_movements').findOne({ _id: movementId } as any, { projection: { lines: 1, party_business_ids: 1, order_id: 1 } });
  if (m?.order_id) void import('./orders.js').then((o) => o.orderCoverage(m.order_id)).catch((e) => console.warn('[sc] order coverage', (e as Error).message));
  if ((m?.party_business_ids?.length ?? 0) < 2) return;
  const stamp = Date.now();
  await enqueueCard('movement', movementId, `update_${stamp}`, stamp);
  for (const r of results) if (r.disputeId) await enqueueCard('dispute', r.disputeId, 'open', stamp);
  void processDueCards();
}

// ── Receiver-first: "Received for work" before the sender recorded it (04 §5.6.2) ───────────────

router.post(
  '/sc/movements/receive-first',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ from: partyRef, process_key: z.string().max(40), lines: z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), lot: z.string().trim().max(30).optional() })).min(1).max(20), business_date: date.optional(), client_id: z.string().min(8).max(40), dc_no: z.string().trim().max(30).optional() }), req.body);
    if (b.from.k !== 'b') return res.status(400).json({ error: 'Pick the business that sent it.', code: 'business_only' });
    await counterparty(ctx, b.from);
    const businessDate = b.business_date ?? todayIST();
    const sender = b.from as PartyRef;
    const custodian = me(ctx);
    const id = newId('rf');
    const postings: Posting[] = [];
    const lines = [];
    for (const l of b.lines) {
      const info = await specInfo(l.spec_id);
      const base = qtyBase(l.qty, l.unit, info).base;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: 'A', dim: info.dim };
      // Visible only to this recorder; the owner never sees an unmatched row (positions() filters provisional_by).
      postings.push({ key: pseudo(goods, 'EXTERNAL', `b:${sender.id}`, sender), delta: -base, dim: info.dim }, { key: real(goods, sender, custodian, { s: 'held', reason: 'unmatched', ref: id }), delta: base, dim: info.dim });
      lines.push({ line_id: newId('ln'), spec_id: info.id, label_en: info.label_en, lot: goods.lot, dim: info.dim, qty: base });
    }
    const doc = { _id: id, id, from: { party: sender }, to: { party: custodian }, process_key: b.process_key, lines, business_date: businessDate, dc_no: b.dc_no ?? null, recorder_business_id: ctx.businessId, recorded_by_user_id: ctx.userId, status: 'unmatched', matched_to: null, created_at: Date.now() };
    const r = await post(ctx, { type: 'receive_first', ref: { kind: 'receive_first', id }, business_date: businessDate, client_id: b.client_id }, postings, async (session) => {
      await col('sc_receive_first').insertOne(doc as any, { session });
      await col('sc_holdings').updateMany({ 'key.state.reason': 'unmatched', 'key.state.ref': id } as any, { $set: { provisional_by: ctx.businessId } }, { session });
    });
    if (r.duplicate) return res.json({ duplicate: true });
    await matchReceiverFirst(ctx.businessId, sender.id);
    res.status(201).json({ receiveFirst: await col('sc_receive_first').findOne({ _id: id } as any) });
  }),
);

/**
 * Matches unmatched receiver-first entries against visible, unconfirmed movements from the same sender (same spec,
 * ±1 business day). On a match the held row is reversed and the figure becomes the receiver's confirmation.
 */
export async function matchReceiverFirst(receiverId: string, senderId: string) {
  const pending = await col('sc_receive_first').find({ recorder_business_id: receiverId, 'from.party.id': senderId, status: 'unmatched' } as any).toArray();
  if (!pending.length) return 0;
  const now = Date.now();
  const movs = await col('sc_movements').find({ 'from.party.id': senderId, 'to.party.k': 'b', 'to.party.id': receiverId, cancelled_at: null, visible_at: { $lte: now } } as any).toArray();
  const user = await col('users').findOne({ business_id: receiverId, role: 'owner' } as any, { projection: { _id: 1 } });
  const ctx: Ctx = { businessId: receiverId, userId: (user?._id as unknown as string) ?? 'system', role: 'owner', language: 'en' };
  let matched = 0;
  for (const rf of pending as any[]) {
    const dayOk = (d: string) => Math.abs(Date.parse(d) - Date.parse(rf.business_date)) <= 86_400_000;
    const m = movs.find((x: any) => dayOk(x.business_date) && rf.lines.every((l: any) => x.lines.some((ml: any) => ml.spec_id === l.spec_id && !(ml.received as any[]).some((a) => a.evidence === 'account'))));
    if (!m) continue;
    const reversal: Posting[] = rf.lines.flatMap((l: any) => {
      const goods: Goods = { spec: l.spec_id, lot: l.lot, grade: 'A', dim: l.dim as Dimension };
      return reverse([{ key: pseudo(goods, 'EXTERNAL', `b:${senderId}`, { k: 'b', id: senderId }), delta: -l.qty, dim: l.dim }, { key: real(goods, { k: 'b', id: senderId }, { k: 'b', id: receiverId }, { s: 'held', reason: 'unmatched', ref: rf._id }), delta: l.qty, dim: l.dim }]);
    });
    await post(ctx, { type: 'receive_first_matched', ref: { kind: 'receive_first', id: rf._id }, payload: { movement_id: m._id }, business_date: rf.business_date }, reversal, async (session: ClientSession) => {
      await col('sc_receive_first').updateOne({ _id: rf._id } as any, { $set: { status: 'matched', matched_to: m._id } }, { session });
    });
    const results = [];
    for (const l of rf.lines) {
      const ml = m.lines.find((x: any) => x.spec_id === l.spec_id);
      if (ml) results.push(await applyReceipt(ctx, m._id, ml.line_id, l.qty, 'account', rf.business_date));
    }
    await afterChange(m._id, results);
    matched++;
  }
  return matched;
}

// ── Share now and Undo (D4) ──────────────────────────────────────────────────────────────────────

router.post(
  '/sc/movements/:id/share-now',
  h(async (req: ScRequest, res) => {
    const m = await col('sc_movements').findOne({ _id: req.params.id, recorder_business_id: req.ctx.businessId, cancelled_at: null } as any);
    if (!m) throw new HttpError(404, 'Not found');
    const now = Date.now();
    if (m.visible_at > now) {
      await col('sc_movements').updateOne({ _id: m._id } as any, { $set: { visible_at: now } });
      await col('sc_holdings').updateMany({ 'key.state.s': 'in_transit', 'key.state.ref': m._id } as any, { $set: { visible_at: now } });
      await dueNow('movement', m._id);
      void processDueCards();
    }
    res.json({ visible_at: Math.min(m.visible_at, now) });
  }),
);

router.post(
  '/sc/movements/:id/undo',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const m = await col('sc_movements').findOne({ _id: req.params.id, recorder_business_id: ctx.businessId } as any);
    if (!m) throw new HttpError(404, 'Not found');
    if (m.cancelled_at) return res.json({ undone: true });
    if (Date.now() > m.recorded_at + UNDO_MS) return res.status(409).json({ error: 'The 10 minutes to undo have passed. Record a correction instead.', code: 'window_closed' });
    // Once the other side has acted on it, Undo is gone (04 §5.3).
    const actedOn = (m.lines as any[]).some((l) => [...l.sent, ...l.received].some((a: any) => a.by?.business_id && a.by.business_id !== ctx.businessId));
    if (actedOn) return res.status(409).json({ error: 'They have already confirmed this. Record a correction instead.', code: 'acted_on' });
    const jobId = m.lines?.[0]?.job_id as string | undefined;
    if (jobId && (await col('sc_jobs').findOne({ _id: jobId, status: 'closed' } as any, { projection: { _id: 1 } }))) return res.status(409).json({ error: 'This job is closed. Reopen it first.', code: 'job_closed' });
    if (m.action === 'send_for_work' && jobId) {
      const job = await col('sc_jobs').findOne({ _id: jobId } as any);
      if (job?.returns?.length) return res.status(409).json({ error: 'Undo the goods that came back first.', code: 'has_returns' });
    }
    const events = await col('sc_events').find({ 'ref.kind': 'movement', 'ref.id': m._id, type: { $ne: 'undo' } } as any).toArray();
    const rows = await col('sc_postings').find({ event_id: { $in: events.map((e) => e._id) } } as any).toArray();
    const postings: Posting[] = reverse(rows.map((r: any) => ({ key: r.key, delta: r.delta_base, dim: r.dimension })));
    await post(ctx, { type: 'undo', ref: { kind: 'movement', id: m._id }, business_date: m.business_date }, postings, async (session) => {
      await col('sc_movements').updateOne({ _id: m._id } as any, { $set: { cancelled_at: Date.now() }, $inc: { version: 1 } }, { session });
      await col('sc_discrepancies').updateMany({ 'refs.movement_id': m._id, state: { $ne: 'resolved' } } as any, { $set: { state: 'cancelled' } }, { session });
      if (m.action === 'send_for_work' && jobId) await col('sc_jobs').updateOne({ _id: jobId } as any, { $set: { status: 'cancelled' }, $inc: { version: 1 } }, { session });
      if (m.purpose === 'sale_allocated' && jobId) {
        await col('sc_jobs').updateOne({ _id: jobId } as any, { $set: { status: 'cancelled' }, $inc: { version: 1 } }, { session });
        await col('sc_jobs').updateOne({ _id: m.parent_job_id } as any, { $pull: { splits: { movement_id: m._id } } as any }, { session });
      }
      if (m.action === 'return_from_work' && jobId) {
        const back = (m.lines as any[]).filter((l) => l.line_kind === 'unprocessed_return').reduce((x: number, l: any) => x + (winningAssertion(l.sent)?.base_qty ?? 0), 0);
        await col('sc_jobs').updateOne({ _id: jobId } as any, { $pull: { outputs: { movement_id: m._id }, returns: m._id } as any, $set: { status: 'in_progress', completed_at: null }, $inc: { version: 1, unprocessed_back: -back } }, { session });
      }
    });
    await cancelCards('movement', m._id);
    res.json({ undone: true });
  }),
);

export default router;
