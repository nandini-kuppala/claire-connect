// Which assertion counts (model §3.4): highest evidence rank wins; server record time breaks ties within a rank.
import { EVIDENCE_RANK, type Assertion } from './types.js';

const rank = (a: Assertion) => EVIDENCE_RANK.indexOf(a.evidence);

export function winningAssertion(list: readonly Assertion[]): Assertion | null {
  let best: Assertion | null = null;
  for (const a of list) {
    if (!best) best = a;
    else if (rank(a) < rank(best) || (rank(a) === rank(best) && a.recorded_at > best.recorded_at)) best = a;
  }
  return best;
}

/** v1 shows three badges (model §3.10) for one's own records. */
export type Badge = 'your_record' | 'confirmed_by' | 'not_confirmed';

export function badgeFor(own: Assertion | null, theirs: Assertion | null): Badge {
  if (theirs && (theirs.evidence === 'account' || theirs.evidence === 'link')) return 'confirmed_by';
  if (theirs && theirs.evidence === 'on_behalf') return 'not_confirmed';
  return own ? 'your_record' : 'not_confirmed';
}
