// Bottom tab bar: Home (Claire) · Chats · Orders · Store (sellers) · Profile. Flat, warm, no floating blobs.
import { NavLink } from 'react-router-dom';
import { ClipboardList, Home, Package, Store, User, MessagesSquare } from '../icons';
import clsx from 'clsx';
import type { LucideIcon } from '../icons';
import { useT } from '../i18n';
import { useSession } from '../store/session';
import { NavGoodsS } from './BottomNav.strings';

function Tab({ to, icon: Icon, label, end, badge }: { to: string; icon: LucideIcon; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx('flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11.5px] font-semibold transition-colors', isActive ? 'text-primary' : 'text-meta hover:text-ink-2')
      }
    >
      {({ isActive }) => (
        <>
          <span className={clsx('relative flex h-8 w-14 items-center justify-center rounded-full transition-colors', isActive && 'bg-primary-tint')}>
            <Icon size={21} strokeWidth={isActive ? 2.3 : 1.9} aria-hidden />
            {!!badge && (
              <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/** Desktop (≥ 1024 px, wide screens only): the same destinations as a labelled left rail. */
export function RailNav({ unread = 0 }: { unread?: number }) {
  const t = useT();
  const sg = NavGoodsS.use();
  const item = ({ isActive }: { isActive: boolean }) =>
    clsx('flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold transition-colors', isActive ? 'bg-primary-tint text-primary' : 'text-ink-2 hover:bg-sunken');
  const items: [string, LucideIcon, string, boolean?, number?][] = [
    ['/', Home, t('nav_home'), true],
    ['/chats', MessagesSquare, t('nav_chats'), false, unread],
    ['/goods', Package, sg('goods')],
    ['/orders', ClipboardList, t('nav_orders')],
    ['/me', User, t('nav_me')],
  ];
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      <p className="px-3 pb-3 pt-2 font-head text-[18px] font-bold text-ink">CLAIRE</p>
      {items.map(([to, Icon, label, end, badge]) => (
        <NavLink key={to} to={to} end={end} className={item}>
          <Icon size={20} aria-hidden />
          <span className="flex-1">{label}</span>
          {!!badge && <span className="rounded-full bg-clay px-1.5 text-[11px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const t = useT();
  const business = useSession((s) => s.business);
  const goodsOn = useSession((s) => s.features?.supplyChain === true);
  const sg = NavGoodsS.use();
  const sells = (business?.sells?.length ?? 0) > 0;

  // With the supply-chain flag on (03 U1): Home · Chats · Goods · Orders · Profile; the Store lives in Profile and Home.
  if (goodsOn) {
    return (
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface pb-[var(--safe-bottom)]">
        <div className="flex items-stretch px-1">
          <Tab to="/" end icon={Home} label={t('nav_home')} />
          <Tab to="/chats" icon={MessagesSquare} label={t('nav_chats')} badge={unread} />
          <Tab to="/goods" icon={Package} label={sg('goods')} />
          <Tab to="/orders" icon={ClipboardList} label={t('nav_orders')} />
          <Tab to="/me" icon={User} label={t('nav_me')} />
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface pb-[var(--safe-bottom)]">
      <div className="flex items-stretch px-1">
        <Tab to="/" end icon={Home} label={t('nav_home')} />
        <Tab to="/chats" icon={MessagesSquare} label={t('nav_chats')} badge={unread} />
        <Tab to="/orders" icon={Package} label={t('nav_orders')} />
        {sells && business && <Tab to={`/store/${business.id}`} icon={Store} label={t('nav_store')} />}
        <Tab to="/me" icon={User} label={t('nav_me')} />
      </div>
    </nav>
  );
}

export default BottomNav;
