// Thin client for the Nexconn Platform Chat API (server side).
// Docs: https://docs.nexconn.ai/platform-chat-api — signature = sha1(AppSecret + Nonce + Timestamp).
import crypto from 'node:crypto';
import { cfg } from './config.js';

const HOSTS: Record<string, [string, string]> = {
  SG: ['api.sg-light-api.com', 'api-b.sg-light-api.com'],
  NA: ['api.us-light-api.com', 'api-b.us-light-api.com'],
  SA: ['api.sau-light-api.com', 'api-b.sau-light-api.com'],
};

let activeHost = 0;

function headers() {
  const nonce = String(Math.floor(Math.random() * 1e12));
  const timestamp = String(Date.now());
  const signature = crypto.createHash('sha1').update(cfg.nexconn.appSecret + nonce + timestamp).digest('hex');
  return {
    'App-Key': cfg.nexconn.appKey,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: signature,
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID().replace(/-/g, ''),
  };
}

export class NexconnError extends Error {
  constructor(public code: number, msg: string, public path: string) {
    super(`Nexconn ${path} failed (${code}): ${msg}`);
  }
}

async function call<T = any>(path: string, body: unknown, attempt = 0): Promise<T> {
  const hosts = HOSTS[cfg.nexconn.area] || HOSTS.SG;
  const host = hosts[activeHost % 2];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { code: res.status, msg: text.slice(0, 200) };
    }
    if (res.status >= 500 && attempt === 0) {
      activeHost++;
      return call(path, body, 1);
    }
    const code = typeof json.code === 'number' ? json.code : res.status;
    if (code !== 0 && code !== 200) throw new NexconnError(code, json.msg || json.errorMessage || text.slice(0, 200), path);
    return json as T;
  } catch (err: any) {
    if (err instanceof NexconnError) throw err;
    if (attempt === 0) {
      activeHost++; // fail over to the backup domain
      return call(path, body, 1);
    }
    throw new NexconnError(-1, err?.message || 'network error', path);
  } finally {
    clearTimeout(timer);
  }
}

export const nexconn = {
  async issueToken(userId: string, name: string, avatarUrl?: string): Promise<string> {
    const r = await call<{ result: { accessToken: string } }>('/v4/auth/access-token/issue', {
      userId,
      name: name.slice(0, 64) || userId,
      ...(avatarUrl ? { avatarUrl } : {}),
    });
    return r.result.accessToken;
  },

  sendDirect(p: { from: string; to: string[]; type: string; content: object; pushContent?: string; echo?: boolean; persist?: boolean }) {
    return call('/v4/direct-channel/message/send', {
      fromUserId: p.from,
      toUserIds: p.to,
      messageType: p.type,
      content: JSON.stringify(p.content),
      ...(p.pushContent ? { pushContent: p.pushContent } : {}),
      isEchoToSender: p.echo ? 1 : 0,
      shouldPersist: p.persist === false ? 0 : 1,
    });
  },

  sendGroup(p: { from: string; groupId: string; type: string; content: object; toUserIds?: string[]; pushContent?: string; echo?: boolean }) {
    return call('/v4/group-channel/message/send', {
      fromUserId: p.from,
      toChannelIds: [p.groupId], // the docs table says String, but every example (and "up to 3 groups") is an array
      ...(p.toUserIds?.length ? { toUserIds: p.toUserIds } : {}),
      messageType: p.type,
      content: JSON.stringify(p.content),
      ...(p.pushContent ? { pushContent: p.pushContent } : {}),
      isEchoToSender: p.echo === false ? 0 : 1,
    });
  },

  sendSystem(p: { from: string; to: string[]; type: string; content: object; pushContent?: string }) {
    return call('/v4/system-channel/message/send', {
      fromUserId: p.from,
      toUserIds: p.to,
      messageType: p.type,
      content: JSON.stringify(p.content),
      pushContent: p.pushContent || 'CLAIRE update',
    });
  },

  /** Streams a text answer chunk by chunk into a direct channel (RC:StreamMsg). */
  async streamDirect(p: { from: string; to: string; chunks: string[]; type?: 'text' | 'markdown' }) {
    let messageId: string | undefined;
    for (let i = 0; i < p.chunks.length; i++) {
      const complete = i === p.chunks.length - 1;
      const r: any = await call('/v4/direct-channel/message/stream/send', {
        fromUserId: p.from,
        toUserId: p.to,
        messageType: 'RC:StreamMsg',
        content: {
          content: p.chunks[i],
          seq: i + 1,
          complete,
          ...(i === 0 ? { type: p.type || 'text' } : { messageId }),
        },
      });
      messageId = messageId || r?.result?.messageId || r?.result?.messageUID || r?.messageId;
      if (!complete) await new Promise((res) => setTimeout(res, 60));
    }
  },

  createGroup(p: { groupId: string; name: string; owner: string; members: string[] }) {
    return call('/v4/group-channel/create', {
      channelId: p.groupId,
      name: p.name.slice(0, 64),
      owner: p.owner,
      userIds: p.members.filter((m) => m !== p.owner).slice(0, 30),
      permissions: { joinPerm: 1, memInvitePerm: 2 },
    });
  },

  joinGroup(groupId: string, userIds: string[]) {
    return call('/v4/group-channel/join', { channelId: groupId, userIds });
  },
};
