// Best-effort transliteration of names via Sarvam (existing key). Lossy ("நொய்யல்" → "Neel"), so it only adds
// searchable forms; matching stays fuzzy across scripts (04 §9.2). Never blocks a write.
import { cfg } from '../config.js';

const LANG: Record<string, string> = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };

export async function transliterate(text: string, from: 'en' | 'ta' | 'hi', to: 'en' | 'ta' | 'hi'): Promise<string | null> {
  if (!cfg.sarvamKey || from === to || !text.trim()) return null;
  try {
    const res = await fetch('https://api.sarvam.ai/transliterate', {
      method: 'POST',
      headers: { 'api-subscription-key': cfg.sarvamKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text.slice(0, 120), source_language_code: LANG[from], target_language_code: LANG[to] }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { transliterated_text?: string };
    return j.transliterated_text?.trim() || null;
  } catch {
    return null;
  }
}

/** Detects the script of a name: Tamil, Devanagari or Latin. */
export function scriptOf(text: string): 'ta' | 'hi' | 'en' {
  if (/[஀-௿]/.test(text)) return 'ta';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  return 'en';
}

/** All three forms of a name (the typed one kept as is). */
export async function nameForms(name: string): Promise<{ en?: string; ta?: string; hi?: string }> {
  const src = scriptOf(name);
  const forms: { en?: string; ta?: string; hi?: string } = { [src]: name.trim() };
  const targets = (['en', 'ta', 'hi'] as const).filter((l) => l !== src);
  const out = await Promise.all(targets.map((t) => transliterate(name, src, t)));
  targets.forEach((t, i) => {
    if (out[i]) forms[t] = out[i]!;
  });
  return forms;
}
