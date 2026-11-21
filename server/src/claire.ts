// Claire — the assistant. One question at a time, always with tap-able answers.
// Flows are deterministic; Claude only turns free speech/text into slots.
import { col, find, findOne, insert, update } from './db/index.js';
import { chat } from './chat.js';
import { BOT } from './config.js';
import { t, unitWord } from './i18n.js';
import { understand } from './ai.js';
import { match, splitJob, marketBand } from './match.js';
import { getBiz, listingSummary, type UserRow } from './biz.js';
import { id, now, inr } from './util.js';
import { CATEGORIES, catById, categoryName } from '../../shared/taxonomy.js';
import { serverLocale } from './locales/index.js';
import { CC_CARD, type CardPayload, type Chip } from '../../shared/cards.js';
import { createTicket } from './desk.js';
import { scClaireTurn, goodsChips } from './sc/claire/turn.js';

type Out = { kind: 'text'; text: string } | CardPayload;

interface Slots {
  group?: 'garment' | 'input' | 'service';
  category?: string;
  liked?: string[];
  styleDone?: boolean;
  qty?: number;
  budget?: number | null;
  budgetDone?: boolean;
  deadlineDays?: number | null;
  timeDone?: boolean;
  city?: string | null;
  fabric?: string | null;
  gsm?: number | null;
  colours?: string[];
}

interface Session {
  intent: string | null;
  step: string | null;
  slots: Slots;
  fail: number;
}

async function load(userId: string): Promise<Session> {
  const r = await findOne('claire_sessions', { _id: userId });
  return r ? { intent: r.intent, step: r.step, slots: r.slots ?? {}, fail: r.fail_count ?? 0 } : { intent: null, step: null, slots: {}, fail: 0 };
}

async function save(userId: string, s: Session) {
  await col('claire_sessions').updateOne(
    { _id: userId } as any,
    { $set: { user_id: userId, intent: s.intent, step: s.step, slots: s.slots, fail_count: s.fail, updated_at: now() } },
    { upsert: true },
  );
}

const catName = (lang: string, catId?: string) => (catById(catId) ? categoryName(catId, lang, serverLocale) : '');

async function say(user: UserRow, outs: Out[]) {
  for (const o of outs) {
    if (o.kind === 'text') await chat.direct(BOT.claire, [user.id], 'RC:TxtMsg', { content: o.text }, { push: o.text.slice(0, 80) });
    else await chat.direct(BOT.claire, [user.id], CC_CARD, o, { push: 'Claire' });
  }
}

// ── Home ──────────────────────────────────────────────────────────────────
export async function homeCard(user: UserRow): Promise<Out[]> {
  const lang = user.language;
  const biz = user.business_id ? await getBiz(user.business_id) : null;
  const buysMore = !biz || biz.buys.length >= biz.sells.length;
  const chips: Chip[] = [
    { id: 'home:buy', label: t(lang, 'home_buy'), primary: buysMore },
    { id: 'home:fabric', label: t(lang, 'home_fabric') },
    { id: 'home:job', label: t(lang, 'home_job') },
    { id: 'home:sell', label: t(lang, 'home_sell'), primary: !buysMore },
    { id: 'home:orders', label: t(lang, 'home_orders') },
    { id: 'home:human', label: t(lang, 'home_human') },
  ];
  const first = (user.name || biz?.owner_name || '').split(' ')[0];
  const goods = await goodsChips(user);
  // Staff: goods only, no buying or selling.
  if (user.role === 'staff') return [{ kind: 'chips', text: t(lang, 'greet', { name: (user.name || '').split(' ')[0] }), hint: undefined, chips: goods, layout: 'grid' }];
  return [{ kind: 'chips', text: t(lang, 'greet', { name: first }), hint: t(lang, 'greet_sub'), chips: [...goods, ...chips], layout: 'grid' }];
}

export async function claireWelcome(user: UserRow) {
  await save(user.id, { intent: null, step: null, slots: {}, fail: 0 });
  await say(user, await homeCard(user));
}

// ── Turn handling ─────────────────────────────────────────────────────────
export async function claireTurn(user: UserRow, input: { text?: string; chipId?: string }) {
  // Goods questions and records (supply-chain flag on): answered from the user's own records, else the flow below.
  const goods = await scClaireTurn(user, input).catch((e) => { console.error('[claire] goods turn failed', e); return null; });
  if (goods) return say(user, goods as Out[]);
  if (user.role === 'staff') {
    const msg = { en: 'I can help you with goods: what came in, what is out, what is late. Buying and selling are for the owner.', ta: 'சரக்கு பற்றி உதவ முடியும்: என்ன வந்தது, என்ன வெளியே உள்ளது, என்ன தாமதம். வாங்குவதும் விற்பதும் உரிமையாளருக்கு.', hi: 'मैं माल में मदद कर सकती हूँ: क्या आया, क्या बाहर है, क्या देर है। खरीद-बिक्री मालिक के लिए है।' } as Record<string, string>;
    return say(user, [{ kind: 'text', text: msg[user.language] ?? msg.en }]);
  }
  const s = await load(user.id);
  const lang = user.language;
  const biz = user.business_id ? await getBiz(user.business_id) : null;
  if (!s.slots.city && biz?.city) s.slots.city = biz.city;

  if (input.chipId) {
    const handled = await applyChip(user, s, input.chipId);
    if (handled === 'done') return;
  } else if (input.text?.trim()) {
    const nlu = await understand(input.text, { step: s.step, slots: s.slots, language: lang });
    if (nlu.intent === 'TALK_TO_HUMAN' || nlu.sentiment === 'angry') return handoff(user, s, 'user_request', input.text);
    if (nlu.intent === 'ADD_LISTING') return sellPrompt(user, s);
    if (nlu.intent === 'ORDER_STATUS') return ordersCard(user, s);
    if (nlu.intent === 'GREETING' && !s.intent) return claireWelcome(user);

    let learned = false;
    if (nlu.category_id) {
      if (s.slots.category && s.slots.category !== nlu.category_id) s.slots = { city: s.slots.city };
      s.slots.category = nlu.category_id;
      s.intent = nlu.category_id.startsWith('service.') ? 'FIND_SERVICE' : 'BUY_PRODUCT';
      learned = true;
    } else if (nlu.intent === 'FIND_SERVICE' && !s.intent) {
      s.intent = 'FIND_SERVICE';
      learned = true;
    } else if (nlu.intent === 'BUY_PRODUCT' && !s.intent) {
      s.intent = 'BUY_PRODUCT';
      learned = true;
    }
    if (nlu.quantity) { s.slots.qty = nlu.quantity; learned = true; }
    if (nlu.budget_per_unit_inr) { s.slots.budget = nlu.budget_per_unit_inr; s.slots.budgetDone = true; learned = true; }
    if (nlu.no_budget_limit) { s.slots.budget = null; s.slots.budgetDone = true; learned = true; }
    if (nlu.deadline_days) { s.slots.deadlineDays = nlu.deadline_days; s.slots.timeDone = true; learned = true; }
    if (nlu.delivery_city) { s.slots.city = nlu.delivery_city; learned = true; }
    if (nlu.fabric) s.slots.fabric = nlu.fabric;
    if (nlu.gsm) s.slots.gsm = nlu.gsm;
    if (nlu.colours?.length) s.slots.colours = nlu.colours;
    // A rich one-sentence request skips the style question.
    if (learned && s.slots.qty && s.slots.budgetDone) s.slots.styleDone = true;

    if (!learned) {
      s.fail += 1;
      if (s.fail >= 2) return handoff(user, s, 'nlu_fail', input.text);
      await save(user.id, s);
      const again = s.intent ? await nextStep(user, s, true) : await homeCard(user);
      return say(user, [{ kind: 'text', text: t(lang, 'not_understood') }, ...again]);
    }
    s.fail = 0;
  }

  if (!s.intent) {
    await save(user.id, s);
    return say(user, await homeCard(user));
  }
  const outs = await nextStep(user, s, false);
  await save(user.id, s);
  await say(user, outs);
}

async function applyChip(user: UserRow, s: Session, chipId: string): Promise<'done' | 'continue'> {
  const [ns, val, extra] = chipId.split(':');
  const lang = user.language;
  switch (ns) {
    case 'home':
      if (val === 'buy') { s.intent = 'BUY_PRODUCT'; s.slots = { city: s.slots.city, group: 'garment' }; }
      if (val === 'fabric') { s.intent = 'BUY_PRODUCT'; s.slots = { city: s.slots.city, group: 'input' }; }
      if (val === 'job') { s.intent = 'FIND_SERVICE'; s.slots = { city: s.slots.city, group: 'service' }; }
      if (val === 'sell') { await sellPrompt(user, s); return 'done'; }
      if (val === 'orders') { await ordersCard(user, s); return 'done'; }
      if (val === 'human') { await handoff(user, s, 'user_request', 'Asked to talk to a person'); return 'done'; }
      s.fail = 0;
      return 'continue';
    case 'cat':
      s.slots = { city: s.slots.city, group: s.slots.group, category: val };
      s.intent = val.startsWith('service.') ? 'FIND_SERVICE' : 'BUY_PRODUCT';
      return 'continue';
    case 'style':
      s.slots.styleDone = true;
      s.slots.liked = val === 'done' && extra ? extra.split(',').filter(Boolean) : [];
      return 'continue';
    case 'qty':
      s.slots.qty = Number(val);
      return 'continue';
    case 'budget':
      s.slots.budgetDone = true;
      s.slots.budget = val === 'none' ? null : Number(val);
      return 'continue';
    case 'time':
      s.slots.timeDone = true;
      s.slots.deadlineDays = val === 'flex' ? null : Number(val);
      return 'continue';
    case 'refine':
      if (val === 'budget') { s.slots.budgetDone = false; s.slots.budget = undefined; }
      if (val === 'qty') { s.slots.qty = undefined; }
      return 'continue';
    case 'restart':
      await claireWelcome(user);
      return 'done';
    default:
      await say(user, await homeCard(user));
      void lang;
      return 'done';
  }
}

// ── The buy / service flow ────────────────────────────────────────────────
async function nextStep(user: UserRow, s: Session, reask: boolean): Promise<Out[]> {
  const lang = user.language;
  const sl = s.slots;
  const isService = s.intent === 'FIND_SERVICE';
  void reask;

  if (!sl.category) {
    s.step = 'category';
    const group = isService ? 'service' : sl.group === 'input' ? ['fabric', 'yarn'] : 'garment';
    const cats = CATEGORIES.filter((c) => (Array.isArray(group) ? group.includes(c.group) : c.group === group));
    return [{
      kind: 'tiles', text: isService ? t(lang, 'job_title') : t(lang, 'ask_category'),
      tiles: cats.map((c) => ({ id: `cat:${c.id}`, label: catName(lang, c.id), shape: c.shape, color: tileColor(c.id) })),
    }];
  }
  const cat = catById(sl.category)!;

  if (!sl.styleDone && cat.group === 'garment') {
    s.step = 'style';
    const rows = await col('listings').aggregate([
      { $match: { active: 1, category: cat.id, business_id: { $ne: user.business_id ?? '' } } },
      { $sort: { stock_qty: -1 } }, { $limit: 10 },
      { $lookup: { from: 'businesses', localField: 'business_id', foreignField: '_id', as: 'b' } },
      { $addFields: { business_name: { $first: '$b.name' } } },
    ]).toArray();
    if (rows.length >= 2) {
      return [{
        kind: 'carousel', text: t(lang, 'ask_style', { cat: catName(lang, cat.id) }), items: await Promise.all(rows.map((r) => listingSummary(r))), selectable: true,
        doneChip: { id: 'style:done', label: t(lang, 'style_done'), primary: true }, extraChips: [{ id: 'style:any', label: t(lang, 'style_any') }],
      }];
    }
    sl.styleDone = true;
  }

  if (!sl.qty) {
    s.step = 'quantity';
    const unit = cat.unit;
    const opts = unit === 'kg' ? [100, 300, 500, 1000] : unit === 'dozen' ? [20, 50, 100, 250] : isService ? [1000, 2000, 5000, 10000] : [300, 500, 1000, 2000, 5000];
    const setObj = ((await findOne('listings', { category: cat.id, size_set: { $ne: null } }))?.size_set ?? null) as Record<string, number> | null;
    const setText = setObj ? Object.entries(setObj).map(([k, v]) => `${k}:${v}`).join(' ') : '';
    return [{
      kind: 'chips', text: t(lang, 'ask_qty', { unit: unitWord(lang, unit) }), hint: setObj && !isService ? t(lang, 'ask_qty_hint', { set: setText }) : undefined,
      chips: opts.map((n) => ({ id: `qty:${n}`, label: n.toLocaleString('en-IN') })),
    }];
  }

  if (!sl.budgetDone) {
    s.step = 'budget';
    const band = await marketBand(cat.id);
    const u1 = unitWord(lang, cat.unit, false);
    const picks = band ? [...new Set([band.p25, band.median, band.p75].map((x) => (x < 50 ? Math.round(x) : Math.round(x / 5) * 5)))] : [];
    return [{
      kind: 'chips', text: t(lang, 'ask_budget', { unit1: u1 }),
      hint: band ? t(lang, 'ask_budget_hint', { lo: inr(band.min), hi: inr(band.max) }) : undefined,
      chips: [...picks.map((p) => ({ id: `budget:${p}`, label: inr(p) })), { id: 'budget:none', label: t(lang, 'no_limit') }],
    }];
  }

  if (!sl.timeDone) {
    s.step = 'timing';
    return [{
      kind: 'chips', text: t(lang, 'ask_time', { city: sl.city || 'your city' }),
      chips: [
        { id: 'time:7', label: t(lang, 't_week') }, { id: 'time:14', label: t(lang, 't_2w') }, { id: 'time:30', label: t(lang, 't_month') }, { id: 'time:flex', label: t(lang, 't_flex') },
      ],
    }];
  }

  // Results
  s.step = 'results';
  const reqId = id('rq_');
  await insert('requirements', {
    id: reqId, buyer_business_id: user.business_id ?? 'unknown', type: cat.type, category: cat.id,
    attrs: { fabric: sl.fabric ?? null, gsm: sl.gsm ?? null, colours: sl.colours ?? [] }, liked: sl.liked ?? [], qty: sl.qty, unit: cat.unit,
    budget: sl.budget ?? null, deadline_days: sl.deadlineDays ?? null, city: sl.city ?? null, status: 'matched', created_at: now(),
  });
  const qtyText = `${sl.qty.toLocaleString('en-IN')} ${unitWord(lang, cat.unit)}`;
  const title = t(lang, 'results_title', { qty: qtyText, cat: catName(lang, cat.id), budget: sl.budget ? inr(sl.budget) : t(lang, 'no_limit'), city: sl.city || '—' });
  const need = {
    category: cat.id, qty: sl.qty, unit: cat.unit, budget: sl.budget ?? null, deadlineDays: sl.deadlineDays ?? null, city: sl.city ?? null,
    attrs: { fabric: sl.fabric, gsm: sl.gsm, colours: sl.colours }, liked: sl.liked, excludeBusinessId: user.business_id ?? undefined,
  };

  if (isService) {
    const split = await splitJob(need);
    const single = split.lines.length === 1;
    const out: Out[] = [{ kind: 'summary', title: t(lang, 'summary_title'), lines: [title] }];
    if (!split.lines.length) out.push({ kind: 'text', text: t(lang, 'results_none') });
    else out.push({
      kind: 'job_split', requirementId: reqId,
      title: single ? title : t(lang, 'job_split_title', { qty: sl.qty.toLocaleString('en-IN'), days: sl.deadlineDays ?? 10 }),
      lines: split.lines, total: split.total, avgPrice: split.avgPrice, readyDays: split.readyDays,
    });
    out.push({ kind: 'chips', text: '', chips: [{ id: 'refine:budget', label: '₹ ' + t(lang, 'ask_budget', { unit1: unitWord(lang, cat.unit, false) }).replace('?', '') }, { id: 'restart', label: t(lang, 'restart') }] });
    return out;
  }

  const m = await match(need);
  const note = !m.singles.length && m.combos.length ? t(lang, 'results_note_combo', { qty: qtyText }) : m.aboveBudget ? t(lang, 'results_none') : undefined;
  if (!m.singles.length && !m.combos.length && !m.mto.length) {
    return [
      { kind: 'text', text: t(lang, 'results_none') },
      { kind: 'chips', text: '', chips: [{ id: 'refine:budget', label: t(lang, 'no_limit') }, { id: 'refine:qty', label: t(lang, 'ask_qty', { unit: unitWord(lang, cat.unit) }) }, { id: 'home:human', label: t(lang, 'home_human') }] },
    ];
  }
  return [{ kind: 'results', requirementId: reqId, title, singles: m.singles, combos: m.combos, mto: m.mto, band: m.band, note }];
}

function tileColor(catId: string) {
  const map: Record<string, string> = {
    'garment.tshirt': '#B91C1C', 'garment.polo': '#1E3A8A', 'garment.trackpants': '#1F2A44', 'garment.shorts': '#4B5563', 'garment.innerwear': '#1D4ED8',
    'garment.vest': '#E7E5E4', 'garment.kids': '#F59E0B', 'garment.nightwear': '#F9A8D4', 'garment.leggings': '#0F766E', 'garment.hoodie': '#7F1D1D',
    'fabric.knit': '#CBD5E1', 'yarn.cotton': '#F5F5F4', 'service.stitching': '#0D9488', 'service.printing': '#7C3AED', 'service.dyeing': '#15803D',
  };
  return map[catId] ?? '#64748B';
}

// ── Other intents ─────────────────────────────────────────────────────────
async function sellPrompt(user: UserRow, s: Session) {
  s.intent = 'ADD_LISTING';
  s.step = 'photos';
  await save(user.id, s);
  await say(user, [{ kind: 'chips', text: t(user.language, 'sell_prompt'), chips: [{ id: 'action:catalog', label: '📷  ' + t(user.language, 'home_sell'), primary: true }, { id: 'restart', label: t(user.language, 'restart') }] }]);
}

async function ordersCard(user: UserRow, s: Session) {
  s.intent = null;
  await save(user.id, s);
  if (!user.business_id) return say(user, [{ kind: 'text', text: t(user.language, 'orders_none') }]);
  const rows = await col('orders').aggregate([
    { $match: { $or: [{ buyer_business_id: user.business_id }, { seller_business_id: user.business_id }] } },
    { $sort: { created_at: -1 } }, { $limit: 5 },
    { $lookup: { from: 'businesses', localField: 'buyer_business_id', foreignField: '_id', as: 'bb' } },
    { $lookup: { from: 'businesses', localField: 'seller_business_id', foreignField: '_id', as: 'sb' } },
    { $addFields: { buyer_name: { $first: '$bb.name' }, seller_name: { $first: '$sb.name' } } },
  ]).toArray();
  if (!rows.length) return say(user, [{ kind: 'text', text: t(user.language, 'orders_none') }, ...(await homeCard(user))]);
  await say(user, [{
    kind: 'orders', text: t(user.language, 'orders_title'),
    items: rows.map((o) => ({ orderId: o.id, code: o.code, title: o.title, status: o.status, total: o.total, counterpart: o.buyer_business_id === user.business_id ? o.seller_name : o.buyer_name, conversationId: o.conversation_id ?? undefined })),
  }]);
}

async function handoff(user: UserRow, s: Session, trigger: string, text?: string) {
  s.fail = 0;
  await save(user.id, s);
  await say(user, [{ kind: 'text', text: t(user.language, 'handoff') }]);
  await createTicket({ type: 'help', trigger, requesterUserId: user.id, businessIds: user.business_id ? [user.business_id] : [], description: text, languages: [user.language] });
}

export async function resetSession(userId: string) {
  await update('claire_sessions', userId, { intent: null, step: null, slots: {}, fail_count: 0, updated_at: now() });
}
