// Server overlay locales: Claire's replies, deal notices, recommendation reasons, Trade Desk lines and
// category names in te, kn, ml, bn, or, mr, gu. One JSON file per language, shaped
// { "<namespace>": { "<key>": "<text>" } }. en.json is GENERATED from the inline English tables
// (npm run i18n:extract) and is never edited by hand; see docs/TRANSLATING.md.
//
// Lookup order used by every server table: inline table for the language (en / ta / hi)
// → overlay JSON for the language → inline English → key.
import fs from 'node:fs';

export type LocaleTable = Record<string, Record<string, string>>;

export const OVERLAY_LANGS = ['te', 'kn', 'ml', 'bn', 'or', 'mr', 'gu'] as const;

const dir = new URL('./', import.meta.url);
const tables: Record<string, LocaleTable> = {};

function load(lang: string): LocaleTable {
  try {
    const raw = fs.readFileSync(new URL(`${lang}.json`, dir), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as LocaleTable) : {};
  } catch (err) {
    console.warn(`[i18n] could not read server/src/locales/${lang}.json:`, (err as Error).message);
    return {};
  }
}

for (const lang of ['en', ...OVERLAY_LANGS]) tables[lang] = load(lang);

/** Overlay text for `lang` / `ns` / `key`, or undefined when the language file has no non-empty entry. */
export function serverLocale(lang: string, ns: string, key: string): string | undefined {
  const v = tables[lang]?.[ns]?.[key];
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}
