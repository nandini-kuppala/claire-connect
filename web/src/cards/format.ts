import type { CardCtx, ChatMessage } from './types';

/** ₹ with Indian digit grouping. Small amounts keep up to 2 decimals (₹167.8), large ones are whole. */
export function inr(n: number | null | undefined, decimals?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const d = decimals ?? (Math.abs(n) < 1000 ? 2 : 0);
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: d });
}

export const num = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-IN'));

/** Short unit for "per" labels: ₹168 / pc. */
export const unitPer = (u: string) => (u === 'kg' ? 'kg' : u === 'dozen' ? 'dozen' : 'pc');

/** Unit after a quantity: 1,000 pcs · 20 dozen · 100 kg. */
export const unitQty = (u: string, n = 2) => (u === 'kg' ? 'kg' : u === 'dozen' ? 'dozen' : n === 1 ? 'pc' : 'pcs');

/** Strip leading emoji from server-provided labels (UI uses Lucide icons only). */
export function cleanLabel(s: string): string {
  return s.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\s]+/u, '').trim() || s;
}

export function errMsg(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string') return e;
  return 'Something went wrong. Please try again.';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

export function fmtDate(ms: number, lang: string): string {
  const loc = lang === 'hi' ? 'hi-IN' : lang === 'ta' ? 'ta-IN' : 'en-IN';
  return new Date(ms).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
}

export type TrustTier = 'high' | 'mid' | 'new';
export const trustTier = (score: number): TrustTier => (score >= 80 ? 'high' : score >= 60 ? 'mid' : 'new');

/**
 * True when a chip-style card has been superseded by a newer card from the same sender,
 * so its answers can no longer be tapped.
 */
export function isStale(message: ChatMessage, ctx: CardCtx): boolean {
  return typeof ctx.latestCardAt === 'number' && message.sentAt < ctx.latestCardAt;
}

const convoCache = new Map<string, string>();

/** Resolve the Mongo conversation id for the chat a message lives in. */
export async function resolveConversationId(ctx: CardCtx, message: ChatMessage): Promise<string> {
  if (ctx.conversationId) return ctx.conversationId;
  const fromMeta = message.metadata?.conversationId;
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta;
  const target = message.channel.targetId;
  const cached = convoCache.get(target);
  if (cached) return cached;
  try {
    const res = await ctx.api.get<unknown>('/api/conversations');
    const list = (Array.isArray(res) ? res : (res as { conversations?: unknown[] })?.conversations ?? []) as {
      id: string;
      channelId?: string;
      channel_id?: string;
    }[];
    const hit = list.find((c) => c.id === target || c.channelId === target || c.channel_id === target);
    if (hit) {
      convoCache.set(target, hit.id);
      return hit.id;
    }
  } catch {
    /* fall through to the channel id */
  }
  return target;
}
