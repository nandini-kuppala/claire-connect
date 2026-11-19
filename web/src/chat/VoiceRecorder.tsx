// Voice capture: MediaRecorder (opus webm, mp4 fallback), max 60 s, live input level,
// plus the recording bar shown in the composer and the STT upload helper.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Trash2 } from '../icons';
import { api } from '../lib/api';
import { duration } from '../lib/format';
import { useT } from '../i18n';

export interface VoiceClip {
  blob: Blob;
  durationMs: number;
  mime: string;
}

export interface SttResult {
  text: string;
  lang: string;
  audioUrl: string;
  durationMs: number;
}

export const MAX_VOICE_MS = 60_000;
const MIN_VOICE_MS = 600;

export function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

export const voiceExt = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

export const canRecord = () => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** POST /api/voice/stt → transcript, detected language and the stored audio URL. */
export async function transcribeClip(clip: VoiceClip, lang: string): Promise<SttResult> {
  const form = new FormData();
  form.append('audio', clip.blob, `voice.${voiceExt(clip.mime)}`);
  form.append('lang', lang);
  form.append('durationMs', String(Math.round(clip.durationMs)));
  const r = await api.upload<Partial<SttResult>>('/api/voice/stt', form);
  return {
    text: String(r?.text ?? '').trim(),
    lang: String(r?.lang || lang),
    audioUrl: String(r?.audioUrl ?? ''),
    durationMs: Number(r?.durationMs) || clip.durationMs,
  };
}

export type RecorderState = 'idle' | 'starting' | 'recording';
export type RecorderError = 'denied' | 'unsupported' | 'failed' | null;

/**
 * `start()` asks for the mic and begins recording; `stop()` finishes and calls `onComplete`;
 * `cancel()` discards. `level` is a smoothed 0..1 input level for the halo animation.
 */
export function useVoiceRecorder({ onComplete, maxMs = MAX_VOICE_MS }: { onComplete: (clip: VoiceClip) => void; maxMs?: number }) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<RecorderError>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const cancelled = useRef(false);
  const wantStop = useRef<'stop' | 'cancel' | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    rec.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => {
    cancelled.current = true;
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    cleanup();
  }, [cleanup]);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') {
      cancelled.current = false;
      rec.current.stop();
    } else if (state === 'starting') wantStop.current = 'stop';
  }, [state]);

  const cancel = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') {
      cancelled.current = true;
      rec.current.stop();
    } else if (state === 'starting') wantStop.current = 'cancel';
  }, [state]);

  const start = useCallback(async (): Promise<boolean> => {
    if (state !== 'idle') return false;
    setError(null);
    if (!canRecord()) {
      setError('unsupported');
      return false;
    }
    setState('starting');
    wantStop.current = null;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      setState('idle');
      setError((err as DOMException)?.name === 'NotAllowedError' || (err as DOMException)?.name === 'SecurityError' ? 'denied' : 'failed');
      return false;
    }
    if (wantStop.current === 'cancel') {
      media.getTracks().forEach((tr) => tr.stop());
      setState('idle');
      return false;
    }
    stream.current = media;
    const mime = pickMime();
    let mr: MediaRecorder;
    try {
      mr = mime ? new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 32_000 }) : new MediaRecorder(media);
    } catch {
      cleanup();
      setState('idle');
      setError('unsupported');
      return false;
    }
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const ms = Date.now() - startedAt.current;
      const type = mr.mimeType || mime || 'audio/webm';
      const wasCancelled = cancelled.current;
      cleanup();
      setState('idle');
      setElapsed(0);
      if (!wasCancelled && ms >= MIN_VOICE_MS && chunks.length) onCompleteRef.current({ blob: new Blob(chunks, { type }), durationMs: Math.min(ms, maxMs), mime: type });
    };
    rec.current = mr;
    cancelled.current = false;
    startedAt.current = Date.now();
    mr.start(250);
    setState('recording');
    setElapsed(0);

    timer.current = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= maxMs && rec.current?.state === 'recording') rec.current.stop();
    }, 100);

    // Live level for the halo.
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtx.current = ctx;
        const src = ctx.createMediaStreamSource(media);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let smooth = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
          smooth = smooth * 0.7 + rms * 0.3;
          setLevel(smooth);
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch {
      /* level is decorative */
    }

    if (wantStop.current) {
      cancelled.current = wantStop.current === 'cancel';
      mr.stop();
    }
    return true;
  }, [state, cleanup, maxMs]);

  return { state, elapsedMs, level, error, start, stop, cancel, clearError: () => setError(null) };
}

/** Replaces the text pill while recording: red dot, timer, slide/visible cancel. */
export function RecordingBar({
  elapsedMs,
  locked,
  slideOffset,
  onCancel,
}: {
  elapsedMs: number;
  locked: boolean;
  slideOffset: number;
  onCancel: () => void;
}) {
  const t = useT();
  const remaining = MAX_VOICE_MS - elapsedMs;
  return (
    <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-[24px] bg-sunken pr-4 pl-1" role="status" aria-live="polite">
      <button
        type="button"
        onClick={onCancel}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-danger transition-colors hover:bg-danger-tint"
        aria-label={t('cancel')}
      >
        <Trash2 size={20} />
      </button>
      <span className="relative flex size-2.5 shrink-0" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-60" />
        <span className="relative size-2.5 rounded-full bg-danger" />
      </span>
      <span className={`font-medium tabular-nums ${remaining < 10_000 ? 'text-danger' : 'text-ink'}`}>{duration(elapsedMs)}</span>
      <span className="sr-only">{t('recording')}</span>
      <span
        className="ml-auto flex min-w-0 items-center gap-1 truncate text-[13px] text-meta transition-transform"
        style={{ transform: `translateX(${-Math.min(slideOffset, 90)}px)`, opacity: 1 - Math.min(slideOffset, 90) / 140 }}
      >
        {locked ? (
          t('tap_stop')
        ) : (
          <>
            <ChevronLeft size={14} aria-hidden />
            {t('slide_cancel')}
          </>
        )}
      </span>
    </div>
  );
}
