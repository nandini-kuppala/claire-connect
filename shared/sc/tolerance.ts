// Weighing / counting tolerance (model §3.10, §4.1). Classified only when a line is final (04 §5.6.4).
import type { MaterialClass, ToleranceRule } from './types.js';
import { DEFAULT_TOLERANCE } from './types.js';

export type ToleranceOutcome = 'exact' | 'within' | 'beyond' | 'over';

export interface Classified {
  outcome: ToleranceOutcome;
  /** sent − received (positive = short). */
  difference: number;
  /** Allowed absolute difference in base atoms. */
  allowed: number;
  pct: number;
}

export function classify(sent: number, received: number, cls: MaterialClass, rule: ToleranceRule = DEFAULT_TOLERANCE): Classified {
  const difference = sent - received;
  const pct = sent > 0 ? Math.round((Math.abs(difference) / sent) * 1000) / 10 : 0;
  const allowed = cls === 'weighed' ? Math.floor((sent * rule.weighedPct) / 100) : rule.countedAbs;
  if (difference === 0) return { outcome: 'exact', difference, allowed, pct };
  if (Math.abs(difference) <= allowed) return { outcome: 'within', difference, allowed, pct };
  return { outcome: difference > 0 ? 'beyond' : 'over', difference, allowed, pct };
}
