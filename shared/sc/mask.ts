// Privacy at the level of holdings (model §7, 04 §10.3): who a holding is "with" or "for", per viewer.
import type { PartyRef, RealKey } from './types.js';
import { same } from './types.js';

export type ViewerRole = 'owner' | 'custodian' | 'via' | 'none';

export function roleOf(viewer: PartyRef, k: RealKey): ViewerRole {
  if (same(viewer, k.owner)) return 'owner';
  if (same(viewer, k.custodian)) return 'custodian';
  if (same(viewer, k.via)) return 'via';
  return 'none';
}

/**
 * The party a holding row is grouped under for this viewer (sub-contract mask, D2):
 * the owner sees goods "with" `via ?? custodian` (silent roll-up: "with Lakshmi", never her home tailor);
 * the custodian sees them "for" `via ?? owner` ("for Lakshmi", never the principal behind her);
 * the via sees what it forwarded "at" the custodian.
 * `disclosed` (registered owner, or the via's setting) lets the owner see the real custodian too.
 */
export function counterpartyFor(viewer: PartyRef, k: RealKey, disclosed = false): { party: PartyRef; also?: PartyRef } | null {
  switch (roleOf(viewer, k)) {
    case 'owner':
      if (k.via && !same(k.via, viewer)) return disclosed ? { party: k.via, also: k.custodian } : { party: k.via };
      return same(k.custodian, viewer) ? null : { party: k.custodian };
    case 'custodian':
      return same(k.owner, viewer) ? null : { party: k.via ?? k.owner };
    case 'via':
      return { party: k.custodian };
    default:
      return null;
  }
}

/** Whether a viewer may see a holding row at all. */
export const canSee = (viewer: PartyRef, k: RealKey) => roleOf(viewer, k) !== 'none';
