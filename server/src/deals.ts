// Deals: deal chats, offers & counters, orders and their lifecycle, ratings, samples, job-work offers
// (spec §J2.2, §J3, §J4, §J5, §J7). MongoDB is the source of truth; chat posts are best-effort.
import { col, find, findOne, byId, insert, update, claim, bump } from './db/index.js';
import { chat } from './chat.js';
import { BOT, features } from './config.js';
import { getBiz, publicBiz, usersOf, type UserRow } from './biz.js';
import { trustOf, invalidateTrust } from './trust.js';
import { marketBand } from './match.js';
import { draftSellerReply } from './ai.js';
import { createTicket, nextSeq, safe, ensureChatUsers, ensureNexconnGroup, langName, OPEN_STATUSES } from './desk.js';
import { id, now, inr, HttpError } from './util.js';
import { advanceAmount, balanceAmount } from './money.js';
import { catById, categoryName } from '../../shared/taxonomy.js';
import { serverLocale } from './locales/index.js';
import { CC_CARD, CC_HINT, type CardPayload, type HintPayload, type MatchLine } from '../../shared/cards.js';

// ── Types ─────────────────────────────────────────────────────────────────
export interface ConversationDoc {
  id: string;
  kind: 'deal' | 'combo' | 'support';
  channel_id: string;
  title: string;
  business_ids: string[];
  user_ids: string[];
  buyer_business_id: string | null;
  seller_business_id: string | null;
  requirement_id: string | null;
  agent_user_id: string | null;
  ticket_id?: string | null;
  posted_requirements?: string[];
  /** 1 once the Nexconn group for this conversation is known to exist. */
  nexconn_synced?: number;
  last_at?: number;
  last_text?: string | null;
  last_buyer_msg_at?: number | null;
  last_seller_msg_at?: number | null;
  last_auto_reply_at?: number | null;
  created_at: number;
  updated_at: number;
}

export type OfferKind = 'purchase' | 'job_work';
export interface OfferDoc {
  id: string;
  kind: OfferKind;
  conversation_id: string;
  requirement_id: string | null;
  listing_id: string | null;
  category: string | null;
  from_business_id: string;
  to_business_id: string;
  from_user_id: string;
  title: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  dispatch_days: number;
  advance_pct: number;
  credit_days: number;
  freight: 'paid' | 'to_pay' | 'extra';
  parent_id: string | null;
  parent_price: number | null;
  status: 'pending' | 'countered' | 'accepted' | 'declined' | 'expired';
  created_by: 'user' | 'claire_auto';
  order_id?: string | null;
  created_at: number;
  updated_at: number;
}

export type OrderKind = 'purchase' | 'sample' | 'job_work';
export type OrderStatus = 'confirmed' | 'advance_paid' | 'in_production' | 'dispatched' | 'delivered' | 'balance_paid' | 'closed' | 'cancelled' | 'disputed';
export interface OrderDoc {
  id: string;
  code: string;
  kind: OrderKind;
  offer_id: string | null;
  group_id: string | null;
  conversation_id: string | null;
  requirement_id: string | null;
  listing_id: string | null;
  category: string | null;
  buyer_business_id: string;
  seller_business_id: string;
  title: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  advance_pct: number;
  credit_days: number;
  dispatch_days: number;
  freight: string;
  gst_pct: number;
  eway_bill: boolean;
  status: OrderStatus;
  status_before_dispute?: OrderStatus | null;
  qty_done: number;
  dispatch: { transporter?: string; lr?: string; bundles?: number } | null;
  note?: string | null;
  sizes?: string[];
  advance_paid_at?: number | null;
  advance_confirmed_at?: number | null;
  production_at?: number | null;
  dispatched_at?: number | null;
  delivered_at?: number | null;
  balance_due_at?: number | null;
  paid_at?: number | null;
  balance_confirmed_at?: number | null;
  closed_at?: number | null;
  created_at: number;
  updated_at: number;
}

export type OrderEventType = 'advance_paid' | 'payment_confirmed' | 'in_production' | 'dispatched' | 'delivered' | 'balance_paid' | 'problem';

const DAY = 86400000;
const autoTimers = new Map<string, NodeJS.Timeout>();
const AUTO_REPLY_DELAY_MS = 20_000;
const strip = <T extends object>(x: T) => {
  const { _id, ...rest } = x as any;
  return rest as T;
};

// ── Phrases (receiver's language; others fall back to English) ─────────────
const P: Record<string, Record<string, string>> = {
  en: {
    lead: '{buyer}: trust {trust}{pays}.',
    lead_market: ' Market median for this spec is {median}; your listed price is {mine}.',
    lead_market_only: ' Market median for this spec is {median}.',
    pays: ', pays on time {x}',
    quote: 'Quote {price}',
    combo: 'Combo order: your share is {qty} {unit}{budget}. Other sellers in this order cannot see your price.',
    combo_budget: ' (buyer budget up to {price})',
    job: 'Job-work offer from {buyer}: {qty} pcs at {price}/pc, needed in {days} days. Accept, counter or decline.',
    offer_market: 'Market median for this spec is {median}. {seller}: trust {trust}{ontime}.',
    ontime: ', on time {x}%',
    counter_hint: 'Make this a counter-offer at {price}?',
    counter_label: 'Counter {price}',
    offer_hint: 'Send this as an offer at {price}?',
    offer_hint_ctx: 'Listed at {listed}/pc. Sellers usually settle 3–6% lower, around {lo}–{hi}. Send {price} as your offer?',
    offer_label: 'Offer {price}',
    declined: '{who} declined the offer at {price}.',
    order_created: 'Order {code} confirmed · {title} · {qty} × {price} = {total}.',
    advance_paid: 'Order {code}: {buyer} marked the advance of {amount} as paid.',
    payment_confirmed: 'Order {code}: {seller} confirmed receiving {amount}.',
    in_production: 'Order {code} is in production.',
    progress: 'Order {code}: {done} of {qty} done.',
    dispatched: 'Order {code} dispatched{via}.',
    delivered: 'Order {code} delivered. Balance {amount} due by {date}.',
    delivered_closed: 'Order {code} delivered. It was fully paid in advance, so the order is complete. Thank you!',
    balance_paid: 'Order {code}: balance {amount} paid. Order closed — thank you!',
    problem: 'Order {code}: a problem was reported. Trade Desk ticket {ticket} is open; a person will join this chat.',
    desk_called: 'I have asked our Trade Desk to help here. A person will join this chat soon ({ticket}).',
    auto_label: 'Auto-reply by Claire for {seller}',
    auto_fallback: 'Namaste! {title}: {price} per {unit}, minimum {moq}{stock}. Please share quantity, sizes and delivery date.',
    auto_stock: ', {stock} ready',
    sample: 'Sample requested: {title} · sizes {sizes}{note}.',
    rated_both: 'Both sides have rated order {code}. Ratings are now visible on profiles.',
    concierge: 'Large order {code}: our Trade Desk will help both sides with samples and payment terms.',
    q_quality: 'Quality matches sample', q_value: 'Value for money', q_on_time: 'Delivered on time', q_communication: 'Communication',
    q_paid_on_time: 'Paid on time', q_clarity: 'Clear requirements', q_fair_returns: 'Fair on returns / no cancellations',
  },
  hi: {
    lead: '{buyer}: ट्रस्ट {trust}{pays}।',
    lead_market: ' इस स्पेक का बाज़ार भाव {median} है; आपका रेट {mine} है।',
    lead_market_only: ' इस स्पेक का बाज़ार भाव {median} है।',
    pays: ', समय पर भुगतान {x}',
    quote: '{price} कोट करें',
    combo: 'कॉम्बो ऑर्डर: आपका हिस्सा {qty} {unit}{budget}। इस ऑर्डर के बाकी सेलर आपका रेट नहीं देख सकते।',
    combo_budget: ' (खरीदार का बजट {price} तक)',
    job: '{buyer} से जॉब वर्क ऑफ़र: {qty} पीस, {price}/पीस, {days} दिन में चाहिए। मंज़ूर करें, काउंटर करें या मना करें।',
    offer_market: 'इस स्पेक का बाज़ार भाव {median} है। {seller}: ट्रस्ट {trust}{ontime}।',
    ontime: ', समय पर {x}%',
    counter_hint: 'इसे {price} का काउंटर-ऑफ़र बनाएँ?',
    counter_label: 'काउंटर {price}',
    offer_hint: 'इसे {price} का ऑफ़र बनाकर भेजें?',
    offer_hint_ctx: 'लिस्ट रेट {listed}/पीस है। विक्रेता आमतौर पर 3–6% कम, यानी {lo}–{hi} पर मान जाते हैं। {price} का ऑफ़र भेजें?',
    offer_label: 'ऑफ़र {price}',
    declined: '{who} ने {price} वाला ऑफ़र मना कर दिया।',
    order_created: 'ऑर्डर {code} पक्का · {title} · {qty} × {price} = {total}।',
    advance_paid: 'ऑर्डर {code}: {buyer} ने {amount} एडवांस भुगतान दर्ज किया।',
    payment_confirmed: 'ऑर्डर {code}: {seller} ने {amount} मिलने की पुष्टि की।',
    in_production: 'ऑर्डर {code} प्रोडक्शन में है।',
    progress: 'ऑर्डर {code}: {qty} में से {done} तैयार।',
    dispatched: 'ऑर्डर {code} भेज दिया गया{via}।',
    delivered: 'ऑर्डर {code} डिलीवर हुआ। बाकी {amount} {date} तक देना है।',
    delivered_closed: 'ऑर्डर {code} डिलीवर हुआ। पूरा भुगतान पहले ही हो चुका था, ऑर्डर पूरा — धन्यवाद!',
    balance_paid: 'ऑर्डर {code}: बाकी {amount} का भुगतान हुआ। ऑर्डर पूरा — धन्यवाद!',
    problem: 'ऑर्डर {code}: समस्या दर्ज हुई। ट्रेड डेस्क टिकट {ticket} खुला है; कोई इस चैट में जुड़ेगा।',
    desk_called: 'मैंने ट्रेड डेस्क से मदद मांगी है। जल्द ही कोई इस चैट में जुड़ेगा ({ticket})।',
    auto_label: '{seller} की ओर से Claire का ऑटो-जवाब',
    auto_fallback: 'नमस्ते! {title}: {price} प्रति {unit}, कम से कम {moq}{stock}। कृपया मात्रा, साइज़ और डिलीवरी की तारीख बताएं।',
    auto_stock: ', {stock} तैयार',
    sample: 'सैंपल माँगा: {title} · साइज़ {sizes}{note}।',
    rated_both: 'दोनों पक्षों ने ऑर्डर {code} को रेटिंग दी। रेटिंग अब प्रोफ़ाइल पर दिखेगी।',
    concierge: 'बड़ा ऑर्डर {code}: हमारा ट्रेड डेस्क सैंपल और भुगतान शर्तों में दोनों की मदद करेगा।',
    q_quality: 'क्वालिटी सैंपल जैसी', q_value: 'दाम के हिसाब से माल', q_on_time: 'समय पर डिलीवरी', q_communication: 'बातचीत',
    q_paid_on_time: 'समय पर भुगतान', q_clarity: 'साफ़ ज़रूरत बताई', q_fair_returns: 'रिटर्न में ईमानदार / कैंसल नहीं किया',
  },
  ta: {
    lead: '{buyer}: நம்பகத்தன்மை {trust}{pays}.',
    lead_market: ' இந்த ஸ்பெக்கின் சந்தை விலை {median}; உங்கள் விலை {mine}.',
    lead_market_only: ' இந்த ஸ்பெக்கின் சந்தை விலை {median}.',
    pays: ', சரியான நேரத்தில் பணம் {x}',
    quote: '{price} கோட் செய்',
    combo: 'காம்போ ஆர்டர்: உங்கள் பங்கு {qty} {unit}{budget}. மற்ற விற்பனையாளர்கள் உங்கள் விலையைப் பார்க்க முடியாது.',
    combo_budget: ' (வாங்குபவர் பட்ஜெட் {price} வரை)',
    job: '{buyer} இடமிருந்து ஜாப் வொர்க்: {qty} பீஸ், {price}/பீஸ், {days} நாளில் தேவை. ஏற்கவும், மாற்று விலை சொல்லவும் அல்லது மறுக்கவும்.',
    offer_market: 'இந்த ஸ்பெக்கின் சந்தை விலை {median}. {seller}: நம்பகத்தன்மை {trust}{ontime}.',
    ontime: ', சரியான நேரம் {x}%',
    counter_hint: 'இதை {price} மாற்று ஆஃபராக அனுப்பவா?',
    counter_label: 'மாற்று {price}',
    offer_hint: 'இதை {price} ஆஃபராக அனுப்பவா?',
    offer_hint_ctx: 'பட்டியல் விலை {listed}/பீஸ். விற்பவர்கள் பொதுவாக 3–6% குறைவாக, {lo}–{hi} அளவில் ஒப்புக்கொள்வார்கள். {price} ஆஃபராக அனுப்பவா?',
    offer_label: 'ஆஃபர் {price}',
    declined: '{who} {price} ஆஃபரை மறுத்தார்.',
    order_created: 'ஆர்டர் {code} உறுதி · {title} · {qty} × {price} = {total}.',
    advance_paid: 'ஆர்டர் {code}: {buyer} {amount} அட்வான்ஸ் செலுத்தியதாக பதிவு செய்தார்.',
    payment_confirmed: 'ஆர்டர் {code}: {seller} {amount} பெற்றதை உறுதி செய்தார்.',
    in_production: 'ஆர்டர் {code} உற்பத்தியில் உள்ளது.',
    progress: 'ஆர்டர் {code}: {qty} இல் {done} முடிந்தது.',
    dispatched: 'ஆர்டர் {code} அனுப்பப்பட்டது{via}.',
    delivered: 'ஆர்டர் {code} டெலிவரி ஆனது. மீதம் {amount} {date} க்குள் செலுத்த வேண்டும்.',
    delivered_closed: 'ஆர்டர் {code} டெலிவரி ஆனது. முழு தொகையும் முன்பே செலுத்தப்பட்டது, ஆர்டர் முடிந்தது — நன்றி!',
    balance_paid: 'ஆர்டர் {code}: மீதம் {amount} செலுத்தப்பட்டது. ஆர்டர் முடிந்தது — நன்றி!',
    problem: 'ஆர்டர் {code}: பிரச்சனை பதிவானது. டிரேட் டெஸ்க் டிக்கெட் {ticket} திறக்கப்பட்டது; ஒருவர் இந்த சாட்டில் சேருவார்.',
    desk_called: 'டிரேட் டெஸ்க் உதவியைக் கேட்டுள்ளேன். விரைவில் ஒருவர் இந்த சாட்டில் சேருவார் ({ticket}).',
    auto_label: '{seller} சார்பாக Claire தானியங்கி பதில்',
    auto_fallback: 'வணக்கம்! {title}: ஒரு {unit} {price}, குறைந்தது {moq}{stock}. அளவு, சைஸ், டெலிவரி தேதியை சொல்லுங்கள்.',
    auto_stock: ', {stock} தயார்',
    sample: 'மாதிரி கேட்கப்பட்டது: {title} · சைஸ் {sizes}{note}.',
    rated_both: 'இரு தரப்பும் ஆர்டர் {code} க்கு மதிப்பீடு அளித்தனர். இப்போது சுயவிவரத்தில் தெரியும்.',
    concierge: 'பெரிய ஆர்டர் {code}: மாதிரி மற்றும் பண நிபந்தனைகளில் டிரேட் டெஸ்க் உதவும்.',
    q_quality: 'தரம் மாதிரியைப் போல', q_value: 'விலைக்கு ஏற்ற மதிப்பு', q_on_time: 'நேரத்தில் டெலிவரி', q_communication: 'தொடர்பு',
    q_paid_on_time: 'நேரத்தில் பணம்', q_clarity: 'தெளிவான தேவைகள்', q_fair_returns: 'ரிட்டர்னில் நியாயம் / ரத்து இல்லை',
  },
};
// Namespace "deals"; te/kn/ml/bn/or/mr/gu come from src/locales/<lang>.json.
function tr(lang: string, key: string, vars: Record<string, string | number> = {}) {
  let s = P[lang]?.[key] ?? serverLocale(lang, 'deals', key) ?? P.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
const UNIT: Record<string, Record<string, string>> = {
  en: { piece: 'pcs', kg: 'kg', dozen: 'dozen' },
  hi: { piece: 'पीस', kg: 'किलो', dozen: 'दर्जन' },
  ta: { piece: 'பீஸ்', kg: 'கிலோ', dozen: 'டஜன்' },
};
const BUNDLES: Record<string, string> = { en: 'bundles', hi: 'बंडल', ta: 'பண்டல்கள்' };
// Namespace "deal_units" (keys piece, kg, dozen, bundles) for the overlay languages.
const unitOf = (lang: string, unit: string) => UNIT[lang]?.[unit] ?? serverLocale(lang, 'deal_units', unit) ?? UNIT.en[unit] ?? unit;
const bundlesWord = (lang: string) => BUNDLES[lang] ?? serverLocale(lang, 'deal_units', 'bundles') ?? BUNDLES.en;
const num = (n: number) => Number(n).toLocaleString('en-IN');
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ── Lookups ───────────────────────────────────────────────────────────────
async function ownerUsers(businessId: string) {
  return find<UserRow>('users', { business_id: businessId, role: 'owner' });
}

/** Send one text per language group (each side reads it in their language). */
async function systemBoth(order: Pick<OrderDoc, 'buyer_business_id' | 'seller_business_id'>, build: (lang: string) => string) {
  const users = [...(await ownerUsers(order.buyer_business_id)), ...(await ownerUsers(order.seller_business_id))];
  const byLang = new Map<string, string[]>();
  for (const u of users) byLang.set(u.language || 'en', [...(byLang.get(u.language || 'en') ?? []), u.id]);
  for (const [lang, ids] of byLang) await safe('system notice', chat.system(ids, build(lang)));
}

/** Targeted hint/card per language group inside a group chat. */
async function targeted(channelId: string, users: UserRow[], type: string, build: (lang: string) => object, from: string = BOT.claire) {
  const byLang = new Map<string, string[]>();
  for (const u of users) byLang.set(u.language || 'en', [...(byLang.get(u.language || 'en') ?? []), u.id]);
  for (const [lang, ids] of byLang) await safe(`targeted ${type}`, chat.group(channelId, from, type, build(lang), { onlyTo: ids }));
}

/** A shared notice in the deal chat, sent per language so each member reads it in their own language. */
async function noticeAll(conv: ConversationDoc, build: (lang: string) => string, tone: 'info' | 'success' | 'warn' = 'info') {
  const users = await find<UserRow>('users', { _id: { $in: conv.user_ids.filter((u) => u.startsWith('u_')) } });
  await targeted(conv.channel_id, users, CC_CARD, (lang) => ({ kind: 'notice', tone, text: build(lang) }) satisfies CardPayload);
}

/** Offers, order actions and messages all count as activity; seller activity cancels a pending auto-reply. */
async function noteActivity(conv: ConversationDoc, side: string | null, lastText?: string) {
  const at = now();
  const set: Record<string, unknown> = { updated_at: at, last_at: at };
  if (lastText !== undefined) set.last_text = lastText.slice(0, 140);
  if (side === 'buyer') set.last_buyer_msg_at = at;
  if (side === 'seller') {
    set.last_seller_msg_at = at;
    const timer = autoTimers.get(conv.id);
    if (timer) clearTimeout(timer);
    autoTimers.delete(conv.id);
  }
  await update('conversations', conv.id, set);
}

export async function getConversation(convId: string) {
  const c = await byId<ConversationDoc>('conversations', convId);
  if (!c) throw new HttpError(404, 'Conversation not found');
  return c;
}

function sideOf(conv: ConversationDoc, user: UserRow): 'buyer' | 'seller' | 'agent' | 'member' | null {
  if (user.business_id && user.business_id === conv.buyer_business_id) return 'buyer';
  if (user.business_id && user.business_id === conv.seller_business_id) return 'seller';
  if (['agent', 'supervisor'].includes(user.role)) return 'agent';
  if (conv.user_ids?.includes(user.id) || (user.business_id && conv.business_ids?.includes(user.business_id))) return 'member';
  return null;
}

function assertMember(conv: ConversationDoc, user: UserRow) {
  const side = sideOf(conv, user);
  if (!side) throw new HttpError(403, 'You are not part of this conversation.');
  return side;
}

export function convOut(c: ConversationDoc) {
  return { ...strip(c), channelId: c.channel_id };
}

function requireBusiness(user: UserRow) {
  if (!user.business_id) throw new HttpError(400, 'Please finish your business profile first.');
  return user.business_id;
}

function reqTitle(r: any): string {
  const c = catById(r.category);
  const name = c?.names.en ?? 'Goods';
  const fabric = r.attrs?.fabric ? String(r.attrs.fabric) : '';
  const base = fabric ? `${fabric} ${name.toLowerCase()}` : name;
  const t = base.charAt(0).toUpperCase() + base.slice(1);
  return r.attrs?.gsm ? `${t}, ${r.attrs.gsm} GSM` : t;
}

export function gstPctFor(category: string | null | undefined, unitPrice: number, unit: string) {
  const perPiece = unit === 'dozen' ? unitPrice / 12 : unitPrice;
  return category?.startsWith('garment') && perPiece > 2500 ? 18 : 5;
}

// ── Cards ─────────────────────────────────────────────────────────────────
export function offerCard(o: OfferDoc, fromName: string): CardPayload {
  return {
    kind: 'offer', offerId: o.id, fromBusinessId: o.from_business_id, fromName, title: o.kind === 'job_work' && !/^job work/i.test(o.title) ? `Job work · ${o.title}` : o.title,
    qty: o.qty, unit: o.unit, unitPrice: o.unit_price, total: o.total, dispatchDays: o.dispatch_days, advancePct: o.advance_pct, creditDays: o.credit_days,
    freight: o.freight, status: o.status, ...(o.parent_price != null ? { parentPrice: o.parent_price } : {}),
  };
}

export function orderCard(o: OrderDoc, buyerName: string, sellerName: string): CardPayload {
  return {
    kind: 'order', orderId: o.id, code: o.code, title: o.title, qty: o.qty, unit: o.unit, unitPrice: o.unit_price, total: o.total, status: o.status,
    buyerBusinessId: o.buyer_business_id, sellerBusinessId: o.seller_business_id, buyerName, sellerName, advancePct: o.advance_pct, creditDays: o.credit_days,
    ...(o.dispatch ? { dispatch: o.dispatch } : {}),
    ...(o.balance_due_at ? { balanceDueAt: o.balance_due_at } : {}),
    gstPct: o.gst_pct, ewayBill: o.eway_bill,
    advancePaid: !!o.advance_paid_at,
    ...(o.paid_at && !o.balance_confirmed_at ? { toConfirm: 'balance' as const } : o.advance_paid_at && !o.advance_confirmed_at ? { toConfirm: 'advance' as const } : {}),
    ...(o.kind === 'sample' ? { kindLabel: 'Sample' } : o.kind === 'job_work' ? { kindLabel: 'Job work', qtyDone: o.qty_done ?? 0 } : {}),
  };
}

async function bizNames(ids: string[]) {
  const rows = await find('businesses', { _id: { $in: [...new Set(ids)] } }, { projection: { name: 1, state: 1, language: 1 } });
  return new Map(rows.map((b) => [b._id as string, b as any]));
}

async function postOrderCard(order: OrderDoc) {
  if (!order.conversation_id) return;
  const conv = await byId<ConversationDoc>('conversations', order.conversation_id);
  if (!conv) return;
  const names = await bizNames([order.buyer_business_id, order.seller_business_id]);
  const card = orderCard(order, names.get(order.buyer_business_id)?.name ?? '', names.get(order.seller_business_id)?.name ?? '');
  await safe('order card', chat.group(conv.channel_id, BOT.claire, CC_CARD, card, { push: `Order ${order.code} · ${order.status.replace(/_/g, ' ')}` }));
}

// ── Open deal chats ───────────────────────────────────────────────────────
interface OpenOpts {
  sellerBusinessId: string;
  requirementId?: string;
  listingId?: string;
  /** Combo / job-work allocation shown on this seller's requirement card. */
  allocation?: { qty: number; unitPrice?: number; readyDays?: number; mode: 'combo' | 'job' };
}

async function findOrCreateConversation(buyerBizId: string, sellerBizId: string, ownerUserId: string): Promise<ConversationDoc> {
  const existing = await findOne<ConversationDoc>('conversations', { kind: 'deal', buyer_business_id: buyerBizId, seller_business_id: sellerBizId });
  if (existing) {
    await ensureNexconnGroup(existing);
    return existing;
  }
  const [buyer, seller] = await Promise.all([getBiz(buyerBizId), getBiz(sellerBizId)]);
  const [buyerUsers, sellerUsers] = await Promise.all([usersOf([buyerBizId]), usersOf([sellerBizId])]);
  const owner = buyerUsers.includes(ownerUserId) ? ownerUserId : buyerUsers[0] ?? ownerUserId;
  const members = [...new Set([owner, ...buyerUsers, ...sellerUsers, BOT.claire])];
  const channelId = `deal_${id('', 12)}`;
  const title = `${buyer.name} · ${seller.name}`;
  await ensureChatUsers(members);
  await chat.createGroup(channelId, title, owner, members);
  const at = now();
  const conv: ConversationDoc = {
    id: channelId, kind: 'deal', channel_id: channelId, title, business_ids: [buyerBizId, sellerBizId], user_ids: members,
    buyer_business_id: buyerBizId, seller_business_id: sellerBizId, requirement_id: null, agent_user_id: null, posted_requirements: [],
    last_at: at, last_text: null, last_buyer_msg_at: null, last_seller_msg_at: null, created_at: at, updated_at: at,
    nexconn_synced: features.nexconn ? 1 : 0,
  };
  try {
    await insert('conversations', conv);
  } catch (err: any) {
    if (err?.code === 11000) {
      const again = await findOne<ConversationDoc>('conversations', { kind: 'deal', buyer_business_id: buyerBizId, seller_business_id: sellerBizId });
      if (again) return again;
    }
    throw err;
  }
  return conv;
}

async function requirementFor(buyerBizId: string, opts: OpenOpts) {
  if (opts.requirementId) {
    const r = await byId('requirements', opts.requirementId);
    if (!r) throw new HttpError(404, 'Requirement not found');
    if (r.buyer_business_id && r.buyer_business_id !== buyerBizId) throw new HttpError(403, 'This requirement belongs to another business.');
    return r;
  }
  if (!opts.listingId) return null;
  const l = await byId('listings', opts.listingId);
  if (!l) throw new HttpError(404, 'Listing not found');
  const buyer = await getBiz(buyerBizId);
  const c = catById(l.category);
  // A storefront enquiry without a Claire search: make a light requirement from the listing.
  return insert('requirements', {
    id: id('rq_'), buyer_business_id: buyerBizId, type: c?.type ?? l.type, category: l.category, attrs: { fabric: l.attrs?.fabric ?? null, gsm: l.attrs?.gsm ?? null, colours: [] },
    liked: [l.id], listing_id: l.id, title: l.title, qty: l.moq, unit: l.unit, budget: null, deadline_days: null, city: buyer.city ?? null,
    status: 'open', source: 'storefront', created_at: now(),
  });
}

export async function openDeal(user: UserRow, opts: OpenOpts): Promise<ConversationDoc> {
  const buyerBizId = requireBusiness(user);
  if (opts.sellerBusinessId === buyerBizId) throw new HttpError(400, 'You cannot open a deal with your own business.');
  const seller = await getBiz(opts.sellerBusinessId);
  let conv = await findOrCreateConversation(buyerBizId, seller.id, user.id);
  const requirement = await requirementFor(buyerBizId, opts);
  if (!requirement) return conv;

  const at = now();
  await update('conversations', conv.id, { requirement_id: requirement.id, updated_at: at, last_at: at });
  conv = { ...conv, requirement_id: requirement.id };
  const postKey = opts.allocation ? `${requirement.id}:${opts.allocation.qty}` : requirement.id;
  if (conv.posted_requirements?.includes(postKey)) return conv;
  await col('conversations').updateOne({ _id: conv.id } as any, { $addToSet: { posted_requirements: postKey } });

  const [buyer, buyerTrust, sellerUsers, band] = await Promise.all([
    getBiz(buyerBizId), trustOf(buyerBizId), ownerUsers(seller.id), requirement.category ? marketBand(requirement.category) : Promise.resolve(null),
  ]);
  const qty = opts.allocation?.qty ?? requirement.qty;
  const card: CardPayload = {
    kind: 'requirement', requirementId: requirement.id, title: requirement.title ?? reqTitle(requirement), qty, unit: requirement.unit ?? 'piece',
    budget: opts.allocation?.unitPrice ?? requirement.budget ?? null, deadlineDays: opts.allocation?.readyDays ?? requirement.deadline_days ?? null,
    city: requirement.city ?? buyer.city ?? null, buyerName: buyer.name, buyerTrust: buyerTrust.score, ...(buyerTrust.paysOnTime ? { buyerPaysOnTime: buyerTrust.paysOnTime } : {}),
  };
  await safe('requirement card', chat.group(conv.channel_id, user.id, CC_CARD, card, { push: `New enquiry from ${buyer.name}` }));

  // Private hint for the seller: who is asking and what the market pays.
  const mine = requirement.category
    ? await findOne('listings', { business_id: seller.id, category: requirement.category, active: 1 }, { sort: { price: 1 } })
    : null;
  const suggested = mine ? Math.max(mine.floor_price ?? 0, requirement.budget ? Math.max(requirement.budget, mine.floor_price ?? 0) : mine.price) : null;
  await targeted(conv.channel_id, sellerUsers, CC_HINT, (lang) => {
    let text: string;
    if (opts.allocation?.mode === 'job') {
      text = tr(lang, 'job', { buyer: buyer.name, qty: num(qty), price: inr(opts.allocation.unitPrice ?? 0), days: opts.allocation.readyDays ?? requirement.deadline_days ?? 10 });
    } else {
      text = tr(lang, 'lead', { buyer: buyer.name, trust: buyerTrust.score, pays: buyerTrust.paysOnTime ? tr(lang, 'pays', { x: buyerTrust.paysOnTime }) : '' });
      if (band && mine) text += tr(lang, 'lead_market', { median: inr(band.median), mine: inr(mine.price) });
      else if (band) text += tr(lang, 'lead_market_only', { median: inr(band.median) });
      if (opts.allocation?.mode === 'combo') {
        text += ' ' + tr(lang, 'combo', { qty: num(qty), unit: unitOf(lang, requirement.unit ?? 'piece'), budget: opts.allocation.unitPrice ? tr(lang, 'combo_budget', { price: inr(opts.allocation.unitPrice) }) : '' });
      }
    }
    const hint: HintPayload = { text };
    if (suggested && opts.allocation?.mode !== 'job') hint.action = { label: tr(lang, 'quote', { price: inr(suggested) }), chipId: `quote:${suggested}` };
    return hint;
  });
  return conv;
}

export async function openCombo(user: UserRow, requirementId: string, lines: MatchLine[]) {
  const out: ConversationDoc[] = [];
  for (const line of lines) {
    out.push(await openDeal(user, { sellerBusinessId: line.businessId, requirementId, allocation: { qty: line.qty, unitPrice: line.unitPrice, readyDays: line.readyDays, mode: 'combo' } }));
  }
  return out;
}

// ── Offers ────────────────────────────────────────────────────────────────
export interface OfferInput {
  conversationId: string;
  qty?: number;
  unitPrice: number;
  dispatchDays?: number;
  advancePct?: number;
  creditDays?: number;
  freight?: 'paid' | 'to_pay' | 'extra';
  listingId?: string;
  title?: string;
  kind?: OfferKind;
}

async function defaultsFor(conv: ConversationDoc, listingId?: string) {
  const requirement = conv.requirement_id ? await byId('requirements', conv.requirement_id) : null;
  let listing = listingId ? await byId('listings', listingId) : null;
  if (!listing && requirement?.listing_id) listing = await byId('listings', requirement.listing_id);
  if (!listing && requirement?.category && conv.seller_business_id) {
    listing = await findOne('listings', { business_id: conv.seller_business_id, category: requirement.category, active: 1 }, { sort: { price: 1 } });
  }
  return { requirement, listing };
}

export async function createOffer(user: UserRow, input: OfferInput, opts: { parent?: OfferDoc; createdBy?: 'user' | 'claire_auto' } = {}) {
  const conv = await getConversation(input.conversationId);
  const side = assertMember(conv, user);
  if (side !== 'buyer' && side !== 'seller') throw new HttpError(403, 'Only the buyer or seller can make offers.');
  if (!(input.unitPrice > 0)) throw new HttpError(400, 'Please give a price per piece.');
  const fromBiz = user.business_id!;
  const toBiz = side === 'buyer' ? conv.seller_business_id! : conv.buyer_business_id!;
  const parent = opts.parent;
  const { requirement, listing } = parent ? { requirement: null, listing: null } : await defaultsFor(conv, input.listingId);

  const qty = Math.round(input.qty ?? parent?.qty ?? requirement?.qty ?? listing?.moq ?? 100);
  if (!(qty > 0)) throw new HttpError(400, 'Please give a quantity.');
  const unit = parent?.unit ?? listing?.unit ?? requirement?.unit ?? 'piece';
  const unitPrice = Math.round(input.unitPrice * 100) / 100;
  const at = now();
  const offer: OfferDoc = {
    id: id('of_'),
    kind: input.kind ?? parent?.kind ?? (catById(listing?.category ?? requirement?.category)?.type === 'service' ? 'job_work' : 'purchase'),
    conversation_id: conv.id,
    requirement_id: parent?.requirement_id ?? conv.requirement_id ?? null,
    listing_id: parent?.listing_id ?? listing?.id ?? null,
    category: parent?.category ?? listing?.category ?? requirement?.category ?? null,
    from_business_id: fromBiz,
    to_business_id: toBiz,
    from_user_id: user.id,
    title: input.title ?? parent?.title ?? listing?.title ?? (requirement ? requirement.title ?? reqTitle(requirement) : 'Order'),
    qty,
    unit,
    unit_price: unitPrice,
    total: Math.round(qty * unitPrice),
    dispatch_days: Math.max(0, Math.round(input.dispatchDays ?? parent?.dispatch_days ?? listing?.lead_days ?? 5)),
    advance_pct: Math.min(100, Math.max(0, Math.round(input.advancePct ?? parent?.advance_pct ?? 30))),
    credit_days: Math.max(0, Math.round(input.creditDays ?? parent?.credit_days ?? 0)),
    freight: input.freight ?? parent?.freight ?? 'to_pay',
    parent_id: parent?.id ?? null,
    parent_price: parent?.unit_price ?? null,
    status: 'pending',
    created_by: opts.createdBy ?? 'user',
    order_id: null,
    created_at: at,
    updated_at: at,
  };
  await insert('offers', offer);
  await noteActivity(conv, side, `${inr(unitPrice)} × ${num(qty)}`);

  const fromName = (await getBiz(fromBiz)).name;
  await safe('offer card', chat.group(conv.channel_id, user.id, CC_CARD, offerCard(offer, fromName), { push: `${fromName}: offer ${inr(unitPrice)}/${unit}` }));

  // The buyer gets a private market check on seller offers.
  if (side === 'seller' && offer.category) {
    const [band, sellerTrust, buyerUsers] = await Promise.all([marketBand(offer.category), trustOf(fromBiz), ownerUsers(toBiz)]);
    if (band) {
      await targeted(conv.channel_id, buyerUsers, CC_HINT, (lang) => ({
        text: tr(lang, 'offer_market', { median: inr(band.median), seller: fromName, trust: sellerTrust.score, ontime: sellerTrust.onTimePct != null ? tr(lang, 'ontime', { x: sellerTrust.onTimePct }) : '' }),
      }));
    }
  }
  return offer;
}

export async function respondOffer(user: UserRow, offerId: string, action: 'accept' | 'decline' | 'counter', unitPrice?: number) {
  const offer = await byId<OfferDoc>('offers', offerId);
  if (!offer) throw new HttpError(404, 'Offer not found');
  const conv = await getConversation(offer.conversation_id);
  assertMember(conv, user);
  if (offer.status !== 'pending') throw new HttpError(409, `This offer is already ${offer.status}.`);
  const isRecipient = user.business_id === offer.to_business_id;
  const isSender = user.business_id === offer.from_business_id;
  if (action !== 'decline' && !isRecipient) throw new HttpError(403, 'Only the other side can accept or counter this offer.');
  if (action === 'decline' && !isRecipient && !isSender) throw new HttpError(403, 'You cannot decline this offer.');

  const nextStatus = action === 'accept' ? 'accepted' : action === 'counter' ? 'countered' : 'declined';
  if (action === 'counter' && !(unitPrice && unitPrice > 0)) throw new HttpError(400, 'Please give your counter price.');
  const claimed = await col('offers').updateOne({ _id: offer.id, status: 'pending' } as any, { $set: { status: nextStatus, updated_at: now() } });
  if (!claimed.modifiedCount) throw new HttpError(409, 'This offer was just answered.');
  await noteActivity(conv, sideOf(conv, user));

  if (action === 'counter') {
    const counter = await createOffer(user, { conversationId: conv.id, unitPrice: unitPrice! }, { parent: { ...offer, status: 'countered' } });
    return { offer: counter };
  }
  if (action === 'decline') {
    const who = (await getBiz(user.business_id!)).name;
    await noticeAll(conv, (lang) => tr(lang, 'declined', { who, price: inr(offer.unit_price) }));
    return { offer: { ...offer, status: 'declined' as const } };
  }
  // Accept: other pending offers in this chat expire.
  await col('offers').updateMany({ conversation_id: conv.id, status: 'pending', _id: { $ne: offer.id } } as any, { $set: { status: 'expired', updated_at: now() } });
  const order = await createOrder({
    kind: offer.kind === 'job_work' ? 'job_work' : 'purchase', conv, offerId: offer.id, listingId: offer.listing_id, requirementId: offer.requirement_id, category: offer.category,
    title: offer.title, qty: offer.qty, unit: offer.unit, unitPrice: offer.unit_price, advancePct: offer.advance_pct, creditDays: offer.credit_days,
    dispatchDays: offer.dispatch_days, freight: offer.freight, actorUserId: user.id,
  });
  await update('offers', offer.id, { order_id: order.id });
  return { offer: { ...offer, status: 'accepted' as const, order_id: order.id }, order };
}

// ── Orders ────────────────────────────────────────────────────────────────
interface NewOrder {
  kind: OrderKind;
  conv: ConversationDoc;
  offerId: string | null;
  listingId: string | null;
  requirementId: string | null;
  category: string | null;
  title: string;
  qty: number;
  unit: string;
  unitPrice: number;
  advancePct: number;
  creditDays: number;
  dispatchDays: number;
  freight: string;
  actorUserId: string;
  note?: string | null;
  sizes?: string[];
}

async function createOrder(n: NewOrder): Promise<OrderDoc> {
  const buyerId = n.conv.buyer_business_id!;
  const sellerId = n.conv.seller_business_id!;
  const names = await bizNames([buyerId, sellerId]);
  const total = Math.round(n.qty * n.unitPrice);
  const gst = gstPctFor(n.category, n.unitPrice, n.unit);
  const interState = (names.get(buyerId)?.state ?? '') !== (names.get(sellerId)?.state ?? '');
  const seq = await nextSeq('order');
  const at = now();
  const order: OrderDoc = {
    id: id('o_'),
    code: `CC-${String(new Date().getFullYear()).slice(2)}-${String(seq).padStart(5, '0')}`,
    kind: n.kind,
    offer_id: n.offerId,
    group_id: n.kind === 'job_work' ? n.requirementId : null,
    conversation_id: n.conv.id,
    requirement_id: n.requirementId,
    listing_id: n.listingId,
    category: n.category,
    buyer_business_id: buyerId,
    seller_business_id: sellerId,
    title: n.title,
    qty: n.qty,
    unit: n.unit,
    unit_price: n.unitPrice,
    total,
    advance_pct: n.advancePct,
    credit_days: n.creditDays,
    dispatch_days: n.dispatchDays,
    freight: n.freight,
    gst_pct: gst,
    eway_bill: interState && total * (1 + gst / 100) > 50000,
    status: 'confirmed',
    status_before_dispute: null,
    qty_done: 0,
    dispatch: null,
    note: n.note ?? null,
    ...(n.sizes ? { sizes: n.sizes } : {}),
    created_at: at,
    updated_at: at,
  };
  await insert('orders', order);
  await insert('order_events', { id: id('ev_'), order_id: order.id, type: 'confirmed', payload: { offerId: n.offerId }, actor_user_id: n.actorUserId, at });
  if (n.requirementId) await update('requirements', n.requirementId, { status: 'ordered' }).catch(() => undefined);
  await update('conversations', n.conv.id, { updated_at: at, last_at: at, last_text: order.code });

  await postOrderCard(order);
  await systemBoth(order, (lang) => tr(lang, 'order_created', { code: order.code, title: order.title, qty: `${num(order.qty)} ${unitOf(lang, order.unit)}`, price: inr(order.unit_price), total: inr(order.total) }));

  if (order.total > 500000) {
    const langs = [names.get(buyerId)?.language, names.get(sellerId)?.language].filter(Boolean) as string[];
    const t = await createTicket({ type: 'concierge', trigger: 'high_value', businessIds: [buyerId, sellerId], languages: langs, orderId: order.id, conversationId: n.conv.id, description: `New order ${order.code} worth ${inr(order.total)}.` }).catch((err) => {
      console.warn('[deals] concierge ticket failed', (err as Error).message);
      return null;
    });
    if (t) await noticeAll(n.conv, (lang) => tr(lang, 'concierge', { code: order.code }));
  }
  return order;
}

const FLOW: OrderStatus[] = ['confirmed', 'advance_paid', 'in_production', 'dispatched', 'delivered', 'balance_paid', 'closed'];
const EVENT_STATUS: Partial<Record<OrderEventType, OrderStatus>> = {
  advance_paid: 'advance_paid', in_production: 'in_production', dispatched: 'dispatched', delivered: 'delivered', balance_paid: 'closed',
};
const BUYER_EVENTS = new Set<OrderEventType>(['advance_paid', 'delivered', 'balance_paid']);
const SELLER_EVENTS = new Set<OrderEventType>(['payment_confirmed', 'in_production', 'dispatched']);


function ratingQuestions(direction: 'buyer_to_seller' | 'seller_to_buyer', lang: string, auto: Record<string, number>) {
  const ids = direction === 'buyer_to_seller' ? ['quality', 'value', 'on_time', 'communication'] : ['paid_on_time', 'clarity', 'fair_returns'];
  return ids.map((q) => ({ id: q, label: tr(lang, `q_${q}`), ...(auto[q] ? { auto: auto[q] } : {}) }));
}

async function postRatingCard(order: OrderDoc, direction: 'buyer_to_seller' | 'seller_to_buyer') {
  if (!order.conversation_id) return;
  const conv = await byId<ConversationDoc>('conversations', order.conversation_id);
  if (!conv) return;
  const raterBiz = direction === 'buyer_to_seller' ? order.buyer_business_id : order.seller_business_id;
  const rateeBiz = direction === 'buyer_to_seller' ? order.seller_business_id : order.buyer_business_id;
  const [raters, ratee] = await Promise.all([ownerUsers(raterBiz), getBiz(rateeBiz)]);
  const auto: Record<string, number> = {};
  if (direction === 'buyer_to_seller' && order.dispatched_at) {
    auto.on_time = order.dispatched_at - order.created_at <= ((order.dispatch_days ?? 5) + 1) * DAY ? 5 : 3;
  }
  if (direction === 'seller_to_buyer' && order.paid_at) {
    const late = order.paid_at - (order.balance_due_at ?? order.paid_at);
    auto.paid_on_time = late <= DAY ? 5 : late <= 7 * DAY ? 3 : 2;
  }
  await targeted(conv.channel_id, raters, CC_CARD, (lang) => ({ kind: 'rating', orderId: order.id, direction, rateeName: ratee.name, questions: ratingQuestions(direction, lang, auto) } satisfies CardPayload));
}

export async function orderEvent(user: UserRow, orderId: string, type: OrderEventType, payload: Record<string, any> = {}) {
  const order = await byId<OrderDoc>('orders', orderId);
  if (!order) throw new HttpError(404, 'Order not found');
  const isBuyer = user.business_id === order.buyer_business_id;
  const isSeller = user.business_id === order.seller_business_id;
  const isAgent = ['agent', 'supervisor'].includes(user.role);
  if (!isBuyer && !isSeller && !isAgent) throw new HttpError(403, 'This is not your order.');
  if (!isAgent && BUYER_EVENTS.has(type) && !isBuyer) throw new HttpError(403, 'Only the buyer can mark this.');
  if (!isAgent && SELLER_EVENTS.has(type) && !isSeller) throw new HttpError(403, 'Only the seller can mark this.');
  if (order.status === 'cancelled') throw new HttpError(409, 'This order was cancelled.');

  const at = now();
  const current: OrderStatus = order.status === 'disputed' ? order.status_before_dispute ?? 'delivered' : order.status;
  const set: Partial<OrderDoc> = { updated_at: at };
  if (type === 'advance_paid' && order.advance_paid_at) throw new HttpError(409, 'The advance is already marked as paid.');
  // The seller may start production before the advance lands; the payment is still recorded.
  const lateAdvance = type === 'advance_paid' && FLOW.indexOf(current) > FLOW.indexOf('advance_paid');
  const target = lateAdvance ? undefined : EVENT_STATUS[type];
  if (target) {
    const from = FLOW.indexOf(current);
    const to = FLOW.indexOf(target);
    if (to < from || (to === from && type !== 'in_production')) throw new HttpError(409, `This order is already ${current.replace(/_/g, ' ')}.`);
    if (order.status === 'disputed') set.status_before_dispute = target;
    else set.status = target;
  }

  let ticketCode: string | null = null;
  switch (type) {
    case 'advance_paid':
      set.advance_paid_at = at;
      break;
    case 'payment_confirmed':
      if (order.paid_at && !order.balance_confirmed_at) set.balance_confirmed_at = at;
      else if (order.advance_paid_at && !order.advance_confirmed_at) set.advance_confirmed_at = at;
      else throw new HttpError(409, 'There is no payment waiting for confirmation.');
      break;
    case 'in_production':
      set.production_at = order.production_at ?? at;
      if (payload.qtyDone != null) set.qty_done = Math.min(order.qty, Math.max(0, Number(payload.qtyDone) || 0));
      break;
    case 'dispatched': {
      const d = { transporter: payload.transporter ? String(payload.transporter).slice(0, 60) : undefined, lr: payload.lr ? String(payload.lr).slice(0, 40) : undefined, bundles: payload.bundles != null ? Number(payload.bundles) || undefined : undefined };
      set.dispatch = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
      set.dispatched_at = at;
      if (order.kind === 'job_work') set.qty_done = order.qty;
      break;
    }
    case 'delivered':
      set.delivered_at = at;
      set.balance_due_at = at + (order.credit_days ?? 0) * DAY;
      // Fully prepaid (samples, 100% advance): nothing is left to pay, so delivery closes the order.
      if (order.advance_paid_at && balanceAmount(order) === 0) {
        if (order.status === 'disputed') set.status_before_dispute = 'closed';
        else set.status = 'closed';
        set.paid_at = at;
        set.closed_at = at;
        set.balance_confirmed_at = at;
      }
      break;
    case 'balance_paid':
      set.paid_at = at;
      set.closed_at = at;
      if (!order.delivered_at) {
        set.delivered_at = at;
        set.balance_due_at = order.balance_due_at ?? at;
      }
      break;
    case 'problem': {
      if (order.status !== 'disputed') {
        set.status = 'disputed';
        set.status_before_dispute = current;
      }
      const conv = order.conversation_id ? await byId<ConversationDoc>('conversations', order.conversation_id) : null;
      const names = await bizNames([order.buyer_business_id, order.seller_business_id]);
      const reason = [payload.reason, payload.note ?? payload.text].filter(Boolean).join(': ');
      const t = await createTicket({
        type: 'quality_dispute', trigger: 'problem_report', priority: 'P2', requesterUserId: user.id, businessIds: [order.buyer_business_id, order.seller_business_id],
        languages: [user.language, names.get(order.buyer_business_id)?.language, names.get(order.seller_business_id)?.language].filter(Boolean) as string[],
        orderId: order.id, conversationId: conv?.id, description: reason || 'Problem reported on delivery',
      });
      ticketCode = t.code;
      break;
    }
    default:
      throw new HttpError(400, 'Unknown order event.');
  }

  await update('orders', order.id, set);
  await insert('order_events', { id: id('ev_'), order_id: order.id, type, payload, actor_user_id: user.id, at });
  const fresh = { ...order, ...set } as OrderDoc;
  for (const b of [order.buyer_business_id, order.seller_business_id]) invalidateTrust(b);
  const orderConv = order.conversation_id ? await byId<ConversationDoc>('conversations', order.conversation_id) : null;
  if (orderConv) await noteActivity(orderConv, isBuyer ? 'buyer' : isSeller ? 'seller' : null, `${order.code} · ${String(fresh.status).replace(/_/g, ' ')}`);

  await postOrderCard(fresh);
  const names = await bizNames([order.buyer_business_id, order.seller_business_id]);
  const buyer = names.get(order.buyer_business_id)?.name ?? '';
  const seller = names.get(order.seller_business_id)?.name ?? '';
  await systemBoth(order, (lang) => {
    const v = { code: order.code, buyer, seller };
    switch (type) {
      case 'advance_paid': return tr(lang, 'advance_paid', { ...v, amount: inr(advanceAmount(order)) });
      case 'payment_confirmed': return tr(lang, 'payment_confirmed', { ...v, amount: inr(set.balance_confirmed_at ? balanceAmount(fresh) : advanceAmount(order)) });
      case 'in_production': return set.qty_done != null && order.kind === 'job_work'
        ? tr(lang, 'progress', { ...v, done: num(set.qty_done), qty: num(order.qty) })
        : tr(lang, 'in_production', v);
      case 'dispatched': {
        const d = fresh.dispatch ?? {};
        const via = [d.transporter, d.lr ? `LR ${d.lr}` : null, d.bundles ? `${d.bundles} ${bundlesWord(lang)}` : null].filter(Boolean).join(', ');
        return tr(lang, 'dispatched', { ...v, via: via ? ` · ${via}` : '' });
      }
      case 'delivered': return fresh.closed_at ? tr(lang, 'delivered_closed', v) : tr(lang, 'delivered', { ...v, amount: inr(balanceAmount(fresh)), date: fmtDate(fresh.balance_due_at ?? at) });
      case 'balance_paid': return tr(lang, 'balance_paid', { ...v, amount: inr(balanceAmount(order)) });
      case 'problem': return tr(lang, 'problem', { ...v, ticket: ticketCode ?? '' });
      default: return '';
    }
  });

  if (type === 'delivered') await postRatingCard(fresh, 'buyer_to_seller');
  if (type === 'balance_paid' || (type === 'delivered' && fresh.closed_at)) await postRatingCard(fresh, 'seller_to_buyer');
  return { order: strip(fresh), ticketCode };
}

export async function myOrders(user: UserRow) {
  const bizId = requireBusiness(user);
  const rows = await find<OrderDoc>('orders', { $or: [{ buyer_business_id: bizId }, { seller_business_id: bizId }] }, { sort: { created_at: -1 }, limit: 100 });
  const names = await bizNames(rows.flatMap((o) => [o.buyer_business_id, o.seller_business_id]));
  return rows.map((o) => {
    const side = o.buyer_business_id === bizId ? 'buyer' : 'seller';
    const other = side === 'buyer' ? o.seller_business_id : o.buyer_business_id;
    return {
      ...strip(o), side, counterpart: { id: other, name: names.get(other)?.name ?? '' }, conversationId: o.conversation_id ?? null,
      card: orderCard(o, names.get(o.buyer_business_id)?.name ?? '', names.get(o.seller_business_id)?.name ?? ''),
    };
  });
}

export async function orderDetail(user: UserRow, orderId: string) {
  const o = await byId<OrderDoc>('orders', orderId);
  if (!o) throw new HttpError(404, 'Order not found');
  const allowed = user.business_id === o.buyer_business_id || user.business_id === o.seller_business_id || ['agent', 'supervisor'].includes(user.role);
  if (!allowed) throw new HttpError(403, 'This is not your order.');
  const [names, events, ratings] = await Promise.all([
    bizNames([o.buyer_business_id, o.seller_business_id]),
    find('order_events', { order_id: o.id }, { sort: { at: 1 } }),
    find('ratings', { order_id: o.id }),
  ]);
  const revealed = ratings.length >= 2 || ratings.some((r) => r.revealed_at);
  return {
    order: strip(o),
    card: orderCard(o, names.get(o.buyer_business_id)?.name ?? '', names.get(o.seller_business_id)?.name ?? ''),
    events: events.map(strip),
    ratings: ratings.map((r) => (revealed || r.rater_business_id === user.business_id ? strip(r) : { direction: r.direction, rated: true })),
  };
}

// ── Ratings ───────────────────────────────────────────────────────────────
export async function rateOrder(user: UserRow, input: { orderId: string; scores: Record<string, number>; wouldRepeat: boolean; comment?: string }) {
  const bizId = requireBusiness(user);
  const order = await byId<OrderDoc>('orders', input.orderId);
  if (!order) throw new HttpError(404, 'Order not found');
  const direction = bizId === order.buyer_business_id ? 'buyer_to_seller' : bizId === order.seller_business_id ? 'seller_to_buyer' : null;
  if (!direction) throw new HttpError(403, 'This is not your order.');
  if (direction === 'buyer_to_seller' && !order.delivered_at) throw new HttpError(409, 'You can rate after delivery.');
  if (direction === 'seller_to_buyer' && !order.paid_at && !order.delivered_at) throw new HttpError(409, 'You can rate after delivery.');
  const allowed = direction === 'buyer_to_seller' ? ['quality', 'value', 'on_time', 'communication'] : ['paid_on_time', 'clarity', 'fair_returns'];
  const scores = Object.fromEntries(
    Object.entries(input.scores ?? {}).filter(([k, v]) => allowed.includes(k) && Number.isFinite(Number(v))).map(([k, v]) => [k, Math.min(5, Math.max(1, Math.round(Number(v))))]),
  );
  if (!Object.keys(scores).length) throw new HttpError(400, 'Please give at least one star rating.');
  const rateeId = direction === 'buyer_to_seller' ? order.seller_business_id : order.buyer_business_id;
  const ratingId = `r_${order.id}_${direction === 'buyer_to_seller' ? 'b' : 's'}`;
  const at = now();
  try {
    await insert('ratings', {
      id: ratingId, order_id: order.id, rater_business_id: bizId, ratee_business_id: rateeId, rater_user_id: user.id, direction, scores,
      would_repeat: input.wouldRepeat ? 1 : 0, comment: input.comment?.slice(0, 500) ?? null, revealed_at: null, created_at: at,
    });
  } catch (err: any) {
    if (err?.code === 11000) throw new HttpError(409, 'You have already rated this order.');
    throw err;
  }
  await insert('order_events', { id: id('ev_'), order_id: order.id, type: 'rated', payload: { direction }, actor_user_id: user.id, at });
  const both = await find('ratings', { order_id: order.id });
  if (both.length >= 2) {
    await col('ratings').updateMany({ order_id: order.id, revealed_at: null } as any, { $set: { revealed_at: at } });
    const conv = order.conversation_id ? await byId<ConversationDoc>('conversations', order.conversation_id) : null;
    if (conv) await noticeAll(conv, (lang) => tr(lang, 'rated_both', { code: order.code }), 'success');
  }
  invalidateTrust(order.buyer_business_id);
  invalidateTrust(order.seller_business_id);
  return { rating: strip(await byId('ratings', ratingId)), revealed: both.length >= 2, trust: await trustOf(rateeId) };
}

// ── Samples ───────────────────────────────────────────────────────────────
export async function requestSample(user: UserRow, input: { conversationId: string; listingId?: string; sizes: string[] | string; note?: string }) {
  const conv = await getConversation(input.conversationId);
  const side = assertMember(conv, user);
  if (side !== 'buyer') throw new HttpError(403, 'Only the buyer can request a sample.');
  const { requirement, listing: found } = await defaultsFor(conv, input.listingId);
  const listing = found ?? (await findOne('listings', { business_id: conv.seller_business_id, active: 1 }, { sort: { stock_qty: -1 } }));
  if (!listing) throw new HttpError(404, 'This seller has no products to sample yet.');
  const sizes = (Array.isArray(input.sizes) ? input.sizes : String(input.sizes ?? '').split(/[\s,]+/)).map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
  const qty = Math.max(1, sizes.length || 3);
  const order = await createOrder({
    kind: 'sample', conv, offerId: null, listingId: listing.id, requirementId: requirement?.id ?? conv.requirement_id, category: listing.category,
    title: listing.title, qty, unit: listing.unit === 'dozen' ? 'piece' : listing.unit, unitPrice: listing.unit === 'dozen' ? Math.round(listing.price / 12) : listing.price,
    advancePct: 100, creditDays: 0, dispatchDays: Math.min(3, listing.lead_days ?? 3), freight: 'extra', actorUserId: user.id, note: input.note?.slice(0, 300) ?? null, sizes,
  });
  await noticeAll(conv, (lang) => tr(lang, 'sample', { title: listing.title, sizes: sizes.join(', ') || '—', note: input.note ? ` · ${input.note.slice(0, 120)}` : '' }));
  return { order: strip(order) };
}

// ── Job-work split offers ─────────────────────────────────────────────────
export async function sendJobOffers(user: UserRow, requirementId: string, lines: MatchLine[]) {
  const req = await byId('requirements', requirementId);
  if (!req) throw new HttpError(404, 'Requirement not found');
  if (req.buyer_business_id && req.buyer_business_id !== user.business_id) throw new HttpError(403, 'This requirement belongs to another business.');
  const out: { conversation: ReturnType<typeof convOut>; offer: OfferDoc }[] = [];
  for (const line of lines) {
    const conv = await openDeal(user, { sellerBusinessId: line.businessId, requirementId, allocation: { qty: line.qty, unitPrice: line.unitPrice, readyDays: line.readyDays, mode: 'job' } });
    const listing = line.listingId ? await byId('listings', line.listingId) : null;
    const garment = req.attrs?.garment ?? (catById(req.category)?.type === 'service' ? 'garments' : catById(req.category)?.names.en);
    const offer = await createOffer(user, {
      conversationId: conv.id, qty: line.qty, unitPrice: line.unitPrice, dispatchDays: line.readyDays ?? req.deadline_days ?? 10,
      advancePct: 0, creditDays: 7, freight: 'paid', listingId: line.listingId, kind: 'job_work',
      title: `Job work · ${(listing?.title ?? reqTitle(req)).replace(/\s*\(job work\)/i, '')}${garment && !listing ? ` (${garment})` : ''} · material provided`,
    });
    out.push({ conversation: convOut(await getConversation(conv.id)), offer });
  }
  await update('requirements', requirementId, { status: 'offered' }).catch(() => undefined);
  return out;
}

// ── Inbound deal messages (client notify / webhook) ────────────────────────
const PRICE_CUE = /(₹|rs\.?|rupe|rupay|रुपय|रुपए|रुपये|rate|price|दाम|रेट|भाव|kar\s*do|kardo|कर\s*दो|में|mein|\bme\b|per\s*(pc|piece|pcs)|\/\s*pc|\bku\b|க்கு|விலை|ரூபாய்|ரேட்|final|best|last)/i;
const QTY_AFTER = /^\s*(pcs?\b|pieces?|पीस|பீஸ்|kg|किलो|கிலோ|dozen|दर्जन|டஜன்|days?|din\b|दिन|நாள்|gsm|%|percent|प्रतिशत|sets?\b|bundles?|machines?|मशीन)/i;
const ANGRY = /(fraud|cheat|scam|thief|\bchor\b|चोर|धोखा|धोखेबाज|फ्रॉड|बेईमान|police|पुलिस|court|legal action|ஏமாற்|மோசடி|திருட|போலீஸ்|worst|useless|bakwas|बकवास|never again|money back|पैसे वापस|refund now)/i;

/** Finds a per-piece price mentioned in free text (₹ or a number 10–5000 next to a price word). */
export function detectPrice(text: string): number | null {
  for (const m of text.matchAll(/(₹\s*)?(\d[\d,]*(?:\.\d+)?)/g)) {
    const n = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 10 || n > 5000) continue;
    const idx = m.index ?? 0;
    const after = text.slice(idx + m[0].length, idx + m[0].length + 16);
    const before = text.slice(Math.max(0, idx - 14), idx);
    if (QTY_AFTER.test(after)) continue;
    if (m[1] || PRICE_CUE.test(before) || PRICE_CUE.test(after.slice(0, 12))) return n;
  }
  return null;
}

export async function handleInbound(conversationId: string, senderUserId: string, input: { text: string; lang?: string; messageId?: string }) {
  const text = (input.text ?? '').trim();
  if (!text) return { ok: true };
  // The production webhook may deliver the same message: whoever claims it first handles it.
  if (input.messageId && !(await claim(`msg:${input.messageId}`))) return { ok: true, deduped: true };
  void bump('messages');
  const conv = await getConversation(conversationId);
  const sender = await byId<UserRow>('users', senderUserId);
  if (!sender) throw new HttpError(404, 'User not found');
  const side = assertMember(conv, sender);
  await noteActivity(conv, side, text);
  const at = now();

  // Agent's first message counts as the ticket's first response.
  if (side === 'agent') {
    await col('tickets').updateOne({ conversation_id: conv.id, status: { $in: OPEN_STATUSES }, first_response_at: null } as any, { $set: { first_response_at: at, updated_at: at } });
    return { ok: true };
  }
  const result: { ok: true; price?: number; ticket?: string } = { ok: true };
  if (conv.kind === 'support') return result;
  // Goods conversations (supply-chain, docs/supply-chain/04 §8.1): no auto-reply, price tips or sentiment desk.
  if ((conv.kind as string) === 'goods') return result;

  // 1. Angry / fraud language → human dispute desk.
  if (ANGRY.test(text) && !conv.agent_user_id) {
    const langs = (await find('businesses', { _id: { $in: conv.business_ids } }, { projection: { language: 1 } })).map((b) => b.language as string);
    const openOrder = await findOne('orders', { conversation_id: conv.id, status: { $nin: ['closed', 'cancelled'] } }, { sort: { created_at: -1 } });
    const t = await createTicket({
      type: 'dispute', trigger: 'sentiment', priority: 'P2', requesterUserId: sender.id, businessIds: conv.business_ids,
      languages: [input.lang || sender.language, ...langs].filter(Boolean), conversationId: conv.id, orderId: openOrder?.id, description: text.slice(0, 500),
    });
    result.ticket = t.code;
    await safe('desk hint', chat.group(conv.channel_id, BOT.claire, CC_HINT, { text: tr(sender.language, 'desk_called', { ticket: t.code }) } satisfies HintPayload, { onlyTo: [sender.id] }));
  }

  // 2. A price in the message → one-tap counter-offer / offer for the sender only.
  const price = detectPrice(text);
  if (price && (side === 'buyer' || side === 'seller')) {
    result.price = price;
    const pending = await findOne<OfferDoc>('offers', { conversation_id: conv.id, to_business_id: sender.business_id, status: 'pending' }, { sort: { created_at: -1 } });
    if (!pending || pending.unit_price !== price) {
      const lang = sender.language || 'en';
      const hint: HintPayload = pending
        ? { text: tr(lang, 'counter_hint', { price: inr(price) }), action: { label: tr(lang, 'counter_label', { price: inr(price) }), chipId: `counter:${price}` } }
        : { text: await buyerOfferHint(conv, side, lang, price), action: { label: tr(lang, 'offer_label', { price: inr(price) }), chipId: `offer:${price}` } };
      await safe('price hint', chat.group(conv.channel_id, BOT.claire, CC_HINT, hint, { onlyTo: [sender.id] }));
    }
  }

  // 3. Seller in Auto mode, no human on the chat → Claire answers after a short wait.
  if (side === 'buyer' && conv.seller_business_id && !conv.agent_user_id) {
    const seller = await getBiz(conv.seller_business_id);
    if (seller.auto_reply === 'auto') {
      const prev = autoTimers.get(conv.id);
      if (prev) clearTimeout(prev);
      const timer = setTimeout(() => {
        autoTimers.delete(conv.id);
        void autoReply(conv.id, sender, text, at).catch((err) => console.warn('[deals] auto-reply failed', (err as Error).message));
      }, AUTO_REPLY_DELAY_MS);
      timer.unref?.();
      autoTimers.set(conv.id, timer);
    }
  }
  return result;
}

async function autoReply(convId: string, buyerUser: UserRow, buyerText: string, buyerAt: number) {
  const conv = await byId<ConversationDoc>('conversations', convId);
  if (!conv || conv.agent_user_id || !conv.seller_business_id) return;
  if ((conv.last_seller_msg_at ?? 0) > buyerAt) return; // the seller answered in time
  if ((conv.last_auto_reply_at ?? 0) > now() - 3 * 60_000) return; // at most one auto-reply every 3 min
  const seller = await getBiz(conv.seller_business_id);
  if (seller.auto_reply !== 'auto') return;
  const sellerUsers = await ownerUsers(seller.id);
  const sellerUser = sellerUsers[0];
  if (!sellerUser) return;
  const listings = await find('listings', { business_id: seller.id, active: 1 }, { sort: { stock_qty: -1 }, limit: 12 });
  const requirement = conv.requirement_id ? await byId('requirements', conv.requirement_id) : null;
  const focus = (requirement?.category && listings.find((l) => l.category === requirement.category)) || listings[0];
  const lang = buyerUser.language || 'en';

  const ai = await draftSellerReply({
    sellerName: seller.name,
    language: lang,
    buyerMessage: buyerText,
    listings: listings.map((l) => ({ title: l.title, price: l.price, unit: l.unit, moq: l.moq, stock: l.stock_qty, leadDays: l.lead_days, floorPrice: l.floor_price })),
    floorNote: `Floor prices (never go below): ${listings.map((l) => `${l.title} ₹${l.floor_price}`).join('; ')}.`,
  }).catch(() => null);
  let reply = ai?.reply?.trim();
  if (!reply && focus) {
    reply = tr(lang, 'auto_fallback', {
      title: focus.title, price: inr(focus.price), unit: unitOf(lang, focus.unit).replace(/s$/, ''), moq: `${num(focus.moq)} ${unitOf(lang, focus.unit)}`,
      stock: focus.stock_qty ? tr(lang, 'auto_stock', { stock: num(focus.stock_qty) }) : '',
    });
  }
  if (!reply) return;
  // Re-check: the seller may have replied while the model was thinking.
  const latest = await byId<ConversationDoc>('conversations', convId);
  if (!latest || latest.agent_user_id || (latest.last_seller_msg_at ?? 0) > buyerAt) return;

  await safe('auto reply', chat.group(conv.channel_id, sellerUser.id, 'RC:TxtMsg', { content: reply, extra: 'auto' }));
  await safe('auto label', chat.group(conv.channel_id, BOT.claire, CC_CARD, { kind: 'notice', tone: 'info', text: tr(lang, 'auto_label', { seller: seller.name }) } satisfies CardPayload));
  const at = now();
  await update('conversations', convId, { last_auto_reply_at: at, last_at: at, last_text: reply.slice(0, 140), updated_at: at });
}

// ── Inbox & conversation detail ───────────────────────────────────────────
const DESK_COUNTERPART = { id: BOT.desk, name: 'CLAIRE Trade Desk', accent: '#0D9488', city: null, trust: null, language: 'en' };

export async function inbox(user: UserRow) {
  const filter = user.business_id ? { $or: [{ business_ids: user.business_id }, { user_ids: user.id }] } : { user_ids: user.id };
  const convs = await find<ConversationDoc>('conversations', filter, { sort: { last_at: -1, updated_at: -1 }, limit: 200 });
  const otherIds = [...new Set(convs.flatMap((c) => c.business_ids.filter((b) => b !== user.business_id)))];
  const businesses = await find('businesses', { _id: { $in: otherIds } }, { projection: { name: 1, accent: 1, city: 1, language: 1 } });
  const trusts = new Map(await Promise.all(otherIds.map(async (b) => [b, (await trustOf(b)).score] as const)));
  // Chats with an offer still waiting for an answer (the inbox "Offers" filter).
  const pendingOffers = await find<OfferDoc>('offers', { conversation_id: { $in: convs.map((c) => c.id) }, status: 'pending' }, { projection: { conversation_id: 1 } });
  const withOffer = new Set(pendingOffers.map((o) => o.conversation_id));
  const bmap = new Map(businesses.map((b) => [b._id as string, b]));
  // Inbox row extras: what the deal is about (product strip) and where it stands (status pill).
  const convIds = convs.map((c) => c.id);
  const [allOffers, allOrders, reqs] = await Promise.all([
    find<OfferDoc>('offers', { conversation_id: { $in: convIds } }, { sort: { created_at: -1 }, projection: { id: 1, conversation_id: 1, title: 1, qty: 1, unit: 1, unit_price: 1, status: 1, from_business_id: 1, listing_id: 1, category: 1, parent_id: 1, created_at: 1 } }),
    find<OrderDoc>('orders', { conversation_id: { $in: convIds } }, { sort: { created_at: -1 }, projection: { id: 1, conversation_id: 1, code: 1, title: 1, qty: 1, unit: 1, unit_price: 1, status: 1, listing_id: 1, category: 1, created_at: 1 } }),
    find('requirements', { _id: { $in: [...new Set(convs.map((c) => c.requirement_id).filter(Boolean))] } }, { projection: { title: 1, category: 1, qty: 1, unit: 1, listing_id: 1, attrs: 1 } }),
  ]);
  const latestOffer = new Map<string, OfferDoc>();
  for (const o of allOffers) if (!latestOffer.has(o.conversation_id)) latestOffer.set(o.conversation_id, o);
  const latestOrder = new Map<string, OrderDoc>();
  for (const o of allOrders) if (o.conversation_id && !latestOrder.has(o.conversation_id)) latestOrder.set(o.conversation_id, o);
  const reqMap = new Map(reqs.map((r) => [r._id as string, r]));
  const listingIds = [...new Set([...allOffers.map((o) => o.listing_id), ...allOrders.map((o) => o.listing_id), ...reqs.map((r) => r.listing_id)].filter(Boolean))] as string[];
  const listings = listingIds.length ? await find('listings', { _id: { $in: listingIds } }, { projection: { art: 1, category: 1, title: 1 } }) : [];
  const listingMap = new Map(listings.map((l) => [l._id as string, l]));
  const lang = (user.language || 'en') as 'en' | 'ta' | 'hi';
  const productFor = (c: ConversationDoc) => {
    const ord = latestOrder.get(c.id);
    const off = latestOffer.get(c.id);
    const req = c.requirement_id ? reqMap.get(c.requirement_id) : null;
    const src = ord ?? off;
    const listingId = (ord?.listing_id ?? off?.listing_id ?? req?.listing_id ?? null) as string | null;
    const listing = listingId ? listingMap.get(listingId) : null;
    const category = (src?.category ?? req?.category ?? listing?.category ?? null) as string | null;
    const cat = category ? catById(category) : null;
    const title = (src?.title ?? req?.title ?? listing?.title ?? (cat ? categoryName(cat, lang, serverLocale) : null)) as string | null;
    if (!title && !cat) return null;
    const art = listing?.art ?? (cat ? { shape: cat.shape } : null);
    return { title, qty: (src?.qty ?? req?.qty ?? null) as number | null, unit: (src?.unit ?? req?.unit ?? cat?.unit ?? null) as string | null, category, art };
  };
  return convs.map((c) => {
    const otherId = c.kind === 'support' && user.business_id ? null : c.business_ids.find((b) => b !== user.business_id) ?? null;
    const b = otherId ? bmap.get(otherId) : null;
    const counterpart = b ? { id: otherId, name: b.name, accent: b.accent, city: b.city, trust: trusts.get(otherId!) ?? null, language: b.language } : DESK_COUNTERPART;
    const side = user.business_id === c.buyer_business_id ? 'buyer' : user.business_id === c.seller_business_id ? 'seller' : null;
    return {
      id: c.id, kind: c.kind, channelId: c.channel_id, title: user.business_id && c.kind !== 'support' ? counterpart.name : c.title, counterpart,
      side, lastAt: c.last_at ?? c.updated_at, lastText: c.last_text ?? null, agentUserId: c.agent_user_id ?? null, requirementId: c.requirement_id ?? null,
      pendingOffer: withOffer.has(c.id),
      product: productFor(c),
      latestOffer: (() => {
        const o = latestOffer.get(c.id);
        return o ? { id: o.id, unitPrice: o.unit_price, unit: o.unit, status: o.status, counter: o.parent_id != null, fromMe: !!user.business_id && o.from_business_id === user.business_id, at: o.created_at } : null;
      })(),
      latestOrder: (() => {
        const o = latestOrder.get(c.id);
        return o ? { id: o.id, code: o.code, status: o.status, unitPrice: o.unit_price, at: o.created_at } : null;
      })(),
    };
  });
}

export async function conversationDetail(user: UserRow, convId: string) {
  const conv = await getConversation(convId);
  const side = assertMember(conv, user);
  await ensureNexconnGroup(conv);
  const otherId = side === 'buyer' ? conv.seller_business_id : side === 'seller' ? conv.buyer_business_id : conv.business_ids.find((b) => b !== user.business_id) ?? null;
  const [counterpart, requirement, offers, orders, agentUser, agentDoc, tickets, myRatings] = await Promise.all([
    otherId && conv.kind !== 'support' ? publicBiz(otherId) : Promise.resolve(DESK_COUNTERPART),
    conv.requirement_id ? byId('requirements', conv.requirement_id) : Promise.resolve(null),
    find<OfferDoc>('offers', { conversation_id: conv.id }, { sort: { created_at: 1 } }),
    find<OrderDoc>('orders', { conversation_id: conv.id }, { sort: { created_at: 1 } }),
    conv.agent_user_id ? byId('users', conv.agent_user_id) : Promise.resolve(null),
    conv.agent_user_id ? byId('agents', conv.agent_user_id) : Promise.resolve(null),
    find('tickets', { conversation_id: conv.id, status: { $in: OPEN_STATUSES } }, { projection: { code: 1, type: 1, status: 1, priority: 1 } }),
    user.business_id ? find('ratings', { rater_business_id: user.business_id }, { projection: { order_id: 1 } }) : Promise.resolve([]),
  ]);
  const names = await bizNames(conv.business_ids);
  const orderIds = new Set(orders.map((o) => o.id));
  const nameOf = (b: string) => names.get(b)?.name ?? '';
  return {
    conversation: convOut(conv),
    counterpart,
    me: { userId: user.id, businessId: user.business_id, side, language: user.language },
    requirement: requirement ? { ...strip(requirement), title: requirement.title ?? reqTitle(requirement) } : null,
    offers: offers.map((o) => ({ ...strip(o), card: offerCard(o, nameOf(o.from_business_id)), mine: o.from_business_id === user.business_id })),
    orders: orders.map((o) => ({ ...strip(o), card: orderCard(o, nameOf(o.buyer_business_id), nameOf(o.seller_business_id)) })),
    agent: agentUser ? { id: agentUser.id, name: agentUser.name, languages: agentDoc?.languages ?? [], languageNames: (agentDoc?.languages ?? []).map(langName) } : null,
    tickets: tickets.map(strip),
    /** Orders in this chat that my business has already rated (their rating cards collapse). */
    ratedOrders: myRatings.map((r) => r.order_id as string).filter((oid) => orderIds.has(oid)),
  };
}

// ── Hint chips from deal chats (one endpoint for the client) ───────────────
/** Handles `counter:<price>`, `offer:<price>`, `quote:<price>`, `accept:<offerId>`, `decline:<offerId>`. */
export async function dealChip(user: UserRow, convId: string, chipId: string) {
  const conv = await getConversation(convId);
  assertMember(conv, user);
  const [ns, val] = chipId.split(':');
  if (ns === 'accept' || ns === 'decline') return respondOffer(user, val, ns);
  const price = Number(val);
  if (!['counter', 'offer', 'quote'].includes(ns) || !(price > 0)) throw new HttpError(400, 'Unknown action.');
  if (ns === 'counter') {
    const pending = await findOne<OfferDoc>('offers', { conversation_id: conv.id, to_business_id: user.business_id, status: 'pending' }, { sort: { created_at: -1 } });
    if (pending) return respondOffer(user, pending.id, 'counter', price);
  }
  return { offer: await createOffer(user, { conversationId: conv.id, unitPrice: price }) };
}

/** Buyer-side tip with market context: the seller's listed price and the usual settling range (never the floor price). */
async function buyerOfferHint(conv: any, side: string, lang: string, price: number): Promise<string> {
  const plain = tr(lang, 'offer_hint', { price: inr(price) });
  if (side !== 'buyer' || !conv.seller_business_id) return plain;
  try {
    const req = conv.requirement_id ? await byId('requirements', conv.requirement_id) : null;
    const filter: Record<string, unknown> = { business_id: conv.seller_business_id, active: 1 };
    if (req?.category) filter.category = req.category;
    const listing = await findOne('listings', filter, { sort: { price: 1 } });
    const listed = Number(listing?.price);
    if (!listed || price >= listed) return plain;
    const lo = Math.round(listed * 0.94);
    const hi = Math.round(listed * 0.97);
    return tr(lang, 'offer_hint_ctx', { listed: inr(listed), lo: inr(lo), hi: inr(hi), price: inr(price) });
  } catch {
    return plain;
  }
}
