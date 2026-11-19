import { useState } from 'react';
import { CircleCheck, Star } from '../icons';
import type { CardProps } from './types';
import { strings } from './strings';
import { RatingForm } from './RatingSheet';

function DoneLine({ title, sub, name }: { title: string; sub?: string; name: string }) {
  return (
    <div className="flex w-fit max-w-[340px] items-center gap-2.5 rounded-[18px] border border-line bg-surface py-2 pr-3.5 pl-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-tint text-success">
        <CircleCheck size={16} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-ink-2">
          <span className="font-semibold text-ink">{title}</span> · {name}
        </p>
        {sub && <p className="text-[12px] leading-snug text-meta">{sub}</p>}
      </div>
    </div>
  );
}

export function RatingCard({ payload, ctx }: CardProps<'rating'>) {
  const t = strings(ctx.lang);
  const [rated, setRated] = useState<number | null>(null);

  if (rated === null && ctx.ratedOrders?.includes(payload.orderId)) {
    return <DoneLine title={t('rated_plain')} name={payload.rateeName} />;
  }

  if (rated !== null) {
    const n = Math.round(rated * 10) / 10;
    return <DoneLine title={t('you_rated', { n: Number.isInteger(n) ? n : n.toFixed(1) })} name={payload.rateeName} sub={t('thanks_rating')} />;
  }

  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[22px] border border-line bg-surface text-ink">
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
            <Star size={16} aria-hidden />
          </span>
          <p className="text-[13px] font-semibold text-accent-ink">{t('rate_now')}</p>
        </div>
        <p className="mt-2 mb-3 font-head text-[17px] leading-snug font-semibold">{t('rate_title', { name: payload.rateeName })}</p>
        <RatingForm payload={payload} ctx={ctx} onDone={setRated} />
      </div>
    </div>
  );
}

export default RatingCard;
