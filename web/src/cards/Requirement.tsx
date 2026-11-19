import { useState } from 'react';
import { CircleCheck, ClipboardList, Send, Wallet } from '../icons';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import type { CardProps } from './types';
import { inr, num, resolveConversationId, unitPer, unitQty } from './format';
import { strings } from './strings';
import { Pill, TrustPill } from './ui';
import { OfferSheet, type OfferValues } from './OfferSheet';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[16px] bg-sunken px-3 py-2">
      <p className="text-[12px] leading-tight text-meta">{label}</p>
      <p className="mt-0.5 text-[14px] leading-snug font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

/** Requirement posted into a deal chat. The seller sees "New enquiry" + Send offer; the buyer a compact recap. */
export function RequirementCard({ message, payload, ctx }: CardProps<'requirement'>) {
  const t = strings(ctx.lang);
  const seller = !message.mine;
  const [sheet, setSheet] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (v: OfferValues) => {
    const conversationId = await resolveConversationId(ctx, message);
    await ctx.api.post('/api/offers', { conversationId, title: payload.title, ...v });
    setSent(true);
    ctx.refresh();
  };

  const per = unitPer(payload.unit);
  const qty = `${num(payload.qty)} ${unitQty(payload.unit, payload.qty)}`;
  const budget = payload.budget ? `≤ ${inr(payload.budget)} / ${per}` : t('no_limit');
  const deadline = payload.deadlineDays ? t('within_days', { n: payload.deadlineDays }) : t('flexible');

  // My own requirement: the deal strip above already carries it, so keep this to a recap.
  if (!seller) {
    return (
      <div className="w-full max-w-[340px] rounded-[22px] border border-line bg-surface px-4 py-3 text-ink">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-meta">
          <ClipboardList size={14} aria-hidden /> {t('your_req')}
        </p>
        <p className="mt-1 font-head text-[16px] leading-snug font-semibold">{payload.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
          {[qty, payload.budget ? budget : '', payload.deadlineDays ? deadline : '', payload.city ?? ''].filter(Boolean).join(' · ')}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[22px] border border-line bg-surface text-ink">
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            <ClipboardList size={16} aria-hidden />
          </span>
          <p className="text-[13px] font-semibold text-primary">{t('new_enquiry')}</p>
        </div>
        <p className="mt-2.5 font-head text-[17px] leading-snug font-semibold">{payload.title}</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Fact label={t('qty')} value={qty} />
          <Fact label={t('budget')} value={budget} />
          <Fact label={t('deadline')} value={deadline} />
          {payload.city && <Fact label={t('city')} value={payload.city} />}
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <Avatar name={payload.buyerName} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-ink">{payload.buyerName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <TrustPill score={payload.buyerTrust} t={t} />
              {payload.buyerPaysOnTime && (
                <Pill tone="success" icon={Wallet}>
                  {t('pays_on_time')} {payload.buyerPaysOnTime}
                </Pill>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3.5">
          {sent && (
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <CircleCheck size={16} aria-hidden /> {t('offer_sent')}
            </p>
          )}
          <Button block icon={Send} variant={sent ? 'secondary' : 'primary'} onClick={() => setSheet(true)}>
            {t('send_offer')}
          </Button>
        </div>
      </div>

      <OfferSheet
        open={sheet}
        onClose={() => setSheet(false)}
        mode="new"
        lang={ctx.lang}
        unit={payload.unit}
        title={payload.title}
        initial={{ qty: payload.qty, unitPrice: payload.budget ?? undefined }}
        onSubmit={submit}
      />
    </div>
  );
}

export default RequirementCard;
