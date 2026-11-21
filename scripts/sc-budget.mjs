#!/usr/bin/env node
// Slice 9 budget: what the Goods screens add on top of the app shell must stay ≤ 150 KB gzipped (04 §12).
// Reads web/dist/.vite/manifest.json (run `npm run build` first) and walks each Goods route's static imports,
// leaving out the main entry chunk every page already loads.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST = path.resolve('web/dist');
const LIMIT_KB = 150;
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, '.vite/manifest.json'), 'utf8'));
const entry = Object.entries(manifest).find(([, v]) => v.isEntry)?.[0];
const shell = new Set();
(function walk(k) { if (!k || shell.has(k)) return; shell.add(k); for (const i of manifest[k].imports ?? []) walk(i); })(entry);

const gz = (file) => zlib.gzipSync(fs.readFileSync(path.join(DIST, file))).length / 1024;
const routes = Object.keys(manifest).filter((k) => /src\/screens\/goods\/[A-Z]\w+\.tsx$/.test(k) && manifest[k].isDynamicEntry);
let worst = 0;
let failed = false;
for (const r of routes) {
  const seen = new Set();
  (function walk(k) { if (seen.has(k) || shell.has(k)) return; seen.add(k); for (const i of manifest[k].imports ?? []) walk(i); })(r);
  const kb = [...seen].reduce((a, k) => a + gz(manifest[k].file), 0);
  worst = Math.max(worst, kb);
  if (kb > LIMIT_KB) failed = true;
  console.log(`${kb > LIMIT_KB ? '✗' : '✓'} ${kb.toFixed(1).padStart(6)} KB gz  ${path.basename(r)}`);
}
console.log(`${routes.length} Goods routes; largest ${worst.toFixed(1)} KB gz (budget ${LIMIT_KB} KB beyond the app shell of ${[...shell].reduce((a, k) => a + gz(manifest[k].file), 0).toFixed(1)} KB)`);
process.exit(failed ? 1 : 0);
