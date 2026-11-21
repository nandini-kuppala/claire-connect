// Units and conversions (model §3.2, §10). Base atoms: g, pc, cm. Conversions are valid, contextual or refused.
import type { Dimension } from './types.js';

export type Unit = 'kg' | 'g' | 't' | 'pcs' | 'dozen' | 'gross' | 'm' | 'cm' | 'rolls' | 'cones' | 'bundles' | 'sets' | 'bags' | 'boxes';

interface UnitDef {
  dim: Dimension;
  /** Base atoms per unit, or null when the factor depends on the material (contextual). */
  factor: number | null;
}

export const UNITS: Record<Unit, UnitDef> = {
  g: { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1000 },
  t: { dim: 'mass', factor: 1_000_000 },
  pcs: { dim: 'count', factor: 1 },
  sets: { dim: 'count', factor: 1 },
  dozen: { dim: 'count', factor: 12 },
  gross: { dim: 'count', factor: 144 },
  cm: { dim: 'length', factor: 1 },
  m: { dim: 'length', factor: 100 },
  // Contextual: a roll's weight or a cone's length varies by lot, so a factor must be given (and the result is approximate).
  rolls: { dim: 'mass', factor: null },
  cones: { dim: 'length', factor: null },
  bundles: { dim: 'count', factor: null },
  bags: { dim: 'mass', factor: null },
  boxes: { dim: 'count', factor: null },
};

export type ToBase =
  | { ok: true; base: number; dim: Dimension; approx: boolean }
  | { ok: false; reason: 'unknown_unit' | 'wrong_dimension' | 'needs_factor' | 'not_a_number' | 'negative' };

/**
 * Converts an entered value to base atoms for a material whose base dimension is `dim`.
 * `factor` (base atoms per unit) is required for contextual units such as rolls or cones.
 */
export function toBase(value: number, unit: string, dim: Dimension, factor?: number): ToBase {
  if (!Number.isFinite(value)) return { ok: false, reason: 'not_a_number' };
  if (value < 0) return { ok: false, reason: 'negative' };
  const def = UNITS[unit as Unit];
  if (!def) return { ok: false, reason: 'unknown_unit' };
  if (def.factor === null) {
    if (!factor || factor <= 0) return { ok: false, reason: 'needs_factor' };
    // A contextual unit converts into the material's own dimension (rolls of fabric → g; cones of thread → cm).
    return { ok: true, base: Math.round(value * factor), dim, approx: true };
  }
  if (def.dim !== dim) return { ok: false, reason: 'wrong_dimension' };
  return { ok: true, base: Math.round(value * def.factor), dim, approx: false };
}

/** Units a user may pick for a material of this dimension (contextual ones only when the material allows them). */
export function unitsFor(dim: Dimension, contextual: Unit[] = []): Unit[] {
  const fixed = (Object.keys(UNITS) as Unit[]).filter((u) => UNITS[u].factor !== null && UNITS[u].dim === dim && u !== 't');
  return [...fixed, ...contextual];
}

/** Indian digit grouping (1,23,45,678) with Western digits, whatever the UI language (ui-principles §2). */
export function groupIndian(n: number, decimals = 0): string {
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${neg ? '−' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** Formats base atoms for display: grams as kg (1 decimal when needed), pieces as pcs, centimetres as m. */
export function formatQty(base: number, dim: Dimension): { value: string; unit: string } {
  if (dim === 'mass') {
    // Up to 2 decimals below 10 kg and 1 above, with no trailing zeros (1.4 kg, 198.6 kg, 0.25 kg).
    const kg = Number((base / 1000).toFixed(Math.abs(base) < 10_000 ? 2 : 1));
    const decimals = Number.isInteger(kg) ? 0 : String(kg).split('.')[1].length;
    return { value: groupIndian(kg, decimals), unit: 'kg' };
  }
  if (dim === 'length') {
    const m = base / 100;
    return { value: groupIndian(m, Number.isInteger(m) ? 0 : 1), unit: 'm' };
  }
  return { value: groupIndian(base), unit: 'pcs' };
}

/** "600 pcs (50 dozen)" when a count divides evenly into dozens (model §10.7). */
export function dozenHint(pcs: number): string | null {
  return pcs >= 24 && pcs % 12 === 0 ? `${groupIndian(pcs / 12)} dozen` : null;
}
