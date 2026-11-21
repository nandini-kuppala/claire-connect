// Statement links (03 S15, 04 §10.4): a public page at /l/:token for a party that isn't using CLAIRE (a contact, or a
// business that never enabled Goods). It shows only the lines between the recorder and that party, with plain names
// and no prices, and lets them confirm, give their figure, say they returned some, mark ready, or stop the updates.
// Server-rendered HTML (no app bundle, < 50 KB). "Seen" only on interaction, so link previews don't count.
import crypto from 'node:crypto';
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import { scOn, type Ctx, type ScRequest } from './flag.js';
import { newId } from './repo.js';
import { applyReceipt, applySenderFigure, qtyBase, specInfo } from './ledgerOps.js';
import { jobSummaries, partyNames } from './views.js';
import { genericLabel } from './work.js';
import { gotBack } from './records.js';
import { formatQty } from '../../../shared/sc/units.js';
import { todayIST } from '../../../shared/sc/dates.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { Dimension, PartyRef } from '../../../shared/sc/types.js';

export const ownerRouter = Router();
export const publicRouter = Router();
// The page posts plain HTML forms (no JS framework on a 2G phone).
publicRouter.use('/api/l', express.urlencoded({ extended: false, limit: '8kb' }));
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const PUBLIC_URL = (process.env.PUBLIC_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
const pk = (p: PartyRef) => `${p.k}:${p.id}`;

// ── Owner: create / rotate, list, stop ──────────────────────────────────────────────────────────

const SHARE_TEXT: Record<string, (biz: string, url: string) => string> = {
  en: (b, u) => `${b} keeps a record of the goods between us on CLAIRE Connect. Please check and confirm: ${u}`,
  ta: (b, u) => `${b} நமக்குள் உள்ள சரக்கு கணக்கை CLAIRE Connect-ல் வைத்திருக்கிறோம். சரிபார்த்து உறுதி செய்யுங்கள்: ${u}`,
  hi: (b, u) => `${b} हमारे बीच के माल का हिसाब CLAIRE Connect पर रखता है। कृपया जाँच कर पुष्टि करें: ${u}`,
};

async function partyFor(ctx: Ctx, p: PartyRef) {
  if (p.k === 'c') {
    const c: any = await col('sc_contacts').findOne({ _id: p.id, owner_business_id: ctx.businessId } as any);
    if (!c) throw new HttpError(404, 'Not found');
    if (c.link_state === 'linked') throw new HttpError(409, 'They are on CLAIRE now; their own account shows these records.');
    return { name: c.name as string, language: (c.language as string | null) ?? null, phone: (c.phones?.[0] as string | undefined) ?? null };
  }
  const b: any = await col('businesses').findOne({ _id: p.id } as any, { projection: { name: 1, language: 1, flags: 1 } });
  if (!b) throw new HttpError(404, 'Not found');
  if (scOn(b)) throw new HttpError(409, 'They use Goods on CLAIRE; they confirm in the app.');
  const owner: any = await col('users').findOne({ business_id: p.id, role: { $ne: 'staff' } } as any, { projection: { phone: 1 } });
  return { name: b.name as string, language: (b.language as string | null) ?? null, phone: (owner?.phone as string | undefined) ?? null };
}

ownerRouter.post(
  '/sc/links',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can share statements.');
    const b = z.object({ party: z.object({ k: z.enum(['b', 'c']), id: z.string().max(64) }), rotate: z.boolean().optional() }).parse(req.body);
    const p = await partyFor(ctx, b.party);
    const token = crypto.randomBytes(16).toString('base64url'); // 128-bit; only its SHA-256 is stored
    const existing: any = await col('sc_statement_links').findOne({ recorder_business_id: ctx.businessId, 'party.k': b.party.k, 'party.id': b.party.id } as any);
    const id = existing?._id ?? newId('sl');
    await col('sc_statement_links').updateOne(
      { _id: id } as any,
      { $set: { token_hash: sha(token), stopped_at: null, stopped_by: null, rotated_at: existing ? Date.now() : null, language: p.language ?? ctx.language }, $setOnInsert: { id, recorder_business_id: ctx.businessId, party: b.party, created_at: Date.now(), seen_at: null } },
      { upsert: true },
    );
    const biz: any = await col('businesses').findOne({ _id: ctx.businessId } as any, { projection: { name: 1 } });
    const url = `${PUBLIC_URL}/l/${token}`;
    const lang = p.language ?? ctx.language;
    const text = (SHARE_TEXT[lang] ?? SHARE_TEXT.en)(biz?.name ?? '', url);
    const phone = p.phone ? p.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1') : '';
    // The app never messages anyone: the user sends this from WhatsApp themselves (03 §4.6).
    res.status(existing ? 200 : 201).json({ link: { id, url }, whatsapp: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, text });
  }),
);

ownerRouter.get(
  '/sc/links',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can see shared statements.'); // contact phones
    const rows = await col('sc_statement_links').find({ recorder_business_id: req.ctx.businessId } as any).sort({ created_at: -1 }).limit(100).toArray();
    const names = await partyNames(req.ctx, rows.map((r: any) => r.party));
    res.json({ links: rows.map((r: any) => ({ id: r._id, party: r.party, name: names.get(pk(r.party))?.name ?? '—', seen_at: r.seen_at, last_action_at: r.last_action_at ?? null, stopped_at: r.stopped_at, stopped_by: r.stopped_by, created_at: r.created_at })) });
  }),
);

ownerRouter.delete(
  '/sc/links/:id',
  h(async (req: ScRequest, res) => {
    if (req.ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can stop a statement link.');
    const r = await col('sc_statement_links').updateOne({ _id: req.params.id, recorder_business_id: req.ctx.businessId } as any, { $set: { stopped_at: Date.now(), stopped_by: 'recorder' } });
    if (!r.matchedCount) throw new HttpError(404, 'Not found');
    res.json({ stopped: true });
  }),
);

/** "I returned some" proposals from statement pages, for the recorder to accept or decline. */
ownerRouter.get(
  '/sc/links/proposals',
  h(async (req: ScRequest, res) => {
    const rows = await col('sc_link_proposals').find({ recorder_business_id: req.ctx.businessId, state: 'pending' } as any).sort({ at: -1 }).limit(50).toArray();
    const names = await partyNames(req.ctx, rows.map((r: any) => r.party));
    res.json({ proposals: rows.map((r: any) => ({ id: r._id, job_id: r.job_id, party: r.party, name: names.get(pk(r.party))?.name ?? '—', qty: r.qty_base, dim: r.dim, label: r.label, note: r.note, at: r.at })) });
  }),
);

ownerRouter.post(
  '/sc/links/proposals/:id/:verb(accept|decline)',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    if (ctx.role !== 'owner') throw new HttpError(403, 'Only the owner can accept this.');
    const p: any = await col('sc_link_proposals').findOne({ _id: req.params.id, recorder_business_id: ctx.businessId, state: 'pending' } as any);
    if (!p) throw new HttpError(404, 'Not found');
    if (req.params.verb === 'decline') {
      await col('sc_link_proposals').updateOne({ _id: p._id } as any, { $set: { state: 'declined', decided_at: Date.now() } });
      return res.json({ declined: true });
    }
    // Accepting records "got back" with their figure (on their word, via the link), against the job's usual output.
    const job: any = await col('sc_jobs').findOne({ _id: p.job_id, 'client_party.id': ctx.businessId } as any);
    const asked = typeof req.body?.spec_id === 'string' ? (req.body.spec_id as string) : null;
    const specId = asked ?? job?.outputs?.at(-1)?.spec_id ?? null;
    if (!job || !specId) return res.status(409).json({ error: 'Record it in Got back: pick what came back.', code: 'pick', job_id: p.job_id });
    const info = await specInfo(specId);
    // They gave the figure in the unit the link showed (the job's input unit). If what comes back is counted differently
    // (fabric in kg, cut kits in pcs), never convert one into the other: the owner records it in Got back.
    if (p.dim && info.dim !== p.dim) {
      const shown = p.dim === 'mass' ? `${p.qty_base / 1000} kg` : p.dim === 'length' ? `${p.qty_base / 100} m` : `${p.qty_base} pcs`;
      return res.status(409).json({ error: `They said ${shown} came back. Record it in Got back with what came back.`, code: 'pick', job_id: p.job_id });
    }
    const unit = info.dim === 'mass' ? 'kg' : info.dim === 'length' ? 'm' : 'pcs';
    const qty = info.dim === 'mass' ? p.qty_base / 1000 : info.dim === 'length' ? p.qty_base / 100 : p.qty_base;
    const r = await gotBack(ctx, { lines: [{ spec_id: specId, qty, unit, they_sent: qty }], client_id: p._id }, job._id);
    if (r.status >= 300) return res.status(r.status).json(r.body);
    await col('sc_link_proposals').updateOne({ _id: p._id } as any, { $set: { state: 'accepted', decided_at: Date.now(), movement_id: r.body?.movement?.id ?? null } });
    res.json({ accepted: true, movement: { id: r.body?.movement?.id ?? null } });
  }),
);

// ── The recorder's own devices (best-effort guard, 04 §10.4) ────────────────────────────────────
const deviceHash = (req: Request) => sha(`${req.ip}|${req.get('user-agent') ?? ''}`).slice(0, 32);
const lastNoted = new Map<string, number>();
/** Called on every authenticated Goods request: remembers this device for the business (throttled). */
export async function noteDevice(req: Request, businessId: string) {
  const k = `${businessId}|${deviceHash(req)}`;
  if ((lastNoted.get(k) ?? 0) > Date.now() - 10 * 60_000) return;
  lastNoted.set(k, Date.now());
  await col('sc_devices').updateOne({ _id: k } as any, { $set: { business_id: businessId, at: Date.now() } }, { upsert: true }).catch(() => undefined);
}
async function isRecorderDevice(req: Request, businessId: string) {
  const d: any = await col('sc_devices').findOne({ _id: `${businessId}|${deviceHash(req)}` } as any);
  return !!d && d.at > Date.now() - 30 * 86400e3;
}

// ── Rate limit: 30 requests a minute per token and IP ───────────────────────────────────────────
const hits = new Map<string, number[]>();
function limited(req: Request, token: string) {
  const k = `${sha(token).slice(0, 16)}|${req.ip}`;
  const now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > 30;
}

// ── The page ────────────────────────────────────────────────────────────────────────────────────
type L = 'en' | 'ta' | 'hi';
const T: Record<L, Record<string, string>> = {
  en: {
    older: '{n} older records are not shown here; ask {biz} if you need them.',
    title: "{biz}'s record with you", for: 'For {name} · updated {date}', received: 'You received <b>{qty}</b> {label} for {biz} on {date}', returned: 'You sent back <b>{qty}</b> {label} on {date} ({biz}\'s record)',
    right: 'Is this right?', correct: 'Correct', differs: 'Different number', your_figure: 'Your number', send: 'Send', with_you: '<b>{qty}</b> {label} still with you ({biz}\'s record)', about: 'about',
    returned_some: 'I returned some', how_many: 'How many did you send back?', ready: 'Ready for pickup', ready_done: 'Marked ready for pickup', done_ok: 'Thank you. {biz} will see it.', confirmed: 'Confirmed by you · {date}',
    nothing: 'Nothing to check right now.', what: 'What is this?', what_body: '{biz} keeps a record of the work they give you on CLAIRE Connect. This page shows only the records {biz} made with you. No login needed.',
    no_prices: 'No prices are shown.', dpdp: 'Your name and phone number are used only to show these records. Your answers go to {biz} only; we don\'t give them to anyone else (DPDP Act, 2023).',
    stop: 'Stop these updates', stopped: 'You stopped these updates. {biz} can send a new link if you want them again.', view_only: 'This is {biz}\'s own phone: you can look, but answers must come from the other side.', gone: 'This link no longer works. Ask the sender for a new one.', busy: 'Too many tries. Please wait a minute.',
  },
  ta: {
    older: '{n} பழைய பதிவுகள் இங்கே காட்டப்படவில்லை; தேவைப்பட்டால் {biz}-இடம் கேளுங்கள்.',
    title: 'உங்களுடன் {biz}-இன் கணக்கு', for: '{name}-க்கு · {date} புதுப்பித்தது', received: '{date} அன்று {biz}-க்காக <b>{qty}</b> {label} பெற்றீர்கள்', returned: '{date} அன்று <b>{qty}</b> {label} திருப்பிக் கொடுத்தீர்கள் ({biz}-இன் பதிவு)',
    right: 'இது சரியா?', correct: 'சரி', differs: 'வேறு எண்', your_figure: 'உங்கள் எண்', send: 'அனுப்பு', with_you: '<b>{qty}</b> {label} இன்னும் உங்களிடம் ({biz}-இன் பதிவு)', about: 'சுமார்',
    returned_some: 'கொஞ்சம் திருப்பிக் கொடுத்தேன்', how_many: 'எத்தனை திருப்பிக் கொடுத்தீர்கள்?', ready: 'எடுக்க தயார்', ready_done: 'எடுக்க தயார் எனக் குறித்தது', done_ok: 'நன்றி. {biz}-க்குத் தெரியும்.', confirmed: 'நீங்கள் உறுதி செய்தது · {date}',
    nothing: 'இப்போது சரிபார்க்க எதுவும் இல்லை.', what: 'இது என்ன?', what_body: '{biz} உங்களுக்குக் கொடுக்கும் வேலையின் கணக்கை CLAIRE Connect-ல் எழுதி வைக்கிறார்கள். {biz} உங்களுடன் செய்த பதிவுகள் மட்டும் இங்கே தெரியும். லாகின் தேவையில்லை.',
    no_prices: 'விலைகள் காட்டப்படுவதில்லை.', dpdp: 'உங்கள் பெயரும் தொலைபேசி எண்ணும் இந்தப் பதிவுகளைக் காட்ட மட்டுமே. உங்கள் பதில்கள் {biz}-க்கு மட்டுமே போகும்; வேறு யாருக்கும் கொடுப்பதில்லை (DPDP சட்டம், 2023).',
    stop: 'இந்தப் புதுப்பிப்புகளை நிறுத்து', stopped: 'நீங்கள் இவற்றை நிறுத்தினீர்கள். வேண்டுமென்றால் {biz} புதிய இணைப்பு அனுப்பலாம்.', view_only: 'இது {biz}-இன் சொந்த போன்: பார்க்கலாம், ஆனால் பதில் மறுபக்கத்திலிருந்து வர வேண்டும்.', gone: 'இந்த இணைப்பு இனி வேலை செய்யாது. அனுப்பியவரிடம் புதியது கேளுங்கள்.', busy: 'அதிக முயற்சிகள். ஒரு நிமிடம் காத்திருங்கள்.',
  },
  hi: {
    older: '{n} पुराने रिकॉर्ड यहाँ नहीं दिखाए गए; ज़रूरत हो तो {biz} से पूछें।',
    title: 'आपके साथ {biz} का हिसाब', for: '{name} के लिए · {date} को अपडेट', received: '{date} को आपको {biz} के लिए <b>{qty}</b> {label} मिला', returned: '{date} को आपने <b>{qty}</b> {label} वापस भेजा ({biz} का रिकॉर्ड)',
    right: 'क्या यह सही है?', correct: 'सही', differs: 'दूसरी संख्या', your_figure: 'आपकी संख्या', send: 'भेजें', with_you: '<b>{qty}</b> {label} अभी आपके पास ({biz} का रिकॉर्ड)', about: 'करीब',
    returned_some: 'कुछ वापस भेजा', how_many: 'कितना वापस भेजा?', ready: 'लेने को तैयार', ready_done: 'लेने को तैयार बताया', done_ok: 'धन्यवाद। {biz} को दिखेगा।', confirmed: 'आपने पुष्टि की · {date}',
    nothing: 'अभी जाँचने को कुछ नहीं।', what: 'यह क्या है?', what_body: '{biz} आपको दिए काम का हिसाब CLAIRE Connect पर रखता है। इस पेज पर सिर्फ़ {biz} के आपके साथ के रिकॉर्ड दिखते हैं। लॉगिन की ज़रूरत नहीं।',
    no_prices: 'कोई कीमत नहीं दिखाई जाती।', dpdp: 'आपका नाम और फ़ोन नंबर सिर्फ़ ये रिकॉर्ड दिखाने के लिए है। आपके जवाब सिर्फ़ {biz} को जाते हैं; किसी और को नहीं दिए जाते (DPDP अधिनियम, 2023)।',
    stop: 'ये अपडेट बंद करें', stopped: 'आपने ये अपडेट बंद किए। चाहें तो {biz} नया लिंक भेज सकता है।', view_only: 'यह {biz} का अपना फ़ोन है: देख सकते हैं, पर जवाब दूसरी तरफ़ से आना चाहिए।', gone: 'यह लिंक अब काम नहीं करता। भेजने वाले से नया माँगें।', busy: 'बहुत बार कोशिश हुई। एक मिनट रुकें।',
  },
};
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const fq = (base: number, dim: Dimension) => { const f = formatQty(base, dim); return `${f.value} ${f.unit}`; };
function sdate(d: string, lang: L) {
  try { return new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`)); } catch { return d; }
}

async function linkByToken(token: string) {
  if (!/^[\w-]{16,40}$/.test(token)) return null;
  const l: any = await col('sc_statement_links').findOne({ token_hash: sha(token) } as any);
  if (!l) return null;
  const biz: any = await col('businesses').findOne({ _id: l.recorder_business_id } as any, { projection: { name: 1, language: 1, flags: 1 } });
  if (!scOn(biz)) return null;
  return { l, biz };
}
/** The recorder's ctx for reads (owner view, then masked to this party's lines only). */
const recorderCtx = (l: any, lang: string): Ctx => ({ businessId: l.recorder_business_id, userId: `link:${l._id}`, role: 'owner', language: lang });
/** Who answers through the link: the party itself, labelled "via link" (evidence rank below an account). */
const linkCtx = (l: any): Ctx => ({ businessId: l.party.k === 'b' ? l.party.id : `c:${l.party.id}`, userId: `link:${l._id}`, role: 'staff', language: l.language ?? 'en' });

const SEND_ACTIONS = new Set(['send_for_work', 'sell', 'sample', 'returnable_sample', 'return_to_supplier']);
const BACK_ACTIONS = new Set(['return_from_work']);

async function pageData(l: any, lang: L) {
  const party = l.party as PartyRef;
  const movs = await col('sc_movements').find({ recorder_business_id: l.recorder_business_id, cancelled_at: null, $or: [{ 'to.party.k': party.k, 'to.party.id': party.id }, { 'from.party.k': party.k, 'from.party.id': party.id }], business_date: { $gte: new Date(Date.now() - 90 * 86400e3).toISOString().slice(0, 10) } } as any).sort({ business_date: -1, recorded_at: -1 }).limit(60).toArray();
  const items: { movementId: string; lineId: string; kind: 'received' | 'returned'; qty: number; dim: Dimension; unit: string; label: string; date: string; confirmed: string | null }[] = [];
  for (const m of movs as any[]) {
    const toThem = m.to.party.k === party.k && m.to.party.id === party.id;
    if (toThem ? !SEND_ACTIONS.has(m.action) : !BACK_ACTIONS.has(m.action)) continue;
    for (const line of m.lines as any[]) {
      const side = toThem ? line.received : line.sent;
      const theirs = (side as any[]).find((a) => a.evidence === 'link' || a.evidence === 'account' && a.by?.business_id !== l.recorder_business_id);
      const qty = winningAssertion(toThem ? line.sent : line.sent)?.base_qty ?? 0;
      items.push({ movementId: m._id, lineId: line.line_id, kind: toThem ? 'received' : 'returned', qty: theirs ? theirs.base_qty : qty, dim: line.dim, unit: line.entered?.unit ?? '', label: await genericLabel(line.spec_id), date: m.business_date, confirmed: theirs ? theirs.business_date : null });
    }
  }
  const jobs = (await jobSummaries(recorderCtx(l, lang), { performer: party })).filter((j) => j.pending > 0 && !j.cancelled);
  const withYou = [];
  for (const j of jobs) {
    const jd: any = await col('sc_jobs').findOne({ _id: j.id } as any, { projection: { inputs: 1, ready_at: 1 } });
    withYou.push({ jobId: j.id, qty: j.pending, dim: j.dim, approx: j.outputs > 0, label: await genericLabel(jd?.inputs?.[0]?.spec_id), ready: !!jd?.ready_at });
  }
  return { items, withYou };
}

function render(o: { lang: L; token: string; biz: string; name: string; data: Awaited<ReturnType<typeof pageData>> | null; stopped: boolean; viewOnly: boolean; flash: string | null; gone?: boolean }) {
  const t = T[o.lang];
  const v = { biz: esc(o.biz), name: esc(o.name), date: sdate(todayIST(), o.lang) };
  const act = (a: string) => `/api/l/${esc(o.token)}/${a}`;
  const dis = o.stopped || o.viewOnly ? ' disabled' : '';
  const open = o.data?.items.filter((i) => !i.confirmed) ?? [];
  const done = o.data?.items.filter((i) => i.confirmed).slice(0, 8) ?? [];
  const card = (i: (typeof open)[number]) => `<section class="c"><p>${fill(i.kind === 'received' ? t.received : t.returned, { ...v, qty: esc(fq(i.qty, i.dim)), label: esc(i.label), date: sdate(i.date, o.lang) })}</p>
<p class="q">${t.right}</p><form method="post" action="${act('confirm')}"><input type="hidden" name="m" value="${esc(i.movementId)}"><input type="hidden" name="l" value="${esc(i.lineId)}"><button${dis}>${t.correct}</button></form>
<details><summary>${t.differs}</summary><form method="post" action="${act('differs')}"><input type="hidden" name="m" value="${esc(i.movementId)}"><input type="hidden" name="l" value="${esc(i.lineId)}"><label>${t.your_figure} <input name="qty" inputmode="decimal" required size="6"> ${esc(i.dim === 'mass' ? 'kg' : i.dim === 'length' ? 'm' : 'pcs')}</label> <button${dis}>${t.send}</button></form></details></section>`;
  const body = o.gone ? `<p class="n">${t.gone}</p>` : `
<h1>${fill(t.title, v)}</h1><p class="m">${fill(t.for, v)}</p>
${o.flash ? `<p class="ok" role="status">${esc(o.flash)}</p>` : ''}${o.viewOnly ? `<p class="n">${fill(t.view_only, v)}</p>` : ''}${o.stopped ? `<p class="n">${fill(t.stopped, v)}</p>` : ''}
${open.slice(0, 20).map(card).join('\n') || `<p class="m">${t.nothing}</p>`}${open.length > 20 ? `<p class="m">${fill(t.older, { ...v, n: String(open.length - 20) })}</p>` : ''}
${(o.data?.withYou ?? []).slice(0, 12).map((w) => `<section class="c"><p>${fill(t.with_you, { ...v, qty: `${w.approx ? `${t.about} ` : ''}${esc(fq(w.qty, w.dim))}`, label: esc(w.label) })}</p>
<details><summary>${t.returned_some}</summary><form method="post" action="${act('propose')}"><input type="hidden" name="j" value="${esc(w.jobId)}"><label>${t.how_many} <input name="qty" inputmode="decimal" required size="6"> ${esc(w.dim === 'mass' ? 'kg' : w.dim === 'length' ? 'm' : 'pcs')}</label> <button${dis}>${t.send}</button></form></details>
${w.ready ? `<p class="m">✓ ${t.ready_done}</p>` : `<form method="post" action="${act('ready')}"><input type="hidden" name="j" value="${esc(w.jobId)}"><button class="g"${dis}>${t.ready}</button></form>`}</section>`).join('\n')}
${done.length ? `<ul class="d">${done.map((i) => `<li>${esc(fq(i.qty, i.dim))} ${esc(i.label)} · ${fill(t.confirmed, { date: sdate(i.confirmed!, o.lang) })}</li>`).join('')}</ul>` : ''}
<footer><h2>${t.what}</h2><p>${fill(t.what_body, v)}</p><p>${t.no_prices}</p><p>${fill(t.dpdp, v)}</p>
${o.stopped ? '' : `<form method="post" action="${act('stop')}"><button class="s"${o.viewOnly ? ' disabled' : ''}>${t.stop}</button></form>`}</footer>`;
  const langs = (['ta', 'hi', 'en'] as L[]).map((l) => (l === o.lang ? `<b>${l === 'ta' ? 'தமிழ்' : l === 'hi' ? 'हिन्दी' : 'English'}</b>` : `<a href="?lang=${l}">${l === 'ta' ? 'தமிழ்' : l === 'hi' ? 'हिन्दी' : 'English'}</a>`)).join(' · ');
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(o.biz)} · CLAIRE</title>
<style>:root{--ink:#1d2321;--ink2:#4a524f;--meta:#6b7370;--line:#e3e1db;--p:#2f7a5b;--bg:#faf8f4;--s:#fff;--ok:#e6f2ec;--n:#fbf1dd;--onp:#fff}@media(prefers-color-scheme:dark){:root{--ink:#eceae5;--ink2:#c5c2ba;--meta:#9a978f;--line:#34322e;--p:#6cc39b;--bg:#161514;--s:#1f1e1c;--ok:#1d3329;--n:#3a2f19;--onp:#0c1a13}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Noto Sans Tamil","Noto Sans Devanagari",sans-serif}main{max-width:480px;margin:0 auto;padding:16px}
h1{font-size:21px;line-height:1.3;margin:8px 0 2px}h2{font-size:15px;margin:0 0 4px}.m{color:var(--meta);font-size:14px;margin:2px 0 12px}.c{background:var(--s);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:10px 0}.c p{margin:0 0 6px}.q{color:var(--ink2);font-size:14px}
button{min-height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--p);background:var(--p);color:var(--onp);font:600 15px system-ui,sans-serif}button.g,button.s{background:transparent;color:var(--p)}button[disabled]{opacity:.5}form{display:inline-block;margin:4px 6px 4px 0}
details{margin:6px 0}summary{color:var(--p);font-weight:600;cursor:pointer;min-height:40px;padding-top:8px}input{font:inherit;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--s);color:var(--ink)}
.ok{background:var(--ok);padding:10px 12px;border-radius:12px}.n{background:var(--n);padding:10px 12px;border-radius:12px}.d{color:var(--meta);font-size:14px;padding-left:18px}footer{margin-top:24px;border-top:1px solid var(--line);padding-top:12px;color:var(--ink2);font-size:14px}nav{font-size:14px;color:var(--meta)}a{color:var(--p)}</style></head>
<body><main><nav>${langs}</nav>${body}</main>${o.gone ? '' : `<script>addEventListener('load',function(){setTimeout(function(){fetch('${act('seen')}',{method:'POST'})},1500)})</script>`}</body></html>`;
}

publicRouter.get('/l/:token', async (req: Request, res: Response) => {
  try {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' });
    const token = req.params.token;
    if (limited(req, token)) return res.status(429).type('html').send(render({ lang: 'en', token, biz: '', name: '', data: null, stopped: true, viewOnly: true, flash: T.en.busy }));
    const found = await linkByToken(token);
    const qLang = String(req.query.lang ?? '');
    if (!found) return res.status(404).type('html').send(render({ lang: (['ta', 'hi', 'en'].includes(qLang) ? qLang : 'en') as L, token, biz: '', name: '', data: null, stopped: true, viewOnly: true, flash: null, gone: true }));
    const { l, biz } = found;
    // Retired by the recorder (stopped or rotated away) or because both now use accounts: the link no longer works.
    if (l.stopped_at && l.stopped_by !== 'party') return res.status(404).type('html').send(render({ lang: (['ta', 'hi', 'en'].includes(qLang) ? qLang : l.language ?? 'en') as L, token, biz: '', name: '', data: null, stopped: true, viewOnly: true, flash: null, gone: true }));
    const lang = (['ta', 'hi', 'en'].includes(qLang) ? qLang : ['ta', 'hi', 'en'].includes(l.language) ? l.language : 'en') as L;
    const names = await partyNames(recorderCtx(l, lang), [l.party]);
    const data = l.stopped_at ? null : await pageData(l, lang);
    const flashKey = String(req.query.done ?? '');
    const flash = flashKey === 'ready' ? T[lang].ready_done : flashKey ? fill(T[lang].done_ok, { biz: biz.name }) : null;
    res.type('html').send(render({ lang, token, biz: biz.name, name: names.get(pk(l.party))?.name ?? '', data, stopped: !!l.stopped_at, viewOnly: await isRecorderDevice(req, l.recorder_business_id), flash }));
  } catch (e) {
    console.error('[statement] page failed', e);
    res.status(500).type('text').send('Something went wrong. Please try again.');
  }
});

publicRouter.post('/api/l/:token/:action(seen|confirm|differs|propose|ready|stop)', async (req: Request, res: Response) => {
  const token = req.params.token;
  const back = (done: string) => res.redirect(303, `/l/${encodeURIComponent(token)}?done=${done}`);
  try {
    if (limited(req, token)) return res.status(429).json({ error: T.en.busy });
    const found = await linkByToken(token);
    if (!found) return res.status(404).json({ error: 'Not found' });
    const { l } = found;
    const action = req.params.action;
    const now = Date.now();
    if (action === 'seen') {
      await col('sc_statement_links').updateOne({ _id: l._id, seen_at: null } as any, { $set: { seen_at: now } });
      return res.status(204).end();
    }
    if (l.stopped_at) return back('stopped');
    // The recorder's own phone can look but never answer for the other side.
    if (await isRecorderDevice(req, l.recorder_business_id)) return res.status(403).type('text').send(T.en.view_only.replace('{biz}', found.biz.name));
    const body = (req.body ?? {}) as Record<string, string>;
    const lc = linkCtx(l);
    const mark = { $set: { last_action_at: now, seen_at: l.seen_at ?? now } };
    if (action === 'stop') {
      await col('sc_statement_links').updateOne({ _id: l._id } as any, { $set: { stopped_at: now, stopped_by: 'party' } });
      return back('stopped');
    }
    if (action === 'confirm' || action === 'differs') {
      const m: any = await col('sc_movements').findOne({ _id: String(body.m), recorder_business_id: l.recorder_business_id, cancelled_at: null } as any);
      const line = m?.lines?.find((x: any) => x.line_id === String(body.l));
      const toThem = m && m.to.party.k === l.party.k && m.to.party.id === l.party.id;
      const fromThem = m && m.from.party.k === l.party.k && m.from.party.id === l.party.id;
      if (!line || !(toThem || fromThem)) return res.status(404).json({ error: 'Not found' });
      const info = await specInfo(line.spec_id);
      const unit = info.dim === 'mass' ? 'kg' : info.dim === 'length' ? 'm' : 'pcs';
      const base = action === 'differs' ? qtyBase(Number(String(body.qty).replace(',', '.')), unit, info).base : winningAssertion(line.sent)!.base_qty;
      if (toThem) await applyReceipt(lc, m._id, line.line_id, base, 'link', todayIST(), true);
      else await applySenderFigure(lc, m._id, line.line_id, base, todayIST(), 'link');
      await col('sc_statement_links').updateOne({ _id: l._id } as any, mark);
      return back(action);
    }
    const job: any = await col('sc_jobs').findOne({ _id: String(body.j), 'client_party.id': l.recorder_business_id, 'performer_party.k': l.party.k, 'performer_party.id': l.party.id, status: { $in: ['issued', 'in_progress', 'completed'] } } as any);
    if (!job) return res.status(404).json({ error: 'Not found' });
    if (action === 'ready') {
      await col('sc_jobs').updateOne({ _id: job._id } as any, { $set: { ready_at: now, ready_via: 'link' } });
      await col('sc_statement_links').updateOne({ _id: l._id } as any, mark);
      return back('ready');
    }
    // propose: "I returned some" → a proposal the recorder accepts (records Got back) or declines.
    const dim = job.inputs?.[0]?.dim as Dimension;
    const qty = Number(String(body.qty).replace(',', '.'));
    if (!(qty > 0) || qty > 10_000_000) return res.status(400).json({ error: 'Please enter a number.' });
    const qty_base = Math.round(dim === 'mass' ? qty * 1000 : dim === 'length' ? qty * 100 : qty);
    await col('sc_link_proposals').insertOne({ _id: newId('lp'), recorder_business_id: l.recorder_business_id, link_id: l._id, party: l.party, job_id: job._id, qty_base, dim, label: await genericLabel(job.inputs?.[0]?.spec_id), note: null, state: 'pending', at: now } as any);
    await col('sc_statement_links').updateOne({ _id: l._id } as any, mark);
    return back('propose');
  } catch (e) {
    const status = (e as any)?.status ?? 500;
    if (status >= 500) console.error('[statement] action failed', e);
    res.status(status).type('text').send((e as any)?.publicMessage ?? 'Something went wrong. Please try again.');
  }
});

