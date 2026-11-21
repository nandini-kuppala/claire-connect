// Staff (slice 7, 04 §10.3b): the owner adds people by phone; they log in with the same OTP and use Goods and Claire
// only. Optional per-person PIN for shared phones. Counts by staff beyond 5 pcs / 2 kg wait for the owner (D5), and
// staff can suggest how to settle a difference but only the owner settles (03 §4.4).
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { col, insert } from '../db/index.js';
import { h, HttpError, id, now } from '../util.js';
import { verifyToken } from '../util.js';
import { chat } from '../chat.js';
import { cfg } from '../config.js';
import { forgetRole } from '../staffGuard.js';
import { ensureChatUsers } from '../desk.js';
import type { Ctx, ScRequest } from './flag.js';
import { post } from './repo.js';
import { postCount } from '../../../shared/sc/postings.js';
import type { Dimension, RealKey } from '../../../shared/sc/types.js';

const router = Router();
const ten = (p: unknown) => String(p ?? '').replace(/\D/g, '').slice(-10);
const PIN_SECRET = cfg.jwtSecret;
export const pinHash = (uid: string, pin: string) => crypto.createHash('sha256').update(`${PIN_SECRET}|${uid}|${pin}`).digest('hex');

/** D5: staff counts that differ from the book by more than this wait for the owner (per material class, editable). */
export const COUNT_THRESHOLD: Record<Dimension, number> = { count: 5, mass: 2000, length: 200 };

function owner(ctx: Ctx) {
  if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can do this.');
}

/** Staff join every Goods conversation of their business (never deal rooms). */
export async function joinGoodsConversations(businessId: string, userId: string) {
  const convs = await col('conversations').find({ kind: 'goods', business_ids: businessId } as any, { projection: { _id: 1 } }).toArray();
  if (!convs.length) return;
  await ensureChatUsers([userId]).catch(() => undefined);
  for (const c of convs as any[]) {
    await chat.joinGroup(c._id, [userId]).catch(() => undefined);
    await col('conversations').updateOne({ _id: c._id } as any, { $addToSet: { user_ids: userId } } as any);
  }
}

router.get(
  '/sc/staff',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const users = await col('users').find({ business_id: req.ctx.businessId, role: 'staff' } as any, { projection: { id: 1, name: 1, phone: 1, pin_hash: 1, staff_added_at: 1, last_seen_at: 1 } }).toArray();
    res.json({ staff: users.map((u: any) => ({ id: u.id ?? u._id, name: u.name, phone: u.phone, has_pin: !!u.pin_hash, added_at: u.staff_added_at ?? null })) });
  }),
);

/** Provisioning rules (04 §10.3b): a phone already in another business is refused; a phone with no business is
 *  attached as staff; a new phone gets a staff user ready to log in with OTP. */
router.post(
  '/sc/staff',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const b = z.object({ phone: z.string().max(20), name: z.string().trim().min(1).max(64) }).parse(req.body);
    const phone = ten(b.phone);
    if (phone.length !== 10) throw new HttpError(400, 'Please enter a 10-digit mobile number.');
    const existing: any = await col('users').findOne({ phone } as any);
    let userId: string;
    if (existing) {
      // Support agents and supervisors are not business users: never turn one into someone's staff.
      if (existing.role && !['owner', 'staff'].includes(existing.role)) return res.status(409).json({ error: 'This number can’t be added as staff.', code: 'not_allowed' });
      if (existing.business_id && existing.business_id !== req.ctx.businessId) return res.status(409).json({ error: 'This number already belongs to another business.', code: 'other_business' });
      if (existing.business_id === req.ctx.businessId) return res.status(409).json({ error: existing.role === 'staff' ? 'Already on your staff.' : 'This is an owner of your business.', code: 'already' });
      userId = existing.id ?? existing._id;
      await col('users').updateOne({ _id: existing._id } as any, { $set: { business_id: req.ctx.businessId, role: 'staff', onboarded: 1, name: existing.name || b.name, staff_added_at: now(), staff_added_by: req.ctx.userId, updated_at: now() } });
    } else {
      const biz: any = await col('businesses').findOne({ _id: req.ctx.businessId } as any, { projection: { language: 1 } });
      userId = id('u_', 12);
      await insert('users', { id: userId, phone, name: b.name, language: biz?.language ?? 'ta', business_id: req.ctx.businessId, role: 'staff', chat_token: null, onboarded: 1, is_seed: 0, created_at: now(), staff_added_at: now(), staff_added_by: req.ctx.userId });
    }
    forgetRole(userId);
    await joinGoodsConversations(req.ctx.businessId, userId);
    res.status(201).json({ staff: { id: userId, name: b.name, phone } });
  }),
);

router.delete(
  '/sc/staff/:uid',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const u: any = await col('users').findOne({ $or: [{ _id: req.params.uid }, { id: req.params.uid }], business_id: req.ctx.businessId, role: 'staff' } as any);
    if (!u) throw new HttpError(404, 'Not found');
    await col('users').updateOne({ _id: u._id } as any, { $set: { business_id: null, role: 'owner', onboarded: 0, pin_hash: null, staff_removed_at: now() } });
    await col('conversations').updateMany({ kind: 'goods', business_ids: req.ctx.businessId } as any, { $pull: { user_ids: u.id ?? u._id } } as any);
    forgetRole(u.id ?? u._id);
    res.json({ removed: true });
  }),
);

// ── PIN on a shared phone (anyone, for themselves) ──────────────────────────────────────────────
router.post(
  '/sc/me/pin',
  h(async (req: ScRequest, res) => {
    const b = z.object({ pin: z.string().regex(/^\d{4}$/).nullable(), current: z.string().regex(/^\d{4}$/).optional() }).parse(req.body);
    // Changing or removing a PIN needs the current one — or a fresh OTP sign-in (the way back if it's forgotten).
    const u: any = await col('users').findOne({ $or: [{ _id: req.ctx.userId }, { id: req.ctx.userId }] } as any, { projection: { pin_hash: 1 } });
    if (u?.pin_hash) {
      const iat = Number((verifyToken(req.headers.authorization?.replace(/^Bearer /, '')) as any)?.iat ?? 0);
      const fresh = Date.now() - iat < 15 * 60_000;
      if (!fresh && (!b.current || pinHash(req.ctx.userId, b.current) !== u.pin_hash)) return res.status(403).json({ error: 'Enter your current PIN first.', code: 'current_pin' });
    }
    await col('users').updateOne({ $or: [{ _id: req.ctx.userId }, { id: req.ctx.userId }] } as any, { $set: { pin_hash: b.pin ? pinHash(req.ctx.userId, b.pin) : null } });
    res.json({ has_pin: !!b.pin });
  }),
);
const pinTries = new Map<string, number[]>();
router.post(
  '/sc/me/pin/verify',
  h(async (req: ScRequest, res) => {
    const b = z.object({ pin: z.string().regex(/^\d{4}$/) }).parse(req.body);
    const tries = (pinTries.get(req.ctx.userId) ?? []).filter((t) => t > Date.now() - 5 * 60_000);
    if (tries.length >= 5) return res.status(429).json({ error: 'Too many tries. Wait 5 minutes or log in again with OTP.', code: 'locked' });
    const u: any = await col('users').findOne({ $or: [{ _id: req.ctx.userId }, { id: req.ctx.userId }] } as any, { projection: { pin_hash: 1 } });
    const ok = !!u?.pin_hash && u.pin_hash === pinHash(req.ctx.userId, b.pin);
    if (!ok) pinTries.set(req.ctx.userId, [...tries, Date.now()]);
    res.status(ok ? 200 : 401).json(ok ? { ok: true } : { error: 'Wrong PIN.', code: 'wrong_pin' });
  }),
);

// ── Waiting for you (owner): staff counts beyond the threshold and staff suggestions on differences ──
router.get(
  '/sc/approvals',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const counts = await col('sc_adjustments').find({ business_id: req.ctx.businessId, op: 'count', state: 'pending' } as any).sort({ at: -1 }).limit(50).toArray();
    const specs = new Map((await col('sc_specs').find({ _id: { $in: counts.map((c: any) => c.key.spec) } } as any).toArray()).map((s: any) => [s._id, s.label_en]));
    const who = new Map((await col('users').find({ $or: [{ _id: { $in: [...counts.map((c: any) => c.by)] } }, { id: { $in: [...counts.map((c: any) => c.by)] } }] } as any, { projection: { id: 1, name: 1 } }).toArray()).map((u: any) => [u.id ?? u._id, u.name]));
    const disputes = await col('sc_discrepancies').find({ parties: req.ctx.businessId, state: { $in: ['open', 'proposed', 'countered'] }, 'staff_suggestions.0': { $exists: true } } as any).limit(30).toArray();
    res.json({
      counts: counts.map((c: any) => ({ id: c._id, label: specs.get(c.key.spec) ?? '', lot: c.key.lot, dim: c.dim, book: c.book, counted: c.qty, by: who.get(c.by) ?? '—', business_date: c.business_date, at: c.at })),
      suggestions: disputes.map((d: any) => {
        const s = d.staff_suggestions.at(-1);
        return { dispute_id: d._id, label: d.line_label, dim: d.dim, difference: d.difference, outcome: s.outcome, by: s.by_name, at: s.at };
      }),
    });
  }),
);

router.post(
  '/sc/adjust/:id/:verb(approve|reject)',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    owner(ctx);
    const a: any = await col('sc_adjustments').findOne({ _id: req.params.id, business_id: ctx.businessId, op: 'count', state: 'pending' } as any);
    if (!a) throw new HttpError(404, 'Not found');
    if (req.params.verb === 'reject') {
      await col('sc_adjustments').updateOne({ _id: a._id } as any, { $set: { state: 'rejected', decided_by: ctx.userId, decided_at: Date.now() } });
      return res.json({ rejected: true });
    }
    // The count is a physical total as of its date: post against the book as it is now.
    const h0: any = await col('sc_holdings').findOne({ key: a.key } as any);
    const book = h0?.qty_base ?? 0;
    const postings = postCount(a.key as RealKey, a.dim, book, a.qty, 'count');
    // Two taps (or two owners) at once must post once: the client id is unique per business, and the state flip inside
    // the same transaction only succeeds while the count is still pending.
    const r = await post(ctx, { type: 'adjust_count', ref: { kind: 'adjustment', id: a._id }, payload: { op: 'count', approved: true }, business_date: a.business_date, client_id: `approve_${a._id}` }, postings, async (session) => {
      const u = await col('sc_adjustments').updateOne({ _id: a._id, state: 'pending' } as any, { $set: { state: 'approved', decided_by: ctx.userId, decided_at: Date.now(), book_at_approval: book } }, { session });
      if (!u.modifiedCount) throw new HttpError(409, 'Already decided.');
    });
    if ((r as { duplicate?: boolean } | undefined)?.duplicate) throw new HttpError(409, 'Already decided.');
    res.json({ approved: true, difference: a.qty - book });
  }),
);

/** Names for "Kavitha counted …" lines. */
export async function staffName(userId: string) {
  const u: any = await col('users').findOne({ $or: [{ _id: userId }, { id: userId }] } as any, { projection: { name: 1 } });
  return (u?.name as string) ?? 'Staff';
}

export default router;
