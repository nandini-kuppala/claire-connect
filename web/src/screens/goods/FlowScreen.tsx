// S9 · Flow view (03 §5 S9): for one style or order, where is every piece right now, what is done, what is late, and
// which buyers are still waiting. A stepped list on a phone; the same stages as columns joined by lines on a desktop.
// No Sankey, no chart library. kg and pcs are never added together. Owner only (the server refuses staff).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleDot, Clock, Factory, Layers, Package, Pause, Repeat, Scissors, Shirt, Spool, Store, Truck, Users } from '../../icons';
import type { IconType } from '../../icons';
import { useSession } from '../../store/session';
import { FlowS } from './Flow.strings';
import { qty as fmtQty, shortDate } from './format';

type Dim = 'mass' | 'count' | 'length';
type RowStatus = 'done' | 'late' | 'held' | 'ready' | 'due_today' | 'in_progress';
type Party = { k: 'b' | 'c'; id: string };
interface Row {
  id: string; in_house: boolean; name: string | null; status: RowStatus; late: { status: string; days: number } | null; since: string; expected_at: string;
  dim: Dim; sent: number; good: number; reject: number; out_dim: Dim; at_unit: number; loss: number; waste: number; lots: string[]; sizes: { size: string; qty: number }[]; disputes: number; disputed: number;
}
interface Stage { key: string; labels: Record<string, string> | null; status: RowStatus; late: number; open: number; unit_changing: boolean; totals: { dim: Dim; sent: number; good: number; reject: number; at_unit: number; loss: number }[]; outputs: { dim: Dim; qty: number }[]; waste: { dim: Dim; qty: number }[]; rows: Row[] }
interface Buyer { party: Party; name: string; dim: Dim; sent: number; received: number; on_the_way: number; returned: number; disputed: number; last: string; sizes: { size: string; qty: number }[]; orders: { code: string; ordered: number; done: number; dim: Dim }[]; waiting: boolean; still_needs: number }
interface NowItem { kind: 'at_unit' | 'in_stock' | 'kept_elsewhere' | 'on_the_way' | 'with_buyer' | 'not_received'; name: string | null; dim: Dim; qty: number; late?: boolean; reject?: boolean }
interface Flow {
  today: string;
  run: { kind: 'style' | 'order'; styles: string[]; name: string | null; pieces: number; buyers: number };
  order: { id: string; code: string; title: string; kind: string; side: 'buyer' | 'seller'; other: string; status: string; progress: { ordered: number; dim: Dim; sent: number; received: number; on_the_way: number; returned: number; done: number } } | null;
  now: NowItem[];
  material: { movement_id: string; name: string; date: string; label: string; lot: string | null; dim: Dim; qty: number; confirmed: boolean }[];
  stages: Stage[];
  buyers: Buyer[];
  coming: { job_id: string; name: string | null; dim: Dim; qty: number; expected_at: string; status: RowStatus; late: { status: string; days: number } | null; sizes: { size: string; qty: number }[] }[];
  disputes: { id: string; label: string; difference: number; dim: Dim }[];
  counts: { late: number; held: number; disputes: number; waiting: number };
}
interface Index { runs: { code: string; name: string | null; last: string; jobs: number; open: number; late: number }[]; orders: { id: string; code: string; title: string; side: 'buyer' | 'seller'; other: string; status: string }[] }

type S = ReturnType<typeof FlowS.use>;

/** Status as text + colour + icon (DESIGN_SYSTEM §1 Goods rules). */
const TONE: Record<RowStatus, { cls: string; Icon: IconType }> = {
  done: { cls: 'bg-success-tint text-success', Icon: CheckCircle2 },
  late: { cls: 'bg-accent-tint text-accent-ink', Icon: Clock },
  due_today: { cls: 'bg-accent-tint text-accent-ink', Icon: Clock },
  held: { cls: 'bg-sunken text-ink-2', Icon: Pause },
  ready: { cls: 'bg-primary-tint text-primary-press', Icon: Package },
  in_progress: { cls: 'bg-sunken text-ink-2', Icon: CircleDot },
};
const DOT: Record<RowStatus, string> = { done: 'bg-success-tint text-success', late: 'bg-accent-tint text-accent-ink', due_today: 'bg-accent-tint text-accent-ink', held: 'bg-sunken text-ink-2', ready: 'bg-primary-tint text-primary-press', in_progress: 'bg-sunken text-ink-2' };

function Pill({ tone, Icon, children }: { tone: string; Icon: IconType; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold leading-tight', tone)}>
      <Icon size={14} aria-hidden className="shrink-0" />
      <span>{children}</span>
    </span>
  );
}

function statusText(s: S, st: RowStatus, late: { days: number } | null) {
  return st === 'late' ? s('s_late', { n: late?.days ?? 0 }) : s(`s_${st}` as 's_done');
}
const sizesText = (z: { size: string; qty: number }[]) => z.map((x) => `${x.size} ${x.qty}`).join(' · ');


export default function FlowScreen() {
  const { kind, id } = useParams();
  return kind && id ? <FlowDetail kind={kind === 'order' ? 'order' : 'style'} id={id} /> : <FlowIndex />;
}

// ── Index: pick a style or an order ───────────────────────────────────────────────────────────────

function Header({ title, sub, back }: { title: string; sub?: string; back: () => void }) {
  const s = FlowS.use();
  return (
    <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
      <button className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={back} aria-label={s('back')}>
        <ArrowLeft size={20} />
      </button>
      <div className="min-w-0 flex-1 py-1">
        <h1 className="font-head text-[20px] font-bold leading-tight text-ink">{title}</h1>
        {sub && <p className="text-[13px] text-meta">{sub}</p>}
      </div>
    </header>
  );
}

function FlowIndex() {
  const s = FlowS.use();
  const nav = useNavigate();
  const lang = useSession((st) => st.user?.language || 'en');
  const [d, setD] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.get<Index>('/api/sc/flow').then(setD).catch((e) => setError(errorText(e))); }, []);

  return (
    <div className="pb-28 lg:pb-10">
      <Header title={s('title')} back={() => nav('/goods')} />
      <div className="px-4 pt-4 lg:max-w-[880px]">
        {error && <p role="alert" className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        {!d && !error && <div className="h-24 animate-pulse rounded-[18px] bg-sunken" />}
        {d && d.runs.length === 0 && d.orders.length === 0 && <p className="text-[14.5px] text-ink-2">{s('empty')}</p>}
        {d && d.runs.length > 0 && (
          <>
            <h2 className="font-head text-[17px] font-semibold text-ink">{s('runs')}</h2>
            <p className="mt-0.5 text-[13px] text-meta">{s('runs_hint')}</p>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {d.runs.map((r) => (
                <li key={r.code}>
                  <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/run/style/${encodeURIComponent(r.code)}`)}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold text-ink">{s('style', { code: r.code })}{r.name ? <span className="font-normal text-ink-2"> · {r.name}</span> : null}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-meta">
                        <span>{s('jobs_n', { n: r.jobs })} · {shortDate(r.last, lang)}</span>
                        {r.late > 0 ? <Pill tone={TONE.late.cls} Icon={Clock}>{s('chip_late', { n: r.late })}</Pill>
                          : r.open > 0 ? <Pill tone={TONE.in_progress.cls} Icon={CircleDot}>{s('open_n', { n: r.open })}</Pill>
                          : <Pill tone={TONE.done.cls} Icon={CheckCircle2}>{s('all_back')}</Pill>}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {d && d.orders.length > 0 && (
          <>
            <h2 className="mt-6 font-head text-[17px] font-semibold text-ink">{s('orders')}</h2>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {d.orders.map((o) => (
                <li key={o.id}>
                  <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/run/order/${encodeURIComponent(o.id)}`)}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold text-ink">{s('order', { code: o.code })} · <span className="font-normal">{o.title}</span></span>
                      <span className="block text-[13px] text-meta">{s(o.side === 'seller' ? 'you_sell' : 'you_buy', { name: o.other })}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// ── One run ───────────────────────────────────────────────────────────────────────────────────────

function FlowDetail({ kind, id }: { kind: 'style' | 'order'; id: string }) {
  const s = FlowS.use();
  const nav = useNavigate();
  const lang = useSession((st) => st.user?.language || 'en');
  const [d, setD] = useState<Flow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    setD(null);
    setError(null);
    void api.get<Flow>(`/api/sc/flow/${kind}/${encodeURIComponent(id)}`).then(setD).catch((e) => setError(errorText(e)));
  }, [kind, id]);

  const back = () => (window.history.length > 1 ? nav(-1) : nav('/goods/flow'));
  if (!d) {
    return (
      <div className="pb-28">
        <Header title={kind === 'order' ? s('title') : s('style', { code: id.toUpperCase() })} back={back} />
        <div className="px-4 pt-4">
          {error ? <p role="alert" className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p> : <div className="h-40 animate-pulse rounded-[18px] bg-sunken" />}
        </div>
      </div>
    );
  }

  const title = d.order ? s('order', { code: d.order.code }) : s('style', { code: d.run.styles[0] ?? id }) + (d.run.name ? ` · ${d.run.name}` : '');
  const sub = [d.order?.title, d.run.pieces ? fmtQty(d.run.pieces, 'count') : null, d.run.buyers ? s('buyers_n', { n: d.run.buyers }) : null, s('today', { date: shortDate(d.today, lang) })].filter(Boolean).join(' · ');
  const tabs: { k: Tab; label: string }[] = [{ k: 'overview', label: s('tab_overview') }, { k: 'stages', label: s('tab_stages') }, { k: 'buyers', label: s('tab_buyers') }];

  return (
    <div className="pb-28 lg:pb-10">
      <Header title={title} sub={sub} back={back} />
      <div className="px-4 pt-3 lg:max-w-[880px]">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-sunken p-1">
          {tabs.map((t) => (
            <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
              className={clsx('min-h-11 rounded-full px-2 text-[15px] font-semibold transition-colors', tab === t.k ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink')}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'buyers' && <Progress d={d} s={s} />}
        {tab === 'overview' && <Overview d={d} s={s} lang={lang} nav={nav} more={() => setTab('buyers')} />}
        {tab === 'stages' && <StagesTab d={d} s={s} lang={lang} nav={nav} />}
        {tab === 'buyers' && <BuyersTab d={d} s={s} lang={lang} nav={nav} />}
        {tab !== 'buyers' && <Differences d={d} s={s} nav={nav} />}
      </div>
    </div>
  );
}

type Tab = 'overview' | 'stages' | 'buyers';

/** Pieces of the run, and how many are back from the units (no longer being worked on outside). */
function piecesBack(d: Flow) {
  const total = d.run.pieces;
  const out = d.now.filter((x) => x.kind === 'at_unit' && x.dim === 'count').reduce((a, x) => a + x.qty, 0);
  return { total, back: Math.max(0, total - out) };
}

function Progress({ d, s }: { d: Flow; s: S }) {
  const { total, back } = piecesBack(d);
  const pct = total ? Math.round((back / total) * 100) : 0;
  const c = d.counts;
  return (
    <section className="mt-4 rounded-[20px] border border-primary-soft bg-primary-tint/60 px-4 py-4 sm:flex sm:items-center sm:gap-5">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink-2">{s('progress')}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="font-head text-[30px] font-bold leading-none tabular-nums text-ink">{back.toLocaleString('en-IN')}<span className="text-[20px] text-ink-2"> / {fmtQty(total, 'count')}</span></p>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[14px] font-bold tabular-nums text-success">{pct}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={s('progress_aria', { back, total })}>
          <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-meta">{s('progress_hint')}</p>
      </div>
      {(c.late > 0 || c.held > 0 || c.disputes > 0 || c.waiting > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:w-[200px] sm:flex-col sm:items-start sm:border-l sm:border-primary-soft sm:pl-5">
          {c.late > 0 && <Pill tone={TONE.late.cls} Icon={Clock}>{s('chip_late', { n: c.late })}</Pill>}
          {c.held > 0 && <Pill tone={TONE.held.cls} Icon={Pause}>{s('chip_held', { n: c.held })}</Pill>}
          {c.disputes > 0 && <Pill tone="bg-danger-tint text-danger" Icon={AlertTriangle}>{s('chip_diff', { n: c.disputes })}</Pill>}
          {c.waiting > 0 && <Pill tone="bg-accent-tint text-accent-ink" Icon={Users}>{s('chip_waiting', { n: c.waiting })}</Pill>}
        </div>
      )}
    </section>
  );
}

/** "Where everything is now" as a few big tiles (pieces only; kg is listed below them when present). */
function Overview({ d, s, lang, nav, more }: { d: Flow; s: S; lang: string; nav: (to: string) => void; more: () => void }) {
  const sum = (k: NowItem['kind'], f?: (x: NowItem) => boolean) => d.now.filter((x) => x.dim === 'count' && x.kind === k && (!f || f(x))).reduce((a, x) => a + x.qty, 0);
  const tiles = [
    { k: 'units', qty: sum('at_unit'), label: s('tile_units'), Icon: Scissors, cls: 'bg-primary-tint/60 text-primary-press' },
    { k: 'unit', qty: sum('in_stock', (x) => !x.reject) + sum('kept_elsewhere'), label: s('tile_unit'), Icon: Factory, cls: 'bg-sunken text-ink-2' },
    { k: 'way', qty: sum('on_the_way'), label: s('tile_transit'), Icon: Truck, cls: 'bg-accent-tint text-accent-ink' },
    { k: 'buyers', qty: sum('with_buyer'), label: s('tile_buyers'), Icon: Users, cls: 'bg-success-tint text-success' },
    { k: 'rej', qty: sum('in_stock', (x) => !!x.reject), label: s('tile_rejects'), Icon: Repeat, cls: 'bg-danger-tint text-danger' },
    { k: 'short', qty: sum('not_received'), label: s('tile_short'), Icon: AlertTriangle, cls: 'bg-danger-tint text-danger' },
  ].filter((t) => t.qty > 0);
  const total = tiles.reduce((a, t) => a + t.qty, 0);
  const other = d.now.filter((x) => x.dim !== 'count');
  return (
    <>
      <section className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-head text-[18px] font-semibold text-ink">{s('now')}</h2>
          {total > 0 && <span className="text-[14px] text-meta">{s('total', { qty: fmtQty(total, 'count') })}</span>}
        </div>
        {d.now.length === 0 && <p className="mt-2 text-[14.5px] text-ink-2">{s('nothing_now')}</p>}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.k} className={clsx('rounded-[18px] px-3.5 py-3', t.cls)}>
              <t.Icon size={22} aria-hidden />
              <p className="mt-1.5 font-head text-[24px] font-bold leading-none tabular-nums text-ink">{fmtQty(t.qty, 'count')}</p>
              <p className="mt-1 text-[14px] font-medium text-ink-2">{t.label}</p>
            </div>
          ))}
        </div>
        {other.length > 0 && (
          <p className="mt-2 text-[13.5px] text-ink-2">{other.map((x) => `${fmtQty(x.qty, x.dim)} ${x.kind === 'at_unit' ? s('at_unit', { name: x.name ?? '—' }) : x.kind === 'in_stock' ? s('in_stock') : x.name ?? ''}`).join(' · ')}</p>
        )}
      </section>

      {d.coming.length > 0 && (
        <section className="mt-5">
          <h2 className="font-head text-[18px] font-semibold text-ink">{s('coming')}</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {d.coming.map((c) => (
              <li key={c.job_id}>
                <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/job/${c.job_id}`)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{c.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-head text-[15px] font-bold tabular-nums text-ink">{fmtQty(c.qty, c.dim)}</span>
                      <Pill tone={TONE[c.status].cls} Icon={TONE[c.status].Icon}>{statusText(s, c.status, c.late)}</Pill>
                      <span className="text-[13px] text-meta">{s('expected', { date: shortDate(c.expected_at, lang) })}</span>
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.order && <OrderCard d={d} s={s} />}

      {d.buyers.length > 0 && (
        <section className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-head text-[18px] font-semibold text-ink">{s('buyers_count', { n: d.buyers.length })}</h2>
            <button className="inline-flex min-h-11 items-center gap-1 text-[14.5px] font-semibold text-primary" onClick={more}>{s('view_all')}<ArrowRight size={16} aria-hidden /></button>
          </div>
          <ul className="mt-1 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {d.buyers.slice(0, 3).map((b) => (
              <li key={`${b.party.k}:${b.party.id}`}>
                <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/party/${b.party.k}/${b.party.id}`)}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-ink-2"><Store size={20} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{b.name}</span>
                    <span className="block text-[13.5px] text-ink-2">{b.sent ? s('sent_recv', { sent: fmtQty(b.sent, b.dim), received: fmtQty(b.received, b.dim) }) : s('nothing_sent')}</span>
                    <BuyerPill b={b} s={s} />
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function BuyerPill({ b, s }: { b: Buyer; s: S }) {
  if (b.disputed > 0) return <span className="mt-1 inline-flex"><Pill tone="bg-danger-tint text-danger" Icon={AlertTriangle}>{s('st_diff', { qty: fmtQty(b.disputed, b.dim) })}</Pill></span>;
  if (b.on_the_way > 0) return <span className="mt-1 inline-flex"><Pill tone="bg-accent-tint text-accent-ink" Icon={Truck}>{s('st_on_the_way', { qty: fmtQty(b.on_the_way, b.dim) })}</Pill></span>;
  const need = b.orders.find((o) => o.ordered > o.done);
  if (need) return <span className="mt-1 inline-flex"><Pill tone="bg-accent-tint text-accent-ink" Icon={Clock}>{s('st_needs', { qty: fmtQty(need.ordered - need.done, need.dim), code: need.code })}</Pill></span>;
  if (b.sent > 0) return <span className="mt-1 inline-flex"><Pill tone={TONE.done.cls} Icon={CheckCircle2}>{s('st_received')}</Pill></span>;
  return null;
}

function Differences({ d, s, nav }: { d: Flow; s: S; nav: (to: string) => void }) {
  if (!d.disputes.length) return null;
  return (
    <section className="mt-5 overflow-hidden rounded-[18px] border border-danger/25 bg-danger-tint">
      <h2 className="flex items-center gap-2 px-4 pt-3 font-head text-[17px] font-semibold text-ink"><AlertTriangle size={20} className="text-danger" aria-hidden />{s('disputes_n', { n: d.disputes.length })}</h2>
      <ul className="pb-1">
        {d.disputes.map((x) => (
          <li key={x.id}>
            <button className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left" onClick={() => nav(`/goods/dispute/${x.id}`)}>
              <span className="min-w-0 flex-1 text-[14.5px] text-ink-2">{x.label} · <span className="font-semibold tabular-nums text-danger">{fmtQty(Math.abs(x.difference), x.dim)}</span></span>
              <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BuyersTab({ d, s, lang, nav }: { d: Flow; s: S; lang: string; nav: (to: string) => void }) {
  if (!d.buyers.length) return <p className="mt-5 text-[14.5px] text-ink-2">{s('no_buyers')}</p>;
  const pcs = d.buyers.filter((b) => b.dim === 'count');
  const tot = (f: (b: Buyer) => number) => pcs.reduce((a, b) => a + f(b), 0);
  const stats = [
    { label: s('b_received'), qty: tot((b) => b.received), Icon: CheckCircle2, cls: 'bg-success-tint text-success' },
    { label: s('b_transit'), qty: tot((b) => b.on_the_way), Icon: Truck, cls: 'bg-accent-tint text-accent-ink' },
    { label: s('b_diff'), qty: tot((b) => b.disputed), Icon: AlertTriangle, cls: 'bg-danger-tint text-danger' },
  ];
  return (
    <>
      <section className="mt-4 grid grid-cols-3 gap-2 rounded-[20px] border border-line bg-surface p-2.5">
        {stats.map((x) => (
          <div key={x.label} className={clsx('rounded-[14px] px-2 py-2.5 text-center', x.cls)}>
            <x.Icon size={20} className="mx-auto" aria-hidden />
            <p className="mt-1 font-head text-[19px] font-bold tabular-nums text-ink">{fmtQty(x.qty, 'count')}</p>
            <p className="text-[12.5px] font-medium">{x.label}</p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-[13px] text-meta">{s('buyers_hint')}</p>
      <ul className="mt-2 space-y-3">
        {d.buyers.map((b) => {
          const pct = b.sent ? Math.round((b.received / b.sent) * 100) : 0;
          return (
            <li key={`${b.party.k}:${b.party.id}`} className="rounded-[18px] border border-line bg-surface p-4">
              <button className="flex w-full items-start gap-3 text-left" onClick={() => nav(`/goods/party/${b.party.k}/${b.party.id}`)}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-ink-2"><Store size={20} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold text-ink">{b.name}</span>
                  <span className="block text-[13px] text-meta">{b.last ? shortDate(b.last, lang) : ''}{b.sizes.length ? ` · ${sizesText(b.sizes)}` : ''}</span>
                  <BuyerPill b={b} s={s} />
                </span>
                <ChevronRight size={18} className="mt-2 shrink-0 text-meta" aria-hidden />
              </button>
              {b.sent > 0 && (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken"><div className={clsx('h-full rounded-full', b.on_the_way ? 'bg-accent' : 'bg-success')} style={{ width: `${b.on_the_way && !b.received ? 12 : pct}%` }} /></div>
                    <span className="text-[13px] tabular-nums text-ink-2">{b.received.toLocaleString('en-IN')} / {fmtQty(b.sent, b.dim)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[[s('b_sent'), b.sent, 'bg-sunken'], [s('b_received'), b.received, 'bg-success-tint'], [s('b_transit'), b.on_the_way, 'bg-accent-tint'], [s('b_diff'), b.disputed, 'bg-danger-tint']].map(([l, q, c]) => (
                      <div key={l as string} className={clsx('rounded-[12px] px-3 py-2', c as string)}>
                        <p className="text-[12.5px] font-medium text-ink-2">{l as string}</p>
                        <p className="font-head text-[16px] font-bold tabular-nums text-ink">{fmtQty(q as number, b.dim)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ── Stage by stage: a vertical timeline of cards; open stages show their units ────────────────────

interface Col { key: string; title: string; status: RowStatus; Icon: IconType; pill: string; summary: string; body: React.ReactNode }

function StagesTab({ d, s, lang, nav }: { d: Flow; s: S; lang: string; nav: (to: string) => void }) {
  const cols: Col[] = [];
  if (d.material.length) {
    const allIn = d.material.every((m) => m.confirmed);
    const m0 = d.material[0];
    cols.push({
      key: 'material', title: s('material'), status: allIn ? 'done' : 'in_progress', Icon: Spool, pill: allIn ? s('confirmed') : s('not_confirmed'),
      summary: [d.material.map((m) => fmtQty(m.qty, m.dim)).join(' + '), s('material_row', { name: m0.name, date: shortDate(m0.date, lang) })].join(' · '),
      body: d.material.map((m) => (
        <button key={`${m.movement_id}:${m.lot}`} className="mt-2 block min-h-11 w-full rounded-[12px] bg-sunken/70 px-3 py-2 text-left text-[14px] hover:bg-sunken" onClick={() => nav(`/goods/movement/${m.movement_id}`)}>
          <span className="block font-semibold text-ink"><span className="font-head tabular-nums">{fmtQty(m.qty, m.dim)}</span> · {m.label}</span>
          <span className="block text-ink-2">{s('material_row', { name: m.name, date: shortDate(m.date, lang) })}{m.lot ? ` · ${s('lot', { lot: m.lot })}` : ''}</span>
        </button>
      )),
    });
  }
  for (const st of d.stages) {
    const title = st.labels?.[lang] ?? st.labels?.en ?? st.key;
    const status: RowStatus = st.status === 'done' ? 'done' : st.late ? 'late' : st.status;
    const pill = st.status === 'done' ? s('s_done') : st.late ? s('stage_late', { n: st.late }) : s('stage_open', { n: st.open });
    const t = st.totals[0];
    const summary = !t ? '' : st.unit_changing
      ? s('rec_cut', { sent: fmtQty(t.sent, t.dim), out: st.outputs.map((o) => fmtQty(o.qty, o.dim)).join(' + ') || '0', waste: st.waste.map((w) => fmtQty(w.qty, w.dim)).join(' + ') || fmtQty(0, 'mass') })
      : [s('row_sent', { qty: fmtQty(t.sent, t.dim) }), s('row_back', { qty: fmtQty(t.good, t.dim) }), t.reject ? s('row_reject', { qty: fmtQty(t.reject, t.dim) }) : null, t.at_unit ? s('row_at', { qty: fmtQty(t.at_unit, t.dim) }) : null].filter(Boolean).join(' · ');
    cols.push({
      key: st.key, title, status, Icon: st.key === 'cutting' ? Scissors : st.key === 'packing' ? Package : st.key === 'stitching' ? Shirt : Layers, pill, summary,
      body: (
        <>
          {st.rows.map((r) => <StageRow key={r.id} r={r} s={s} lang={lang} nav={nav} />)}
          {st.totals.filter(() => !st.unit_changing).map((x) => (
            <p key={x.dim} className="mt-2 text-[13px] text-meta">{s('rec', { sent: fmtQty(x.sent, x.dim), good: fmtQty(x.good, x.dim), reject: fmtQty(x.reject, x.dim), at: fmtQty(x.at_unit, x.dim), loss: fmtQty(x.loss, x.dim) })}</p>
          ))}
        </>
      ),
    });
  }
  if (d.buyers.length) {
    const sent = d.buyers.reduce((a, b) => a + (b.dim === 'count' ? b.sent : 0), 0);
    const waiting = d.buyers.filter((b) => b.waiting).length;
    cols.push({
      key: 'dispatch', title: s('dispatch'), status: waiting ? 'in_progress' : 'done', Icon: Truck, pill: waiting ? s('chip_waiting', { n: waiting }) : s('st_received'),
      summary: `${fmtQty(sent, 'count')} ${s('sent_word')} · ${s('buyers_n', { n: d.buyers.length })}`, body: null,
    });
  }
  const [open, setOpen] = useState<Set<string>>(() => new Set(cols.filter((c) => c.status !== 'done' && c.body).map((c) => c.key)));
  if (!cols.length) return null;
  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-head text-[18px] font-semibold text-ink">{s('stages')}</h2>
        <span className="text-[13px] text-meta">{s('stages_hint')}</span>
      </div>
      <ol className="mt-3">
        {cols.map((c, i) => {
          const isOpen = open.has(c.key) && !!c.body;
          const dot = c.status === 'done' ? 'bg-success text-white' : c.status === 'late' ? 'bg-accent text-white' : 'border-2 border-line-strong bg-surface text-ink-2';
          return (
            <li key={c.key} className="relative grid grid-cols-[30px_minmax(0,1fr)] gap-x-3 pb-3">
              {i < cols.length - 1 && <span aria-hidden className={clsx('absolute bottom-0 left-[14px] top-9 w-0.5', c.status === 'done' ? 'bg-success' : c.status === 'late' ? 'bg-accent' : 'bg-line-strong')} />}
              <span className={clsx('relative mt-4 flex size-[30px] items-center justify-center rounded-full', dot)}>
                {c.status === 'done' ? <Check size={17} strokeWidth={3} aria-hidden /> : c.status === 'late' ? <Clock size={17} aria-hidden /> : <CircleDot size={16} aria-hidden />}
              </span>
              <div className="min-w-0 rounded-[18px] border border-line bg-surface">
                <button className="flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left" onClick={() => c.body && setOpen((o) => { const n = new Set(o); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })} aria-expanded={c.body ? isOpen : undefined}>
                  <span className={clsx('flex size-11 shrink-0 items-center justify-center rounded-[14px]', c.status === 'done' ? 'bg-success-tint text-success' : c.status === 'late' ? 'bg-accent-tint text-accent-ink' : 'bg-sunken text-ink-2')}><c.Icon size={22} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-head text-[16.5px] font-semibold text-ink">{c.title}</span>
                      <Pill tone={TONE[c.status].cls} Icon={c.status === 'done' ? CheckCircle2 : TONE[c.status].Icon}>{c.pill}</Pill>
                    </span>
                    {c.summary && <span className="mt-0.5 block text-[13.5px] text-ink-2">{c.summary}</span>}
                  </span>
                  {c.body ? (isOpen ? <ChevronUp size={18} className="shrink-0 text-meta" aria-hidden /> : <ChevronDown size={18} className="shrink-0 text-meta" aria-hidden />) : null}
                </button>
                {isOpen && <div className="border-t border-line px-3 pb-3">{c.body}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OrderCard({ d, s }: { d: Flow; s: S }) {
  const o = d.order!;
  const p = o.progress;
  const jobWork = o.kind === 'job_work';
  const left = Math.max(0, p.ordered - (jobWork ? p.done : p.sent));
  return (
    <section className="mt-4 rounded-[18px] border border-line bg-surface px-4 py-3.5 lg:mt-0">
      <p className="text-[13px] text-meta">{s(o.side === 'seller' ? 'you_sell' : 'you_buy', { name: o.other })}</p>
      <p className="mt-1 text-[15px] text-ink"><span className="font-head text-[17px] font-bold tabular-nums">{fmtQty(p.ordered, p.dim)}</span> {s('ordered')}</p>
      <p className="mt-1 text-[14px] text-ink-2">
        {jobWork ? s('order_done', { done: fmtQty(p.done, p.dim), ordered: fmtQty(p.ordered, p.dim) }) : s('order_line', { sent: fmtQty(p.sent, p.dim), received: fmtQty(p.received, p.dim), otw: fmtQty(p.on_the_way, p.dim) })}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {left > 0 ? <Pill tone={TONE.late.cls} Icon={Clock}>{s(jobWork ? 'order_left_work' : 'order_left', { qty: fmtQty(left, p.dim) })}</Pill> : <Pill tone={TONE.done.cls} Icon={CheckCircle2}>{s('order_all')}</Pill>}
        {p.returned > 0 && <Pill tone={TONE.held.cls} Icon={Package}>{s('st_returned', { qty: fmtQty(p.returned, p.dim) })}</Pill>}
      </div>
    </section>
  );
}

function StageRow({ r, s, lang, nav }: { r: Row; s: S; lang: string; nav: (to: string) => void }) {
  const t = TONE[r.status];
  const parts = r.out_dim !== r.dim
    ? [s('row_sent', { qty: fmtQty(r.sent, r.dim) }), s('row_made', { qty: fmtQty(r.good + r.reject, r.out_dim) }), r.waste ? s('row_waste', { qty: fmtQty(r.waste, 'mass') }) : null, r.at_unit ? s('row_at', { qty: fmtQty(r.at_unit, r.dim) }) : null]
    : [s('row_sent', { qty: fmtQty(r.sent, r.dim) }), s('row_back', { qty: fmtQty(r.good, r.dim) }), r.reject ? s('row_reject', { qty: fmtQty(r.reject, r.dim) }) : null, s('row_at', { qty: fmtQty(r.at_unit, r.dim) }), r.loss ? s('row_loss', { qty: fmtQty(r.loss, r.dim) }) : null];
  return (
    <button className={clsx('mt-2 block min-h-11 w-full rounded-[12px] border-l-[3px] bg-sunken/70 px-3 py-2 text-left text-[14px] hover:bg-sunken', r.status === 'late' ? 'border-accent' : r.status === 'ready' ? 'border-primary' : r.disputes ? 'border-danger' : 'border-line-strong')} onClick={() => nav(`/goods/job/${r.id}`)}>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-ink">{r.in_house ? s('in_house') : r.name}</span>
        {(r.sizes.length > 0 || r.lots.length > 0) && <span className="text-[13px] text-meta">{[r.sizes.map((z) => z.size).join(', '), r.lots.join(', ')].filter(Boolean).join(' · ')}</span>}
      </span>
      <span className="block text-ink-2">{parts.filter(Boolean).join(' · ')}</span>
      <span className="mt-1 flex flex-wrap items-center gap-2">
        <Pill tone={t.cls} Icon={t.Icon}>{statusText(s, r.status, r.late)}</Pill>
        {r.disputes > 0 && <Pill tone="bg-danger-tint text-danger" Icon={AlertTriangle}>{s('st_diff', { qty: fmtQty(r.disputed, r.dim) })}</Pill>}
        {r.status !== 'done' && !r.in_house && <span className="text-[13px] text-meta">{s('expected', { date: shortDate(r.expected_at, lang) })}</span>}
      </span>
    </button>
  );
}
