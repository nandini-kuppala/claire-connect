// Stage backgrounds for the demo scenes: caption panel + one or two phone frames (screens are filled by ffmpeg).
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = new URL('./stages/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(new URL('./anim.html', import.meta.url), 'utf8');
const head = html.split('<body>')[0];
const LOGO = html.match(/const LOGO = \(h\) => `([\s\S]*?)`;/)[1];
const logo = (h) => LOGO.replace(/\$\{h\}/g, h).replace(/\$\{\(h \* 140\) \/ 130\}/g, (h * 140) / 130);
const brand = `<div class="brand" style="left:96px;right:auto;top:64px">${logo(46)}<span>CLAIRE <b>Connect</b></span></div>`;
const caption = (k, title, bullets, tone = '') => `
  <div class="abs" style="left:96px;top:250px;width:560px">
    <div class="kicker ${tone}">${k}</div>
    <div class="h" style="font-size:54px;line-height:1.06;margin-top:22px">${title}</div>
    <div style="margin-top:30px;display:flex;flex-direction:column;gap:18px">${bullets.map((b) => `<div style="display:flex;gap:14px;font-size:26px;color:#3A465C;line-height:1.35"><span style="margin-top:12px;width:12px;height:12px;border-radius:50%;background:#3DB394;flex:none"></span><span>${b}</span></div>`).join('')}</div>
  </div>`;
// Two phones: screens at (716,120) and (1276,120), 416x900. One phone: screen at (1252,120).
const phone = (x, label, sub) => `<div class="abs" style="left:${x - 16}px;top:104px;width:448px;height:932px;border-radius:66px;background:#13203B"></div>
  <div class="abs" style="left:${x - 16}px;top:40px;width:448px;text-align:center"><span class="pill" style="background:#F3F4F6;font-size:21px;padding:6px 18px 6px 8px;align-items:center"><b style="display:inline-flex;align-items:center">${label}</b><span style="color:#667085;font-weight:600">${sub}</span></span></div>`;
const live = `<div class="abs" style="left:1148px;top:520px;width:112px;display:flex;flex-direction:column;align-items:center;gap:10px">
  <svg width="112" height="40"><path d="M8 20h96" stroke="#3DB394" stroke-width="4" stroke-dasharray="8 8"/><circle cx="56" cy="20" r="9" fill="#3DB394"/></svg>
  <div style="font-size:17px;font-weight:800;color:#1F8C73;text-align:center;line-height:1.2">Nexconn<br>live</div></div>`;
const leftOnly = (cap, a) => `${cap}${phone(716, a[0], a[1])}`;
const two = (cap, a, b, showLive = true) => `${cap}${phone(716, a[0], a[1])}${phone(1276, b[0], b[1])}${showLive ? live : ''}`;
const one = (cap, a) => `${cap}${phone(1252, a[0], a[1])}`;
const av = (t, c) => `<span style="display:inline-flex;width:34px;height:34px;border-radius:50%;background:${c};color:#fff;font-size:15px;font-weight:800;align-items:center;justify-content:center;margin-right:8px">${t}</span>`;
// Inside a chat the header shows the OTHER person (like WhatsApp), so each label says whose phone it is and who they chat with.
const A7 = [av('AH', '#2E6B5E') + "Amit's phone", ' · buyer, Kolkata · हिन्दी'];
const A = [av('AH', '#2E6B5E') + "Amit's phone", ' · chatting with Lakshmi'], L = [av('LG', '#B7862F') + "Lakshmi's phone", ' · chatting with Amit'], M = ['Murali', ' · garment maker'], PR = ['Priya', ' · stitching unit'];
const stages = {
  s07: leftOnly(caption('Live demo · Ask', 'Ask Claire for what you need', ['Typed or spoken, in 10 languages', 'Makers ranked by price, trust and delivery']), A7),
  s08base: leftOnly(caption('Nexconn group channel', 'One live chat, two languages', ['Amit writes Hindi, Lakshmi reads Tamil', 'Her Tamil reply reaches him in Hindi', 'Each chat shows the other person at the top']), A),
  s08: two(caption('Nexconn group channel', 'One live chat, two languages', ['Amit writes Hindi, Lakshmi reads Tamil', 'Her Tamil reply reaches him in Hindi', 'Each chat shows the other person at the top']), A, L),
  s09: two(caption('Sample → order', 'From a sample to a 1,000-piece order', ['Sample delivered to his door first', "Claire's private tip: sellers settle 3–6% lower", 'Listed ₹98 → offer ₹90 → deal at ₹94', 'Order with GST on both phones']), A, L),
  s09b: two(caption('Ratings, both ways', 'Everyone sees the standards kept', ['Buyers rate makers on quality, value and delivery', 'Makers rate buyers on paying on time', 'Ratings feed a trust score on every profile']), ["Lakshmi's seller rating", ''], ["Amit's buyer rating", ''], false),
  s11: two(caption('Track production', 'Every hand-off, confirmed by both sides', ['Murali records it by telling Claire', 'Priya confirms what actually arrived', 'Differences are flagged, never overwritten'], 'amber'), M, PR),
  s12: one(caption('Flow view', 'Where is every piece, right now?', ['Overview: progress and where each piece is', 'Stages: what is done, what is late', 'Buyers: sent, received, differences']), M),
  s13: one(caption('Private Claire · தமிழ்', 'Ask your own records, in Tamil', ['Answers come from your own records', 'Each line links to its record']), M),
  s14: `<div class="abs" style="right:110px;top:70px;display:flex;align-items:center;gap:16px"><div class="kicker red">If something goes wrong</div><div class="h" style="font-size:40px">The Trade Desk</div></div>
    <div class="abs" style="left:220px;top:150px;width:1480px;height:890px;border-radius:30px;background:#13203B"></div>
    <div class="abs" style="left:242px;top:166px;display:flex;gap:10px"><span style="width:14px;height:14px;border-radius:50%;background:#B9502F"></span><span style="width:14px;height:14px;border-radius:50%;background:#E9A23B"></span><span style="width:14px;height:14px;border-radius:50%;background:#3DB394"></span></div>`,
};
const br = await chromium.launch(); const p = await br.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [k, body] of Object.entries(stages)) { await p.setContent(`${head}<body>${brand}${body}</body></html>`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: OUT + k + '.png' }); }
await p.setViewportSize({ width: 560, height: 90 }); await p.setContent(`${head}<body style="background:transparent"><div style="display:inline-flex;align-items:center;gap:12px;padding:16px 26px;border-radius:999px;background:#13203B;color:#fff;font-weight:700;font-size:26px;font-family:Figtree">2 days later · sample delivered to Amit's shop</div></body></html>`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.locator('body > div').screenshot({ path: OUT + 'pill_sample.png', omitBackground: true });
await p.setViewportSize({ width: 416, height: 900 }); await p.setContent(`<body style="margin:0;background:#000"><div style="width:416px;height:900px;border-radius:52px;background:#fff"></div></body>`); await p.screenshot({ path: OUT + 'mask_phone.png' });
await p.setViewportSize({ width: 1440, height: 860 }); await p.setContent(`<body style="margin:0;background:#000"><div style="width:1440px;height:860px;border-radius:0 0 22px 22px;background:#fff"></div></body>`); await p.screenshot({ path: OUT + 'mask_desk.png' });
await br.close(); console.log('stages ok');
