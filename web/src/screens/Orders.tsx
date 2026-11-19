// Orders: Active / Completed (plus Buying / Selling when the business does both).
// Each row shows the garment, counterpart, code · qty, amount, one status pill and a five-step progress line.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, RefreshCw } from '../icons';
import { api } from '../lib/api';
import { statusLabel, strings } from '../cards/strings';
import { GarmentArt } from '../components/GarmentArt';
import { Button } from '../components/Button';
import { CATEGORIES, catById } from '../../../shared/taxonomy';
import { ErrorBar, errMsg, inr, listOf, normOrder, statusStyle, useMe, type Order } from '../desk/kit';
import { OrdersS } from './Orders.strings';

type Tab = 'active' | 'completed';
type Side = 'all' | 'buying' | 'selling';
const DONE = new Set(['closed', 'balance_paid', 'cancelled']);

// confirmed → production → dispatched → delivered → paid
const STEP_KEYS = ['step_confirmed', 'step_production', 'step_dispatched', 'step_delivered', 'step_paid'] as const;
function stepOf(status: string): number | null {
  switch (status) {
    case 'confirmed':
    case 'advance_paid':
    case 'payment_confirmed':
      return 0;
    case 'in_production':
      return 1;
    case 'dispatched':
      return 2;
    case 'delivered':
      return 3;
    case 'balance_paid':
    case 'closed':
      return 4;
    default:
      return null; // cancelled / disputed: no progress line
  }
}

const THUMB_COLOURS = ['#1F8C73', '#B9502F', '#C98A2B', '#3C4247', '#E8E1D3', '#2F7A47'];
function artFor(o: Order) {
  const cat = catById(o.category) ?? CATEGORIES.find((c) => c.keywords.some((k) => o.title.toLowerCase().includes(k)));
  let h = 0;
  for (const ch of o.title || o.code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { shape: cat?.shape ?? 'tshirt', color: THUMB_COLOURS[h % THUMB_COLOURS.length] };
}

export default function Orders() {
  const s = OrdersS.use();
  const nav = useNavigate();
  const { business, lang } = useMe();
  const ct = strings(lang);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('active');
  const [side, setSide] = useState<Side>('all');

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.get('/api/orders');
      const list = listOf(r, 'orders').map(normOrder);
      list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setOrders(list);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sideOf = useCallback(
    (o: Order): 'buying' | 'selling' => (o.side ? (o.side === 'buyer' ? 'buying' : 'selling') : business && o.sellerBusinessId === business.id ? 'selling' : 'buying'),
    [business],
  );
  const hasBoth = useMemo(() => {
    const sides = new Set(orders.map(sideOf));
    return sides.size > 1;
  }, [orders, sideOf]);

  const bySide = useMemo(() => (side === 'all' || !hasBoth ? orders : orders.filter((o) => sideOf(o) === side)), [orders, side, hasBoth, sideOf]);
  const groups = useMemo(() => {
    const g: Record<Tab, Order[]> = { active: [], completed: [] };
    for (const o of bySide) g[DONE.has(o.status) ? 'completed' : 'active'].push(o);
    return g;
  }, [bySide]);
  const list = groups[tab];

  const unitWord = (u: string) => (u === 'kg' ? s('kg') : u === 'dozen' ? s('dozen') : s('pcs'));

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-4 pb-1 pt-[max(18px,var(--safe-top))]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-head text-[28px] font-bold leading-tight text-ink">{s('title')}</h1>
          <button
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:bg-sunken"
            onClick={() => { setLoading(true); void load(); }}
            aria-label={s('refresh')}
          >
            <RefreshCw size={18} className={loading && orders.length ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Active / Completed */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-sunken p-1" role="tablist">
          {(['active', 'completed'] as Tab[]).map((k) => {
            const on = tab === k;
            const n = groups[k].length;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(k)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-[15px] font-semibold transition-colors ${on ? 'bg-surface text-primary shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink-2'}`}
              >
                {s(k)}
                {n > 0 && (
                  <span className={`min-w-6 rounded-full px-1.5 text-[12px] leading-6 tabular-nums ${on ? 'bg-primary-tint text-primary' : 'bg-page text-meta'}`}>{n}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Buying / Selling (only when the business does both) */}
        {hasBoth && (
          <div className="mt-3 flex gap-2">
            {(['all', 'buying', 'selling'] as Side[]).map((k) => {
              const on = side === k;
              return (
                <button
                  key={k}
                  onClick={() => setSide(k)}
                  aria-pressed={on}
                  className={`min-h-10 rounded-full border px-4 text-[14px] font-medium transition-colors ${on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-sunken'}`}
                >
                  {s(k)}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {error && <ErrorBar message={error} onRetry={load} retryLabel={s('retry')} />}

      {loading && !orders.length ? (
        <ul className="space-y-3 px-4 pt-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3 rounded-[22px] border border-line bg-surface p-4">
              <span className="size-[60px] shrink-0 animate-pulse rounded-[16px] bg-sunken" />
              <span className="flex-1 space-y-2 pt-1">
                <span className="block h-4 w-2/3 animate-pulse rounded-full bg-sunken" />
                <span className="block h-3 w-1/2 animate-pulse rounded-full bg-sunken" />
                <span className="block h-2 w-full animate-pulse rounded-full bg-sunken" />
              </span>
            </li>
          ))}
        </ul>
      ) : list.length ? (
        <ul className="space-y-3 px-4 pb-6 pt-4">
          {list.map((o) => (
            <OrderRow
              key={o.id}
              o={o}
              counterpart={o.counterpartName ?? (sideOf(o) === 'buying' ? o.sellerName : o.buyerName) ?? '—'}
              statusText={statusLabel(o.status, ct)}
              qtyText={`${o.qty.toLocaleString('en-IN')} ${unitWord(o.unit)}`}
              kindText={o.kind === 'sample' ? s('sample') : o.kind === 'job_work' ? s('job') : null}
              stepText={(n) => s('progress', { n: n + 1, step: s(STEP_KEYS[n]) })}
              openLabel={s('open_chat')}
              onOpen={o.conversationId ? () => nav(`/chat/${o.conversationId}`) : undefined}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center px-8 pb-10 pt-16 text-center">
          <p className="font-head text-[18px] font-semibold text-ink">{tab === 'active' ? s('empty_active') : s('empty_done')}</p>
          <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-meta">{tab === 'active' ? s('empty_active_sub') : s('empty_done_sub')}</p>
          {tab === 'active' && (
            <Button className="mt-5" onClick={() => nav('/')}>
              {s('find')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function OrderRow({
  o, counterpart, statusText, qtyText, kindText, stepText, openLabel, onOpen,
}: {
  o: Order; counterpart: string; statusText: string; qtyText: string; kindText: string | null;
  stepText: (n: number) => string; openLabel: string; onOpen?: () => void;
}) {
  const art = artFor(o);
  const st = statusStyle(o.status);
  const step = stepOf(o.status);
  return (
    <li>
      <button
        className="block w-full rounded-[22px] border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong active:bg-page disabled:cursor-default"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={onOpen ? `${counterpart} · ${o.code} · ${openLabel}` : undefined}
      >
        <span className="flex gap-3">
          <span className="size-[60px] shrink-0 overflow-hidden rounded-[16px] bg-sunken">
            <GarmentArt shape={art.shape} color={art.color} size={60} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1 truncate font-head text-[16px] font-semibold leading-snug text-ink">{counterpart}</span>
              <span className="shrink-0 font-head text-[16px] font-bold tabular-nums text-ink">{inr(o.total)}</span>
            </span>
            <span className="mt-0.5 block truncate text-[14px] text-ink-2">{o.title}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-meta">
              <span className="truncate tabular-nums">{o.code} · {qtyText}</span>
              {kindText && <span className="shrink-0 rounded-full bg-sunken px-2 text-[11px] font-semibold leading-5 text-ink-2">{kindText}</span>}
            </span>
          </span>
          {onOpen && <ChevronRight size={18} className="mt-0.5 shrink-0 self-center text-faint" aria-hidden />}
        </span>

        <span className="mt-3 flex items-center gap-3">
          <span className="inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[12px] font-semibold" style={{ background: st.bg, color: st.fg }}>
            {statusText}
          </span>
          {step != null && (
            <span className="flex flex-1 gap-1" role="img" aria-label={stepText(step)}>
              {STEP_KEYS.map((k, i) => (
                <span key={k} className={`h-1.5 flex-1 rounded-full ${i <= step ? (step === 4 ? 'bg-success' : 'bg-primary') : 'bg-sunken'}`} />
              ))}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
