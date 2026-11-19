import clsx from 'clsx';
import { ChevronRight, Package } from '../icons';
import type { CardProps } from './types';
import { inr } from './format';
import { strings } from './strings';
import { CardShell, OrderStatusPill } from './ui';

export function OrdersCard({ payload, ctx }: CardProps<'orders'>) {
  const t = strings(ctx.lang);
  return (
    <CardShell>
      <div className="px-4 pt-3.5 pb-1">
        <p className="font-head text-[16.5px] font-semibold text-ink">{payload.text || t('your_orders')}</p>
      </div>
      <ul className="divide-y divide-line px-1.5 pb-1.5">
        {payload.items.map((o) => {
          const open = o.conversationId;
          return (
            <li key={o.orderId}>
              <button
                type="button"
                disabled={!open}
                onClick={() => open && ctx.openConversation(open)}
                className={clsx(
                  'flex min-h-16 w-full items-center gap-3 rounded-[16px] px-2.5 py-3 text-left transition-colors',
                  open ? 'hover:bg-sunken' : 'cursor-default',
                )}
                aria-label={open ? `${t('open_chat')}: ${o.code}` : undefined}
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <Package size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] leading-[1.4] font-semibold text-ink">{o.title}</span>
                  <span className="block truncate text-[12.5px] text-meta">
                    {o.counterpart} · <span className="tabular-nums">{o.code}</span>
                  </span>
                  <span className="mt-1 block">
                    <OrderStatusPill status={o.status} t={t} />
                  </span>
                </span>
                <span className="shrink-0 font-head text-[15px] font-bold text-ink tabular-nums">{inr(o.total)}</span>
                {open && <ChevronRight size={18} aria-hidden className="shrink-0 text-faint" />}
              </button>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

export default OrdersCard;
