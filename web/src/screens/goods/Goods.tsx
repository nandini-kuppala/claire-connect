// Goods tab (03 S1 / S1c / S10). Out with others (late first), Coming in, In my unit; Record sheet; Undo toast.
// Lazy-loaded route, so it adds nothing to the first load.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowDown, ArrowRight, BarChart3, ChevronRight, Plus, Repeat, Settings, Scissors, SlidersHorizontal, AlertTriangle, Clock, Pause } from '../../icons';
import { MoneyS } from './Money.strings';
import { useSession } from '../../store/session';
import { GoodsS } from './Goods.strings';
import { SetupS } from './Setup.strings';
import { RecS } from './Record.strings';
import { Status, type Late } from './Status';
import { TwoS } from './Two.strings';
import { WorkS } from './Work.strings';
import { JobS } from './Job.strings';
import { TradeS } from './Trade.strings';
import { LinkBanners } from './LinkBanners';
import { WorkCard } from './WorkCard';
import { OutboxBar } from './OutboxBar';
import { OfflineS } from './Offline.strings';
import { cachedGet } from '../../lib/offline';
import { Others } from './Others';
import { qty as fmtQty, shortDate } from './format';

type Tab = 'out' | 'in' | 'coming';
interface Job { id: string; performer: { k: string; id: string }; status: string; ready?: boolean; cancelled?: boolean; held?: string | null; since: string; expected_at: string; late: Late; dim: string; sent: number; issued: number; issuedBasis: string; outputs: number; pending: number; pendingAsOutput: number | null; lossNormPct: number; inputLabel: string; outputLabel: string | null; lots: string[]; name?: string }
interface OutRow { party: { k: string; id: string }; name: string; kind: string; onClaire: boolean; since: string; status: Late; jobs: Job[] }
interface InRow { id: string; label: string; lot: string | null; grade: string; place: string | null; qty: number; dim: string; state?: string }
interface Home { chips: { late: number; toConfirm: number; disputes: number }; role: 'owner' | 'staff' }
interface ToConfirm { movementId: string; action: string; role: 'receiver' | 'sender'; business_date: string; dc_no: string | null; name: string; lines: { line_id: string; label: string; dim: string; sent: number; received: number | null }[] }
interface Unmatched { id: string; from: string; business_date: string; lines: { label_en: string; qty: number; dim: string }[] }
interface DisputeRow { id: string; state: string; line_label: string; dim: string; difference: number }

const TAB_KEY = 'cc_goods_tab';
const readTab = (): Tab => {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return t === 'in' || t === 'coming' ? t : 'out';
  } catch {
    return 'out';
  }
};

export default function Goods() {
  const s = GoodsS.use();
  const ss = SetupS.use();
  const r = RecS.use();
  const t2 = TwoS.use();
  const wk = WorkS.use();
  const jb = JobS.use();
  const tr = TradeS.use();
  const [sub, setSub] = useState<'mine' | 'others'>(() => {
    try {
      return localStorage.getItem('cc_goods_sub') === 'others' ? 'others' : 'mine';
    } catch {
      return 'mine';
    }
  });
  const [othersCount, setOthersCount] = useState(0);
  const nav = useNavigate();
  const lang = useSession((st) => st.user?.language || 'en');
  const [params, setParams] = useSearchParams();
  const isStaff = useSession((st) => st.user?.role === 'staff');
  const mo = MoneyS.use();
  const off = OfflineS.use();
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const [tab, setTabState] = useState<Tab>(() => (params.get('tab') as Tab) || (isStaff && !(() => { try { return localStorage.getItem(TAB_KEY); } catch { return null; } })() ? 'coming' : readTab()));
  const [home, setHome] = useState<Home | null>(null);
  const [out, setOut] = useState<OutRow[] | null>(null);
  const [coming, setComing] = useState<Job[] | null>(null);
  const [mine, setMine] = useState<InRow[] | null>(null);
  const [toConfirm, setToConfirm] = useState<ToConfirm[]>([]);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'record' | 'pick_job' | 'disputes' | null>(null);
  const [toast, setToast] = useState<{ id: string; until: number } | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* per-viewer convenience only */
    }
  };

  // A just-saved record arrives as ?saved=<movementId>&until=<ms>: offer Undo until the window closes (D4).
  useEffect(() => {
    const id = params.get('saved');
    const until = Number(params.get('until'));
    if (params.get('queued')) {
      setToastText(off('kept'));
      const keep = params.get('tab');
      setParams(keep ? { tab: keep } : {}, { replace: true });
      const t = setTimeout(() => setToastText(null), 4000);
      return () => clearTimeout(t);
    }
    if (id && until > Date.now()) {
      setToast({ id, until });
      setToastText(r('saved'));
      const t = setTimeout(() => setToast(null), Math.min(until - Date.now(), 12_000));
      setParams({}, { replace: true });
      return () => clearTimeout(t);
    }
  }, [params, setParams, r, off]);

  const load = useCallback(async () => {
    setError(null);
    let stale: number | null = null;
    // Offline, each list shows the last copy saved on this phone ("Last updated 10:42").
    const get = async <T,>(path: string): Promise<T> => { const r0 = await cachedGet<T>(path); if (r0.staleAt) stale = Math.min(stale ?? r0.staleAt, r0.staleAt); return r0.data; };
    try {
      const h = await get<Home>('/api/sc/home');
      setHome(h);
      if (tab === 'in' && sub === 'mine') {
        const o = await api.get<{ groups: { jobs: unknown[] }[] }>('/api/sc/goods/others');
        const n = o.groups.reduce((a, g) => a + g.jobs.length, 0);
        setOthersCount(n);
      }
      if (tab === 'out') {
        const rows = (await get<{ rows: OutRow[] }>('/api/sc/goods/out')).rows;
        setOut(rows);
        // A job worker (nothing of its own out, others' goods here) opens on Others' goods unless it chose a tab (03 §4.5).
        let chosen = false;
        try {
          chosen = !!localStorage.getItem(TAB_KEY);
        } catch {
          /* no storage */
        }
        if (!rows.length && !chosen && !params.get('tab')) {
          const o = await api.get<{ groups: { jobs: unknown[] }[] }>('/api/sc/goods/others');
          if (o.groups.length) {
            setSub('others');
            setTabState('in');
          }
        }
      }
      if (tab === 'coming') {
        const c = await get<{ rows: Job[]; toConfirm: ToConfirm[]; unmatched: Unmatched[] }>('/api/sc/goods/coming');
        setComing(c.rows);
        setToConfirm(c.toConfirm);
        setUnmatched(c.unmatched);
      }
      if (tab === 'in') setMine((await get<{ mine: InRow[] }>('/api/sc/goods/in')).mine);
      setStaleAt(stale);
    } catch (e) {
      setError(errorText(e));
    }
  }, [tab, sub]);

  useEffect(() => {
    void load();
  }, [load]);
  // A kept record was sent: drop the "saved on this phone" note (the strip shows "Sent") and refresh the lists.
  const onSent = useCallback(() => { setToastText(null); void load(); }, [load]);

  const undo = async () => {
    if (!toast) return;
    try {
      await api.post(`/api/sc/movements/${toast.id}/undo`);
      setToast(null);
      setToastText(r('undone'));
      setTimeout(() => setToastText(null), 2500);
      await load();
    } catch (e) {
      setToast(null);
      setToastText(errorText(e));
    }
  };

  const openPickJob = async () => {
    if (!coming) setComing((await api.get<{ rows: Job[] }>('/api/sc/goods/coming')).rows);
    setSheet('pick_job');
  };

  const chips = home?.chips;
  const list = tab === 'out' ? out : tab === 'coming' ? coming : mine;
  const empty = { out: ['empty_out', 'empty_out_hint'], in: ['empty_in', 'empty_in_hint'], coming: ['empty_coming', 'empty_coming_hint'] } as const;

  return (
    <div className="pb-28 lg:pb-10">
      <header className="px-4 pb-1 pt-[max(18px,var(--safe-top))] lg:pt-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-head text-[28px] font-bold leading-tight text-ink">{s('title')}</h1>
          <span className="flex items-center gap-2">
          {home?.role === 'owner' && (
            <button className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-sunken" onClick={() => nav('/goods/reports')} aria-label={mo('reports')}>
              <BarChart3 size={18} aria-hidden />
              <span className="hidden sm:inline">{mo('reports')}</span>
            </button>
          )}
          <button className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-sunken" onClick={() => nav('/goods/setup')}>
            <Settings size={18} aria-hidden />
            {ss('open')}
          </button>
            <span className="hidden lg:block"><Button icon={Plus} onClick={() => setSheet('record')}>{r('record')}</Button></span>
          </span>
        </div>

        {chips && (chips.late > 0 || chips.toConfirm > 0 || chips.disputes > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.late > 0 && <button onClick={() => setTab('out')} className="min-h-11 rounded-full bg-danger-tint px-3 text-[14px] font-semibold text-danger">{s('chip_late', { n: chips.late })}</button>}
            {chips.toConfirm > 0 && <button onClick={() => setTab('coming')} className="min-h-11 rounded-full bg-accent-tint px-3 text-[14px] font-semibold text-accent-ink">{s('chip_confirm', { n: chips.toConfirm })}</button>}
            {chips.disputes > 0 && (
              <button onClick={async () => { setDisputes((await api.get<{ disputes: DisputeRow[] }>('/api/sc/disputes')).disputes); setSheet('disputes'); }} className="min-h-11 rounded-full bg-danger-tint px-3 text-[14px] font-semibold text-danger">
                {s('chip_dispute', { n: chips.disputes })}
              </button>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-sunken p-1 lg:max-w-[560px]" role="tablist">
          {(['out', 'in', 'coming'] as Tab[]).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={clsx('flex min-h-11 items-center justify-center rounded-full px-2 py-1 text-center text-[14px] font-semibold leading-tight transition-colors', tab === k ? 'bg-surface text-primary shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink-2')}>
              {s(`tab_${k}` as 'tab_out')}
            </button>
          ))}
        </div>
      </header>

      <OutboxBar staleAt={staleAt} onSent={onSent} />
      {home?.role === 'owner' && <WorkCard />}
      <LinkBanners owner={home?.role === 'owner'} onChange={() => void load()} />

      {tab === 'in' && (othersCount > 0 || sub === 'others') && (
        <div className="mx-4 mt-3 inline-flex gap-1 rounded-full bg-sunken p-1" role="tablist">
          {(['mine', 'others'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={sub === k} onClick={() => { setSub(k); try { localStorage.setItem('cc_goods_sub', k); } catch { /* convenience */ } }}
              className={clsx('min-h-10 rounded-full px-4 text-[14px] font-semibold', sub === k ? 'bg-surface text-primary shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink-2')}>
              {wk(k)}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-4 rounded-[16px] bg-danger-tint px-4 py-3 text-[14px] text-danger">
          {s('error')}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void load()}>{s('retry')}</Button>
        </div>
      )}

      {list === null && !error ? (
        <div className="mx-4 mt-4 space-y-3" aria-busy>
          {[0, 1, 2].map((i) => <div key={i} className="h-[84px] animate-pulse rounded-[18px] bg-sunken" />)}
        </div>
      ) : list && list.length === 0 && !(tab === 'coming' && (toConfirm.length || unmatched.length)) && !(tab === 'in' && sub === 'others') ? (
        <section className="mx-4 mt-5">
          <p className="font-head text-[18px] font-semibold text-ink">{s(empty[tab][0])}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{s(empty[tab][1])}</p>
          <div className="mt-6 rounded-[18px] border border-line bg-surface px-4 py-4">
            <h2 className="font-head text-[16px] font-semibold text-ink">{s('guide_title')}</h2>
            <ol className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink-2">
              {(['guide_1', 'guide_2', 'guide_3'] as const).map((k, i) => (
                <li key={k} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-[13px] font-semibold text-ink-2 tabular-nums">{i + 1}</span>
                  <span>{s(k)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : tab === 'out' && out ? (
        <>
          <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{out.length === 1 ? r('out_title_one') : r('out_title', { n: out.length })}</h2>
          <div className="mx-4 mt-2 hidden overflow-hidden rounded-[18px] border border-line bg-surface lg:block">
            <table className="w-full text-left text-[14.5px]">
              <thead className="bg-sunken text-[13px] text-ink-2">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{r('col_unit')}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{r('col_with_them')}</th>
                  <th className="px-4 py-2.5 font-semibold">{r('col_what')}</th>
                  <th className="px-4 py-2.5 font-semibold">{r('col_since')}</th>
                  <th className="px-4 py-2.5 font-semibold">{r('col_expected')}</th>
                  <th className="px-4 py-2.5 font-semibold">{r('col_status')}</th>
                </tr>
              </thead>
              {out.map((row) => (
                <tbody key={`${row.party.k}:${row.party.id}`} className="cursor-pointer border-t border-line hover:bg-sunken" onClick={() => nav(`/goods/party/${row.party.k}/${row.party.id}`)}>
                  {row.jobs.map((j, i) => (
                    <tr key={j.id} className="align-top">
                      {i === 0 && <td rowSpan={row.jobs.length} className="px-4 py-3 font-semibold text-ink"><button className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); nav(`/goods/party/${row.party.k}/${row.party.id}`); }}>{row.name}</button></td>}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-head font-bold tabular-nums text-ink">{j.outputs > 0 ? `${r('approx')} ` : ''}{fmtQty(j.pending, j.dim)}</td>
                      <td className="px-4 py-3 text-ink">{j.inputLabel}{j.pendingAsOutput !== null && j.outputLabel ? <span className="block text-[13px] text-meta">{r('to_come', { qty: `${r('approx')} ${fmtQty(j.pendingAsOutput, j.dim)}` })}</span> : null}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-2">{shortDate(j.since, lang)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-2">{shortDate(j.expected_at, lang)}</td>
                      <td className="px-4 py-3">{j.cancelled ? <span className="inline-flex rounded-full bg-danger-tint px-2.5 py-1 text-[12.5px] font-semibold text-danger">{jb('st_stopped')}</span> : j.held ? <span className="inline-flex rounded-full bg-accent-tint px-2.5 py-1 text-[12.5px] font-semibold text-accent-ink">{wk('held')}</span> : j.ready && j.late?.status !== 'late' ? <span className="inline-flex rounded-full bg-primary-tint px-2.5 py-1 text-[12.5px] font-semibold text-primary">{wk('ready')}</span> : <Status late={j.late} />}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface lg:hidden">
            {out.map((row) => (
              <li key={`${row.party.k}:${row.party.id}`}>
                <button className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-sunken" onClick={() => nav(`/goods/party/${row.party.k}/${row.party.id}`)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold text-ink">{row.name}</span>
                    {row.jobs.some((j) => j.cancelled) ? <span className="mt-1 inline-flex rounded-full bg-danger-tint px-2.5 py-1 text-[12.5px] font-semibold text-danger">{jb('st_stopped')}</span> : row.jobs.some((j) => j.held) ? <span className="mt-1 inline-flex rounded-full bg-accent-tint px-2.5 py-1 text-[12.5px] font-semibold text-accent-ink">{wk('held')}</span> : row.jobs.some((j) => j.ready) && row.status.status !== 'late' ? <span className="mt-1 inline-flex rounded-full bg-primary-tint px-2.5 py-1 text-[12.5px] font-semibold text-primary">{wk('ready')}</span> : <Status late={row.status} className="mt-1" />}
                    {row.jobs.map((j) => (
                      <span key={j.id} className="mt-1.5 block text-[15px] text-ink">
                        <span className="font-head font-bold tabular-nums">{j.outputs > 0 ? `${r('approx')} ` : ''}{fmtQty(j.pending, j.dim)}</span> {j.inputLabel}
                        <span className="block text-[13px] text-meta">
                          {r('since', { date: shortDate(j.since, lang) })} · {r('expected_on', { date: shortDate(j.expected_at, lang) })}
                          {j.pendingAsOutput !== null && j.outputLabel ? ` · ${r('to_come', { qty: `${r('approx')} ${fmtQty(j.pendingAsOutput, j.dim)}` })}` : ''}
                        </span>
                      </span>
                    ))}
                  </span>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-meta" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : tab === 'coming' && coming ? (
        <>
        {toConfirm.length > 0 && (
          <>
            <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{t2('to_confirm')}</h2>
            <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {toConfirm.map((c) => (
                <li key={c.movementId}>
                  <button className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-sunken" onClick={() => nav(`/goods/movement/${c.movementId}`)}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold text-ink">{c.name}</span>
                      <span className="mt-1 inline-flex items-center rounded-full bg-accent-tint px-2.5 py-1 text-[12.5px] font-semibold text-accent-ink">{t2('badge_check')}</span>
                      {c.lines.map((l) => (
                        <span key={l.line_id} className="mt-1 block text-[14.5px] text-ink"><span className="font-head font-bold tabular-nums">{fmtQty(l.sent, l.dim)}</span> {l.label}</span>
                      ))}
                      <span className="block text-[13px] text-meta">{r(`a_${c.action}` as 'a_send_for_work')} · {shortDate(c.business_date, lang)}{c.dc_no ? ` · DC ${c.dc_no}` : ''}</span>
                    </span>
                    <ChevronRight size={18} className="mt-1 shrink-0 text-meta" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {unmatched.length > 0 && (
          <>
            <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{t2('waiting_them')}</h2>
            <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {unmatched.map((u) => (
                <li key={u.id} className="px-4 py-3">
                  <p className="text-[15.5px] font-semibold text-ink">{u.from}</p>
                  {u.lines.map((l, i) => <p key={i} className="text-[14.5px] text-ink"><span className="font-head font-bold tabular-nums">{fmtQty(l.qty, l.dim)}</span> {l.label_en}</p>)}
                  <p className="text-[13px] text-meta">{t2('waiting_hint', { name: u.from })}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        {coming.length > 0 && <ul className="mx-4 mt-5 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
          {coming.map((j) => (
            <li key={j.id} className="px-4 py-3.5">
              <p className="text-[15.5px] font-semibold text-ink">{j.name}</p>
              <Status late={j.late} className="mt-1" />
              <p className="mt-1.5 text-[15px] text-ink">
                <span className="font-head font-bold tabular-nums">{r('approx')} {fmtQty(j.pendingAsOutput ?? j.pending, j.dim)}</span> {j.outputLabel ?? j.inputLabel}
              </p>
              <p className="text-[13px] text-meta">{r('expected_on', { date: shortDate(j.expected_at, lang) })}{j.pendingAsOutput !== null ? ` · ${r('est_note', { pct: j.lossNormPct })}` : ''}</p>
              <Button size="sm" variant="tint" icon={ArrowDown} className="mt-2" onClick={() => nav(`/goods/job/${j.id}/return`)}>{r('back_btn')}</Button>
            </li>
          ))}
        </ul>}
        </>
      ) : tab === 'in' && sub === 'others' ? (
        <Others onCount={setOthersCount} />
      ) : tab === 'in' && mine ? (
        <>
          <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{r('mine_title')}</h2>
          <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {mine.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <p className="text-[15.5px] font-semibold text-ink">{m.label}</p>
                <p className="mt-0.5 text-[15px] text-ink"><span className="font-head font-bold tabular-nums">{fmtQty(m.qty, m.dim)}</span>{m.grade !== 'A' ? ` · ${r(`g_${m.grade}` as 'g_B')}` : ''}</p>
                <p className="text-[13px] text-meta">{[m.place, m.lot ? `Lot ${m.lot}` : null].filter(Boolean).join(' · ')}</p>
                {/* Goods that have left (on the way) or are in question are still mine on the books, but not "here": say so. */}
                {m.state === 'in_transit' && <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent-tint px-2.5 py-0.5 text-[13px] font-semibold text-accent-ink"><Clock size={14} aria-hidden />{s('st_in_transit')}</p>}
                {m.state === 'disputed' && <button onClick={() => setSheet('disputes')} className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-danger-tint px-2.5 py-0.5 text-[13px] font-semibold text-danger"><AlertTriangle size={14} aria-hidden />{s('st_disputed')}</button>}
                {m.state && /^held/.test(m.state) && <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-0.5 text-[13px] font-semibold text-ink-2"><Pause size={14} aria-hidden />{s('st_held')}</p>}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(61px+var(--safe-bottom))] z-20 mx-auto w-full max-w-[480px] border-t border-line bg-surface px-4 py-2.5 lg:hidden">
        <Button block size="lg" icon={Plus} onClick={() => setSheet('record')}>{r('record')}</Button>
      </div>

      {(toast || toastText) && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(140px+var(--safe-bottom))] z-40 mx-auto flex w-[calc(100%-32px)] max-w-[448px] items-center lg:inset-x-auto lg:bottom-8 lg:right-8 lg:mx-0 lg:w-[420px] gap-3 rounded-[18px] bg-ink px-4 py-3 text-[14px] text-white shadow-[var(--shadow-float)]">
          <span className="min-w-0 flex-1">{toastText}</span>
          {toast && (
            <>
              <button className="inline-flex min-h-9 items-center rounded-full px-2 font-semibold text-primary-soft" onClick={async () => { await api.post(`/api/sc/movements/${toast.id}/share-now`); setToast(null); setToastText(r('shared')); setTimeout(() => setToastText(null), 2500); }}>
                {r('share_now')}
              </button>
              <button className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 font-semibold text-primary-soft" onClick={() => void undo()}>
                <Repeat size={16} aria-hidden />
                {r('undo')}
              </button>
            </>
          )}
        </div>
      )}

      <Sheet open={sheet === 'record'} onClose={() => setSheet(null)} title={r('what_happened')}>
        <div className="space-y-4 pb-2">
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink-2">{r('went_out')}</h3>
            <button className="flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3 text-left hover:bg-sunken" onClick={() => nav('/goods/record/send')}>
              <ArrowRight size={22} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-ink">{r('send')}</span><span className="block text-[13px] text-meta">{r('send_hint')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/sell')}>
              <ArrowRight size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_sell')}</span><span className="block text-[12.5px] text-meta">{tr('h_sell')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/return_to_supplier')}>
              <ArrowRight size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_return_to_supplier')}</span><span className="block text-[12.5px] text-meta">{tr('h_return_to_supplier')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/sample')}>
              <ArrowRight size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_sample')}</span><span className="block text-[12.5px] text-meta">{tr('h_sample')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/returnable_sample')}>
              <ArrowRight size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_returnable_sample')}</span><span className="block text-[12.5px] text-meta">{tr('h_returnable_sample')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/move')}>
              <ArrowRight size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_move')}</span><span className="block text-[12.5px] text-meta">{tr('h_move')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
          </section>
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink-2">{r('came_in')}</h3>
            <button className="flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3 text-left hover:bg-sunken" onClick={() => void openPickJob()}>
              <ArrowDown size={22} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-ink">{r('got_back')}</span><span className="block text-[13px] text-meta">{r('got_back_hint')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3 text-left hover:bg-sunken" onClick={() => nav('/goods/record/receive-first')}>
              <ArrowDown size={22} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-ink">{t2('received_first')}</span><span className="block text-[13px] text-meta">{t2('received_first_hint')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/buy')}>
              <ArrowDown size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_buy')}</span><span className="block text-[12.5px] text-meta">{tr('h_buy')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/buyer_returned')}>
              <ArrowDown size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_buyer_returned')}</span><span className="block text-[12.5px] text-meta">{tr('h_buyer_returned')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/record/t/collect')}>
              <ArrowDown size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('t_collect')}</span><span className="block text-[12.5px] text-meta">{tr('h_collect')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
          </section>
          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink-2">{tr('inside')}</h3>
            <button className="flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3 text-left hover:bg-sunken" onClick={() => nav('/goods/record/made')}>
              <Scissors size={22} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-ink">{jb('made')}</span><span className="block text-[13px] text-meta">{jb('made_hint')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/adjust')}>
              <SlidersHorizontal size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('stock')}</span><span className="block text-[12.5px] text-meta">{tr('stock_hint')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
            <button className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left hover:bg-sunken" onClick={() => nav('/goods/adjust?fire=1')}>
              <AlertTriangle size={20} className="shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-[15.5px] font-semibold text-ink">{tr('fire')}</span><span className="block text-[12.5px] text-meta">{tr('fire_hint')}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
          </section>
        </div>
      </Sheet>

      <Sheet open={sheet === 'disputes'} onClose={() => setSheet(null)} title={t2('dispute')}>
        <ul className="mb-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
          {(disputes ?? []).map((d) => (
            <li key={d.id}>
              <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/dispute/${d.id}`)}>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{d.line_label}</span><span className="block text-[13px] text-meta">{t2('diff')} {fmtQty(Math.abs(d.difference), d.dim)}</span></span>
                <ChevronRight size={18} className="text-meta" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={sheet === 'pick_job'} onClose={() => setSheet(null)} title={r('pick_job')}>
        <div className="pb-2">
          {!coming?.length ? (
            <p className="text-[15px] text-ink-2">{r('no_open_jobs')}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {coming.map((j) => (
                <li key={j.id}>
                  <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/job/${j.id}/return`)}>
                    <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{j.name}</span><span className="block text-[13px] text-meta">{j.inputLabel} · {r('since', { date: shortDate(j.since, lang) })}</span></span>
                    <ChevronRight size={18} className="text-meta" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  );
}
