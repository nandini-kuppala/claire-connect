// Dev tool: turn the supply-chain flag on/off for one business (04 §12).
//   npm run sc:flag -w server -- <businessId | phone> on|off
// Refuses to touch the shared production database unless MONGODB_DB names a dev/test database.
import { connectDb, closeDb, col } from '../db/index.js';

const [who, state] = process.argv.slice(2);
const dbName = (process.env.MONGODB_DB || 'nexconn').trim();
if (!who || !['on', 'off'].includes(state)) {
  console.error('usage: npm run sc:flag -w server -- <businessId|phone> on|off');
  process.exit(2);
}
if (!/^[a-z0-9_]+_(dev|test_[a-z0-9_]+)$/i.test(dbName)) {
  console.error(`Refusing: MONGODB_DB is "${dbName}". Use a dev/test database (e.g. nexconn_sc_dev).`);
  process.exit(2);
}
await connectDb();
let bizId = who;
if (/^\d{10}$/.test(who)) {
  const u = await col('users').findOne({ phone: who } as any);
  if (!u?.business_id) {
    console.error(`No business for phone ${who}`);
    process.exit(1);
  }
  bizId = u.business_id;
}
const r = await col('businesses').updateOne({ _id: bizId } as any, { $set: { 'flags.sc': state === 'on' } });
console.log(r.matchedCount ? `flags.sc ${state} for ${bizId} (db ${dbName})` : `business ${bizId} not found`);
await closeDb();
