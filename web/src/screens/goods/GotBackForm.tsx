// Record → Got back from work (03 S5): what came back against an open job, with a live balance strip computed by
// the same shared code the server uses (approx. pending, P7) and the completion question.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { postOrQueue } from '../../lib/offline';
import { Button } from '../../components/Button';
import { ArrowLeft } from '../../icons';
import { useSession } from '../../store/session';
import { approxPending } from '@shared/sc/conservation';
import { toBase } from '@shared/sc/units';
import { todayIST } from '@shared/sc/dates';
import { RecS } from './Record.strings';
import { SpecPicker } from './SpecPicker';
import { clientId, qty as fmtQty, shortDate } from './format';
import type { ResolvedSpec } from './types';

interface JobSummary {
  id: string; process_key: string; status: string; since: string; expected_at: string; dim: 'mass' | 'count' | 'length';
  sent: number; issued: number; issuedBasis: string; outputs: number; pending: number; pendingAsOutput: number | null; lossNormPct: number; inputLabel: string; outputLabel: string | null;
}
interface JobResp { job: JobSummary; performerName: string; process: Record<string, string> | null; lastOutputSpecId: string | null; inputSpecId: string | null }

const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';
const GRADES = ['A', 'B', 'rework', 'reject'] as const;

export default function GotBackForm() {
  const s = RecS.use();
  const nav = useNavigate();
  const { id } = useParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const [data, setData] = useState<JobResp | null>(null);
  const [spec, setSpec] = useState<ResolvedSpec | null>(null);
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('');
  const [grade, setGrade] = useState<(typeof GRADES)[number]>('A');
  const [rolls, setRolls] = useState('');
  const [theySent, setTheySent] = useState('');
  const [unprocessed, setUnprocessed] = useState(false);
  const [last, setLast] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cid] = useState(clientId);

  useEffect(() => {
    void api.get<JobResp>(`/api/sc/jobs/${id}`).then(async (r) => {
      setData(r);
      const specId = r.lastOutputSpecId ?? r.inputSpecId;
      if (specId) {
        const sp = await api.get<{ aliases: unknown[]; recent: { id: string; material_type_id: string; attrs: Record<string, unknown> }[] }>('/api/sc/specs');
        const found = sp.recent.find((x) => x.id === specId);
        if (found) {
          const res = await api.post<ResolvedSpec>('/api/sc/specs/resolve', { material_type_id: found.material_type_id, attrs: found.attrs });
          setSpec(res);
          setUnit(res.units[0] ?? '');
        }
      }
    }).catch((e) => setError(errorText(e)));
  }, [id]);

  const job = data?.job;
  const entered = useMemo(() => {
    if (!spec || !(Number(q) > 0) || !unit) return null;
    const r = toBase(Number(q), unit, spec.dimension);
    return r.ok ? r.base : null;
  }, [q, unit, spec]);
  const declared = useMemo(() => {
    if (!spec || !(Number(theySent) > 0) || !unit) return null;
    const r = toBase(Number(theySent), unit, spec.dimension);
    return r.ok ? r.base : null;
  }, [theySent, unit, spec]);

  // Live strip: outputs so far + this return (the performer's figure when given, P6) against what was issued.
  const strip = useMemo(() => {
    if (!job) return null;
    const thisOut = unprocessed ? 0 : declared ?? entered ?? 0;
    const outputs = job.outputs + (spec?.dimension === job.dim ? thisOut : 0);
    const kind = job.lossNormPct > 0 && job.dim === 'mass' ? 'mass_losing' : 'count_preserving';
    const p = approxPending({ kind, issued: job.issued, outputs, factor: kind === 'mass_losing' ? job.lossNormPct / 100 : 1 });
    const lossPct = kind === 'mass_losing' && outputs > 0 ? Math.round(((job.issued - outputs) / job.issued) * 1000) / 10 : null;
    return { outputs, pending: p.input, asOutput: p.asOutput, lossPct, complete: p.input === 0 };
  }, [job, entered, declared, spec, unprocessed]);

  useEffect(() => {
    if (strip && last === null && (entered ?? 0) > 0) setLast(strip.complete ? null : false);
    if (strip?.complete && last === false) setLast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strip?.complete, entered]);

  const save = async () => {
    if (!spec || !job) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postOrQueue<{ movement: { id: string }; undo_until: number }>(`/api/sc/jobs/${job.id}/return`, {
        client_id: cid, business_date: todayIST(), last: last === true,
        lines: [{ spec_id: spec.spec.id, qty: Number(q), unit, grade, rolls: Number(rolls) > 0 ? Number(rolls) : undefined, they_sent: Number(theySent) > 0 ? Number(theySent) : undefined, unprocessed: unprocessed || undefined }],
      }, `${s('got_back')} · ${spec.spec.label_en}`);
      if ('queued' in r) nav('/goods?queued=1&tab=coming', { replace: true });
      else nav(`/goods?saved=${r.movement.id}&until=${r.undo_until}&tab=coming`, { replace: true });
    } catch (e) {
      setError(errorText(e) || s('error'));
    } finally {
      setBusy(false);
    }
  };

  const dim = job?.dim ?? 'mass';
  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-head text-[20px] font-bold leading-tight text-ink">{s('got_back')}</h1>
          {data && <p className="truncate text-[13px] text-meta">{data.performerName} · {shortDate(todayIST(), lang)}</p>}
        </div>
      </header>

      {job && (
        <div className="space-y-5 px-4 pt-4">
          <section className="rounded-[18px] border border-line bg-surface px-4 py-3.5">
            <p className="font-head text-[16px] font-semibold text-ink">{data?.process?.[lang] ?? data?.process?.en} · {job.inputLabel}</p>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[14px]">
              <dt className="text-meta">{s('sent')} · {shortDate(job.since, lang)}</dt>
              <dd className="text-right font-semibold tabular-nums text-ink">{fmtQty(job.sent, dim)}</dd>
              <dt className="text-meta">{s('received_by', { name: data?.performerName ?? '' })}</dt>
              <dd className="text-right font-semibold tabular-nums text-ink">{fmtQty(job.issued, dim)}{job.issuedBasis === 'sent' && <span className="block text-[12px] font-normal text-meta">{s('based_on_sent')}</span>}</dd>
              <dt className="text-meta">{s('back_so_far')}</dt>
              <dd className="text-right font-semibold tabular-nums text-ink">{fmtQty(job.outputs, dim)}</dd>
            </dl>
          </section>

          <section className="space-y-3">
            <h2 className="font-head text-[17px] font-semibold text-ink">{s('came_back')}</h2>
            <button className="min-h-12 w-full rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setPick(true)}>
              {spec?.spec.label_en ?? <span className="font-normal text-meta">{s('material')} · {s('pick')}</span>}
            </button>
            {spec && (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="w-32">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('qty')}</span>
                    <input className={inputCls + ' text-right font-head font-bold tabular-nums'} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />
                  </label>
                  <div className="flex flex-wrap gap-1.5 pb-0.5">
                    {spec.units.filter((u) => !['rolls', 'cones', 'bundles', 'bags', 'boxes'].includes(u)).map((u) => (
                      <button key={u} onClick={() => setUnit(u)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', unit === u ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{u}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('grade')}</span>
                  <div className="flex flex-wrap gap-2" role="radiogroup">
                    {GRADES.map((g) => (
                      <button key={g} role="radio" aria-checked={grade === g} onClick={() => setGrade(g)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', grade === g ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
                        {s(`g_${g}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('rolls')}</span>
                  <input className={inputCls + ' w-32 tabular-nums'} inputMode="numeric" value={rolls} onChange={(e) => setRolls(e.target.value.replace(/\D/g, ''))} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('they_sent')}</span>
                  <input className={inputCls + ' w-32 tabular-nums'} inputMode="decimal" value={theySent} onChange={(e) => setTheySent(e.target.value.replace(/[^\d.]/g, ''))} />
                  <span className="mt-1 block text-[12.5px] text-meta">{s('they_sent_hint')}</span>
                </label>
                <label className="flex min-h-11 items-center gap-3 text-[14.5px] text-ink-2">
                  <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={unprocessed} onChange={(e) => setUnprocessed(e.target.checked)} />
                  {s('unprocessed')}
                </label>
              </>
            )}
          </section>

          {/* Only when this return is in the same dimension as what was sent (kg in, pcs back has no common unit). */}
          {strip && (entered ?? 0) > 0 && spec?.dimension === job.dim && (
            <section className="rounded-[16px] bg-sunken px-4 py-3 text-[14.5px] text-ink-2">
              <p className="tabular-nums">
                <span className="font-semibold text-ink">{fmtQty(job.issued, dim)}</span> → {s('back_so_far').toLowerCase()} <span className="font-semibold text-ink">{fmtQty(strip.outputs, dim)}</span>
              </p>
              {strip.lossPct !== null && strip.complete && <p className="mt-1">{s('loss_so_far', { pct: strip.lossPct })} · {s('usual_loss', { pct: job.lossNormPct })}</p>}
              {declared !== null && entered !== null && declared !== entered && <p className="mt-1">{s('weighing_diff', { qty: fmtQty(Math.abs(declared - entered), dim) })}</p>}
              {strip.pending > 0 && <p className="mt-1">{s('approx')} {fmtQty(strip.pending, dim)} {s('still_there')} <span className="text-meta">({s('est_note', { pct: job.lossNormPct })})</span></p>}
            </section>
          )}

          {strip && (entered ?? 0) > 0 && (
            <section>
              <p className="text-[15px] font-semibold text-ink">{strip.complete ? s('looks_complete') : s('is_last')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([true, false] as const).map((v) => (
                  <button key={String(v)} onClick={() => setLast(v)} className={clsx('min-h-11 rounded-full border px-4 text-[14px] font-semibold', last === v ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
                    {v ? s('last') : s('more')}
                  </button>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
      {/* Outside the job block, so a failed load still says why the form is empty. */}
      {error && <p role="alert" className="mx-4 mt-4 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface px-4 py-3 pb-[calc(12px+var(--safe-bottom))]">
        <Button block size="lg" loading={busy} disabled={!spec || !(entered && entered > 0) || last === null} onClick={() => void save()}>
          {s('save')}
        </Button>
      </div>

      <SpecPicker open={pick} onClose={() => setPick(false)} onPick={(r) => { setSpec(r); setUnit(r.units[0] ?? ''); }} />
    </div>
  );
}
