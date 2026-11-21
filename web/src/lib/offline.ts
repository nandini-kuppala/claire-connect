// Offline support for Goods (slice 9, 04 §5.4, 03 §6.4).
// - Create-only records (send, got back, trade, confirm, output, count, made here, receive first, order dispatch) queue in
//   IndexedDB when there is no network and are sent in order when it returns. Each carries its client id, so a retry
//   that already reached the server is recorded once (the server dedupes on (business, client_id); confirmations are
//   idempotent per figure). The undo window starts when the server receives it, i.e. at sync.
// - Reads used by the Goods lists are cached, so offline they show the last copy with "Last updated 10:42".
// Disputes, settlements, edits and approvals stay online-only.
import { api, ApiError } from './api';

export interface OutboxItem {
  id: string; // the record's client id (or a fresh id for confirmations)
  path: string;
  body: unknown;
  label: string;
  created_at: number;
  attempts: number;
  state: 'queued' | 'sending' | 'check' | 'failed';
  error?: string | null;
  code?: string | null;
}
export type OutboxEvent = { type: 'sent'; item: OutboxItem; response: any } | { type: 'changed' };

const DB = 'cc_offline';
const QUEUEABLE = [
  /^\/api\/sc\/movements\/(send|trade|receive-first)$/,
  /^\/api\/sc\/movements\/[\w-]+\/(confirm|sender-figure)$/,
  /^\/api\/sc\/jobs\/[\w-]+\/(return|output|send-back)$/,
  /^\/api\/sc\/orders\/[\w-]+\/(dispatch|send-material)$/,
  /^\/api\/sc\/(made|adjust)$/,
];
export const canQueue = (path: string) => QUEUEABLE.some((r) => r.test(path));

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('cache')) d.createObjectStore('cache', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r ? (r.result as T) : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// ── Cached reads ────────────────────────────────────────────────────────────────────────────────
/** GET with a device copy: online it refreshes the copy; offline it returns the copy and when it was saved. */
export async function cachedGet<T>(path: string): Promise<{ data: T; staleAt: number | null }> {
  const key = `${tokenTag()}|${path}`;
  try {
    const data = await api.get<T>(path);
    void tx('cache', 'readwrite', (s) => s.put({ key, data, at: Date.now() })).catch(() => undefined);
    return { data, staleAt: null };
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      const hit = (await tx<{ data: T; at: number }>('cache', 'readonly', (s) => s.get(key)).catch(() => undefined)) as { data: T; at: number } | undefined;
      if (hit) return { data: hit.data, staleAt: hit.at };
    }
    throw e;
  }
}
/**
 * Copies and the queue belong to a person, not a login: tagged with the user id inside the token (a new login keeps
 * the same user id, so records queued before logging out are still sent; another person on the phone never sees them).
 */
export function tokenTag(): string {
  try {
    const t = localStorage.getItem('cc_token') ?? '';
    const seg = t.split('.')[0] ?? '';
    const json = JSON.parse(atob(seg.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((seg.length + 3) % 4)));
    return String(json.uid ?? '');
  } catch {
    return '';
  }
}

// ── Outbox ──────────────────────────────────────────────────────────────────────────────────────
const listeners = new Set<(e: OutboxEvent) => void>();
export function onOutbox(fn: (e: OutboxEvent) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const emit = (e: OutboxEvent) => listeners.forEach((l) => { try { l(e); } catch { /* a listener's problem */ } });

export async function listOutbox(): Promise<OutboxItem[]> {
  const all = ((await tx<OutboxItem[]>('outbox', 'readonly', (s) => s.getAll()).catch(() => [])) ?? []) as OutboxItem[];
  return all.filter((x) => (x as any).owner === tokenTag()).sort((a, b) => a.created_at - b.created_at);
}
const put = (item: OutboxItem) => tx('outbox', 'readwrite', (s) => s.put({ ...item, owner: tokenTag() }));
export async function discard(id: string) { await tx('outbox', 'readwrite', (s) => s.delete(id)); emit({ type: 'changed' }); }

/**
 * Post a create-only record; with no network it is kept on the phone and sent later. Returns the server's response, or
 * `{ queued: true }` when it was kept. Any other failure (a 4xx) is thrown as usual, so the form can show it.
 */
export async function postOrQueue<T>(path: string, body: Record<string, unknown>, label: string): Promise<T | { queued: true; id: string }> {
  const id = String(body.client_id ?? (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const queue = async () => {
    await put({ id, path, body, label, created_at: Date.now(), attempts: 0, state: 'queued' });
    emit({ type: 'changed' });
    return { queued: true as const, id };
  };
  if (canQueue(path) && typeof navigator !== 'undefined' && navigator.onLine === false) return queue();
  try {
    return await api.post<T>(path, body);
  } catch (e) {
    if (e instanceof ApiError && e.status === 0 && canQueue(path)) return queue();
    throw e;
  }
}

let syncing = false;
/** Send what is waiting, oldest first. Stops at the first network failure; a refused record is kept for the user. */
export async function syncOutbox(): Promise<number> {
  if (syncing) return 0;
  syncing = true;
  let sent = 0;
  try {
    for (const item of await listOutbox()) {
      if (item.state === 'check' || item.state === 'failed') continue;
      try {
        const response = await api.post(item.path, item.body);
        await tx('outbox', 'readwrite', (s) => s.delete(item.id));
        sent += 1;
        emit({ type: 'sent', item, response });
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break; // still offline
        if (e instanceof ApiError && e.status >= 500) { await put({ ...item, attempts: item.attempts + 1 }); break; }
        const code = (e instanceof ApiError ? (e.body as { code?: string } | undefined)?.code : null) ?? null;
        // The checks re-run on the server (never-negative, staff limits…): keep it, marked, for the user to decide.
        await put({ ...item, attempts: item.attempts + 1, state: code === 'negative' ? 'check' : 'failed', error: e instanceof Error ? e.message : String(e), code });
        emit({ type: 'changed' });
      }
    }
  } finally {
    syncing = false;
    emit({ type: 'changed' });
  }
  return sent;
}

/** Try a kept record again, optionally changed (e.g. "record anyway" for a short-stock check). */
export async function retry(id: string, patch: Record<string, unknown> = {}) {
  const item = (await listOutbox()).find((x) => x.id === id);
  if (!item) return;
  await put({ ...item, state: 'queued', error: null, code: null, body: { ...(item.body as object), ...patch } });
  emit({ type: 'changed' });
  await syncOutbox();
}

let started = false;
/** Start once per app: sync when the network returns, when the app comes back to the front, and every 30 s. */
export function startOffline() {
  if (started || typeof window === 'undefined' || !('indexedDB' in window)) return;
  started = true;
  const kick = () => { void syncOutbox().catch(() => undefined); };
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  setInterval(() => { if (navigator.onLine) kick(); }, 30_000);
  kick();
}
