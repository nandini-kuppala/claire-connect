// Health, public traction stats and the demo-account list for the login screen.
import { Router } from 'express';
import { col, count, counter, find } from '../db/index.js';
import { features } from '../config.js';
import { chatMode } from '../chat.js';
import { usageToday } from '../llm.js';
import { h } from '../util.js';

const router = Router();
const startedAt = Date.now();

router.get('/health', (_req, res) => {
  res.json({ ok: true, chat: chatMode(), features, uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
});

const DEMO_PHONES = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000901', '9000000902', '9000000903'];
const DEMO_LABEL: Record<string, string> = {
  '9000000001': 'Buyer',
  '9000000002': 'Stitching unit',
  '9000000003': 'Manufacturer',
  '9000000004': 'Brand owner',
  '9000000901': 'Trade Desk agent',
  '9000000902': 'Trade Desk agent',
  '9000000903': 'Trade Desk agent',
};

router.get(
  '/demo-accounts',
  h(async (_req, res) => {
    const users = await find('users', { phone: { $in: DEMO_PHONES }, is_seed: 1 });
    const bizIds = users.map((u) => u.business_id).filter(Boolean);
    const businesses = await find('businesses', { _id: { $in: bizIds } });
    const byId = new Map(businesses.map((b) => [b.id, b]));
    const accounts = DEMO_PHONES.map((phone) => users.find((u) => u.phone === phone))
      .filter(Boolean)
      .map((u) => {
        const b = u.business_id ? byId.get(u.business_id) : null;
        return {
          phone: u.phone, name: u.name, language: u.language, role: u.role, label: DEMO_LABEL[u.phone] ?? u.role,
          business: b ? { id: b.id, name: b.name, city: b.city, roleLabel: b.role_label, accent: b.accent } : null,
        };
      });
    res.json({ accounts, otp: 'demo' });
  }),
);

async function groupCount(collection: string, match: object, field: string) {
  const rows = await col(collection).aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
  return Object.fromEntries(rows.map((r) => [r._id ?? 'unknown', r.n]));
}

router.get(
  '/stats',
  h(async (_req, res) => {
    const real = { is_seed: { $ne: 1 } };
    const seedBiz = await find('businesses', { is_seed: 1 }, { projection: { _id: 1 } });
    const seedBizIds = seedBiz.map((b) => b._id);
    const realOrders = { _id: { $not: /^o_seed/ } };
    const [businesses, byRole, byLanguage, users, listings, orders, gmv, conversations, tickets, ratings, messages, seedListings, seedOrders, ai] = await Promise.all([
      count('businesses', real),
      groupCount('businesses', real, 'role_label'),
      groupCount('businesses', real, 'language'),
      count('users', { ...real, role: 'owner' }),
      count('listings', { business_id: { $nin: seedBizIds } }),
      count('orders', realOrders),
      col('orders').aggregate([{ $match: realOrders }, { $group: { _id: null, total: { $sum: '$total' } } }]).toArray(),
      count('conversations'),
      count('tickets'),
      count('ratings', { _id: { $not: /^r_[sb]\d/ } }),
      counter('messages'),
      count('listings', { business_id: { $in: seedBizIds } }),
      count('orders', { _id: /^o_seed/ }),
      usageToday(),
    ]);
    res.json({
      traction: { businesses, byRole, byLanguage, users, listings, orders, gmv: gmv[0]?.total ?? 0, conversations, tickets, ratings, messages },
      seed: { businesses: seedBiz.length, listings: seedListings, orders: seedOrders },
      ai: { llm: ai, nexconn: features.nexconn, sarvam: features.sarvam },
      updatedAt: Date.now(),
    });
  }),
);

export default router;
