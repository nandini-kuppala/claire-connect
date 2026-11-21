// Record drafts (04 §9.2): Claire turns "I sent 400 polo kits to Lakshmi, S M only" into a draft card. Nothing is
// written until the user taps Save, which runs the same write path as the form (idempotent on the draft id).
import { Router } from 'express';
import { col } from '../../db/index.js';
import { h, HttpError } from '../../util.js';
import type { Ctx, ScRequest } from '../flag.js';
import { newId, positions } from '../repo.js';
import { jobSummaries, partyNames } from '../views.js';
import { sendForWork, gotBack } from '../records.js';
import { recordTrade } from '../trade.js';
import { upsertSpec } from '../setup.js';
import { toBase } from '../../../../shared/sc/units.js';
import { tenX } from '../../../../shared/sc/plausibility.js';
import { todayIST } from '../../../../shared/sc/dates.js';
import type { CardPayload } from '../../../../shared/cards.js';
import type { Dimension, PartyRef } from '../../../../shared/sc/types.js';
import { colourKey, isGrey, labelFits, materialKey } from './resolve.js';
import { q, shortDate, resolveParty } from './answer.js';
import { tr } from './strings.js';
import type { ToolCall } from './tools.js';

export type DraftCard = Extract<CardPayload, { kind: 'record_draft' }>;
type DraftArgs = Extract<ToolCall, { tool: 'draft_record' }>['args'];
const router = Router();
const EXPIRES_MS = 24 * 3600e3;

const PROCESS_WORDS: [RegExp, string][] = [
  [/dye|டையிங்|சாயம்|डाइंग|रंगाई/i, 'dyeing'], [/stitch|தையல்|ஸ்டிச்சிங்|सिलाई|स्टिच/i, 'stitching'], [/compact|காம்பாக்ட்|कॉम्पैक्ट/i, 'compacting'],
  [/knit|நிட்டிங்|निटिंग|बुनाई/i, 'knitting'], [/print|பிரிண்ட்|प्रिंट|छपाई/i, 'printing'], [/embroider|எம்ப்ராய்டரி|कढ़ाई/i, 'embroidery'],
  [/check|செக்கிங்|चेकिंग/i, 'checking'], [/iron|அயர்னிங்|इस्त्री|प्रेस/i, 'ironing'], [/pack|பேக்கிங்|पैकिंग/i, 'packing'], [/wash|வாஷிங்|धुलाई/i, 'garment_washing'],
  [/button|காஜா|काज/i, 'button_attach'],
];
// What work a material usually goes to, when the user didn't say (form → first process that takes it).
const PROCESS_FOR: Record<string, string> = { kit: 'stitching', cut_panel: 'printing_panels', knit_fabric: 'dyeing', yarn: 'knitting', garment: 'checking' };

const FORM_PROCESS: Record<string, string> = { kit: 'stitching', panel: 'printing_panels', fabric: 'dyeing', yarn: 'knitting', garment: 'checking' };
async function formOf(specId: string): Promise<string | null> {
  const sp: any = await col('sc_specs').findOne({ _id: specId } as any, { projection: { material_type_id: 1 } });
  const mt: any = sp ? await col('sc_material_types').findOne({ _id: sp.material_type_id } as any, { projection: { form: 1 } }) : null;
  return mt?.form ?? null;
}

interface Line { spec_id: string | null; label: string; qty: number; unit: string; dim: Dimension | null; lot: string | null; have?: number | null }

/** Specs this business knows: in my unit (with lots), then recently used. */
async function knownSpecs(ctx: Ctx) {
  const mine = (await positions(ctx, { tab: 'in' })).filter((r) => r.mine && r.key.t === 'real' && r.key.state.s === 'available' && r.qty_base > 0);
  const recent = await col('sc_recent_specs').find({ business_id: ctx.businessId } as any).sort({ used_at: -1 }).limit(60).toArray();
  const ids = [...new Set([...mine.map((r) => (r.key.t === 'real' ? r.key.spec : '')), ...recent.map((r: any) => r.spec_id)])];
  const specs = await col('sc_specs').find({ _id: { $in: ids } } as any).toArray();
  const mts = new Map((await col('sc_material_types').find({ _id: { $in: [...new Set(specs.map((s: any) => s.material_type_id))] } } as any).toArray()).map((m: any) => [m._id, m]));
  // Per spec, the lot with the most at my unit (a draft draws from one lot; the form can split lots).
  const stock = new Map<string, { qty: number; lot: string | null }>();
  for (const r of mine) if (r.key.t === 'real' && r.key.place === null && r.qty_base > (stock.get(r.key.spec)?.qty ?? 0)) stock.set(r.key.spec, { qty: r.qty_base, lot: r.key.lot });
  const order = new Map(ids.map((id, i) => [id, i]));
  return specs
    .map((s: any) => ({ id: s._id as string, label: s.label_en as string, attrs: (s.attrs ?? {}) as Record<string, any>, mtId: s.material_type_id as string, mtKey: (mts.get(s.material_type_id) as any)?.key as string, dim: (mts.get(s.material_type_id) as any)?.base_dimension as Dimension, stock: stock.get(s._id) ?? null }))
    .sort((a, b) => (a.stock ? 0 : 1) - (b.stock ? 0 : 1) || (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

function unitFor(said: string | undefined, dim: Dimension | null): string {
  if (said === 'sets') return 'pcs';
  if (said) return said;
  return dim === 'mass' ? 'kg' : dim === 'length' ? 'm' : 'pcs';
}

/** Lines for what the user said: a material + colour (+ sizes) matched to a spec they hold or used. */
async function linesFor(ctx: Ctx, args: DraftArgs, notes: string[], prefer: (label: string) => boolean): Promise<Line[]> {
  const specs = await knownSpecs(ctx);
  const out: Line[] = [];
  for (const l of args.lines) {
    const mk = materialKey(l.material) ?? materialKey(l.colour);
    const ck = colourKey(l.colour) ?? colourKey(l.material);
    const grey = isGrey(l.material) || isGrey(l.colour);
    const fits = specs.filter((s) => (!mk || s.mtKey === mk) && (!ck || String(s.attrs.colour ?? '').toLowerCase() === ck) && (!grey || s.attrs.state === 'grey') && labelFits(s.label, l.material, l.colour));
    const ranked = [...fits.filter((s) => prefer(s.label)), ...fits.filter((s) => !prefer(s.label))];
    const sizes = l.sizes?.map((x) => ({ size: x.size.toUpperCase(), qty: x.qty })) ?? [];
    if (sizes.length && ranked.length) {
      // Same style and colour as the best match, one line per size; quantities said per size, else split evenly.
      const base = ranked.find((s) => s.attrs.size) ?? ranked[0];
      const given = sizes.every((x) => x.qty);
      const even = Math.floor(l.qty / sizes.length);
      if (!given) notes.push('n_split');
      for (const [i, z] of sizes.entries()) {
        const sp = specs.find((s) => s.mtId === base.mtId && s.attrs.style === base.attrs.style && s.attrs.colour === base.attrs.colour && String(s.attrs.size).toUpperCase() === z.size)
          ?? (await upsertSpec(ctx, base.mtId, { ...base.attrs, size: z.size }).then((r) => (r ? { id: r.id, label: r.label_en, dim: base.dim, stock: null } : null)));
        const qty = given ? z.qty! : even + (i === 0 ? l.qty - even * sizes.length : 0);
        out.push({ spec_id: sp?.id ?? null, label: sp?.label ?? `${l.material ?? ''} ${z.size}`.trim(), qty, unit: unitFor(l.unit, base.dim), dim: base.dim, lot: sp && 'stock' in sp && sp.stock ? sp.stock.lot : null, have: sp && 'stock' in sp && sp.stock ? sp.stock.qty : 0 });
      }
      continue;
    }
    const sp = ranked[0] ?? null;
    if (!sp) notes.push('n_pick_material');
    out.push({ spec_id: sp?.id ?? null, label: sp?.label ?? [l.colour, l.material].filter(Boolean).join(' '), qty: l.qty, unit: unitFor(l.unit, sp?.dim ?? null), dim: sp?.dim ?? null, lot: sp?.stock?.lot ?? null, have: sp?.stock?.qty ?? 0 });
  }
  return out;
}

function base(line: Line): number {
  if (!line.dim) return 0;
  const r = toBase(line.qty, line.unit, line.dim);
  return r.ok ? r.base : 0;
}

/** Builds and stores a draft; returns its card (or a question to ask first). */
export async function makeDraft(ctx: Ctx, args: DraftArgs, loose: boolean, partyOverride?: PartyRef | null): Promise<DraftCard | { kind: 'chips'; text: string; chips: { id: string; label: string }[] } | { kind: 'text'; text: string }> {
  const lang = ctx.language;
  const notes: string[] = [];
  const p = partyOverride ? { ref: partyOverride, name: (await partyNames(ctx, [partyOverride])).get(`${partyOverride.k}:${partyOverride.id}`)?.name ?? null } : await resolveParty(ctx, args.party, loose);
  const draftId = newId('dr');
  if ('ask' in p && p.ask) {
    // Keep what was said; the party chip routes back into this draft (claire_sessions-like follow-up).
    await col('sc_drafts').insertOne({ _id: draftId, id: draftId, business_id: ctx.businessId, user_id: ctx.userId, args, state: 'pending_party', created_at: Date.now() } as any);
    return { ...p.ask, chips: p.ask.chips.map((c) => ({ ...c, id: `scd:${draftId}:${c.id.slice(4)}` })) };
  }
  if (!p.ref) notes.push('n_pick_party');

  // Got back: which open work at that party (matching the material if said).
  let job: any = null;
  let processKey: string | null = null;
  if (args.action === 'got_back' && p.ref) {
    const open = (await jobSummaries(ctx, { performer: p.ref })).filter((j) => j.pending > 0 && !j.cancelled);
    const said = args.lines.map((l) => [l.colour, l.material].filter(Boolean).join(' ')).join(' ');
    const fit = open.filter((j) => labelFits(j.inputLabel, said) || (j.outputLabel && labelFits(j.outputLabel, said)));
    job = (fit.length ? fit : open)[0] ?? null;
    if (!job) notes.push('n_pick_job');
    processKey = job?.process_key ?? null;
  }
  if (args.action === 'send_for_work') {
    const said = args.process ?? '';
    processKey = PROCESS_WORDS.find(([re]) => re.test(said))?.[1] ?? null;
    if (processKey === 'printing') processKey = args.lines.some((l) => materialKey(l.material) === 'knit_fabric') ? 'printing_fabric' : 'printing_panels';
  }

  // Got back prefers the job's own output (or input, for count-preserving work); a send prefers what's in stock.

  const lastOut = job ? (await col('sc_jobs').findOne({ _id: job.id } as any, { projection: { outputs: 1 } }))?.outputs?.at(-1)?.spec_id ?? null : null;
  const lastOutLabel = lastOut ? (await col('sc_specs').findOne({ _id: lastOut } as any, { projection: { label_en: 1 } }))?.label_en ?? '' : '';
  let lines = await linesFor(ctx, args, notes, (label) => (job ? label === lastOutLabel || label === job.outputLabel : true));
  if (job && lines.some((l) => !l.spec_id) && lastOut) {
    lines = lines.map((l) => (l.spec_id ? l : { ...l, spec_id: lastOut, label: lastOutLabel, dim: job.dim, unit: unitFor(args.lines[0]?.unit, job.dim) }));
    const i = notes.indexOf('n_pick_material');
    if (i >= 0) notes.splice(i, 1);
  }

  if (args.action === 'send_for_work' && !processKey) {
    // Not said: the last work this party did that takes this kind of material, else the usual work for it.
    const form = lines[0]?.spec_id ? await formOf(lines[0].spec_id) : null;
    if (p.ref) {
      const recent = await col('sc_jobs').find({ 'owner_party.id': ctx.businessId, 'performer_party.id': p.ref.id, in_house: { $ne: true } } as any, { sort: { created_at: -1 }, projection: { process_key: 1 } }).limit(10).toArray();
      for (const r of recent as any[]) {
        const pt: any = await col('sc_process_types').findOne({ key: r.process_key } as any, { projection: { input_forms: 1 } });
        if (!form || pt?.input_forms?.includes(form)) { processKey = r.process_key; break; }
      }
    }
    if (!processKey) processKey = PROCESS_FOR[materialKey(args.lines[0]?.material) ?? ''] ?? (form ? FORM_PROCESS[form] ?? null : null);
  }

  // Outgoing drafts: say up front when my unit has less than this (saving would be refused; the form can override).
  if ((args.action === 'send_for_work' || args.action === 'sell') && lines.some((l) => l.spec_id && (l.have ?? 0) < base(l))) notes.push('n_short');
  // Checks: ×10 against what was last sent to them; the same record already today.
  if (p.ref && lines[0]?.spec_id) {
    const prev = await col('sc_movements').findOne({ recorder_business_id: ctx.businessId, cancelled_at: null, 'lines.spec_id': lines[0].spec_id, $or: [{ 'to.party.id': p.ref.id }, { 'from.party.id': p.ref.id }] } as any, { sort: { recorded_at: -1 } });
    const usual = prev?.lines?.find((x: any) => x.spec_id === lines[0].spec_id)?.sent?.at(-1)?.base_qty ?? null;
    if (tenX(base(lines[0]), usual)) notes.push('n_tenx');
    const total = lines.reduce((a, l) => a + base(l), 0);
    const same = await col('sc_movements').find({ recorder_business_id: ctx.businessId, cancelled_at: null, business_date: todayIST(), $or: [{ 'to.party.id': p.ref.id }, { 'from.party.id': p.ref.id }] } as any).toArray();
    if (same.some((m: any) => (m.lines as any[]).reduce((a, l) => a + (l.sent?.at(-1)?.base_qty ?? 0), 0) === total)) notes.push('n_dup');
  }
  const day = args.day === 'yesterday' ? 1 : args.day === 'day_before' ? 2 : 0;
  const businessDate = new Date(Date.parse(`${todayIST()}T00:00:00Z`) - day * 86400e3).toISOString().slice(0, 10);
  const doc = {
    _id: draftId, id: draftId, business_id: ctx.businessId, user_id: ctx.userId, args, action: args.action, party: p.ref, party_name: p.name, process_key: processKey, job_id: job?.id ?? null,
    lines, notes: [...new Set(notes)], business_date: businessDate, state: 'draft', created_at: Date.now(), expires_at: Date.now() + EXPIRES_MS, movement_id: null,
  };
  await col('sc_drafts').insertOne(doc as any);
  return draftCard(ctx, doc);
}

export async function draftCard(ctx: Ctx, d: any): Promise<DraftCard> {
  const lang = ctx.language;
  const proc = d.process_key ? (await col('sc_process_types').findOne({ key: d.process_key } as any, { projection: { labels: 1 } })) : null;
  const procLabel = (proc as any)?.labels?.[lang] ?? (proc as any)?.labels?.en ?? '';
  const verb = tr(lang, `d_${d.action}` as 'd_buy', { process: procLabel.toLowerCase() || tr(lang, 'processes') });
  const date = d.business_date === todayIST() ? tr(lang, 'today') : shortDate(d.business_date, lang);
  const lines = (d.lines as Line[]).map((l) => ({ label: l.label, qty: l.dim ? q(base(l), l.dim) : `${l.qty} ${l.unit}` }));
  const party = d.party_name ? tr(lang, d.action === 'got_back' || d.action === 'buy' ? 'd_from' : 'd_to', { name: d.party_name }) : '';
  const expired = d.state === 'draft' && Date.now() > d.expires_at;
  const canSave = d.state === 'draft' && !expired && !!d.party && (d.lines as Line[]).every((l) => l.spec_id && base(l) > 0) && (d.action !== 'send_for_work' || !!d.process_key) && (d.action !== 'got_back' || !!d.job_id);
  const formHref = d.action === 'got_back' && d.job_id ? `/goods/job/${d.job_id}/return` : d.action === 'send_for_work' ? `/goods/record/send?draft=${d._id}` : `/goods/record/t/${d.action}`;
  return {
    kind: 'record_draft', draftId: d._id, header: tr(lang, 'd_header', { verb, tense: tr(lang, 'd_past'), date }),
    readBack: tr(lang, 'read_back', { verb, lines: lines.map((l) => `${l.qty} ${l.label}`).join(', '), party, date }),
    partyName: d.party_name ?? null, lines, notes: [...(d.notes as string[]).map((n) => tr(lang, n as 'n_split', { qty: lines[0]?.qty ?? '' })), ...(expired ? [tr(lang, 'expired')] : [])],
    state: expired ? 'expired' : d.state, canSave, formHref, movementId: d.movement_id ?? null,
  };
}

// ── Routes: read, save, cancel ──────────────────────────────────────────────────────────────────
async function myDraft(ctx: Ctx, id: string) {
  const d: any = await col('sc_drafts').findOne({ _id: id, business_id: ctx.businessId, user_id: ctx.userId } as any);
  if (!d) throw new HttpError(404, 'Not found');
  // Saved from the form ("Change") under the draft's id: the draft is saved too.
  if (d.state === 'draft') {
    const m: any = await col('sc_movements').findOne({ recorder_business_id: ctx.businessId, client_id: d._id, cancelled_at: null } as any, { projection: { _id: 1 } });
    if (m) {
      await col('sc_drafts').updateOne({ _id: d._id } as any, { $set: { state: 'saved', movement_id: m._id, saved_at: Date.now() } });
      Object.assign(d, { state: 'saved', movement_id: m._id });
    }
  }
  return d;
}

router.get(
  '/sc/drafts/:id',
  h(async (req: ScRequest, res) => {
    const d = await myDraft(req.ctx, req.params.id);
    const specs = await col('sc_specs').find({ _id: { $in: (d.lines ?? []).map((l: Line) => l.spec_id).filter(Boolean) } } as any).toArray();
    const mts = new Map((await col('sc_material_types').find({ _id: { $in: specs.map((s: any) => s.material_type_id) } } as any).toArray()).map((m: any) => [m._id, m]));
    res.json({
      card: await draftCard(req.ctx, d), action: d.action, party: d.party, party_name: d.party_name, process_key: d.process_key, job_id: d.job_id,
      lines: (d.lines ?? []).map((l: Line) => {
        const s: any = specs.find((x: any) => x._id === l.spec_id);
        const mt: any = s ? mts.get(s.material_type_id) : null;
        return { qty: l.qty, unit: l.unit, lot: l.lot, spec: s ? { spec: { id: s._id, material_type_id: s.material_type_id, attrs: s.attrs, label_en: s.label_en, family_key: s.family_key }, dimension: mt?.base_dimension, units: mt?.allowed_units ?? [], class: mt?.material_class_key } : null };
      }),
    });
  }),
);

router.post(
  '/sc/drafts/:id/save',
  h(async (req: ScRequest, res) => {
    const ctx = req.ctx;
    const d = await myDraft(ctx, req.params.id);
    if (d.state === 'saved') return res.json({ card: await draftCard(ctx, d) });
    const card = await draftCard(ctx, d);
    if (!card.canSave) return res.status(409).json({ error: tr(ctx.language, card.state === 'expired' ? 'expired' : 'open_form'), code: card.state === 'expired' ? 'expired' : 'incomplete', card });
    const lines = (d.lines as Line[]).map((l) => ({ spec_id: l.spec_id, qty: l.qty, unit: l.unit, ...(l.lot ? { lot: l.lot } : {}) }));
    // The draft id is the client id: a double tap or a retry never records twice.
    const r = d.action === 'send_for_work'
      ? await sendForWork(ctx, { to: d.party, process_key: d.process_key, lines, business_date: d.business_date, client_id: d._id })
      : d.action === 'got_back'
        ? await gotBack(ctx, { lines, business_date: d.business_date, client_id: d._id }, d.job_id)
        : await recordTrade(ctx, { kind: d.action, party: d.party, lines, business_date: d.business_date, client_id: d._id });
    if (r.status >= 300) return res.status(r.status).json({ ...r.body, card });
    const movementId = r.body?.movement?.id ?? r.body?.movement?._id ?? null;
    await col('sc_drafts').updateOne({ _id: d._id } as any, { $set: { state: 'saved', movement_id: movementId, saved_at: Date.now() } });
    res.json({ card: await draftCard(ctx, { ...d, state: 'saved', movement_id: movementId }), movement: { id: movementId }, undo_until: r.body?.undo_until ?? null });
  }),
);

router.post(
  '/sc/drafts/:id/cancel',
  h(async (req: ScRequest, res) => {
    const d = await myDraft(req.ctx, req.params.id);
    if (d.state === 'draft') await col('sc_drafts').updateOne({ _id: d._id } as any, { $set: { state: 'cancelled' } });
    res.json({ card: await draftCard(req.ctx, { ...d, state: d.state === 'draft' ? 'cancelled' : d.state }) });
  }),
);

export default router;
