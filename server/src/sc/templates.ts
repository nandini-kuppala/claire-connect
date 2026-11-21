// Built-in material types and process types (BRIEF §5.1: data, not code). Sources: docs/supply-chain/research/
// materials-units.md (attributes, units) and lead-times-losses.md (turnaround and loss defaults).
// Businesses can add their own rows with owner_business_id set; built-ins have owner_business_id: null.
import { col } from '../db/index.js';
import type { ConservationKind, Dimension, RateBasis } from '../../../shared/sc/types.js';

type L = { en: string; ta: string; hi: string };
interface Attr { key: string; role: 'spec' | 'lot' | 'info'; type: 'text' | 'number' | 'enum'; enum?: string[]; required?: boolean }
interface MaterialType { key: string; form: string; base_dimension: Dimension; allowed_units: string[]; material_class_key: 'weighed' | 'counted'; attributes: Attr[]; labels: L }
interface ProcessType { key: string; input_forms: string[]; output_forms: string[]; conservation_kind: ConservationKind; rate_basis: RateBasis; billable_grades: string[]; itc04_nature: string; default_turnaround_days: number; rework_turnaround_days: number; loss_norm_pct: number; labels: L }

const colour: Attr = { key: 'colour', role: 'spec', type: 'text' };

export const MATERIAL_TYPES: MaterialType[] = [
  { key: 'knit_fabric', form: 'fabric', base_dimension: 'mass', allowed_units: ['kg', 'g', 'rolls'], material_class_key: 'weighed',
    attributes: [{ key: 'state', role: 'spec', type: 'enum', enum: ['grey', 'rfd', 'dyed', 'finished', 'printed'], required: true }, { key: 'structure', role: 'spec', type: 'enum', enum: ['single jersey', 'lycra single jersey', 'interlock', 'rib 1x1', 'rib 2x2', 'pique', 'fleece', 'french terry', 'waffle'], required: true }, { key: 'fibre', role: 'spec', type: 'text' }, { key: 'gsm', role: 'spec', type: 'number' }, { key: 'dia', role: 'spec', type: 'number' }, { key: 'width_form', role: 'spec', type: 'enum', enum: ['tubular', 'open-width'] }, colour, { key: 'dye_lot', role: 'lot', type: 'text' }, { key: 'roll_no', role: 'info', type: 'text' }],
    labels: { en: 'Knitted fabric', ta: 'பனியன் துணி', hi: 'होज़री कपड़ा' } },
  { key: 'yarn', form: 'yarn', base_dimension: 'mass', allowed_units: ['kg', 'g', 'bags'], material_class_key: 'weighed',
    attributes: [{ key: 'fibre', role: 'spec', type: 'text', required: true }, { key: 'count', role: 'spec', type: 'text', required: true }, { key: 'spinning', role: 'spec', type: 'enum', enum: ['carded', 'combed', 'compact', 'open-end', 'filament'] }, colour, { key: 'lot_no', role: 'lot', type: 'text' }],
    labels: { en: 'Yarn', ta: 'நூல்', hi: 'धागा' } },
  { key: 'collar_cuff', form: 'component', base_dimension: 'count', allowed_units: ['pcs', 'dozen', 'sets'], material_class_key: 'counted',
    attributes: [{ key: 'kind', role: 'spec', type: 'enum', enum: ['collar', 'cuff', 'collar+cuff set'] }, colour, { key: 'size', role: 'spec', type: 'text' }],
    labels: { en: 'Collar / cuff', ta: 'காலர் / கஃப்', hi: 'कॉलर / कफ़' } },
  { key: 'cut_panel', form: 'panel', base_dimension: 'count', allowed_units: ['pcs', 'dozen', 'bundles'], material_class_key: 'counted',
    attributes: [{ key: 'style', role: 'spec', type: 'text', required: true }, { key: 'component', role: 'spec', type: 'enum', enum: ['front', 'back', 'sleeve', 'neck rib', 'placket', 'pocket', 'hood', 'waistband'] }, colour, { key: 'size', role: 'spec', type: 'text' }, { key: 'fabric_lot', role: 'lot', type: 'text' }],
    labels: { en: 'Cut panels', ta: 'கட்டிங் பேனல்', hi: 'कटे पैनल' } },
  { key: 'kit', form: 'kit', base_dimension: 'count', allowed_units: ['sets', 'pcs', 'dozen', 'bundles'], material_class_key: 'counted',
    attributes: [{ key: 'style', role: 'spec', type: 'text', required: true }, colour, { key: 'size', role: 'spec', type: 'text' }, { key: 'fabric_lot', role: 'lot', type: 'text' }],
    labels: { en: 'Cut kits', ta: 'கிட்', hi: 'किट' } },
  { key: 'garment', form: 'garment', base_dimension: 'count', allowed_units: ['pcs', 'dozen'], material_class_key: 'counted',
    attributes: [{ key: 'style', role: 'spec', type: 'text', required: true }, colour, { key: 'size', role: 'spec', type: 'text' }, { key: 'lot', role: 'lot', type: 'text' }],
    labels: { en: 'Garments', ta: 'ஆடைகள்', hi: 'कपड़े (गारमेंट)' } },
  { key: 'packed_garment', form: 'pack', base_dimension: 'count', allowed_units: ['pcs', 'dozen', 'boxes'], material_class_key: 'counted',
    attributes: [{ key: 'style', role: 'spec', type: 'text', required: true }, colour, { key: 'size', role: 'spec', type: 'text' }, { key: 'pack', role: 'spec', type: 'text' }],
    labels: { en: 'Packed goods', ta: 'பேக் செய்த சரக்கு', hi: 'पैक माल' } },
  { key: 'thread', form: 'trim', base_dimension: 'length', allowed_units: ['m', 'cones'], material_class_key: 'counted',
    attributes: [{ key: 'kind', role: 'spec', type: 'text' }, { key: 'tex', role: 'spec', type: 'text' }, colour],
    labels: { en: 'Thread', ta: 'நூல் கோன்', hi: 'सिलाई धागा' } },
  { key: 'button', form: 'trim', base_dimension: 'count', allowed_units: ['pcs', 'gross', 'dozen'], material_class_key: 'counted',
    attributes: [{ key: 'kind', role: 'spec', type: 'text' }, { key: 'ligne', role: 'spec', type: 'number' }, colour],
    labels: { en: 'Buttons', ta: 'பட்டன்', hi: 'बटन' } },
  { key: 'zip', form: 'trim', base_dimension: 'count', allowed_units: ['pcs', 'gross', 'dozen'], material_class_key: 'counted',
    attributes: [{ key: 'length_in', role: 'spec', type: 'number' }, colour],
    labels: { en: 'Zips', ta: 'ஜிப்', hi: 'ज़िप' } },
  { key: 'label', form: 'trim', base_dimension: 'count', allowed_units: ['pcs', 'gross'], material_class_key: 'counted',
    attributes: [{ key: 'kind', role: 'spec', type: 'enum', enum: ['main', 'size', 'care', 'price tag'] }, { key: 'brand', role: 'spec', type: 'text' }],
    labels: { en: 'Labels and tags', ta: 'லேபிள்', hi: 'लेबल' } },
  { key: 'elastic', form: 'trim', base_dimension: 'length', allowed_units: ['m'], material_class_key: 'counted',
    attributes: [{ key: 'width_mm', role: 'spec', type: 'number' }, colour], labels: { en: 'Elastic', ta: 'எலாஸ்டிக்', hi: 'इलास्टिक' } },
  { key: 'packing_material', form: 'trim', base_dimension: 'count', allowed_units: ['pcs', 'gross'], material_class_key: 'counted',
    attributes: [{ key: 'kind', role: 'spec', type: 'enum', enum: ['polybag', 'carton', 'tag', 'hanger', 'tissue'] }, { key: 'size', role: 'spec', type: 'text' }],
    labels: { en: 'Packing material', ta: 'பேக்கிங் பொருள்', hi: 'पैकिंग सामान' } },
  { key: 'unspecified_mass', form: 'any', base_dimension: 'mass', allowed_units: ['kg', 'g'], material_class_key: 'weighed', attributes: [{ key: 'note', role: 'info', type: 'text' }], labels: { en: 'Other (by weight)', ta: 'மற்றவை (எடை)', hi: 'अन्य (वज़न)' } },
  { key: 'unspecified_count', form: 'any', base_dimension: 'count', allowed_units: ['pcs', 'dozen'], material_class_key: 'counted', attributes: [{ key: 'note', role: 'info', type: 'text' }], labels: { en: 'Other (by pieces)', ta: 'மற்றவை (பீஸ்)', hi: 'अन्य (पीस)' } },
  { key: 'unspecified_length', form: 'any', base_dimension: 'length', allowed_units: ['m'], material_class_key: 'counted', attributes: [{ key: 'note', role: 'info', type: 'text' }], labels: { en: 'Other (by length)', ta: 'மற்றவை (நீளம்)', hi: 'अन्य (लंबाई)' } },
];

export const PROCESS_TYPES: ProcessType[] = [
  { key: 'knitting', input_forms: ['yarn'], output_forms: ['fabric'], conservation_kind: 'mass_losing', rate_basis: 'per_input_mass', billable_grades: ['A', 'B'], itc04_nature: 'knitting', default_turnaround_days: 4, rework_turnaround_days: 3, loss_norm_pct: 2, labels: { en: 'Knitting', ta: 'நிட்டிங்', hi: 'निटिंग' } },
  { key: 'dyeing', input_forms: ['fabric', 'yarn'], output_forms: ['fabric', 'yarn'], conservation_kind: 'mass_losing', rate_basis: 'per_input_mass', billable_grades: ['A', 'B'], itc04_nature: 'dyeing', default_turnaround_days: 6, rework_turnaround_days: 7, loss_norm_pct: 7, labels: { en: 'Dyeing', ta: 'டையிங்', hi: 'डाइंग' } },
  { key: 'compacting', input_forms: ['fabric'], output_forms: ['fabric'], conservation_kind: 'mass_losing', rate_basis: 'per_input_mass', billable_grades: ['A', 'B'], itc04_nature: 'compacting', default_turnaround_days: 2, rework_turnaround_days: 2, loss_norm_pct: 1, labels: { en: 'Compacting', ta: 'காம்பாக்டிங்', hi: 'कॉम्पैक्टिंग' } },
  { key: 'printing_fabric', input_forms: ['fabric'], output_forms: ['fabric'], conservation_kind: 'mass_losing', rate_basis: 'per_input_mass', billable_grades: ['A'], itc04_nature: 'printing', default_turnaround_days: 5, rework_turnaround_days: 4, loss_norm_pct: 1.5, labels: { en: 'Fabric printing', ta: 'துணி பிரிண்டிங்', hi: 'कपड़ा छपाई' } },
  { key: 'printing_panels', input_forms: ['panel', 'garment'], output_forms: ['panel', 'garment'], conservation_kind: 'count_preserving', rate_basis: 'per_good_output_piece', billable_grades: ['A'], itc04_nature: 'printing', default_turnaround_days: 4, rework_turnaround_days: 3, loss_norm_pct: 1.5, labels: { en: 'Printing', ta: 'பிரிண்டிங்', hi: 'प्रिंटिंग' } },
  { key: 'embroidery', input_forms: ['panel', 'garment'], output_forms: ['panel', 'garment'], conservation_kind: 'count_preserving', rate_basis: 'per_good_output_piece', billable_grades: ['A'], itc04_nature: 'embroidery', default_turnaround_days: 4, rework_turnaround_days: 3, loss_norm_pct: 1, labels: { en: 'Embroidery', ta: 'எம்ப்ராய்டரி', hi: 'कढ़ाई' } },
  { key: 'cutting', input_forms: ['fabric'], output_forms: ['panel', 'kit'], conservation_kind: 'unit_changing', rate_basis: 'per_output_piece', billable_grades: ['A', 'B'], itc04_nature: 'cutting', default_turnaround_days: 1, rework_turnaround_days: 1, loss_norm_pct: 8, labels: { en: 'Cutting', ta: 'கட்டிங்', hi: 'कटिंग' } },
  { key: 'stitching', input_forms: ['kit', 'panel', 'trim', 'component'], output_forms: ['garment'], conservation_kind: 'assembling', rate_basis: 'per_good_output_piece', billable_grades: ['A', 'B'], itc04_nature: 'stitching', default_turnaround_days: 6, rework_turnaround_days: 3, loss_norm_pct: 2, labels: { en: 'Stitching', ta: 'தையல்', hi: 'सिलाई' } },
  { key: 'button_attach', input_forms: ['garment', 'trim'], output_forms: ['garment'], conservation_kind: 'count_preserving', rate_basis: 'per_good_output_piece', billable_grades: ['A'], itc04_nature: 'kaja-button', default_turnaround_days: 2, rework_turnaround_days: 1, loss_norm_pct: 0.5, labels: { en: 'Kaja and buttons', ta: 'காஜா பட்டன்', hi: 'काज बटन' } },
  { key: 'checking', input_forms: ['garment'], output_forms: ['garment'], conservation_kind: 'count_preserving', rate_basis: 'per_output_piece', billable_grades: ['A', 'B', 'rework', 'reject'], itc04_nature: 'checking', default_turnaround_days: 1, rework_turnaround_days: 1, loss_norm_pct: 0, labels: { en: 'Checking', ta: 'செக்கிங்', hi: 'चेकिंग' } },
  { key: 'ironing', input_forms: ['garment'], output_forms: ['garment'], conservation_kind: 'count_preserving', rate_basis: 'per_output_piece', billable_grades: ['A', 'B'], itc04_nature: 'ironing', default_turnaround_days: 1, rework_turnaround_days: 1, loss_norm_pct: 0, labels: { en: 'Ironing', ta: 'அயர்னிங்', hi: 'प्रेस' } },
  { key: 'packing', input_forms: ['garment', 'trim'], output_forms: ['pack'], conservation_kind: 'assembling', rate_basis: 'per_output_piece', billable_grades: ['A', 'B'], itc04_nature: 'packing', default_turnaround_days: 1, rework_turnaround_days: 1, loss_norm_pct: 0, labels: { en: 'Packing', ta: 'பேக்கிங்', hi: 'पैकिंग' } },
  { key: 'garment_washing', input_forms: ['garment'], output_forms: ['garment'], conservation_kind: 'count_preserving', rate_basis: 'per_output_piece', billable_grades: ['A', 'B'], itc04_nature: 'washing', default_turnaround_days: 3, rework_turnaround_days: 2, loss_norm_pct: 0.5, labels: { en: 'Garment washing', ta: 'கார்மென்ட் வாஷிங்', hi: 'गारमेंट वॉशिंग' } },
];

/** Upserts the built-in templates (idempotent). Ids are stable: mt_<key>, pt_<key>. */
export async function ensureTemplates() {
  const now = Date.now();
  await Promise.all([
    ...MATERIAL_TYPES.map((m, order) => col('sc_material_types').updateOne({ _id: `mt_${m.key}` } as any, { $set: { ...m, order, id: `mt_${m.key}`, owner_business_id: null, updated_at: now } }, { upsert: true })),
    ...PROCESS_TYPES.map((p, order) => col('sc_process_types').updateOne({ _id: `pt_${p.key}` } as any, { $set: { ...p, order, id: `pt_${p.key}`, owner_business_id: null, calendar: 'default', updated_at: now } }, { upsert: true })),
  ]);
}
