// Entity resolution for personal Claire (04 §9.2): the model never gives ids. Party names in any script are matched
// phonetically against this business's own parties; materials and colours map to specs it has used.
import { col } from '../../db/index.js';
import type { Ctx } from '../flag.js';
import type { PartyRef } from '../../../../shared/sc/types.js';

// ── Romanizing Tamil and Devanagari (rough, for matching only) ─────────────────────────────────────
const TA_C: Record<string, string> = { 'க': 'k', 'ங': 'ng', 'ச': 'ch', 'ஞ': 'nj', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n', 'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h' };
const TA_V: Record<string, string> = { 'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ii', 'உ': 'u', 'ஊ': 'uu', 'எ': 'e', 'ஏ': 'ee', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oo', 'ஔ': 'au' };
const TA_S: Record<string, string> = { 'ா': 'aa', 'ி': 'i', 'ீ': 'ii', 'ு': 'u', 'ூ': 'uu', 'ெ': 'e', 'ே': 'ee', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oo', 'ௌ': 'au', '்': '' };
const HI_C: Record<string, string> = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ज़': 'z', 'फ़': 'f', 'ड़': 'r' };
const HI_V: Record<string, string> = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ii', 'उ': 'u', 'ऊ': 'uu', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri' };
const HI_S: Record<string, string> = { 'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri', '्': '', 'ं': 'n', 'ँ': 'n', 'ः': 'h', '़': '' };

function romanizeScript(word: string, C: Record<string, string>, V: Record<string, string>, S: Record<string, string>, schwaDrop: boolean): string {
  const chars = [...word.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (C[ch] !== undefined) {
      const next = chars[i + 1];
      if (next !== undefined && S[next] !== undefined) { out += C[ch] + S[next]; i++; }
      else out += C[ch] + 'a';
    } else if (V[ch] !== undefined) out += V[ch];
    else if (S[ch] !== undefined) out += S[ch];
    else out += ch;
  }
  return schwaDrop && out.endsWith('a') && out.length > 2 ? out.slice(0, -1) : out;
}

/** Any-script text to rough Latin, word by word. */
export function romanize(text: string): string {
  return text.split(/(\s+)/).map((w) => (/[஀-௿]/.test(w) ? romanizeScript(w, TA_C, TA_V, TA_S, false) : /[ऀ-ॿ]/.test(w) ? romanizeScript(w, HI_C, HI_V, HI_S, true) : w)).join('');
}

/** A phonetic key that forgives spelling and script: Noyyal / Nooyyal / நொய்யல் / नोय्यल all agree. */
export function phoneticKey(latin: string): string {
  let s = latin.toLowerCase().replace(/[^a-z]/g, '');
  const pairs: [RegExp, string][] = [[/ksh/g, 'ks'], [/th/g, 't'], [/dh/g, 'd'], [/sh/g, 's'], [/zh/g, 'l'], [/ph/g, 'p'], [/bh/g, 'p'], [/kh/g, 'k'], [/gh/g, 'k'], [/ch/g, 'c'], [/j/g, 'c'], [/z/g, 's'], [/w/g, 'v'], [/q/g, 'k'], [/x/g, 'ks'], [/b/g, 'p'], [/g/g, 'k'], [/d/g, 't'], [/f/g, 'p'], [/aa/g, 'a'], [/ii/g, 'i'], [/ee/g, 'i'], [/uu/g, 'u'], [/oo/g, 'o'], [/ou/g, 'u'], [/ai/g, 'e'], [/y$/g, 'i']];
  for (const [re, to] of pairs) s = s.replace(re, to);
  return s.replace(/(.)\1+/g, '$1');
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const GENERIC = new Set(['garments', 'garment', 'textiles', 'textile', 'dyeing', 'dyers', 'fabrics', 'fabric', 'exports', 'export', 'works', 'work', 'job', 'unit', 'mills', 'mill', 'traders', 'trading', 'knit', 'knits', 'fashions', 'fashion', 'processing', 'printers', 'printing', 'trims', 'stitching', 'the', 'and', 'co', 'company', 'pvt', 'ltd', 'enterprises', 'industries', 'sri', 'shri', 'sree', 'apparels', 'clothing']);
// Tamil/Hindi case endings on a name: லக்ஷ்மிக்கு (to), நொய்யல்ல (at), लक्ष्मी को.
const SUFFIXES = ['ukku', 'kku', 'ikku', 'ilirundu', 'irundu', 'kitte', 'kitta', 'idam', 'ille', 'illa', 'lla', 'il', 'ku', 'oda', 'ode'];

interface Cand { ref: PartyRef; name: string; keys: string[] }

/** Distinctive tokens of a name (generic trade words and very short words left out unless that's all there is). */
const GENERIC_KEYS = new Set([...GENERIC].map((g) => phoneticKey(g)));
function keysOf(names: string[]): string[] {
  const keys = new Set<string>();
  for (const n of names) {
    const toks = romanize(n).toLowerCase().split(/[^a-z]+/).filter(Boolean);
    // Generic words compared by sound, so a Tamil "ஸ்ரீ" (srii) or "ஃபேப்ரிக்ஸ்" counts as generic too.
    const strong = toks.filter((t) => !GENERIC_KEYS.has(phoneticKey(t)) && !GENERIC_KEYS.has(phoneticKey(t.replace(/s$/, ''))) && t.length >= 3);
    for (const t of strong.length ? strong : toks) keys.add(phoneticKey(t));
  }
  return [...keys].filter((k) => k.length >= 3);
}

/** Exposed for unit tests only. */
export const __keysForTest = keysOf;

/** This business's parties: its contacts and every business it has traded goods with. */
export async function candidates(ctx: Ctx): Promise<Cand[]> {
  const contacts = await col('sc_contacts').find({ owner_business_id: ctx.businessId, archived_at: { $exists: false } } as any).limit(300).toArray();
  const movs = await col('sc_movements').find({ party_business_ids: ctx.businessId } as any, { projection: { party_business_ids: 1 } }).sort({ recorded_at: -1 }).limit(400).toArray();
  const bizIds = [...new Set(movs.flatMap((m: any) => m.party_business_ids as string[]).filter((b) => b !== ctx.businessId))];
  const bizs = await col('businesses').find({ _id: { $in: bizIds } } as any, { projection: { name: 1 } }).toArray();
  return [
    ...contacts.map((c: any) => ({ ref: { k: 'c' as const, id: c._id as string }, name: c.name as string, keys: keysOf([c.name, ...Object.values((c.name_forms ?? {}) as Record<string, string>)]) })),
    ...bizs.map((b: any) => ({ ref: { k: 'b' as const, id: b._id as string }, name: b.name as string, keys: keysOf([b.name]) })),
  ];
}

const tokenKeys = (text: string) =>
  romanize(text).toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 3).flatMap((t) => {
    const out = [phoneticKey(t)];
    for (const suf of SUFFIXES) if (t.endsWith(suf) && t.length - suf.length >= 3) out.push(phoneticKey(t.slice(0, -suf.length)));
    return out;
  });

function score(tk: string, ck: string): number {
  if (tk === ck) return 3;
  if (ck.length >= 4 && (tk.startsWith(ck) || (tk.length >= 4 && ck.startsWith(tk)))) return 2;
  if (Math.min(tk.length, ck.length) >= 4 && lev(tk, ck) <= 1) return 1.5;
  return 0;
}

export interface PartyMatch { best: Cand | null; options: Cand[] }

/** Matches a name said in any script (or any mention inside a sentence) to this business's parties. */
export function matchParty(said: string, cands: Cand[]): PartyMatch {
  const tks = tokenKeys(said);
  const scored = cands.map((c) => ({ c, s: Math.max(0, ...c.keys.flatMap((ck) => tks.map((tk) => score(tk, ck)))) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!scored.length) return { best: null, options: [] };
  const top = scored.filter((x) => x.s === scored[0].s);
  return top.length === 1 ? { best: top[0].c, options: [top[0].c] } : { best: null, options: top.slice(0, 4).map((x) => x.c) };
}

// ── Materials, colours, sizes ───────────────────────────────────────────────────────────────────
const MATERIAL_WORDS: [RegExp, string][] = [
  [/\bkits?\b|கிட்|किट/i, 'kit'],
  [/fabric|cloth|jersey|\bsj\b|துணி|ஜெர்சி|कपड़ा|कपडा|जर्सी/i, 'knit_fabric'],
  [/garments?|pieces|\bpcs\b|t-?shirts?|பீஸ்|ஆடை|டி-?ஷர்ட்|पीस|कपड़े|टी-?शर्ट/i, 'garment'],
  [/buttons?|பட்டன்|बटन/i, 'button'],
  [/zips?|zippers?|ஜிப்|ज़िप|जिप/i, 'zip'],
  [/yarn|நூல்|धागा|यार्न/i, 'yarn'],
  [/panels?|fronts?|backs?|sleeves?|பேனல்|पैनल/i, 'cut_panel'],
  [/waste|வேஸ்ட்|वेस्ट/i, 'waste'],
];
const COLOUR_WORDS: [RegExp, string][] = [
  [/navy|நேவி|नेवी/i, 'navy'], [/black|கருப்பு|ப்ளாக்|काला|काली|ब्लैक/i, 'black'], [/white|வெள்ளை|வைட்|सफ़ेद|सफेद|व्हाइट/i, 'white'],
  [/red|சிவப்பு|ரெட்|लाल|रेड/i, 'red'], [/maroon|மெரூன்|मैरून/i, 'maroon'], [/blue|நீலம்|ப்ளூ|नीला|ब्लू/i, 'blue'], [/green|பச்சை|ग्रीन|हरा/i, 'green'],
];
const GREY = /\bgrey\b|\bgray\b|கிரே|க்ரே|ग्रे/i;
export const materialKey = (s?: string | null) => (s ? MATERIAL_WORDS.find(([re]) => re.test(s))?.[1] ?? null : null);
export const colourKey = (s?: string | null) => (s ? COLOUR_WORDS.find(([re]) => re.test(s))?.[1] ?? null : null);
export const isGrey = (s?: string | null) => !!s && GREY.test(s);
export const LABEL_RE: Record<string, RegExp> = { kit: /cut kits/i, knit_fabric: /jersey|fabric|interlock|rib|fleece|pique|gsm/i, garment: /garments/i, button: /buttons/i, zip: /zips/i, yarn: /yarn|count/i, cut_panel: /panel|front|back|sleeve/i, waste: /waste/i };

/** Does an English label fit what was asked ("navy fabric")? Unknown words don't filter. */
export function labelFits(label: string, material?: string | null, colour?: string | null): boolean {
  const mk = materialKey(material) ?? materialKey(colour);
  const ck = colourKey(colour) ?? colourKey(material);
  if (mk && LABEL_RE[mk] && !LABEL_RE[mk].test(label)) return false;
  if (ck && !new RegExp(ck, 'i').test(label)) return false;
  if ((isGrey(material) || isGrey(colour)) && !/grey/i.test(label)) return false;
  return true;
}
