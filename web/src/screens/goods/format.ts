// Display helpers for Goods screens: quantities with units (Indian grouping, Western digits) and short dates.
import { formatQty } from '@shared/sc/units';
import type { Dimension } from '@shared/sc/types';

export function qty(base: number, dim: Dimension | string): string {
  const f = formatQty(base, dim as Dimension);
  return `${f.value} ${f.unit}`;
}

/** Just the number, for "400 of 600 pcs". */
export function qtyNum(base: number, dim: Dimension | string): string {
  return String(formatQty(base, dim as Dimension).value);
}

/** "14 Nov" / "14 நவ." / "14 नव॰" from a YYYY-MM-DD business date. */
export function shortDate(d: string | null | undefined, lang: string): string {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00Z`);
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt);
  } catch {
    return d;
  }
}

/** A client id for offline-safe retries (04 §5.4). */
export const clientId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
