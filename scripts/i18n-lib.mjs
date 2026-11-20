// Shared helpers for scripts/i18n-extract.mjs and scripts/i18n-check.mjs.
// The English source of truth is the inline tables in the TypeScript code; this file knows where they are
// and reads them statically with the TypeScript compiler API (nothing is executed).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OVERLAY_LANGS = ['te', 'kn', 'ml', 'bn', 'or', 'mr', 'gu'];
export const SIDES = {
  web: path.join(ROOT, 'web/src/locales'),
  server: path.join(ROOT, 'server/src/locales'),
};

const require = createRequire(path.join(ROOT, 'web/package.json'));
const ts = require('typescript');

const rel = (p) => path.relative(ROOT, p);

function parse(file) {
  const abs = path.join(ROOT, file);
  return ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, abs.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

const unwrap = (n) => {
  while (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n) || ts.isParenthesizedExpression(n) || ts.isTypeAssertionExpression?.(n))) n = n.expression;
  return n;
};

function propName(p) {
  const n = p.name;
  if (!n) return null;
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  return null;
}

function getProp(obj, name) {
  obj = unwrap(obj);
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  const p = obj.properties.find((x) => ts.isPropertyAssignment(x) && propName(x) === name);
  return p ? unwrap(p.initializer) : null;
}

const isStr = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

/** { key: 'text' } object literal → plain object; warns on non-literal values. */
function strings(obj, where, warnings) {
  obj = unwrap(obj);
  const out = {};
  if (!obj || !ts.isObjectLiteralExpression(obj)) {
    warnings.push(`${where}: expected an object literal`);
    return out;
  }
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) {
      warnings.push(`${where}: skipped a non-literal member`);
      continue;
    }
    const k = propName(p);
    const v = unwrap(p.initializer);
    if (k == null || !isStr(v)) {
      warnings.push(`${where}.${k ?? '?'}: value is not a string literal, skipped`);
      continue;
    }
    out[k] = v.text;
  }
  return out;
}

function topConst(sf, name) {
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) return unwrap(d.initializer);
  }
  return null;
}

/** First `const <name> = …` anywhere in the file (e.g. a map declared inside a function). */
function anyConst(sf, name) {
  let found = null;
  const visit = (n) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) found = unwrap(n.initializer);
    else ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function need(node, what) {
  if (!node) throw new Error(`i18n-extract: could not find ${what}. Update scripts/i18n-lib.mjs if the table moved.`);
  return node;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Category names (shared/taxonomy.ts CATEGORIES[].names.en), keyed by category id. */
function taxonomy(warnings) {
  const file = 'shared/taxonomy.ts';
  const arr = need(topConst(parse(file), 'CATEGORIES'), `${file} CATEGORIES`);
  const out = {};
  for (const el of arr.elements) {
    const id = getProp(el, 'id');
    const en = getProp(getProp(el, 'names'), 'en');
    if (isStr(id) && isStr(en)) out[id.text] = en.text;
    else warnings.push(`${file}: a category without a literal id / names.en`);
  }
  return out;
}

/** Reads every English table. Returns { web: {ns: {key: text}}, server: {...}, sources, warnings }. */
export function extractAll() {
  const warnings = [];
  const sources = { web: {}, server: {} };
  /** inline[side][ns][lang] = { key: text } for overlay languages written inline in the source. */
  const inline = { web: {}, server: {} };
  const web = {};
  const server = {};
  const add = (side, ns, table, file) => {
    const target = side === 'web' ? web : server;
    if (target[ns]) throw new Error(`i18n-extract: namespace "${ns}" defined twice (${sources[side][ns]} and ${file})`);
    target[ns] = table;
    sources[side][ns] = file;
  };

  // ── web ──
  add('web', 'app', strings(need(topConst(parse('web/src/i18n.ts'), 'en'), 'web/src/i18n.ts const en'), 'web/src/i18n.ts en', warnings), 'web/src/i18n.ts');
  add('web', 'cards', strings(need(topConst(parse('web/src/cards/strings.ts'), 'en'), 'web/src/cards/strings.ts const en'), 'web/src/cards/strings.ts en', warnings), 'web/src/cards/strings.ts');
  for (const abs of walk(path.join(ROOT, 'web/src'))) {
    const src = fs.readFileSync(abs, 'utf8');
    if (!src.includes('defineStrings(') || abs.endsWith(path.join('lib', 'localStrings.ts'))) continue;
    const file = rel(abs);
    const sf = parse(file);
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'defineStrings') {
        const [nsArg, tablesArg] = n.arguments;
        if (!isStr(nsArg)) throw new Error(`i18n-extract: ${file}: defineStrings needs a string-literal namespace as its first argument`);
        add('web', nsArg.text, strings(need(getProp(tablesArg, 'en'), `${file} en table`), `${file} en`, warnings), file);
        // A namespace may also carry overlay languages inline (e.g. 'call'); the check counts those as translated.
        for (const lang of OVERLAY_LANGS) {
          const tbl = getProp(tablesArg, lang);
          if (tbl) (inline.web[nsArg.text] ??= {})[lang] = strings(tbl, `${file} ${lang}`, warnings);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  add('web', 'taxonomy', taxonomy(warnings), 'shared/taxonomy.ts');

  // ── server ──
  {
    const file = 'server/src/i18n.ts';
    const sf = parse(file);
    add('server', 'claire', strings(need(topConst(sf, 'en'), `${file} const en`), `${file} en`, warnings), file);
    const map = need(getProp(anyConst(sf, 'map'), 'en'), `${file} unitWord map.en`);
    const units = {};
    for (const p of map.properties) {
      const k = propName(p);
      const v = unwrap(p.initializer);
      if (k && v && ts.isArrayLiteralExpression(v) && v.elements.length === 2 && v.elements.every(isStr)) {
        units[`${k}_one`] = v.elements[0].text;
        units[`${k}_other`] = v.elements[1].text;
      } else warnings.push(`${file} unitWord map.en.${k}: expected ['one', 'other']`);
    }
    add('server', 'units', units, `${file} (unitWord)`);
  }
  {
    const file = 'server/src/deals.ts';
    const sf = parse(file);
    add('server', 'deals', strings(need(getProp(topConst(sf, 'P'), 'en'), `${file} P.en`), `${file} P.en`, warnings), file);
    const units = strings(need(getProp(topConst(sf, 'UNIT'), 'en'), `${file} UNIT.en`), `${file} UNIT.en`, warnings);
    const bundles = need(getProp(topConst(sf, 'BUNDLES'), 'en'), `${file} BUNDLES.en`);
    if (isStr(bundles)) units.bundles = bundles.text;
    add('server', 'deal_units', units, `${file} (UNIT, BUNDLES)`);
  }
  {
    const file = 'server/src/desk.ts';
    add('server', 'desk', strings(need(getProp(topConst(parse(file), 'REQ_TEXT'), 'en'), `${file} REQ_TEXT.en`), `${file} REQ_TEXT.en`, warnings), file);
  }
  {
    const file = 'server/src/routes/requirements.ts';
    add('server', 'reasons', strings(need(getProp(topConst(parse(file), 'REASON'), 'en'), `${file} REASON.en`), `${file} REASON.en`, warnings), file);
  }
  add('server', 'taxonomy', taxonomy(warnings), 'shared/taxonomy.ts');

  return { web, server, sources, inline, warnings };
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Stable JSON: namespaces sorted, keys in source order, 2-space indent, trailing newline. */
export function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export const placeholders = (s) => [...new Set([...String(s).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]))].sort();
