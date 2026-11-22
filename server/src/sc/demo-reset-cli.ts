// Dev tool: nightly demo reset. Removes the Goods records of the Scenario A / B demo businesses (businesses.sc_demo
// 'A' | 'B', owner phones 9000001001–010 and 9000002001–005) and seeds them again by running
// scripts/sc-demo-scenarios.py once. Every other business is left untouched and the ledger stays consistent.
//
//   MONGODB_DB=nexconn_sc_dev npm run sc:demo-reset -w server              # delete + re-seed (dev server on :8787)
//   MONGODB_DB=nexconn_sc_dev npm run sc:demo-reset -w server -- --dry-run  # report only, writes nothing
//   MONGODB_DB=nexconn_sc_dev npm run sc:demo-reset -w server -- --no-seed  # delete only
//
// Refuses any database not named like "<name>_dev" or "<name>_test_<suffix>" (like demo-cli.ts), and refuses to delete when the API on :8787
// is not running on the same database (the re-seed goes through the API).
//
// What is removed: every sc_* record (events with their postings, movements, jobs, disputes, prices, settlements,
// adjustments, notify rows, statement links, drafts …) whose parties are all demo businesses, their users, or contacts
// owned by them. Records are grouped by the ids they share (an event with its movement, a movement with its jobs,
// disputes and notify rows …); a group is removed only if no member names a non-demo business, user, contact, order
// or Trade Desk ticket. Groups that do are kept and reported. Holdings are recomputed from the postings left, inside
// the same transaction; a real holding that would go negative aborts the whole reset. Setup rows (contacts, places,
// rate cards, styles, aliases, recent specs, devices, Claire sessions/log, relationships) go too unless a kept record
// still names them. Never touched: the shared catalog (specs, material and process types), sc_order_openings, files,
// the businesses and users themselves, marketplace orders, and the Goods conversations (their Nexconn chat cards stay).
//
// Nightly schedule (not installed; pick one). The dev server must be running (SC_ENABLED=1, same MONGODB_DB):
//   cron (crontab -e), 03:30 every night:
//     30 3 * * * cd /Users/dev/Desktop/claire && . ~/.nvm/nvm.sh && nvm use 24 >/dev/null && MONGODB_DB=nexconn_sc_dev npm run sc:demo-reset -w server >> /tmp/sc-demo-reset.log 2>&1
//   launchd (~/Library/LaunchAgents/claire.sc-demo-reset.plist, then `launchctl load` it): ProgramArguments
//     /bin/zsh -lc "<the same command as the cron line>", StartCalendarInterval { Hour 3, Minute 30 }.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, closeDb, col, withTx } from '../db/index.js';
import { holdingId } from './repo.js';
import { verifyLedger } from './verify.js';

const DEMO_PHONES = [
  ...Array.from({ length: 10 }, (_, i) => String(9000001001 + i)),
  ...Array.from({ length: 5 }, (_, i) => String(9000002001 + i)),
];
const API = 'http://localhost:8787'; // the scenarios script's server; local dev only
const SCENARIOS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts/sc-demo-scenarios.py');
// Shared catalog / files / order openings: never deleted. Postings and holdings are handled with their events.
const NEVER = new Set(['sc_specs', 'sc_material_types', 'sc_process_types', 'sc_order_openings', 'sc_files.files', 'sc_files.chunks', 'sc_postings', 'sc_holdings']);
// Setup rows: removed only when no kept record names them (they are not grouped with records).
const SETUP = new Set(['sc_contacts', 'sc_places', 'sc_rate_cards', 'sc_styles', 'sc_aliases', 'sc_recent_specs', 'sc_devices', 'sc_claire_sessions', 'sc_claire_log', 'sc_relationships']);

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const seed = !args.has('--no-seed') && !dryRun;
const dbName = (process.env.MONGODB_DB || 'nexconn').trim();
if (!/^[a-z0-9_]+_(dev|test_[a-z0-9_]+)$/i.test(dbName)) {
  console.error(`Refusing: MONGODB_DB is "${dbName}". Use a dev/test database (e.g. nexconn_sc_dev).`);
  process.exit(2);
}

/** Every string in a document, plus its parts split on ':' and '|' (holding refs "b:<id>", notify ids, device ids). */
function tokens(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === 'string') {
    out.add(v);
    if (/[:|]/.test(v)) for (const p of v.split(/[:|]/)) if (p) out.add(p);
  } else if (Array.isArray(v)) for (const x of v) tokens(x, out);
  else if (v && typeof v === 'object') {
    if (typeof (v as any).toHexString === 'function') out.add(String(v));
    else for (const x of Object.values(v)) tokens(x, out);
  }
  return out;
}

async function apiBusinessId(phone: string): Promise<string | null> {
  const post = await fetch(`${API}/api/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, otp: '123456' }) });
  const tok = ((await post.json()) as any)?.token;
  if (!tok) return null;
  const me: any = await (await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${tok}` } })).json();
  return (me?.user ?? me)?.business_id ?? null;
}

const database = await connectDb();
const db = database.databaseName;

// ── 1. Who is demo ────────────────────────────────────────────────────────────────────────────────────────────
const owners = (await col('users').find({ phone: { $in: DEMO_PHONES } } as any, { projection: { phone: 1, business_id: 1 } }).toArray()) as any[];
const flagged = (await col('businesses').find({ sc_demo: { $in: ['A', 'B'] } } as any, { projection: { name: 1, sc_demo: 1 } }).toArray()) as any[];
const ownerBiz = new Map(owners.filter((u) => u.business_id).map((u) => [u.business_id as string, u.phone as string]));
const demo = new Set<string>(flagged.filter((b) => ownerBiz.has(b._id)).map((b) => b._id));
for (const b of flagged) if (!ownerBiz.has(b._id)) console.log(`note: ${b.name} has sc_demo=${b.sc_demo} but no demo-range owner phone; treated as NOT demo`);
for (const [id, phone] of ownerBiz) if (!demo.has(id)) console.log(`note: ${phone} owns ${id}, which is not flagged sc_demo; treated as NOT demo`);
if (!demo.size) {
  console.error('No demo businesses found (run scripts/sc-demo-scenarios.py once to create them).');
  process.exit(1);
}
const demoUsers = new Set(((await col('users').find({ business_id: { $in: [...demo] } } as any, { projection: { _id: 1 } }).toArray()) as any[]).map((u) => String(u._id)));
const demoContacts = new Set<string>();
const other = new Set<string>(); // ids of everything that is not demo: businesses, users, contacts, orders, tickets
for (const b of (await col('businesses').find({}, { projection: { _id: 1 } }).toArray()) as any[]) if (!demo.has(b._id)) other.add(String(b._id));
for (const u of (await col('users').find({}, { projection: { _id: 1 } }).toArray()) as any[]) if (!demoUsers.has(String(u._id))) other.add(String(u._id));
for (const c of (await col('sc_contacts').find({}, { projection: { owner_business_id: 1, linked_business_id: 1 } }).toArray()) as any[]) {
  const mine = demo.has(c.owner_business_id) && (!c.linked_business_id || demo.has(c.linked_business_id));
  (mine ? demoContacts : other).add(String(c._id));
}
for (const name of ['orders', 'tickets']) for (const d of (await col(name).find({}, { projection: { _id: 1 } }).toArray()) as any[]) other.add(String(d._id));
const isDemo = (t: string) => demo.has(t) || demoUsers.has(t) || demoContacts.has(t);
console.log(`db ${db}: ${demo.size} demo businesses, ${demoUsers.size} demo users, ${demoContacts.size} demo contacts`);

// ── 2. Load records and group them ───────────────────────────────────────────────────────────────────────────
interface Node { col: string; id: unknown; key: string; demo: boolean; foreign: string[]; toks: Set<string> }
const names = (await database.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => n.startsWith('sc_') && !NEVER.has(n)).sort();
const postingsByEvent = new Map<string, any[]>();
for await (const p of col('sc_postings').find({})) {
  const list = postingsByEvent.get(p.event_id) ?? [];
  list.push(p);
  postingsByEvent.set(p.event_id, list);
}
const records: Node[] = [];
const setup: Node[] = [];
for (const name of names) {
  for await (const d of col(name).find({})) {
    const toks = tokens(d);
    if (name === 'sc_events') for (const p of postingsByEvent.get(String(d._id)) ?? []) tokens(p.key, toks);
    const node: Node = { col: name, id: d._id, key: String(d._id), demo: false, foreign: [], toks };
    for (const t of toks) {
      if (isDemo(t)) node.demo = true;
      else if (other.has(t)) node.foreign.push(t);
    }
    (SETUP.has(name) ? setup : records).push(node);
  }
}
const byKey = new Map(records.map((n, i) => [n.key, i]));
const parent = records.map((_, i) => i);
const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
records.forEach((n, i) => {
  for (const t of n.toks) {
    const j = byKey.get(t);
    if (j !== undefined && j !== i) parent[find(i)] = find(j);
  }
});
const groups = new Map<number, Node[]>();
records.forEach((n, i) => {
  const g = groups.get(find(i)) ?? [];
  g.push(n);
  groups.set(find(i), g);
});
const inDemoGroups: Node[] = [];
const remove: Node[] = [];
const skipped: { size: number; foreign: Set<string>; sample: string }[] = [];
for (const g of groups.values()) {
  if (!g.some((n) => n.demo)) continue;
  inDemoGroups.push(...g);
  const foreign = new Set(g.flatMap((n) => n.foreign));
  if (foreign.size) skipped.push({ size: g.length, foreign, sample: g.filter((n) => n.demo).slice(0, 3).map((n) => `${n.col}/${n.key}`).join(', ') });
  else remove.push(...g);
}
const removeKeys = new Set(remove.map((n) => n.key));
const keptToks = new Set<string>();
for (const n of records) if (!removeKeys.has(n.key)) for (const t of n.toks) keptToks.add(t);
const setupRemove = setup.filter((n) => n.demo && !n.foreign.length && !keptToks.has(n.key));
const setupKept = setup.filter((n) => n.demo && !setupRemove.includes(n));

// ── 3. Ledger: postings of removed events, holdings to recompute ─────────────────────────────────────────────
const events = remove.filter((n) => n.col === 'sc_events').map((n) => n.key);
const eventSet = new Set(events);
const affected = new Map<string, { owner: string }>();
let postingsRemoved = 0;
for (const e of events) for (const p of postingsByEvent.get(e) ?? []) {
  postingsRemoved += 1;
  affected.set(holdingId(p.key, p.dimension), { owner: p.key.owner?.id });
}
const after = new Map<string, number>();
for (const [e, list] of postingsByEvent) if (!eventSet.has(e)) for (const p of list) {
  const h = holdingId(p.key, p.dimension);
  if (affected.has(h)) after.set(h, (after.get(h) ?? 0) + p.delta_base);
}

// ── Report the plan ──────────────────────────────────────────────────────────────────────────────────────────
const count = (list: Node[]) => list.reduce<Record<string, number>>((a, n) => ((a[n.col] = (a[n.col] ?? 0) + 1), a), {});
const touching = count([...inDemoGroups, ...setup.filter((n) => n.demo)]);
const removing = count([...remove, ...setupRemove]);
console.log('\ncollection                  demo + linked   remove   keep');
for (const c of [...new Set([...Object.keys(touching), ...Object.keys(removing)])].sort()) {
  const r = removing[c] ?? 0;
  console.log(`${c.padEnd(26)} ${String(touching[c] ?? 0).padStart(13)} ${String(r).padStart(8)} ${String((touching[c] ?? 0) - r).padStart(6)}`);
}
console.log(`sc_postings                ${String(postingsRemoved).padStart(22)}`);
console.log(`sc_holdings                recompute ${affected.size} (${[...affected.keys()].filter((h) => !after.has(h)).length} rows go, the rest are set from the postings left)`);
for (const s of skipped) {
  const who = [...s.foreign].slice(0, 4).join(', ');
  console.log(`SKIP group of ${s.size} record(s) touching non-demo ${who}${s.foreign.size > 4 ? ' …' : ''}: e.g. ${s.sample}`);
}
if (setupKept.length) console.log(`kept ${setupKept.length} demo setup row(s) still named by a kept record or a non-demo party: e.g. ${setupKept.slice(0, 3).map((n) => `${n.col}/${n.key}`).join(', ')}`);

const before = await verifyLedger();
console.log(`\nledger before: ${before.events} event×dimension groups, ${before.holdings} holdings, ${before.problems.length} problem(s)`);
if (before.problems.length && !args.has('--force')) {
  before.problems.slice(0, 10).forEach((p) => console.log('  ' + p));
  console.error('Refusing: the ledger has problems before the reset (pass --force to go ahead anyway).');
  process.exit(1);
}
if (dryRun) {
  console.log('dry run: nothing written');
  await closeDb();
  process.exit(0);
}

// The re-seed goes through the API, so it must use this same database: compare a demo owner's business id.
if (seed) {
  const phone = owners.find((u) => demo.has(u.business_id))!.phone;
  const viaApi = await apiBusinessId(phone).catch(() => null);
  if (viaApi !== owners.find((u) => u.phone === phone)!.business_id) {
    console.error(`Refusing: the API at ${API} is not running on ${db} (or is down). Start it with SC_ENABLED=1 MONGODB_DB=${db}, or pass --no-seed.`);
    process.exit(1);
  }
}

// ── 4. Delete + recompute holdings, all in one transaction ───────────────────────────────────────────────────
const recordIds = remove.filter((n) => n.col !== 'sc_events').map((n) => n.key);
const result = await withTx(async (session) => {
  // A record written since the scan that points at something we remove would be left dangling: stop instead.
  const late = await col('sc_events').countDocuments({ 'ref.id': { $in: recordIds }, _id: { $nin: events } } as any, { session });
  if (late) throw new Error(`${late} event(s) recorded since the scan refer to removed records; run the reset again`);
  const byCol = new Map<string, unknown[]>();
  for (const n of [...remove, ...setupRemove]) {
    if (!byCol.has(n.col)) byCol.set(n.col, []);
    byCol.get(n.col)!.push(n.id);
  }
  const deleted: Record<string, number> = {};
  for (const [c, ids] of byCol) deleted[c] = (await col(c).deleteMany({ _id: { $in: ids } } as any, { session })).deletedCount;
  deleted.sc_postings = (await col('sc_postings').deleteMany({ event_id: { $in: events } } as any, { session })).deletedCount;
  // Recompute every affected holding from the postings left (read inside the transaction).
  const sums = new Map<string, number>();
  const ownerIds = [...new Set([...affected.values()].map((a) => a.owner).filter(Boolean))];
  for await (const p of col('sc_postings').find({ 'key.owner.id': { $in: ownerIds } } as any, { session, projection: { key: 1, dimension: 1, delta_base: 1 } })) {
    const h = holdingId(p.key, p.dimension);
    if (affected.has(h)) sums.set(h, (sums.get(h) ?? 0) + p.delta_base);
  }
  const rows = (await col('sc_holdings').find({ _id: { $in: [...affected.keys()] } } as any, { session, projection: { t: 1 } }).toArray()) as any[];
  const ops: any[] = [];
  for (const h of rows) {
    const qty = sums.get(h._id);
    if (qty === undefined) ops.push({ deleteOne: { filter: { _id: h._id } } });
    else {
      if (h.t === 'real' && qty < 0) throw new Error(`holding ${h._id} would go negative (${qty}); nothing was changed`);
      ops.push({ updateOne: { filter: { _id: h._id }, update: { $set: { qty_base: qty, updated_at: Date.now() } } } });
    }
  }
  const bw = ops.length ? await col('sc_holdings').bulkWrite(ops, { session, ordered: false }) : null;
  return { deleted, holdingsDeleted: bw?.deletedCount ?? 0, holdingsUpdated: bw?.modifiedCount ?? 0 };
});
console.log(`\ndeleted: ${Object.entries(result.deleted).map(([c, n]) => `${c} ${n}`).join(', ')}`);
console.log(`holdings: ${result.holdingsDeleted} removed, ${result.holdingsUpdated} updated`);
const mid = await verifyLedger();
console.log(`ledger after delete: ${mid.events} event×dimension groups, ${mid.holdings} holdings, ${mid.problems.length} problem(s)`);
mid.problems.slice(0, 10).forEach((p) => console.log('  ' + p));
await closeDb();
if (mid.problems.length) process.exit(1);

// ── 5. Re-seed: run the scenarios once ───────────────────────────────────────────────────────────────────────
if (seed) {
  console.log(`\nre-seeding: python3 ${path.relative(process.cwd(), SCENARIOS)}`);
  const r = spawnSync('python3', [SCENARIOS], { stdio: 'inherit', env: { ...process.env, MONGODB_DB: db } });
  process.exit(r.status ?? 1);
}
