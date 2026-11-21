// Personal Claire's seven tools (04 §9.2): one schema, used by every model tier and validated with zod after the call.
// The model only ever sees the user's own sentence; it picks a tool and fills slots. The server resolves names,
// materials and dates, runs the tool with the user's ctx, and renders the answer from a template.
import { z } from 'zod';

const str = { type: 'string' } as const;
const party = { type: 'string', description: 'The other business or person as the user said it (any script). Never an id.' } as const;
const material = { type: 'string', description: 'What the goods are, in the user\'s words, e.g. "navy fabric", "polo kits", "buttons".' } as const;

/** JSON Schemas: additionalProperties false everywhere, no numeric or length constraints (strict-mode safe). */
export const TOOL_DEFS = [
  {
    name: 'query_holdings',
    description: "Where the user's own goods are and how much: out with others (job workers, suppliers), in my unit, or coming in. Use for 'how much ... is at X', 'what is with X', 'did X get ...?'.",
    input_schema: { type: 'object', additionalProperties: false, properties: { scope: { type: 'string', enum: ['out_with_others', 'in_my_unit', 'coming_in', 'any'] }, party, material, colour: str, size: str }, required: ['scope'] },
  },
  {
    name: 'query_jobs',
    description: 'Work sent out (dyeing, stitching, printing...) by status: late, open, ready to collect, closed.',
    input_schema: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['late', 'open', 'ready', 'closed', 'any'] }, party, process: str }, required: ['status'] },
  },
  {
    name: 'query_movements',
    description: 'What was sent or received recently, with a party or overall.',
    input_schema: { type: 'object', additionalProperties: false, properties: { party, direction: { type: 'string', enum: ['sent', 'received', 'any'] }, period: { type: 'string', enum: ['today', 'this_week', 'this_month', 'any'] } }, required: ['direction', 'period'] },
  },
  {
    name: 'compute_analytics',
    description: 'Performance per job worker: process loss %, turnaround days, rejects %.',
    input_schema: { type: 'object', additionalProperties: false, properties: { metric: { type: 'string', enum: ['loss_pct', 'turnaround_days', 'reject_pct'] }, process: str }, required: ['metric'] },
  },
  {
    name: 'explain_job',
    description: 'Explain one piece of work at a party: what went, what came back, what is still there.',
    input_schema: { type: 'object', additionalProperties: false, properties: { party, material }, required: [] },
  },
  {
    name: 'draft_record',
    description: 'Draft (never save) a record of goods that moved. mood=statement only for facts the user states ("I sent", "came back"); questions ("was it sent?") are mood=question; intentions ("need to send") are mood=plan.',
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['send_for_work', 'got_back', 'buy', 'sell'] },
        mood: { type: 'string', enum: ['statement', 'question', 'plan'] },
        tense: { type: 'string', enum: ['past', 'present', 'future'] },
        party,
        process: { type: 'string', description: 'The work, e.g. dyeing, stitching, printing, compacting.' },
        lines: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              material, colour: str, qty: { type: 'number' }, unit: { type: 'string', enum: ['kg', 'g', 'pcs', 'dozen', 'sets', 'rolls', 'cones', 'gross', 'm'] },
              sizes: { type: 'array', description: 'Sizes the user named, e.g. ["S","M"], with a qty each when said.', items: { type: 'object', additionalProperties: false, properties: { size: str, qty: { type: 'number' } }, required: ['size'] } },
            },
            required: ['qty'],
          },
        },
        day: { type: 'string', enum: ['today', 'yesterday', 'day_before'] },
        dc_no: str,
      },
      required: ['action', 'mood', 'tense', 'lines'],
    },
  },
  {
    name: 'find_suppliers',
    description: 'The user wants to buy, or find a supplier or job worker (search the marketplace).',
    input_schema: { type: 'object', additionalProperties: false, properties: { what: str }, required: ['what'] },
  },
] as const;

const optStr = z.string().max(120).optional().nullable().transform((v) => v ?? undefined);

export const TOOL_ARGS = {
  query_holdings: z.object({ scope: z.enum(['out_with_others', 'in_my_unit', 'coming_in', 'any']), party: optStr, material: optStr, colour: optStr, size: optStr }),
  query_jobs: z.object({ status: z.enum(['late', 'open', 'ready', 'closed', 'any']), party: optStr, process: optStr }),
  query_movements: z.object({ party: optStr, direction: z.enum(['sent', 'received', 'any']).default('any'), period: z.enum(['today', 'this_week', 'this_month', 'any']).default('this_week') }),
  compute_analytics: z.object({ metric: z.enum(['loss_pct', 'turnaround_days', 'reject_pct']), process: optStr }),
  explain_job: z.object({ party: optStr, material: optStr }),
  draft_record: z.object({
    action: z.enum(['send_for_work', 'got_back', 'buy', 'sell']),
    mood: z.enum(['statement', 'question', 'plan']),
    tense: z.enum(['past', 'present', 'future']),
    party: optStr,
    process: optStr,
    lines: z.array(z.object({
      material: optStr, colour: optStr, qty: z.number().positive().max(10_000_000),
      unit: z.enum(['kg', 'g', 'pcs', 'dozen', 'sets', 'rolls', 'cones', 'gross', 'm']).optional().nullable().transform((v) => v ?? undefined),
      sizes: z.array(z.object({ size: z.string().max(10), qty: z.number().positive().optional().nullable().transform((v) => v ?? undefined) })).max(12).optional().nullable().transform((v) => v ?? undefined),
    })).min(1).max(12),
    day: z.enum(['today', 'yesterday', 'day_before']).optional().nullable().transform((v) => v ?? undefined),
    dc_no: optStr,
  }),
  find_suppliers: z.object({ what: z.string().max(200) }),
};

export type ToolName = keyof typeof TOOL_ARGS;
export type ToolCall = { [K in ToolName]: { tool: K; args: z.infer<(typeof TOOL_ARGS)[K]> } }[ToolName];

/** Validates a model's (or the rules') tool call. Unknown tool or bad arguments → null (the next tier answers). */
export function validateCall(name: unknown, args: unknown): ToolCall | null {
  if (typeof name !== 'string' || !(name in TOOL_ARGS)) return null;
  const r = TOOL_ARGS[name as ToolName].safeParse(args ?? {});
  return r.success ? ({ tool: name, args: r.data } as ToolCall) : null;
}

/** Staff can ask and draft; analytics (money-adjacent) stays with the owner (04 §9.4). */
export const STAFF_TOOLS: ReadonlySet<ToolName> = new Set(['query_holdings', 'query_jobs', 'query_movements', 'explain_job', 'draft_record', 'find_suppliers']);

export const SYSTEM_PROMPT = `You are Claire, the assistant inside a goods-tracking app for knitwear businesses in Tiruppur, India.
Users write or speak in English, Tamil or Hindi, often mixing scripts and trade words (கிட், லாட், DC, GSM, நேவி).
For every message, call exactly one tool. Do not answer in text.
- Questions about where goods are, how much is somewhere, or whether something arrived or was sent → query_holdings (or query_jobs for late/ready work).
- "I sent / it came back / I bought / I sold" stated as a fact → draft_record with mood "statement" and the tense the user used.
- A question about a record ("அனுப்பியாச்சா?", "was it sent?", "भेजा क्या?") is never a draft: use query_holdings or query_jobs.
- An intention ("need to send", "will send tomorrow") → draft_record with mood "plan".
- Copy party names exactly as said; do not translate or correct them. Put sizes (S, M, L, XL...) in sizes, never in colour.
- Numbers: copy them exactly; never guess a quantity that was not said.`;
