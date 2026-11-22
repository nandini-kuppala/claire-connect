// Offline strip on the Goods home: "Offline · Last updated 10:42", records waiting to send with their state, and a toast
// with Undo when a kept record is sent (the undo window starts at sync).
import { useEffect, useState } from 'react';
import { api, errorText } from '../../lib/api';
import { discard, listOutbox, onOutbox, retry, type OutboxItem } from '../../lib/offline';
import { useSession } from '../../store/session';
import { WifiOff, Clock, AlertTriangle } from '../../icons';
import { OfflineS } from './Offline.strings';

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export function OutboxBar({ staleAt, onSent }: { staleAt: number | null; onSent: () => void }) {
  const t = OfflineS.use();
  const owner = useSession((st) => st.user?.role !== 'staff');
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [toast, setToast] = useState<{ text: string; undo?: string } | null>(null);

  useEffect(() => {
    const refresh = () => void listOutbox().then(setItems);
    refresh();
    const off = onOutbox((e) => {
      refresh();
      if (e.type === 'sent') {
        const mv = e.response?.movement?.id as string | undefined;
        const until = e.response?.undo_until as number | undefined;
        setToast({ text: t('sent', { label: e.item.label }), undo: mv && until && until > Date.now() ? mv : undefined });
        setTimeout(() => setToast(null), 10_000);
        onSent();
      }
    });
    const on = () => setOnline(true);
    const offl = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', offl);
    return () => { off(); window.removeEventListener('online', on); window.removeEventListener('offline', offl); };
  }, [t, onSent]);

  const undo = async (id: string) => {
    try { await api.post(`/api/sc/movements/${id}/undo`); setToast({ text: t('undone') }); onSent(); } catch (e) { setToast({ text: errorText(e) }); }
  };
  const showStale = !online || staleAt !== null;
  if (!showStale && !items.length && !toast) return null;
  return (
    <>
      {(showStale || items.length > 0) && (
        <section className="mx-4 mt-3 rounded-[18px] border border-line bg-sunken px-4 py-3" aria-live="polite">
          {showStale && (
            <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <WifiOff size={16} aria-hidden />{t('offline')}{staleAt ? <span className="font-normal text-meta"> · {t('last_updated', { time: timeOf(staleAt) })}</span> : null}
            </p>
          )}
          {items.length > 0 && (
            <>
              <p className="mt-1 flex items-center gap-2 text-[14px] text-ink-2"><Clock size={15} aria-hidden />{items.length === 1 ? t('waiting_one') : t('waiting', { n: items.length })}</p>
              <ul className="mt-2 space-y-1.5">
                {items.map((x) => (
                  <li key={x.id} className="rounded-[12px] bg-surface px-3 py-2 text-[13.5px]">
                    <span className="flex items-center gap-2">
                      {x.state === 'check' || x.state === 'failed' ? <AlertTriangle size={15} className="shrink-0 text-accent-ink" aria-hidden /> : <Clock size={15} className="shrink-0 text-meta" aria-hidden />}
                      <span className="min-w-0 flex-1 font-semibold text-ink">{x.label}</span>
                      <span className="shrink-0 text-meta">{timeOf(x.created_at)}</span>
                    </span>
                    {(x.state === 'check' || x.state === 'failed') && (
                      <>
                        <p className="mt-1 text-accent-ink">{x.state === 'check' ? t('check') : `${t('failed')}: ${x.error ?? ''}`}</p>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {x.state === 'check' && owner && <button className="min-h-9 rounded-full border border-line-strong px-3 font-semibold text-ink" onClick={() => void retry(x.id, { allow_untracked: true, untracked_reason: 'Recorded offline; stock was short' })}>{t('anyway')}</button>}
                          {x.state === 'failed' && <button className="min-h-9 rounded-full border border-line-strong px-3 font-semibold text-ink" onClick={() => void retry(x.id)}>{t('retry')}</button>}
                          <button className="min-h-9 rounded-full px-3 font-semibold text-ink-2" onClick={() => void discard(x.id)}>{t('discard')}</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(140px+var(--safe-bottom))] z-40 mx-auto flex w-[calc(100%-32px)] max-w-[448px] items-center gap-3 rounded-[18px] bg-ink px-4 py-3 text-[14px] text-white shadow-[var(--shadow-float)] lg:inset-x-auto lg:bottom-8 lg:right-8 lg:mx-0 lg:w-[420px]">
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.undo && <button className="inline-flex min-h-9 items-center rounded-full px-2 font-semibold text-primary-soft" onClick={() => void undo(toast.undo!)}>{t('undo')}</button>}
        </div>
      )}
    </>
  );
}
