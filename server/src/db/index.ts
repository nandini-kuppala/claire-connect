// MongoDB Atlas data layer. Every document uses our own string id as `_id` and also keeps it in `id`.
import { MongoClient, type ClientSession, type Db, type Document, type Filter, type FindOptions } from 'mongodb';
import 'dotenv/config';

const uri = (process.env.MONGODB_URI || process.env.mongodb || '').trim();
// No silent default: a local run without MONGODB_DB used to land on the production database ("nexconn").
// Production sets MONGODB_DB=nexconn explicitly (render.yaml); local work uses nexconn_sc_dev.
const dbName = (process.env.MONGODB_DB || '').trim();

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDb() {
  if (database) return database;
  if (!uri) throw new Error('MongoDB connection string missing: set MONGODB_URI (or "mongodb") in server/.env');
  if (!dbName) throw new Error('MONGODB_DB is not set. Use MONGODB_DB=nexconn_sc_dev for local work; production sets it in render.yaml.');
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: 'claire-connect' });
  await client.connect();
  database = client.db(dbName);
  await Promise.all([
    col('users').createIndex({ phone: 1 }, { unique: true }),
    col('businesses').createIndex({ slug: 1 }, { unique: true }),
    col('listings').createIndex({ category: 1, active: 1 }),
    col('listings').createIndex({ business_id: 1 }),
    col('orders').createIndex({ buyer_business_id: 1 }),
    col('orders').createIndex({ seller_business_id: 1 }),
    col('ratings').createIndex({ ratee_business_id: 1 }),
    col('conversations').createIndex({ channel_id: 1 }, { unique: true }),
    col('tickets').createIndex({ status: 1, created_at: -1 }),
    col('dev_messages').createIndex({ channel_key: 1, sent_at: -1 }),
  ]);
  return database;
}

/** Runs `fn` in a MongoDB transaction (Atlas replica set). Transient errors are retried by the driver. */
export async function withTx<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!client) throw new Error('Database not connected yet');
  const session = client.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

export function col<T extends Document = any>(name: string) {
  if (!database) throw new Error('Database not connected yet');
  return database.collection<T>(name);
}

export async function insert(name: string, doc: Record<string, any>) {
  const withId: Record<string, any> = { _id: doc.id ?? doc._id, ...doc };
  if (!withId.id) withId.id = withId._id;
  await col(name).insertOne(withId as any);
  return withId;
}

export async function update(name: string, id: string, set: Record<string, any>) {
  await col(name).updateOne({ _id: id } as any, { $set: set });
}

export async function findOne<T = any>(name: string, filter: Filter<any>, opts: FindOptions = {}): Promise<T | null> {
  return (await col(name).findOne(filter, opts)) as T | null;
}

export async function find<T = any>(name: string, filter: Filter<any> = {}, opts: FindOptions = {}): Promise<T[]> {
  return (await col(name).find(filter, opts).toArray()) as T[];
}

export async function byId<T = any>(name: string, id: string): Promise<T | null> {
  return findOne<T>(name, { _id: id });
}

export async function count(name: string, filter: Filter<any> = {}) {
  return col(name).countDocuments(filter);
}

export const kv = {
  async get(k: string) {
    return (await col('kv').findOne({ _id: k } as any))?.v as string | undefined;
  },
  async set(k: string, v: string) {
    await col('kv').updateOne({ _id: k } as any, { $set: { v } }, { upsert: true });
  },
};

export async function closeDb() {
  await client?.close();
  client = null;
  database = null;
}

/** Atomically claim a one-time key (e.g. a message id). Returns true only for the first caller. */
export async function claim(key: string) {
  try {
    await col('kv').insertOne({ _id: key, v: '1', at: Date.now() } as any);
    return true;
  } catch (err: any) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

/** Increment a named counter (stats). Never throws. */
export async function bump(counter: string, by = 1) {
  try {
    await col('counters').updateOne({ _id: counter } as any, { $inc: { n: by } }, { upsert: true });
  } catch (err) {
    console.warn('[db] counter bump failed', counter, (err as Error).message);
  }
}

export async function counter(name: string) {
  return ((await col('counters').findOne({ _id: name } as any))?.n as number | undefined) ?? 0;
}
