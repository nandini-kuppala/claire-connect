// An order's goods (slice 8b, 03 J8/J15): what was ordered, sent, received, on the way and returned; the seller sends
// goods against it, the buyer returns some, and a job-work order sends material and shows the work coming back.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText, ApiError } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, ChevronRight, Truck, Repeat, Send, CircleCheck, Clock, AlertCircle } from '../../icons';
import { useSession } from '../../store/session';
import { todayIST } from '@shared/sc/dates';
import { OrderGoodsS } from './OrderGoods.strings';
import { SpecPicker } from './SpecPicker';
import { clientId, qty as fmtQty, qtyNum, shortDate } from './format';
import type { ResolvedSpec } from './types';

interface Delivery { movement_id: string; sent: number; received: number | null; sent_on: string; state: 'on_the_way' | 'received' | 'different'; dc_no: string | null; items: { spec_id: string; label: string; qty: number }[] }
interface Progress { ordered: number; dim: string; sent: number; received: number; on_the_way: number; returned: number; done: number; opening: number; deliveries: Delivery[]; returns: { movement_id: string; qty: number; on: string; reason: string | null }[]; jobs: { id: string; status: string; back: number }[] }
interface Order { id: string; code: string; kind: string; title: string; qty: number; unit: string; status: string; delivered_at: number | null; side: 'buyer' | 'seller'; buyer: string; seller: string; dim: string; on_goods: boolean }
type Reason = 'wrong_size' | 'defect' | 'other';
const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';

export default function OrderGoodsScreen() {
  const t = OrderGoodsS.use();
  const nav = useNavigate();
  const { id } = useParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const [o, setO] = useState<Order | null>(null);
  const [p, setP] = useState<Progress | null>(null);
  const [can, setCan] = useState<{ dispatch: boolean; return: boolean; send_material: boolean } | null>(null);
  const [sheet, setSheet] = useState<'send' | 'return' | null>(null);
  const [pick, setPick] = useState(false);
  const [spec, setSpec] = useState<ResolvedSpec | null>(null);
  const [retSpec, setRetSpec] = useState<{ spec_id: string; label: string } | null>(null);
  const [qty, setQty] = useState('');
  const [dc, setDc] = useState('');
  const [reason, setReason] = useState<Reason>('wrong_size');
  const [cid, setCid] = useState(clientId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [short, setShort] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ order: Order; progress: Progress | null; can?: { dispatch: boolean; return: boolean; send_material: boolean } }>(`/api/sc/orders/${id}/goods`);
      setO(r.order); setP(r.progress); setCan(r.can ?? null);
    } catch (e) { setError(errorText(e)); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const other = o ? (o.side === 'buyer' ? o.seller : o.buyer) : '';
  const delivered = p ? p.deliveries.flatMap((d) => d.items).reduce<{ spec_id: string; label: string }[]>((acc, x) => (acc.some((a) => a.spec_id === x.spec_id) ? acc : [...acc, { spec_id: x.spec_id, label: x.label }]), []) : [];
  const open = (k: 'send' | 'return') => {
    setSheet(k); setQty(''); setDc(''); setError(null); setShort(false); setCid(clientId());
    if (k === 'return') setRetSpec(delivered[0] ?? null);
    else if (!spec) setPick(true);
  };
  const flash = (x: string) => { setMsg(x); setTimeout(() => setMsg(null), 3000); };
  const save = async (untracked = false) => {
    if (!o) return;
    setBusy(true); setError(null);
    try {
      if (sheet === 'send' && spec) {
        const unit = spec.units.find((u) => !['rolls', 'cones', 'bundles', 'bags', 'boxes'].includes(u)) ?? spec.units[0];
        await api.post(`/api/sc/orders/${o.id}/dispatch`, { lines: [{ spec_id: spec.spec.id, qty: Number(qty), unit }], ...(dc.trim() ? { dc_no: dc.trim() } : {}), business_date: todayIST(), client_id: cid, ...(untracked ? { allow_untracked: true, untracked_reason: 'Sent against an order' } : {}) });
        flash(t('saved_dispatch', { name: other }));
      } else if (sheet === 'return' && retSpec) {
        await api.post(`/api/sc/orders/${o.id}/return`, { lines: [{ spec_id: retSpec.spec_id, qty: Number(qty), unit: o.dim === 'mass' ? 'kg' : o.dim === 'length' ? 'm' : 'pcs' }], reason, business_date: todayIST(), client_id: cid });
        flash(t('saved_return'));
      }
      setSheet(null);
      await load();
    } catch (e) {
      if (e instanceof ApiError && (e.body as { code?: string } | undefined)?.code === 'negative') setShort(true);
      else setError(errorText(e));
    } finally { setBusy(false); }
  };

  const stateIcon = (s: Delivery['state']) => (s === 'on_the_way' ? <Clock size={16} className="text-accent-ink" aria-hidden /> : s === 'different' ? <AlertCircle size={16} className="text-accent-ink" aria-hidden /> : <CircleCheck size={16} className="text-success" aria-hidden />);
  const pct = p && p.ordered ? Math.min(100, Math.round((p.done / p.ordered) * 100)) : 0;
  const q = (n: number) => fmtQty(n, o?.dim ?? 'count');

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 truncate font-head text-[20px] font-bold text-ink">{t('title')}</h1>
      </header>

      <div className="px-4 pt-4 lg:grid lg:max-w-[1040px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6">
        <section>
          {o && (
            <div className="rounded-[18px] border border-line bg-surface px-4 py-4">
              <p className="text-[13px] text-meta">{o.code} · {other}</p>
              <p className="mt-0.5 text-[16px] font-semibold text-ink">{o.title}</p>
              {!o.on_goods && <p className="mt-3 text-[14.5px] text-ink-2">{t('not_on_goods', { name: other })}</p>}
              {p && (
                <>
                  <p className="mt-3 font-head text-[22px] font-bold tabular-nums text-ink">{o.kind === 'job_work' ? t('summary_done', { got: qtyNum(p.done, o.dim), qty: q(p.ordered) }) : t('summary', { got: qtyNum(p.received, o.dim), qty: q(p.ordered) })}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${pct}%`}><div className={clsx('h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>
                  <p className="mt-2 text-[14px] text-ink-2">
                    {[p.on_the_way > 0 ? t('summary_way', { qty: q(p.on_the_way), date: shortDate(p.deliveries.filter((d) => d.state === 'on_the_way').at(-1)?.sent_on, lang) }) : null, p.returned > 0 ? t('returned', { qty: q(p.returned) }) : null].filter(Boolean).join(' · ')}
                  </p>
                  {o.delivered_at && <p className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-success"><CircleCheck size={16} aria-hidden />{t('delivered')}</p>}
                </>
              )}
              <div className="mt-4 flex flex-col gap-2">
                {can?.dispatch && <Button block icon={Truck} onClick={() => open('send')}>{t('send_goods')}</Button>}
                {can?.send_material && <Button block icon={Send} onClick={() => nav(`/goods/record/send?order=${o.id}`)}>{t('send_material')}</Button>}
                {can?.return && <Button block variant="ghost" icon={Repeat} onClick={() => open('return')}>{t('return_some')}</Button>}
              </div>
              {can?.dispatch && <p className="mt-2 text-[12.5px] text-meta">{t('send_hint')}</p>}
              {can?.send_material && <p className="mt-2 text-[12.5px] text-meta">{t('send_material_hint', { name: other })}</p>}
            </div>
          )}
          {error && !sheet && <p role="alert" className="mt-3 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </section>

        <section>
          {p && p.deliveries.length > 0 && (
            <>
              <h2 className="mt-5 font-head text-[17px] font-semibold text-ink lg:mt-0">{t('deliveries')}</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {p.deliveries.slice().reverse().map((d) => (
                  <li key={d.movement_id}>
                    <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/movement/${d.movement_id}`)}>
                      {stateIcon(d.state)}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{d.received !== null && d.received !== d.sent ? `${q(d.received)} / ${q(d.sent)}` : q(d.sent)} · {t(`st_${d.state}` as 'st_received')}</span>
                        <span className="block text-[12.5px] text-meta">{[t('sent_on', { date: shortDate(d.sent_on, lang) }), d.dc_no ? t('dc', { no: d.dc_no }) : null, d.items.map((x) => x.label).join(', ')].filter(Boolean).join(' · ')}</span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {p && p.returns.length > 0 && (
            <>
              <h2 className="mt-5 font-head text-[17px] font-semibold text-ink">{t('returns')}</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {p.returns.map((r) => (
                  <li key={r.movement_id}>
                    <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/movement/${r.movement_id}`)}>
                      <Repeat size={16} className="text-ink-2" aria-hidden />
                      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{q(r.qty)}</span><span className="block text-[12.5px] text-meta">{[shortDate(r.on, lang), r.reason].filter(Boolean).join(' · ')}</span></span>
                      <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {p && o?.kind === 'job_work' && (p.jobs.length > 0 || p.opening > 0) && (
            <>
              <h2 className="mt-5 font-head text-[17px] font-semibold text-ink">{t('jobs')}</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {p.opening > 0 && <li className="px-4 py-3 text-[14px] text-ink-2">{t('opening', { qty: q(p.opening) })}</li>}
                {p.jobs.map((j) => (
                  <li key={j.id}>
                    <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/job/${j.id}`)}>
                      <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{t('job_back', { qty: q(j.back) })}</span>
                      <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {msg && <div role="status" className="fixed inset-x-0 bottom-[calc(96px+var(--safe-bottom))] z-40 mx-auto w-[calc(100%-32px)] max-w-[448px] rounded-[18px] bg-ink px-4 py-3 text-[14px] text-white shadow-[var(--shadow-float)] lg:inset-x-auto lg:bottom-8 lg:right-8 lg:mx-0 lg:w-[420px]">{msg}</div>}

      <Sheet open={sheet !== null && !pick} onClose={() => setSheet(null)} title={sheet === 'return' ? t('return_some') : t('send_goods')}
        footer={<Button block size="lg" loading={busy} disabled={!(Number(qty) > 0) || (sheet === 'send' ? !spec : !retSpec)} onClick={() => void save(short)}>{sheet === 'return' ? t('return_some') : t('send_goods')}</Button>}>
        <div className="space-y-4 pb-2">
          {sheet === 'send' && (
            <button className="flex min-h-12 w-full items-center gap-3 rounded-[16px] border border-line-strong bg-surface px-3.5 text-left" onClick={() => setPick(true)}>
              <span className="min-w-0 flex-1"><span className="block text-[12.5px] text-meta">{t('what')}</span><span className="block text-[15px] font-semibold text-ink">{spec?.spec.label_en ?? '—'}</span></span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
          )}
          {sheet === 'return' && (
            <div><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('what')}</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup">
                {delivered.map((x) => <button key={x.spec_id} role="radio" aria-checked={retSpec?.spec_id === x.spec_id} onClick={() => setRetSpec(x)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', retSpec?.spec_id === x.spec_id ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{x.label}</button>)}
              </div>
            </div>
          )}
          <label className="block w-40"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('how_many')} ({o?.dim === 'mass' ? 'kg' : o?.dim === 'length' ? 'm' : 'pcs'})</span>
            <input className={inputCls + ' text-right font-head font-bold tabular-nums'} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} /></label>
          {sheet === 'send' && <label className="block"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('dc_no')}</span><input className={inputCls} value={dc} maxLength={30} onChange={(e) => setDc(e.target.value)} /></label>}
          {sheet === 'return' && (
            <div><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('reason')}</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup">
                {(['wrong_size', 'defect', 'other'] as Reason[]).map((r) => <button key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', reason === r ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{t(`r_${r}` as 'r_defect')}</button>)}
              </div>
            </div>
          )}
          {short && <p className="rounded-[14px] bg-accent-tint px-3 py-2 text-[14px] text-accent-ink">{t('short')}</p>}
          {error && <p role="alert" className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </div>
      </Sheet>
      <SpecPicker open={pick} onClose={() => setPick(false)} onPick={(x) => { setSpec(x); setPick(false); }} />
    </div>
  );
}
