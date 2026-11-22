// Nexconn webhooks (production path). Locally the client notify endpoints do the same job;
// both paths claim `msg:<messageId>` so a message is only ever answered once.
import crypto from 'node:crypto';
import { Router } from 'express';
import { BOT, cfg } from '../config.js';
import { bump, byId, claim } from '../db/index.js';
import { claireTurn } from '../claire.js';
import { archiveGroupMessage } from '../chat.js';
import type { UserRow } from '../biz.js';

const router = Router();
const DIRECT = 1; // Nexconn channelType for one-to-one chats
const GROUP = 3; // Nexconn channelType for group chats
/** Give the client notify path a head start so it (with its richer context) normally wins the claim. */
const WEBHOOK_GRACE_MS = 1500;

function verify(headers: Record<string, unknown>) {
  const { appKey, appSecret } = cfg.nexconn;
  if (!appSecret) return false;
  const nonce = String(headers['nonce'] ?? '');
  const timestamp = String(headers['timestamp'] ?? '');
  const signature = String(headers['signature'] ?? '').toLowerCase();
  const key = String(headers['appkey'] ?? '');
  if (!nonce || !timestamp || !signature || (key && key !== appKey)) return false;
  const expected = crypto.createHash('sha1').update(appSecret + nonce + timestamp).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

interface MessageEvent {
  userId: string;
  channelId: string;
  messageType: string;
  content: string;
  channelType: number;
  messageId: string;
  os?: string;
  time?: number;
  groupUserIds?: string[];
}

/** Group messages go to the server's archive, so a Trade Desk agent who joins later can read what came before (B10). */
function archive(m: MessageEvent) {
  // Server API sends are archived when the server sends them (chat.group).
  if (m.channelType !== GROUP || m.os === 'Server' || !m.messageId) return;
  let content: unknown = m.content;
  try {
    content = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
  } catch { /* keep the raw string */ }
  void archiveGroupMessage({ id: m.messageId, channelId: m.channelId, senderId: m.userId, type: m.messageType, content, directed: m.groupUserIds?.length ? m.groupUserIds : null, sentAt: Number(m.time) || Date.now() });
}

function inputFrom(m: MessageEvent): { text?: string; chipId?: string } | null {
  let c: any = {};
  try {
    c = typeof m.content === 'string' ? JSON.parse(m.content) : m.content ?? {};
  } catch {
    c = { content: m.content };
  }
  if (m.messageType === 'RC:TxtMsg') return c.content || c.text ? { text: String(c.content || c.text) } : null;
  if (m.messageType === 'CC:Reply') return c.chipId ? { chipId: String(c.chipId) } : null;
  if (m.messageType === 'CC:Voice') return c.transcript ? { text: String(c.transcript) } : null;
  return null;
}

async function handleMessage(m: MessageEvent) {
  void bump('messages');
  archive(m);
  if (m.channelType !== DIRECT || m.channelId !== BOT.claire || !m.userId?.startsWith('u_') || m.os === 'Server') return;
  const input = inputFrom(m);
  if (!input) return;
  await new Promise((r) => setTimeout(r, WEBHOOK_GRACE_MS));
  if (!(await claim(`msg:${m.messageId}`))) return;
  const user = await byId<UserRow>('users', m.userId);
  if (!user) return;
  await claireTurn(user, input);
}

router.post('/webhooks/nexconn', (req, res) => {
  if (!verify(req.headers as Record<string, unknown>)) {
    console.warn('[webhook] rejected a request with a bad Nexconn signature');
    return res.status(401).json({ error: 'bad signature' });
  }
  res.status(200).json({ ok: true }); // ack inside Nexconn's 5 s window, work happens after
  const evt = req.body ?? {};
  if (evt.type !== 'message:send' || !Array.isArray(evt.data)) return;
  for (const m of evt.data as MessageEvent[]) {
    handleMessage(m).catch((err) => console.error('[webhook] message handling failed', m?.messageId, err?.message ?? err));
  }
});

export default router;
