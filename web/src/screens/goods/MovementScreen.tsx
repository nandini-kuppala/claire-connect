// One record (03 S6): what moved, both sides' figures, and — for the side that has to check — a confirm form per line.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { JobS } from './Job.strings';
import { ArrowLeft } from '../../icons';
import { useSession } from '../../store/session';
import { TwoS } from './Two.strings';
import { RecS } from './Record.strings';
import { qty as fmtQty, shortDate } from './format';

interface Assert { qty: number; evidence: string; by: string | null; at: number; reason?: string | null }
interface Line { line_id: string; label: string; lot: string | null; dim: string; unit: string | null; settled: { outcome: string } | null; sent: Assert[]; received: Assert[] }
interface Mv { id: string; jobId?: string | null; action: string; business_date: string; dc_no: string | null; cancelled: boolean; recorder: string; from: { k: string; id: string; name: string }; to: { k: string; id: string; name: string }; terms: { tolerance?: { weighed_pct: number } }; lines: Line[]; photos?: string[] }

const best = (list: Assert[]) => (list.length ? list.reduce((a, b) => (b.at > a.at ? b : a)) : null);
const toUnit = (base: number, dim: string) => (dim === 'mass' ? base / 1000 : dim === 'length' ? base / 100 : base);

export default function MovementScreen() {
  const s = TwoS.use();
  const r = RecS.use();
  const nav = useNavigate();
  const jb = JobS.use();
  const { id } = useParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const myBiz = useSession((st) => st.business?.id);
  const [m, setM] = useState<Mv | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<Mv>(`/api/sc/movements/${id}`);
      setM(d);
      setVals(Object.fromEntries(d.lines.map((l) => [l.line_id, String(toUnit((best(l.sent)?.qty ?? 0), l.dim))])));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  if (!m) return <p className="px-4 pt-6 text-[14px] text-meta">{error ?? ''}</p>;
  const iAmReceiver = m.to.k === 'b' && m.to.id === myBiz;
  const iAmSender = m.from.k === 'b' && m.from.id === myBiz;
  const isReturn = m.action === 'return_from_work';
  const mineToCheck = m.recorder !== myBiz && ((iAmReceiver && !isReturn) || (iAmSender && isReturn));
  const pending = m.lines.filter((l) => !(isReturn ? l.sent : l.received).some((a) => a.by === myBiz));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const lines = pending.map((l) => ({ line_id: l.line_id, qty: Number(vals[l.line_id]), unit: l.dim === 'mass' ? 'kg' : l.dim === 'length' ? 'm' : 'pcs' }));
      const res = await api.post<{ results: { disputeId?: string | null }[] }>(`/api/sc/movements/${m.id}/${isReturn ? 'sender-figure' : 'confirm'}`, { lines });
      const dq = res.results.find((x) => x.disputeId)?.disputeId;
      if (dq) nav(`/goods/dispute/${dq}`, { replace: true });
      else {
        setMsg(s('confirmed'));
        await load();
      }
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
        <div className="min-w-0">
          <h1 className="font-head text-[20px] font-bold leading-tight text-ink">{mineToCheck && pending.length ? (isReturn ? s('check_title_sender') : s('check_title')) : r(`a_${m.action}` as 'a_send_for_work')}</h1>
          <p className="truncate text-[13px] text-meta">{m.from.name} → {m.to.name} · {shortDate(m.business_date, lang)}{m.dc_no ? ` · DC ${m.dc_no}` : ''}</p>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
        {mineToCheck && pending.length > 0 && <p className="text-[14.5px] leading-relaxed text-ink-2">{s('check_hint')}</p>}
        {m.lines.map((l) => {
          const sent = best(l.sent);
          const recv = best(l.received);
          const editable = mineToCheck && pending.some((p) => p.line_id === l.line_id);
          return (
            <section key={l.line_id} className="rounded-[18px] border border-line bg-surface px-4 py-3.5">
              <p className="font-head text-[16px] font-semibold text-ink">{l.label}{l.lot ? ` · ${l.lot}` : ''}</p>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[14px]">
                <dt className="text-meta">{s('sent')} ({m.from.name})</dt>
                <dd className="text-right font-semibold tabular-nums text-ink">{sent ? fmtQty(sent.qty, l.dim) : '—'}</dd>
                <dt className="text-meta">{s('received')} ({m.to.name})</dt>
                <dd className="text-right font-semibold tabular-nums text-ink">{recv ? fmtQty(recv.qty, l.dim) : '—'}</dd>
              </dl>
              {editable && (
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('your_figure')}</span>
                  <span className="flex items-center gap-2">
                    <input className="min-h-12 w-36 rounded-[16px] border border-line-strong bg-surface px-3.5 text-right font-head text-[16px] font-bold tabular-nums outline-none focus:border-primary" inputMode="decimal"
                      value={vals[l.line_id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [l.line_id]: e.target.value.replace(/[^\d.]/g, '') }))} />
                    <span className="text-[15px] text-ink-2">{l.dim === 'mass' ? 'kg' : l.dim === 'length' ? 'm' : 'pcs'}</span>
                  </span>
                </label>
              )}
            </section>
          );
        })}
        {mineToCheck && pending.length > 0 && <p className="text-[13px] text-meta">{m.lines.some((l) => l.dim === 'mass') ? s('allowed_weighed', { pct: m.terms.tolerance?.weighed_pct ?? 1.5 }) : ''} {s('counted_exact')}</p>}
        {!!m.photos?.length && (
          <div className="flex flex-wrap gap-2">
            {m.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="DC" className="h-28 w-auto rounded-[12px] border border-line object-cover" /></a>)}
          </div>
        )}
        {m.jobId && <Button variant="ghost" onClick={() => nav(`/goods/job/${m.jobId}`)}>{jb('open_job')}</Button>}
        {msg && <p className="rounded-[14px] bg-success-tint px-3 py-2 text-[14px] text-success">{msg}</p>}
        {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
      </div>

      {mineToCheck && pending.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface px-4 py-3 pb-[calc(12px+var(--safe-bottom))]">
          <Button block size="lg" loading={busy} disabled={pending.some((l) => !(Number(vals[l.line_id]) > 0))} onClick={() => void submit()}>{s('confirm')}</Button>
        </div>
      )}
    </div>
  );
}
