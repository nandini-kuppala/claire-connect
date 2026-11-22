// Extra deal facts handed to cards through ChatView's `cardExtras` (no change to CardCtx itself).
// Cards read them with `dealOf(ctx)`; outside deal chats it is undefined and cards fall back gracefully.
import type { CardCtx } from './types';

export interface DealOfferLite {
  id: string;
  unitPrice: number;
  qty: number;
  status: string;
  /** Sent by my business. */
  mine: boolean;
  createdAt?: number;
  /** The offer this one counters. */
  parentId?: string | null;
}

export interface DealInfo {
  title?: string;
  qty?: number;
  unit?: string;
  /** The seller's listing price for this product (shown as "listed"). */
  listedPrice?: number;
  /** 'buyer' | 'seller' | null */
  side?: string | null;
  offers: DealOfferLite[];
}

export type DealCtx = CardCtx & { deal?: DealInfo };

export const dealOf = (ctx: CardCtx): DealInfo | undefined => (ctx as DealCtx).deal;

/** Price the other side last asked for: their newest offer, else the listed price. */
export function theirPrice(deal: DealInfo | undefined): number | undefined {
  if (!deal) return undefined;
  const theirs = [...deal.offers].reverse().find((o) => !o.mine);
  return theirs?.unitPrice ?? deal.listedPrice;
}
