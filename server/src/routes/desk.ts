// Trade Desk console API (agents and supervisors only).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { col, find, byId } from '../db/index.js';
import { getUser, type UserRow } from '../biz.js';
import {
  OPEN_STATUSES, dispatchQueued, joinTicket, resolveTicket, ticketDetail, ticketRow, deskStats, simulateOverdue, startSlaWatcher, isAgentOnline,
  type AgentDoc, type TicketDoc,
} from '../desk.js';
import { h, HttpError, now, requireAuth, type AuthedRequest } from '../util.js';

const router = Router();
type DeskRequest = AuthedRequest & { deskUser: UserRow };

startSlaWatcher();

/** Only agents / supervisors; every call also marks the agent as recently active. */
async function deskOnly(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getUser((req as AuthedRequest).uid);
    if (!['agent', 'supervisor'].includes(user.role)) return res.status(403).json({ error: 'The Trade Desk console is for CLAIRE agents only.' });
    (req as DeskRequest).deskUser = user;
    if (user.role === 'agent') void col('agents').updateOne({ _id: user.id } as any, { $set: { last_seen_at: now() } }).catch(() => undefined);
    next();
  } catch (err) {
    next(err);
  }
}

router.use('/desk', requireAuth, deskOnly);

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, `Please check ${r.error.issues[0]?.path?.join('.') || 'the details'} and try again.`);
  return r.data;
}

const PRIORITY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

router.get(
  '/desk/me',
  h(async (req: DeskRequest, res) => {
    const agent = await byId<AgentDoc>('agents', req.deskUser.id);
    res.json({
      user: { id: req.deskUser.id, name: req.deskUser.name, language: req.deskUser.language, role: req.deskUser.role },
      agent: agent ? { ...agent, online: isAgentOnline(agent) } : null,
    });
  }),
);

router.get(
  '/desk/tickets',
  h(async (req: DeskRequest, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'open';
    const filter: Record<string, unknown> = {};
    if (status === 'open') filter.status = { $in: OPEN_STATUSES };
    else if (status !== 'all') filter.status = { $in: status.split(',') };
    if (req.query.mine === '1' || req.query.mine === 'true') filter.assigned_agent_id = req.deskUser.id;
    if (typeof req.query.lang === 'string' && req.query.lang) filter.language_needed = req.query.lang;
    const tickets = await find<TicketDoc>('tickets', filter, { sort: { created_at: -1 }, limit: 200 });
    const bizIds = [...new Set(tickets.flatMap((t) => t.business_ids))];
    const names = new Map((await find('businesses', { _id: { $in: bizIds } }, { projection: { name: 1, city: 1, language: 1, accent: 1 } })).map((b) => [b._id, b]));
    const rows = await Promise.all(tickets.map((t) => ticketRow(t, names)));
    if (status === 'open') rows.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || a.sla_due_at - b.sla_due_at);
    res.json(rows);
  }),
);

router.get(
  '/desk/tickets/:id',
  h(async (req: DeskRequest, res) => {
    res.json(await ticketDetail(req.params.id));
  }),
);

router.post(
  '/desk/status',
  h(async (req: DeskRequest, res) => {
    const { status } = parse(z.object({ status: z.enum(['online', 'busy', 'offline']) }), req.body);
    if (req.deskUser.role !== 'agent') throw new HttpError(400, 'Only agents have a desk status.');
    const at = now();
    await col('agents').updateOne(
      { _id: req.deskUser.id } as any,
      { $set: { status, status_explicit: true, last_seen_at: at, user_id: req.deskUser.id }, $setOnInsert: { languages: [req.deskUser.language], skills: ['help'], max_concurrent: 5 } },
      { upsert: true },
    );
    if (status === 'online') await dispatchQueued();
    const agent = await byId<AgentDoc>('agents', req.deskUser.id);
    res.json({ agent: agent ? { ...agent, online: isAgentOnline(agent) } : null });
  }),
);

router.post(
  '/desk/tickets/:id/join',
  h(async (req: DeskRequest, res) => {
    const out = await joinTicket(req.params.id, req.deskUser.id);
    res.json({ ticket: out.ticket, conversation: out.conversation ? { ...out.conversation, channelId: out.conversation.channel_id } : null });
  }),
);

router.post(
  '/desk/tickets/:id/resolve',
  h(async (req: DeskRequest, res) => {
    const body = parse(
      z.object({ outcome: z.string().min(1).max(500), upheld: z.boolean().nullish(), againstBusinessId: z.string().nullish(), note: z.string().max(1000).nullish() }),
      req.body,
    );
    res.json({ ticket: await resolveTicket(req.params.id, req.deskUser.id, body) });
  }),
);

router.post(
  '/desk/simulate-overdue',
  h(async (req: DeskRequest, res) => {
    const { orderId } = parse(z.object({ orderId: z.string().optional() }), req.body);
    res.json(await simulateOverdue(orderId));
  }),
);

router.get(
  '/desk/stats',
  h(async (_req: DeskRequest, res) => {
    res.json(await deskStats());
  }),
);

export default router;
