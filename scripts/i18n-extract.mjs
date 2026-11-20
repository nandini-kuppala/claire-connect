#!/usr/bin/env node
// Regenerates web/src/locales/en.json and server/src/locales/en.json from the inline English tables
// (web: src/i18n.ts, src/cards/strings.ts, every defineStrings(...) table, shared/taxonomy.ts;
//  server: src/i18n.ts, src/deals.ts, src/desk.ts, src/routes/requirements.ts, shared/taxonomy.ts).
// en.json is never edited by hand. Also creates an empty {} file for any missing overlay language.
//
//   npm run i18n:extract
import fs from 'node:fs';
import path from 'node:path';
import { OVERLAY_LANGS, ROOT, SIDES, extractAll, writeJson } from './i18n-lib.mjs';

const { web, server, sources, warnings } = extractAll();

for (const [side, data] of Object.entries({ web, server })) {
  const dir = SIDES[side];
  fs.mkdirSync(dir, { recursive: true });
  const sorted = Object.fromEntries(Object.keys(data).sort().map((ns) => [ns, data[ns]]));
  writeJson(path.join(dir, 'en.json'), sorted);
  for (const lang of OVERLAY_LANGS) {
    const f = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(f)) writeJson(f, {});
  }
  const total = Object.values(data).reduce((n, t) => n + Object.keys(t).length, 0);
  console.log(`${side}: ${path.relative(ROOT, path.join(dir, 'en.json'))} · ${Object.keys(data).length} namespaces · ${total} keys`);
  for (const ns of Object.keys(sorted)) console.log(`  ${ns.padEnd(12)} ${String(Object.keys(data[ns]).length).padStart(4)}  ${sources[side][ns]}`);
}
if (warnings.length) {
  console.warn(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.warn('  ' + w);
}
