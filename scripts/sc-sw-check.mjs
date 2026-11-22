// Service worker check: register, precache, then an offline cold start, in headless Chrome against the production
// build on :8795 (see sc-device-pass.mjs for how to start it). Usage: node scripts/sc-sw-check.mjs <scratch-dir>
// Headless Chrome over CDP: load the built app, wait for the service worker, go offline, cold-reload, check it renders.
import { spawn } from 'node:child_process';
const port = 9333, base = 'http://localhost:8795';
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${process.argv[2]}/chrome-prof`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://localhost:${port}/json`)).json(); break; } catch { await sleep(250); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let n = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const cmd = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cmd('Page.enable'); await cmd('Network.enable');
await cmd('Page.navigate', { url: base + '/login' }); await sleep(4000);
console.log('controller/registration:', await ev(`(async()=>{const r=await navigator.serviceWorker.getRegistration(); return JSON.stringify({reg: !!r, state: r?.active?.state})})()`));
await sleep(4000);
console.log('caches:', await ev(`(async()=>{const o={}; for (const k of await caches.keys()){const ks=await (await caches.open(k)).keys(); o[k]=ks.length+' entries, api cached: '+ks.some(r=>new URL(r.url).pathname.startsWith('/api/'))} return JSON.stringify(o)})()`));
await cmd('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await cmd('Page.navigate', { url: base + '/goods/flow' }); await sleep(4000);
console.log('offline cold start /goods/flow:', await ev(`JSON.stringify({title: document.title, rootChildren: document.getElementById('root')?.children.length, text: document.body.innerText.slice(0,160)})`));
ws.close(); chrome.kill();
