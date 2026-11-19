// Catalog from photos: photos → AI drafts → one spoken price sentence → publish → storefront link.
import { Router } from 'express';
import { insert, update } from '../db/index.js';
import { catalogFromImages, parseCatalogRules } from '../ai.js';
import { saveUpload } from '../voice.js';
import { chat } from '../chat.js';
import { BOT, cfg } from '../config.js';
import { t } from '../i18n.js';
import { getBiz, getUser, listingRow } from '../biz.js';
import { invalidateTrust } from '../trust.js';
import { h, HttpError, id, now, requireAuth, upload, type AuthedRequest } from '../util.js';
import { catById, CATEGORIES, PALETTE } from '../../../shared/taxonomy.js';
import { CC_CARD, type CardPayload } from '../../../shared/cards.js';

const router = Router();
const MAX_PHOTOS = 12;

export interface Draft {
  tempId: string;
  imageUrls: string[];
  category: string;
  title: string;
  attrs: { fabric?: string | null; colours?: string[]; pattern?: string | null; [k: string]: unknown };
  price: number | null;
  moq: number | null;
  sizes: string[];
  stock?: number | null;
  confidence?: number;
}

const COLOUR_HEX: Record<string, string> = {
  black: '#111827', navy: '#1F2A44', blue: '#1D4ED8', 'sky blue': '#60A5FA', grey: '#6B7280', gray: '#6B7280', charcoal: '#374151', white: '#F5F5F4',
  red: '#B91C1C', maroon: '#7F1D1D', green: '#15803D', 'bottle green': '#14532D', olive: '#3F4A2F', yellow: '#F59E0B', mustard: '#C89B3C', orange: '#EA580C',
  pink: '#F9A8D4', peach: '#FDBA74', purple: '#7C3AED', lavender: '#C4B5FD', beige: '#D6C7A1', brown: '#78350F', teal: '#0D9488', mint: '#A7F3D0',
};

/** SVG art for listings without a usable photo: garment shape from the category, colour from the first colour word. */
export function artFor(category: string, colours: string[] = []) {
  const cat = catById(category) ?? CATEGORIES[0];
  const word = colours.map((c) => c.toLowerCase()).find((c) => Object.keys(COLOUR_HEX).some((k) => c.includes(k)));
  const key = word ? Object.keys(COLOUR_HEX).sort((a, b) => b.length - a.length).find((k) => word.includes(k)) : undefined;
  const color = key ? COLOUR_HEX[key] : PALETTE[Math.abs([...category].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % 10];
  return { shape: cat.shape, color };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : typeof v === 'string' && Number(v) > 0 ? Number(v) : null);

function cleanDrafts(raw: unknown): Draft[] {
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, 'No products to work with.');
  return raw.slice(0, 50).map((d: any) => ({
    tempId: String(d?.tempId || id('t_', 8)),
    imageUrls: Array.isArray(d?.imageUrls) ? d.imageUrls.filter((u: unknown) => typeof u === 'string').slice(0, 8) : [],
    category: catById(d?.category) ? d.category : 'garment.tshirt',
    title: String(d?.title || 'New product').trim().slice(0, 120),
    attrs: d?.attrs && typeof d.attrs === 'object' ? d.attrs : {},
    price: num(d?.price),
    moq: num(d?.moq),
    sizes: Array.isArray(d?.sizes) ? d.sizes.map(String).slice(0, 12) : [],
    stock: num(d?.stock),
    confidence: typeof d?.confidence === 'number' ? d.confidence : undefined,
  }));
}

router.post(
  '/catalog/photos',
  requireAuth,
  upload.any(),
  h(async (req: AuthedRequest, res) => {
    const files = ((req.files as Express.Multer.File[] | undefined) ?? [])
      .filter((f) => f.fieldname.startsWith('image') && f.mimetype.startsWith('image/'))
      .slice(0, MAX_PHOTOS);
    if (!files.length) throw new HttpError(400, 'Please choose at least one photo.');
    const urls = files.map((f) => saveUpload(f.buffer, 'img', f.mimetype.split('/')[1] || 'jpg'));
    const products = await catalogFromImages(files.map((f) => ({ mediaType: f.mimetype, base64: f.buffer.toString('base64') })));

    const used = new Set<number>();
    const drafts: Draft[] = products.map((p) => {
      const idx = p.image_indexes.filter((i) => Number.isInteger(i) && i >= 0 && i < urls.length);
      idx.forEach((i) => used.add(i));
      return {
        tempId: id('t_', 8), imageUrls: idx.map((i) => urls[i]), category: p.category_id, title: p.title,
        attrs: { fabric: p.fabric, colours: p.colours, pattern: p.pattern }, price: null, moq: null, sizes: [], confidence: p.confidence,
      };
    }).filter((d) => d.imageUrls.length);
    // Photos the model skipped still become a draft so nothing the seller sent is lost.
    urls.forEach((u, i) => {
      if (!used.has(i)) drafts.push({ tempId: id('t_', 8), imageUrls: [u], category: drafts[0]?.category ?? 'garment.tshirt', title: drafts[0]?.title ?? 'New product', attrs: {}, price: null, moq: null, sizes: [], confidence: 0.2 });
    });
    res.json({ drafts });
  }),
);

router.post(
  '/catalog/apply',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const drafts = cleanDrafts(req.body?.drafts);
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'Tell me the price and minimum order.');
    const cats = [...new Set(drafts.map((d) => d.category))];
    const rules = await parseCatalogRules(text, cats);
    const general = rules.find((r) => !r.category_id || !cats.includes(r.category_id));
    const out = drafts.map((d) => {
      const r = rules.find((x) => x.category_id === d.category) ?? general;
      if (!r) return d;
      return {
        ...d,
        price: r.price ?? d.price,
        moq: r.moq ?? d.moq,
        sizes: r.sizes?.length ? r.sizes : d.sizes,
        stock: r.stock ?? d.stock ?? null,
      };
    });
    res.json({ drafts: out });
  }),
);

router.post(
  '/catalog/publish',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    if (!user.business_id) throw new HttpError(400, 'Finish setting up your business first.');
    const biz = await getBiz(user.business_id);
    const drafts = cleanDrafts(req.body?.drafts);
    const missing = drafts.filter((d) => !d.price).length;
    if (missing) throw new HttpError(400, missing === 1 ? 'One product has no price yet.' : `${missing} products have no price yet.`);

    const listings = [];
    for (const d of drafts) {
      const cat = catById(d.category)!;
      const colours = Array.isArray(d.attrs.colours) ? d.attrs.colours.map(String) : [];
      const row = await insert('listings', {
        id: id('l_', 10), business_id: biz.id, category: cat.id, type: cat.type, title: d.title,
        attrs: { ...d.attrs, ...(d.sizes.length ? { sizes: d.sizes } : {}) }, images: d.imageUrls, art: artFor(cat.id, colours),
        price: d.price, floor_price: Math.round(d.price! * 0.95 * 100) / 100, unit: cat.unit, moq: d.moq ?? (cat.unit === 'piece' ? 100 : 10),
        size_set: d.sizes.length ? Object.fromEntries(d.sizes.map((s) => [s, 1])) : null, min_order_value: null,
        stock_qty: d.stock ?? 0, capacity_per_day: 0, lead_days: 3, active: 1, is_seed: 0, created_at: now(),
      });
      listings.push(listingRow(row));
    }
    const sells = [...new Set([...biz.sells, ...drafts.map((d) => d.category)])];
    await update('businesses', biz.id, { sells, updated_at: now() });
    invalidateTrust(biz.id);

    const storefrontUrl = `${cfg.webUrl}/s/${biz.slug}`;
    const notice: CardPayload = { kind: 'notice', tone: 'success', text: t(user.language, 'catalog_live', { n: listings.length, url: storefrontUrl }) };
    chat.direct(BOT.claire, [user.id], CC_CARD, notice, { push: 'Claire' }).catch((err) => console.error('[catalog] could not post the catalog notice:', err.message));
    res.json({ listings, storefrontUrl });
  }),
);

export default router;
