// Nexconn profanity filter: show, push or remove the app's word list (server/src/moderation.ts).
//   npm run chat:moderation -w server -- list          what Nexconn has now
//   npm run chat:moderation -w server -- sync          add the missing words (block + mask)
//   npm run chat:moderation -w server -- remove-all    remove every word this app manages
// The list lives in Nexconn and applies to every environment on the same App Key; changes take up to ~15 minutes.
import { features } from '../config.js';
import { nexconn } from '../nexconn.js';
import { BLOCK_WORDS, MASK_WORDS, nexconnWordList } from '../moderation.js';

const cmd = process.argv[2] || 'list';
if (!features.nexconn) {
  console.error('Nexconn keys are missing (server/.env).');
  process.exit(2);
}

const current = await nexconn.profanityList('all');
const have = new Set(current.map((w) => w.word.toLowerCase()));
if (cmd === 'list') {
  console.log(`${current.length} word(s) in Nexconn:`);
  for (const w of current) console.log(`  ${w.word}${w.replacement ? ` -> ${w.replacement}` : ' (block)'}`);
} else if (cmd === 'sync') {
  const missing = nexconnWordList().filter((w) => !have.has(w.word.toLowerCase()));
  if (!missing.length) console.log('Nothing to add: every word is already in Nexconn.');
  else {
    const r = await nexconn.profanityAdd(missing);
    console.log(`Added ${missing.length} word(s); remaining quota ${r.remainingQuota ?? '?'}. Nexconn applies changes within ~15 minutes.`);
  }
} else if (cmd === 'remove-all') {
  const ours = [...BLOCK_WORDS, ...MASK_WORDS].filter((w) => have.has(w.toLowerCase()));
  if (ours.length) await nexconn.profanityRemove(ours);
  console.log(`Removed ${ours.length} word(s).`);
} else {
  console.error('usage: npm run chat:moderation -w server -- list|sync|remove-all');
  process.exit(2);
}
