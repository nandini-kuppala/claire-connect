// One party's bills and payments (slice 8a, 03 S14): billed − settled each way, the items behind it, and Record payment
// (paid, received, or a set-off when both work for each other). Record only; voiding a wrong entry, never deleting.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, IndianRupee } from '../../icons';
import { useSession } from '../../store/session';
import { todayIST } from '@shared/sc/dates';
import { MoneyS, inr } from './Money.strings';
import { clientId, shortDate } from './format';
import type { Bal } from './ReportsScreen';

interface Item { dir: 'i_owe' | 'they_owe'; date: string; label: string; qty: string | null; rate_paise: number | null; amount_paise: number; source: { kind: 'job' | 'movement'; id: string }; note?: string }
interface Settle { id: string; dir: 'paid' | 'received' | 'setoff'; amount_paise: number; mode: string; ref: string | null; business_date: string; mine: boolean }
type Dir = 'paid' | 'received' | 'setoff';
type Mode = 'cash' | 'upi' | 'neft' | 'cheque';
const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';

export default function BillScreen() {
  const m = MoneyS.use();
  const nav = useNavigate();
  const { k, id } = useParams();
  const lang = useSession((st) => st.user?.language || 'en');
  const [bal, setBal] = useState<Bal | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sets, setSets] = useState<Settle[]>([]);
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<Dir>('paid');
  const [amt, setAmt] = useState('');
  const [mode, setMode] = useState<Mode>('upi');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(todayIST());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sure, setSure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ balance: Bal | null; items: Item[]; settlements: Settle[] }>(`/api/sc/bills/${k}/${id}`);
      setBal(r.balance); setItems(r.items); setSets(r.settlements);
    } catch (e) { setError(errorText(e)); }
  }, [k, id]);
  useEffect(() => { void load(); }, [load]);

  const both = !!bal && bal.balance_i_owe > 0 && bal.balance_they_owe > 0;
  const setoffMax = both ? Math.min(bal!.balance_i_owe, bal!.balance_they_owe) : 0;
  const start = () => {
    const d: Dir = bal && bal.balance_they_owe > bal.balance_i_owe ? 'received' : 'paid';
    setDir(d); setAmt(bal ? String(Math.max(0, (d === 'paid' ? bal.balance_i_owe : bal.balance_they_owe)) / 100 || '') : ''); setRef(''); setDate(todayIST()); setError(null); setOpen(true);
  };
  const pickDir = (d: Dir) => {
    setDir(d);
    if (!bal) return;
    const v = d === 'setoff' ? setoffMax : d === 'paid' ? bal.balance_i_owe : bal.balance_they_owe;
    setAmt(v > 0 ? String(v / 100) : '');
  };
  const paise = Math.round(Number(amt) * 100);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.post('/api/sc/settlements', { party: { k, id }, direction: dir, amount_paise: paise, mode: dir === 'setoff' ? 'adjustment' : mode, ...(ref.trim() ? { ref: ref.trim() } : {}), business_date: date, client_id: clientId() });
      setOpen(false); setMsg(m('saved')); setTimeout(() => setMsg(null), 2500);
      await load();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const voidIt = async (sid: string) => {
    setSure(null);
    try { await api.post(`/api/sc/settlements/${sid}/void`, {}); setMsg(m('voided')); setTimeout(() => setMsg(null), 2500); await load(); } catch (e) { setError(errorText(e)); }
  };
  const go = (it: Item) => nav(it.source.kind === 'job' ? `/goods/job/${it.source.id}` : `/goods/movement/${it.source.id}`);

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 truncate font-head text-[20px] font-bold text-ink">{bal?.name ?? m('bills')}</h1>
      </header>

      <div className="px-4 pt-4 lg:grid lg:max-w-[1040px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-6">
        <section>
          {bal && (
            <div className="rounded-[18px] border border-line bg-surface px-4 py-4">
              <p className={clsx('font-head text-[24px] font-bold tabular-nums', bal.net > 0 ? 'text-success' : bal.net < 0 ? 'text-accent-ink' : 'text-meta')}>
                {bal.net === 0 ? m('settled') : bal.net > 0 ? m('net_they', { amt: inr(bal.net) }) : m('net_me', { amt: inr(-bal.net) })}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
                {bal.they_owe > 0 && <><dt className="text-ink-2">{m('they_owe')}</dt><dd className="text-right tabular-nums text-ink">{inr(bal.balance_they_owe)}</dd></>}
                {bal.i_owe > 0 && <><dt className="text-ink-2">{m('i_owe')}</dt><dd className="text-right tabular-nums text-ink">{inr(bal.balance_i_owe)}</dd></>}
                {bal.paid > 0 && <><dt className="text-meta">{m('paid')}</dt><dd className="text-right tabular-nums text-meta">{inr(bal.paid)}</dd></>}
                {bal.received > 0 && <><dt className="text-meta">{m('received')}</dt><dd className="text-right tabular-nums text-meta">{inr(bal.received)}</dd></>}
                {bal.setoff > 0 && <><dt className="text-meta">{m('setoff')}</dt><dd className="text-right tabular-nums text-meta">{inr(bal.setoff)}</dd></>}
              </dl>
              {bal.oldest_unpaid_days !== null && <p className="mt-2 text-[13.5px] font-semibold text-accent-ink">{m('oldest', { n: bal.oldest_unpaid_days })}</p>}
              {bal.unpriced > 0 && <p className="mt-1 text-[13px] text-meta">{m('unpriced', { n: bal.unpriced })}</p>}
              <div className="mt-4"><Button block icon={IndianRupee} onClick={start}>{m('record_payment')}</Button></div>
              <p className="mt-2 text-[12.5px] text-meta">{m('record_only')}</p>
            </div>
          )}
          {error && !open && <p role="alert" className="mt-3 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
          {sets.length > 0 && (
            <>
              <h2 className="mt-5 font-head text-[17px] font-semibold text-ink">{m('payments')}</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {sets.slice().reverse().map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold text-ink">{x.dir === 'paid' ? m('paid') : x.dir === 'received' ? m('received') : m('setoff')}</span>
                      <span className="block text-[12.5px] text-meta">{[shortDate(x.business_date, lang), m(`m_${x.mode}` as 'm_cash'), x.ref].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="shrink-0 font-head font-bold tabular-nums text-ink">{inr(x.amount_paise)}</span>
                    {x.mine && <button className={clsx('min-h-9 shrink-0 rounded-full px-2 text-[12.5px] font-semibold hover:bg-sunken', sure === x.id ? 'bg-danger-tint text-danger' : 'text-ink-2')} onClick={() => (sure === x.id ? void voidIt(x.id) : setSure(x.id))}>{sure === x.id ? m('void_sure') : m('void')}</button>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <h2 className="mt-5 font-head text-[17px] font-semibold text-ink lg:mt-0">{m('items')}</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {items.slice().reverse().slice(0, 60).map((it, i) => (
              <li key={`${it.source.id}:${i}`}>
                <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken" onClick={() => go(it)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-ink">{it.label}</span>
                    <span className="block text-[12.5px] text-meta">{[shortDate(it.date, lang), it.qty, it.rate_paise !== null ? `@ ${inr(it.rate_paise)}` : null, it.note === 'no_rate' ? m('no_rate') : it.note === 'leftover_kept' ? m('leftover_kept') : null, it.dir === 'they_owe' ? m('they_owe') : m('i_owe')].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={clsx('shrink-0 font-head font-bold tabular-nums', it.note === 'no_rate' ? 'text-meta' : 'text-ink')}>{it.note === 'no_rate' ? '—' : inr(it.amount_paise)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {msg && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(96px+var(--safe-bottom))] z-40 mx-auto w-[calc(100%-32px)] max-w-[448px] rounded-[18px] bg-ink px-4 py-3 text-[14px] text-white shadow-[var(--shadow-float)] lg:inset-x-auto lg:bottom-8 lg:right-8 lg:mx-0 lg:w-[420px]">{msg}</div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={m('record_payment')}
        footer={<Button block size="lg" loading={busy} disabled={!(paise > 0) || (dir === 'setoff' && paise > setoffMax)} onClick={() => void save()}>{m('record_payment')}</Button>}>
        <div className="space-y-4 pb-2">
          <div className="flex flex-col gap-1.5" role="radiogroup">
            {(['paid', 'received', ...(both ? ['setoff'] : [])] as Dir[]).map((d) => (
              <button key={d} role="radio" aria-checked={dir === d} onClick={() => pickDir(d)}
                className={clsx('min-h-12 rounded-[14px] border px-3.5 text-left text-[15px] font-semibold', dir === d ? 'border-primary bg-primary-tint text-ink' : 'border-line-strong bg-surface text-ink')}>{m(`dir_${d}` as 'dir_paid')}</button>
            ))}
          </div>
          {dir === 'setoff' && <p className="text-[13.5px] text-ink-2">{m('setoff_hint', { amt: inr(paise > 0 ? paise : setoffMax) })}</p>}
          <label className="block"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{m('amount')}</span>
            <input className={inputCls + ' font-head font-bold tabular-nums'} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} /></label>
          {dir !== 'setoff' && (
            <div><span className="mb-1 block text-[13px] font-semibold text-ink-2">{m('mode')}</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup">
                {(['upi', 'cash', 'neft', 'cheque'] as Mode[]).map((x) => (
                  <button key={x} role="radio" aria-checked={mode === x} onClick={() => setMode(x)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', mode === x ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{m(`m_${x}` as 'm_cash')}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex-1"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{m('ref')}</span><input className={inputCls} value={ref} maxLength={60} onChange={(e) => setRef(e.target.value)} /></label>
            <label className="w-40"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{m('date')}</span><input type="date" className={inputCls} value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          {error && <p role="alert" className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </div>
      </Sheet>
    </div>
  );
}
