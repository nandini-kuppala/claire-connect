// Slice 1 read paths (03 S1, S1c, S10, S2; 04 §6.1): job summaries with the read-time approx. pending (P7),
// the three Goods lists and the party ledger. Everything is scoped by the Ctx.
import { Router } from 'express';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { positions } from './repo.js';
import { UNDO_MS } from './records.js';
import { approxPending } from '../../../shared/sc/conservation.js';
import { lateness, todayIST, workingDaysBetween } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { ConservationKind, Dimension, PartyRef } from '../../../shared/sc/types.js';

const router = Router();

export interface PartyName { name: string; kind: 'contact' | 'business'; onClaire: boolean; phone?: string | null; language?: string | null; sub?: string | null }

export async function partyNames(ctx: Ctx, refs: PartyRef[]): Promise<Map<string, PartyName>> {
  const out = new Map<string, PartyName>();
  const cIds = [...new Set(refs.filter((r) => r.k === 'c').map((r) => r.id))];
  const bIds = [...new Set(refs.filter((r) => r.k === 'b').map((r) => r.id))];
  if (cIds.length) {
    for (const c of await col('sc_contacts').find({ _id: { $in: cIds }, owner_business_id: ctx.businessId } as any).toArray())
      out.set(`c:${c._id}`, { name: c.name, kind: 'contact', onClaire: c.link_state === 'linked', phone: c.phones?.[0] ?? null, language: c.language, sub: c.role_hint });
  }
  if (bIds.length) {
    for (const b of await col('businesses').find({ _id: { $in: bIds } } as any, { projection: { name: 1, role_label: 1, area: 1, city: 1, language: 1 } }).toArray())
      out.set(`b:${b._id}`, { name: b.name, kind: 'business', onClaire: true, language: b.language, sub: [b.role_label, b.area || b.city].filter(Boolean).join(' · ') });
  }
  return out;
}

const key = (p: PartyRef) => `${p.k}:${p.id}`;

export interface JobSummary {
  id: string;
  process_key: string;
  performer: PartyRef;
  status: string;
  since: string;
  expected_at: string;
  late: ReturnType<typeof lateness>;
  dim: Dimension;
  sent: number; // Σ sent (input atoms)
  issued: number; // Σ received basis (P6)
  issuedBasis: 'sent' | 'their_figure' | 'mixed';
  outputs: number; // Σ declared outputs in the input's dimension
  pending: number; // read-time approx., input atoms
  pendingAsOutput: number | null;
  overYield: boolean;
  lossPctSoFar: number | null;
  lossNormPct: number;
  inputLabel: string;
  outputLabel: string | null;
  lots: string[];
  movementIds: string[];
}

/** Summaries of my open jobs (owner = me), optionally for one performer. */
export async function jobSummaries(ctx: Ctx, opts: { performer?: PartyRef; statuses?: string[] } = {}): Promise<JobSummary[]> {
  const filter: any = { 'owner_party.k': 'b', 'owner_party.id': ctx.businessId, status: { $in: opts.statuses ?? ['issued', 'in_progress'] } };
  if (opts.performer) Object.assign(filter, { 'performer_party.k': opts.performer.k, 'performer_party.id': opts.performer.id });
  const jobs = await col('sc_jobs').find(filter).sort({ expected_at: 1 }).limit(200).toArray();
  if (!jobs.length) return [];
  const movIds = [...new Set(jobs.flatMap((j: any) => j.inputs.map((i: any) => i.movement_id)))];
  const movs = new Map((await col('sc_movements').find({ _id: { $in: movIds } } as any).toArray()).map((m: any) => [m._id, m]));
  const specIds = [...new Set(jobs.flatMap((j: any) => [...j.inputs.map((i: any) => i.spec_id), ...j.outputs.map((o: any) => o.spec_id)]))];
  const labels = new Map((await col('sc_specs').find({ _id: { $in: specIds } } as any, { projection: { label_en: 1 } }).toArray()).map((s: any) => [s._id, s.label_en as string]));
  const today = todayIST();
  return jobs.map((j: any) => {
    let sent = 0;
    let issued = 0;
    const bases = new Set<string>();
    const lots = new Set<string>();
    let dim: Dimension = 'mass';
    for (const inp of j.inputs) {
      const line = movs.get(inp.movement_id)?.lines.find((l: any) => l.line_id === inp.line_id);
      if (!line) continue;
      dim = line.dim;
      const s = winningAssertion(line.sent)?.base_qty ?? 0;
      const r = winningAssertion(line.received);
      sent += s;
      issued += Math.min(r?.base_qty ?? s, s);
      bases.add(r?.reason === 'based_on_sent' ? 'sent' : 'their_figure');
      if (line.lot) lots.add(line.lot);
    }
    const outputs = j.outputs.filter((o: any) => o.dim === dim).reduce((a: number, o: any) => a + o.qty, 0);
    const kind = j.conservation_kind as ConservationKind;
    const factor = kind === 'mass_losing' ? (j.loss_norm_pct ?? 0) / 100 : 1;
    const p = approxPending({ kind, issued, outputs, factor });
    const last = j.outputs.at(-1);
    return {
      id: j._id, process_key: j.process_key, performer: j.performer_party, status: j.status, since: j.business_date, expected_at: j.expected_at,
      late: lateness(j.expected_at, today), dim, sent, issued, issuedBasis: bases.size > 1 ? 'mixed' : ((bases.values().next().value ?? 'sent') as 'sent' | 'their_figure'),
      outputs, pending: p.input, pendingAsOutput: kind === 'mass_losing' ? p.asOutput : null, overYield: p.overYield,
      // Loss is shown only once nothing is estimated to be left (or the owner said it was the last); before that the
      // remainder is still being processed, not lost.
      lossPctSoFar: kind === 'mass_losing' && outputs > 0 && (p.input === 0 || j.status === 'completed') ? Math.round(((issued - outputs) / issued) * 1000) / 10 : null, lossNormPct: j.loss_norm_pct ?? 0,
      inputLabel: labels.get(j.inputs[0]?.spec_id) ?? '', outputLabel: last ? labels.get(last.spec_id) ?? null : null, lots: [...lots],
      movementIds: [...new Set([...j.inputs.map((i: any) => i.movement_id), ...(j.returns ?? [])])],
    };
  });
}

const STATUS_RANK = { late: 0, due_today: 1, on_time: 2 } as const;

/** Goods → Out with others: grouped by the party holding my goods, late first (03 S1). */
router.get(
  '/sc/goods/out',
  h(async (req: ScRequest, res) => {
    const jobs = (await jobSummaries(req.ctx)).filter((j) => j.pending > 0 || j.overYield);
    const names = await partyNames(req.ctx, jobs.map((j) => j.performer));
    const groups = new Map<string, { party: PartyRef; name: PartyName | undefined; jobs: JobSummary[] }>();
    for (const j of jobs) {
      const k = key(j.performer);
      if (!groups.has(k)) groups.set(k, { party: j.performer, name: names.get(k), jobs: [] });
      groups.get(k)!.jobs.push(j);
    }
    const rows = [...groups.values()].map((g) => {
      const worst = g.jobs.reduce((a, j) => (STATUS_RANK[j.late.status] < STATUS_RANK[a.late.status] || (j.late.status === a.late.status && j.late.days > a.late.days) ? j : a));
      return { party: g.party, name: g.name?.name ?? '—', kind: g.name?.kind ?? 'contact', onClaire: !!g.name?.onClaire, since: g.jobs.map((j) => j.since).sort()[0], status: worst.late, jobs: g.jobs };
    });
    rows.sort((a, b) => STATUS_RANK[a.status.status] - STATUS_RANK[b.status.status] || b.status.days - a.status.days || a.since.localeCompare(b.since));
    res.json({ today: todayIST(), rows });
  }),
);

/** Goods → Coming in: expected returns, late first, then soonest (03 S1c). */
router.get(
  '/sc/goods/coming',
  h(async (req: ScRequest, res) => {
    const jobs = (await jobSummaries(req.ctx)).filter((j) => j.pending > 0);
    const names = await partyNames(req.ctx, jobs.map((j) => j.performer));
    const rows = jobs
      .map((j) => ({ ...j, name: names.get(key(j.performer))?.name ?? '—' }))
      .sort((a, b) => STATUS_RANK[a.late.status] - STATUS_RANK[b.late.status] || b.late.days - a.late.days || a.expected_at.localeCompare(b.expected_at));
    res.json({ today: todayIST(), rows });
  }),
);

/** Goods → In my unit: my goods at my places, by material (03 S10). Allocated rows never show raw (04 §6.1b). */
router.get(
  '/sc/goods/in',
  h(async (req: ScRequest, res) => {
    const rows = (await positions(req.ctx, { tab: 'in' })).filter((r) => r.key.t === 'real' && r.key.state.s !== 'allocated' && r.qty_base > 0);
    const specIds = [...new Set(rows.map((r) => (r.key.t === 'real' ? r.key.spec : '')))];
    const placeIds = [...new Set(rows.map((r) => (r.key.t === 'real' ? r.key.place : null)).filter(Boolean))] as string[];
    const [specs, places] = await Promise.all([
      col('sc_specs').find({ _id: { $in: specIds } } as any, { projection: { label_en: 1 } }).toArray(),
      col('sc_places').find({ _id: { $in: placeIds }, business_id: req.ctx.businessId } as any).toArray(),
    ]);
    const label = new Map(specs.map((s: any) => [s._id, s.label_en]));
    const place = new Map(places.map((p: any) => [p._id, p.name]));
    const mine = rows.filter((r) => r.mine).map((r) => {
      const k = r.key as Extract<typeof r.key, { t: 'real' }>;
      return { id: r.id, spec_id: k.spec, label: label.get(k.spec) ?? k.spec, lot: k.lot, grade: k.grade, place: k.place ? place.get(k.place) ?? null : null, state: k.state.s, qty: r.qty_base, dim: r.dimension };
    });
    const others = rows.filter((r) => !r.mine).length; // others' goods arrive in slice 3
    res.json({ mine, othersCount: others });
  }),
);

/** Party ledger (03 S2): open jobs, history, and (for the owner) terms and rates. */
router.get(
  '/sc/parties/:k/:id/ledger',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const k = req.params.k === 'b' ? 'b' : req.params.k === 'c' ? 'c' : null;
    if (!k) throw new HttpError(404, 'Not found');
    const party: PartyRef = { k, id: req.params.id };
    const names = await partyNames(ctx, [party]);
    const name = names.get(key(party));
    if (!name) throw new HttpError(404, 'Not found');
    const open = await jobSummaries(ctx, { performer: party, statuses: ['issued', 'in_progress', 'completed'] });
    const movs = await col('sc_movements')
      .find({ recorder_business_id: ctx.businessId, $or: [{ 'to.party.k': k, 'to.party.id': party.id }, { 'from.party.k': k, 'from.party.id': party.id }] } as any)
      .sort({ recorded_at: -1 })
      .limit(40)
      .toArray();
    const now = Date.now();
    const history = movs.map((m: any) => ({
      id: m._id, action: m.action, business_date: m.business_date, dc_no: m.dc_no, cancelled: !!m.cancelled_at,
      undoable_until: !m.cancelled_at && now < m.recorded_at + UNDO_MS ? m.recorded_at + UNDO_MS : null,
      lines: m.lines.map((l: any) => {
        const sent = winningAssertion(l.sent);
        const recv = winningAssertion(l.received);
        const theirs = m.action === 'send_for_work' ? recv : sent;
        return {
          line_id: l.line_id, label: l.label_en, lot: l.lot, grade: l.grade, dim: l.dim, rolls: l.rolls ?? null, sent: sent?.base_qty ?? 0, received: recv?.base_qty ?? 0,
          their: theirs && theirs.evidence === 'on_behalf' ? theirs.base_qty : null, settled: l.settled ?? null, line_kind: l.line_kind,
        };
      }),
      badge: 'your_record' as const,
    }));
    const daysOpen = open.length ? workingDaysBetween(open.map((j) => j.since).sort()[0], todayIST()) : 0;
    res.json({ party, name, open, history, daysOpen, role: ctx.role });
  }),
);

/** Job detail for the Got back form (03 S5) and the job page (S7, slice 4). */
router.get(
  '/sc/jobs/:id',
  h(async (req: ScRequest, res) => {
    const j = await col('sc_jobs').findOne({ _id: req.params.id, 'owner_party.id': req.ctx.businessId } as any);
    if (!j) throw new HttpError(404, 'Not found');
    const [summary] = await jobSummaries(req.ctx, { performer: j.performer_party, statuses: [j.status] }).then((all) => all.filter((x) => x.id === j._id));
    const names = await partyNames(req.ctx, [j.performer_party]);
    const lastOut = j.outputs.at(-1);
    const proc = await col('sc_process_types').findOne({ key: j.process_key } as any, { projection: { labels: 1, conservation_kind: 1 } });
    // Default for "what came back": this job's last output, else what this unit last returned for the same work.
    const prev = lastOut
      ? null
      : await col('sc_jobs').findOne(
          { _id: { $ne: j._id }, 'owner_party.id': req.ctx.businessId, 'performer_party.k': j.performer_party.k, 'performer_party.id': j.performer_party.id, process_key: j.process_key, 'outputs.0': { $exists: true } } as any,
          { sort: { created_at: -1 }, projection: { outputs: 1 } },
        );
    res.json({ job: summary, performerName: names.get(key(j.performer_party))?.name ?? '—', process: proc?.labels ?? null, lastOutputSpecId: lastOut?.spec_id ?? prev?.outputs?.at(-1)?.spec_id ?? null, inputSpecId: j.inputs[0]?.spec_id ?? null, outputs: j.outputs });
  }),
);

export default router;
