// Chat archives (server/src/chatArchive.ts): list a conversation's daily archives, read one back, run the job now.
import { Router } from 'express';
import { getUser } from '../biz.js';
import { byId, findOne } from '../db/index.js';
import { listArchives, readArchiveFile, runChatArchive } from '../chatArchive.js';
import { h, HttpError, requireAuth, type AuthedRequest } from '../util.js';

const router = Router();
const DEV_DB = /^[a-z0-9_]+_(dev|test_[a-z0-9_]+)$/i;

/** Members of the conversation (either business) and Trade Desk staff may read its archive. */
async function memberConversation(uid: string, conversationId: string) {
  const [user, conv] = await Promise.all([getUser(uid), byId<any>('conversations', conversationId)]);
  const c = conv ?? (await findOne<any>('conversations', { channel_id: conversationId }));
  if (!c) throw new HttpError(404, 'Conversation not found');
  const ok = ['agent', 'supervisor'].includes(user.role) || c.user_ids?.includes(user.id) || (user.business_id && c.business_ids?.includes(user.business_id));
  if (!ok) throw new HttpError(403, 'You are not part of this conversation.');
  return c;
}

const out = (r: any) => ({
  id: r.id, conversationId: r.conversation_id, channelId: r.channel_id, kind: r.kind, day: r.day, storage: r.storage,
  fileKey: r.file?.key ?? null, size: r.file?.size ?? null, sha256: r.sha256, messageCount: r.message_count,
  firstAt: r.first_at, lastAt: r.last_at, uploadedAt: r.uploaded_at, encryption: r.encryption?.alg ?? null,
});

router.get(
  '/conversations/:id/archives',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const c = await memberConversation(req.uid, req.params.id);
    res.json({ archives: (await listArchives(c.id)).map(out) });
  }),
);

router.get(
  '/archives/:id',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    const rec = await findOne<any>('chat_archives', { _id: req.params.id });
    if (!rec) throw new HttpError(404, 'Archive not found');
    await memberConversation(req.uid, rec.conversation_id);
    let data;
    try {
      data = await readArchiveFile(rec);
    } catch (err) {
      throw new HttpError(502, `Could not read the archive: ${(err as Error).message}`);
    }
    res.json({ archive: out(rec), data });
  }),
);

/** Runs the archive now for one conversation the caller is in. Dev / test databases only. */
router.post(
  '/archives/run',
  requireAuth,
  h(async (req: AuthedRequest, res) => {
    if (!DEV_DB.test((process.env.MONGODB_DB || '').trim())) throw new HttpError(403, 'Only on a dev database. Use the scheduled job (CHAT_ARCHIVE_EVERY_MIN).');
    const conversationId = String(req.body?.conversationId ?? '');
    if (!conversationId) throw new HttpError(400, 'conversationId is required.');
    const c = await memberConversation(req.uid, conversationId);
    const day = typeof req.body?.day === 'string' ? req.body.day : undefined;
    res.json(await runChatArchive({ day, conversationIds: [c.id] }));
  }),
);

export default router;
