// Order money on one basis everywhere (cards, notices, desk): GST is added to the goods total,
// and the advance / balance are shares of that GST-inclusive invoice total.
export interface MoneyOrder {
  total: number;
  gst_pct?: number | null;
  advance_pct?: number | null;
  advance_paid_at?: number | null;
}

export const grandTotal = (o: MoneyOrder) => o.total + Math.round((o.total * (o.gst_pct ?? 0)) / 100);
export const advanceAmount = (o: MoneyOrder) => Math.round((grandTotal(o) * (o.advance_pct ?? 0)) / 100);
/** What is still owed: the invoice total minus an advance that was actually paid. */
export const balanceAmount = (o: MoneyOrder) => Math.max(0, grandTotal(o) - (o.advance_paid_at ? advanceAmount(o) : 0));
