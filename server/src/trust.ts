import { find, byId, count, col } from './db/index.js';

export interface Trust {
  score: number;
  components: { verification: number; ratings: number; reliability: number; responsiveness: number; disputes: number };
  badges: string[];
  ratingAvg: number | null;
  ratingCount: number;
  onTimePct: number | null; // sellers: on-time dispatch, buyers: on-time payment
  paysOnTime: string | null; // e.g. "9/10"
  repeatBuyers: number;
  vouchedBy: { name: string; note: string }[];
  isNew: boolean;
}

const cache = new Map<string, { at: number; v: Trust }>();
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null);

export async function trustOf(businessId: string): Promise<Trust> {
  const hit = cache.get(businessId);
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  const b = await byId('businesses', businessId);
  if (!b) return emptyTrust();

  const [ratings, asSeller, asBuyer, upheld, repeatAgg, vouches] = await Promise.all([
    find('ratings', { ratee_business_id: businessId }, { projection: { scores: 1 } }),
    find('orders', { seller_business_id: businessId, dispatched_at: { $ne: null } }, { projection: { dispatched_at: 1, created_at: 1, buyer_business_id: 1 } }),
    find('orders', { buyer_business_id: businessId, paid_at: { $ne: null } }, { projection: { paid_at: 1, balance_due_at: 1 } }),
    count('tickets', { 'resolution.against_business_id': businessId, status: 'resolved', 'resolution.upheld': true }),
    col('orders').aggregate([{ $match: { seller_business_id: businessId } }, { $group: { _id: '$buyer_business_id', n: { $sum: 1 } } }, { $match: { n: { $gte: 2 } } }, { $count: 'n' }]).toArray(),
    col('vouches').aggregate([{ $match: { vouched_business_id: businessId } }, { $limit: 3 }, { $lookup: { from: 'businesses', localField: 'voucher_business_id', foreignField: '_id', as: 'v' } }]).toArray(),
  ]);

  const verification = 5 + (b.gst_verified ? 7 : 0) + (b.udyam ? 3 : 0) + (b.unit_visited ? 5 : 0);
  const perRating = ratings.map((r) => avg(Object.values((r.scores || {}) as Record<string, number>)) ?? 0);
  const sum = perRating.reduce((a, c) => a + c, 0);
  const bayes = (sum + 3.5 * 5) / (perRating.length + 5);
  const ratingPts = Math.round(((bayes - 1) / 4) * 40);

  const sellerOnTime = asSeller.length ? asSeller.filter((o) => o.dispatched_at - o.created_at <= 9 * 86400000).length / asSeller.length : null;
  const paidOk = asBuyer.filter((o) => o.paid_at <= (o.balance_due_at ?? o.paid_at) + 86400000).length;
  const buyerOnTime = asBuyer.length ? paidOk / asBuyer.length : null;
  const relParts = [sellerOnTime, buyerOnTime].filter((x): x is number => x !== null);
  const reliability = Math.round((relParts.length ? relParts.reduce((a, c) => a + c, 0) / relParts.length : 0.6) * 25);
  const responsiveness = Math.max(0, Math.round(10 * (1 - Math.min(1, (b.reply_minutes ?? 60) / 120))));
  const disputes = Math.max(0, 5 - 2 * upheld);
  const score = Math.min(100, verification + ratingPts + reliability + responsiveness + disputes);
  const repeat = (repeatAgg[0] as any)?.n ?? 0;

  const quality = avg(ratings.map((r) => r.scores?.quality).filter((x: unknown): x is number => typeof x === 'number'));
  const badges: string[] = [];
  if (b.gst_verified) badges.push('GST verified');
  if (b.is_manufacturer) badges.push('Manufacturer');
  if (b.unit_visited) badges.push('Unit visited');
  if ((b.reply_minutes ?? 99) <= 10) badges.push('Replies in < 10 min');
  if (buyerOnTime !== null && buyerOnTime >= 0.85 && asBuyer.length >= 3) badges.push('Pays on time');
  if (quality !== null && quality >= 4.6 && ratings.length >= 3) badges.push('Top quality');
  if (repeat >= 3) badges.push(`${repeat} repeat buyers`);

  const v: Trust = {
    score,
    components: { verification, ratings: ratingPts, reliability, responsiveness, disputes },
    badges,
    ratingAvg: perRating.length ? Math.round((sum / perRating.length) * 10) / 10 : null,
    ratingCount: perRating.length,
    onTimePct: sellerOnTime !== null ? Math.round(sellerOnTime * 100) : buyerOnTime !== null ? Math.round(buyerOnTime * 100) : null,
    paysOnTime: asBuyer.length ? `${paidOk}/${asBuyer.length}` : null,
    repeatBuyers: repeat,
    vouchedBy: vouches.map((x: any) => ({ name: x.v?.[0]?.name ?? '', note: x.note ?? '' })).filter((x) => x.name),
    isNew: perRating.length === 0,
  };
  cache.set(businessId, { at: Date.now(), v });
  return v;
}

export const invalidateTrust = (businessId?: string) => (businessId ? cache.delete(businessId) : cache.clear());

function emptyTrust(): Trust {
  return {
    score: 45,
    components: { verification: 5, ratings: 20, reliability: 15, responsiveness: 5, disputes: 5 },
    badges: [], ratingAvg: null, ratingCount: 0, onTimePct: null, paysOnTime: null, repeatBuyers: 0, vouchedBy: [], isNew: true,
  };
}
