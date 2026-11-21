// Receiver-side translation. Both engines run in parallel for every new message:
// - Server (POST /api/translate, LLM with a trade glossary) is preferred: in live tests it handled
//   Hinglish/Tanglish and trade terms far better than the built-in machine translation.
// - Nexconn built-in translation (translateMessages / translateTexts, source 'auto', batches of ≤ 10)
//   is the fallback when the server is unavailable or out of daily budget. Its output is only
//   accepted if every number, ₹ amount and size from the source survives unchanged.
// Results are cached by (id, text, language) in localStorage.
import { NCEngine, TranslateMessageParam, TranslateSourceType, TranslateTextParam, type TranslateResult } from '@nexconn/chat';
import { api } from '../lib/api';
import { hash } from '../lib/format';

export interface TranslateRequest {
  /** Message id (or any stable id for free text). */
  id: string;
  text: string;
  /** Source language if known; 'auto' or undefined lets the service detect it. */
  from?: string;
  /** 'message' = a Nexconn text message id usable with translateMessages; 'text' = free text. */
  kind?: 'message' | 'text';
}

/** True when every number / ₹ amount / size token of the source appears in the translation. */
export function numbersKept(source: string, translated: string): boolean {
  const nums = (t: string) => (t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, '')).sort();
  const a = nums(source);
  const b = nums(translated);
  if (a.length !== b.length || a.some((n, i) => n !== b[i])) return false;
  const sizes = (t: string) => (t.match(/\b(?:XXXL|XXL|XL|XS|[2-5]XL)\b/gi) ?? []).map((x) => x.toUpperCase()).sort().join(',');
  return sizes(source) === sizes(translated);
}

// ── Cache ──────────────────────────────────────────────────────────────────
const CACHE_KEY = 'cc_tr_v1';
const CACHE_MAX = 800;
const cache = new Map<string, string>();
let cacheLoaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const cacheKey = (r: TranslateRequest, to: string) => `${to}|${r.id}|${hash(r.text).toString(36)}`;

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) for (const [k, v] of JSON.parse(raw) as [string, string][]) cache.set(k, v);
  } catch {
    /* ignore */
  }
}

function remember(key: string, text: string) {
  cache.delete(key);
  cache.set(key, text);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify([...cache.entries()]));
    } catch {
      /* quota: keep memory cache only */
    }
  }, 800);
}

export function cachedTranslation(r: TranslateRequest, to: string): string | undefined {
  loadCache();
  return cache.get(cacheKey(r, to));
}

// ── Nexconn built-in translation ───────────────────────────────────────────
let nexconnReady = false;
export function setNexconnTranslateReady(v: boolean) {
  nexconnReady = v;
}

type Waiter = (text: string | null) => void;
/**
 * Waiters keyed by `<sourceType>:<identifier>`. Text identifiers are an md5 of the text, so two jobs
 * with the same text share one key: every waiter is resolved, none is overwritten.
 * Keying by source type keeps a message auto-translation from answering a text request.
 */
const pending = new Map<string, Waiter[]>();
const pendingKey = (sourceType: TranslateSourceType, identifier: string) => `${sourceType}:${identifier}`;
/** Auto-translate results we did not ask for (message id → text + language); used as a last-resort fallback. */
const unsolicited = new Map<string, { text: string; lang: string }>();

function settle(key: string, text: string | null): boolean {
  const waiters = pending.get(key);
  if (!waiters) return false;
  pending.delete(key);
  for (const fn of waiters) fn(text);
  return true;
}

/** Wired to TranslateHandler.onTranslationCompleted by the engine. */
export function handleTranslationResults(results: TranslateResult[]) {
  for (const r of results) {
    const text = r.code === 0 && r.translateInfo?.translatedText ? r.translateInfo.translatedText : null;
    if (settle(pendingKey(r.sourceType, r.identifier), text)) continue;
    if (text && r.sourceType === TranslateSourceType.MESSAGE && r.translateInfo?.targetLanguage) {
      unsolicited.set(r.identifier, { text, lang: r.translateInfo.targetLanguage });
      if (unsolicited.size > 300) unsolicited.delete(unsolicited.keys().next().value as string);
    }
  }
}

function waitFor(sourceType: TranslateSourceType, identifier: string, ms = 9000): Promise<string | null> {
  const key = pendingKey(sourceType, identifier);
  return new Promise((resolve) => {
    const done: Waiter = (t) => {
      clearTimeout(timer);
      resolve(t);
    };
    const timer = setTimeout(() => {
      const left = (pending.get(key) ?? []).filter((w) => w !== done);
      if (left.length) pending.set(key, left);
      else pending.delete(key);
      resolve(null);
    }, ms);
    pending.set(key, [...(pending.get(key) ?? []), done]);
  });
}

interface Job {
  req: TranslateRequest;
}

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function nexconnBatch(jobs: Job[], to: string, asMessages: boolean): Promise<(string | null)[]> {
  // Source is always 'auto' (an explicit code such as 'en' → 'ta' failed with 28401 in live tests) and
  // the raw text is sent: ⟦n⟧ markers were mangled by the service, so numbers are verified afterwards.
  const params = jobs.map((j) => (asMessages ? new TranslateMessageParam(j.req.id, 'auto', to, j.req.text) : new TranslateTextParam(j.req.text, 'auto', to)));
  const sourceType = asMessages ? TranslateSourceType.MESSAGE : TranslateSourceType.CUSTOM_TEXT;
  const waits = params.map((p) => waitFor(sourceType, p.identifier));
  const failAll = () => params.forEach((p) => settle(pendingKey(sourceType, p.identifier), null));
  try {
    const r = asMessages
      ? await NCEngine.translateModule.translateMessages({ list: params as TranslateMessageParam[], force: true })
      : await NCEngine.translateModule.translateTexts({ list: params as TranslateTextParam[] });
    if (!r.isOk) failAll();
  } catch {
    failAll();
  }
  return Promise.all(waits);
}

async function viaNexconn(jobs: Job[], to: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!nexconnReady || !jobs.length) return out;
  const groups: [Job[], boolean][] = [
    [jobs.filter((j) => j.req.kind === 'message'), true],
    [jobs.filter((j) => j.req.kind !== 'message'), false],
  ];
  await Promise.all(
    groups.flatMap(([list, asMessages]) =>
      chunk(list, 10).map(async (batch) => {
        const texts = await nexconnBatch(batch, to, asMessages);
        batch.forEach((j, i) => {
          const t = texts[i];
          if (t == null) return;
          if (t.trim() && numbersKept(j.req.text, t) && isDifferent(t, j.req.text)) out.set(j.req.id, t);
        });
      }),
    ),
  );
  return out;
}

// ── Server fallback ────────────────────────────────────────────────────────
async function viaServer(reqs: TranslateRequest[], to: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!reqs.length) return out;
  const froms = new Set(reqs.map((r) => r.from).filter((f) => f && f !== 'auto'));
  try {
    const r = await api.post<{ translations?: (string | null)[] }>('/api/translate', {
      texts: reqs.map((x) => x.text),
      to,
      ...(froms.size === 1 ? { from: [...froms][0] } : {}),
    });
    (r?.translations ?? []).forEach((t, i) => {
      if (typeof t === 'string' && t.trim() && isDifferent(t, reqs[i].text)) out.set(reqs[i].id, t);
    });
  } catch {
    /* translation is best effort; the original stays visible */
  }
  return out;
}

// ── Entry point ────────────────────────────────────────────────────────────
const inflight = new Map<string, Promise<string | null>>();

/** Translates items into `to`. The map holds only successful translations. */
export async function translateItems(items: TranslateRequest[], to: string): Promise<Map<string, string>> {
  loadCache();
  const out = new Map<string, string>();
  const todo: TranslateRequest[] = [];
  const waits: Promise<void>[] = [];

  for (const it of items) {
    if (!it.text?.trim() || (it.from && it.from === to)) continue;
    const key = cacheKey(it, to);
    const hit = cache.get(key);
    if (hit !== undefined) {
      out.set(it.id, hit);
      continue;
    }
    const running = inflight.get(key);
    if (running) {
      waits.push(running.then((t) => void (t != null && out.set(it.id, t))));
      continue;
    }
    todo.push(it);
  }

  if (todo.length) {
    const run = (async () => {
      const jobs: Job[] = todo.map((req) => ({ req }));
      const result = new Map<string, string>();
      const remaining = jobs.filter((j) => !result.has(j.req.id));
      // Both engines start together; the server result wins, Nexconn fills whatever it missed.
      const nc = viaNexconn(remaining, to);
      const sv = await viaServer(remaining.map((j) => j.req), to);
      sv.forEach((v, k) => result.set(k, v));
      if (remaining.some((j) => !result.has(j.req.id))) {
        (await nc).forEach((v, k) => {
          if (!result.has(k)) result.set(k, v);
        });
        // Last resort: a Nexconn auto-translation that already arrived for this message.
        for (const j of remaining) {
          const auto = j.req.kind === 'message' && !result.has(j.req.id) ? unsolicited.get(j.req.id) : undefined;
          if (auto && sameLang(auto.lang, to) && numbersKept(j.req.text, auto.text)) result.set(j.req.id, auto.text);
        }
      }
      for (const req of todo) {
        const t = result.get(req.id);
        // An unchanged "translation" may be a silent service failure: don't pin it in the cache.
        if (t != null && isDifferent(t, req.text)) remember(cacheKey(req, to), t);
      }
      return result;
    })();

    todo.forEach((req) => {
      const key = cacheKey(req, to);
      const p = run.then((m) => m.get(req.id) ?? null).finally(() => inflight.delete(key));
      inflight.set(key, p);
    });
    const result = await run;
    result.forEach((v, k) => out.set(k, v));
  }

  await Promise.all(waits);
  return out;
}

const SCRIPTS: [RegExp, string][] = [
  [/[஀-௿]/g, 'ta'],
  [/[ऀ-ॿ]/g, 'hi'],
  [/[ఀ-౿]/g, 'te'],
  [/[ಀ-೿]/g, 'kn'],
  [/[ഀ-ൿ]/g, 'ml'],
  [/[ঀ-৿]/g, 'bn'],
  [/[଀-୿]/g, 'or'],
  [/[઀-૿]/g, 'gu'],
];

/**
 * The language a message is written in, from its script (Tamil script → 'ta', Devanagari → 'hi', …);
 * `hint` breaks the Devanagari tie for Marathi. Latin-script text (English, Hinglish, Tanglish) → null.
 */
export function scriptLang(text: string, hint?: string | null): string | null {
  let best: string | null = null;
  let most = 0;
  for (const [re, lang] of SCRIPTS) {
    const n = text.match(re)?.length ?? 0;
    if (n > most) {
      most = n;
      best = lang;
    }
  }
  if (!best) return null;
  return best === 'hi' && hint === 'mr' ? 'mr' : best;
}

const sameLang = (a: string, b: string) => a.toLowerCase().split(/[-_]/)[0] === b.toLowerCase().split(/[-_]/)[0];

/** True when the translation differs meaningfully from the source (avoid "Translated" labels on same-language text). */
export function isDifferent(a: string, b: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}]+/gu, '');
  return norm(a) !== norm(b);
}
