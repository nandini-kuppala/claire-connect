import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../icons';
import clsx from 'clsx';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky footer (usually the primary action). */
  footer?: ReactNode;
  className?: string;
}

const DURATION = 220;

/** Bottom sheet aligned to the 480px app column: 26px top corners, grab handle, warm scrim, sticky footer. Esc / backdrop tap closes. */
export function Sheet({ open, onClose, title, subtitle, children, footer, className }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Mount → animate in; close → animate out → unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), DURATION);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="presentation">
      <div
        className={clsx(
          'absolute inset-0 bg-[rgb(42_33_22/0.42)] transition-opacity',
          shown ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${DURATION}ms` }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[26px] bg-surface shadow-[var(--shadow-float)] outline-none transition-transform ease-out',
          shown ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
        style={{ transitionDuration: `${DURATION}ms` }}
      >
        <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden>
          <span className="h-1.5 w-11 rounded-full bg-line-strong" />
        </div>
        {(title || subtitle) && (
          <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-1">
            <div className="min-w-0 flex-1 pt-1.5">
              {title && (
                <h2 id={titleId} className="font-head text-[19px] font-semibold leading-snug text-ink">
                  {title}
                </h2>
              )}
              {subtitle && <p className="mt-1 text-[14px] leading-[1.45] text-meta">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 transition-colors hover:bg-line"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <div
            className="shrink-0 border-t border-line bg-surface px-5 pt-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: 'env(safe-area-inset-bottom)' }} />}
      </div>
    </div>,
    document.body,
  );
}

export default Sheet;
