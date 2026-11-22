#!/usr/bin/env node
// End-to-end smoke for the Nexconn features, against the LOCAL dev server (http://localhost:8787, dev DB) and
// Nexconn's cloud. Two test businesses talk in their shared conversation:
//   1. Moderation   - the profanity filter masks a MASK word and blocks a BLOCK word (sender gets onMessageBlocked,
//                     the receiver never sees it); the server's notify path refuses the blocked text.
//   2. Translation  - Nexconn translateMessages + translateTexts return results; the server fallback answers too.
//   3. Archive      - POST /api/archives/run uploads the day's JSON to Nexconn file storage; reading it back gives
//                     the messages sent here (masked one included, blocked one absent).
//   4. Calls        - (optional, needs Playwright from demo-video/) two Chromium pages with fake media: ring,
//                     accept, connect, hang up, and the CC:Call line; reports SKIP if the console's Call service is off.
// Usage: node scripts/nexconn-features-smoke.mjs [--calls] [phoneA=9400000001] [phoneB=9400000002]
// Moderation words must be in Nexconn first: npm run chat:moderation -w server -- sync (takes up to ~15 min).
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const B = 'http://localhost:8787'; // local dev server only; never production
const WEB = 'http://localhost:5173';
const args = process.argv.slice(2);
const CALLS = args.includes('--calls');
const [PHONE_A = '9400000001', PHONE_B = '9400000002'] = args.filter((a) => !a.startsWith('--'));
const SELF = fileURLToPath(import.meta.url);

async function call(method, path, body, tok) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(240_000) });
  const text = await r.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { s: r.status, d: data };
}
const login = async (phone) => (await call('POST', '/api/auth/verify', { phone, otp: '123456' })).d;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(v, handlers) {
  const { loadChatSdk } = await import('../server/src/nexconn-node/shims.mjs');
  const sdk = await loadChatSdk();
  const { NCEngine, AreaCode, MessageHandler, TranslateHandler } = sdk;
  NCEngine.initialize({ appKey: v.chat.appKey, areaCode: AreaCode[(v.chat.area || 'SG').toUpperCase()] ?? AreaCode.SG, logOutputLevel: 4 });
  NCEngine.addMessageHandler('smoke', new MessageHandler(handlers.message));
  NCEngine.addTranslateHandler('smoke', new TranslateHandler(handlers.translate ?? {}));
  const r = await NCEngine.connect({ token: v.chat.token });
  if (!r.isOk) throw new Error(`connect failed (${r.code})`);
  return sdk;
}

// ══ Receiver (child process: the SDK is one engine per process) ══════════════════════════════════
if (args[0] === '--peer') {
  const v = await login(args[1]);
  const got = [];
  const tr = new Map();
  const sdk = await connect(v, {
    message: { onMessageReceived: ({ messages }) => messages.forEach((m) => got.push({ id: m.messageId, type: m.messageType, text: m.content?.text ?? m.content?.content ?? '', at: m.sentTime })) },
    translate: { onTranslationCompleted: ({ results }) => results.forEach((r) => tr.set(r.identifier, r)) },
  });
  const { NCEngine, TranslateMessageParam, TranslateTextParam, TranslateSourceType } = sdk;
  process.send({ ready: true, userId: v.user.id, lang: v.user.language });
  process.on('message', async (msg) => {
    if (msg.op === 'received') process.send({ op: 'received', got });
    if (msg.op === 'translate') {
      // One message by id, one free text; retry once on a transient failure (e.g. 28401 when requests come fast).
      const attempt = async () => {
        const m = got.find((x) => x.id === msg.messageId);
        const mp = new TranslateMessageParam(msg.messageId, 'auto', msg.to, m?.text ?? msg.text);
        const tp = new TranslateTextParam(msg.freeText, 'auto', msg.to);
        const a = await NCEngine.translateModule.translateMessages({ list: [mp], force: true });
        await sleep(400);
        const b = await NCEngine.translateModule.translateTexts({ list: [tp] });
        const end = Date.now() + 12_000;
        while (Date.now() < end && !(tr.has(mp.identifier) && tr.has(tp.identifier))) await sleep(200);
        return { accepted: [a.code, b.code], message: tr.get(mp.identifier) ?? null, text: tr.get(tp.identifier) ?? null, ids: [mp.identifier, tp.identifier], sourceTypes: [TranslateSourceType.MESSAGE, TranslateSourceType.CUSTOM_TEXT] };
      };
      // Nexconn answers 28401 now and then (seen on fast successive requests): up to three tries, spaced out.
      let r = await attempt();
      for (let i = 0; i < 2 && (r.message?.code !== 0 || r.text?.code !== 0); i++) {
        await sleep(4000);
        tr.clear();
        r = await attempt();
      }
      process.send({ op: 'translate', r });
    }
    if (msg.op === 'quit') {
      await NCEngine.disconnect().catch(() => undefined);
      process.exit(0);
    }
  });
} else {
  // ══ Sender / orchestrator ══════════════════════════════════════════════════════════════════════
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok === true ? 'PASS' : ok === null ? 'SKIP' : 'FAIL'}  ${name}${detail ? ` · ${detail}` : ''}`);
  };
  const health = (await call('GET', '/api/health')).d;
  if (health.chat !== 'nexconn') {
    console.error('The dev server is not running on Nexconn (GET /api/health). Start it first.');
    process.exit(2);
  }
  const A = await login(PHONE_A);
  const Bv = await login(PHONE_B);
  // Their shared conversation (Goods or deal).
  const inbox = (await call('GET', '/api/conversations', undefined, A.token)).d;
  const convs = Array.isArray(inbox) ? inbox : inbox.conversations ?? [];
  // Prefer the Goods conversation (one per pair); a deal room works too.
  const shared = convs.filter((c) => (c.counterpart?.id === Bv.user.business_id || (c.business_ids ?? []).includes(Bv.user.business_id)) && ['goods', 'deal'].includes(c.kind));
  const conv = shared.find((c) => c.kind === 'goods') ?? shared[0];
  if (!conv) {
    console.error(`No conversation between ${PHONE_A} and ${PHONE_B}. Open a deal or Goods conversation between them first.`);
    process.exit(2);
  }
  const channelId = conv.channelId ?? conv.channel_id;
  console.log(`A ${A.user.id} (${A.user.language}) ↔ B ${Bv.user.id} (${Bv.user.language}) in ${conv.kind} ${channelId}`);

  const peer = fork(SELF, ['--peer', PHONE_B], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let peerErr = '';
  peer.stderr.on('data', (d) => (peerErr = (peerErr + d).slice(-3000)));
  peer.on('exit', (code) => code && console.error(`peer exited (${code}): ${peerErr.split('\n').filter((l) => !/IMLib/.test(l)).slice(-5).join(' ')}`));
  const ask = (op, extra = {}) => new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`peer did not answer "${op}"`)), 60_000);
    const on = (m) => {
      if (m.op === op) {
        clearTimeout(timer);
        peer.off('message', on);
        res(m);
      }
    };
    peer.on('message', on);
    peer.once('exit', () => rej(new Error('peer exited')));
    peer.send({ op, ...extra });
  });
  await new Promise((res, rej) => {
    peer.once('message', (m) => (m.ready ? res() : rej(new Error('peer failed'))));
    peer.once('exit', () => rej(new Error('peer exited')));
  });

  const blocked = new Map();
  const sdk = await connect(A, { message: { onMessageBlocked: ({ info }) => blocked.set(info.messageId, info) } });
  const ch = new sdk.GroupChannel(channelId);
  const tag = Date.now().toString(36).slice(-5);
  const send = async (text) => {
    const r = await ch.sendMessage(new sdk.SendTextMessageParams({ text }));
    if (!r.isOk) throw new Error(`send failed (${r.code})`);
    // The app's notify path: the server archives / reacts to what was delivered.
    const n = await call('POST', `/api/deals/${conv.id}/inbound`, { text, messageId: r.data.messageId, lang: A.user.language }, A.token);
    return { id: r.data.messageId, notify: n.d };
  };

  // ── 1. Moderation ──
  const plain = await send(`Smoke ${tag}: please send 250 pcs by Friday at ₹48 each.`);
  const masked = await send(`Smoke ${tag}: zzmaskprobe, the last lot was late.`);
  const block = await send(`Smoke ${tag}: zzblockprobe this message must not arrive.`);
  await sleep(6000);
  const got = (await ask('received')).got;
  const gotPlain = got.find((m) => m.id === plain.id);
  const gotMasked = got.find((m) => m.id === masked.id);
  const gotBlocked = got.find((m) => m.id === block.id);
  check('plain message delivered', Boolean(gotPlain), gotPlain?.text);
  check('mask word replaced before delivery', Boolean(gotMasked) && gotMasked.text.includes('***') && !/zzmaskprobe/i.test(gotMasked.text), gotMasked?.text ?? 'not received');
  check('block word: receiver never gets it', !gotBlocked, gotBlocked ? `received "${gotBlocked.text}"` : 'not delivered');
  check('block word: sender SDK gets onMessageBlocked', blocked.has(block.id), blocked.get(block.id) ? `blockType ${blocked.get(block.id).blockType}` : 'no event');
  check('server notify path refuses the blocked text', block.notify?.blocked === true, JSON.stringify(block.notify));
  const modActive = Boolean(gotMasked?.text.includes('***')) && !gotBlocked;
  if (!modActive) console.log('      Nexconn delivered the moderated words unchanged: the word list is not applied (run `npm run chat:moderation -w server -- list`; changes take up to ~15 min).');

  // ── 2. Translation ──
  const to = Bv.user.language === A.user.language ? (Bv.user.language === 'bn' ? 'te' : 'bn') : Bv.user.language;
  const t = (await ask('translate', { messageId: plain.id, text: gotPlain?.text ?? '', freeText: 'Payment of ₹12,000 will reach you tomorrow.', to })).r;
  check(`Nexconn translateMessages → ${to} (answers; the app uses translateTexts)`, t.message?.code === 0 && Boolean(t.message?.translateInfo?.translatedText), t.message ? `code ${t.message.code}: ${t.message.translateInfo?.translatedText ?? ''}` : 'no result');
  check(`Nexconn translateTexts → ${to}`, t.text?.code === 0 && Boolean(t.text?.translateInfo?.translatedText), t.text ? `code ${t.text.code}: ${t.text.translateInfo?.translatedText ?? ''}` : 'no result');
  const sv = await call('POST', '/api/translate', { texts: ['Please send 250 pcs by Friday.'], to }, Bv.token);
  check('server fallback /api/translate', sv.s === 200 && typeof sv.d.translations?.[0] === 'string', sv.d.translations?.[0] ?? JSON.stringify(sv.d).slice(0, 120));

  // ── 3. Archive ──
  const run = await call('POST', '/api/archives/run', { conversationId: conv.id }, A.token);
  const rec = run.d.records?.[0];
  check('archive job ran', run.s === 200 && Boolean(rec), run.s === 200 ? `${run.d.uploaded} uploaded, ${run.d.unchanged} unchanged, history ${run.d.historySource}` : JSON.stringify(run.d));
  check('archive stored in Nexconn file storage', rec?.storage === 'nexconn' && /^https:\/\//.test(rec?.url ?? ''), rec?.url ?? rec?.storage);
  const list = (await call('GET', `/api/conversations/${conv.id}/archives`, undefined, Bv.token)).d.archives ?? [];
  check('other member lists the archive', list.some((a) => a.id === rec?.id), `${list.length} archive(s)`);
  const read = await call('GET', `/api/archives/${encodeURIComponent(rec?.id ?? 'none')}`, undefined, Bv.token);
  const msgs = read.d.data?.messages ?? [];
  const ids = new Set(msgs.map((m) => m.id));
  check('read back: decrypted, checksum ok', read.s === 200 && read.d.data?.format === 'claire-chat-archive', `${msgs.length} messages, ${read.d.archive?.encryption}`);
  check('read back: has the plain and masked messages', ids.has(plain.id) && ids.has(masked.id));
  // The archive records what Nexconn delivered, so these two follow the platform filter.
  check('read back: masked text stored masked', modActive ? msgs.find((m) => m.id === masked.id)?.text?.includes('***') === true : null, modActive ? '' : 'Nexconn filter not active');
  check('read back: blocked message absent', modActive ? !ids.has(block.id) && !msgs.some((m) => (m.text ?? '').includes(`Smoke ${tag}: zzblockprobe`)) : null, modActive ? '' : 'Nexconn filter not active');
  check('read back: newest last', msgs.every((m, i) => i === 0 || msgs[i - 1].at <= m.at));
  const outsider = await login('9000000003');
  const denied = await call('GET', `/api/archives/${encodeURIComponent(rec?.id ?? 'none')}`, undefined, outsider.token);
  check('non-member is refused', denied.s === 403, `HTTP ${denied.s}`);

  await ask('quit').catch(() => undefined);
  peer.kill();
  await sdk.NCEngine.disconnect().catch(() => undefined);

  // ── 4. Calls (optional) ──
  if (CALLS) await callChecks(conv.id, check);
  else check('calls (run with --calls)', null);

  const failed = results.filter((r) => r.ok === false);
  console.log(`\n${results.filter((r) => r.ok === true).length} passed, ${failed.length} failed, ${results.filter((r) => r.ok === null).length} skipped`);
  process.exit(failed.length ? 1 : 0);
}

async function callChecks(conversationId, check) {
  let chromium;
  try {
    ({ chromium } = createRequire(new URL('../demo-video/package.json', import.meta.url))('playwright'));
  } catch {
    return check('calls: Playwright not installed (cd demo-video && npm install)', null);
  }
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const codes = [];
  const open = async (phone) => {
    const ctx = await browser.newContext({ permissions: ['microphone', 'camera'], viewport: { width: 420, height: 860 } });
    const tok = (await login(phone)).token;
    await ctx.addInitScript((t) => localStorage.setItem('cc_token', t), tok);
    const page = await ctx.newPage();
    page.on('console', (m) => {
      const hit = /Nexconn code (\d+)/.exec(m.text());
      if (hit) codes.push(Number(hit[1]));
    });
    await page.goto(`${WEB}/chat/${conversationId}`);
    await page.waitForSelector('[data-call="audio"]', { timeout: 30_000 });
    return page;
  };
  const phase = (p) => p.evaluate(() => document.querySelector('[data-call-phase]')?.getAttribute('data-call-phase') ?? 'idle');
  const waitPhase = async (p, want, ms) => {
    const end = Date.now() + ms;
    let ph;
    while (Date.now() < end) {
      ph = await phase(p);
      if (want.includes(ph)) return ph;
      await p.waitForTimeout(250);
    }
    return ph;
  };
  try {
    const a = await open(PHONE_A);
    const b = await open(PHONE_B);
    await a.waitForTimeout(4000);
    // The button can be tapped before the chat connection is up; tap again if no call screen appeared.
    for (let i = 0; i < 3; i++) {
      await a.click('[data-call="audio"]');
      if ((await waitPhase(a, ['outgoing', 'connecting', 'notice'], 6000)) !== 'idle') break;
    }
    // Either the callee rings, or the caller gets a notice (80006 = the Call service is off in the console).
    let inc = 'idle';
    let pa0 = 'idle';
    for (const end = Date.now() + 35_000; Date.now() < end; ) {
      [inc, pa0] = [await phase(b), await phase(a)];
      if (inc === 'incoming' || pa0 === 'notice') break;
      await a.waitForTimeout(300);
    }
    if (pa0 === 'notice' || codes.includes(80006)) {
      const off = codes.includes(80006);
      check(off ? 'calls: Call service is off in the Nexconn console (80006); the caller sees the "not switched on" sheet' : `calls: caller got a notice (codes ${codes.join(',') || 'none'})`, off ? null : false);
      return;
    }
    check('calls: callee rings', inc === 'incoming', `caller ${pa0}, callee ${inc}`);
    if (inc !== 'incoming') return;
    await b.click('[data-call-action="accept"]');
    const [pa, pb] = [await waitPhase(a, ['active'], 30_000), await waitPhase(b, ['active'], 30_000)];
    check('calls: accept → connected on both sides', pa === 'active' && pb === 'active', `${pa}/${pb}`);
    await a.waitForTimeout(4000);
    await a.click('[data-call-action="hangup"]');
    const [ea, eb] = [await waitPhase(a, ['ended', 'idle'], 15_000), await waitPhase(b, ['ended', 'idle'], 15_000)];
    check('calls: hang up ends both sides', ['ended', 'idle'].includes(ea) && ['ended', 'idle'].includes(eb), `${ea}/${eb}`);
    await b.waitForTimeout(5000);
    const line = await b.evaluate(() => document.body.innerText.match(/[^\n]*(call|কল|కాల్)[^\n]*·\s*\d+:\d\d/i)?.[0] ?? null);
    check('calls: CC:Call summary line in the chat', Boolean(line), line ?? 'none');
  } finally {
    await browser.close();
  }
}
