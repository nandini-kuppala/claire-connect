// Chat archive: every deal room and Goods conversation, one JSON file per conversation per day (IST), stored in
// Nexconn's file storage, with the file reference recorded in `chat_archives`.
//
// Sources, merged by message id (the same message from two sources is kept once):
//   1. Nexconn's cloud history of the group, read through the Web SDK as the Claire bot (a member of every deal and
//      Goods group). This is the only place client-sent messages that skip our server (voice notes, call summaries,
//      card replies) exist. The Platform Chat API has no group history query, hence the SDK.
//   2. The server's own copy (`chat_archive`): its sends, the client notify path and the `message:send` webhook. It
//      also holds Claire's targeted tips, which only their recipients can see in Nexconn.
//   3. The previous version of the same day's file, so a re-run only ever appends (newest last), even if a source
//      no longer returns an older message.
//
// Storage: Nexconn's file storage has no server API, so the Web SDK's uploader runs in a worker process
// (nexconn-node/worker.mjs). Download URLs are not authenticated, so each file is encrypted (AES-256-GCM) with a key
// derived from CHAT_ARCHIVE_KEY (or JWT_SECRET); the URL alone reveals nothing. If the upload fails, the file is
// written to server/data/chat-archives (git-ignored, never served) and the record says storage 'local'.
// A day whose content is unchanged since the last run is not uploaded again.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOT, cfg, features } from './config.js';
import { col, find } from './db/index.js';
import { runSdkWorker, type SdkHistoryMessage } from './nexconn-node/client.js';

const IST_MS = 5.5 * 3600_000;
const KINDS = ['deal', 'combo', 'goods'];
const LOCAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/chat-archives');
const MAX_VERSIONS = 10;

/** 'YYYY-MM-DD' in India time for a timestamp. */
export const istDay = (t = Date.now()) => new Date(t + IST_MS).toISOString().slice(0, 10);
/** [start, end) of an IST day in epoch ms. */
export function dayRange(day: string): [number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Bad day "${day}" (want YYYY-MM-DD)`);
  const start = Date.parse(`${day}T00:00:00Z`) - IST_MS;
  return [start, start + 86_400_000];
}

// ── Encryption ──────────────────────────────────────────────────────────────
function archiveKey(): Buffer {
  const secret = process.env.CHAT_ARCHIVE_KEY || cfg.jwtSecret;
  return Buffer.from(crypto.hkdfSync('sha256', secret, 'claire-chat-archive', 'v1', 32));
}
const keyId = () => crypto.createHash('sha256').update(archiveKey()).digest('hex').slice(0, 8);

function seal(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', archiveKey(), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from('CCA1'), iv, c.getAuthTag(), body]);
}

function open(sealed: Buffer): Buffer {
  if (sealed.subarray(0, 4).toString() !== 'CCA1') throw new Error('Not a CLAIRE chat archive');
  const iv = sealed.subarray(4, 16);
  const tag = sealed.subarray(16, 32);
  const d = crypto.createDecipheriv('aes-256-gcm', archiveKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(sealed.subarray(32)), d.final()]);
}

// ── Shape ───────────────────────────────────────────────────────────────────
export interface ArchiveMessage {
  id: string;
  at: number;
  iso: string;
  senderId: string;
  senderName: string;
  type: string;
  /** Plain text for text-like messages (text, stream, hint, reply label, voice transcript). */
  text: string | null;
  /** Full payload for cards, calls, voice notes and other custom messages. */
  payload: unknown;
  /** Set when only some members could see it (Claire's targeted tips). */
  directedTo: string[] | null;
  source: string[];
}

export interface ArchiveFile {
  format: 'claire-chat-archive';
  version: 1;
  day: string;
  timezone: 'Asia/Kolkata';
  conversation: { id: string; channelId: string; kind: string; title: string; businessIds: string[]; members: { userId: string; name: string; business: string | null }[] };
  generatedAt: string;
  messageCount: number;
  messages: ArchiveMessage[];
}

const parse = (v: unknown) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

function normalise(type: string, raw: unknown): { text: string | null; payload: unknown } {
  let c: any = parse(raw);
  if (c && typeof c === 'object' && Object.keys(c).length === 1 && typeof c.content === 'string' && type.startsWith('CC:')) c = parse(c.content);
  if (typeof c === 'string') return { text: c, payload: null };
  c = c ?? {};
  if (type === 'RC:TxtMsg' || type === 'RC:StreamMsg') return { text: String(c.text ?? c.content ?? ''), payload: null };
  if (type === 'CC:Hint') return { text: String(c.text ?? ''), payload: c };
  if (type === 'CC:Reply') return { text: String(c.label ?? ''), payload: c };
  if (type === 'CC:Voice') return { text: c.transcript ? String(c.transcript) : null, payload: c };
  return { text: typeof c.text === 'string' ? c.text : null, payload: c };
}

// ── Job ─────────────────────────────────────────────────────────────────────
export interface ArchiveRunResult {
  day: string;
  conversations: number;
  uploaded: number;
  unchanged: number;
  empty: number;
  local: number;
  failed: { channelId: string; error: string }[];
  historySource: 'nexconn' | 'server-only';
  records: { id: string; channelId: string; messages: number; storage: string; url: string | null; changed: boolean }[];
}

/**
 * Archives one IST day (default today) for every deal / Goods conversation with activity that day, or only for
 * `conversationIds`. Safe to run repeatedly: unchanged days are skipped, changed days get a new file (append-only).
 */
export async function runChatArchive(opts: { day?: string; conversationIds?: string[] } = {}): Promise<ArchiveRunResult> {
  const day = opts.day ?? istDay();
  const [since, until] = dayRange(day);
  const filter: any = { kind: { $in: KINDS } };
  if (opts.conversationIds?.length) filter.id = { $in: opts.conversationIds };
  else {
    const active = await col('chat_archive').distinct('channel_id', { sent_at: { $gte: since, $lt: until } } as any);
    filter.$or = [{ last_at: { $gte: since } }, { updated_at: { $gte: since } }, { channel_id: { $in: active } }];
  }
  const convs = await find('conversations', filter, { projection: { id: 1, channel_id: 1, kind: 1, title: 1, business_ids: 1, user_ids: 1 } });
  const result: ArchiveRunResult = { day, conversations: convs.length, uploaded: 0, unchanged: 0, empty: 0, local: 0, failed: [], historySource: 'server-only', records: [] };
  if (!convs.length) return result;

  // 1. Nexconn cloud history, one SDK session for all conversations.
  const cloud = new Map<string, SdkHistoryMessage[]>();
  if (features.nexconn) {
    try {
      const res = await runSdkWorker(BOT.claire, 'Claire', convs.map((c) => ({ op: 'history' as const, channelId: c.channel_id, since, until })));
      res.forEach((r, i) => r.ok && cloud.set(convs[i].channel_id, r.messages ?? []));
      result.historySource = 'nexconn';
    } catch (err) {
      console.warn('[archive] Nexconn history unavailable, using the server copy only:', (err as Error).message);
    }
  }

  // Names for senders.
  const userIds = [...new Set(convs.flatMap((c) => c.user_ids ?? []))];
  const users = await find('users', { _id: { $in: userIds } }, { projection: { name: 1, business_id: 1 } });
  const bizIds = [...new Set([...users.map((u) => u.business_id), ...convs.flatMap((c) => c.business_ids ?? [])].filter(Boolean))];
  const biz = new Map((await find('businesses', { _id: { $in: bizIds } }, { projection: { name: 1 } })).map((b) => [b._id, b.name as string]));
  const names = new Map<string, { name: string; business: string | null }>(users.map((u) => [u._id as string, { name: u.name ?? '', business: biz.get(u.business_id) ?? null }]));
  for (const [id, name] of [[BOT.claire, 'Claire'], [BOT.updates, 'CLAIRE Updates'], [BOT.desk, 'CLAIRE Trade Desk']]) names.set(id, { name, business: null });

  const toUpload: { conv: any; data: ArchiveFile; sealed: Buffer; sha: string; prev: any }[] = [];
  for (const conv of convs) {
    try {
      const recId = `${conv.channel_id}:${day}`;
      const prev = await col('chat_archives').findOne({ _id: recId } as any);
      const merged = new Map<string, ArchiveMessage>();
      const add = (m: { id: string; senderId: string; type: string; content: unknown; sentAt: number; directed: string[] | null }, source: string) => {
        if (!m.id) return;
        const have = merged.get(m.id);
        if (have) {
          if (!have.source.includes(source)) have.source.push(source);
          return;
        }
        const { text, payload } = normalise(m.type, m.content);
        merged.set(m.id, {
          id: m.id, at: m.sentAt, iso: new Date(m.sentAt).toISOString(), senderId: m.senderId, senderName: names.get(m.senderId)?.name ?? m.senderId,
          type: m.type, text, payload, directedTo: m.directed?.length ? m.directed : null, source: [source],
        });
      };
      for (const m of cloud.get(conv.channel_id) ?? []) add(m, 'nexconn');
      const local = await find('chat_archive', { channel_id: conv.channel_id, sent_at: { $gte: since, $lt: until } }, { sort: { sent_at: 1 } });
      // Rows the server stored before it knew Nexconn's message id ('srv_…') are the same message as the cloud copy
      // with the same sender, type and content within a few seconds: keep one.
      const fp = (m: { senderId: string; type: string; text: string | null; payload: unknown }) => `${m.senderId}|${m.type}|${m.text ?? ''}|${JSON.stringify(m.payload ?? null)}`;
      const cloudByFp = new Map<string, ArchiveMessage[]>();
      for (const m of merged.values()) if (!m.id.startsWith('srv_')) cloudByFp.set(fp(m), [...(cloudByFp.get(fp(m)) ?? []), m]);
      for (const r of local) {
        if (String(r.id).startsWith('srv_')) {
          const { text, payload } = normalise(r.type, r.content);
          const twin = (cloudByFp.get(fp({ senderId: r.sender_id, type: r.type, text, payload })) ?? []).find((m) => Math.abs(m.at - r.sent_at) < 10_000);
          if (twin) {
            if (!twin.source.includes('server')) twin.source.push('server');
            if (!twin.directedTo && r.directed?.length) twin.directedTo = r.directed;
            merged.delete(r.id);
            continue;
          }
        }
        add({ id: r.id, senderId: r.sender_id, type: r.type, content: r.content, sentAt: r.sent_at, directed: r.directed }, 'server');
      }

      // Nothing new since the last version (every id already in it): skip without downloading the old file.
      const prevIds = new Set<string>(prev?.message_ids ?? []);
      if (prev && merged.size && [...merged.keys()].every((k) => prevIds.has(k))) {
        result.unchanged++;
        result.records.push({ id: recId, channelId: conv.channel_id, messages: prev.message_count, storage: prev.storage, url: prev.file?.url ?? null, changed: false });
        continue;
      }
      // Append-only: the previous version's entries are kept as they were; new ones join them.
      if (prev) {
        const old = await readArchiveFile(prev).catch(() => null);
        for (const m of old?.messages ?? []) {
          // A server row ('srv_…') that now has its Nexconn twin was merged into it above: don't bring it back.
          const twinned = m.id.startsWith('srv_') && !merged.has(m.id) && local.some((r) => r.id === m.id);
          if (!twinned) merged.set(m.id, m);
        }
      }
      const messages = [...merged.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
      if (!messages.length) {
        result.empty++;
        continue;
      }
      const sha = crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex');
      if (prev?.sha256 === sha) {
        result.unchanged++;
        result.records.push({ id: recId, channelId: conv.channel_id, messages: messages.length, storage: prev.storage, url: prev.file?.url ?? null, changed: false });
        continue;
      }
      const data: ArchiveFile = {
        format: 'claire-chat-archive', version: 1, day, timezone: 'Asia/Kolkata',
        conversation: {
          id: conv.id, channelId: conv.channel_id, kind: conv.kind, title: conv.title ?? '', businessIds: conv.business_ids ?? [],
          members: (conv.user_ids ?? []).map((u: string) => ({ userId: u, name: names.get(u)?.name ?? u, business: names.get(u)?.business ?? null })),
        },
        generatedAt: new Date().toISOString(), messageCount: messages.length, messages,
      };
      toUpload.push({ conv, data, sealed: seal(Buffer.from(JSON.stringify(data))), sha, prev });
    } catch (err) {
      result.failed.push({ channelId: conv.channel_id, error: (err as Error).message });
    }
  }

  // 2. Upload every changed day in one SDK session; fall back to local files.
  let uploads: ({ url: string; key: string; size: number } | null)[] = toUpload.map(() => null);
  if (toUpload.length && features.nexconn) {
    try {
      const res = await runSdkWorker(
        BOT.claire,
        'Claire',
        toUpload.map((u) => ({ op: 'upload' as const, name: `chat-${u.conv.channel_id}-${day}.cca`, base64: u.sealed.toString('base64') })),
        180_000,
      );
      uploads = res.map((r) => (r.ok && r.file ? { url: r.file.url, key: r.file.key, size: r.file.size } : null));
    } catch (err) {
      console.warn('[archive] Nexconn upload unavailable, writing local files:', (err as Error).message);
    }
  }

  for (let i = 0; i < toUpload.length; i++) {
    const { conv, data, sealed, sha, prev } = toUpload[i];
    const recId = `${conv.channel_id}:${day}`;
    try {
      let file: { url: string | null; key: string; size: number };
      let storage: 'nexconn' | 'local';
      if (uploads[i]) {
        file = uploads[i]!;
        storage = 'nexconn';
        result.uploaded++;
      } else {
        await fs.mkdir(path.join(LOCAL_DIR, day), { recursive: true });
        const key = path.join(day, `${conv.channel_id}-${Date.now()}.cca`);
        await fs.writeFile(path.join(LOCAL_DIR, key), sealed);
        file = { url: null, key, size: sealed.length };
        storage = 'local';
        result.local++;
      }
      const at = Date.now();
      const versions = prev ? [{ storage: prev.storage, file: prev.file, sha256: prev.sha256, message_count: prev.message_count, uploaded_at: prev.uploaded_at }, ...(prev.versions ?? [])].slice(0, MAX_VERSIONS) : [];
      await col('chat_archives').updateOne(
        { _id: recId } as any,
        {
          $set: {
            id: recId, conversation_id: conv.id, channel_id: conv.channel_id, kind: conv.kind, day, business_ids: conv.business_ids ?? [], user_ids: conv.user_ids ?? [],
            storage, file, encryption: { alg: 'aes-256-gcm', key_id: keyId() }, sha256: sha, message_count: data.messageCount, message_ids: data.messages.map((m) => m.id),
            first_at: data.messages[0].at, last_at: data.messages[data.messages.length - 1].at, uploaded_at: at, versions,
          },
          $setOnInsert: { created_at: at },
        },
        { upsert: true },
      );
      result.records.push({ id: recId, channelId: conv.channel_id, messages: data.messageCount, storage, url: file.url, changed: true });
    } catch (err) {
      result.failed.push({ channelId: conv.channel_id, error: (err as Error).message });
    }
  }
  await col('chat_archives').createIndex({ conversation_id: 1, day: -1 }).catch(() => undefined);
  return result;
}

// ── Reading back ────────────────────────────────────────────────────────────
/** Fetches (Nexconn URL or local file), decrypts and verifies one archive record's file. */
export async function readArchiveFile(rec: any): Promise<ArchiveFile> {
  let sealed: Buffer;
  if (rec.storage === 'nexconn') {
    const r = await fetch(rec.file.url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Nexconn file storage answered ${r.status}`);
    sealed = Buffer.from(await r.arrayBuffer());
  } else {
    const p = path.resolve(LOCAL_DIR, rec.file.key);
    if (!p.startsWith(LOCAL_DIR + path.sep)) throw new Error('Bad archive path');
    sealed = await fs.readFile(p);
  }
  const data = JSON.parse(open(sealed).toString('utf8')) as ArchiveFile;
  const sha = crypto.createHash('sha256').update(JSON.stringify(data.messages)).digest('hex');
  if (rec.sha256 && sha !== rec.sha256) throw new Error('Archive checksum mismatch');
  return data;
}

export async function listArchives(conversationId: string, limit = 60) {
  return find('chat_archives', { conversation_id: conversationId }, { sort: { day: -1 }, limit, projection: { versions: 0, message_ids: 0 } });
}

/** Starts the archive on a timer when CHAT_ARCHIVE_EVERY_MIN is set (off by default). Runs today's IST day. */
export function startArchiveTicker() {
  const every = Number(process.env.CHAT_ARCHIVE_EVERY_MIN || 0);
  if (!every || every < 5) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // Early in the IST day, finish yesterday too (messages after the last run before midnight).
      const days = Date.now() - dayRange(istDay())[0] < every * 60_000 * 2 ? [istDay(Date.now() - 86_400_000), istDay()] : [istDay()];
      for (const day of days) {
        const r = await runChatArchive({ day });
        console.log(`[archive] ${r.day}: ${r.uploaded} uploaded, ${r.unchanged} unchanged, ${r.local} local, ${r.failed.length} failed`);
      }
    } catch (err) {
      console.warn('[archive] run failed', (err as Error).message);
    } finally {
      running = false;
    }
  };
  setInterval(tick, every * 60_000).unref();
  console.log(`[archive] chat archive every ${every} min`);
}
