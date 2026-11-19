// Listings, business profiles and the public storefront (/s/:slug).
import { Router } from 'express';
import { byId, col, find, findOne, update } from '../db/index.js';
import { getUser, listingRow, publicBiz } from '../biz.js';
import { invalidateTrust } from '../trust.js';
import { h, HttpError, now, requireAuth, type AuthedRequest } from '../util.js';
import { catById } from '../../../shared/taxonomy.js';

const router = Router();

async function storefront(businessId: string) {
  const [business, rows, ratings] = await Promise.all([
    publicBiz(businessId),
    find('listings', { business_id: businessId, active: 1 }, { sort: { created_at: -1 }, limit: 100 }),
    col('ratings')
      .aggregate([
        { $match: { ratee_business_id: businessId } },
        { $sort: { created_at: -1 } },
        { $limit: 20 },
        { $lookup: { from: 'businesses', localField: 'rater_business_id', foreignField: '_id', as: 'rb' } },
        { $addFields: { rater: { $first: '$rb' } } },
      ])
      .toArray(),
  ]);
  return {
    business,
    listings: rows.map((r) => ({ ...listingRow(r), businessName: business.name })),
    reviews: ratings.map((r) => ({
      rater: r.rater ? { id: r.rater.id, name: r.rater.name, city: r.rater.city, isDemo: !!r.rater.is_seed } : null,
      direction: r.direction,
      scores: r.scores ?? {},
      wouldRepeat: !!r.would_repeat,
      comment: r.comment ?? null,
      at: r.created_at,
    })),
  };
}

router.get(
  '/listings',
  requireAuth,
  h(async (req, res) => {
    const filter: Record<string, unknown> = { active: 1 };
    if (typeof req.query.category === 'string' && req.query.category) filter.category = req.query.category;
    if (typeof req.query.business === 'string' && req.query.business) {
      filter.business_id = req.query.business;
      if (req.query.all === '1') delete filter.active; // owner view includes paused listings
    }
    const rows = await col('listings')
      .aggregate([
        { $match: filter },
        { $sort: { created_at: -1 } },
        { $limit: 200 },
        { $lookup: { from: 'businesses', localField: 'business_id', foreignField: '_id', as: 'b' } },
        { $addFields: { business_name: { $first: '$b.name' }, business_city: { $first: '$b.city' }, business_seed: { $first: '$b.is_seed' } } },
        { $project: { b: 0 } },
      ])
      .toArray();
    res.json({ listings: rows.map((r) => ({ ...listingRow(r), businessName: r.business_name ?? '', city: r.business_city ?? null, isDemo: !!r.business_seed })) });
  }),
);

const EDITABLE: Record<string, (v: unknown) => unknown> = {
  title: (v) => String(v).trim().slice(0, 120) || undefined,
  price: (v) => (Number(v) > 0 ? Number(v) : undefined),
  floor_price: (v) => (Number(v) > 0 ? Number(v) : undefined),
  moq: (v) => (Number(v) > 0 ? Math.round(Number(v)) : undefined),
  stock_qty: (v) => (Number(v) >= 0 ? Math.round(Number(v)) : undefined),
  capacity_per_day: (v) => (Number(v) >= 0 ? Math.round(Number(v)) : undefined),
  lead_days: (v) => (Number(v) >= 0 ? Math.round(Number(v)) : undefined),
  active: (v) => (v ? 1 : 0),
  images: (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 8) : undefined),
  category: (v) => (catById(String(v)) ? String(v) : undefined),
};
// Accept camelCase keys from the client too.
const ALIAS: Record<string, string> = { floorPrice: 'floor_price', stock: 'stock_qty', capacityPerDay: 'capacity_per_day', leadDays: 'lead_days' };

router.patch(
  '/listings/:id',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    const listing = await byId('listings', req.params.id);
    if (!listing) throw new HttpError(404, 'Listing not found');
    if (!user.business_id || listing.business_id !== user.business_id) throw new HttpError(403, 'You can only edit your own listings.');
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.body ?? {})) {
      const key = ALIAS[k] ?? k;
      const parsed = EDITABLE[key]?.(v);
      if (parsed !== undefined) set[key] = parsed;
    }
    if (req.body?.sizes && Array.isArray(req.body.sizes)) {
      const sizes = req.body.sizes.map(String).slice(0, 12);
      set.size_set = sizes.length ? Object.fromEntries(sizes.map((s: string) => [s, 1])) : null;
      set.attrs = { ...(listing.attrs ?? {}), sizes };
    }
    if (!Object.keys(set).length) throw new HttpError(400, 'Nothing to change.');
    await update('listings', listing.id, { ...set, updated_at: now() });
    invalidateTrust(listing.business_id);
    res.json({ listing: listingRow(await byId('listings', listing.id)) });
  }),
);

router.get(
  '/businesses/:id',
  requireAuth,
  h(async (req, res) => {
    res.json(await storefront(req.params.id));
  }),
);

router.get(
  '/public/s/:slug',
  h(async (req, res) => {
    const b = await findOne('businesses', { slug: String(req.params.slug).toLowerCase() });
    if (!b) throw new HttpError(404, 'This shop does not exist.');
    const data = await storefront(b.id);
    // Phone-linked user ids are not needed by anonymous visitors.
    res.json({ ...data, business: { ...data.business, userIds: [] } });
  }),
);

export default router;
