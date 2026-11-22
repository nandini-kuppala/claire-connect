// Matching + combo builder (see docs/02-product-spec.md §8).
import { col, find } from './db/index.js';
import { trustOf } from './trust.js';
import type { MatchCard, MatchLine } from '../../shared/cards.js';

export interface Need {
  category: string;
  qty: number;
  unit: string;
  budget: number | null;
  deadlineDays: number | null;
  city: string | null;
  attrs?: { fabric?: string | null; gsm?: number | null; colours?: string[]; garment?: string | null };
  liked?: string[];
  excludeBusinessId?: string;
}

interface Cand {
  listingId: string;
  businessId: string;
  businessName: string;
  price: number;
  moq: number;
  available: number;
  readyDays: number;
  trust: number;
  ratingAvg: number | null;
  onTimePct: number | null;
  reply: number;
  attrs: any;
  art: any;
  stock: number;
  badges: string[];
  score: number;
}

const FREIGHT_PER_KG: Record<string, number> = { local: 4, south: 9, west: 13, north: 15, east: 15 };
const ZONE: Record<string, string> = {
  tiruppur: 'local', coimbatore: 'local', chennai: 'south', bengaluru: 'south', bangalore: 'south', hyderabad: 'south', kochi: 'south',
  mumbai: 'west', pune: 'west', surat: 'west', ahmedabad: 'west', delhi: 'north', jaipur: 'north', lucknow: 'north', patna: 'east', kolkata: 'east', guwahati: 'east',
};
const WEIGHT_KG: Record<string, number> = {
  'garment.trackpants': 0.33, 'garment.tshirt': 0.19, 'garment.polo': 0.24, 'garment.shorts': 0.22, 'garment.hoodie': 0.5, 'garment.kids': 0.18,
  'garment.nightwear': 0.3, 'garment.leggings': 0.2, 'garment.innerwear': 0.9, 'garment.vest': 1.1,
};

export function freightFor(category: string, qty: number, unit: string, city: string | null) {
  const zone = ZONE[(city || '').toLowerCase()] || 'north';
  const kg = unit === 'kg' ? qty : (WEIGHT_KG[category] ?? 0.25) * qty;
  return Math.round(kg * FREIGHT_PER_KG[zone]);
}

export function transitDays(city: string | null) {
  const zone = ZONE[(city || '').toLowerCase()] || 'north';
  return { local: 1, south: 2, west: 4, north: 5, east: 6 }[zone] as number;
}

function attrScore(need: Need, attrs: any): number {
  let s = 1;
  if (need.attrs?.fabric && attrs.fabric) s *= String(attrs.fabric).toLowerCase().includes(need.attrs.fabric.toLowerCase().split(' ')[0]) ? 1 : 0.7;
  if (need.attrs?.gsm && attrs.gsm) s *= Math.abs(need.attrs.gsm - attrs.gsm) <= 20 ? 1 : 0.75;
  if (need.attrs?.colours?.length && attrs.colours?.length) {
    const have = (attrs.colours as string[]).join(' ').toLowerCase();
    s *= need.attrs.colours.some((c) => have.includes(c.toLowerCase())) || have.includes('any') || have.includes('assorted') ? 1 : 0.8;
  }
  return s;
}

async function listingRows(category: string, excludeBusinessId?: string) {
  return col('listings').aggregate([
    { $match: { active: 1, category, ...(excludeBusinessId ? { business_id: { $ne: excludeBusinessId } } : {}) } },
    { $lookup: { from: 'businesses', localField: 'business_id', foreignField: '_id', as: 'b' } },
    { $addFields: { business_name: { $first: '$b.name' }, reply_minutes: { $first: '$b.reply_minutes' } } },
    { $project: { b: 0 } },
  ]).toArray() as Promise<any[]>;
}

// ── Declared work (S18) and real Goods history: rank job-work units that do this process higher ──
/** Marketplace job-work category → the S18 work key and the Goods process keys that count as doing it. */
const SERVICE_WORK: Record<string, { work: string; processes: string[] }> = {
  'service.stitching': { work: 'stitching', processes: ['stitching'] },
  'service.printing': { work: 'printing', processes: ['printing_panels', 'printing_fabric'] },
  'service.dyeing': { work: 'dyeing', processes: ['dyeing'] },
  'service.embroidery': { work: 'embroidery', processes: ['embroidery'] },
  'service.cutting': { work: 'cutting', processes: ['cutting'] },
  'service.knitting': { work: 'knitting', processes: ['knitting'] },
  'service.checking': { work: 'checking_packing', processes: ['checking', 'packing'] },
};
/** Finished jobs at which the history signal is full. */
const HISTORY_FULL = 5;

/**
 * 0..1 per business: 0.4 when it declared this process in `businesses.sc_work.processes`, plus up to 0.6 for jobs of this
 * process it actually finished for other businesses on Goods. Only ever used to order results; it never changes a price
 * and never removes anyone.
 */
export async function workFit(category: string, businessIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const spec = SERVICE_WORK[category];
  const ids = [...new Set(businessIds)];
  if (!spec || !ids.length) return out;
  const [declared, done] = await Promise.all([
    col('businesses').find({ _id: { $in: ids }, 'sc_work.processes': spec.work } as any, { projection: { _id: 1 } }).toArray(),
    col('sc_jobs').aggregate([
      { $match: { 'performer_party.k': 'b', 'performer_party.id': { $in: ids }, process_key: { $in: spec.processes }, status: { $in: ['completed', 'closed'] }, in_house: { $ne: true } } },
      { $match: { $expr: { $ne: ['$client_party.id', '$performer_party.id'] } } },
      { $group: { _id: '$performer_party.id', n: { $sum: 1 } } },
    ]).toArray(),
  ]);
  for (const b of declared) out.set(b._id as unknown as string, 0.4);
  for (const d of done) out.set(d._id as string, (out.get(d._id as string) ?? 0) + 0.6 * Math.min(1, Number(d.n) / HISTORY_FULL));
  return out;
}

async function candidates(need: Need): Promise<Cand[]> {
  const rows = await listingRows(need.category, need.excludeBusinessId);
  const fit = await workFit(need.category, rows.map((r) => r.business_id)).catch(() => new Map<string, number>());
  const workDays = need.deadlineDays ? Math.max(1, Math.floor((need.deadlineDays - transitDays(need.city)) * 6 / 7)) : 21;
  const trusts = new Map(await Promise.all([...new Set(rows.map((r) => r.business_id))].map(async (b) => [b, await trustOf(b)] as const)));
  return rows.map((r) => {
    const attrs = r.attrs || {};
    const t = trusts.get(r.business_id)!;
    const producible = r.capacity_per_day * Math.max(0, workDays - (r.lead_days ?? 1));
    const available = r.stock_qty + producible;
    const fromStock = r.stock_qty >= need.qty;
    const readyDays = fromStock ? r.lead_days : r.capacity_per_day > 0 ? r.lead_days + Math.ceil(Math.max(0, need.qty - r.stock_qty) / r.capacity_per_day) : 99;
    const budget = need.budget ?? r.price * 1.2;
    const priceFit = Math.max(0, Math.min(1, (budget - r.price) / budget + 0.5));
    const coverage = Math.min(1, available / need.qty);
    const leadFit = !need.deadlineDays || readyDays + transitDays(need.city) <= need.deadlineDays ? 1 : 0.3;
    const resp = 1 - Math.min(1, (r.reply_minutes ?? 60) / 120);
    const liked = need.liked?.includes(r.id) ? 0.08 : 0;
    const work = 0.06 * (fit.get(r.business_id) ?? 0); // declared work + Goods history (job-work categories only)
    const score = (0.3 * priceFit + 0.25 * (t.score / 100) + 0.15 * coverage + 0.1 * leadFit + 0.1 * resp + 0.05) * attrScore(need, attrs) + liked + work;
    return {
      listingId: r.id, businessId: r.business_id, businessName: r.business_name, price: r.price, moq: r.moq, available, readyDays,
      trust: t.score, ratingAvg: t.ratingAvg, onTimePct: t.onTimePct, reply: r.reply_minutes, attrs, art: r.art, stock: r.stock_qty,
      badges: t.badges, score,
    };
  });
}

const tier = (t: number) => (t >= 80 ? 2 : t >= 60 ? 1 : 0);

function card(kind: MatchCard['kind'], lines: (MatchLine & { cand: Cand })[], need: Need): MatchCard {
  const total = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const qty = lines.reduce((a, l) => a + l.qty, 0);
  const first = lines[0].cand;
  const avgPrice = Math.round((total / qty) * 10) / 10;
  return {
    ...(need.budget && avgPrice > need.budget ? { overBudget: true } : {}),
    kind,
    lines: lines.map(({ cand: _c, ...l }) => l),
    avgPrice,
    total: Math.round(total),
    freight: freightFor(need.category, qty, need.unit, need.city),
    readyDays: Math.max(...lines.map((l) => l.readyDays)),
    trust: Math.min(...lines.map((l) => l.cand.trust)),
    badges: first.badges.slice(0, 3),
    art: first.art,
    rating: first.ratingAvg ?? undefined,
    onTimePct: first.onTimePct ?? undefined,
    stock: first.stock,
  };
}

export async function match(need: Need) {
  const all = (await candidates(need)).filter((c) => c.available > 0);
  const budgetCap = need.budget ? need.budget * 1.05 : Infinity;
  const inBudget = all.filter((c) => c.price <= budgetCap);
  const prices = all.map((c) => c.price).sort((a, b) => a - b);
  const pct = (p: number) => prices[Math.min(prices.length - 1, Math.floor(p * (prices.length - 1)))] ?? 0;
  const band = prices.length ? { p25: pct(0.25), median: pct(0.5), p75: pct(0.75) } : undefined;

  const line = (c: Cand, qty: number) => ({ listingId: c.listingId, businessId: c.businessId, businessName: c.businessName, qty, unitPrice: c.price, readyDays: c.readyDays, cand: c });

  // Ready from one seller (stock now) vs made to order (needs production)
  // Within budget first; the few just above it (≤ 5 %) come after and carry an "above budget" flag.
  const over = (c: Cand) => (need.budget && c.price > need.budget ? 1 : 0);
  const singles = inBudget
    .filter((c) => c.stock >= need.qty && c.moq <= need.qty)
    .sort((a, b) => over(a) - over(b) || b.score - a.score)
    .slice(0, 4)
    .map((c) => card('single', [line(c, need.qty)], need));

  const mto = inBudget
    .filter((c) => c.stock < need.qty && c.available >= need.qty && c.moq <= need.qty)
    .sort((a, b) => a.price - b.price)
    .slice(0, 2)
    .map((c) => card('mto', [line(c, need.qty)], need));

  // Combos of 2–3 sellers with compatible specs and similar trust
  const pool = inBudget.filter((c) => c.stock > 0).sort((a, b) => b.score - a.score).slice(0, 10);
  const combos: { c: MatchCard; s: number }[] = [];
  const tryCombo = (set: Cand[]) => {
    if (Math.max(...set.map((c) => tier(c.trust))) - Math.min(...set.map((c) => tier(c.trust))) > 1) return;
    for (let a = 0; a < set.length; a++) for (let b = a + 1; b < set.length; b++) {
      if (attrScore({ ...need, attrs: { fabric: set[a].attrs.fabric, gsm: set[a].attrs.gsm } }, set[b].attrs) < 0.75) return;
    }
    const sorted = [...set].sort((x, y) => x.price - y.price);
    let left = need.qty;
    const lines: ReturnType<typeof line>[] = [];
    for (const c of sorted) {
      if (left <= 0) break;
      const take = Math.min(c.stock, left);
      if (take < c.moq) return;
      lines.push(line(c, take));
      left -= take;
    }
    if (left > 0 || lines.length !== set.length) return;
    const mc = card('combo', lines, need);
    const s = 0.45 * Math.max(0, Math.min(1, ((need.budget ?? mc.avgPrice * 1.2) - mc.avgPrice) / (need.budget ?? mc.avgPrice) + 0.5)) + 0.3 * (mc.trust / 100) + 0.15 - (set.length - 2) * 0.05;
    combos.push({ c: mc, s });
  };
  for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) {
    tryCombo([pool[a], pool[b]]);
    for (let c = b + 1; c < pool.length; c++) tryCombo([pool[a], pool[b], pool[c]]);
  }
  const bestSingle = singles[0]?.avgPrice ?? Infinity;
  const comboList = combos
    .sort((x, y) => Number(!!x.c.overBudget) - Number(!!y.c.overBudget) || y.s - x.s)
    .map((x) => x.c)
    .filter((c) => singles.length < 2 || c.avgPrice < bestSingle * 0.97)
    .filter((c, i, arr) => arr.findIndex((o) => o.lines.map((l) => l.businessId).sort().join() === c.lines.map((l) => l.businessId).sort().join()) === i)
    .slice(0, 2);

  // Nothing in budget? show the closest options above budget.
  const above = !singles.length && !comboList.length && !mto.length
    ? all.filter((c) => c.available >= need.qty).sort((a, b) => a.price - b.price).slice(0, 2).map((c) => card(c.stock >= need.qty ? 'single' : 'mto', [line(c, need.qty)], need))
    : [];

  return { singles: singles.length ? singles : above.filter((c) => c.kind === 'single'), combos: comboList, mto: mto.length ? mto : above.filter((c) => c.kind === 'mto'), band, aboveBudget: above.length > 0 };
}

const garmentKey = (g: string) => g.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '');
/** A unit fits when it lists the garment, or when either side does not say. */
function garmentFits(want: string | null | undefined, garments: unknown): boolean {
  if (!want || !Array.isArray(garments) || !garments.length) return true;
  const w = garmentKey(want);
  return garments.some((g) => garmentKey(String(g)) === w);
}

/** Job-work split: allocate a service quantity across units by free capacity within the deadline. */
export async function splitJob(need: Need) {
  const days = need.deadlineDays ?? 10;
  const rows = await listingRows(need.category, need.excludeBusinessId);
  const fit = await workFit(need.category, rows.map((r) => r.business_id)).catch(() => new Map<string, number>());
  const scored = await Promise.all(rows.map(async (r) => ({ r, cap: r.capacity_per_day * Math.max(1, days - 1), trust: (await trustOf(r.business_id)).score, fit: fit.get(r.business_id) ?? 0 })));
  // Units that declared this process (S18) and have finished such jobs on Goods come first among equals: up to 18 points
  // on the 0–100 trust + price scale. Order only; prices are untouched.
  const rank = (u: (typeof scored)[number]) => u.trust * 0.6 + (1 - u.r.price / 40) * 40 + 18 * u.fit;
  // Hard rules: never above the buyer's rate, and only units that do this garment (when both are known).
  const units = scored
    .filter((u) => !need.budget || u.r.price <= need.budget)
    .filter((u) => garmentFits(need.attrs?.garment, u.r.attrs?.garments) && attrScore(need, u.r.attrs || {}) >= 0.75)
    .sort((a, b) => rank(b) - rank(a));
  let left = need.qty;
  const lines: MatchLine[] = [];
  for (const u of units) {
    if (left <= 0) break;
    const take = Math.min(left, Math.floor(u.cap / 100) * 100);
    if (take < Math.min(u.r.moq, left)) continue;
    lines.push({ listingId: u.r.id, businessId: u.r.business_id, businessName: u.r.business_name, qty: take, unitPrice: u.r.price, readyDays: Math.ceil(take / u.r.capacity_per_day) + 1 });
    left -= take;
  }
  const total = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const qty = lines.reduce((a, l) => a + l.qty, 0);
  return { lines, total: Math.round(total), avgPrice: qty ? Math.round((total / qty) * 10) / 10 : 0, readyDays: lines.length ? Math.max(...lines.map((l) => l.readyDays)) : 0, covered: qty, short: Math.max(0, left) };
}

export async function marketBand(category: string) {
  const prices = (await find<{ price: number }>('listings', { active: 1, category }, { projection: { price: 1 }, sort: { price: 1 } }))
    .map((r) => Number(r.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (!prices.length) return null;
  const pct = (p: number) => prices[Math.min(prices.length - 1, Math.floor(p * (prices.length - 1)))];
  // min/max are the 10th–90th percentiles so one odd listing cannot stretch the "most sellers" range.
  return { p25: pct(0.25), median: pct(0.5), p75: pct(0.75), min: pct(0.1), max: pct(0.9) };
}
