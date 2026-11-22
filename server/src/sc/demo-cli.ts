// Dev tool (Phase 7): mark the Scenario A / B demo businesses as demo and turn Goods on for them.
//   npx tsx src/sc/demo-cli.ts <A|B> <phone> [<phone> …]
// Sets businesses.flags.sc, businesses.is_seed = 1 and businesses.sc_demo = 'A' | 'B', and users.is_seed = 1, so they
// read as demo businesses like the existing "Explore as a demo business" accounts. Refuses any non-dev database.
import { connectDb, closeDb, col } from '../db/index.js';

const [scenario, ...phones] = process.argv.slice(2);
const dbName = (process.env.MONGODB_DB || 'nexconn').trim();
if (!['A', 'B'].includes(scenario) || !phones.length || phones.some((p) => !/^\d{10}$/.test(p))) {
  console.error('usage: npx tsx src/sc/demo-cli.ts <A|B> <phone> [<phone> …]');
  process.exit(2);
}
if (!/_dev|_test_/.test(dbName)) {
  console.error(`Refusing: MONGODB_DB is "${dbName}". Use a dev/test database (e.g. nexconn_sc_dev).`);
  process.exit(2);
}
await connectDb();
let n = 0;
for (const phone of phones) {
  const u: any = await col('users').findOne({ phone } as any);
  if (!u?.business_id) { console.error(`no business for ${phone}`); continue; }
  await col('users').updateOne({ _id: u._id } as any, { $set: { is_seed: 1 } });
  await col('businesses').updateOne({ _id: u.business_id } as any, { $set: { 'flags.sc': true, is_seed: 1, sc_demo: scenario } });
  n += 1;
}
console.log(`scenario ${scenario}: ${n} demo business(es) flagged (db ${dbName})`);
await closeDb();
