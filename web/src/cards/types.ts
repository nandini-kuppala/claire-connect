// Shared chat + card types. The web shell (ChatView, engine facade) imports these.
import type { CardPayload } from '@shared/cards';

export type ChannelType = 'direct' | 'group' | 'system';

export interface Channel {
  type: ChannelType;
  targetId: string;
}

/** Normalised chat message produced by web/src/chat/engine.ts. */
export interface ChatMessage {
  id: string;
  channel: Channel;
  senderId: string;
  /** Nexconn message type, e.g. 'RC:TxtMsg', 'CC:Card', 'CC:Hint', 'CC:Reply', 'CC:Voice'. */
  type: string;
  // Content shape depends on `type`; cards receive the parsed payload separately.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  metadata?: Record<string, unknown>;
  sentAt: number;
  mine: boolean;
}

export interface CardApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = any>(path: string): Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T = any>(path: string, body?: unknown): Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T = any>(path: string, body?: unknown): Promise<T>;
}

export interface CardCtx {
  me: { id: string; businessId: string | null; language: string };
  lang: string;
  /** Send a chip tap (shows as the user's reply bubble and notifies the server). */
  chip(chipId: string, label: string): void | Promise<void>;
  openStorefront(businessId: string): void;
  openDeal(sellerBusinessId: string, opts?: { requirementId?: string; listingId?: string }): void | Promise<void>;
  openConversation(id: string): void;
  api: CardApi;
  refresh(): void;
  /**
   * Optional: sentAt of the newest card/chips message from the same sender in this chat.
   * When present, chip-style cards older than this collapse so they cannot be re-submitted.
   */
  latestCardAt?: number;
  /** Optional: the Mongo conversation id of the open chat (deal chats). Falls back to a lookup. */
  conversationId?: string;
  /** Optional: live offer statuses by offerId (deal chats); offer cards keep the status they were posted with. */
  offerStatus?: Record<string, string>;
  /** Optional: orderIds my business has already rated; their rating cards collapse. */
  ratedOrders?: string[];
}

export type CardKind = CardPayload['kind'];
export type CardOf<K extends CardKind> = Extract<CardPayload, { kind: K }>;

/** Props every card component receives. */
export interface CardProps<K extends CardKind> {
  message: ChatMessage;
  payload: CardOf<K>;
  ctx: CardCtx;
}
