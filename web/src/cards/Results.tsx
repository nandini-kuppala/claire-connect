// Compact results card in Claire's chat: summary, Claire's take, top 2 suppliers, then "See all" → /results/:id.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Chip, MatchCard } from '@shared/cards';
import { Columns, MessageCircle, Users } from '../icons';
import { Button } from '../components/Button';
import { ClaireMark } from '../components/Avatar';
import type { CardProps } from './types';
import { cleanLabel, errMsg, inr, isStale } from './format';
import { strings } from './strings';
import { ErrorLine, TrustPill } from './ui';
import { useChipLock } from './Chips';
import { RS } from '../screens/results.strings';

/** MatchCard carries no unit; infer it from the listing art. */
function unitKey(m: MatchCard): 'kg' | 'dozen' | 'piece' {
  const s = m.art?.shape;
  if (s === 'fabric' || s === 'yarn' || s === 'dye') return 'kg';
  if (s === 'brief' || s === 'vest') return 'dozen';
  return 'piece';
}

export function ResultsCard({ message, payload, ctx }: CardProps<'results'>) {
  const nav = useNavigate();
  const t = strings(ctx.lang);
  const s = (key: Parameters<typeof RS.get>[1], vars?: Record<string, string | number>) => RS.get(ctx.lang, key, vars);
  const { locked, pick } = useChipLock(isStale(message, ctx));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const singles = [...payload.singles, ...payload.mto];
  const all = [...payload.singles, ...payload.combos, ...payload.mto];
  const sellers = new Set(all.flatMap((m) => m.lines.map((l) => l.businessId))).size;
  const first = all[0];
  const unit = first ? s(`u_${unitKey(first)}1` as Parameters<typeof RS.get>[1]) : '';
  const minPrice = all.length ? Math.min(...all.map((m) => m.avgPrice)) : 0;
  const top = singles.slice(0, 2);
  const combo = !top.length ? payload.combos[0] : undefined;
  const days = (n: number) => (n <= 1 ? s('day_1') : s('days_n', { n }));

  const take =
    payload.note ??
    (top[0]
      ? s('card_take', { name: top[0].lines[0]?.businessName ?? '', price: inr(top[0].avgPrice), unit, days: days(top[0].readyDays) })
      : combo
        ? s('card_take_combo', { n: combo.lines.length })
        : null);

  const go = (path: string) => nav(path);
  const chat = async (key: string, fn: () => Promise<unknown> | unknown) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const footer: Chip[] = [
    { id: 'refine:budget', label: t('change_budget') },
    { id: 'restart', label: t('start_over') },
  ];

  return (
    <div className="w-full max-w-[380px] overflow-hidden rounded-[22px] border border-line bg-surface text-ink">
      <div className="px-4 pt-4">
        <h3 className="font-head text-[16px] leading-snug font-semibold text-ink">{payload.title}</h3>
        {all.length > 0 && (
          <p className="mt-0.5 text-[13px] text-meta">
            {sellers === 1 ? s('card_summary_1', { price: inr(minPrice), unit }) : s('card_summary', { n: sellers, price: inr(minPrice), unit })}
          </p>
        )}
        {take && (
          <p className="mt-3 flex items-start gap-2 rounded-[16px] bg-accent-tint px-3 py-2.5 text-[13px] leading-snug text-ink-2">
            <ClaireMark size={22} className="mt-px" />
            <span className="min-w-0">{take}</span>
          </p>
        )}
      </div>

      {(top.length > 0 || combo) && (
        <ul className="mt-2 divide-y divide-line px-4">
          {top.map((m, i) => {
            const l = m.lines[0];
            if (!l) return null;
            const key = `t${i}`;
            return (
              <li key={key} className="flex items-center gap-3 py-3">
                <button type="button" onClick={() => ctx.openStorefront(l.businessId)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{l.businessName}</span>
                    <TrustPill score={m.trust} t={t} className="h-[22px] text-[11px]" />
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink-2">
                    <span className="font-head text-[15px] font-bold text-ink tabular-nums">{inr(m.avgPrice)}</span>
                    <span className="text-meta">/{unit}</span>
                    <span className="text-faint"> · </span>
                    {m.readyDays <= 1 ? s('ready_1') : s('ready_in', { n: m.readyDays })}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="tint"
                  icon={MessageCircle}
                  loading={busy === key}
                  disabled={!!busy}
                  onClick={() => chat(key, () => ctx.openDeal(l.businessId, { requirementId: payload.requirementId, listingId: l.listingId }))}
                  aria-label={`${s('chat')} ${l.businessName}`}
                >
                  {s('chat')}
                </Button>
              </li>
            );
          })}
          {combo && (
            <li className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
                <Users size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">{s('split_names', { names: combo.lines.map((l) => l.businessName).join(' + ') })}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  <span className="font-head text-[15px] font-bold text-ink tabular-nums">{inr(combo.avgPrice)}</span>
                  <span className="text-meta">/{unit}</span>
                  <span className="text-faint"> · </span>
                  {combo.readyDays <= 1 ? s('ready_1') : s('ready_in', { n: combo.readyDays })}
                </p>
              </div>
              <Button
                size="sm"
                variant="tint"
                icon={MessageCircle}
                loading={busy === 'combo'}
                disabled={!!busy}
                onClick={() =>
                  chat('combo', async () => {
                    const r = await ctx.api.post<{ conversations?: { id: string }[] }>('/api/deals/combo', { requirementId: payload.requirementId, lines: combo.lines });
                    const id = r?.conversations?.[0]?.id;
                    if (id) ctx.openConversation(id);
                    ctx.refresh();
                  })
                }
              >
                {combo.lines.length === 2 ? s('chat_both') : s('chat_all', { n: combo.lines.length })}
              </Button>
            </li>
          )}
        </ul>
      )}

      {error && (
        <div className="px-4">
          <ErrorLine>{error}</ErrorLine>
        </div>
      )}

      <div className="px-4 pt-2 pb-3">
        <Button block variant="primary" onClick={() => go(`/results/${payload.requirementId}`)}>
          {sellers > 1 ? s('see_all', { n: sellers }) : s('see_details')}
        </Button>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
          {singles.length > 1 && (
            <button
              type="button"
              onClick={() => go(`/compare/${payload.requirementId}`)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-primary hover:bg-primary-tint"
            >
              <Columns size={15} aria-hidden />
              {s('compare_link')}
            </button>
          )}
          {!locked &&
            footer.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (locked) return;
                  pick(c.id);
                  void ctx.chip(c.id, cleanLabel(c.label));
                }}
                className="inline-flex min-h-10 items-center rounded-full px-3 text-[13px] font-medium text-meta hover:bg-sunken"
              >
                {c.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export default ResultsCard;
