// S9 · Flow view (03 §5 S9, A5): for one run, where is every piece right now. A run is a style (every spec carrying
// that style code: kits, garments, packed goods) or a marketplace order (its linked jobs and deliveries, widened to
// the styles they carry). Nothing new is stored: stages come from my jobs (grouped by process), the material that
// fed them (walked back by spec + lot), and my sales to buyers. Every figure is computed the way the job page, the
// stock list and the order page compute it, so the flow reconciles with those records. Owner only (prices and buyers).
import { Router } from 'express';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import type { Ctx, ScRequest } from './flag.js';
import { partyNames } from './views.js';
import { orderProgress, type OrderProgress } from './orders.js';
import { approxPending } from '../../../shared/sc/conservation.js';
import { lateness, todayIST, workingDaysBetween } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { ConservationKind, Dimension, PartyRef } from '../../../shared/sc/types.js';

const router = Router();
const OPEN_DISPUTE = ['open', 'proposed', 'countered', 'escalated'];
const OUTGOING = ['sell', 'sample', 'returnable_sample'];
const REJECT = new Set(['reject', 'scrap']);
const pk = (p: PartyRef) => `${p.k}:${p.id}`;
const isMe = (ctx: Ctx, p: PartyRef | null | undefined) => !!p && p.k === 'b' && p.id === ctx.businessId;
const pairKey = (spec: string, lot: string | null) => `${spec}|${lot ?? ''}`;

function ownerOnly(ctx: Ctx) {
  if (ctx.role !== 'owner') throw new HttpError(403, 'The flow view is for the owner only.');
}

type Qty = { dim: Dimension; qty: number };
const addQty = (list: Qty[], dim: Dimension, qty: number) => {
  if (!qty) return;
  const hit = list.find((x) => x.dim === dim);
  if (hit) hit.qty += qty;
  else list.push({ dim, qty });
};
const sizeList = (m: Map<string, number>) => [...m.entries()].map(([size, qty]) => ({ size, qty }));

export interface FlowRow {
  id: string; in_house: boolean; name: string | null; process_key: string; status: 'done' | 'late' | 'held' | 'ready' | 'due_today' | 'in_progress';
  late: { status: string; days: number } | null; held: string | null; since: string; expected_at: string; closed: boolean;
  dim: Dimension; sent: number; good: number; reject: number; out_dim: Dimension; at_unit: number; loss: number; waste: number;
  input_label: string; output_label: string | null; lots: string[]; sizes: { size: string; qty: number }[]; disputes: number; disputed: number;
}

/** Specs of a style (kits, garments, packed goods). Style codes are stored lower-case on specs. */
async function styleSpecs(codes: string[]) {
  if (!codes.length) return new Map<string, any>();
  const specs = (await col('sc_specs').find({ 'attrs.style': { $in: codes.map((c) => c.toLowerCase()) } } as any, { projection: { label_en: 1, attrs: 1, material_type_id: 1 } }).toArray()) as any[];
  return new Map(specs.map((s) => [s._id as string, s]));
}

/** Read-time figures for one job, the same way the job page (GET /sc/jobs/:id/detail) computes them. */
function jobFigures(j: any, movs: Map<string, any>, children: any[], today: string) {
  const inputs = (j.inputs as any[]).filter((i) => i.role !== 'secondary').map((inp) => {
    const line = inp.movement_id ? movs.get(inp.movement_id)?.lines.find((l: any) => l.line_id === inp.line_id) : null;
    const sent = line ? winningAssertion(line.sent)?.base_qty ?? 0 : inp.qty ?? 0;
    const r = line ? winningAssertion(line.received) : null;
    const issued = line ? line.resolved_received ?? Math.min(r?.base_qty ?? sent, sent) : inp.qty ?? 0;
    return { spec_id: inp.spec_id as string, lot: (inp.lot ?? line?.lot ?? null) as string | null, dim: (inp.dim ?? line?.dim) as Dimension, issued };
  });
  const dim: Dimension = inputs[0]?.dim ?? 'count';
  const issued = inputs.filter((i) => i.dim === dim).reduce((a, i) => a + i.issued, 0);
  const roleOf = (spec: string) => (j.inputs as any[]).find((i) => i.spec_id === spec)?.role ?? 'primary';
  let unprocessed = 0;
  for (const rid of j.returns ?? []) for (const l of movs.get(rid)?.lines ?? []) if (l.job_id === j._id && l.line_kind === 'unprocessed_return' && roleOf(l.spec_id) === 'primary' && l.dim === dim) unprocessed += winningAssertion(l.sent)?.base_qty ?? 0;
  const sentOn = children.filter((c) => c.hop_from_job_id === j._id || c.split_from_job_id === j._id).reduce((a, c) => a + (c.sent_inputs ?? c.issued_sent ?? 0), 0);
  const lost = j.casualty_lost ?? 0;
  const kind = j.conservation_kind as ConservationKind;
  const outs = (j.outputs as any[]).filter((o) => !o.by_product);
  const outDim: Dimension = kind === 'unit_changing' ? outs.find((o) => o.dim !== dim)?.dim ?? 'count' : dim;
  let good = 0;
  let reject = 0;
  for (const o of outs.filter((x) => x.dim === outDim)) {
    if (REJECT.has(o.grade ?? 'A')) reject += o.qty;
    else good += o.qty;
  }
  const waste = (j.outputs as any[]).filter((o) => o.by_product).reduce((a, o) => a + o.qty, 0);
  const left = Math.max(0, issued - unprocessed - sentOn - lost);
  const closed = j.status === 'closed';
  const factor = kind === 'mass_losing' ? (j.loss_norm_pct ?? 0) / 100 : 1;
  const pending = closed ? 0 : kind === 'unit_changing' ? left : approxPending({ kind, issued: left, outputs: good + reject, factor }).input;
  // Same unit only: what is neither back nor still there (process loss, unprocessed back, sent on, unaccounted).
  const wasteSame = (j.outputs as any[]).filter((o) => o.by_product && o.dim === dim).reduce((a, o) => a + o.qty, 0);
  const loss = kind === 'unit_changing' ? 0 : Math.max(0, issued - good - reject - pending - wasteSame);
  const lt = closed || j.in_house || j.cancelled_at
    ? null
    : lateness(j.expected_at, today, { pausedDays: (j.pauses ?? []).reduce((n: number, p: any) => n + workingDaysBetween(p.from, p.to ?? today), 0), reason: (j.pauses ?? []).some((p: any) => !p.to) ? 'held_for_dues' : j.ready_at ? 'ready_not_collected' : 'processing' });
  const held = (j.pauses ?? []).find((p: any) => !p.to)?.reason ?? null;
  const done = closed || (pending === 0 && j.status === 'completed');
  const status: FlowRow['status'] = done ? 'done' : held ? 'held' : lt?.status === 'late' ? 'late' : j.ready_at ? 'ready' : lt?.status === 'due_today' ? 'due_today' : 'in_progress';
  return { inputs, dim, issued, good, reject, outDim, pending, loss, waste, late: lt ? { status: lt.status, days: lt.days } : null, held, status, closed };
}

interface Seed { styles: string[]; orderId?: string }

/** Builds the flow for a run. Every query is scoped to records this business owns or is a party to. */
async function buildFlow(ctx: Ctx, seed: Seed) {
  const me: PartyRef = { k: 'b', id: ctx.businessId };
  const now = Date.now();
  const today = todayIST();
  const mine = { 'owner_party.k': 'b', 'owner_party.id': ctx.businessId, 'client_party.k': 'b', 'client_party.id': ctx.businessId, status: { $ne: 'cancelled' } };
  const visible = (m: any) => m.recorder_business_id === ctx.businessId || m.visible_at <= now;

  // An order widens to the styles its own jobs and deliveries carry.
  let order: any = null;
  const styles = new Set(seed.styles.map((s) => s.toLowerCase()));
  if (seed.orderId) {
    order = await col('orders').findOne({ _id: seed.orderId, $or: [{ buyer_business_id: ctx.businessId }, { seller_business_id: ctx.businessId }] } as any);
    if (!order) throw new HttpError(404, 'Not found');
    const [oj, om] = await Promise.all([
      col('sc_jobs').find({ ...mine, order_id: order._id } as any, { projection: { inputs: 1, outputs: 1 } }).toArray(),
      col('sc_movements').find({ order_id: order._id, party_business_ids: ctx.businessId, cancelled_at: null } as any, { projection: { lines: 1 } }).toArray(),
    ]);
    const ids = [...new Set([...(oj as any[]).flatMap((j) => [...j.inputs, ...j.outputs].map((x: any) => x.spec_id)), ...(om as any[]).flatMap((m) => m.lines.map((l: any) => l.spec_id))])];
    for (const s of (await col('sc_specs').find({ _id: { $in: ids } } as any, { projection: { attrs: 1 } }).toArray()) as any[]) if (s.attrs?.style) styles.add(String(s.attrs.style));
  }
  const specs = await styleSpecs([...styles]);
  const S = [...specs.keys()];

  // Jobs of the run: touching a style spec, or linked to the order.
  const or: any[] = [];
  if (S.length) or.push({ 'inputs.spec_id': { $in: S } }, { 'outputs.spec_id': { $in: S } });
  if (order) or.push({ order_id: order._id });
  const jobs: any[] = or.length ? ((await col('sc_jobs').find({ ...mine, $or: or } as any).limit(500).toArray()) as any[]) : [];
  const jobIds = new Set(jobs.map((j) => j._id as string));

  // Walk back to the material that fed the run (fabric → dyeing → …) by spec + lot, up to three steps.
  const upstream = new Set<string>();
  let frontier = jobs.flatMap((j) => (j.inputs as any[]).filter((i) => i.role !== 'secondary' && !specs.has(i.spec_id) && i.lot).map((i) => ({ spec: i.spec_id as string, lot: i.lot as string })));
  for (let step = 0; step < 3 && frontier.length; step++) {
    for (const f of frontier) upstream.add(pairKey(f.spec, f.lot));
    const found = (await col('sc_jobs').find({ ...mine, _id: { $nin: [...jobIds] }, 'outputs.spec_id': { $in: [...new Set(frontier.map((f) => f.spec))] }, 'outputs.lot': { $in: [...new Set(frontier.map((f) => f.lot))] } } as any).limit(100).toArray()) as any[];
    const want = new Set(frontier.map((f) => pairKey(f.spec, f.lot)));
    const fed = found.filter((j) => (j.outputs as any[]).some((o) => want.has(pairKey(o.spec_id, o.lot ?? null))));
    for (const j of fed) { jobs.push(j); jobIds.add(j._id); }
    frontier = fed.flatMap((j) => (j.inputs as any[]).filter((i) => i.role !== 'secondary' && i.lot && !upstream.has(pairKey(i.spec_id, i.lot))).map((i) => ({ spec: i.spec_id as string, lot: i.lot as string })));
  }
  const upSpecs = [...new Set([...upstream].map((k) => k.split('|')[0]))];

  // Movements: the jobs' own, purchases of the upstream material, sales of the style (or for the order) to buyers.
  const ids = [...jobIds];
  const jobMovIds = [...new Set(jobs.flatMap((j) => [...(j.inputs as any[]).map((i) => i.movement_id), ...(j.returns ?? [])]).filter(Boolean))];
  const tradeOr: any[] = [];
  if (S.length || upSpecs.length) tradeOr.push({ 'lines.spec_id': { $in: [...S, ...upSpecs] } });
  if (order) tradeOr.push({ order_id: order._id });
  const [jobMovs, children, trades] = await Promise.all([
    col('sc_movements').find({ _id: { $in: jobMovIds }, cancelled_at: null } as any).toArray(),
    ids.length ? col('sc_jobs').find({ $or: [{ hop_from_job_id: { $in: ids } }, { split_from_job_id: { $in: ids } }], status: { $ne: 'cancelled' } } as any, { projection: { hop_from_job_id: 1, split_from_job_id: 1, sent_inputs: 1, issued_sent: 1 } }).toArray() : Promise.resolve([]),
    tradeOr.length ? col('sc_movements').find({ party_business_ids: ctx.businessId, cancelled_at: null, action: { $in: [...OUTGOING, 'buy', 'buyer_returned'] }, $or: tradeOr } as any).sort({ recorded_at: 1 }).limit(500).toArray() : Promise.resolve([]),
  ]);
  const movs = new Map((jobMovs as any[]).map((m) => [m._id, m]));
  const linesFor = (m: any) => (m.lines as any[]).filter((l) => l.viewer_business_ids?.includes(ctx.businessId));

  // Disputes still open on any record of the run.
  const tradeIds = (trades as any[]).map((m) => m._id);
  const disputes = (await col('sc_discrepancies').find({ parties: ctx.businessId, state: { $in: OPEN_DISPUTE }, $or: [{ 'refs.job_id': { $in: ids } }, { 'refs.job_ids': { $in: ids } }, { 'refs.movement_id': { $in: [...jobMovIds, ...tradeIds] } }] } as any).toArray()) as any[];
  const jobOfMov = new Map<string, string>();
  for (const j of jobs) for (const m of [...(j.inputs as any[]).map((i) => i.movement_id), ...(j.returns ?? [])]) if (m) jobOfMov.set(m, j._id);

  // Labels: specs, processes, parties, places.
  const allSpecIds = [...new Set([...jobs.flatMap((j) => [...j.inputs, ...j.outputs].map((x: any) => x.spec_id)), ...(trades as any[]).flatMap((m) => m.lines.map((l: any) => l.spec_id))])];
  const [specDocs, procs, styleDocs] = await Promise.all([
    col('sc_specs').find({ _id: { $in: allSpecIds } } as any, { projection: { label_en: 1, attrs: 1 } }).toArray(),
    col('sc_process_types').find({ key: { $in: [...new Set(jobs.map((j) => j.process_key))] }, owner_business_id: { $in: [null, ctx.businessId] } } as any, { projection: { key: 1, labels: 1, order: 1 } }).toArray(),
    col('sc_styles').find({ business_id: ctx.businessId, code: { $in: [...styles].map((s) => s.toUpperCase()) } } as any, { projection: { code: 1, name: 1 } }).toArray(),
  ]);
  const specBy = new Map((specDocs as any[]).map((s) => [s._id, s]));
  const procBy = new Map((procs as any[]).map((p) => [p.key, p]));
  const sizeOf = (spec: string) => (specBy.get(spec)?.attrs?.size ? String(specBy.get(spec).attrs.size).toUpperCase() : null);

  // ── Job rows, grouped into stages by process ──
  const disputesOfJob = (j: any) => disputes.filter((d) => d.refs?.job_id === j._id || (d.refs?.job_ids ?? []).includes(j._id) || jobOfMov.get(d.refs?.movement_id) === j._id);
  const rows: FlowRow[] = jobs.map((j) => {
    const f = jobFigures(j, movs, children as any[], today);
    const sizes = new Map<string, number>();
    for (const i of f.inputs) { const z = sizeOf(i.spec_id); if (z && i.dim === f.dim) sizes.set(z, (sizes.get(z) ?? 0) + i.issued); }
    const ds = disputesOfJob(j);
    const lastOut = (j.outputs as any[]).filter((o) => !o.by_product).at(-1);
    return {
      id: j._id, in_house: !!j.in_house, name: null, process_key: j.process_key, status: f.status, late: f.late, held: f.held, since: j.business_date, expected_at: j.expected_at, closed: f.closed,
      dim: f.dim, sent: f.issued, good: f.good, reject: f.reject, out_dim: f.outDim, at_unit: f.pending, loss: f.loss, waste: f.waste,
      input_label: specBy.get(f.inputs[0]?.spec_id)?.label_en ?? '', output_label: lastOut ? specBy.get(lastOut.spec_id)?.label_en ?? null : null,
      lots: [...new Set(f.inputs.map((i) => i.lot).filter(Boolean) as string[])], sizes: sizeList(sizes), disputes: ds.length, disputed: ds.reduce((a, d) => a + (d.difference ?? 0), 0),
    };
  });
  const performerOf = new Map(jobs.map((j) => [j._id as string, j.performer_party as PartyRef]));

  // ── Purchases of the upstream material (the first stage), and sales to buyers (the last) ──
  const bought: { movement_id: string; party: PartyRef; date: string; label: string; lot: string | null; dim: Dimension; qty: number; confirmed: boolean }[] = [];
  const buyers = new Map<string, { party: PartyRef; sent: number; received: number; on_the_way: number; returned: number; disputed: number; dim: Dimension; last: string; sizes: Map<string, number>; movements: string[]; orders: Set<string> }>();
  for (const m of (trades as any[]).filter(visible)) {
    const inbound = (m.action === 'buy' && isMe(ctx, m.to.party)) || (m.action === 'sell' && isMe(ctx, m.to.party));
    const outbound = OUTGOING.includes(m.action) && m.recorder_business_id === ctx.businessId && !isMe(ctx, m.to.party);
    const returned = m.action === 'buyer_returned' && m.recorder_business_id === ctx.businessId;
    for (const l of linesFor(m)) {
      const inRun = specs.has(l.spec_id) || (order && m.order_id === order._id);
      if (inbound && upstream.has(pairKey(l.spec_id, l.lot ?? null))) {
        const r = l.resolved_received ?? winningAssertion(l.received)?.base_qty ?? winningAssertion(l.sent)?.base_qty ?? 0;
        bought.push({ movement_id: m._id, party: m.from.party, date: m.business_date, label: l.label_en ?? specBy.get(l.spec_id)?.label_en ?? '', lot: l.lot ?? null, dim: l.dim, qty: r, confirmed: (l.received as any[]).some((a) => a.evidence === 'account' || a.evidence === 'link') });
      } else if ((outbound || returned) && inRun) {
        const party: PartyRef = outbound ? m.to.party : m.from.party;
        const k = pk(party);
        if (!buyers.has(k)) buyers.set(k, { party, sent: 0, received: 0, on_the_way: 0, returned: 0, disputed: 0, dim: l.dim, last: m.business_date, sizes: new Map(), movements: [], orders: new Set() });
        const b = buyers.get(k)!;
        if (l.dim !== b.dim) continue; // one unit per buyer row (pieces); a kg sample doesn't add to pieces
        const s = winningAssertion(l.sent)?.base_qty ?? 0;
        if (returned) { b.returned += s; continue; }
        // As the order page counts it: a received figure (not an implied one) means it arrived; none means on the way.
        const got = l.resolved_received ?? winningAssertion((l.received as any[]).filter((a) => a.evidence !== 'implied'))?.base_qty;
        b.sent += s;
        if (got === undefined || got === null) b.on_the_way += s;
        else b.received += got;
        const z = sizeOf(l.spec_id);
        if (z) b.sizes.set(z, (b.sizes.get(z) ?? 0) + s);
        if (m.business_date > b.last) b.last = m.business_date;
        if (!b.movements.includes(m._id)) b.movements.push(m._id);
        if (m.order_id) b.orders.add(m.order_id);
      }
    }
  }
  for (const d of disputes) for (const b of buyers.values()) if (b.movements.includes(d.refs?.movement_id)) b.disputed += d.difference ?? 0;

  // ── Who holds what now: my stock of the run's goods (at my places or kept elsewhere), as the stock list shows it ──
  const holdOr: any[] = [];
  if (S.length) holdOr.push({ 'key.spec': { $in: S } });
  if (upSpecs.length) holdOr.push({ 'key.spec': { $in: upSpecs } });
  const holdings = holdOr.length
    ? ((await col('sc_holdings').find({ t: 'real', 'key.owner.k': 'b', 'key.owner.id': ctx.businessId, 'key.state.s': { $in: ['available', 'ready'] }, qty_base: { $gt: 0 }, $or: holdOr } as any).limit(400).toArray()) as any[]).filter((r) => specs.has(r.key.spec) || upstream.has(pairKey(r.key.spec, r.key.lot ?? null)))
    : [];
  const places = new Map(((await col('sc_places').find({ business_id: ctx.businessId } as any, { projection: { name: 1 } }).toArray()) as any[]).map((p) => [p._id, p.name as string]));

  // Names for every party shown.
  const names = await partyNames(ctx, [...performerOf.values(), ...bought.map((b) => b.party), ...[...buyers.values()].map((b) => b.party), ...holdings.map((r) => r.key.custodian)]);
  const nameOf = (p: PartyRef | null | undefined) => (p ? names.get(pk(p))?.name ?? '—' : '—');
  for (const r of rows) r.name = r.in_house ? null : nameOf(performerOf.get(r.id));

  const stock = new Map<string, { where: 'mine' | 'other'; name: string | null; dim: Dimension; reject: boolean; qty: number; items: Map<string, number> }>();
  for (const r of holdings) {
    const atMe = isMe(ctx, r.key.custodian);
    const k = atMe ? `me:${r.key.place ?? ''}` : pk(r.key.custodian);
    const reject = REJECT.has(r.key.grade);
    const key = `${k}|${r.dimension}|${reject ? 'r' : 'g'}`;
    if (!stock.has(key)) stock.set(key, { where: atMe ? 'mine' : 'other', name: atMe ? (r.key.place ? places.get(r.key.place) ?? null : null) : nameOf(r.key.custodian), dim: r.dimension, reject, qty: 0, items: new Map() });
    const s = stock.get(key)!;
    s.qty += r.qty_base;
    const label = specBy.get(r.key.spec)?.label_en ?? specs.get(r.key.spec)?.label_en ?? '';
    s.items.set(label, (s.items.get(label) ?? 0) + r.qty_base);
  }

  // ── Stages: material in → each process in its usual order → dispatch ──
  const stageMap = new Map<string, FlowRow[]>();
  for (const r of rows) {
    if (!stageMap.has(r.process_key)) stageMap.set(r.process_key, []);
    stageMap.get(r.process_key)!.push(r);
  }
  const rank = (k: string) => procBy.get(k)?.order ?? 99;
  const statusRank = { late: 0, held: 1, due_today: 2, ready: 3, in_progress: 4, done: 5 } as const;
  const stages = [...stageMap.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([key, list]) => {
    list.sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.since.localeCompare(b.since));
    const totals: { dim: Dimension; sent: number; good: number; reject: number; at_unit: number; loss: number }[] = [];
    const tot = (dim: Dimension) => { let t = totals.find((x) => x.dim === dim); if (!t) { t = { dim, sent: 0, good: 0, reject: 0, at_unit: 0, loss: 0 }; totals.push(t); } return t; };
    const outputs: Qty[] = [];
    const waste: Qty[] = [];
    for (const r of list) {
      const t = tot(r.dim);
      t.sent += r.sent; t.at_unit += r.at_unit; t.loss += r.loss;
      if (r.out_dim === r.dim) { t.good += r.good; t.reject += r.reject; }
      else { addQty(outputs, r.out_dim, r.good + r.reject); }
      addQty(waste, 'mass', r.waste);
    }
    const worst = list[0]?.status ?? 'done';
    return {
      key, labels: procBy.get(key)?.labels ?? null, status: worst, late: list.filter((r) => r.status === 'late').length, open: list.filter((r) => r.status !== 'done').length,
      unit_changing: list.some((r) => r.out_dim !== r.dim), totals, outputs, waste, rows: list,
    };
  });

  const buyerRows = [...buyers.values()].map((b) => ({
    party: b.party, name: nameOf(b.party), dim: b.dim, sent: b.sent, received: b.received, on_the_way: b.on_the_way, returned: b.returned, disputed: b.disputed, last: b.last,
    sizes: sizeList(b.sizes), movements: b.movements, orders: [...b.orders],
  }));

  // An order: its own figures exactly as the order page shows them, and its buyer as a row even before anything is sent.
  let orderCard: { id: string; code: string; title: string; kind: string; side: string; other: string; status: string; progress: OrderProgress } | null = null;
  if (order) {
    const p = await orderProgress(order, ctx.businessId);
    const side = order.buyer_business_id === ctx.businessId ? 'buyer' : 'seller';
    const other: PartyRef = { k: 'b', id: side === 'buyer' ? order.seller_business_id : order.buyer_business_id };
    const otherName = (await partyNames(ctx, [other])).get(pk(other))?.name ?? '—';
    orderCard = { id: order._id, code: order.code, title: order.title, kind: order.kind, side, other: otherName, status: order.status, progress: p };
    if (side === 'seller' && order.kind !== 'job_work' && !buyers.has(pk(other))) buyerRows.push({ party: other, name: otherName, dim: p.dim, sent: 0, received: 0, on_the_way: 0, returned: 0, disputed: 0, last: '', sizes: [], movements: [], orders: [order._id] });
  }
  // What each buyer's linked orders still need (only where the sale was recorded against an order).
  const orderIds = [...new Set(buyerRows.flatMap((b) => b.orders))];
  const orders = new Map<string, any>();
  for (const o of (await col('orders').find({ _id: { $in: orderIds }, seller_business_id: ctx.businessId } as any).toArray()) as any[]) orders.set(o._id, { code: o.code, ...(await orderProgress(o, ctx.businessId)) });
  const buyersOut = buyerRows.map((b) => {
    const os = b.orders.map((id) => orders.get(id)).filter(Boolean).map((o: any) => ({ code: o.code, ordered: o.ordered, done: o.done, dim: o.dim }));
    const short = os.reduce((a: number, o: any) => a + Math.max(0, o.ordered - o.done), 0);
    return { ...b, orders: os, waiting: b.on_the_way > 0 || short > 0 || b.disputed > 0, still_needs: short };
  });
  buyersOut.sort((a, b) => Number(b.waiting) - Number(a.waiting) || a.name.localeCompare(b.name));

  // ── "Where everything is now", per unit ──
  const now_: { kind: 'at_unit' | 'in_stock' | 'kept_elsewhere' | 'on_the_way' | 'with_buyer' | 'not_received'; name: string | null; dim: Dimension; qty: number; late?: boolean; reject?: boolean }[] = [];
  const atUnit = new Map<string, { name: string; dim: Dimension; qty: number; late: boolean }>();
  for (const r of rows.filter((x) => x.at_unit > 0 && !x.in_house)) {
    const k = `${pk(performerOf.get(r.id)!)}|${r.dim}`;
    const a = atUnit.get(k) ?? { name: r.name ?? '—', dim: r.dim, qty: 0, late: false };
    a.qty += r.at_unit;
    a.late ||= r.status === 'late';
    atUnit.set(k, a);
  }
  for (const a of atUnit.values()) now_.push({ kind: 'at_unit', name: a.name, dim: a.dim, qty: a.qty, late: a.late });
  for (const s of stock.values()) now_.push({ kind: s.where === 'mine' ? 'in_stock' : 'kept_elsewhere', name: s.name, dim: s.dim, qty: s.qty, reject: s.reject });
  for (const b of buyersOut) {
    if (b.on_the_way) now_.push({ kind: 'on_the_way', name: b.name, dim: b.dim, qty: b.on_the_way });
    if (b.received - b.returned > 0) now_.push({ kind: 'with_buyer', name: b.name, dim: b.dim, qty: b.received - b.returned });
    const short = b.sent - b.on_the_way - b.received;
    if (short > 0) now_.push({ kind: 'not_received', name: b.name, dim: b.dim, qty: short });
  }

  // What is still to come back, soonest first: the date to tell a buyer depends on these.
  const coming = rows.filter((r) => r.at_unit > 0 && !r.in_house).sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.expected_at.localeCompare(b.expected_at))
    .map((r) => ({ job_id: r.id, name: r.name, dim: r.dim, qty: r.at_unit, expected_at: r.expected_at, status: r.status, late: r.late, sizes: r.sizes }));

  const pieces = Math.max(0, ...stages.filter((s) => s.unit_changing).flatMap((s) => s.outputs.filter((o) => o.dim === 'count').map((o) => o.qty)), ...stages.flatMap((s) => s.totals.filter((t) => t.dim === 'count').map((t) => t.sent)));
  const st = (styleDocs as any[])[0];
  return {
    today, run: { kind: order ? 'order' : 'style', styles: [...styles].map((s) => s.toUpperCase()), name: st?.name ?? null, pieces, buyers: buyersOut.length },
    order: orderCard,
    now: now_,
    stock: [...stock.values()].map((s) => ({ where: s.where, name: s.name, dim: s.dim, reject: s.reject, qty: s.qty, items: [...s.items.entries()].map(([label, qty]) => ({ label, qty })) })),
    material: bought.map((b) => ({ ...b, name: nameOf(b.party) })),
    stages,
    buyers: buyersOut,
    coming,
    disputes: disputes.map((d) => ({ id: d._id, label: d.line_label, difference: d.difference, dim: d.dim, job_id: d.refs?.job_id ?? jobOfMov.get(d.refs?.movement_id) ?? null, movement_id: d.refs?.movement_id ?? null })),
    counts: { late: rows.filter((r) => r.status === 'late').length, held: rows.filter((r) => r.status === 'held').length, disputes: disputes.length, waiting: buyersOut.filter((b) => b.waiting).length },
  };
}

/** Runs to pick from: styles in my recent jobs (open work first), and my orders that have goods recorded. */
router.get(
  '/sc/flow',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    ownerOnly(ctx);
    const today = todayIST();
    const jobs = (await col('sc_jobs').find({ 'owner_party.k': 'b', 'owner_party.id': ctx.businessId, 'client_party.id': ctx.businessId, status: { $ne: 'cancelled' } } as any,
      { projection: { 'inputs.spec_id': 1, 'outputs.spec_id': 1, status: 1, business_date: 1, expected_at: 1, pauses: 1, ready_at: 1, in_house: 1, cancelled_at: 1 } }).sort({ created_at: -1 }).limit(400).toArray()) as any[];
    const specIds = [...new Set(jobs.flatMap((j) => [...j.inputs, ...j.outputs].map((x: any) => x.spec_id)))];
    const styleOf = new Map(((await col('sc_specs').find({ _id: { $in: specIds }, 'attrs.style': { $exists: true } } as any, { projection: { 'attrs.style': 1 } }).toArray()) as any[]).map((s) => [s._id, String(s.attrs.style).toUpperCase()]));
    const runs = new Map<string, { code: string; last: string; jobs: number; open: number; late: number }>();
    for (const j of jobs) {
      const codes = new Set([...j.inputs, ...j.outputs].map((x: any) => styleOf.get(x.spec_id)).filter(Boolean) as string[]);
      const open = ['issued', 'in_progress'].includes(j.status) && !j.in_house;
      const late = open && !j.cancelled_at && lateness(j.expected_at, today, { pausedDays: (j.pauses ?? []).reduce((n: number, p: any) => n + workingDaysBetween(p.from, p.to ?? today), 0) }).status === 'late';
      for (const c of codes) {
        const r = runs.get(c) ?? { code: c, last: j.business_date, jobs: 0, open: 0, late: 0 };
        r.jobs += 1; r.open += Number(open); r.late += Number(late);
        if (j.business_date > r.last) r.last = j.business_date;
        runs.set(c, r);
      }
    }
    const styleNames = new Map(((await col('sc_styles').find({ business_id: ctx.businessId, code: { $in: [...runs.keys()] } } as any, { projection: { code: 1, name: 1 } }).toArray()) as any[]).map((s) => [s.code, s.name]));
    const list = [...runs.values()].map((r) => ({ ...r, name: styleNames.get(r.code) ?? null })).sort((a, b) => b.late - a.late || b.open - a.open || b.last.localeCompare(a.last)).slice(0, 60);

    const orders = (await col('orders').find({ $or: [{ buyer_business_id: ctx.businessId }, { seller_business_id: ctx.businessId }] } as any, { projection: { code: 1, title: 1, kind: 1, status: 1, buyer_business_id: 1, seller_business_id: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(100).toArray()) as any[];
    const oids = orders.map((o) => o._id);
    const linked = new Set<string>([
      ...((await col('sc_movements').distinct('order_id', { order_id: { $in: oids }, party_business_ids: ctx.businessId } as any)) as string[]),
      ...((await col('sc_jobs').distinct('order_id', { order_id: { $in: oids }, 'owner_party.id': ctx.businessId } as any)) as string[]),
    ]);
    const withGoods = orders.filter((o) => linked.has(o._id)).slice(0, 30);
    const names = await partyNames(ctx, withGoods.map((o) => ({ k: 'b' as const, id: o.buyer_business_id === ctx.businessId ? o.seller_business_id : o.buyer_business_id })));
    res.json({
      today, runs: list,
      orders: withGoods.map((o) => {
        const side = o.buyer_business_id === ctx.businessId ? 'buyer' : 'seller';
        return { id: o._id, code: o.code, title: o.title, kind: o.kind, status: o.status, side, other: names.get(`b:${side === 'buyer' ? o.seller_business_id : o.buyer_business_id}`)?.name ?? '—' };
      }),
    });
  }),
);

router.get(
  '/sc/flow/style/:code',
  h(async (req: ScRequest, res) => {
    ownerOnly(req.ctx);
    const code = String(req.params.code ?? '').trim();
    if (!/^[\w-]{1,40}$/.test(code)) throw new HttpError(404, 'Not found');
    const flow = await buildFlow(req.ctx, { styles: [code] });
    if (!flow.stages.length && !flow.buyers.length && !flow.stock.length) throw new HttpError(404, 'Not found');
    res.json(flow);
  }),
);

router.get(
  '/sc/flow/order/:id',
  h(async (req: ScRequest, res) => {
    ownerOnly(req.ctx);
    res.json(await buildFlow(req.ctx, { styles: [], orderId: String(req.params.id) }));
  }),
);

export default router;
