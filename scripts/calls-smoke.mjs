#!/usr/bin/env node
// End-to-end smoke for voice / video calls (Nexconn Call SDK), against the LOCAL dev web app
// (http://localhost:5173, API http://localhost:8787, dev DB) and Nexconn's cloud. Two Chromium contexts with fake
// media open the shared chat of two test businesses and run every call path:
//   caller hangs up · callee hangs up · callee declines · missed (no answer until the server timeout)
//   caller cancels while ringing · voice → video → voice · the callee never gets Nexconn's end signal
//   · a second call right after the first
// Each scenario checks both screens (data-call-phase / data-call-result), that local capture is released
// (no live getUserMedia tracks), and that exactly one CC:Call line lands in the chat with the right outcome.
// Webhooks are not involved (they cannot reach localhost).
// Needs Playwright from demo-video/ (cd demo-video && npm install) and the Call service on in the console.
// Usage: node scripts/calls-smoke.mjs [--runs=2] [--only=caller_hangup,decline] [--skip-missed] [--verbose]
//        [phoneA=9400000001] [phoneB=9400000002]
import { createRequire } from 'node:module';

const API = 'http://localhost:8787'; // local dev server only; never production
const WEB = 'http://localhost:5173';
const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const RUNS = Number(flag('runs') ?? 2);
const ONLY = flag('only')?.split(',');
const VERBOSE = args.includes('--verbose');
const SKIP_MISSED = args.includes('--skip-missed');
const [PHONE_A = '9400000001', PHONE_B = '9400000002'] = args.filter((a) => !a.startsWith('--'));

async function call(method, path, body, tok) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return { s: r.status, d: await r.json().catch(() => ({})) };
}
const login = async (phone) => (await call('POST', '/api/auth/verify', { phone, otp: '123456' })).d;

let chromium;
try {
  ({ chromium } = createRequire(new URL('../demo-video/package.json', import.meta.url))('playwright'));
} catch {
  console.error('Playwright is not installed: cd demo-video && npm install');
  process.exit(2);
}

const health = (await call('GET', '/api/health')).d;
if (health.chat !== 'nexconn') {
  console.error('The dev server is not running on Nexconn (GET /api/health). Start it first.');
  process.exit(2);
}
const A = await login(PHONE_A);
const Bv = await login(PHONE_B);
const inbox = (await call('GET', '/api/conversations', undefined, A.token)).d;
const convs = Array.isArray(inbox) ? inbox : inbox.conversations ?? [];
const shared = convs.filter((c) => (c.counterpart?.id === Bv.user.business_id || (c.business_ids ?? []).includes(Bv.user.business_id)) && ['goods', 'deal'].includes(c.kind));
const conv = shared.find((c) => c.kind === 'goods') ?? shared[0];
if (!conv) {
  console.error(`No conversation between ${PHONE_A} and ${PHONE_B}. Open a deal or Goods conversation between them first.`);
  process.exit(2);
}
console.log(`caller A ${PHONE_A} (${A.user.language}) → callee B ${PHONE_B} (${Bv.user.language}) in ${conv.kind} ${conv.id}`);

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

/** Opens the chat as `phone`, tracking every getUserMedia stream so the test can see whether capture is released. */
async function open(phone, tag) {
  const ctx = await browser.newContext({ permissions: ['microphone', 'camera'], viewport: { width: 420, height: 860 } });
  const tok = (await login(phone)).token;
  await ctx.addInitScript((t) => {
    localStorage.setItem('cc_token', t);
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const orig = md.getUserMedia.bind(md);
      window.__streams = [];
      md.getUserMedia = async (c) => {
        const s = await orig(c);
        window.__streams.push(s);
        return s;
      };
    }
  }, tok);
  const page = await ctx.newPage();
  page.log = [];
  page.tag = tag;
  page.on('console', (m) => {
    const t = m.text();
    if (/\[call\]|Nexconn code/.test(t)) {
      page.log.push(`${new Date().toISOString().slice(11, 23)} ${t}`);
      if (VERBOSE) console.log(`      [${tag}] ${t}`);
    }
  });
  // A dev server that just rebuilt can serve a half-ready page: reload once before giving up.
  for (let i = 0; ; i++) {
    await page.goto(`${WEB}/chat/${conv.id}`);
    const ok = await page.waitForSelector('[data-call="audio"]', { timeout: 30_000 }).then(() => true, () => false);
    if (ok) break;
    if (i >= 2) throw new Error(`${tag}: no call button in the chat header`);
  }
  // Wait for the chat history, so the CC:Call line count starts from the real number.
  await page.waitForFunction(() => document.querySelectorAll('[data-call-line]').length > 0, null, { timeout: 30_000 }).catch(() => undefined);
  return page;
}

const state = (p) =>
  p.evaluate(() => {
    const el = document.querySelector('[data-call-phase]');
    return {
      phase: el?.getAttribute('data-call-phase') ?? 'idle',
      media: el?.getAttribute('data-call-media') ?? null,
      result: el?.getAttribute('data-call-result') ?? null,
    };
  });
const phase = async (p) => (await state(p)).phase;
async function waitFor(p, pred, ms) {
  const end = Date.now() + ms;
  let s;
  while (Date.now() < end) {
    s = await state(p);
    if (pred(s)) return s;
    await p.waitForTimeout(200);
  }
  return s;
}
const waitPhase = (p, want, ms) => waitFor(p, (s) => want.includes(s.phase), ms);
const liveTracks = (p) => p.evaluate(() => (window.__streams ?? []).flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);
const lines = (p) => p.evaluate(() => [...document.querySelectorAll('[data-call-line]')].map((e) => ({ outcome: e.getAttribute('data-call-line'), id: e.getAttribute('data-call-id'), text: e.textContent })));

/** Both screens back to idle (the "ended" screen closes by itself) and no capture left running. */
async function settled(a, b, ms = 12_000) {
  const [sa, sb] = [await waitPhase(a, ['idle'], ms), await waitPhase(b, ['idle'], ms)];
  await a.waitForTimeout(600);
  const [ta, tb] = [await liveTracks(a), await liveTracks(b)];
  return { ok: sa.phase === 'idle' && sb.phase === 'idle' && ta === 0 && tb === 0, detail: `idle ${sa.phase}/${sb.phase}, live tracks ${ta}/${tb}` };
}

/** Taps the call button on the caller until a call screen appears; returns the callee's state once it rings. */
async function dial(a, b, media = 'audio') {
  for (let i = 0; i < 4; i++) {
    await a.click(`[data-call="${media}"]`);
    if ((await waitPhase(a, ['outgoing', 'connecting', 'notice'], 6000)).phase !== 'idle') break;
  }
  const end = Date.now() + 35_000;
  let sa;
  let sb;
  while (Date.now() < end) {
    [sa, sb] = [await state(a), await state(b)];
    if (sb.phase === 'incoming' || sa.phase === 'notice') break;
    await a.waitForTimeout(250);
  }
  return { ok: sb.phase === 'incoming' && sa.phase === 'outgoing', detail: `caller ${sa.phase}, callee ${sb.phase}`, notice: sa.phase === 'notice' };
}

async function connect(a, b, media = 'audio') {
  const d = await dial(a, b, media);
  if (!d.ok) return d;
  await b.click('[data-call-action="accept"]');
  const [sa, sb] = [await waitPhase(a, ['active'], 30_000), await waitPhase(b, ['active'], 30_000)];
  return { ok: sa.phase === 'active' && sb.phase === 'active', detail: `connect ${sa.phase}/${sb.phase}` };
}

/** Exactly one new CC:Call line on both sides, with the expected outcome (and a duration for completed calls). */
async function summary(a, b, before, outcome) {
  // The call this summary is for: the caller logs "calling <peer> (...) · callId <id>" when it starts.
  const callId = [...a.log].reverse().map((l) => /\[call\] calling .* callId (\d+)/.exec(l)?.[1]).find(Boolean);
  if (!callId) return { ok: false, detail: 'no callId in the caller log' };
  const mine = async (p) => (await lines(p)).filter((l) => l.id === callId);
  const end = Date.now() + 15_000;
  let la;
  let lb;
  while (Date.now() < end) {
    [la, lb] = [await mine(a), await mine(b)];
    if (la.length && lb.length) break;
    await a.waitForTimeout(400);
  }
  await a.waitForTimeout(2500); // a duplicate would arrive within this window
  [la, lb] = [await mine(a), await mine(b)];
  const line = lb[0];
  const ok = la.length === 1 && lb.length === 1 && line.outcome === outcome && (outcome !== 'completed' || /\d+:\d\d/.test(line.text ?? ''));
  return { ok, detail: `${la.length}/${lb.length} line(s) for call ${callId.slice(-6)}, "${line?.text ?? 'none'}" (${line?.outcome ?? '-'})` };
}
/** Baseline line counts. The shared chat already has call lines, so 0 means the history has not loaded yet. */
async function count(a, b) {
  const end = Date.now() + 20_000;
  let c;
  do {
    c = { a: (await lines(a)).length, b: (await lines(b)).length };
    if (c.a && c.b) break;
    await a.waitForTimeout(500);
  } while (Date.now() < end);
  return c;
}

// ── Scenarios ───────────────────────────────────────────────────────────────
// Each returns a list of [check, {ok, detail}] and must leave both sides idle.
const scenarios = {
  async caller_hangup(a, b) {
    const before = await count(a, b);
    const c = await connect(a, b);
    if (!c.ok) return [['connect', c]];
    await a.waitForTimeout(3000);
    await a.click('[data-call-action="hangup"]');
    const [sa, sb] = [await waitPhase(a, ['ended', 'idle'], 10_000), await waitPhase(b, ['ended', 'idle'], 10_000)];
    return [
      ['connect', c],
      ['both sides end', { ok: sa.phase !== 'active' && sb.phase !== 'active' && ['ended', 'idle'].includes(sa.phase) && ['ended', 'idle'].includes(sb.phase), detail: `${sa.phase}/${sb.phase}` }],
      ['summary', await summary(a, b, before, 'completed')],
      ['released', await settled(a, b)],
    ];
  },
  async callee_hangup(a, b) {
    const before = await count(a, b);
    const c = await connect(a, b);
    if (!c.ok) return [['connect', c]];
    await a.waitForTimeout(3000);
    await b.click('[data-call-action="hangup"]');
    const [sa, sb] = [await waitPhase(a, ['ended', 'idle'], 10_000), await waitPhase(b, ['ended', 'idle'], 10_000)];
    return [
      ['connect', c],
      ['both sides end', { ok: ['ended', 'idle'].includes(sa.phase) && ['ended', 'idle'].includes(sb.phase), detail: `${sa.phase}/${sb.phase}` }],
      ['summary', await summary(a, b, before, 'completed')],
      ['released', await settled(a, b)],
    ];
  },
  async decline(a, b) {
    const before = await count(a, b);
    const d = await dial(a, b);
    if (!d.ok) return [['ring', d]];
    await b.click('[data-call-action="decline"]');
    const sa = await waitFor(a, (s) => s.phase === 'ended' || s.phase === 'idle', 10_000);
    const sb = await waitPhase(b, ['idle'], 10_000);
    return [
      ['ring', d],
      ['caller sees "declined"', { ok: sa.phase === 'ended' && sa.result === 'declined', detail: `${sa.phase} ${sa.result}` }],
      ['callee closes', { ok: sb.phase === 'idle', detail: sb.phase }],
      ['summary', await summary(a, b, before, 'declined')],
      ['released', await settled(a, b)],
    ];
  },
  async cancel(a, b) {
    const before = await count(a, b);
    const d = await dial(a, b);
    if (!d.ok) return [['ring', d]];
    await a.waitForTimeout(1500);
    await a.click('[data-call-action="hangup"]');
    const sa = await waitFor(a, (s) => s.phase === 'ended' || s.phase === 'idle', 10_000);
    const sb = await waitFor(b, (s) => s.phase === 'ended' || s.phase === 'idle', 10_000);
    return [
      ['ring', d],
      ['caller sees "cancelled"', { ok: sa.phase === 'idle' || (sa.phase === 'ended' && sa.result === 'cancelled'), detail: `${sa.phase} ${sa.result}` }],
      ['callee sees "missed"', { ok: sb.phase === 'ended' && sb.result === 'missed', detail: `${sb.phase} ${sb.result}` }],
      ['summary', await summary(a, b, before, 'cancelled')],
      ['released', await settled(a, b)],
    ];
  },
  async missed(a, b) {
    const before = await count(a, b);
    const d = await dial(a, b);
    if (!d.ok) return [['ring', d]];
    const t0 = Date.now();
    // Nobody answers: the call service times the call out (about a minute).
    const sa = await waitFor(a, (s) => s.phase !== 'outgoing' && s.phase !== 'connecting', 120_000);
    const sb = await waitFor(b, (s) => s.phase !== 'incoming', 15_000);
    const secs = Math.round((Date.now() - t0) / 1000);
    return [
      ['ring', d],
      ['caller sees "no answer"', { ok: sa.phase === 'ended' && sa.result === 'no_answer', detail: `${sa.phase} ${sa.result} after ${secs}s` }],
      ['callee sees "missed"', { ok: sb.phase === 'ended' && sb.result === 'missed', detail: `${sb.phase} ${sb.result}` }],
      ['missed call line', await summary(a, b, before, 'missed')],
      ['released', await settled(a, b)],
    ];
  },
  async switch_media(a, b) {
    const before = await count(a, b);
    const c = await connect(a, b, 'audio');
    if (!c.ok) return [['connect', c]];
    await a.waitForTimeout(2000);
    await a.click('[data-call-action="switch"]');
    const req = await b.waitForSelector('[data-call-action="video-accept"]', { timeout: 15_000 }).then(() => true, () => false);
    if (req) await b.click('[data-call-action="video-accept"]');
    const [va, vb] = [await waitFor(a, (s) => s.media === 'video', 15_000), await waitFor(b, (s) => s.media === 'video', 15_000)];
    await a.waitForTimeout(2000);
    // Back down to voice: no question for the other side.
    await b.click('[data-call-action="switch"]');
    const [xa, xb] = [await waitFor(a, (s) => s.media === 'audio', 15_000), await waitFor(b, (s) => s.media === 'audio', 15_000)];
    await a.waitForTimeout(1000);
    await a.click('[data-call-action="hangup"]');
    const [sa, sb] = [await waitPhase(a, ['ended', 'idle'], 10_000), await waitPhase(b, ['ended', 'idle'], 10_000)];
    return [
      ['connect', c],
      ['callee asked to turn on video', { ok: req, detail: req ? 'request shown' : 'no request' }],
      ['voice → video on both', { ok: va.media === 'video' && vb.media === 'video' && va.phase === 'active' && vb.phase === 'active', detail: `${va.phase}:${va.media}/${vb.phase}:${vb.media}` }],
      ['video → voice on both', { ok: xa.media === 'audio' && xb.media === 'audio' && xa.phase === 'active' && xb.phase === 'active', detail: `${xa.phase}:${xa.media}/${xb.phase}:${xb.media}` }],
      ['both sides end', { ok: ['ended', 'idle'].includes(sa.phase) && ['ended', 'idle'].includes(sb.phase), detail: `${sa.phase}/${sb.phase}` }],
      ['summary', await summary(a, b, before, 'completed')],
      ['released', await settled(a, b)],
    ];
  },
  async lost_end_event(a, b) {
    // Nexconn's end signal does not reach the callee: 'end' drops onCallEnded (the remote-left event must end
    // the call), 'all' drops both (the watchdog must notice the SDK has no live session). Dev builds only.
    const out = [];
    for (const drop of ['end', 'all']) {
      const before = await count(a, b);
      const c = await connect(a, b);
      out.push([`${drop}: connect`, c]);
      if (!c.ok) return out;
      await b.evaluate((d) => (window.__ccCallDrop = d), drop);
      await a.waitForTimeout(2000);
      await a.click('[data-call-action="hangup"]');
      const [sa, sb] = [await waitPhase(a, ['ended', 'idle'], 10_000), await waitPhase(b, ['ended', 'idle'], 10_000)];
      const dropped = b.log.some((l) => l.includes('test: dropped'));
      await b.evaluate(() => (window.__ccCallDrop = null));
      out.push([`${drop}: callee still ends`, { ok: dropped && ['ended', 'idle'].includes(sa.phase) && ['ended', 'idle'].includes(sb.phase), detail: `${sa.phase}/${sb.phase}${dropped ? '' : ' (nothing was dropped: not a dev build?)'}` }]);
      out.push([`${drop}: summary`, await summary(a, b, before, 'completed')]);
      out.push([`${drop}: released`, await settled(a, b)]);
    }
    return out;
  },
  async back_to_back(a, b) {
    // Two calls with no pause: the second is placed the moment both screens are idle again.
    const out = [];
    for (const who of ['first', 'second']) {
      const before = await count(a, b);
      const c = await connect(a, b);
      out.push([`${who}: connect`, c]);
      if (!c.ok) return out;
      await a.waitForTimeout(2000);
      await (who === 'first' ? a : b).click('[data-call-action="hangup"]');
      const [sa, sb] = [await waitPhase(a, ['ended', 'idle'], 10_000), await waitPhase(b, ['ended', 'idle'], 10_000)];
      out.push([`${who}: both sides end`, { ok: ['ended', 'idle'].includes(sa.phase) && ['ended', 'idle'].includes(sb.phase), detail: `${sa.phase}/${sb.phase}` }]);
      out.push([`${who}: summary`, await summary(a, b, before, 'completed')]);
      out.push([`${who}: released`, await settled(a, b)]);
    }
    return out;
  },
};

const order = ['caller_hangup', 'callee_hangup', 'decline', 'cancel', 'missed', 'switch_media', 'lost_end_event', 'back_to_back'].filter((n) => (!ONLY || ONLY.includes(n)) && !(SKIP_MISSED && n === 'missed'));
const table = {};
let failed = 0;
try {
  const a = await open(PHONE_A, 'A');
  const b = await open(PHONE_B, 'B');
  // --second-device: B is also signed in on another device that stays idle (rings, then must stop).
  if (args.includes('--second-device')) await open(PHONE_B, 'B2');
  await a.waitForTimeout(4000); // chat + call engine connect
  for (let run = 1; run <= RUNS; run++) {
    console.log(`\n── Run ${run} ──`);
    for (const name of order) {
      a.log.length = 0;
      b.log.length = 0;
      let checks;
      try {
        checks = await scenarios[name](a, b);
      } catch (err) {
        checks = [['error', { ok: false, detail: String(err?.message ?? err).split('\n')[0] }]];
      }
      if (checks.some(([, r]) => r.notice)) {
        console.log('SKIP  calls: the caller got a notice (Call service off in the console?)');
        process.exit(2);
      }
      const ok = checks.every(([, r]) => r.ok);
      if (!ok) failed++;
      (table[name] ??= []).push(ok ? 'PASS' : 'FAIL');
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
      for (const [c, r] of checks) console.log(`      ${r.ok ? 'ok  ' : 'FAIL'} ${c} · ${r.detail}`);
      if (!ok) {
        console.log('      caller log:\n' + a.log.map((l) => `        ${l}`).join('\n'));
        console.log('      callee log:\n' + b.log.map((l) => `        ${l}`).join('\n'));
        // Leave a clean slate for the next scenario.
        for (const p of [a, b]) if ((await phase(p)) !== 'idle') await p.click('[data-call-action="hangup"], [data-call-action="decline"]').catch(() => undefined);
        await settled(a, b, 15_000);
      }
    }
  }
} finally {
  await browser.close();
}
console.log('\nscenario        ' + Array.from({ length: RUNS }, (_, i) => `run ${i + 1}`).join('  '));
for (const [n, r] of Object.entries(table)) console.log(`${n.padEnd(16)}${r.map((x) => x.padEnd(7)).join('')}`);
process.exit(failed ? 1 : 0);
