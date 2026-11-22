// Reusable chat surface for any channel (Claire, deal chats, Updates, Trade Desk console):
// message list with day separators, grouping, translation, cards, voice, typing, and composer.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Loader2, MessageCircle, RefreshCw, WifiOff, type LucideIcon } from '../icons';
import clsx from 'clsx';
import { CC_CALL, CC_CARD, CC_HINT, CC_REPLY, CC_VOICE, type CallPayload, type CardPayload, type HintPayload, type ReplyPayload, type VoicePayload } from '@shared/cards';
import { CardRenderer, HintBubble, ReplyBubble, SYSTEM_CARD_KINDS } from '../cards/CardRenderer';
import type { CardCtx } from '../cards/types';
import { CatalogSheet } from '../components/CatalogSheet';
import { ClaireMark } from '../components/Avatar';
import type { DealInfo } from '../cards/dealCtx';
import { dealT } from './deal.strings';
import { api, errorText } from '../lib/api';
import { dayLabel, sameDay } from '../lib/format';
import { useT } from '../i18n';
import { useSession } from '../store/session';
import { CLAIRE_ID, DESK_ID, UPDATES_ID, channelKey, engine, HISTORY_PAGE, sameChannel, type Channel, type ChatMessage, type ConnState } from './engine';
import { isDifferent, scriptLang, type TranslateRequest } from './translate';
import { moderateText } from '@shared/moderation';
import { BubbleShell, MessageBubble, SystemPill, type BubblePosition, type TranslationState } from './MessageBubble';
import { VoiceBubble } from './VoiceBubble';
import { Composer } from './Composer';
import { CallLine } from '../call/CallButtons';
import { transcribeClip, type VoiceClip } from './VoiceRecorder';

export interface SendInfo {
  text: string;
  voice?: boolean;
  messageId?: string;
  lang?: string;
  audioUrl?: string;
}

/** A one-tap suggestion shown in a row above the composer. */
export interface QuickReply {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** 'primary' = the suggested next step (tinted), 'quiet' = secondary action. Default 'primary'. */
  tone?: 'primary' | 'quiet';
  /** Sent as my text message when tapped (in my language; the counterpart sees it translated). */
  text?: string;
  /** Custom handler (open a sheet, accept an offer…); wins over `text`. */
  onTap?: () => void;
  /** Draw a thin divider before this chip (separates suggestions from actions). */
  divider?: boolean;
}

export interface ChatViewProps {
  channel: Channel;
  /** Mongo conversation id (deal chats) — passed to cards. */
  conversationId?: string;
  /** Language the counterpart writes in. Same as mine → no translation; default 'auto'. */
  counterpartLang?: string;
  /** Runs after the SDK send succeeded (Claire turn, deal inbound…). */
  onSend?: (m: SendInfo) => void | Promise<unknown>;
  /** Runs after a chip tap was echoed as a CC:Reply. */
  /** `messageId` is the echoed CC:Reply's id, so the server and the webhook answer the tap only once. */
  onChip?: (chipId: string, label: string, messageId?: string) => void | Promise<unknown>;
  /** Called once when the first history page is empty (e.g. Claire welcome). */
  onEmpty?: () => Promise<unknown>;
  header?: ReactNode;
  /** Pinned strip under the header (deal summary…). */
  banner?: ReactNode;
  /** Dense layout without safe-area padding (desk console). */
  compact?: boolean;
  /** Hide the composer (system channels). */
  readOnly?: boolean;
  /** senderId → display name, shown above the first bubble of a run in group chats. */
  names?: Record<string, string>;
  placeholder?: string;
  emptyState?: ReactNode;
  /** Sender whose reply we wait for after the user speaks (shows "Claire is thinking…"). */
  thinkingFor?: string;
  /** Hide the attach (+) button. */
  noAttach?: boolean;
  /** Echo chip taps as a CC:Reply bubble before onChip (default true; deal hints are private, so false there). */
  echoChips?: boolean;
  /** Live state handed to cards (offer statuses, rated orders) from the screen's API data. */
  cardExtras?: Pick<CardCtx, 'offerStatus' | 'ratedOrders'> & { deal?: DealInfo };
  /** Language for cards and translations when it differs from the user's (the English desk console). */
  uiLang?: string;
  /** Bump to scroll to the newest message (e.g. after the screen posted a card itself). */
  scrollSignal?: number;
  /** Optional one-tap suggestions above the composer (smart replies, deal actions). */
  quickReplies?: QuickReply[];
  /** Optional content between the message list and the composer (under the quick replies). */
  footer?: ReactNode;
  /** Called when a card changed the deal (accept, counter, order step) so the screen reloads its own data too. */
  onRefresh?: () => void;
  className?: string;
}

const BOTS = new Set([CLAIRE_ID, UPDATES_ID, DESK_ID]);
const SYSTEM_TYPES = new Set(['RC:InfoNtf', 'RC:GrpNtf', 'RC:RcNtf', 'RC:ChrmNtf', 'RC:ProfileNtf']);
const RENDERED = new Set(['RC:TxtMsg', 'RC:StreamMsg', 'RC:HQVCMsg', 'RC:ImgMsg', CC_CARD, CC_HINT, CC_REPLY, CC_VOICE, CC_CALL, ...SYSTEM_TYPES]);
const WIDE_CARDS = new Set(['results', 'tiles', 'carousel', 'job_split']);
const THINKING_TIMEOUT = 45_000;
const TYPING_TTL = 6_000;

let localSeq = 0;
const newLocalId = () => `local_${Date.now().toString(36)}_${++localSeq}`;

function signature(m: ChatMessage): string {
  const c = m.content ?? {};
  if (m.type === 'RC:TxtMsg') return `t:${c.text}`;
  if (m.type === CC_REPLY) return `r:${c.chipId}`;
  if (m.type === CC_VOICE) return `v:${c.durationMs}`;
  return `${m.type}:${JSON.stringify(c)}`;
}

/** Insert or replace by id / optimistic local id / pending signature; keeps ascending order. */
function upsert(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  // Moderation may block a message before or after its send call returns: the blocked state always wins.
  const m: ChatMessage = incoming.mine && engine.isBlocked(incoming.id) ? { ...incoming, status: 'blocked' } : incoming;
  let next = list;
  const byId = list.findIndex((x) => x.id === m.id);
  const byLocal = m.localId ? list.findIndex((x) => x.id === m.localId) : -1;
  if (byLocal >= 0) {
    next = list.slice();
    next[byLocal] = { ...m, localId: undefined };
    if (byId >= 0 && byId !== byLocal) next.splice(byId, 1);
  } else if (byId >= 0) {
    next = list.slice();
    next[byId] = { ...list[byId], ...m, status: m.status ?? list[byId].status };
  } else {
    const pending = m.mine ? list.findIndex((x) => x.status === 'sending' && x.type === m.type && signature(x) === signature(m)) : -1;
    if (pending >= 0) {
      next = list.slice();
      next[pending] = m;
    } else {
      next = [...list, m];
    }
  }
  // Mostly already sorted; a stable sort keeps optimistic order intact.
  return next.slice().sort((a, b) => a.sentAt - b.sentAt);
}

function textOf(m: ChatMessage): string {
  const c = m.content ?? {};
  return String(c.text ?? c.message ?? c.content ?? '');
}

export function ChatView({
  channel,
  conversationId,
  counterpartLang = 'auto',
  onSend,
  onChip,
  onEmpty,
  header,
  banner,
  compact,
  readOnly,
  names,
  placeholder,
  emptyState,
  thinkingFor,
  noAttach,
  echoChips = true,
  cardExtras,
  uiLang,
  scrollSignal,
  quickReplies,
  footer,
  onRefresh,
  className,
}: ChatViewProps) {
  const t = useT();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const userLang = user?.language || 'en'; // what the user speaks and types
  const myLang = uiLang || userLang; // what cards and translations are shown in
  const myId = user?.id || '';
  const aiId = thinkingFor ?? (channel.type === 'direct' && channel.targetId === CLAIRE_ID ? CLAIRE_ID : undefined);
  const key = channelKey(channel);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [conn, setConn] = useState<ConnState>(engine.state);
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});
  const [showOriginal, setShowOriginal] = useState<Set<string>>(() => new Set());
  const [typing, setTyping] = useState<{ userId: string; type: string; at: number } | null>(null);
  const [thinkingSince, setThinkingSince] = useState<number | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const requested = useRef<Set<string>>(new Set());
  const prependAnchor = useRef<number | null>(null);
  const stickNext = useRef<'instant' | 'smooth' | null>('instant');
  const emptyCalled = useRef(false);
  const onEmptyRef = useRef(onEmpty);
  onEmptyRef.current = onEmpty;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // ── Scrolling ────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scroller.current;
    if (!el) return;
    // Far away (long Claire chats): jump; a smooth scroll over thousands of pixels can stall on mobile.
    const far = el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight * 3;
    el.scrollTo({ top: el.scrollHeight, behavior: far ? 'auto' : behavior });
    setNewCount(0);
    atBottomRef.current = true;
    // Streamed text and card images keep growing the log after the tap: land on the real bottom.
    setTimeout(() => {
      const cur = scroller.current;
      if (cur && cur.scrollHeight - cur.scrollTop - cur.clientHeight > 4) cur.scrollTo({ top: cur.scrollHeight, behavior: 'auto' });
    }, far || behavior !== 'smooth' ? 60 : 500);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prependAnchor.current != null) {
      el.scrollTop = el.scrollHeight - prependAnchor.current;
      prependAnchor.current = null;
      return;
    }
    if (stickNext.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: stickNext.current === 'instant' ? 'auto' : 'smooth' });
      stickNext.current = null;
    }
  }, [messages, thinkingSince, typing]);

  // ── Load + subscribe ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await engine.history(channel);
      stickNext.current = 'instant';
      setMessages((cur) => page.reduce(upsert, cur.filter((m) => m.status === 'sending')));
      setHasMore(page.length >= HISTORY_PAGE);
      engine.markRead(channel, page.filter((m) => !m.mine).map((m) => m.id));
      if (!page.length && onEmptyRef.current && !emptyCalled.current) {
        emptyCalled.current = true;
        setThinkingSince(Date.now());
        onEmptyRef.current().catch(() => setThinkingSince(null));
      }
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMessages([]);
    setTranslations({});
    requested.current = new Set();
    emptyCalled.current = false;
    setThinkingSince(null);
    setTyping(null);
    void load();

    const offMsg = engine.onMessage((m) => {
      if (!sameChannel(m.channel, channel)) return;
      if (m.mine) stickNext.current = 'smooth';
      else {
        if (atBottomRef.current) stickNext.current = 'smooth';
        else setNewCount((n) => n + 1);
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') engine.markRead(channel, [m.id]);
        setTyping((tp) => (tp && tp.userId === m.senderId ? null : tp));
        if (aiId && m.senderId === aiId) setThinkingSince(null);
      }
      setMessages((cur) => upsert(cur, m));
    });
    const offTyping = engine.onTyping((ev) => {
      if (!sameChannel(ev.channel, channel) || ev.userId === myId) return;
      setTyping({ userId: ev.userId, type: ev.typingType, at: Date.now() });
    });
    const offStatus = engine.onStatus(setConn);
    const offBlocked = engine.onBlocked((ev) => {
      if (!sameChannel(ev.channel, channel)) return;
      setMessages((cur) => cur.map((x) => (x.id === ev.messageId ? { ...x, status: 'blocked' } : x)));
    });
    return () => {
      offBlocked();
      offMsg();
      offTyping();
      offStatus();
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Typing / thinking indicators expire on their own.
  useEffect(() => {
    if (!typing) return;
    const id = setTimeout(() => setTyping(null), TYPING_TTL);
    return () => clearTimeout(id);
  }, [typing]);
  useEffect(() => {
    if (thinkingSince == null) return;
    const id = setTimeout(() => setThinkingSince(null), THINKING_TIMEOUT);
    return () => clearTimeout(id);
  }, [thinkingSince]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || !messages.length) return;
    const el = scroller.current;
    setLoadingOlder(true);
    try {
      const oldest = messages.find((m) => m.status !== 'sending') ?? messages[0];
      const page = await engine.history(channel, oldest.sentAt);
      if (el) prependAnchor.current = el.scrollHeight - el.scrollTop;
      setMessages((cur) => page.reduce(upsert, cur));
      setHasMore(page.length >= HISTORY_PAGE);
    } catch (e) {
      setToast(errorText(e));
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, messages, channel]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    atBottomRef.current = bottom;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (bottom && newCount) setNewCount(0);
    if (el.scrollTop < 80 && hasMore && !loadingOlder) void loadOlder();
  };

  // ── Visible list: newest order card per orderId only, known types only ──
  const visible = useMemo(() => {
    const seenOrders = new Set<string>();
    const out: ChatMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!RENDERED.has(m.type)) continue;
      if (m.type === CC_CARD && m.content?.kind === 'order' && m.content.orderId) {
        if (seenOrders.has(m.content.orderId)) continue;
        seenOrders.add(m.content.orderId);
      }
      // Supply-chain cards: newest card per movement / dispute only (each state change re-posts the card).
      const scId = m.type === CC_CARD ? (m.content?.kind === 'movement' ? `mv:${m.content.movementId}` : m.content?.kind === 'dispute' ? `dq:${m.content.disputeId}` : null) : null;
      if (scId) {
        if (seenOrders.has(scId)) continue;
        seenOrders.add(scId);
      }
      if ((m.type === 'RC:TxtMsg' || m.type === 'RC:StreamMsg') && !textOf(m).trim()) continue;
      out.push(m);
    }
    return out.reverse();
  }, [messages]);

  const latestCardBySender = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of visible) if (m.type === CC_CARD) map[m.senderId] = Math.max(map[m.senderId] ?? 0, m.sentAt);
    return map;
  }, [visible]);

  // ── Translation ─────────────────────────────────────────────────────────
  const needsTranslation = counterpartLang !== myLang;

  const translationRequest = useCallback(
    (m: ChatMessage): TranslateRequest | null => {
      if (m.mine || m.status === 'sending') return null;
      if (m.type === CC_VOICE) {
        const p = m.content as VoicePayload;
        if (!p?.transcript?.trim() || !p.lang || p.lang === myLang) return null;
        return { id: `${m.id}:v`, text: p.transcript, from: p.lang, kind: 'text' };
      }
      if (!needsTranslation || BOTS.has(m.senderId)) return null;
      // Source = the message's own language (its script), not the counterpart's: an agent's English line is
      // not "from Tamil", and a Claire auto-reply already in my language needs no translation.
      const text = textOf(m);
      // Latin script can be English, Hinglish or Tanglish whatever the sender's language: let the engine detect it
      // (the label then says "Translated", not "Translated from Telugu" for an English line).
      const from = scriptLang(text, counterpartLang) ?? 'auto';
      if (from === myLang) return null;
      if (m.type === 'RC:TxtMsg') {
        const local = m.id.startsWith('local_') || m.id.startsWith('tmp_') || engine.mode !== 'nexconn';
        return { id: m.id, text, from, kind: local ? 'text' : 'message' };
      }
      if (m.type === 'RC:StreamMsg' && m.content?.complete) return { id: `${m.id}:s`, text, from, kind: 'text' };
      return null;
    },
    [myLang, needsTranslation, counterpartLang, names],
  );

  const runTranslations = useCallback(
    async (reqs: TranslateRequest[]) => {
      if (!reqs.length) return;
      const result = await engine.translate(
        reqs.map((r) => ({ ...r, from: r.from === 'auto' ? undefined : r.from })),
        myLang,
      );
      setTranslations((cur) => {
        const next = { ...cur };
        for (const r of reqs) {
          const tr = result.get(r.id);
          if (tr != null) next[r.id] = isDifferent(tr, r.text) ? { text: tr, from: r.from } : {};
          else next[r.id] = { failed: true, from: r.from };
        }
        return next;
      });
    },
    [myLang],
  );

  useEffect(() => {
    const reqs: TranslateRequest[] = [];
    for (const m of visible) {
      const r = translationRequest(m);
      if (!r) continue;
      const k = `${r.id}|${r.text.length}`;
      if (requested.current.has(k)) continue;
      requested.current.add(k);
      reqs.push(r);
    }
    void runTranslations(reqs);
  }, [visible, translationRequest, runTranslations]);

  const retryTranslation = (m: ChatMessage) => {
    const r = translationRequest(m);
    if (!r) return;
    setTranslations((cur) => ({ ...cur, [r.id]: {} }));
    void runTranslations([r]);
  };

  const toggleOriginal = (id: string) =>
    setShowOriginal((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Sending ──────────────────────────────────────────────────────────────
  const addOptimistic = (m: ChatMessage) => {
    stickNext.current = 'smooth';
    setMessages((cur) => [...cur, m]);
  };
  const markFailed = (localId: string) => setMessages((cur) => cur.map((x) => (x.id === localId ? { ...x, status: 'failed' } : x)));
  const startThinking = () => aiId && setThinkingSince(Date.now());

  const runHook = async (fn: () => void | Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setThinkingSince(null);
      setToast(errorText(e));
    }
  };

  const sendText = async (typed: string, reuseId?: string) => {
    const localId = reuseId ?? newLocalId();
    // Moderation (shared/moderation.ts, the same list Nexconn's filter has): a blocked text never leaves the phone and
    // its bubble says why; a masked word goes out as the mask. Nexconn's own filter still checks what is sent.
    const moderated = moderateText(typed);
    if (moderated.action === 'block') {
      const blockedMsg: ChatMessage = { id: localId, channel, senderId: myId, type: 'RC:TxtMsg', content: { text: typed }, sentAt: Date.now(), mine: true, status: 'blocked' };
      if (reuseId) setMessages((cur) => cur.map((x) => (x.id === reuseId ? blockedMsg : x)));
      else addOptimistic(blockedMsg);
      return;
    }
    const text = moderated.text;
    if (reuseId) setMessages((cur) => cur.map((x) => (x.id === reuseId ? { ...x, status: 'sending', sentAt: Date.now() } : x)));
    else addOptimistic({ id: localId, channel, senderId: myId, type: 'RC:TxtMsg', content: { text }, sentAt: Date.now(), mine: true, status: 'sending' });
    let sent: ChatMessage;
    try {
      sent = await engine.sendText(channel, text);
    } catch {
      markFailed(localId);
      return;
    }
    setMessages((cur) => upsert(cur, { ...sent, localId }));
    startThinking();
    if (onSend) await runHook(() => onSend({ text, messageId: sent.id, lang: userLang }));
  };

  const sendVoice = async (clip: VoiceClip) => {
    const localId = newLocalId();
    const preview = URL.createObjectURL(clip.blob);
    addOptimistic({
      id: localId,
      channel,
      senderId: myId,
      type: CC_VOICE,
      content: { audioUrl: preview, durationMs: clip.durationMs, lang: userLang, transcript: '' } satisfies VoicePayload,
      sentAt: Date.now(),
      mine: true,
      status: 'sending',
    });
    setVoiceBusy(true);
    try {
      const stt = await transcribeClip(clip, userLang);
      const payload: VoicePayload = { audioUrl: stt.audioUrl || preview, durationMs: Math.round(stt.durationMs || clip.durationMs), lang: stt.lang || userLang, transcript: stt.text };
      setMessages((cur) => cur.map((x) => (x.id === localId ? { ...x, content: payload } : x)));
      const sent = await engine.sendVoice(channel, payload);
      setMessages((cur) => upsert(cur, { ...sent, content: payload, localId }));
      startThinking();
      if (onSend && stt.text) await runHook(() => onSend({ text: stt.text, voice: true, messageId: sent.id, lang: payload.lang, audioUrl: payload.audioUrl }));
    } catch (e) {
      markFailed(localId);
      setToast(`${t('voice_failed')} ${errorText(e)}`);
    } finally {
      setVoiceBusy(false);
    }
  };

  const chip = useCallback(
    async (chipId: string, label: string) => {
      if (chipId === 'action:catalog') {
        setCatalogOpen(true);
        return;
      }
      let messageId: string | undefined;
      if (echoChips) {
        const localId = newLocalId();
        const content: ReplyPayload = { chipId, label };
        addOptimistic({ id: localId, channel, senderId: myId, type: CC_REPLY, content, sentAt: Date.now(), mine: true, status: 'sending' });
        try {
          const sent = await engine.sendCard(channel, CC_REPLY, content);
          messageId = sent.id;
          setMessages((cur) => upsert(cur, { ...sent, localId }));
        } catch {
          markFailed(localId);
        }
      }
      startThinking();
      // The chip's action matters more than its echo bubble, so notify the server either way.
      if (onChip) await runHook(() => onChip(chipId, label, messageId));
    },
    [key, onChip, myId, echoChips], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const retrySend = (m: ChatMessage) => {
    if (m.type === 'RC:TxtMsg') void sendText(textOf(m), m.id);
  };

  // ── Card context ─────────────────────────────────────────────────────────
  const baseCtx = useMemo<CardCtx>(
    () => ({
      me: { id: myId, businessId: (user?.business_id as string | null | undefined) ?? null, language: myLang },
      lang: myLang,
      chip,
      openStorefront: (businessId: string) => navigate(`/store/${businessId}`),
      openDeal: async (sellerBusinessId: string, opts?: { requirementId?: string; listingId?: string }) => {
        try {
          const r = await api.post<{ conversation?: { id: string } }>('/api/deals/open', { sellerBusinessId, ...(opts ?? {}) });
          if (r?.conversation?.id) navigate(`/chat/${r.conversation.id}`);
        } catch (e) {
          setToast(errorText(e));
        }
      },
      openConversation: (id: string) => navigate(`/chat/${id}`),
      api,
      refresh: () => {
        void load();
        onRefreshRef.current?.();
      },
      conversationId,
      ...cardExtras,
    }),
    [myId, user?.business_id, myLang, chip, navigate, load, conversationId, cardExtras],
  );

  // The screen posted something (e.g. an offer from its sheet): follow it to the bottom.
  useEffect(() => {
    if (!scrollSignal) return;
    stickNext.current = 'smooth';
    const id = setTimeout(() => scrollToBottom('smooth'), 900);
    return () => clearTimeout(id);
  }, [scrollSignal, scrollToBottom]);

  // ── Render helpers ───────────────────────────────────────────────────────
  const labelFor = (m: ChatMessage): string | undefined => {
    if (m.mine || channel.type === 'direct') return undefined;
    if (names?.[m.senderId]) return names[m.senderId];
    if (m.senderId === CLAIRE_ID) return 'Claire';
    if (m.senderId === DESK_ID) return 'Trade Desk';
    return undefined;
  };

  const renderMessage = (m: ChatMessage, pos: BubblePosition) => {
    const c = m.content ?? {};
    switch (m.type) {
      case 'RC:TxtMsg':
      case 'RC:StreamMsg': {
        const trKey = m.type === 'RC:StreamMsg' ? `${m.id}:s` : m.id;
        return (
          <MessageBubble
            message={m}
            pos={pos}
            text={textOf(m)}
            senderLabel={labelFor(m)}
            translation={translations[trKey]}
            showOriginal={showOriginal.has(trKey)}
            onToggleOriginal={() => toggleOriginal(trKey)}
            onRetryTranslation={() => retryTranslation(m)}
            onRetrySend={() => retrySend(m)}
            streaming={m.type === 'RC:StreamMsg' && !c.complete}
          />
        );
      }
      case CC_VOICE:
      case 'RC:HQVCMsg': {
        const payload: VoicePayload =
          m.type === CC_VOICE
            ? (c as VoicePayload)
            : { audioUrl: String(c.remoteUrl ?? ''), durationMs: Number(c.duration ?? 0) * 1000, lang: '', transcript: String(c.sttInfo?.text ?? '') };
        const trKey = `${m.id}:v`;
        return (
          <VoiceBubble
            message={m}
            payload={payload}
            pos={pos}
            myLang={myLang}
            senderLabel={labelFor(m)}
            translation={translations[trKey]}
            showOriginal={showOriginal.has(trKey)}
            onToggleOriginal={() => toggleOriginal(trKey)}
            onRetryTranslation={() => retryTranslation(m)}
          />
        );
      }
      case 'RC:ImgMsg': {
        const src = c.remoteUrl || c.imageUri || (c.thumbnailBase64 ? `data:image/jpeg;base64,${c.thumbnailBase64}` : c.content ? `data:image/jpeg;base64,${c.content}` : '');
        return (
          <BubbleShell mine={m.mine} pos={pos} className="!p-1">
            {src ? <img src={src} alt="" className="max-h-72 rounded-[16px] object-cover" loading="lazy" /> : null}
          </BubbleShell>
        );
      }
      case CC_CARD: {
        const ctx = latestCardBySender[m.senderId] ? { ...baseCtx, latestCardAt: latestCardBySender[m.senderId] } : baseCtx;
        if (SYSTEM_CARD_KINDS.has(c.kind)) {
          return (
            <div className="flex w-full animate-fade-up justify-center">
              <CardRenderer message={m} payload={c as CardPayload} ctx={ctx} />
            </div>
          );
        }
        // Claire's browsing cards use the full width; deal cards keep a gutter so the sender side reads.
        const wide = WIDE_CARDS.has(c.kind);
        return (
          <div className={clsx('flex w-full animate-fade-up', m.mine ? 'justify-end' : 'justify-start')}>
            <div className={clsx('w-full', !wide && 'max-w-[92%]')}>
              <CardRenderer message={m} payload={c as CardPayload} ctx={ctx} />
            </div>
          </div>
        );
      }
      case CC_HINT:
        return <HintBubble message={m} payload={c as HintPayload} ctx={baseCtx} />;
      case CC_CALL:
        return <CallLine payload={c as Partial<CallPayload>} />;
      case CC_REPLY:
        return (
          <div className={clsx('flex w-full', m.mine ? 'justify-end' : 'justify-start')}>
            <div className="max-w-[78%]">
              <ReplyBubble message={m} payload={c as ReplyPayload} ctx={baseCtx} />
              {m.status === 'failed' && <p className="mt-1 text-right text-[12px] text-danger">{t('send_failed')}</p>}
            </div>
          </div>
        );
      default:
        if (SYSTEM_TYPES.has(m.type)) {
          const txt = String(c.message ?? c.text ?? c.content ?? '');
          return txt ? <SystemPill>{txt}</SystemPill> : null;
        }
        return null;
    }
  };

  const typingLabel = typing
    ? typing.type === CC_VOICE || typing.type === 'RC:HQVCMsg' || typing.type === 'RC:VcMsg'
      ? t('recording_voice')
      : t('typing')
    : '';

  const empty = !loading && !loadError && visible.length === 0 && thinkingSince == null;
  const dt = dealT(myLang);
  const replies = !readOnly && quickReplies?.length ? quickReplies : null;

  return (
    <div className={clsx('flex h-full min-h-0 flex-col bg-surface', className)}>
      {header}
      {banner}
      {conn !== 'connected' && conn !== 'idle' && !loading && (
        <div className="flex items-center justify-center gap-2 bg-accent-tint px-3 py-1.5 text-[12px] font-medium text-accent-ink" role="status">
          {conn === 'error' ? <WifiOff size={14} aria-hidden /> : <Loader2 size={14} className="animate-spin" aria-hidden />}
          {t('offline')}
          {conn === 'error' && (
            <button type="button" className="min-h-[28px] px-1 font-semibold underline underline-offset-2" onClick={() => void engine.connect().then(load).catch(() => undefined)}>
              {t('retry')}
            </button>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-page">
        <div
          ref={scroller}
          onScroll={onScroll}
          className={clsx('scroll-thin absolute inset-0 overflow-y-auto overscroll-contain', compact ? 'px-3 py-3' : 'px-3 pt-3 pb-4', !atBottom && '!pb-16')}
        >
          {loadingOlder && (
            <div className="flex justify-center py-2 text-meta">
              <Loader2 size={18} className="animate-spin" aria-label={t('loading')} />
            </div>
          )}
          {!loadingOlder && hasMore && (
            <div className="flex justify-center pb-2">
              <button type="button" onClick={() => void loadOlder()} className="min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold text-primary hover:bg-primary-tint">
                {t('load_earlier')}
              </button>
            </div>
          )}

          {loading && !visible.length && (
            <div className="space-y-3 py-2" aria-busy="true" aria-label={t('loading')}>
              {[62, 44, 70, 38].map((w, i) => (
                <div key={i} className={clsx('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                  <div className="shimmer-block h-11 rounded-[20px]" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          )}

          {loadError && !visible.length && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-meta">
                <WifiOff size={22} aria-hidden />
              </span>
              <p className="text-[14px] text-ink-2">{loadError}</p>
              <button type="button" onClick={() => void load()} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-tint px-4 font-semibold text-primary hover:bg-primary-soft">
                <RefreshCw size={16} aria-hidden /> {t('retry')}
              </button>
            </div>
          )}

          {empty &&
            (emptyState ?? (
              <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <MessageCircle size={26} aria-hidden />
                </span>
                <p className="font-head text-[17px] font-semibold text-ink">{t('no_messages')}</p>
                {!readOnly && <p className="text-[14px] text-meta">{t('say_hello')}</p>}
              </div>
            ))}

          <div role="log" aria-live="polite" aria-relevant="additions" aria-label={t('conversation_log')}>
            {visible.map((m, i) => {
              const prev = visible[i - 1];
              const next = visible[i + 1];
              const newDay = !prev || !sameDay(prev.sentAt, m.sentAt);
              const groupedWithPrev = !newDay && prev && prev.senderId === m.senderId && m.sentAt - prev.sentAt < 5 * 60_000 && prev.type !== CC_CARD && m.type !== CC_CARD;
              const groupedWithNext =
                next && next.senderId === m.senderId && sameDay(next.sentAt, m.sentAt) && next.sentAt - m.sentAt < 5 * 60_000 && next.type !== CC_CARD && m.type !== CC_CARD;
              const pos: BubblePosition = { first: !groupedWithPrev, last: !groupedWithNext };
              const node = renderMessage(m, pos);
              if (!node) return null;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="flex justify-center pt-2 pb-1">
                      <span className="rounded-full bg-sunken px-3 py-1 text-[12px] font-medium text-meta">
                        {dayLabel(m.sentAt, { today: t('today'), yesterday: t('yesterday') })}
                      </span>
                    </div>
                  )}
                  <div className={clsx(i === 0 || newDay ? 'mt-2' : groupedWithPrev ? 'mt-0.5' : 'mt-3')}>{node}</div>
                </Fragment>
              );
            })}
          </div>

          {thinkingSince != null && (
            <div className="mt-3 flex items-end gap-2" role="status">
              <ClaireMark size={26} />
              <div className="rounded-[20px_20px_20px_8px] border border-line bg-surface px-3.5 py-2">
                <span className="shimmer-text text-[14px] font-medium">{t('claire_thinking')}</span>
              </div>
            </div>
          )}

          {typing && thinkingSince == null && (
            <div className="mt-3 flex items-center gap-2" role="status" aria-label={typingLabel}>
              <div className="flex h-9 items-center gap-1 rounded-[20px_20px_20px_8px] border border-line bg-surface px-3.5" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-1.5 animate-typing rounded-full bg-meta" style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[12px] text-meta">{typingLabel}</span>
            </div>
          )}
        </div>

        {!atBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className={clsx(
              'absolute bottom-3 left-1/2 z-20 inline-flex min-h-[44px] min-w-[44px] -translate-x-1/2 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold shadow-[var(--shadow-float)]',
              newCount ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-2',
            )}
          >
            <ArrowDown size={16} aria-hidden />
            {newCount ? `${t('new_messages')} · ${newCount}` : ''}
            {!newCount && <span className="sr-only">{t('new_messages')}</span>}
          </button>
        )}
      </div>

      {toast && (
        <div className="bg-page px-3 pb-2">
          <div role="alert" className="rounded-[16px] bg-ink px-3.5 py-2.5 text-[13px] text-white shadow-[var(--shadow-float)]">
            {toast}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="shrink-0 border-t border-line bg-surface">
          {replies && (
            <div role="group" aria-label={dt('quick_replies')} className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 pt-2.5 pb-0.5">
              {replies.map((r) => {
                const Icon = r.icon;
                return (
                  <Fragment key={r.id}>
                    {r.divider && <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-line" />}
                    <button
                      type="button"
                      onClick={() => (r.onTap ? r.onTap() : r.text ? void sendText(r.text) : undefined)}
                      className={clsx(
                        'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
                        r.tone === 'quiet'
                          ? 'border-line bg-surface text-ink-2 hover:bg-sunken'
                          : 'border-chip-border bg-primary-tint text-primary hover:bg-primary-soft',
                      )}
                    >
                      {Icon && <Icon size={16} aria-hidden className="shrink-0" />}
                      {r.label}
                    </button>
                  </Fragment>
                );
              })}
            </div>
          )}
          {footer}
          <Composer
            onSendText={(text) => void sendText(text)}
            onVoice={(clip) => void sendVoice(clip)}
            onAttach={noAttach ? undefined : () => setCatalogOpen(true)}
            onTyping={(type) => engine.sendTyping(channel, type)}
            placeholder={placeholder}
            busy={voiceBusy}
            compact={compact}
          />
        </div>
      )}

      {!readOnly && !noAttach && (
        <CatalogSheet
          open={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          onPublished={() => {
            setCatalogOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

export default ChatView;
