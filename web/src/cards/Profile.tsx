import { Gauge, MapPin } from '../icons';
import { Avatar } from '../components/Avatar';
import type { CardProps } from './types';
import { strings } from './strings';
import { CardShell } from './ui';

function TagList({ items }: { items: string[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="inline-flex min-h-8 items-center rounded-full bg-sunken px-3 text-[13px] leading-[1.35] text-ink">
          {s}
        </span>
      ))}
    </div>
  );
}

/** Business profile summary (onboarding confirmation, shared contact). */
export function ProfileCard({ payload, ctx }: CardProps<'profile'>) {
  const t = strings(ctx.lang);
  return (
    <CardShell>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar name={payload.business || payload.name} size={48} />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-meta">{t('profile')}</p>
          <p className="truncate font-head text-[17px] leading-tight font-semibold text-ink">{payload.business}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-ink-2">
            <span className="truncate">{payload.name}</span>
            {payload.city && (
              <>
                <span aria-hidden>·</span>
                <MapPin size={13} aria-hidden className="shrink-0 text-meta" />
                <span className="truncate">{payload.city}</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="space-y-3 border-t border-line px-4 py-3.5">
        {payload.sells.length > 0 && (
          <div>
            <p className="text-[13px] font-semibold text-meta">{t('sells')}</p>
            <TagList items={payload.sells} />
          </div>
        )}
        {payload.buys.length > 0 && (
          <div>
            <p className="text-[13px] font-semibold text-meta">{t('buys')}</p>
            <TagList items={payload.buys} />
          </div>
        )}
        {payload.capacity && (
          <p className="flex items-center gap-1.5 text-[13.5px] text-ink-2">
            <Gauge size={16} aria-hidden className="text-meta" />
            <span className="text-meta">{t('capacity')}:</span> {payload.capacity}
          </p>
        )}
      </div>
    </CardShell>
  );
}

export default ProfileCard;
