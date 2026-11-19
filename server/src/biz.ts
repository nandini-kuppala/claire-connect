import { byId, find } from './db/index.js';
import { trustOf } from './trust.js';
import { HttpError } from './util.js';
import type { ListingSummary } from '../../shared/cards.js';

export interface UserRow {
  id: string; phone: string; name: string | null; language: string; business_id: string | null; role: string; chat_token: string | null; onboarded: number; is_seed: number;
}

export async function getUser(id: string): Promise<UserRow> {
  const u = await byId<UserRow>('users', id);
  if (!u) throw new HttpError(404, 'User not found');
  return u;
}

export async function getBiz(id: string): Promise<any> {
  const b = await byId('businesses', id);
  if (!b) throw new HttpError(404, 'Business not found');
  return { ...b, sells: b.sells ?? [], buys: b.buys ?? [] };
}

export async function bizUsers(businessId: string) {
  return find<UserRow>('users', { business_id: businessId, role: 'owner' });
}

export async function publicBiz(id: string) {
  const [b, t, users] = await Promise.all([getBiz(id), trustOf(id), bizUsers(id)]);
  return {
    id: b.id, slug: b.slug, name: b.name, ownerName: b.owner_name, language: b.language, city: b.city, state: b.state, area: b.area,
    about: b.about, role: b.role_label, sells: b.sells, buys: b.buys, capacity: b.capacity_note, gstVerified: !!b.gst_verified,
    isManufacturer: !!b.is_manufacturer, unitVisited: !!b.unit_visited, replyMinutes: b.reply_minutes, accent: b.accent, isDemo: !!b.is_seed,
    autoReply: b.auto_reply, trust: t, userIds: users.map((u) => u.id),
  };
}

export function listingRow(r: any) {
  return {
    id: r.id, businessId: r.business_id, category: r.category, type: r.type, title: r.title, attrs: r.attrs ?? {}, images: r.images ?? [],
    art: r.art ?? undefined, price: r.price, unit: r.unit, moq: r.moq, sizeSet: r.size_set ?? null, minOrderValue: r.min_order_value ?? null,
    stock: r.stock_qty, capacityPerDay: r.capacity_per_day, leadDays: r.lead_days, active: !!r.active,
  };
}

export async function listingSummary(r: any, businessName?: string): Promise<ListingSummary> {
  return {
    id: r.id, businessId: r.business_id, businessName: businessName ?? r.business_name ?? '', title: r.title, price: r.price, unit: r.unit, moq: r.moq,
    stock: r.stock_qty, art: r.art ?? undefined, image: (r.images ?? [])[0], trust: (await trustOf(r.business_id)).score,
  };
}

/** Owner user ids of a list of businesses — used as chat members. */
export async function usersOf(businessIds: string[]) {
  const users = await find<UserRow>('users', { business_id: { $in: businessIds }, role: 'owner' });
  return users.map((u) => u.id);
}
