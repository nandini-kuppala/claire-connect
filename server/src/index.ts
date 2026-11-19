// CLAIRE Connect API server.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import cors from 'cors';
import multer from 'multer';
import { cfg, features } from './config.js';
import { connectDb, count, kv } from './db/index.js';
import { seed, BOT_USERS } from './db/seed.js';
import { chat, chatMode } from './chat.js';
import { NexconnError } from './nexconn.js';
import { uploadsDir } from './voice.js';
import auth from './routes/auth.js';
import onboarding from './routes/onboarding.js';
import claire from './routes/claire.js';
import catalog from './routes/catalog.js';
import business from './routes/business.js';
import voice from './routes/voice.js';
import dev from './routes/dev.js';
import webhooks from './routes/webhooks.js';
import misc from './routes/misc.js';

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost)(:\d+)?$/i;

/** Route modules written by other parts of the team; a missing one is reported, not fatal. */
const EXTERNAL_ROUTES = ['./routes/deals.js', './routes/desk.js', './routes/requirements.js'];

async function ensureBots() {
  if (!features.nexconn) return;
  for (const bot of BOT_USERS) {
    const key = `nexconn_bot:${bot.id}`;
    if (await kv.get(key)) continue;
    try {
      const token = await chat.ensureUser(bot.id, bot.name);
      if (token) await kv.set(key, token);
      console.log(`[nexconn] bot user ready: ${bot.id}`);
    } catch (err) {
      console.error(`[nexconn] could not register bot user "${bot.id}":`, (err as Error).message);
      if (err instanceof NexconnError && [401, 403, 1004].includes(err.code)) {
        // Credentials are rejected (bad App Secret / App Key / area): every chat call would fail.
        features.nexconn = false;
        console.error(
          '[nexconn] Nexconn rejected the app credentials. Check NEXCONN_APP_KEY / NEXCONN_APP_SECRET / NEXCONN_AREA in server/.env.\n' +
            '[nexconn] Falling back to the LOCAL chat relay (/api/dev/*) so the app keeps working. Restart after fixing the keys.',
        );
        return;
      }
    }
  }
}

async function main() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || origin === cfg.webUrl || LOCAL_ORIGIN.test(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '15mb' }));
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', fallthrough: false }));

  await connectDb();
  console.log('[db] connected to MongoDB');
  if ((await count('businesses', { is_seed: 1 })) === 0) {
    console.log('[seed] no demo data found, seeding…');
    await seed();
  }
  await ensureBots();

  for (const r of [misc, auth, onboarding, claire, catalog, business, voice, dev, webhooks]) app.use('/api', r);
  for (const path of EXTERNAL_ROUTES) {
    try {
      const mod = (await import(path)) as { default?: Router };
      if (mod.default) app.use('/api', mod.default);
      else console.error(`[routes] ${path} has no default export Router`);
    } catch (err) {
      console.error(`[routes] could not load ${path}:`, (err as Error).message);
    }
  }

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Production: serve the built web app (web/dist) from the same origin, with SPA fallback.
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
    console.log('[web] serving built app from web/dist');
  }
  // Body-parser / multer / static errors → friendly JSON.
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large (max 15 MB).' : err.code === 'LIMIT_FILE_COUNT' ? 'Too many files (max 12).' : 'Upload failed.';
      return res.status(400).json({ error: msg });
    }
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (err?.status === 404 || err?.statusCode === 404) return res.status(404).json({ error: 'Not found' });
    console.error('[server error]', req.method, req.path, err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  app.listen(cfg.port, () => {
    console.log(`[server] CLAIRE Connect API on http://localhost:${cfg.port} · chat=${chatMode()} · llm=${features.llm} · sarvam=${features.sarvam}`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err?.message ?? err);
  process.exit(1);
});
