// DC / invoice photos as evidence (04 §2.3, T5, T9): GridFS bucket `sc_files`, ≤ 350 KB each (the client compresses to
// about 300 KB), at most 200 per business while the cluster is shared. Served only through short-lived signed URLs
// (HMAC, 10 minutes), never with the login token in the URL.
import crypto from 'node:crypto';
import { Router } from 'express';
import { GridFSBucket, ObjectId } from 'mongodb';
import { cfg } from '../config.js';
import { col, connectDb } from '../db/index.js';
import { h, HttpError, requireAuth, upload } from '../util.js';
import { requireSc, type ScRequest } from './flag.js';
import { newId } from './repo.js';

const MAX_BYTES = 350 * 1024;
const MAX_PER_BUSINESS = 200;
const TTL_MS = 10 * 60_000;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const sign = (id: string, exp: number) => crypto.createHmac('sha256', cfg.jwtSecret).update(`sc-file:${id}:${exp}`).digest('base64url');
export const signedUrl = (id: string) => {
  const exp = Date.now() + TTL_MS;
  return `/api/sc-files/${id}?exp=${exp}&sig=${sign(id, exp)}`;
};

const bucket = async () => new GridFSBucket(await connectDb(), { bucketName: 'sc_files' });

const router = Router();

router.post(
  '/sc/files',
  requireAuth,
  requireSc,
  upload.single('photo'),
  h(async (req: ScRequest & { file?: Express.Multer.File }, res) => {
    const f = req.file;
    if (!f) throw new HttpError(400, 'Please add a photo.');
    if (!TYPES.has(f.mimetype)) throw new HttpError(400, 'Please add a JPG, PNG or WebP photo.');
    if (f.size > MAX_BYTES) throw new HttpError(413, 'This photo is too large. Please try again.');
    const count = await col('sc_documents').countDocuments({ business_id: req.ctx.businessId } as any);
    if (count >= MAX_PER_BUSINESS) throw new HttpError(409, 'Photo storage for your business is full for now.');
    const b = await bucket();
    const stream = b.openUploadStream(`${req.ctx.businessId}-${Date.now()}`, { metadata: { business_id: req.ctx.businessId, user_id: req.ctx.userId, contentType: f.mimetype } });
    await new Promise<void>((resolve, reject) => stream.on('finish', () => resolve()).on('error', reject).end(f.buffer));
    const id = newId('doc');
    await col('sc_documents').insertOne({ _id: id, id, business_id: req.ctx.businessId, kind: 'photo', gridfs_id: stream.id, content_type: f.mimetype, bytes: f.size, shared_with: [req.ctx.businessId], created_at: Date.now() } as any);
    res.status(201).json({ id, url: signedUrl(id) });
  }),
);

/** Signed, short-lived photo URL. No session needed, so it works in <img>; it expires in 10 minutes. */
router.get(
  '/sc-files/:id',
  h(async (req, res) => {
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    const expected = sign(req.params.id, exp);
    if (!exp || exp < Date.now() || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new HttpError(403, 'This link has expired.');
    const doc = await col('sc_documents').findOne({ _id: req.params.id } as any);
    if (!doc) throw new HttpError(404, 'Not found');
    res.setHeader('Content-Type', doc.content_type);
    res.setHeader('Cache-Control', 'private, max-age=600');
    (await bucket()).openDownloadStream(doc.gridfs_id as ObjectId).on('error', () => res.status(404).end()).pipe(res);
  }),
);

export default router;
