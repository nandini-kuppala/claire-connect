// Chat moderation word list, shared by the server and the web app (docs: /platform-chat-api/moderation/overview).
//
// Three layers use it:
// 1. Nexconn's profanity filter (authoritative, every client): the list is pushed with
//    `npm run chat:moderation -w server -- sync` (POST /v4/profanity-word/batch/add). Nexconn checks every text
//    message a client SDK sends, before delivery: a BLOCK word stops the message (the receiver never gets it; the
//    sender's SDK fires MessageHandler.onMessageBlocked, and the web app marks the bubble "Not delivered"); a MASK word
//    is replaced by MASK. The list is app-wide in Nexconn (every environment on the same App Key), capped at 50 words.
// 2. The web composer checks before sending (web/src/chat/ChatView.tsx), so the sender gets the notice at once and a
//    blocked text never leaves the phone, even while a Nexconn list change is still propagating.
// 3. The server applies it to the text it archives and reacts to (deal / Goods notify path in server/src/deals.ts).
// The two `zz…probe` words are for automated checks (scripts/nexconn-features-smoke.mjs), so tests never need real
// abuse.

export const MASK = '***';

/** Whole message is blocked. Clear abuse and slurs in English, Hindi (both scripts) and Tamil (both scripts). */
export const BLOCK_WORDS = [
  'fuck',
  'fucking',
  'motherfucker',
  'bastard',
  'bitch',
  'asshole',
  'madarchod',
  'behenchod',
  'bhenchod',
  'chutiya',
  'bhosdike',
  'gaandu',
  'मादरचोद',
  'बहनचोद',
  'चूतिया',
  'भोसड़ीके',
  'गांडू',
  'thevidiya',
  'தேவடியா',
  'புண்டை',
  'zzblockprobe',
];

/** Milder insults: the word is masked, the rest of the message is delivered. */
export const MASK_WORDS = ['idiot', 'stupid', 'shit', 'harami', 'हरामी', 'kamina', 'कमीना', 'zzmaskprobe'];

export type ModerationAction = 'pass' | 'mask' | 'block';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Mirrors Nexconn's matching: English (Latin) words as whole words, ignoring case; other scripts inside the text.
const pattern = (words: string[]) => words.map((w) => (/^[a-z]+$/i.test(w) ? `(?<![\\p{L}\\p{N}])${esc(w)}(?![\\p{L}\\p{N}])` : esc(w))).join('|');
const blockRe = new RegExp(pattern(BLOCK_WORDS), 'iu');
const maskRe = new RegExp(pattern(MASK_WORDS), 'giu');

/** The server-side mirror of the Nexconn filter, for text the server stores or reacts to. */
export function moderateText(text: string): { action: ModerationAction; text: string } {
  if (!text) return { action: 'pass', text };
  if (blockRe.test(text)) return { action: 'block', text: '' };
  const masked = text.replace(maskRe, MASK);
  return masked === text ? { action: 'pass', text } : { action: 'mask', text: masked };
}

/** The list in the shape POST /v4/profanity-word/batch/add takes. */
export function nexconnWordList(): { word: string; replacement?: string }[] {
  return [...BLOCK_WORDS.map((word) => ({ word })), ...MASK_WORDS.map((word) => ({ word, replacement: MASK }))];
}
