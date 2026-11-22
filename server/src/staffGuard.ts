// Staff guard on EVERY API route (04 §10.3b). Existing routes trust users.business_id, so a staff login would otherwise
// see deal rooms, offers, prices, orders and the store. Staff may use only: sign-in and their own profile, Claire,
// voice, the Goods module, and Goods conversations. Anything else, including routes added later, is refused.
import type { NextFunction, Request, Response } from 'express';
import { col } from './db/index.js';
import { verifyToken } from './util.js';

const ALLOW: [RegExp, RegExp][] = [
  [/^(GET|POST)$/, /^\/auth\/(otp|verify)$/],
  [/^(GET|PATCH)$/, /^\/me$/],
  [/^POST$/, /^\/claire\/(turn|welcome|reset)$/],
  [/^POST$/, /^\/voice\/(stt|tts)$/],
  [/^POST$/, /^\/translate$/],
  [/^(GET|POST|PUT|PATCH|DELETE)$/, /^\/sc\//],
  [/^GET$/, /^\/sc-files\//],
  [/^(GET|POST)$/, /^\/l\//],
  [/^GET$/, /^\/(health|demo-accounts)$/],
  [/^GET$/, /^\/conversations$/],
  [/^(GET|POST)$/, /^\/dev\/(stream|send|history)$/], // the local chat transport (dev only)
];
// Routes about one conversation: allowed only when that conversation is a Goods conversation.
const CONV: [RegExp, RegExp][] = [
  [/^GET$/, /^\/conversations\/([\w-]+)$/],
  [/^POST$/, /^\/deals\/([\w-]+)\/inbound$/],
];

const roles = new Map<string, { role: string; at: number }>();
async function roleOf(uid: string): Promise<string> {
  const hit = roles.get(uid);
  if (hit && hit.at > Date.now() - 30_000) return hit.role;
  const u: any = await col('users').findOne({ $or: [{ _id: uid }, { id: uid }] } as any, { projection: { role: 1 } });
  const role = (u?.role as string) ?? 'owner';
  roles.set(uid, { role, at: Date.now() });
  return role;
}

export async function staffGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.get('authorization') ?? '';
    const v = auth.startsWith('Bearer ') ? verifyToken(auth.slice(7)) : null;
    if (!v || (await roleOf(v.uid)) !== 'staff') return next();
    const path = req.path;
    if (ALLOW.some(([m, p]) => m.test(req.method) && p.test(path))) {
      // A staff member may change their own name and language, not the business's auto-reply.
      if (path === '/me' && req.method === 'PATCH' && req.body?.autoReply !== undefined) return refuse(res);
      return next();
    }
    for (const [m, p] of CONV) {
      const hit = m.test(req.method) ? p.exec(path) : null;
      if (!hit) continue;
      const conv: any = await col('conversations').findOne({ $or: [{ _id: hit[1] }, { id: hit[1] }] } as any, { projection: { kind: 1 } });
      return conv?.kind === 'goods' ? next() : refuse(res);
    }
    return refuse(res);
  } catch (err) {
    next(err);
  }
}

function refuse(res: Response) {
  res.status(403).json({ error: 'Your staff login is for Goods and Claire. Ask the owner for anything else.', code: 'staff_forbidden' });
}

/** Tests and role changes: forget a cached role. */
export const forgetRole = (uid: string) => roles.delete(uid);
