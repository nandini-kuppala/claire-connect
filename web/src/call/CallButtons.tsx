// Header call buttons (voice + video) and the in-chat call summary line.
import clsx from 'clsx';
import { Phone, Video } from '../icons';
import type { CallPayload } from '@shared/cards';
import { useSession } from '../store/session';
import { CallStrings, callSummaryText } from './call.strings';
import { startCall, useCallStore, type CallContext, type CallPeer } from './service';

/** True when this session can place calls at all (Nexconn chat mode, WebRTC in the browser). */
export function useCanCall(): boolean {
  const mode = useSession((s) => s.chat?.mode);
  const availability = useCallStore((s) => s.availability);
  return mode === 'nexconn' && availability !== 'unsupported' && typeof RTCPeerConnection !== 'undefined';
}

export function CallButtons({ peer, context, className }: { peer: CallPeer | null; context: CallContext; className?: string }) {
  const s = CallStrings.use();
  const can = useCanCall();
  const busy = useCallStore((x) => x.phase !== 'idle' && x.phase !== 'notice' && x.phase !== 'ended');
  if (!can || !peer?.userId) return null;
  const btn = 'flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-sunken disabled:opacity-40';
  return (
    <span className={clsx('flex shrink-0 items-center', className)}>
      <button type="button" data-call="audio" className={btn} aria-label={s('voice_call')} title={s('voice_call')} disabled={busy} onClick={() => void startCall(peer, 'audio', context)}>
        <Phone size={21} />
      </button>
      <button type="button" data-call="video" className={btn} aria-label={s('video_call')} title={s('video_call')} disabled={busy} onClick={() => void startCall(peer, 'video', context)}>
        <Video size={22} />
      </button>
    </span>
  );
}

/** Centered system line in the chat for a CC:Call message. */
export function CallLine({ payload }: { payload: Partial<CallPayload> }) {
  const lang = useSession((s) => s.user?.language || 'en');
  CallStrings.use(); // re-render when the language changes
  const missed = payload.outcome !== 'completed';
  const Icon = payload.media === 'video' ? Video : Phone;
  return (
    <div className="flex w-full animate-fade-up justify-center">
      <span
        data-call-line={payload.outcome ?? 'missed'}
        data-call-id={payload.callId}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium tabular-nums',
          missed ? 'border-clay/25 bg-clay-tint text-clay' : 'border-line bg-surface text-ink-2',
        )}
      >
        <Icon size={15} aria-hidden />
        {callSummaryText(payload, lang)}
      </span>
    </div>
  );
}
