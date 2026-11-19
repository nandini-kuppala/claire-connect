// Records every demo scene with Playwright (one video per page) and logs scene marks.
// Usage: node capture.mjs   (app must be running: web :5173, API :8787)
import { chromium } from 'playwright';
import fs from 'node:fs';

const WEB = 'http://localhost:5173';
const API = 'http://localhost:8787/api';
const OUT = new URL('./raw/', import.meta.url).pathname;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const marks = [];

// ── API helpers (demo setup between scenes) ─────────────────────────────
async function api(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function login(phone) {
  await api('/auth/otp', { method: 'POST', body: { phone } });
  return (await api('/auth/verify', { method: 'POST', body: { phone, otp: '123456' } })).token;
}

// Tap ripple so viewers can see where the finger lands.
const TAP_JS = `
addEventListener('pointerdown', (e) => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:'+(e.clientX-22)+'px;top:'+(e.clientY-22)+'px;width:44px;height:44px;border-radius:50%;background:rgba(19,32,59,.18);border:2px solid rgba(19,32,59,.45);transition:transform .45s ease-out,opacity .45s ease-out;';
  document.documentElement.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; });
  setTimeout(() => d.remove(), 520);
}, true);`;

async function newPhone(browser, name, origin = WEB) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    recordVideo: { dir: OUT + name, size: { width: 780, height: 1688 } }, baseURL: origin, locale: 'en-IN',
  });
  await ctx.addInitScript(TAP_JS);
  const page = await ctx.newPage();
  const t0 = Date.now();
  return { ctx, page, name, mark: (id, edge) => marks.push({ page: name, id, edge, t: (Date.now() - t0) / 1000 }) };
}

async function smoothScroll(page, y, ms = 900) {
  await page.evaluate(([y, ms]) => new Promise((res) => {
    const el = document.scrollingElement; const from = el.scrollTop; const to = Math.max(0, y === 'end' ? el.scrollHeight : y); const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2; el.scrollTop = from + (to - from) * e; k < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  }), [y, ms]);
}
async function scrollInner(page, sel, y, ms = 900) {
  await page.evaluate(([sel, y, ms]) => new Promise((res) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.scrollHeight > e.clientHeight + 10); if (!el) return res();
    const from = el.scrollTop; const to = y === 'end' ? el.scrollHeight : y; const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); el.scrollTop = from + (to - from) * (k < .5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2); k < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  }), [sel, y, ms]);
}
const tap = async (loc, wait = 600) => {
  await loc.first().scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {});
  try { await loc.first().click({ timeout: 15000 }); } catch (e) {
    const pg = loc.page(); await pg.screenshot({ path: OUT + 'fail.png' }).catch(() => {}); fs.writeFileSync(OUT + 'fail.url', pg.url()); throw e;
  }
  await sleep(wait);
};
async function typeSlow(page, text) {
  const ta = page.locator('textarea').last();
  await ta.click();
  for (const ch of text) { await page.keyboard.insertText(ch); await sleep(45); }
}

// ── Demo data setup ─────────────────────────────────────────────────────
const amitTok = await login('9000000001');
const lakshmiTok = await login('9000000002');
const meenaTok = await login('9000000901');
await api('/me', { token: amitTok, method: 'PATCH', body: { language: 'en' } });
await api('/me', { token: lakshmiTok, method: 'PATCH', body: { language: 'ta' } });
await api('/me', { token: meenaTok, method: 'PATCH', body: { language: 'en' } }).catch((e) => console.warn('meena lang', e.message));
// Warm Claire's AI cache so the on-camera answers come back quickly, then reset her session.
const ASK = '500 cotton T-shirts under ₹120';
await api('/claire/reset', { token: amitTok, method: 'POST' }).catch(() => {});
const MSG = 'Hi, can you do 90 rupees per piece for 500 pieces?';
const REPLY_TA = 'வணக்கம் அமித், ₹94 தான் இறுதி விலை. இரண்டு நாளில் அனுப்பி விடுகிறேன்.';
await api('/translate', { token: amitTok, method: 'POST', body: { texts: [MSG], to: 'ta' } }).catch(() => {});
await api('/translate', { token: amitTok, method: 'POST', body: { texts: [REPLY_TA], to: 'hi' } }).catch(() => {});
await api('/translate', { token: amitTok, method: 'POST', body: { texts: [REPLY_TA], to: 'en' } }).catch(() => {});

const browser = await chromium.launch();
const B = await newPhone(browser, 'buyer');
const { page: b } = B;
const send = (p, label = 'Send') => p.locator(`button[aria-label="${label}"]`).last();

// d1 · sign in
await b.goto('/login'); await b.waitForLoadState('networkidle'); await sleep(800);
B.mark('d1', 'start');
await sleep(2500);
await tap(b.getByText('Explore as a demo business'), 900);
await smoothScroll(b, 'end', 1200); await sleep(1500);
await tap(b.getByText('Amit Hosiery', { exact: true }), 300);
await b.waitForURL(`${WEB}/`); await sleep(2600);
B.mark('d1', 'end');

// d2 · home
B.mark('d2', 'start');
await sleep(4200);
await smoothScroll(b, 520, 1400); await sleep(4200);
await smoothScroll(b, 0, 1200); await sleep(3500);
B.mark('d2', 'end');

// d3 · ask Claire
B.mark('d3', 'start');
await sleep(1200);
const prevIdsEarly = new Set(((await api('/requirements?limit=30', { token: amitTok })).requirements || []).map((r) => r.id));
await tap(b.getByText(/500 cotton T-shirts under/).first(), 2500);
const seeAll = b.getByRole('button', { name: /See all/ });
const twoWeeks = b.getByRole('button', { name: /^2 weeks$/ }).last();
await twoWeeks.waitFor({ timeout: 60000 }).catch(() => {});
await sleep(2200);
if (await twoWeeks.count()) await tap(twoWeeks, 300);
const prevIds = prevIdsEarly;
let newRq = null;
for (let i = 0; i < 240 && !newRq; i++) {
  await sleep(500);
  const list = (await api('/requirements?limit=5', { token: amitTok })).requirements || [];
  newRq = list.find((r) => !prevIds.has(r.id))?.id ?? null;
}
for (let i = 0; i < 20; i++) { if (await b.locator(`text=${'from ₹'}`).count()) break; await sleep(300); }
await sleep(1500);
await sleep(800);
await scrollInner(b, '[role="log"], main, div', 'end', 800);
await sleep(6500);
B.mark('d3', 'end');

// d4 · results
B.mark('d4', 'start');
await tap(b.getByRole('button', { name: /See all/ }).last(), 2600);
if (newRq && !b.url().includes(newRq)) { await b.goto(`/results/${newRq}`); await sleep(2000); }
const rqId = b.url().split('/results/')[1]?.split('?')[0];
await smoothScroll(b, 700, 2200); await sleep(3600);
await smoothScroll(b, 1400, 2200); await sleep(3000);
await smoothScroll(b, 0, 1500); await sleep(1500);
B.mark('d4', 'end');

// d5 · compare
B.mark('d5', 'start');
await tap(b.getByRole('tab', { name: /Compare/ }), 3200);
await smoothScroll(b, 600, 2000); await sleep(3500);
await smoothScroll(b, 'end', 2000); await sleep(4500);
B.mark('d5', 'end');

// d6 · insights
B.mark('d6', 'start');
await smoothScroll(b, 0, 600);
await tap(b.getByRole('tab', { name: /Insights/ }), 3000);
await smoothScroll(b, 400, 1500); await sleep(2800);
B.mark('d6', 'end');

// d7 · open a deal with Lakshmi Garments
B.mark('d7', 'start');
await smoothScroll(b, 0, 500);
await tap(b.getByRole('tab', { name: /Suppliers/ }), 1200);
const lakshmiCard = b.locator('article').filter({ hasText: 'Lakshmi Garments' }).first();
await lakshmiCard.scrollIntoViewIfNeeded(); await sleep(1500);
await tap(lakshmiCard.getByRole('button', { name: 'Chat', exact: true }), 300);
await b.waitForURL(/\/chat\/deal_/); await sleep(4500);
const dealUrl = b.url();
const convId = dealUrl.split('/chat/')[1];
await tap(b.locator('button').filter({ hasText: 'Cotton' }).first(), 2600);
await tap(b.locator('button').filter({ hasText: 'Cotton' }).first(), 1500);
B.mark('d7', 'end');

// d8 · price message → Claire's private tip → offer
B.mark('d8', 'start');
await typeSlow(b, MSG); await sleep(500);
await tap(send(b), 300);
await b.getByRole('button', { name: /Send offer to supplier/ }).waitFor({ timeout: 30000 });
await sleep(7000);
await tap(b.getByRole('button', { name: /Send offer to supplier/ }), 3500);
B.mark('d8', 'end');

// Lakshmi counters at ₹94 (her side is shown later, in Tamil).
const detail = await api(`/conversations/${convId}`, { token: lakshmiTok });
const offer = (detail.offers || []).find((o) => o.status === 'pending');
if (offer) await api(`/offers/${offer.id}/respond`, { token: lakshmiTok, method: 'POST', body: { action: 'counter', unitPrice: 94 } });

// d9 · counter offer arrives
B.mark('d9', 'start');
await b.getByText('Counter offer received').first().waitFor({ timeout: 20000 }).catch(() => {});
await sleep(1200);
await b.getByText('Counter offer received').first().scrollIntoViewIfNeeded().catch(() => {});
await sleep(9500);
B.mark('d9', 'end');

// d10 · accept → order card
B.mark('d10', 'start');
await tap(b.getByRole('button', { name: /^Accept$/ }), 1600);
await tap(b.getByRole('button', { name: /Yes, accept/ }), 4200);
await b.getByText(/Show all steps/).first().scrollIntoViewIfNeeded().catch(() => {});
await sleep(1500);
await tap(b.getByText(/Show all steps/).first(), 4500);
B.mark('d10', 'end');

// d11 · messages + orders tabs
B.mark('d11', 'start');
await b.goto('/chats'); await sleep(6500);
await tap(b.getByRole('link', { name: 'Orders' }), 6500);
B.mark('d11', 'end');

// d12 · profile and trust
B.mark('d12', 'start');
await tap(b.getByRole('link', { name: 'Profile' }), 4500);
await smoothScroll(b, 520, 2200); await sleep(4500);
await smoothScroll(b, 900, 1800); await sleep(4000);
B.mark('d12', 'end');

// d13 · seller storefront
B.mark('d13', 'start');
await b.goto('/store/b_lakshmi'); await sleep(3500);
await smoothScroll(b, 600, 2200); await sleep(4000);
B.mark('d13', 'end');

// d14 · Trade Desk (desktop console)
await api('/desk/status', { token: meenaTok, method: 'POST', body: { status: 'online' } }).catch(() => {});
await api('/desk/simulate-overdue', { token: meenaTok, method: 'POST', body: {} }).catch((e) => console.warn('overdue', e.message));
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, recordVideo: { dir: OUT + 'desk', size: { width: 1440, height: 900 } }, baseURL: WEB });
await dctx.addInitScript(TAP_JS);
const d = await dctx.newPage(); const dT0 = Date.now();
const dmark = (id, edge) => marks.push({ page: 'desk', id, edge, t: (Date.now() - dT0) / 1000 });
await d.goto('/login'); await d.waitForLoadState('networkidle');
await tap(d.getByText('Explore as a demo business'), 600);
await tap(d.getByText('Meena', { exact: true }), 300);
await d.waitForURL(/\/desk/); await sleep(3000);
dmark('d14', 'start');
await sleep(3500);
await d.getByText(/Amit Hosiery ↔ Lakshmi Garments/).first().click({ timeout: 5000 }).catch(() => {});
await sleep(4500);
await tap(d.getByRole('button', { name: /^Join/ }), 5000);
await sleep(4000);
await tap(d.getByRole('button', { name: /^Resolve/ }).first(), 3000);
dmark('d14', 'end');
await dctx.close();

// m1 · Lakshmi in Tamil
const S = await newPhone(browser, 'seller');
const { page: s } = S;
await s.goto('/login'); await s.waitForLoadState('networkidle');
await tap(s.getByText(/demo/i).first(), 600);
await tap(s.getByText('Lakshmi Garments', { exact: true }), 300);
await s.waitForURL(`${WEB}/`); await sleep(2500);
await s.goto('/chats'); await s.getByText('Amit Hosiery', { exact: true }).first().waitFor({ timeout: 20000 }).catch(() => {}); await sleep(1500);
await s.goto('/'); await sleep(2500);
S.mark('m1', 'start');
await sleep(5200);
await tap(s.getByRole('link', { name: /சாட்/ }), 300);
await s.getByText('Amit Hosiery', { exact: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
await sleep(5500);
S.mark('m1', 'end');

// m2 · her deal room, translated, Tamil reply
S.mark('m2', 'start');
await tap(s.getByText('Amit Hosiery', { exact: true }), 4200);
await scrollInner(s, 'div', 'end', 600);
await sleep(3500);
await typeSlow(s, REPLY_TA); await sleep(400);
await tap(send(s, 'அனுப்பு'), 3500);
S.mark('m2', 'end');

// m3 · Amit switches to Hindi
B.mark('m3', 'start');
await b.goto('/'); await sleep(1200);
await b.goto('/language'); await sleep(1600);
await tap(b.getByText('हिन्दी', { exact: true }).first(), 1500);
await b.goto('/'); await sleep(3200);
if (rqId) { await b.goto(`/results/${rqId}`); await sleep(3600); }
B.mark('m3', 'end');

// m4 · Lakshmi's Tamil reply shown in Hindi
B.mark('m4', 'start');
await b.goto(dealUrl); await sleep(5000);
await scrollInner(b, 'div', 'end', 600);
await sleep(6000);
B.mark('m4', 'end');

await B.ctx.close();
await S.ctx.close();
await browser.close();

const vid = (dir) => { const f = fs.readdirSync(OUT + dir).find((x) => x.endsWith('.webm')); return f ? OUT + dir + '/' + f : null; };
fs.writeFileSync(OUT + 'marks.json', JSON.stringify({ files: { buyer: vid('buyer'), seller: vid('seller'), desk: vid('desk') }, marks, rqId, convId }, null, 1));
console.log('done', marks.length, 'marks');
