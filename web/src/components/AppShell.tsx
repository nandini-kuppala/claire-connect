// App column: max 480px, centred on a #FFFFFF page on desktop.
// 'page' scrolls the document and reserves room for the bottom nav;
// 'chat' is a fixed full-height column (header / log / composer) using dvh;
// 'wide' is 'page' on phones and, at ≥ 1024 px, a left rail plus a content area that uses the width (tables, two panes).
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { BottomNav, RailNav } from './BottomNav';

export function AppShell({
  children,
  variant = 'page',
  nav = variant !== 'chat',
  unread,
  className,
}: {
  children: ReactNode;
  variant?: 'page' | 'chat' | 'wide';
  nav?: boolean;
  unread?: number;
  className?: string;
}) {
  if (variant === 'chat') {
    return (
      <div className="min-h-dvh bg-page">
        <div className={clsx('relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-surface min-[481px]:shadow-[0_0_0_1px_var(--color-line)]', className)}>
          {children}
        </div>
      </div>
    );
  }
  if (variant === 'wide') {
    return (
      <div className="min-h-dvh bg-page lg:flex">
        {nav && (
          <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 border-r border-line bg-surface lg:block">
            <RailNav unread={unread} />
          </aside>
        )}
        <div className={clsx('relative mx-auto min-h-dvh w-full max-w-[480px] bg-page min-[481px]:shadow-[0_0_0_1px_var(--color-line)] lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:shadow-none', className)}>
          <main className={clsx('lg:mx-auto lg:max-w-[1120px] lg:px-6 lg:pb-10', nav && 'pb-[calc(76px+var(--safe-bottom))]')}>{children}</main>
          {nav && <div className="lg:hidden"><BottomNav unread={unread} /></div>}
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-page">
      <div className={clsx('relative mx-auto min-h-dvh w-full max-w-[480px] bg-page min-[481px]:shadow-[0_0_0_1px_var(--color-line)]', className)}>
        <main className={clsx(nav && 'pb-[calc(76px+var(--safe-bottom))]')}>{children}</main>
        {nav && <BottomNav unread={unread} />}
      </div>
    </div>
  );
}

/** Sticky screen header with optional back button slot. */
export function ScreenHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={clsx('sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]', className)}>
      {children}
    </header>
  );
}

export default AppShell;
