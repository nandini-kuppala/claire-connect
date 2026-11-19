import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Check, ShieldCheck, type LucideIcon } from '../icons';
import type { Chip } from '@shared/cards';
import { cleanLabel, trustTier } from './format';
import type { T } from './strings';

// Small building blocks shared by every card. Flat cotton surfaces, 1px warm lines, soft corners.

export function CardShell({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div
      className={clsx(
        'w-full overflow-hidden rounded-[22px] border border-line bg-surface text-ink',
        wide ? 'max-w-full' : 'max-w-[340px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small section label. Sentence case; colour comes from the caller (meta by default). */
export function Eyebrow({ children, icon: Icon, className }: { children: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={clsx('flex items-center gap-1.5 text-[13px] leading-[1.4] font-semibold text-meta', className)}>
      {Icon && <Icon size={16} aria-hidden className="shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={clsx('font-head text-[16.5px] leading-[1.35] font-semibold text-ink', className)}>{children}</h3>;
}

const TRUST_STYLE = {
  high: 'bg-success-tint text-success',
  mid: 'bg-primary-tint text-primary',
  new: 'bg-sunken text-ink-2',
} as const;

export function TrustPill({ score, t, className }: { score: number | null | undefined; t: T; className?: string }) {
  if (score == null || !Number.isFinite(score)) return null;
  const tier = trustTier(score);
  return (
    <span
      className={clsx(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] leading-none font-semibold tabular-nums',
        TRUST_STYLE[tier],
        className,
      )}
    >
      <ShieldCheck size={13} aria-hidden />
      {tier === 'new' && score < 50 ? t('new_on') : t('trust', { n: Math.round(score) })}
    </span>
  );
}

export type PillTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
const PILL: Record<PillTone, string> = {
  neutral: 'bg-sunken text-ink-2',
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success',
  warning: 'bg-note text-warning',
  danger: 'bg-danger-tint text-danger',
};

export function Pill({ children, tone = 'neutral', icon: Icon, className }: { children: ReactNode; tone?: PillTone; icon?: LucideIcon; className?: string }) {
  return (
    <span className={clsx('inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] leading-[1.3] font-semibold', PILL[tone], className)}>
      {Icon && <Icon size={13} aria-hidden className="shrink-0" />}
      {children}
    </span>
  );
}

const ORDER_TONE: Record<string, PillTone> = {
  confirmed: 'success',
  advance_paid: 'success',
  in_production: 'primary',
  dispatched: 'primary',
  delivered: 'success',
  balance_paid: 'success',
  closed: 'success',
  cancelled: 'neutral',
  disputed: 'danger',
};

export function OrderStatusPill({ status, t }: { status: string; t: T }) {
  const key = `s_${status}` as Parameters<T>[0];
  const raw = t(key);
  const label = raw === key ? status.replace(/_/g, ' ') : raw;
  return <Pill tone={ORDER_TONE[status] ?? 'neutral'}>{label}</Pill>;
}

/** Settled-state seal shown once an offer/action is done: a soft tinted pill with a tick, no rubber-stamp tilt. */
export function Stamp({ label, tone }: { label: string; tone: 'success' | 'primary' | 'danger' | 'neutral' }) {
  const cls = {
    success: 'bg-success-tint text-success',
    primary: 'bg-primary-tint text-primary',
    danger: 'bg-danger-tint text-danger',
    neutral: 'bg-sunken text-ink-2',
  }[tone];
  return (
    <span className={clsx('inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold', cls)}>
      {tone === 'success' && (
        <span className="flex size-[18px] items-center justify-center rounded-full bg-success text-white">
          <Check size={12} aria-hidden />
        </span>
      )}
      {label}
    </span>
  );
}

export function KV({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[14px] leading-[1.45]">
      <span className="shrink-0 text-meta">{label}</span>
      <span className={clsx('min-w-0 text-right tabular-nums', strong ? 'font-semibold text-ink' : 'text-ink')}>{value}</span>
    </div>
  );
}

export interface ChipButtonProps {
  chip: Chip;
  onTap: () => void;
  disabled?: boolean;
  selected?: boolean;
  icon?: LucideIcon;
  className?: string;
}

/** Answer chip: ≥44px pill on sunken cotton; primary (and selected) chips are filled loom green. */
export function ChipButton({ chip, onTap, disabled, selected, icon: Icon, className }: ChipButtonProps) {
  const filled = chip.primary || selected;
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-pressed={selected || undefined}
      className={clsx(
        'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-full px-4 py-2 text-[14.5px] leading-[1.35] font-semibold transition-[background-color,transform] active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        filled ? 'bg-primary text-white hover:bg-primary-hover' : 'border border-line bg-sunken text-ink hover:bg-primary-tint hover:text-primary',
        disabled && !selected && 'cursor-not-allowed opacity-50 hover:bg-sunken hover:text-ink',
        disabled && selected && 'cursor-default',
        className,
      )}
    >
      {selected ? <Check size={16} aria-hidden className="shrink-0" /> : Icon ? <Icon size={18} aria-hidden className="shrink-0" /> : null}
      <span className="min-w-0 text-left">
        <span className="block">{cleanLabel(chip.label)}</span>
        {chip.sub && <span className={clsx('block text-[12px] font-normal', filled ? 'text-white/80' : 'text-meta')}>{chip.sub}</span>}
      </span>
    </button>
  );
}

export function ErrorLine({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 rounded-[14px] bg-danger-tint px-3 py-2 text-[13px] leading-[1.45] text-danger">
      {children}
    </p>
  );
}

export const inputCls =
  'h-12 w-full rounded-[16px] border border-line bg-sunken px-4 text-[16px] text-ink placeholder:text-faint transition-colors focus:border-primary focus:bg-surface focus:outline-none';

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] leading-[1.45] text-meta">{hint}</span>}
    </label>
  );
}

/** Claire's question that heads chip / tile / carousel cards: drawn exactly like Claire's chat bubble. */
export function QuestionBubble({ text, hint }: { text?: string; hint?: string }) {
  if (!text && !hint) return null;
  return (
    <div className="w-fit max-w-[86%] rounded-[20px] rounded-bl-[8px] border border-line bg-surface px-3.5 py-2.5">
      {text && <p className="text-[15px] leading-[1.45] whitespace-pre-line text-ink">{text}</p>}
      {hint && <p className="mt-1 text-[13px] leading-[1.45] text-meta">{hint}</p>}
    </div>
  );
}

/** Segmented single-choice chips (used in sheets). */
export function ChoiceChips<V extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              'min-h-11 min-w-14 rounded-full px-4 text-[14.5px] font-semibold transition-colors',
              on ? 'bg-primary text-white' : 'border border-line bg-sunken text-ink hover:bg-primary-tint hover:text-primary',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
