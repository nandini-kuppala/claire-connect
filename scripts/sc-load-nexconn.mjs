#!/usr/bin/env node
// Stress test with real Nexconn chat connections (LOCAL dev server + dev DB for the app; Nexconn's own cloud for chat).
//   node scripts/sc-load-nexconn.mjs [workers=30] [seconds=90]
// Parent: makes sure 20 test businesses exist (9300000001–9300000020; the 11–20 are created here; nothing is deleted,
// nothing is added to the demo logins), flags them for Goods, then starts one child process per worker. Each child is
// one virtual user: it logs in, opens a Nexconn Web SDK connection (@nexconn/chat NCEngine, the same SDK the app uses),
// and for the whole run does the Goods mix over HTTP (60 % reads, 40 % writes) while sending a chat message into its
// Goods conversation with its partner every few seconds. Partners time delivery (send → onMessageReceived).
// 30 workers over 20 users = 10 owners on two devices at once (Nexconn allows multiple connections per user).
import { spawn, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const B = 'http://localhost:8787'; // local dev server only; never production
const CHILD = process.argv[2] === '--child';

async function call(method, path, body, tok) {
  const t0 = performance.now();
  try {
    const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
    const text = await r.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    return { s: r.status, d: data, ms: performance.now() - t0 };
  } catch (e) {
    return { s: 0, d: { error: String(e) }, ms: performance.now() - t0 };
  }
}
const login = async (phone) => (await call('POST', '/api/auth/verify', { phone, otp: '123456' })).d;

// ══ Child: one virtual user ═══════════════════════════════════════════════════════════════════════
if (CHILD) {
  const [, , , phone, partnerId, seconds, wid] = process.argv;
  // Browser globals the Web SDK expects.
  const store = new Map();
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  Object.assign(globalThis, { window: globalThis, self: globalThis, localStorage: ls, sessionStorage: ls });
  globalThis.document ??= { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible', hidden: false, createElement: () => ({}), cookie: '' };
  globalThis.location ??= { href: 'http://localhost:5173/', protocol: 'http:', host: 'localhost:5173', hostname: 'localhost', origin: 'http://localhost:5173' };
  globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
  class XHR {
    constructor() { this.readyState = 0; this.status = 0; this.responseText = ''; this.response = ''; this.headers = {}; this.timeout = 0; this.withCredentials = false; this.responseType = ''; this._res = {}; }
    open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    getAllResponseHeaders() { return Object.entries(this._res).map(([k, v]) => `${k}: ${v}`).join('\r\n'); }
    getResponseHeader(k) { return this._res[String(k).toLowerCase()] ?? null; }
    abort() { this._aborted = true; this.ctrl?.abort(); }
    send(body) {
      this.ctrl = new AbortController();
      const t = this.timeout ? setTimeout(() => { this.ctrl.abort(); this.ontimeout?.(); }, this.timeout) : null;
      fetch(this.url, { method: this.method, headers: this.headers, body: body ?? undefined, signal: this.ctrl.signal })
        .then(async (r) => { this.status = r.status; r.headers.forEach((v, k) => { this._res[k] = v; }); this.responseText = await r.text(); this.response = this.responseType === 'json' ? JSON.parse(this.responseText || 'null') : this.responseText; this.readyState = 4; if (t) clearTimeout(t); this.onreadystatechange?.(); this.onload?.(); this.onloadend?.(); })
        .catch((e) => { if (t) clearTimeout(t); if (this._aborted) return; this.readyState = 4; this.status = 0; this.onreadystatechange?.(); this.onerror?.(e); this.onloadend?.(); });
    }
  }
  globalThis.XMLHttpRequest = XHR;
  // Browsers hand binary frames to the SDK as ArrayBuffers; Node's WebSocket defaults to Blob, which the SDK's
  // protobuf decoder can't read ("pb decode error … Illegal buffer").
  const NodeWS = globalThis.WebSocket;
  globalThis.WebSocket = class extends NodeWS { constructor(...a) { super(...a); this.binaryType = 'arraybuffer'; } };
  const { NCEngine, AreaCode, GroupChannel, SendTextMessageParams, MessageHandler, ConnectionStatusHandler } = await import('../node_modules/@nexconn/chat/index.mjs');

  let runStart = Date.now() + 3_600_000; // set when the run starts
  const out = { wid, phone, ops: {}, codes: {}, chat: { connectMs: null, connected: false, sent: 0, sendFail: 0, sendMs: [], received: 0, deliveryMs: [], drops: 0 } };
  const rec = (op, s, ms) => { (out.ops[op] ??= []).push(Math.round(ms)); const c = (out.codes[op] ??= {}); c[s] = (c[s] ?? 0) + 1; };
  const v = await login(phone);
  const tok = v.token;
  const me = v.user.business_id;
  const ids = await Promise.all(['mt_kit', 'mt_garment', 'mt_knit_fabric'].map((mt, i) => call('POST', '/api/sc/specs/resolve', { material_type_id: mt, attrs: i === 2 ? { state: 'finished', structure: 'single jersey', gsm: 180, colour: 'navy' } : { style: 'LT-1', colour: 'navy', size: 'M' } }, tok)));
  const [kit, gar, fab] = ids.map((r) => r.d.spec.id);
  const channelId = `goods_${[me, partnerId].sort().join('_')}`;

  // Chat: connect with the same SDK the app uses; count what arrives from the partner and how long it took.
  try {
    NCEngine.initialize({ appKey: v.chat.appKey, areaCode: AreaCode[(v.chat.area || 'SG').toUpperCase()] ?? AreaCode.SG });
    NCEngine.addConnectionStatusHandler('lt', new ConnectionStatusHandler({ onConnectionStatusChanged: ({ status }) => { if (status !== 0 && status !== 1 && out.chat.connected) out.chat.drops += 1; } }));
    NCEngine.addMessageHandler('lt', new MessageHandler({
      onMessageReceived({ messages }) {
        for (const m of messages) {
          const text = m.content?.text ?? m.content?.content ?? '';
          const hit = /^lt\|(\d+)\|/.exec(String(text));
          // Only messages sent during this run count (older ones are pulled down as history when we connect).
          if (hit && Number(hit[1]) >= runStart) { out.chat.received += 1; out.chat.deliveryMs.push(Date.now() - Number(hit[1])); }
        }
      },
    }));
    const t0 = performance.now();
    const r = await NCEngine.connect({ token: v.chat.token });
    out.chat.connectMs = Math.round(performance.now() - t0);
    out.chat.connected = !!r.isOk;
    if (!r.isOk) out.chat.connectError = `${r.code} ${r.msg ?? ''}`;
  } catch (e) { out.chat.connectError = String(e); }

  const read = async () => {
    const [op, path] = [['GET home', '/api/sc/home'], ['GET out', '/api/sc/goods/out'], ['GET coming', '/api/sc/goods/coming'], ['GET in', '/api/sc/goods/in'], ['GET stock', '/api/sc/stock'], ['GET bills', '/api/sc/bills'], ['GET performance', '/api/sc/reports/performance'], ['GET ledger', `/api/sc/parties/b/${partnerId}/ledger`], ['GET conversations', '/api/conversations']][Math.floor(Math.random() * 9)];
    const r = await call('GET', path, undefined, tok); rec(op, r.s, r.ms);
  };
  const write = async () => {
    const x = Math.random();
    if (x < 0.3) {
      const r = await call('POST', '/api/sc/movements/send', { to: { k: 'b', id: partnerId }, process_key: 'stitching', lines: [{ spec_id: kit, qty: 10, unit: 'pcs' }], client_id: randomUUID(), allow_untracked: true, untracked_reason: 'load test' }, tok);
      rec('POST send', r.s, r.ms);
      if (r.s === 201) { const s2 = await call('POST', `/api/sc/movements/${r.d.movement.id}/share-now`, {}, tok); rec('POST share-now', s2.s, s2.ms); }
    } else if (x < 0.55) {
      const c = await call('GET', '/api/sc/goods/coming', undefined, tok); rec('GET coming', c.s, c.ms);
      for (const t of (c.d.toConfirm ?? []).filter((y) => y.role === 'receiver').slice(0, 2)) {
        const r = await call('POST', `/api/sc/movements/${t.movementId}/confirm`, { lines: t.lines.map((l) => ({ line_id: l.line_id })) }, tok); rec('POST confirm', r.s, r.ms);
      }
    } else if (x < 0.75) {
      const o = await call('GET', '/api/sc/goods/out', undefined, tok); rec('GET out', o.s, o.ms);
      const jobs = (o.d.rows ?? []).flatMap((row) => row.jobs ?? []).filter((j) => (j.pending ?? 0) >= 10);
      if (jobs.length) { const j = jobs[Math.floor(Math.random() * jobs.length)]; const r = await call('POST', `/api/sc/jobs/${j.id}/return`, { lines: [{ spec_id: gar, qty: 10, unit: 'pcs' }], last: true, client_id: randomUUID() }, tok); rec('POST got back', r.s, r.ms); }
    } else if (x < 0.9) {
      const r = await call('POST', '/api/sc/movements/trade', { kind: 'sell', party: { k: 'b', id: partnerId }, lines: [{ spec_id: fab, qty: 5, unit: 'kg' }], rate_paise: 20000, client_id: randomUUID(), allow_untracked: true, untracked_reason: 'load test' }, tok); rec('POST sale', r.s, r.ms);
    } else {
      const r = await call('POST', '/api/sc/settlements', { party: { k: 'b', id: partnerId }, direction: 'paid', amount_paise: 10000, mode: 'upi', client_id: randomUUID() }, tok); rec('POST payment', r.s, r.ms);
    }
  };
  const chatSend = async () => {
    if (!out.chat.connected) return;
    const t0 = performance.now();
    try {
      const r = await new GroupChannel(channelId).sendMessage(new SendTextMessageParams({ text: `lt|${Date.now()}|${phone}|load test chat` }));
      if (r.isOk) { out.chat.sent += 1; out.chat.sendMs.push(Math.round(performance.now() - t0)); } else { out.chat.sendFail += 1; out.chat.lastSendError = `${r.code} ${r.msg ?? ''}`; }
    } catch (e) { out.chat.sendFail += 1; out.chat.lastSendError = String(e); }
  };

  process.send?.({ ready: true });
  await new Promise((res) => process.once('message', res)); // start together
  runStart = Date.now() - 1000;
  const until = Date.now() + Number(seconds) * 1000;
  let nextChat = Date.now() + Math.random() * 4000;
  while (Date.now() < until) {
    if (Date.now() >= nextChat) { await chatSend(); nextChat = Date.now() + 3000 + Math.random() * 2000; }
    await (Math.random() < 0.6 ? read() : write());
  }
  await new Promise((r) => setTimeout(r, 6000)); // let the last chat messages arrive
  out.chat.connected = out.chat.connected; const wasConnected = out.chat.connected; out.chat.connected = false; // our own disconnect is not a drop
  try { await NCEngine.disconnect?.(); } catch { /* best effort */ }
  out.chat.connected = wasConnected;
  process.send?.({ result: out });
  setTimeout(() => process.exit(0), 200);
} else {
  // ══ Parent ═════════════════════════════════════════════════════════════════════════════════════
  const WORKERS = Number(process.argv[2] || 30);
  const SECONDS = Number(process.argv[3] || 90);
  const phones = Array.from({ length: 20 }, (_, i) => `93000000${String(i + 1).padStart(2, '0')}`);
  const users = [];
  for (const [i, phone] of phones.entries()) {
    let v = await login(phone);
    if (!(v.user?.onboarded === 1 && v.user?.business_id)) {
      await call('POST', '/api/onboarding/complete', { draft: { owner_name: `Load ${i + 1}`, business_name: `Load Test Unit ${String(i + 1).padStart(2, '0')}`, city: 'Tiruppur', role_label: 'Garment maker', sells: [], buys: [] }, language: ['en', 'ta', 'hi'][i % 3] }, v.token);
      v = await login(phone);
    }
    users.push({ phone, id: v.user.business_id });
  }
  for (const u of users) execSync(`bash -lc 'cd /Users/dev/Desktop/claire && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npm run sc:flag -w server -- ${u.phone} on >/dev/null'`);
  // The flag can take a moment to show (it is cached server-side): wait until each business can open Goods.
  for (const u of users) {
    for (let i = 0; i < 40; i++) {
      const t = (await login(u.phone)).token;
      if ((await call('GET', '/api/sc/home', undefined, t)).s === 200) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  // Make sure each pair in the ring has a Goods conversation (it is created with the first shared record).
  for (const [i, u] of users.entries()) {
    const p = users[(i + 1) % users.length];
    const t = (await login(u.phone)).token;
    const k = (await call('POST', '/api/sc/specs/resolve', { material_type_id: 'mt_kit', attrs: { style: 'LT-1', colour: 'navy', size: 'M' } }, t)).d.spec.id;
    const r = await call('POST', '/api/sc/movements/send', { to: { k: 'b', id: p.id }, process_key: 'stitching', lines: [{ spec_id: k, qty: 10, unit: 'pcs' }], client_id: randomUUID(), allow_untracked: true, untracked_reason: 'load test' }, t);
    if (r.s === 201) await call('POST', `/api/sc/movements/${r.d.movement.id}/share-now`, {}, t);
  }
  console.log(`setup: ${users.length} businesses (${phones[0]}–${phones.at(-1)}), ${WORKERS} workers × ${SECONDS} s`);

  // Server sampling: CPU and memory of the API process, and /api/health (no database) every second.
  const pid = execSync('lsof -ti :8787 | head -1').toString().trim();
  const cpu = []; const health = [];
  let sampling = true;
  (async () => { while (sampling) { try { const [c, rss] = execSync(`ps -o %cpu=,rss= -p ${pid}`).toString().trim().split(/\s+/); cpu.push([Number(c), Number(rss) / 1024]); } catch { /* gone */ } const h = await call('GET', '/api/health'); health.push(h.ms); await new Promise((r) => setTimeout(r, 1000)); } })();

  const kids = [];
  const results = [];
  const crashes = [];
  for (let w = 0; w < WORKERS; w++) {
    const i = w % users.length;
    const kid = spawn(process.execPath, [new URL(import.meta.url).pathname, '--child', users[i].phone, users[(i + 1) % users.length].id, String(SECONDS), String(w)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let errTail = '';
    kid.stderr.on('data', (d) => { errTail = (errTail + d.toString()).slice(-4000); });
    kid.on('exit', (code) => { if (code) crashes.push({ w, code, err: errTail.split('\n').filter((l) => /Error|error/.test(l) && !/WARN/.test(l)).slice(-3).join(' | ').slice(0, 300) }); });
    kids.push(new Promise((res) => {
      kid.on('message', (m) => { if (m.result) results.push(m.result); if (m.ready) kid.ready = true; });
      kid.on('exit', () => res());
    }));
    kid.ref = kid;
    kids[w].kid = kid;
  }
  // Wait until every child is logged in and connected, then start together.
  const t0 = Date.now();
  while (kids.some((p) => !p.kid.ready) && Date.now() - t0 < 120_000) await new Promise((r) => setTimeout(r, 250));
  const start = Date.now();
  for (const p of kids) p.kid.send?.({ go: true });
  await Promise.all(kids);
  sampling = false;
  const elapsed = (Date.now() - start) / 1000;

  const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1)))] : 0; };
  const ops = {}; const codes = {};
  for (const r of results) for (const [op, xs] of Object.entries(r.ops)) { (ops[op] ??= []).push(...xs); for (const [c, n] of Object.entries(r.codes[op])) { (codes[op] ??= {})[c] = ((codes[op] ??= {})[c] ?? 0) + n; } }
  const all = Object.values(ops).flat();
  const total = all.length - 0;
  const chat = results.reduce((a, r) => ({ connected: a.connected + (r.chat.connected ? 1 : 0), connectMs: [...a.connectMs, ...(r.chat.connectMs ? [r.chat.connectMs] : [])], sent: a.sent + r.chat.sent, sendFail: a.sendFail + r.chat.sendFail, sendMs: [...a.sendMs, ...r.chat.sendMs], received: a.received + r.chat.received, deliveryMs: [...a.deliveryMs, ...r.chat.deliveryMs], drops: a.drops + r.chat.drops, errors: [...a.errors, ...(r.chat.connectError ? [r.chat.connectError] : []), ...(r.chat.lastSendError ? [r.chat.lastSendError] : [])] }), { connected: 0, connectMs: [], sent: 0, sendFail: 0, sendMs: [], received: 0, deliveryMs: [], drops: 0, errors: [] });
  const errs = Object.fromEntries(Object.entries(codes).map(([op, c]) => [op, Object.fromEntries(Object.entries(c).filter(([k]) => !['200', '201', '202'].includes(k)))]).filter(([, e]) => Object.keys(e).length));
  const summary = {
    workers: WORKERS, users: users.length, seconds: Math.round(elapsed), reports: results.length,
    http: { requests: total, rps: +(total / elapsed).toFixed(1), p50: pct(all, 50), p95: pct(all, 95), p99: pct(all, 99), max: Math.max(0, ...all), errors: errs },
    chat: { connections: `${chat.connected}/${WORKERS}`, connect_p50: pct(chat.connectMs, 50), connect_max: Math.max(0, ...chat.connectMs), sent: chat.sent, send_failures: chat.sendFail, send_p50: pct(chat.sendMs, 50), send_p95: pct(chat.sendMs, 95), received_by_partners: chat.received, delivery_p50: pct(chat.deliveryMs, 50), delivery_p95: pct(chat.deliveryMs, 95), delivery_max: Math.max(0, ...chat.deliveryMs), connection_drops: chat.drops, errors: [...new Set(chat.errors)].slice(0, 5) },
    server: { cpu_avg: +(cpu.reduce((a, [c]) => a + c, 0) / Math.max(1, cpu.length)).toFixed(1), cpu_max: Math.max(0, ...cpu.map(([c]) => c)), rss_max_mb: Math.round(Math.max(0, ...cpu.map(([, m]) => m))), health_p50: Math.round(pct(health, 50)), health_max: Math.round(Math.max(0, ...health)) },
    ops: Object.fromEntries(Object.entries(ops).sort().map(([op, xs]) => [op, { n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: Math.max(...xs), codes: codes[op] }])),
  };
  const v = execSync("bash -lc 'cd /Users/dev/Desktop/claire/server && source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npx tsx src/sc/verify.ts | tail -1'").toString().trim();
  summary.ledger = v;
  summary.crashed_workers = crashes;
  console.log(JSON.stringify(summary, null, 1));
  if (process.env.LOAD_OUT) writeFileSync(process.env.LOAD_OUT, JSON.stringify(summary, null, 1));
  process.exit(0);
}
