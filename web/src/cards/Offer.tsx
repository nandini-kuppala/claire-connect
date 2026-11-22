import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Clock, Handshake, Repeat, TrendingDown, TrendingUp, X, type LucideIcon } from '../icons';
import { Button } from '../components/Button';
import { dealT } from '../chat/deal.strings';
import type { CardProps } from './types';
import { errMsg, inr, num, unitPer, unitQty } from './format';
import { strings } from './strings';
import { ErrorLine, KV } from './ui';
import { OfferSheet, freightLabel } from './OfferSheet';
import { dealOf } from './dealCtx';

const SETTLED: Record<string, { key: 'st_accepted' | 'st_countered' | 'st_declined' | 'st_expired'; icon: LucideIcon; tone: string }> = {
  accepted: { key: 'st_accepted', icon: Check, tone: 'bg-success-tint text-success' },
  countered: { key: 'st_countered', icon: Repeat, tone: 'bg-clay-tint text-clay' },
  declined: { key: 'st_declined', icon: X, tone: 'bg-danger-tint text-danger' },
  expired: { key: 'st_expired', icon: Clock, tone: 'bg-sunken text-meta' },
};

export function OfferCard({ message, payload, ctx }: CardProps<'offer'>) {
  const t = strings(ctx.lang);
  const dt = dealT(ctx.lang);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmRef = useRef<HTMLDivElement>(null);
  // Offer cards keep the status they were posted with; the chat passes the live one.
  const live = ctx.offerStatus?.[payload.offerId];
  const status = localStatus ?? (live && live !== 'pending' ? live : payload.status);

  useEffect(() => {
    if (confirming) confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [confirming]);
  const pending = status === 'pending';
  const isCounter = payload.parentPrice != null;
  const per = unitPer(payload.unit, ctx.lang);
  const qtyText = `${num(payload.qty)} ${unitQty(payload.unit, payload.qty, ctx.lang)}`;
  const canAct = pending && !message.mine;

  const respond = async (action: 'accept' | 'decline' | 'counter', unitPrice?: number, qty?: number) => {
    await ctx.api.post(`/api/offers/${encodeURIComponent(payload.offerId)}/respond`, { action, unitPrice, ...(qty && qty !== payload.qty ? { qty } : {}) });
    setLocalStatus(action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'countered');
    setConfirming(false);
    ctx.refresh();
  };

  const run = async (action: 'accept' | 'decline') => {
    setBusy(action);
    setError(null);
    try {
      await respond(action);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  // ── Settled: a one-line stamp keeps the history readable without the full card. ──
  const settled = SETTLED[status];
  if (!pending && settled) {
    const Icon = settled.icon;
    // A countered offer shows the new price it was countered with, not only the old one.
    const reply = status === 'countered' ? dealOf(ctx)?.offers.find((o) => o.parentId === payload.offerId) : undefined;
    return (
      <div className={clsx('flex w-fit max-w-[340px] items-center gap-2.5 rounded-[18px] border border-line bg-surface py-2 pr-3.5 pl-2', message.mine && 'ml-auto')}>
        <span className={clsx('flex size-8 shrink-0 items-center justify-center rounded-full', settled.tone)}>
          <Icon size={16} aria-hidden />
        </span>
        <p className="min-w-0 text-[13px] leading-snug text-ink-2">
          <span className="font-semibold text-ink">{t(settled.key)}</span>
          <span className="text-faint"> · </span>
          <span className={clsx('font-head font-semibold tabular-nums', reply ? 'text-meta line-through' : 'text-ink')}>
            {inr(payload.unitPrice)}/{per}
          </span>
          {reply && (
            <>
              <span aria-hidden className="text-faint"> → </span>
              <span className="font-head font-semibold text-ink tabular-nums">
                {inr(reply.unitPrice)}/{per}
              </span>
            </>
          )}
          <span className="text-faint"> · </span>
          {reply && reply.qty !== payload.qty ? `${num(reply.qty)} ${unitQty(payload.unit, reply.qty, ctx.lang)}` : qtyText}
        </p>
      </div>
    );
  }

  const diff = isCounter ? payload.unitPrice - (payload.parentPrice as number) : 0;
  const heading = canAct ? (isCounter ? dt('counter_received') : dt('offer_received')) : isCounter ? dt('your_counter') : dt('your_offer');

  return (
    <div
      className={clsx(
        'w-full max-w-[340px] overflow-hidden rounded-[22px] border text-ink',
        canAct ? 'border-clay/25 bg-surface' : 'border-line bg-surface',
      )}
    >
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-2">
          <span className={clsx('flex size-8 shrink-0 items-center justify-center rounded-full', canAct ? 'bg-clay-tint text-clay' : 'bg-primary-tint text-primary')}>
            <Handshake size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className={clsx('text-[13px] leading-tight font-semibold', canAct ? 'text-clay' : 'text-primary')}>{heading}</p>
            <p className="truncate text-[12px] leading-tight text-meta">{payload.title}</p>
          </div>
        </div>

        <p className="mt-3 text-ink">
          <span className="font-head text-[28px] leading-none font-bold tabular-nums">{inr(payload.unitPrice)}</span>
          <span className="text-[15px] text-meta"> / {per}</span>
          <span className="text-[15px] text-ink-2"> · {qtyText}</span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-meta">
          <span>
            {t('total')} <span className="font-head font-semibold text-ink tabular-nums">{inr(payload.total)}</span>
          </span>
          {isCounter && diff !== 0 && (
            <span className={clsx('inline-flex items-center gap-1 font-medium', diff < 0 ? 'text-success' : 'text-clay')}>
              {diff < 0 ? <TrendingDown size={14} aria-hidden /> : <TrendingUp size={14} aria-hidden />}
              {dt(diff < 0 ? 'less_than' : 'more_than', { amt: inr(Math.abs(diff)), prev: inr(payload.parentPrice) })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowTerms((v) => !v)}
          aria-expanded={showTerms}
          className="mt-2 -ml-1 inline-flex min-h-[36px] items-center gap-1 rounded-full px-1 text-[13px] font-semibold text-primary"
        >
          {showTerms ? dt('hide_terms') : dt('terms')}
          <ChevronDown size={15} aria-hidden className={clsx('transition-transform', showTerms && 'rotate-180')} />
        </button>
        {showTerms && (
          <div className="mt-1 rounded-[16px] bg-sunken px-3 py-1.5">
            <KV label={t('dispatch')} value={t('in_days', { n: payload.dispatchDays })} />
            <KV label={t('advance')} value={`${payload.advancePct}%`} />
            <KV label={t('credit')} value={payload.creditDays > 0 ? t('days', { n: payload.creditDays }) : t('none')} />
            <KV label={t('freight')} value={freightLabel(payload.freight, t)} />
          </div>
        )}

        {pending && message.mine && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-meta">
            <Clock size={14} aria-hidden /> {t('waiting')}
          </p>
        )}

        {canAct && !confirming && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button icon={Check} onClick={() => setConfirming(true)} disabled={busy !== null}>
                {t('accept')}
              </Button>
              <Button variant="secondary" icon={Repeat} onClick={() => setSheet(true)} disabled={busy !== null}>
                {t('counter')}
              </Button>
            </div>
            <div className="mt-1 flex justify-center">
              <Button variant="ghost" size="sm" className="text-meta" loading={busy === 'decline'} onClick={() => run('decline')}>
                {t('decline')}
              </Button>
            </div>
          </>
        )}

        {canAct && confirming && (
          <div ref={confirmRef} className="mt-3 scroll-mb-24 rounded-[18px] bg-primary-tint p-3">
            <p className="text-[15px] font-semibold text-ink">{t('accept_q', { total: inr(payload.total) })}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t('accept_note')}</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy !== null}>
                {t('cancel')}
              </Button>
              <Button icon={Check} loading={busy === 'accept'} onClick={() => run('accept')}>
                {t('yes_accept')}
              </Button>
            </div>
          </div>
        )}
        <ErrorLine>{error}</ErrorLine>
      </div>

      {canAct && (
        <OfferSheet
          open={sheet}
          onClose={() => setSheet(false)}
          mode="counter"
          lang={ctx.lang}
          unit={payload.unit}
          title={payload.title}
          theirPrice={payload.unitPrice}
          counterUp={dealOf(ctx)?.side === 'seller'}
          initial={{ qty: payload.qty, dispatchDays: payload.dispatchDays, advancePct: payload.advancePct, creditDays: payload.creditDays }}
          onSubmit={(v) => respond('counter', v.unitPrice, v.qty)}
        />
      )}
    </div>
  );
}

export default OfferCard;
