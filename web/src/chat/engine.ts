// Single chat facade for the whole web app.
// Nexconn mode: @nexconn/chat Web SDK (NCEngine). Local mode: the server's dev relay
// (SSE /api/dev/stream + REST), used only when the server has no Nexconn keys.
import {
  AreaCode,
  BaseChannel,
  ChannelHandler,
  ChannelType as NCChannelType,
  ConnectionStatus,
  ConnectionStatusHandler,
  DirectChannel,
  GroupChannel,
  MessageDirection,
  MessageHandler,
  NCEngine,
  SendMessageParams,
  SendTextMessageParams,
  SystemChannel,
  TranslateHandler,
  type ChannelIdentifier,
  type Message,
} from '@nexconn/chat';
import { CC_CARD, CC_HINT, CC_REPLY, CC_VOICE, type VoicePayload } from '@shared/cards';
import { api, getToken } from '../lib/api';
import { useSession, type ChatCreds } from '../store/session';
import { handleTranslationResults, setNexconnTranslateReady, translateItems, type TranslateRequest } from './translate';

// ── Public types ───────────────────────────────────────────────────────────
export type ChannelKind = 'direct' | 'group' | 'system';
export interface Channel {
  type: ChannelKind;
  targetId: string;
}

export interface ChatMessage {
  id: string;
  channel: Channel;
  senderId: string;
  /** 'RC:TxtMsg' | 'RC:StreamMsg' | 'RC:HQVCMsg' | 'CC:Card' | 'CC:Hint' | 'CC:Reply' | 'CC:Voice' | … */
  type: string;
  /** Normalised: text messages always carry `content.text`; stream messages also `content.complete`. */
  content: any;
  metadata?: Record<string, string>;
  sentAt: number;
  mine: boolean;
  /** Client-side delivery state for optimistic messages. */
  status?: 'sending' | 'sent' | 'failed';
  /** Temporary id of the optimistic copy this message replaces. */
  localId?: string;
}

export interface TypingEvent {
  channel: Channel;
  userId: string;
  typingType: string;
  at: number;
}

export type ConnState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ChannelSummary {
  channel: Channel;
  latest: ChatMessage | null;
  unread: number;
  updatedAt: number;
}

export const HISTORY_PAGE = 30;
export const CLAIRE_ID = 'claire';
export const UPDATES_ID = 'claire_updates';
export const DESK_ID = 'trade_desk';
export const TYPING_VOICE = CC_VOICE;

export const channelKey = (c: Channel) => `${c.type}:${c.targetId}`;
export const sameChannel = (a: Channel, b: Channel) => a.type === b.type && a.targetId === b.targetId;
export const claireChannel: Channel = { type: 'direct', targetId: CLAIRE_ID };
export const updatesChannel: Channel = { type: 'system', targetId: UPDATES_ID };

/** Plain-text preview of any message (inbox rows, notifications). */
export function previewText(m: ChatMessage | null | undefined, labels: { voice: string; card: string } = { voice: 'Voice note', card: 'Card' }): string {
  if (!m) return '';
  const c = m.content ?? {};
  switch (m.type) {
    case 'RC:TxtMsg':
    case 'RC:StreamMsg':
      return String(c.text ?? '');
    case CC_REPLY:
      return String(c.label ?? '');
    case CC_HINT:
      return String(c.text ?? '');
    case CC_VOICE:
      return c.transcript ? `${labels.voice}: ${c.transcript}` : labels.voice;
    case 'RC:HQVCMsg':
      return labels.voice;
    case CC_CARD:
      return String(c.text || c.title || (c.kind === 'offer' || c.kind === 'order' ? `${c.title ?? ''}` : '') || labels.card);
    default:
      return String(c.text ?? c.message ?? c.content ?? '');
  }
}

// ── Internal state ─────────────────────────────────────────────────────────
type Listener<T> = (v: T) => void;
const messageListeners = new Set<Listener<ChatMessage>>();
const typingListeners = new Set<Listener<TypingEvent>>();
const statusListeners = new Set<Listener<ConnState>>();

let state: ConnState = 'idle';
let mode: 'nexconn' | 'local' | null = null;
let myId = '';
let connectPromise: Promise<void> | null = null;
let connectedToken: string | null = null;
let ncInitializedKey: string | null = null;
let eventSource: EventSource | null = null;

const ncChannels = new Map<string, BaseChannel>();
const streams = new Map<string, ChatMessage>();
const typingSentAt = new Map<string, number>();

function setState(s: ConnState) {
  if (s === state) return;
  state = s;
  statusListeners.forEach((fn) => fn(s));
}

function emit(m: ChatMessage) {
  messageListeners.forEach((fn) => {
    try {
      fn(m);
    } catch (err) {
      console.error('[chat] listener failed', err);
    }
  });
}

// ── Normalisation ──────────────────────────────────────────────────────────
function parseMaybeJson(v: unknown): any {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return v;
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
}

export function normalizeContent(type: string, raw: unknown): any {
  let c: any = parseMaybeJson(raw);
  if (typeof c === 'string') c = { text: c };
  c = c ?? {};
  if (type === 'RC:TxtMsg') return { ...c, text: String(c.text ?? c.content ?? '') };
  if (type === 'RC:StreamMsg') {
    return { ...c, text: String(c.text ?? c.content ?? ''), complete: c.isCompleted ?? c.complete ?? true };
  }
  if (type.startsWith('CC:')) {
    // Server REST sends `content: JSON.stringify(payload)`; some paths wrap it once more.
    const keys = Object.keys(c);
    if (keys.length === 1 && keys[0] === 'content') {
      const inner = parseMaybeJson(c.content);
      if (inner && typeof inner === 'object') return inner;
    }
  }
  return c;
}

function kindFromNC(t: number): ChannelKind {
  if (t === NCChannelType.GROUP) return 'group';
  if (t === NCChannelType.SYSTEM) return 'system';
  return 'direct';
}

function channelFromIdentifier(id: ChannelIdentifier): Channel {
  return { type: kindFromNC(id.channelType), targetId: id.channelId };
}

function metadataOf(m: Message): Record<string, string> | undefined {
  const md = m.metadata;
  if (!md) return undefined;
  if (md instanceof Map) return md.size ? Object.fromEntries(md) : undefined;
  return Object.keys(md).length ? (md as unknown as Record<string, string>) : undefined;
}

function fromNC(m: Message): ChatMessage {
  const sender = m.senderUserId || '';
  const mine = (myId && sender === myId) || m.direction === MessageDirection.SEND;
  return {
    id: m.messageId || `tmp_${m.clientId}`,
    channel: channelFromIdentifier(m.channelIdentifier),
    senderId: sender || (mine ? myId : ''),
    type: m.messageType,
    content: normalizeContent(m.messageType, m.content),
    metadata: metadataOf(m),
    sentAt: m.sentTime || Date.now(),
    mine: Boolean(mine),
    status: 'sent',
  };
}

interface WireMessage {
  id: string;
  channelType: ChannelKind;
  targetId: string;
  senderId: string;
  type: string;
  content: unknown;
  metadata?: Record<string, string>;
  sentAt: number;
}

function fromWire(w: WireMessage): ChatMessage {
  return {
    id: w.id,
    channel: { type: w.channelType, targetId: w.targetId },
    senderId: w.senderId,
    type: w.type,
    content: normalizeContent(w.type, w.content),
    metadata: w.metadata,
    sentAt: w.sentAt || Date.now(),
    mine: w.senderId === myId,
    status: 'sent',
  };
}

// ── Nexconn plumbing ───────────────────────────────────────────────────────
function ncChannel(c: Channel): BaseChannel {
  const key = channelKey(c);
  let ch = ncChannels.get(key);
  if (!ch) {
    ch = c.type === 'group' ? new GroupChannel(c.targetId) : c.type === 'system' ? new SystemChannel(c.targetId) : new DirectChannel(c.targetId);
    ncChannels.set(key, ch);
  }
  return ch;
}

/** RC:StreamMsg arrives with only the first chunk; ask the SDK for the rest. */
function trackStream(m: Message, cm: ChatMessage) {
  if (cm.type !== 'RC:StreamMsg' || cm.content.complete) return;
  streams.set(cm.id, cm);
  m.requestStreamMessage().catch(() => streams.delete(cm.id));
}

const CUSTOM_MESSAGES = [
  { messageType: CC_CARD, isPersisted: true, isCounted: true },
  { messageType: CC_HINT, isPersisted: true, isCounted: false },
  { messageType: CC_REPLY, isPersisted: true, isCounted: true },
  { messageType: CC_VOICE, isPersisted: true, isCounted: true },
];

function initNexconn(creds: ChatCreds) {
  if (ncInitializedKey) return; // NCEngine.initialize may only run once per page load
  const area = (creds.area || 'SG').toUpperCase() as keyof typeof AreaCode;
  NCEngine.initialize({ appKey: creds.appKey, areaCode: AreaCode[area] ?? AreaCode.SG });
  // Registration needs the initialised engine (it is a no-op before initialize) and must precede connect.
  NCEngine.registerCustomMessages(CUSTOM_MESSAGES);
  ncInitializedKey = creds.appKey;

  NCEngine.addConnectionStatusHandler(
    'cc-conn',
    new ConnectionStatusHandler({
      onConnectionStatusChanged({ status }) {
        if (status === ConnectionStatus.CONNECTED) setState('connected');
        else if (status === ConnectionStatus.CONNECTING || status === ConnectionStatus.SUSPENDED) setState('connecting');
        else setState('disconnected');
      },
    }),
  );

  NCEngine.addMessageHandler(
    'cc-msg',
    new MessageHandler({
      onMessageReceived({ messages }) {
        for (const m of messages) {
          const cm = fromNC(m);
          emit(cm);
          trackStream(m, cm);
        }
      },
      onStreamMessageRequestDelta({ messageId, chunkInfo }) {
        const base = streams.get(messageId);
        if (!base) return;
        const next: ChatMessage = { ...base, content: { ...base.content, text: chunkInfo.messageContent, complete: false } };
        streams.set(messageId, next);
        emit(next);
      },
      onStreamMessageRequestComplete({ messageId }) {
        const base = streams.get(messageId);
        if (!base) return;
        streams.delete(messageId);
        emit({ ...base, content: { ...base.content, complete: true } });
      },
      onMessagesUpdated({ messages }) {
        messages.forEach((m) => emit(fromNC(m)));
      },
    }),
  );

  NCEngine.addChannelHandler(
    'cc-channel',
    new ChannelHandler({
      onTypingStatusChanged({ channelIdentifier, userTypingStatus }) {
        const channel = channelFromIdentifier(channelIdentifier);
        for (const s of userTypingStatus) {
          if (s.userId === myId) continue;
          const ev = { channel, userId: s.userId, typingType: s.typingMessageType, at: s.sentTime || Date.now() };
          typingListeners.forEach((fn) => fn(ev));
        }
      },
    }),
  );

  NCEngine.addTranslateHandler(
    'cc-translate',
    new TranslateHandler({
      onTranslationCompleted({ results }) {
        handleTranslationResults(results);
      },
    }),
  );
}

async function connectNexconn(creds: ChatCreds, lang: string) {
  if (!creds.token) throw new Error('No chat token from the server');
  initNexconn(creds);
  setState('connecting');
  const r = await NCEngine.connect({ token: creds.token });
  if (!r.isOk) {
    setState('error');
    throw new Error(`Chat connect failed (${r.code}${r.msg ? `: ${r.msg}` : ''})`);
  }
  myId = r.data?.userId || NCEngine.getCurrentUserId();
  setState('connected');
  setNexconnTranslateReady(true);
  // Built-in translation settings: best effort, the app translates on demand anyway.
  NCEngine.translateModule.setTranslationLanguage(lang).catch(() => undefined);
  NCEngine.translateModule.setAutoTranslateEnabled(true).catch(() => undefined);
}

// Keep Nexconn's auto-translate language in step when the user switches language (Language / Me screens).
useSession.subscribe((session, prev) => {
  const lang = session.user?.language;
  if (!lang || lang === prev.user?.language || mode !== 'nexconn' || state !== 'connected') return;
  NCEngine.translateModule.setTranslationLanguage(lang).catch(() => undefined);
});

// ── Local relay plumbing ───────────────────────────────────────────────────
function connectLocal() {
  const token = getToken();
  if (!token) throw new Error('Not signed in');
  eventSource?.close();
  setState('connecting');
  const es = new EventSource(`/api/dev/stream?token=${encodeURIComponent(token)}`);
  eventSource = es;
  es.onopen = () => setState('connected');
  es.onerror = () => setState(es.readyState === EventSource.CLOSED ? 'disconnected' : 'connecting');
  es.addEventListener('message', (ev) => {
    try {
      emit(fromWire(JSON.parse((ev as MessageEvent<string>).data) as WireMessage));
    } catch (err) {
      console.warn('[chat] bad relay event', err);
    }
  });
  es.addEventListener('typing', (ev) => {
    try {
      const d = JSON.parse((ev as MessageEvent<string>).data) as { channelType: ChannelKind; targetId: string; userId: string; typingType?: string };
      if (d.userId === myId) return;
      const tev = { channel: { type: d.channelType, targetId: d.targetId }, userId: d.userId, typingType: d.typingType || 'RC:TxtMsg', at: Date.now() };
      typingListeners.forEach((fn) => fn(tev));
    } catch {
      /* ignore */
    }
  });
}

function listFrom<T>(r: unknown, key: string): T[] {
  if (Array.isArray(r)) return r as T[];
  if (r && typeof r === 'object' && Array.isArray((r as Record<string, unknown>)[key])) return (r as Record<string, T[]>)[key];
  return [];
}

// ── Facade ─────────────────────────────────────────────────────────────────
/** Sends and echoes the sent message to every listener (the SDK does not deliver own sends back). */
async function sendRaw(channel: Channel, type: string, content: Record<string, unknown>): Promise<ChatMessage> {
  const sent = await sendRawInner(channel, type, content);
  emit(sent);
  return sent;
}

async function sendRawInner(channel: Channel, type: string, content: Record<string, unknown>): Promise<ChatMessage> {
  await engine.connect();
  if (mode === 'nexconn') {
    const ch = ncChannel(channel);
    const r =
      type === 'RC:TxtMsg'
        ? await ch.sendMessage(new SendTextMessageParams({ text: String(content.text ?? '') }))
        : await ch.sendMessage(new SendMessageParams(content, type));
    if (!r.isOk || !r.data) throw new Error(`Message not sent (${r.code})`);
    const cm = fromNC(r.data);
    return { ...cm, channel, mine: true, senderId: cm.senderId || myId, content: cm.content && Object.keys(cm.content).length ? cm.content : normalizeContent(type, content) };
  }
  const wireContent = type === 'RC:TxtMsg' ? { content: content.text } : content;
  const r = await api.post<any>('/api/dev/send', { channelType: channel.type, targetId: channel.targetId, type, content: wireContent });
  const w = (r?.message ?? r) as Partial<WireMessage> | null;
  return {
    id: String(w?.id ?? r?.id ?? `m${Date.now()}`),
    channel,
    senderId: myId,
    type,
    content: normalizeContent(type, wireContent),
    sentAt: Number(w?.sentAt ?? Date.now()),
    mine: true,
    status: 'sent',
  };
}

export const engine = {
  get mode() {
    return mode;
  },
  get state() {
    return state;
  },
  get userId() {
    return myId || useSession.getState().user?.id || '';
  },

  /** Connects once per session; safe to call from every screen. */
  connect(): Promise<void> {
    const s = useSession.getState();
    const creds = s.chat;
    if (!s.user || !creds) return Promise.reject(new Error('Not signed in'));
    const tokenKey = `${creds.mode}:${creds.token ?? s.token}`;
    if (connectPromise && connectedToken === tokenKey) return connectPromise;
    connectedToken = tokenKey;
    myId = s.user.id;
    mode = creds.mode === 'nexconn' && creds.appKey && creds.token ? 'nexconn' : 'local';
    connectPromise = (async () => {
      if (mode === 'nexconn') await connectNexconn(creds, s.user?.language || 'en');
      else connectLocal();
    })().catch((err) => {
      connectPromise = null;
      connectedToken = null;
      setState('error');
      throw err;
    });
    return connectPromise;
  },

  async disconnect() {
    connectPromise = null;
    connectedToken = null;
    eventSource?.close();
    eventSource = null;
    ncChannels.clear();
    streams.clear();
    setNexconnTranslateReady(false);
    if (mode === 'nexconn') await NCEngine.disconnect().catch(() => undefined);
    mode = null;
    setState('idle');
  },

  onMessage(cb: Listener<ChatMessage>) {
    messageListeners.add(cb);
    return () => {
      messageListeners.delete(cb);
    };
  },

  onTyping(cb: Listener<TypingEvent>) {
    typingListeners.add(cb);
    return () => {
      typingListeners.delete(cb);
    };
  },

  onStatus(cb: Listener<ConnState>) {
    statusListeners.add(cb);
    return () => {
      statusListeners.delete(cb);
    };
  },

  /** Newest page before `before` (ms), returned oldest → newest. */
  async history(channel: Channel, before?: number): Promise<ChatMessage[]> {
    await engine.connect();
    if (mode === 'nexconn') {
      const query = BaseChannel.createMessagesQuery({
        channelIdentifier: ncChannel(channel).identifier,
        startTime: before ?? Date.now() + 60_000,
        pageSize: HISTORY_PAGE,
        isAscending: false,
      });
      const r = await query.loadNextPage();
      if (!r.isOk) throw new Error(`Could not load messages (${r.code})`);
      const page = r.data?.data ?? [];
      return page
        .map((m) => {
          const cm = fromNC(m);
          trackStream(m, cm);
          return { ...cm, channel };
        })
        .sort((a, b) => a.sentAt - b.sentAt);
    }
    const qs = new URLSearchParams({ channelType: channel.type, targetId: channel.targetId, ...(before ? { before: String(before) } : {}) });
    const r = await api.get<unknown>(`/api/dev/history?${qs}`);
    return listFrom<WireMessage>(r, 'messages')
      .map((w) => ({ ...fromWire(w), channel }))
      .sort((a, b) => a.sentAt - b.sentAt);
  },

  sendText(channel: Channel, text: string) {
    return sendRaw(channel, 'RC:TxtMsg', { text });
  },

  sendCard(channel: Channel, type: string, content: object) {
    return sendRaw(channel, type, content as Record<string, unknown>);
  },

  sendVoice(channel: Channel, payload: VoicePayload) {
    return sendRaw(channel, CC_VOICE, payload as unknown as Record<string, unknown>);
  },

  /** Throttled typing indicator. Nexconn supports it on direct channels only. */
  sendTyping(channel: Channel, typingType = 'RC:TxtMsg') {
    if (state !== 'connected' || channel.type !== 'direct' || mode !== 'nexconn') return;
    const key = `${channelKey(channel)}|${typingType}`;
    const now = Date.now();
    if (now - (typingSentAt.get(key) ?? 0) < 4000) return;
    typingSentAt.set(key, now);
    const ch = ncChannel(channel);
    if (ch instanceof DirectChannel) ch.sendTypingStatus(typingType).catch(() => undefined);
  },

  translate(items: TranslateRequest[], to: string): Promise<Map<string, string>> {
    return translateItems(items, to);
  },

  /** Clears the unread badge and sends read receipts where the channel supports them. */
  async markRead(channel: Channel, messageIds: string[]) {
    if (mode !== 'nexconn' || state !== 'connected') return;
    const ch = ncChannel(channel);
    ch.clearUnreadCount().catch(() => undefined);
    const ids = messageIds.filter((id) => id && !id.startsWith('local_') && !id.startsWith('tmp_'));
    if (ids.length && channel.type !== 'system') ch.sendReadReceiptResponse(ids.slice(-50)).catch(() => undefined);
  },

  /** Server-side channel list with latest message and unread count (Nexconn only). */
  async listChannels(): Promise<ChannelSummary[]> {
    await engine.connect();
    if (mode !== 'nexconn') return [];
    const query = BaseChannel.createChannelsQuery({ pageSize: 100, channelTypes: [NCChannelType.DIRECT, NCChannelType.GROUP, NCChannelType.SYSTEM] });
    const r = await query.loadNextPage();
    if (!r.isOk) return [];
    return (r.data?.data ?? []).map((c) => {
      const latest = c.latestMessage ? fromNC(c.latestMessage) : null;
      return {
        channel: channelFromIdentifier(c.identifier),
        latest,
        unread: c.unreadCount || 0,
        updatedAt: latest?.sentAt || c.operationTime || 0,
      };
    });
  },
};

export type Engine = typeof engine;
