// Browser globals the Nexconn Web SDK (@nexconn/chat NCEngine) expects, so it can run headless in Node 22+.
// Used by the archive worker (server/src/nexconn-node/worker.mjs) and the smoke / load scripts. Never import this
// into the API server process itself: it defines `window`, which changes how other libraries behave.
// Based on the shims first written for scripts/sc-load-nexconn.mjs.

export function installBrowserShims() {
  if (globalThis.__ncShims) return;
  globalThis.__ncShims = true;
  const store = new Map();
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.assign(globalThis, { window: globalThis, self: globalThis, localStorage: ls, sessionStorage: ls });
  globalThis.document ??= { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible', hidden: false, createElement: () => ({}), cookie: '' };
  globalThis.location ??= { href: 'http://localhost:5173/', protocol: 'http:', host: 'localhost:5173', hostname: 'localhost', origin: 'http://localhost:5173' };
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};

  // XMLHttpRequest on top of fetch: enough for the SDK's navigation, upload and translation requests.
  class XHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = '';
      this.response = '';
      this.headers = {};
      this.timeout = 0;
      this.withCredentials = false;
      this.responseType = '';
      this._res = {};
      this._listeners = {};
      // Upload progress: the SDK attaches handlers here; we report one 100 % event when the body is sent.
      this.upload = { onprogress: null, addEventListener: (ev, fn) => ((this._up ??= {})[ev] = fn), removeEventListener() {} };
    }
    open(method, url) {
      this.method = method;
      this.url = url;
      this.readyState = 1;
    }
    setRequestHeader(k, v) {
      this.headers[k] = v;
    }
    getAllResponseHeaders() {
      return Object.entries(this._res).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    }
    getResponseHeader(k) {
      return this._res[String(k).toLowerCase()] ?? null;
    }
    addEventListener(ev, fn) {
      (this._listeners[ev] ??= []).push(fn);
    }
    removeEventListener() {}
    _fire(ev, arg) {
      this[`on${ev}`]?.(arg);
      for (const fn of this._listeners[ev] ?? []) fn(arg);
    }
    abort() {
      this._aborted = true;
      this.ctrl?.abort();
    }
    send(body) {
      this.ctrl = new AbortController();
      const t = this.timeout
        ? setTimeout(() => {
            this.ctrl.abort();
            this._fire('timeout');
          }, this.timeout)
        : null;
      fetch(this.url, { method: this.method, headers: this.headers, body: body ?? undefined, signal: this.ctrl.signal })
        .then(async (r) => {
          const ev = { lengthComputable: true, loaded: 1, total: 1 };
          this.upload.onprogress?.(ev);
          this._up?.progress?.(ev);
          this.status = r.status;
          r.headers.forEach((v, k) => {
            this._res[k] = v;
          });
          this.responseText = await r.text();
          try {
            this.response = this.responseType === 'json' ? JSON.parse(this.responseText || 'null') : this.responseText;
          } catch {
            this.response = null;
          }
          this.readyState = 4;
          if (t) clearTimeout(t);
          this._fire('readystatechange');
          this._fire('load');
          this._fire('loadend');
        })
        .catch((e) => {
          if (t) clearTimeout(t);
          if (this._aborted) return;
          this.readyState = 4;
          this.status = 0;
          this._fire('readystatechange');
          this._fire('error', e);
          this._fire('loadend');
        });
    }
  }
  globalThis.XMLHttpRequest = XHR;
  // Browsers hand binary frames to the SDK as ArrayBuffers; Node's WebSocket defaults to Blob, which the SDK's
  // protobuf decoder can't read ("pb decode error … Illegal buffer").
  const NodeWS = globalThis.WebSocket;
  globalThis.WebSocket = class extends NodeWS {
    constructor(...a) {
      super(...a);
      this.binaryType = 'arraybuffer';
    }
  };
}

/** Loads the Web SDK after the shims are in place. */
export async function loadChatSdk() {
  installBrowserShims();
  return import('@nexconn/chat');
}
