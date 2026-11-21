// Disputes (03 S8, model §3.7): two figures, the difference, and four v1 outcomes, each with exactly one posting from
// the held difference. Outcomes are absolute ("use the sender's figure"), so "mine/theirs" is only a label on screen.
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import { createTicket } from '../desk.js';
import { requireOwner, type ScRequest } from './flag.js';
import { post } from './repo.js';
import { partyNames } from './views.js';
import { enqueueCard, processDueCards } from './goodsChat.js';
import { casualtyPostings } from './adjust.js';
import { pseudo, real } from '../../../shared/sc/postings.js';
import { todayIST } from '../../../shared/sc/dates.js';
import type { PartyRef, Posting } from '../../../shared/sc/types.js';

const router = Router();
const OPEN = ['open', 'proposed', 'countered', 'escalated'];
type Outcome = 'sent' | 'received' | 'split' | 'credit';

async function myDispute(businessId: string, id: string) {
  const d = await col('sc_discrepancies').findOne({ _id: id, parties: businessId } as any);
  if (!d) throw new HttpError(404, 'Not found');
  return d as any;
}

/** The single posting set for an outcome (model §3.7 mapping table; 04 §5.5). */
export function resolutionPostings(d: any, outcome: Outcome): { postings: Posting[]; resolvedReceived: number } {
  if (d.kind === 'casualty') return { postings: casualtyPostings(d, outcome), resolvedReceived: 0 };
  const pc = d.posting;
  const g = pc.goods;
  const owner = pc.owner as PartyRef;
  // Where the receiver's share lands; a sale passes title (EXTERNAL pair), a sale to someone untracked leaves our books.
  const after = (pc.dest.ownerAfter ?? null) as PartyRef | null;
  const destKey = pc.dest.external ? pseudo(g, 'EXTERNAL', `${pc.dest.party.k}:${pc.dest.party.id}`, owner) : real(g, after ?? owner, pc.dest.party, pc.dest.state, { place: pc.dest.place, via: pc.dest.via ?? null });
  const diff = d.difference as number; // sent − received
  const { sent, received } = d.figures;
  const toReceiver = outcome === 'sent' ? Math.abs(diff) : outcome === 'split' ? Math.floor(Math.abs(diff) / 2) : 0;
  const rest = Math.abs(diff) - toReceiver;
  const P = (key: any, delta: number): Posting => ({ key, delta, dim: g.dim });
  const land = (q: number): Posting[] =>
    after ? [P(pseudo(g, 'EXTERNAL', `${after.k}:${after.id}`, owner), q), P(pseudo(g, 'EXTERNAL', `${owner.k}:${owner.id}`, after), -q), P(destKey, q)] : [P(destKey, q)];
  const out: Posting[] = [];
  if (diff > 0) {
    // Short: the difference sits in disputed(D) on the in-transit custodian.
    out.push(P(real(g, owner, pc.transit_custodian, { s: 'disputed', ref: d._id }), -diff));
    if (toReceiver) out.push(...land(toReceiver));
    if (rest) {
      // Receiver's figure stands: weighed → weighing loss on the terms' bearer; counted → short-shipped, still the
      // sender's (back to the sender's holding).
      out.push(pc.counted ? P(real(g, owner, pc.sender, { s: 'available' }), rest) : P(pseudo(g, 'LOSS', 'weighing_difference', owner, pc.bearer), rest));
    }
  } else if (diff < 0) {
    // Over-receipt: the excess sits held(found_pending) at the receiver.
    out.push(P(real(g, owner, pc.receiver, { s: 'held', reason: 'found_pending', ref: d._id }), diff));
    const toDest = outcome === 'received' || outcome === 'credit' ? -diff : outcome === 'split' ? Math.floor(-diff / 2) : 0;
    if (toDest) out.push(...land(toDest));
    if (-diff - toDest) out.push(P(pseudo(g, 'ADJUSTMENT', 'found_pending', owner), -diff - toDest));
  }
  const resolvedReceived = diff > 0 ? received + toReceiver : outcome === 'sent' ? sent : outcome === 'split' ? sent + Math.floor(-diff / 2) : received;
  return { postings: out, resolvedReceived };
}

async function resolve(req: ScRequest, d: any, outcome: Outcome, note?: string) {
  // A claim carried past closing settles later: the job reopens around the resolution and closes again (04 §5.6.3).
  const { withLateFigure } = await import('./jobs.js');
  return withLateFigure(req.ctx, [d.refs?.job_id], 'dispute_settled', () => resolveNow(req, d, outcome, note));
}

async function resolveNow(req: ScRequest, d: any, outcome: Outcome, note?: string) {
  const { postings, resolvedReceived } = resolutionPostings(d, outcome);
  const at = Date.now();
  await post(req.ctx, { type: 'dispute_resolved', ref: { kind: 'dispute', id: d._id }, payload: { outcome }, business_date: todayIST() }, postings, async (session) => {
    await col('sc_discrepancies').updateOne({ _id: d._id } as any, { $set: { state: 'resolved', resolution: { outcome, by_business_id: req.ctx.businessId, by_user_id: req.ctx.userId, at, note: note ?? null } } }, { session });
    if (d.kind === 'casualty') {
      // Goods of a job written off in a casualty leave that job (they are no longer "still there").
      const lostByJob = new Map<string, number>();
      for (const it of d.items as any[]) {
        if (it.key.state?.s !== 'allocated') continue;
        const back = outcome === 'sent' ? it.qty : outcome === 'split' ? Math.floor(it.qty / 2) : 0;
        lostByJob.set(it.key.state.ref, (lostByJob.get(it.key.state.ref) ?? 0) + it.qty - back);
      }
      for (const [jobId, lost] of lostByJob) if (lost) await col('sc_jobs').updateOne({ _id: jobId } as any, { $inc: { casualty_lost: lost, version: 1 } }, { session });
    }
    if (d.refs?.movement_id) {
      await col('sc_movements').updateOne(
        { _id: d.refs.movement_id, 'lines.line_id': d.refs.line_id } as any,
        { $set: { 'lines.$.settled': { outcome: 'resolved', resolution: outcome, difference: d.difference, pct: d.pct }, 'lines.$.resolved_received': resolvedReceived } },
        { session },
      );
    }
  });
}

async function cardsFor(d: any) {
  const stamp = Date.now();
  await enqueueCard('dispute', d._id, `s_${stamp}`, stamp);
  if (d.refs?.movement_id) await enqueueCard('movement', d.refs.movement_id, `d_${stamp}`, stamp);
  void processDueCards();
}

router.get(
  '/sc/disputes',
  h(async (req: ScRequest, res) => {
    const rows = await col('sc_discrepancies').find({ parties: req.ctx.businessId, state: { $in: OPEN } } as any).sort({ opened_at: -1 }).limit(50).toArray();
    res.json({ disputes: rows.map((d: any) => ({ id: d._id, state: d.state, line_label: d.line_label, dim: d.dim, figures: d.figures, difference: d.difference, opened_at: d.opened_at })) });
  }),
);

router.get(
  '/sc/disputes/:id',
  h(async (req: ScRequest, res) => {
    const d = await myDispute(req.ctx.businessId, req.params.id);
    const refs: PartyRef[] = [d.posting.sender, d.posting.receiver];
    const names = await partyNames(req.ctx, refs);
    const nm = (p: PartyRef) => names.get(`${p.k}:${p.id}`)?.name ?? '—';
    const me = req.ctx.businessId;
    const side = d.sent_by === me ? 'sender' : d.received_by === me ? 'receiver' : 'recorder';
    const last = d.proposals?.at(-1) ?? null;
    res.json({
      id: d._id, state: d.state, kind: d.kind, cause: d.cause ?? null, note: d.note ?? null, line_label: d.line_label, dim: d.dim, counted: d.posting.counted, allowed: d.allowed, pct: d.pct,
      figures: d.figures, difference: d.difference, sender: { ...d.posting.sender, name: nm(d.posting.sender) }, receiver: { ...d.posting.receiver, name: nm(d.posting.receiver) },
      side, twoSided: (d.parties?.length ?? 0) > 1, proposals: d.proposals ?? [], lastProposal: last, mayAccept: !!last && last.by_business_id !== me && d.state !== 'resolved',
      resolution: d.resolution ?? null, refs: d.refs, ticket_id: d.ticket_id ?? null, role: req.ctx.role,
    });
  }),
);

const outcomeBody = z.object({ outcome: z.enum(['sent', 'received', 'split', 'credit']), note: z.string().trim().max(300).optional() });

/** Propose an outcome. Conceding (using the other side's figure) settles at once; one-sided disputes settle at once. */
router.post(
  '/sc/disputes/:id/propose',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const b = outcomeBody.parse(req.body);
    const d = await myDispute(req.ctx.businessId, req.params.id);
    if (!OPEN.includes(d.state)) throw new HttpError(409, 'This difference is already settled.');
    const me = req.ctx.businessId;
    const oneSided = (d.parties?.length ?? 0) < 2;
    const concedes = (d.sent_by === me && b.outcome === 'received') || (d.received_by === me && b.outcome === 'sent');
    if (oneSided || concedes) {
      await resolve(req, d, b.outcome, b.note);
    } else {
      await col('sc_discrepancies').updateOne({ _id: d._id } as any, { $set: { state: d.proposals?.length ? 'countered' : 'proposed' }, $push: { proposals: { by_business_id: me, by_user_id: req.ctx.userId, outcome: b.outcome, note: b.note ?? null, at: Date.now() } } as any });
    }
    await cardsFor(d);
    res.json({ dispute: await col('sc_discrepancies').findOne({ _id: d._id } as any, { projection: { state: 1, resolution: 1, proposals: 1 } }) });
  }),
);

/** Accept the other side's latest proposal. */
router.post(
  '/sc/disputes/:id/accept',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const d = await myDispute(req.ctx.businessId, req.params.id);
    const last = d.proposals?.at(-1);
    if (!last || !OPEN.includes(d.state) || last.by_business_id === req.ctx.businessId) throw new HttpError(409, 'There is nothing to accept.');
    await resolve(req, d, last.outcome, last.note);
    await cardsFor(d);
    res.json({ resolved: true });
  }),
);

/** Ask Trade Desk to help (04 §8.3): a ticket that is not attached to the Goods conversation. */
router.post(
  '/sc/disputes/:id/escalate',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const d = await myDispute(req.ctx.businessId, req.params.id);
    if (!OPEN.includes(d.state)) throw new HttpError(409, 'This difference is already settled.');
    const t = await createTicket({
      type: 'dispute', trigger: 'sc_dispute', requesterUserId: req.ctx.userId, businessIds: d.parties, languages: [req.ctx.language],
      description: `Goods difference on ${d.line_label}: sent ${d.figures.sent}, received ${d.figures.received} (base units, ${d.dim}). Dispute ${d._id}.`,
    });
    await col('sc_discrepancies').updateOne({ _id: d._id } as any, { $set: { state: 'escalated', ticket_id: t.id } });
    await cardsFor(d);
    res.json({ ticket: { id: t.id, code: t.code } });
  }),
);

export default router;
