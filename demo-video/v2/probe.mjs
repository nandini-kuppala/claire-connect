import { chromium } from 'playwright';
const [,, tok, path] = process.argv;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript((t) => localStorage.setItem('cc_token', t), tok);
const p = await ctx.newPage(); await p.goto('http://localhost:5173' + path); await p.waitForTimeout(4000);
const el = p.getByText('Lakshmi Garments').first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
console.log(await el.evaluate((e) => { let x = e; for (let i = 0; i < 6; i++) x = x.parentElement; return x.tagName + ' ' + x.outerHTML.replace(/class="[^"]*"/g, '').slice(0, 1500); }));
await p.screenshot({ path: 'v2/x3.png' }); await b.close();
