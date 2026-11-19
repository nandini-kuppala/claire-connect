// Trust score pill: green ≥ 80, blue 60–79, amber below; "New" for new businesses.
import { ShieldCheck, Sparkle } from '../icons';
import clsx from 'clsx';
import { defineStrings } from '../lib/localStrings';

const S = defineStrings({
  en: { new_on: 'New on CLAIRE', trust: 'Trust' },
  ta: { new_on: 'CLAIRE-இல் புதியவர்', trust: 'நம்பிக்கை' },
  hi: { new_on: 'CLAIRE पर नए', trust: 'भरोसा' },
});

export type TrustLike = number | { score?: number | null; isNew?: boolean | null } | null | undefined;

export function trustScore(t: TrustLike): { score: number | null; isNew: boolean } {
  if (t == null) return { score: null, isNew: false };
  if (typeof t === 'number') return { score: t, isNew: false };
  return { score: typeof t.score === 'number' ? t.score : null, isNew: Boolean(t.isNew) };
}

export function trustColors(score: number) {
  if (score >= 80) return { fg: 'var(--color-success)', bg: 'var(--color-success-tint)' };
  if (score >= 60) return { fg: 'var(--color-primary)', bg: 'var(--color-primary-tint)' };
  return { fg: 'var(--color-accent-ink)', bg: 'var(--color-accent-tint)' };
}

export function TrustBadge({ trust, size = 'sm', className, label }: { trust: TrustLike; size?: 'sm' | 'md'; className?: string; label?: string }) {
  const s = S.use();
  label = label ?? s('trust');
  const { score, isNew } = trustScore(trust);
  if (score == null && !isNew) return null;
  const small = size === 'sm';
  if (isNew || score == null) {
    return (
      <span
        className={clsx('inline-flex items-center gap-1 rounded-full bg-primary-tint font-medium text-primary', small ? 'h-5 px-1.5 text-[11px]' : 'h-7 px-2.5 text-[13px]', className)}
      >
        <Sparkle size={small ? 11 : 13} aria-hidden /> {s('new_on')}
      </span>
    );
  }
  const c = trustColors(score);
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full font-semibold tabular-nums', small ? 'h-5 px-1.5 text-[11px]' : 'h-7 px-2.5 text-[13px]', className)}
      style={{ color: c.fg, background: c.bg }}
      title={`${label} ${Math.round(score)} / 100`}
    >
      <ShieldCheck size={small ? 11 : 14} aria-hidden />
      <span className="sr-only">{label} </span>
      {Math.round(score)}
    </span>
  );
}

export default TrustBadge;
