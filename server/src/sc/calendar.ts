// Closed days (Q): each business keeps its own weekly off days and holidays (`businesses.sc_calendar`). Every request
// under /api/sc runs inside that business's calendar (AsyncLocalStorage), so the shared working-day maths (lateness,
// expected dates, oldest unpaid, performance, history) uses it without each caller passing it along.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { col } from '../db/index.js';
import type { ScRequest } from './flag.js';
import { calendarFrom, setCalendarProvider, type Calendar } from '../../../shared/sc/dates.js';

const als = new AsyncLocalStorage<Calendar>();
setCalendarProvider(() => als.getStore());

export interface StoredCalendar { off_weekdays: number[]; holidays: string[] }
export const DEFAULT_STORED: StoredCalendar = { off_weekdays: [0], holidays: [] };

const cache = new Map<string, { at: number; stored: StoredCalendar; cal: Calendar }>();
const TTL = 60_000;

export async function storedCalendar(bizId: string): Promise<StoredCalendar> {
  const hit = cache.get(bizId);
  if (hit && Date.now() - hit.at < TTL) return hit.stored;
  const b: any = await col('businesses').findOne({ _id: bizId } as any, { projection: { sc_calendar: 1 } });
  const stored: StoredCalendar = { off_weekdays: b?.sc_calendar?.off_weekdays ?? DEFAULT_STORED.off_weekdays, holidays: b?.sc_calendar?.holidays ?? [] };
  cache.set(bizId, { at: Date.now(), stored, cal: calendarFrom(stored) });
  return stored;
}

export async function calendarFor(bizId: string): Promise<Calendar> {
  await storedCalendar(bizId);
  return cache.get(bizId)!.cal;
}

export function forgetCalendar(bizId: string) {
  cache.delete(bizId);
}

/** Runs `fn` with a business's calendar as the default (background jobs, which have no request). */
export async function withCalendar<T>(bizId: string, fn: () => Promise<T>): Promise<T> {
  const cal = await calendarFor(bizId);
  return als.run(cal, fn);
}

/** Express middleware (after requireSc): the rest of the request runs inside the business's calendar. */
export function calendarContext(req: Request, _res: Response, next: NextFunction) {
  const ctx = (req as ScRequest).ctx;
  if (!ctx?.businessId) return next();
  calendarFor(ctx.businessId).then((cal) => als.run(cal, () => next()), next);
}
