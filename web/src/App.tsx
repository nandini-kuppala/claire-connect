// Router, auth guards and the single chat connection for the signed-in user.
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from './icons';
import { useSession, isAgent, isOnboarded } from './store/session';
import { engine } from './chat/engine';
import { useLocaleVersion } from './locales';
import { AppShell } from './components/AppShell';
import { PinGate } from './components/PinGate';
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
const GoodsSetup = lazy(() => import('./screens/goods/GoodsSetup'));
const SendForm = lazy(() => import('./screens/goods/SendForm'));
const GotBackForm = lazy(() => import('./screens/goods/GotBackForm'));
const PartyLedger = lazy(() => import('./screens/goods/PartyLedger'));
const MovementScreen = lazy(() => import('./screens/goods/MovementScreen'));
const DisputeScreen = lazy(() => import('./screens/goods/DisputeScreen'));
const ReceiveFirstForm = lazy(() => import('./screens/goods/ReceiveFirstForm'));
const WorkScreen = lazy(() => import('./screens/goods/WorkScreen'));
const JobScreen = lazy(() => import('./screens/goods/JobScreen'));
const MadeForm = lazy(() => import('./screens/goods/MadeForm'));
const TradeForm = lazy(() => import('./screens/goods/TradeForm'));
const AdjustScreen = lazy(() => import('./screens/goods/AdjustScreen'));
const ReportsScreen = lazy(() => import('./screens/goods/ReportsScreen'));
const BillScreen = lazy(() => import('./screens/goods/BillScreen'));
const OrderGoodsScreen = lazy(() => import('./screens/goods/OrderGoodsScreen'));

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

/** Pages a staff login never sees: home (marketplace), orders, store, Trade Desk, onboarding. */
const STAFF_AWAY = /^\/(?:$|goods\/reports|orders|store|s\/|desk|onboarding|catalog|requirements)/;

function RequireAuth({ children, allowUnonboarded = false, agentOk = true }: { children: ReactNode; allowUnonboarded?: boolean; agentOk?: boolean }) {
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!user) return ready ? <Navigate to="/login" replace /> : <Splash />;
  if (!agentOk && isAgent(user)) return <Navigate to="/desk" replace />;
  if (!allowUnonboarded && !isAgent(user) && !isOnboarded(user)) return <Navigate to="/onboarding" replace />;
  // Staff use Goods, Claire and Goods conversations only (04 §10.3b); the server refuses the rest anyway.
  if (user.role === 'staff' && STAFF_AWAY.test(location.pathname)) return <Navigate to="/goods?tab=coming" replace />;
  return <PinGate>{children}</PinGate>;
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
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <Goods />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/setup"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell>
                  <Suspense fallback={<Splash />}>
                    <GoodsSetup />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/record/send"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell nav={false}>
                  <Suspense fallback={<Splash />}>
                    <SendForm />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/job/:id"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <JobScreen />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/record/made"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell nav={false}>
                  <Suspense fallback={<Splash />}>
                    <MadeForm />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/record/t/:kind"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell nav={false}>
                  <Suspense fallback={<Splash />}>
                    <TradeForm />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/reports"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <ReportsScreen />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/reports/bills/:k/:id"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <BillScreen />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/order/:id"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <OrderGoodsScreen />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/adjust"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <AdjustScreen />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/job/:id/return"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell nav={false}>
                  <Suspense fallback={<Splash />}>
                    <GotBackForm />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/party/:k/:id"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <PartyLedger />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/movement/:id"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell nav={false}>
                  <Suspense fallback={<Splash />}>
                    <MovementScreen />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/dispute/:id"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell >
                  <Suspense fallback={<Splash />}>
                    <DisputeScreen />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/record/receive-first"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell nav={false}>
                  <Suspense fallback={<Splash />}>
                    <ReceiveFirstForm />
                  </Suspense>
                </AppShell>
              </RequireGoods>
            </RequireAuth>
          }
        />
        <Route
          path="/goods/work/:id"
          element={
            <RequireAuth agentOk={false}>
              <RequireGoods>
                <AppShell variant="wide">
                  <Suspense fallback={<Splash />}>
                    <WorkScreen />
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
