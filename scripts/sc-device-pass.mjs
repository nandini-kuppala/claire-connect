// Device pass (4x CPU, slow 4G, 360x740 phone) against the PRODUCTION build served by a local API on :8795.
// Usage: npm run build -w web; (cd server && SC_ENABLED=1 MONGODB_DB=nexconn_sc_dev PORT=8795 SC_REMINDERS=0 npx tsx src/index.ts &)
//        node scripts/sc-device-pass.mjs <scratch-dir> <token>   (token: POST /api/auth/verify on :8795; needs Google Chrome)
// 4x CPU + slow 4G (Lighthouse "slow 4G": 150 ms RTT, 1.6 Mbps down) on a 360x740 phone, against the production build.
// Time from navigation start until the screen's main heading and content are on the page (data loaded).
import { spawn } from 'node:child_process';
const [,, dir, token] = process.argv;
const port = 9334, base = 'http://localhost:8795';
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}/chrome-prof2`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://localhost:${port}/json`)).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let n = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const cmd = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cmd('Page.enable'); await cmd('Network.enable');
await cmd('Page.navigate', { url: base + '/login' }); await sleep(2500);
await ev(`localStorage.setItem('cc_token', ${JSON.stringify(token)})`);
await cmd('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
await cmd('Emulation.setCPUThrottlingRate', { rate: 4 });
await cmd('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
const screens = [['Goods home', '/goods', 'main h1'], ['Flow index', '/goods/flow', 'main a, main button[class*="rounded"]'], ['Flow of a style', '/goods/run/style/FL55QO', 'main section'], ['Reports', '/goods/reports', 'main li, main table'], ['Send for work', '/goods/record/send', 'main input, main button']];
for (const [warm] of [['cold'], ['warm']]) {
  for (const [name, path, sel] of screens) {
    if (warm === 'cold') await cmd('Network.clearBrowserCache');
    await cmd('Page.navigate', { url: base + path });
    const t0 = Date.now(); let ok = false;
    while (Date.now() - t0 < 30000) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)}) && !document.querySelector('.animate-pulse')`)) { ok = true; break; } await sleep(100); }
    const longTasks = await ev(`performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd|0`);
    console.log(`${warm.padEnd(5)} ${name.padEnd(16)} ${ok ? ((Date.now() - t0) / 1000).toFixed(1) + ' s' : 'TIMEOUT'}  (DOMContentLoaded ${(longTasks / 1000).toFixed(1)} s)`);
  }
}
ws.close(); chrome.kill();
