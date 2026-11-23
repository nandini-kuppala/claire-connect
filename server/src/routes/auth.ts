// Phone + demo OTP sign-in, the signed-in user's profile, and the Nexconn chat credentials.
import { Router } from 'express';
import { cfg, features } from '../config.js';
import { scOn } from '../sc/flag.js';
import { chat, chatMode } from '../chat.js';
import { byId, findOne, insert, update } from '../db/index.js';
import { getUser, publicBiz, type UserRow } from '../biz.js';
import { trustOf } from '../trust.js';
import { h, HttpError, id, now, requireAuth, signToken, type AuthedRequest } from '../util.js';
import { LANGS } from '../../../shared/taxonomy.js';

const router = Router();

/** Accepts "+91 90000 00001", "09000000001", "9000000001" → "9000000001". */
export function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const local = digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0')) ? digits.slice(-10) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
  return local;
}

/** User as sent to the client: the stored row without internal fields. */
export function publicUser(u: UserRow) {
  const { chat_token: _token, pin_hash: pinHash, ...rest } = u as UserRow & { _id?: string; pin_hash?: string | null };
  delete (rest as { _id?: string })._id;
  return { ...rest, onboarded: u.onboarded ? 1 : 0, has_pin: !!pinHash };
}

/** Returns the user's Nexconn token, issuing (and caching) one if needed. Null in local mode or on failure. */
export async function chatTokenFor(u: UserRow): Promise<string | null> {
  if (chatMode() !== 'nexconn') return null;
  if (u.chat_token) return u.chat_token;
  try {
    const token = await chat.ensureUser(u.id, u.name || `User ${u.phone.slice(-4)}`);
    if (token) {
      await update('users', u.id, { chat_token: token });
      u.chat_token = token;
    }
    return token;
  } catch (err) {
    console.error(`[nexconn] could not issue a chat token for ${u.id}:`, (err as Error).message);
    return null;
  }
}

export async function chatInfo(u: UserRow) {
  return { mode: chatMode(), appKey: cfg.nexconn.appKey, area: cfg.nexconn.area, token: await chatTokenFor(u) };
}

async function businessOf(u: UserRow) {
  if (!u.business_id) return null;
  try {
    return await publicBiz(u.business_id);
  } catch {
    return null;
  }
}

router.post(
  '/auth/otp',
  h(async (req, res) => {
    normalizePhone(req.body?.phone);
    // Demo build: no SMS gateway. The OTP is fixed (DEMO_OTP) and shown on the login screen.
    res.json({ ok: true, demo: true });
  }),
);

router.post(
  '/auth/verify',
  h(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    if (String(req.body?.otp ?? '').trim() !== cfg.demoOtp) throw new HttpError(400, 'That code is not right. Please try again.');

    let user = await findOne<UserRow>('users', { phone });
    const isNew = !user;
    if (!user) {
      const lang = LANGS.some((l) => l.code === req.body?.language) ? String(req.body.language) : 'en';
      user = (await insert('users', {
        id: id('u_', 12), phone, name: null, language: lang, business_id: null, role: 'owner', chat_token: null, onboarded: 0, is_seed: 0, created_at: now(),
      })) as unknown as UserRow;
    }
    const [business, chatCreds] = await Promise.all([businessOf(user), chatInfo(user)]);
    res.json({ token: signToken({ uid: user.id }), user: publicUser(user), business, chat: chatCreds, isNew });
  }),
);

router.get(
  '/me',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    const [business, chatCreds, trust] = await Promise.all([
      businessOf(user),
      chatInfo(user),
      user.business_id ? trustOf(user.business_id).catch(() => null) : Promise.resolve(null),
    ]);
    res.json({ user: publicUser(user), business, trust, chat: chatCreds, features: { ...features, supplyChain: features.supplyChain && !!user.business_id && scOn(await byId<any>('businesses', user.business_id)) } });
  }),
);

router.patch(
  '/me',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const set: Partial<UserRow> = {};
    const { language, name, autoReply } = req.body ?? {};
    if (autoReply !== undefined && !['off', 'suggest', 'auto'].includes(autoReply)) throw new HttpError(400, 'Auto-reply must be off, suggest or auto.');
    if (language !== undefined) {
      if (!LANGS.some((l) => l.code === language)) throw new HttpError(400, 'Unsupported language.');
      set.language = language;
    }
    if (name !== undefined) {
      const clean = String(name).trim().slice(0, 64);
      if (!clean) throw new HttpError(400, 'Name cannot be empty.');
      set.name = clean;
    }
    if (autoReply !== undefined) {
      const owner = await byId<UserRow>('users', req.uid);
      if (!owner?.business_id) throw new HttpError(400, 'Set up your business first.');
      await update('businesses', owner.business_id, { auto_reply: autoReply });
    }
    if (Object.keys(set).length) {
      await update('users', req.uid, { ...set, updated_at: now() });
      const u = await byId<UserRow>('users', req.uid);
      // Keep the business record's language in step so Claire and translation use it. Only the owner's choice:
      // a staff member picking their own app language must not switch the business (chat partners read it as the
      // business's language and stop translating; the owner's notices follow it too).
      if (set.language && u?.business_id && (u.role ?? 'owner') === 'owner') await update('businesses', u.business_id, { language: set.language });
    }
    res.json({ user: publicUser(await getUser(req.uid)) });
  }),
);

export default router;
