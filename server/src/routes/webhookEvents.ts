// Pure helpers for /webhooks/nexconn (no config or database imports, so they are unit-testable).
import crypto from 'node:crypto';

type Bag = Record<string, unknown>;
const pick = (headers: Bag, query: Bag, key: string) => String(headers[key.toLowerCase()] ?? query[key] ?? query[key.toLowerCase()] ?? '');

/**
 * Nexconn signs a callback as sha1(appSecret + nonce + timestamp). Message callbacks carry the parts as headers;
 * other subscriptions (calls) may put them in the query string, so both are accepted.
 */
export function verifySignature(headers: Bag, query: Bag, appKey: string, appSecret: string): boolean {
  if (!appSecret) return false;
  const nonce = pick(headers, query, 'nonce');
  const timestamp = pick(headers, query, 'timestamp');
  const signature = pick(headers, query, 'signature').toLowerCase();
  const key = pick(headers, query, 'appKey');
  if (!nonce || !timestamp || !signature || (key && key !== appKey)) return false;
  const expected = crypto.createHash('sha1').update(appSecret + nonce + timestamp).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export type WebhookKind = 'message' | 'call' | 'other';

/**
 * What a callback is about. Messages are handled; call events (ring / answer / hang-up / call log) are only logged,
 * because both phones already post the CC:Call summary and update their screens from the Call SDK.
 */
export function webhookKind(evt: unknown): WebhookKind {
  if (!evt || typeof evt !== 'object') return 'other';
  const e = evt as Bag;
  const type = String(e.type ?? e.eventType ?? e.event ?? '');
  if (type === 'message:send' && Array.isArray(e.data)) return 'message';
  if (/call|rtc|voip/i.test(type) || 'callId' in e || 'sessionId' in e) return 'call';
  return 'other';
}

/** One short log line for a call event (ids and the event name only, never message content). */
export function describeCallEvent(evt: unknown): string {
  const e = (evt && typeof evt === 'object' ? evt : {}) as Bag;
  const d = (Array.isArray(e.data) ? e.data[0] : e.data) as Bag | undefined;
  const type = String(e.type ?? e.eventType ?? e.event ?? 'call');
  const callId = String(e.callId ?? e.sessionId ?? d?.callId ?? d?.sessionId ?? '?');
  return `${type} · callId ${callId}`.slice(0, 160);
}
