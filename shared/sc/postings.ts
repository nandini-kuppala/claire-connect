// Posting rules (model §4, 04 §5.6). Pure functions: each returns postings that balance per dimension.
import type { Dimension, Grade, HoldingKey, HoldingState, PartyRef, Posting, PseudoKey, PseudoKind, RealKey } from './types.js';

/** What the goods are, independent of who holds them. */
export interface Goods {
  spec: string;
  lot: string | null;
  grade: Grade;
  dim: Dimension;
}

export const real = (g: Goods, owner: PartyRef, custodian: PartyRef, state: HoldingState, extra: { via?: PartyRef | null; place?: string | null } = {}): RealKey => ({
  t: 'real',
  spec: g.spec,
  lot: g.lot,
  grade: g.grade,
  owner,
  custodian,
  via: extra.via ?? null,
  place: extra.place ?? null,
  state,
});

export const pseudo = (g: Goods, kind: PseudoKind, ref: string, owner: PartyRef, attributedTo?: PartyRef | null): PseudoKey => ({
  t: 'pseudo',
  kind,
  ref,
  spec: g.spec,
  lot: g.lot,
  grade: g.grade,
  owner,
  ...(attributedTo !== undefined ? { attributedTo } : {}),
});

const p = (key: HoldingKey, delta: number, dim: Dimension): Posting => ({ key, delta, dim });

/** Σ = 0 per dimension for one event (04 §5.6.7). Throws on violation; the transaction then aborts. */
export function assertBalanced(postings: Posting[]): void {
  const sums = new Map<Dimension, number>();
  for (const x of postings) {
    if (!Number.isInteger(x.delta)) throw new Error(`posting delta must be an integer number of base atoms: ${x.delta}`);
    sums.set(x.dim, (sums.get(x.dim) ?? 0) + x.delta);
  }
  for (const [dim, sum] of sums) if (sum !== 0) throw new Error(`postings do not balance in ${dim}: Σ = ${sum}`);
}

export const reverse = (postings: Posting[]): Posting[] => postings.map((x) => ({ ...x, delta: -x.delta }));

/** Drops zero rows and merges postings to the same key, so a write touches each holding once. */
export function compact(postings: Posting[], keyOf: (k: HoldingKey) => string = (k) => JSON.stringify(k)): Posting[] {
  const by = new Map<string, Posting>();
  for (const x of postings) {
    const id = `${x.dim}|${keyOf(x.key)}`;
    const cur = by.get(id);
    if (cur) cur.delta += x.delta;
    else by.set(id, { ...x });
  }
  return [...by.values()].filter((x) => x.delta !== 0);
}

// ── Movements ────────────────────────────────────────────────────────────────

export interface SendInput {
  goods: Goods;
  qty: number;
  owner: PartyRef;
  /** Where the goods leave from. `external: true` when the sender doesn't track this stock (EXTERNAL source, P11). */
  from: { party: PartyRef; place?: string | null; state?: HoldingState; via?: PartyRef | null; external?: boolean };
  movementId: string;
  /** Custodian while in transit: the sender by default, or a recorded transporter. */
  transitCustodian?: PartyRef;
}

/** `sent = s`: −s from the sender's holding (or EXTERNAL) · +s in transit (model §4.1). */
export function postSend(i: SendInput): Posting[] {
  const { goods: g, qty: s, owner } = i;
  const out = i.from.external
    ? pseudo(g, 'EXTERNAL', `${i.from.party.k}:${i.from.party.id}`, owner)
    : real(g, owner, i.from.party, i.from.state ?? { s: 'available' }, { via: i.from.via, place: i.from.place });
  // In transit, the goods sit with whoever carries them; `via` (the accountable intermediary) applies at a unit, not on the road.
  const transit = real(g, owner, i.transitCustodian ?? i.from.party, { s: 'in_transit', ref: i.movementId });
  return [p(out, -s, g.dim), p(transit, s, g.dim)];
}

export interface ReceiptInput {
  goods: Goods;
  owner: PartyRef;
  movementId: string;
  transitCustodian: PartyRef;
  to: { party: PartyRef; place?: string | null; state?: HoldingState; via?: PartyRef | null; external?: boolean };
  /** Change in the receiver's cumulative received total (negative when a winning assertion goes down). */
  delta: number;
  /** Ownership after receipt (sales pass title; job work does not). Defaults to `owner`. */
  ownerAfter?: PartyRef;
}

/** `received`: −r in transit · +r at the receiver (or EXTERNAL when the receiver is untracked). */
export function postReceipt(i: ReceiptInput): Posting[] {
  const { goods: g } = i;
  const transit = real(g, i.owner, i.transitCustodian, { s: 'in_transit', ref: i.movementId });
  const ownerAfter = i.ownerAfter ?? i.owner;
  const dest = i.to.external
    ? pseudo(g, 'EXTERNAL', `${i.to.party.k}:${i.to.party.id}`, ownerAfter)
    : real(g, ownerAfter, i.to.party, i.to.state ?? { s: 'available' }, { via: i.to.via, place: i.to.place });
  if (ownerAfter.k === i.owner.k && ownerAfter.id === i.owner.id) return [p(transit, -i.delta, g.dim), p(dest, i.delta, g.dim)];
  // Title passes on receipt: the seller's books close through EXTERNAL(buyer); the buyer's open from EXTERNAL(seller).
  return [
    p(transit, -i.delta, g.dim),
    p(pseudo(g, 'EXTERNAL', `${ownerAfter.k}:${ownerAfter.id}`, i.owner), i.delta, g.dim),
    p(pseudo(g, 'EXTERNAL', `${i.owner.k}:${i.owner.id}`, ownerAfter), -i.delta, g.dim),
    p(dest, i.delta, g.dim),
  ];
}

export interface SettleLineInput {
  goods: Goods;
  owner: PartyRef;
  movementId: string;
  transitCustodian: PartyRef;
  receiver: PartyRef;
  /** sent − received when the line is final. Positive = short, negative = over. */
  difference: number;
  outcome: 'within' | 'beyond' | 'over';
  /** Terms: who bears a weighing difference (job work default: the owner, 04 §5.6). */
  weighingBearer: PartyRef;
  disputeId?: string;
}

/**
 * Closes the in-transit remainder of a final line (model §4.1):
 * within tolerance → LOSS(weighing_difference); beyond → disputed(D) for the whole difference;
 * over-receipt → excess held(found_pending) at the receiver via ADJUSTMENT(found_pending); the receipt itself is capped at `sent`.
 */
export function postSettleLine(i: SettleLineInput): Posting[] {
  const { goods: g, difference: d } = i;
  if (d === 0) return [];
  const transit = real(g, i.owner, i.transitCustodian, { s: 'in_transit', ref: i.movementId });
  if (i.outcome === 'within') {
    return [p(transit, -d, g.dim), p(pseudo(g, 'LOSS', 'weighing_difference', i.owner, i.weighingBearer), d, g.dim)];
  }
  if (i.outcome === 'beyond') {
    if (!i.disputeId) throw new Error('a dispute id is required for a difference beyond tolerance');
    return [p(transit, -d, g.dim), p(real(g, i.owner, i.transitCustodian, { s: 'disputed', ref: i.disputeId }), d, g.dim)];
  }
  // Over-receipt: the caller posts the receipt only up to `sent` (so in-transit never goes negative);
  // the excess is held at the receiver as found_pending until the dispute resolves.
  const excess = -d;
  return [
    p(real(g, i.owner, i.receiver, { s: 'held', reason: 'found_pending', ref: i.disputeId }), excess, g.dim),
    p(pseudo(g, 'ADJUSTMENT', 'found_pending', i.owner), -excess, g.dim),
  ];
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export interface OutputInput {
  goods: Goods; // the output spec, in the output's dimension
  qty: number;
  owner: PartyRef;
  performer: PartyRef;
  via?: PartyRef | null;
  jobId: string;
  ready?: boolean;
  place?: string | null;
}

/** `output o`: +o at the performer · −o CONSUMED(J) in the output's dimension. Inputs are not reduced (P7). */
export function postOutput(i: OutputInput): Posting[] {
  const state: HoldingState = i.ready ? { s: 'ready', ref: i.jobId } : { s: 'available' };
  return [
    p(real(i.goods, i.owner, i.performer, state, { via: i.via, place: i.place }), i.qty, i.goods.dim),
    p(pseudo(i.goods, 'CONSUMED', i.jobId, i.owner), -i.qty, i.goods.dim),
  ];
}

export interface CloseInput {
  goods: Goods; // the input line's goods, in the input's dimension
  owner: PartyRef;
  performer: PartyRef;
  via?: PartyRef | null;
  jobId: string;
  /** What leaves allocated(J) at close (model §5.2 "consumed"). */
  consumed: number;
  intoOutput: number;
  loss: number;
  residual: number;
  lossBearer?: PartyRef | null;
}

/** `close`: −c allocated(J) · +into_output CONSUMED(J) · +loss LOSS(process) · +residual RESIDUAL(J). */
export function postClose(i: CloseInput): Posting[] {
  if (i.intoOutput + i.loss + i.residual !== i.consumed) {
    throw new Error(`closure does not conserve: ${i.intoOutput} + ${i.loss} + ${i.residual} ≠ ${i.consumed}`);
  }
  const g = i.goods;
  const out: Posting[] = [p(real(g, i.owner, i.performer, { s: 'allocated', ref: i.jobId }, { via: i.via }), -i.consumed, g.dim)];
  if (i.intoOutput) out.push(p(pseudo(g, 'CONSUMED', i.jobId, i.owner), i.intoOutput, g.dim));
  if (i.loss) out.push(p(pseudo(g, 'LOSS', 'process', i.owner, i.lossBearer ?? null), i.loss, g.dim));
  if (i.residual) out.push(p(pseudo(g, 'RESIDUAL', i.jobId, i.owner), i.residual, g.dim));
  return out;
}

// ── Adjustments ──────────────────────────────────────────────────────────────

/** A physical count against the book (model §3.6). Positive difference = found, negative = shortage. */
export function postCount(key: RealKey, dim: Dimension, book: number, counted: number, reason = 'count'): Posting[] {
  const d = counted - book;
  if (d === 0) return [];
  const g: Goods = { spec: key.spec, lot: key.lot, grade: key.grade, dim };
  return [p(key, d, dim), p(pseudo(g, 'ADJUSTMENT', reason, key.owner), -d, dim)];
}

/** Regrade: same goods, different grade; nets to zero. */
export function postRegrade(key: RealKey, dim: Dimension, qty: number, to: Grade): Posting[] {
  return [p(key, -qty, dim), p({ ...key, grade: to }, qty, dim)];
}

/** Respec: quantity moves between specs of the same dimension (typo, "unspecified" → real spec). */
export function postRespec(key: RealKey, dim: Dimension, qty: number, toSpec: string): Posting[] {
  return [p(key, -qty, dim), p({ ...key, spec: toSpec }, qty, dim)];
}

/** Opening balance or stock first recorded now: draws from EXTERNAL(self) (model §3.6). */
export function postOpening(key: RealKey, dim: Dimension, qty: number): Posting[] {
  const g: Goods = { spec: key.spec, lot: key.lot, grade: key.grade, dim };
  return [p(pseudo(g, 'EXTERNAL', `${key.owner.k}:${key.owner.id}`, key.owner), -qty, dim), p(key, qty, dim)];
}
