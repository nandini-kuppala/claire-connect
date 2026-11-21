// Specs are content-addressed (model §3.2): material type + normalised spec attributes. The same spec typed twice
// is one row. Only attributes with role 'spec' are part of identity; 'lot' and 'info' attributes are not.

export interface AttrDef {
  key: string;
  role: 'spec' | 'lot' | 'info';
  type: 'text' | 'number' | 'enum';
  enum?: string[];
  required?: boolean;
}

export interface MaterialTypeDef {
  id: string;
  key: string;
  base_dimension: 'mass' | 'count' | 'length';
  allowed_units: string[];
  material_class_key: 'weighed' | 'counted';
  attributes: AttrDef[];
  labels: { en: string; ta: string; hi: string };
}

export type SpecAttrs = Record<string, string | number>;

export type NormaliseResult = { ok: true; attrs: SpecAttrs; identity: string } | { ok: false; missing: string[]; invalid: string[] };

const normText = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Normalises spec attributes and returns the identity string the server hashes into the spec id. */
export function normaliseSpec(mt: MaterialTypeDef, raw: Record<string, unknown>): NormaliseResult {
  const attrs: SpecAttrs = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const a of mt.attributes.filter((x) => x.role === 'spec')) {
    const v = raw[a.key];
    if (v === undefined || v === null || v === '') {
      if (a.required) missing.push(a.key);
      continue;
    }
    if (a.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) invalid.push(a.key);
      else attrs[a.key] = n;
    } else if (a.type === 'enum') {
      const t = normText(v);
      if (a.enum && !a.enum.includes(t)) invalid.push(a.key);
      else attrs[a.key] = t;
    } else {
      const t = normText(v);
      if (t.length > 60) invalid.push(a.key);
      else attrs[a.key] = t;
    }
  }
  if (missing.length || invalid.length) return { ok: false, missing, invalid };
  const identity = `${mt.id}|${Object.keys(attrs).sort().map((k) => `${k}=${attrs[k]}`).join('|')}`;
  return { ok: true, attrs, identity };
}

/** A short human label: "Navy single jersey 180 GSM" (English; screens add the material label in the user's language). */
export function specLabel(mt: MaterialTypeDef, attrs: SpecAttrs): string {
  const order = ['state', 'colour', 'structure', 'kind', 'component', 'style', 'fibre', 'count', 'gsm', 'size', 'length_in', 'width_mm'];
  const parts: string[] = [];
  for (const k of order) {
    const v = attrs[k];
    if (v === undefined) continue;
    parts.push(k === 'gsm' ? `${v} GSM` : k === 'length_in' ? `${v}"` : k === 'width_mm' ? `${v} mm` : String(v));
  }
  for (const [k, v] of Object.entries(attrs)) if (!order.includes(k)) parts.push(String(v));
  const s = parts.join(' ') || mt.labels.en;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
