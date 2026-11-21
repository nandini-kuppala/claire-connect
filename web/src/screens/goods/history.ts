// "Your history with them" (J15): private numbers from my own Goods jobs with a business, for search results.
// Requests from many cards on one screen are batched into one call.
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../../store/session';

export interface History { jobs: number; usual_days: number | null; loss_pct: number | null; processes: string[] }
const cache = new Map<string, History | null>();
const pending = new Set<string>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  if (!ids.length) return;
  ids.forEach((id) => inflight.add(id));
  void api.get<{ history: Record<string, History> }>(`/api/sc/history?ids=${ids.map(encodeURIComponent).join(',')}`)
    .then((r) => { for (const id of ids) cache.set(id, r.history[id] ?? null); })
    .catch(() => { for (const id of ids) cache.set(id, null); })
    .finally(() => { ids.forEach((id) => inflight.delete(id)); listeners.forEach((l) => l()); });
}

export function useGoodsHistory(businessId: string | null | undefined): History | null {
  const on = useSession((st) => !!st.features?.supplyChain && st.user?.role !== 'staff');
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on || !businessId) return;
    const l = () => bump((x) => x + 1);
    listeners.add(l);
    if (!cache.has(businessId) && !inflight.has(businessId)) {
      pending.add(businessId);
      if (!timer) timer = setTimeout(flush, 60);
    }
    return () => { listeners.delete(l); };
  }, [on, businessId]);
  return on && businessId ? cache.get(businessId) ?? null : null;
}
