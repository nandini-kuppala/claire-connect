// Plausibility checks (model §10, 03 §6.5). They never block silently; they ask with chips.

const near = (ratio: number, target: number, tol: number) => Math.abs(ratio - target) <= target * tol;

/**
 * Unit-slip check: compares an entry with the open remainder (or the other side's figure).
 * Returns the factor the entry is probably off by (12, 144, 1000 or their inverses), or null.
 */
export function unitSlip(entered: number, reference: number, unitSource: 'typed' | 'defaulted' | 'parsed' = 'typed'): number | null {
  if (entered <= 0 || reference <= 0) return null;
  const tol = unitSource === 'defaulted' ? 0.1 : 0.05;
  const ratio = reference / entered;
  for (const f of [12, 144, 1000]) {
    if (near(ratio, f, tol)) return f;
    if (near(ratio, 1 / f, tol)) return 1 / f;
  }
  return null;
}

/**
 * ×10 / ÷10 check for spoken numbers (ஐம்பது/ஐநூறு, पचास/पाँच सौ): an entry 10× or a tenth of this party's and
 * material's usual quantity, or of the stock it draws from, is questioned (03 §6.5).
 */
export function tenX(entered: number, usual: number | null | undefined): 10 | 0.1 | null {
  if (!usual || usual <= 0 || entered <= 0) return null;
  const ratio = entered / usual;
  if (near(ratio, 10, 0.25)) return 10;
  if (near(ratio, 0.1, 0.25)) return 0.1;
  return null;
}

/** Real holdings never go negative (model §5.4). */
export const wouldGoNegative = (balance: number, delta: number) => balance + delta < 0;

/** Received far beyond sent (model §10.4): e.g. 1,100 % of the dispatch. */
export const receivedImplausible = (sent: number, received: number) => sent > 0 && received > sent * 1.5;
