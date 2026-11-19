import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { cfg } from './config.js';

export const id = (prefix: string, len = 10) =>
  `${prefix}${crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, len)}`;

export const now = () => Date.now();

/** Minimal signed token (HMAC-SHA256), enough for a hackathon backend. */
export function signToken(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', cfg.jwtSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string | undefined): { uid: string } | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', cfg.jwtSecret).update(body).digest('base64url');
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  uid: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization?.replace(/^Bearer /, '');
  const token = header || (typeof req.query.token === 'string' ? req.query.token : undefined);
  const v = verifyToken(token);
  if (!v?.uid) return res.status(401).json({ error: 'Please sign in again.' });
  (req as AuthedRequest).uid = v.uid;
  next();
}

/** Wrap async route handlers so thrown errors become JSON 500s. */
export const h =
  (fn: (req: any, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('[route error]', req.method, req.path, err);
      if (!res.headersSent) res.status(err.status || 500).json({ error: err.publicMessage || 'Something went wrong. Please try again.' });
      next;
    });

export class HttpError extends Error {
  constructor(public status: number, public publicMessage: string) {
    super(publicMessage);
  }
}

export const rupees = (paise: number) => Math.round(paise / 100);
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'shop';

/** Shared multipart parser: files stay in memory (voice notes, catalog photos). */
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 12 } });

/** Parse a field that may arrive as JSON text (multipart) or as an object (JSON body). */
export function jsonField<T>(v: unknown, fallback: T): T {
  if (v == null || v === '') return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}
