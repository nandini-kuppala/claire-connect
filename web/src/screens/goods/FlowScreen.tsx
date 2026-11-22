// S9 · Flow view (03 §5 S9): for one style or order, where is every piece right now, what is done, what is late, and
// which buyers are still waiting. A stepped list on a phone; the same stages as columns joined by lines on a desktop.
// No Sankey, no chart library. kg and pcs are never added together. Owner only (the server refuses staff).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, CircleDot, Clock, Package, Pause, Truck, Factory, ShoppingBag } from '../../icons';
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

const NOW_FILL: Record<NowItem['kind'], string> = { at_unit: 'bg-primary-soft', in_stock: 'bg-ink-2/40', kept_elsewhere: 'bg-teal/60', on_the_way: 'bg-accent', with_buyer: 'bg-success', not_received: 'bg-danger' };

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

  return (
    <div className="pb-28 lg:pb-10">
      <Header title={title} sub={sub} back={back} />
      <div className="px-4 pt-4 lg:max-w-[1180px]">
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
          <NowCard d={d} s={s} />
          <div>
            {d.order && <OrderCard d={d} s={s} />}
            <BuyersCard d={d} s={s} lang={lang} nav={nav} />
          </div>
        </div>

        {d.coming.length > 0 && (
          <section className="mt-4">
            <h2 className="font-head text-[17px] font-semibold text-ink">{s('coming')}</h2>
            <p className="mt-0.5 text-[13px] text-meta">{s('coming_hint')}</p>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface lg:grid lg:grid-cols-2 lg:divide-y-0">
              {d.coming.map((c) => (
                <li key={c.job_id} className="lg:border-b lg:border-line">
                  <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/job/${c.job_id}`)}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{c.name}</span>
                      <span className="block text-[14px] text-ink-2"><span className="font-head font-bold tabular-nums text-ink">{fmtQty(c.qty, c.dim)}</span>{c.sizes.length ? ` · ${c.sizes.map((z) => z.size).join(', ')}` : ''}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
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

        {d.disputes.length > 0 && (
          <section className="mt-4">
            <h2 className="font-head text-[17px] font-semibold text-ink">{s('disputes')}</h2>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {d.disputes.map((x) => (
                <li key={x.id}>
                  <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/dispute/${x.id}`)}>
                    <AlertTriangle size={18} className="shrink-0 text-danger" aria-hidden />
                    <span className="min-w-0 flex-1 text-[15px] text-ink">{x.label} · <span className="font-semibold tabular-nums text-danger">{s('st_diff', { qty: fmtQty(Math.abs(x.difference), x.dim) })}</span></span>
                    <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Stages d={d} s={s} lang={lang} nav={nav} />
      </div>
    </div>
  );
}

function NowCard({ d, s }: { d: Flow; s: S }) {
  const label = (x: NowItem) =>
    x.kind === 'at_unit' ? s('at_unit', { name: x.name ?? '—' })
      : x.kind === 'in_stock' ? (x.name ? s('in_stock_at', { place: x.name }) : s('in_stock'))
      : x.kind === 'kept_elsewhere' ? s('kept_elsewhere', { name: x.name ?? '—' })
      : x.kind === 'on_the_way' ? s('on_the_way', { name: x.name ?? '—' })
      : x.kind === 'not_received' ? s('not_received', { name: x.name ?? '—' })
      : s('with_buyer', { name: x.name ?? '—' });
  const dims = [...new Set(d.now.map((x) => x.dim))].sort((a) => (a === 'count' ? -1 : 1));
  const c = d.counts;
  return (
    <section className="rounded-[18px] border border-line bg-surface px-4 py-3.5">
      <h2 className="font-head text-[17px] font-semibold text-ink">{s('now')}</h2>
      {(c.late > 0 || c.held > 0 || c.disputes > 0 || c.waiting > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {c.late > 0 && <Pill tone={TONE.late.cls} Icon={Clock}>{s('chip_late', { n: c.late })}</Pill>}
          {c.held > 0 && <Pill tone={TONE.held.cls} Icon={Pause}>{s('chip_held', { n: c.held })}</Pill>}
          {c.disputes > 0 && <Pill tone="bg-danger-tint text-danger" Icon={AlertTriangle}>{s('chip_diff', { n: c.disputes })}</Pill>}
          {c.waiting > 0 && <Pill tone="bg-accent-tint text-accent-ink" Icon={ShoppingBag}>{s('chip_waiting', { n: c.waiting })}</Pill>}
        </div>
      )}
      {d.now.length === 0 && <p className="mt-2 text-[14.5px] text-ink-2">{s('nothing_now')}</p>}
      {dims.map((dim) => {
        const items = d.now.filter((x) => x.dim === dim);
        const total = items.reduce((a, x) => a + x.qty, 0) || 1;
        return (
          <div key={dim} className="mt-3">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label={items.map((x) => `${fmtQty(x.qty, dim)} ${label(x)}`).join(', ')}>
              {items.map((x, i) => (
                <span key={i} className={clsx('h-full', x.kind === 'at_unit' && x.late ? 'bg-accent/70' : NOW_FILL[x.kind], i > 0 && 'border-l-2 border-surface')} style={{ width: `${(x.qty / total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-2.5 space-y-1 text-[14.5px]">
              {items.map((x, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className={clsx('mt-1 size-2.5 shrink-0 rounded-[3px]', x.kind === 'at_unit' && x.late ? 'bg-accent/70' : NOW_FILL[x.kind])} aria-hidden />
                  <span className="shrink-0 font-head font-bold tabular-nums text-ink">{fmtQty(x.qty, dim)}</span>
                  <span className="min-w-0 text-ink-2">{label(x)}{x.kind === 'at_unit' && x.late ? <span className="font-semibold text-accent-ink"> · {s('late_word')}</span> : null}{x.reject ? <span className="text-meta"> · {s('rejects_word')}</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
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

function BuyersCard({ d, s, lang, nav }: { d: Flow; s: S; lang: string; nav: (to: string) => void }) {
  if (!d.buyers.length) return null;
  return (
    <section className="mt-4 lg:mt-0 [section+&]:lg:mt-4">
      <h2 className="font-head text-[17px] font-semibold text-ink">{s('buyers')}</h2>
      <p className="mt-0.5 text-[13px] text-meta">{s('buyers_hint')}</p>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
        {d.buyers.map((b) => (
          <li key={`${b.party.k}:${b.party.id}`}>
            <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken" onClick={() => nav(`/goods/party/${b.party.k}/${b.party.id}`)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-semibold text-ink">{b.name}</span>
                <span className="block text-[14px] text-ink-2">
                  {b.sent ? s('sent_recv', { sent: fmtQty(b.sent, b.dim), received: fmtQty(b.received, b.dim) }) : s('nothing_sent')}
                  {b.last ? <span className="text-meta"> · {shortDate(b.last, lang)}</span> : null}
                </span>
                {b.sizes.length > 0 && <span className="block text-[13px] text-meta">{sizesText(b.sizes)}</span>}
                <span className="mt-1 flex flex-wrap gap-2">
                  {b.on_the_way > 0 && <Pill tone="bg-accent-tint text-accent-ink" Icon={Truck}>{s('st_on_the_way', { qty: fmtQty(b.on_the_way, b.dim) })}</Pill>}
                  {b.disputed > 0 && <Pill tone="bg-danger-tint text-danger" Icon={AlertTriangle}>{s('st_diff', { qty: fmtQty(b.disputed, b.dim) })}</Pill>}
                  {b.returned > 0 && <Pill tone={TONE.held.cls} Icon={Package}>{s('st_returned', { qty: fmtQty(b.returned, b.dim) })}</Pill>}
                  {b.orders.filter((o) => o.ordered > o.done).map((o) => <Pill key={o.code} tone="bg-accent-tint text-accent-ink" Icon={Clock}>{s('st_needs', { qty: fmtQty(o.ordered - o.done, o.dim), code: o.code })}</Pill>)}
                  {!b.waiting && b.sent > 0 && <Pill tone={TONE.done.cls} Icon={CheckCircle2}>{s('st_received')}</Pill>}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Stage by stage ───────────────────────────────────────────────────────────────────────────────

interface Col { key: string; title: string; status: RowStatus; Icon: IconType; pill: string; body: React.ReactNode }

function Stages({ d, s, lang, nav }: { d: Flow; s: S; lang: string; nav: (to: string) => void }) {
  const cols: Col[] = [];
  if (d.material.length) {
    const allIn = d.material.every((m) => m.confirmed);
    cols.push({
      key: 'material', title: s('material'), status: allIn ? 'done' : 'in_progress', Icon: allIn ? CheckCircle2 : CircleDot, pill: allIn ? s('confirmed') : s('not_confirmed'),
      body: d.material.map((m) => (
        <button key={`${m.movement_id}:${m.lot}`} className="mt-2 block min-h-11 w-full rounded-r-[12px] border-l-[3px] border-line-strong bg-sunken/60 px-3 py-2 text-left text-[14px] hover:bg-sunken" onClick={() => nav(`/goods/movement/${m.movement_id}`)}>
          <span className="block font-semibold text-ink"><span className="font-head tabular-nums">{fmtQty(m.qty, m.dim)}</span> · {m.label}</span>
          <span className="block text-ink-2">{s('material_row', { name: m.name, date: shortDate(m.date, lang) })}{m.lot ? ` · ${s('lot', { lot: m.lot })}` : ''}</span>
        </button>
      )),
    });
  }
  for (const st of d.stages) {
    const title = st.labels?.[lang] ?? st.labels?.en ?? st.key;
    const pill = st.status === 'done' ? s('s_done') : st.late ? s('stage_late', { n: st.late }) : s('stage_open', { n: st.open });
    cols.push({
      key: st.key, title, status: st.status === 'done' ? 'done' : st.late ? 'late' : st.status, Icon: st.status === 'done' ? CheckCircle2 : st.late ? Clock : TONE[st.status].Icon, pill,
      body: (
        <>
          {st.rows.map((r) => <StageRow key={r.id} r={r} s={s} lang={lang} nav={nav} />)}
          {st.totals.map((t) => (
            <p key={t.dim} className="mt-2 text-[13px] text-meta">
              {st.unit_changing
                ? s('rec_cut', { sent: fmtQty(t.sent, t.dim), out: st.outputs.map((o) => fmtQty(o.qty, o.dim)).join(' + ') || '0', waste: st.waste.map((w) => fmtQty(w.qty, w.dim)).join(' + ') || fmtQty(0, 'mass') })
                : s('rec', { sent: fmtQty(t.sent, t.dim), good: fmtQty(t.good, t.dim), reject: fmtQty(t.reject, t.dim), at: fmtQty(t.at_unit, t.dim), loss: fmtQty(t.loss, t.dim) })}
            </p>
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
      body: (
        <>
          <p className="mt-1 text-[14.5px] text-ink"><span className="font-head font-bold tabular-nums">{fmtQty(sent, 'count')}</span> {s('sent_word')}</p>
          {d.buyers.map((b) => (
            <button key={`${b.party.k}:${b.party.id}`} className={clsx('mt-2 block min-h-11 w-full rounded-r-[12px] border-l-[3px] bg-sunken/60 px-3 py-2 text-left text-[14px] hover:bg-sunken', b.waiting ? 'border-accent' : 'border-success')} onClick={() => nav(`/goods/party/${b.party.k}/${b.party.id}`)}>
              <span className="block font-semibold text-ink">{b.name}</span>
              <span className="block text-ink-2">{b.sent ? s('sent_recv', { sent: fmtQty(b.sent, b.dim), received: fmtQty(b.received, b.dim) }) : s('nothing_sent')}</span>
            </button>
          ))}
        </>
      ),
    });
  }
  if (!cols.length) return null;
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-head text-[17px] font-semibold text-ink">{s('stages')}</h2>
        <span className="text-[13px] text-meta">{s('stages_hint')}</span>
      </div>
      <ol className="mt-3 lg:grid lg:gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 6)}, minmax(0, 1fr))` }}>
        {cols.map((c, i) => (
          <li key={c.key} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 pb-5 lg:block lg:pb-0">
            {i < cols.length - 1 && <span aria-hidden className="absolute bottom-1 left-[13px] top-8 w-0.5 bg-line-strong lg:bottom-auto lg:left-9 lg:right-[-12px] lg:top-[13px] lg:h-0.5 lg:w-auto" />}
            <span className={clsx('relative flex size-7 items-center justify-center rounded-full', DOT[c.status])}><c.Icon size={16} aria-hidden /></span>
            <div className="min-w-0 lg:mt-2.5">
              <div className="flex min-h-7 flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="font-head text-[16.5px] font-semibold leading-tight text-ink">{c.title}</h3>
                <Pill tone={TONE[c.status].cls} Icon={c.status === 'done' ? CheckCircle2 : c.key === 'dispatch' ? Truck : c.key === 'material' ? Factory : TONE[c.status].Icon}>{c.pill}</Pill>
              </div>
              {c.body}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StageRow({ r, s, lang, nav }: { r: Row; s: S; lang: string; nav: (to: string) => void }) {
  const t = TONE[r.status];
  const parts = r.out_dim !== r.dim
    ? [s('row_sent', { qty: fmtQty(r.sent, r.dim) }), s('row_made', { qty: fmtQty(r.good + r.reject, r.out_dim) }), r.waste ? s('row_waste', { qty: fmtQty(r.waste, 'mass') }) : null, r.at_unit ? s('row_at', { qty: fmtQty(r.at_unit, r.dim) }) : null]
    : [s('row_sent', { qty: fmtQty(r.sent, r.dim) }), s('row_back', { qty: fmtQty(r.good, r.dim) }), r.reject ? s('row_reject', { qty: fmtQty(r.reject, r.dim) }) : null, s('row_at', { qty: fmtQty(r.at_unit, r.dim) }), r.loss ? s('row_loss', { qty: fmtQty(r.loss, r.dim) }) : null];
  return (
    <button className={clsx('mt-2 block min-h-11 w-full rounded-r-[12px] border-l-[3px] bg-sunken/60 px-3 py-2 text-left text-[14px] hover:bg-sunken', r.status === 'late' ? 'border-accent' : r.status === 'ready' ? 'border-primary' : r.disputes ? 'border-danger' : 'border-line-strong')} onClick={() => nav(`/goods/job/${r.id}`)}>
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
