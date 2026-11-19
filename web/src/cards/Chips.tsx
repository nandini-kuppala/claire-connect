import { useState } from 'react';
import clsx from 'clsx';
import { Camera, Headset, Layers, Package, Scissors, ShoppingBag, type LucideIcon } from '../icons';
import type { Chip } from '@shared/cards';
import type { CardProps } from './types';
import { cleanLabel, isStale } from './format';
import { ChipButton, QuestionBubble } from './ui';

const ICONS: Record<string, LucideIcon> = {
  'home:buy': ShoppingBag,
  'home:fabric': Layers,
  'home:job': Scissors,
  'home:sell': Camera,
  'home:orders': Package,
  'home:human': Headset,
};

/** Shared "tap once" behaviour for chip-like cards. */
export function useChipLock(stale: boolean) {
  const [picked, setPicked] = useState<string | null>(null);
  return { picked, locked: stale || picked !== null, pick: setPicked };
}

export function ChipsCard({ message, payload, ctx }: CardProps<'chips'>) {
  const { picked, locked, pick } = useChipLock(isStale(message, ctx));
  const grid = payload.layout === 'grid';

  const tap = (c: Chip) => {
    if (locked) return;
    pick(c.id);
    void ctx.chip(c.id, cleanLabel(c.label));
  };

  // Once answered the chips fold away: the user's reply bubble right below already shows the choice.
  const visible = locked ? [] : payload.chips;

  return (
    <div className="flex w-full flex-col gap-2.5">
      <QuestionBubble text={payload.text} hint={payload.hint} />
      {visible.length > 0 &&
        (grid ? (
          <div className="grid w-full max-w-[380px] grid-cols-2 gap-2.5">
            {visible.map((c) => (
              <GridChip key={c.id} chip={c} icon={ICONS[c.id]} onTap={() => tap(c)} />
            ))}
          </div>
        ) : (
          <div className="flex max-w-[380px] flex-wrap gap-2">
            {visible.map((c) => (
              <ChipButton key={c.id} chip={c} icon={ICONS[c.id]} selected={picked === c.id} disabled={locked} onTap={() => tap(c)} />
            ))}
          </div>
        ))}
    </div>
  );
}

/** Big friendly action tile: icon in a soft circle, label that wraps (Tamil / Hindi run long). */
function GridChip({ chip, icon: Icon, onTap }: { chip: Chip; icon?: LucideIcon; onTap: () => void }) {
  const primary = !!chip.primary;
  return (
    <button
      type="button"
      onClick={onTap}
      className={clsx(
        'flex min-h-[64px] items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-[background-color,transform] active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        primary ? 'bg-primary text-white hover:bg-primary-hover' : 'border border-line bg-surface text-ink hover:bg-sunken',
      )}
    >
      {Icon && (
        <span
          className={clsx(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            primary ? 'bg-white/15 text-white' : 'bg-primary-tint text-primary',
          )}
        >
          <Icon size={20} aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[14.5px] leading-[1.35] font-semibold">{cleanLabel(chip.label)}</span>
        {chip.sub && <span className={clsx('mt-0.5 block text-[12px] leading-[1.35]', primary ? 'text-white/80' : 'text-meta')}>{chip.sub}</span>}
      </span>
    </button>
  );
}

export default ChipsCard;
