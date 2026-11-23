// Nexconn webhooks (production path). Locally the client notify endpoints do the same job;
// both paths claim `msg:<messageId>` so a message is only ever answered once.
import { Router } from 'express';
import { BOT, cfg } from '../config.js';
import { bump, byId, claim } from '../db/index.js';
import { claireTurn } from '../claire.js';
import { archiveGroupMessage } from '../chat.js';
import type { UserRow } from '../biz.js';
import { describeCallEvent, verifySignature, webhookKind } from './webhookEvents.js';

const router = Router();
const DIRECT = 1; // Nexconn channelType for one-to-one chats
const GROUP = 3; // Nexconn channelType for group chats
/** Give the client notify path a head start so it (with its richer context) normally wins the claim. */
const WEBHOOK_GRACE_MS = 1500;

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
  if (!verifySignature(req.headers as Record<string, unknown>, req.query as Record<string, unknown>, cfg.nexconn.appKey, cfg.nexconn.appSecret)) {
    console.warn('[webhook] rejected a request with a bad Nexconn signature');
    return res.status(401).json({ error: 'bad signature' });
  }
  res.status(200).json({ ok: true }); // ack inside Nexconn's 5 s window, work happens after
  const evt = req.body ?? {};
  try {
    const kind = webhookKind(evt);
    // Call events (subscribed in the console): logged only. The phones end the call and post the CC:Call
    // summary themselves from the Call SDK, so nothing here may change call state or post a second line.
    if (kind === 'call') console.info(`[webhook] call event ${describeCallEvent(evt)}`);
    if (kind !== 'message') return;
    for (const m of evt.data as MessageEvent[]) {
      handleMessage(m).catch((err) => console.error('[webhook] message handling failed', m?.messageId, err?.message ?? err));
    }
  } catch (err) {
    console.error('[webhook] could not read the callback', (err as Error)?.message ?? err);
  }
});

export default router;
