// Correct stock (slice 4.5, model §3.6): change grade / material / lot, write off, count, found goods; and goods lost
// in a fire, theft or flood at my unit (one difference per owner whose goods were lost).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, Plus } from '../../icons';
import { useSession } from '../../store/session';
import { todayIST } from '@shared/sc/dates';
import { toBase } from '@shared/sc/units';
import { TradeS } from './Trade.strings';
import { StaffS } from './Staff.strings';
import { JobS } from './Job.strings';
import { RecS } from './Record.strings';
import { SpecPicker } from './SpecPicker';
import { clientId, qty as fmtQty, shortDate } from './format';
import type { ResolvedSpec, Spec } from './types';

type Op = 'regrade' | 'respec' | 'relot' | 'write_off' | 'count';
type Grade = 'A' | 'B' | 'rework' | 'reject' | 'scrap';
interface Row { id: string; spec: Spec | null; dimension: 'mass' | 'count' | 'length'; units: string[]; lot: string | null; grade: Grade; place: string | null; qty: number; with: unknown }
interface AtUnit { id: string; label: string; lot: string | null; grade: string; dim: string; qty: number; state: string; mine: boolean; for: string | null }
interface Hist { id: string; op: string; label: string; to_label: string | null; lot: string | null; qty: number; book: number; dim: string; reason: string | null; business_date: string }
const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';
const UNITLESS = ['rolls', 'cones', 'bundles', 'bags', 'boxes'];

export default function AdjustScreen() {
  const t = TradeS.use();
  const sf = StaffS.use();
  const jb = JobS.use();
  const r = RecS.use();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const [rows, setRows] = useState<Row[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [sel, setSel] = useState<Row | null>(null);
  const [op, setOp] = useState<Op>('count');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [grade, setGrade] = useState<Grade>('B');
  const [toSpec, setToSpec] = useState<ResolvedSpec | null>(null);
  const [lot, setLot] = useState('');
  const [why, setWhy] = useState('');
  const [pick, setPick] = useState<'respec' | 'found' | null>(null);
  const [found, setFound] = useState<ResolvedSpec | null>(null);
  const [fire, setFire] = useState(params.get('fire') === '1');
  const [atUnit, setAtUnit] = useState<AtUnit[]>([]);
  const [lost, setLost] = useState<Record<string, string>>({});
  const [cause, setCause] = useState<'fire' | 'theft' | 'flood' | 'other'>('fire');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, hh] = await Promise.all([api.get<{ rows: Row[] }>('/api/sc/stock'), api.get<{ adjustments: Hist[] }>('/api/sc/adjust')]);
    setRows(s.rows.filter((x) => !x.with && x.spec));
    setHist(hh.adjustments);
  }, []);
  useEffect(() => {
    void load();
    void api.get<{ role: 'owner' | 'staff' }>('/api/sc/home').then((h) => setRole(h.role)).catch(() => undefined);
  }, [load]);
  useEffect(() => {
    if (fire) void api.get<{ rows: AtUnit[] }>('/api/sc/adjust/at-my-unit').then((x) => setAtUnit(x.rows));
  }, [fire]);

  const open = (x: Row) => {
    setSel(x); setOp('count'); setQty(''); setUnit(x.units.find((u) => !UNITLESS.includes(u)) ?? ''); setToSpec(null); setLot(''); setWhy(''); setError(null);
  };
  const counted = sel && Number(qty) >= 0 && qty !== '' ? toBase(Number(qty), unit, sel.dimension) : null;
  const diff = sel && counted?.ok ? counted.base - sel.qty : null;

  const submit = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ adjustment?: { pending?: boolean } }>('/api/sc/adjust', { ...body, client_id: clientId(), business_date: todayIST() });
      setSel(null); setFound(null); setMsg(r.adjustment?.pending ? sf('pending_sent') : done); setTimeout(() => setMsg(null), 2500);
      await load();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const ops: Op[] = role === 'owner' ? ['count', 'regrade', 'relot', 'respec', 'write_off'] : ['count', 'regrade', 'relot'];
  const opLabel = (o: string) => t(`op_${o}` as 'op_count');

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 font-head text-[20px] font-bold text-ink">{t('stock')}</h1>
      </header>

      <div className="px-4 pt-4 lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-6">
        <section>
          <div className="flex flex-wrap gap-2">
            {role === 'owner' && <Button variant="tint" icon={Plus} onClick={() => setPick('found')}>{t('found')}</Button>}
            {role === 'owner' && <Button variant="ghost" onClick={() => setFire(true)}>{t('fire')}</Button>}
          </div>
          <h2 className="mt-5 font-head text-[17px] font-semibold text-ink">{t('my_unit')}</h2>
          {rows.length === 0 ? <p className="mt-2 text-[14.5px] text-ink-2">{t('nothing')}</p> : (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {rows.map((x) => (
                <li key={x.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => open(x)}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{x.spec?.label_en}{x.grade !== 'A' ? ` · ${jb(`g_${x.grade}` as 'g_A')}` : ''}</span>
                      <span className="block text-[13px] text-meta">{[x.lot, x.place].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="shrink-0 font-head font-bold tabular-nums text-ink">{fmtQty(x.qty, x.dimension)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          {hist.length > 0 && (
            <>
              <h2 className="mt-5 font-head text-[17px] font-semibold text-ink lg:mt-0">{t('history')}</h2>
              <ul className="mt-2 space-y-1.5 rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] text-ink-2">
                {hist.slice(0, 12).map((x) => (
                  <li key={x.id}>
                    <span className="font-semibold text-ink">{opLabel(x.op)}</span> · {x.label}{x.to_label ? ` → ${x.to_label}` : ''} · {x.op === 'count' ? t('h_line_count', { book: fmtQty(x.book, x.dim), qty: fmtQty(x.qty, x.dim) }) : x.op === 'casualty' ? '' : fmtQty(x.qty, x.dim)}
                    <span className="text-meta"> · {shortDate(x.business_date, lang)}{x.reason ? ` · ${x.reason}` : ''}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {msg && <p role="status" className="mt-4 rounded-[14px] bg-success-tint px-3 py-2 text-[14px] text-success">{msg}</p>}
      </div>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.spec?.label_en}
        footer={<Button block size="lg" loading={busy}
          disabled={!sel || (op === 'count' ? !counted?.ok : !(Number(qty) > 0)) || (op === 'respec' && !toSpec) || (op === 'relot' && !lot.trim()) || (op === 'write_off' && why.trim().length < 2)}
          onClick={() => sel && void submit({ op, holding_id: sel.id, qty: Number(qty), unit, ...(op === 'regrade' ? { to_grade: grade } : {}), ...(op === 'respec' ? { to_spec_id: toSpec?.spec.id } : {}), ...(op === 'relot' ? { to_lot: lot.trim() } : {}), ...(why.trim() ? { reason: why.trim() } : {}) }, t('saved'))}>
          {opLabel(op)}</Button>}>
        {sel && (
          <div className="space-y-4 pb-2">
            <p className="text-[13.5px] text-meta">{[sel.lot, sel.place, jb(`g_${sel.grade === 'scrap' ? 'reject' : sel.grade}` as 'g_A'), t('book', { qty: fmtQty(sel.qty, sel.dimension) })].filter(Boolean).join(' · ')}</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {ops.map((o) => (
                <button key={o} role="radio" aria-checked={op === o} onClick={() => setOp(o)} className={clsx('min-h-10 rounded-full border px-3 text-[13.5px] font-semibold', op === o ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{opLabel(o)}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="w-32"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{op === 'count' ? t('counted') : t('how_many')}</span>
                <input className={inputCls + ' text-right font-head font-bold tabular-nums'} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} /></label>
              <div className="flex flex-wrap gap-1.5 pb-0.5">
                {sel.units.filter((u) => !UNITLESS.includes(u)).map((u) => (
                  <button key={u} onClick={() => setUnit(u)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', unit === u ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{u}</button>
                ))}
              </div>
            </div>
            {op === 'count' && diff !== null && <p className={clsx('text-[15px] font-semibold', diff === 0 ? 'text-success' : 'text-accent-ink')}>{diff === 0 ? t('diff_same') : diff > 0 ? t('diff_more', { qty: fmtQty(diff, sel.dimension) }) : t('diff_less', { qty: fmtQty(-diff, sel.dimension) })}</p>}
            {op === 'regrade' && (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('grade')}>
                {(['A', 'B', 'rework', 'reject'] as Grade[]).filter((g) => g !== sel.grade).map((g) => (
                  <button key={g} role="radio" aria-checked={grade === g} onClick={() => setGrade(g)} className={clsx('min-h-10 rounded-full border px-3 text-[13.5px] font-semibold', grade === g ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{jb(`g_${g}` as 'g_A')}</button>
                ))}
              </div>
            )}
            {op === 'respec' && <button className="min-h-12 w-full rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setPick('respec')}>{toSpec?.spec.label_en ?? <span className="font-normal text-meta">{r('material')} · {r('pick')}</span>}</button>}
            {op === 'relot' && <label className="block"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('new_lot')}</span><input className={inputCls} value={lot} onChange={(e) => setLot(e.target.value)} /></label>}
            {(op === 'write_off' || op === 'respec') && <label className="block"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('why')}</span><input className={inputCls} placeholder={t('why_ph')} value={why} onChange={(e) => setWhy(e.target.value)} /></label>}
            {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
          </div>
        )}
      </Sheet>

      <Sheet open={!!found} onClose={() => setFound(null)} title={t('found')}
        footer={<Button block size="lg" loading={busy} disabled={!(Number(qty) > 0) || !unit} onClick={() => found && void submit({ op: 'found', spec_id: found.spec.id, qty: Number(qty), unit, ...(lot.trim() ? { lot: lot.trim() } : {}), ...(why.trim() ? { reason: why.trim() } : {}) }, t('saved'))}>{t('op_found')}</Button>}>
        {found && (
          <div className="space-y-4 pb-2">
            <p className="text-[15px] font-semibold text-ink">{found.spec.label_en}</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="w-32"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('how_many')}</span><input className={inputCls + ' text-right font-head font-bold tabular-nums'} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} /></label>
              <div className="flex flex-wrap gap-1.5 pb-0.5">{found.units.filter((u) => !UNITLESS.includes(u)).map((u) => <button key={u} onClick={() => setUnit(u)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', unit === u ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{u}</button>)}</div>
            </div>
            <label className="block"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{r('lot')}</span><input className={inputCls} value={lot} onChange={(e) => setLot(e.target.value)} /></label>
            {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
          </div>
        )}
      </Sheet>

      <Sheet open={fire} onClose={() => setFire(false)} title={t('fire')}
        footer={<Button block size="lg" loading={busy} disabled={!Object.values(lost).some((v) => Number(v) > 0)} onClick={async () => {
          setBusy(true); setError(null);
          try {
            const items = Object.entries(lost).filter(([, v]) => Number(v) > 0).map(([id, v]) => { const x = atUnit.find((a) => a.id === id)!; return { holding_id: id, qty: Number(v), unit: x.dim === 'mass' ? 'kg' : x.dim === 'length' ? 'm' : 'pcs' }; });
            await api.post('/api/sc/adjust/casualty', { cause, note: note.trim() || undefined, items, client_id: clientId(), business_date: todayIST() });
            setFire(false); setLost({}); setMsg(t('casualty_done')); setTimeout(() => setMsg(null), 4000); await load();
          } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
        }}>{t('lost')}</Button>}>
        <div className="space-y-4 pb-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('cause')}>
            {(['fire', 'theft', 'flood', 'other'] as const).map((c) => (
              <button key={c} role="radio" aria-checked={cause === c} onClick={() => setCause(c)} className={clsx('min-h-10 rounded-full border px-3 text-[13.5px] font-semibold', cause === c ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{t(`c_${c}` as 'c_fire')}</button>
            ))}
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {atUnit.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-ink">{x.label}</span>
                  <span className="block text-[12.5px] text-meta">{[x.mine ? t('mine') : t('for_name', { name: x.for ?? '' }), x.lot, fmtQty(x.qty, x.dim)].filter(Boolean).join(' · ')}</span>
                </span>
                <input className="h-11 w-20 rounded-[12px] border border-line-strong px-2 text-right tabular-nums" inputMode="decimal" aria-label={`${t('lost')} ${x.label}`} placeholder="0" value={lost[x.id] ?? ''} onChange={(e) => setLost((l) => ({ ...l, [x.id]: e.target.value.replace(/[^\d.]/g, '') }))} />
              </li>
            ))}
          </ul>
          <label className="block"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('note')}</span><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </div>
      </Sheet>

      <SpecPicker open={pick !== null} onClose={() => setPick(null)} onPick={(x) => { if (pick === 'respec') setToSpec(x); else { setFound(x); setQty(''); setLot(''); setUnit(x.units.find((u) => !UNITLESS.includes(u)) ?? ''); } }} />
    </div>
  );
}
