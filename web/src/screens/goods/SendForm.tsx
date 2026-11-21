// Record → Send for work (03 S4, slice 1: off-platform counterparties, no size grid yet).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText, ApiError } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, ChevronRight, Plus, Trash2 } from '../../icons';
import { useSession } from '../../store/session';
import { addWorkingDays, todayIST } from '@shared/sc/dates';
import { RecS } from './Record.strings';
import { PartyPicker } from './PartyPicker';
import { SpecPicker } from './SpecPicker';
import { clientId, qty as fmtQty } from './format';
import type { Party, ResolvedSpec } from './types';

interface Process { key: string; labels: Record<string, string>; default_turnaround_days: number; rate_basis: string }
interface Line { spec: ResolvedSpec | null; qty: string; unit: string; lot: string; theyGot: string }
const emptyLine = (): Line => ({ spec: null, qty: '', unit: '', lot: '', theyGot: '' });
const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] font-semibold text-ink-2">
      <span>{children}</span>
      {hint && <span className="text-[12.5px] font-normal text-meta">{hint}</span>}
    </span>
  );
}

export default function SendForm() {
  const s = RecS.use();
  const nav = useNavigate();
  const lang = useSession((st) => st.user?.language || 'en');
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [party, setParty] = useState<Party | null>(null);
  const [procs, setProcs] = useState<Process[]>([]);
  const [proc, setProc] = useState<Process | null>(null);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [expected, setExpected] = useState('');
  const [expectedTouched, setExpectedTouched] = useState(false);
  const [dc, setDc] = useState('');
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [short, setShort] = useState<{ have: string; need: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cid] = useState(clientId);
  const today = todayIST();

  useEffect(() => {
    void api.get<{ role: 'owner' | 'staff' }>('/api/sc/home').then((h) => setRole(h.role)).catch(() => undefined);
    void api.get<{ processes: Process[] }>('/api/sc/templates').then((r) => setProcs(r.processes)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (proc && !expectedTouched) setExpected(addWorkingDays(today, proc.default_turnaround_days));
  }, [proc, expectedTouched, today]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const ready = !!party && !!proc && lines.every((l) => l.spec && Number(l.qty) > 0 && l.unit);
  const rateUnit = useMemo(() => lines[0]?.spec?.units?.[0] ?? 'kg', [lines]);

  const submit = async (override?: { reason: string }) => {
    if (!party || !proc) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        to: party.ref, process_key: proc.key, business_date: today, expected_at: expected || undefined, dc_no: dc.trim() || undefined, note: note.trim() || undefined, client_id: cid,
        rate_paise: role === 'owner' && Number(rate) > 0 ? Math.round(Number(rate) * 100) : undefined,
        lines: lines.map((l) => ({ spec_id: l.spec!.spec.id, qty: Number(l.qty), unit: l.unit, lot: l.lot.trim() || undefined, they_got: Number(l.theyGot) > 0 ? Number(l.theyGot) : undefined })),
        ...(override ? { allow_untracked: true, untracked_reason: override.reason } : {}),
      };
      const r = await api.post<{ movement: { id: string }; undo_until: number }>('/api/sc/movements/send', body);
      nav(`/goods?saved=${r.movement.id}&until=${r.undo_until}`, { replace: true });
    } catch (e) {
      const body = (e as ApiError).body as { code?: string; lines?: { index: number; available: number; needed: number; dim: string }[] } | undefined;
      if (e instanceof ApiError && body?.code === 'negative' && body.lines?.length) {
        const l = body.lines[0];
        setShort({ have: fmtQty(l.available, l.dim), need: fmtQty(l.needed, l.dim) });
      } else setError(errorText(e) || s('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-head text-[20px] font-bold text-ink">{s('send')}</h1>
      </header>

      <div className="space-y-5 px-4 pt-4">
        <div>
          <Label>{s('to')}</Label>
          <button className="flex min-h-14 w-full items-center gap-3 rounded-[16px] border border-line-strong bg-surface px-3.5 text-left" onClick={() => setPartyOpen(true)}>
            <span className={clsx('min-w-0 flex-1 text-[16px]', party ? 'font-semibold text-ink' : 'text-meta')}>{party?.name ?? s('pick_party')}</span>
            <span className="text-[14px] font-semibold text-primary">{party ? s('change') : ''}</span>
            {!party && <ChevronRight size={18} className="text-meta" aria-hidden />}
          </button>
        </div>

        <div>
          <Label>{s('work')}</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {procs.map((p) => (
              <button key={p.key} role="radio" aria-checked={proc?.key === p.key} onClick={() => setProc(p)}
                className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', proc?.key === p.key ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
                {p.labels[lang] ?? p.labels.en}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 font-head text-[17px] font-semibold text-ink">{s('what')}</h2>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="rounded-[18px] border border-line bg-surface p-3.5">
                <div className="flex items-start gap-2">
                  <button className="min-h-12 flex-1 rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setPickFor(i)}>
                    {l.spec?.spec.label_en ?? <span className="font-normal text-meta">{s('material')} · {s('pick')}</span>}
                  </button>
                  {lines.length > 1 && (
                    <button className="flex size-12 items-center justify-center rounded-full text-meta hover:bg-sunken" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                {l.spec && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="w-32">
                        <Label>{s('qty')}</Label>
                        <input className={inputCls + ' text-right font-head font-bold tabular-nums'} inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^\d.]/g, '') })} />
                      </label>
                      <div className="flex flex-wrap gap-1.5 pb-0.5">
                        {l.spec.units.filter((u) => !['rolls', 'cones', 'bundles', 'bags', 'boxes'].includes(u)).map((u) => (
                          <button key={u} onClick={() => setLine(i, { unit: u })} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', l.unit === u ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <Label>{s('lot')}</Label>
                      <input className={inputCls} value={l.lot} onChange={(e) => setLine(i, { lot: e.target.value })} placeholder="K-221" />
                    </label>
                    <label className="block">
                      <Label hint={s('they_got_hint')}>{s('they_got')}</Label>
                      <input className={inputCls + ' tabular-nums'} inputMode="decimal" value={l.theyGot} onChange={(e) => setLine(i, { theyGot: e.target.value.replace(/[^\d.]/g, '') })} placeholder={l.unit || ''} />
                    </label>
                  </div>
                )}
              </div>
            ))}
            <Button variant="ghost" icon={Plus} onClick={() => setLines((ls) => [...ls, emptyLine()])}>
              {s('material')}
            </Button>
          </div>
        </div>

        <label className="block">
          <Label hint={proc ? s('usual_days', { n: proc.default_turnaround_days }) : undefined}>{s('expected')}</Label>
          <input type="date" className={inputCls} value={expected} min={today} onChange={(e) => { setExpectedTouched(true); setExpected(e.target.value); }} />
        </label>

        <label className="block">
          <Label>{s('dc')}</Label>
          <input className={inputCls} value={dc} onChange={(e) => setDc(e.target.value)} placeholder="0412" />
        </label>

        {role === 'owner' && (
          <label className="block">
            <Label hint={s('rate_hint')}>{s('rate')}</Label>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-ink-2">₹</span>
              <input className={inputCls + ' w-32 tabular-nums'} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} />
              <span className="text-[14px] text-meta">{s('per', { unit: rateUnit })}</span>
            </div>
          </label>
        )}

        <label className="block">
          <Label>{s('note')}</Label>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface px-4 py-3 pb-[calc(12px+var(--safe-bottom))]">
        <Button block size="lg" loading={busy} disabled={!ready} onClick={() => void submit()}>
          {s('save')}
        </Button>
      </div>

      <PartyPicker open={partyOpen} onClose={() => setPartyOpen(false)} onPick={setParty} />
      <SpecPicker
        open={pickFor !== null}
        onClose={() => setPickFor(null)}
        onPick={(r) => pickFor !== null && setLine(pickFor, { spec: r, unit: r.units[0] ?? '' })}
      />
      <Sheet
        open={!!short}
        onClose={() => setShort(null)}
        title={s('short_title')}
        footer={
          role === 'owner' ? (
            <Button block size="lg" loading={busy} disabled={reason.trim().length < 3} onClick={() => { setShort(null); void submit({ reason: reason.trim() }); }}>
              {s('record_anyway')}
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-3 pb-2">
          <p className="text-[15px] leading-relaxed text-ink-2">{short ? s('short_body', short) : ''}</p>
          {role === 'owner' ? (
            <label className="block">
              <Label>{s('reason')}</Label>
              <input className={inputCls} placeholder={s('reason_ph')} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          ) : (
            <p className="text-[14px] text-meta">{s('owner_only_override')}</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}
