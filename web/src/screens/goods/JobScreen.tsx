// Job detail (03 S7): for this piece of work, where did every unit go? Close it, reopen it, or stop it (V).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, ApiError, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowDown, ArrowLeft, Check, ChevronRight, Lock, Repeat } from '../../icons';
import { useSession } from '../../store/session';
import { JobS } from './Job.strings';
import { TradeS } from './Trade.strings';
import { PartyPicker } from './PartyPicker';
import { clientId } from './format';
import type { Party } from './types';
import { RecS } from './Record.strings';
import { Status, type Late } from './Status';
import { qty as fmtQty, shortDate } from './format';

type Dim = 'mass' | 'count' | 'length';
interface Seg { kind: string; qty: number; grade?: string; approx?: boolean }
interface Detail {
  job: { id: string; process: Record<string, string> | null; kind: string; status: string; in_house: boolean; cancelled: boolean; performerName: string | null; since: string; expected_at: string; closed_at: number | null; late: Late | null; ready: boolean; held: string | null; loss_norm_pct: number };
  dim: Dim; issued: number; segments: Seg[]; pending: number;
  inputs: { spec_id: string; label: string; lot: string | null; dim: Dim; role: string; sent: number; issued: number }[];
  grid: { label: string; dim: Dim; grades: Record<string, number>; via_sub: number }[];
  children: { kind: 'sub' | 'hop' | 'rework' | 'sold'; id: string; name: string; sent: number; status: string; since: string; outputs: Record<string, number> }[];
  disputes: { id: string; label: string; difference: number; dim: Dim }[];
  closure: { business_date: string; residual: number; loss: number; loss_pct: number | null; unchecked: boolean; accepted: boolean; carried_claims: string[]; auto: string | null } | null;
  adjustments: { label: string; qty: number; unit: string; rate_paise: number; amount_paise: number; date: string }[];
  billChange: { from_paise: number; to_paise: number; business_date: string } | null;
  reopens: { business_date: string; reason: string; auto: boolean }[];
  reclose_failed: { reason: string } | null;
  canClose: boolean; canReopen: boolean; canSellPart: boolean;
}
interface Preview {
  needs: { shortage: number; highLoss: number | null; unexplained: number | null };
  lines: { row_id: string; label: string; dim: Dim; role: string; consumed: number; units: string[] }[];
  disputes: { id: string; label: string; difference: number; dim: Dim }[];
}
type Disp = 'used' | 'kept_adjusted' | 'kept_for_next' | 'scrapped';

// Segment fills: colour is never the only signal (each segment is named with its number below the bar).
const FILL: Record<string, string> = {
  A: 'bg-success', B: 'bg-success/60', rework: 'bg-accent', reject: 'bg-danger/70', scrap: 'bg-danger/50', output_est: 'bg-success',
  unprocessed: 'bg-ink-2/40', sent_on: 'bg-teal/60', sold: 'bg-marigold/70', lost: 'bg-ink', loss: 'bg-clay', gain: 'bg-clay/50', unaccounted: 'bg-danger', still_there: 'bg-primary-soft',
};
const inr = (paise: number) => `${Math.round(paise / 100).toLocaleString('en-IN')}`;

export default function JobScreen() {
  const s = JobS.use();
  const tr = TradeS.use();
  const r = RecS.use();
  const nav = useNavigate();
  const { id } = useParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'close' | 'reopen' | 'sell' | null>(null);
  const [buyer, setBuyer] = useState<Party | null>(null);
  const [buyerPick, setBuyerPick] = useState(false);
  const [sellQty, setSellQty] = useState<Record<string, string>>({});
  const [pv, setPv] = useState<Preview | null>(null);
  const [left, setLeft] = useState<Record<string, { qty: string; disp: Disp; rate: string }>>({});
  const [carry, setCarry] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.get<Detail>(`/api/sc/jobs/${id}/detail`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  const openClose = async () => {
    setAsk(null);
    setCarry(false);
    setLeft({});
    setPv(await api.get<Preview>(`/api/sc/jobs/${id}/close-preview`));
    setSheet('close');
  };
  const doClose = async (accept = false) => {
    if (!pv) return;
    setBusy(true);
    try {
      const leftovers = Object.entries(left)
        .filter(([, v]) => v.disp !== 'used' && Number(v.qty) > 0)
        .map(([row_id, v]) => ({ row_id, qty: Number(v.qty), unit: pv.lines.find((l) => l.row_id === row_id)?.units[0] ?? 'pcs', disposition: v.disp, ...(v.disp === 'kept_adjusted' && Number(v.rate) > 0 ? { rate_paise: Math.round(Number(v.rate) * 100) } : {}) }));
      await api.post(`/api/sc/jobs/${id}/close`, { leftovers, accept, carry_claim: carry });
      setSheet(null);
      setToast(s('closed_done'));
      setTimeout(() => setToast(null), 2500);
      await load();
    } catch (e) {
      const body = (e as ApiError).body as { code?: string; shortage?: number; highLoss?: number | null; unexplained?: number | null } | undefined;
      if (e instanceof ApiError && body?.code === 'unaccounted') {
        setAsk(
          body.shortage ? s('shortage_q', { qty: fmtQty(body.shortage, d!.dim), name: d!.job.performerName ?? '' })
            : body.highLoss != null ? s('high_loss_q', { pct: body.highLoss, norm: d!.job.loss_norm_pct })
              : s('unexplained_q', { qty: fmtQty(Math.abs(body.unexplained ?? 0), d!.dim) }),
        );
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!d) {
    return (
      <div className="px-4 pt-6">
        {error ? <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p> : <div className="h-40 animate-pulse rounded-[18px] bg-sunken" aria-busy />}
      </div>
    );
  }
  const j = d.job;
  const open = j.status !== 'closed';
  const total = d.segments.reduce((a, x) => a + x.qty, 0) || 1;
  const segLabel = (x: Seg) => (x.kind === 'output' ? s(`seg_${x.grade ?? 'A'}` as 'seg_A') : s(`seg_${x.kind}` as 'seg_loss'));
  const statusText = j.cancelled && open ? s('st_stopped') : s(`st_${j.status}` as 'st_closed');

  return (
    <div className="pb-32 lg:pb-10">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-head text-[20px] font-bold leading-tight text-ink">{j.in_house ? s('made') : j.performerName}</h1>
          <p className="text-[13px] text-meta">{[j.process?.[lang] ?? j.process?.en, statusText].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-start lg:gap-x-2">
        <section className="lg:col-start-1">
          <div className="mx-4 mt-4 rounded-[18px] border border-line bg-surface px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {j.status === 'closed' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[12.5px] font-semibold text-ink-2"><Lock size={13} aria-hidden />{s('st_closed')}</span>
              ) : j.cancelled ? (
                <span className="rounded-full bg-danger-tint px-2.5 py-1 text-[12.5px] font-semibold text-danger">{s('st_stopped')}</span>
              ) : j.late ? <Status late={j.late} /> : null}
              <span className="text-[13px] text-meta">
                {j.in_house ? s('made_on', { date: shortDate(j.since, lang) }) : s('sent_on', { date: shortDate(j.since, lang) })}
                {d.closure && !j.in_house ? ` · ${s('closed_on', { date: shortDate(d.closure.business_date, lang) })}` : ''}
                {open && !j.cancelled ? ` · ${r('expected_on', { date: shortDate(j.expected_at, lang) })}` : ''}
              </span>
            </div>
            {j.cancelled && open && <p className="mt-2 text-[14px] text-ink-2">{s('stopped_note')}</p>}

            <h2 className="mt-4 text-[13px] font-semibold text-ink-2">{s('where')} · {s('of', { qty: fmtQty(d.issued, d.dim) })}</h2>
            <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label={d.segments.map((x) => `${fmtQty(x.qty, d.dim)} ${segLabel(x)}`).join(', ')}>
              {d.segments.map((x, i) => (
                <span key={i} className={clsx('h-full', FILL[x.kind === 'output' ? x.grade ?? 'A' : x.kind], x.approx && 'opacity-70', i > 0 && 'border-l-2 border-surface')} style={{ width: `${(x.qty / total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-2.5 space-y-1 text-[14.5px]">
              {d.segments.map((x, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className={clsx('mt-1 size-2.5 shrink-0 rounded-[3px]', FILL[x.kind === 'output' ? x.grade ?? 'A' : x.kind])} aria-hidden />
                  <span className="font-head font-bold tabular-nums text-ink">{x.approx ? `${r('approx')} ` : ''}{fmtQty(x.qty, d.dim)}</span>
                  <span className={clsx('text-ink-2', x.kind === 'unaccounted' && 'font-semibold text-danger')}>{segLabel(x)}</span>
                </li>
              ))}
            </ul>
            {d.closure?.unchecked && <p className="mt-2 text-[13px] text-meta">{s('unchecked')}</p>}
            {d.closure && d.closure.carried_claims.length > 0 && <p className="mt-2 text-[13px] text-accent-ink">{s('carried', { n: d.closure.carried_claims.length })}</p>}
          </div>

          {d.disputes.length > 0 && (
            <>
              <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{s('open_diffs')}</h2>
              <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {d.disputes.map((x) => (
                  <li key={x.id}>
                    <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/dispute/${x.id}`)}>
                      <span className="min-w-0 flex-1 text-[15px] text-ink">{x.label} · <span className="tabular-nums">{fmtQty(Math.abs(x.difference), x.dim)}</span></span>
                      <ChevronRight size={18} className="text-meta" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {d.grid.length > 0 && (
            <>
              <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{s('what_came')}</h2>
              <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {d.grid.map((g) => (
                  <li key={g.label} className="px-4 py-3">
                    <p className="text-[15px] font-semibold text-ink">{g.label}</p>
                    <p className="mt-0.5 text-[14px] text-ink-2">
                      {Object.entries(g.grades).map(([gr, q]) => `${fmtQty(q, g.dim)} ${s(`seg_${gr}` as 'seg_A')}`).join(' · ')}
                    </p>
                    {g.via_sub > 0 && <p className="text-[12.5px] text-meta">{s('via_sub', { qty: fmtQty(g.via_sub, g.dim) })}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="lg:col-start-2 lg:row-start-1">
          <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink lg:mt-4">{s('what_went')}</h2>
          <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {d.inputs.map((i, k) => (
              <li key={k} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[14.5px]">
                <span className="min-w-0 text-ink">{i.label}{i.lot ? <span className="whitespace-nowrap text-meta"> · {s('lot')} {i.lot}</span> : null}{i.role === 'secondary' ? <span className="text-meta"> · {s('trims')}</span> : null}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{fmtQty(i.issued, i.dim)}</span>
              </li>
            ))}
          </ul>

          {d.children.length > 0 && (
            <>
              <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{s('sent_on_title')}</h2>
              <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {d.children.map((c) => (
                  <li key={c.id} className="px-4 py-3 text-[14.5px]">
                    <p className="font-semibold text-ink">{s(`k_${c.kind}` as 'k_sub')} · {c.name}</p>
                    <p className="text-ink-2"><span className="tabular-nums">{fmtQty(c.sent, d.dim)}</span> · {shortDate(c.since, lang)}{Object.keys(c.outputs).length ? ` → ${Object.entries(c.outputs).map(([g, q]) => `${fmtQty(q, d.dim)} ${s(`seg_${g}` as 'seg_A')}`).join(' · ')}` : ''}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(d.adjustments.length > 0 || d.billChange) && (
            <>
              <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{s('bill')}</h2>
              <ul className="mx-4 mt-2 space-y-1 rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] text-ink">
                {d.adjustments.map((a, k) => (
                  <li key={k}>
                    {s('kept_line', { label: a.label, qty: a.qty, unit: a.unit, rate: inr(a.rate_paise), amount: inr(a.amount_paise) })}
                    <span className="text-meta"> · {shortDate(a.date, lang)}</span>
                  </li>
                ))}
                {d.billChange && <li className="text-ink-2">{s('bill_change', { date: shortDate(d.billChange.business_date, lang), from: inr(d.billChange.from_paise), to: inr(d.billChange.to_paise) })}</li>}
              </ul>
            </>
          )}

          {(d.reopens.length > 0 || d.reclose_failed) && (
            <>
              <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{s('changes')}</h2>
              <ul className="mx-4 mt-2 space-y-1.5 rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px] text-ink-2">
                {d.reopens.map((x, k) => (
                  <li key={k} className="flex items-start gap-2"><Repeat size={15} className="mt-0.5 shrink-0 text-meta" aria-hidden />
                    <span>{s('reopened', { date: shortDate(x.business_date, lang), reason: x.auto ? s(`r_${x.reason}` as 'r_late_receipt') : x.reason })}{x.auto && k === d.reopens.length - 1 && j.status === 'closed' ? ` · ${s('again')}` : ''}</span>
                  </li>
                ))}
                {d.reclose_failed && <li className="text-danger">{s('reclose_failed', { reason: d.reclose_failed.reason })}</li>}
              </ul>
            </>
          )}

          {d.canClose && (
            <div className="mx-4 mt-5 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={async () => { await api.post(`/api/sc/jobs/${id}/cancel`, { on: !j.cancelled }); await load(); }}>{j.cancelled ? s('resume') : s('stop')}</Button>
              {d.canSellPart && <Button variant="ghost" onClick={() => { setBuyer(null); setSellQty({}); setSheet('sell'); }}>{tr('sell_part')}</Button>}
            </div>
          )}
          {error && <p className="mx-4 mt-4 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </section>
      </div>

      {(d.canClose || d.canReopen) && (
        <div className="fixed inset-x-0 bottom-[calc(61px+var(--safe-bottom))] z-20 mx-auto flex w-full max-w-[480px] gap-2 border-t border-line bg-surface px-4 py-2.5 lg:static lg:mx-4 lg:mt-6 lg:w-auto lg:max-w-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          {d.canClose && d.pending > 0 && <Button className="flex-1 lg:flex-none" size="lg" icon={ArrowDown} onClick={() => nav(`/goods/job/${id}/return`)}>{r('back_btn')}</Button>}
          {d.canClose && <Button className="flex-1 lg:flex-none" size="lg" variant={d.pending > 0 ? 'secondary' : 'primary'} icon={Check} onClick={() => void openClose()}>{s('close')}</Button>}
          {d.canReopen && <Button className="flex-1 lg:flex-none" size="lg" variant="secondary" icon={Repeat} onClick={() => { setWhy(''); setSheet('reopen'); }}>{s('reopen')}</Button>}
        </div>
      )}

      {toast && <div role="status" className="fixed inset-x-0 bottom-[calc(140px+var(--safe-bottom))] z-40 mx-auto w-[calc(100%-32px)] max-w-[448px] rounded-[18px] bg-ink px-4 py-3 text-[14px] text-white lg:inset-x-auto lg:bottom-8 lg:right-8 lg:w-[420px]">{toast}</div>}

      <Sheet open={sheet === 'close'} onClose={() => setSheet(null)} title={s('close_title')}
        footer={ask
          ? <Button block size="lg" loading={busy} onClick={() => void doClose(true)}>{s('accept')}</Button>
          : <Button block size="lg" loading={busy} disabled={!!pv?.disputes.length && !carry} icon={Lock} onClick={() => void doClose(false)}>{s('close')}</Button>}>
        {pv && (
          <div className="space-y-4 pb-2">
            <p className="text-[14px] text-ink-2">{s('close_hint')}</p>
            {ask && <p className="rounded-[14px] bg-accent-tint px-3 py-2.5 text-[15px] font-semibold text-accent-ink">{ask}</p>}
            {pv.lines.some((l) => l.role === 'secondary' && l.consumed > 0) && (
              <div>
                <h3 className="mb-2 font-head text-[16px] font-semibold text-ink">{s('rest_title')}</h3>
                <ul className="space-y-3">
                  {pv.lines.filter((l) => l.role === 'secondary' && l.consumed > 0).map((l) => {
                    const v = left[l.row_id] ?? { qty: '', disp: 'used' as Disp, rate: '' };
                    const set = (patch: Partial<typeof v>) => setLeft((x) => ({ ...x, [l.row_id]: { ...v, ...patch } }));
                    return (
                      <li key={l.row_id} className="rounded-[16px] border border-line p-3">
                        <p className="text-[15px] font-semibold text-ink">{l.label}</p>
                        <p className="text-[13px] text-meta">{s('left_with', { qty: fmtQty(l.consumed, l.dim) })}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(['used', 'kept_adjusted', 'kept_for_next', 'scrapped'] as Disp[]).map((k) => (
                            <button key={k} onClick={() => set({ disp: k })} className={clsx('min-h-10 rounded-full border px-3 text-[13.5px] font-semibold', v.disp === k ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{s(`d_${k}` as 'd_used')}</button>
                          ))}
                        </div>
                        {v.disp !== 'used' && (
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
                            <label className="flex items-center gap-1.5">{s('how_many_left')}<input className="h-10 w-20 rounded-[12px] border border-line-strong px-2 text-right tabular-nums" inputMode="decimal" value={v.qty} onChange={(e) => set({ qty: e.target.value.replace(/[^\d.]/g, '') })} />{l.units[0]}</label>
                            {v.disp === 'kept_adjusted' && <label className="flex items-center gap-1.5">₹<input className="h-10 w-16 rounded-[12px] border border-line-strong px-2 text-right tabular-nums" inputMode="decimal" value={v.rate} onChange={(e) => set({ rate: e.target.value.replace(/[^\d.]/g, '') })} />{s('rate_each')}</label>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {pv.disputes.length > 0 && (
              <div className="rounded-[16px] bg-danger-tint p-3">
                <p className="text-[14.5px] font-semibold text-danger">{s('diffs_open', { n: pv.disputes.length })}</p>
                <ul className="mt-1 text-[14px] text-ink">{pv.disputes.map((x) => <li key={x.id}>{x.label} · {fmtQty(Math.abs(x.difference), x.dim)}</li>)}</ul>
                <label className="mt-2 flex min-h-11 items-center gap-3 text-[14.5px] font-semibold text-ink">
                  <input type="checkbox" className="size-5" checked={carry} onChange={(e) => setCarry(e.target.checked)} />{s('carry')}
                </label>
                <p className="pl-8 text-[13px] text-ink-2">{s('carry_hint')}</p>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'sell'} onClose={() => setSheet(null)} title={tr('sell_part')}
        footer={<Button block size="lg" loading={busy} disabled={!buyer || !Object.values(sellQty).some((v) => Number(v) > 0)} onClick={async () => {
          setBusy(true);
          try {
            const unitOf = (dim: Dim) => (dim === 'mass' ? 'kg' : dim === 'length' ? 'm' : 'pcs');
            const lines = d.inputs.map((i, k) => ({ i, v: sellQty[k] })).filter((x) => Number(x.v) > 0).map(({ i, v }) => ({ spec_id: i.spec_id, qty: Number(v), unit: unitOf(i.dim), ...(i.lot ? { lot: i.lot } : {}) }));
            await api.post(`/api/sc/jobs/${id}/sell-part`, { to: buyer!.ref, lines, client_id: clientId() });
            setSheet(null);
            await load();
          } catch (e) { setError(errorText(e)); setSheet(null); } finally { setBusy(false); }
        }}>{r('save')}</Button>}>
        <div className="space-y-4 pb-2">
          <p className="text-[14px] text-ink-2">{tr('sell_part_hint', { name: j.performerName ?? '' })}</p>
          <button className="flex min-h-12 w-full items-center rounded-[16px] border border-line-strong bg-surface px-3.5 text-left text-[15px]" onClick={() => setBuyerPick(true)}>{buyer?.name ?? <span className="text-meta">{tr('buyer')}</span>}</button>
          <ul className="space-y-2">
            {d.inputs.map((i, k) => i.role === 'primary' && (
              <li key={k} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-[14.5px] text-ink">{i.label}{i.lot ? <span className="whitespace-nowrap text-meta"> · {s('lot')} {i.lot}</span> : null}</span>
                <input className="h-11 w-24 rounded-[12px] border border-line-strong px-2 text-right tabular-nums" inputMode="decimal" aria-label={i.label} placeholder="0" value={sellQty[k] ?? ''} onChange={(e) => setSellQty((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.]/g, '') }))} />
                <span className="w-8 text-[13px] text-meta">{i.dim === 'mass' ? 'kg' : i.dim === 'length' ? 'm' : 'pcs'}</span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
      <PartyPicker open={buyerPick} onClose={() => setBuyerPick(false)} onPick={setBuyer} />

      <Sheet open={sheet === 'reopen'} onClose={() => setSheet(null)} title={s('reopen_title')}
        footer={<Button block size="lg" loading={busy} disabled={why.trim().length < 2} onClick={async () => { setBusy(true); try { await api.post(`/api/sc/jobs/${id}/reopen`, { reason: why.trim() }); setSheet(null); await load(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }}>{s('reopen')}</Button>}>
        <label className="block pb-2">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('why')}</span>
          <input className="min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary" placeholder={s('why_ph')} value={why} onChange={(e) => setWhy(e.target.value)} />
        </label>
      </Sheet>
    </div>
  );
}
