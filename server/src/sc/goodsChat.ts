// Goods conversation per business pair (03 U5, 04 §8) and the card outbox (04 §8.3).
// Cards are one payload for both businesses (no prices); the client renders its own side. A card is posted once
// its record is visible (after the 10-minute undo window), at most once per (record, state).
import { col, find } from '../db/index.js';
import { chat } from '../chat.js';
import { BOT } from '../config.js';
import { usersOf } from '../biz.js';
import { ensureChatUsers } from '../desk.js';
import { CC_CARD, type CardPayload } from '../../../shared/cards.js';
import { formatQty } from '../../../shared/sc/units.js';
import { winningAssertion } from '../../../shared/sc/evidence.js';
import type { Dimension } from '../../../shared/sc/types.js';

const pairKey = (a: string, b: string) => [a, b].sort().join('_');

/** Finds or creates the Goods conversation for two businesses. Staff join in slice 7; deal rooms stay separate. */
export async function goodsConversation(a: string, b: string) {
  const channelId = `goods_${pairKey(a, b)}`;
  const existing = await col('conversations').findOne({ channel_id: channelId } as any);
  if (existing) return existing;
  const [ua, ub, biz] = await Promise.all([usersOf([a]), usersOf([b]), find('businesses', { _id: { $in: [a, b] } }, { projection: { name: 1 } })]);
  const members = [...new Set([...ua, ...ub, BOT.claire])];
  const names = new Map(biz.map((x: any) => [x._id, x.name]));
  const now = Date.now();
  const conv = {
    _id: channelId, id: channelId, kind: 'goods', channel_id: channelId, title: `${names.get(a) ?? ''} · ${names.get(b) ?? ''}`,
    business_ids: [a, b], user_ids: members, buyer_business_id: null, seller_business_id: null, requirement_id: null, agent_user_id: null,
    posted_requirements: [], last_at: now, last_text: null, created_at: now, updated_at: now,
  };
  try {
    await ensureChatUsers(members);
    await chat.createGroup(channelId, conv.title, ua[0] ?? members[0], members);
    await col('conversations').insertOne(conv as any);
  } catch (err: any) {
    if (err?.code !== 11000) throw err;
  }
  return (await col('conversations').findOne({ channel_id: channelId } as any)) ?? conv;
}

const q = (base: number, dim: string) => {
  const f = formatQty(base, dim as Dimension);
  return `${f.value} ${f.unit}`;
};

/** Builds the movement card from the current record (state reflects confirmations and disputes). */
export async function movementCard(movementId: string): Promise<{ payload: CardPayload; pair: [string, string] } | null> {
  const m = await col('sc_movements').findOne({ _id: movementId } as any);
  if (!m || m.from?.party?.k !== 'b' || m.to?.party?.k !== 'b') return null;
  const fromId = m.from.party.id as string;
  const toId = m.to.party.id as string;
  const biz = await find('businesses', { _id: { $in: [fromId, toId] } }, { projection: { name: 1 } });
  const name = new Map(biz.map((x: any) => [x._id, x.name as string]));
  const open = await col('sc_discrepancies').findOne({ 'refs.movement_id': movementId, state: { $in: ['open', 'proposed', 'countered'] } } as any);
  const lines = (m.lines as any[]).map((l) => {
    const recv = (l.received as any[]).filter((a) => a.evidence === 'account' || a.evidence === 'link');
    const sent = winningAssertion(l.sent);
    return { lineId: l.line_id, label: l.label_generic ?? l.label_en, dim: l.dim, sent: sent?.base_qty ?? 0, received: recv.length ? winningAssertion(recv)!.base_qty : null, final: recv.some((a) => a.final) };
  });
  const allConfirmed = lines.every((l) => l.received !== null);
  const state = m.cancelled_at ? 'cancelled' : open ? 'disputed' : allConfirmed ? ((m.lines as any[]).some((l) => l.settled?.outcome === 'within') ? 'within_tolerance' : 'confirmed') : 'sent';
  const first = lines[0];
  const summary = `${q(first.sent, first.dim)} ${first.label}${lines.length > 1 ? ` +${lines.length - 1}` : ''}`;
  const VERBS: Record<string, string[]> = {
    send_for_work: ['sent for work', 'வேலைக்கு அனுப்பியது', 'काम के लिए भेजा'], sell: ['sold', 'விற்றது', 'बेचा'], return_to_supplier: ['returned', 'திருப்பியது', 'लौटाया'],
    sample: ['sample', 'சாம்பிள்', 'सैंपल'], returnable_sample: ['sample to return', 'திரும்பத் தர வேண்டிய சாம்பிள்', 'वापसी वाला सैंपल'], collect: ['collected', 'எடுத்துச் சென்றது', 'ले गए'],
  };
  const verb = VERBS[m.action] ?? ['sent back', 'திருப்பி அனுப்பியது', 'वापस भेजा'];
  const text = `${name.get(fromId)} → ${name.get(toId)}: ${summary} (${verb[0]} / ${verb[1]} / ${verb[2]})${m.dc_no ? ` · DC ${m.dc_no}` : ''}`;
  return {
    pair: [fromId, toId],
    payload: {
      kind: 'movement', movementId, action: m.action, text, fromBusinessId: fromId, toBusinessId: toId, fromName: name.get(fromId) ?? '', toName: name.get(toId) ?? '',
      date: m.business_date, dcNo: m.dc_no ?? null, processKey: m.process_key ?? null, lines, state, disputeId: open?._id ?? null,
    },
  };
}

export async function disputeCard(disputeId: string): Promise<{ payload: CardPayload; pair: [string, string] } | null> {
  const d = await col('sc_discrepancies').findOne({ _id: disputeId } as any);
  if (!d || (d.parties?.length ?? 0) < 2) return null;
  const pair = [d.parties[0], d.parties[1]] as [string, string];
  const last = d.proposals?.at(-1) ?? null;
  const text = `${d.line_label ?? ''}: ${q(d.figures.sent, d.dim)} / ${q(d.figures.received, d.dim)} · difference ${q(Math.abs(d.difference), d.dim)} (வித்தியாசம் / फ़र्क)`;
  return {
    pair,
    payload: {
      kind: 'dispute', disputeId, text, movementId: d.refs?.movement_id ?? null, lineLabel: d.line_label ?? '', dim: d.dim, sentBy: d.sent_by, receivedBy: d.received_by,
      sent: d.figures.sent, received: d.figures.received, difference: d.difference, allowed: d.allowed ?? 0, state: d.state,
      proposal: last && d.state !== 'resolved' ? { by: last.by_business_id, outcome: last.outcome } : null, outcome: d.resolution?.outcome ?? null,
    },
  };
}

/** Queues a card for a record state. The same (record, state) is queued once (idempotency key). */
export async function enqueueCard(kind: 'movement' | 'dispute', id: string, state: string, dueAt: number) {
  const key = `${kind}:${id}:${state}`;
  await col('sc_notify').updateOne({ _id: key } as any, { $setOnInsert: { id: key, ref: { kind, id }, state, due_at: dueAt, sent_at: null, cancelled: false, claimed_at: null, attempts: 0, created_at: Date.now() } }, { upsert: true });
}

/** Cancels queued, unsent cards for a record (Undo). */
export async function cancelCards(kind: string, id: string) {
  await col('sc_notify').updateMany({ 'ref.kind': kind, 'ref.id': id, sent_at: null } as any, { $set: { cancelled: true } });
}

/** Moves queued cards for a record to now (Share now). */
export async function dueNow(kind: string, id: string) {
  await col('sc_notify').updateMany({ 'ref.kind': kind, 'ref.id': id, sent_at: null, cancelled: false } as any, { $set: { due_at: Date.now() } });
}

let running = false;

/** Posts due cards. Each row is claimed atomically with a 60 s lease, so two server instances can't both send it. */
export async function processDueCards(limit = 20) {
  if (running) return;
  running = true;
  try {
    for (let i = 0; i < limit; i++) {
      const now = Date.now();
      const row = await col('sc_notify').findOneAndUpdate(
        { sent_at: null, cancelled: false, due_at: { $lte: now }, attempts: { $lt: 3 }, $or: [{ claimed_at: null }, { claimed_at: { $lt: now - 60_000 } }] } as any,
        { $set: { claimed_at: now }, $inc: { attempts: 1 } },
        { sort: { due_at: 1 }, returnDocument: 'after' },
      );
      if (!row) break;
      try {
        const built = row.ref.kind === 'movement' ? await movementCard(row.ref.id) : await disputeCard(row.ref.id);
        if (built) {
          const conv = await goodsConversation(built.pair[0], built.pair[1]);
          await chat.group(conv.channel_id, BOT.claire, CC_CARD, built.payload, { push: built.payload.kind === 'movement' || built.payload.kind === 'dispute' ? built.payload.text.slice(0, 120) : undefined });
          await col('conversations').updateOne({ _id: conv._id } as any, { $set: { last_at: Date.now(), last_text: built.payload.kind === 'movement' || built.payload.kind === 'dispute' ? built.payload.text.slice(0, 140) : null, updated_at: Date.now() } });
        }
        await col('sc_notify').updateOne({ _id: row._id } as any, { $set: { sent_at: Date.now() } });
        // A movement just became visible: match any receiver-first entry waiting for it (04 §5.6.2).
        if (row.ref.kind === 'movement' && row.state === 'sent' && built?.payload.kind === 'movement') {
          const { matchReceiverFirst } = await import('./records.js');
          await matchReceiverFirst(built.payload.toBusinessId, built.payload.fromBusinessId).catch((e) => console.warn('[sc] match', e.message));
        }
      } catch (err) {
        console.warn('[sc] card send failed', row._id, (err as Error).message);
        await col('sc_notify').updateOne({ _id: row._id } as any, { $set: { claimed_at: null } });
      }
    }
  } finally {
    running = false;
  }
}

/** In-process ticker (04 A6): visibility is computed at read time, so this only delivers cards. */
export function startCardTicker() {
  setInterval(() => void processDueCards().catch((e) => console.warn('[sc] ticker', e.message)), 30_000).unref();
  void processDueCards().catch(() => undefined);
}
