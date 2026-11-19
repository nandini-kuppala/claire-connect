// Avatars: business initials on their accent colour, plus the CLAIRE brand marks.
import { Bell, Headset } from '../icons';
import clsx from 'clsx';
import { accentFor, initials } from '../lib/format';

export function Avatar({
  name,
  accent,
  size = 44,
  src,
  online,
  className,
}: {
  name?: string | null;
  accent?: string | null;
  size?: number;
  src?: string | null;
  online?: boolean;
  className?: string;
}) {
  // Seed accents may be off-palette; avatars always use the warm dye palette.
  void accent;
  const bg = accentFor(name || '?');
  return (
    <span className={clsx('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="flex size-full items-center justify-center rounded-full font-head font-semibold text-white"
          style={{ background: bg, fontSize: Math.round(size * 0.36) }}
        >
          {initials(name)}
        </span>
      )}
      {online && (
        <span className="absolute right-0 bottom-0 rounded-full border-2 border-surface bg-success" style={{ width: size * 0.28, height: size * 0.28 }} aria-hidden />
      )}
    </span>
  );
}

/** Robot head from the CLAIRE Connect logo (white head, navy visor, teal smiling eyes), drawn on a 120 grid. */
function BotHead() {
  return (
    <g>
      <path d="M60 30v-9" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="18" r="6" fill="#FFFFFF" />
      <rect x="20" y="52" width="10" height="26" rx="5" fill="#FFFFFF" />
      <rect x="90" y="52" width="10" height="26" rx="5" fill="#FFFFFF" />
      <rect x="26" y="30" width="68" height="64" rx="26" fill="#FFFFFF" />
      <rect x="33" y="42" width="54" height="38" rx="17" fill="#13203B" />
      <path d="M43 61c3-5 8-5 11 0M66 61c3-5 8-5 11 0" stroke="#55D6B4" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M53 69c4 4 10 4 14 0" stroke="#55D6B4" strokeWidth="4" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** CLAIRE mark: the logo's smiling robot on a teal disc (or rounded tile). */
export function ClaireMark({ size = 44, className, rounded = 'full' }: { size?: number; className?: string; rounded?: 'full' | 'xl' }) {
  return (
    <span
      aria-hidden
      className={clsx('inline-flex shrink-0 items-center justify-center bg-brand', rounded === 'full' ? 'rounded-full' : 'rounded-[30%]', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" width={size * 0.8} height={size * 0.8} fill="none">
        <g transform="translate(0 6)">
          <BotHead />
        </g>
      </svg>
    </span>
  );
}

/** The full CLAIRE Connect logo symbol: teal price-tag blob with the robot, a tag hole and three spark lines. */
export function LogoSymbol({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 140 130" width={size * (140 / 130)} height={size} fill="none" aria-hidden className={className}>
      <path d="M30 16c22-12 64-14 88 2 14 9 17 40 12 66-5 25-30 40-62 42-26 2-50-8-58-30C2 72 4 30 30 16Z" fill="#3DB394" />
      <path d="M8 98c6 14 22 24 42 27-16 1-32-6-40-16-2-3-3-7-2-11Z" fill="#2E9C80" />
      <circle cx="30" cy="34" r="9" fill="#FFFFFF" />
      <path d="M113 4l-3 9M126 10l-7 7M132 24l-9 2" stroke="#3DB394" strokeWidth="5" strokeLinecap="round" />
      <g transform="translate(14 22) scale(0.86)">
        <BotHead />
      </g>
    </svg>
  );
}

/** Standalone waving Claire robot for hero areas (login, empty states). */
export function ClaireBot({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 140 130" width={size * (140 / 130)} height={size} fill="none" aria-hidden className={className}>
      <ellipse cx="64" cy="72" rx="56" ry="52" fill="#3DB394" />
      <path d="M112 8l-3 9M125 14l-7 7M131 28l-9 2" stroke="#3DB394" strokeWidth="5" strokeLinecap="round" />
      <path d="M98 88c9-4 13-12 12-21" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
      <circle cx="110" cy="62" r="7.5" fill="#FFFFFF" />
      <g transform="translate(4 16)">
        <BotHead />
      </g>
    </svg>
  );
}

/** App-bar brand mark: the logo symbol. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return <LogoSymbol size={size} />;
}

export function UpdatesMark({ size = 44 }: { size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink" style={{ width: size, height: size }}>
      <Bell size={size * 0.46} />
    </span>
  );
}

export function DeskMark({ size = 44 }: { size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-clay-tint text-clay" style={{ width: size, height: size }}>
      <Headset size={size * 0.46} />
    </span>
  );
}

export default Avatar;
