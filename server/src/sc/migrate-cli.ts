// Migration (04 §11): opening positions for open job-work orders where both businesses use Goods.
//   npm run sc:migrate-orders -w server            (dry run: prints the plan, writes nothing)
//   npm run sc:migrate-orders -w server -- --apply (writes sc_order_openings; idempotent by order id)
// Refuses any database that is not a dev/test one: running it on production is the owner's decision.
import { connectDb, closeDb } from '../db/index.js';
import { migrateOpenings } from './orders.js';

const apply = process.argv.includes('--apply');
const dbName = (process.env.MONGODB_DB || 'nexconn').trim();
if (!/^[a-z0-9_]+_(dev|test_[a-z0-9_]+)$/i.test(dbName)) {
  console.error(`Refusing: MONGODB_DB is "${dbName}". Use a dev/test database (e.g. nexconn_sc_dev).`);
  process.exit(2);
}
await connectDb();
const plan = await migrateOpenings({ apply });
for (const p of plan) console.log(`${p.code}  ${p.qty_done}/${p.qty}  ${p.action}${p.action === 'create' && !apply ? ' (dry run)' : ''}`);
console.log(`${plan.length} open job-work order(s); ${plan.filter((p) => p.action === 'create').length} to create${apply ? ' (applied)' : ' (dry run; pass --apply to write)'} (db ${dbName})`);
await closeDb();
