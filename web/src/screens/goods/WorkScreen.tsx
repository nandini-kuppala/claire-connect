// The job worker's view of one job (03 S11): what was received, done here, sent back and sent on, with the actions
// Record work done · Mark ready · Hold for dues · Send back · Forward. No owner name for a sub-contract; no prices.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { postOrQueue } from '../../lib/offline';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, ArrowRight, Check, Clock, Plus } from '../../icons';
import { useSession } from '../../store/session';
import { WorkS } from './Work.strings';
import { RecS } from './Record.strings';
import { Status } from './Status';
import { PartyPicker } from './PartyPicker';
import { SpecPicker } from './SpecPicker';
import { clientId, qty as fmtQty, shortDate } from './format';
import type { WorkRow } from './Others';
import type { Party, ResolvedSpec } from './types';

interface Resp { job: WorkRow; clientName: string; process: Record<string, string> | null; inputSpecId: string | null; lastOutputSpecId: string | null; role: 'owner' | 'staff'; disclosureTo: string | null }
interface ReadyLine { spec_id: string; grade: string; dim: string; qty: number; label: string }
const unitOf = (dim: string) => (dim === 'mass' ? 'kg' : dim === 'length' ? 'm' : 'pcs');
const toUnit = (base: number, dim: string) => (dim === 'mass' ? base / 1000 : dim === 'length' ? base / 100 : base);
const inputCls = 'min-h-12 w-32 rounded-[16px] border border-line-strong bg-surface px-3.5 text-right font-head text-[16px] font-bold tabular-nums outline-none focus:border-primary';

export default function WorkScreen() {
  const w = WorkS.use();
  const r = RecS.use();
  const nav = useNavigate();
  const { id } = useParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const [d, setD] = useState<Resp | null>(null);
  const [sheet, setSheet] = useState<'done' | 'back' | 'forward' | null>(null);
  const [spec, setSpec] = useState<ResolvedSpec | null>(null);
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState<'A' | 'B' | 'rework' | 'reject'>('A');
  const [readyToo, setReadyToo] = useState(false);
  const [lines, setLines] = useState<(ReadyLine & { value: string })[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.get<Resp>(`/api/sc/work/${id}`));
    } catch (e) {
      setMsg(errorText(e));
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  const resolveDefault = async (specId: string | null) => {
    if (!specId) return;
    const sp = await api.get<{ recent: { id: string; material_type_id: string; attrs: Record<string, unknown> }[] }>('/api/sc/specs');
    const f = sp.recent.find((x) => x.id === specId);
    if (f) setSpec(await api.post<ResolvedSpec>('/api/sc/specs/resolve', { material_type_id: f.material_type_id, attrs: f.attrs }));
  };

  const open = async (k: 'done' | 'back' | 'forward') => {
    setMsg(null);
    setQ('');
    if (k === 'done') { setSpec(null); void resolveDefault(d?.lastOutputSpecId ?? null); }
    if (k === 'back') {
      const rl = await api.get<{ lines: ReadyLine[] }>(`/api/sc/jobs/${id}/ready-lines`);
      setLines(rl.lines.map((l) => ({ ...l, value: String(toUnit(l.qty, l.dim)) })));
    }
    if (k === 'forward') { setParty(null); setSpec(null); void resolveDefault(d?.inputSpecId ?? null); }
    setSheet(k);
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setSheet(null);
      setMsg(w('saved'));
      await load();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!d?.job) return <p className="px-4 pt-6 text-[14px] text-meta">{msg ?? ''}</p>;
  const j = d.job;
  const ins = j.instructions[0];

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="min-w-0">
          <h1 className="truncate font-head text-[20px] font-bold leading-tight text-ink">{j.inputLabel}</h1>
          <p className="truncate text-[13px] text-meta">{w('for_name', { name: d.clientName })} · {d.process?.[lang] ?? d.process?.en}</p>
        </div>
      </header>

      <section className="mx-4 mt-4 rounded-[18px] border border-line bg-surface px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {j.held ? <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[12.5px] font-semibold text-accent-ink">{w('held')}</span> : j.ready ? <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[12.5px] font-semibold text-primary">{w('ready')}</span> : <Status late={j.late} />}
          <span className="inline-flex items-center gap-1 text-[13px] text-meta"><Clock size={14} aria-hidden />{r('expected_on', { date: shortDate(j.expected_at, lang) })}</span>
        </div>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[14.5px]">
          <dt className="text-meta">{w('received')} · {shortDate(j.since, lang)}</dt><dd className="text-right tabular-nums text-ink">{fmtQty(j.received, j.dim)}{j.receivedBasis === 'their_record' && <span className="block text-[12px] text-meta">{w('their_record')}</span>}</dd>
          {j.forwarded > 0 && <><dt className="text-meta">{w('forwarded')}</dt><dd className="text-right tabular-nums text-ink">{fmtQty(j.forwarded, j.dim)}</dd></>}
          <dt className="text-meta">{w('done')}</dt><dd className="text-right tabular-nums text-ink">{fmtQty(j.outputs, j.dim)}</dd>
          <dt className="text-meta">{w('sent_back')}</dt><dd className="text-right tabular-nums text-ink">{fmtQty(j.returned, j.dim)}</dd>
          <dt className="font-semibold text-ink">{w('here_inputs')}</dt><dd className="text-right font-head font-bold tabular-nums text-ink">{j.dim === 'mass' && j.outputs ? `${r('approx')} ` : ''}{fmtQty(j.inputsHere, j.dim)}</dd>
          <dt className="font-semibold text-ink">{w('here_done')}</dt><dd className="text-right font-head font-bold tabular-nums text-ink">{fmtQty(j.outputsHere, j.dim)}</dd>
        </dl>
      </section>

      {ins && (
        <div className="mx-4 mt-3 rounded-[16px] bg-primary-tint px-4 py-3 text-[14.5px] text-primary">
          {w('instructed', { name: d.clientName, to: ins.to_name ?? '' })}
          <Button className="mt-2" block icon={ArrowRight} onClick={() => { setParty({ ref: ins.to as Party['ref'], name: ins.to_name ?? '', kind: ins.to.k === 'b' ? 'business' : 'contact', sub: null, onClaire: ins.to.k === 'b' }); void open('forward'); }}>{w('send_on', { to: ins.to_name ?? '' })}</Button>
        </div>
      )}

      <div className="mx-4 mt-4 grid gap-2">
        <Button variant="tint" icon={Plus} onClick={() => void open('done')}>{w('record_done')}</Button>
        <Button variant="primary" icon={ArrowRight} disabled={!j.outputsHere && !j.inputsHere} onClick={() => void open('back')}>{w('send_back')}</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={j.ready ? undefined : Check} onClick={() => void run(() => api.post(`/api/sc/jobs/${j.id}/ready`, { ready: !j.ready }))}>{j.ready ? w('unmark_ready') : w('mark_ready')}</Button>
          {d.role === 'owner' && <Button variant="secondary" onClick={() => void run(() => api.post(`/api/sc/jobs/${j.id}/hold`, { on: !j.held, reason: 'dues' }))}>{j.held ? w('release') : w('hold')}</Button>}
        </div>
        {!j.parentJobId && <Button variant="ghost" onClick={() => void open('forward')}>{w('forward')}</Button>}
      </div>
      {msg && <p className="mx-4 mt-3 rounded-[14px] bg-sunken px-3 py-2 text-[14px] text-ink-2">{msg}</p>}

      <Sheet open={sheet === 'done'} onClose={() => setSheet(null)} title={w('work_done_title')}
        footer={<Button block size="lg" loading={busy} disabled={!spec || !(Number(q) > 0)} onClick={() => void run(async () => { const r0 = await postOrQueue(`/api/sc/jobs/${j.id}/output`, { ready: readyToo, lines: [{ spec_id: spec!.spec.id, qty: Number(q), unit: unitOf(spec!.dimension), grade }], client_id: clientId() }, `${w('work_done_title')} · ${spec!.spec.label_en}`); if (r0 && typeof r0 === 'object' && 'queued' in r0) nav('/goods?queued=1'); })}>{r('save')}</Button>}>
        <div className="space-y-3 pb-2">
          <button className="min-h-12 w-full rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setPick(true)}>{spec?.spec.label_en ?? <span className="font-normal text-meta">{r('material')} · {r('pick')}</span>}</button>
          <div className="flex items-center gap-2"><input className={inputCls} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value.replace(/[^\d.]/g, ''))} aria-label={w('how_many')} /><span className="text-ink-2">{spec ? unitOf(spec.dimension) : ''}</span></div>
          <div className="flex flex-wrap gap-2">
            {(['A', 'B', 'rework', 'reject'] as const).map((g) => (
              <button key={g} onClick={() => setGrade(g)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', grade === g ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{r(`g_${g}`)}</button>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-[14.5px] text-ink-2"><input type="checkbox" className="size-5" checked={readyToo} onChange={(e) => setReadyToo(e.target.checked)} />{w('mark_ready')}</label>
        </div>
      </Sheet>

      <Sheet open={sheet === 'back'} onClose={() => setSheet(null)} title={w('send_back_title')}
        footer={<Button block size="lg" loading={busy} disabled={!lines.some((l) => Number(l.value) > 0)} onClick={() => void run(() => api.post(`/api/sc/jobs/${j.id}/send-back`, { client_id: clientId(), lines: lines.filter((l) => Number(l.value) > 0).map((l) => ({ spec_id: l.spec_id, grade: l.grade, qty: Number(l.value), unit: unitOf(l.dim) })) }))}>{r('save')}</Button>}>
        <div className="space-y-3 pb-2">
          {lines.length === 0 && <p className="text-[14.5px] text-ink-2">{w('nothing_ready')}</p>}
          {lines.map((l, i) => (
            <div key={`${l.spec_id}|${l.grade}`} className="rounded-[16px] border border-line px-3 py-2.5">
              <p className="text-[15px] font-semibold text-ink">{l.label}{l.grade !== 'A' ? ` · ${r(`g_${l.grade}` as 'g_B')}` : ''}</p>
              <div className="mt-2 flex items-center gap-2"><input className={inputCls} inputMode="decimal" value={l.value} onChange={(e) => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, value: e.target.value.replace(/[^\d.]/g, '') } : x)))} /><span className="text-ink-2">{unitOf(l.dim)}</span></div>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'forward'} onClose={() => setSheet(null)} title={w('forward_title')}
        footer={<Button block size="lg" loading={busy} disabled={!party || !spec || !(Number(q) > 0)} onClick={() => void run(() => api.post(`/api/sc/jobs/${j.id}/forward`, { to: party!.ref, client_id: clientId(), instruction_id: ins && party && ins.to.id === party.ref.id ? ins.id : undefined, lines: [{ spec_id: spec!.spec.id, qty: Number(q), unit: unitOf(spec!.dimension) }] }))}>{r('save')}</Button>}>
        <div className="space-y-3 pb-2">
          <button className="flex min-h-12 w-full items-center rounded-[16px] border border-line-strong bg-surface px-3.5 text-left text-[15px]" onClick={() => setPartyOpen(true)}>{party?.name ?? <span className="text-meta">{w('pick_unit')}</span>}</button>
          <button className="min-h-12 w-full rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setPick(true)}>{spec?.spec.label_en ?? <span className="font-normal text-meta">{r('material')} · {r('pick')}</span>}</button>
          <div className="flex items-center gap-2"><input className={inputCls} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value.replace(/[^\d.]/g, ''))} aria-label={w('how_many')} /><span className="text-ink-2">{spec ? unitOf(spec.dimension) : ''}</span></div>
          {d.disclosureTo && <p className="rounded-[14px] bg-accent-tint px-3 py-2 text-[13.5px] text-accent-ink">{w('disclosure', { owner: d.disclosureTo })}</p>}
          <p className="text-[13px] text-meta">{w('generic_note')}</p>
        </div>
      </Sheet>

      <PartyPicker open={partyOpen} onClose={() => setPartyOpen(false)} onPick={setParty} />
      <SpecPicker open={pick} onClose={() => setPick(false)} onPick={setSpec} />
    </div>
  );
}
