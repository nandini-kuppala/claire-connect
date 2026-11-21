// Supply-chain domain types (docs/supply-chain/02-domain-model.md, 04-technical-design.md).
// Quantities are integers in base atoms: grams (mass), pieces (count) or centimetres (length).

export type Dimension = 'mass' | 'count' | 'length';
export const BASE_UNIT: Record<Dimension, 'g' | 'pc' | 'cm'> = { mass: 'g', count: 'pc', length: 'cm' };

/** A business on the platform, or an off-platform contact owned by one business. */
export type PartyRef = { k: 'b'; id: string } | { k: 'c'; id: string };

export type Grade = 'A' | 'B' | 'rework' | 'reject' | 'scrap';

export type HeldReason = 'qc' | 'rejected_on_receipt' | 'dues' | 'detained' | 'customer_hold' | 'found_pending' | 'unmatched';

/** Holding state (model §3.3). `ref` is the movement, job or discrepancy the state belongs to. */
export type HoldingState =
  | { s: 'available' }
  | { s: 'allocated'; ref: string } // job id
  | { s: 'in_transit'; ref: string } // movement id
  | { s: 'disputed'; ref: string } // discrepancy id
  | { s: 'ready'; ref: string } // job id
  | { s: 'held'; reason: HeldReason; ref?: string };

/** A real holding: someone owns it and someone holds it (model P3). */
export interface RealKey {
  t: 'real';
  spec: string;
  lot: string | null;
  grade: Grade;
  owner: PartyRef;
  custodian: PartyRef;
  via: PartyRef | null;
  place: string | null;
  state: HoldingState;
}

export type PseudoKind = 'EXTERNAL' | 'CONSUMED' | 'LOSS' | 'RESIDUAL' | 'ADJUSTMENT' | 'WRITTEN_OFF' | 'SOLD_TO_MARKET';

/** Pseudo-holdings may go negative (model §3.3). */
export interface PseudoKey {
  t: 'pseudo';
  kind: PseudoKind;
  /** EXTERNAL: party; CONSUMED/RESIDUAL: job id; LOSS: loss kind; ADJUSTMENT/WRITTEN_OFF: reason. */
  ref: string;
  spec: string;
  lot: string | null;
  grade: Grade;
  /** The party whose books this pseudo-holding belongs to (owner of the goods that flowed in or out). */
  owner: PartyRef;
  /** LOSS only: who bears it. */
  attributedTo?: PartyRef | null;
}

export type HoldingKey = RealKey | PseudoKey;

export interface Posting {
  key: HoldingKey;
  /** Signed quantity in base atoms of `dim`. */
  delta: number;
  dim: Dimension;
}

/** The six internal evidence levels (model §3.4), strongest first. */
export const EVIDENCE_RANK = ['account', 'link', 'on_behalf', 'self', 'provisional', 'implied'] as const;
export type Evidence = (typeof EVIDENCE_RANK)[number];

export interface Assertion {
  a_id: string;
  /** Cumulative total for this side, in base atoms (04 §5.6.4). */
  base_qty: number;
  final: boolean;
  evidence: Evidence;
  by: { business_id?: string; contact_id?: string; user_id?: string };
  business_date: string; // YYYY-MM-DD, IST
  recorded_at: number; // server ms
  grade?: Grade;
  reason?: string;
  responds_to?: string;
}

export type MaterialClass = 'weighed' | 'counted';

/** Tolerance taken from the terms snapshot (model P8, §3.10). */
export interface ToleranceRule {
  weighedPct: number; // e.g. 1.5
  countedAbs: number; // e.g. 0
}

export const DEFAULT_TOLERANCE: ToleranceRule = { weighedPct: 1.5, countedAbs: 0 };

export type ConservationKind = 'mass_losing' | 'count_preserving' | 'unit_changing' | 'assembling' | 'disassembling';
export type RateBasis = 'per_input_mass' | 'per_good_output_piece' | 'per_output_piece' | 'lump_sum';

export const same = (a: PartyRef | null | undefined, b: PartyRef | null | undefined) =>
  !!a && !!b && a.k === b.k && a.id === b.id;

export const partyStr = (p: PartyRef) => `${p.k}:${p.id}`;
