// Conservation per job input line (model §5.2) and the read-time "approx. still at the performer" (P7).
import type { ConservationKind } from './types.js';

export interface CloseSplit {
  intoOutput: number;
  loss: number;
  residual: number;
  /** A negative loss (gain) or a residual of either sign is flagged for review, never hidden. */
  flags: ('gain' | 'residual')[];
}

/**
 * Splits what leaves allocated(J) at closure (`consumed`) into into_output + loss + residual.
 * `intoOutput` is already expressed in the input's dimension (e.g. pcs × g/pc for cutting).
 */
export function closeSplit(kind: ConservationKind, consumed: number, intoOutput: number, declaredLoss = 0): CloseSplit {
  const flags: CloseSplit['flags'] = [];
  switch (kind) {
    case 'mass_losing': {
      const loss = consumed - intoOutput;
      if (loss < 0) flags.push('gain');
      return { intoOutput, loss, residual: 0, flags };
    }
    case 'count_preserving':
    case 'unit_changing': {
      const residual = consumed - intoOutput;
      if (residual !== 0) flags.push('residual');
      return { intoOutput, loss: 0, residual, flags };
    }
    case 'assembling': {
      const residual = consumed - intoOutput - declaredLoss;
      if (residual !== 0) flags.push('residual');
      return { intoOutput, loss: declaredLoss, residual, flags };
    }
    case 'disassembling': {
      const residual = consumed - intoOutput;
      if (residual !== 0) throw new Error(`unpacking must conserve exactly: residual ${residual}`);
      return { intoOutput, loss: 0, residual: 0, flags };
    }
  }
}

export interface PendingInput {
  kind: ConservationKind;
  /** Issued, on the received basis (P6), in the input's base atoms. */
  issued: number;
  /** Outputs so far in the output's base atoms. */
  outputs: number;
  /** mass_losing: the usual loss fraction (0.07 = 7 %). unit_changing: input atoms per output unit. assembling: 1. */
  factor: number;
  byProducts?: number;
  /** Returned unprocessed, forwarded, leftovers, scrapped input (input atoms). */
  dispositions?: number;
}

export interface Pending {
  /** Approx. input still at the performer, in input atoms (never below 0). */
  input: number;
  /** The same expressed as expected output (e.g. navy kg after the usual loss); null when not meaningful. */
  asOutput: number | null;
  /** Outputs already exceed what the inputs should yield: "over-yield, check". */
  overYield: boolean;
}

/** Read-time estimate (P7): issued − output-equivalents − by-products − dispositions. Always labelled as an estimate. */
export function approxPending(i: PendingInput): Pending {
  let outputEquivalent: number;
  let toOutput: ((x: number) => number) | null;
  switch (i.kind) {
    case 'mass_losing':
      outputEquivalent = i.outputs / (1 - i.factor);
      toOutput = (x) => x * (1 - i.factor);
      break;
    case 'unit_changing':
      outputEquivalent = i.outputs * i.factor;
      toOutput = (x) => x / i.factor;
      break;
    default:
      outputEquivalent = i.outputs * (i.factor || 1);
      toOutput = (x) => x / (i.factor || 1);
  }
  const raw = i.issued - outputEquivalent - (i.byProducts ?? 0) - (i.dispositions ?? 0);
  const input = Math.max(0, Math.round(raw));
  return { input, asOutput: toOutput ? Math.round(toOutput(input)) : null, overYield: raw < -0.5 };
}

/** Loss percentage from the performer's declared outputs (P6), never from the receiver's weighing. */
export const lossPct = (issued: number, declaredOutputs: number) =>
  issued > 0 ? Math.round(((issued - declaredOutputs) / issued) * 1000) / 10 : 0;

// ── Job closure plan (model §4.2, §5.2; 04 §5.6.7) ───────────────────────────────────────────────

/** One allocated(J) holding row at closure, after leftovers were taken out. */
export interface ClosureLine {
  id: string;
  dim: 'mass' | 'count' | 'length';
  qty: number;
  role: 'primary' | 'secondary';
  /** Lines in one group share outputs (same component); different groups each consume up to the outputs (assembling). */
  group: string;
  size?: string | null;
}

export interface ClosureOutput {
  dim: 'mass' | 'count' | 'length';
  qty: number;
  size?: string | null;
}

export interface ClosurePlanLine {
  id: string;
  consumed: number;
  intoOutput: number;
  loss: number;
  residual: number;
}

export interface ClosurePlan {
  lines: ClosurePlanLine[];
  /** Primary goods not accounted for (counted: missing pieces; cutting: unexplained kg, either sign). */
  residual: number;
  /** mass_losing: total process loss (negative = gain). */
  loss: number;
  lossPct: number | null;
  /** Outputs above what the inputs can yield (counted). */
  overYield: number;
  /** The split could not be checked (cutting with no weight per piece, unpacking). */
  unchecked: boolean;
}

/** Splits `total` across `weights` in proportion, in whole atoms; the last share takes the rounding. */
function prorate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  let left = total;
  return weights.map((w, i) => {
    if (i === weights.length - 1) return left;
    const share = Math.round((total * w) / sum);
    left -= share;
    return share;
  });
}

/**
 * What leaves allocated(J) at closure, line by line: consumed = into_output + loss + residual (model §5.2).
 * - Secondary lines (trims, packing) are used up: into_output = qty (leftovers were taken out before).
 * - mass_losing: into_output = outputs in the same dimension, loss = the rest (negative = gain), prorated.
 * - count_preserving / assembling: outputs matched by size first, then any size; the rest is residual.
 *   Lines in the same `group` share outputs; for assembling, each group consumes up to the outputs on its own
 *   (a top and a bottom both go into one set).
 * - unit_changing (cutting): `estimateInto` (pieces × weight per piece + waste, in input atoms) when known,
 *   residual = the rest (either sign); unknown → everything into output, unchecked.
 * - disassembling: everything into output, unchecked.
 */
export function planClosure(kind: ConservationKind, lines: ClosureLine[], outputs: ClosureOutput[], opts: { estimateInto?: number | null } = {}): ClosurePlan {
  const plan: ClosurePlan = { lines: [], residual: 0, loss: 0, lossPct: null, overYield: 0, unchecked: false };
  const primary = lines.filter((l) => l.role === 'primary' && l.qty > 0);
  for (const l of lines) if (l.role === 'secondary' && l.qty > 0) plan.lines.push({ id: l.id, consumed: l.qty, intoOutput: l.qty, loss: 0, residual: 0 });
  if (!primary.length) return plan;
  const dim = primary[0].dim;
  const same = primary.filter((l) => l.dim === dim);
  const consumed = same.reduce((a, l) => a + l.qty, 0);
  const sameOut = outputs.filter((o) => o.dim === dim);
  const push = (l: ClosureLine, into: number, loss: number, residual: number) => plan.lines.push({ id: l.id, consumed: l.qty, intoOutput: into, loss, residual });

  if (kind === 'mass_losing') {
    const out = sameOut.reduce((a, o) => a + o.qty, 0);
    const into = prorate(out, same.map((l) => l.qty));
    same.forEach((l, i) => push(l, into[i], l.qty - into[i], 0));
    plan.loss = consumed - out;
    plan.lossPct = consumed > 0 ? Math.round((plan.loss / consumed) * 1000) / 10 : null;
  } else if (kind === 'unit_changing' || kind === 'disassembling') {
    const est = kind === 'unit_changing' && opts.estimateInto != null ? Math.round(opts.estimateInto) : null;
    if (est === null) {
      plan.unchecked = true;
      same.forEach((l) => push(l, l.qty, 0, 0));
    } else {
      const into = prorate(est, same.map((l) => l.qty));
      same.forEach((l, i) => push(l, into[i], 0, l.qty - into[i]));
      plan.residual = consumed - est;
    }
  } else {
    // count_preserving, assembling: match outputs to lines, by size first.
    const groups = new Map<string, ClosureLine[]>();
    for (const l of same) groups.set(kind === 'assembling' ? l.group : 'all', [...(groups.get(kind === 'assembling' ? l.group : 'all') ?? []), l]);
    let maxOver = 0;
    for (const g of groups.values()) {
      const left = sameOut.map((o) => ({ ...o }));
      const into = new Map<string, number>(g.map((l) => [l.id, 0]));
      const take = (l: ClosureLine, pool: typeof left) => {
        for (const o of pool) {
          const room = l.qty - into.get(l.id)!;
          if (room <= 0) break;
          const n = Math.min(room, o.qty);
          o.qty -= n;
          into.set(l.id, into.get(l.id)! + n);
        }
      };
      for (const l of g) if (l.size) take(l, left.filter((o) => o.size === l.size));
      for (const l of g) take(l, left);
      for (const l of g) push(l, into.get(l.id)!, 0, l.qty - into.get(l.id)!);
      maxOver = Math.max(maxOver, left.reduce((a, o) => a + o.qty, 0));
    }
    plan.overYield = maxOver;
    plan.residual = plan.lines.filter((x) => same.some((l) => l.id === x.id)).reduce((a, x) => a + x.residual, 0);
  }
  for (const l of primary.filter((l) => l.dim !== dim)) push(l, l.qty, 0, 0);
  return plan;
}
