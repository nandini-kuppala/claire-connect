// Formatting helpers: Indian number grouping, times, day labels, names.
import { LANGS } from '@shared/taxonomy';

/** ₹1,68,000 — Indian grouping, no decimals unless needed. */
export function inr(n: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const digits = opts.decimals && !Number.isInteger(v) ? 2 : 0;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** 1,00,000 */
export const num = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('en-IN'));

const toDate = (ts: number | string | Date) => (ts instanceof Date ? ts : new Date(typeof ts === 'string' && /^\d+$/.test(ts) ? Number(ts) : ts));

/** 14:05 style clock time in the user's locale (24h stays compact in bubbles). */
export function clock(ts: number | string | Date): string {
  const d = toDate(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function sameDay(a: number, b: number) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** "Today", "Yesterday", "Mon 17 Nov" — `labels` lets callers pass translated words. */
export function dayLabel(ts: number, labels: { today: string; yesterday: string } = { today: 'Today', yesterday: 'Yesterday' }): string {
  const now = Date.now();
  if (sameDay(ts, now)) return labels.today;
  if (sameDay(ts, now - 86_400_000)) return labels.yesterday;
  const d = new Date(ts);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) });
}

/** Inbox timestamp: time today, "Yesterday", weekday this week, else date. */
export function listTime(ts: number | null | undefined, yesterday = 'Yesterday'): string {
  if (!ts) return '';
  const now = Date.now();
  if (sameDay(ts, now)) return clock(ts);
  if (sameDay(ts, now - 86_400_000)) return yesterday;
  const d = new Date(ts);
  if (now - ts < 6 * 86_400_000) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** 0:42 */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function initials(name?: string | null): string {
  const parts = String(name ?? '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] ?? '';
  const second = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? '') : ([...parts[0]][1] ?? '');
  return (first + second).toUpperCase();
}

export function langNative(code?: string | null): string {
  return LANGS.find((l) => l.code === code)?.native ?? (code ? code.toUpperCase() : '');
}

export function langEnglish(code?: string | null): string {
  return LANGS.find((l) => l.code === code)?.english ?? (code ? code.toUpperCase() : '');
}

/** Deterministic 32-bit hash (FNV-1a) — used for waveform bars and avatar colours. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Warm, dye-inspired avatar colours (loom green, madder, indigo-ink, turmeric, plum, olive, rust, slate).
const ACCENTS = ['#1F8C73', '#B9502F', '#3D4B6E', '#B7802A', '#6D4466', '#5E6B2E', '#9A4A26', '#44524C', '#7A5230', '#2F6F6A'];
export const accentFor = (seed: string) => ACCENTS[hash(seed) % ACCENTS.length];

export const firstName = (name?: string | null) => String(name ?? '').trim().split(/\s+/)[0] ?? '';
