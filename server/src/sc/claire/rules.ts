// The deterministic layer of personal Claire (04 §9.2, §9.3 tiers 0 and 3): exact chips and plain phrases go straight
// to a tool with no model call; when every model fails, a rule parser reads the common record and question shapes.
import { validateCall, type ToolCall } from './tools.js';

const mk = (tool: string, args: object): ToolCall => validateCall(tool, args)!;

const CHIP: Record<string, ToolCall> = {
  'sc:late': mk('query_jobs', { status: 'late' }),
  'sc:out': mk('query_holdings', { scope: 'out_with_others' }),
  'sc:coming': mk('query_holdings', { scope: 'coming_in' }),
  'sc:in': mk('query_holdings', { scope: 'in_my_unit' }),
  'sc:ready': mk('query_jobs', { status: 'ready' }),
  'sc:loss': mk('compute_analytics', { metric: 'loss_pct' }),
};
export const chipCall = (id: string): ToolCall | null => CHIP[id] ?? null;

const PHRASES: [RegExp, ToolCall][] = [
  [/^(what'?s|what is|show)?\s*late\??$|^late (work|jobs)\??$|^தாமதம்\??$|^என்ன தாமதம்\??$|^क्या देर है\??$|^देर वाले काम\??$/i, CHIP['sc:late']],
  [/^(goods )?out with others\??$|^வெளியே உள்ளது\??$|^दूसरों के पास\??$/i, CHIP['sc:out']],
  [/^coming in\??$|^வர வேண்டியது\??$|^आने वाला( माल)?\??$/i, CHIP['sc:coming']],
  [/^in my unit\??$|^என் யூனிட்டில்\??$|^मेरी यूनिट में\??$/i, CHIP['sc:in']],
  [/^ready to collect\??$|^எடுக்க தயார்\??$|^लेने को तैयार\??$/i, CHIP['sc:ready']],
];
export function phraseCall(text: string): ToolCall | null {
  const t = text.trim().replace(/\s+/g, ' ');
  return PHRASES.find(([re]) => re.test(t))?.[1] ?? null;
}

// ── Tier 3: rules ───────────────────────────────────────────────────────────────────────────────
const QUESTION = /\?|^(how|where|what|which|did|has|is|was|when)\b|எவ்வளவு|எங்கே|எத்தனை|என்ன\b|ஆச்சா|ச்சா\b|தா\?|கிடைச்சதா|வந்ததா|कितना|कितने|कहाँ|क्या\b|कब/i;
const PLAN = /\bwill\b|need to|going to|tomorrow|have to|அனுப்பணும்|அனுப்பப்போ|நாளைக்கு|அனுப்ப வேண்டும்|भेजना है|भेजूँगा|भेजेंगे|कल भेज/i;
const VERBS: [RegExp, 'send_for_work' | 'got_back' | 'buy' | 'sell'][] = [
  [/came back|got back|received|returned|வந்தது|வந்துச்சு|திரும்ப|வாங்கிட்டேன்|वापस आया|वापस आए|मिला|मिले/i, 'got_back'],
  [/\bsent\b|\bgave\b|dispatched|அனுப்பினேன்|அனுப்பியாச்சு|அனுப்பிட்டேன்|அனுப்பினோம்|कोभेजा|भेजा|भेज दिया|भेजे/i, 'send_for_work'],
  [/\bbought\b|purchased|வாங்கினேன்|வாங்கினோம்|खरीदा|खरीदे/i, 'buy'],
  [/\bsold\b|விற்றேன்|வித்தேன்|வித்தோம்|बेचा|बेचे/i, 'sell'],
];
const UNIT_WORDS: [RegExp, 'kg' | 'pcs' | 'dozen' | 'rolls' | 'sets' | 'cones' | 'm'][] = [
  [/^(kg|kgs|kilo|kilos|கிலோ|किलो)$/i, 'kg'], [/^(pcs|pieces|piece|nos|பீஸ்|पीस)$/i, 'pcs'], [/^(dozen|dz|டஜன்|दर्जन)$/i, 'dozen'],
  [/^(rolls?|ரோல்|रोल)$/i, 'rolls'], [/^(sets?|செட்|सेट)$/i, 'sets'], [/^(cones?|கோன்|कोन)$/i, 'cones'], [/^(m|metres?|meters?|மீட்டர்|मीटर)$/i, 'm'],
];
const SIZE = /\b(XXS|XS|S|M|L|XL|XXL|XXXL|3XL|4XL)\b/g;
// Spoken numbers (voice transcripts often spell them out): ஐம்பது / ஐநூறு (50 / 500) must never be confused.
const NUMBER_WORDS: [RegExp, number][] = [
  [/ஆயிரம்|हज़ार|हजार|\bthousand\b/g, 1000], [/தொள்ளாயிரம்/g, 900], [/எண்ணூறு/g, 800], [/எழுநூறு/g, 700], [/அறுநூறு/g, 600], [/ஐநூறு|पाँच सौ|पांच सौ|five hundred/g, 500], [/நானூறு|चार सौ|four hundred/g, 400],
  [/முந்நூறு|முன்னூறு|तीन सौ|three hundred/g, 300], [/இருநூறு|दो सौ|two hundred/g, 200], [/நூறு|\bसौ\b|\bhundred\b/g, 100], [/தொண்ணூறு|नब्बे|ninety/g, 90], [/எண்பது|अस्सी|eighty/g, 80], [/எழுபது|सत्तर|seventy/g, 70],
  [/அறுபது|साठ|sixty/g, 60], [/ஐம்பது|पचास|fifty/g, 50], [/நாற்பது|चालीस|forty/g, 40], [/முப்பது|तीस|thirty/g, 30], [/இருபது|बीस|twenty/g, 20], [/பத்து|\bदस\b|\bten\b/g, 10],
];
export const spellNumbers = (t: string) => NUMBER_WORDS.reduce((acc, [re, n]) => acc.replace(re, ` ${n} `), t);
const ANALYTICS: [RegExp, 'loss_pct' | 'turnaround_days' | 'reject_pct'][] = [[/loss|லாஸ்|சேதாரம்|लॉस|घटत/i, 'loss_pct'], [/how (many|long).*(days?|take)|turnaround|எத்தனை நாள்|कितने दिन/i, 'turnaround_days'], [/reject|ரிஜெக்ட்|रिजेक्ट/i, 'reject_pct']];
const PERIOD: [RegExp, 'today' | 'this_week' | 'this_month'][] = [[/today|இன்று|இன்னைக்கு|आज/i, 'today'], [/this week|இந்த வாரம்|इस हफ़्ते|इस हफ्ते/i, 'this_week'], [/this month|இந்த மாசம்|இந்த மாதம்|इस महीने/i, 'this_month']];

/** Reads "sent 400 polo kits to Lakshmi, S M only" / "நொய்யல்ல எவ்வளவு நேவி துணி?" without a model. */
export function ruleCall(text: string): ToolCall | null {
  const t = spellNumbers(text.trim());
  const isQ = QUESTION.test(t);
  const isPlan = PLAN.test(t);
  const verb = VERBS.find(([re]) => re.test(t))?.[1] ?? (isPlan && /\bsend\b|அனுப்ப|भेज/i.test(t) ? 'send_for_work' : null);
  const nums = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*([^\s\d,.;!?]+)?/g)].map((m) => ({ qty: Number(m[1].replace(',', '.')), unit: UNIT_WORDS.find(([re]) => re.test(m[2] ?? ''))?.[1] }));
  if (verb && nums.length && !isQ) {
    const sizes = [...new Set([...t.toUpperCase().matchAll(SIZE)].map((m) => m[1]))];
    return {
      tool: 'draft_record',
      args: {
        action: verb, mood: isPlan ? 'plan' : 'statement', tense: isPlan ? 'future' : 'past', party: t, process: undefined,
        lines: [{ qty: nums[0].qty, unit: nums[0].unit, material: t, colour: t, sizes: sizes.length ? sizes.map((s) => ({ size: s, qty: undefined })) : undefined }],
        day: /yesterday|நேத்து|நேற்று|कल/i.test(t) ? 'yesterday' : undefined, dc_no: undefined,
      },
    };
  }
  const metric = ANALYTICS.find(([re]) => re.test(t))?.[1];
  if (metric && isQ) return { tool: 'compute_analytics', args: { metric, process: undefined } };
  const period = PERIOD.find(([re]) => re.test(t))?.[1];
  if (period && isQ) return { tool: 'query_movements', args: { party: t, direction: verb === 'got_back' || /came|got|received|வந்தது|आया|मिला/i.test(t) ? 'received' : verb || /\bsend\b|அனுப்ப|भेज/i.test(t) ? 'sent' : 'any', period } };
  if (/my unit|in stock|my stock|godown|என் யூனிட்|ஸ்டாக்|स्टॉक|मेरी यूनिट/i.test(t)) return { tool: 'query_holdings', args: { scope: 'in_my_unit', party: undefined, material: t, colour: t, size: undefined } };
  if (/about the job|the job at|job with|வேலை எப்படி|काम कैसा/i.test(t)) return { tool: 'explain_job', args: { party: t, material: t } };
  if (/late|தாமத|देर/i.test(t)) return { tool: 'query_jobs', args: { status: 'late', party: t, process: undefined } };
  if (/ready|தயார|तैयार/i.test(t)) return { tool: 'query_jobs', args: { status: 'ready', party: t, process: undefined } };
  if (isQ || verb) return { tool: 'query_holdings', args: { scope: 'any', party: t, material: t, colour: t, size: undefined } };
  return null;
}
