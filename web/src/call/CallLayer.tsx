// Global call UI: incoming call, calling / ringing, in-call (voice or video), ended, and friendly notices.
// Mounted once in App; everything it shows comes from the call store (service.ts).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, Lock, Mic, MicOff, Phone, PhoneOff, RefreshCw, Video, VideoOff, Volume2, type LucideIcon } from '../icons';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { TrustBadge } from '../components/TrustBadge';
import { isAgent, useSession } from '../store/session';
import { CallStrings, callDuration, type CallStringKey } from './call.strings';
import {
  acceptCall,
  answerVideoRequest,
  cycleSpeaker,
  endAllCalls,
  flipCamera,
  hangUp,
  switchMedia,
  toggleCamera,
  toggleMic,
  useCallStore,
  videoElements,
  type CallNotice,
  type CallResult,
} from './service';

const NOTICE: Record<CallNotice, { title: CallStringKey; body: CallStringKey; icon: LucideIcon }> = {
  off: { title: 'off_title', body: 'off_body', icon: Phone },
  permission: { title: 'perm_title', body: 'perm_body', icon: MicOff },
  insecure: { title: 'failed', body: 'secure_body', icon: Lock },
  failed: { title: 'failed', body: 'off_body', icon: AlertCircle },
  in_call: { title: 'already_in_call', body: 'off_body', icon: Phone },
};

const RESULT: Record<CallResult, CallStringKey> = {
  ended: 'ended',
  no_answer: 'no_answer',
  declined: 'declined',
  busy: 'busy',
  cancelled: 'cancelled',
  missed: 'missed_voice',
  failed: 'failed',
};

/** Seconds since `from`, ticking once a second. */
function useElapsed(from: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!from) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [from]);
  return from ? Math.max(0, Math.floor((now - from) / 1000)) : 0;
}

/** Hosts one of the SDK-bound <video> elements (they live outside React so the SDK can bind them early). */
function VideoSlot({ which, className, mirror }: { which: 'local' | 'remote'; className?: string; mirror?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = videoElements()[which];
    el.className = 'size-full object-cover';
    el.style.transform = mirror ? 'scaleX(-1)' : '';
    host.current?.appendChild(el);
    void el.play().catch(() => undefined);
    return () => {
      el.remove();
    };
  }, [which, mirror]);
  return <div ref={host} className={clsx('overflow-hidden', className)} />;
}

export function CallLayer() {
  const st = useCallStore();
  const s = CallStrings.use();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSession((x) => x.user);
  const elapsed = useElapsed(st.phase === 'active' ? st.startedAt : null);
  const [speakerLabel, setSpeakerLabel] = useState<string | null>(null);

  // Release media if the whole layer goes away (sign-out, hot reload).
  useEffect(() => () => endAllCalls(), []);

  // Esc hangs up / closes.
  useEffect(() => {
    if (st.phase === 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (st.phase === 'notice' || st.phase === 'ended')) void hangUp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st.phase]);

  if (st.phase === 'idle') return null;

  if (st.phase === 'notice' && st.notice) {
    const n = NOTICE[st.notice];
    const Icon = n.icon;
    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 sm:items-center" role="presentation" onClick={() => void hangUp()}>
        <div
          data-call-notice={st.notice}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="call-notice-title"
          className="m-3 w-full max-w-[420px] animate-fade-up rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow-float)]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-tint text-primary">
            <Icon size={22} aria-hidden />
          </span>
          <h2 id="call-notice-title" className="mt-3 font-head text-[18px] leading-snug font-semibold text-ink">
            {s(n.title)}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-meta">{s(n.body)}</p>
          {st.errorCode != null && <p className="mt-2 text-[11px] text-faint tabular-nums">Nexconn {st.errorCode}</p>}
          <Button block className="mt-4" onClick={() => void hangUp()}>
            {s('close')}
          </Button>
        </div>
      </div>
    );
  }

  const peer = st.peer;
  const video = st.media === 'video';
  const live = st.phase === 'active';
  const showRemoteVideo = video && live && !st.remoteCamOff;
  const dark = video && st.phase !== 'incoming' && st.phase !== 'ended';

  let status: string;
  if (st.phase === 'incoming') status = s(video ? 'incoming_video' : 'incoming_voice');
  else if (st.phase === 'outgoing') status = s(st.ringing ? 'ringing' : 'calling');
  else if (st.phase === 'connecting') status = s('connecting');
  else if (st.phase === 'ended') {
    const key = st.result === 'missed' && video ? 'missed_video' : RESULT[st.result ?? 'ended'];
    status = st.result === 'ended' && st.durationSec ? `${s('ended')} · ${callDuration(st.durationSec)}` : s(key);
  } else status = callDuration(elapsed);

  const accept = async () => {
    const conv = st.context?.conversationId;
    await acceptCall();
    // Land in the deal chat after the call (callee side).
    if (conv && user && !isAgent(user) && location.pathname !== `/chat/${conv}`) navigate(`/chat/${conv}`);
  };

  const controls: { id: string; label: string; icon: LucideIcon; on?: boolean; run: () => void; hidden?: boolean }[] = [
    { id: 'mic', label: s(st.micOn ? 'mute' : 'unmute'), icon: st.micOn ? Mic : MicOff, on: !st.micOn, run: () => void toggleMic() },
    { id: 'cam', label: s('camera'), icon: st.camOn ? Video : VideoOff, on: !st.camOn, run: () => void toggleCamera(), hidden: !video },
    { id: 'flip', label: s('flip'), icon: RefreshCw, run: () => void flipCamera(), hidden: !video || st.cameras < 2 },
    {
      id: 'speaker',
      label: speakerLabel ? speakerLabel.slice(0, 14) : s('speaker'),
      icon: Volume2,
      run: () => void cycleSpeaker().then(setSpeakerLabel),
      hidden: video || st.outputs < 2,
    },
    { id: 'switch', label: s(video ? 'to_voice' : 'to_video'), icon: video ? Phone : Video, on: st.switching, run: () => void switchMedia() },
  ];

  return (
    <div data-call-phase={st.phase} className="fixed inset-0 z-[80] flex justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={peer?.name ?? s('voice_call')}>
      <div
        className={clsx(
          'relative flex h-dvh w-full max-w-[480px] flex-col overflow-hidden min-[481px]:shadow-[0_0_0_1px_var(--color-line)]',
          dark ? 'bg-ink text-white' : 'bg-page text-ink',
        )}
      >
        {/* Video surfaces */}
        {video && (live || st.phase === 'outgoing' || st.phase === 'connecting') && (
          <>
            {showRemoteVideo && <VideoSlot which="remote" className="absolute inset-0" />}
            <VideoSlot
              which="local"
              mirror
              className={clsx(
                'absolute z-10 rounded-[18px] border border-white/20 bg-ink',
                live ? 'top-[calc(16px+var(--safe-top))] right-4 h-40 w-28' : 'inset-0 rounded-none border-0 opacity-90',
                !st.camOn && 'invisible',
              )}
            />
          </>
        )}

        {/* Who */}
        <div
          className={clsx(
            'relative z-20 flex flex-col',
            showRemoteVideo
              ? // Over the remote video: a small solid label top-left.
                'mx-4 mt-[calc(16px+var(--safe-top))] items-start self-start rounded-[18px] bg-ink/55 px-4 py-2.5 text-left'
              : 'mt-[calc(72px+var(--safe-top))] items-center px-6 text-center',
            // Over the camera preview: a solid backing keeps the name and status readable.
            dark && !showRemoteVideo && 'mx-6 rounded-[22px] bg-ink/55 py-5',
          )}
        >
          {!showRemoteVideo && (
            <span className="relative mb-5 inline-flex">
              {(st.phase === 'incoming' || st.phase === 'outgoing') && (
                <span aria-hidden className={clsx('absolute inset-0 animate-pulse-ring rounded-full', dark ? 'bg-white/25' : 'bg-primary-soft')} />
              )}
              <Avatar name={peer?.name} accent={peer?.accent} size={112} />
            </span>
          )}
          <div className={clsx('flex max-w-full flex-wrap items-center gap-2', showRemoteVideo ? 'justify-start' : 'justify-center')}>
            <h2 className={clsx('font-head font-semibold', showRemoteVideo ? 'text-[18px] drop-shadow' : 'text-[26px] leading-tight')}>{peer?.name}</h2>
            {!showRemoteVideo && peer?.trust != null && <TrustBadge trust={peer.trust} size="md" />}
          </div>
          {!showRemoteVideo && peer?.sub && <p className={clsx('mt-1 text-[14px]', dark ? 'text-white/70' : 'text-meta')}>{peer.sub}</p>}
          <p
            className={clsx(
              showRemoteVideo ? 'mt-0.5 text-[14px] tabular-nums' : 'mt-2 text-[15px] tabular-nums',
              st.phase === 'ended' && st.result !== 'ended' ? 'font-semibold text-clay' : dark ? 'text-white/85' : 'text-ink-2',
              showRemoteVideo && 'drop-shadow',
            )}
            aria-live="polite"
          >
            {status}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {live && st.remoteMicOff && <Chip dark={dark} icon={MicOff}>{s('mic_off_them')}</Chip>}
            {live && video && st.remoteCamOff && <Chip dark={dark} icon={VideoOff}>{s('camera_off_them')}</Chip>}
            {st.flash && <Chip dark={dark}>{s(st.flash as CallStringKey)}</Chip>}
          </div>
        </div>

        <div className="flex-1" />

        {/* Upgrade request from the other side */}
        {st.videoRequest && (
          <div className="relative z-20 mx-4 mb-4 animate-fade-up rounded-[18px] border border-line bg-surface p-4 text-ink shadow-[var(--shadow-float)]">
            <p className="text-[15px] font-medium">{s('video_request', { name: peer?.name ?? '' })}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => void answerVideoRequest(false)}>
                {s('not_now')}
              </Button>
              <Button size="sm" className="flex-1" icon={Video} onClick={() => void answerVideoRequest(true)}>
                {s('switch')}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="relative z-20 px-6 pb-[calc(32px+var(--safe-bottom))]">
          {st.phase === 'incoming' ? (
            <div className="flex items-start justify-around">
              <RoundAction id="decline" label={s('decline')} icon={PhoneOff} tone="danger" onClick={() => void hangUp()} />
              <RoundAction id="accept" label={s('accept')} icon={video ? Video : Phone} tone="success" onClick={() => void accept()} />
            </div>
          ) : st.phase === 'ended' ? null : (
            <>
              {live && (
                <div className={clsx('mb-6 flex flex-wrap items-start justify-center gap-x-3 gap-y-4', dark && 'rounded-[22px] bg-ink/55 px-2 py-3')}>
                  {controls
                    .filter((c) => !c.hidden)
                    .map((c) => (
                      <ToggleAction key={c.id} id={c.id} label={c.label} icon={c.icon} on={c.on} dark={dark} onClick={c.run} />
                    ))}
                </div>
              )}
              <div className="flex justify-center">
                <RoundAction id="hangup" label={s('hang_up')} icon={PhoneOff} tone="danger" dark={dark} onClick={() => void hangUp()} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, icon: Icon, dark }: { children: ReactNode; icon?: LucideIcon; dark?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium', dark ? 'bg-white/15 text-white' : 'bg-sunken text-ink-2')}>
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </span>
  );
}

function RoundAction({ id, label, icon: Icon, tone, dark, onClick }: { id: string; label: string; icon: LucideIcon; tone: 'danger' | 'success'; dark?: boolean; onClick: () => void }) {
  return (
    <button type="button" data-call-action={id} onClick={onClick} className="flex w-24 flex-col items-center gap-2" aria-label={label}>
      <span className={clsx('flex size-[68px] items-center justify-center rounded-full text-white', tone === 'danger' ? 'bg-danger active:brightness-90' : 'bg-success active:brightness-90')}>
        <Icon size={28} aria-hidden />
      </span>
      <span className={clsx('text-[13px] font-medium', dark ? 'text-white/90' : 'text-ink-2')}>{label}</span>
    </button>
  );
}

function ToggleAction({ id, label, icon: Icon, on, dark, onClick }: { id: string; label: string; icon: LucideIcon; on?: boolean; dark?: boolean; onClick: () => void }) {
  return (
    <button type="button" data-call-action={id} onClick={onClick} aria-pressed={on} className="flex w-[68px] flex-col items-center gap-1.5" aria-label={label}>
      <span
        className={clsx(
          'flex size-14 items-center justify-center rounded-full transition-colors',
          on ? (dark ? 'bg-white text-ink' : 'bg-ink text-white') : dark ? 'bg-white/15 text-white' : 'border border-line bg-surface text-ink',
        )}
      >
        <Icon size={22} aria-hidden />
      </span>
      <span className={clsx('text-center text-[12px] leading-tight', dark ? 'text-white/85' : 'text-ink-2')}>{label}</span>
    </button>
  );
}
