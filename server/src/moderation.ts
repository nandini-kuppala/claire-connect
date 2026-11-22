// Chat moderation: the word list and matcher live in shared/moderation.ts (used by the web app too).
export { BLOCK_WORDS, MASK, MASK_WORDS, moderateText, nexconnWordList, type ModerationAction } from '../../shared/moderation.js';
