// Side-by-side supplier comparison (ref: docs/ui-refs/4.webp). Also embedded as the Results "Compare" tab.
import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';
import { BadgeCheck, Check, Clock, Factory, Handshake, MessageCircle, Package, ShieldCheck, Star, Tag as TagIcon, Trophy, Truck, Wallet, type LucideIcon } from '../icons';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { ClaireMark } from '../components/Avatar';
import { TrustBadge } from '../components/TrustBadge';
import { RS, type RT } from './results.strings';
import {
  PageHeader, Thumb, Toast, daysText, inr, joinNames, num, sellerCards, unitOf, useBack, useDealActions, useRequirement, useToast,
  type DealActions, type Detail, type RCard,
} from './results.kit';

export default function Compare() {
  const { requirementId } = useParams();
  const s = RS.use();
  const back = useBack(requirementId ? `/results/${requirementId}` : '/');
  const { data, error, loading, reload } = useRequirement(requirementId);
  const act = useDealActions(requirementId);
  const toast = useToast();
  const r = data?.requirement;
  const sub = r ? [r.title, `${num(r.qty)} ${unitOf(s, r.unit)}`, r.city].filter(Boolean).join(' · ') : undefined;

  return (
    <AppShell nav={false}>
      <PageHeader title={s('compare_title')} sub={sub} back={back} />
      <div className="px-4 pt-4 pb-10">
        {loading && !data ? (
          <div className="space-y-3" aria-busy>
            <p className="text-[14px] text-meta">{s('loading')}</p>
            <div className="h-24 animate-pulse rounded-[22px] bg-sunken" />
            <div className="h-80 animate-pulse rounded-[22px] bg-sunken" />
          </div>
        ) : error || !data ? (
          <div className="py-16 text-center">
            <p className="text-[15px] text-ink-2">{error?.status === 404 ? s('not_found') : error?.text ?? s('not_found')}</p>
            <Button className="mt-4" variant="secondary" onClick={() => (error?.status === 404 ? back() : void reload())}>
              {error?.status === 404 ? s('back') : s('retry')}
            </Button>
          </div>
        ) : (
          <>
            <CompareView data={data} act={act} toast={toast.show} />
            {act.error && <p className="mt-4 rounded-[16px] bg-danger-tint px-4 py-3 text-[14px] text-danger">{act.error}</p>}
          </>
        )}
      </div>
      <Toast text={toast.text} />
    </AppShell>
  );
}

// ── The comparison itself ─────────────────────────────────────────────────
interface Row {
  id: string;
  icon: LucideIcon;
  label: string;
  value: (c: RCard) => number | boolean | null;
  show: (c: RCard) => ReactNode;
  better: 'min' | 'max' | 'bool';
}

function score(c: RCard, all: RCard[]) {
  const minP = Math.min(...all.map((x) => x.avgPrice));
  const minD = Math.min(...all.map((x) => x.deliveryDays));
  return 0.4 * (minP / Math.max(1, c.avgPrice)) + 0.35 * (c.trust / 100) + 0.25 * ((minD + 1) / (c.deliveryDays + 1)) - (c.onTime ? 0 : 0.2);
}

export function CompareView({ data, act, toast }: { data: Detail; act: DealActions; toast: (t: string) => void }) {
  const s = RS.use();
  const r = data.requirement;
  const candidates = useMemo(() => {
    const list = sellerCards(data);
    const rec = list.find((c) => c.recommended);
    return rec ? [rec, ...list.filter((c) => c !== rec)] : list;
  }, [data]);
  const [picked, setPicked] = useState<string[]>(() => candidates.slice(0, 2).map((c) => c.key));
  const selected = candidates.filter((c) => picked.includes(c.key));

  const toggle = (key: string) => {
    if (picked.includes(key)) {
      if (picked.length <= 2) return toast(s('need2'));
      setPicked(picked.filter((k) => k !== key));
    } else {
      if (picked.length >= 3) return toast(s('max3'));
      setPicked([...picked, key]);
    }
  };

  if (candidates.length < 2) {
    const only = candidates[0];
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] text-ink-2">{s('only_one')}</p>
        {only && (
          <Button className="mt-4" icon={MessageCircle} loading={act.isBusy(only.key, 'chat')} onClick={() => act.chat(only.key, only.lines[0].businessId, only.lines[0].listingId)}>
            {s('chat')} · {only.lines[0].supplier.name}
          </Button>
        )}
      </div>
    );
  }

  const per = unitOf(s, r.unit, true);
  const sup = (c: RCard) => c.lines[0].supplier;
  const yesNo = (v: boolean) =>
    v ? (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-success-tint text-success">
        <Check size={16} aria-label={s('yes')} />
      </span>
    ) : (
      <span className="text-faint" aria-label={s('no')}>
        —
      </span>
    );

  const rows: Row[] = [
    { id: 'price', icon: TagIcon, label: s('row_price', { unit: per }), value: (c) => c.avgPrice, show: (c) => inr(c.avgPrice), better: 'min' },
    { id: 'total', icon: Wallet, label: s('row_total', { qty: `${num(r.qty)} ${unitOf(s, r.unit)}` }), value: (c) => c.total, show: (c) => inr(c.total), better: 'min' },
    { id: 'stock', icon: Package, label: s('row_stock'), value: (c) => c.lines[0].stock, show: (c) => num(c.lines[0].stock), better: 'max' },
    { id: 'delivery', icon: Truck, label: s('row_delivery'), value: (c) => c.deliveryDays, show: (c) => daysText(s, c.deliveryDays), better: 'min' },
    { id: 'trust', icon: ShieldCheck, label: s('row_trust'), value: (c) => c.trust, show: (c) => c.trust, better: 'max' },
    {
      id: 'rating',
      icon: Star,
      label: s('row_rating'),
      value: (c) => sup(c).ratingAvg,
      show: (c) =>
        sup(c).ratingAvg != null ? (
          <span className="inline-flex items-center gap-1">
            {sup(c).ratingAvg!.toFixed(1)}
            <Star size={14} aria-hidden className="text-accent" />
          </span>
        ) : (
          '—'
        ),
      better: 'max',
    },
    { id: 'ontime', icon: Clock, label: s('row_ontime'), value: (c) => sup(c).onTimePct, show: (c) => (sup(c).onTimePct != null ? `${sup(c).onTimePct}%` : '—'), better: 'max' },
    { id: 'gst', icon: BadgeCheck, label: s('row_gst'), value: (c) => sup(c).gstVerified, show: (c) => yesNo(sup(c).gstVerified), better: 'bool' },
    { id: 'mfr', icon: Factory, label: s('row_mfr'), value: (c) => sup(c).isManufacturer, show: (c) => yesNo(sup(c).isManufacturer), better: 'bool' },
  ];

  const wins = (row: Row, c: RCard) => {
    const vals = selected.map(row.value);
    const v = row.value(c);
    if (v == null) return false;
    if (row.better === 'bool') return v === true && vals.some((x) => x !== true);
    const nums = vals.filter((x): x is number => typeof x === 'number');
    if (nums.length < 2 || nums.every((x) => x === nums[0])) return false;
    return v === (row.better === 'min' ? Math.min(...nums) : Math.max(...nums));
  };

  // Claire's pick among the selected, plus what each one is best at.
  const winner = selected.find((c) => c.recommended) ?? [...selected].sort((a, b) => score(b, selected) - score(a, selected))[0];
  const strength = (c: RCard, others: RCard[]) => {
    if (others.every((o) => c.avgPrice < o.avgPrice)) return s('cmp_price', { name: sup(c).name, price: inr(c.avgPrice) });
    if (others.every((o) => c.deliveryDays < o.deliveryDays)) return s('cmp_fast', { name: sup(c).name, days: daysText(s, c.deliveryDays) });
    if (others.every((o) => c.trust > o.trust)) return s('cmp_trust', { name: sup(c).name, n: c.trust });
    if (others.every((o) => c.lines[0].stock > o.lines[0].stock)) return s('cmp_stock', { name: sup(c).name, n: num(c.lines[0].stock) });
    return null;
  };
  const advice = [
    strength(winner, selected.filter((c) => c !== winner)) ?? s('cmp_overall', { name: sup(winner).name }),
    ...selected.filter((c) => c !== winner).map((c) => strength(c, [winner])).filter((x): x is string => !!x),
  ];

  const cols = `minmax(0,1.25fr) repeat(${selected.length}, minmax(0,1fr))`;
  const names = selected.map((c) => sup(c).name);

  return (
    <div className="space-y-5">
      {/* Chooser */}
      <section>
        <p className="mb-2 px-1 text-[13px] text-meta">{s('choose')}</p>
        <div className="-mx-4 flex snap-x gap-2.5 no-scrollbar overflow-x-auto px-4 pb-1">
          {candidates.map((c) => {
            const on = picked.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                aria-pressed={on}
                aria-label={s('select', { name: sup(c).name })}
                className={clsx(
                  'relative flex w-[46%] max-w-[200px] min-w-[150px] shrink-0 snap-start items-center gap-2.5 rounded-[18px] border bg-surface p-2.5 text-left transition-colors',
                  on ? 'border-primary/60 bg-primary-tint/40' : 'border-line hover:bg-sunken',
                )}
              >
                <Thumb art={c.lines[0].art ?? c.art} shape={r.shape} w={44} h={52} className="rounded-[12px]" />
                <span className="min-w-0 flex-1 pr-5">
                  <span className="line-clamp-2 text-[13px] leading-snug font-semibold text-ink">{sup(c).name}</span>
                  <span className="mt-1 block">
                    <TrustBadge trust={c.trust} size="sm" label={s('row_trust')} />
                  </span>
                </span>
                <span
                  aria-hidden
                  className={clsx(
                    'absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border-[1.5px]',
                    on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface',
                  )}
                >
                  {on && <Check size={14} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-[22px] border border-line bg-surface" role="table" aria-label={s('compare_title')}>
        <div role="row" className="grid border-b border-line bg-page" style={{ gridTemplateColumns: cols }}>
          <span role="columnheader" className="sr-only">
            {s('compare_title')}
          </span>
          <span aria-hidden />
          {selected.map((c) => (
            <span role="columnheader" key={c.key} className="flex items-center justify-center gap-1 px-1.5 py-2.5 text-center text-[12.5px] leading-tight font-semibold text-ink">
              {c === winner && <Trophy size={13} aria-hidden className="shrink-0 text-accent-ink" />}
              <span className="line-clamp-2">{sup(c).name}</span>
            </span>
          ))}
        </div>
        {rows.map((row, i) => (
          <div role="row" key={row.id} className={clsx('grid', i > 0 && 'border-t border-line')} style={{ gridTemplateColumns: cols }}>
            <span role="rowheader" className="flex min-h-[52px] items-center gap-2 py-2 pr-1 pl-3 text-[13px] leading-snug text-ink-2">
              <row.icon size={17} aria-hidden className="shrink-0 text-meta" />
              <span className="min-w-0">{row.label}</span>
            </span>
            {selected.map((c) => {
              const win = wins(row, c);
              return (
                <span
                  role="cell"
                  key={c.key}
                  className={clsx(
                    'flex items-center justify-center border-l border-line px-1 py-2 text-center text-[15px] tabular-nums',
                    win ? 'bg-success-tint font-semibold text-success' : 'text-ink',
                    (row.id === 'price' || row.id === 'total') && 'font-head font-bold',
                  )}
                >
                  {row.show(c)}
                </span>
              );
            })}
          </div>
        ))}
      </section>

      {/* Claire's take */}
      <section className="flex gap-3 rounded-[18px] bg-accent-tint p-4">
        <ClaireMark size={36} />
        <div className="min-w-0 flex-1">
          <h2 className="font-head text-[16px] font-semibold text-ink">{s('claire_rec')}</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-accent-ink">
            <Trophy size={14} aria-hidden />
            {sup(winner).name}
          </span>
          <div className="mt-2 space-y-1 text-[14px] leading-relaxed text-ink-2">
            {advice.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="space-y-2.5">
        <Button
          size="lg"
          block
          icon={Handshake}
          loading={act.isBusy(winner.key, 'chat')}
          disabled={act.anyBusy}
          onClick={() => act.chat(winner.key, winner.lines[0].businessId, winner.lines[0].listingId)}
        >
          {s('start_neg', { name: sup(winner).name })}
        </Button>
        <Button
          size="lg"
          block
          variant="secondary"
          icon={MessageCircle}
          loading={act.isBusy('compare', 'many')}
          disabled={act.anyBusy}
          onClick={() => act.many('compare', selected, s('chats_opened', { names: joinNames(s, names) }), toast)}
        >
          {selected.length === 2 ? s('chat_both_sup') : s('chat_all_sup', { n: selected.length })}
        </Button>
      </div>
    </div>
  );
}
