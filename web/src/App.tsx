// Router, auth guards and the single chat connection for the signed-in user.
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from './icons';
import { useSession, isAgent, isOnboarded } from './store/session';
import { engine } from './chat/engine';
import { useLocaleVersion } from './locales';
import { AppShell } from './components/AppShell';
import Login from './screens/Login';
import Language from './screens/Language';
import Inbox from './screens/Inbox';
import ClaireScreen from './screens/ClaireScreen';
import DealScreen from './screens/DealScreen';
import UpdatesScreen from './screens/UpdatesScreen';
import Onboarding from './screens/Onboarding';
import Storefront from './screens/Storefront';
import Orders from './screens/Orders';
import Me from './screens/Me';
import Desk from './screens/Desk';
import Home from './screens/Home';
import Results from './screens/Results';
import Compare from './screens/Compare';
import IconGallery from './icons/Gallery';
import { CallLayer } from './call/CallLayer';

// Supply-chain screens are lazy routes: they add nothing to the first load (docs/supply-chain/04 §6.3).
const Goods = lazy(() => import('./screens/goods/Goods'));

/** The Goods routes exist only for businesses with the supply-chain flag; others go Home. */
function RequireGoods({ children }: { children: ReactNode }) {
  const on = useSession((s) => s.features?.supplyChain === true);
  return on ? <>{children}</> : <Navigate to="/" replace />;
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page text-primary">
      <Loader2 size={28} className="animate-spin" aria-label="Loading" />
    </div>
  );
}

/** Keeps one chat connection open while signed in; drops it on logout. */
function ChatConnection() {
  const userId = useSession((s) => s.user?.id);
  const chatToken = useSession((s) => s.chat?.token ?? s.chat?.mode);
  const lang = useSession((s) => s.user?.language);
  useEffect(() => {
    if (!userId || !chatToken) return;
    engine.connect().catch((err) => console.warn('[chat]', (err as Error).message));
  }, [userId, chatToken]);
  useEffect(() => {
    if (!userId) void engine.disconnect();
  }, [userId]);
  useEffect(() => {
    document.documentElement.lang = lang || 'en';
  }, [lang]);
  return null;
}

function RequireAuth({ children, allowUnonboarded = false, agentOk = true }: { children: ReactNode; allowUnonboarded?: boolean; agentOk?: boolean }) {
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!user) return ready ? <Navigate to="/login" replace /> : <Splash />;
  if (!agentOk && isAgent(user)) return <Navigate to="/desk" replace />;
  if (!allowUnonboarded && !isAgent(user) && !isOnboarded(user)) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** /chat/claire is the Claire screen; any other id is a deal / support conversation. */
function ChatRoute() {
  const { conversationId } = useParams();
  return conversationId === 'claire' ? <ClaireScreen /> : <DealScreen />;
}

export default function App() {
  const refresh = useSession((s) => s.refresh);
  const token = useSession((s) => s.token);
  // Re-render the whole tree when a language overlay file (src/locales/<lang>.json) finishes loading,
  // so non-hook lookups (cards' strings(lang), catName, translate) pick up the new text too.
  useLocaleVersion(useSession((s) => s.user?.language));
  useEffect(() => {
    if (token) void refresh();
    // Only on first load / sign-in.
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <ChatConnection />
      <CallLayer />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/s/:slug" element={<Storefront />} />
        <Route
          path="/language"
          element={
            <RequireAuth allowUnonboarded>
              <Language />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding"
          element={
            <RequireAuth allowUnonboarded agentOk={false}>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth agentOk={false}>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/chats"
          element={
            <RequireAuth agentOk={false}>
              <Inbox />
            </RequireAuth>
          }
        />
        <Route
          path="/results/:requirementId"
          element={
            <RequireAuth agentOk={false}>
              <Results />
            </RequireAuth>
          }
        />
        <Route
          path="/compare/:requirementId"
          element={
            <RequireAuth agentOk={false}>
              <Compare />
            </RequireAuth>
          }
        />
        <Route path="/dev/icons" element={<IconGallery />} />
        <Route
          path="/chat/:conversationId"
          element={
            <RequireAuth>
              <ChatRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/updates"
          element={
            <RequireAuth>
              <UpdatesScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/store/:businessId"
          element={
            <RequireAuth>
              <Storefront />
            </RequireAuth>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAuth agentOk={false}>
              <AppShell>
                <Orders />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/goods"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell>
                  <Suspense fallback={<Splash />}>
                    <Goods />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/me"
          element={
            <RequireAuth agentOk={false}>
              <AppShell>
                <Me />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/desk"
          element={
            <RequireAuth>
              <Desk />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
