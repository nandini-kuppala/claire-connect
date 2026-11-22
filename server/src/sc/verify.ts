// Ledger verification (04 §6.2): every event balances per dimension, and each materialized holding equals the sum of
// its postings. Run: npm run sc:verify -w server (dev/test databases only). Exit code 1 on any mismatch.
import { connectDb, closeDb, col } from '../db/index.js';
import { holdingId } from './repo.js';

export async function verifyLedger() {
  const problems: string[] = [];
  const byEvent = new Map<string, number>();
  const byHolding = new Map<string, number>();
  for await (const p of col('sc_postings').find({}, { projection: { event_id: 1, key: 1, dimension: 1, delta_base: 1 } })) {
    const ek = `${p.event_id}|${p.dimension}`;
    byEvent.set(ek, (byEvent.get(ek) ?? 0) + p.delta_base);
    const hid = holdingId(p.key, p.dimension);
    byHolding.set(hid, (byHolding.get(hid) ?? 0) + p.delta_base);
  }
  for (const [k, v] of byEvent) if (v !== 0) problems.push(`event ${k} does not balance: Σ = ${v}`);
  let holdings = 0;
  for await (const h of col('sc_holdings').find({}, { projection: { qty_base: 1, t: 1, key: 1 } })) {
    holdings++;
    const expected = byHolding.get(h._id as unknown as string) ?? 0;
    if (expected !== h.qty_base) problems.push(`holding ${h._id} is ${h.qty_base}, postings say ${expected}`);
    if (h.t === 'real' && h.qty_base < 0) problems.push(`real holding ${h._id} is negative (${h.qty_base})`);
    byHolding.delete(h._id as unknown as string);
  }
  for (const [k, v] of byHolding) if (v !== 0) problems.push(`postings for ${k} (Σ ${v}) have no holding row`);
  return { events: byEvent.size, holdings, problems };
}

if (process.argv[1]?.endsWith('verify.ts')) {
  const dbName = (process.env.MONGODB_DB || 'nexconn').trim();
  if (!/_dev|_test_/.test(dbName)) {
    console.error(`Refusing: MONGODB_DB is "${dbName}". Use a dev/test database.`);
    process.exit(2);
  }
  await connectDb();
  const r = await verifyLedger();
  console.log(`sc-verify: ${r.events} event×dimension groups, ${r.holdings} holdings, ${r.problems.length} problem(s)`);
  r.problems.slice(0, 20).forEach((p) => console.log('  ' + p));
  await closeDb();
  process.exit(r.problems.length ? 1 : 0);
}
