// AI layer: OpenRouter (free tier, Nemotron) for understanding speech/text, cataloguing photos,
// drafting replies and summarising tickets. Every function has a rule-based fallback.
import { z } from 'zod';
import { llmObject, llmEnabled } from './llm.js';
import { CATEGORIES, catById } from '../../shared/taxonomy.js';

const TAXONOMY = CATEGORIES.map((c) => `${c.id} — ${c.names.en} (${c.unit}; also: ${c.keywords.slice(0, 6).join(', ')})`).join('\n');

const GLOSSARY = 'GSM, combed, carded, compacting, interlock, rib, fleece, loopknit, lycra, kora, job work, MOQ, LR, to-pay, set, dozen';

async function structured<T extends z.ZodType>(opts: {
  schema: T;
  name: string;
  system: string;
  content: string | any[];
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  vision?: boolean;
  cache?: boolean;
}): Promise<z.infer<T> | null> {
  return llmObject({ schema: opts.schema, name: opts.name, system: opts.system, user: opts.content, effort: opts.effort, maxTokens: opts.maxTokens, vision: opts.vision, cache: opts.cache });
}

// ── Intent + slot extraction ───────────────────────────────────────────────
export const INTENTS = ['BUY_PRODUCT', 'FIND_SERVICE', 'ADD_LISTING', 'UPDATE_STOCK', 'ORDER_STATUS', 'REORDER', 'TALK_TO_HUMAN', 'GREETING', 'UNKNOWN'] as const;

const NluSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number(),
  category_id: z.string().nullable(),
  fabric: z.string().nullable(),
  gsm: z.number().nullable(),
  colours: z.array(z.string()),
  quantity: z.number().nullable(),
  unit: z.enum(['piece', 'kg', 'dozen']).nullable(),
  budget_per_unit_inr: z.number().nullable(),
  no_budget_limit: z.boolean(),
  deadline_days: z.number().nullable(),
  delivery_city: z.string().nullable(),
  material_supplied: z.boolean().nullable(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'angry']),
});
export type Nlu = z.infer<typeof NluSchema>;

const NLU_SYSTEM = `You are the language-understanding step of "Claire", a B2B trade assistant for India's Tiruppur garment supply chain.
Users speak Tamil, Hindi, English, Telugu, Bengali etc., often code-mixed (Tanglish/Hinglish), usually transcribed from voice.
Extract the intent and slots from the user's message. Rules:
- category_id MUST be one of these ids, or null if unclear:
${TAXONOMY}
- Stitching / printing / dyeing work requests are FIND_SERVICE with a service.* category. Buying finished goods, fabric or yarn is BUY_PRODUCT.
- quantity is the number of pieces/kg/dozen wanted; budget_per_unit_inr is the price per unit (e.g. "170 tak", "under 170", "170க்குள்" → 170).
- deadline_days: "this week" 7, "2 weeks"/"do hafte" 14, "1 month" 30, "10 days" 10.
- delivery_city in English (Kolkata, Delhi…). Never invent values; use null when not said.
- "talk to a person", "human", "agent", anger about fraud or non-payment → TALK_TO_HUMAN.
- Trade terms (${GLOSSARY}) keep their meaning.
The JSON input has: step (what Claire last asked), slots (already known), language, utterance.`;

const CITIES: Record<string, string> = {
  kolkata: 'Kolkata', calcutta: 'Kolkata', कोलकाता: 'Kolkata', கொல்கத்தா: 'Kolkata', delhi: 'Delhi', दिल्ली: 'Delhi', டெல்லி: 'Delhi',
  mumbai: 'Mumbai', मुंबई: 'Mumbai', pune: 'Pune', patna: 'Patna', पटना: 'Patna', hyderabad: 'Hyderabad', bengaluru: 'Bengaluru', bangalore: 'Bengaluru',
  chennai: 'Chennai', சென்னை: 'Chennai', surat: 'Surat', jaipur: 'Jaipur', lucknow: 'Lucknow', tiruppur: 'Tiruppur', திருப்பூர்: 'Tiruppur', coimbatore: 'Coimbatore',
};

/** Fast rule-based parser — used for simple turns and whenever Claude is unavailable. */
export function ruleNlu(text: string, step?: string | null): Nlu {
  const s = ` ${text.toLowerCase()} `;
  const out: Nlu = {
    intent: 'UNKNOWN', confidence: 0.4, category_id: null, fabric: null, gsm: null, colours: [], quantity: null, unit: null,
    budget_per_unit_inr: null, no_budget_limit: false, deadline_days: null, delivery_city: null, material_supplied: null, sentiment: 'neutral',
  };
  for (const c of CATEGORIES) if (c.keywords.some((k) => s.includes(k.toLowerCase()))) { out.category_id = c.id; break; }
  if (/cotton|कॉटन|காட்டன்/.test(s)) out.fabric = 'cotton';
  if (/lycra|लाइक्रा/.test(s)) out.fabric = 'cotton lycra';
  if (/poly/.test(s)) out.fabric = 'polyester';
  const gsm = s.match(/(\d{3})\s*gsm/);
  if (gsm) out.gsm = Number(gsm[1]);
  for (const [k, v] of Object.entries(CITIES)) if (s.includes(k)) out.delivery_city = v;

  const nums = [...s.matchAll(/(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k\b|हज़ार|हजार|ஆயிரம்)?/g)].map((m) => ({
    n: Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1), raw: m[0], idx: m.index ?? 0,
  })).filter((x) => !Number.isNaN(x.n) && !(out.gsm && x.n === out.gsm));
  const budgetCue = /(under|below|upto|up to|tak|तक|க்குள்|budget|बजट|rate|रेट|₹|rs)/;
  for (const x of nums) {
    const around = s.slice(Math.max(0, x.idx - 12), x.idx + x.raw.length + 10);
    if (/(day|din|दिन|நாள்)/.test(around) && x.n <= 60) out.deadline_days = x.n;
    else if (budgetCue.test(around) && x.n <= 3000 && out.budget_per_unit_inr === null) out.budget_per_unit_inr = x.n;
    else if (out.quantity === null && x.n >= 20) out.quantity = x.n;
    else if (out.budget_per_unit_inr === null && x.n < 3000) out.budget_per_unit_inr = x.n;
  }
  if (step === 'budget' && nums.length && out.budget_per_unit_inr === null) out.budget_per_unit_inr = nums[0].n;
  if (step === 'quantity' && nums.length && out.quantity === null) out.quantity = nums[0].n;
  if (/week|hafte|हफ्ते|हफ़्ते|வாரம்/.test(s)) out.deadline_days = (nums.find((x) => x.n <= 4)?.n || (/(do|two|2|இரண்டு)/.test(s) ? 2 : 1)) * 7;
  if (/month|mahine|महीने|மாதம்/.test(s)) out.deadline_days = 30;
  if (/no limit|koi bhi|कोई भी|any price/.test(s)) out.no_budget_limit = true;

  if (/(person|human|agent|insaan|इंसान|किसी से बात|ஆள்|பேச வேண்டும்|fraud|cheat|धोखा|ஏமாற்)/.test(s)) out.intent = 'TALK_TO_HUMAN';
  else if (/(sell|बेच|विक्र|விற்க|add product|catalog)/.test(s)) out.intent = 'ADD_LISTING';
  else if (/(my order|order status|मेरे ऑर्डर|ஆர்டர்)/.test(s)) out.intent = 'ORDER_STATUS';
  else if (/(reorder|same as last|फिर से|மீண்டும்)/.test(s)) out.intent = 'REORDER';
  else if (out.category_id?.startsWith('service.') || /(stitch|silai|सिलाई|தையல்|job work)/.test(s)) out.intent = 'FIND_SERVICE';
  else if (out.category_id || out.quantity) out.intent = 'BUY_PRODUCT';
  else if (/^(\s*)(hi|hello|namaste|vanakkam|नमस्ते|வணக்கம்)/.test(s)) out.intent = 'GREETING';
  if (out.intent !== 'UNKNOWN') out.confidence = 0.75;
  return out;
}

export async function understand(text: string, ctx: { step?: string | null; slots?: unknown; language: string }): Promise<Nlu> {
  const rules = ruleNlu(text, ctx.step);
  // Short answers to a direct question (a number, a category word) don't need the model.
  const words = text.trim().split(/\s+/);
  // Only a bare number answering a direct question skips the model — everything else gets full understanding.
  const simple = words.length <= 2 && /^[₹\d,.\s]+(pcs|pieces|kg|rs)?$/i.test(text.trim()) && (ctx.step === 'quantity' || ctx.step === 'budget');
  if (simple || !llmEnabled) return rules;
  const ai = await structured({
    schema: NluSchema,
    name: 'extract_intent',
    system: NLU_SYSTEM,
    content: JSON.stringify({ step: ctx.step ?? null, slots: ctx.slots ?? {}, language: ctx.language, utterance: text }),
    effort: 'medium',
    maxTokens: 3000,
  });
  if (!ai) return rules;
  if (ai.category_id && !catById(ai.category_id)) ai.category_id = rules.category_id;
  return ai;
}

// ── Onboarding profile ─────────────────────────────────────────────────────
const ProfileSchema = z.object({
  owner_name: z.string().nullable(),
  business_name: z.string().nullable(),
  role_label: z.string().nullable(),
  sells: z.array(z.string()),
  buys: z.array(z.string()),
  capacity_note: z.string().nullable(),
  city: z.string().nullable(),
  area: z.string().nullable(),
  gstin: z.string().nullable(),
  is_manufacturer: z.boolean().nullable(),
});
export type ProfileDraft = z.infer<typeof ProfileSchema>;

export async function extractProfile(transcripts: string[], language: string, previous: Partial<ProfileDraft>): Promise<ProfileDraft> {
  const ai = await structured({
    schema: ProfileSchema,
    name: 'business_profile',
    system: `You build a business profile for a B2B garment trade app from what the owner said while onboarding (any Indian language, code-mixed).
sells/buys must contain only these category ids:\n${TAXONOMY}\nrole_label is a short English label like "Stitching unit", "Manufacturer", "Wholesaler", "Reseller", "Yarn agent". capacity_note keeps numbers as said ("20 machines"). Names in their original form (Latin script if said in English). Keep previous values unless the user corrected them. Never invent.`,
    content: JSON.stringify({ language, previous, transcripts }),
    effort: 'medium',
    maxTokens: 3000,
  });
  if (ai) return { ...emptyProfile(), ...previous, ...Object.fromEntries(Object.entries(ai).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length))) } as ProfileDraft;
  return ruleProfile(transcripts, previous);
}

const catsIn = (clause: string) => {
  const c = ` ${clause.toLowerCase()} `;
  return CATEGORIES.filter((cat) => cat.keywords.some((k) => c.includes(k.toLowerCase()))).map((cat) => cat.id);
};

/** Keyword fallback for onboarding when the model is unavailable. Transcripts may be tagged "[step] text". */
function ruleProfile(transcripts: string[], previous: Partial<ProfileDraft>): ProfileDraft {
  const d: ProfileDraft = { ...emptyProfile(), ...previous, sells: [...(previous.sells ?? [])], buys: [...(previous.buys ?? [])] };
  for (const raw of transcripts) {
    const tag = raw.match(/^\[(\w+)\]\s*/);
    const step = tag?.[1];
    const text = tag ? raw.slice(tag[0].length) : raw;

    const name = text.match(/(?:my name is|i am|i'm|this is|मेरा नाम|என் பேரு|என் பெயர்)\s+([^\s,.]+(?:\s+[A-Z][a-z]+)?)/i);
    if (name && !/^(a|the|from)$/i.test(name[1])) d.owner_name = name[1].replace(/\s+(and|my)$/i, '');
    const biz = text.match(/(?:business(?:\s+name)?|company(?:\s+name)?|shop(?:\s+name)?|firm|unit)\s+(?:is|called|named)\s+([^,.;]+)/i)
      || text.match(/(?:बिज़नेस|बिजनेस|दुकान|कंपनी)(?:\s+का\s+नाम)?\s+([^,.;।]+?)\s+(?:है|हैं)/);
    if (biz) d.business_name = biz[1].trim().split(/\s+/).slice(0, 6).join(' ');
    if (step === 'intro' && !name && !biz && text.includes(',')) {
      const [a, b] = text.split(',').map((x) => x.trim());
      if (a && !d.owner_name) d.owner_name = a.split(/\s+/).slice(0, 2).join(' ');
      if (b && !d.business_name) d.business_name = b.split(/\s+/).slice(0, 6).join(' ');
    }

    for (const clause of text.split(/[.;।]|\band\b|\balso\b|और|மற்றும்/i)) {
      let cats = catsIn(clause);
      if (!cats.length) continue;
      // "track pants stitching job work" describes the service, not a garment they sell.
      if (cats.some((c) => c.startsWith('service.'))) cats = cats.filter((c) => c.startsWith('service.'));
      const target = /(buy|purchase|need|खरीद|வாங்க)/i.test(clause) ? d.buys : d.sells;
      for (const c of cats) if (!target.includes(c)) target.push(c);
    }
    const cap = text.match(/(\d[\d,]*)\s*(machines?|मशीन|மெஷின்|pieces?\s+(?:a|per)\s+(?:day|week))/i);
    if (cap) d.capacity_note = `${cap[1]} ${cap[2]}`;
    if (/manufactur|we make|factory|बनाते|தயாரி/i.test(text)) d.is_manufacturer = true;

    const lower = ` ${text.toLowerCase()} `;
    for (const [k, v] of Object.entries(CITIES)) if (lower.includes(k)) d.city = v;
    if (step === 'location') {
      const parts = text.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
      const area = parts.find((p) => !Object.keys(CITIES).some((k) => p.toLowerCase().includes(k)));
      if (area && area.length < 60) d.area = area;
      if (!d.city && parts.length) d.city = parts[parts.length - 1].slice(0, 40);
    }
    const gst = text.toUpperCase().replace(/[\s-]/g, '').match(/\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/);
    if (gst) d.gstin = gst[0];
  }
  if (!d.role_label) {
    const has = (p: string) => d.sells.some((c) => c.startsWith(p));
    d.role_label = has('service.stitching') ? 'Stitching unit' : has('service.printing') ? 'Printing unit' : has('service.dyeing') ? 'Dyeing unit'
      : has('fabric.') ? 'Knitting unit' : has('yarn.') ? 'Yarn agent' : has('garment.') ? (d.is_manufacturer ? 'Manufacturer' : 'Wholesaler')
      : d.buys.length ? 'Reseller' : null;
  }
  return d;
}

export const emptyProfile = (): ProfileDraft => ({
  owner_name: null, business_name: null, role_label: null, sells: [], buys: [], capacity_note: null, city: null, area: null, gstin: null, is_manufacturer: null,
});

// ── Catalog from photos ────────────────────────────────────────────────────
const CatalogSchema = z.object({
  products: z.array(z.object({
    image_indexes: z.array(z.number()),
    category_id: z.string(),
    title: z.string(),
    fabric: z.string().nullable(),
    colours: z.array(z.string()),
    pattern: z.string().nullable(),
    confidence: z.number(),
  })),
});
export type CatalogDraft = z.infer<typeof CatalogSchema>['products'][number];

export async function catalogFromImages(images: { mediaType: string; base64: string }[]): Promise<CatalogDraft[]> {
  const content: any[] = [];
  images.forEach((img, i) => {
    content.push({ type: 'text', text: `Image ${i}:` });
    content.push({ type: 'image_url', image_url: { url: `data:${img.mediaType};base64,${img.base64}` } });
  });
  content.push({ type: 'text', text: 'Group these photos into distinct products (several angles or colours of one design = one product) and describe each.' });
  const ai = await structured({
    schema: CatalogSchema,
    name: 'catalog_products',
    vision: true,
    system: `You catalogue product photos for a Tiruppur garment wholesaler. category_id must be one of:\n${TAXONOMY}\nTitle: short English wholesale title like "Cotton track pants, side stripe" (no prices, no brand claims). Colours: plain colour words. If unsure of fabric say null.`,
    content,
    effort: 'medium',
    maxTokens: 6000,
  });
  if (ai?.products?.length) return ai.products.map((p) => ({ ...p, category_id: catById(p.category_id) ? p.category_id : 'garment.tshirt' }));
  return images.map((_, i) => ({ image_indexes: [i], category_id: 'garment.tshirt', title: 'New product', fabric: null, colours: [], pattern: null, confidence: 0.2 }));
}

const RulesSchema = z.object({
  rules: z.array(z.object({ category_id: z.string().nullable(), price: z.number().nullable(), moq: z.number().nullable(), sizes: z.array(z.string()), stock: z.number().nullable() })),
});

export async function parseCatalogRules(text: string, categories: string[]) {
  const ai = await structured({
    schema: RulesSchema,
    name: 'price_rules',
    system: `A seller describes prices for products they just photographed (any Indian language). Return one rule per category mentioned; category_id null means "all products". Allowed category ids: ${categories.join(', ')}. price is rupees per piece (or per dozen/kg if the seller says so). moq = minimum order quantity. sizes like ["M","L","XL","XXL"] ("M to XXL" → M,L,XL,XXL).`,
    content: text,
    effort: 'medium',
    maxTokens: 2000,
  });
  if (ai) return ai.rules;
  return ruleCatalogRules(text, categories);
}

const MOQ_CUE = /(minimum|min\.?|moq|at least|कम से कम|मिनिमम|குறைந்தது|மினிமம்)\s*(?:order\s*)?(?:of\s*)?(\d[\d,]*)/i;
const STOCK_CUE = /(\d[\d,]*)\s*(?:pieces?|pcs)?\s*(?:ready|in stock|stock|तैयार|ரெடி)/i;

/** Fallback for "Track pants 180, T-shirt 120, minimum 500, sizes M to XXL" when the model is unavailable. */
function ruleCatalogRules(text: string, categories: string[]) {
  const toNum = (x: string) => Number(x.replace(/,/g, ''));
  const moqM = text.match(MOQ_CUE);
  const moq = moqM ? toNum(moqM[2]) : null;
  const stockM = text.match(STOCK_CUE);
  const stock = stockM ? toNum(stockM[1]) : null;
  const sizeM = text.match(/\b(XS|S|M|L|XL|XXL|XXXL|2XL|3XL)\s*(?:to|-|से|முதல்)\s*(XS|S|M|L|XL|XXL|XXXL|2XL|3XL)\b/i);
  const ladder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const norm = (x: string) => ({ '2XL': 'XXL', '3XL': 'XXXL' } as Record<string, string>)[x.toUpperCase()] ?? x.toUpperCase();
  const sizes = sizeM ? ladder.slice(ladder.indexOf(norm(sizeM[1])), ladder.indexOf(norm(sizeM[2])) + 1) : [];
  // Numbers that are not the MOQ / stock are prices.
  const priceIn = (chunk: string) => {
    const cleaned = chunk.replace(MOQ_CUE, ' ').replace(STOCK_CUE, ' ').replace(/\b\d{3}\s*gsm\b/gi, ' ');
    const m = cleaned.match(/(?:₹|rs\.?|rupees?|रुपये|ரூபாய்)?\s*(\d[\d,]*(?:\.\d+)?)/i);
    return m ? toNum(m[1]) : null;
  };
  const perCat = categories
    .map((id) => {
      const cat = catById(id);
      if (!cat) return null;
      const lower = text.toLowerCase();
      const hit = cat.keywords.map((k) => lower.indexOf(k.toLowerCase())).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      if (hit === undefined) return null;
      const chunk = text.slice(hit).split(/[,;]|\band\b/i)[0];
      const price = priceIn(chunk);
      return price ? { category_id: id, price, moq, sizes, stock } : null;
    })
    .filter((r): r is NonNullable<typeof r> => !!r);
  if (perCat.length) return perCat;
  return [{ category_id: null, price: priceIn(text), moq, sizes, stock }];
}

// ── Trade Desk triage ──────────────────────────────────────────────────────
const TriageSchema = z.object({
  summary_en: z.string(),
  summary_local: z.string(),
  next_step: z.string(),
  priority: z.enum(['P1', 'P2', 'P3']),
});

export async function triage(context: object, agentLanguage: string) {
  return structured({
    schema: TriageSchema,
    name: 'ticket_brief',
    cache: false,
    system: `You brief a human support agent at CLAIRE Trade Desk (B2B garment marketplace, Tiruppur). Write a 2–3 sentence factual summary of what happened and what each side wants (amounts in ₹ with Indian grouping), then one concrete suggested next step. summary_local is the same summary in language code "${agentLanguage}". Only use facts from the context.`,
    content: JSON.stringify(context),
    effort: 'medium',
    maxTokens: 3000,
  });
}

// ── Translation fallback (Nexconn built-in translation is primary, on the client) ─────
const TransSchema = z.object({ translations: z.array(z.string()) });

export async function translate(texts: string[], to: string, from = 'auto') {
  if (!texts.length) return [];
  const ai = await structured({
    schema: TransSchema,
    name: 'translations',
    system: `Translate each input string into language code "${to}" (source: ${from}). Natural, colloquial trade speech, always written in the target language's native script (Tamil script for ta, Devanagari for hi, etc.) even when the input is romanised. Keep numbers, ₹ amounts, sizes and these trade terms exactly: ${GLOSSARY}. Return the same number of strings in the same order.`,
    content: JSON.stringify(texts),
    effort: 'low', // short chat lines: low effort keeps translations fast without hurting quality
    maxTokens: 3000,
  });
  return ai?.translations?.length === texts.length ? ai.translations : texts;
}

// ── Seller auto-reply ──────────────────────────────────────────────────────
const ReplySchema = z.object({ reply: z.string(), propose_price: z.number().nullable() });

export async function draftSellerReply(ctx: { sellerName: string; language: string; buyerMessage: string; listings: object[]; floorNote: string }) {
  return structured({
    schema: ReplySchema,
    name: 'seller_reply',
    cache: false,
    system: `You are Claire answering a buyer on behalf of the seller "${ctx.sellerName}" while the owner is busy. Reply in language code "${ctx.language}" in 1–3 short sentences, friendly and businesslike. Only use the seller's catalog data provided (prices, MOQ, stock). Never accept orders or credit terms. ${ctx.floorNote} If the buyer asks for a price, propose_price may be set but never below the floor price.`,
    content: JSON.stringify({ buyerMessage: ctx.buyerMessage, catalog: ctx.listings }),
    effort: 'medium',
    maxTokens: 2000,
  });
}
