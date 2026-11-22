// Tier 2 of personal Claire's model chain (04 §9.3, T1): Claude Haiku 5.5 through the official Anthropic SDK, used
// only when the free tier fails (429/5xx/timeout/bad schema). Off unless ANTHROPIC_API_KEY is set AND
// SC_CLAIRE_PAID=1 (set it after scripts/sc-claire-verify.mjs passes on the 7-tool schema). Hard cap
// CLAIRE_PAID_DAILY_USD (default $1/day), tracked in kv from the token usage each response reports.
import Anthropic from '@anthropic-ai/sdk';
import { col } from '../../db/index.js';
import { SYSTEM_PROMPT, TOOL_DEFS, validateCall } from './tools.js';
import type { TierResult } from './openrouter.js';

const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
export const haikuEnabled = () => Boolean(KEY) && process.env.SC_CLAIRE_PAID === '1';
const MODEL = 'claude-haiku-5-5';
const CAP_USD = Number(process.env.CLAIRE_PAID_DAILY_USD || 1);
// List price, Haiku 5.5 (prompts ≤ 100K tokens): $0.10 / 1M input, $0.50 / 1M output; cache reads cost less, so this over-counts.
const USD_IN = 0.1 / 1e6;
const USD_OUT = 0.5 / 1e6;
const day = () => new Date().toISOString().slice(0, 10);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: KEY, maxRetries: 0 }));

const TOOLS: Anthropic.Tool[] = TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as unknown as Anthropic.Tool.InputSchema, strict: true }));

async function spentToday(): Promise<number> {
  return ((await col('kv').findOne({ _id: `sc_paid_usd:${day()}` } as any)) as any)?.usd ?? 0;
}

export async function haikuPick(text: string, budgetMs = 4000): Promise<TierResult> {
  const t0 = Date.now();
  if (!haikuEnabled()) return { call: null, model: MODEL, ms: 0, outcome: 'off' };
  if ((await spentToday()) >= CAP_USD) return { call: null, model: MODEL, ms: 0, outcome: 'budget' };
  try {
    const res = await anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        // Thinking off (accepted at effort high or below) and low effort: one tool pick, no reasoning needed.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        // Stable prefix first (system + tools) and cached; the user's sentence is the only varying part.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
        messages: [{ role: 'user', content: text }],
      },
      { timeout: budgetMs },
    );
    const usd = res.usage.input_tokens * USD_IN + (res.usage.cache_creation_input_tokens ?? 0) * USD_IN * 1.25 + (res.usage.cache_read_input_tokens ?? 0) * USD_IN * 0.1 + res.usage.output_tokens * USD_OUT;
    await col('kv').updateOne({ _id: `sc_paid_usd:${day()}` } as any, { $inc: { usd, n: 1 } }, { upsert: true });
    // A refusal is a 200 with stop_reason "refusal": fall through to the rules, never read content first.
    if (res.stop_reason === 'refusal') return { call: null, model: MODEL, ms: Date.now() - t0, outcome: 'no_tool' };
    const tu = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!tu) return { call: null, model: MODEL, ms: Date.now() - t0, outcome: 'no_tool' };
    const call = validateCall(tu.name, tu.input);
    return { call, model: MODEL, ms: Date.now() - t0, outcome: call ? 'ok' : 'invalid' };
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) return { call: null, model: MODEL, ms: Date.now() - t0, outcome: 'timeout' };
    if (e instanceof Anthropic.APIError) return { call: null, model: MODEL, ms: Date.now() - t0, outcome: 'http' };
    throw e;
  }
}
