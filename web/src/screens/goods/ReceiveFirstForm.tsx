// Record → Received for work (receiver-first, 04 §5.6.2): goods arrived before the sender recorded them. Only the
// recorder sees it until it links up with the sender's record.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { postOrQueue } from '../../lib/offline';
import { Button } from '../../components/Button';
import { ArrowLeft, ChevronRight } from '../../icons';
import { useSession } from '../../store/session';
import { todayIST } from '@shared/sc/dates';
import { RecS } from './Record.strings';
import { TwoS } from './Two.strings';
import { PartyPicker } from './PartyPicker';
import { SpecPicker } from './SpecPicker';
import { clientId } from './format';
import type { Party, ResolvedSpec } from './types';

interface Process { key: string; labels: Record<string, string> }
const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';

export default function ReceiveFirstForm() {
  const s = RecS.use();
  const t2 = TwoS.use();
  const nav = useNavigate();
  const lang = useSession((st) => st.user?.language || 'en');
  const [party, setParty] = useState<Party | null>(null);
  const [procs, setProcs] = useState<Process[]>([]);
  const [proc, setProc] = useState<string | null>(null);
  const [spec, setSpec] = useState<ResolvedSpec | null>(null);
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('');
  const [lot, setLot] = useState('');
  const [dc, setDc] = useState('');
  const [open, setOpen] = useState<'party' | 'spec' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cid] = useState(clientId);

  useEffect(() => void api.get<{ processes: Process[] }>('/api/sc/templates').then((r) => setProcs(r.processes)).catch(() => undefined), []);

  const save = async () => {
    if (!party || !proc || !spec) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postOrQueue('/api/sc/movements/receive-first', { from: party.ref, process_key: proc, lines: [{ spec_id: spec.spec.id, qty: Number(q), unit, lot: lot.trim() || undefined }], business_date: todayIST(), client_id: cid, dc_no: dc.trim() || undefined }, `${party.name} · ${spec.spec.label_en}`);
      nav(r && typeof r === 'object' && 'queued' in r ? '/goods?queued=1&tab=coming' : '/goods?tab=coming', { replace: true });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="font-head text-[20px] font-bold text-ink">{t2('received_first')}</h1>
      </header>
      <div className="space-y-5 px-4 pt-4">
        <p className="text-[14px] text-ink-2">{t2('received_first_hint')}</p>
        <button className="flex min-h-14 w-full items-center gap-3 rounded-[16px] border border-line-strong bg-surface px-3.5 text-left" onClick={() => setOpen('party')}>
          <span className={clsx('min-w-0 flex-1 text-[16px]', party ? 'font-semibold text-ink' : 'text-meta')}>{party?.name ?? `${t2('from_who')} · ${s('pick')}`}</span>
          <ChevronRight size={18} className="text-meta" aria-hidden />
        </button>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {procs.map((p) => (
            <button key={p.key} role="radio" aria-checked={proc === p.key} onClick={() => setProc(p.key)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', proc === p.key ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
              {p.labels[lang] ?? p.labels.en}
            </button>
          ))}
        </div>
        <button className="min-h-12 w-full rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setOpen('spec')}>
          {spec?.spec.label_en ?? <span className="font-normal text-meta">{s('material')} · {s('pick')}</span>}
        </button>
        {spec && (
          <div className="flex flex-wrap items-end gap-2">
            <input className={inputCls + ' w-32 text-right font-head font-bold tabular-nums'} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value.replace(/[^\d.]/g, ''))} aria-label={s('qty')} />
            {spec.units.filter((u) => !['rolls', 'cones', 'bundles', 'bags', 'boxes'].includes(u)).map((u) => (
              <button key={u} onClick={() => setUnit(u)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', unit === u ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{u}</button>
            ))}
          </div>
        )}
        <input className={inputCls} placeholder={s('lot')} value={lot} onChange={(e) => setLot(e.target.value)} />
        <input className={inputCls} placeholder={s('dc')} value={dc} onChange={(e) => setDc(e.target.value)} />
        {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface px-4 py-3 pb-[calc(12px+var(--safe-bottom))]">
        <Button block size="lg" loading={busy} disabled={!party || !proc || !spec || !(Number(q) > 0) || !unit} onClick={() => void save()}>{t2('save')}</Button>
      </div>
      <PartyPicker open={open === 'party'} businessOnly onClose={() => setOpen(null)} onPick={setParty} />
      <SpecPicker open={open === 'spec'} onClose={() => setOpen(null)} onPick={(r) => { setSpec(r); setUnit(r.units[0] ?? ''); }} />
    </div>
  );
}
