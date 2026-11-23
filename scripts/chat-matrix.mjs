#!/usr/bin/env node
// Chat matrix: every test account talks to every account it shares a conversation with, over real Nexconn
// connections, all pairs at once. LOCAL dev only: API http://localhost:8787 on the dev DB; Nexconn's cloud for chat.
//   node scripts/chat-matrix.mjs [--wait=30] [--verbose]
//
// 1. One child process per account (the Web SDK is one engine per process): log in (OTP 123456), list
//    GET /api/conversations, connect the Nexconn Web SDK headless (server/src/nexconn-node/shims.mjs).
// 2. Pairs = accounts whose inboxes share a deal room or Goods conversation (one check per pair per conversation).
//    Each side sends one message the way the app does (GroupChannel.sendMessage, then POST /api/deals/:id/inbound),
//    all sends at once; the other side must get it (onMessageReceived from the right sender). Delivery = send → receive.
// 3. Translation: for pairs whose app languages differ, the receiver translates what it got with the app's own code,
//    web/src/chat/translate.ts translateItems (Nexconn translateTexts first, numbers checked, then the server's
//    POST /api/translate), built like ChatView's request. Each message is written in the sender's language.
//    Also checked: the counterpart language each inbox row carries (what ChatView decides on) equals the language
//    the counterpart's owner actually uses.
// 4. Moderation: a few pairs also send a mask word and a block word (shared/moderation.ts probes): the receiver must
//    get the masked text and never the blocked one; the sender's SDK must fire onMessageBlocked; the server notify path
//    must answer blocked; the composer check (moderateText) must flag both.
// Prints no secrets: no tokens, no App Key (server/.env is never read here).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const B = 'http://localhost:8787'; // local dev server only; never production
const SELF = fileURLToPath(import.meta.url);
const ROOT = join(dirname(SELF), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const VERBOSE = argv.includes('--verbose');

async function call(method, path, body, tok) {
  const t0 = performance.now();
  try {
    const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
    const text = await r.text();
    let d = {};
    try { d = text ? JSON.parse(text) : {}; } catch { d = { raw: text.slice(0, 200) }; }
    return { s: r.status, d, ms: performance.now() - t0 };
  } catch (e) {
    return { s: 0, d: { error: String(e) }, ms: performance.now() - t0 };
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One trade line per language, with a quantity so the translation's number check has something to verify.
const LINES = {
  en: (n) => `Sending ${n} pieces of the navy kit tomorrow morning.`,
  ta: (n) => `நாளை காலை ${n} துண்டுகள் அனுப்புகிறேன்.`,
  hi: (n) => `कल सुबह ${n} पीस भेज दूंगा।`,
  te: (n) => `రేపు ఉదయం ${n} ముక్కలు పంపుతాను.`,
  bn: (n) => `কাল সকালে ${n} পিস পাঠিয়ে দেব।`,
};
const line = (lang, n) => (LINES[lang] ?? LINES.en)(n);
const TAG = /^\[cm-([a-z0-9]+)-([a-z0-9]+)\] ?/;

// ══ Child: one account ════════════════════════════════════════════════════════════════════════════
if (argv[0] === '--child') {
  const phone = argv[1];
  const run = argv[2];
  const send = (m) => process.send?.(m);
  try {
    const { loadChatSdk } = await import('../server/src/nexconn-node/shims.mjs');
    const sdk = await loadChatSdk();
    const { NCEngine, AreaCode, GroupChannel, SendTextMessageParams, MessageHandler, TranslateHandler, ConnectionStatusHandler } = sdk;
    // The app's api client calls relative URLs ('/api/translate'); in Node they go to the local server. Server
    // translation calls are noted so each result can be credited to the engine that produced it.
    const serverTranslated = new Set();
    const nodeFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        if (url === '/api/translate' && init?.body) for (const t of JSON.parse(init.body).texts ?? []) serverTranslated.add(t);
        url = B + url;
      }
      return nodeFetch(url, init);
    };
    const v = (await call('POST', '/api/auth/verify', { phone, otp: '123456' })).d;
    if (!v?.token || !v.chat?.token) throw new Error(`login failed for ${phone}`);
    localStorage.setItem('cc_token', v.token); // what the app's api client reads
    const inbox = (await call('GET', '/api/conversations', undefined, v.token)).d;
    const convs = (Array.isArray(inbox) ? inbox : inbox.conversations ?? []).map((c) => ({ id: c.id, kind: c.kind, channelId: c.channelId, counterpart: c.counterpart ? { id: c.counterpart.id ?? null, language: c.counterpart.language ?? null } : null }));
    // The app's translation module and moderation list (TypeScript, loaded through tsx with web/tsconfig.json paths).
    const tr = await import('../web/src/chat/translate.ts');
    const { moderateText } = await import('../shared/moderation.ts');
    if ((await import('@nexconn/chat')).NCEngine !== NCEngine) throw new Error('two copies of @nexconn/chat loaded');

    const me = v.user.id;
    const seen = new Set();
    const blocked = new Map();
    let drops = 0;
    let connected = false;
    NCEngine.initialize({ appKey: v.chat.appKey, areaCode: AreaCode[(v.chat.area || 'SG').toUpperCase()] ?? AreaCode.SG, logOutputLevel: 4 });
    NCEngine.addConnectionStatusHandler('cm', new ConnectionStatusHandler({ onConnectionStatusChanged: ({ status }) => { if (connected && status !== 0 && status !== 1) drops += 1; } }));
    NCEngine.addMessageHandler('cm', new MessageHandler({
      onMessageReceived({ messages }) {
        const at = Date.now();
        for (const m of messages) {
          const text = String(m.content?.text ?? m.content?.content ?? '');
          const hit = TAG.exec(text);
          if (!hit || hit[1] !== run || m.senderUserId === me) continue;
          const dup = seen.has(m.messageId);
          seen.add(m.messageId);
          send({ op: 'recv', key: hit[2], at, id: m.messageId, from: m.senderUserId, channelId: m.channelIdentifier?.channelId ?? m.channelIdentifier?.targetId ?? null, text: text.replace(TAG, ''), dup });
        }
      },
      onMessageBlocked({ info }) {
        blocked.set(info.messageId, Number(info.blockType) || 0);
        send({ op: 'blocked', id: info.messageId, blockType: Number(info.blockType) || 0 });
      },
    }));
    // Raw Nexconn translateTexts answers, so a server-answered item can say why Nexconn's was not used.
    const ncRaw = new Map();
    NCEngine.addTranslateHandler('cm', new TranslateHandler({
      onTranslationCompleted: ({ results }) => {
        for (const x of results) if (x.sourceType === sdk.TranslateSourceType.CUSTOM_TEXT) ncRaw.set(x.identifier, { code: x.code, text: x.translateInfo?.translatedText ?? null });
        tr.handleTranslationResults(results);
      },
    }));
    const t0 = performance.now();
    const r = await NCEngine.connect({ token: v.chat.token });
    const connectMs = Math.round(performance.now() - t0);
    connected = !!r.isOk;
    if (connected) {
      // Same as web/src/chat/engine.ts after connect.
      tr.setNexconnTranslateReady(true);
      NCEngine.translateModule.setTranslationLanguage(v.user.language || 'en').catch(() => undefined);
      NCEngine.translateModule.setAutoTranslateEnabled(true).catch(() => undefined);
    }
    send({ op: 'ready', phone, userId: me, businessId: v.user.business_id ?? null, name: v.user.name, lang: v.user.language || 'en', role: v.user.role, convs, connected, connectMs, connectError: connected ? null : `code ${r.code}` });

    process.on('message', async (msg) => {
      if (msg.op === 'go') {
        // All of this account's sends at once; the parent starts every account together.
        // Nexconn allows a client about 5 sends a second (20604 SEND_FREQUENCY_TOO_FAST): an account with more
        // conversations sends them in waves of 5, one second apart, and retries once if it is still told to slow down.
        const out = await Promise.all(msg.sends.map(async (s, i) => {
          await sleep(Math.floor(i / 5) * 1100);
          const res = { key: s.key, t0: Date.now() };
          try {
            let sr = await new GroupChannel(s.channelId).sendMessage(new SendTextMessageParams({ text: s.text }));
            if (!sr.isOk && sr.code === 20604) {
              res.rateLimited = true;
              await sleep(1200);
              res.t0 = Date.now();
              sr = await new GroupChannel(s.channelId).sendMessage(new SendTextMessageParams({ text: s.text }));
            }
            res.sendMs = Date.now() - res.t0;
            res.ok = !!sr.isOk;
            if (sr.isOk) res.id = sr.data?.messageId;
            else res.error = `code ${sr.code}${sr.code === 20604 ? ' SEND_FREQUENCY_TOO_FAST' : ''}`;
          } catch (e) {
            res.ok = false;
            res.error = String(e).slice(0, 160);
          }
          if (res.ok) {
            // The app's notify path after a successful send (ChatView → POST /api/deals/:id/inbound).
            const n = await call('POST', `/api/deals/${s.convId}/inbound`, { text: s.text, messageId: res.id, lang: v.user.language }, v.token);
            res.notify = { s: n.s, blocked: n.d?.blocked === true, error: n.s >= 400 ? n.d?.error ?? n.d?.raw ?? '' : undefined };
          }
          if (s.moderation) res.composer = moderateText(s.text).action;
          return res;
        }));
        send({ op: 'sent', results: out });
      }
      if (msg.op === 'translate') {
        // Built like ChatView.translationRequest: source = the text's script language, kind 'message' for a text
        // message with a server id; one batch per open chat, so one translateItems call per conversation.
        const byConv = new Map();
        for (const q of msg.items) (byConv.get(q.convId) ?? byConv.set(q.convId, []).get(q.convId)).push(q);
        const results = [];
        await Promise.all([...byConv.values()].map(async (items) => {
          const reqs = items.map((q) => {
            const from = tr.scriptLang(q.text, q.senderLang) ?? 'auto';
            return { q, req: { id: q.id, text: q.text, from: from === 'auto' ? undefined : from, kind: 'message' }, skip: from === msg.to };
          });
          const t1 = performance.now();
          const map = await tr.translateItems(reqs.filter((x) => !x.skip).map((x) => x.req), msg.to);
          const ms = Math.round(performance.now() - t1);
          for (const { q, req, skip } of reqs) {
            const t = map.get(req.id) ?? null;
            const script = t ? tr.scriptLang(t, msg.to) : null;
            const nc = ncRaw.get(new sdk.TranslateTextParam(req.text, 'auto', msg.to).identifier);
            const ncWhy = !nc ? 'no answer in 7 s' : nc.code !== 0 ? `code ${nc.code}` : !nc.text ? 'empty' : !tr.numbersKept(req.text, nc.text) ? `number changed: "${nc.text}"` : !tr.isDifferent(nc.text, req.text) ? 'unchanged' : 'ok';
            results.push({
              key: q.key, from: req.from ?? 'auto', to: msg.to, skip, ms, text: t,
              engine: t == null ? null : serverTranslated.has(req.text) ? 'server' : 'nexconn',
              nexconn: ncWhy,
              numbersKept: t == null ? null : tr.numbersKept(req.text, t),
              scriptOk: t == null ? null : msg.to === 'en' ? script === null : script === msg.to,
            });
          }
        }));
        send({ op: 'translated', results });
      }
      if (msg.op === 'quit') {
        connected = false;
        await NCEngine.disconnect().catch(() => undefined);
        send({ op: 'bye', drops });
        setTimeout(() => process.exit(0), 100);
      }
    });
  } catch (e) {
    send({ op: 'ready', phone, connected: false, connectError: String(e?.message ?? e).slice(0, 200), convs: [] });
    setTimeout(() => process.exit(1), 100);
  }
} else {
  // ══ Parent ═════════════════════════════════════════════════════════════════════════════════════
  const WAIT_S = Number(opt('wait', 30));
  const health = (await call('GET', '/api/health')).d;
  if (health.chat !== 'nexconn') {
    console.error('The local dev server is not on Nexconn (GET /api/health). Start it first.');
    process.exit(2);
  }
  const phones = [
    '9000000001', '9000000002', '9000000003', '9000000004', '9400000001', '9400000002',
    ...Array.from({ length: 10 }, (_, i) => String(9000001001 + i)),
    ...Array.from({ length: 5 }, (_, i) => String(9000002001 + i)),
    '9000000901', '9000000902', '9000000903',
  ];
  const run = Date.now().toString(36);
  console.log(`chat matrix ${run}: ${phones.length} accounts, one Nexconn connection each`);

  // ── Children ──
  const kids = new Map(); // phone → { proc, info, ... }
  const recv = new Map(); // `${phone}|${key}` → [receipts]
  const blockedIds = new Map(); // messageId → blockType (reported by the sender's SDK)
  const waiters = new Map(); // `${phone}|${op}` → resolve
  const crashes = [];
  for (const phone of phones) {
    const proc = spawn(process.execPath, ['--import', 'tsx', SELF, '--child', phone, run], {
      cwd: ROOT,
      env: { ...process.env, TSX_TSCONFIG_PATH: join(ROOT, 'web/tsconfig.json') },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    const k = { proc, phone, err: '' };
    kids.set(phone, k);
    proc.stderr.on('data', (d) => (k.err = (k.err + d).slice(-3000)));
    proc.on('exit', (code) => {
      k.exited = true;
      if (code) crashes.push({ phone, code, err: k.err.split('\n').filter((l) => /error/i.test(l) && !/IMLib|WARN/.test(l)).slice(-2).join(' | ').slice(0, 240) });
      for (const [key, res] of waiters) if (key.startsWith(`${phone}|`)) res(null);
    });
    proc.on('message', (m) => {
      if (m.op === 'recv') {
        const key = `${phone}|${m.key}`;
        (recv.get(key) ?? recv.set(key, []).get(key)).push(m);
      } else if (m.op === 'blocked') blockedIds.set(m.id, m.blockType);
      const w = waiters.get(`${phone}|${m.op}`);
      if (w) {
        waiters.delete(`${phone}|${m.op}`);
        w(m);
      }
    });
  }
  const expect = (phone, op, ms) => new Promise((res) => {
    const t = setTimeout(() => { waiters.delete(`${phone}|${op}`); res(null); }, ms);
    waiters.set(`${phone}|${op}`, (m) => { clearTimeout(t); res(m); });
    if (kids.get(phone).exited) res(null);
  });
  const ask = (phone, op, extra, waitOp, ms = 120_000) => {
    const p = expect(phone, waitOp, ms);
    if (!kids.get(phone).exited) kids.get(phone).proc.send({ op, ...extra });
    return p;
  };

  const tReady = Date.now();
  const readies = await Promise.all(phones.map((p) => expect(p, 'ready', 120_000)));
  const acc = new Map(readies.map((r, i) => [phones[i], r ?? { phone: phones[i], connected: false, connectError: 'no answer', convs: [] }]));
  const connectMs = [...acc.values()].filter((a) => a.connected).map((a) => a.connectMs);
  console.log(`connected ${connectMs.length}/${phones.length} in ${((Date.now() - tReady) / 1000).toFixed(1)} s (connect p50 ${pct(connectMs, 50)} ms, max ${Math.max(0, ...connectMs)} ms)`);
  for (const a of acc.values()) if (!a.connected) console.log(`  NOT CONNECTED ${a.phone}: ${a.connectError}`);

  // ── Pairs from shared conversations ──
  const convMembers = new Map(); // convId → { kind, channelId, members: [phone] }
  for (const a of acc.values()) {
    for (const c of a.convs ?? []) {
      if (!['deal', 'goods'].includes(c.kind)) continue;
      const e = convMembers.get(c.id) ?? convMembers.set(c.id, { id: c.id, kind: c.kind, channelId: c.channelId, members: [] }).get(c.id);
      e.members.push(a.phone);
    }
  }
  const tests = []; // one per (pair, conversation)
  for (const c of convMembers.values()) {
    for (let i = 0; i < c.members.length; i++) for (let j = i + 1; j < c.members.length; j++) {
      const [x, y] = [c.members[i], c.members[j]].sort();
      tests.push({ a: x, b: y, conv: c });
    }
  }
  tests.sort((p, q) => `${p.a}${p.b}${p.conv.id}`.localeCompare(`${q.a}${q.b}${q.conv.id}`));
  const pairKeys = new Set(tests.map((t) => `${t.a}-${t.b}`));
  const lonely = phones.filter((p) => !tests.some((t) => t.a === p || t.b === p));
  console.log(`${pairKeys.size} account pairs share ${convMembers.size ? [...convMembers.values()].filter((c) => c.members.length > 1).length : 0} conversations → ${tests.length} pair-conversation checks${lonely.length ? `; no shared conversation: ${lonely.join(', ')}` : ''}`);

  // The app decides to translate a deal / Goods chat from the counterpart's language in the inbox / conversation
  // detail (the business record), so it must match what that business's owner actually reads (their app language).
  const ownerLang = new Map([...acc.values()].filter((a) => a.businessId && a.role === 'owner').map((a) => [a.businessId, a]));
  const langMismatch = [];
  for (const a of acc.values()) {
    for (const c of a.convs ?? []) {
      const o = ['deal', 'goods'].includes(c.kind) && c.counterpart?.id ? ownerLang.get(c.counterpart.id) : null;
      if (o && c.counterpart.language !== o.lang) langMismatch.push(`${a.phone} sees ${o.phone}'s business as "${c.counterpart.language}" but its owner reads "${o.lang}" (${c.kind} ${c.id}): ${a.lang === c.counterpart.language ? 'no translation would be offered' : 'wrong source hint'}`);
    }
  }
  console.log(langMismatch.length ? `LANGUAGE DATA: ${langMismatch.length} mismatch(es)\n  ${langMismatch.join('\n  ')}` : 'language data: every counterpart language matches its owner\'s app language');

  // Moderation probes on a few pairs (a deal room and Goods conversations; not the QA pair the call tests use).
  const MOD_PAIRS = ['9000000001-9000000002', '9000001001-9000001002', '9000002001-9000002005'];
  const sendsBy = new Map(phones.map((p) => [p, []]));
  const msgs = []; // every message we expect (or expect NOT) to arrive
  tests.forEach((t, i) => {
    t.idx = i;
    for (const [from, to, dir] of [[t.a, t.b, 'a'], [t.b, t.a, 'b']]) {
      const key = `${i.toString(36)}${dir}`;
      const sentence = line(acc.get(from).lang, 100 + ((i * 7 + (dir === 'a' ? 3 : 5)) % 900));
      const m = { key, kind: 'plain', test: t, from, to, sentence, text: `[cm-${run}-${key}] ${sentence}` };
      msgs.push(m);
      sendsBy.get(from).push({ key, channelId: t.conv.channelId, convId: t.conv.id, text: m.text });
    }
  });
  const modTests = MOD_PAIRS.map((k) => tests.find((t) => `${t.a}-${t.b}` === k)).filter(Boolean);
  for (const t of modTests) {
    for (const [kind, word] of [['mask', 'zzmaskprobe'], ['block', 'zzblockprobe']]) {
      const key = `${t.idx.toString(36)}${kind === 'mask' ? 'm' : 'x'}`; // never 'a'/'b' (the plain messages)
      const sentence = kind === 'mask' ? `Matrix check: ${word}, the last lot was late.` : `Matrix check: ${word} this message must not arrive.`;
      const m = { key, kind, test: t, from: t.a, to: t.b, sentence, text: `[cm-${run}-${key}] ${sentence}` };
      msgs.push(m);
      sendsBy.get(t.a).push({ key, channelId: t.conv.channelId, convId: t.conv.id, text: m.text, moderation: kind });
    }
  }

  // ── Send everything at once ──
  const tGo = Date.now();
  const sentReplies = await Promise.all([...sendsBy.entries()].map(([p, sends]) => (sends.length ? ask(p, 'go', { sends }, 'sent') : null)));
  const sendRes = new Map();
  for (const r of sentReplies) for (const s of r?.results ?? []) sendRes.set(s.key, s);
  const sendPhase = Date.now() - tGo;
  // Wait until every delivered-type message has arrived (or the window closes), then a little longer so a blocked
  // message that slipped through would show up.
  const deliverable = msgs.filter((m) => m.kind !== 'block' && sendRes.get(m.key)?.ok);
  const until = Date.now() + WAIT_S * 1000;
  while (Date.now() < until && deliverable.some((m) => !recv.has(`${m.to}|${m.key}`))) await sleep(250);
  await sleep(3000);

  // ── Delivery results ──
  const delivery = [];
  for (const m of msgs) {
    const s = sendRes.get(m.key);
    const got = (recv.get(`${m.to}|${m.key}`) ?? []).filter((x) => x.from === acc.get(m.from).userId);
    m.send = s;
    m.got = got[0] ?? null;
    m.dups = Math.max(0, got.length - 1) + got.filter((x) => x.dup).length;
    m.deliveryMs = m.got && s ? m.got.at - s.t0 : null;
    if (m.kind === 'plain' && m.deliveryMs != null) delivery.push(m.deliveryMs);
  }

  // ── Translation (receivers whose language differs from the sender's) ──
  const trItems = new Map(); // receiver → items
  for (const m of msgs) {
    if (m.kind !== 'plain' || !m.got) continue;
    const [fl, tl] = [acc.get(m.from).lang, acc.get(m.to).lang];
    if (fl === tl) continue;
    (trItems.get(m.to) ?? trItems.set(m.to, []).get(m.to)).push({ key: m.key, id: m.got.id, text: m.got.text, senderLang: fl, convId: m.test.conv.id });
  }
  const tTr = Date.now();
  const trReplies = await Promise.all([...trItems.entries()].map(([p, items]) => ask(p, 'translate', { items, to: acc.get(p).lang }, 'translated', 90_000)));
  const trPhase = Date.now() - tTr;
  const trRes = new Map();
  for (const r of trReplies) for (const x of r?.results ?? []) trRes.set(x.key, x);
  for (const [p, items] of trItems) for (const it of items) if (!trRes.has(it.key)) trRes.set(it.key, { key: it.key, to: acc.get(p).lang, text: null, error: 'no answer' });

  // ── Report ──
  const short = (p) => `${acc.get(p).name ?? p} ${p.slice(-4)} (${acc.get(p).lang ?? '?'})`;
  const failures = langMismatch.map((x) => `language data: ${x}`);
  console.log('\nPer pair (→ delivery ms each way; tr = translation on the receiving side):');
  for (const t of tests) {
    const parts = [];
    let ok = true;
    for (const dir of ['a', 'b']) {
      const m = msgs.find((x) => x.test === t && x.kind === 'plain' && x.key.endsWith(dir));
      const arrow = dir === 'a' ? '→' : '←';
      if (!m.send?.ok) {
        ok = false;
        parts.push(`${arrow} SEND FAIL ${m.send?.error ?? 'no answer'}`);
        failures.push(`${short(m.from)} → ${short(m.to)} in ${t.conv.kind} ${t.conv.id}: send failed (${m.send?.error ?? 'no answer'})`);
        continue;
      }
      if (!m.got) {
        ok = false;
        parts.push(`${arrow} NOT RECEIVED`);
        failures.push(`${short(m.from)} → ${short(m.to)} in ${t.conv.kind} ${t.conv.id}: sent (${m.send.id}) but not received in ${WAIT_S} s`);
        continue;
      }
      if (m.send.notify && m.send.notify.s !== 200) {
        ok = false;
        failures.push(`${short(m.from)} → ${short(m.to)} in ${t.conv.kind} ${t.conv.id}: notify path HTTP ${m.send.notify.s} ${m.send.notify.error ?? ''}`);
      }
      const x = trRes.get(m.key);
      const trs = !x ? '' : x.skip ? ' tr:same-script' : x.text == null ? ' tr:NONE' : ` tr:${x.engine}${x.numbersKept && x.scriptOk ? '' : `!${x.numbersKept ? '' : 'numbers'}${x.scriptOk ? '' : 'script'}`}`;
      parts.push(`${arrow} ${m.deliveryMs} ms${m.dups ? ` (+${m.dups} dup)` : ''}${m.send.notify?.s !== 200 ? ` notify ${m.send.notify?.s}` : ''}${trs}`);
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${short(t.a)} ↔ ${short(t.b)} · ${t.conv.kind} ${t.conv.id} · ${parts.join(' · ')}`);
  }

  // Translation summary.
  const trList = [...trRes.values()];
  const trAsked = trList.filter((x) => !x.skip);
  const trOk = trAsked.filter((x) => x.text != null && x.numbersKept && x.scriptOk);
  const trBy = (e) => trOk.filter((x) => x.engine === e).length;
  const trMs = [...new Set(trAsked.map((x) => x.ms).filter((x) => x != null))];
  console.log(`\nTranslation (app path translate.ts → ${trItems.size} receivers, ${trAsked.length} messages, ${(trPhase / 1000).toFixed(1)} s): ${trOk.length} ok (${trBy('nexconn')} Nexconn translateTexts, ${trBy('server')} server /api/translate), ${trAsked.filter((x) => x.text == null).length} none, ${trAsked.filter((x) => x.text != null && !(x.numbersKept && x.scriptOk)).length} bad; batch p50 ${pct(trMs, 50)} ms`);
  for (const x of trAsked.filter((y) => !(y.text != null && y.numbersKept && y.scriptOk))) {
    const m = msgs.find((y) => y.key === x.key);
    const why = x.text == null ? x.error ?? 'no translation from either engine' : `${x.numbersKept ? '' : 'number changed '}${x.scriptOk ? '' : `not in ${x.to} script`}`;
    console.log(`  TR FAIL ${short(m.from)} → ${short(m.to)}: "${m.sentence}" → ${x.text ? `"${x.text}"` : '-'} (${why})`);
    failures.push(`translation ${m.from} → ${m.to} (${x.from} → ${x.to}): ${why}`);
  }
  const whyServer = {};
  for (const x of trAsked.filter((y) => y.engine === 'server' || y.text == null)) whyServer[`${x.from}→${x.to}: ${String(x.nexconn).replace(/: ".*/, '')}`] = (whyServer[`${x.from}→${x.to}: ${String(x.nexconn).replace(/: ".*/, '')}`] ?? 0) + 1;
  if (Object.keys(whyServer).length) console.log(`  Nexconn not used for: ${Object.entries(whyServer).map(([k, n]) => `${k} ×${n}`).join('; ')}`);
  if (VERBOSE) for (const x of trOk) console.log(`  tr ${x.from}→${x.to} [${x.engine}] ${msgs.find((y) => y.key === x.key).sentence} ⇒ ${x.text}`);
  else {
    const sample = new Map();
    for (const x of trOk) if (!sample.has(`${x.from}>${x.to}`)) sample.set(`${x.from}>${x.to}`, x);
    for (const x of sample.values()) console.log(`  e.g. ${x.from}→${x.to} [${x.engine}] "${msgs.find((y) => y.key === x.key).sentence}" ⇒ "${x.text}"`);
  }

  // Moderation summary.
  const modRows = [];
  for (const t of modTests) {
    const mk = msgs.find((m) => m.test === t && m.kind === 'mask');
    const bl = msgs.find((m) => m.test === t && m.kind === 'block');
    const checks = {
      composer_flags: mk.send?.composer === 'mask' && bl.send?.composer === 'block',
      mask_delivered_masked: Boolean(mk.got) && mk.got.text.includes('***') && !/zzmaskprobe/i.test(mk.got.text),
      block_not_delivered: Boolean(bl.send?.ok) && !bl.got,
      sender_onMessageBlocked: Boolean(bl.send?.id) && blockedIds.has(bl.send.id),
      server_refuses_block: bl.send?.notify?.blocked === true,
    };
    const ok = Object.values(checks).every(Boolean);
    modRows.push({ t, ok, checks });
    console.log(`${modRows.length === 1 ? '\nModeration:\n' : ''}${ok ? 'PASS' : 'FAIL'}  ${short(t.a)} → ${short(t.b)} · ${t.conv.kind} · ${Object.entries(checks).map(([k, v]) => `${k} ${v ? 'ok' : 'NO'}`).join(', ')}${mk.got ? ` · got "${mk.got.text}"` : ''}`);
    if (!ok) failures.push(`moderation ${t.a} → ${t.b}: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
  }

  const plain = msgs.filter((m) => m.kind === 'plain');
  const byes = await Promise.all(phones.map((p) => ask(p, 'quit', {}, 'bye', 10_000)));
  const drops = byes.reduce((a, b) => a + (b?.drops ?? 0), 0);
  for (const k of kids.values()) if (!k.exited) k.proc.kill();
  const totals = {
    run,
    accounts: `${connectMs.length}/${phones.length} connected`,
    pairs: pairKeys.size,
    pair_conversations: tests.length,
    messages: plain.length,
    sent: plain.filter((m) => m.send?.ok).length,
    delivered: plain.filter((m) => m.got).length,
    failures: failures.length,
    duplicates: plain.reduce((a, m) => a + m.dups, 0),
    send_phase_ms: sendPhase,
    rate_limited_retries: plain.filter((m) => m.send?.rateLimited).length,
    send_p50: pct(plain.map((m) => m.send?.sendMs).filter((x) => x != null), 50),
    delivery_p50: pct(delivery, 50),
    delivery_p95: pct(delivery, 95),
    delivery_max: Math.max(0, ...delivery),
    language_mismatches: langMismatch.length,
    notify_errors: plain.filter((m) => m.send?.notify && m.send.notify.s !== 200).length,
    translation: `${trOk.length}/${trAsked.length} ok (nexconn ${trBy('nexconn')}, server ${trBy('server')})`,
    moderation: `${modRows.filter((r) => r.ok).length}/${modRows.length} pairs pass`,
    connection_drops: drops,
    crashed: crashes.length,
  };
  console.log('\nTotals:', JSON.stringify(totals, null, 1));
  if (failures.length) console.log(`\nFailures:\n  ${failures.join('\n  ')}`);
  for (const c of crashes) console.log(`  crashed child ${c.phone} (exit ${c.code}): ${c.err}`);
  process.exit(failures.length || crashes.length ? 1 : 0);
}

function pct(xs, p) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1)))] : 0;
}
