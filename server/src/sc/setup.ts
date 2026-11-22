// Slice 0.5 setup routes (05 §2): contacts, the party picker, places, specs and aliases, terms, rate cards,
// process offerings and capability confirmation. All scoped by the Ctx from the token.
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { col } from '../db/index.js';
import { h, HttpError } from '../util.js';
import { normalizePhone } from '../routes/auth.js';
import { requireOwner, type ScRequest } from './flag.js';
import { newId } from './repo.js';
import { nameForms } from './translit.js';
import { normaliseSpec, specLabel, type MaterialTypeDef } from '../../../shared/sc/specs.js';
import { DEFAULT_TOLERANCE, type PartyRef } from '../../../shared/sc/types.js';

// Mounted inside sc/routes.ts, after requireAuth + requireSc.
const router = Router();

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, 'Please check the details and try again.');
  return r.data;
};

const partyRef = z.object({ k: z.enum(['b', 'c']), id: z.string().min(1).max(64) });

/** A party ref the caller may use: its own contacts, or any business on the platform. Never another business's contact. */
async function assertUsableParty(ctx: ScRequest['ctx'], p: PartyRef) {
  if (p.k === 'c') {
    const c = await col('sc_contacts').findOne({ _id: p.id, owner_business_id: ctx.businessId } as any, { projection: { _id: 1 } });
    if (!c) throw new HttpError(404, 'Not found');
  } else {
    if (p.id === ctx.businessId) throw new HttpError(400, 'Pick another business, not your own.');
    const b = await col('businesses').findOne({ _id: p.id } as any, { projection: { _id: 1 } });
    if (!b) throw new HttpError(404, 'Not found');
  }
}

// ── Contacts (off-platform counterparties, model §3.1) ───────────────────────────────────────────

const contactBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional(),
  language: z.enum(['en', 'ta', 'hi', 'te', 'kn', 'ml', 'bn', 'or', 'mr', 'gu']).optional(),
  address: z.string().trim().max(200).optional(),
  gstin: z.string().trim().max(15).optional(),
  role_hint: z.string().trim().max(40).optional(),
});

router.get(
  '/sc/contacts',
  h(async (req: ScRequest, res) => {
    const rows = await col('sc_contacts').find({ owner_business_id: req.ctx.businessId } as any).sort({ name: 1 }).limit(500).toArray();
    res.json({ contacts: rows });
  }),
);

router.post(
  '/sc/contacts',
  h(async (req: ScRequest, res) => {
    const b = parse(contactBody, req.body);
    const phones = b.phone ? [normalizePhone(b.phone)] : [];
    if (phones.length && (await col('sc_contacts').findOne({ owner_business_id: req.ctx.businessId, phones: phones[0] } as any))) {
      throw new HttpError(409, 'You already have a contact with this number.');
    }
    const id = newId('ct');
    const doc = {
      _id: id, id, owner_business_id: req.ctx.businessId, name: b.name, name_forms: await nameForms(b.name), phones,
      language: b.language ?? null, address: b.address ?? null, gstin: b.gstin ?? null, role_hint: b.role_hint ?? null,
      linked_business_id: null, link_state: 'unlinked', created_by: req.ctx.userId, created_at: Date.now(), updated_at: Date.now(),
    };
    await col('sc_contacts').insertOne(doc as any);
    res.status(201).json({ contact: doc });
  }),
);

router.patch(
  '/sc/contacts/:id',
  h(async (req: ScRequest, res) => {
    const b = parse(contactBody.partial(), req.body);
    const set: Record<string, unknown> = { updated_at: Date.now() };
    if (b.name) Object.assign(set, { name: b.name, name_forms: await nameForms(b.name) });
    if (b.phone !== undefined) set.phones = b.phone ? [normalizePhone(b.phone)] : [];
    for (const k of ['language', 'address', 'gstin', 'role_hint'] as const) if (b[k] !== undefined) set[k] = b[k] || null;
    const r = await col('sc_contacts').findOneAndUpdate({ _id: req.params.id, owner_business_id: req.ctx.businessId } as any, { $set: set }, { returnDocument: 'after' });
    if (!r) throw new HttpError(404, 'Not found');
    res.json({ contact: r });
  }),
);

// ── Party picker: my contacts + businesses I trade with + a name search on the platform ───────────

router.get(
  '/sc/parties',
  h(async (req: ScRequest, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 40);
    const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const contacts = await col('sc_contacts')
      .find({ owner_business_id: req.ctx.businessId, link_state: { $ne: 'linked' }, archived_at: { $exists: false }, ...(rx ? { $or: [{ name: rx }, { 'name_forms.ta': rx }, { 'name_forms.hi': rx }, { 'name_forms.en': rx }, { phones: rx }] } : {}) } as any)
      .limit(30)
      .toArray();
    const convs = await col('conversations').find({ business_ids: req.ctx.businessId, kind: { $in: ['deal', 'goods'] } } as any, { projection: { business_ids: 1 } }).limit(100).toArray();
    const linked = await col('sc_contacts').find({ owner_business_id: req.ctx.businessId, link_state: 'linked' } as any, { projection: { linked_business_id: 1 } }).toArray();
    const tradeIds = [...new Set([...convs.flatMap((c: any) => c.business_ids as string[]), ...linked.map((c: any) => c.linked_business_id as string)].filter((x) => x && x !== req.ctx.businessId))];
    const bizFilter: any = rx ? { $or: [{ name: rx }, { owner_name: rx }] } : { _id: { $in: tradeIds } };
    const businesses = await col('businesses').find({ ...bizFilter, _id: { ...(bizFilter._id ?? {}), $ne: req.ctx.businessId } } as any, { projection: { name: 1, role_label: 1, city: 1, area: 1, language: 1 } }).limit(20).toArray();
    res.json({
      parties: [
        ...contacts.map((c: any) => ({ ref: { k: 'c', id: c._id }, name: c.name, kind: 'contact', sub: c.role_hint ?? null, onClaire: c.link_state === 'linked', language: c.language })),
        ...businesses.map((b: any) => ({ ref: { k: 'b', id: b._id }, name: b.name, kind: 'business', sub: [b.role_label, b.area || b.city].filter(Boolean).join(' · '), onClaire: true, recent: tradeIds.includes(b._id), language: b.language })),
      ],
    });
  }),
);

// ── My places (model §3.1, AB) ────────────────────────────────────────────────────────────────────

router.get(
  '/sc/places',
  h(async (req: ScRequest, res) => {
    res.json({ places: await col('sc_places').find({ business_id: req.ctx.businessId } as any).sort({ created_at: 1 }).toArray() });
  }),
);

router.post(
  '/sc/places',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ name: z.string().trim().min(2).max(60), kind: z.enum(['godown', 'floor', 'shop', 'other']).default('godown'), address: z.string().trim().max(200).optional() }), req.body);
    const id = newId('pl');
    const doc = { _id: id, id, business_id: req.ctx.businessId, name: b.name, kind: b.kind, address: b.address ?? null, created_at: Date.now() };
    await col('sc_places').insertOne(doc as any);
    res.status(201).json({ place: doc });
  }),
);

// ── Specs (content-addressed) and my aliases ─────────────────────────────────────────────────────

async function materialType(ctx: ScRequest['ctx'], id: string): Promise<MaterialTypeDef> {
  const mt = await col('sc_material_types').findOne({ _id: id, owner_business_id: { $in: [null, ctx.businessId] } } as any);
  if (!mt) throw new HttpError(404, 'Not found');
  return mt as unknown as MaterialTypeDef;
}

const specId = (identity: string) => `sp_${crypto.createHash('sha1').update(identity).digest('base64url').slice(0, 20)}`;

/** Content-addressed spec for a material type + attributes (also used by Claire's drafts). Null when incomplete. */
export async function upsertSpec(ctx: ScRequest['ctx'], materialTypeId: string, attrs: Record<string, unknown>): Promise<{ id: string; label_en: string } | null> {
  const mt = await materialType(ctx, materialTypeId);
  const n = normaliseSpec(mt, attrs);
  if (!n.ok) return null;
  const id = specId(n.identity);
  const family_key = `${mt.key}|${n.attrs.structure ?? n.attrs.kind ?? n.attrs.style ?? ''}`;
  const label_en = specLabel(mt, n.attrs);
  await col('sc_specs').updateOne({ _id: id } as any, { $set: { label_en }, $setOnInsert: { id, material_type_id: mt.id, attrs: n.attrs, family_key, created_at: Date.now() } }, { upsert: true });
  return { id, label_en };
}

router.post(
  '/sc/specs/resolve',
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ material_type_id: z.string(), attrs: z.record(z.string(), z.unknown()), alias: z.string().trim().min(1).max(40).optional() }), req.body);
    const mt = await materialType(req.ctx, b.material_type_id);
    const n = normaliseSpec(mt, b.attrs);
    if (!n.ok) return res.status(400).json({ error: 'Please fill the missing details.', code: 'spec_incomplete', missing: n.missing, invalid: n.invalid });
    const id = specId(n.identity);
    const family_key = `${mt.key}|${n.attrs.structure ?? n.attrs.kind ?? n.attrs.style ?? ''}`;
    await col('sc_specs').updateOne({ _id: id } as any, { $set: { label_en: specLabel(mt, n.attrs) }, $setOnInsert: { id, material_type_id: mt.id, attrs: n.attrs, family_key, created_at: Date.now() } }, { upsert: true });
    if (b.alias) {
      await col('sc_aliases').updateOne({ business_id: req.ctx.businessId, alias: b.alias.toLowerCase() } as any, { $set: { spec_id: id, updated_at: Date.now() }, $setOnInsert: { _id: newId('al') } }, { upsert: true });
    }
    await col('sc_recent_specs').updateOne({ _id: `${req.ctx.businessId}|${id}` } as any, { $set: { business_id: req.ctx.businessId, spec_id: id, used_at: Date.now() } }, { upsert: true });
    res.json({ spec: await col('sc_specs').findOne({ _id: id } as any), dimension: mt.base_dimension, units: mt.allowed_units, class: mt.material_class_key });
  }),
);

/** Search: my aliases first, then my recent specs; free text matches the English label. */
router.get(
  '/sc/specs',
  h(async (req: ScRequest, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase().slice(0, 40);
    const aliases = await col('sc_aliases').find({ business_id: req.ctx.businessId, ...(q ? { alias: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } } : {}) } as any).limit(10).toArray();
    const recent = await col('sc_recent_specs').find({ business_id: req.ctx.businessId } as any).sort({ used_at: -1 }).limit(20).toArray();
    const ids = [...new Set([...aliases.map((a: any) => a.spec_id), ...recent.map((r: any) => r.spec_id)])];
    const specs = await col('sc_specs').find({ _id: { $in: ids } } as any).toArray();
    const byId = new Map(specs.map((s: any) => [s._id, s]));
    const matches = (s: any) => !q || String(s.label_en).toLowerCase().includes(q);
    res.json({
      aliases: aliases.map((a: any) => ({ alias: a.alias, spec: byId.get(a.spec_id) })).filter((x) => x.spec),
      recent: recent.map((r: any) => byId.get(r.spec_id)).filter((s) => s && matches(s)),
    });
  }),
);

/** A size × colour grid → one content-addressed spec per cell (03 §6.2). Same attributes + colour + size. */
router.post(
  '/sc/specs/resolve-grid',
  h(async (req: ScRequest, res) => {
    const b = parse(z.object({ material_type_id: z.string(), base: z.record(z.string(), z.unknown()), colours: z.array(z.string().trim().min(1).max(30)).min(1).max(8), sizes: z.array(z.string().trim().min(1).max(10)).min(1).max(12) }), req.body);
    const mt = await materialType(req.ctx, b.material_type_id);
    const cells: Record<string, Record<string, unknown>> = {};
    for (const colour of b.colours) {
      cells[colour] = {};
      for (const size of b.sizes) {
        const n = normaliseSpec(mt, { ...b.base, colour, size });
        if (!n.ok) return res.status(400).json({ error: 'Please fill the missing details.', code: 'spec_incomplete', missing: n.missing, invalid: n.invalid });
        const id = specId(n.identity);
        const family_key = `${mt.key}|${n.attrs.style ?? ''}`;
        await col('sc_specs').updateOne({ _id: id } as any, { $set: { label_en: specLabel(mt, n.attrs) }, $setOnInsert: { id, material_type_id: mt.id, attrs: n.attrs, family_key, created_at: Date.now() } }, { upsert: true });
        cells[colour][size] = { id, label_en: specLabel(mt, n.attrs), material_type_id: mt.id, attrs: n.attrs, family_key };
      }
    }
    res.json({ cells, dimension: mt.base_dimension, units: mt.allowed_units, class: mt.material_class_key });
  }),
);

// ── Styles: size set and trims per piece (model §3.2; snapshotted onto jobs) ─────────────────────

router.get(
  '/sc/styles',
  h(async (req: ScRequest, res) => {
    const styles = await col('sc_styles').find({ business_id: req.ctx.businessId } as any).sort({ code: 1 }).toArray();
    // Trims come back resolved, so a send form can add them as lines without another lookup.
    const ids = [...new Set(styles.flatMap((st: any) => (st.trims ?? []).map((t: any) => t.spec_id)))];
    const specs = await col('sc_specs').find({ _id: { $in: ids } } as any).toArray();
    const mts = await col('sc_material_types').find({ _id: { $in: [...new Set(specs.map((x: any) => x.material_type_id))] } } as any).toArray();
    const mtBy = new Map(mts.map((m: any) => [m._id, m]));
    const resolved = new Map(specs.map((x: any) => { const m: any = mtBy.get(x.material_type_id); return [x._id, { spec: x, dimension: m?.base_dimension, units: m?.allowed_units ?? [], class: m?.material_class_key }]; }));
    res.json({ styles: styles.map((st: any) => ({ ...st, trims: (st.trims ?? []).map((t: any) => ({ ...t, resolved: resolved.get(t.spec_id) ?? null })) })) });
  }),
);

router.post(
  '/sc/styles',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const b = parse(
      z.object({
        code: z.string().trim().min(1).max(30), name: z.string().trim().max(60).optional(), size_set: z.array(z.string().trim().min(1).max(10)).min(1).max(12),
        set_weight_g: z.number().positive().max(10_000).nullable().optional(),
        trims: z.array(z.object({ spec_id: z.string(), per_piece: z.number().positive().max(1000), unit: z.string().max(10), spare_pct: z.number().min(0).max(50).default(2) })).max(20),
      }),
      req.body,
    );
    for (const t of b.trims) if (!(await col('sc_specs').findOne({ _id: t.spec_id } as any, { projection: { _id: 1 } }))) throw new HttpError(400, 'Please pick the trims again.');
    const code = b.code.toUpperCase();
    const _id = `st_${req.ctx.businessId}_${code}`;
    await col('sc_styles').updateOne({ _id } as any, { $set: { id: _id, business_id: req.ctx.businessId, code, name: b.name ?? null, size_set: b.size_set.map((x) => x.toUpperCase()), trims: b.trims, ...(b.set_weight_g !== undefined ? { set_weight_g: b.set_weight_g } : {}), updated_at: Date.now() } }, { upsert: true });
    res.status(201).json({ style: await col('sc_styles').findOne({ _id } as any) });
  }),
);

// ── Terms per party (relationship, private; model §3.1, P8) ───────────────────────────────────────

const relId = (bizId: string, p: PartyRef) => `rel_${bizId}_${p.k}_${p.id}`;
export const DEFAULT_TERMS = {
  weighing_loss_bearer: 'owner' as 'owner' | 'performer' | 'sender' | 'receiver',
  transit_risk: 'buyer' as 'buyer' | 'seller',
  bill_basis: 'received' as 'received' | 'sender_weight',
  billable_reject_causes: [] as string[],
  tolerance: { weighed_pct: DEFAULT_TOLERANCE.weighedPct, counted_abs: DEFAULT_TOLERANCE.countedAbs },
};

router.get(
  '/sc/parties/:k/:id/terms',
  h(async (req: ScRequest, res) => {
    const p = parse(partyRef, { k: req.params.k, id: req.params.id });
    await assertUsableParty(req.ctx, p);
    const rel = await col('sc_relationships').findOne({ _id: relId(req.ctx.businessId, p) } as any);
    res.json({ terms: { ...DEFAULT_TERMS, ...(rel?.terms ?? {}) }, isDefault: !rel?.terms, language: rel?.language ?? null });
  }),
);

router.put(
  '/sc/parties/:k/:id/terms',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const p = parse(partyRef, { k: req.params.k, id: req.params.id });
    await assertUsableParty(req.ctx, p);
    const t = parse(
      z.object({
        weighing_loss_bearer: z.enum(['owner', 'performer', 'sender', 'receiver']),
        transit_risk: z.enum(['buyer', 'seller']),
        bill_basis: z.enum(['received', 'sender_weight']),
        billable_reject_causes: z.array(z.string().max(30)).max(10),
        tolerance: z.object({ weighed_pct: z.number().min(0).max(10), counted_abs: z.number().int().min(0).max(100) }),
      }),
      req.body,
    );
    await col('sc_relationships').updateOne({ _id: relId(req.ctx.businessId, p) } as any, { $set: { business_id: req.ctx.businessId, party: p, terms: t, updated_at: Date.now() } }, { upsert: true });
    res.json({ terms: t });
  }),
);

// ── Rate cards (owner only, effective-dated; W) ──────────────────────────────────────────────────

router.get(
  '/sc/rates',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const filter: any = { business_id: req.ctx.businessId };
    if (req.query.k && req.query.id) filter.party = { k: req.query.k, id: req.query.id };
    res.json({ rates: await col('sc_rate_cards').find(filter).sort({ effective_from: -1 }).limit(100).toArray() });
  }),
);

router.post(
  '/sc/rates',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const b = parse(
      z.object({
        party: partyRef,
        process_key: z.string().max(40).optional(),
        spec_family: z.string().max(80).optional(),
        basis: z.enum(['per_input_mass', 'per_good_output_piece', 'per_output_piece', 'lump_sum', 'per_unit']),
        value_paise: z.number().int().min(0).max(100_000_000),
        effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
      req.body,
    );
    await assertUsableParty(req.ctx, b.party);
    // Close the previous open card for the same party/process/spec family the day before the new one starts.
    const prevEnd = new Date(Date.parse(`${b.effective_from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    await col('sc_rate_cards').updateMany(
      { business_id: req.ctx.businessId, party: b.party, process_key: b.process_key ?? null, spec_family: b.spec_family ?? null, effective_to: null, effective_from: { $lt: b.effective_from } } as any,
      { $set: { effective_to: prevEnd } },
    );
    const id = newId('rc');
    const doc = { _id: id, id, business_id: req.ctx.businessId, ...b, process_key: b.process_key ?? null, spec_family: b.spec_family ?? null, effective_to: null, created_at: Date.now() };
    await col('sc_rate_cards').insertOne(doc as any);
    res.status(201).json({ rate: doc });
  }),
);

// ── Process offerings (job workers; discovery and default turnaround) ────────────────────────────

router.get(
  '/sc/offerings',
  h(async (req: ScRequest, res) => {
    const b = await col('businesses').findOne({ _id: req.ctx.businessId } as any, { projection: { process_offerings: 1 } });
    res.json({ offerings: b?.process_offerings ?? [] });
  }),
);

router.put(
  '/sc/offerings',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const list = parse(
      z.array(z.object({ process_key: z.string().max(40), capacity_per_day: z.number().min(0).max(1_000_000).optional(), capacity_unit: z.enum(['kg', 'pcs']).optional(), min_lot: z.number().min(0).optional(), turnaround_days: z.number().int().min(0).max(120).optional() })).max(20),
      req.body?.offerings,
    );
    await col('businesses').updateOne({ _id: req.ctx.businessId } as any, { $set: { process_offerings: list } });
    res.json({ offerings: list });
  }),
);

// ── Capabilities: derived from today's sells/buys + role label, confirmed once (04 §11) ──────────

const CAP_FROM_CATEGORY: Record<string, string> = {
  'service.stitching': 'stitching', 'service.printing': 'printing', 'service.dyeing': 'dyeing', 'fabric.knit': 'fabric', 'yarn.cotton': 'yarn',
};
const CAP_FROM_ROLE: [RegExp, string][] = [
  [/stitch/i, 'stitching'], [/dye/i, 'dyeing'], [/print/i, 'printing'], [/knit/i, 'knitting'], [/yarn/i, 'yarn'],
  [/manufactur|brand/i, 'garments'], [/wholesal|reseller|retail/i, 'selling_garments'], [/trim/i, 'trims'], [/fabric/i, 'fabric'],
];

export function deriveCapabilities(b: { sells?: string[]; role_label?: string }): string[] {
  const caps = new Set<string>();
  for (const c of b.sells ?? []) {
    if (CAP_FROM_CATEGORY[c]) caps.add(CAP_FROM_CATEGORY[c]);
    else if (c.startsWith('garment.')) caps.add('garments');
  }
  for (const [rx, cap] of CAP_FROM_ROLE) if (rx.test(b.role_label ?? '')) caps.add(cap);
  return [...caps];
}

router.get(
  '/sc/capabilities',
  h(async (req: ScRequest, res) => {
    const b = await col('businesses').findOne({ _id: req.ctx.businessId } as any, { projection: { sells: 1, buys: 1, role_label: 1, capabilities: 1, capabilities_confirmed_at: 1 } });
    res.json({ suggested: deriveCapabilities(b ?? {}), capabilities: b?.capabilities ?? null, confirmed: !!b?.capabilities_confirmed_at });
  }),
);

router.post(
  '/sc/capabilities',
  requireOwner,
  h(async (req: ScRequest, res) => {
    const caps = parse(z.array(z.enum(['knitting', 'dyeing', 'printing', 'embroidery', 'cutting', 'stitching', 'checking_packing', 'fabric', 'trims', 'yarn', 'transport', 'garments', 'selling_garments'])).max(13), req.body?.capabilities);
    await col('businesses').updateOne({ _id: req.ctx.businessId } as any, { $set: { capabilities: caps, capabilities_confirmed_at: Date.now() } });
    res.json({ capabilities: caps, confirmed: true });
  }),
);

export default router;
