// Jobs, slice 4: job detail (03 S7), closing with leftovers / shortage / claim carried, reopening (by hand and when a
// later figure outranks the one the closure used, 04 §5.6.3), cancelling (V), and Made here (in-house jobs, U8).
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { holdingId, lotForUntyped, newId, post } from './repo.js';
import { me, qtyBase, specInfo } from './ledgerOps.js';
import { lineLabel, partyNames } from './views.js';
import { postOutput, pseudo, real, reverse, type Goods } from '../../../shared/sc/postings.js';
import { approxPending, planClosure, type ClosureLine, type ClosureOutput, type ClosurePlan } from '../../../shared/sc/conservation.js';
import { workingDaysBetween, lateness, todayIST } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import { normaliseSpec, specLabel, type MaterialTypeDef } from '../../../shared/sc/specs.js';
import type { ConservationKind, Dimension, Grade, PartyRef, Posting, RealKey } from '../../../shared/sc/types.js';

const router = Router();

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details.');
  return r.data;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const OPEN_DISPUTE = ['open', 'proposed', 'countered', 'escalated'];
const isMe = (ctx: Ctx, p: PartyRef | null | undefined) => !!p && p.k === 'b' && p.id === ctx.businessId;
const pk = (p: PartyRef) => `${p.k}:${p.id}`;

// ── Spec metadata ───────────────────────────────────────────────────────────────────────────────

interface SpecMeta { label: string; attrs: Record<string, unknown>; mtKey: string; dim: Dimension; role: 'primary' | 'secondary'; group: string }

async function specMeta(ids: string[]): Promise<Map<string, SpecMeta>> {
  const specs = await col('sc_specs').find({ _id: { $in: [...new Set(ids)] } } as any).toArray();
  const mts = await col('sc_material_types').find({ _id: { $in: [...new Set(specs.map((s: any) => s.material_type_id))] } } as any).toArray();
  const mtBy = new Map(mts.map((m: any) => [m._id, m]));
  return new Map(
    specs.map((s: any) => {
      const mt: any = mtBy.get(s.material_type_id) ?? {};
      const a = s.attrs ?? {};
      // One "component" for assembling: same material type, style, panel component and kind; sizes and lots share outputs.
      const group = `${mt.key}|${a.style ?? ''}|${a.component ?? ''}|${a.kind ?? ''}`;
      return [s._id, { label: s.label_en, attrs: a, mtKey: mt.key, dim: mt.base_dimension, role: mt.form === 'trim' ? 'secondary' : 'primary', group }];
    }),
  );
}

/** Cutting: pieces × weight per set (from the style) + weighed waste, in grams. Null when a style has no weight. */
async function cuttingEstimate(ownerBiz: string, outputs: { spec_id: string; qty: number; dim: Dimension }[], meta: Map<string, SpecMeta>): Promise<number | null> {
  let est = 0;
  for (const o of outputs) {
    if (o.dim === 'mass') { est += o.qty; continue; }
    const style = meta.get(o.spec_id)?.attrs.style;
    if (!style) return null;
    const st = await col('sc_styles').findOne({ _id: `st_${ownerBiz}_${String(style).toUpperCase()}` } as any, { projection: { set_weight_g: 1 } });
    if (!st?.set_weight_g) return null;
    est += o.qty * st.set_weight_g;
  }
  return est;
}

// ── Closure ─────────────────────────────────────────────────────────────────────────────────────

type Disposition = 'kept_adjusted' | 'kept_for_next' | 'scrapped';
interface Leftover { row_id: string; base: number; disposition: Disposition; rate_paise?: number | null; qty_entered?: number; unit?: string }

const allocatedRows = async (jobId: string) =>
  (await col('sc_holdings').find({ t: 'real', 'key.state.s': 'allocated', 'key.state.ref': jobId, qty_base: { $gt: 0 } } as any).toArray()) as any[];

async function jobMovementIds(j: any): Promise<string[]> {
  return [...new Set([...(j.inputs ?? []).map((i: any) => i.movement_id), ...(j.returns ?? []), ...(j.forwards ?? []).map((f: any) => f.movement_id)].filter(Boolean))];
}

async function openDisputes(j: any) {
  const ids = await jobMovementIds(j);
  return col('sc_discrepancies').find({ state: { $in: OPEN_DISPUTE }, $or: [{ 'refs.job_id': j._id }, { 'refs.job_ids': j._id }, { 'refs.movement_id': { $in: ids } }] } as any).toArray();
}

interface Prepared {
  rows: any[];
  leftovers: (Leftover & { row: any })[];
  plan: ClosurePlan;
  meta: Map<string, SpecMeta>;
  kind: ConservationKind;
  /** What needs an explicit yes before closing. */
  needs: { shortage: number; highLoss: number | null; unexplained: number | null };
}

async function prepareClose(j: any, leftovers: Leftover[]): Promise<Prepared> {
  const rows = await allocatedRows(j._id);
  const own = (j.outputs as any[]).filter((o) => o.source !== 'child');
  const meta = await specMeta([...rows.map((r) => r.key.spec), ...own.map((o) => o.spec_id)]);
  const taken = new Map<string, number>();
  const lfs: Prepared['leftovers'] = [];
  for (const lf of leftovers) {
    const row = rows.find((r) => r._id === lf.row_id);
    if (!row) throw new HttpError(400, 'Please pick the leftover again.');
    const used = (taken.get(row._id) ?? 0) + lf.base;
    if (used > row.qty_base) throw new HttpError(400, 'That is more than is left with them.');
    taken.set(row._id, used);
    lfs.push({ ...lf, row });
  }
  const lines: ClosureLine[] = rows.map((r) => {
    const m = meta.get(r.key.spec);
    return { id: r._id, dim: r.dimension, qty: r.qty_base - (taken.get(r._id) ?? 0), role: m?.role ?? 'primary', group: m?.group ?? r.key.spec, size: (m?.attrs.size as string) ?? null };
  });
  const outs: ClosureOutput[] = own.map((o) => ({ dim: o.dim, qty: o.qty, size: (meta.get(o.spec_id)?.attrs.size as string) ?? null }));
  const kind = j.conservation_kind as ConservationKind;
  const est = kind === 'unit_changing' && j.owner_party?.k === 'b' ? await cuttingEstimate(j.owner_party.id, own, meta) : null;
  const plan = planClosure(kind, lines, outs, { estimateInto: est });
  const norm = Number(j.loss_norm_pct ?? 0);
  const consumedPrimary = plan.lines.filter((l) => lines.find((x) => x.id === l.id)?.role === 'primary').reduce((a, l) => a + l.consumed, 0);
  const needs: Prepared['needs'] = { shortage: 0, highLoss: null, unexplained: null };
  if (kind === 'count_preserving' || kind === 'assembling') needs.shortage = plan.residual;
  if (kind === 'mass_losing' && plan.lossPct !== null && plan.lossPct > norm + Math.max(2, norm * 0.5)) needs.highLoss = plan.lossPct;
  if (kind === 'unit_changing' && !plan.unchecked && consumedPrimary > 0 && Math.abs(plan.residual) / consumedPrimary > Math.max(0.02, norm / 100)) needs.unexplained = plan.residual;
  return { rows, leftovers: lfs, plan, meta, kind, needs };
}

function closurePostings(j: any, p: Prepared, acceptedShortage: boolean): Posting[] {
  const owner = j.owner_party as PartyRef;
  const performer = j.performer_party as PartyRef;
  const out: Posting[] = [];
  const goodsOf = (k: RealKey, dim: Dimension): Goods => ({ spec: k.spec, lot: k.lot, grade: k.grade, dim });
  for (const lf of p.leftovers) {
    const k = lf.row.key as RealKey;
    const dim = lf.row.dimension as Dimension;
    const g = goodsOf(k, dim);
    out.push({ key: k, delta: -lf.base, dim });
    if (lf.disposition === 'kept_for_next') out.push({ key: { ...k, state: { s: 'available' } }, delta: lf.base, dim });
    else if (lf.disposition === 'scrapped') out.push({ key: pseudo(g, 'WRITTEN_OFF', 'scrapped', owner, performer), delta: lf.base, dim });
    else if (performer.k === 'b') out.push({ key: { ...k, owner: performer, via: null, state: { s: 'available' } }, delta: lf.base, dim });
    else out.push({ key: pseudo(g, 'EXTERNAL', `sold:${pk(performer)}`, owner), delta: lf.base, dim });
  }
  const rowsById = new Map(p.rows.map((r) => [r._id, r]));
  for (const pl of p.plan.lines) {
    const row = rowsById.get(pl.id);
    if (!row || pl.consumed === 0) continue;
    const k = row.key as RealKey;
    const dim = row.dimension as Dimension;
    const g = goodsOf(k, dim);
    out.push({ key: k, delta: -pl.consumed, dim });
    if (pl.intoOutput) out.push({ key: pseudo(g, 'CONSUMED', j._id, owner), delta: pl.intoOutput, dim });
    if (pl.loss) out.push({ key: pseudo(g, 'LOSS', 'process', owner, performer), delta: pl.loss, dim });
    if (pl.residual) out.push({ key: pseudo(g, 'RESIDUAL', j._id, owner, acceptedShortage && !isMeParty(owner, performer) ? performer : null), delta: pl.residual, dim });
  }
  return out;
}
const isMeParty = (a: PartyRef, b: PartyRef) => a.k === b.k && a.id === b.id;

export interface CloseOpts { leftovers: Leftover[]; accept: boolean; carry: boolean; auto?: string | null; businessDate?: string }

/** Closes a job: one event that takes leftovers out, then posts consumed → into output + loss + residual (model §4.2). */
export async function closeJob(ctx: Ctx, jobId: string, opts: CloseOpts) {
  const j = await col('sc_jobs').findOne({ _id: jobId } as any);
  if (!j) throw new HttpError(404, 'Not found');
  if (j.status === 'closed') throw new HttpError(409, 'This job is already closed.');
  if (j.status === 'cancelled') throw new HttpError(409, 'This record was undone.');
  // Work still out with a sub-contractor belongs to this job: close the sub-contract first (its return rolls up here).
  const openChild = await col('sc_jobs').findOne({ parent_job_id: j._id, status: { $in: ['issued', 'in_progress'] } } as any, { projection: { _id: 1 } });
  if (openChild && !opts.auto) throw Object.assign(new HttpError(409, 'Part of this job is still with a sub-contractor.'), { body: { code: 'subcontract_open' } });
  const disputes = await openDisputes(j);
  if (disputes.length && !opts.carry) throw Object.assign(new HttpError(409, 'A difference on this job is still open.'), { body: { code: 'disputes', disputes: disputes.map((d: any) => ({ id: d._id, label: d.line_label, difference: d.difference, dim: d.dim })) } });
  const p = await prepareClose(j, opts.leftovers);
  if (!opts.accept && (p.needs.shortage > 0 || p.needs.highLoss !== null || p.needs.unexplained !== null)) {
    throw Object.assign(new HttpError(409, 'Some goods are not accounted for.'), { body: { code: 'unaccounted', ...p.needs } });
  }
  const postings = closurePostings(j, p, opts.accept);
  const now = Date.now();
  const businessDate = opts.businessDate ?? todayIST();
  const adjustments = p.leftovers
    .filter((l) => l.disposition === 'kept_adjusted' && l.rate_paise)
    .map((l) => ({ kind: 'leftover_kept', label: p.meta.get(l.row.key.spec)?.label ?? '', qty: l.qty_entered ?? l.base, unit: l.unit ?? '', rate_paise: l.rate_paise, amount_paise: Math.round((l.qty_entered ?? l.base) * (l.rate_paise ?? 0)), date: businessDate }));
  const summary = {
    at: now, by: ctx.businessId, business_date: businessDate, auto: opts.auto ?? null,
    residual: p.plan.residual, loss: p.plan.loss, loss_pct: p.plan.lossPct, over_yield: p.plan.overYield, unchecked: p.plan.unchecked,
    accepted: opts.accept && (p.needs.shortage > 0 || p.needs.highLoss !== null || p.needs.unexplained !== null),
    carried_claims: disputes.map((d: any) => d._id),
    leftovers: p.leftovers.map((l) => ({ row_id: l.row_id, base: l.base, dim: l.row.dimension, disposition: l.disposition, rate_paise: l.rate_paise ?? null, qty_entered: l.qty_entered ?? null, unit: l.unit ?? null, label: p.meta.get(l.row.key.spec)?.label ?? '' })),
    adjustments,
  };
  await post(ctx, { type: 'job_close', ref: { kind: 'job', id: j._id }, payload: { residual: p.plan.residual, loss: p.plan.loss, auto: opts.auto ?? null }, business_date: businessDate }, postings, async (session, eventId) => {
    const r = await col('sc_jobs').updateOne(
      { _id: j._id, status: j.status, version: j.version } as any,
      { $set: { status: 'closed', closed_at: now, closure: { ...summary, event_id: eventId, postings, opts: { leftovers: opts.leftovers, accept: opts.accept, carry: opts.carry } } }, $inc: { version: 1 } },
      { session },
    );
    if (!r.matchedCount) throw new HttpError(409, 'Someone changed this job just now. Please try again.');
  });
  return { plan: p.plan, closure: summary };
}

/** Reverses the closure postings and puts the job back in progress with a dated reason (model §4.2 reopen). */
export async function reopenJob(ctx: Ctx, jobId: string, reason: string, auto = false) {
  const j = await col('sc_jobs').findOne({ _id: jobId } as any);
  if (!j || j.status !== 'closed' || !j.closure) throw new HttpError(409, 'This job is not closed.');
  const { postings, ...prev } = j.closure;
  const now = Date.now();
  await post(ctx, { type: 'job_reopen', ref: { kind: 'job', id: j._id }, payload: { reason, auto }, business_date: todayIST() }, reverse(postings as Posting[]), async (session) => {
    const r = await col('sc_jobs').updateOne(
      { _id: j._id, status: 'closed', version: j.version } as any,
      { $set: { status: j.completed_at ? 'completed' : 'in_progress', closed_at: null, closure: null }, $push: { reopens: { at: now, business_date: todayIST(), reason, auto, by: ctx.businessId, previous: prev } } as any, $inc: { version: 1 } },
      { session },
    );
    if (!r.matchedCount) throw new HttpError(409, 'Someone changed this job just now. Please try again.');
  });
  return prev.opts as Omit<CloseOpts, 'auto'>;
}

/**
 * 04 §5.6.3: a later figure on a line of a closed job outranks the one the closure used. Reopen, apply the figure,
 * close again with the same choices; the bill keeps the earlier close as a dated line. If closing again fails (say the
 * new figure opens a difference), the job stays open with its reason, which is the honest state.
 */
export async function withLateFigure<T>(ctx: Ctx, jobIds: (string | null | undefined)[], reason: string, apply: () => Promise<T>): Promise<T> {
  const closed = await col('sc_jobs').find({ _id: { $in: jobIds.filter(Boolean) }, status: 'closed' } as any, { projection: { _id: 1 } }).toArray();
  const reopened: [string, Omit<CloseOpts, 'auto'>][] = [];
  for (const c of closed) reopened.push([c._id as unknown as string, await reopenJob(ctx, c._id as unknown as string, reason, true)]);
  try {
    return await apply();
  } finally {
    // Close again with the owner's own choices (never accepting a shortage on their behalf). If the figure was refused,
    // this restores the earlier closure; if closing now needs a yes, the job stays open with the reason recorded.
    for (const [id, opts] of reopened) {
      try {
        await closeJob(ctx, id, { ...opts, carry: true, auto: reason });
      } catch (e) {
        await col('sc_jobs').updateOne({ _id: id } as any, { $set: { reclose_failed: { at: Date.now(), reason: (e as Error).message } } });
      }
    }
  }
}

// ── Routes: close, reopen, cancel ───────────────────────────────────────────────────────────────

/** The job's client decides about closing: the owner for a direct job, the intermediary for a sub-contract. */
async function clientJob(ctx: Ctx, id: string) {
  const j = await col('sc_jobs').findOne({ _id: id, 'client_party.k': 'b', 'client_party.id': ctx.businessId } as any);
  if (!j) throw new HttpError(404, 'Not found');
  return j;
}
function ownerRole(ctx: Ctx) {
  if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can close or reopen a job.');
}

const leftoverIn = z.array(z.object({ row_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), disposition: z.enum(['kept_adjusted', 'kept_for_next', 'scrapped']), rate_paise: z.number().int().min(0).max(10_000_000).optional() })).max(20);

async function leftoversToBase(rows: any[], list: z.infer<typeof leftoverIn>): Promise<Leftover[]> {
  const out: Leftover[] = [];
  for (const l of list) {
    const row = rows.find((r) => r._id === l.row_id);
    if (!row) throw new HttpError(400, 'Please pick the leftover again.');
    const info = await specInfo(row.key.spec);
    out.push({ row_id: l.row_id, base: qtyBase(l.qty, l.unit, info).base, disposition: l.disposition, rate_paise: l.rate_paise ?? null, qty_entered: l.qty, unit: l.unit });
  }
  return out;
}

/** What closing would post, with leftovers to decide and what needs a yes. Nothing is written. */
router.get(
  '/sc/jobs/:id/close-preview',
  h(async (req: ScRequest, res) => {
    const j = await clientJob(req.ctx, req.params.id);
    const p = await prepareClose(j, []);
    const disputes = await openDisputes(j);
    const lines = p.plan.lines.map((pl) => {
      const row = p.rows.find((r) => r._id === pl.id);
      const m = p.meta.get(row.key.spec);
      return { row_id: pl.id, label: m?.label ?? '', lot: row.key.lot, dim: row.dimension, role: m?.role ?? 'primary', units: [] as string[], ...pl };
    });
    for (const l of lines) l.units = (await specInfo(p.rows.find((r) => r._id === l.row_id).key.spec)).units;
    res.json({ kind: p.kind, plan: { residual: p.plan.residual, loss: p.plan.loss, lossPct: p.plan.lossPct, overYield: p.plan.overYield, unchecked: p.plan.unchecked }, needs: p.needs, lines, disputes: disputes.map((d: any) => ({ id: d._id, label: d.line_label, difference: d.difference, dim: d.dim })), status: j.status });
  }),
);

router.post(
  '/sc/jobs/:id/close',
  h(async (req: ScRequest, res) => {
    ownerRole(req.ctx);
    const b = parse(z.object({ leftovers: leftoverIn.default([]), accept: z.boolean().default(false), carry_claim: z.boolean().default(false), business_date: date.optional() }), req.body);
    const j = await clientJob(req.ctx, req.params.id);
    const leftovers = await leftoversToBase(await allocatedRows(j._id), b.leftovers);
    try {
      res.json(await closeJob(req.ctx, j._id, { leftovers, accept: b.accept, carry: b.carry_claim, businessDate: b.business_date }));
    } catch (e: any) {
      const body = (e as { body?: Record<string, unknown> }).body;
      if (e instanceof HttpError && e.status === 409 && body) return res.status(409).json({ error: e.publicMessage, ...body });
      throw e;
    }
  }),
);

router.post(
  '/sc/jobs/:id/reopen',
  h(async (req: ScRequest, res) => {
    ownerRole(req.ctx);
    const b = parse(z.object({ reason: z.string().trim().min(2).max(200) }), req.body);
    const j = await clientJob(req.ctx, req.params.id);
    await reopenJob(req.ctx, j._id, b.reason);
    res.json({ reopened: true });
  }),
);

/** V: stop the work. Nothing moves; what is still there comes back "as sent", then the job closes as usual. */
router.post(
  '/sc/jobs/:id/cancel',
  h(async (req: ScRequest, res) => {
    ownerRole(req.ctx);
    const b = parse(z.object({ on: z.boolean().default(true), reason: z.string().trim().max(200).optional() }), req.body);
    const j = await clientJob(req.ctx, req.params.id);
    if (j.status === 'closed') throw new HttpError(409, 'This job is already closed.');
    await col('sc_jobs').updateOne({ _id: j._id } as any, b.on ? { $set: { cancelled_at: Date.now(), cancel_reason: b.reason ?? null }, $inc: { version: 1 } } : { $set: { cancelled_at: null, cancel_reason: null }, $inc: { version: 1 } });
    res.json({ cancelled: b.on });
  }),
);

// ── Job detail (03 S7) ──────────────────────────────────────────────────────────────────────────

router.get(
  '/sc/jobs/:id/detail',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const j: any = await col('sc_jobs').findOne({ _id: req.params.id, $or: [{ 'owner_party.k': 'b', 'owner_party.id': ctx.businessId }, { 'client_party.k': 'b', 'client_party.id': ctx.businessId }] } as any);
    if (!j || j.status === 'cancelled') throw new HttpError(404, 'Not found');
    // D2: an undisclosed sub-contract is between the intermediary and its sub-contractor; the owner never opens it.
    if (j.disclosed === false && !isMe(ctx, j.client_party)) throw new HttpError(404, 'Not found');
    const children = await col('sc_jobs').find({ $or: [{ parent_job_id: j._id }, { hop_from_job_id: j._id }, { split_from_job_id: j._id }, { rework_of: j._id }], status: { $ne: 'cancelled' } } as any).toArray();
    const movIds = [...(await jobMovementIds(j)), ...children.flatMap((c: any) => c.returns ?? [])];
    const movs = new Map((await col('sc_movements').find({ _id: { $in: movIds }, cancelled_at: null } as any).toArray()).map((m: any) => [m._id, m]));
    const meta = await specMeta([...(j.inputs ?? []).map((i: any) => i.spec_id), ...(j.outputs ?? []).map((o: any) => o.spec_id)]);
    const roleOf = (spec: string) => (j.inputs as any[]).find((i) => i.spec_id === spec)?.role ?? meta.get(spec)?.role ?? 'primary';

    // Inputs as issued (received basis, P6), per line.
    const inputs = (j.inputs as any[]).map((inp) => {
      const line = movs.get(inp.movement_id)?.lines.find((l: any) => l.line_id === inp.line_id);
      const sent = line ? winningAssertion(line.sent)?.base_qty ?? 0 : inp.qty ?? 0;
      const r = line ? winningAssertion(line.received) : null;
      const issued = line ? line.resolved_received ?? Math.min(r?.base_qty ?? sent, sent) : inp.qty ?? 0;
      return { spec_id: inp.spec_id, label: line ? lineLabel(ctx, line) : meta.get(inp.spec_id)?.label ?? '', lot: inp.lot ?? line?.lot ?? null, dim: (inp.dim ?? line?.dim) as Dimension, role: inp.role ?? 'primary', sent, issued };
    });
    const primary = inputs.filter((i) => i.role === 'primary');
    const dim: Dimension = primary[0]?.dim ?? 'count';
    const issued = primary.filter((i) => i.dim === dim).reduce((a, i) => a + i.issued, 0);

    // Unprocessed back, sent on (sub-contract and hops), outputs by grade.
    let unprocessed = 0;
    for (const rid of j.returns ?? []) for (const l of movs.get(rid)?.lines ?? []) if (l.job_id === j._id && l.line_kind === 'unprocessed_return' && roleOf(l.spec_id) === 'primary' && l.dim === dim) unprocessed += winningAssertion(l.sent)?.base_qty ?? 0;
    const sub = children.filter((c: any) => c.parent_job_id === j._id);
    const hops = children.filter((c: any) => c.hop_from_job_id === j._id);
    const sales = children.filter((c: any) => c.split_from_job_id === j._id);
    const reworks = children.filter((c: any) => c.rework_of === j._id);
    const sentOnHop = hops.reduce((a: number, c: any) => a + (c.sent_inputs ?? c.issued_sent ?? 0), 0);
    const soldInPlace = sales.reduce((a: number, c: any) => a + (c.sent_inputs ?? c.issued_sent ?? 0), 0);
    const lostCasualty = j.casualty_lost ?? 0; // written off after a fire, theft or flood at the unit
    const outs = (j.outputs as any[]).filter((o) => o.dim === dim || j.conservation_kind === 'unit_changing');
    const byGrade: Record<string, number> = {};
    for (const o of outs.filter((o) => o.dim !== 'mass' || dim === 'mass')) byGrade[o.grade ?? 'A'] = (byGrade[o.grade ?? 'A'] ?? 0) + o.qty;
    const outputsTotal = Object.values(byGrade).reduce((a, x) => a + x, 0);
    const kind = j.conservation_kind as ConservationKind;
    const factor = kind === 'mass_losing' ? (j.loss_norm_pct ?? 0) / 100 : 1;
    const pend = approxPending({ kind: kind === 'unit_changing' ? 'assembling' : kind, issued: Math.max(0, issued - unprocessed - sentOnHop - soldInPlace - lostCasualty), outputs: kind === 'unit_changing' ? 0 : outputsTotal, factor });

    // The conservation bar, in the input's unit. Open jobs show an estimate for what is still there.
    const segs: { kind: string; qty: number; grade?: string; approx?: boolean }[] = [];
    if (kind !== 'unit_changing') for (const [g, q] of Object.entries(byGrade).sort((a, b) => GRADE_ORDER.indexOf(a[0]) - GRADE_ORDER.indexOf(b[0]))) segs.push({ kind: 'output', grade: g, qty: q });
    if (unprocessed) segs.push({ kind: 'unprocessed', qty: unprocessed });
    if (sentOnHop) segs.push({ kind: 'sent_on', qty: sentOnHop });
    if (soldInPlace) segs.push({ kind: 'sold', qty: soldInPlace });
    if (lostCasualty) segs.push({ kind: 'lost', qty: lostCasualty });
    const closure = j.closure ?? null;
    const leftoverQty = (closure?.leftovers ?? []).reduce((a: number, l: any) => a + (l.dim === dim ? l.base : 0), 0);
    if (j.status === 'closed' && closure) {
      if (kind === 'unit_changing') segs.push({ kind: 'output_est', qty: Math.max(0, issued - unprocessed - sentOnHop - soldInPlace - lostCasualty - (closure.residual ?? 0)), approx: true });
      if (closure.loss) segs.push({ kind: closure.loss < 0 ? 'gain' : 'loss', qty: Math.abs(closure.loss) });
      if (closure.residual) segs.push({ kind: 'unaccounted', qty: Math.abs(closure.residual) });
    } else {
      if (kind === 'mass_losing') {
        const lossSoFar = Math.max(0, issued - unprocessed - sentOnHop - soldInPlace - lostCasualty - outputsTotal - pend.input);
        if (pend.input === 0 && lossSoFar) segs.push({ kind: 'loss', qty: lossSoFar });
      }
      if (pend.input > 0) segs.push({ kind: 'still_there', qty: kind === 'unit_changing' ? Math.max(0, issued - unprocessed - sentOnHop - soldInPlace - lostCasualty) : pend.input, approx: true });
    }

    // Outputs grid: spec × grade.
    const grid = new Map<string, { label: string; dim: Dimension; grades: Record<string, number>; via_sub: number }>();
    for (const o of j.outputs as any[]) {
      const k = o.spec_id;
      if (!grid.has(k)) grid.set(k, { label: meta.get(k)?.label ?? '', dim: o.dim, grades: {}, via_sub: 0 });
      const g = grid.get(k)!;
      g.grades[o.grade ?? 'A'] = (g.grades[o.grade ?? 'A'] ?? 0) + o.qty;
      if (o.source === 'child') g.via_sub += o.qty;
    }

    const names = await partyNames(ctx, [j.performer_party, ...children.map((c: any) => c.performer_party)]);
    const proc = await col('sc_process_types').findOne({ key: j.process_key } as any, { projection: { labels: 1 } });
    const disputes = j.status === 'closed' ? [] : await openDisputes(j);
    const today = todayIST();
    const isOwnerOrClient = isMe(ctx, j.client_party) || isMe(ctx, j.owner_party);
    res.json({
      job: {
        id: j._id, process: proc?.labels ?? null, process_key: j.process_key, kind, status: j.status, in_house: !!j.in_house, cancelled: !!j.cancelled_at, cancel_reason: j.cancel_reason ?? null,
        performer: j.performer_party, performerName: j.in_house ? null : names.get(pk(j.performer_party))?.name ?? '—',
        since: j.business_date, expected_at: j.expected_at, closed_at: j.closed_at ?? null, completed_at: j.completed_at ?? null,
        late: j.status === 'closed' || j.in_house || j.cancelled_at ? null : lateness(j.expected_at, today, { pausedDays: (j.pauses ?? []).reduce((n: number, p: any) => n + workingDaysBetween(p.from, p.to ?? today), 0), reason: (j.pauses ?? []).some((p: any) => !p.to) ? 'held_for_dues' : j.ready_at ? 'ready_not_collected' : 'processing' }),
        ready: !!j.ready_at, held: (j.pauses ?? []).find((x: any) => !x.to)?.reason ?? null,
        rework_of: j.rework_of ?? null, loss_norm_pct: j.loss_norm_pct ?? 0,
      },
      dim, issued, segments: segs, pending: j.status === 'closed' ? 0 : pend.input,
      inputs, grid: [...grid.values()],
      children: [...sub.map((c: any) => ({ kind: 'sub', c })), ...hops.map((c: any) => ({ kind: 'hop', c })), ...sales.map((c: any) => ({ kind: 'sold', c })), ...reworks.map((c: any) => ({ kind: 'rework', c }))].map(({ kind: ck, c }) => ({
        // An undisclosed sub-contractor is named only to the one who sub-contracted (D2).
        ...(c.disclosed === false && !isMe(ctx, c.client_party) ? { id: null, name: null, masked: true } : { id: c._id, name: names.get(pk(c.performer_party))?.name ?? '—' }), kind: ck, sent: c.sent_inputs ?? c.issued_sent ?? 0, status: c.status, since: c.business_date,
        outputs: (c.outputs as any[]).reduce((acc: Record<string, number>, o: any) => ({ ...acc, [o.grade ?? 'A']: (acc[o.grade ?? 'A'] ?? 0) + o.qty }), {}),
      })),
      disputes: disputes.map((d: any) => ({ id: d._id, label: d.line_label, difference: d.difference, dim: d.dim })),
      closure: closure && { at: closure.at, business_date: closure.business_date, residual: closure.residual, loss: closure.loss, loss_pct: closure.loss_pct, over_yield: closure.over_yield, unchecked: closure.unchecked, accepted: closure.accepted, carried_claims: closure.carried_claims, leftovers: isOwnerOrClient && ctx.role === 'owner' ? closure.leftovers : (closure.leftovers ?? []).map(({ rate_paise: _r, amount_paise: _a, ...l }: any) => l), auto: closure.auto, leftoverQty },
      adjustments: isOwnerOrClient && ctx.role === 'owner' ? closure?.adjustments ?? [] : [],
      // A dated bill change against the figure locked before the last reopen (model §4.2), only when it differs.
      billChange: isOwnerOrClient && ctx.role === 'owner' ? billChange(j) : null,
      reopens: (j.reopens ?? []).map((r: any) => ({ at: r.at, business_date: r.business_date, reason: r.reason, auto: r.auto })),
      reclose_failed: j.reclose_failed ?? null,
      canClose: isMe(ctx, j.client_party) && ctx.role === 'owner' && j.status !== 'closed' && !j.in_house,
      canSellPart: isMe(ctx, j.client_party) && isMe(ctx, j.owner_party) && ctx.role === 'owner' && j.status !== 'closed' && !j.in_house && !j.cancelled_at && pend.input > 0,
      canReopen: isMe(ctx, j.client_party) && ctx.role === 'owner' && j.status === 'closed',
    });
  }),
);
const GRADE_ORDER = ['A', 'B', 'rework', 'reject', 'scrap'];
function billChange(j: any): { from_paise: number; to_paise: number; business_date: string } | null {
  const last = (j.reopens ?? []).at(-1);
  if (!last?.previous) return null;
  const sum = (xs: any[] | undefined) => (xs ?? []).reduce((t: number, x: any) => t + (x.amount_paise ?? 0), 0);
  const from = sum(last.previous.adjustments);
  const to = j.status === 'closed' ? sum(j.closure?.adjustments) : 0;
  return from === to ? null : { from_paise: from, to_paise: to, business_date: last.business_date };
}

// ── Made here: in-house jobs (U8, J17) ───────────────────────────────────────────────────────────

const specIdOf = (identity: string) => `sp_${crypto.createHash('sha1').update(identity).digest('base64url').slice(0, 20)}`;

async function wasteSpec(kind: string): Promise<string> {
  const mt = (await col('sc_material_types').findOne({ _id: 'mt_waste' } as any)) as unknown as MaterialTypeDef & { _id: string; key: string };
  if (!mt) throw new HttpError(500, 'Waste material type missing.');
  const n = normaliseSpec(mt, { kind });
  if (!n.ok) throw new HttpError(400, 'Please check the waste.');
  const id = specIdOf(n.identity);
  await col('sc_specs').updateOne({ _id: id } as any, { $set: { label_en: specLabel(mt, n.attrs) }, $setOnInsert: { id, material_type_id: 'mt_waste', attrs: n.attrs, family_key: `waste|${kind}`, created_at: Date.now() } }, { upsert: true });
  return id;
}

const MADE = ['cutting', 'packing', 'checking', 'make_sets', 'unpack'] as const;
const qtyLine = z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), factor: z.number().positive().optional(), lot: z.string().trim().max(30).optional() });

router.post(
  '/sc/made',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(
      z.object({
        process_key: z.enum(MADE),
        inputs: z.array(qtyLine).min(1).max(20),
        outputs: z.array(qtyLine.extend({ grade: z.enum(['A', 'B', 'rework', 'reject', 'scrap']).default('A') })).min(1).max(60),
        waste: z.object({ qty: z.number().positive(), unit: z.string().max(10), kind: z.string().max(30).default('cut waste') }).optional(),
        from_place_id: z.string().max(40).optional(),
        place_id: z.string().max(40).optional(),
        business_date: date.optional(),
        client_id: z.string().min(8).max(40),
        allow_untracked: z.boolean().optional(),
        untracked_reason: z.string().trim().max(120).optional(),
        note: z.string().trim().max(200).optional(),
      }),
      req.body,
    );
    if (b.allow_untracked && ctx.role !== 'owner') return res.status(403).json({ error: 'Only the owner can record stock you never entered.', code: 'needs_owner' });
    const dup = await col('sc_jobs').findOne({ in_house: true, 'owner_party.id': ctx.businessId, client_id: b.client_id } as any, { projection: { _id: 1 } });
    if (dup) return res.json({ duplicate: true, job: { id: dup._id } });
    const proc = await col('sc_process_types').findOne({ key: b.process_key } as any);
    if (!proc) throw new HttpError(400, 'Please pick the work.');
    const self = me(ctx);
    const businessDate = b.business_date ?? todayIST();
    const jobId = newId('jb');
    const from = b.from_place_id ?? null;
    const to = b.place_id ?? from;
    const postings: Posting[] = [];
    const short: { index: number; available: number; needed: number; dim: Dimension }[] = [];
    const inputs: any[] = [];
    const rows = new Map<string, { _id: string; key: RealKey; dimension: Dimension; qty_base: number }>();
    for (const [i, l] of b.inputs.entries()) {
      const info = await specInfo(l.spec_id);
      const q = qtyBase(l.qty, l.unit, info, l.factor).base;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: 'A', dim: info.dim };
      let have = Math.max(0, (await col('sc_holdings').findOne({ _id: holdingId(real(goods, self, self, { s: 'available' }, { place: from }), info.dim) } as any))?.qty_base ?? 0);
      if (!goods.lot && have < q) {
        const alt = await lotForUntyped(self, info.id, from, q);
        if (alt) { goods.lot = alt.lot; have = alt.qty; }
      }
      const stockKey = real(goods, self, self, { s: 'available' }, { place: from });
      if (have < q) short.push({ index: i, available: have, needed: q, dim: info.dim });
      const fromStock = Math.min(have, q);
      if (fromStock) postings.push({ key: stockKey, delta: -fromStock, dim: info.dim });
      if (q > fromStock) postings.push({ key: pseudo(goods, 'EXTERNAL', `b:${ctx.businessId}`, self), delta: -(q - fromStock), dim: info.dim });
      const alloc = real(goods, self, self, { s: 'allocated', ref: jobId }, { place: from });
      postings.push({ key: alloc, delta: q, dim: info.dim });
      const id = holdingId(alloc, info.dim);
      rows.set(id, { _id: id, key: alloc, dimension: info.dim, qty_base: (rows.get(id)?.qty_base ?? 0) + q });
      inputs.push({ movement_id: null, line_id: newId('ln'), spec_id: info.id, dim: info.dim, lot: goods.lot, role: info.role, qty: q, from_untracked: q - fromStock });
    }
    if (short.length && !b.allow_untracked) return res.status(409).json({ error: 'You have less of this in stock than you are using.', code: 'negative', lines: short });
    const outputs: any[] = [];
    const outLines = [...b.outputs.map((o) => ({ ...o, waste: false })), ...(b.waste ? [{ spec_id: await wasteSpec(b.waste.kind), qty: b.waste.qty, unit: b.waste.unit, grade: 'A' as Grade, lot: undefined, factor: undefined, waste: true }] : [])];
    for (const o of outLines) {
      const info = await specInfo(o.spec_id);
      const q = qtyBase(o.qty, o.unit, info, o.factor).base;
      const goods: Goods = { spec: info.id, lot: o.lot || null, grade: o.grade, dim: info.dim };
      postings.push(...postOutput({ goods, qty: q, owner: self, performer: self, via: null, jobId, place: to }));
      outputs.push({ movement_id: null, line_id: newId('ln'), spec_id: info.id, grade: o.grade, lot: goods.lot, dim: info.dim, qty: q, business_date: businessDate, ...(o.waste ? { by_product: true } : {}) });
    }
    const issuedSent = inputs.filter((x) => x.role === 'primary').reduce((a, x) => a + x.qty, 0);
    const job: any = {
      _id: jobId, id: jobId, client_id: b.client_id, process_key: proc.key, process_type_id: proc._id, conservation_kind: proc.conservation_kind, loss_norm_pct: proc.loss_norm_pct, rate_basis: proc.rate_basis,
      owner_party: self, client_party: self, performer_party: self, via: null, in_house: true, parent_job_id: null, status: 'completed', completed_at: Date.now(),
      inputs, issued_sent: issuedSent, outputs, returns: [], business_date: businessDate, expected_at: businessDate, pauses: [], note: b.note ?? null, untracked_reason: b.allow_untracked ? b.untracked_reason ?? null : null,
      party_business_ids: [ctx.businessId], created_at: Date.now(), version: 1,
    };
    // Close in the same write: the closure reads the allocated rows this event creates.
    const prep: Prepared = await (async () => {
      const meta = await specMeta([...inputs.map((x) => x.spec_id), ...outputs.map((o) => o.spec_id)]);
      const lines: ClosureLine[] = [...rows.values()].map((r) => {
        const m = meta.get(r.key.spec);
        return { id: r._id, dim: r.dimension, qty: r.qty_base, role: m?.role ?? 'primary', group: m?.group ?? r.key.spec, size: (m?.attrs.size as string) ?? null };
      });
      const kind = proc.conservation_kind as ConservationKind;
      const est = kind === 'unit_changing' ? await cuttingEstimate(ctx.businessId, outputs, meta) : null;
      const plan = planClosure(kind, lines, outputs.map((o) => ({ dim: o.dim, qty: o.qty, size: (meta.get(o.spec_id)?.attrs.size as string) ?? null })), { estimateInto: est });
      return { rows: [...rows.values()], leftovers: [], plan, meta, kind, needs: { shortage: 0, highLoss: null, unexplained: null } };
    })();
    const closing = closurePostings(job, prep, false);
    const now = Date.now();
    const summary = { at: now, by: ctx.businessId, business_date: businessDate, auto: null, residual: prep.plan.residual, loss: prep.plan.loss, loss_pct: prep.plan.lossPct, over_yield: prep.plan.overYield, unchecked: prep.plan.unchecked, accepted: false, carried_claims: [], leftovers: [], adjustments: [] };
    await post(ctx, { type: 'made_here', ref: { kind: 'job', id: jobId }, payload: { process_key: proc.key }, business_date: businessDate, client_id: b.client_id }, [...postings, ...closing], async (session, eventId) => {
      await col('sc_jobs').insertOne({ ...job, status: 'closed', closed_at: now, closure: { ...summary, event_id: eventId, postings: closing, opts: { leftovers: [], accept: false, carry: false } } }, { session });
    });
    res.status(201).json({ job: { id: jobId }, plan: prep.plan, outputs: outputs.map((o) => ({ spec_id: o.spec_id, qty: o.qty, dim: o.dim, grade: o.grade, lot: o.lot, by_product: !!o.by_product })) });
  }),
);

/** Made here, in-house jobs I recorded: newest first (for Goods → In my unit and the Made here history). */
router.get(
  '/sc/made',
  h(async (req: ScRequest, res) => {
    const jobs = await col('sc_jobs').find({ in_house: true, 'owner_party.id': req.ctx.businessId, status: { $ne: 'cancelled' } } as any).sort({ created_at: -1 }).limit(30).toArray();
    const meta = await specMeta(jobs.flatMap((j: any) => [...j.inputs.map((i: any) => i.spec_id), ...j.outputs.map((o: any) => o.spec_id)]));
    res.json({
      jobs: jobs.map((j: any) => ({
        id: j._id, process_key: j.process_key, business_date: j.business_date, status: j.status,
        inputs: j.inputs.map((i: any) => ({ label: meta.get(i.spec_id)?.label ?? '', qty: i.qty, dim: i.dim, role: i.role })),
        outputs: j.outputs.map((o: any) => ({ label: meta.get(o.spec_id)?.label ?? '', qty: o.qty, dim: o.dim, grade: o.grade, by_product: !!o.by_product })),
        residual: j.closure?.residual ?? 0, unchecked: !!j.closure?.unchecked,
      })),
    });
  }),
);

export default router;
