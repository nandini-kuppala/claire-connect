// CLAIRE Updates: order, payment and dispatch notices from the system channel (read-only).
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useSession } from '../store/session';
import { updatesChannel } from '../chat/engine';
import { ChatView } from '../chat/ChatView';
import { AppShell } from '../components/AppShell';
import { UpdatesMark } from '../components/Avatar';
import { ArrowLeft } from '../icons';
import { UpdatesStrings } from './UpdatesScreen.strings';

export default function UpdatesScreen() {
  const t = useT();
  const s = UpdatesStrings.use();
  const navigate = useNavigate();
  const myLang = useSession((st) => st.user?.language || 'en');

  const header = (
    <header className="flex min-h-[64px] shrink-0 items-center gap-2.5 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/chats'))}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-sunken"
        aria-label={t('back')}
      >
        <ArrowLeft size={22} />
      </button>
      <UpdatesMark size={42} />
      <div className="min-w-0 flex-1">
        <h1 className="font-head text-[17px] leading-tight font-semibold text-ink">{s('title')}</h1>
        <p className="truncate text-[13px] leading-[1.45] text-meta">{s('sub')}</p>
      </div>
    </header>
  );

  const empty = (
    <div className="mx-auto mt-10 flex max-w-[320px] flex-col items-center rounded-[22px] border border-line bg-page px-6 py-8 text-center">
      <p className="text-[15px] leading-[1.5] text-ink-2">{s('empty')}</p>
      <button
        type="button"
        onClick={() => navigate('/orders')}
        className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-primary-tint px-5 text-[15px] font-semibold text-primary hover:bg-primary-soft"
      >
        {s('see_orders')}
      </button>
    </div>
  );

  // Notices are written by the server in each user's language, so no translation is needed.
  return (
    <AppShell variant="chat">
      <ChatView channel={updatesChannel} counterpartLang={myLang} header={header} readOnly emptyState={empty} />
    </AppShell>
  );
}
