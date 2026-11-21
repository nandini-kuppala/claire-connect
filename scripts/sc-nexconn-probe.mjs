// Probe: can the Nexconn Web SDK (@nexconn/chat) connect from Node? LOCAL dev server for login only.
const store = new Map();
const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
Object.assign(globalThis, { window: globalThis, self: globalThis, localStorage: ls, sessionStorage: ls });
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible', hidden: false, createElement: () => ({}), cookie: '' };
globalThis.location ??= { href: 'http://localhost:5173/', protocol: 'http:', host: 'localhost:5173', hostname: 'localhost', origin: 'http://localhost:5173' };
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {};
// Minimal XMLHttpRequest on top of fetch (the SDK's navigation/config requests).
class XHR {
  constructor() { this.readyState = 0; this.status = 0; this.responseText = ''; this.response = ''; this.headers = {}; this.timeout = 0; this.withCredentials = false; this.responseType = ''; this._res = {}; }
  open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  getAllResponseHeaders() { return Object.entries(this._res).map(([k, v]) => `${k}: ${v}`).join('\r\n'); }
  getResponseHeader(k) { return this._res[String(k).toLowerCase()] ?? null; }
  abort() { this._aborted = true; this.ctrl?.abort(); }
  send(body) {
    this.ctrl = new AbortController();
    const t = this.timeout ? setTimeout(() => { this.ctrl.abort(); this.ontimeout?.(); }, this.timeout) : null;
    fetch(this.url, { method: this.method, headers: this.headers, body: body ?? undefined, signal: this.ctrl.signal })
      .then(async (r) => {
        this.status = r.status; r.headers.forEach((v, k) => { this._res[k] = v; });
        this.responseText = await r.text(); this.response = this.responseType === 'json' ? JSON.parse(this.responseText || 'null') : this.responseText;
        this.readyState = 4; if (t) clearTimeout(t); this.onreadystatechange?.(); this.onload?.(); this.onloadend?.();
      })
      .catch((e) => { if (t) clearTimeout(t); if (this._aborted) return; this.readyState = 4; this.status = 0; this.onreadystatechange?.(); this.onerror?.(e); this.onloadend?.(); });
  }
}
globalThis.XMLHttpRequest = XHR;
const { NCEngine, AreaCode, DirectChannel, SendTextMessageParams, ConnectionStatusHandler } = await import('../node_modules/@nexconn/chat/index.mjs');
const phone = process.argv[2] || '9300000001';
const v = await (await fetch('http://localhost:8787/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, otp: '123456' }) })).json();
console.log('chat creds:', { mode: v.chat?.mode, area: v.chat?.area, hasToken: !!v.chat?.token, user: v.user?.id });
NCEngine.initialize({ appKey: v.chat.appKey, areaCode: AreaCode[(v.chat.area || 'SG').toUpperCase()] ?? AreaCode.SG });
try { NCEngine.addConnectionStatusHandler('probe', new ConnectionStatusHandler({ onConnectionStatusChanged: (e) => console.log('status:', JSON.stringify(e)) })); } catch (e) { console.log('no status handler', e.message); }
const t0 = Date.now();
const r = await NCEngine.connect({ token: v.chat.token });
console.log('connect:', r.isOk, r.code, r.msg ?? '', `${Date.now() - t0} ms`, r.data?.userId);
if (r.isOk) {
  const ch = new DirectChannel('claire');
  const t1 = Date.now();
  const s = await ch.sendMessage(new SendTextMessageParams({ text: 'load probe ping' }));
  console.log('send:', s.isOk, s.code, `${Date.now() - t1} ms`);
}
await new Promise((r) => setTimeout(r, Number(process.argv[3] || 0)));
process.exit(0);
