// Buyer requirements: recent searches (Home) and the full results / compare data (Results, Compare screens).
import { Router } from 'express';
import { col, find, findOne, update } from '../db/index.js';
import { getUser, type UserRow } from '../biz.js';
import { match, splitJob, freightFor, transitDays, type Need } from '../match.js';
import { trustOf } from '../trust.js';
import { unitWord } from '../i18n.js';
import { h, HttpError, requireAuth, type AuthedRequest } from '../util.js';
import { catById } from '../../../shared/taxonomy.js';
import type { MatchCard, MatchLine } from '../../../shared/cards.js';

const router = Router();

// ── Shapes ────────────────────────────────────────────────────────────────
export interface RequirementOut {
  id: string;
  title: string;
  categoryId: string;
  qty: number;
  unit: string;
  budget: number | null;
  deadlineDays: number | null;
  city: string | null;
  createdAt: number;
  matchCount: number;
}

export interface SupplierInfo {
  businessId: string;
  name: string;
  city: string | null;
  trust: number;
  isNew: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  orders: number;
  onTimePct: number | null;
  badges: string[];
  gstVerified: boolean;
  isManufacturer: boolean;
  replyMinutes: number | null;
}

export interface ResultLine extends MatchLine {
  listingTitle: string;
  stock: number;
  moq: number;
  unit: string;
  art?: MatchCard['art'];
  supplier: SupplierInfo;
}

export interface ResultCard extends Omit<MatchCard, 'lines'> {
  key: string;
  lines: ResultLine[];
  /** Days from today until it reaches the buyer (ready + transit). */
  deliveryDays: number;
  /** Fits the buyer's deadline (true when there is no deadline). */
  onTime: boolean;
  bestPrice?: boolean;
  fastest?: boolean;
  recommended?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────
const catName = (lang: string, catId: string) => {
  const c = catById(catId);
  if (!c) return catId;
  return (c.names as Record<string, string>)[lang] ?? c.names.en;
};

function titleOf(doc: any, lang: string) {
  const name = catName(lang, doc.category);
  const fabric = typeof doc.attrs?.fabric === 'string' ? doc.attrs.fabric.trim() : '';
  // Only English titles get the fabric prefix ("Cotton T-shirts"); the Tamil/Hindi names stand alone.
  if (lang === 'en' && fabric && !name.toLowerCase().includes(fabric.toLowerCase())) {
    return `${fabric.charAt(0).toUpperCase()}${fabric.slice(1)} ${name}`;
  }
  return name;
}

function needOf(doc: any, user: UserRow): Need {
  return {
    category: doc.category,
    qty: Number(doc.qty) || 0,
    unit: doc.unit ?? 'piece',
    budget: doc.budget ?? null,
    deadlineDays: doc.deadline_days ?? null,
    city: doc.city ?? null,
    attrs: { fabric: doc.attrs?.fabric ?? null, gsm: doc.attrs?.gsm ?? null, colours: doc.attrs?.colours ?? [] },
    liked: doc.liked ?? [],
    excludeBusinessId: user.business_id ?? doc.buyer_business_id ?? undefined,
  };
}

function reqOut(doc: any, lang: string, matchCount: number): RequirementOut {
  return {
    id: doc.id,
    title: titleOf(doc, lang),
    categoryId: doc.category,
    qty: Number(doc.qty) || 0,
    unit: doc.unit ?? 'piece',
    budget: doc.budget ?? null,
    deadlineDays: doc.deadline_days ?? null,
    city: doc.city ?? null,
    createdAt: doc.created_at ?? 0,
    matchCount,
  };
}

const isService = (doc: any) => doc.type === 'service' || String(doc.category ?? '').startsWith('service.');

/** Raw match results as MatchCards (services become one split card or a single). */
async function rawResults(doc: any, user: UserRow) {
  const need = needOf(doc, user);
  if (isService(doc)) {
    const split = await splitJob(need);
    if (!split.lines.length) return { singles: [] as MatchCard[], combos: [] as MatchCard[], mto: [] as MatchCard[], band: undefined, aboveBudget: false, short: split.short };
    const card: MatchCard = {
      kind: split.lines.length === 1 ? 'single' : 'combo',
      lines: split.lines,
      avgPrice: split.avgPrice,
      total: split.total,
      freight: 0,
      readyDays: split.readyDays,
      trust: 0,
      badges: [],
    };
    return {
      singles: card.kind === 'single' ? [card] : [],
      combos: card.kind === 'combo' ? [card] : [],
      mto: [] as MatchCard[],
      band: undefined,
      aboveBudget: false,
      short: split.short,
    };
  }
  const m = await match(need);
  return { ...m, short: 0 };
}

const businessesIn = (cards: MatchCard[]) => new Set(cards.flatMap((c) => c.lines.map((l) => l.businessId)));

async function countMatches(doc: any, user: UserRow) {
  const r = await rawResults(doc, user);
  return businessesIn([...r.singles, ...r.combos, ...r.mto]).size;
}

async function loadReq(id: string, user: UserRow) {
  const doc = await findOne('requirements', { _id: id });
  if (!doc || !user.business_id || doc.buyer_business_id !== user.business_id) throw new HttpError(404, 'This search was not found.');
  return doc;
}

async function suppliers(businessIds: string[]): Promise<Map<string, SupplierInfo>> {
  const ids = [...new Set(businessIds)];
  if (!ids.length) return new Map();
  const [bizRows, orderAgg, trusts] = await Promise.all([
    find('businesses', { _id: { $in: ids } }),
    col('orders').aggregate([{ $match: { seller_business_id: { $in: ids } } }, { $group: { _id: '$seller_business_id', n: { $sum: 1 } } }]).toArray(),
    Promise.all(ids.map(async (b) => [b, await trustOf(b)] as const)),
  ]);
  const biz = new Map(bizRows.map((b: any) => [b.id ?? b._id, b]));
  const orders = new Map(orderAgg.map((o: any) => [o._id, o.n as number]));
  const trust = new Map(trusts);
  const out = new Map<string, SupplierInfo>();
  for (const bid of ids) {
    const b = biz.get(bid) ?? {};
    const t = trust.get(bid)!;
    out.set(bid, {
      businessId: bid,
      name: b.name ?? '',
      city: b.city ?? null,
      trust: t.score,
      isNew: t.isNew,
      ratingAvg: t.ratingAvg,
      ratingCount: t.ratingCount,
      orders: orders.get(bid) ?? 0,
      onTimePct: t.onTimePct,
      badges: t.badges,
      gstVerified: !!b.gst_verified,
      isManufacturer: !!b.is_manufacturer,
      replyMinutes: b.reply_minutes ?? null,
    });
  }
  return out;
}

async function enrich(raw: Awaited<ReturnType<typeof rawResults>>, doc: any) {
  const all = [...raw.singles, ...raw.combos, ...raw.mto];
  const lines = all.flatMap((c) => c.lines);
  const [sup, listingRows] = await Promise.all([
    suppliers(lines.map((l) => l.businessId)),
    find('listings', { _id: { $in: [...new Set(lines.map((l) => l.listingId))] } }),
  ]);
  const listings = new Map(listingRows.map((l: any) => [l.id ?? l._id, l]));
  const transit = transitDays(doc.city ?? null);
  const deadline: number | null = doc.deadline_days ?? null;

  const toCard = (c: MatchCard, key: string): ResultCard => {
    const rl: ResultLine[] = c.lines.map((l) => {
      const li = listings.get(l.listingId) ?? {};
      return {
        ...l,
        listingTitle: li.title ?? '',
        stock: li.stock_qty ?? 0,
        moq: li.moq ?? 0,
        unit: li.unit ?? doc.unit ?? 'piece',
        art: li.art ?? undefined,
        supplier: sup.get(l.businessId)!,
      };
    });
    const trust = c.trust || Math.min(...rl.map((l) => l.supplier.trust));
    const deliveryDays = c.readyDays + (isService(doc) ? 0 : transit);
    return {
      ...c,
      key,
      lines: rl,
      trust,
      art: c.art ?? rl[0]?.art,
      rating: c.rating ?? rl[0]?.supplier.ratingAvg ?? undefined,
      onTimePct: c.onTimePct ?? rl[0]?.supplier.onTimePct ?? undefined,
      badges: c.badges.length ? c.badges : rl[0]?.supplier.badges.slice(0, 3) ?? [],
      deliveryDays,
      onTime: !deadline || deliveryDays <= deadline,
    };
  };

  const singles = raw.singles.map((c, i) => toCard(c, `s${i}`));
  const combos = raw.combos.map((c, i) => toCard(c, `c${i}`));
  const mto = raw.mto.map((c, i) => toCard(c, `m${i}`));

  // Tags across every option the buyer can act on.
  const every = [...singles, ...combos, ...mto];
  if (every.length > 1) {
    const minPrice = Math.min(...every.map((c) => c.avgPrice));
    const minDays = Math.min(...every.map((c) => c.deliveryDays));
    every.forEach((c) => {
      if (c.avgPrice === minPrice) c.bestPrice = true;
      if (c.deliveryDays === minDays) c.fastest = true;
    });
  }
  return { singles, combos, mto };
}

// ── Recommendation (deterministic, no LLM) ────────────────────────────────
type ReasonTable = Record<'cheapest' | 'trust' | 'fastest' | 'among' | 'balance' | 'facts' | 'split' | 'and', string>;
const REASON: Record<'en' | 'ta' | 'hi', ReasonTable> = {
  en: {
    cheapest: 'lowest price',
    trust: 'highest trust',
    fastest: 'fastest delivery',
    among: '{s} among {n} options.',
    balance: 'Best balance of price, trust and speed.',
    facts: '{price}/{unit} · trust {trust} · ready in {days}.',
    split: 'Split across {n} suppliers to cover the full quantity.',
    and: ' and ',
  },
  ta: {
    cheapest: 'குறைந்த விலை',
    trust: 'அதிக நம்பகத்தன்மை',
    fastest: 'விரைவான டெலிவரி',
    among: '{n} விருப்பங்களில் {s}.',
    balance: 'விலை, நம்பகத்தன்மை, வேகம் — மூன்றிலும் நல்ல சமநிலை.',
    facts: '{price}/{unit} · நம்பகம் {trust} · {days} நாளில் தயார்.',
    split: 'முழு அளவுக்கு {n} விற்பனையாளர்களிடம் பிரித்து வாங்கலாம்.',
    and: ', ',
  },
  hi: {
    cheapest: 'सबसे कम दाम',
    trust: 'सबसे ज़्यादा भरोसा',
    fastest: 'सबसे जल्दी डिलीवरी',
    among: '{n} विकल्पों में {s}।',
    balance: 'दाम, भरोसे और रफ़्तार का सबसे अच्छा संतुलन।',
    facts: '{price}/{unit} · भरोसा {trust} · {days} दिन में तैयार।',
    split: 'पूरी मात्रा के लिए {n} सप्लायर में बाँटा गया है।',
    and: ' और ',
  },
};

const fill = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((a, [k, x]) => a.replaceAll(`{${k}}`, String(x)), s);
const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: n < 1000 ? 2 : 0 });

function recommend(cards: ResultCard[], lang: string, unit: string) {
  if (!cards.length) return null;
  const minPrice = Math.min(...cards.map((c) => c.avgPrice));
  const maxTrust = Math.max(...cards.map((c) => c.trust));
  const minDays = Math.min(...cards.map((c) => c.deliveryDays));
  const score = (c: ResultCard) =>
    0.4 * (minPrice / Math.max(1, c.avgPrice)) +
    0.35 * (c.trust / 100) +
    0.25 * ((minDays + 1) / (c.deliveryDays + 1)) -
    (c.onTime ? 0 : 0.2) -
    (c.kind === 'combo' ? 0.04 * (c.lines.length - 1) : 0) -
    (c.kind === 'mto' ? 0.03 : 0);
  const best = [...cards].sort((a, b) => score(b) - score(a))[0];
  const R = (REASON as Record<string, ReasonTable>)[lang] ?? REASON.en;
  const strengths: string[] = [];
  if (cards.length > 1) {
    if (best.avgPrice === minPrice) strengths.push(R.cheapest);
    if (best.trust === maxTrust) strengths.push(R.trust);
    if (best.deliveryDays === minDays) strengths.push(R.fastest);
  }
  let head: string;
  if (strengths.length) {
    const joined = strengths.length > 1 ? strengths.slice(0, -1).join(', ') + R.and + strengths[strengths.length - 1] : strengths[0];
    head = fill(R.among, { s: joined, n: cards.length });
    head = head.charAt(0).toUpperCase() + head.slice(1);
  } else head = R.balance;
  const facts = fill(R.facts, { price: money(best.avgPrice), unit: unitWord(lang, unit, false), trust: best.trust, days: lang === 'en' ? (best.readyDays === 1 ? '1 day' : `${best.readyDays} days`) : best.readyDays });
  const parts = [head, facts];
  if (best.kind === 'combo') parts.push(fill(R.split, { n: best.lines.length }));
  best.recommended = true;
  const first = best.lines[0];
  return { key: best.key, kind: best.kind, listingId: first.listingId, businessId: first.businessId, businessName: first.supplier.name, reason: parts.join(' ') };
}

// ── Routes ────────────────────────────────────────────────────────────────
router.get(
  '/requirements',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    if (!user.business_id) return res.json({ requirements: [] });
    const limit = Math.max(1, Math.min(30, Number(req.query.limit) || 6));
    const docs = await find('requirements', { buyer_business_id: user.business_id }, { sort: { created_at: -1 }, limit });
    const requirements = await Promise.all(
      docs.map(async (d) => {
        let n = typeof d.match_count === 'number' ? d.match_count : null;
        if (n === null) {
          try {
            n = await countMatches(d, user);
            await update('requirements', d.id ?? d._id, { match_count: n });
          } catch {
            n = 0;
          }
        }
        return reqOut(d, user.language, n);
      }),
    );
    res.json({ requirements });
  }),
);

router.get(
  '/requirements/:id',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    const doc = await loadReq(req.params.id, user);
    const raw = await rawResults(doc, user);
    const results = await enrich(raw, doc);
    const all = [...results.singles, ...results.combos, ...results.mto];
    const matchCount = businessesIn(all as unknown as MatchCard[]).size;
    if (doc.match_count !== matchCount) await update('requirements', doc.id ?? doc._id, { match_count: matchCount });
    const recommendation = recommend(all, user.language, doc.unit ?? 'piece');
    const service = isService(doc);
    res.json({
      requirement: { ...reqOut(doc, user.language, matchCount), type: doc.type ?? (service ? 'service' : 'product'), shape: catById(doc.category)?.shape ?? 'tshirt' },
      results: { ...results, band: raw.band ?? null, aboveBudget: !!raw.aboveBudget, short: raw.short || 0 },
      recommendation,
      insights: {
        freight: service ? 0 : freightFor(doc.category, Number(doc.qty) || 0, doc.unit ?? 'piece', doc.city ?? null),
        transitDays: service ? 0 : transitDays(doc.city ?? null),
        budget: doc.budget ?? null,
        lowest: all.length ? Math.min(...all.map((c) => c.avgPrice)) : null,
      },
    });
  }),
);

export default router;
