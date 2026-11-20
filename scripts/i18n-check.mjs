#!/usr/bin/env node
// Checks overlay translations against the English source (web + server en.json).
//
//   npm run i18n:check -- te          one language
//   npm run i18n:check -- all         te kn ml bn or mr gu
//   npm run i18n:check -- te --list   print every problem (default: the first 15 per kind)
//   npm run i18n:check -- te --web    only the web app (or --server)
//
// Reports, per language and side:
//   missing      key in en.json but absent / empty in <lang>.json (falls back to English on screen)
//   extra        namespace or key not in en.json (typo, or removed from the source: delete it)
//   placeholder  {name}/{price}/{n}… set differs from English (would show a raw {x} or drop a value)
//   empty        "" or whitespace-only value
//   same         identical to English and longer than 3 words (probably untranslated)
//   type         value is not a string
// A namespace that carries this language inline in its defineStrings(...) table (e.g. 'call') is checked
// against that inline table instead of the JSON file.
// Exit code 1 when any problem is found, 0 when the language is complete and clean.
// It first verifies en.json is up to date with the source tables (run `npm run i18n:extract` if not).
import path from 'node:path';
import fs from 'node:fs';
import { OVERLAY_LANGS, ROOT, SIDES, extractAll, placeholders, readJson } from './i18n-lib.mjs';

const args = process.argv.slice(2);
const list = args.includes('--list');
const onlyWeb = args.includes('--web');
const onlyServer = args.includes('--server');
const target = args.find((a) => !a.startsWith('--')) ?? 'all';
const langs = target === 'all' ? OVERLAY_LANGS : [target];
for (const l of langs) {
  if (!OVERLAY_LANGS.includes(l)) {
    console.error(`Unknown overlay language "${l}". Use one of: ${OVERLAY_LANGS.join(', ')} or all.`);
    console.error('(ta and hi live in the inline tables in the source files, not in JSON.)');
    process.exit(2);
  }
}
const sides = Object.keys(SIDES).filter((s) => (onlyWeb ? s === 'web' : onlyServer ? s === 'server' : true));
const LIMIT = list ? Infinity : 15;

let failed = false;

// 1. en.json must match the source tables.
const fresh = extractAll();
for (const side of sides) {
  const file = path.join(SIDES[side], 'en.json');
  const current = fs.existsSync(file) ? readJson(file) : {};
  const same = JSON.stringify(sortNs(current)) === JSON.stringify(sortNs(fresh[side]));
  if (!same) {
    failed = true;
    console.log(`✗ ${path.relative(ROOT, file)} is out of date with the source tables. Run: npm run i18n:extract`);
  }
}

// 2. Each language vs en.json.
const summary = [];
for (const lang of langs) {
  for (const side of sides) {
    const en = readJson(path.join(SIDES[side], 'en.json'));
    const file = path.join(SIDES[side], `${lang}.json`);
    let tr = {};
    if (!fs.existsSync(file)) {
      console.log(`✗ ${path.relative(ROOT, file)} does not exist (run npm run i18n:extract to create it)`);
      failed = true;
    } else {
      try {
        tr = readJson(file);
      } catch (e) {
        console.log(`✗ ${path.relative(ROOT, file)} is not valid JSON: ${e.message}`);
        failed = true;
        continue;
      }
    }
    const issues = { missing: [], extra: [], placeholder: [], empty: [], same: [], type: [] };
    let total = 0;
    let done = 0;
    for (const [ns, table] of Object.entries(en)) {
      for (const [key, english] of Object.entries(table)) {
        total++;
        const id = `${ns}.${key}`;
        // Same order as the app: an inline table for this language wins over the overlay JSON.
        const inlineTable = fresh.inline?.[side]?.[ns]?.[lang];
        const v = inlineTable?.[key] ?? tr?.[ns]?.[key];
        if (v === undefined) {
          issues.missing.push(id);
          continue;
        }
        if (typeof v !== 'string') {
          issues.type.push(`${id} (${typeof v})`);
          continue;
        }
        if (v.trim() === '') {
          issues.empty.push(id);
          continue;
        }
        done++;
        const a = placeholders(english).join(',');
        const b = placeholders(v).join(',');
        if (a !== b) issues.placeholder.push(`${id}  en {${a}}  ${lang} {${b}}`);
        if (v.trim() === english.trim() && english.trim().split(/\s+/).length > 3) issues.same.push(`${id}  "${english}"`);
      }
    }
    for (const [ns, table] of Object.entries(tr ?? {})) {
      if (!en[ns]) {
        issues.extra.push(`${ns} (whole namespace)`);
        continue;
      }
      if (!table || typeof table !== 'object') {
        issues.type.push(`${ns} (namespace is not an object)`);
        continue;
      }
      for (const key of Object.keys(table)) if (!(key in en[ns])) issues.extra.push(`${ns}.${key}`);
    }
    const count = Object.values(issues).reduce((n, x) => n + x.length, 0);
    if (count) failed = true;
    summary.push({ lang, side, total, done, issues });
    const head = `${count ? '✗' : '✓'} ${lang} ${side.padEnd(6)} ${done}/${total} translated`;
    const parts = Object.entries(issues).filter(([, x]) => x.length).map(([k, x]) => `${x.length} ${k}`);
    console.log(parts.length ? `${head} · ${parts.join(' · ')}` : head);
    if (!count) continue;
    for (const [kind, items] of Object.entries(issues)) {
      if (!items.length) continue;
      // A language that has not been started: one line is enough.
      if (kind === 'missing' && items.length === total && !list) {
        console.log(`    missing: everything (file not started)`);
        continue;
      }
      console.log(`    ${kind}:`);
      for (const it of items.slice(0, LIMIT)) console.log(`      ${it}`);
      if (items.length > LIMIT) console.log(`      … ${items.length - LIMIT} more (use --list)`);
    }
  }
}

if (langs.length > 1) {
  const pct = (s) => (s.total ? Math.round((100 * s.done) / s.total) : 100);
  console.log('\nlanguage  web    server');
  for (const lang of langs) {
    const w = summary.find((s) => s.lang === lang && s.side === 'web');
    const v = summary.find((s) => s.lang === lang && s.side === 'server');
    console.log(`${lang.padEnd(9)} ${w ? String(pct(w)).padStart(3) + '%' : '  - '}   ${v ? String(pct(v)).padStart(3) + '%' : '  - '}`);
  }
}

process.exit(failed ? 1 : 0);

function sortNs(obj) {
  return Object.fromEntries(
    Object.keys(obj ?? {})
      .sort()
      .map((ns) => [ns, Object.fromEntries(Object.entries(obj[ns] ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))]),
  );
}
