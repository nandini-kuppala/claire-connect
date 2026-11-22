// Dev command: archive chats to Nexconn file storage now, or read one archive back.
//   npm run chat:archive -w server -- [--day YYYY-MM-DD] [--conv <conversationId>]   archive (default: today, IST)
//   npm run chat:archive -w server -- read <channelId>:<YYYY-MM-DD>                  print an archive back
// Dev/test databases only (MONGODB_DB=nexconn_sc_dev); the server runs the same job on CHAT_ARCHIVE_EVERY_MIN.
import { closeDb, col, connectDb } from '../db/index.js';
import { readArchiveFile, runChatArchive } from '../chatArchive.js';

const args = process.argv.slice(2);
const dbName = (process.env.MONGODB_DB || '').trim();
if (!/^[a-z0-9_]+_(dev|test_[a-z0-9_]+)$/i.test(dbName)) {
  console.error(`Refusing: MONGODB_DB is "${dbName}". Use a dev/test database (e.g. nexconn_sc_dev).`);
  process.exit(2);
}
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
await connectDb();
if (args[0] === 'read') {
  const rec = await col('chat_archives').findOne({ _id: args[1] } as any);
  if (!rec) {
    console.error(`No archive ${args[1]}`);
    process.exit(1);
  }
  const data = await readArchiveFile(rec);
  console.log(`${rec.storage} ${rec.file?.url ?? rec.file?.key} · ${data.messageCount} messages · ${data.conversation.title}`);
  for (const m of data.messages) console.log(`  ${m.iso} ${m.senderName} [${m.type}] ${m.text ?? JSON.stringify(m.payload).slice(0, 100)}`);
} else {
  const conv = opt('--conv');
  const r = await runChatArchive({ day: opt('--day'), conversationIds: conv ? [conv] : undefined });
  console.log(JSON.stringify({ ...r, records: r.records.slice(0, 50) }, null, 2));
}
await closeDb();
process.exit(0);
