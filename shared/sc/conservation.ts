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
