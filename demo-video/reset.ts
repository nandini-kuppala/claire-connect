// Demo reset: clean deals/searches and give the demo buyer + seller fresh chat identities (empty Nexconn history).
// Run from demo-video/: DOTENV_CONFIG_PATH=../server/.env npx tsx reset.ts
import { connectDb, col, closeDb } from '../server/src/db/index.js';
await connectDb();
const stamp = Date.now().toString(36).slice(-4);
for (const [oldPrefix, key] of [['u_amit', 'amit'], ['u_lakshmi', 'lakshmi']] as const) {
  const u = await col('users').findOne({ business_id: `b_${key}` } as any);
  if (!u) continue;
  const fresh = { ...u, _id: `u_${key}${stamp}`, id: `u_${key}${stamp}`, chat_token: null };
  await col('users').deleteOne({ _id: u._id } as any);
  await col('users').insertOne(fresh as any);
  console.log('user', u._id, '→', fresh._id, '(was', oldPrefix + ')');
}
const recent = { $gt: Date.now() - 24 * 3600e3 };
await col('claire_sessions').deleteMany({});
await col('requirements').deleteMany({});
await col('offers').deleteMany({});
await col('orders').deleteMany({ code: { $regex: '^CC-26' } });
await col('conversations').deleteMany({ created_at: recent } as any);
await col('tickets').deleteMany({ created_at: recent } as any);
await col('dev_messages').deleteMany({});
await col('counters').deleteMany({});
await col('kv').deleteMany({ $or: [{ _id: { $in: ['seq_order', 'seq_ticket'] } }, { _id: { $regex: '^msg:' } }] } as any);
await closeDb();
console.log('reset done');
