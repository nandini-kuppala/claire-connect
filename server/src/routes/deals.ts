// Deals, offers, orders, ratings, samples, job-work offers and the conversation inbox.
import { Router } from 'express';
import { z } from 'zod';
import { getUser } from '../biz.js';
import {
  openDeal, openCombo, convOut, inbox, conversationDetail, handleInbound, createOffer, respondOffer, orderEvent, myOrders, orderDetail,
  rateOrder, requestSample, sendJobOffers, dealChip,
} from '../deals.js';
import { h, HttpError, requireAuth, type AuthedRequest } from '../util.js';

const router = Router();

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body ?? {});
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, `Please check ${first?.path?.join('.') || 'the details'} and try again.`);
  }
  return r.data;
}

const money = z.coerce.number().positive().max(10_000_000);
const MatchLineSchema = z.object({
  listingId: z.string().min(1),
  businessId: z.string().min(1),
  businessName: z.string().optional().default(''),
  qty: z.coerce.number().positive(),
  unitPrice: money,
  readyDays: z.coerce.number().int().min(0).max(365).optional().default(7),
});
const LinesBody = z.object({ requirementId: z.string().min(1), lines: z.array(MatchLineSchema).min(1).max(5) });

// ── Deal chats ────────────────────────────────────────────────────────────
router.post(
  '/deals/open',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(z.object({ sellerBusinessId: z.string().min(1), requirementId: z.string().optional(), listingId: z.string().optional() }), req.body);
    const user = await getUser(req.uid);
    const conversation = await openDeal(user, body);
    res.json({ conversation: convOut(conversation) });
  }),
);

router.post(
  '/deals/combo',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(LinesBody, req.body);
    const user = await getUser(req.uid);
    const conversations = await openCombo(user, body.requirementId, body.lines);
    res.json({ conversations: conversations.map(convOut) });
  }),
);

router.post(
  '/deals/:id/inbound',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(z.object({ text: z.string().max(4000).optional().default(''), lang: z.string().max(8).optional(), messageId: z.string().max(200).optional() }), req.body);
    res.json(await handleInbound(req.params.id, req.uid, body));
  }),
);

/** Hint chips tapped inside a deal chat: counter:<price> · offer:<price> · quote:<price> · accept:<offerId> · decline:<offerId>. */
router.post(
  '/deals/:id/chip',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(z.object({ chipId: z.string().min(3).max(120) }), req.body);
    const user = await getUser(req.uid);
    res.json(await dealChip(user, req.params.id, body.chipId));
  }),
);

router.get(
  '/conversations',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    res.json(await inbox(user));
  }),
);

router.get(
  '/conversations/:id',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    res.json(await conversationDetail(user, req.params.id));
  }),
);

// ── Offers ────────────────────────────────────────────────────────────────
router.post(
  '/offers',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(
      z.object({
        conversationId: z.string().min(1),
        qty: z.coerce.number().positive().max(10_000_000).optional(),
        unitPrice: money,
        dispatchDays: z.coerce.number().min(0).max(365).optional(),
        advancePct: z.coerce.number().min(0).max(100).optional(),
        creditDays: z.coerce.number().min(0).max(180).optional(),
        freight: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/[-\s]+/g, '_') : v), z.enum(['paid', 'to_pay', 'extra'])).optional(),
        listingId: z.string().optional(),
        title: z.string().max(140).optional(),
      }),
      req.body,
    );
    const user = await getUser(req.uid);
    res.json({ offer: await createOffer(user, body) });
  }),
);

router.post(
  '/offers/:id/respond',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(z.object({ action: z.enum(['accept', 'decline', 'counter']), unitPrice: money.optional() }), req.body);
    const user = await getUser(req.uid);
    res.json(await respondOffer(user, req.params.id, body.action, body.unitPrice));
  }),
);

// ── Orders ────────────────────────────────────────────────────────────────
router.post(
  '/orders/:id/event',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(
      z.object({
        type: z.enum(['advance_paid', 'payment_confirmed', 'in_production', 'dispatched', 'delivered', 'balance_paid', 'problem']),
        payload: z.record(z.string(), z.any()).optional().default({}),
      }),
      req.body,
    );
    const user = await getUser(req.uid);
    res.json(await orderEvent(user, req.params.id, body.type, body.payload));
  }),
);

router.get(
  '/orders',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    res.json(await myOrders(user));
  }),
);

router.get(
  '/orders/:id',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    res.json(await orderDetail(user, req.params.id));
  }),
);

// ── Ratings, samples, job work ────────────────────────────────────────────
router.post(
  '/ratings',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(
      z.object({
        orderId: z.string().min(1),
        scores: z.record(z.string(), z.coerce.number().min(1).max(5)),
        wouldRepeat: z.boolean().optional().default(true),
        comment: z.string().max(500).optional(),
      }),
      req.body,
    );
    const user = await getUser(req.uid);
    res.json(await rateOrder(user, body));
  }),
);

router.post(
  '/samples',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(
      z.object({
        conversationId: z.string().min(1),
        listingId: z.string().optional(),
        sizes: z.union([z.array(z.string().max(20)).max(12), z.string().max(200)]).optional().default([]),
        note: z.string().max(300).optional(),
      }),
      req.body,
    );
    const user = await getUser(req.uid);
    res.json(await requestSample(user, body));
  }),
);

router.post(
  '/jobs/offer',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const body = parse(LinesBody, req.body);
    const user = await getUser(req.uid);
    const sent = await sendJobOffers(user, body.requirementId, body.lines);
    res.json({ conversations: sent.map((s) => s.conversation), offers: sent.map((s) => s.offer) });
  }),
);

export default router;
