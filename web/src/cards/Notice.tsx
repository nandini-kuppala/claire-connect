import clsx from 'clsx';
import { CircleCheck, Info, AlertTriangle } from '../icons';
import type { CardProps } from './types';

const TONES = {
  info: { icon: Info, box: 'bg-sunken', ic: 'text-meta' },
  success: { icon: CircleCheck, box: 'bg-success-tint', ic: 'text-success' },
  warn: { icon: AlertTriangle, box: 'bg-accent-tint', ic: 'text-accent-ink' },
} as const;

/** Slim centered system notice (order updates, payment reminders, rate changes). */
export function NoticeCard({ payload }: CardProps<'notice'>) {
  const tone = TONES[payload.tone ?? 'info'] ?? TONES.info;
  const Icon = tone.icon;
  return (
    <div className="flex w-full justify-center">
      <div className={clsx('flex max-w-[320px] items-start gap-2 rounded-[18px] px-3.5 py-2', tone.box)}>
        <Icon size={15} aria-hidden className={clsx('mt-0.5 shrink-0', tone.ic)} />
        <p className="text-[13px] leading-snug whitespace-pre-line text-ink-2">{payload.text}</p>
      </div>
    </div>
  );
}

export default NoticeCard;
