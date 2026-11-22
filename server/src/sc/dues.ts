// Money follow-ups (03 S14): closed days (Q), credit days per party, and due reminders. Owner only; record-only.
// - Closed days: `businesses.sc_calendar {off_weekdays, holidays}`; every /api/sc request runs inside it (calendar.ts).
// - Credit days: `sc_relationships.credit_days` per party (default 30), kept apart from the goods terms.
// - Due reminders: a party whose unpaid bills (first in, first out) are older than its credit days gets a reminder to
//   the owner, at most once a day per party: a notice only the owner sees in the Goods conversation (a business) or in
//   their Claire chat (a contact), plus the banner on Reports and the bill page. The owner can snooze it.
import { Router } from 'express';
import { z } from 'zod';
import { col, find } from '../db/index.js';
import { h, HttpError } from '../util.js';
import { chat } from '../chat.js';
import { BOT, features } from '../config.js';
import { usersOf } from '../biz.js';
import type { Ctx, ScRequest } from './flag.js';
import { calendarContext, forgetCalendar, storedCalendar, withCalendar } from './calendar.js';
import { billItems, settlementsWith, unpaidLines, type BillItem } from './money.js';
import { orderPaidSweep } from './orders.js';
import { goodsConversation } from './goodsChat.js';
import { partyNames } from './views.js';
import { todayIST } from '../../../shared/sc/dates.js';
import type { PartyRef } from '../../../shared/sc/types.js';
import { CC_CARD, type CardPayload } from '../../../shared/cards.js';

const router = Router();
router.use('/sc', calendarContext);

export const DEFAULT_CREDIT_DAYS = 30;
const pk = (p: PartyRef) => `${p.k}:${p.id}`;
const relId = (bizId: string, p: PartyRef) => `rel_${bizId}_${p.k}_${p.id}`;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};
function owner(ctx: Ctx) {
  if (ctx.role !== 'owner') throw new HttpError(403, 'Rates and bills are visible to the owner only.');
}
const calDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const partyRef = z.object({ k: z.enum(['b', 'c']), id: z.string().min(1).max(64) });

async function assertParty(ctx: Ctx, p: PartyRef) {
  if (p.k === 'b' && p.id === ctx.businessId) throw new HttpError(400, 'Pick the other party.');
  const found = p.k === 'c'
    ? await col('sc_contacts').findOne({ _id: p.id, owner_business_id: ctx.businessId } as any, { projection: { _id: 1 } })
    : await col('businesses').findOne({ _id: p.id } as any, { projection: { _id: 1 } });
  if (!found) throw new HttpError(404, 'Not found');
}

// ── Closed days (Q) ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/sc/calendar',
  h(async (req: ScRequest, res) => {
    res.json({ calendar: await storedCalendar(req.ctx.businessId) });
  }),
);

router.put(
  '/sc/calendar',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can change this.');
    const b = parse(z.object({ off_weekdays: z.array(z.number().int().min(0).max(6)).max(6), holidays: z.array(z.string().regex(DATE)).max(100) }), req.body);
    const cal = { off_weekdays: [...new Set(b.off_weekdays)].sort(), holidays: [...new Set(b.holidays)].sort() };
    await col('businesses').updateOne({ _id: req.ctx.businessId } as any, { $set: { sc_calendar: { ...cal, updated_at: Date.now() } } });
    forgetCalendar(req.ctx.businessId);
    res.json({ calendar: cal });
  }),
);

// ── Credit days per party ───────────────────────────────────────────────────────────────────────
export async function creditDays(bizId: string, parties: PartyRef[]): Promise<Map<string, number>> {
  const rels = (await col('sc_relationships').find({ _id: { $in: parties.map((p) => relId(bizId, p)) } } as any, { projection: { party: 1, credit_days: 1 } }).toArray()) as any[];
  const out = new Map<string, number>(parties.map((p) => [pk(p), DEFAULT_CREDIT_DAYS]));
  for (const r of rels) if (typeof r.credit_days === 'number' && r.party) out.set(pk(r.party), r.credit_days);
  return out;
}

router.put(
  '/sc/parties/:k/:id/credit-days',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const p = parse(partyRef, { k: req.params.k, id: req.params.id }) as PartyRef;
    const b = parse(z.object({ days: z.number().int().min(0).max(365) }), req.body);
    await assertParty(req.ctx, p);
    await col('sc_relationships').updateOne({ _id: relId(req.ctx.businessId, p) } as any, { $set: { business_id: req.ctx.businessId, party: p, credit_days: b.days, updated_at: Date.now() } }, { upsert: true });
    res.json({ credit_days: b.days });
  }),
);

// ── Who I am and how to reach them (Share bill) ─────────────────────────────────────────────────
export async function partyContact(ctx: Ctx, p: PartyRef) {
  const me: any = await col('businesses').findOne({ _id: ctx.businessId } as any, { projection: { name: 1, city: 1, gstin: 1 } });
  let them: { name: string; phone: string | null; language: string | null } = { name: '', phone: null, language: null };
  if (p.k === 'c') {
    const c: any = await col('sc_contacts').findOne({ _id: p.id, owner_business_id: ctx.businessId } as any, { projection: { name: 1, phones: 1, language: 1 } });
    if (c) them = { name: c.name ?? '', phone: c.phones?.[0] ?? null, language: c.language ?? null };
  } else {
    const [b, u]: any[] = await Promise.all([
      col('businesses').findOne({ _id: p.id } as any, { projection: { name: 1, language: 1 } }),
      col('users').findOne({ business_id: p.id, role: 'owner' } as any, { projection: { phone: 1 } }),
    ]);
    them = { name: b?.name ?? '', phone: u?.phone ?? null, language: b?.language ?? null };
  }
  return { me: { name: (me?.name as string) ?? '', city: (me?.city as string | null) ?? null, gstin: (me?.gstin as string | null) ?? null }, them };
}

// ── Due reminders ───────────────────────────────────────────────────────────────────────────────
export interface DueRow { party: PartyRef; name: string; side: 'they_owe' | 'i_owe'; overdue_paise: number; oldest_date: string; days: number; credit_days: number; snoozed_until: string | null }

/** Per party and side: what is unpaid beyond the party's credit days (calendar days since the bill). */
function overdueRows(lines: ReturnType<typeof unpaidLines>, credit: Map<string, number>, today: string) {
  const rows: Omit<DueRow, 'name' | 'snoozed_until'>[] = [];
  for (const u of lines) {
    const cd = credit.get(pk(u.party)) ?? DEFAULT_CREDIT_DAYS;
    const late = u.lines.filter((l) => calDays(l.date, today) > cd);
    if (!late.length) continue;
    rows.push({ party: u.party, side: u.side, overdue_paise: late.reduce((a, l) => a + l.remaining, 0), oldest_date: late[0].date, days: calDays(late[0].date, today), credit_days: cd });
  }
  return rows;
}

async function snoozes(bizId: string): Promise<Map<string, string>> {
  const today = todayIST();
  const rows = (await col('sc_reminders').find({ business_id: bizId, snoozed_until: { $gt: today } } as any, { projection: { party: 1, snoozed_until: 1 } }).toArray()) as any[];
  return new Map(rows.filter((r) => r.party).map((r) => [pk(r.party), r.snoozed_until as string]));
}

export async function dueReminders(ctx: Ctx): Promise<DueRow[]> {
  const [items, sets] = await Promise.all([billItems(ctx), settlementsWith(ctx)]);
  const lines = unpaidLines(items, sets);
  const credit = await creditDays(ctx.businessId, lines.map((l) => l.party));
  const rows = overdueRows(lines, credit, todayIST());
  const [names, snoozed] = await Promise.all([partyNames(ctx, rows.map((r) => r.party)), snoozes(ctx.businessId)]);
  return rows.map((r) => ({ ...r, name: names.get(pk(r.party))?.name ?? '—', snoozed_until: snoozed.get(pk(r.party)) ?? null })).sort((a, b) => b.days - a.days);
}

/** The bill page's view of one party's reminder (from the lines it already loaded). */
export async function reminderState(ctx: Ctx, p: PartyRef, items: BillItem[], sets: Awaited<ReturnType<typeof settlementsWith>>) {
  if (ctx.role !== 'owner') return null;
  const credit = await creditDays(ctx.businessId, [p]);
  const rows = overdueRows(unpaidLines(items, sets).filter((l) => pk(l.party) === pk(p)), credit, todayIST());
  const snoozed = (await snoozes(ctx.businessId)).get(pk(p)) ?? null;
  const rem: any = await col('sc_reminders').findOne({ _id: `${ctx.businessId}|${pk(p)}` } as any, { projection: { last_sent_on: 1 } });
  return { rows: rows.map((r) => ({ side: r.side, overdue_paise: r.overdue_paise, oldest_date: r.oldest_date, days: r.days })), snoozed_until: snoozed, last_sent_on: rem?.last_sent_on ?? null };
}

router.get(
  '/sc/reminders',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const rows = await dueReminders(req.ctx);
    res.json({ rows: rows.filter((r) => !r.snoozed_until), snoozed: rows.filter((r) => r.snoozed_until) });
  }),
);

router.post(
  '/sc/reminders/:k/:id/snooze',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    const p = parse(partyRef, { k: req.params.k, id: req.params.id }) as PartyRef;
    const b = parse(z.object({ days: z.number().int().min(0).max(30) }), req.body);
    await assertParty(req.ctx, p);
    const until = b.days > 0 ? addDays(todayIST(), b.days) : null;
    await col('sc_reminders').updateOne({ _id: `${req.ctx.businessId}|${pk(p)}` } as any, { $set: { business_id: req.ctx.businessId, party: p, snoozed_until: until, updated_at: Date.now() } }, { upsert: true });
    res.json({ snoozed_until: until });
  }),
);

// The notice is the owner's own (never seen by the other side), in the owner's language.
const TEXT: Record<string, { they_owe: string; i_owe: string; tail: string }> = {
  en: { they_owe: 'Payment due: {name} owes you {amt}, unpaid for {days} days (credit {credit} days).', i_owe: 'Payment due: you owe {name} {amt}, unpaid for {days} days (credit {credit} days).', tail: 'To record it or snooze: Goods → Reports → Bills.' },
  ta: { they_owe: 'பணம் பாக்கி: {name} உங்களுக்கு {amt} தர வேண்டும், {days} நாளாகச் செலுத்தவில்லை (கடன் {credit} நாள்).', i_owe: 'பணம் பாக்கி: நீங்கள் {name}-க்கு {amt} தர வேண்டும், {days} நாளாகச் செலுத்தவில்லை (கடன் {credit} நாள்).', tail: 'பதிய அல்லது தள்ளிவைக்க: சரக்கு → அறிக்கைகள் → பில்கள்.' },
  hi: { they_owe: 'भुगतान बाकी: {name} को आपको {amt} देना है, {days} दिन से बकाया (उधार {credit} दिन)।', i_owe: 'भुगतान बाकी: आपको {name} को {amt} देना है, {days} दिन से बकाया (उधार {credit} दिन)।', tail: 'दर्ज करने या टालने के लिए: माल → रिपोर्ट → बिल।' },
  te: { they_owe: 'చెల్లింపు బాకీ: {name} మీకు {amt} ఇవ్వాలి, {days} రోజులుగా చెల్లించలేదు (అప్పు {credit} రోజులు).', i_owe: 'చెల్లింపు బాకీ: మీరు {name}కి {amt} ఇవ్వాలి, {days} రోజులుగా చెల్లించలేదు (అప్పు {credit} రోజులు).', tail: 'నమోదు చేయడానికి లేదా వాయిదా వేయడానికి: సరుకు → నివేదికలు → బిల్లులు.' },
  kn: { they_owe: 'ಪಾವತಿ ಬಾಕಿ: {name} ನಿಮಗೆ {amt} ಕೊಡಬೇಕು, {days} ದಿನಗಳಿಂದ ಪಾವತಿಸಿಲ್ಲ (ಸಾಲ {credit} ದಿನ).', i_owe: 'ಪಾವತಿ ಬಾಕಿ: ನೀವು {name}ಗೆ {amt} ಕೊಡಬೇಕು, {days} ದಿನಗಳಿಂದ ಪಾವತಿಸಿಲ್ಲ (ಸಾಲ {credit} ದಿನ).', tail: 'ದಾಖಲಿಸಲು ಅಥವಾ ಮುಂದೂಡಲು: ಸರಕು → ವರದಿಗಳು → ಬಿಲ್‌ಗಳು.' },
  ml: { they_owe: 'പണം കുടിശ്ശിക: {name} നിങ്ങൾക്ക് {amt} തരാനുണ്ട്, {days} ദിവസമായി അടച്ചിട്ടില്ല (കടം {credit} ദിവസം).', i_owe: 'പണം കുടിശ്ശിക: നിങ്ങൾ {name}-ന് {amt} കൊടുക്കാനുണ്ട്, {days} ദിവസമായി അടച്ചിട്ടില്ല (കടം {credit} ദിവസം).', tail: 'രേഖപ്പെടുത്താനോ മാറ്റിവയ്ക്കാനോ: സാധനങ്ങൾ → റിപ്പോർട്ടുകൾ → ബില്ലുകൾ.' },
  bn: { they_owe: 'পেমেন্ট বাকি: {name} আপনাকে {amt} দেবে, {days} দিন ধরে বাকি (ধার {credit} দিন)।', i_owe: 'পেমেন্ট বাকি: আপনি {name}-কে {amt} দেবেন, {days} দিন ধরে বাকি (ধার {credit} দিন)।', tail: 'লিখে রাখতে বা পিছিয়ে দিতে: মাল → রিপোর্ট → বিল।' },
  or: { they_owe: 'ପେମେଣ୍ଟ ବାକି: {name} ଆପଣଙ୍କୁ {amt} ଦେବେ, {days} ଦିନ ହେଲା ବାକି (ଧାର {credit} ଦିନ)।', i_owe: 'ପେମେଣ୍ଟ ବାକି: ଆପଣ {name}ଙ୍କୁ {amt} ଦେବେ, {days} ଦିନ ହେଲା ବାକି (ଧାର {credit} ଦିନ)।', tail: 'ଲେଖିବା ବା ପଛକୁ ଘୁଞ୍ଚାଇବା ପାଇଁ: ମାଲ → ରିପୋର୍ଟ → ବିଲ୍।' },
  mr: { they_owe: 'पेमेंट बाकी: {name} यांनी तुम्हाला {amt} द्यायचे आहेत, {days} दिवसांपासून बाकी (उधारी {credit} दिवस).', i_owe: 'पेमेंट बाकी: तुम्हाला {name} यांना {amt} द्यायचे आहेत, {days} दिवसांपासून बाकी (उधारी {credit} दिवस).', tail: 'नोंदवण्यासाठी किंवा पुढे ढकलण्यासाठी: माल → अहवाल → बिले.' },
  gu: { they_owe: 'ચુકવણી બાકી: {name} એ તમને {amt} આપવાના છે, {days} દિવસથી બાકી (ઉધાર {credit} દિવસ).', i_owe: 'ચુકવણી બાકી: તમારે {name} ને {amt} આપવાના છે, {days} દિવસથી બાકી (ઉધાર {credit} દિવસ).', tail: 'નોંધવા અથવા મુલતવી રાખવા: માલ → રિપોર્ટ → બિલ.' },
};
const inr = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

export function reminderText(lang: string, rows: Pick<DueRow, 'name' | 'side' | 'overdue_paise' | 'days' | 'credit_days'>[]) {
  const t = TEXT[lang] ?? TEXT.en;
  return [...rows.map((r) => fill(t[r.side], { name: r.name, amt: inr(r.overdue_paise), days: r.days, credit: r.credit_days })), t.tail].join(' ');
}

/** Sends today's reminders for one business: one notice per party a day, skipping snoozed parties. */
export async function sendReminders(bizId: string, opts: { force?: boolean } = {}) {
  const today = todayIST();
  // One sweep per business a day (the hourly ticker), unless the owner asks for it now.
  if (!opts.force) {
    try {
      const r = await col('sc_reminders').updateOne({ _id: `run|${bizId}`, day: { $ne: today } } as any, { $set: { day: today, business_id: null } }, { upsert: true });
      if (!r.modifiedCount && !r.upsertedCount) return [];
    } catch (e: any) {
      if (e?.code === 11000) return [];
      throw e;
    }
  }
  const [biz, ownerRow]: any[] = await Promise.all([col('businesses').findOne({ _id: bizId } as any, { projection: { language: 1 } }), col('users').findOne({ business_id: bizId, role: 'owner' } as any)]);
  if (!ownerRow) return [];
  const ctx: Ctx = { businessId: bizId, userId: ownerRow.id ?? ownerRow._id, role: 'owner', language: ownerRow.language || biz?.language || 'en' };
  return withCalendar(bizId, async () => {
    const rows = (await dueReminders(ctx)).filter((r) => !r.snoozed_until);
    const byParty = new Map<string, DueRow[]>();
    for (const r of rows) byParty.set(pk(r.party), [...(byParty.get(pk(r.party)) ?? []), r]);
    const owners = await usersOf([bizId]);
    const sent: { party: PartyRef; text: string; channel: 'goods' | 'claire' }[] = [];
    for (const [key, rs] of byParty) {
      const party = rs[0].party;
      const text = reminderText(ctx.language, rs);
      const channel = party.k === 'b' ? 'goods' : 'claire';
      // At most once a day per party: the claim fails (or finds today's date) when today's reminder already went.
      try {
        const r = await col('sc_reminders').updateOne({ _id: `${bizId}|${key}`, last_sent_on: { $ne: today } } as any, { $set: { business_id: bizId, party, last_sent_on: today, last_sent_at: Date.now(), last_text: text, last_channel: channel } }, { upsert: true });
        if (!r.modifiedCount && !r.upsertedCount) continue;
      } catch (e: any) {
        if (e?.code === 11000) continue;
        throw e;
      }
      const notice: CardPayload = { kind: 'notice', text, tone: 'warn' };
      try {
        if (party.k === 'b') {
          const conv = await goodsConversation(bizId, party.id);
          await chat.group(conv.channel_id, BOT.claire, CC_CARD, notice, { onlyTo: owners, push: text.slice(0, 120) });
        } else {
          await chat.direct(BOT.claire, owners, CC_CARD, notice, { push: text.slice(0, 120) });
        }
        sent.push({ party, text, channel });
      } catch (e) {
        console.warn('[sc] reminder', key, (e as Error).message);
        await col('sc_reminders').updateOne({ _id: `${bizId}|${key}` } as any, { $set: { last_sent_on: null } });
        if (!opts.force) await col('sc_reminders').updateOne({ _id: `run|${bizId}` } as any, { $set: { day: null } });
      }
    }
    return sent;
  });
}

router.post(
  '/sc/reminders/run',
  h(async (req: ScRequest, res) => {
    owner(req.ctx);
    res.json({ sent: await sendReminders(req.ctx.businessId, { force: true }) });
  }),
);

/** Hourly: due reminders for every business using Goods (once a day each), and orders paid in full then delivered. */
export function startDuesTicker() {
  if (process.env.SC_REMINDERS === '0' || !features.supplyChain) return;
  const tick = async () => {
    await orderPaidSweep();
    const bizs = (await find('businesses', { 'flags.sc': true }, { projection: { _id: 1 } })) as any[];
    for (const b of bizs.slice(0, 500)) await sendReminders(b._id).catch((e) => console.warn('[sc] reminders', b._id, (e as Error).message));
  };
  setTimeout(() => void tick().catch((e) => console.warn('[sc] dues ticker', e.message)), 3 * 60_000).unref();
  setInterval(() => void tick().catch((e) => console.warn('[sc] dues ticker', e.message)), 60 * 60_000).unref();
}

export default router;
