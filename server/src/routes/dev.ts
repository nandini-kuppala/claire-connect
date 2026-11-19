// Local chat relay (only used when Nexconn keys are missing): SSE stream, send and history.
import { Router } from 'express';
import { attachStream, chatMode, localHistory, localSendDirect, localSendGroup } from '../chat.js';
import { bump, findOne } from '../db/index.js';
import { h, HttpError, requireAuth, type AuthedRequest } from '../util.js';

const router = Router();

function localOnly() {
  if (chatMode() !== 'local') throw new HttpError(409, 'Chat runs on Nexconn; the local relay is off.');
}

router.get('/dev/stream', requireAuth, (req, res) => {
  const uid = (req as AuthedRequest).uid;
  if (chatMode() !== 'local') return res.status(409).json({ error: 'Chat runs on Nexconn; the local relay is off.' });
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify({ userId: uid })}\n\n`);
  attachStream(uid, res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => clearInterval(ping));
});

router.post(
  '/dev/send',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    localOnly();
    const { channelType, targetId, type, content, metadata } = req.body ?? {};
    if (typeof targetId !== 'string' || !targetId || typeof type !== 'string' || !type) throw new HttpError(400, 'targetId and type are required.');
    let messageId: string;
    if (channelType === 'group') {
      const conv = await findOne('conversations', { channel_id: targetId });
      if (!conv?.user_ids?.includes(req.uid)) throw new HttpError(403, 'You are not in this chat.');
      messageId = await localSendGroup(targetId, req.uid, type, content ?? {}, undefined, metadata);
    } else if (channelType === 'direct') {
      messageId = await localSendDirect(req.uid, targetId, type, content ?? {}, metadata);
    } else {
      throw new HttpError(400, 'channelType must be direct or group.');
    }
    void bump('messages');
    res.json({ id: messageId, sentAt: Date.now() });
  }),
);

router.get(
  '/dev/history',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    localOnly();
    const channelType = String(req.query.channelType || 'direct');
    const targetId = String(req.query.targetId || '');
    if (!targetId) throw new HttpError(400, 'targetId is required.');
    if (channelType === 'group') {
      const conv = await findOne('conversations', { channel_id: targetId });
      if (!conv?.user_ids?.includes(req.uid) && conv?.agent_user_id !== req.uid) throw new HttpError(403, 'You are not in this chat.');
    }
    const before = Number(req.query.before) > 0 ? Number(req.query.before) : Date.now() + 1;
    // System notices are stored as direct rows from claire_updates.
    const messages = await localHistory(req.uid, channelType === 'group' ? 'group' : 'direct', targetId, before);
    res.json({ messages });
  }),
);

export default router;
