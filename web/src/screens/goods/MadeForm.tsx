// Record → Made here (U8, J17): Cut · Pack · Check · Make sets · Unpack, as an in-house job saved and closed at once.
// The "Does it add up?" strip runs the same closure plan the server posts (@shared/sc/conservation).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api, ApiError, errorText } from '../../lib/api';
import { postOrQueue } from '../../lib/offline';
import { Button } from '../../components/Button';
import { ArrowLeft, ChevronRight, LayoutGrid, Plus, Trash2 } from '../../icons';
import { useSession } from '../../store/session';
import { todayIST } from '@shared/sc/dates';
import { toBase } from '@shared/sc/units';
import { planClosure, type ClosureLine } from '@shared/sc/conservation';
import { JobS } from './Job.strings';
import { RecS } from './Record.strings';
import { SpecPicker } from './SpecPicker';
import { GridSheet, type Style } from './GridSheet';
import { clientId, qty as fmtQty, shortDate } from './format';
import type { MaterialType, ResolvedSpec } from './types';

interface Proc { key: string; labels: Record<string, string>; conservation_kind: string }
type Grade = 'A' | 'B' | 'rework' | 'reject';
interface Line { spec: ResolvedSpec | null; qty: string; unit: string; lot: string; grade: Grade }
interface Made { id: string; process_key: string; business_date: string; inputs: { label: string; qty: number; dim: string; role: string }[]; outputs: { label: string; qty: number; dim: string; grade: string; by_product: boolean }[]; residual: number }
const MADE = ['cutting', 'packing', 'checking', 'make_sets', 'unpack'];
const empty = (grade: Grade = 'A'): Line => ({ spec: null, qty: '', unit: '', lot: '', grade });
const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';
const base = (l: Line) => {
  if (!l.spec || !(Number(l.qty) > 0)) return 0;
  const r = toBase(Number(l.qty), l.unit, l.spec.dimension);
  return r.ok ? r.base : 0;
};

export default function MadeForm() {
  const s = JobS.use();
  const r = RecS.use();
  const nav = useNavigate();
  const lang = useSession((st) => st.user?.language || 'en');
  const [procs, setProcs] = useState<Proc[]>([]);
  const [forms, setForms] = useState<Record<string, string>>({});
  const [styles, setStyles] = useState<Style[]>([]);
  const [proc, setProc] = useState<Proc | null>(null);
  const [ins, setIns] = useState<Line[]>([empty()]);
  const [outs, setOuts] = useState<Line[]>([empty()]);
  const [waste, setWaste] = useState('');
  const [pick, setPick] = useState<{ side: 'in' | 'out'; i: number } | null>(null);
  const [grid, setGrid] = useState(false);
  const [short, setShort] = useState<string | null>(null);
  const [then, setThen] = useState<'send' | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Made[]>([]);
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [cid, setCid] = useState(clientId);

  useEffect(() => {
    void api.get<{ materials: MaterialType[] & { form?: string }[]; processes: Proc[] }>('/api/sc/templates').then((t) => {
      const list = t.processes.filter((p) => MADE.includes(p.key)).sort((a, b) => MADE.indexOf(a.key) - MADE.indexOf(b.key));
      setProcs(list);
      setProc((cur) => cur ?? list[0] ?? null);
      setForms(Object.fromEntries((t.materials as unknown as { id: string; form: string }[]).map((m) => [m.id, m.form])));
    });
    void api.get<{ styles: Style[] }>('/api/sc/styles').then((x) => setStyles(x.styles)).catch(() => undefined);
    void api.get<{ jobs: Made[] }>('/api/sc/made').then((x) => setRecent(x.jobs)).catch(() => undefined);
    void api.get<{ role: 'owner' | 'staff' }>('/api/sc/home').then((h) => setRole(h.role)).catch(() => undefined);
  }, []);

  const kind = proc?.conservation_kind ?? 'count_preserving';
  const isCut = proc?.key === 'cutting';
  const isCheck = proc?.key === 'checking';
  const set = (side: 'in' | 'out', i: number, patch: Partial<Line>) => (side === 'in' ? setIns : setOuts)((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // QC: what came out is the same goods, split by grade.
  useEffect(() => {
    if (isCheck && ins[0]?.spec && outs.every((o) => !o.spec)) {
      setOuts((['A', 'rework', 'reject'] as Grade[]).map((g) => ({ ...empty(g), spec: ins[0].spec, unit: ins[0].unit })));
    }
  }, [isCheck, ins, outs]);

  const check = useMemo(() => {
    const lines: ClosureLine[] = ins.filter((l) => l.spec && base(l) > 0).map((l, i) => {
      const a = l.spec!.spec.attrs ?? {};
      return { id: String(i), dim: l.spec!.dimension, qty: base(l), role: forms[l.spec!.spec.material_type_id] === 'trim' ? 'secondary' : 'primary', group: `${l.spec!.spec.material_type_id}|${a.style ?? ''}|${a.component ?? ''}|${a.kind ?? ''}`, size: (a.size as string) ?? null };
    });
    const o = outs.filter((l) => l.spec && base(l) > 0);
    if (!lines.length || !o.length) return null;
    const wasteG = isCut && Number(waste) > 0 ? Math.round(Number(waste) * 1000) : 0;
    let est: number | null = wasteG;
    let missing: string | null = null;
    for (const l of o) {
      if (l.spec!.dimension === 'mass') { est = (est ?? 0) + base(l); continue; }
      const style = String(l.spec!.spec.attrs?.style ?? '').toUpperCase();
      const w = styles.find((x) => x.code === style)?.set_weight_g;
      if (!w) { missing = style || '—'; est = null; break; }
      est = (est ?? 0) + base(l) * w;
    }
    const outsAll = [...o.map((l) => ({ dim: l.spec!.dimension, qty: base(l), size: (l.spec!.spec.attrs?.size as string) ?? null })), ...(wasteG ? [{ dim: 'mass' as const, qty: wasteG, size: null }] : [])];
    const plan = planClosure(kind as never, lines, outsAll, { estimateInto: isCut ? est : null });
    const primary = lines.filter((l) => l.role === 'primary');
    const dim = primary[0]?.dim ?? 'count';
    const inQty = primary.filter((l) => l.dim === dim).reduce((a, l) => a + l.qty, 0);
    const pieces = o.filter((l) => l.spec!.dimension === 'count').reduce((a, l) => a + base(l), 0);
    return { plan, dim, inQty, pieces, wasteG, est, missing };
  }, [ins, outs, waste, styles, forms, kind, isCut]);

  const ready = !!proc && ins.every((l) => l.spec && Number(l.qty) > 0 && l.unit) && outs.some((l) => l.spec && Number(l.qty) > 0) && outs.every((l) => !l.spec || (Number(l.qty) >= 0 && l.unit));

  const save = async (next?: 'send', untracked?: string) => {
    if (!proc) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        process_key: proc.key, client_id: cid, business_date: todayIST(),
        inputs: ins.map((l) => ({ spec_id: l.spec!.spec.id, qty: Number(l.qty), unit: l.unit, lot: l.lot.trim() || undefined })),
        outputs: outs.filter((l) => l.spec && Number(l.qty) > 0).map((l) => ({ spec_id: l.spec!.spec.id, qty: Number(l.qty), unit: l.unit, grade: l.grade, lot: l.lot.trim() || undefined })),
        ...(isCut && Number(waste) > 0 ? { waste: { qty: Number(waste), unit: 'kg' } } : {}),
        ...(untracked ? { allow_untracked: true, untracked_reason: untracked } : {}),
      };
      const res = await postOrQueue<{ job: { id: string } }>('/api/sc/made', body, s('made'));
      if ('queued' in res) { nav('/goods?queued=1', { replace: true }); return; }
      if (next === 'send') {
        const prefill = outs.filter((l) => l.spec && Number(l.qty) > 0 && l.grade === 'A').map((l) => ({ spec: l.spec, qty: l.qty, unit: l.unit, lot: l.lot }));
        nav('/goods/record/send', { replace: true, state: { prefill } });
      } else nav(`/goods/job/${res.job.id}`, { replace: true });
    } catch (e) {
      const b = (e as ApiError).body as { code?: string; lines?: { available: number; needed: number; dim: string }[] } | undefined;
      if (e instanceof ApiError && b?.code === 'negative' && b.lines?.length) {
        setThen(next);
        setShort(s('from_stock_short', { have: fmtQty(b.lines[0].available, b.lines[0].dim), need: fmtQty(b.lines[0].needed, b.lines[0].dim) }));
      }
      else setError(errorText(e));
      setCid(clientId());
    } finally {
      setBusy(false);
    }
  };

  const lineEditor = (side: 'in' | 'out', l: Line, i: number, list: Line[]) => (
    <div key={`${side}${i}`} className="rounded-[18px] border border-line bg-surface p-3.5">
      <div className="flex items-start gap-2">
        <button className="min-h-12 flex-1 rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setPick({ side, i })}>
          {l.spec?.spec.label_en ?? <span className="font-normal text-meta">{r('material')} · {r('pick')}</span>}
        </button>
        {list.length > 1 && (
          <button className="flex size-12 items-center justify-center rounded-full text-meta hover:bg-sunken" aria-label="Remove" onClick={() => (side === 'in' ? setIns : setOuts)((ls) => ls.filter((_, j) => j !== i))}>
            <Trash2 size={18} />
          </button>
        )}
      </div>
      {l.spec && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="w-28">
            <span className="mb-1 block text-[13px] font-semibold text-ink-2">{r('qty')}</span>
            <input className={inputCls + ' text-right font-head font-bold tabular-nums'} inputMode="decimal" value={l.qty} onChange={(e) => set(side, i, { qty: e.target.value.replace(/[^\d.]/g, '') })} />
          </label>
          <div className="flex flex-wrap gap-1.5 pb-0.5">
            {l.spec.units.filter((u) => !['rolls', 'cones', 'bundles', 'bags', 'boxes'].includes(u)).map((u) => (
              <button key={u} onClick={() => set(side, i, { unit: u })} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', l.unit === u ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{u}</button>
            ))}
          </div>
          <label className="w-28">
            <span className="mb-1 block text-[13px] font-semibold text-ink-2">{r('lot')}</span>
            <input className={inputCls} value={l.lot} onChange={(e) => set(side, i, { lot: e.target.value })} placeholder="N-0398" />
          </label>
          {side === 'out' && (isCheck || l.grade !== 'A') && (
            <div className="flex w-full flex-wrap gap-1.5" role="radiogroup">
              {(['A', 'B', 'rework', 'reject'] as Grade[]).map((g) => (
                <button key={g} role="radio" aria-checked={l.grade === g} onClick={() => set(side, i, { grade: g })} className={clsx('min-h-10 rounded-full border px-3 text-[13.5px] font-semibold', l.grade === g ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{s(`g_${g}` as 'g_A')}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const c = check;
  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="font-head text-[20px] font-bold text-ink">{s('made')}</h1>
      </header>

      <div className="space-y-5 px-4 pt-4">
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {procs.map((p) => (
            <button key={p.key} role="radio" aria-checked={proc?.key === p.key} onClick={() => { setProc(p); setOuts([empty()]); }}
              className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', proc?.key === p.key ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
              {p.labels[lang] ?? p.labels.en}
            </button>
          ))}
        </div>

        <section>
          <h2 className="mb-2 font-head text-[17px] font-semibold text-ink">{s('taken')}</h2>
          <div className="space-y-3">
            {ins.map((l, i) => lineEditor('in', l, i, ins))}
            <Button variant="ghost" icon={Plus} onClick={() => setIns((ls) => [...ls, empty()])}>{r('material')}</Button>
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-head text-[17px] font-semibold text-ink">{s('came_out')}</h2>
          <div className="space-y-3">
            {outs.map((l, i) => lineEditor('out', l, i, outs))}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" icon={Plus} onClick={() => setOuts((ls) => [...ls, empty()])}>{s('add')}</Button>
              {!isCheck && <Button variant="ghost" icon={LayoutGrid} onClick={() => setGrid(true)}>{s('grid')}</Button>}
            </div>
          </div>
        </section>

        {isCut && (
          <label className="block">
            <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] font-semibold text-ink-2"><span>{s('waste')}</span><span className="font-normal text-meta">{s('waste_hint')}</span></span>
            <span className="flex items-center gap-2"><input className={inputCls + ' w-32 text-right tabular-nums'} inputMode="decimal" value={waste} onChange={(e) => setWaste(e.target.value.replace(/[^\d.]/g, ''))} /><span className="text-[15px] text-ink-2">kg</span></span>
          </label>
        )}

        {c && (
          <section className="rounded-[18px] bg-sunken px-4 py-3.5" aria-live="polite">
            <h2 className="text-[13px] font-semibold text-ink-2">{s('adds_up')}</h2>
            {isCut ? (
              c.est == null ? <p className="mt-1 text-[14.5px] text-ink-2">{s('no_weight', { style: c.missing ?? '' })}</p> : (
                <>
                  <p className="mt-1 text-[15px] text-ink">{s('cut_line', { in: fmtQty(c.inQty, 'mass'), into: fmtQty(Math.max(0, c.est - c.wasteG), 'mass'), n: c.pieces, waste: fmtQty(c.wasteG, 'mass') })}</p>
                  <p className={clsx('mt-0.5 text-[15px] font-semibold', Math.abs(c.plan.residual) > c.inQty * 0.02 ? 'text-danger' : 'text-ink')}>{s('left_line', { qty: `${fmtQty(Math.abs(c.plan.residual), 'mass')}${c.inQty ? ` (${Math.round((Math.abs(c.plan.residual) / c.inQty) * 1000) / 10} %)` : ''}` })}</p>
                </>
              )
            ) : (
              <>
                <p className="mt-1 text-[15px] text-ink">{s('count_line', { in: fmtQty(c.inQty, c.dim), out: fmtQty(outs.filter((l) => l.spec?.dimension === c.dim).reduce((a, l) => a + base(l), 0), c.dim) })}</p>
                <p className={clsx('mt-0.5 text-[15px] font-semibold', c.plan.residual > 0 ? 'text-danger' : 'text-success')}>
                  {c.plan.overYield > 0 ? s('over_line', { n: c.plan.overYield }) : c.plan.residual > 0 ? s('unacc_line', { n: fmtQty(c.plan.residual, c.dim) }) : s('all_adds_up')}
                </p>
              </>
            )}
          </section>
        )}

        {short && (
          <div className="rounded-[16px] bg-accent-tint p-3.5">
            <p className="text-[15px] font-semibold text-accent-ink">{short}</p>
            {role === 'owner' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input className={inputCls + ' flex-1'} placeholder={r('reason_ph')} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={s('reason')} />
                <Button disabled={reason.trim().length < 3} loading={busy} onClick={() => void save(then, reason.trim())}>{s('record_anyway')}</Button>
              </div>
            ) : <p className="mt-1 text-[14px] text-ink-2">{r('owner_only_override')}</p>}
          </div>
        )}
        {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}

        {recent.length > 0 && (
          <section>
            <h2 className="mb-2 font-head text-[17px] font-semibold text-ink">{s('recent')}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {recent.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/job/${m.id}`)}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{procs.find((p) => p.key === m.process_key)?.labels[lang] ?? m.process_key} · {shortDate(m.business_date, lang)}</span>
                      <span className="block text-[13px] text-ink-2">{m.inputs.filter((x) => x.role === 'primary').map((x) => `${fmtQty(x.qty, x.dim)} ${x.label}`).join(', ')} → {m.outputs.filter((x) => !x.by_product).reduce((a, x) => a + x.qty, 0)} pcs</span>
                    </span>
                    <ChevronRight size={18} className="text-meta" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[480px] gap-2 border-t border-line bg-surface px-4 py-3 pb-[calc(12px+var(--safe-bottom))]">
        {isCut && <Button className="flex-1" size="lg" variant="secondary" disabled={!ready} loading={busy} onClick={() => void save('send')}>{s('save_send')}</Button>}
        <Button className="flex-1" size="lg" disabled={!ready} loading={busy} onClick={() => void save()}>{s('save')}</Button>
      </div>

      <SpecPicker open={pick !== null} onClose={() => setPick(null)} onPick={(x) => pick && set(pick.side, pick.i, { spec: x, unit: x.units[0] ?? '' })} />
      <GridSheet open={grid} noTrims onClose={() => setGrid(false)} onAdd={(add) => setOuts((ls) => [...ls.filter((l) => l.spec), ...add.map((a) => ({ spec: a.spec, qty: String(a.qty), unit: a.unit, lot: a.lot, grade: 'A' as Grade }))])} />
    </div>
  );
}
