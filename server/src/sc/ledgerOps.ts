// Shared ledger operations for movements (04 §5): spec lookup, terms, assertions, settlement of a final line and the
// receipt/sender-figure supersession used by both single-player and two-sided records.
import type { ClientSession } from 'mongodb';
import { col } from '../db/index.js';
import { HttpError } from '../util.js';
import type { Ctx } from './flag.js';
import { newId, post } from './repo.js';
import { DEFAULT_TERMS } from './setup.js';
import { postOutput, postReceipt, postSend, postSettleLine, real, reverse, type Goods } from '../../../shared/sc/postings.js';
import { classify } from '../../../shared/sc/tolerance.js';
import { toBase } from '../../../shared/sc/units.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { Assertion, Dimension, HoldingState, MaterialClass, PartyRef, Posting } from '../../../shared/sc/types.js';

export const UNDO_MS = 10 * 60_000; // D4
export const me = (ctx: Ctx): PartyRef => ({ k: 'b', id: ctx.businessId });
export const sameParty = (a: PartyRef | null | undefined, b: PartyRef | null | undefined) => !!a && !!b && a.k === b.k && a.id === b.id;

export interface SpecInfo { id: string; label_en: string; dim: Dimension; cls: MaterialClass; units: string[]; mtKey: string; role: 'primary' | 'secondary' }

export async function specInfo(specId: string): Promise<SpecInfo> {
  const sp = await col('sc_specs').findOne({ _id: specId } as any);
  if (!sp) throw new HttpError(400, 'Please pick the material again.');
  const mt = await col('sc_material_types').findOne({ _id: sp.material_type_id } as any);
  if (!mt) throw new HttpError(400, 'Please pick the material again.');
  // Trims (thread, buttons, labels, packing) are secondary inputs: they never add to the main goods count of a job.
  return { id: specId, label_en: sp.label_en, dim: mt.base_dimension, cls: mt.material_class_key, units: mt.allowed_units, mtKey: mt.key, role: mt.form === 'trim' ? 'secondary' : 'primary' };
}

export type Terms = typeof DEFAULT_TERMS;
export async function termsFor(ctx: Ctx, party: PartyRef): Promise<Terms> {
  const rel = await col('sc_relationships').findOne({ _id: `rel_${ctx.businessId}_${party.k}_${party.id}` } as any);
  return { ...DEFAULT_TERMS, ...(rel?.terms ?? {}) } as Terms;
}

export function qtyBase(value: number, unit: string, info: SpecInfo, factor?: number): { base: number; approx: boolean } {
  const r = toBase(value, unit, info.dim, factor);
  if (!r.ok) {
    const msg = r.reason === 'wrong_dimension' ? `${info.label_en} is counted in ${info.units.join(' or ')}, not ${unit}.` : r.reason === 'needs_factor' ? `How much is one ${unit}? Enter the weight per ${unit}, or use ${info.units[0]}.` : 'Please check the quantity.';
    throw new HttpError(400, msg);
  }
  if (r.base <= 0) throw new HttpError(400, 'Please enter a quantity.');
  return { base: r.base, approx: r.approx };
}

export const assertion = (ctx: Ctx, base: number, evidence: Assertion['evidence'], businessDate: string, extra: Partial<Assertion> = {}): Assertion => ({
  a_id: newId('as'), base_qty: base, final: false, evidence, by: { business_id: ctx.businessId, user_id: ctx.userId }, business_date: businessDate, recorded_at: Date.now(), ...extra,
});

export const bearerOf = (t: Terms, roles: { owner: PartyRef; sender: PartyRef; receiver: PartyRef; performer: PartyRef }) =>
  t.weighing_loss_bearer === 'performer' ? roles.performer : t.weighing_loss_bearer === 'sender' ? roles.sender : t.weighing_loss_bearer === 'receiver' ? roles.receiver : roles.owner;

/** Where a movement line's receipt lands: allocated to the job at the performer, or available at the owner. */
export interface Dest { party: PartyRef; state: HoldingState; place: string | null; via: PartyRef | null; ownerAfter: PartyRef | null; external: boolean }
export function destOf(m: any, line: any): Dest {
  // Work-bound movements land allocated to the (child) job; a sub-contract forward keeps the intermediary as `via`.
  if (m.action === 'send_for_work' || m.action === 'forward') return { party: m.to.party, state: { s: 'allocated', ref: line.job_id }, place: null, via: m.via ?? null, ownerAfter: null, external: false };
  // A sub-contractor's unprocessed goods go back into the parent job's allocation at the intermediary (model §3.5).
  if (m.action === 'return_from_work' && line.line_kind === 'unprocessed_return' && line.parent_job_id) return { party: m.to.party, state: { s: 'allocated', ref: line.parent_job_id }, place: null, via: null, ownerAfter: null, external: false };
  // Trade (slice 4.5): a sale passes title on receipt; goods leaving to someone we don't track close through EXTERNAL.
  const ownerAfter = line.owner_after && !sameParty(line.owner_after, line.owner_before) ? (line.owner_after as PartyRef) : null;
  return { party: m.to.party, state: { s: 'available' }, place: m.to.place_id ?? null, via: null, ownerAfter: line.dest_external ? null : ownerAfter, external: !!line.dest_external };
}

export interface SettleCtx {
  owner: PartyRef;
  movementId: string;
  transitCustodian: PartyRef;
  sender: PartyRef;
  receiver: PartyRef;
  bearer: PartyRef;
  tol: { weighedPct: number; countedAbs: number };
}

/** Settles a final line (04 §5.6.4): within tolerance → weighing loss; beyond/over → a discrepancy holding the difference. */
export function settleLine(goods: Goods, cls: MaterialClass, sent: number, received: number, c: SettleCtx, disputeId?: string) {
  const out = classify(sent, received, cls, c.tol);
  if (out.outcome === 'exact') return { postings: [] as Posting[], outcome: out, disputeId: null as string | null };
  const id = out.outcome === 'within' ? null : disputeId ?? newId('dq');
  const postings = postSettleLine({ goods, owner: c.owner, movementId: c.movementId, transitCustodian: c.transitCustodian, receiver: c.receiver, difference: out.difference, outcome: out.outcome as 'within' | 'beyond' | 'over', weighingBearer: c.bearer, disputeId: id ?? undefined });
  return { postings, outcome: out, disputeId: id };
}

export function settleCtxFor(m: any, line: any): SettleCtx {
  const terms = { ...DEFAULT_TERMS, ...(m.terms_snapshot ?? {}) };
  const owner = line.owner_before as PartyRef;
  const sender = m.from.party as PartyRef;
  const receiver = m.to.party as PartyRef;
  const performer = m.action === 'send_for_work' || m.action === 'forward' ? receiver : sender;
  return {
    owner, movementId: m._id, transitCustodian: (m.transit_custodian ?? sender) as PartyRef, sender, receiver,
    bearer: bearerOf(terms, { owner, sender, receiver, performer }), tol: { weighedPct: terms.tolerance.weighed_pct, countedAbs: terms.tolerance.counted_abs },
  };
}

export const goodsOf = (line: any): Goods => ({ spec: line.spec_id, lot: line.lot ?? null, grade: line.grade ?? 'A', dim: line.dim });

/** A discrepancy document with everything its resolution needs (posting context), visible to both businesses. */
export function discrepancyDoc(id: string, m: any, line: any, c: SettleCtx, sent: number, received: number, outcome: { difference: number; pct: number; allowed: number }) {
  const parties = [...new Set([m.from.party, m.to.party].filter((p: PartyRef) => p.k === 'b').map((p: PartyRef) => p.id))];
  const contactOwner = m.recorder_business_id;
  return {
    _id: id, id, kind: 'qty_mismatch', refs: { movement_id: m._id, line_id: line.line_id, job_id: line.job_id ?? null },
    parties: parties.length ? (parties.includes(contactOwner) ? parties : [...parties, contactOwner]) : [contactOwner],
    sent_by: m.from.party.k === 'b' ? m.from.party.id : null, received_by: m.to.party.k === 'b' ? m.to.party.id : null,
    line_label: line.label_en, dim: line.dim, class: line.class, figures: { sent, received }, difference: outcome.difference, pct: outcome.pct, allowed: outcome.allowed,
    posting: { goods: goodsOf(line), owner: c.owner, transit_custodian: c.transitCustodian, sender: c.sender, receiver: c.receiver, bearer: c.bearer, dest: destOf(m, line), counted: line.class === 'counted', ...(line.from_state ? { sender_state: line.from_state, sender_via: line.from_via ?? null } : {}) },
    state: 'open', proposals: [] as unknown[], resolution: null, opened_at: Date.now(),
  };
}

/**
 * The receiver's figure for a line (account, link or on-behalf): posts the change against the previous winning
 * receipt, re-settles the line, and opens a discrepancy beyond tolerance. A closed job reopens and closes again around it.
 */
export async function applyReceipt(ctx: Ctx, movementId: string, lineId: string, base: number, evidence: Assertion['evidence'], businessDate: string, final = true) {
  return onClosedJob(ctx, movementId, lineId, 'late_receipt', () => applyReceiptNow(ctx, movementId, lineId, base, evidence, businessDate, final));
}

/** A difference that was settled is final for that line: a later figure would re-open it against the old figures. */
function refuseIfSettled(line: any) {
  if (line?.settled?.outcome === 'resolved') throw new HttpError(409, 'This difference was already settled. Record a correction instead.');
}

/** 04 §5.6.3: a figure on a line of a closed job reopens it, applies, and closes it again (jobs.ts). */
async function onClosedJob<T>(ctx: Ctx, movementId: string, lineId: string, reason: string, apply: () => Promise<T>): Promise<T> {
  const m = await col('sc_movements').findOne({ _id: movementId } as any, { projection: { lines: 1 } });
  const ln = (m?.lines as any[] | undefined)?.find((l) => l.line_id === lineId);
  // Refuse before touching a closed job, so a refused figure never leaves it reopened.
  refuseIfSettled(ln);
  const open = await col('sc_discrepancies').findOne({ 'refs.movement_id': movementId, 'refs.line_id': lineId, state: { $in: ['open', 'proposed', 'countered', 'escalated'] } } as any, { projection: { _id: 1 } });
  if (open) throw new HttpError(409, 'This line has an open difference. Settle it on the dispute screen.');
  const jobId = ln?.job_id ?? null;
  const { withLateFigure } = await import('./jobs.js');
  return withLateFigure(ctx, [jobId], reason, apply);
}

async function applyReceiptNow(ctx: Ctx, movementId: string, lineId: string, base: number, evidence: Assertion['evidence'], businessDate: string, final = true) {
  const m = await col('sc_movements').findOne({ _id: movementId, cancelled_at: null } as any);
  if (!m) throw new HttpError(404, 'Not found');
  const line = (m.lines as any[]).find((l) => l.line_id === lineId);
  if (!line) throw new HttpError(404, 'Not found');
  refuseIfSettled(line);
  const open = await col('sc_discrepancies').findOne({ 'refs.movement_id': movementId, 'refs.line_id': lineId, state: { $in: ['open', 'proposed', 'countered', 'escalated'] } } as any);
  if (open) throw new HttpError(409, 'This line has an open difference. Settle it on the dispute screen.');
  const c = settleCtxFor(m, line);
  const goods = goodsOf(line);
  const sent = winningAssertion(line.sent)!.base_qty;
  const oldWinner = winningAssertion(line.received);
  const oldRecv = oldWinner?.base_qty ?? 0;
  const a = assertion(ctx, base, evidence, businessDate, { final });
  const newWinner = winningAssertion([...(line.received as Assertion[]), a])!;
  const dest = destOf(m, line);
  const postings: Posting[] = [];
  if (line.settled?.outcome === 'within') postings.push(...reverse(settleLine(goods, line.class, sent, oldRecv, c).postings));
  const delta = Math.min(newWinner.base_qty, sent) - Math.min(oldRecv, sent);
  if (delta) postings.push(...postReceipt({ goods, owner: c.owner, movementId, transitCustodian: c.transitCustodian, to: { party: dest.party, state: dest.state, place: dest.place, via: dest.via, external: dest.external }, delta, ...(dest.ownerAfter ? { ownerAfter: dest.ownerAfter } : {}) }));
  let settled: any = line.settled?.outcome === 'within' ? null : line.settled ?? null;
  let dq: any = null;
  if (newWinner.final) {
    const st = settleLine(goods, line.class, sent, newWinner.base_qty, c);
    postings.push(...st.postings);
    settled = { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct };
    if (st.disputeId) dq = discrepancyDoc(st.disputeId, m, line, c, sent, newWinner.base_qty, st.outcome);
  }
  await post(ctx, { type: 'receipt', ref: { kind: 'movement', id: movementId }, payload: { line_id: lineId, base, evidence }, business_date: businessDate }, postings, async (session: ClientSession) => {
    await col('sc_movements').updateOne({ _id: movementId, 'lines.line_id': lineId } as any, { $push: { 'lines.$.received': a } as any, $set: { 'lines.$.settled': settled } }, { session });
    if (dq) await col('sc_discrepancies').insertOne(dq, { session });
  });
  return { outcome: settled, disputeId: dq?._id ?? null };
}

/**
 * The sender's own figure on a return they did not record (P6: the performer's declared output). Posts the change in
 * output and dispatch, and re-settles the line against what the owner received.
 */
export async function applySenderFigure(ctx: Ctx, movementId: string, lineId: string, base: number, businessDate: string, evidence: 'account' | 'link' = 'account') {
  return onClosedJob(ctx, movementId, lineId, 'late_sender_figure', () => applySenderFigureNow(ctx, movementId, lineId, base, businessDate, evidence));
}

async function applySenderFigureNow(ctx: Ctx, movementId: string, lineId: string, base: number, businessDate: string, evidence: 'account' | 'link') {
  const m = await col('sc_movements').findOne({ _id: movementId, cancelled_at: null } as any);
  if (!m) throw new HttpError(404, 'Not found');
  const line = (m.lines as any[]).find((l) => l.line_id === lineId);
  if (!line) throw new HttpError(404, 'Not found');
  if (m.action !== 'return_from_work' || m.recorder_business_id === ctx.businessId) throw new HttpError(409, 'Give your figure only on a return the other side recorded.');
  refuseIfSettled(line);
  const open = await col('sc_discrepancies').findOne({ 'refs.movement_id': movementId, 'refs.line_id': lineId, state: { $in: ['open', 'proposed', 'countered', 'escalated'] } } as any);
  if (open) throw new HttpError(409, 'This line has an open difference. Settle it on the dispute screen.');
  const c = settleCtxFor(m, line);
  const goods = goodsOf(line);
  const oldDeclared = winningAssertion(line.sent)!.base_qty;
  const received = winningAssertion(line.received)?.base_qty ?? 0;
  const a = assertion(ctx, base, evidence, businessDate, { final: true });
  const declared = winningAssertion([...(line.sent as Assertion[]), a])!.base_qty;
  const postings: Posting[] = [];
  if (line.settled?.outcome === 'within') postings.push(...reverse(settleLine(goods, line.class, oldDeclared, received, c).postings));
  const delta = declared - oldDeclared;
  if (delta !== 0) {
    const job = line.job_id as string;
    const performer = m.from.party as PartyRef;
    const out = [
      ...(line.line_kind === 'unprocessed_return' ? [] : postOutput({ goods, qty: Math.abs(delta), owner: c.owner, performer, jobId: job })),
      ...postSend({ goods, qty: Math.abs(delta), owner: c.owner, from: { party: performer, state: line.line_kind === 'unprocessed_return' ? { s: 'allocated', ref: job } : { s: 'available' } }, movementId, transitCustodian: performer }),
    ];
    postings.push(...(delta > 0 ? out : reverse(out)));
  }
  // The receipt was capped at the old declared figure; widen or narrow it to the new one.
  const recvDelta = Math.min(received, declared) - Math.min(received, oldDeclared);
  if (recvDelta) postings.push(...postReceipt({ goods, owner: c.owner, movementId, transitCustodian: c.transitCustodian, to: { party: m.to.party, place: m.to.place_id ?? null }, delta: recvDelta }));
  const st = settleLine(goods, line.class, declared, received, c);
  postings.push(...st.postings);
  const settled = { outcome: st.outcome.outcome, difference: st.outcome.difference, pct: st.outcome.pct };
  const dq = st.disputeId ? discrepancyDoc(st.disputeId, m, line, c, declared, received, st.outcome) : null;
  await post(ctx, { type: 'sender_figure', ref: { kind: 'movement', id: movementId }, payload: { line_id: lineId, base }, business_date: businessDate }, postings, async (session: ClientSession) => {
    await col('sc_movements').updateOne({ _id: movementId, 'lines.line_id': lineId } as any, { $push: { 'lines.$.sent': a } as any, $set: { 'lines.$.settled': settled } }, { session });
    if (line.job_id && delta !== 0 && line.line_kind !== 'unprocessed_return') {
      await col('sc_jobs').updateOne({ _id: line.job_id, 'outputs.line_id': lineId } as any, { $inc: { 'outputs.$.qty': delta } }, { session });
    }
    if (dq) await col('sc_discrepancies').insertOne(dq as any, { session });
  });
  return { outcome: settled, disputeId: dq?._id ?? null };
}

/** Holdings real-key helper re-exported for routes. */
/**
 * Work the performer has done on a job but not yet sent back, for one item and grade: outputs recorded (Work done,
 * sub-contract roll-ups, earlier returns) minus what earlier returns carried. A return only implies new output for the
 * part above this, so nothing is counted twice (model §3.5). Unprocessed returns are not output and don't count.
 */
export async function unreturnedOutput(job: any, specId: string, grade: string, excludeMovementId?: string): Promise<number> {
  const done = ((job.outputs ?? []) as any[]).filter((o) => o.spec_id === specId && (o.grade ?? 'A') === grade).reduce((a, o) => a + o.qty, 0);
  let returned = 0;
  for (const rid of (job.returns ?? []) as string[]) {
    if (rid === excludeMovementId) continue;
    const m: any = await col('sc_movements').findOne({ _id: rid, cancelled_at: null } as any, { projection: { lines: 1 } });
    for (const l of (m?.lines ?? []) as any[]) {
      if (l.job_id !== job._id || l.line_kind === 'unprocessed_return' || l.spec_id !== specId || (l.grade ?? 'A') !== grade) continue;
      returned += winningAssertion(l.sent)?.base_qty ?? 0;
    }
  }
  return Math.max(0, done - returned);
}

export { real };
