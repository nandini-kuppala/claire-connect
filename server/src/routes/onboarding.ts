// Voice onboarding: at most four spoken questions build the business profile, then one tap confirms it.
import { Router } from 'express';
import { z } from 'zod';
import { col, findOne, insert, update } from '../db/index.js';
import { emptyProfile, extractProfile, type ProfileDraft } from '../ai.js';
import { transcribe, speak } from '../voice.js';
import { t } from '../i18n.js';
import { getUser, publicBiz, type UserRow } from '../biz.js';
import { claireWelcome } from '../claire.js';
import { invalidateTrust } from '../trust.js';
import { h, HttpError, id, jsonField, now, requireAuth, slugify, upload, type AuthedRequest } from '../util.js';
import { publicUser } from './auth.js';
import { catById, LANGS, PALETTE } from '../../../shared/taxonomy.js';
import { WORK_KEYS } from '../sc/orders.js';

const router = Router();

const STEPS = ['intro', 'business', 'location', 'gst'] as const;
type Step = (typeof STEPS)[number];
const MAX_ASKS_PER_STEP = 2;
const MAX_TURNS = 7;

interface OnbSession {
  transcripts: Partial<Record<Step, string[]>>;
  asked: Partial<Record<Step, number>>;
  gstAnswered: boolean;
  turns: number;
}

const blank = (): OnbSession => ({ transcripts: {}, asked: {}, gstAnswered: false, turns: 0 });
const isStep = (s: unknown): s is Step => STEPS.includes(s as Step);
const isLang = (l: unknown): l is string => LANGS.some((x) => x.code === l);

async function loadSession(uid: string): Promise<OnbSession> {
  const r = await findOne('onboarding_sessions', { _id: uid });
  return r ? { ...blank(), transcripts: r.transcripts ?? {}, asked: r.asked ?? {}, gstAnswered: !!r.gst_answered, turns: r.turns ?? 0 } : blank();
}

async function saveSession(uid: string, s: OnbSession, draft: ProfileDraft) {
  await col('onboarding_sessions').updateOne(
    { _id: uid } as any,
    { $set: { user_id: uid, transcripts: s.transcripts, asked: s.asked, gst_answered: s.gstAnswered, turns: s.turns, draft, updated_at: now() } },
    { upsert: true },
  );
}

const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/;
/** GSTIN spoken or typed with spaces ("33 ABCDE 1234 F1Z5") → canonical form. */
function findGstin(text: string): string | null {
  const m = text.toUpperCase().replace(/[\s-]/g, '').match(/\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/);
  return m && GSTIN_RE.test(m[0]) ? m[0] : null;
}

/** Normalise whatever the client sends back as the draft (it may have been edited on screen). */
function cleanDraft(raw: Partial<ProfileDraft> | null | undefined): ProfileDraft {
  const d = { ...emptyProfile(), ...(raw ?? {}) };
  const cats = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.map(String).filter((c) => catById(c)))] : []);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);
  return {
    owner_name: str(d.owner_name), business_name: str(d.business_name), role_label: str(d.role_label), sells: cats(d.sells), buys: cats(d.buys),
    capacity_note: str(d.capacity_note), city: str(d.city), area: str(d.area), gstin: str(d.gstin), is_manufacturer: typeof d.is_manufacturer === 'boolean' ? d.is_manufacturer : null,
  };
}

/** Which question comes next: skips anything already answered, never asks one step more than twice. */
function nextStep(d: ProfileDraft, s: OnbSession): Step | null {
  if (s.turns >= MAX_TURNS) return null;
  const canAsk = (k: Step) => (s.asked[k] ?? 0) < MAX_ASKS_PER_STEP;
  if ((!d.owner_name || !d.business_name) && canAsk('intro')) return 'intro';
  if (!d.sells.length && !d.buys.length && !d.role_label && canAsk('business')) return 'business';
  if (!d.city && canAsk('location')) return 'location';
  if (!d.gstin && !s.gstAnswered && canAsk('gst')) return 'gst';
  return null;
}

async function question(step: Step | null, lang: string, draft: ProfileDraft, repeat: boolean) {
  if (!step) {
    const name = (draft.owner_name || '').split(' ')[0];
    const text = t(lang, 'onb_done', { name }).replace(/,\s*!/, '!');
    return { key: 'confirm', text, ttsUrl: await speak(text, lang).catch(() => null) };
  }
  const text = (repeat ? t(lang, 'onb_sorry') + ' ' : '') + t(lang, `onb_q_${step}`);
  return { key: step, text, ttsUrl: await speak(text, lang).catch(() => null) };
}

router.post(
  '/onboarding/turn',
  requireAuth,
  upload.single('audio'),
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    const body = req.body ?? {};
    const hint = isLang(body.lang) ? body.lang : isLang(body.language) ? body.language : user.language;
    const answering: Step | null = isStep(body.step) ? body.step : null;
    const s = await loadSession(user.id);
    let draft = cleanDraft(jsonField<Partial<ProfileDraft>>(body.draft, {}));

    // 1) What did they say?
    let transcript = typeof body.text === 'string' ? body.text.trim() : '';
    let lang = hint;
    if (req.file?.buffer?.length) {
      const stt = await transcribe(req.file, hint);
      if (!stt) throw new HttpError(502, 'I could not hear that. Please try again or type instead.');
      transcript = stt.text;
      lang = isLang(stt.lang) ? stt.lang : hint;
    }

    // First call with nothing said yet: just ask the opening question.
    if (!transcript && !answering) {
      Object.assign(s, blank());
      const step = nextStep(draft, s) ?? 'intro';
      s.asked[step] = 1;
      await saveSession(user.id, s, draft);
      return res.json({ transcript: '', lang: hint, draft, next: await question(step, hint, draft, false), done: false });
    }

    // 2) Accumulate and extract.
    const step: Step = answering ?? nextStep(draft, s) ?? 'intro';
    s.turns += 1;
    if (transcript) {
      (s.transcripts[step] ||= []).push(transcript);
      if (step === 'gst') {
        s.gstAnswered = true;
        const gstin = findGstin(transcript);
        if (gstin) draft.gstin = gstin;
      }
      const all = STEPS.flatMap((k) => (s.transcripts[k] ?? []).map((x) => `[${k}] ${x}`));
      const extracted = await extractProfile(all, lang, draft);
      draft = cleanDraft({ ...extracted, gstin: draft.gstin ?? (extracted.gstin ? findGstin(extracted.gstin) ?? extracted.gstin : null) });
    } else if (step === 'gst') {
      s.gstAnswered = true; // empty answer on the GST step = skip
    }

    // 3) Decide the next question in the user's chosen language.
    const next = nextStep(draft, s);
    if (next) s.asked[next] = (s.asked[next] ?? 0) + 1;
    await saveSession(user.id, s, draft);
    res.json({ transcript, lang, draft, next: await question(next, hint, draft, next === step && !!transcript), done: !next });
  }),
);

async function uniqueSlug(name: string, ownBusinessId?: string | null) {
  const base = slugify(name);
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const hit = await findOne('businesses', { slug });
    if (!hit || hit._id === ownBusinessId) return slug;
  }
  return `${base}-${id('', 5).toLowerCase()}`;
}

// S18 "What work does your unit do?": the same checks and stored shape as POST /api/sc/profile/work (businesses.sc_work).
const WorkBody = z.object({
  processes: z.array(z.enum(WORK_KEYS)).max(WORK_KEYS.length),
  capacity: z.string().trim().max(500).transform((v) => v.slice(0, 60)).optional(),
  turnaround_days: z.number().int().min(0).max(999).transform((v) => Math.min(90, v)).optional(),
  sends_work: z.boolean().optional(),
});
/** Optional and skippable: no answer stores nothing, so the Goods home card asks later. Bad input is a 400. */
function workFrom(raw: unknown) {
  if (raw == null) return null;
  const r = WorkBody.safeParse(raw);
  if (!r.success) throw new HttpError(400, 'Please check the work you picked and try again.');
  const b = r.data;
  if (!b.processes.length && b.sends_work == null) return null;
  return { processes: [...new Set(b.processes)], capacity: b.capacity || null, turnaround_days: b.turnaround_days ?? null, sends_work: b.sends_work ?? null, skipped: false, at: Date.now() };
}

const ACCENTS = PALETTE.filter((c) => !['#E5E7EB', '#F5F5F4'].includes(c));

router.post(
  '/onboarding/complete',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const user = await getUser(req.uid);
    const draft = cleanDraft(jsonField<Partial<ProfileDraft>>(req.body?.draft, {}));
    const language = isLang(req.body?.language) ? req.body.language : user.language;
    const ownerName = draft.owner_name || user.name || 'Friend';
    const bizName = draft.business_name || `${ownerName.split(' ')[0]}'s business`;
    const work = workFrom(req.body?.work);
    const roleLabel = draft.role_label || (draft.sells.some((c) => c.startsWith('service.')) ? 'Job work unit' : draft.sells.length ? 'Seller' : 'Buyer');

    const fields = {
      name: bizName, owner_name: ownerName, language, city: draft.city, area: draft.area, role_label: roleLabel,
      sells: draft.sells, buys: draft.buys, capacity_note: draft.capacity_note, gstin: draft.gstin,
      about: [roleLabel, draft.capacity_note, draft.area && draft.city ? `${draft.area}, ${draft.city}` : draft.city].filter(Boolean).join(' · '),
      is_manufacturer: draft.is_manufacturer ? 1 : 0, updated_at: now(),
      ...(work ? { sc_work: work } : {}),
    };

    let businessId = user.business_id;
    const existing = businessId ? await findOne('businesses', { _id: businessId }) : null;
    if (existing && businessId) {
      await update('businesses', businessId, { ...fields, slug: existing.name === bizName ? existing.slug : await uniqueSlug(bizName, businessId) });
    } else {
      businessId = id('b_', 10);
      await insert('businesses', {
        id: businessId, slug: await uniqueSlug(bizName), state: null, gst_verified: 0, udyam: 0, unit_visited: 0, reply_minutes: null,
        auto_reply: 'suggest', accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)], is_seed: 0, created_at: now(), ...fields,
      });
    }
    await update('users', user.id, { business_id: businessId, name: ownerName, language, onboarded: 1, updated_at: now() });
    await col('onboarding_sessions').deleteOne({ _id: user.id } as any);
    invalidateTrust(businessId!);

    const fresh: UserRow = await getUser(user.id);
    try {
      await claireWelcome(fresh);
    } catch (err) {
      console.error(`[onboarding] Claire welcome failed for ${user.id}:`, (err as Error).message);
    }
    res.json({ business: await publicBiz(businessId!), user: publicUser(fresh) });
  }),
);

export default router;
