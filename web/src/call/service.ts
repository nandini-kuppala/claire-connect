// Voice and video calls on the Nexconn Call SDK (@nexconn/call), riding on the chat connection.
//
// Wiring (see chat/engine.ts): NCEngine.initialize → initCallEngine() (NCCallEngine.initialize + event handler)
// → NCEngine.connect. The SDK chunk is loaded lazily, so the main bundle stays small; engine.ts waits for it
// (with a timeout) before connecting, because the Call plugin must be installed before the connection is made.
//
// One call at a time, 1:1 only (NCCallType.SINGLE). The caller posts a CC:Call summary ("Voice call · 2:31",
// "Missed call") into the deal chat when the call ends. A global <CallLayer/> renders every phase from the store.
import { create } from 'zustand';
import type * as CallSdkModule from '@nexconn/call';
import type { NCCallEngine, NCCallEndReason as EndReason, NCCallSession } from '@nexconn/call';
import { CC_CALL, type CallOutcome, type CallPayload } from '@shared/cards';
import { engine, type Channel } from '../chat/engine';
import { useSession } from '../store/session';
import type { TrustLike } from '../components/TrustBadge';

type CallSdk = typeof CallSdkModule;
export type CallMedia = 'audio' | 'video';
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended' | 'notice';
/** Why a call could not start: shown as a friendly sheet instead of a broken call screen. */
export type CallNotice = 'off' | 'permission' | 'insecure' | 'failed' | 'in_call';
/** What the "ended" screen says. */
export type CallResult = 'ended' | 'no_answer' | 'declined' | 'busy' | 'cancelled' | 'missed' | 'failed';
export type CallAvailability = 'unknown' | 'on' | 'off' | 'unsupported';

export interface CallPeer {
  userId: string;
  name: string;
  accent?: string | null;
  trust?: TrustLike;
  /** One short line under the name: "Stitching unit · Tiruppur" or "Trade Desk". */
  sub?: string | null;
}

/** Where the call belongs: the deal chat that receives the summary, and the conversation to open. */
export interface CallContext {
  channel?: Channel | null;
  conversationId?: string | null;
}

/** Caller identity and context, sent to the callee in `extra` (the callee has no other way to know the name). */
interface CallExtra {
  v: 1;
  name: string;
  accent?: string | null;
  trust?: number | null;
  sub?: string | null;
  ch?: string | null;
  conv?: string | null;
}

interface CallState {
  phase: CallPhase;
  availability: CallAvailability;
  media: CallMedia;
  direction: 'out' | 'in' | null;
  peer: CallPeer | null;
  context: CallContext | null;
  callId: string | null;
  /** Remote device is ringing (outgoing). */
  ringing: boolean;
  startedAt: number | null;
  micOn: boolean;
  camOn: boolean;
  remoteMicOff: boolean;
  remoteCamOff: boolean;
  /** Pending upgrade request from the other side. */
  videoRequest: { transactionId: string } | null;
  /** My own pending media-type change. */
  switching: boolean;
  /** Short status line (e.g. "Staying on voice"). Cleared after a few seconds. */
  flash: string | null;
  result: CallResult | null;
  durationSec: number;
  notice: CallNotice | null;
  /** Last SDK result code that was not success (logged too). */
  errorCode: number | null;
  outputs: number;
  cameras: number;
}

const IDLE: Omit<CallState, 'availability' | 'outputs' | 'cameras'> = {
  phase: 'idle',
  media: 'audio',
  direction: null,
  peer: null,
  context: null,
  callId: null,
  ringing: false,
  startedAt: null,
  micOn: true,
  camOn: true,
  remoteMicOff: false,
  remoteCamOff: false,
  videoRequest: null,
  switching: false,
  flash: null,
  result: null,
  durationSec: 0,
  notice: null,
  errorCode: null,
};

export const useCallStore = create<CallState>(() => ({ ...IDLE, availability: 'unknown', outputs: 0, cameras: 0 }));
const set = (p: Partial<CallState>) => useCallStore.setState(p);
const get = () => useCallStore.getState();

// ── SDK bootstrap ───────────────────────────────────────────────────────────
let sdk: CallSdk | null = null;
let ce: NCCallEngine | null = null;
let initPromise: Promise<void> | null = null;

const CODE_NAMES: Record<number, string> = {
  80001: 'PARAM_ERROR',
  80002: 'ON_CALLING',
  80003: 'NOT_IN_CALL',
  80004: 'MEDIA_TYPE_INVALID',
  80005: 'NOT_VIDEO_CALL',
  80006: 'VOIP_SERVICE_UNAVAILABLE',
  80007: 'USER_LIST_INVAILD',
  80010: 'USER_ID_INVALID',
  80012: 'CHAT_DISCONNECTED',
  80100: 'CAMERA_CLOSED',
  80101: 'MICROPHONE_CLOSED',
  80102: 'MEDIA_RESOURCE_INVALIED',
  80104: 'PLAY_MEDIA_FAILED',
  80105: 'VIDEO_VIEW_NOT_SET',
};
const codeName = (code: number) => `${code}${CODE_NAMES[code] ? ` ${CODE_NAMES[code]}` : ''}`;
function logCode(what: string, code: number, extra?: unknown) {
  console.warn(`[call] ${what} failed: Nexconn code ${codeName(code)}`, extra ?? '');
}

function supported(): boolean {
  return typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Loads @nexconn/call and initialises NCCallEngine. Must run after NCEngine.initialize and before
 * NCEngine.connect (engine.ts does this). Safe to call repeatedly; never throws.
 */
export function initCallEngine(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!supported()) {
      set({ availability: 'unsupported' });
      return;
    }
    try {
      sdk = await import('@nexconn/call');
      ce = sdk.NCCallEngine.initialize({ logOutputLevel: sdk.NCCallLogLevel.WARN });
      ce.setCallEventHandler(handler);
      console.info(`[call] Nexconn Call SDK ${sdk.NCCallEngine.getVersion()} ready`);
    } catch (err) {
      ce = null;
      set({ availability: 'unsupported' });
      console.warn('[call] Call SDK could not start', err);
    }
  })();
  return initPromise;
}

/** Engine is connected: remember that calls can be tried (the real check is the first startCall). */
export function onChatConnected() {
  if (ce && get().availability === 'unknown') set({ availability: 'on' });
}

// ── Media elements (created once, moved into the call screen by <VideoSlot>) ─
let localVideo: HTMLVideoElement | null = null;
let remoteVideo: HTMLVideoElement | null = null;
function makeVideo(muted: boolean) {
  const v = document.createElement('video');
  v.autoplay = true;
  v.playsInline = true;
  v.muted = muted;
  v.setAttribute('playsinline', '');
  return v;
}
export function videoElements() {
  localVideo ??= makeVideo(true);
  remoteVideo ??= makeVideo(false);
  return { local: localVideo, remote: remoteVideo };
}

function bindViews(peerId: string) {
  if (!ce) return;
  const { local, remote } = videoElements();
  const a = ce.setLocalVideoView({ videoElement: local });
  if (a.code !== 0) logCode('setLocalVideoView', a.code);
  const b = ce.setRemoteVideoView([{ userId: peerId, videoElement: remote }]);
  if (b.code !== 0) logCode('setRemoteVideoView', b.code);
}

function releaseViews(peerId?: string | null) {
  if (ce && peerId) {
    try {
      ce.removeVideoView([peerId]);
    } catch {
      /* already gone */
    }
  }
  for (const v of [localVideo, remoteVideo]) {
    if (!v) continue;
    const s = v.srcObject as MediaStream | null;
    // Remote tracks belong to the SDK's peer connection; only stop our local capture.
    if (s && v === localVideo) s.getTracks().forEach((t) => t.stop());
    v.srcObject = null;
  }
}

// ── Ring tones (Web Audio, no files) ─────────────────────────────────────────
let audioCtx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;
function tone(freqs: number[], ms: number, gain = 0.05) {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const now = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.03);
    g.gain.setValueAtTime(gain, now + ms / 1000 - 0.05);
    g.gain.linearRampToValueAtTime(0, now + ms / 1000);
    g.connect(audioCtx.destination);
    for (const f of freqs) {
      const o = audioCtx.createOscillator();
      o.frequency.value = f;
      o.connect(g);
      o.start(now);
      o.stop(now + ms / 1000);
    }
  } catch {
    /* audio blocked until the user interacts: silent ring */
  }
}
function startRing(kind: 'in' | 'out') {
  stopRing();
  const play = () => {
    if (kind === 'out') tone([440, 480], 1200, 0.035);
    else {
      tone([660, 880], 350, 0.06);
      setTimeout(() => tone([660, 880], 350, 0.06), 450);
      navigator.vibrate?.([300, 150, 300]);
    }
  };
  play();
  ringTimer = setInterval(play, kind === 'out' ? 3500 : 2600);
}
function stopRing() {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
let flashTimer: ReturnType<typeof setTimeout> | null = null;
function flash(text: string) {
  set({ flash: text });
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => set({ flash: null }), 3500);
}

let endTimer: ReturnType<typeof setTimeout> | null = null;
function toIdle(delay = 0) {
  if (endTimer) clearTimeout(endTimer);
  const go = () => {
    endTimer = null;
    const { availability, outputs, cameras } = get();
    useCallStore.setState({ ...IDLE, availability, outputs, cameras }, true);
  };
  if (delay) endTimer = setTimeout(go, delay);
  else go();
}

function mediaOf(session: NCCallSession): CallMedia {
  return sdk && session.getMediaType() === sdk.NCCallMediaType.AUDIO ? 'audio' : 'video';
}

function parseExtra(extra?: string): CallExtra | null {
  if (!extra) return null;
  try {
    const x = JSON.parse(extra) as CallExtra;
    return x && typeof x === 'object' && typeof x.name === 'string' ? x : null;
  } catch {
    return null;
  }
}

/** Asks the browser for the microphone (and camera) up front, so a refusal shows a clear message. */
async function checkDevices(media: CallMedia): Promise<CallNotice | null> {
  if (!window.isSecureContext) return 'insecure';
  if (!supported()) return 'failed';
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: media === 'video' });
    s.getTracks().forEach((t) => t.stop());
    return null;
  } catch (err) {
    const name = (err as DOMException)?.name;
    console.warn('[call] getUserMedia failed', name, err);
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
    // No camera on this device: a video call still works as voice on our side.
    if (media === 'video' && (name === 'NotFoundError' || name === 'OverconstrainedError')) return null;
    return 'permission';
  }
}

async function countDevices() {
  if (!ce) return;
  try {
    const [outs, cams] = await Promise.all([ce.getAudioOutputDevices(), ce.getVideoInputDevices()]);
    set({ outputs: outs.length, cameras: cams.length });
  } catch {
    /* labels hidden before permission: ignore */
  }
}

function myIdentity(): Omit<CallExtra, 'v' | 'ch' | 'conv'> & { name: string } {
  const s = sessionSnapshot();
  if (s.role === 'agent' || s.role === 'supervisor') return { name: s.userName || 'Trade Desk', sub: 'Trade Desk' };
  return { name: s.businessName || s.userName || '', accent: s.accent, trust: s.trust, sub: s.city };
}

function sessionSnapshot() {
  const s = useSession.getState();
  const trust = s.trust?.score ?? (s.business?.trust as { score?: number } | undefined)?.score ?? null;
  return {
    role: s.user?.role,
    userName: s.user?.name ?? '',
    businessName: s.business?.name ?? '',
    accent: s.business?.accent ?? null,
    city: s.business?.city ?? null,
    trust: typeof trust === 'number' ? trust : null,
  };
}

// ── Public actions ──────────────────────────────────────────────────────────
/** Starts a 1:1 voice or video call to `peer`. The summary goes to `context.channel` when it ends. */
export async function startCall(peer: CallPeer, media: CallMedia, context: CallContext = {}) {
  const st = get();
  if (st.phase !== 'idle' && st.phase !== 'notice' && st.phase !== 'ended') {
    set({ phase: st.phase }); // ignore double taps
    return;
  }
  toIdle();
  set({ peer, media, context, direction: 'out' });

  if (!window.isSecureContext) return showNotice('insecure');
  await initCallEngine();
  if (!ce || !sdk) return showNotice('failed');
  if (get().availability === 'off') return showNotice('off', 80006);

  set({ phase: 'outgoing', ringing: false, micOn: true, camOn: media === 'video' });
  const deviceIssue = await checkDevices(media);
  if (deviceIssue) return showNotice(deviceIssue);
  if (get().phase !== 'outgoing') return; // cancelled while the permission prompt was open

  bindViews(peer.userId);
  const me = myIdentity();
  const extra: CallExtra = { v: 1, ...me, ch: context.channel?.targetId ?? null, conv: context.conversationId ?? null };
  startRing('out');
  let r: Awaited<ReturnType<NCCallEngine['startCall']>>;
  try {
    r = await ce.startCall({
      calleeIds: [peer.userId],
      callType: sdk.NCCallType.SINGLE,
      mediaType: media === 'video' ? sdk.NCCallMediaType.AUDIO_VIDEO : sdk.NCCallMediaType.AUDIO,
      extra: JSON.stringify(extra),
      ...(context.channel?.targetId ? { targetId: context.channel.targetId } : {}),
    });
  } catch (err) {
    stopRing();
    console.warn('[call] startCall threw', err);
    return showNotice('failed');
  }
  if (r.code !== sdk.NCCallCode.SUCCESS) {
    stopRing();
    releaseViews(peer.userId);
    logCode('startCall', r.code, r);
    if (r.code === sdk.NCCallCode.VOIP_SERVICE_UNAVAILABLE) {
      set({ availability: 'off' });
      return showNotice('off', r.code);
    }
    if (r.code === sdk.NCCallCode.ON_CALLING) return showNotice('in_call', r.code);
    if (r.code === sdk.NCCallCode.MICROPHONE_CLOSED || r.code === sdk.NCCallCode.CAMERA_CLOSED) return showNotice('permission', r.code);
    return showNotice('failed', r.code);
  }
  set({ availability: 'on' });
  console.info(`[call] calling ${peer.userId} (${media}) · callId ${r.callId}`);
  // The hang-up may have been pressed while startCall was in flight.
  if (get().phase !== 'outgoing') {
    void ce.endCall({ callId: r.callId }).catch(() => undefined);
    return;
  }
  set({ callId: r.callId ?? null });
  if (r.busyLineUserList?.some((u) => u.userId === peer.userId)) {
    stopRing();
    void ce.endCall({ callId: r.callId }).catch(() => undefined);
    finish('busy', 'busy');
  }
}

function showNotice(notice: CallNotice, code?: number) {
  stopRing();
  set({ phase: 'notice', notice, errorCode: code ?? null });
}

export async function acceptCall() {
  const st = get();
  if (st.phase !== 'incoming' || !ce || !st.callId) return;
  stopRing();
  set({ phase: 'connecting' });
  const issue = await checkDevices(st.media);
  if (issue) {
    void ce.endCall({ callId: st.callId }).catch(() => undefined);
    return showNotice(issue);
  }
  if (st.peer) bindViews(st.peer.userId);
  const r = await ce.acceptCall({ callId: st.callId });
  if (r.code !== 0) {
    logCode('acceptCall', r.code);
    if (r.code === 80006) set({ availability: 'off' });
    showNotice(r.code === 80006 ? 'off' : 'failed', r.code);
  }
}

/** Call id this client ended itself (decline / cancel / hang up), so onCallEnded can skip "missed" screens. */
let endedLocally: string | null = null;

/** Decline (incoming), cancel (outgoing) or hang up (active). */
export async function hangUp() {
  const st = get();
  stopRing();
  endedLocally = st.callId;
  if (st.phase === 'notice' || st.phase === 'ended') return toIdle();
  if (st.phase === 'idle') return;
  if (st.phase === 'outgoing' && !st.callId) {
    // Still asking for permission / starting: startCall ends the call when it returns.
    releaseViews(st.peer?.userId);
    finish(st.direction === 'out' ? 'cancelled' : 'ended', null);
    return;
  }
  if (ce) {
    const r = await ce.endCall(st.callId ? { callId: st.callId } : undefined).catch(() => ({ code: -1 }));
    if (r.code !== 0) logCode('endCall', r.code);
  }
  // onCallEnded normally follows; make sure the screen never sticks if it does not.
  setTimeout(() => {
    if (get().callId === st.callId && get().phase !== 'idle' && get().phase !== 'ended') {
      releaseViews(st.peer?.userId);
      finish(st.startedAt ? 'ended' : st.direction === 'out' ? 'cancelled' : 'ended', st.startedAt ? 'completed' : 'cancelled');
    }
  }, 2500);
}

export async function toggleMic() {
  const st = get();
  if (!ce) return;
  const r = await ce.enableMicrophone(!st.micOn);
  if (r.code === 0) set({ micOn: !st.micOn });
  else logCode('enableMicrophone', r.code);
}

export async function toggleCamera() {
  const st = get();
  if (!ce || st.media !== 'video') return;
  const r = await ce.enableCamera(!st.camOn);
  if (r.code === 0) set({ camOn: !st.camOn });
  else logCode('enableCamera', r.code);
}

let camIdx = 0;
export async function flipCamera() {
  if (!ce) return;
  const cams = await ce.getVideoInputDevices().catch(() => [] as MediaDeviceInfo[]);
  if (cams.length < 2) return;
  camIdx = (camIdx + 1) % cams.length;
  const r = await ce.selectVideoInputDevice({ deviceId: cams[camIdx].deviceId });
  if (r.code !== 0) logCode('selectVideoInputDevice', r.code);
}

let outIdx = 0;
/** Cycles the audio output (speaker / headset) where the browser exposes more than one. */
export async function cycleSpeaker(): Promise<string | null> {
  if (!ce) return null;
  const outs = await ce.getAudioOutputDevices().catch(() => [] as MediaDeviceInfo[]);
  if (outs.length < 2) return null;
  outIdx = (outIdx + 1) % outs.length;
  const r = await ce.selectAudioOutputDevice({ deviceId: outs[outIdx].deviceId });
  if (r.code !== 0) logCode('selectAudioOutputDevice', r.code);
  return outs[outIdx].label || null;
}

/** Asks the other side to switch between voice and video (1:1 only). */
export async function switchMedia() {
  const st = get();
  if (!ce || !sdk || st.phase !== 'active' || st.switching) return;
  const target = st.media === 'audio' ? 'video' : 'audio';
  if (target === 'video') {
    const issue = await checkDevices('video');
    if (issue) return flash(issue);
  }
  set({ switching: true });
  const r = await ce.requestChangeMediaType({ mediaType: target === 'video' ? sdk.NCCallMediaType.AUDIO_VIDEO : sdk.NCCallMediaType.AUDIO });
  if (r.code !== 0) {
    logCode('requestChangeMediaType', r.code);
    set({ switching: false });
  }
}

export async function answerVideoRequest(agree: boolean) {
  const st = get();
  if (!ce || !st.videoRequest) return;
  const { transactionId } = st.videoRequest;
  set({ videoRequest: null });
  if (agree) {
    const issue = await checkDevices('video');
    if (issue) agree = false;
  }
  const r = await ce.replyChangeMediaType({ transactionId, isAgreed: agree });
  if (r.code !== 0) logCode('replyChangeMediaType', r.code);
}

/** Logout / unload: end anything in progress and drop the media. */
export function endAllCalls() {
  stopRing();
  const st = get();
  if (ce && st.phase !== 'idle' && st.phase !== 'notice') void ce.endCall(st.callId ? { callId: st.callId } : undefined).catch(() => undefined);
  releaseViews(st.peer?.userId);
  toIdle();
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => endAllCalls());

// ── Ending and the chat summary ─────────────────────────────────────────────
function finish(result: CallResult, outcome: CallOutcome | null, reason?: EndReason) {
  const st = get();
  stopRing();
  const durationSec = st.startedAt ? Math.round((Date.now() - st.startedAt) / 1000) : 0;
  set({ phase: 'ended', result, durationSec, videoRequest: null });
  releaseViews(st.peer?.userId);
  // Only the caller posts, so each call leaves exactly one line in the chat.
  if (st.direction === 'out' && outcome && st.context?.channel && st.peer) {
    const payload: CallPayload = {
      media: st.media,
      outcome,
      durationSec: outcome === 'completed' ? durationSec : 0,
      callerId: engine.userId,
      calleeId: st.peer.userId,
      ...(st.callId ? { callId: st.callId } : {}),
    };
    engine.sendCard(st.context.channel, CC_CALL, payload).catch((err) => console.warn('[call] summary not sent', err, reason));
  }
  toIdle(result === 'ended' && !durationSec ? 900 : 2400);
}

function endResult(reason: number, st: CallState): { result: CallResult; outcome: CallOutcome | null } {
  const R = sdk!.NCCallEndReason;
  if (st.startedAt) {
    if (reason >= 1105 && reason !== R.HANGUP_BY_OTHER_CLIENT) return { result: 'failed', outcome: 'completed' };
    return { result: 'ended', outcome: 'completed' };
  }
  switch (reason) {
    case R.NO_ANSWER:
      return { result: 'no_answer', outcome: 'missed' };
    case R.DECLINED:
      return { result: 'declined', outcome: 'declined' };
    case R.CANCELED:
      return { result: st.direction === 'out' ? 'cancelled' : 'ended', outcome: 'cancelled' };
    case R.MISSED:
      return { result: 'missed', outcome: 'missed' };
    case R.BUSY_LINE_RINGING:
    case R.BUSY_LINE_WAIT:
    case R.REMOTE_OTHER_CLIENT_ONCALL:
      return { result: 'busy', outcome: 'busy' };
    case R.ACCEPT_BY_OTHER_CLIENT:
    case R.HANGUP_BY_OTHER_CLIENT:
    case R.OTHER_CLIENT_CALLING:
      return { result: 'ended', outcome: null };
    default:
      return reason >= 1105 ? { result: 'failed', outcome: 'missed' } : { result: 'ended', outcome: 'missed' };
  }
}

// ── SDK events ──────────────────────────────────────────────────────────────
const handler: CallSdkModule.NCCallEventHandler = {
  onCallReceived({ session, extra }) {
    const st = get();
    const callId = session.getCallId();
    if (st.phase !== 'idle' && st.phase !== 'ended' && st.phase !== 'notice') {
      // One call at a time: turn the second one away (the caller sees "busy").
      void ce?.endCall({ callId }).catch(() => undefined);
      return;
    }
    toIdle();
    const x = parseExtra(extra);
    const callerId = session.getCallerUserId();
    const media = mediaOf(session);
    set({
      phase: 'incoming',
      direction: 'in',
      callId,
      media,
      camOn: media === 'video',
      micOn: true,
      peer: { userId: callerId, name: x?.name || callerId, accent: x?.accent ?? null, trust: x?.trust ?? undefined, sub: x?.sub ?? null },
      context: { channel: x?.ch ? { type: 'group', targetId: x.ch } : null, conversationId: x?.conv ?? null },
    });
    startRing('in');
    console.info(`[call] incoming ${media} call from ${callerId} · callId ${callId}`);
  },
  onCallConnected({ session }) {
    stopRing();
    const st = get();
    set({ phase: 'active', callId: session.getCallId(), startedAt: st.startedAt ?? Date.now(), media: mediaOf(session) });
    void countDevices();
    console.info(`[call] connected · callId ${session.getCallId()}`);
  },
  onStartTimeReceived({ startTime }) {
    if (startTime > 0 && get().phase === 'active') set({ startedAt: Math.min(startTime, Date.now()) });
  },
  onCallEnded({ session, reason }) {
    const st = get();
    if (st.callId && session.getCallId() !== st.callId) return; // a turned-away second call
    if (st.phase === 'idle') return;
    console.info(`[call] ended · callId ${session.getCallId()} · reason ${reason}`);
    const { result, outcome } = endResult(reason, st);
    const mine = endedLocally != null && endedLocally === st.callId;
    endedLocally = null;
    if (st.direction === 'in' && !st.startedAt) {
      // I declined: no "ended" screen. The caller gave up / it timed out while ringing: "Missed".
      if (mine) {
        releaseViews(st.peer?.userId);
        toIdle();
        return;
      }
      finish('missed', null, reason);
      return;
    }
    finish(result, outcome, reason);
  },
  onRemoteUserStateChanged({ userState }) {
    if (sdk && userState === sdk.NCCallUserState.RINGING && get().phase === 'outgoing') set({ ringing: true });
    if (sdk && userState === sdk.NCCallUserState.CONNECTING && get().phase === 'outgoing') set({ phase: 'connecting' });
  },
  onRemoteMicrophoneStateChanged({ disabled }) {
    set({ remoteMicOff: disabled });
  },
  onRemoteCameraStateChanged({ disabled }) {
    set({ remoteCamOff: disabled });
  },
  onMediaTypeChangeRequestReceived({ transactionId, mediaType }) {
    if (!sdk) return;
    if (mediaType === sdk.NCCallMediaType.AUDIO) {
      // Going down to voice never needs a question.
      void ce?.replyChangeMediaType({ transactionId, isAgreed: true });
      return;
    }
    set({ videoRequest: { transactionId } });
  },
  onMediaTypeChangeResultReceived({ mediaType, result }) {
    if (!sdk) return;
    const st = get();
    set({ switching: false, videoRequest: null });
    if (result === sdk.NCCallMediaTypeChangeResult.SERVER_ALLOW_MEDIA_TYPE) {
      const media: CallMedia = mediaType === sdk.NCCallMediaType.AUDIO ? 'audio' : 'video';
      set({ media, camOn: media === 'video', remoteCamOff: false });
      if (media === 'video' && st.peer) bindViews(st.peer.userId);
    } else if (st.media === 'audio') {
      flash('stayed_voice');
    }
  },
  onLocalCallLogReceived({ callLog }) {
    console.info('[call] call log', { callId: callLog.callId, duration: callLog.duration, endReason: callLog.endReason });
  },
};
