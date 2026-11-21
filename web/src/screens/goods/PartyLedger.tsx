// Party ledger (03 S2): what is open with this party, what happened, and the terms (owner edits).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, Clock, Phone, Repeat } from '../../icons';
import { useSession } from '../../store/session';
import { RecS } from './Record.strings';
import { TwoS } from './Two.strings';
import { WorkS } from './Work.strings';
import { LinkS } from './Link.strings';
import { PartyPicker } from './PartyPicker';
import type { Party } from './types';
import { SetupS } from './Setup.strings';
import { Status, type Late } from './Status';
import { qty as fmtQty, shortDate } from './format';

interface Job { id: string; process_key: string; status: string; since: string; expected_at: string; late: Late; dim: string; sent: number; issued: number; issuedBasis: string; outputs: number; pending: number; pendingAsOutput: number | null; lossPctSoFar: number | null; lossNormPct: number; inputLabel: string; outputLabel: string | null; lots: string[] }
interface Line { line_id: string; label: string; lot: string | null; grade: string; dim: string; rolls: number | null; sent: number; received: number; their: number | null; settled: { outcome: string; difference: number; pct: number } | null }
interface Hist { id: string; action: string; business_date: string; dc_no: string | null; cancelled: boolean; mine?: boolean; undoable_until: number | null; badge?: { kind: string; why?: string }; lines: Line[] }
interface Ledger { party: { k: string; id: string }; name: { name: string; kind: string; onClaire: boolean; phone?: string | null; sub?: string | null }; open: Job[]; history: Hist[]; role: 'owner' | 'staff' }
interface Terms { weighing_loss_bearer: string; bill_basis: string; tolerance: { weighed_pct: number; counted_abs: number } }

function Badge({ b, name }: { b?: { kind: string; why?: string }; name: string }) {
  const t2 = TwoS.use();
  const s = RecS.use();
  if (!b) return null;
  const text =
    b.kind === 'confirmed_by' ? t2('badge_confirmed_by', { name }) : b.kind === 'confirmed_by_you' ? t2('badge_confirmed_by_you') : b.kind === 'receipt_confirmed' ? t2('badge_receipt_confirmed') : b.kind === 'check_and_confirm' ? t2('badge_check') : b.kind === 'not_confirmed' ? t2('badge_not_confirmed') : s('your_record');
  const cls = b.kind === 'confirmed_by' || b.kind === 'confirmed_by_you' || b.kind === 'receipt_confirmed' ? 'bg-success-tint text-success border-transparent' : b.kind === 'check_and_confirm' ? 'bg-accent-tint text-accent-ink border-transparent' : b.kind === 'not_confirmed' ? 'border-dashed text-meta' : 'text-ink-2';
  return (
    <span className="text-right">
      <span className={clsx('inline-block rounded-full border border-line-strong px-2 py-0.5 text-[12px] font-semibold', cls)}>{text}</span>
      {b.why && <span className="block text-[11.5px] text-meta">{t2(`why_${b.why}` as 'why_no_answer')}</span>}
    </span>
  );
}

export default function PartyLedger() {
  const s = RecS.use();
  const ss = SetupS.use();
  const t2 = TwoS.use();
  const nav = useNavigate();
  const { k, id } = useParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const [d, setD] = useState<Ledger | null>(null);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [edit, setEdit] = useState<Terms | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wk = WorkS.use();
  const ls = LinkS.use();
  const [shared, setShared] = useState<{ url: string; copied: boolean } | null>(null);
  const [tell, setTell] = useState<string | null>(null);
  const [tellTo, setTellTo] = useState<Party | null>(null);
  const [tellPick, setTellPick] = useState(false);
  const [procs, setProcs] = useState<{ key: string; labels: Record<string, string> }[]>([]);
  const [tellProc, setTellProc] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, t] = await Promise.all([api.get<Ledger>(`/api/sc/parties/${k}/${id}/ledger`), api.get<{ terms: Terms }>(`/api/sc/parties/${k}/${id}/terms`)]);
      setD(l);
      setTerms(t.terms);
    } catch (e) {
      setError(errorText(e));
    }
  }, [k, id]);
  useEffect(() => void load(), [load]);

  const undo = async (mid: string) => {
    try {
      await api.post(`/api/sc/movements/${mid}/undo`);
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const saveTerms = async () => {
    if (!edit) return;
    try {
      await api.put(`/api/sc/parties/${k}/${id}/terms`, { ...edit, transit_risk: 'buyer', billable_reject_causes: [] });
      setEdit(null);
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const owner = d?.role === 'owner';
  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-head text-[20px] font-bold leading-tight text-ink">{d?.name.name ?? ''}</h1>
          {d && <p className="truncate text-[13px] text-meta">{[d.name.sub, d.name.onClaire ? null : ss('your_contact')].filter(Boolean).join(' · ')}</p>}
        </div>
        {d?.name.phone && (
          <a href={`tel:+91${d.name.phone}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-sunken">
            <Phone size={18} aria-hidden />
            {s('call')}
          </a>
        )}
      </header>

      {d && owner && d.name.kind === 'contact' && !d.name.onClaire && (
        <div className="mx-4 mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="tint" onClick={async () => {
            try {
              const r = await api.post<{ link: { url: string }; whatsapp: string }>('/api/sc/links', { party: d.party });
              setShared({ url: r.link.url, copied: false });
              window.open(r.whatsapp, '_blank', 'noopener');
            } catch (e) { setError(errorText(e)); }
          }}>{ls('send_statement')}</Button>
          {shared && <button className="min-h-10 rounded-full px-3 text-[13.5px] font-semibold text-primary" onClick={async () => { try { await navigator.clipboard.writeText(shared.url); setShared({ ...shared, copied: true }); } catch { /* clipboard blocked */ } }}>{shared.copied ? ls('copied') : ls('copy')}</button>}
        </div>
      )}
      {error && <p className="mx-4 mt-4 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}

      {d && (
        <>
          <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <section className="lg:col-start-1">
          <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{s('open')}</h2>
          {d.open.length === 0 ? (
            <p className="mx-4 mt-2 text-[14.5px] text-ink-2">{s('nothing_open')}</p>
          ) : (
            <ul className="mx-4 mt-2 space-y-3">
              {d.open.map((j) => (
                <li key={j.id} className="rounded-[18px] border border-line bg-surface px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button className="text-left font-head text-[16px] font-semibold text-ink underline-offset-2 hover:underline" onClick={() => nav(`/goods/job/${j.id}`)}>{j.inputLabel}</button>
                    {j.status === 'completed' ? <span className="rounded-full bg-success-tint px-2.5 py-1 text-[12.5px] font-semibold text-success">{s('completed')}</span> : <Status late={j.late} />}
                  </div>
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[14px]">
                    <dt className="text-meta">{s('sent')} · {shortDate(j.since, lang)}</dt>
                    <dd className="text-right tabular-nums text-ink">{fmtQty(j.sent, j.dim)}</dd>
                    <dt className="text-meta">{s('received_by', { name: d.name.name })}</dt>
                    <dd className="text-right tabular-nums text-ink">{fmtQty(j.issued, j.dim)}{j.issuedBasis === 'sent' && <span className="block text-[12px] text-meta">{s('based_on_sent')}</span>}</dd>
                    <dt className="text-meta">{s('back_so_far')}</dt>
                    <dd className="text-right tabular-nums text-ink">{fmtQty(j.outputs, j.dim)}</dd>
                    {j.status !== 'completed' && (
                      <>
                        <dt className="font-semibold text-ink">{s('still_there_label')}</dt>
                        <dd className="text-right font-head font-bold tabular-nums text-ink">{j.outputs > 0 ? `${s('approx')} ` : ''}{fmtQty(j.pending, j.dim)}</dd>
                      </>
                    )}
                    {j.lossPctSoFar !== null && (
                      <>
                        <dt className="text-meta">{s('loss_so_far', { pct: j.lossPctSoFar })}</dt>
                        <dd className="text-right text-meta">{s('usual_loss', { pct: j.lossNormPct })}</dd>
                      </>
                    )}
                  </dl>
                  {j.status !== 'completed' && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-meta"><Clock size={15} aria-hidden />{s('expected_on', { date: shortDate(j.expected_at, lang) })}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {d.party.k === 'b' && owner && (
                          <Button size="sm" variant="ghost" onClick={async () => { setTell(j.id); setTellTo(null); setTellProc(null); if (!procs.length) setProcs((await api.get<{ processes: { key: string; labels: Record<string, string> }[] }>('/api/sc/templates')).processes); }}>{wk('tell_send_on')}</Button>
                        )}
                        <Button size="sm" variant="tint" onClick={() => nav(`/goods/job/${j.id}/return`)}>{s('back_btn')}</Button>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          </section>
          <section className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <h2 className="mx-4 mt-6 lg:mt-5 font-head text-[17px] font-semibold text-ink">{s('history')}</h2>
          <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {d.history.map((h) => (
              <li key={h.id} className={clsx('px-4 py-3', h.cancelled && 'opacity-60')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-semibold text-ink">{s(`a_${h.action}` as 'a_send_for_work')} · {shortDate(h.business_date, lang)}{h.dc_no ? ` · DC ${h.dc_no}` : ''}</p>
                  {h.cancelled ? <span className="text-[12.5px] text-meta">{s('cancelled')}</span> : <Badge b={h.badge} name={d.name.name} />}
                </div>
                {h.lines.map((l) => (
                  <p key={l.line_id} className="mt-1 text-[14px] text-ink-2">
                    {l.label}{l.lot ? ` · ${l.lot}` : ''} · <span className="tabular-nums">{fmtQty(h.action === 'send_for_work' ? l.sent : l.received, l.dim)}</span>
                    {l.their !== null && <span className="block text-[12.5px] text-meta">{d.name.name}: {fmtQty(l.their, l.dim)} · {s('you_typed')}{l.settled?.outcome === 'within' ? ` · ${s('weighing_diff', { qty: fmtQty(Math.abs(l.settled.difference), l.dim) })}` : ''}</span>}
                  </p>
                ))}
                {h.badge?.kind === 'check_and_confirm' && (
                  <Button size="sm" variant="tint" className="mt-2" onClick={() => nav(`/goods/movement/${h.id}`)}>{t2('badge_check')}</Button>
                )}
                {h.undoable_until && (
                  <Button size="sm" variant="ghost" icon={Repeat} className="mt-1 -ml-2" onClick={() => void undo(h.id)}>{s('undo')}</Button>
                )}
              </li>
            ))}
          </ul>

          </section>
          <section className="lg:col-start-1">
          {terms && (
            <>
              <div className="mx-4 mt-6 flex items-center justify-between gap-3">
                <h2 className="font-head text-[17px] font-semibold text-ink">{s('terms')}</h2>
                {owner && <Button size="sm" variant="ghost" onClick={() => setEdit(terms)}>{s('edit_terms')}</Button>}
              </div>
              <dl className="mx-4 mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-[18px] border border-line bg-surface px-4 py-3 text-[14px]">
                <dt className="text-meta">{s('weighing_bearer')}</dt>
                <dd className="text-right font-semibold text-ink">{s(`b_${terms.weighing_loss_bearer}` as 'b_owner')}</dd>
                <dt className="text-meta">{s('tolerance')}</dt>
                <dd className="text-right font-semibold tabular-nums text-ink">±{terms.tolerance.weighed_pct} %</dd>
                <dt className="col-span-2 text-[12.5px] text-meta">{s('counted_exact')}</dt>
              </dl>
            </>
          )}
          </section>
          </div>
        </>
      )}

      <Sheet open={!!tell} onClose={() => setTell(null)} title={wk('tell_title')}
        footer={<Button block size="lg" disabled={!tellTo || !tellProc} onClick={async () => { try { await api.post(`/api/sc/jobs/${tell}/instruct`, { to: tellTo!.ref, process_key: tellProc }); setTell(null); } catch (e) { setError(errorText(e)); } }}>{s('save')}</Button>}>
        <div className="space-y-3 pb-2">
          <p className="text-[14px] text-ink-2">{wk('tell_hint')}</p>
          <button className="flex min-h-12 w-full items-center rounded-[16px] border border-line-strong bg-surface px-3.5 text-left text-[15px]" onClick={() => setTellPick(true)}>{tellTo?.name ?? <span className="text-meta">{wk('pick_unit')}</span>}</button>
          <div className="flex flex-wrap gap-2">
            {procs.map((p) => (
              <button key={p.key} onClick={() => setTellProc(p.key)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', tellProc === p.key ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{p.labels[lang] ?? p.labels.en}</button>
            ))}
          </div>
        </div>
      </Sheet>
      <PartyPicker open={tellPick} onClose={() => setTellPick(false)} onPick={setTellTo} />

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={s('terms')} footer={<Button block size="lg" onClick={() => void saveTerms()}>{s('save')}</Button>}>
        {edit && (
          <div className="space-y-4 pb-2">
            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('weighing_bearer')}</span>
              <div className="flex flex-wrap gap-2">
                {(['owner', 'performer', 'sender', 'receiver'] as const).map((b) => (
                  <button key={b} onClick={() => setEdit({ ...edit, weighing_loss_bearer: b })} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', edit.weighing_loss_bearer === b ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
                    {s(`b_${b}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('tolerance')} (%)</span>
              <input className="min-h-12 w-32 rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] tabular-nums outline-none focus:border-primary" inputMode="decimal" value={edit.tolerance.weighed_pct}
                onChange={(e) => setEdit({ ...edit, tolerance: { ...edit.tolerance, weighed_pct: Math.min(10, Number(e.target.value.replace(/[^\d.]/g, '')) || 0) } })} />
            </label>
          </div>
        )}
      </Sheet>
    </div>
  );
}
