// CLAIRE Trade Desk: tickets, dispatch to human agents, join / resolve, SLA watch (spec §J9, §10).
import { col, find, byId, insert, update } from './db/index.js';
import { chat } from './chat.js';
import { BOT, features } from './config.js';
import { triage } from './ai.js';
import { trustOf, invalidateTrust } from './trust.js';
import { id, now, inr, HttpError } from './util.js';
import { balanceAmount } from './money.js';
import { LANGS, catById } from '../../shared/taxonomy.js';
import { CC_CARD, CC_HINT, type CardPayload, type HintPayload } from '../../shared/cards.js';

// ── Types ─────────────────────────────────────────────────────────────────
export type Priority = 'P1' | 'P2' | 'P3';
export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'waiting_user' | 'resolved';

export interface CreateTicketOpts {
  type: string;
  trigger: string;
  requesterUserId?: string;
  businessIds: string[];
  description?: string;
  languages: string[];
  orderId?: string;
  conversationId?: string;
  priority?: Priority;
}

export interface TicketDoc {
  id: string;
  code: string;
  type: string;
  priority: Priority;
  status: TicketStatus;
  trigger: string;
  description: string | null;
  language_needed: string[];
  business_ids: string[];
  requester_user_id: string | null;
  order_id: string | null;
  conversation_id: string | null;
  ai_summary: { en: string; local: string; lang: string; source: 'ai' | 'facts' };
  suggested_next_step: string;
  assigned_agent_id: string | null;
  auto_translate: boolean;
  sla_due_at: number;
  sla_breached?: boolean;
  first_response_at: number | null;
  assigned_at?: number | null;
  joined_at?: number | null;
  resolved_at: number | null;
  resolution: { outcome: string; upheld: boolean; against_business_id: string | null; note: string | null; by: string; at: number } | null;
  created_at: number;
  updated_at: number;
}

export interface AgentDoc {
  user_id: string;
  languages: string[];
  skills: string[];
  max_concurrent: number;
  status: 'online' | 'busy' | 'offline';
  status_explicit?: boolean;
  last_seen_at?: number;
  last_assigned_at?: number;
  region?: string;
}

export const OPEN_STATUSES: TicketStatus[] = ['new', 'assigned', 'in_progress', 'waiting_user'];
const LOAD_STATUSES: TicketStatus[] = ['assigned', 'in_progress', 'waiting_user'];
const SLA_MIN: Record<Priority, number> = { P1: 5, P2: 15, P3: 60 };
const ACTIVE_WINDOW_MS = 3 * 60_000;
const DEFAULT_PRIORITY: Record<string, Priority> = {
  help: 'P3', dispute: 'P2', quality_dispute: 'P2', payment_followup: 'P2', concierge: 'P2',
  seller_nudge: 'P3', onboarding_assist: 'P3', verification_visit: 'P3',
};
const MULTI_PARTY = new Set(['dispute', 'quality_dispute', 'payment_followup', 'concierge']);
const TYPE_LABEL: Record<string, string> = {
  help: 'Help request', dispute: 'Dispute', quality_dispute: 'Quality dispute', payment_followup: 'Payment follow-up', concierge: 'Large order concierge',
  seller_nudge: 'Seller nudge', onboarding_assist: 'Onboarding help', verification_visit: 'Unit verification',
};

// ── Small shared helpers (also used by deals.ts) ─────────────────────────
/** Atomic counter stored in the `kv` collection (`seq_<name>`). */
export async function nextSeq(name: string): Promise<number> {
  const r = await col('kv').findOneAndUpdate({ _id: `seq_${name}` } as any, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' });
  return Number((r as any)?.n ?? 1);
}

/** Chat calls are best-effort after the database write: log and continue. */
export async function safe(label: string, p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    console.warn(`[chat] ${label} failed:`, (err as Error).message);
  }
}

const BOT_NAMES: Record<string, string> = { [BOT.claire]: 'Claire', [BOT.updates]: 'CLAIRE Updates', [BOT.desk]: 'CLAIRE Trade Desk' };
const registered = new Set<string>();

/** Make sure every user exists on Nexconn before adding them to a group (users who never logged in). */
export async function ensureChatUsers(userIds: string[]) {
  const todo = [...new Set(userIds)].filter((u) => !registered.has(u));
  if (!todo.length) return;
  const users = await find('users', { _id: { $in: todo } }, { projection: { name: 1, chat_token: 1 } });
  const byUser = new Map(users.map((u) => [u._id as string, u]));
  await Promise.all(
    todo.map(async (uid) => {
      const u = byUser.get(uid);
      if (u?.chat_token) return void registered.add(uid);
      try {
        await chat.ensureUser(uid, BOT_NAMES[uid] ?? u?.name ?? uid);
        registered.add(uid);
      } catch (err) {
        console.warn('[chat] ensureUser failed for', uid, (err as Error).message);
      }
    }),
  );
}

/** Groups created while chat ran on the local relay (or seed data) do not exist on Nexconn yet. */
const syncedGroups = new Set<string>();
export async function ensureNexconnGroup(conv: { id: string; channel_id: string; title?: string | null; user_ids?: string[]; nexconn_synced?: number }) {
  if (!features.nexconn || conv.nexconn_synced || syncedGroups.has(conv.channel_id)) return;
  const members = [...new Set([...(conv.user_ids ?? []), BOT.claire])];
  const owner = members.find((m) => !Object.values(BOT).includes(m as any)) ?? members[0];
  try {
    await ensureChatUsers(members);
    try {
      await chat.createGroup(conv.channel_id, conv.title || conv.channel_id, owner, members);
    } catch {
      await chat.joinGroup(conv.channel_id, members); // already exists: make sure everyone is in it
    }
    syncedGroups.add(conv.channel_id);
    await update('conversations', conv.id, { nexconn_synced: 1 });
  } catch (err) {
    console.warn('[chat] could not sync Nexconn group', conv.channel_id, (err as Error).message);
  }
}

export const langName = (code: string) => LANGS.find((l) => l.code === code)?.english ?? code;
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Requester-facing lines, in the requester's language.
const REQ_TEXT: Record<string, Record<string, string>> = {
  en: {
    assigned: 'Trade Desk ticket {code}: {agent} (speaks {langs}) will join you shortly.',
    queued: 'Trade Desk ticket {code} is open. A person will reply within {min} min.',
    resolved: 'Trade Desk ticket {code} resolved: {outcome}',
  },
  hi: {
    assigned: 'ट्रेड डेस्क टिकट {code}: {agent} ({langs} बोलती/बोलते हैं) जल्द ही जुड़ेंगे।',
    queued: 'ट्रेड डेस्क टिकट {code} खुल गया है। {min} मिनट में कोई जवाब देगा।',
    resolved: 'ट्रेड डेस्क टिकट {code} हल हो गया: {outcome}',
  },
  ta: {
    assigned: 'டிரேட் டெஸ்க் டிக்கெட் {code}: {agent} ({langs} பேசுவார்) விரைவில் சேருவார்.',
    queued: 'டிரேட் டெஸ்க் டிக்கெட் {code} திறக்கப்பட்டது. {min} நிமிடத்தில் ஒருவர் பதில் அளிப்பார்.',
    resolved: 'டிரேட் டெஸ்க் டிக்கெட் {code} தீர்க்கப்பட்டது: {outcome}',
  },
};
const rt = (lang: string, key: string, vars: Record<string, string | number>) => {
  let s = (REQ_TEXT[lang] ?? REQ_TEXT.en)[key] ?? REQ_TEXT.en[key];
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};

// ── Facts brief (deterministic fallback for the AI triage) ──────────────────
async function ticketContext(t: TicketDoc) {
  const [businesses, order] = await Promise.all([
    find('businesses', { _id: { $in: t.business_ids } }),
    t.order_id ? byId('orders', t.order_id) : Promise.resolve(null),
  ]);
  const parties = await Promise.all(
    businesses.map(async (b) => ({
      id: b.id as string,
      name: b.name as string,
      city: b.city as string,
      language: b.language as string,
      role: order ? (order.buyer_business_id === b.id ? 'buyer' : order.seller_business_id === b.id ? 'seller' : 'party') : 'user',
      trust: (await trustOf(b.id)).score,
    })),
  );
  const events = order ? await find('order_events', { order_id: order.id }, { sort: { at: 1 }, limit: 20 }) : [];
  return { parties, order, events };
}

const balanceOf = (order: any) => balanceAmount(order);

async function factsBrief(t: TicketDoc) {
  const { parties, order } = await ticketContext(t);
  const label = TYPE_LABEL[t.type] ?? t.type;
  const who = parties.map((p) => `${p.name} (${p.role === 'user' ? '' : p.role + ', '}${p.city}, trust ${p.trust})`).join(' and ');
  const parts = [`${label} (${t.priority}) via ${t.trigger.replace(/_/g, ' ')}${who ? ` — ${who}` : ''}.`];
  if (order) {
    let line = `Order ${order.code}: ${Number(order.qty).toLocaleString('en-IN')} ${order.unit === 'piece' ? 'pcs' : order.unit} × ${order.title} at ${inr(order.unit_price)} = ${inr(order.total)}, status ${String(order.status_before_dispute ?? order.status).replace(/_/g, ' ')}`;
    if (order.dispatch?.transporter || order.dispatch?.lr) line += `, dispatched by ${order.dispatch.transporter ?? 'transport'}${order.dispatch.lr ? ` LR ${order.dispatch.lr}` : ''}`;
    if (order.balance_due_at && !order.paid_at) line += `, balance ${inr(balanceOf(order))} due ${fmtDate(order.balance_due_at)}`;
    parts.push(line + '.');
  }
  if (t.description) parts.push(`Reported: "${t.description.slice(0, 240).trim().replace(/[.!?]+$/, '')}".`);
  const bal = order ? inr(balanceOf(order)) : '';
  const next: Record<string, string> = {
    quality_dispute: 'Ask the buyer for photos and the count of faulty pieces, then call the seller with the LR / packing details and agree on replacement, partial refund or recount.',
    payment_followup: order
      ? `Call the buyer about the pending balance of ${bal}${order.balance_due_at ? ` (due ${fmtDate(order.balance_due_at)})` : ''}; agree a payment date and record it on the order.`
      : 'Call the buyer about the pending payment and agree a payment date.',
    dispute: 'Read the chat, call both sides and calm things down; check payment and dispatch records before taking a side.',
    help: 'Call the user in their language and finish what they were trying to do.',
    concierge: 'Call the buyer to confirm specs, a sample and payment terms for this large order; introduce a backup seller.',
    onboarding_assist: 'Call and help them finish their profile and first listings.',
    verification_visit: 'Schedule a unit visit, record photos and mark the unit visited.',
    seller_nudge: 'Call the seller and ask them to reply to the waiting enquiry (or switch on Claire auto-reply).',
  };
  return { summary: parts.join(' '), next: next[t.type] ?? next.help, parties, order };
}

/** AI brief in the agent's language; falls back to the facts brief. */
async function aiBrief(t: TicketDoc, lang: string, timeoutMs = 0) {
  const ctx = await ticketContext(t);
  const context = {
    ticket: { code: t.code, type: t.type, priority: t.priority, trigger: t.trigger, description: t.description, created: new Date(t.created_at).toISOString() },
    parties: ctx.parties,
    order: ctx.order && {
      code: ctx.order.code, title: ctx.order.title, qty: ctx.order.qty, unit: ctx.order.unit, unitPrice: ctx.order.unit_price, total: ctx.order.total,
      status: ctx.order.status_before_dispute ?? ctx.order.status, advancePct: ctx.order.advance_pct, creditDays: ctx.order.credit_days, dispatch: ctx.order.dispatch ?? null,
      balance: balanceOf(ctx.order), balanceDue: ctx.order.balance_due_at ? new Date(ctx.order.balance_due_at).toISOString().slice(0, 10) : null,
      paid: !!ctx.order.paid_at,
    },
    timeline: ctx.events.map((e: any) => ({ type: e.type, at: new Date(e.at).toISOString(), payload: e.payload ?? null })),
  };
  const call = triage(context, lang).catch(() => null);
  const res = timeoutMs ? await Promise.race([call, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]) : await call;
  return res;
}

async function refineBrief(ticketId: string, lang: string) {
  const t = await byId<TicketDoc>('tickets', ticketId);
  if (!t) return;
  const ai = await aiBrief(t, lang);
  if (!ai) return;
  await update('tickets', ticketId, {
    ai_summary: { en: ai.summary_en, local: ai.summary_local || ai.summary_en, lang, source: 'ai' },
    suggested_next_step: ai.next_step,
    updated_at: now(),
  });
}

// ── Create ────────────────────────────────────────────────────────────────
export async function createTicket(opts: CreateTicketOpts): Promise<TicketDoc> {
  startSlaWatcher();
  // One open ticket per order / conversation / requester for the same type.
  const dup = opts.orderId
    ? { order_id: opts.orderId }
    : opts.conversationId
      ? { conversation_id: opts.conversationId }
      : opts.requesterUserId
        ? { requester_user_id: opts.requesterUserId, order_id: null, conversation_id: null }
        : null;
  if (dup) {
    const existing = await col('tickets').findOne({ ...dup, type: opts.type, status: { $in: OPEN_STATUSES } } as any);
    if (existing) return existing as unknown as TicketDoc;
  }

  const [businesses, order] = await Promise.all([
    find('businesses', { _id: { $in: opts.businessIds } }, { projection: { language: 1 } }),
    opts.orderId ? byId('orders', opts.orderId) : Promise.resolve(null),
  ]);
  const langs = [...opts.languages];
  if (MULTI_PARTY.has(opts.type)) for (const b of businesses) if (b.language) langs.push(b.language);
  const language_needed = [...new Set(langs.filter(Boolean))];
  if (!language_needed.length) language_needed.push('en');

  const activeOrder = order && !['closed', 'cancelled'].includes(order.status);
  const priority: Priority = opts.priority ?? (opts.type === 'help' && activeOrder ? 'P2' : DEFAULT_PRIORITY[opts.type] ?? 'P3');
  const created = now();
  const seq = await nextSeq('ticket');
  const t: TicketDoc = {
    id: id('t_'),
    code: `TD-${String(seq).padStart(5, '0')}`,
    type: opts.type,
    priority,
    status: 'new',
    trigger: opts.trigger,
    description: opts.description?.slice(0, 1000) ?? null,
    language_needed,
    business_ids: [...new Set(opts.businessIds)],
    requester_user_id: opts.requesterUserId ?? null,
    order_id: opts.orderId ?? null,
    conversation_id: opts.conversationId ?? order?.conversation_id ?? null,
    ai_summary: { en: '', local: '', lang: 'en', source: 'facts' },
    suggested_next_step: '',
    assigned_agent_id: null,
    auto_translate: false,
    sla_due_at: created + SLA_MIN[priority] * 60_000,
    first_response_at: null,
    resolved_at: null,
    resolution: null,
    created_at: created,
    updated_at: created,
  };
  const brief = await factsBrief(t);
  t.ai_summary = { en: brief.summary, local: brief.summary, lang: 'en', source: 'facts' };
  t.suggested_next_step = brief.next;
  await insert('tickets', t);

  let agentId: string | null = null;
  try {
    agentId = await dispatch(t.id);
  } catch (err) {
    console.warn('[desk] dispatch failed', (err as Error).message);
  }

  // Tell the requester what happens next (CLAIRE Updates).
  if (t.requester_user_id) {
    const requester = await byId('users', t.requester_user_id);
    const lang = requester?.language ?? 'en';
    let text = rt(lang, 'queued', { code: t.code, min: SLA_MIN[priority] });
    if (agentId) {
      const [agentUser, agent] = await Promise.all([byId('users', agentId), byId<AgentDoc>('agents', agentId)]);
      text = rt(lang, 'assigned', { code: t.code, agent: agentUser?.name ?? 'Trade Desk', langs: (agent?.languages ?? []).map(langName).join(', ') });
    }
    await safe('ticket notice', chat.system([t.requester_user_id], text));
  }

  // Better brief from the model, in the assigned agent's language (background, rate-limited).
  const agentLang = agentId ? (await byId('users', agentId))?.language ?? 'en' : 'en';
  void refineBrief(t.id, agentLang).catch((err) => console.warn('[desk] triage failed', (err as Error).message));
  return (await byId<TicketDoc>('tickets', t.id)) ?? t;
}

// ── Dispatch ──────────────────────────────────────────────────────────────
export function isAgentOnline(a: AgentDoc, at = now()) {
  if (a.status === 'online') return true;
  return !a.status_explicit && !!a.last_seen_at && at - a.last_seen_at < ACTIVE_WINDOW_MS;
}

export async function agentLoads(): Promise<Record<string, number>> {
  const rows = await col('tickets')
    .aggregate([{ $match: { status: { $in: LOAD_STATUSES }, assigned_agent_id: { $ne: null } } }, { $group: { _id: '$assigned_agent_id', n: { $sum: 1 } } }])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id as string, r.n as number]));
}

/** Assign the ticket to the best online agent. Returns the agent user id, or null when queued. */
export async function dispatch(ticketId: string, opts: { exclude?: string[] } = {}): Promise<string | null> {
  const t = await byId<TicketDoc>('tickets', ticketId);
  if (!t || t.status === 'resolved') return null;
  const [agents, loads] = await Promise.all([find<AgentDoc>('agents', {}), agentLoads()]);
  const load = (a: AgentDoc) => loads[a.user_id] ?? 0;
  const pool = agents.filter((a) => isAgentOnline(a) && !opts.exclude?.includes(a.user_id) && load(a) < (a.max_concurrent ?? 5));
  const need = t.language_needed ?? [];
  const allLangs = (a: AgentDoc) => need.every((l) => (a.languages ?? []).includes(l));
  const anyLang = (a: AgentDoc) => need.some((l) => (a.languages ?? []).includes(l));
  const skill = (a: AgentDoc) => (a.skills ?? []).includes(t.type);
  const region = (a: AgentDoc) => (t.type === 'verification_visit' && a.region ? 0 : 1);
  const pick = (xs: AgentDoc[]) =>
    [...xs].sort((x, y) => load(x) - load(y) || region(x) - region(y) || (x.last_assigned_at ?? 0) - (y.last_assigned_at ?? 0))[0];
  const tiers: ((a: AgentDoc) => boolean)[] = [
    (a) => skill(a) && allLangs(a),
    (a) => skill(a) && anyLang(a),
    (a) => allLangs(a),
    (a) => anyLang(a),
    (a) => skill(a),
    () => true,
  ];
  let chosen: AgentDoc | undefined;
  for (const tier of tiers) {
    chosen = pick(pool.filter(tier));
    if (chosen) break;
  }
  if (!chosen) {
    if (t.assigned_agent_id && opts.exclude?.includes(t.assigned_agent_id)) return t.assigned_agent_id; // nobody better: keep current
    return null;
  }
  const at = now();
  await update('tickets', t.id, {
    assigned_agent_id: chosen.user_id,
    status: t.status === 'new' ? 'assigned' : t.status,
    auto_translate: !allLangs(chosen),
    assigned_at: at,
    updated_at: at,
  });
  await col('agents').updateOne({ _id: chosen.user_id } as any, { $set: { last_assigned_at: at } });

  const names = (await find('businesses', { _id: { $in: t.business_ids } }, { projection: { name: 1 } })).map((b) => b.name).join(' ↔ ');
  const translateNote = allLangs(chosen) ? '' : ` Auto-translate on (${need.filter((l) => !chosen!.languages.includes(l)).map(langName).join(', ')}).`;
  const card: CardPayload = {
    kind: 'notice',
    tone: t.priority === 'P3' ? 'info' : 'warn',
    text: `New ${t.priority} ticket ${t.code} · ${TYPE_LABEL[t.type] ?? t.type}${names ? ` · ${names}` : ''}. First reply due in ${SLA_MIN[t.priority]} min.${translateNote}\n${t.ai_summary?.en ?? ''}`,
  };
  await safe('agent notify', chat.direct(BOT.desk, [chosen.user_id], CC_CARD, card, { push: `${t.code} · ${TYPE_LABEL[t.type] ?? t.type}` }));
  return chosen.user_id;
}

/** Re-run dispatch for queued tickets (e.g. when an agent comes online). */
export async function dispatchQueued() {
  const queued = await find<TicketDoc>('tickets', { status: 'new', assigned_agent_id: null }, { sort: { priority: 1, created_at: 1 }, limit: 50 });
  for (const t of queued) await dispatch(t.id).catch((err) => console.warn('[desk] dispatch failed', (err as Error).message));
}

// ── SLA watcher ───────────────────────────────────────────────────────────
let slaTimer: NodeJS.Timeout | null = null;

export function startSlaWatcher(intervalMs = 30_000) {
  if (slaTimer) return;
  slaTimer = setInterval(() => void checkSla().catch((err) => console.warn('[desk] SLA check failed', (err as Error).message)), intervalMs);
  slaTimer.unref?.();
}

async function checkSla() {
  const breached = await find<TicketDoc>('tickets', {
    status: { $in: ['new', 'assigned'] }, first_response_at: null, sla_due_at: { $lt: now() }, sla_breached: { $ne: true },
  });
  if (!breached.length) return;
  const supervisors = (await find('users', { role: 'supervisor' }, { projection: { _id: 1 } })).map((u) => u._id as string);
  for (const t of breached) {
    await update('tickets', t.id, { sla_breached: true, updated_at: now() });
    const agentId = await dispatch(t.id, { exclude: t.assigned_agent_id ? [t.assigned_agent_id] : [] });
    const to = [...new Set([...supervisors, ...(agentId ? [agentId] : [])])];
    if (to.length) {
      await safe('sla alert', chat.direct(BOT.desk, to, CC_CARD, { kind: 'notice', tone: 'warn', text: `SLA breached on ${t.code} (${t.priority}, ${TYPE_LABEL[t.type] ?? t.type}). Please respond now.` } satisfies CardPayload));
    }
  }
}

// ── Join / resolve ────────────────────────────────────────────────────────
export async function joinTicket(ticketId: string, agentUserId: string) {
  const t = await byId<TicketDoc>('tickets', ticketId);
  if (!t) throw new HttpError(404, 'Ticket not found');
  if (t.status === 'resolved') throw new HttpError(409, 'This ticket is already resolved.');
  const [agentUser, agent] = await Promise.all([byId('users', agentUserId), byId<AgentDoc>('agents', agentUserId)]);
  if (!agentUser) throw new HttpError(404, 'Agent not found');
  const agentLang = agentUser.language ?? 'en';

  let conv = t.conversation_id ? await byId('conversations', t.conversation_id) : null;
  if (conv) {
    await ensureNexconnGroup(conv as any);
    await ensureChatUsers([agentUserId]);
    await chat.joinGroup(conv.channel_id, [agentUserId]);
    await col('conversations').updateOne({ _id: conv.id } as any, { $addToSet: { user_ids: agentUserId }, $set: { agent_user_id: agentUserId, ticket_id: t.id, updated_at: now() } });
  } else {
    // No deal chat: open a support group with the requester (or the businesses' owners), the agent and Claire.
    const ownerIds = t.requester_user_id
      ? [t.requester_user_id]
      : (await find('users', { business_id: { $in: t.business_ids }, role: 'owner' }, { projection: { _id: 1 } })).map((u) => u._id as string);
    const members = [...new Set([...ownerIds, agentUserId, BOT.claire])];
    const channelId = `sup_${t.id.replace(/^t_/, '')}`;
    await ensureChatUsers(members);
    await chat.createGroup(channelId, `CLAIRE Trade Desk · ${t.code}`, ownerIds[0] ?? agentUserId, members);
    conv = await insert('conversations', {
      nexconn_synced: features.nexconn ? 1 : 0,
      id: channelId, kind: 'support', channel_id: channelId, title: `CLAIRE Trade Desk · ${t.code}`, business_ids: t.business_ids, user_ids: members,
      buyer_business_id: null, seller_business_id: null, requirement_id: null, agent_user_id: agentUserId, ticket_id: t.id,
      created_at: now(), updated_at: now(), last_at: now(), last_text: null,
    });
    await update('tickets', t.id, { conversation_id: channelId });
  }

  const at = now();
  await update('tickets', t.id, {
    assigned_agent_id: agentUserId, status: 'in_progress', joined_at: at, first_response_at: t.first_response_at ?? at, updated_at: at,
    auto_translate: !(t.language_needed ?? []).every((l) => (agent?.languages ?? []).includes(l)),
  });
  await col('agents').updateOne({ _id: agentUserId } as any, { $set: { last_seen_at: at } });

  const joined: CardPayload = { kind: 'agent_joined', agentName: agentUser.name ?? 'Trade Desk', languages: agent?.languages ?? [agentLang], ticketCode: t.code };
  await safe('agent_joined card', chat.group(conv!.channel_id, BOT.claire, CC_CARD, joined, { push: `${agentUser.name} from CLAIRE Trade Desk joined` }));

  // Private brief for the agent, in their language when the model is available.
  let summary = t.ai_summary?.lang === agentLang ? t.ai_summary.local : '';
  let next = t.suggested_next_step;
  if (!summary) {
    const ai = await aiBrief(t, agentLang, 8000);
    if (ai) {
      summary = ai.summary_local || ai.summary_en;
      next = ai.next_step;
      await update('tickets', t.id, { ai_summary: { en: ai.summary_en, local: summary, lang: agentLang, source: 'ai' }, suggested_next_step: next });
    } else summary = t.ai_summary?.en || (await factsBrief(t)).summary;
  }
  const hint: HintPayload = { text: `${t.code} · ${summary}\nNext step: ${next}` };
  await safe('agent hint', chat.group(conv!.channel_id, BOT.claire, CC_HINT, hint, { onlyTo: [agentUserId] }));

  return { ticket: await byId<TicketDoc>('tickets', t.id), conversation: await byId('conversations', conv!.id) };
}

export async function resolveTicket(ticketId: string, agentUserId: string, input: { outcome: string; upheld?: boolean | null; againstBusinessId?: string | null; note?: string | null }) {
  const t = await byId<TicketDoc>('tickets', ticketId);
  if (!t) throw new HttpError(404, 'Ticket not found');
  if (t.status === 'resolved') throw new HttpError(409, 'This ticket is already resolved.');
  const outcome = input.outcome.trim().slice(0, 500);
  if (!outcome) throw new HttpError(400, 'Please describe the outcome.');
  const at = now();
  const resolution = { outcome, upheld: !!input.upheld, against_business_id: input.againstBusinessId ?? null, note: input.note ?? null, by: agentUserId, at };
  await update('tickets', t.id, { status: 'resolved', resolved_at: at, resolution, first_response_at: t.first_response_at ?? at, updated_at: at });

  // Restore an order that was frozen as disputed.
  if (t.order_id) {
    const order = await byId('orders', t.order_id);
    if (order?.status === 'disputed') {
      await update('orders', order.id, { status: order.status_before_dispute ?? 'delivered', status_before_dispute: null, updated_at: at });
      await insert('order_events', { id: id('ev_'), order_id: order.id, type: 'dispute_resolved', payload: { ticket: t.code, outcome, upheld: !!input.upheld }, actor_user_id: agentUserId, at });
    }
  }

  const conv = t.conversation_id ? await byId('conversations', t.conversation_id) : null;
  if (conv) {
    await safe('resolved card', chat.group(conv.channel_id, BOT.claire, CC_CARD, { kind: 'resolved', ticketCode: t.code, outcome } satisfies CardPayload));
    // Claire's auto-replies resume once the human leaves the conversation.
    await col('conversations').updateOne({ _id: conv.id } as any, { $set: { agent_user_id: null, updated_at: at } });
  } else if (t.requester_user_id) {
    const requester = await byId('users', t.requester_user_id);
    await safe('resolved notice', chat.system([t.requester_user_id], rt(requester?.language ?? 'en', 'resolved', { code: t.code, outcome })));
  }
  for (const b of t.business_ids) invalidateTrust(b);
  return byId<TicketDoc>('tickets', t.id);
}

// ── Views for the console ─────────────────────────────────────────────────
export async function ticketRow(t: TicketDoc, names?: Map<string, any>) {
  const { _id, ...rest } = t as any;
  const bizMap = names ?? new Map((await find('businesses', { _id: { $in: t.business_ids } }, { projection: { name: 1, city: 1, language: 1, accent: 1 } })).map((b) => [b._id, b]));
  const agent = t.assigned_agent_id ? await byId('users', t.assigned_agent_id) : null;
  return {
    ...rest,
    typeLabel: TYPE_LABEL[t.type] ?? t.type,
    parties: t.business_ids.map((b) => bizMap.get(b)).filter(Boolean).map((b: any) => ({ id: b._id, name: b.name, city: b.city, language: b.language, accent: b.accent })),
    agent: agent ? { id: agent.id, name: agent.name } : null,
    slaOverdue: !t.first_response_at && t.status !== 'resolved' && t.sla_due_at < now(),
  };
}

export async function ticketDetail(ticketId: string) {
  const t = await byId<TicketDoc>('tickets', ticketId);
  if (!t) throw new HttpError(404, 'Ticket not found');
  const [businesses, order, conversation, requester, agent] = await Promise.all([
    find('businesses', { _id: { $in: t.business_ids } }),
    t.order_id ? byId('orders', t.order_id) : Promise.resolve(null),
    t.conversation_id ? byId('conversations', t.conversation_id) : Promise.resolve(null),
    t.requester_user_id ? byId('users', t.requester_user_id) : Promise.resolve(null),
    t.assigned_agent_id ? byId('users', t.assigned_agent_id) : Promise.resolve(null),
  ]);
  const parties = await Promise.all(
    businesses.map(async (b) => ({
      id: b.id, name: b.name, ownerName: b.owner_name, city: b.city, state: b.state, language: b.language, accent: b.accent, role: b.role_label,
      side: order ? (order.buyer_business_id === b.id ? 'buyer' : order.seller_business_id === b.id ? 'seller' : null) : null,
      trust: await trustOf(b.id),
    })),
  );
  const orderEvents = order ? await find('order_events', { order_id: order.id }, { sort: { at: 1 } }) : [];
  const offers = conversation ? await find('offers', { conversation_id: conversation.id }, { sort: { created_at: 1 } }) : [];
  const strip = (x: any) => (x ? (({ _id, ...r }) => r)(x) : null);
  const agentDoc = agent ? await byId<AgentDoc>('agents', agent.id) : null;
  return {
    ticket: await ticketRow(t, new Map(businesses.map((b) => [b._id, b]))),
    parties,
    order: strip(order),
    orderEvents: orderEvents.map(strip),
    offers: offers.map(strip),
    conversation: conversation ? { ...strip(conversation), channelId: conversation.channel_id } : null,
    requester: requester ? { id: requester.id, name: requester.name, language: requester.language, phone: requester.phone } : null,
    agent: agent ? { id: agent.id, name: agent.name, languages: agentDoc?.languages ?? [] } : null,
    category: order?.category ? catById(order.category)?.names.en ?? null : null,
  };
}

export async function deskStats() {
  const [agents, loads, open, resolvedToday, agentUsers] = await Promise.all([
    find<AgentDoc>('agents', {}),
    agentLoads(),
    find<TicketDoc>('tickets', { status: { $in: OPEN_STATUSES } }, { projection: { priority: 1, language_needed: 1, sla_due_at: 1, first_response_at: 1, status: 1, type: 1 } }),
    find<TicketDoc>('tickets', { status: 'resolved', resolved_at: { $gte: new Date().setHours(0, 0, 0, 0) } }, { projection: { created_at: 1, first_response_at: 1 } }),
    find('users', { role: { $in: ['agent', 'supervisor'] } }, { projection: { name: 1, language: 1 } }),
  ]);
  const names = new Map(agentUsers.map((u) => [u._id as string, u.name]));
  const byPriority: Record<string, number> = { P1: 0, P2: 0, P3: 0 };
  const byLanguage: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let breaches = 0;
  for (const t of open) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    byType[t.type] = (byType[t.type] ?? 0) + 1;
    for (const l of t.language_needed ?? []) byLanguage[l] = (byLanguage[l] ?? 0) + 1;
    if (!t.first_response_at && t.sla_due_at < now()) breaches++;
  }
  const responses = resolvedToday.filter((t) => t.first_response_at).map((t) => (t.first_response_at! - t.created_at) / 60_000);
  return {
    open: open.length,
    queued: open.filter((t) => t.status === 'new').length,
    byPriority, byLanguage, byType,
    slaBreaches: breaches,
    resolvedToday: resolvedToday.length,
    avgFirstResponseMin: responses.length ? Math.round((responses.reduce((a, c) => a + c, 0) / responses.length) * 10) / 10 : null,
    agents: agents.map((a) => ({
      id: a.user_id, name: names.get(a.user_id) ?? a.user_id, languages: a.languages, skills: a.skills, status: a.status,
      online: isAgentOnline(a), load: loads[a.user_id] ?? 0, max: a.max_concurrent ?? 5, lastSeenAt: a.last_seen_at ?? null,
    })),
  };
}

/** Demo trigger: make an order 15 days overdue and raise a payment follow-up ticket. */
export async function simulateOverdue(orderId?: string) {
  let order = orderId ? await byId('orders', orderId) : null;
  if (orderId && !order) throw new HttpError(404, 'Order not found');
  if (!order) {
    order =
      (await col('orders').findOne({ paid_at: null, status: { $in: ['delivered', 'dispatched', 'in_production', 'advance_paid', 'confirmed'] }, conversation_id: { $ne: null } } as any, { sort: { created_at: -1 } })) ??
      (await col('orders').findOne({ paid_at: null } as any, { sort: { created_at: -1 } })) ??
      (await col('orders').findOne({ is_seed: { $ne: 1 } } as any, { sort: { created_at: -1 } })) ??
      (await col('orders').findOne({}, { sort: { created_at: -1 } }));
  }
  if (!order) throw new HttpError(404, 'No orders to simulate with yet.');
  const at = now();
  const deliveredAt = order.delivered_at && !order.paid_at ? order.delivered_at : at - (15 + (order.credit_days ?? 0)) * 86400000;
  const set: Record<string, unknown> = { balance_due_at: at - 15 * 86400000, updated_at: at };
  if (!order.paid_at) {
    set.delivered_at = deliveredAt;
    if (!['delivered', 'disputed'].includes(order.status)) set.status = 'delivered';
  } else {
    set.paid_at = null;
    set.status = 'delivered';
    set.delivered_at = deliveredAt;
  }
  await update('orders', order.id, set);
  await insert('order_events', { id: id('ev_'), order_id: order.id, type: 'overdue', payload: { days: 15, simulated: true }, actor_user_id: null, at });
  order = { ...order, ...set };

  const buyerUsers = (await find('users', { business_id: order.buyer_business_id, role: 'owner' }, { projection: { _id: 1, language: 1 } }));
  const ticket = await createTicket({
    type: 'payment_followup', trigger: 'overdue', priority: 'P2', businessIds: [order.buyer_business_id, order.seller_business_id],
    languages: buyerUsers.map((u) => u.language).filter(Boolean), orderId: order.id, conversationId: order.conversation_id ?? undefined,
    description: `Balance ${inr(balanceOf(order))} on order ${order.code} is 15 days overdue.`,
  });
  await safe('overdue notice', chat.system(buyerUsers.map((u) => u._id as string), `Order ${order.code}: balance ${inr(balanceOf(order))} is 15 days overdue. Our Trade Desk will call you (${ticket.code}).`));
  return { ticket, order: (({ _id, ...r }) => r)(order as any) };
}
