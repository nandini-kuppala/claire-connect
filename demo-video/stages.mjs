// Renders 1920x1080 stage backgrounds (intro slides + per-scene caption panels with an empty phone/browser frame).
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = new URL('./stages/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const BOT = `<g><path d="M60 30v-9" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="18" r="6" fill="#fff"/><rect x="20" y="52" width="10" height="26" rx="5" fill="#fff"/><rect x="90" y="52" width="10" height="26" rx="5" fill="#fff"/><rect x="26" y="30" width="68" height="64" rx="26" fill="#fff"/><rect x="33" y="42" width="54" height="38" rx="17" fill="#13203B"/><path d="M43 61c3-5 8-5 11 0M66 61c3-5 8-5 11 0M53 69c4 4 10 4 14 0" stroke="#55D6B4" stroke-width="4" stroke-linecap="round" fill="none"/></g>`;
const LOGO = (h) => `<svg viewBox="0 0 140 130" height="${h}" width="${(h * 140) / 130}"><path d="M30 16c22-12 64-14 88 2 14 9 17 40 12 66-5 25-30 40-62 42-26 2-50-8-58-30C2 72 4 30 30 16Z" fill="#3DB394"/><path d="M8 98c6 14 22 24 42 27-16 1-32-6-40-16-2-3-3-7-2-11Z" fill="#2E9C80"/><circle cx="30" cy="34" r="9" fill="#fff"/><path d="M113 4l-3 9M126 10l-7 7M132 24l-9 2" stroke="#3DB394" stroke-width="5" stroke-linecap="round"/><g transform="translate(14 22) scale(0.86)">${BOT}</g></svg>`;
const MARK = (s) => `<svg viewBox="0 0 120 120" width="${s}" height="${s}"><circle cx="60" cy="60" r="60" fill="#3DB394"/><g transform="translate(0 6)">${BOT}</g></svg>`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{width:1920px;height:1080px;background:#fff;font-family:Figtree,sans-serif;color:#13203B;overflow:hidden;position:relative}
.h{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.02em}
.brand{position:absolute;left:120px;top:72px;display:flex;align-items:center;gap:14px;font-family:'Bricolage Grotesque';font-weight:800;font-size:30px}
.brand b{color:#3DB394}
.kicker{display:inline-flex;align-items:center;gap:10px;padding:10px 20px;border-radius:999px;background:#E6F6F1;color:#1F8C73;font-weight:700;font-size:22px}
.foot{position:absolute;left:120px;bottom:64px;color:#667085;font-size:20px;font-weight:500}
.dot{width:10px;height:10px;border-radius:50%;background:#3DB394;display:inline-block}
`;

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
const brandRow = `<div class="brand">${LOGO(52)}<span>CLAIRE <b>Connect</b></span></div>`;

// ── Intro + outro slides ────────────────────────────────────────────────
const slides = {
  i1: page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      ${LOGO(200)}
      <div class="h" style="font-size:112px;margin-top:28px;line-height:1">CLAIRE <span style="color:#3DB394">Connect</span></div>
      <div style="font-size:38px;color:#3A465C;margin-top:30px;max-width:1200px;line-height:1.35">The trade chat for India's garment supply chain.<br/>Find suppliers, negotiate and trade with trust, in your own language.</div>
      <div class="kicker" style="margin-top:48px">Nexconn Build Challenge 2026 · Marketplace &amp; Support</div>
    </div>`),
  i2: page(`${brandRow}
    <div style="position:absolute;left:120px;top:230px"><div class="kicker">The market</div>
      <div class="h" style="font-size:84px;line-height:1.05;margin-top:28px;max-width:1500px">Tiruppur, Tamil Nadu<br/><span style="color:#3DB394">India's knitwear capital</span></div></div>
    <div style="position:absolute;left:120px;top:600px;display:flex;gap:40px">
      ${[['~20,000', 'units that knit, dye, print<br/>and stitch garments'], ['~90%', "of India's cotton<br/>knitwear exports"], ['~8', 'vendors can touch<br/>a single order']].map(([n, t]) => `
      <div style="width:470px;padding:40px 44px;border:2px solid #E7E9EC;border-radius:32px">
        <div class="h" style="font-size:88px;color:#1F8C73;line-height:1">${n}</div>
        <div style="font-size:28px;color:#3A465C;margin-top:18px;line-height:1.35">${t}</div></div>`).join('')}
    </div>
    <div class="foot">Sources: TEA via Upstox 2026 · Outlook Business</div>`),
  i3: page(`${brandRow}
    <div style="position:absolute;left:120px;top:230px"><div class="kicker" style="background:#F7E4DB;color:#B9502F">The problem</div>
      <div class="h" style="font-size:80px;line-height:1.05;margin-top:28px;max-width:1500px">Trade still runs on calls,<br/>WhatsApp and guesswork</div></div>
    <div style="position:absolute;left:120px;top:610px;display:grid;grid-template-columns:repeat(4,400px);gap:28px">
      ${[['📞', 'Phone calls &amp; WhatsApp', 'No prices, no records'], ['अ ↔ த', 'Hindi buyers, Tamil makers', 'Every deal lost in translation'], ['8×', 'Fragmented supply chain', 'One order, many vendors'], ['?', 'No trust signals', 'Who pays on time?']].map(([i, t, s]) => `
      <div style="padding:36px;border-radius:30px;background:#F3F4F6">
        <div class="h" style="font-size:44px;color:#B9502F;height:60px">${i}</div>
        <div style="font-size:29px;font-weight:700;margin-top:18px;line-height:1.25">${t}</div>
        <div style="font-size:24px;color:#667085;margin-top:10px">${s}</div></div>`).join('')}
    </div>`),
  i4: page(`${brandRow}
    <div style="position:absolute;left:120px;top:220px"><div class="kicker">The solution</div>
      <div class="h" style="font-size:78px;line-height:1.05;margin-top:28px">Claire, an AI trade assistant,<br/>inside a translated trade chat</div></div>
    <div style="position:absolute;left:120px;top:620px;display:flex;align-items:stretch;gap:18px">
      ${[['Ask', 'in any language, by text or voice'], ['Match', 'suppliers, or split one order across 2–3'], ['Negotiate', 'every message translated, private AI tips'], ['Order', 'GST, payments, two-way ratings'], ['Trade Desk', 'human agents step in when needed']].map(([t, s], i) => `
      <div style="width:316px;padding:34px 30px;border-radius:30px;border:2px solid ${i === 0 ? '#3DB394' : '#E7E9EC'};background:${i === 0 ? '#E6F6F1' : '#fff'}">
        <div style="font-size:22px;font-weight:700;color:#1F8C73">0${i + 1}</div>
        <div class="h" style="font-size:40px;margin-top:10px">${t}</div>
        <div style="font-size:24px;color:#3A465C;margin-top:12px;line-height:1.35">${s}</div></div>`).join('')}
    </div>`),
  i5: page(`${brandRow}
    <div style="position:absolute;left:120px;top:220px"><div class="kicker">Built on Nexconn</div>
      <div class="h" style="font-size:78px;line-height:1.05;margin-top:28px">Every conversation runs<br/>on the Nexconn Chat SDK</div></div>
    <div style="position:absolute;left:120px;top:600px;display:grid;grid-template-columns:repeat(3,540px);gap:24px">
      ${[['Group channels', 'One deal room per buyer–seller deal'], ['Custom message cards', 'Offers, orders, ratings, results'], ['Targeted messages', "Claire's private tips, one person only"], ['System channel', 'Order and payment updates'], ['Built-in translation', 'Receiver-side, with an AI fallback'], ['+ Sarvam · OpenRouter · Atlas', 'Indian voice, AI matching, data']].map(([t, s], i) => `
      <div style="padding:30px 34px;border-radius:28px;background:${i < 5 ? '#E6F6F1' : '#F3F4F6'}">
        <div style="font-size:31px;font-weight:700">${t}</div>
        <div style="font-size:24px;color:#3A465C;margin-top:8px">${s}</div></div>`).join('')}
    </div>`),
  o1: page(`
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      ${LOGO(170)}
      <div class="h" style="font-size:96px;margin-top:24px;line-height:1">CLAIRE <span style="color:#3DB394">Connect</span></div>
      <div style="font-size:40px;color:#3A465C;margin-top:30px;line-height:1.4">Find suppliers · Negotiate · Order · Build trust<br/><b style="color:#1F8C73">In your own language</b></div>
      <div class="kicker" style="margin-top:48px">Built on the Nexconn Chat SDK</div>
    </div>`),
};

// ── Scene panels (phone on the right) ───────────────────────────────────
const S = (chapter, title, bullets, tone = '#E6F6F1', toneInk = '#1F8C73') => page(`${brandRow}
  <div style="position:absolute;left:120px;top:300px;width:900px">
    <div class="kicker" style="background:${tone};color:${toneInk}">${chapter}</div>
    <div class="h" style="font-size:72px;line-height:1.06;margin-top:28px">${title}</div>
    <div style="margin-top:40px;display:flex;flex-direction:column;gap:22px">
      ${bullets.map((b) => `<div style="display:flex;gap:18px;align-items:flex-start;font-size:32px;color:#3A465C;line-height:1.35"><span style="margin-top:14px;width:14px;height:14px;border-radius:50%;background:#3DB394;flex:none"></span><span>${b}</span></div>`).join('')}
    </div>
  </div>
  <div style="position:absolute;left:1236px;top:66px;width:448px;height:948px;border-radius:66px;background:#13203B"></div>`);

const scenes = {
  d1: S('Product demo', 'Sign in, or try a demo business', ['Phone number and OTP sign in', 'Demo accounts for buyers, sellers and agents']),
  d2: S('Buyer · Home', 'Just tell Claire what you need', ['Type, speak, browse or use a template', 'Example requests for first-time users']),
  d3: S('Buyer · Ask', 'Ask in plain words', ['Claire reads quantity, budget and city', 'One quick question, then matched suppliers']),
  d4: S('Buyer · Results', 'Matched suppliers, ranked', ["Claire's recommendation first", 'Trust score, ratings, stock and ready-in days']),
  d5: S('Buyer · Compare', 'Compare side by side', ['Best value in every row highlighted', 'Claire explains which to choose']),
  d6: S('Buyer · Insights', 'Know the market price', ['Price band and where your budget sits', 'Freight estimate to your city']),
  d7: S('Deal room', 'A Nexconn group channel per deal', ['Requirement pinned at the top', 'Quick replies ready below']),
  d8: S('Negotiate', "Claire's private tip", ['A targeted message only the buyer sees', 'One tap turns it into a formal offer'], '#FDF4E3', '#8A5A12'),
  d9: S('Negotiate', 'Counter offers as clear cards', ['Custom Nexconn message cards', 'Smart replies suggest the next move']),
  d10: S('Order', 'From deal to order in one tap', ['GST worked out automatically', 'Step-by-step progress for both sides']),
  d11: S('Track', 'Every deal at a glance', ['Live status on every chat', 'All orders in one place']),
  d12: S('Trust', 'Trust works both ways', ['Verification, ratings, payments, replies', 'Buyers are rated on paying on time too']),
  d13: S('Seller', 'A storefront for every seller', ['Badges and vouches from partners', 'Products with price and minimum order']),
  m1: S('Multilingual · தமிழ்', 'The seller sees everything in Tamil', ['Home, messages and Claire in Tamil', 'Same app, same data']),
  m2: S('Multilingual · தமிழ்', 'Translated deal chat', ["Amit's English arrives in Tamil", 'Lakshmi replies in Tamil']),
  m3: S('Multilingual · हिन्दी', 'Switch to Hindi in one tap', ['Home, Claire and results in Hindi']),
  m4: S('Multilingual · हिन्दी', 'Tamil in, Hindi out', ["Lakshmi's Tamil reply, read in Hindi", 'No shared language needed']),
};

// ── Desk panel (wide browser frame) ─────────────────────────────────────
const desk = page(`${brandRow}
  <div style="position:absolute;right:120px;top:70px;display:flex;align-items:center;gap:16px">
    <div class="kicker" style="background:#F7E4DB;color:#B9502F">Support · Human agent dispatch</div>
    <div class="h" style="font-size:40px">The Trade Desk</div></div>
  <div style="position:absolute;left:220px;top:170px;width:1480px;height:870px;border-radius:30px;background:#13203B"></div>
  <div style="position:absolute;left:240px;top:186px;display:flex;gap:10px"><span style="width:14px;height:14px;border-radius:50%;background:#B9502F"></span><span style="width:14px;height:14px;border-radius:50%;background:#E9A23B"></span><span style="width:14px;height:14px;border-radius:50%;background:#3DB394"></span></div>`);

const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
for (const [k, html] of Object.entries({ ...slides, ...scenes, d14: desk })) {
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: OUT + k + '.png' });
}
// Rounded masks for the phone screen and the desk browser screen.
await p.setContent(`<body style="margin:0;background:#000"><div style="width:416px;height:900px;border-radius:52px;background:#fff"></div></body>`);
await p.setViewportSize({ width: 416, height: 900 });
await p.screenshot({ path: OUT + 'mask_phone.png' });
await p.setViewportSize({ width: 1440, height: 810 });
await p.setContent(`<body style="margin:0;background:#000"><div style="width:1440px;height:810px;border-radius:0 0 22px 22px;background:#fff"></div></body>`);
await p.screenshot({ path: OUT + 'mask_desk.png' });
await br.close();
console.log('stages ok');
