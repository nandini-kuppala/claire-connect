// Claire chat notify path: the client sends the message through Nexconn, then tells us here.
import { Router } from 'express';
import { bump, claim } from '../db/index.js';
import { getUser } from '../biz.js';
import { claireTurn, claireWelcome, resetSession } from '../claire.js';
import { h, HttpError, requireAuth, type AuthedRequest } from '../util.js';

const router = Router();

router.post(
  '/claire/turn',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const { text, chipId, messageId } = req.body ?? {};
    const input = {
      text: typeof text === 'string' ? text.trim().slice(0, 2000) : undefined,
      chipId: typeof chipId === 'string' ? chipId.slice(0, 120) : undefined,
    };
    if (!input.text && !input.chipId) throw new HttpError(400, 'Say or tap something first.');
    // The production webhook may deliver the same message; whoever claims it first answers.
    if (typeof messageId === 'string' && messageId && !(await claim(`msg:${messageId}`))) return res.json({ ok: true, deduped: true });
    const user = await getUser(req.uid);
    void bump('messages');
    await claireTurn(user, input);
    res.json({ ok: true });
  }),
);

router.post(
  '/claire/welcome',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    await claireWelcome(await getUser(req.uid));
    res.json({ ok: true });
  }),
);

router.post(
  '/claire/reset',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    await resetSession(req.uid);
    res.json({ ok: true });
  }),
);

export default router;
