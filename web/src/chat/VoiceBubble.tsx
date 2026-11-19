// Voice note bubble: play/pause, deterministic waveform, duration, transcript in my
// language, "Listen in <my language>" (TTS) and "Original" audio.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play, Volume2 } from '../icons';
import clsx from 'clsx';
import type { VoicePayload } from '@shared/cards';
import { api } from '../lib/api';
import { duration, hash, langNative } from '../lib/format';
import { useT } from '../i18n';
import type { ChatMessage } from './engine';
import { BubbleShell, MessageMeta, TranslationToggle, type BubblePosition, type TranslationState } from './MessageBubble';

const BARS = 30;
const ttsCache = new Map<string, string | null>();

function bars(seed: string): number[] {
  // mulberry32 PRNG seeded from the message id: same waveform on every device.
  let a = hash(seed) || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: BARS }, (_, i) => {
    const envelope = 0.55 + 0.45 * Math.sin((i / (BARS - 1)) * Math.PI);
    return Math.round(4 + rnd() * 18 * envelope);
  });
}

export function VoiceBubble({
  message,
  payload,
  pos,
  myLang,
  translation,
  showOriginal = false,
  onToggleOriginal,
  onRetryTranslation,
  senderLabel,
}: {
  message: ChatMessage;
  payload: VoicePayload;
  pos: BubblePosition;
  myLang: string;
  translation?: TranslationState;
  showOriginal?: boolean;
  onToggleOriginal?: () => void;
  onRetryTranslation?: () => void;
  senderLabel?: string;
}) {
  const t = useT();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState<'original' | 'tts'>('original');
  const [ttsUrl, setTtsUrl] = useState<string | null>(() => ttsCache.get(`${message.id}|${myLang}`) ?? null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsFailed, setTtsFailed] = useState(false);
  const heights = useMemo(() => bars(message.id), [message.id]);

  const transcript = (payload.transcript || '').trim();
  const translated = translation?.text && !showOriginal ? translation.text : null;
  const shownTranscript = translated ?? transcript;
  const foreign = Boolean(payload.lang && payload.lang !== myLang && transcript);
  const totalMs = payload.durationMs || 0;
  const pending = message.status === 'sending';

  useEffect(() => () => audio.current?.pause(), []);

  function ensureAudio(): HTMLAudioElement {
    if (!audio.current) {
      const a = new Audio();
      a.preload = 'none';
      a.addEventListener('timeupdate', () => {
        const d = a.duration && Number.isFinite(a.duration) ? a.duration * 1000 : totalMs;
        setProgress(d ? Math.min(1, (a.currentTime * 1000) / d) : 0);
      });
      a.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
      });
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('play', () => setPlaying(true));
      audio.current = a;
    }
    return audio.current;
  }

  async function playUrl(url: string, which: 'original' | 'tts') {
    const a = ensureAudio();
    if (a.src !== new URL(url, location.href).href) {
      a.src = url;
      setProgress(0);
    }
    setSource(which);
    try {
      await a.play();
    } catch {
      setPlaying(false);
    }
  }

  function toggle() {
    const a = ensureAudio();
    if (playing) return a.pause();
    const url = source === 'tts' && ttsUrl ? ttsUrl : payload.audioUrl;
    if (url) void playUrl(url, source === 'tts' && ttsUrl ? 'tts' : 'original');
  }

  async function listenTranslated() {
    if (ttsUrl) return playUrl(ttsUrl, 'tts');
    setTtsLoading(true);
    setTtsFailed(false);
    try {
      const r = await api.post<{ url: string | null }>('/api/voice/tts', { text: translation?.text || transcript, lang: myLang });
      ttsCache.set(`${message.id}|${myLang}`, r?.url ?? null);
      if (r?.url) {
        setTtsUrl(r.url);
        await playUrl(r.url, 'tts');
      } else setTtsFailed(true);
    } catch {
      setTtsFailed(true);
    } finally {
      setTtsLoading(false);
    }
  }

  const playedBars = Math.round(progress * BARS);
  const mine = message.mine;

  return (
    <BubbleShell mine={mine} pos={pos} wide className="min-w-[240px] pb-2">
      {senderLabel && pos.first && <div className="mb-0.5 text-[12px] font-semibold text-primary">{senderLabel}</div>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!payload.audioUrl}
          aria-label={playing ? t('pause') : t('play')}
          className={clsx(
            'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50',
            mine ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-primary-tint text-primary hover:bg-primary-soft',
          )}
        >
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-[1px]" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-[2px]" aria-hidden>
            {heights.map((h, i) => (
              <span
                key={i}
                className="w-[3px] shrink-0 rounded-full transition-colors"
                style={{ height: h, background: i < playedBars ? 'var(--color-primary)' : mine ? '#9DBFAF' : 'var(--color-line-strong)' }}
              />
            ))}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-meta">
            <span className="tabular-nums">{duration(playing || progress ? progress * totalMs : totalMs)}</span>
            {source === 'tts' && (
              <span className="inline-flex items-center gap-0.5 text-primary">
                <Volume2 size={11} aria-hidden /> {langNative(myLang)}
              </span>
            )}
            <MessageMeta message={message} className="ml-auto" />
          </div>
        </div>
      </div>

      {pending && !transcript && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-meta">
          <Loader2 size={13} className="animate-spin" aria-hidden /> {t('transcribing')}
        </p>
      )}

      {shownTranscript && (
        <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-ink" lang={translated ? myLang : payload.lang}>
          {shownTranscript}
        </p>
      )}

      {foreign && translation && onToggleOriginal && (
        <TranslationToggle
          translation={{ ...translation, from: translation.from ?? payload.lang }}
          showOriginal={showOriginal}
          onToggle={onToggleOriginal}
          onRetry={onRetryTranslation}
        />
      )}

      {foreign && !mine && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={listenTranslated}
            disabled={ttsLoading}
            className={clsx(
              'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
              source === 'tts' ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-primary hover:bg-primary-tint',
            )}
          >
            {ttsLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
            {t('listen_in', { lang: langNative(myLang) })}
          </button>
          <button
            type="button"
            onClick={() => payload.audioUrl && playUrl(payload.audioUrl, 'original')}
            className={clsx(
              'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
              source === 'original' && playing ? 'border-ink-2 bg-ink-2 text-white' : 'border-line bg-surface text-ink-2 hover:bg-sunken',
            )}
          >
            <Play size={13} /> {t('original')} · {langNative(payload.lang)}
          </button>
          {ttsFailed && <span className="self-center text-[12px] text-meta">{t('translation_unavailable')}</span>}
        </div>
      )}
    </BubbleShell>
  );
}
