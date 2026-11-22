import { chromium } from 'playwright';
const [,, phone, path, out, ...actions] = process.argv;
const tok = (await (await fetch('http://localhost:8787/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, otp: '123456' }) })).json()).token;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.addInitScript((t) => localStorage.setItem('cc_token', t), tok);
const p = await ctx.newPage(); await p.goto('http://localhost:5173' + path); await p.waitForTimeout(3500);
for (const a of actions) { const [k, v] = a.split('='); try { if (k === 'click') await p.getByText(v, { exact: false }).first().click({ timeout: 5000 }); if (k === 'role') await p.getByRole('button', { name: new RegExp(v) }).first().click({ timeout: 5000 }); if (k === 'fill') { const [sel, val] = v.split('|'); await p.locator(sel).first().fill(val); } if (k === 'wait') await p.waitForTimeout(+v); } catch (e) { console.log('fail', a, e.message.split('\n')[0]); } await p.waitForTimeout(900); }
await p.screenshot({ path: out, fullPage: true }); console.log(p.url()); console.log((await p.locator('main').innerText().catch(() => '')).slice(0, 1500)); await b.close();
