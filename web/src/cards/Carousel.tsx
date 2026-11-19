import { useState } from 'react';
import clsx from 'clsx';
import { Heart, ShieldCheck } from '../icons';
import type { Chip, ListingSummary } from '@shared/cards';
import GarmentArt from '../components/GarmentArt';
import type { CardProps } from './types';
import { cleanLabel, inr, isStale, num, unitPer } from './format';
import { strings, type T } from './strings';
import { ChipButton, QuestionBubble } from './ui';
import { useChipLock } from './Chips';
import { flatArtStyle } from './Tiles';

export function CarouselCard({ message, payload, ctx }: CardProps<'carousel'>) {
  const t = strings(ctx.lang);
  const { locked, pick } = useChipLock(isStale(message, ctx));
  const [liked, setLiked] = useState<string[]>([]);
  const selectable = payload.selectable !== false && !!(payload.doneChip || payload.selectable);
  const done: Chip = payload.doneChip ?? { id: 'style:done', label: t('done'), primary: true };
  const extras = payload.extraChips ?? [];

  const toggle = (id: string) => {
    if (locked) return;
    setLiked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const send = (chip: Chip, id: string) => {
    if (locked) return;
    pick(chip.id);
    void ctx.chip(id, cleanLabel(chip.label));
  };

  const doneLabel = liked.length ? `${cleanLabel(done.label)} · ${t('liked', { n: liked.length })}` : cleanLabel(done.label);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5 [contain:inline-size]">
      <QuestionBubble text={payload.text} />
      <div
        className="-mx-1 flex w-[calc(100%+8px)] snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {payload.items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            t={t}
            selectable={selectable && !locked}
            liked={liked.includes(item.id)}
            onLike={() => toggle(item.id)}
            onOpen={() => ctx.openStorefront(item.businessId)}
          />
        ))}
      </div>
      {/* Once answered the chips fold away: the user's reply bubble already shows the choice. */}
      {selectable && !locked && (
        <div className="flex max-w-[380px] flex-wrap gap-2">
          <ChipButton
            chip={{ ...done, label: doneLabel, primary: true }}
            disabled={liked.length === 0}
            onTap={() => send({ ...done, label: doneLabel }, `${done.id}:${liked.join(',')}`)}
          />
          {extras.map((c) => (
            <ChipButton key={c.id} chip={c} onTap={() => send(c, c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * While choosing, tapping the card toggles it (clear selected state: green border + filled heart);
 * "View" opens the seller's store. After answering, the card simply opens the store.
 */
function ProductCard({
  item,
  t,
  selectable,
  liked,
  onLike,
  onOpen,
}: {
  item: ListingSummary;
  t: T;
  selectable: boolean;
  liked: boolean;
  onLike: () => void;
  onOpen: () => void;
}) {
  const body = (
    <>
      <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-[16px]">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <GarmentArt shape={item.art?.shape ?? 'tshirt'} color={item.art?.color} pattern={item.art?.pattern} style={flatArtStyle} />
        )}
        {selectable && (
          <span
            aria-hidden
            className={clsx(
              'absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full transition-colors',
              liked ? 'bg-clay text-white' : 'bg-surface text-ink-2',
            )}
          >
            <Heart size={18} className={liked ? 'fill-current' : undefined} />
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5 px-1 pt-2 pb-1">
        <span className="line-clamp-2 min-h-[38px] text-[13.5px] leading-[1.4] font-medium text-ink">{item.title}</span>
        <span className="mt-0.5 text-ink">
          <span className="font-head text-[17px] font-bold tabular-nums">{inr(item.price)}</span>
          <span className="text-[12px] text-meta"> / {unitPer(item.unit)}</span>
        </span>
        <span className="text-[12px] text-meta">{t('moq', { n: num(item.moq) })}</span>
        <span className="mt-1 flex items-center gap-1 text-[12px] text-ink-2">
          <span className="min-w-0 truncate">{item.businessName}</span>
          {item.trust != null && (
            <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-success tabular-nums">
              <ShieldCheck size={12} aria-hidden />
              {Math.round(item.trust)}
            </span>
          )}
        </span>
      </span>
    </>
  );

  return (
    <div
      role="listitem"
      className={clsx(
        'relative flex w-[168px] shrink-0 snap-start flex-col rounded-[20px] border bg-surface p-1.5 transition-colors',
        liked ? 'border-primary bg-primary-tint shadow-[inset_0_0_0_1px_var(--color-primary)]' : 'border-line',
      )}
    >
      {selectable ? (
        <>
          <button
            type="button"
            onClick={onLike}
            aria-pressed={liked}
            aria-label={`${liked ? t('unlike_item') : t('like_item')}: ${item.title}`}
            className="block w-full rounded-[16px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {body}
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="mt-0.5 min-h-10 rounded-full text-[13px] font-semibold text-primary hover:bg-primary-tint"
          >
            {t('view')}
          </button>
        </>
      ) : (
        <button type="button" onClick={onOpen} className="block w-full rounded-[16px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {body}
        </button>
      )}
    </div>
  );
}

export default CarouselCard;
