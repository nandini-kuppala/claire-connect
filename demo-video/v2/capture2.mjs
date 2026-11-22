// v2 capture: marketplace scenes on two phones at once (Amit EN, Lakshmi TA) + Trade Desk. One clock for all pages.
import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
const WEB = 'http://localhost:5173', API = 'http://localhost:8787/api';
const OUT = new URL('./raw/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[2] || 'market';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(); const now = () => (Date.now() - T0) / 1000;
const marks = []; const starts = {};
const mark = (id, edge) => { marks.push({ id, edge, t: now() }); console.log(id, edge, now().toFixed(1)); };
async function api(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`); return j;
}
const login = async (phone) => (await api('/auth/verify', { method: 'POST', body: { phone, otp: '123456' } })).token;
const TAP_JS = `addEventListener('pointerdown', (e) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:'+(e.clientX-22)+'px;top:'+(e.clientY-22)+'px;width:44px;height:44px;border-radius:50%;background:rgba(19,32,59,.18);border:2px solid rgba(19,32,59,.45);transition:transform .45s ease-out,opacity .45s ease-out;'; document.documentElement.appendChild(d); requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; }); setTimeout(() => d.remove(), 520); }, true);`;
async function phone(browser, name, token, desk = false) {
  const vp = desk ? { width: 1440, height: 860 } : { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: desk ? 1 : 2, isMobile: !desk, hasTouch: !desk, recordVideo: { dir: OUT + name, size: desk ? vp : { width: 780, height: 1688 } }, baseURL: WEB, locale: 'en-IN' });
  await ctx.addInitScript(TAP_JS); await ctx.addInitScript((t) => localStorage.setItem('cc_token', t), token);
  const page = await ctx.newPage(); starts[name] = now(); return { ctx, page };
}
const tap = async (loc, wait = 600) => { await loc.first().scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {}); await loc.first().click({ timeout: 15000 }); await sleep(wait); };
async function typeIn(page, loc, text, ms = 40) { await loc.click(); for (const ch of text) { await page.keyboard.insertText(ch); await sleep(ms); } }
async function scrollEnd(page) { await page.evaluate(() => { for (const el of document.querySelectorAll('div,main')) if (el.scrollHeight > el.clientHeight + 10 && getComputedStyle(el).overflowY !== 'visible') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }); }
async function smooth(page, y, ms = 1200) { await page.evaluate(([y, ms]) => new Promise((res) => { const el = document.scrollingElement; const f = el.scrollTop, to = y; const t0 = performance.now(); const st = (t) => { const k = Math.min(1, (t - t0) / ms); el.scrollTop = f + (to - f) * (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); k < 1 ? requestAnimationFrame(st) : res(); }; requestAnimationFrame(st); }), [y, ms]); }
const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' }).catch(() => {});

const browser = await chromium.launch();
const amitT = await login('9000000001'), lakT = await login('9000000002'), meenaT = await login('9000000901');
await api('/me', { token: amitT, method: 'PATCH', body: { language: 'en' } });
await api('/me', { token: lakT, method: 'PATCH', body: { language: 'ta' } });
await api('/claire/reset', { token: amitT, method: 'POST' }).catch(() => {});
const MSG1 = 'Hi Lakshmi, I need 1,000 cotton T-shirts for my shops in Kolkata. Can you send a sample first?';
const REPLY1 = 'வணக்கம் அமித்! கண்டிப்பாக, மாதிரி இரண்டு நாளில் அனுப்புகிறேன்.';
const MSG2 = 'The sample quality is good. Can you do ₹90 per piece for 1,000 pieces?';
for (const [t, to] of [[MSG1, 'ta'], [REPLY1, 'en'], [MSG2, 'ta']]) await api('/translate', { token: amitT, method: 'POST', body: { texts: [t], to } }).catch(() => {});

if (ONLY === 'market') {
  const A = await phone(browser, 'amit', amitT), L = await phone(browser, 'lakshmi', lakT);
  const a = A.page, l = L.page;
  await Promise.all([a.goto('/'), l.goto('/')]); await sleep(4000);
  // s07 · ask Claire
  mark('s07', 'start'); await sleep(1500);
  await typeIn(a, a.getByPlaceholder(/Tell me what you need/).first(), '1000 cotton T-shirts under ₹120, Kolkata', 45);
  await a.keyboard.press('Enter'); await sleep(2500);
  const quick = a.getByRole('button', { name: /^2 weeks$/ }).last();
  await quick.waitFor({ timeout: 45000 }).catch(() => {}); if (await quick.count()) { await sleep(1500); await tap(quick, 500); }
  await a.getByRole('button', { name: /See all/ }).last().waitFor({ timeout: 90000 }).catch(() => {}); await sleep(1200); await scrollEnd(a); await sleep(3500);
  await tap(a.getByRole('button', { name: /See all/ }).last(), 2500); await smooth(a, 500, 1500); await sleep(2500); await smooth(a, 0, 800);
  mark('s07', 'end');
  // s08 · open the chat, live translated exchange
  mark('s08', 'start');
  const card = a.locator('article').filter({ hasText: 'Lakshmi Garments' }).first();
  await card.scrollIntoViewIfNeeded(); await sleep(800);
  await tap(card.getByRole('button', { name: 'Chat', exact: true }), 300); await a.waitForURL(/\/chat\/deal_/, { timeout: 30000 }); await sleep(2500);
  const convId = a.url().split('/chat/')[1];
  await l.goto('/chat/' + convId); await sleep(3000);
  await typeIn(a, a.locator('textarea').last(), MSG1, 30); await tap(a.locator('button[aria-label="Send"]').last(), 300);
  await sleep(5500); await scrollEnd(l); await sleep(1500);
  await typeIn(l, l.locator('textarea').last(), REPLY1, 45); await tap(l.locator('button[aria-label="அனுப்பு"]').last(), 300);
  await sleep(5000); await scrollEnd(a); await sleep(2000);
  mark('s08', 'end');
  // s09 · sample → offer → tip → counter → accept → order
  mark('s09', 'start');
  try { await tap(a.getByText('Request sample').last(), 1200); } catch { await shot(a, 'fail-sample'); }
  await tap(a.getByRole('button', { name: 'S', exact: true }).last(), 600);
  await tap(a.getByRole('button', { name: /Send request/i }).last(), 3500);
  await scrollEnd(l); await sleep(2500);
  mark('s09', 'sampled');
  await typeIn(a, a.locator('textarea').last(), MSG2, 28); await tap(a.locator('button[aria-label="Send"]').last(), 300);
  await a.getByRole('button', { name: /Send offer to supplier/ }).waitFor({ timeout: 40000 }).catch(() => shot(a, 'fail-tip'));
  await sleep(3500); await tap(a.getByRole('button', { name: /Send offer to supplier/ }), 3000);
  await scrollEnd(l); await sleep(1500);
  const detail = await api(`/conversations/${convId}`, { token: lakT });
  const offer = (detail.offers || []).find((o) => o.status === 'pending');
  if (offer) await api(`/offers/${offer.id}/respond`, { token: lakT, method: 'POST', body: { action: 'counter', unitPrice: 94 } });
  await a.getByText('Counter offer received').first().waitFor({ timeout: 20000 }).catch(() => {}); await sleep(1500);
  await a.getByText('Counter offer received').first().scrollIntoViewIfNeeded().catch(() => {}); await sleep(2500);
  await tap(a.getByRole('button', { name: /^Accept$/ }).last(), 1300); await tap(a.getByRole('button', { name: /Yes, accept/ }), 3500);
  await scrollEnd(a); await scrollEnd(l); await sleep(4500);
  mark('s09', 'end');
  await A.ctx.close(); await L.ctx.close();
  fs.writeFileSync(OUT + 'market.json', JSON.stringify({ starts, marks, convId }, null, 1));
}

if (ONLY === 'goods') {
  const mT = await login('9000001005'), pT = await login('9000001006');
  await api('/me', { token: mT, method: 'PATCH', body: { language: 'en' } });
  await api('/me', { token: pT, method: 'PATCH', body: { language: 'en' } });
  const meP = await api('/me', { token: pT }); const priyaId = (meP.user || meP).business_id;
  // Fresh cut pieces in Murali's unit, so the hand-off draws from real stock.
  const RUN = Math.random().toString(36).slice(2, 6).toUpperCase(); const STYLE = 'NV' + RUN;
  const navy = (await api('/sc/specs/resolve', { token: mT, method: 'POST', body: { material_type_id: 'mt_knit_fabric', attrs: { state: 'finished', structure: 'single jersey', gsm: 180, colour: 'navy' } } })).spec.id;
  const kit = {}; for (const z of ['S', 'M']) kit[z] = (await api('/sc/specs/resolve', { token: mT, method: 'POST', body: { material_type_id: 'mt_kit', attrs: { style: STYLE, colour: 'navy', size: z } } })).spec.id;
  await api('/sc/made', { token: mT, method: 'POST', body: { process_key: 'cutting', inputs: [{ spec_id: navy, qty: 100, unit: 'kg', lot: 'L' + RUN }], outputs: [{ spec_id: kit.S, qty: 200, unit: 'pcs', lot: 'L' + RUN }, { spec_id: kit.M, qty: 200, unit: 'pcs', lot: 'L' + RUN }], client_id: crypto.randomUUID(), allow_untracked: true, untracked_reason: 'demo opening stock' } });
  const CODE = fs.readFileSync(new URL('./raw/flow_code.txt', import.meta.url), 'utf8').trim();
  const Mu = await phone(browser, 'murali', mT), Pr = await phone(browser, 'priya', pT);
  const m = Mu.page, p = Pr.page;
  let saved = null; m.on('response', async (r) => { if (/\/api\/sc\/drafts\/[^/]+\/save$/.test(r.url())) { try { saved = await r.json(); } catch {} } });
  await Promise.all([m.goto('/goods'), p.goto('/goods?tab=coming')]); await sleep(4000);
  // s11 · Murali tells Claire; Priya confirms what arrived
  mark('s11', 'start'); await sleep(1200);
  await m.goto('/'); await sleep(1500);
  await typeIn(m, m.getByPlaceholder(/Tell me what you need/).first(), 'Sent 400 navy kits to Priya Stitching for stitching, S and M', 40);
  await m.keyboard.press('Enter');
  const save = m.getByRole('button', { name: /^Save$/ }).last();
  await save.waitFor({ timeout: 60000 }).catch(() => shot(m, 'fail-draft')); await sleep(2500);
  await tap(save, 2500);
  for (let i = 0; i < 20 && !saved; i++) await sleep(300);
  const mv = saved?.movement?.id || saved?.movementId || saved?.card?.movementId;
  console.log('saved', JSON.stringify(saved).slice(0, 200));
  if (mv) await api(`/sc/movements/${mv}/share-now`, { token: mT, method: 'POST', body: {} }).catch((e) => console.warn(e.message));
  await p.reload(); await sleep(3000);
  if (mv) { await p.goto('/goods/movement/' + mv); } else { await tap(p.getByText('Murali Garments (demo)').first(), 1500); }
  await sleep(2500);
  const fig = p.locator('input').first(); await fig.click(); await fig.fill(''); await sleep(300); for (const ch of '198') { await p.keyboard.insertText(ch); await sleep(160); }
  await sleep(1200); await tap(p.getByRole('button', { name: /^Confirm/ }).last(), 3500);
  await m.goto('/goods?tab=out'); await sleep(4500);
  mark('s11', 'end');
  // s12 · flow view
  mark('s12', 'start');
  await m.goto('/goods/run/style/' + CODE); await sleep(4500);
  await smooth(m, 650, 2200); await sleep(2500); await smooth(m, 1500, 2200); await sleep(2000);
  mark('s12', 'end');
  // s13 · private Claire in Tamil
  await api('/me', { token: mT, method: 'PATCH', body: { language: 'ta' } });
  await m.goto('/'); await sleep(3500);
  mark('s13', 'start'); await sleep(800);
  await typeIn(m, m.locator('input, textarea').first(), 'பிரியா ஸ்டிச்சிங்கிடம் என்ன இருக்கு?', 70);
  await m.keyboard.press('Enter');
  await m.getByText(/From your records|உங்கள் பதிவுகளில்/).first().waitFor({ timeout: 60000 }).catch(() => shot(m, 'fail-ask'));
  await sleep(1500); await scrollEnd(m); await sleep(4000);
  mark('s13', 'end');
  await api('/me', { token: mT, method: 'PATCH', body: { language: 'en' } });
  await Mu.ctx.close(); await Pr.ctx.close();
}
if (ONLY === 'desk') {
  await api('/desk/status', { token: meenaT, method: 'POST', body: { status: 'online' } }).catch(() => {});
  await api('/desk/simulate-overdue', { token: meenaT, method: 'POST', body: {} }).catch((e) => console.warn('overdue', e.message));
  const D = await phone(browser, 'desk', meenaT, true); const d = D.page;
  await d.goto('/desk'); await sleep(4000);
  mark('s14', 'start'); await sleep(2000);
  await d.getByText(/Amit Hosiery ↔ Lakshmi Garments/).first().click({ timeout: 8000 }).catch(() => {}); await sleep(3500);
  await tap(d.getByRole('button', { name: /^Join/ }), 4000);
  await d.getByText(/Before you joined/).first().click({ timeout: 4000 }).catch(() => {}); await sleep(3500);
  await tap(d.getByRole('button', { name: /^Resolve/ }).first(), 3000).catch(() => {});
  mark('s14', 'end');
  await D.ctx.close();
  fs.writeFileSync(OUT + 'desk.json', JSON.stringify({ starts, marks }, null, 1));
}
await browser.close();
const vids = {}; for (const n of Object.keys(starts)) { const f = fs.readdirSync(OUT + n).filter((x) => x.endsWith('.webm')).map((x) => OUT + n + '/' + x).sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs)[0]; vids[n] = f; }
const prev = fs.existsSync(OUT + 'all.json') ? JSON.parse(fs.readFileSync(OUT + 'all.json')) : {};
fs.writeFileSync(OUT + 'all.json', JSON.stringify({ ...prev, [ONLY]: { starts, marks, vids } }, null, 1));
console.log('done', ONLY);
