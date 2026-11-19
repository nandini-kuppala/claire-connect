// OpenRouter client (free tier) with pacing, daily budget, retries and caching.
// Free tier limits: ~20 requests/minute and 1,000 requests/day (with credits on the account).
import crypto from 'node:crypto';
import { z } from 'zod';
import { col } from './db/index.js';

// Nemotron is tried first. If the account's guardrail blocks it ("no endpoints"), it is skipped for
// an hour and the next free model in the chain answers instead, so Claire never goes silent.
const list = (env: string | undefined, defaults: string[]) =>
  [...new Set([...(env ? env.split(',').map((s) => s.trim()).filter(Boolean) : []), ...defaults])];

export const MODEL_CHAIN = {
  text: list(process.env.OPENROUTER_MODEL, [
    'nvidia/nemotron-3-ultra-550b-a55b:free', // primary (best quality); needs free endpoints allowed in OpenRouter privacy settings
    'baidu/ernie-5.5-flash-preview:free',
    'inclusionai/ling-3.2-flash:free',
    'google/gemma-4-31b-it:free',
  ]),
  vision: list(process.env.OPENROUTER_VISION_MODEL, [
    'nvidia/nemotron-3.5-super-vl:free',
    'inclusionai/ling-3.2-flash:free',
    'google/gemma-4-31b-it:free',
    'dots-studio/dots-3-note-preview:free',
  ]),
};

export const MODELS = {
  text: MODEL_CHAIN.text[0],
  vision: MODEL_CHAIN.vision[0],
  textFallback: process.env.OPENROUTER_FALLBACK_MODEL || MODEL_CHAIN.text[1] || MODEL_CHAIN.text[0],
};

/** Models that answered "no endpoints available" (guardrail / data policy / removed) are skipped for an hour. */
const unavailable = new Map<string, number>();
function usable(chain: string[]): string[] {
  const now = Date.now();
  const ok = chain.filter((m) => (unavailable.get(m) ?? 0) < now);
  return ok.length ? ok : chain;
}
function markIfUnavailable(model: string, err: unknown) {
  const msg = (err as Error)?.message ?? '';
  if (/OpenRouter 40[34]/.test(msg) && /endpoint|guardrail|data policy|not a valid model|No endpoints|agentic/i.test(msg)) {
    if (!unavailable.has(model) || (unavailable.get(model) ?? 0) < Date.now()) console.warn(`[llm] ${model} unavailable for this key — trying the next model`);
    unavailable.set(model, Date.now() + 60 * 60_000);
    return true;
  }
  return false;
}

const KEY = (process.env.OPENROUTER_API_KEY || process.env.openrouter || '').trim();
export const llmEnabled = Boolean(KEY);

const PER_MINUTE = Number(process.env.OPENROUTER_RPM || 19);
const PER_DAY = Number(process.env.OPENROUTER_RPD || 1000);
const DAY_RESERVE = 30; // keep a few requests for the live demo

// ── Pacing: at most PER_MINUTE request starts in any rolling 60 s window ──
const starts: number[] = [];
let chain: Promise<void> = Promise.resolve();

function slot(): Promise<void> {
  const next = chain.then(async () => {
    for (;;) {
      const nowMs = Date.now();
      while (starts.length && nowMs - starts[0] > 60_000) starts.shift();
      if (starts.length < PER_MINUTE) {
        starts.push(nowMs);
        return;
      }
      await sleep(60_000 - (nowMs - starts[0]) + 50);
    }
  });
  chain = next.catch(() => undefined);
  return next;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

async function takeDailyBudget(): Promise<boolean> {
  const key = `openrouter:${today()}`;
  const r = await col('kv').findOneAndUpdate({ _id: key } as any, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' });
  return (r?.n ?? 1) <= PER_DAY - DAY_RESERVE;
}

export async function usageToday() {
  const r = await col('kv').findOne({ _id: `openrouter:${today()}` } as any);
  return { used: r?.n ?? 0, limit: PER_DAY };
}

// ── Cache (memory + Atlas) so identical requests never spend quota twice ──
const mem = new Map<string, unknown>();
async function cacheGet(k: string) {
  if (mem.has(k)) return mem.get(k);
  const r = await col('llm_cache').findOne({ _id: k } as any);
  if (r) mem.set(k, r.v);
  return r?.v;
}
async function cachePut(k: string, v: unknown) {
  mem.set(k, v);
  await col('llm_cache').updateOne({ _id: k } as any, { $set: { v, at: Date.now() } }, { upsert: true });
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string | any[] };

async function post(body: object, attempt = 0): Promise<any> {
  await slot();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.PUBLIC_WEB_URL || 'http://localhost:5173',
        'X-Title': 'CLAIRE Connect',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch { json = { error: { message: text.slice(0, 200) } }; }
    if (res.status === 429 || res.status >= 500 || json?.error?.code === 429) {
      if (attempt >= 4) throw new Error(`OpenRouter ${res.status}: ${json?.error?.message ?? 'rate limited'}`);
      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const wait = retryAfter || (reset > Date.now() ? Math.min(reset - Date.now(), 65_000) : 0) || 2000 * 2 ** attempt + Math.random() * 500;
      console.warn(`[llm] ${res.status} — waiting ${Math.round(wait / 1000)}s then retrying`);
      await sleep(wait);
      return post(body, attempt + 1);
    }
    if (!res.ok || json.error) throw new Error(`OpenRouter ${res.status}: ${json?.error?.message ?? text.slice(0, 200)}`);
    return json;
  } catch (err: any) {
    if (err?.name === 'AbortError' && attempt < 1) return post(body, attempt + 1);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function toSchema(schema: z.ZodType) {
  const js: any = z.toJSONSchema(schema, { target: 'draft-7' });
  delete js.$schema;
  return js;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '').trim();
  const start = cleaned.search(/[{[]/);
  if (start < 0) return null;
  for (let end = cleaned.length; end > start; end--) {
    try { return JSON.parse(cleaned.slice(start, end)); } catch { /* keep shrinking */ }
  }
  return null;
}

/**
 * Ask a model for an object that matches `schema`. Uses a forced function call (tool) because the
 * Nemotron Ultra free endpoint supports tools but not response_format; falls back to JSON-in-text.
 */
export async function llmObject<T extends z.ZodType>(opts: {
  schema: T;
  name: string;
  system: string;
  user: string | any[];
  vision?: boolean;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  cache?: boolean;
}): Promise<z.infer<T> | null> {
  if (!llmEnabled) return null;
  const chain = usable(opts.vision ? MODEL_CHAIN.vision : MODEL_CHAIN.text);
  const model = chain[0];
  const cacheKey = opts.cache === false ? null : crypto.createHash('sha1').update(JSON.stringify([model, opts.name, opts.system, opts.user])).digest('hex');
  if (cacheKey) {
    const hit = await cacheGet(cacheKey);
    if (hit) {
      const ok = opts.schema.safeParse(hit);
      if (ok.success) return ok.data;
    }
  }
  if (!(await takeDailyBudget())) {
    console.warn('[llm] daily OpenRouter budget reached — using rule-based fallback');
    return null;
  }
  const parameters = toSchema(opts.schema);
  const messages: Msg[] = [
    { role: 'system', content: `${opts.system}\n\nReturn your answer only by calling the function "${opts.name}" with arguments that match its JSON schema exactly.` },
    { role: 'user', content: opts.user },
  ];
  const base = {
    messages,
    max_tokens: opts.maxTokens ?? 4000,
    temperature: 0.2,
    reasoning: { effort: opts.effort ?? 'medium', exclude: true },
    tools: [{ type: 'function', function: { name: opts.name, description: `Submit the ${opts.name} result`, parameters } }],
    tool_choice: { type: 'function', function: { name: opts.name } },
  };

  const jsonOnly = (m: string): object => ({
    model: m,
    messages: [
      { role: 'system', content: `${opts.system}\n\nRespond with ONLY a JSON object matching this JSON schema, no prose:\n${JSON.stringify(parameters)}` },
      { role: 'user', content: opts.user },
    ],
    max_tokens: base.max_tokens,
    temperature: 0.2,
    reasoning: base.reasoning,
    ...(opts.vision ? { response_format: { type: 'json_schema', json_schema: { name: opts.name, strict: true, schema: parameters } } } : {}),
  });

  // Per model: forced tool call, then JSON-in-text. A model that is unavailable for this key is skipped.
  const tried = new Set<string>();
  for (const m of chain.slice(0, 3)) {
    if (tried.has(m)) continue;
    tried.add(m);
    for (const body of [{ ...base, model: m }, jsonOnly(m)]) {
      try {
        const json = await post(body);
        const msg = json?.choices?.[0]?.message ?? {};
        const raw = msg.tool_calls?.[0]?.function?.arguments;
        const value = raw ? (typeof raw === 'string' ? extractJson(raw) : raw) : extractJson(String(msg.content ?? ''));
        const parsed = opts.schema.safeParse(value);
        if (parsed.success) {
          if (cacheKey) await cachePut(cacheKey, parsed.data);
          return parsed.data;
        }
        console.warn(`[llm] ${opts.name} (${m}): output did not match schema, trying next strategy`, parsed.error.issues.slice(0, 2));
      } catch (err) {
        if (markIfUnavailable(m, err)) break;
        console.warn(`[llm] ${opts.name} (${m}) failed:`, (err as Error).message);
      }
    }
  }
  return null;
}

/** Plain text completion (used for short natural replies). */
export async function llmText(opts: { system: string; user: string; effort?: 'low' | 'medium' | 'high'; maxTokens?: number }): Promise<string | null> {
  if (!llmEnabled || !(await takeDailyBudget())) return null;
  for (const m of usable(MODEL_CHAIN.text).slice(0, 3)) {
    try {
      const json = await post({
        model: m,
        messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
        max_tokens: opts.maxTokens ?? 1500,
        temperature: 0.4,
        reasoning: { effort: opts.effort ?? 'medium', exclude: true },
      });
      const out = String(json?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (out) return out;
    } catch (err) {
      if (markIfUnavailable(m, err)) continue;
      console.warn(`[llm] text (${m}) failed:`, (err as Error).message);
      return null;
    }
  }
  return null;
}
