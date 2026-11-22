// Lint for supply-chain code (05 §1): no lucide-react imports, no blue Tailwind colours, no gradients, no emoji in UI files.
// Usage: node scripts/sc-lint.mjs   (also run by `npm run lint`)
import fs from 'node:fs';
import path from 'node:path';

const roots = ['web/src/screens/goods', 'web/src/components/BottomNav.strings.ts', 'shared/sc', 'server/src/sc'];
const rules = [
  { re: /from ['"]lucide-react['"]/, msg: 'import icons from web/src/icons, never lucide-react' },
  { re: /\b(?:bg|text|border|from|to|via|ring)-(?:blue|sky|indigo)-\d/, msg: 'no blue Tailwind colours (DESIGN_SYSTEM)' },
  { re: /(?:linear|radial)-gradient|bg-gradient-/, msg: 'no gradients (DESIGN_SYSTEM)' },
  { re: /[\u{1F300}-\u{1FAFF}\u{2728}]/u, msg: 'no emoji in UI or code (ui-principles)' },
];
const files = [];
const walk = (p) => {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f));
  else if (/\.(ts|tsx|css)$/.test(p)) files.push(p);
};
roots.forEach(walk);
let bad = 0;
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const r of rules) if (r.re.test(line)) { console.error(`${f}:${i + 1}: ${r.msg}`); bad++; }
  });
}
console.log(`sc-lint: ${files.length} files, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
