// Tier 1 of personal Claire's model chain (04 §9.3): a free OpenRouter model (ERNIE, verified 6/6) picks one tool.
// Its own client, not llmObject(): a hard 4 s budget, no 429 sleeps (fall through instead), and each HTTP request
// counted against a 400/day share (SC_LLM_DAILY) of the app's 1,000 free requests, so deal rooms and search keep theirs.
import { col } from '../../db/index.js';
import { SYSTEM_PROMPT, TOOL_DEFS, validateCall, type ToolCall } from './tools.js';

const KEY = (process.env.OPENROUTER_API_KEY || process.env.openrouter || '').trim();
const MODELS = (process.env.SC_LLM_MODELS || 'baidu/ernie-5.5-flash-preview:free').split(',').map((s) => s.trim()).filter(Boolean);
const DAILY = Number(process.env.SC_LLM_DAILY || 400);
const APP_DAILY = Number(process.env.OPENROUTER_RPD || 1000) - 30;
const TOOLS = TOOL_DEFS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
const day = () => new Date().toISOString().slice(0, 10);

/** Takes one request from both counters; false when either is spent (the next tier answers). */
async function take(): Promise<boolean> {
  const mine = await col('kv').findOneAndUpdate({ _id: `sc_llm:${day()}` } as any, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' });
  if ((mine?.n ?? 1) > DAILY) return false;
  const app = await col('kv').findOneAndUpdate({ _id: `openrouter:${day()}` } as any, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' });
  return (app?.n ?? 1) <= APP_DAILY;
}

export interface TierResult { call: ToolCall | null; model: string; ms: number; outcome: 'ok' | 'no_tool' | 'invalid' | 'http' | 'timeout' | 'budget' | 'off' }

export async function openRouterPick(text: string, budgetMs = 4000): Promise<TierResult> {
  const t0 = Date.now();
  if (!KEY || process.env.SC_LLM_OFF === '1') return { call: null, model: '-', ms: 0, outcome: 'off' };
  for (const model of MODELS) {
    const left = budgetMs - (Date.now() - t0);
    if (left < 600) return { call: null, model, ms: Date.now() - t0, outcome: 'timeout' };
    if (!(await take())) return { call: null, model, ms: Date.now() - t0, outcome: 'budget' };
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'CLAIRE Connect' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }], tools: TOOLS, tool_choice: 'auto', temperature: 0, max_tokens: 400 }),
        signal: AbortSignal.timeout(left),
      });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || j.error) continue; // 429 / 5xx / guardrail: try the next model, never sleep
      const tc = j.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc) return { call: null, model, ms: Date.now() - t0, outcome: 'no_tool' };
      let args: unknown = null;
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { return { call: null, model, ms: Date.now() - t0, outcome: 'invalid' }; }
      const call = validateCall(tc.function?.name, args);
      return { call, model, ms: Date.now() - t0, outcome: call ? 'ok' : 'invalid' };
    } catch (e) {
      if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') return { call: null, model, ms: Date.now() - t0, outcome: 'timeout' };
    }
  }
  return { call: null, model: MODELS.at(-1) ?? '-', ms: Date.now() - t0, outcome: 'http' };
}
