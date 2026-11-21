// Personal Claire's goods turn (04 §9.2): chips and plain phrases first (no model), then ONE model call through the
// chain (free OpenRouter model → Claude Haiku 5.5 when enabled → rules). Returns null when the turn isn't about goods,
// so the existing marketplace flow answers it. Logs the tier and outcome per turn, never the user's text.
import { col } from '../../db/index.js';
import { scOn, type Ctx } from '../flag.js';
import type { UserRow } from '../../biz.js';
import type { CardPayload } from '../../../../shared/cards.js';
import type { PartyRef } from '../../../../shared/sc/types.js';
import { chipCall, phraseCall, ruleCall } from './rules.js';
import { openRouterPick, type TierResult } from './openrouter.js';
import { haikuPick } from './haiku.js';
import { STAFF_TOOLS, validateCall, type ToolCall } from './tools.js';
import { runQuery } from './answer.js';
import { makeDraft } from './drafts.js';
import { tr } from './strings.js';

export type Out = { kind: 'text'; text: string } | CardPayload;

async function ctxFor(user: UserRow): Promise<Ctx | null> {
  if (!user.business_id) return null;
  const biz = await col('businesses').findOne({ _id: user.business_id } as any, { projection: { flags: 1, language: 1 } });
  if (!scOn(biz as any)) return null;
  return { businessId: user.business_id, userId: user.id, role: user.role === 'staff' ? 'staff' : 'owner', language: user.language || (biz as any)?.language || 'en' };
}

/** Goods chips for Claire's home card (U1): only when the flag is on for this business. */
export async function goodsChips(user: UserRow) {
  const ctx = await ctxFor(user);
  if (!ctx) return [];
  return [
    { id: 'sc:late', label: tr(ctx.language, 'late_chip') },
    { id: 'sc:out', label: tr(ctx.language, 'out_chip') },
    { id: 'sc:coming', label: tr(ctx.language, 'coming_chip') },
  ];
}

async function log(ctx: Ctx, entry: Record<string, unknown>) {
  await col('sc_claire_log').insertOne({ business_id: ctx.businessId, user_id: ctx.userId, at: Date.now(), ...entry } as any).catch(() => undefined);
}

async function session(userId: string) {
  return (await col('sc_claire_sessions').findOne({ _id: userId } as any)) as any;
}
const keep = (userId: string, pending: ToolCall | null) => col('sc_claire_sessions').updateOne({ _id: userId } as any, { $set: { pending, updated_at: Date.now() } }, { upsert: true });

async function run(ctx: Ctx, call: ToolCall, loose: boolean, party?: PartyRef | null): Promise<Out[] | null> {
  if (call.tool === 'find_suppliers') return null; // the marketplace search flow answers this
  if (ctx.role === 'staff' && !STAFF_TOOLS.has(call.tool)) return [{ kind: 'text', text: tr(ctx.language, 'owner_only') }];
  if (call.tool === 'draft_record') {
    const a = call.args;
    // Questions never draft ("அனுப்பியாச்சா?" is past tense but a question): answer from the records instead.
    if (a.mood === 'question') {
      const q = validateCall('query_holdings', { scope: a.party ? 'out_with_others' : 'any', party: a.party, material: a.lines[0]?.material, colour: a.lines[0]?.colour })!;
      return run(ctx, q, loose, party);
    }
    if (a.mood === 'plan' || a.tense === 'future') return [{ kind: 'chips', text: tr(ctx.language, 'plan'), chips: [{ id: 'sc:out', label: tr(ctx.language, 'out_chip') }] }];
    const d = await makeDraft(ctx, a, loose, party);
    if (d.kind === 'chips') await keep(ctx.userId, null);
    return [d as Out];
  }
  const ans = await runQuery(ctx, call, loose, party);
  if (ans.kind === 'chips') await keep(ctx.userId, call);
  return [ans as Out];
}

export async function scClaireTurn(user: UserRow, input: { text?: string; chipId?: string }): Promise<Out[] | null> {
  const ctx = await ctxFor(user);
  if (!ctx) return null;
  const t0 = Date.now();

  if (input.chipId) {
    const id = input.chipId;
    const direct = chipCall(id);
    if (direct) { await log(ctx, { tier: 'chip', tool: direct.tool, ms: Date.now() - t0 }); return run(ctx, direct, false); }
    // A party picked for a pending question, or for a pending draft (follow-ups stay deterministic).
    let m = /^scp:([bc]):(.+)$/.exec(id);
    if (m) {
      const s = await session(user.id);
      if (!s?.pending) return null;
      await keep(user.id, null);
      return run(ctx, s.pending as ToolCall, false, { k: m[1] as 'b' | 'c', id: m[2] });
    }
    m = /^scd:(dr_[\w-]+):([bc]):(.+)$/.exec(id);
    if (m) {
      const d: any = await col('sc_drafts').findOne({ _id: m[1], user_id: user.id, state: 'pending_party' } as any);
      if (!d) return null;
      await col('sc_drafts').updateOne({ _id: d._id } as any, { $set: { state: 'replaced' } });
      return run(ctx, { tool: 'draft_record', args: d.args }, false, { k: m[2] as 'b' | 'c', id: m[3] });
    }
    return null;
  }

  const text = (input.text ?? '').trim().slice(0, 2000);
  if (!text) return null;
  const phrase = phraseCall(text);
  if (phrase) { await log(ctx, { tier: 'phrase', tool: phrase.tool, ms: Date.now() - t0 }); return run(ctx, phrase, false); }

  // One model call per turn: the free tier, then the paid tier only if the free one failed, then rules.
  const tiers: TierResult[] = [];
  let call: ToolCall | null = null;
  let loose = false;
  const a = await openRouterPick(text);
  tiers.push(a);
  call = a.call;
  if (!call && a.outcome !== 'no_tool') {
    const b = await haikuPick(text, Math.max(1500, 4000 - (Date.now() - t0)));
    tiers.push(b);
    call = b.call;
  }
  if (!call) { call = ruleCall(text); loose = !!call; }
  await log(ctx, { tier: call ? (loose ? 'rules' : tiers.at(-1)?.model) : 'none', tool: call?.tool ?? null, tiers: tiers.map((x) => ({ model: x.model, outcome: x.outcome, ms: x.ms })), ms: Date.now() - t0 });
  if (!call) return null;
  return run(ctx, call, loose);
}
