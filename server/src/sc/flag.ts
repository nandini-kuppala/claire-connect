// Feature flag for the supply-chain module (04 §12): env SC_ENABLED=1 and businesses.flags.sc === true.
import type { NextFunction, Request, Response } from 'express';
import { features } from '../config.js';
import { byId } from '../db/index.js';
import type { AuthedRequest } from '../util.js';

export interface Ctx {
  businessId: string;
  userId: string;
  role: 'owner' | 'staff';
  language: string;
}

export interface ScRequest extends AuthedRequest {
  ctx: Ctx;
}

export const scOn = (business: { flags?: { sc?: boolean } } | null | undefined) => features.supplyChain && business?.flags?.sc === true;

/** After requireAuth: builds the Ctx from the token's user (never from the request body) and enforces the flag. */
export async function requireSc(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await byId<any>('users', (req as AuthedRequest).uid);
    const business = user?.business_id ? await byId<any>('businesses', user.business_id) : null;
    if (!user || !business || !scOn(business)) return res.status(404).json({ error: 'Not found' });
    (req as ScRequest).ctx = { businessId: business.id, userId: user.id, role: user.role === 'staff' ? 'staff' : 'owner', language: user.language || business.language || 'en' };
    next();
  } catch (err) {
    next(err);
  }
}

/** Owner-only actions (prices, bills, settlements, settings, resolving disputes). */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if ((req as ScRequest).ctx?.role !== 'owner') return res.status(403).json({ error: 'Only the owner can do this.', code: 'needs_owner' });
  next();
}
