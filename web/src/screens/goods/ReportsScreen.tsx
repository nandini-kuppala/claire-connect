// Reports (slice 8a, 03 S13–S14): bills and dues per party, how units are doing, and the GST clock. Owner only.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText, getToken } from '../../lib/api';
import { ArrowLeft, ChevronRight, Upload, AlertTriangle } from '../../icons';
import { useSession } from '../../store/session';
import { Money3S, MoneyS, inr } from './Money.strings';
import { shortDate } from './format';

export interface Bal { party: { k: 'b' | 'c'; id: string }; name: string; i_owe: number; they_owe: number; paid: number; received: number; setoff: number; balance_i_owe: number; balance_they_owe: number; net: number; oldest_unpaid_days: number | null; unpriced: number }
interface Perf { party: { k: string; id: string }; name: string; process: string; process_label: string; n: number; enough: boolean; median_days: number | null; promised_days: number | null; excluded_days: number; excluded_why: string[]; loss_pct: number | null; loss_norm_pct: number | null; best_loss_pct: number | null; rejects_pct: number | null; disputes: number }
interface Gst { job_id: string; name: string; label: string; days: number; due_by: string }
interface Due { party: { k: 'b' | 'c'; id: string }; name: string; side: 'they_owe' | 'i_owe'; overdue_paise: number; oldest_date: string; days: number; credit_days: number }

/** CSV comes from an authenticated route, so it's fetched and handed to the browser as a file. */
export async function downloadCsv(name: 'bills' | 'performance') {
  const r = await fetch(`/api/sc/reports/${name}.csv`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsScreen() {
  const m = MoneyS.use();
  const m3 = Money3S.use();
  const [dues, setDues] = useState<Due[]>([]);
  const loadDues = () => void api.get<{ rows: Due[] }>('/api/sc/reminders').then((x) => setDues(x.rows)).catch(() => undefined);
  const snooze = (d: Due) => void api.post(`/api/sc/reminders/${d.party.k}/${d.party.id}/snooze`, { days: 7 }).then(loadDues).catch((e) => setError(errorText(e)));
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'performance' ? 'performance' : 'bills';
  const lang = useSession((st) => st.user?.language || 'en');
  const [bills, setBills] = useState<Bal[] | null>(null);
  const [perf, setPerf] = useState<Perf[] | null>(null);
  const [gst, setGst] = useState<Gst[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (tab === 'bills') void api.get<{ parties: Bal[] }>('/api/sc/bills').then((x) => setBills(x.parties)).catch((e) => setError(errorText(e)));
    else void api.get<{ rows: Perf[] }>('/api/sc/reports/performance').then((x) => setPerf(x.rows)).catch((e) => setError(errorText(e)));
  }, [tab]);
  useEffect(() => { void api.get<{ rows: Gst[] }>('/api/sc/reports/gst').then((x) => setGst(x.rows)).catch(() => undefined); loadDues(); }, []);

  const why = (w: string) => (w === 'held_for_dues' ? m('held_for_dues') : m('paused'));
  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav('/goods')} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="flex-1 font-head text-[20px] font-bold text-ink">{m('reports')}</h1>
        <button className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-sunken" onClick={() => void downloadCsv(tab).catch((e) => setError(errorText(e)))}>
          <Upload size={17} aria-hidden />{m('download')}
        </button>
      </header>

      <div className="px-4 pt-4 lg:max-w-[880px]">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1 lg:max-w-[520px]" role="tablist">
          {(['bills', 'performance'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'bills' ? {} : { tab: k }, { replace: true })}
              className={clsx('min-h-11 rounded-full px-2 text-[14.5px] font-semibold leading-tight', tab === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-2')}>{m(k)}</button>
          ))}
        </div>

        {gst.length > 0 && (
          <section className="mt-4 rounded-[18px] border border-accent/40 bg-accent-tint px-4 py-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-accent-ink"><AlertTriangle size={18} aria-hidden />{m('gst')}</h2>
            <p className="mt-1 text-[13px] text-ink-2">{m('gst_hint')}</p>
            <ul className="mt-2 space-y-1 text-[14px] text-ink">
              {gst.slice(0, 8).map((g) => <li key={g.job_id}><button className="text-left underline-offset-2 hover:underline" onClick={() => nav(`/goods/job/${g.job_id}`)}>{m('gst_line', { label: g.label, name: g.name, days: g.days, due: shortDate(g.due_by, lang) })}</button></li>)}
            </ul>
          </section>
        )}
        {error && <p role="alert" className="mt-4 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}

        {tab === 'bills' && (
          <>
            {dues.length > 0 && (
              <section className="mt-4 rounded-[18px] border border-accent/40 bg-accent-tint px-4 py-3">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-accent-ink"><AlertTriangle size={18} aria-hidden />{m3('due_title')}</h2>
                <ul className="mt-1 divide-y divide-accent/20">
                  {dues.slice(0, 12).map((d) => (
                    <li key={`${d.party.k}:${d.party.id}:${d.side}`} className="flex items-center gap-2 py-1.5">
                      <button className="min-h-11 min-w-0 flex-1 text-left text-[14px] text-ink underline-offset-2 hover:underline" onClick={() => nav(`/goods/reports/bills/${d.party.k}/${d.party.id}`)}>
                        {d.side === 'they_owe' ? m3('due_they', { name: d.name, amt: inr(d.overdue_paise), days: d.days, credit: d.credit_days }) : m3('due_me', { name: d.name, amt: inr(d.overdue_paise), days: d.days, credit: d.credit_days })}
                      </button>
                      <button className="min-h-11 shrink-0 rounded-full px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-surface" onClick={() => snooze(d)}>{m3('snooze')}</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="mt-4 text-[13px] text-meta">{m('record_only')}</p>
            {bills && bills.length === 0 && <p className="mt-3 text-[14.5px] text-ink-2">{m('no_bills')}</p>}
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {(bills ?? []).map((b) => (
                <li key={`${b.party.k}:${b.party.id}`}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/reports/bills/${b.party.k}/${b.party.id}`)}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-[15.5px] font-semibold text-ink">{b.name}</span>
                        <span className={clsx('shrink-0 font-head text-[16px] font-bold tabular-nums', b.net > 0 ? 'text-success' : b.net < 0 ? 'text-accent-ink' : 'text-meta')}>{b.net === 0 ? m('settled') : inr(Math.abs(b.net))}</span>
                      </span>
                      <span className="block text-[13px] text-meta">
                        {[b.net > 0 ? m('they_owe') : b.net < 0 ? m('i_owe') : null, b.oldest_unpaid_days !== null ? m('oldest', { n: b.oldest_unpaid_days }) : null, b.unpriced ? m('unpriced', { n: b.unpriced }) : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'performance' && (
          <>
            <p className="mt-4 text-[13px] text-meta">{m('perf_hint')}</p>
            {perf && perf.length === 0 && <p className="mt-3 text-[14.5px] text-ink-2">{m('no_perf')}</p>}
            <ul className="mt-2 space-y-2">
              {(perf ?? []).map((p) => (
                <li key={`${p.party.k}:${p.party.id}:${p.process}`} className="rounded-[18px] border border-line bg-surface px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15.5px] font-semibold text-ink">{p.name}</span>
                    <span className="shrink-0 text-[13px] text-meta">{p.process_label} · {m('jobs', { n: p.n })}</span>
                  </div>
                  {!p.enough ? <p className="mt-1 text-[14px] text-ink-2">{m('not_enough', { n: p.n })}</p> : (
                    <ul className="mt-1 space-y-0.5 text-[14px] text-ink-2">
                      <li className={clsx(p.median_days !== null && p.promised_days !== null && p.median_days > p.promised_days && 'font-semibold text-accent-ink')}>{m('days', { d: p.median_days ?? '—', p: p.promised_days ?? '—' })}</li>
                      {p.excluded_days > 0 && <li className="text-meta">{m('excluded', { n: p.excluded_days, why: p.excluded_why.map(why).join(', ') })}</li>}
                      {p.loss_pct !== null && <li className={clsx(p.loss_norm_pct !== null && p.loss_pct > p.loss_norm_pct && 'font-semibold text-accent-ink')}>{m('loss', { x: p.loss_pct, norm: p.loss_norm_pct ?? '—', best: p.best_loss_pct ?? '—' })}</li>}
                      {!!p.rejects_pct && <li>{m('rejects', { x: p.rejects_pct })}</li>}
                      {p.disputes > 0 && <li>{m('disputes', { n: p.disputes })}</li>}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
