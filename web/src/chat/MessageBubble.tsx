// Chat bubbles: the shared shell (colours, radius, softened tail) and the text bubble with
// translation toggle, time and delivery state.
import type { ReactNode } from 'react';
import { AlertCircle, Check, Clock3, Languages, ShieldAlert } from '../icons';
import clsx from 'clsx';
import { clock, langNative } from '../lib/format';
import { useT } from '../i18n';
import type { ChatMessage } from './engine';
import { MODERATION_MASK, ModerationStrings } from './moderation.strings';

export interface BubblePosition {
  /** First bubble of a run from the same sender. */
  first: boolean;
  /** Last bubble of a run: gets the softened 8px tail corner. */
  last: boolean;
}

/** Radius per position: 20px all round, the tail corner of the last bubble in a run softens to 8px (never square). */
function radius(mine: boolean, pos: BubblePosition): string {
  if (mine) return pos.last ? '20px 20px 8px 20px' : pos.first ? '20px' : '20px 8px 8px 20px';
  return pos.last ? '20px 20px 20px 8px' : pos.first ? '20px' : '8px 20px 20px 8px';
}

export function BubbleShell({
  mine,
  pos,
  children,
  className,
  wide = false,
}: {
  mine: boolean;
  pos: BubblePosition;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={clsx('flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'relative min-w-[72px] px-3.5 pt-2 pb-1.5 text-[15px] leading-[1.45] text-ink',
          mine ? 'bg-bubble-own' : 'border border-line bg-surface',
          wide ? 'max-w-[86%]' : 'max-w-[80%]',
          className,
        )}
        style={{ borderRadius: radius(mine, pos) }}
      >
        {children}
      </div>
    </div>
  );
}

export function MessageMeta({ message, className }: { message: ChatMessage; className?: string }) {
  const t = useT();
  const tm = ModerationStrings.use();
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[11px] leading-none whitespace-nowrap text-meta tabular-nums', className)}>
      {clock(message.sentAt)}
      {message.mine && message.status === 'sending' && <Clock3 size={12} aria-label={t('sending')} />}
      {message.mine && (message.status === 'sent' || message.status == null) && <Check size={13} className="text-primary" aria-hidden />}
      {message.mine && message.status === 'failed' && <AlertCircle size={13} className="text-danger" aria-label={t('send_failed')} />}
      {message.mine && message.status === 'blocked' && <ShieldAlert size={13} className="text-danger" aria-label={tm('blocked_label')} />}
    </span>
  );
}

export interface TranslationState {
  text?: string;
  from?: string;
  failed?: boolean;
}

/** "Translated from Hindi · Show original" line under a translated message. */
export function TranslationToggle({
  translation,
  showOriginal,
  onToggle,
  onRetry,
}: {
  translation: TranslationState;
  showOriginal: boolean;
  onToggle: () => void;
  onRetry?: () => void;
}) {
  const t = useT();
  if (translation.failed) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-meta">
        <Languages size={13} aria-hidden />
        <span>{t('translation_unavailable')}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="min-h-[28px] font-semibold text-primary">
            {t('retry')}
          </button>
        )}
      </div>
    );
  }
  if (!translation.text) return null;
  const from = translation.from && translation.from !== 'auto' ? langNative(translation.from) : '';
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-meta">
      <Languages size={13} aria-hidden className="shrink-0" />
      <span>{showOriginal ? t('original') : from ? t('translated_from', { lang: from }) : t('translated')}</span>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <button type="button" onClick={onToggle} className="min-h-[28px] font-semibold text-primary">
        {showOriginal ? t('show_translation') : t('show_original')}
      </button>
    </div>
  );
}

export function MessageBubble({
  message,
  pos,
  text,
  senderLabel,
  translation,
  showOriginal = false,
  onToggleOriginal,
  onRetryTranslation,
  onRetrySend,
  streaming = false,
}: {
  message: ChatMessage;
  pos: BubblePosition;
  text: string;
  senderLabel?: string;
  translation?: TranslationState;
  showOriginal?: boolean;
  onToggleOriginal?: () => void;
  onRetryTranslation?: () => void;
  onRetrySend?: () => void;
  streaming?: boolean;
}) {
  const t = useT();
  const tm = ModerationStrings.use();
  const translated = translation?.text && !showOriginal ? translation.text : null;
  // Moderation replaced a word with the mask (Nexconn before delivery, or the composer before sending).
  const masked = message.status !== 'blocked' && text.includes(MODERATION_MASK);
  const body = translated ?? text;
  const hasToggle = Boolean(translation && (translation.text || translation.failed) && onToggleOriginal);
  const blocked = message.status === 'blocked';
  // A moderation notice gets its own line with the time under it, instead of the time tucked into the text.
  const footer = blocked || masked;
  const inlineMeta = !hasToggle && !footer;
  return (
    <BubbleShell mine={message.mine} pos={pos}>
      {senderLabel && pos.first && <div className="mb-0.5 text-[12px] font-semibold text-primary">{senderLabel}</div>}
      <p className="break-words whitespace-pre-wrap" lang={translated ? undefined : translation?.from}>
        {body}
        {streaming && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse rounded-full bg-ink-2 align-baseline" aria-hidden />}
        {/* Spacer so the time tucked into the last line never overlaps the text. */}
        {inlineMeta && <span className={clsx('inline-block', message.mine ? 'w-[74px]' : 'w-[56px]')} aria-hidden />}
      </p>
      {hasToggle && translation && onToggleOriginal && (
        <div className="flex flex-wrap items-end justify-between gap-x-3">
          <TranslationToggle translation={translation} showOriginal={showOriginal} onToggle={onToggleOriginal} onRetry={onRetryTranslation} />
          <MessageMeta message={message} className="mb-1.5 ml-auto" />
        </div>
      )}
      {inlineMeta && <MessageMeta message={message} className="absolute right-3 bottom-2" />}
      {footer && (
        <p className={clsx('mt-1 flex items-start gap-1 text-[12px] leading-snug', blocked ? 'font-medium text-danger' : 'text-meta')} role={blocked ? 'status' : undefined}>
          <ShieldAlert size={13} aria-hidden className="mt-[2px] shrink-0" />
          <span>{tm(blocked ? 'blocked' : 'masked')}</span>
        </p>
      )}
      {footer && !hasToggle && (
        <div className="flex justify-end">
          <MessageMeta message={message} className="mb-0.5" />
        </div>
      )}
      {message.status === 'failed' && onRetrySend && (
        <button type="button" onClick={onRetrySend} className="mt-1 block min-h-[28px] text-left text-[12px] font-semibold text-danger">
          {t('send_failed')}
        </button>
      )}
    </BubbleShell>
  );
}

/** Centered soft pill for system notices (group notifications, recalls…) and day separators. */
export function SystemPill({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center py-1">
      <span className="max-w-[86%] rounded-full bg-sunken px-3 py-1 text-center text-[12px] leading-snug text-meta">{children}</span>
    </div>
  );
}
