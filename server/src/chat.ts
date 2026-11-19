// Chat delivery layer. Uses Nexconn when keys are configured; otherwise a local
// relay (SQLite + Server-Sent Events) so the app can be developed before keys exist.
import type { Response } from 'express';
import { features, BOT } from './config.js';
import { nexconn } from './nexconn.js';
import { insert, find, findOne } from './db/index.js';
import { id, now } from './util.js';

export const chatMode = () => (features.nexconn ? 'nexconn' : 'local') as 'nexconn' | 'local';

// ── Local relay ────────────────────────────────────────────────────────────
const streams = new Map<string, Set<Response>>();

export function attachStream(userId: string, res: Response) {
  if (!streams.has(userId)) streams.set(userId, new Set());
  streams.get(userId)!.add(res);
  res.on('close', () => streams.get(userId)?.delete(res));
}

function push(userId: string, event: string, data: unknown) {
  for (const res of streams.get(userId) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export interface WireMessage {
  id: string;
  channelType: 'direct' | 'group' | 'system';
  targetId: string; // from the receiver's point of view
  senderId: string;
  type: string;
  content: any;
  metadata?: Record<string, string>;
  sentAt: number;
}

const directKey = (a: string, b: string) => `d:${[a, b].sort().join('|')}`;

async function storeLocal(row: {
  key: string; channelType: string; groupId?: string; sender: string; receiver?: string; directed?: string[]; type: string; content: unknown; metadata?: Record<string, string>;
}) {
  const msg = { id: id('m', 14), sent_at: now() };
  await insert('dev_messages', {
    id: msg.id, channel_key: row.key, channel_type: row.channelType, group_id: row.groupId ?? null, sender_id: row.sender,
    receiver_id: row.receiver ?? null, directed: row.directed?.length ? row.directed : null, type: row.type,
    content: row.content, metadata: row.metadata ?? null, sent_at: msg.sent_at,
  });
  return msg;
}

export async function localSendDirect(from: string, to: string, type: string, content: any, metadata?: Record<string, string>, channelType: 'direct' | 'system' = 'direct') {
  const m = await storeLocal({ key: directKey(from, to), channelType, sender: from, receiver: to, type, content, metadata });
  const base = { id: m.id, channelType, senderId: from, type, content, metadata, sentAt: m.sent_at };
  push(to, 'message', { ...base, targetId: from } satisfies WireMessage);
  push(from, 'message', { ...base, targetId: to } satisfies WireMessage);
  return m.id;
}

export async function localSendGroup(groupId: string, from: string, type: string, content: any, directed?: string[], metadata?: Record<string, string>) {
  const m = await storeLocal({ key: `g:${groupId}`, channelType: 'group', groupId, sender: from, directed, type, content, metadata });
  const conv = await findOne('conversations', { channel_id: groupId });
  const members: string[] = conv?.user_ids ?? [];
  const recipients = directed?.length ? [...new Set([...directed, from])] : members;
  for (const u of recipients) push(u, 'message', { id: m.id, channelType: 'group', targetId: groupId, senderId: from, type, content, metadata, sentAt: m.sent_at } satisfies WireMessage);
  return m.id;
}

export async function localHistory(userId: string, channelType: string, targetId: string, before = Date.now(), limit = 40): Promise<WireMessage[]> {
  const key = channelType === 'group' ? `g:${targetId}` : directKey(userId, targetId);
  const rows = await find('dev_messages', { channel_key: key, sent_at: { $lt: before } }, { sort: { sent_at: -1 }, limit });
  return rows
    .filter((r) => !r.directed || r.directed.includes(userId) || r.sender_id === userId)
    .reverse()
    .map((r) => ({
      id: r.id,
      channelType: r.channel_type,
      targetId: channelType === 'group' ? targetId : r.sender_id === userId ? r.receiver_id : r.sender_id,
      senderId: r.sender_id,
      type: r.type,
      content: r.content,
      metadata: r.metadata ?? undefined,
      sentAt: r.sent_at,
    }));
}

export function pushEvent(userIds: string[], event: string, data: unknown) {
  for (const u of userIds) push(u, event, data);
}

// ── Public API used by the rest of the server ──────────────────────────────
export const chat = {
  async ensureUser(userId: string, name: string): Promise<string | null> {
    if (!features.nexconn) return null;
    return nexconn.issueToken(userId, name);
  },

  /** Direct message from `from` to each user in `to` (e.g. Claire → user). */
  async direct(from: string, to: string[], type: string, content: any, opts: { push?: string; metadata?: Record<string, string> } = {}) {
    if (!features.nexconn) {
      for (const t of to) await localSendDirect(from, t, type, content, opts.metadata);
      return;
    }
    await nexconn.sendDirect({ from, to, type, content, pushContent: opts.push, echo: false });
  },

  /** Group message; `onlyTo` turns it into a targeted message seen only by those members. */
  async group(groupId: string, from: string, type: string, content: any, opts: { onlyTo?: string[]; push?: string } = {}) {
    if (!features.nexconn) {
      await localSendGroup(groupId, from, type, content, opts.onlyTo);
      return;
    }
    await nexconn.sendGroup({ from, groupId, type, content, toUserIds: opts.onlyTo, pushContent: opts.push });
  },

  /** "CLAIRE Updates" system notices (order, payment, dispatch). */
  async system(to: string[], text: string) {
    const content = { content: text };
    if (!features.nexconn) {
      for (const t of to) await localSendDirect(BOT.updates, t, 'RC:TxtMsg', content, undefined, 'system');
      return;
    }
    await nexconn.sendSystem({ from: BOT.updates, to, type: 'RC:TxtMsg', content, pushContent: text.slice(0, 80) });
  },

  /** Claire's longer answers stream in chunk by chunk (Nexconn streaming messages). */
  async stream(from: string, to: string, text: string) {
    if (!features.nexconn) {
      await localSendDirect(from, to, 'RC:TxtMsg', { content: text });
      return;
    }
    const words = text.split(/(\s+)/);
    const chunks: string[] = [];
    let buf = '';
    for (const w of words) {
      buf += w;
      if (buf.length > 24) {
        chunks.push(buf);
        buf = '';
      }
    }
    if (buf) chunks.push(buf);
    try {
      await nexconn.streamDirect({ from, to, chunks: chunks.length ? chunks : [text] });
    } catch (err) {
      console.warn('[chat] stream failed, falling back to text', (err as Error).message);
      await nexconn.sendDirect({ from, to: [to], type: 'RC:TxtMsg', content: { content: text } });
    }
  },

  async createGroup(groupId: string, name: string, owner: string, members: string[]) {
    if (!features.nexconn) return;
    await nexconn.createGroup({ groupId, name, owner, members });
  },

  async joinGroup(groupId: string, userIds: string[]) {
    if (!features.nexconn) return;
    await nexconn.joinGroup(groupId, userIds);
  },
};
