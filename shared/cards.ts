// Payloads of CLAIRE custom chat messages. Every card travels as a Nexconn custom message.
// Message types: 'CC:Card' (persisted, counted), 'CC:Hint' (persisted, not counted, usually targeted),
// 'CC:Reply' (a chip tap rendered as the user's bubble).

export const CC_CARD = 'CC:Card';
export const CC_HINT = 'CC:Hint';
export const CC_REPLY = 'CC:Reply';
export const CC_VOICE = 'CC:Voice';
/** Summary of a Nexconn Call SDK voice / video call, posted into the deal chat by the caller when it ends. */
export const CC_CALL = 'CC:Call';

export interface Chip {
  id: string;        // e.g. "qty:1000"
  label: string;     // already localised for the receiver
  sub?: string;
  primary?: boolean;
}

export interface ListingSummary {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  price: number;
  unit: string;
  moq: number;
  stock: number;
  art?: { shape: string; color: string; pattern?: string };
  image?: string;
  trust?: number;
}

export interface MatchLine {
  listingId: string;
  businessId: string;
  businessName: string;
  qty: number;
  unitPrice: number;
  readyDays: number;
}

export interface MatchCard {
  kind: 'single' | 'combo' | 'mto';
  lines: MatchLine[];
  avgPrice: number;
  total: number;
  freight: number;
  readyDays: number;
  trust: number;
  badges: string[];
  art?: ListingSummary['art'];
  rating?: number;
  onTimePct?: number;
  stock?: number;
}

export type CardPayload =
  | { kind: 'chips'; text: string; chips: Chip[]; hint?: string; layout?: 'row' | 'grid' }
  | { kind: 'tiles'; text: string; tiles: { id: string; label: string; shape: string; color: string }[] }
  | { kind: 'carousel'; text: string; items: ListingSummary[]; selectable?: boolean; doneChip?: Chip; extraChips?: Chip[] }
  | { kind: 'summary'; title: string; lines: string[] }
  | { kind: 'results'; requirementId: string; title: string; singles: MatchCard[]; combos: MatchCard[]; mto: MatchCard[]; band?: { p25: number; median: number; p75: number }; note?: string }
  | { kind: 'requirement'; requirementId: string; title: string; qty: number; unit: string; budget: number | null; deadlineDays: number | null; city: string | null; buyerName: string; buyerTrust: number; buyerPaysOnTime?: string }
  | { kind: 'offer'; offerId: string; fromBusinessId: string; fromName: string; title: string; qty: number; unit: string; unitPrice: number; total: number; dispatchDays: number; advancePct: number; creditDays: number; freight: string; status: string; parentPrice?: number }
  | { kind: 'order'; orderId: string; code: string; title: string; qty: number; unit: string; unitPrice: number; total: number; status: string; buyerBusinessId: string; sellerBusinessId: string; buyerName: string; sellerName: string; advancePct: number; creditDays: number; dispatch?: { transporter?: string; lr?: string; bundles?: number }; balanceDueAt?: number; gstPct: number; ewayBill: boolean; kindLabel?: string; qtyDone?: number; advancePaid?: boolean; toConfirm?: 'advance' | 'balance' }
  | { kind: 'rating'; orderId: string; direction: 'buyer_to_seller' | 'seller_to_buyer'; rateeName: string; questions: { id: string; label: string; auto?: number }[] }
  | { kind: 'orders'; text: string; items: { orderId: string; code: string; title: string; status: string; total: number; counterpart: string; conversationId?: string }[] }
  | { kind: 'agent_joined'; agentName: string; languages: string[]; ticketCode: string }
  | { kind: 'resolved'; ticketCode: string; outcome: string }
  | { kind: 'profile'; name: string; business: string; sells: string[]; buys: string[]; city?: string; capacity?: string }
  | { kind: 'notice'; text: string; tone?: 'info' | 'success' | 'warn' }
  | { kind: 'job_split'; requirementId: string; title: string; lines: MatchLine[]; total: number; avgPrice: number; readyDays: number }
  /** Supply-chain movement (docs/supply-chain/04 §8.2). One payload for both businesses: the client works out its own
   *  side from fromBusinessId / toBusinessId. Never carries prices. `text` is a short trilingual fallback line. */
  | { kind: 'movement'; movementId: string; action: string; text: string; fromBusinessId: string; toBusinessId: string; fromName: string; toName: string;
      date: string; dcNo?: string | null; processKey?: string | null; lines: { lineId: string; label: string; dim: string; sent: number; received?: number | null; final?: boolean }[];
      state: 'sent' | 'confirmed' | 'within_tolerance' | 'disputed' | 'cancelled'; disputeId?: string | null }
  | { kind: 'dispute'; disputeId: string; text: string; movementId?: string | null; lineLabel: string; dim: string; sentBy: string; receivedBy: string;
      sent: number; received: number; difference: number; allowed: number; state: string; proposal?: { by: string; outcome: string } | null; outcome?: string | null }
  /** Personal Claire's answer about goods (04 §9.2): rows are the records behind it, each tappable; `source` says
   *  what it is based on and as of when. Text is already in the reader's language. */
  | { kind: 'goods_answer'; title: string; rows: { label: string; value: string; sub?: string; href?: string; tone?: 'late' | 'ready' | 'held' | 'due' | null }[];
      source: string; note?: string; chips?: Chip[] }
  /** A record Claire drafted from what the user said; nothing is saved until Save. */
  | { kind: 'record_draft'; draftId: string; header: string; readBack: string; partyName: string | null; lines: { label: string; qty: string }[];
      notes: string[]; state: 'draft' | 'saved' | 'cancelled' | 'expired'; canSave: boolean; formHref: string; movementId?: string | null; chips?: Chip[] };

export interface HintPayload {
  text: string;
  action?: { label: string; chipId: string };
}

export interface ReplyPayload {
  chipId: string;
  label: string;
}

export interface VoicePayload {
  audioUrl: string;
  durationMs: number;
  lang: string;
  transcript: string;
}

/** 'completed' = the call connected; everything else is a call that did not connect. */
export type CallOutcome = 'completed' | 'missed' | 'declined' | 'busy' | 'cancelled' | 'failed';

export interface CallPayload {
  media: 'audio' | 'video';
  outcome: CallOutcome;
  /** Talk time in seconds (0 when the call did not connect). */
  durationSec: number;
  callerId: string;
  calleeId: string;
  /** Nexconn call id, for support look-ups. */
  callId?: string;
}
