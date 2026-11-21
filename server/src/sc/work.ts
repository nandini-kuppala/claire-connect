// Slice 3 (05 §2): the job worker's side. Others' goods by principal, work done (outputs), ready / held for dues,
// send back to the owner, and forward to another unit (sub-contract keeps `via`, owner-instructed hop drops it).
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { newId, post } from './repo.js';
import { UNDO_MS, assertion, me, qtyBase, sameParty, specInfo, termsFor } from './ledgerOps.js';
import { enqueueCard } from './goodsChat.js';
import { lineLabel, partyNames } from './views.js';
import { postOutput, postReceipt, postSend, type Goods } from '../../../shared/sc/postings.js';
import { approxPending } from '../../../shared/sc/conservation.js';
import { addWorkingDays, lateness, todayIST, workingDaysBetween } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { ConservationKind, PartyRef, Posting } from '../../../shared/sc/types.js';

const router = Router();
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const partyRef = z.object({ k: z.enum(['b', 'c']), id: z.string().min(1).max(64) });
const pk = (p: PartyRef) => `${p.k}:${p.id}`;
const bizIds = (...ps: (PartyRef | null | undefined)[]) => [...new Set(ps.filter((p): p is PartyRef => !!p && p.k === 'b').map((p) => p.id))];

async function myWork(ctx: Ctx, id: string) {
  const j = await col('sc_jobs').findOne({ _id: id, 'performer_party.k': 'b', 'performer_party.id': ctx.businessId } as any);
  if (!j) throw new HttpError(404, 'Not found');
  if (['closed', 'cancelled'].includes(j.status)) throw new HttpError(409, 'This job is already closed.');
  return j as any;
}

/** Days paused (held for dues, detained…) up to today, for honest lateness (model §11.1). */
export function pausedDays(j: any, today: string) {
  return (j.pauses ?? []).reduce((n: number, p: any) => n + workingDaysBetween(p.from, p.to ?? today), 0);
}

/** A sub-contractor must not learn whose goods these are: style codes and brands are dropped from forwarded lines. */
async function genericLabel(specId: string) {
  const sp = await col('sc_specs').findOne({ _id: specId } as any);
  const mt = sp ? await col('sc_material_types').findOne({ _id: sp.material_type_id } as any) : null;
  if (!sp || !mt) return 'Goods';
  const a = sp.attrs ?? {};
  const parts = [a.state, a.colour, a.structure, a.kind, a.component, a.gsm ? `${a.gsm} GSM` : null, a.size ? String(a.size).toUpperCase() : null].filter(Boolean);
  const s = parts.join(' ');
  return `${s ? s.charAt(0).toUpperCase() + s.slice(1) + ' · ' : ''}${mt.labels.en}`;
}

interface WorkRow {
  id: string; client: PartyRef; owner_hidden: boolean; process_key: string; status: string; since: string; expected_at: string;
  late: ReturnType<typeof lateness>; dim: string; received: number; receivedBasis: 'confirmed' | 'their_record'; outputs: number; ownOutputs: number;
  returned: number; forwarded: number; outputsHere: number; inputsHere: number; ready: boolean; held: string | null; inputLabel: string; parentJobId: string | null;
  instructions: { id: string; to: PartyRef; to_name?: string; process_key: string }[];
}

/** Jobs this business performs, grouped by whom it works for (`via ?? owner`, i.e. the job's client). */
export async function workRows(ctx: Ctx): Promise<WorkRow[]> {
  const jobs = await col('sc_jobs').find({ 'performer_party.k': 'b', 'performer_party.id': ctx.businessId, status: { $in: ['issued', 'in_progress', 'completed'] } } as any).sort({ expected_at: 1 }).limit(300).toArray();
  if (!jobs.length) return [];
  const ids = jobs.map((j: any) => j._id);
  const movIds = [...new Set(jobs.flatMap((j: any) => [...j.inputs.map((i: any) => i.movement_id), ...(j.returns ?? [])]))].filter(Boolean);
  const [movs, children, specs] = await Promise.all([
    col('sc_movements').find({ _id: { $in: movIds }, cancelled_at: null } as any).toArray(),
    col('sc_jobs').find({ $or: [{ parent_job_id: { $in: ids } }, { hop_from_job_id: { $in: ids } }], status: { $ne: 'cancelled' } } as any).toArray(),
    col('sc_specs').find({ _id: { $in: [...new Set(jobs.map((j: any) => j.inputs[0]?.spec_id))] } } as any, { projection: { label_en: 1 } }).toArray(),
  ]);
  const mv = new Map(movs.map((m: any) => [m._id, m]));
  const label = new Map(specs.map((s: any) => [s._id, s.label_en]));
  // A sub-contractor sees the plain name the forward carried, never the owner's style code.
  const inputLabel = (j: any) => {
    const ln = (mv.get(j.inputs[0]?.movement_id)?.lines ?? []).find((l: any) => l.spec_id === j.inputs[0]?.spec_id);
    return ln ? lineLabel(ctx, ln) : label.get(j.inputs[0]?.spec_id) ?? '';
  };
  const today = todayIST();
  return jobs.map((j: any) => {
    let received = 0;
    let confirmed = true;
    let dim = 'mass';
    for (const inp of j.inputs.filter((i: any) => i.role !== 'secondary')) {
      const line = mv.get(inp.movement_id)?.lines.find((l: any) => l.line_id === inp.line_id);
      if (!line) continue;
      dim = line.dim;
      const mine = (line.received as any[]).filter((a) => a.by?.business_id === ctx.businessId);
      const r = line.resolved_received ?? (mine.length ? winningAssertion(mine)!.base_qty : winningAssertion(line.received)?.base_qty ?? winningAssertion(line.sent)?.base_qty ?? 0);
      if (!mine.length && line.resolved_received === undefined) confirmed = false;
      received += r;
    }
    const outputs = (j.outputs as any[]).filter((o) => o.dim === dim).reduce((a, o) => a + o.qty, 0);
    const ownOutputs = (j.outputs as any[]).filter((o) => o.dim === dim && o.source !== 'child').reduce((a, o) => a + o.qty, 0);
    let returned = 0;
    for (const rid of j.returns ?? []) for (const l of mv.get(rid)?.lines ?? []) if (l.job_id === j._id && l.line_kind !== 'unprocessed_return') returned += winningAssertion(l.sent)?.base_qty ?? 0;
    const sentOn = children.filter((c: any) => c.parent_job_id === j._id || c.hop_from_job_id === j._id);
    // Unprocessed goods back: mine to the owner leave; a sub-contractor's back to me return to this job (model §3.5).
    const roleOf = new Map((j.inputs as any[]).map((i) => [i.spec_id, i.role ?? 'primary']));
    let unprocessedOut = 0;
    for (const rid of j.returns ?? []) for (const l of mv.get(rid)?.lines ?? []) if (l.job_id === j._id && l.line_kind === 'unprocessed_return' && l.dim === dim && roleOf.get(l.spec_id) !== 'secondary') unprocessedOut += winningAssertion(l.sent)?.base_qty ?? 0;
    const childBack = sentOn.filter((c: any) => c.parent_job_id === j._id).reduce((a: number, c: any) => a + (c.unprocessed_back ?? 0), 0);
    const forwarded = Math.max(0, sentOn.reduce((a: number, c: any) => a + (c.sent_inputs ?? c.issued_sent ?? 0), 0) - childBack);
    // Finished work an owner told me to send on has left my unit for good (a hop never comes back here).
    const hoppedOutputs = sentOn.filter((c: any) => c.hop_from_job_id === j._id).reduce((a: number, c: any) => a + (c.sent_outputs ?? 0), 0);
    const kind = j.conservation_kind as ConservationKind;
    const p = approxPending({ kind, issued: Math.max(0, received - forwarded - unprocessedOut), outputs: ownOutputs, factor: kind === 'mass_losing' ? (j.loss_norm_pct ?? 0) / 100 : 1 });
    const held = (j.pauses ?? []).find((x: any) => !x.to)?.reason ?? null;
    return {
      id: j._id, client: j.client_party, owner_hidden: !!j.parent_job_id, process_key: j.process_key, status: j.status, since: j.business_date, expected_at: j.expected_at,
      late: lateness(j.expected_at, today, { pausedDays: pausedDays(j, today), reason: held ? 'held_for_dues' : j.ready_at ? 'ready_not_collected' : 'processing' }),
      dim, received, receivedBasis: confirmed ? 'confirmed' : 'their_record', outputs, ownOutputs, returned, forwarded, outputsHere: Math.max(0, outputs - returned - hoppedOutputs), inputsHere: p.input,
      ready: !!j.ready_at, held, inputLabel: inputLabel(j), parentJobId: j.parent_job_id ?? null, instructions: j.instructions ?? [],
    };
  });
}

/** Goods → In my unit → Others' goods (03 S10/S11): by principal, never mixed with mine. */
router.get(
  '/sc/goods/others',
  h(async (req: ScRequest, res) => {
    const rows = await workRows(req.ctx);
    const names = await partyNames(req.ctx, [...rows.map((r) => r.client), ...rows.flatMap((r) => r.instructions.map((i) => i.to))]);
    const groups = new Map<string, { client: PartyRef; name: string; jobs: WorkRow[] }>();
    for (const r of rows) {
      const k = pk(r.client);
      if (!groups.has(k)) groups.set(k, { client: r.client, name: names.get(k)?.name ?? '—', jobs: [] });
      groups.get(k)!.jobs.push({ ...r, instructions: r.instructions.map((i) => ({ ...i, to_name: names.get(pk(i.to))?.name ?? '—' })) });
    }
    res.json({ today: todayIST(), groups: [...groups.values()] });
  }),
);

/** One job from the performer's side (no owner name for a sub-contract; no prices). */
router.get(
  '/sc/work/:id',
  h(async (req: ScRequest, res) => {
    const j = await myWork(req.ctx, req.params.id);
    const row = (await workRows(req.ctx)).find((r) => r.id === j._id);
    const names = await partyNames(req.ctx, [j.client_party]);
    const proc = await col('sc_process_types').findOne({ key: j.process_key } as any, { projection: { labels: 1 } });
    const lastOut = (j.outputs as any[]).at(-1);
    // Forwarding a registered owner's goods discloses the sub-contractor to them (ITC-04, model §7): say so up front.
    const ownerBiz = !j.parent_job_id && j.owner_party.k === 'b' ? await col('businesses').findOne({ _id: j.owner_party.id } as any, { projection: { gstin: 1, gst: 1, name: 1 } }) : null;
    const disclosureTo = ownerBiz && (ownerBiz.gst?.registered || ownerBiz.gstin) ? ownerBiz.name : null;
    res.json({ job: row, clientName: names.get(pk(j.client_party))?.name ?? '—', process: proc?.labels ?? null, inputSpecId: j.inputs[0]?.spec_id ?? null, lastOutputSpecId: lastOut?.spec_id ?? null, role: req.ctx.role, disclosureTo });
  }),
);

// ── Work done, ready, held for dues ──────────────────────────────────────────────────────────────

const qtyLines = z.array(z.object({ spec_id: z.string(), qty: z.number().positive(), unit: z.string().max(10), grade: z.enum(['A', 'B', 'rework', 'reject', 'scrap']).default('A'), lot: z.string().trim().max(30).optional(), unprocessed: z.boolean().optional() })).min(1).max(40);

/** Record work done (outputs at my unit). Optional; many units only record returns. */
router.post(
  '/sc/jobs/:id/output',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ lines: qtyLines, ready: z.boolean().optional(), business_date: date.optional() }), req.body);
    const j = await myWork(ctx, req.params.id);
    const businessDate = b.business_date ?? todayIST();
    const postings: Posting[] = [];
    const outputs: any[] = [];
    for (const l of b.lines) {
      const info = await specInfo(l.spec_id);
      const q = qtyBase(l.qty, l.unit, info).base;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: l.grade, dim: info.dim };
      postings.push(...postOutput({ goods, qty: q, owner: j.owner_party, performer: me(ctx), via: j.via ?? null, jobId: j._id }));
      outputs.push({ line_id: newId('ou'), spec_id: info.id, grade: l.grade, lot: goods.lot, dim: info.dim, qty: q, business_date: businessDate, recorded_by: ctx.businessId });
    }
    await post(ctx, { type: 'output', ref: { kind: 'job', id: j._id }, business_date: businessDate }, postings, async (session) => {
      await col('sc_jobs').updateOne({ _id: j._id } as any, { $push: { outputs: { $each: outputs } } as any, $set: { status: 'in_progress', ...(b.ready ? { ready_at: Date.now() } : {}) }, $inc: { version: 1 } }, { session });
      if (j.parent_job_id) await col('sc_jobs').updateOne({ _id: j.parent_job_id } as any, { $set: { child_progress_at: Date.now() } }, { session });
    });
    res.status(201).json({ outputs });
  }),
);

router.post(
  '/sc/jobs/:id/ready',
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ ready: z.boolean() }), req.body);
    const j = await myWork(req.ctx, req.params.id);
    await col('sc_jobs').updateOne({ _id: j._id } as any, b.ready ? { $set: { ready_at: Date.now() } } : { $unset: { ready_at: '' } });
    res.json({ ready: b.ready });
  }),
);

/** Held for dues (Y): pauses the late clock for both sides; the owner sees "Held for dues". Owner role only. */
router.post(
  '/sc/jobs/:id/hold',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') return res.status(403).json({ error: 'Only the owner can hold goods for dues.', code: 'needs_owner' });
    const b = parse(z.object({ on: z.boolean(), reason: z.enum(['dues', 'detained', 'qc']).default('dues') }), req.body);
    const j = await myWork(req.ctx, req.params.id);
    const today = todayIST();
    const open = (j.pauses ?? []).findIndex((p: any) => !p.to);
    if (b.on && open < 0) await col('sc_jobs').updateOne({ _id: j._id } as any, { $push: { pauses: { from: today, to: null, reason: b.reason, by: req.ctx.businessId } } as any });
    if (!b.on && open >= 0) await col('sc_jobs').updateOne({ _id: j._id } as any, { $set: { [`pauses.${open}.to`]: today } });
    res.json({ held: b.on });
  }),
);

// ── Send back to the owner (the performer records the return) ────────────────────────────────────

router.post(
  '/sc/jobs/:id/send-back',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ lines: qtyLines, business_date: date.optional(), client_id: z.string().min(8).max(40), dc_no: z.string().trim().max(30).optional() }), req.body);
    const j = await myWork(ctx, req.params.id);
    const businessDate = b.business_date ?? todayIST();
    const performer = me(ctx);
    const client = j.client_party as PartyRef;
    const owner = j.owner_party as PartyRef;
    const via = (j.via ?? null) as PartyRef | null;
    const movementId = newId('mv');
    const now = Date.now();
    const parties = bizIds(performer, client);
    const postings: Posting[] = [];
    const movLines: any[] = [];
    const newOutputs: any[] = [];
    // Outputs recorded but not yet returned, per spec: a send-back larger than that implies the missing output (model §3.5).
    const returnedBySpec = new Map<string, number>();
    for (const rid of j.returns ?? []) {
      const m = await col('sc_movements').findOne({ _id: rid, cancelled_at: null } as any, { projection: { lines: 1 } });
      for (const l of m?.lines ?? []) if (l.job_id === j._id) returnedBySpec.set(l.spec_id, (returnedBySpec.get(l.spec_id) ?? 0) + (winningAssertion(l.sent)?.base_qty ?? 0));
    }
    for (const l of b.lines) {
      const info = await specInfo(l.spec_id);
      const q = qtyBase(l.qty, l.unit, info).base;
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: l.grade, dim: info.dim };
      const lineId = newId('ln');
      if (!l.unprocessed) {
        const done = (j.outputs as any[]).filter((o) => o.spec_id === info.id && o.grade === l.grade).reduce((a, o) => a + o.qty, 0);
        const here = Math.max(0, done - (returnedBySpec.get(info.id) ?? 0));
        if (q > here) {
          postings.push(...postOutput({ goods, qty: q - here, owner, performer, via, jobId: j._id }));
          newOutputs.push({ movement_id: movementId, line_id: lineId, spec_id: info.id, grade: l.grade, lot: goods.lot, dim: info.dim, qty: q - here, business_date: businessDate });
        }
      }
      postings.push(...postSend({ goods, qty: q, owner, from: { party: performer, via, state: l.unprocessed ? { s: 'allocated', ref: j._id } : { s: 'available' } }, movementId, transitCustodian: performer }));
      // An off-platform client's receipt is our own figure (single-player); a business on CLAIRE confirms its own.
      const receivedNow = client.k === 'c' ? q : null;
      if (receivedNow !== null) postings.push(...postReceipt({ goods, owner, movementId, transitCustodian: performer, to: { party: client }, delta: receivedNow }));
      movLines.push({
        line_id: lineId, spec_id: info.id, label_en: info.label_en, ...(j.parent_job_id && performer.k === 'b' ? { label_generic: await genericLabel(info.id), generic_viewer: performer.id } : {}), lot: goods.lot, grade: l.grade, dim: info.dim, class: info.cls,
        entered: { value: l.qty, unit: l.unit }, owner_before: owner, owner_after: owner, job_id: j._id, line_kind: l.unprocessed ? 'unprocessed_return' : 'goods', viewer_business_ids: parties,
        sent: [assertion(ctx, q, 'account', businessDate, { final: true })],
        received: receivedNow === null ? [] : [assertion(ctx, q, 'self', businessDate, { reason: 'based_on_sent' })],
        settled: null,
      });
    }
    const terms = await termsFor(ctx, client);
    const movement: any = {
      _id: movementId, id: movementId, client_id: b.client_id, action: 'return_from_work', purpose: j.parent_job_id ? 'subcontract_return' : 'job_work_return', process_key: j.process_key,
      from: { party: performer }, to: { party: client }, transit_custodian: performer, via, lines: movLines, terms_snapshot: terms, dc_no: b.dc_no ?? null,
      business_date: businessDate, recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId,
      visible_at: now + UNDO_MS, cancelled_at: null, party_business_ids: parties, version: 1,
    };
    const r = await post(ctx, { type: 'send_back', ref: { kind: 'movement', id: movementId }, payload: { job_id: j._id }, business_date: businessDate, client_id: b.client_id, visible_at: movement.visible_at }, postings, async (session) => {
      await col('sc_movements').insertOne(movement, { session });
      await col('sc_jobs').updateOne({ _id: j._id } as any, { $push: { outputs: { $each: newOutputs }, returns: movementId } as any, $set: { status: 'in_progress' }, $unset: { ready_at: '' }, $inc: { version: 1, unprocessed_back: movLines.filter((l: any) => l.line_kind === 'unprocessed_return' && ((j.inputs as any[]).find((i) => i.spec_id === l.spec_id)?.role ?? 'primary') !== 'secondary').reduce((a: number, l: any) => a + l.sent[0].base_qty, 0) } }, { session });
      // Roll-up (model §3.5): everything a sub-contractor sends back counts for the parent job the owner sees.
      const rolled = movLines.filter((l) => l.line_kind !== 'unprocessed_return').map((l) => ({ movement_id: movementId, line_id: l.line_id, spec_id: l.spec_id, grade: l.grade, lot: l.lot, dim: l.dim, qty: l.sent[0].base_qty, business_date: businessDate, source: 'child', child_job_id: j._id }));
      if (j.parent_job_id && rolled.length) await col('sc_jobs').updateOne({ _id: j.parent_job_id } as any, { $push: { outputs: { $each: rolled } } as any }, { session });
    });
    if (r.duplicate) return res.json({ duplicate: true });
    if (client.k === 'b') await enqueueCard('movement', movementId, 'sent', movement.visible_at);
    res.status(201).json({ movement, undo_until: movement.visible_at });
  }),
);

/** What is done here and not yet sent back, per spec and grade (for "Return what's ready"). */
router.get(
  '/sc/jobs/:id/ready-lines',
  h(async (req: ScRequest, res) => {
    const j = await myWork(req.ctx, req.params.id);
    const sent = new Map<string, number>();
    for (const rid of j.returns ?? []) {
      const m = await col('sc_movements').findOne({ _id: rid, cancelled_at: null } as any, { projection: { lines: 1 } });
      for (const l of m?.lines ?? []) if (l.job_id === j._id && l.line_kind !== 'unprocessed_return') sent.set(`${l.spec_id}|${l.grade}`, (sent.get(`${l.spec_id}|${l.grade}`) ?? 0) + (winningAssertion(l.sent)?.base_qty ?? 0));
    }
    const done = new Map<string, { spec_id: string; grade: string; dim: string; qty: number }>();
    for (const o of j.outputs as any[]) {
      const k = `${o.spec_id}|${o.grade}`;
      const cur = done.get(k) ?? { spec_id: o.spec_id, grade: o.grade, dim: o.dim, qty: 0 };
      cur.qty += o.qty;
      done.set(k, cur);
    }
    const specs = new Map((await col('sc_specs').find({ _id: { $in: [...done.values()].map((d) => d.spec_id) } } as any, { projection: { label_en: 1 } }).toArray()).map((x: any) => [x._id, x.label_en]));
    const lines = [...done.entries()].map(([k, d]) => ({ ...d, label: specs.get(d.spec_id) ?? '', qty: d.qty - (sent.get(k) ?? 0) })).filter((l) => l.qty > 0);
    res.json({ lines });
  }),
);

// ── Forward to another unit ──────────────────────────────────────────────────────────────────────

/** The owner (the job's client) tells the performer to send the goods on to another unit: that forward is a hop. */
router.post(
  '/sc/jobs/:id/instruct',
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ to: partyRef, process_key: z.string().max(40) }), req.body);
    const j = await col('sc_jobs').findOne({ _id: req.params.id, 'client_party.k': 'b', 'client_party.id': req.ctx.businessId } as any);
    if (!j) throw new HttpError(404, 'Not found');
    if (b.to.k === 'c') {
      const c = await col('sc_contacts').findOne({ _id: b.to.id, owner_business_id: req.ctx.businessId } as any);
      if (!c) throw new HttpError(404, 'Not found');
    }
    const ins = { id: newId('in'), to: b.to, process_key: b.process_key, by: req.ctx.businessId, at: Date.now() };
    await col('sc_jobs').updateOne({ _id: j._id } as any, { $push: { instructions: ins } as any });
    res.status(201).json({ instruction: ins });
  }),
);

router.post(
  '/sc/jobs/:id/forward',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const b = parse(z.object({ to: partyRef, lines: qtyLines, process_key: z.string().max(40).optional(), instruction_id: z.string().optional(), expected_at: date.optional(), business_date: date.optional(), client_id: z.string().min(8).max(40), dc_no: z.string().trim().max(30).optional() }), req.body);
    const j = await myWork(ctx, req.params.id);
    if (j.parent_job_id) return res.status(400).json({ error: 'Forwarding again from a sub-contract is not supported yet.', code: 'nested' });
    const instruction = b.instruction_id ? (j.instructions ?? []).find((i: any) => i.id === b.instruction_id) : null;
    if (b.instruction_id && !instruction) throw new HttpError(404, 'Not found');
    const hop = !!instruction;
    const to = (instruction ? instruction.to : b.to) as PartyRef;
    if (sameParty(to, me(ctx))) throw new HttpError(400, 'Pick another unit, not your own.');
    // A sub-contractor named by me must be my own contact or a business; an owner-instructed hop names the owner's choice.
    if (!hop && to.k === 'c' && !(await col('sc_contacts').findOne({ _id: to.id, owner_business_id: ctx.businessId } as any))) throw new HttpError(404, 'Not found');
    const owner = j.owner_party as PartyRef;
    const ownerBiz = owner.k === 'b' ? await col('businesses').findOne({ _id: owner.id } as any, { projection: { gstin: 1, gst: 1 } }) : null;
    // ITC-04 needs a registered owner to know the sub-contractor (model §7): disclose for registered owners.
    const disclosed = hop || !!(ownerBiz?.gst?.registered || ownerBiz?.gstin);
    const via = hop ? null : me(ctx);
    const procKey = instruction?.process_key ?? b.process_key ?? j.process_key;
    const proc = await col('sc_process_types').findOne({ key: procKey } as any);
    if (!proc) throw new HttpError(400, 'Please pick the work.');
    const businessDate = b.business_date ?? todayIST();
    const movementId = newId('mv');
    const childId = newId('jb');
    const now = Date.now();
    const viewers = bizIds(me(ctx), to, disclosed ? owner : null);
    const postings: Posting[] = [];
    const movLines: any[] = [];
    let issuedSent = 0; // primary goods only
    // What leaves the parent job: its own unprocessed inputs, or work already done there (outputs).
    const inputSpecs = new Set((j.inputs as any[]).filter((i) => i.role !== 'secondary').map((i) => i.spec_id));
    let sentInputs = 0;
    let sentOutputs = 0;
    for (const l of b.lines) {
      const info = await specInfo(l.spec_id);
      const q = qtyBase(l.qty, l.unit, info).base;
      if (info.role !== 'secondary') {
        issuedSent += q;
        if (inputSpecs.has(info.id)) sentInputs += q;
        else sentOutputs += q;
      }
      const goods: Goods = { spec: info.id, lot: l.lot || null, grade: l.grade, dim: info.dim };
      postings.push(...postSend({ goods, qty: q, owner, from: { party: me(ctx), state: { s: 'allocated', ref: j._id } }, movementId }));
      if (to.k === 'c') postings.push(...postReceipt({ goods, owner, movementId, transitCustodian: me(ctx), to: { party: to, state: { s: 'allocated', ref: childId }, via }, delta: q }));
      movLines.push({
        line_id: newId('ln'), spec_id: info.id, role: info.role, label_en: info.label_en, ...(!hop && to.k === 'b' ? { label_generic: await genericLabel(info.id), generic_viewer: to.id } : {}), lot: goods.lot, grade: l.grade, dim: info.dim, class: info.cls,
        entered: { value: l.qty, unit: l.unit }, owner_before: owner, owner_after: owner, job_id: childId, line_kind: 'goods', viewer_business_ids: viewers,
        sent: [assertion(ctx, q, 'account', businessDate, { final: true })], received: to.k === 'c' ? [assertion(ctx, q, 'self', businessDate, { reason: 'based_on_sent' })] : [], settled: null,
      });
    }
    const terms = await termsFor(ctx, to);
    const movement: any = {
      _id: movementId, id: movementId, client_id: b.client_id, action: 'forward', purpose: hop ? 'hop' : 'subcontract_out', process_key: procKey,
      from: { party: me(ctx) }, to: { party: to }, transit_custodian: me(ctx), via, disclosed, lines: movLines, terms_snapshot: terms, dc_no: b.dc_no ?? null,
      business_date: businessDate, recorded_at: now, recorded_by_user_id: ctx.userId, recorder_business_id: ctx.businessId,
      visible_at: now + UNDO_MS, cancelled_at: null, party_business_ids: viewers, version: 1,
    };
    const child = {
      _id: childId, id: childId, process_key: proc.key, process_type_id: proc._id, conservation_kind: proc.conservation_kind, loss_norm_pct: proc.loss_norm_pct, rate_basis: proc.rate_basis,
      owner_party: owner, client_party: hop ? owner : me(ctx), performer_party: to, via, parent_job_id: hop ? null : j._id, hop_from_job_id: hop ? j._id : null, disclosed,
      status: 'issued', inputs: movLines.map((l) => ({ movement_id: movementId, line_id: l.line_id, spec_id: l.spec_id, dim: l.dim, lot: l.lot, role: l.role ?? 'primary' })), issued_sent: issuedSent, sent_inputs: sentInputs, sent_outputs: sentOutputs,
      outputs: [], returns: [], promised_at: null, expected_at: b.expected_at ?? addWorkingDays(businessDate, proc.default_turnaround_days), business_date: businessDate, pauses: [],
      party_business_ids: viewers, created_at: now, version: 1,
    };
    const r = await post(ctx, { type: hop ? 'hop' : 'subcontract_out', ref: { kind: 'movement', id: movementId }, payload: { job_id: j._id, child_job_id: childId }, business_date: businessDate, client_id: b.client_id, visible_at: movement.visible_at }, postings, async (session) => {
      await col('sc_movements').insertOne(movement, { session });
      await col('sc_jobs').insertOne(child as any, { session });
      await col('sc_jobs').updateOne({ _id: j._id } as any, { $push: { forwards: { movement_id: movementId, child_job_id: childId, hop } } as any, ...(instruction ? { $pull: { instructions: { id: instruction.id } } as any } : {}) }, { session });
    });
    if (r.duplicate) return res.json({ duplicate: true });
    if (to.k === 'b') await enqueueCard('movement', movementId, 'sent', movement.visible_at);
    res.status(201).json({ movement, job: child, undo_until: movement.visible_at });
  }),
);

export default router;
