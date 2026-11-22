#!/usr/bin/env node
// Runs the Nexconn Web SDK (@nexconn/chat) headless in its own Node process, for the server jobs that the
// Platform Chat API can't do:
//   - read a group channel's cloud history (the REST API has no group history query), and
//   - upload a file to Nexconn's file storage (the SDK's own uploader; the REST API has no upload endpoint).
// The API server spawns it (server/src/nexconn-node/client.ts) so the browser shims never touch the server process.
//
// Protocol: one JSON object on stdin, one `@@RESULT@@{json}` line on stdout.
//   in:  { appKey, area, token, ops: [ {op:'history', channelId, since, until, max?} | {op:'upload', name, base64, mime?} ] }
//   out: { ok, userId, results: [ {ok, messages?|file?, code?, error?} ] }
import { loadChatSdk } from './shims.mjs';

// The SDK logs to the console; keep stdout for the result line only.
const realLog = console.log.bind(console);
console.log = (...a) => console.error(...a);
console.info = (...a) => console.error(...a);

const done = (obj) => {
  realLog(`@@RESULT@@${JSON.stringify(obj)}`);
  setTimeout(() => process.exit(0), 50);
};

let input = '';
for await (const chunk of process.stdin) input += chunk;
const job = JSON.parse(input || '{}');
const killer = setTimeout(() => done({ ok: false, error: 'worker timeout' }), Number(job.timeoutMs) || 120_000);

try {
  const sdk = await loadChatSdk();
  const { NCEngine, AreaCode, BaseChannel, GroupChannel, Helper } = sdk;
  NCEngine.initialize({ appKey: job.appKey, areaCode: AreaCode[(job.area || 'SG').toUpperCase()] ?? AreaCode.SG, logOutputLevel: 4 });
  const c = await NCEngine.connect({ token: job.token });
  if (!c.isOk) {
    clearTimeout(killer);
    done({ ok: false, error: `connect failed (${c.code})`, code: c.code });
  } else {
    const results = [];
    for (const op of job.ops ?? []) {
      try {
        if (op.op === 'history') results.push(await history(op));
        else if (op.op === 'upload') results.push(await upload(op));
        else results.push({ ok: false, error: `unknown op ${op.op}` });
      } catch (err) {
        results.push({ ok: false, error: String(err?.message ?? err) });
      }
    }
    await NCEngine.disconnect().catch(() => undefined);
    clearTimeout(killer);
    done({ ok: true, userId: c.data?.userId, results });
  }

  /** Messages in [since, until), oldest first, paging back from `until` (pages of 30, the SDK's sweet spot). */
  async function history({ channelId, since = 0, until = Date.now(), max = 2000 }) {
    const identifier = new GroupChannel(channelId).identifier;
    const out = [];
    let start = until;
    for (let page = 0; page < Math.ceil(max / 30); page++) {
      const q = BaseChannel.createMessagesQuery({ channelIdentifier: identifier, startTime: start, pageSize: 30, isAscending: false });
      const r = await q.loadNextPage();
      if (!r.isOk) return { ok: false, code: r.code, error: `history failed (${r.code})`, messages: out };
      const rows = r.data?.data ?? [];
      for (const m of rows) {
        if (m.sentTime < since || m.sentTime >= until) continue;
        out.push({
          id: m.messageId,
          senderId: m.senderUserId,
          type: m.messageType,
          content: m.content,
          sentAt: m.sentTime,
          directed: Array.isArray(m.directedUserIds) && m.directedUserIds.length ? m.directedUserIds : null,
        });
      }
      const oldest = rows.reduce((t, m) => Math.min(t, m.sentTime || t), start);
      if (rows.length < 30 || oldest < since || oldest >= start) break;
      start = oldest;
    }
    const seen = new Set();
    return { ok: true, messages: out.filter((m) => !seen.has(m.id) && seen.add(m.id)).sort((a, b) => a.sentAt - b.sentAt) };
  }

  async function upload({ name, base64, mime = 'application/octet-stream' }) {
    const file = new File([Buffer.from(base64, 'base64')], name, { type: mime });
    const up = Helper.FileUploader.create({ file, fileType: Helper.FileType.FILE, contentDisposition: 'attachment' });
    if (!up.isOk) return { ok: false, code: up.code, error: `uploader failed (${up.code})` };
    const r = await up.data.result();
    if (!r.isOk || !r.data?.downloadUrl) return { ok: false, code: r.code, error: `upload failed (${r.code})` };
    return { ok: true, file: { url: r.data.downloadUrl, key: r.data.uniqueName, name: r.data.name, size: r.data.size } };
  }
} catch (err) {
  clearTimeout(killer);
  done({ ok: false, error: String(err?.message ?? err) });
}
