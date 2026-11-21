// Results for one buyer requirement: suppliers, compare and market insights (ref: docs/ui-refs/3.webp).
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ChevronDown, ChevronRight, Factory, Info, MessageCircle, Package, Star, Trophy, Truck, Users, History } from '../icons';
import { useGoodsHistory } from './goods/history';
import { OrderGoodsS } from './goods/OrderGoods.strings';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { ClaireMark } from '../components/Avatar';
import { TrustBadge } from '../components/TrustBadge';
import { useLang } from '../store/session';
import { RS, type RT } from './results.strings';
import {
  Badges, PageHeader, Tag, Thumb, Toast, useBack, daysText, inr, num, readyText, sellerCards, summaryLine, unitOf, useDealActions, useRequirement, useToast,
  type DealActions, type Detail, type RCard,
} from './results.kit';
import { CompareView } from './Compare';

type Tab = 'suppliers' | 'compare' | 'insights';

export default function Results() {
  const { requirementId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (['suppliers', 'compare', 'insights'].includes(params.get('tab') ?? '') ? params.get('tab') : 'suppliers') as Tab;
  const s = RS.use();
  const lang = useLang();
  const back = useBack('/');
  const nav = useNavigate();
  const { data, error, loading, reload } = useRequirement(requirementId);
  const act = useDealActions(requirementId);
  const toast = useToast();

  const setTab = (t: Tab) => setParams(t === 'suppliers' ? {} : { tab: t }, { replace: true });
  const count = data?.requirement.matchCount ?? 0;

  return (
    <AppShell nav={false}>
      <PageHeader title={data?.requirement.title ?? (loading ? '' : s('not_found'))} sub={data ? summaryLine(s, data.requirement) : undefined} back={back} />

      {loading && !data ? (
        <Skeleton label={s('loading')} />
      ) : error || !data ? (
        <div className="px-4 py-16 text-center">
          <p className="text-[15px] text-ink-2">{error?.status === 404 ? s('not_found') : error?.text ?? s('not_found')}</p>
          <Button className="mt-4" variant={error?.status === 404 ? 'primary' : 'secondary'} onClick={() => (error?.status === 404 ? nav('/') : void reload())}>
            {error?.status === 404 ? s('go_home') : s('retry')}
          </Button>
        </div>
      ) : (
        <>
          <nav className="flex gap-2 no-scrollbar overflow-x-auto px-4 pt-4 pb-1" role="tablist" aria-label={data.requirement.title}>
            {(
              [
                ['suppliers', s('tab_suppliers', { n: count })],
                ['compare', s('tab_compare')],
                ['insights', s('tab_insights')],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={clsx(
                  'min-h-11 shrink-0 grow rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors',
                  tab === id ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-2 hover:bg-sunken',
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="px-4 pt-4 pb-10">
            {tab === 'suppliers' && <Suppliers d={data} s={s} lang={lang} act={act} />}
            {tab === 'compare' && <CompareView data={data} act={act} toast={toast.show} />}
            {tab === 'insights' && <Insights d={data} s={s} />}
            {act.error && <p className="mt-4 rounded-[16px] bg-danger-tint px-4 py-3 text-[14px] text-danger">{act.error}</p>}
          </div>
        </>
      )}
      <Toast text={toast.text} />
    </AppShell>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4 px-4 pt-4" aria-busy>
      <p className="text-[14px] text-meta">{label}</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3.5 rounded-[22px] border border-line bg-surface p-4">
          <div className="h-24 w-[84px] animate-pulse rounded-[16px] bg-sunken" />
          <div className="flex-1 space-y-2.5 pt-1">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-sunken" />
            <div className="h-6 w-1/3 animate-pulse rounded-full bg-sunken" />
            <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Suppliers tab ─────────────────────────────────────────────────────────
function ClaireNote({ d, s }: { d: Detail; s: RT }) {
  const extra = d.results.aboveBudget ? s('above_budget') : !d.results.singles.length && d.results.combos.length ? s('combo_only') : null;
  if (!d.recommendation && !extra) return null;
  return (
    <section className="flex gap-3 rounded-[18px] bg-accent-tint p-4">
      <ClaireMark size={36} />
      <div className="min-w-0 flex-1">
        <h2 className="font-head text-[16px] font-semibold text-ink">{s('claire_rec')}</h2>
        {d.recommendation && <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{d.recommendation.reason}</p>}
        {extra && <p className="mt-1.5 text-[13px] leading-relaxed text-accent-ink">{extra}</p>}
      </div>
    </section>
  );
}

function Suppliers({ d, s, lang, act }: { d: Detail; s: RT; lang: string; act: DealActions }) {
  const nav = useNavigate();
  const { singles, combos, mto } = d.results;
  const rec = [...singles, ...combos, ...mto].find((c) => c.recommended);
  // The recommended option always leads, even when it is made to order.
  const main = useMemo(() => {
    const list = singles.filter((c) => c !== rec);
    return rec && rec.kind !== 'combo' ? [rec, ...list] : list;
  }, [singles, rec]);
  const comboList = rec?.kind === 'combo' ? [rec, ...combos.filter((c) => c !== rec)] : combos;
  const mtoRest = mto.filter((c) => c !== rec);
  const [mtoOpen, setMtoOpen] = useState(!main.length && !comboList.length);

  if (!singles.length && !combos.length && !mto.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] text-ink-2">{s('no_results')}</p>
        <Button className="mt-4" icon={MessageCircle} onClick={() => nav('/chat/claire')}>
          {s('ask_again')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ClaireNote d={d} s={s} />
      {rec?.kind === 'combo' && comboList.map((c) => <ComboCard key={c.key} c={c} d={d} s={s} act={act} />)}
      {main.map((c) => (
        <SupplierCard key={c.key} c={c} d={d} s={s} lang={lang} act={act} />
      ))}
      {rec?.kind !== 'combo' && comboList.map((c) => <ComboCard key={c.key} c={c} d={d} s={s} act={act} />)}

      {mtoRest.length > 0 && (
        <section className="pt-2">
          <button
            type="button"
            onClick={() => setMtoOpen((o) => !o)}
            aria-expanded={mtoOpen}
            className="flex min-h-12 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 text-left hover:bg-sunken"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
              <Factory size={18} aria-hidden />
            </span>
            <span className="flex-1 font-head text-[16px] font-semibold text-ink">{s('mto_section', { n: mtoRest.length })}</span>
            <ChevronDown size={20} aria-hidden className={clsx('shrink-0 text-meta transition-transform', mtoOpen && 'rotate-180')} />
          </button>
          {mtoOpen && (
            <div className="mt-3 space-y-4">
              <p className="px-1 text-[13px] text-meta">{s('mto_hint')}</p>
              {mtoRest.map((c) => (
                <SupplierCard key={c.key} c={c} d={d} s={s} lang={lang} act={act} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** J15: "You: 4 jobs · usually 6 days · 7.1% loss", from my own Goods jobs with them (private to me). */
function MyHistory({ businessId }: { businessId: string }) {
  const h = useGoodsHistory(businessId);
  const og = OrderGoodsS.use();
  if (!h) return null;
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1 text-[13px] font-semibold text-ink-2">
      <History size={15} aria-hidden className="text-meta" />
      {[og('history', { n: h.jobs }), h.usual_days !== null ? og('history_days', { d: h.usual_days }) : null, h.loss_pct !== null ? og('history_loss', { x: h.loss_pct }) : null].filter(Boolean).join(' · ')}
    </p>
  );
}

function SupplierCard({ c, d, s, lang, act }: { c: RCard; d: Detail; s: RT; lang: string; act: DealActions }) {
  const nav = useNavigate();
  const line = c.lines[0];
  if (!line) return null;
  const sup = line.supplier;
  const per = unitOf(s, d.requirement.unit, true);
  const store = () => nav(`/store/${line.businessId}`);
  const trust = <TrustBadge trust={{ score: c.trust, isNew: sup.isNew && c.trust < 50 }} size="md" label={s('row_trust')} />;

  return (
    <article className={clsx('rounded-[22px] bg-surface p-4', c.recommended ? 'border-[1.5px] border-primary/50' : 'border border-line')}>
      {c.recommended && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <Tag tone="accent" icon={Trophy}>
            {s('recommended')}
          </Tag>
          {trust}
        </div>
      )}
      <div className="flex gap-3.5">
        <button type="button" onClick={store} aria-label={sup.name} className="shrink-0 self-start">
          <Thumb art={line.art ?? c.art} shape={d.requirement.shape} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={store} className="min-w-0 text-left font-head text-[17px] leading-snug font-semibold text-ink hover:underline">
              {sup.name}
            </button>
            {!c.recommended && trust}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-head text-[26px] leading-none font-bold text-ink tabular-nums">{inr(c.avgPrice)}</span>
            <span className="text-[14px] text-meta">{s('per_unit', { unit: per })}</span>
            {c.bestPrice && <Tag>{s('best_price')}</Tag>}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-2">
            {sup.ratingAvg != null ? (
              <>
                <Star size={15} aria-hidden className="text-accent" />
                <span className="font-semibold text-ink">{sup.ratingAvg.toFixed(1)}</span>
                <span className="text-meta">
                  ({sup.orders > 0 ? s('orders', { n: num(sup.orders) }) : s('reviews', { n: sup.ratingCount })})
                </span>
              </>
            ) : (
              <span className="text-meta">{s('new_supplier')}</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-ink-2">
        {c.kind === 'mto' ? (
          <span className="inline-flex items-center gap-1.5">
            <Factory size={17} aria-hidden className="text-meta" />
            {s('made_to_order')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Package size={17} aria-hidden className="text-meta" />
            {s('in_stock', { n: num(line.stock) })}
          </span>
        )}
        <span className={clsx('inline-flex items-center gap-1.5', !c.onTime && 'text-clay')}>
          <Truck size={17} aria-hidden className={c.onTime ? 'text-meta' : 'text-clay'} />
          {readyText(s, c.readyDays)}
        </span>
      </div>
      <MyHistory businessId={line.businessId} />

      {c.badges.length > 0 && (
        <div className="mt-3">
          <Badges badges={c.badges} lang={lang} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" className="flex-1" icon={MessageCircle} loading={act.isBusy(c.key, 'chat')} disabled={act.anyBusy} onClick={() => act.chat(c.key, line.businessId, line.listingId)}>
          {s('chat')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          icon={act.isDone(c.key, 'sample') ? Check : Package}
          loading={act.isBusy(c.key, 'sample')}
          disabled={act.anyBusy || act.isDone(c.key, 'sample')}
          onClick={() => act.sample(c.key, line.businessId, line.listingId)}
        >
          {act.isDone(c.key, 'sample') ? s('sample_asked') : s('get_sample')}
        </Button>
        <button
          type="button"
          onClick={store}
          aria-label={s('view_details')}
          title={s('view_details')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
    </article>
  );
}

function ComboCard({ c, d, s, act }: { c: RCard; d: Detail; s: RT; act: DealActions }) {
  const nav = useNavigate();
  const per = unitOf(s, d.requirement.unit, true);
  const n = c.lines.length;
  return (
    <article className={clsx('rounded-[22px] bg-surface p-4', c.recommended ? 'border-[1.5px] border-primary/50' : 'border border-line')}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
          <Users size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {c.recommended && (
            <span className="mb-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink">
              <Trophy size={13} aria-hidden />
              {s('recommended')}
            </span>
          )}
          <h3 className="font-head text-[17px] leading-snug font-semibold text-ink">{s('split_n', { n })}</h3>
        </div>
        {c.trust > 0 && <TrustBadge trust={c.trust} size="md" label={s('row_trust')} />}
      </div>

      <ul className="mt-3 divide-y divide-line rounded-[18px] bg-page px-3.5">
        {c.lines.map((l) => (
          <li key={l.listingId} className="flex items-center gap-3 py-2.5">
            <Thumb art={l.art} shape={d.requirement.shape} w={40} h={44} className="rounded-[12px]" />
            <button type="button" onClick={() => nav(`/store/${l.businessId}`)} className="min-w-0 flex-1 text-left text-[14px] font-semibold text-ink hover:underline">
              {l.supplier.name}
            </button>
            <span className="shrink-0 text-[14px] text-ink-2 tabular-nums">
              {num(l.qty)} × {inr(l.unitPrice)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-head text-[22px] font-bold text-ink tabular-nums">{s('avg_per', { price: inr(c.avgPrice), unit: per })}</span>
        {c.bestPrice && <Tag>{s('best_price')}</Tag>}
      </div>
      <p className="mt-1 text-[13px] text-meta">
        {s('total_about', { amt: inr(c.total) })} · {readyText(s, c.readyDays)}
      </p>

      <Button
        block
        className="mt-3.5"
        icon={act.isDone(c.key, 'combo') ? Check : MessageCircle}
        loading={act.isBusy(c.key, 'combo')}
        disabled={act.anyBusy}
        onClick={() => act.combo(c.key, c, s('chats_opened', { names: c.lines.map((l) => l.supplier.name).join(', ') }))}
      >
        {n === 2 ? s('chat_both') : s('chat_all', { n })}
      </Button>
    </article>
  );
}

// ── Insights tab ──────────────────────────────────────────────────────────
function Insights({ d, s }: { d: Detail; s: RT }) {
  const r = d.requirement;
  const band = d.results.band;
  const { freight, transitDays, budget, lowest } = d.insights;
  const per = unitOf(s, r.unit, true);
  const all = [...d.results.singles, ...d.results.combos, ...d.results.mto];
  const minReady = all.length ? Math.min(...all.map((c) => c.readyDays)) : 0;

  const tips: string[] = [];
  if (budget && lowest != null && lowest < budget - 0.5) tips.push(s('tip_room', { amt: inr(budget - lowest) }));
  else if (budget && band && budget < band.p25) tips.push(s('tip_tight'));
  if (band && tips.length < 1) tips.push(s('tip_median', { mid: inr(band.median) }));
  if (r.deadlineDays && r.city && transitDays) {
    const left = r.deadlineDays - transitDays - minReady;
    tips.push(left >= 1 ? s('tip_deadline', { city: r.city, days: daysText(s, transitDays), left: daysText(s, left) }) : s('tip_late', { city: r.city }));
  }
  if (all.some((c) => c.lines.some((l) => l.supplier.isNew || l.supplier.orders < 3))) tips.push(s('tip_sample'));
  tips.push(s('tip_gst'));

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-line bg-surface p-4">
        <h2 className="font-head text-[17px] font-semibold text-ink">{s('market_title')}</h2>
        <p className="mt-0.5 text-[13px] text-meta">{s('market_sub', { unit: per })}</p>
        {band ? <BandBar band={band} budget={budget} s={s} /> : <p className="mt-3 text-[14px] text-ink-2">{s('no_band')}</p>}
      </section>

      {freight > 0 && (
        <section className="flex gap-3.5 rounded-[22px] border border-line bg-surface p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            <Truck size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-head text-[17px] font-semibold text-ink">{s('freight_title')}</h2>
            <p className="mt-0.5 font-head text-[20px] font-bold text-ink tabular-nums">{s('freight_line', { amt: inr(freight), city: r.city ?? '—' })}</p>
            <p className="mt-0.5 text-[13px] text-meta">
              {s('freight_sub', { per: inr(Math.round((freight / Math.max(1, r.qty)) * 100) / 100), unit: per, days: daysText(s, transitDays) })}
            </p>
          </div>
        </section>
      )}

      <section className="rounded-[22px] border border-line bg-surface p-4">
        <div className="flex items-center gap-2.5">
          <ClaireMark size={28} />
          <h2 className="font-head text-[17px] font-semibold text-ink">{s('tips_title')}</h2>
        </div>
        <ul className="mt-3 space-y-2.5">
          {tips.slice(0, 3).map((tip) => (
            <li key={tip} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
              <Info size={17} aria-hidden className="mt-0.5 shrink-0 text-accent-ink" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BandBar({ band, budget, s }: { band: { p25: number; median: number; p75: number }; budget: number | null; s: RT }) {
  const lo = Math.min(band.p25, budget ?? band.p25) * 0.85;
  const hi = Math.max(band.p75, budget ?? band.p75) * 1.1;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / Math.max(1, hi - lo)) * 100))}%`;
  return (
    <div className="mt-4">
      <div className="relative h-14">
        {budget != null && (
          <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(budget) }}>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink">
              {s('your_budget')} {inr(budget)}
            </span>
            <span className="h-[26px] w-[2px] rounded-full bg-accent" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-3 rounded-full bg-sunken">
          <div className="absolute inset-y-0 rounded-full bg-primary-soft" style={{ left: pos(band.p25), right: `calc(100% - ${pos(band.p75)})` }} />
          <div className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-full bg-primary" style={{ left: pos(band.median) }} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['low', band.p25],
            ['median', band.median],
            ['high', band.p75],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className={clsx('rounded-[16px] py-2', k === 'median' ? 'bg-primary-tint' : 'bg-page')}>
            <dt className="text-[12px] text-meta">{s(k)}</dt>
            <dd className="font-head text-[17px] font-bold text-ink tabular-nums">{inr(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
