// Trade Desk console (desktop, agents): rail · queue · ticket workspace · context panel, with a supervisor strip.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Inbox, LogOut, Zap } from '../icons';
import { ClaireMark } from '../components/Avatar';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { engine, type Channel } from '../chat/engine';
import { C, HEAD, errMsg, listOf, normOrder, normTicket, normTrust, useInterval, useMe, type Order, type Ticket } from '../desk/kit';
import { QueuePane, type QueueTab } from '../desk/QueuePane';
import { TicketPane } from '../desk/TicketPane';
import { ContextPanel, type OrderEvent, type Party } from '../desk/ContextPanel';
import { SupervisorStrip, normStats, type DeskStats } from '../desk/SupervisorStrip';

type AgentStatus = 'online' | 'away';
interface Detail { ticket: Ticket; parties: Party[]; order: Order | null; events: OrderEvent[]; channelId: string | null; conversationId: string | null }

function normDetail(r: any, lang: string): Detail {
  const ticket = normTicket(r.ticket ?? r, lang);
  const parties: Party[] = listOf(r.parties).map((p: any) => ({
    id: p.id, name: p.name ?? '', ownerName: p.ownerName ?? p.owner_name ?? null, city: p.city ?? null, language: p.language ?? null,
    accent: p.accent ?? null, role: p.role ?? p.role_label ?? null, side: p.side === 'buyer' || p.side === 'seller' ? p.side : null, trust: normTrust(p.trust),
    userIds: Array.isArray(p.userIds) ? p.userIds.map(String) : [],
  }));
  const events: OrderEvent[] = listOf(r.orderEvents ?? r.order_events ?? r.events).map((e: any) => ({
    id: e.id, type: e.type, at: e.at ?? e.created_at ?? null, payload: e.payload ?? null,
  }));
  const channelId = r.conversation?.channelId ?? r.conversation?.channel_id ?? ticket.channelId ?? null;
  return { ticket, parties, order: r.order ? normOrder(r.order) : null, events, channelId, conversationId: r.conversation?.id ?? null };
}

export default function Desk() {
  const nav = useNavigate();
  const { user, lang } = useMe();
  const logout = useSession((s: any) => s.logout) as (() => void) | undefined;
  const myId = user?.id ?? '';
  const isAgent = user?.role === 'agent' || user?.role === 'supervisor';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [tab, setTab] = useState<QueueTab>('mine');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingD, setLoadingD] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinedChannel, setJoinedChannel] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<AgentStatus>('online');
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const flash = (text: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3200);
  };

  // ── Data ──
  const loadTickets = useCallback(async () => {
    try {
      const r = await api.get('/api/desk/tickets');
      setTickets(listOf(r, 'tickets').map((t) => normTicket(t, lang)));
    } catch (e) {
      if (loadingQ) flash(errMsg(e), 'err');
    } finally {
      setLoadingQ(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const loadStats = useCallback(async () => {
    try {
      setStats(normStats(await api.get('/api/desk/stats')));
    } catch { /* strip is optional */ }
  }, []);

  const loadDetail = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setLoadingD(true);
    try {
      const r = await api.get(`/api/desk/tickets/${encodeURIComponent(id)}`);
      setDetail((cur) => (id === selectedIdRef.current || !cur ? normDetail(r, lang) : cur));
    } catch (e) {
      if (!quiet) flash(errMsg(e), 'err');
    } finally {
      if (!quiet) setLoadingD(false);
    }
  }, [lang]);


  useEffect(() => {
    if (!isAgent) return;
    void loadTickets();
    void loadStats();
    api.post('/api/desk/status', { status: 'online' }).catch(() => {});
    engine.connect().catch(() => {});
  }, [isAgent, loadTickets, loadStats]);

  useInterval(() => { void loadTickets(); }, isAgent ? 4000 : null);
  useInterval(() => { void loadStats(); }, isAgent && showStats ? 8000 : null);
  useInterval(() => { if (selectedId) void loadDetail(selectedId, true); }, isAgent && selectedId ? 8000 : null);

  // Pick the first of my tickets (or unassigned) on first load.
  useEffect(() => {
    if (selectedId || !tickets.length) return;
    const mine = tickets.find((t) => t.agentId === myId && t.status !== 'resolved');
    const first = mine ?? tickets.find((t) => !t.agentId && t.status !== 'resolved');
    if (first) {
      setSelectedId(first.id);
      if (!mine) setTab('unassigned');
    }
  }, [tickets, selectedId, myId]);

  useEffect(() => {
    setDetail(null);
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // Keep the selected ticket in step with the polled queue (status / SLA / assignment).
  const live = useMemo(() => {
    if (!detail) return null;
    const q = tickets.find((t) => t.id === detail.ticket.id);
    return q ? { ...detail.ticket, ...q, summary: q.summary ?? detail.ticket.summary, nextStep: q.nextStep ?? detail.ticket.nextStep, parties: detail.ticket.parties.length ? detail.ticket.parties : q.parties } : detail.ticket;
  }, [detail, tickets]);

  const channelId = live ? joinedChannel[live.id] ?? (live.agentId === myId && ['in_progress', 'waiting_user', 'resolved'].includes(live.status) ? detail?.channelId : null) : null;
  const channel: Channel | null = channelId ? { type: 'group', targetId: channelId } : null;
  const joined = !!channel;

  // ── Actions ──
  async function join() {
    if (!live) return;
    setJoining(true);
    try {
      const r = (await api.post(`/api/desk/tickets/${encodeURIComponent(live.id)}/join`)) as any;
      const cid = r.conversation?.channel_id ?? r.conversation?.channelId ?? r.channelId;
      if (cid) setJoinedChannel((m) => ({ ...m, [live.id]: cid }));
      await engine.connect().catch(() => {});
      await Promise.all([loadTickets(), loadDetail(live.id, true)]);
      setTab('mine');
    } catch (e) {
      flash(errMsg(e), 'err');
    } finally {
      setJoining(false);
    }
  }

  async function markPaid() {
    const o = detail?.order;
    if (!o) return;
    setBusy('paid');
    try {
      const type = o.status === 'confirmed' ? 'advance_paid' : 'balance_paid';
      await api.post(`/api/orders/${encodeURIComponent(o.id)}/event`, { type, payload: { by: 'trade_desk', ticketId: live?.id } });
      flash('Payment recorded. Both parties were notified.');
      if (live) await loadDetail(live.id, true);
    } catch (e) {
      flash(errMsg(e), 'err');
    } finally {
      setBusy(null);
    }
  }

  async function resolve(r: { outcome: string; upheld: boolean; againstBusinessId: string | null; note: string | null }) {
    if (!live) return;
    setBusy('resolve');
    try {
      await api.post(`/api/desk/tickets/${encodeURIComponent(live.id)}/resolve`, r);
      flash(`${live.code} resolved. Claire posted the outcome in both languages.`);
      await Promise.all([loadTickets(), loadDetail(live.id, true), loadStats()]);
    } catch (e) {
      flash(errMsg(e), 'err');
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus() {
    const next: AgentStatus = status === 'online' ? 'away' : 'online';
    setStatus(next);
    try {
      await api.post('/api/desk/status', { status: next === 'online' ? 'online' : 'busy' });
      void loadStats();
    } catch (e) {
      setStatus(status);
      flash(errMsg(e), 'err');
    }
  }

  async function simulate() {
    setBusy('simulate');
    try {
      const r = (await api.post('/api/desk/simulate-overdue', {})) as any;
      const t = r.ticket ? normTicket(r.ticket, lang) : null;
      flash(t ? `Created ${t.code}: payment follow-up (${t.priority}).` : 'Overdue payment simulated.');
      await Promise.all([loadTickets(), loadStats()]);
      if (t) {
        setSelectedId(t.id);
        setTab(t.agentId === myId ? 'mine' : t.agentId ? 'all' : 'unassigned');
      }
    } catch (e) {
      flash(errMsg(e), 'err');
    } finally {
      setBusy(null);
    }
  }

  if (!user)
    return (
      <Centered>
        <p className={`${HEAD} text-[18px] font-semibold`} style={{ color: C.ink }}>Trade Desk</p>
        <p className="mt-1 text-[14px]" style={{ color: C.meta }}>Sign in with an agent account to open the console.</p>
        <Link to="/login?next=%2Fdesk" className="mt-4 inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-white" style={{ background: C.primary }}>Sign in</Link>
      </Centered>
    );
  if (!isAgent)
    return (
      <Centered>
        <p className={`${HEAD} text-[18px] font-semibold`} style={{ color: C.ink }}>Agents only</p>
        <p className="mt-1 max-w-[360px] text-[14px]" style={{ color: C.meta }}>The Trade Desk console is for CLAIRE agents. Sign in with an agent demo account (Meena, Arjun or Farida).</p>
        <button className="mt-4 inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-white" style={{ background: C.primary }} onClick={() => { logout?.(); nav('/login?next=%2Fdesk'); }}>Switch account</button>
      </Centered>
    );

  return (
    <>
    <div className="md:hidden">
      <Centered>
        <p className={`${HEAD} text-[18px] font-semibold`} style={{ color: C.ink }}>Trade Desk</p>
        <p className="mt-1 max-w-[320px] text-[14px]" style={{ color: C.meta }}>The agent console needs a wider screen. Open it on a laptop or tablet in landscape.</p>
        <button className="mt-4 inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-white" style={{ background: C.primary }} onClick={() => { nav('/login', { replace: true, state: null }); logout?.(); }}>Log out</button>
      </Centered>
    </div>
    <div className="hidden h-dvh min-w-[1100px] grid-cols-[64px_340px_minmax(0,1fr)_360px] md:grid grid-rows-[56px_auto_minmax(0,1fr)] bg-page" style={{ color: C.ink }}>
      {/* Rail */}
      <nav className="row-span-3 flex flex-col items-center gap-2 py-3" style={{ background: C.ink }}>
        <div className="mb-2" title="CLAIRE Trade Desk">
          <ClaireMark size={40} rounded="xl" />
        </div>
        <RailBtn active title="Queue"><Inbox size={20} /></RailBtn>
        <RailBtn active={showStats} title="Supervisor view" onClick={() => setShowStats((v) => !v)}><BarChart3 size={20} /></RailBtn>
        <div className="flex-1" />
        <RailBtn title="Log out" onClick={() => { nav('/login', { replace: true, state: null }); logout?.(); }}><LogOut size={20} /></RailBtn>
      </nav>

      {/* Top bar */}
      <header className="col-span-3 flex items-center gap-4 border-b bg-surface px-5" style={{ borderColor: C.border }}>
        <h1 className={`${HEAD} text-[18px] font-bold`}>Trade Desk</h1>
        <span className="text-[13px]" style={{ color: C.meta }}>{user.name}</span>
        <div className="flex-1" />
        <button
          onClick={simulate}
          disabled={busy === 'simulate'}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium disabled:opacity-50"
          style={{ borderColor: C.accentTint, color: C.accentInk, background: C.accentTint }}
          title="Demo: makes an order 15 days overdue and raises a payment follow-up ticket"
        >
          <Zap size={14} /> {busy === 'simulate' ? 'Simulating…' : 'Simulate overdue payment'}
        </button>
        <button
          onClick={toggleStatus}
          role="switch"
          aria-checked={status === 'online'}
          className="inline-flex h-9 items-center gap-2 rounded-full border pl-2 pr-3.5 text-[13px] font-medium"
          style={{ borderColor: status === 'online' ? C.successTint : C.border, background: status === 'online' ? C.successTint : C.sunken, color: status === 'online' ? C.success : C.ink2 }}
        >
          <span className="relative flex h-5 w-9 items-center rounded-full transition-colors" style={{ background: status === 'online' ? C.success : C.lineStrong }}>
            <span className="absolute size-4 rounded-full bg-surface transition-transform" style={{ transform: `translateX(${status === 'online' ? 18 : 2}px)` }} />
          </span>
          {status === 'online' ? 'Online' : 'Away'}
        </button>
      </header>

      {/* Supervisor strip */}
      <div className="col-span-3">{showStats ? <SupervisorStrip stats={stats} /> : null}</div>

      <QueuePane tickets={tickets} myId={myId} tab={tab} onTab={setTab} selectedId={selectedId} onSelect={setSelectedId} loading={loadingQ} />
      <TicketPane ticket={live} channel={channel} joined={joined} joining={joining} onJoin={join} agentName={user.name ?? 'Trade Desk'} agentLang={lang} loading={loadingD} />
      {live && detail ? (
        <ContextPanel
          key={live.id}
          ticket={live}
          parties={detail.parties}
          order={detail.order}
          events={detail.events}
          callContext={{ channel, conversationId: detail.conversationId }}
          joined={joined}
          busy={busy}
          onMarkPaid={markPaid}
          onResolve={resolve}
        />
      ) : (
        <aside className="border-l bg-surface" style={{ borderColor: C.border }} />
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2.5 text-[13px] font-medium text-white shadow-[var(--shadow-float)]"
          style={{ background: toast.tone === 'err' ? C.danger : C.ink }}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </div>
    </>
  );
}

function RailBtn({ children, active, title, onClick }: { children: ReactNode; active?: boolean; title: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-[14px] transition-colors hover:bg-surface/10"
      style={{ color: active ? C.surface : C.faint, background: active ? 'rgb(255 252 246 / 0.12)' : undefined }}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex h-dvh flex-col items-center justify-center bg-page px-6 text-center">{children}</div>;
}
