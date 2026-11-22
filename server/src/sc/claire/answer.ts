// Runs personal Claire's query tools through the same scoped reads the Goods screens use (ctx only; nothing from the
// model reaches a query except resolved ids and filters) and renders template answers in the user's language.
import { col } from '../../db/index.js';
import type { Ctx } from '../flag.js';
import { jobSummaries, partyNames, toConfirmFor, type JobSummary } from '../views.js';
import { positions } from '../repo.js';
import { formatQty } from '../../../../shared/sc/units.js';
import { todayIST, workingDaysBetween } from '../../../../shared/sc/dates.js';
import type { CardPayload } from '../../../../shared/cards.js';
import type { Dimension, PartyRef } from '../../../../shared/sc/types.js';
import { candidates, labelFits, matchParty } from './resolve.js';
import { tr } from './strings.js';
import type { ToolCall } from './tools.js';

export type Answer = Extract<CardPayload, { kind: 'goods_answer' }>;
export type Ask = { kind: 'chips'; text: string; chips: { id: string; label: string }[] };

export const q = (base: number, dim: Dimension | string) => {
  const f = formatQty(base, dim as Dimension);
  return `${f.value} ${f.unit}`;
};
export function shortDate(d: string | null | undefined, lang: string): string {
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
  } catch {
    return d;
  }
}
const timeNow = (lang: string) => new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date());
const pk = (p: PartyRef) => `${p.k}:${p.id}`;

async function processLabels(lang: string): Promise<Map<string, string>> {
  const rows = await col('sc_process_types').find({} as any, { projection: { key: 1, labels: 1 } }).toArray();
  return new Map(rows.map((r: any) => [r.key, (r.labels?.[lang] ?? r.labels?.en ?? r.key) as string]));
}

function status(j: JobSummary, lang: string): { text: string; tone: Answer['rows'][number]['tone'] } {
  if (j.held) return { text: tr(lang, 'held'), tone: 'held' };
  if (j.ready) return { text: tr(lang, 'ready'), tone: 'ready' };
  if (j.late.status === 'late') return { text: tr(lang, 'late_n', { n: j.late.days }), tone: 'late' };
  if (j.late.status === 'due_today') return { text: tr(lang, 'due_today'), tone: 'due' };
  return { text: tr(lang, 'expected', { date: shortDate(j.expected_at, lang) }), tone: null };
}

/** "about 89 kg Finished navy…" with "about 95 kg Grey … being dyed" underneath (P7 estimate, in words). */
function jobRow(j: JobSummary, lang: string, procs: Map<string, string>, name?: string): Answer['rows'][number] {
  const st = status(j, lang);
  const about = tr(lang, 'about');
  const asOut = j.pendingAsOutput !== null && j.outputLabel && j.outputs >= 0 && j.pendingAsOutput !== j.pending;
  const value = `${j.outputs > 0 || asOut ? `${about} ` : ''}${q(asOut ? j.pendingAsOutput! : j.pending, j.dim)}`;
  const label = asOut ? j.outputLabel! : j.inputLabel;
  const sub = [
    name ?? null,
    asOut ? tr(lang, 'being', { qty: `${about} ${q(j.pending, j.dim)}`, label: j.inputLabel, process: (procs.get(j.process_key) ?? j.process_key).toLowerCase() }) : null,
    tr(lang, 'since', { date: shortDate(j.since, lang) }),
    st.text,
  ].filter(Boolean).join(' · ');
  return { label, value, sub, href: `/goods/job/${j.id}`, tone: st.tone };
}

const source = (lang: string, n: number, est: boolean) => tr(lang, est ? 'source_est' : 'source', { n: n === 1 ? '1' : String(n), time: timeNow(lang) });

/** Resolves a party the model (or the rules) named. A whole sentence from the rules is scanned for any mention. */
export async function resolveParty(ctx: Ctx, said: string | undefined, loose: boolean): Promise<{ ref: PartyRef | null; name: string | null; ask?: Ask; unknown?: string }> {
  if (!said) return { ref: null, name: null };
  const m = matchParty(said, await candidates(ctx));
  if (m.best) return { ref: m.best.ref, name: m.best.name };
  if (m.options.length > 1) return { ref: null, name: null, ask: { kind: 'chips', text: tr(ctx.language, 'which_party'), chips: m.options.map((o) => ({ id: `scp:${o.ref.k}:${o.ref.id}`, label: o.name })) } };
  return { ref: null, name: null, unknown: loose ? undefined : said };
}

export async function runQuery(ctx: Ctx, call: Exclude<ToolCall, { tool: 'draft_record' | 'find_suppliers' }>, loose: boolean, partyOverride?: PartyRef | null): Promise<Answer | Ask | { kind: 'text'; text: string }> {
  const lang = ctx.language;
  if (call.tool === 'compute_analytics' && ctx.role !== 'owner') return { kind: 'text', text: tr(lang, 'owner_only') };
  const said = 'party' in call.args ? call.args.party : undefined;
  const p = partyOverride !== undefined ? { ref: partyOverride, name: partyOverride ? (await partyNames(ctx, [partyOverride])).get(pk(partyOverride))?.name ?? null : null } : await resolveParty(ctx, said, loose);
  if ('ask' in p && p.ask) return p.ask;
  if ('unknown' in p && p.unknown) return { kind: 'text', text: tr(lang, 'unknown_party', { name: p.unknown }) };
  const procs = await processLabels(lang);

  switch (call.tool) {
    case 'query_holdings':
    case 'explain_job': {
      const material = 'material' in call.args ? call.args.material : undefined;
      const colour = 'colour' in call.args ? call.args.colour : undefined;
      const scope = call.tool === 'explain_job' ? 'out_with_others' : call.args.scope;
      if (scope === 'in_my_unit' || (scope === 'any' && !p.ref && !material)) return inMyUnit(ctx, material, colour);
      if (scope === 'coming_in') return comingIn(ctx);
      const jobs = (await jobSummaries(ctx, p.ref ? { performer: p.ref } : {})).filter((j) => j.pending > 0 && !j.cancelled);
      if (!p.ref) {
        if (scope === 'any' && material) return inMyUnit(ctx, material, colour);
        const names = await partyNames(ctx, jobs.map((j) => j.performer));
        const rows = jobs.filter((j) => labelFits(j.inputLabel, material, colour) || (j.outputLabel && labelFits(j.outputLabel, material, colour))).sort((a, b) => (b.late.days ?? 0) - (a.late.days ?? 0)).slice(0, 8).map((j) => jobRow(j, lang, procs, names.get(pk(j.performer))?.name));
        const total = jobs.filter((j) => labelFits(j.inputLabel, material, colour) || (j.outputLabel && labelFits(j.outputLabel, material, colour))).length;
        return { kind: 'goods_answer', title: tr(lang, 'out_title'), rows, source: source(lang, total, rows.some((r) => r.value.startsWith(tr(lang, 'about')))), note: rows.length ? (total > rows.length ? tr(lang, 'and_more', { n: total - rows.length }) : undefined) : tr(lang, 'nothing') };
      }
      const fits = jobs.filter((j) => labelFits(j.inputLabel, material, colour) || (j.outputLabel && labelFits(j.outputLabel, material, colour)));
      const shown = fits.length ? fits : jobs;
      const rows = shown.slice(0, 8).map((j) => jobRow(j, lang, procs));
      // Goods of mine kept with them outside any job (bought and kept, samples lent, leftovers kept for the next job).
      const loose = (await positions(ctx, { tab: 'out' })).filter((r) => r.key.t === 'real' && r.key.custodian.id === p.ref!.id && r.key.state.s === 'available' && r.qty_base > 0);
      if (loose.length) {
        const specs = new Map((await col('sc_specs').find({ _id: { $in: loose.map((r) => (r.key.t === 'real' ? r.key.spec : '')) } } as any).toArray()).map((s: any) => [s._id, s.label_en as string]));
        for (const r of loose) {
          const label = r.key.t === 'real' ? specs.get(r.key.spec) ?? '' : '';
          if (!fits.length || labelFits(label, material, colour)) rows.push({ label, value: q(r.qty_base, r.dimension), sub: tr(lang, 'with_them'), tone: null });
        }
      }
      const what = [colour, material].filter(Boolean).join(' ');
      const note = !rows.length ? tr(lang, 'nothing_at', { name: p.name ?? '' }) : !fits.length && (material || colour) ? tr(lang, 'nothing_match', { what, name: p.name ?? '' }) : shown.length > 8 ? tr(lang, 'and_more', { n: shown.length - 8 }) : undefined;
      return { kind: 'goods_answer', title: call.tool === 'explain_job' && shown[0] ? tr(lang, 'job_title', { process: procs.get(shown[0].process_key) ?? '', name: p.name ?? '' }) : tr(lang, 'at_title', { name: p.name ?? '' }), rows, source: source(lang, shown.length + (rows.length - Math.min(8, shown.length)), rows.some((r) => r.value.startsWith(tr(lang, 'about')))), note };
    }
    case 'query_jobs': {
      const statuses = call.args.status === 'closed' ? ['closed'] : ['issued', 'in_progress', 'completed'];
      let jobs = await jobSummaries(ctx, { ...(p.ref ? { performer: p.ref } : {}), statuses });
      if (call.args.status === 'late') jobs = jobs.filter((j) => j.late.status === 'late' && j.pending > 0 && !j.cancelled);
      if (call.args.status === 'ready') jobs = jobs.filter((j) => j.ready && j.pending > 0);
      if (call.args.status === 'open') jobs = jobs.filter((j) => j.pending > 0);
      if (call.args.process) jobs = jobs.filter((j) => (procs.get(j.process_key) ?? j.process_key).toLowerCase().includes(call.args.process!.toLowerCase()) || j.process_key.includes(call.args.process!.toLowerCase()));
      jobs.sort((a, b) => b.late.days - a.late.days || a.expected_at.localeCompare(b.expected_at));
      const names = await partyNames(ctx, jobs.map((j) => j.performer));
      const rows = jobs.slice(0, 8).map((j) => jobRow(j, lang, procs, names.get(pk(j.performer))?.name));
      const title = tr(lang, call.args.status === 'late' ? 'late_title' : call.args.status === 'ready' ? 'ready_title' : call.args.status === 'closed' ? 'closed_title' : 'open_title');
      return { kind: 'goods_answer', title, rows, source: source(lang, jobs.length, rows.some((r) => r.value.startsWith(tr(lang, 'about')))), note: rows.length ? (jobs.length > 8 ? tr(lang, 'and_more', { n: jobs.length - 8 }) : undefined) : tr(lang, 'nothing') };
    }
    case 'query_movements': {
      const since = call.args.period === 'today' ? todayIST() : call.args.period === 'this_week' ? daysAgo(7) : call.args.period === 'this_month' ? daysAgo(31) : '2000-01-01';
      const f: any = { party_business_ids: ctx.businessId, cancelled_at: null, business_date: { $gte: since } };
      const movs = (await col('sc_movements').find(f).sort({ business_date: -1, recorded_at: -1 }).limit(60).toArray()).filter((m: any) => {
        if (m.recorder_business_id !== ctx.businessId && m.visible_at > Date.now()) return false;
        const fromMe = m.from.party.k === 'b' && m.from.party.id === ctx.businessId;
        if (call.args.direction === 'sent' && !fromMe) return false;
        if (call.args.direction === 'received' && fromMe) return false;
        if (p.ref && !(pk(m.from.party) === pk(p.ref) || pk(m.to.party) === pk(p.ref))) return false;
        return true;
      });
      const names = await partyNames(ctx, movs.flatMap((m: any) => [m.from.party, m.to.party]));
      const rows = movs.slice(0, 8).map((m: any) => {
        const fromMe = m.from.party.k === 'b' && m.from.party.id === ctx.businessId;
        const other = fromMe ? m.to.party : m.from.party;
        const lines = (m.lines as any[]).filter((l) => l.viewer_business_ids?.includes(ctx.businessId));
        const first = lines[0];
        const sent = first?.sent?.at(-1)?.base_qty ?? 0;
        return { label: `${first?.label_generic && first.generic_viewer === ctx.businessId ? first.label_generic : first?.label_en ?? ''}${lines.length > 1 ? ` ${tr(lang, 'and_more', { n: lines.length - 1 })}` : ''}`, value: q(sent, first?.dim ?? 'count'), sub: `${names.get(pk(other))?.name ?? ''} · ${shortDate(m.business_date, lang)}`, href: `/goods/movement/${m._id}`, tone: null };
      });
      return { kind: 'goods_answer', title: tr(lang, 'moves_title'), rows, source: source(lang, movs.length, false), note: rows.length ? undefined : tr(lang, 'nothing') };
    }
    case 'compute_analytics':
      return analytics(ctx, call.args.metric, call.args.process ?? undefined, procs);
  }
}

const daysAgo = (n: number) => new Date(Date.now() + 5.5 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);

async function inMyUnit(ctx: Ctx, material?: string, colour?: string): Promise<Answer> {
  const lang = ctx.language;
  const rows0 = (await positions(ctx, { tab: 'in' })).filter((r) => r.mine && r.key.t === 'real' && r.key.state.s !== 'allocated' && r.qty_base > 0);
  const specs = new Map((await col('sc_specs').find({ _id: { $in: rows0.map((r) => (r.key.t === 'real' ? r.key.spec : '')) } } as any).toArray()).map((s: any) => [s._id, s.label_en as string]));
  const rows = rows0
    .map((r) => ({ r, label: r.key.t === 'real' ? specs.get(r.key.spec) ?? '' : '' }))
    .filter((x) => labelFits(x.label, material, colour))
    .sort((a, b) => b.r.qty_base - a.r.qty_base)
    .slice(0, 8)
    .map((x) => ({ label: x.label, value: q(x.r.qty_base, x.r.dimension), sub: x.r.key.t === 'real' ? [x.r.key.lot, x.r.key.grade !== 'A' ? x.r.key.grade : null].filter(Boolean).join(' · ') || undefined : undefined, tone: null as null }));
  return { kind: 'goods_answer', title: tr(lang, 'in_title'), rows, source: source(lang, rows.length, false), note: rows.length ? undefined : tr(lang, 'nothing') };
}

async function comingIn(ctx: Ctx): Promise<Answer> {
  const lang = ctx.language;
  const procs = await processLabels(lang);
  const conf = await toConfirmFor(ctx);
  const rows: Answer['rows'] = conf.slice(0, 4).map((c: any) => ({ label: c.lines?.[0]?.label ?? '', value: q(c.lines?.[0]?.sent ?? 0, c.lines?.[0]?.dim ?? 'count'), sub: `${c.name} · ${tr(lang, 'to_confirm')}`, href: `/goods/movement/${c.movementId}`, tone: 'due' }));
  const jobs = (await jobSummaries(ctx)).filter((j) => j.pending > 0 && !j.cancelled).sort((a, b) => a.expected_at.localeCompare(b.expected_at));
  const names = await partyNames(ctx, jobs.map((j) => j.performer));
  for (const j of jobs.slice(0, 8 - rows.length)) rows.push(jobRow(j, lang, procs, names.get(pk(j.performer))?.name));
  return { kind: 'goods_answer', title: tr(lang, 'coming_title'), rows, source: source(lang, conf.length + jobs.length, rows.some((r) => r.value.startsWith(tr(lang, 'about')))), note: rows.length ? undefined : tr(lang, 'nothing') };
}

/** Owner-only performance per job worker from closed jobs (last 12 months); fewer than 3 jobs says so. */
async function analytics(ctx: Ctx, metric: 'loss_pct' | 'turnaround_days' | 'reject_pct', process: string | undefined, procs: Map<string, string>): Promise<Answer> {
  const lang = ctx.language;
  const jobs = await col('sc_jobs').find({ 'owner_party.id': ctx.businessId, 'client_party.id': ctx.businessId, status: 'closed', in_house: { $ne: true }, closed_at: { $gte: Date.now() - 365 * 86400e3 } } as any).limit(500).toArray();
  const pick = jobs.filter((j: any) => !process || j.process_key.includes(process.toLowerCase()) || (procs.get(j.process_key) ?? '').toLowerCase().includes(process.toLowerCase()));
  const by = new Map<string, { ref: PartyRef; vals: number[]; norm: number; proc: string }>();
  for (const j of pick as any[]) {
    let v: number | null = null;
    if (metric === 'loss_pct') v = j.conservation_kind === 'mass_losing' ? j.closure?.loss_pct ?? null : null;
    // Same rule as the Performance report: working days, minus days the job was held (not the worker's delay).
    if (metric === 'turnaround_days') v = j.closure?.business_date ? Math.max(0, workingDaysBetween(j.business_date, j.closure.business_date) - (j.pauses ?? []).reduce((n: number, p: any) => n + workingDaysBetween(p.from, p.to ?? j.closure.business_date), 0)) : null;
    if (metric === 'reject_pct') {
      const outs = (j.outputs as any[]).filter((o) => o.source !== 'child');
      const tot = outs.reduce((a, o) => a + o.qty, 0);
      v = tot ? Math.round((outs.filter((o) => ['reject', 'scrap'].includes(o.grade)).reduce((a, o) => a + o.qty, 0) / tot) * 1000) / 10 : null;
    }
    if (v === null) continue;
    const k = pk(j.performer_party);
    if (!by.has(k)) by.set(k, { ref: j.performer_party, vals: [], norm: j.loss_norm_pct ?? 0, proc: j.process_key });
    by.get(k)!.vals.push(v);
  }
  const names = await partyNames(ctx, [...by.values()].map((x) => x.ref));
  const unit = metric === 'turnaround_days' ? '' : ' %';
  const rows = [...by.entries()].map(([k, x]) => {
    // Median, like the Performance report, so Claire and the report give the same figure.
    const sv = [...x.vals].sort((a, b) => a - b);
    const mid = sv.length % 2 ? sv[(sv.length - 1) / 2] : (sv[sv.length / 2 - 1] + sv[sv.length / 2]) / 2;
    const avg = Math.round(mid * 10) / 10;
    const enough = x.vals.length >= 3;
    return { label: names.get(k)?.name ?? '—', value: enough ? `${avg}${unit}` : '—', sub: [procs.get(x.proc) ?? x.proc, enough ? tr(lang, 'jobs_n', { n: x.vals.length }) : tr(lang, 'not_enough', { n: x.vals.length }), metric === 'loss_pct' && enough ? tr(lang, 'usual', { pct: x.norm }) : null].filter(Boolean).join(' · '), tone: null as null };
  }).sort((a, b) => (a.value === '—' ? 1 : 0) - (b.value === '—' ? 1 : 0));
  return { kind: 'goods_answer', title: tr(lang, metric === 'loss_pct' ? 'analytics_title' : metric === 'turnaround_days' ? 'turnaround_title' : 'rejects_title'), rows, source: source(lang, pick.length, false), note: rows.length ? undefined : tr(lang, 'nothing') };
}
