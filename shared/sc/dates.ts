// Business dates (IST, model P14), working-day arithmetic with private closed days (Q), and lateness.

const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;

/** Today's business date in IST as YYYY-MM-DD. */
export const todayIST = (now = Date.now()) => new Date(now + IST_OFFSET).toISOString().slice(0, 10);

const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(toMs(d)).getUTCDay(); // 0 = Sunday

export interface Calendar {
  offWeekdays: number[]; // default [0]: Sundays off
  closed?: Set<string>; // cluster events / holidays (YYYY-MM-DD)
}

export const DEFAULT_CALENDAR: Calendar = { offWeekdays: [0] };

/** A business's stored closed days (Q: weekly off days and holidays) as a Calendar. */
export function calendarFrom(stored: { off_weekdays?: number[] | null; holidays?: string[] | null } | null | undefined): Calendar {
  if (!stored) return DEFAULT_CALENDAR;
  const off = (stored.off_weekdays ?? DEFAULT_CALENDAR.offWeekdays).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return { offWeekdays: off.length >= 7 ? DEFAULT_CALENDAR.offWeekdays : off, closed: new Set(stored.holidays ?? []) };
}

// The server sets a provider that returns the calendar of the business making the request (AsyncLocalStorage), so
// every working-day sum that doesn't pass a calendar uses that business's closed days. Without one (the web, tests),
// the default calendar applies.
let provider: (() => Calendar | undefined) | null = null;
export function setCalendarProvider(fn: (() => Calendar | undefined) | null) {
  provider = fn;
}
export const currentCalendar = (): Calendar => provider?.() ?? DEFAULT_CALENDAR;

export const isWorkingDay = (d: string, cal: Calendar = currentCalendar()) => !cal.offWeekdays.includes(weekday(d)) && !cal.closed?.has(d);

/** Adds n working days, counting from the day after `start` (6 working days from Sat 21 Nov 2026 = Sat 28 Nov). */
export function addWorkingDays(start: string, n: number, cal: Calendar = currentCalendar()): string {
  let ms = toMs(start);
  let left = Math.max(0, Math.ceil(n));
  while (left > 0) {
    ms += DAY;
    if (isWorkingDay(fromMs(ms), cal)) left--;
  }
  return fromMs(ms);
}

/** Working days strictly after `from` up to and including `to` (0 if `to` ≤ `from`). */
export function workingDaysBetween(from: string, to: string, cal: Calendar = currentCalendar()): number {
  let n = 0;
  for (let ms = toMs(from) + DAY; ms <= toMs(to); ms += DAY) if (isWorkingDay(fromMs(ms), cal)) n++;
  return n;
}

export type LateReason = 'processing' | 'ready_not_collected' | 'held_for_dues' | 'detained' | 'waiting_input';

export interface Lateness {
  status: 'on_time' | 'due_today' | 'late';
  days: number;
  reason: LateReason | null;
}

/** Lateness of anything not yet back (model §11.1). Paused days (with a reason) are not counted. */
export function lateness(expected: string, today: string, opts: { cal?: Calendar; pausedDays?: number; reason?: LateReason | null } = {}): Lateness {
  if (today === expected) return { status: 'due_today', days: 0, reason: null };
  const days = Math.max(0, workingDaysBetween(expected, today, opts.cal) - (opts.pausedDays ?? 0));
  if (today < expected || days === 0) return { status: 'on_time', days: 0, reason: null };
  return { status: 'late', days, reason: opts.reason ?? 'processing' };
}
