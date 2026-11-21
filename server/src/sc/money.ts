// Slice 8a: reports and money (03 S13–S14, model §3.9, §11.4). Record-only: nothing is paid through the app.
// Bills are DERIVED from records and rates (jobs either way, sales and purchases); Settlements are the only money
// record (paid / received / set-off). Everything here is owner-only; staff never see money (04 §10.3b).
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { newId } from './repo.js';
import { partyNames } from './views.js';
import { todayIST, workingDaysBetween } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { PartyRef } from '../../../shared/sc/types.js';
import { toBase } from '../../../shared/sc/units.js';

const router = Router();
const pk = (p: PartyRef) => `${p.k}:${p.id}`;
const isMe = (ctx: Ctx, p: PartyRef | null | undefined) => !!p && p.k === 'b' && p.id === ctx.businessId;
function owner(ctx: Ctx) {
  if (ctx.role !== 'owner') throw new HttpError(403, 'Rates and bills are visible to the owner only.');
}

// ── Bills (derived) ─────────────────────────────────────────────────────────────────────────────
export interface BillItem { party: PartyRef; dir: 'i_owe' | 'they_owe'; date: string; label: string; qty: string | null; rate_paise: number | null; amount_paise: number; source: { kind: 'job' | 'movement'; id: string }; note?: string }

const unitOf = (dim: string) => (dim === 'mass' ? 'kg' : dim === 'length' ? 'm' : 'pcs');
const toUnit = (base: number, dim: string) => (dim === 'mass' ? base / 1000 : dim === 'length' ? base / 100 : base);
const fmt = (base: number, dim: string) => `${Math.round(toUnit(base, dim) * 100) / 100} ${unitOf(dim)}`;

type Rate = { basis: string; value_paise: number };

/** The rate for a job: the one agreed on it, else the client's rate card in force on its date (most specific first). */
function jobRate(j: any, agreed: Map<string, Rate>, cards: any[]): Rate | null {
  const p = agreed.get(j._id);
  if (p) return p;
  const fits = cards.filter((c) => c.business_id === j.client_party.id && c.party?.k === j.performer_party.k && c.party?.id === j.performer_party.id
    && (c.process_key === j.process_key || c.process_key === null) && c.effective_from <= j.business_date && (!c.effective_to || c.effective_to >= j.business_date));
  fits.sort((x, y) => Number(y.process_key !== null) - Number(x.process_key !== null) || y.effective_from.localeCompare(x.effective_from));
  return fits[0] ? { basis: fits[0].basis, value_paise: fits[0].value_paise } : null;
}

/** Billable quantity by the rate basis (model §11.4). Returns base atoms in the job's dimension, or 1 for lump sums. */
function billable(j: any, basis: string, movements: Map<string, any>, procs: Map<string, any>): { base: number; dim: string } {
  const dim = j.inputs?.[0]?.dim ?? 'count';
  if (basis === 'lump_sum') return { base: 1, dim: 'lump' };
  if (basis === 'per_input_mass') {
    let issued = 0;
    for (const inp of (j.inputs as any[]).filter((i) => i.role !== 'secondary')) {
      const line = movements.get(inp.movement_id)?.lines?.find((l: any) => l.line_id === inp.line_id);
      const sent = line ? winningAssertion(line.sent)?.base_qty ?? 0 : inp.qty ?? 0;
      const r = line ? winningAssertion(line.received) : null;
      issued += line ? line.resolved_received ?? Math.min(r?.base_qty ?? sent, sent) : inp.qty ?? 0;
    }
    return { base: issued, dim };
  }
  const grades: string[] = basis === 'per_good_output_piece' ? procs.get(j.process_key)?.billable_grades ?? ['A'] : ['A', 'B', 'rework', 'reject', 'scrap'];
  const outs = (j.outputs as any[]).filter((o) => grades.includes(o.grade ?? 'A'));
  return { base: outs.reduce((a, o) => a + o.qty, 0), dim: outs[0]?.dim ?? dim };
}

/** Every bill line between me and others (or one party): a handful of batched reads, no per-job lookups. */
export async function billItems(ctx: Ctx, party?: PartyRef): Promise<BillItem[]> {
  const items: BillItem[] = [];
  // Jobs either way: work I gave (I owe the performer) and work I did (the client owes me). In-house work is free.
  const pf: any = party ? { $or: [{ 'performer_party.k': party.k, 'performer_party.id': party.id }, { 'client_party.k': party.k, 'client_party.id': party.id }] } : {};
  const jobs = (await col('sc_jobs').find({ party_business_ids: ctx.businessId, in_house: { $ne: true }, status: { $nin: ['cancelled'] }, $and: [{ $or: [{ 'client_party.id': ctx.businessId }, { 'performer_party.id': ctx.businessId }] }, pf] } as any,
    { projection: { client_party: 1, performer_party: 1, process_key: 1, status: 1, business_date: 1, inputs: 1, outputs: 1, 'closure.business_date': 1, 'closure.adjustments': 1 } }).sort({ business_date: -1 }).limit(1500).toArray()) as any[];
  const ids = jobs.map((j) => j._id);
  const [procList, priceList, cards] = await Promise.all([
    col('sc_process_types').find({} as any, { projection: { key: 1, labels: 1, billable_grades: 1 } }).toArray(),
    col('sc_prices').find({ 'record.kind': 'job', 'record.id': { $in: ids } } as any, { projection: { record: 1, basis: 1, value_paise: 1, created_at: 1 } }).sort({ created_at: 1 }).toArray(),
    col('sc_rate_cards').find({ business_id: { $in: [...new Set(jobs.map((j) => j.client_party.id))] } } as any).limit(2000).toArray(),
  ]);
  const procs = new Map((procList as any[]).map((p) => [p.key, p]));
  const agreed = new Map<string, Rate>((priceList as any[]).map((p) => [p.record.id, { basis: p.basis, value_paise: p.value_paise }])); // latest wins
  const rated = jobs.map((j) => ({ j, rate: isMe(ctx, j.client_party) && isMe(ctx, j.performer_party) ? null : jobRate(j, agreed, cards) }));
  const movIds = [...new Set(rated.filter((x) => x.rate?.basis === 'per_input_mass').flatMap((x) => (x.j.inputs as any[]).map((i) => i.movement_id).filter(Boolean)))];
  const movements = new Map(((await col('sc_movements').find({ _id: { $in: movIds } } as any, { projection: { lines: 1 } }).toArray()) as any[]).map((m) => [m._id, m]));
  const label = (k: string) => procs.get(k)?.labels?.[ctx.language] ?? procs.get(k)?.labels?.en ?? k;
  for (const { j, rate } of rated) {
    const iAmClient = isMe(ctx, j.client_party);
    const other = (iAmClient ? j.performer_party : j.client_party) as PartyRef;
    if (isMe(ctx, other)) continue;
    // Work on input weight is billed once the job is done; piece rates accrue as goods come back.
    if (rate?.basis === 'per_input_mass' && !['completed', 'closed'].includes(j.status)) continue;
    if (!rate && !(j.outputs?.length)) continue;
    const q = rate ? billable(j, rate.basis, movements, procs) : { base: 0, dim: 'count' };
    if (rate && q.base === 0) continue; // nothing billable yet
    const amount = rate ? Math.round(rate.basis === 'lump_sum' ? rate.value_paise : toUnit(q.base, q.dim) * rate.value_paise) : 0;
    const date = j.closure?.business_date ?? j.outputs?.at(-1)?.business_date ?? j.business_date;
    items.push({ party: other, dir: iAmClient ? 'i_owe' : 'they_owe', date, label: label(j.process_key), qty: rate?.basis === 'lump_sum' ? null : q.base ? fmt(q.base, q.dim) : null, rate_paise: rate?.value_paise ?? null, amount_paise: amount, source: { kind: 'job', id: j._id }, ...(rate ? {} : { note: 'no_rate' }) });
    // Bill adjustments from closing (leftovers they kept: they pay for them, so it reduces what the client owes).
    for (const a of (j.closure?.adjustments ?? []) as any[]) items.push({ party: other, dir: iAmClient ? 'they_owe' : 'i_owe', date: a.date, label: a.label, qty: `${a.qty} ${a.unit}`, rate_paise: a.rate_paise, amount_paise: a.amount_paise, source: { kind: 'job', id: j._id }, note: 'leftover_kept' });
  }
  // Sales and purchases recorded with a rate (a return is a negative line on the same side).
  const prices = (await col('sc_prices').find({ business_id: ctx.businessId, movement_id: { $exists: true } } as any).limit(1500).toArray()) as any[];
  const tmov = new Map(((await col('sc_movements').find({ _id: { $in: prices.map((p) => p.movement_id) }, cancelled_at: null } as any, { projection: { from: 1, to: 1, lines: 1, business_date: 1 } }).toArray()) as any[]).map((m) => [m._id, m]));
  for (const pr of prices) {
    const m = tmov.get(pr.movement_id);
    if (!m) continue;
    const other = (isMe(ctx, m.from.party) ? m.to.party : m.from.party) as PartyRef;
    if (party && pk(other) !== pk(party)) continue;
    const line = m.lines?.[0];
    const base = (m.lines as any[]).reduce((a, l) => a + (winningAssertion(l.received)?.base_qty ?? winningAssertion(l.sent)?.base_qty ?? 0), 0);
    const per = toBase(1, pr.unit ?? unitOf(line?.dim ?? 'count'), line?.dim ?? 'count');
    const amount = Math.round((base / (per.ok && per.base > 0 ? per.base : 1)) * pr.rate_paise);
    const dir = pr.kind === 'sell' || pr.kind === 'buyer_returned' ? 'they_owe' : 'i_owe';
    const neg = pr.kind === 'return_to_supplier' || pr.kind === 'buyer_returned';
    items.push({ party: other, dir, date: m.business_date, label: line?.label_en ?? '', qty: fmt(base, line?.dim ?? 'count'), rate_paise: pr.rate_paise, amount_paise: neg ? -amount : amount, source: { kind: 'movement', id: m._id } });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Settlements (the only money record) ─────────────────────────────────────────────────────────
/** Settlements between me and a party, seen from my side (a payment they recorded to me reads "received"). */
async function settlementsWith(ctx: Ctx, party?: PartyRef) {
  const rows = await col('sc_settlements').find({ parties: ctx.businessId, voided_at: null } as any).sort({ business_date: 1 }).limit(2000).toArray();
  return (rows as any[])
    .map((s) => {
      const mine = s.recorder_business_id === ctx.businessId;
      const other = (mine ? s.party : { k: 'b', id: s.recorder_business_id }) as PartyRef;
      const dir = s.direction === 'setoff' ? 'setoff' : mine ? s.direction : s.direction === 'paid' ? 'received' : 'paid';
      return { id: s._id as string, party: other, dir: dir as 'paid' | 'received' | 'setoff', amount_paise: s.amount_paise as number, mode: s.mode as string, ref: s.ref as string | null, business_date: s.business_date as string, mine };
    })
    .filter((s) => !party || pk(s.party) === pk(party));
}

export interface PartyBalance { party: PartyRef; name: string; i_owe: number; they_owe: number; paid: number; received: number; setoff: number; balance_i_owe: number; balance_they_owe: number; net: number; oldest_unpaid_days: number | null; unpriced: number }

/** Per party: billed − settled each way; net = they owe me − I owe them; oldest unpaid by first-in-first-out. */
export async function balances(ctx: Ctx, only?: PartyRef, pre?: { items: BillItem[]; sets: Awaited<ReturnType<typeof settlementsWith>> }): Promise<PartyBalance[]> {
  const [items, sets] = pre ? [pre.items, pre.sets] : await Promise.all([billItems(ctx, only), settlementsWith(ctx, only)]);
  const by = new Map<string, PartyBalance & { _items: BillItem[] }>();
  const get = (p: PartyRef) => {
    const k = pk(p);
    if (!by.has(k)) by.set(k, { party: p, name: '', i_owe: 0, they_owe: 0, paid: 0, received: 0, setoff: 0, balance_i_owe: 0, balance_they_owe: 0, net: 0, oldest_unpaid_days: null, unpriced: 0, _items: [] });
    return by.get(k)!;
  };
  for (const it of items) {
    const b = get(it.party);
    if (it.note === 'no_rate') { b.unpriced += 1; continue; }
    b[it.dir] += it.amount_paise;
    b._items.push(it);
  }
  for (const s of sets) {
    const b = get(s.party);
    if (s.dir === 'setoff') b.setoff += s.amount_paise;
    else b[s.dir] += s.amount_paise;
  }
  const names = await partyNames(ctx, [...by.values()].map((b) => b.party));
  const today = todayIST();
  return [...by.values()].map(({ _items, ...b }) => {
    b.name = names.get(pk(b.party))?.name ?? '—';
    b.balance_i_owe = b.i_owe - b.paid - b.setoff;
    b.balance_they_owe = b.they_owe - b.received - b.setoff;
    b.net = b.balance_they_owe - b.balance_i_owe;
    // Oldest unpaid: walk that side's bills oldest first, covering them with what was settled.
    const side = b.balance_i_owe > 0 ? 'i_owe' : b.balance_they_owe > 0 ? 'they_owe' : null;
    if (side) {
      let cover = side === 'i_owe' ? b.paid + b.setoff : b.received + b.setoff;
      for (const it of _items.filter((x) => x.dir === side)) {
        cover -= it.amount_paise;
        if (cover < 0) { b.oldest_unpaid_days = workingDaysBetween(it.date, today); break; }
      }
    }
    return b;
  }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

router.get(
  '/sc/bills',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    res.json({ parties: await balances(req.ctx) });
  }),
);

router.get(
  '/sc/bills/:k/:id',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const party = { k: req.params.k as 'b' | 'c', id: req.params.id };
    if (party.k === 'c' && !(await col('sc_contacts').findOne({ _id: party.id, owner_business_id: req.ctx.businessId } as any, { projection: { _id: 1 } }))) throw new HttpError(404, 'Not found');
    const [items, sets] = await Promise.all([billItems(req.ctx, party), settlementsWith(req.ctx, party)]);
    const [bal] = await balances(req.ctx, party, { items, sets });
    res.json({ balance: bal ?? null, items, settlements: sets });
  }),
);

/** Record payment (record-only): I paid them, they paid me, or a set-off between two bills (Y netting). */
router.post(
  '/sc/settlements',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    owner(ctx);
    const b = z.object({
      party: z.object({ k: z.enum(['b', 'c']), id: z.string().max(64) }),
      direction: z.enum(['paid', 'received', 'setoff']),
      amount_paise: z.number().int().positive().max(10_000_000_000),
      mode: z.enum(['cash', 'upi', 'neft', 'cheque', 'adjustment']),
      ref: z.string().trim().max(60).optional(),
      note: z.string().trim().max(200).optional(),
      business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      client_id: z.string().min(8).max(40),
    }).parse(req.body);
    if (b.party.k === 'b' && b.party.id === ctx.businessId) throw new HttpError(400, 'Pick the other party.');
    if (b.party.k === 'c' && !(await col('sc_contacts').findOne({ _id: b.party.id, owner_business_id: ctx.businessId } as any))) throw new HttpError(404, 'Not found');
    const dup = await col('sc_settlements').findOne({ recorder_business_id: ctx.businessId, client_id: b.client_id } as any);
    if (dup) return res.json({ settlement: { id: dup._id }, duplicate: true });
    if (b.direction === 'setoff') {
      const [bal] = await balances(ctx, b.party);
      const max = bal ? Math.min(bal.balance_i_owe, bal.balance_they_owe) : 0;
      if (b.amount_paise > max) throw new HttpError(409, max > 0 ? `You can set off at most ₹${(max / 100).toFixed(2)}: the smaller of what each side owes.` : 'A set-off needs bills both ways.');
    }
    const id = newId('st');
    await col('sc_settlements').insertOne({
      _id: id, id, recorder_business_id: ctx.businessId, recorded_by: ctx.userId, party: b.party, parties: [ctx.businessId, ...(b.party.k === 'b' ? [b.party.id] : [])],
      direction: b.direction, amount_paise: b.amount_paise, mode: b.direction === 'setoff' ? 'adjustment' : b.mode, ref: b.ref ?? null, note: b.note ?? null,
      business_date: b.business_date ?? todayIST(), client_id: b.client_id, created_at: Date.now(), voided_at: null,
    } as any);
    res.status(201).json({ settlement: { id } });
  }),
);

/** A wrong entry is voided (dated), never deleted. Only the business that recorded it. */
router.post(
  '/sc/settlements/:id/void',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const r = await col('sc_settlements').updateOne({ _id: req.params.id, recorder_business_id: req.ctx.businessId, voided_at: null } as any, { $set: { voided_at: Date.now(), voided_by: req.ctx.userId } });
    if (!r.matchedCount) throw new HttpError(404, 'Not found');
    res.json({ voided: true });
  }),
);

// ── Performance (S13) ───────────────────────────────────────────────────────────────────────────
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

/**
 * Per party × process over closed and completed jobs (12 months). Judged against fixed yardsticks, never the party's
 * own history: days vs the agreed promise (else the process template), loss vs the template beside the best unit.
 * Only the performer's own delay counts: paused days are excluded and listed. Fewer than 3 jobs: not enough history.
 */
export async function performance(ctx: Ctx) {
  const since = new Date(Date.now() - 365 * 86400e3).toISOString().slice(0, 10);
  const jobs = await col('sc_jobs').find({ 'client_party.id': ctx.businessId, in_house: { $ne: true }, status: { $in: ['closed', 'completed'] }, business_date: { $gte: since } } as any).limit(2000).toArray();
  const procs = new Map((await col('sc_process_types').find({} as any).toArray()).map((p: any) => [p.key, p]));
  const disputes = await col('sc_discrepancies').find({ parties: ctx.businessId, 'refs.job_id': { $in: jobs.map((j: any) => j._id) } } as any, { projection: { 'refs.job_id': 1 } }).toArray();
  const dByJob = new Map<string, number>();
  for (const d of disputes as any[]) dByJob.set(d.refs.job_id, (dByJob.get(d.refs.job_id) ?? 0) + 1);
  const groups = new Map<string, { party: PartyRef; process: string; days: number[]; promised: number[]; excluded: number; excludedWhy: Set<string>; loss: number[]; rejects: number[]; disputes: number; n: number }>();
  for (const j of jobs as any[]) {
    const k = `${pk(j.performer_party)}|${j.process_key}`;
    if (!groups.has(k)) groups.set(k, { party: j.performer_party, process: j.process_key, days: [], promised: [], excluded: 0, excludedWhy: new Set(), loss: [], rejects: [], disputes: 0, n: 0 });
    const g = groups.get(k)!;
    g.n += 1;
    const end = j.closure?.business_date ?? j.outputs?.at(-1)?.business_date ?? null;
    if (end) {
      const paused = (j.pauses ?? []).reduce((a: number, p: any) => a + workingDaysBetween(p.from, p.to ?? end), 0);
      g.days.push(Math.max(0, workingDaysBetween(j.business_date, end) - paused));
      g.excluded += paused;
      for (const p of j.pauses ?? []) g.excludedWhy.add(p.reason ?? 'paused');
      const pt: any = procs.get(j.process_key);
      g.promised.push(j.promised_at ? workingDaysBetween(j.business_date, j.promised_at) : pt?.default_turnaround_days ?? 0);
    }
    if (j.conservation_kind === 'mass_losing' && typeof j.closure?.loss_pct === 'number') g.loss.push(j.closure.loss_pct);
    const outs = (j.outputs as any[]).filter((o) => o.source !== 'child');
    const tot = outs.reduce((a, o) => a + o.qty, 0);
    if (tot) g.rejects.push((outs.filter((o) => ['reject', 'scrap'].includes(o.grade)).reduce((a, o) => a + o.qty, 0) / tot) * 100);
    g.disputes += dByJob.get(j._id) ?? 0;
  }
  // The best unit for each process (lowest median loss among parties with enough history): a yardstick, not a grade.
  const best = new Map<string, number>();
  for (const g of groups.values()) {
    const m = median(g.loss);
    if (g.n >= 3 && m !== null && (best.get(g.process) === undefined || m < best.get(g.process)!)) best.set(g.process, m);
  }
  const names = await partyNames(ctx, [...groups.values()].map((g) => g.party));
  return [...groups.values()].map((g) => {
    const pt: any = procs.get(g.process);
    const enough = g.n >= 3;
    const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
    return {
      party: g.party, name: names.get(pk(g.party))?.name ?? '—', process: g.process, process_label: pt?.labels?.[ctx.language] ?? pt?.labels?.en ?? g.process, n: g.n, enough,
      median_days: enough ? r1(median(g.days)) : null, promised_days: enough ? r1(median(g.promised)) : null, excluded_days: g.excluded, excluded_why: [...g.excludedWhy],
      loss_pct: enough ? r1(median(g.loss)) : null, loss_norm_pct: pt?.loss_norm_pct ?? null, best_loss_pct: r1(best.get(g.process) ?? null),
      rejects_pct: enough ? r1(median(g.rejects)) : null, disputes: g.disputes,
    };
  }).sort((a, b) => a.process.localeCompare(b.process) || b.n - a.n);
}

router.get(
  '/sc/reports/performance',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    res.json({ rows: await performance(req.ctx) });
  }),
);

// ── GST clock (registered owners, H2): job-work inputs must come back within a year ─────────────
router.get(
  '/sc/reports/gst',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const biz: any = await col('businesses').findOne({ _id: req.ctx.businessId } as any, { projection: { gstin: 1, gst: 1 } });
    const registered = !!(biz?.gstin || biz?.gst?.registered);
    const { jobSummaries } = await import('./views.js');
    const jobs = (await jobSummaries(req.ctx)).filter((j) => j.pending > 0);
    const today = todayIST();
    const days = (d: string) => Math.round((Date.parse(today) - Date.parse(d)) / 86400e3);
    const names = await partyNames(req.ctx, jobs.map((j) => j.performer));
    const rows = jobs.map((j) => ({ job_id: j.id, name: names.get(pk(j.performer))?.name ?? '—', label: j.inputLabel, pending: j.pending, dim: j.dim, sent_on: j.since, days: days(j.since), due_by: new Date(Date.parse(j.since) + 365 * 86400e3).toISOString().slice(0, 10) }))
      .filter((r) => r.days >= 300).sort((a, b) => b.days - a.days);
    res.json({ registered, rows });
  }),
);

// ── CSV export (owner; formula-injection safe) ──────────────────────────────────────────────────
const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`; // a cell starting like a formula opens as text in a spreadsheet
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
const rupees = (p: number) => (p / 100).toFixed(2);

router.get(
  '/sc/reports/:name(bills|performance).csv',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    let rows: unknown[][];
    if (req.params.name === 'bills') {
      const bal = await balances(req.ctx);
      rows = [['Party', 'I owe (₹)', 'They owe me (₹)', 'Paid (₹)', 'Received (₹)', 'Set off (₹)', 'Net: they owe me (₹)', 'Oldest unpaid (days)', 'Jobs without a rate'],
        ...bal.map((b) => [b.name, rupees(b.i_owe), rupees(b.they_owe), rupees(b.paid), rupees(b.received), rupees(b.setoff), rupees(b.net), b.oldest_unpaid_days ?? '', b.unpriced])];
    } else {
      const perf = await performance(req.ctx);
      rows = [['Unit', 'Process', 'Jobs', 'Median days', 'Promised days', 'Days excluded', 'Loss %', 'Usual loss %', 'Best unit loss %', 'Rejects %', 'Disputes'],
        ...perf.map((p) => [p.name, p.process_label, p.n, p.median_days ?? 'not enough history', p.promised_days ?? '', p.excluded_days, p.loss_pct ?? '', p.loss_norm_pct ?? '', p.best_loss_pct ?? '', p.rejects_pct ?? '', p.disputes])];
    }
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${req.params.name}-${todayIST()}.csv"`, 'Cache-Control': 'no-store' });
    res.send(csv(rows));
  }),
);

export default router;
