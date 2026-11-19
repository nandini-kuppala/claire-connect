// Chat composer: + button, rounded field on the sunken tone, and a 48px mic that turns into send when there is text.
// Mic supports hold-to-talk (release sends, slide left cancels) and tap-to-start / tap-to-send.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Loader2, Mic, Plus, SendHorizontal } from '../icons';
import clsx from 'clsx';
import { useT } from '../i18n';
import { RecordingBar, useVoiceRecorder, type VoiceClip } from './VoiceRecorder';

const HOLD_MS = 350;
const CANCEL_PX = 90;

export interface ComposerProps {
  onSendText: (text: string) => void;
  onVoice: (clip: VoiceClip) => void;
  onAttach?: () => void;
  /** Called while typing ('RC:TxtMsg') or recording ('CC:Voice'). */
  onTyping?: (typingType: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** A voice note is being uploaded / transcribed. */
  busy?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
}

export function Composer({ onSendText, onVoice, onAttach, onTyping, placeholder, disabled, busy, compact, autoFocus }: ComposerProps) {
  const t = useT();
  const [text, setText] = useState('');
  const [locked, setLocked] = useState(false);
  const [slide, setSlide] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const press = useRef<{ x: number; at: number; id: number } | null>(null);

  const recorder = useVoiceRecorder({ onComplete: onVoice });
  const recording = recorder.state !== 'idle';
  const hasText = text.trim().length > 0;

  // Auto-grow the textarea up to ~5 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  useEffect(() => {
    if (!recording) {
      setLocked(false);
      setSlide(0);
    }
  }, [recording]);

  useEffect(() => {
    if (recorder.state === 'recording') onTyping?.('CC:Voice');
  }, [recorder.state, onTyping]);

  useEffect(() => {
    if (!recorder.error) return;
    const id = setTimeout(recorder.clearError, 4000);
    return () => clearTimeout(id);
  }, [recorder.error, recorder.clearError]);

  const send = useCallback(() => {
    const v = text.trim();
    if (!v || disabled) return;
    onSendText(v);
    setText('');
    inputRef.current?.focus();
  }, [text, disabled, onSendText]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      send();
    }
  };

  // ── Mic gestures ──────────────────────────────────────────────────────────
  const onMicDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (hasText || disabled || busy || e.button > 0) return;
    if (recording) return; // tap-mode stop is handled on click
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { x: e.clientX, at: Date.now(), id: e.pointerId };
    void recorder.start();
  };

  const onMicMove = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId || locked) return;
    const dx = Math.max(0, p.x - e.clientX);
    setSlide(dx);
    if (dx > CANCEL_PX) {
      press.current = null;
      recorder.cancel();
    }
  };

  const onMicUp = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    setSlide(0);
    if (Date.now() - p.at < HOLD_MS) setLocked(true); // quick tap → keep recording until send is tapped
    else recorder.stop();
  };

  const onMicCancel = () => {
    if (!press.current) return;
    press.current = null;
    if (!locked) recorder.cancel();
  };

  const onMicClick = () => {
    if (hasText) return send();
    if (recording && locked && !press.current) recorder.stop();
  };

  const onMicKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (hasText || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (recording) recorder.stop();
    else {
      setLocked(true);
      void recorder.start();
    }
  };

  const errorText =
    recorder.error === 'denied' ? t('mic_denied') : recorder.error === 'unsupported' ? t('mic_unsupported') : recorder.error === 'failed' ? t('voice_failed') : '';

  const halo = recorder.state === 'recording' ? 1 + recorder.level * 0.9 : 1;
  const micLabel = hasText ? t('send') : recording ? t('send') : t('hold_to_talk');

  return (
    <div className={clsx('bg-surface', compact ? 'px-3 pt-2 pb-2' : 'px-2.5 pt-2 pb-[max(10px,var(--safe-bottom))]')}>
      {errorText && (
        <p role="alert" className="mx-1 mb-2 rounded-[16px] bg-danger-tint px-3 py-2 text-[13px] text-danger">
          {errorText}
        </p>
      )}
      <div className="flex items-end gap-1.5">
        {!recording && onAttach && (
          <button
            type="button"
            onClick={onAttach}
            disabled={disabled}
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken active:bg-sunken disabled:opacity-40"
            aria-label={t('attach')}
          >
            <Plus size={24} />
          </button>
        )}

        {recording ? (
          <RecordingBar elapsedMs={recorder.elapsedMs} locked={locked} slideOffset={slide} onCancel={() => recorder.cancel()} />
        ) : (
          <label className="flex min-h-[48px] flex-1 items-center rounded-[24px] border border-transparent bg-sunken px-4 transition-colors focus-within:border-line-strong focus-within:bg-surface">
            <span className="sr-only">{placeholder ?? t('chat_placeholder')}</span>
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              autoFocus={autoFocus}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) onTyping?.('RC:TxtMsg');
              }}
              onKeyDown={onKeyDown}
              placeholder={busy ? t('transcribing') : (placeholder ?? t('chat_placeholder'))}
              className="block max-h-[132px] w-full resize-none bg-transparent py-3 text-[15px] leading-[1.4] text-ink outline-none placeholder:text-meta"
              enterKeyHint="send"
            />
          </label>
        )}

        <div className="relative shrink-0">
          {recorder.state === 'recording' && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-danger/20 transition-transform duration-75"
              style={{ transform: `scale(${halo})` }}
            />
          )}
          <button
            type="button"
            onPointerDown={onMicDown}
            onPointerMove={onMicMove}
            onPointerUp={onMicUp}
            onPointerCancel={onMicCancel}
            onClick={onMicClick}
            onKeyDown={onMicKey}
            onContextMenu={(e) => e.preventDefault()}
            disabled={disabled || busy}
            aria-label={micLabel}
            title={micLabel}
            className={clsx(
              'relative flex size-12 touch-none items-center justify-center rounded-full text-white transition-colors select-none disabled:opacity-60',
              recording ? 'bg-danger' : 'bg-primary hover:bg-primary-hover active:bg-primary-press',
            )}
          >
            {busy ? (
              <Loader2 size={22} className="animate-spin" />
            ) : hasText || (recording && locked) ? (
              <SendHorizontal size={22} />
            ) : (
              <Mic size={22} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
