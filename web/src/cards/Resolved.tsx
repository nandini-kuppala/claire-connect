import { CircleCheck } from '../icons';
import type { CardProps } from './types';
import { strings } from './strings';

/** Centered system line: a Trade Desk ticket was resolved. */
export function ResolvedCard({ payload, ctx }: CardProps<'resolved'>) {
  const t = strings(ctx.lang);
  return (
    <div className="flex w-full justify-center">
      <div className="flex max-w-[320px] items-start gap-2.5 rounded-[18px] bg-success-tint px-3.5 py-2.5">
        <CircleCheck size={18} aria-hidden className="mt-px shrink-0 text-success" />
        <div className="min-w-0">
          <p className="text-[14px] leading-snug font-semibold text-ink">{t('resolved', { code: payload.ticketCode })}</p>
          {payload.outcome && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{payload.outcome}</p>}
        </div>
      </div>
    </div>
  );
}

export default ResolvedCard;
