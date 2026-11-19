# CLAIRE Connect — Handover

Everything a new developer (or the submitting team) needs to run, change, deploy and submit CLAIRE Connect.
Status on 19 Nov 2026: feature-complete for the Nexconn Build Challenge; runs live on Nexconn, MongoDB Atlas, OpenRouter and Sarvam. Submission deadline **Sun 22 Nov 2026, 11:59 PM IST**.

---

## 1. Repository layout

```
claire-connect/
├── server/            Express + TypeScript API (run with tsx, no build step)
│   ├── src/index.ts   entry: CORS, routes, seeding, bot users, serves web/dist in production
│   ├── src/routes/    auth, onboarding, claire, catalog, business, voice, deals, desk, requirements, webhooks, misc, dev
│   ├── src/claire.ts  Claire's buy flow (slot filling: category → style → qty → budget → timing → results)
│   ├── src/match.ts   supplier matching, 2–3 seller combos, job-work split, market price band
│   ├── src/deals.ts   deal rooms, offers, counter-offers, orders, ratings, samples, inbox
│   ├── src/desk.ts    Trade Desk tickets, dispatch by language/skill, AI summaries
│   ├── src/trust.ts   trust score (verification 20, ratings 40, reliability 25, responsiveness 10, disputes 5)
│   ├── src/llm.ts     OpenRouter client: pacing, daily budget, retries, cache, model chain
│   ├── src/ai.ts      NLU, profile extraction, catalogue-from-photos, translation, triage
│   ├── src/voice.ts   Sarvam speech-to-text / text-to-speech
│   ├── src/nexconn.ts Nexconn Server API client (signed REST)
│   ├── src/chat.ts    chat facade (Nexconn, or a local relay when Nexconn keys are missing)
│   └── src/db/        MongoDB helpers + demo seed (25 businesses, 38 listings, 88 past orders, 3 agents)
├── web/               React 19 + Vite + Tailwind v4 app (mobile-first, desk is desktop)
│   ├── src/chat/      engine.ts (Nexconn Web SDK), translate.ts, ChatView, Composer, voice
│   ├── src/cards/     custom message cards (results, offer, order, rating, hint …)
│   ├── src/screens/   Login, Home, Claire, Results, Compare, Deal, Inbox, Orders, Profile, Storefront, Desk …
│   ├── src/icons/     custom icon set (no third-party icon library)
│   └── src/components Button, Avatar/logo, TrustBadge, BottomNav, Sheet, CatalogSheet, GarmentArt
├── shared/            types shared by server and web (card payloads, category taxonomy)
├── demo-video/        scripts that record and narrate the demo video + the final render
├── docs/              research, spec, design, contracts, this handover
└── render.yaml        one-click Render deployment (secrets entered in the dashboard)
```

## 2. Architecture

```
 Browser (React)  ──Nexconn Web SDK──▶  Nexconn cloud (SG)  ◀──signed REST──  Express server
      │  translation (SDK, fallback /api/translate)                                │
      └──────────── HTTPS /api (same origin in production) ───────────────────────┤
                                                                                   ├── MongoDB Atlas (db "nexconn")
                                                                                   ├── OpenRouter (LLM: NLU, vision, translation)
                                                                                   └── Sarvam AI (Indian-language STT/TTS)
```

- **Client → server notify pattern:** the web app sends a chat message through the Nexconn SDK and then tells the server (`POST /api/claire/turn`, `POST /api/deals/:id/inbound`) so Claire can react without a public webhook. When the app is deployed, the Nexconn webhook (`/api/webhooks/nexconn`) works too; both paths dedupe on the message id.
- **Bots:** `claire` (assistant), `claire_updates` (system channel notices), `trade_desk` (agents) are Nexconn users created at boot.
- **Local relay:** if `NEXCONN_APP_SECRET` is missing or rejected, the server logs it and switches to a local relay (SSE + Mongo) so the app still works offline. `/api/health` shows `chat: "nexconn"` or `"local"`.

## 3. Nexconn features used (and where) — needed for the submission form

| Feature | Where |
|---|---|
| Web Chat SDK `@nexconn/engine` + `@nexconn/chat` 26.5.1: initialize, connect, handlers | `web/src/chat/engine.ts` |
| Direct channels (user ↔ Claire) | Claire assistant chat |
| Group channels (one per deal, agents join) | `server/src/deals.ts` `openDeal`, `server/src/desk.ts` join |
| System channel (order / payment updates) | `server/src/chat.ts` `system()` → CLAIRE Updates |
| Custom messages `CC:Card`, `CC:Hint`, `CC:Reply`, `CC:Voice` (registered before connect) | `shared/cards.ts`, `web/src/cards/*` |
| Targeted group messages (`toUserIds`) for Claire's private tips | `server/src/deals.ts` hints, rating cards |
| Built-in translation (`translateMessages`, translation language, auto-translate) | `web/src/chat/translate.ts` |
| History query, typing status, read receipts, unread | `web/src/chat/engine.ts`, `ChatView.tsx` |
| Server API: access-token issue, direct/group/system send, group create/join, stream send | `server/src/nexconn.ts` |
| Webhook receiver with signature check | `server/src/routes/webhooks.ts` |

App Key: shown in the Nexconn console (Key Management). Put it in the PDF write-up and the submission form; do not post it in public issues.

## 4. Secrets and configuration

Secrets live only in `server/.env` (git-ignored) locally and in the hosting dashboard in production. `server/.env.example` lists every variable.

| Variable | Where to get it |
|---|---|
| `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, `NEXCONN_AREA` (SG) | console.nexconn.ai → your app → Key Management |
| `MONGODB_URI` (+ `MONGODB_DB=nexconn`) | Atlas → Connect → Drivers. Network Access must allow the host (use `0.0.0.0/0` for Render/Railway) |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |
| `SARVAM_API_KEY` | indus.sarvam.ai/key-management |
| `JWT_SECRET` | any long random string in production (`openssl rand -hex 32`) |
| `PUBLIC_WEB_URL`, `PUBLIC_SERVER_URL` | your public https URL in production (same value for the single-service deploy) |
| `DEMO_OTP` | demo OTP for every phone (default `123456`; there is no SMS provider) |

**Nexconn console settings to keep on:** translation (otherwise SDK translation returns 28400 and the server fallback is used), **Targeted Group cloud retention** (so private tips and rating cards survive a reload), Chat Growth Credit (Pro features free up to 10K MAU), and the webhook URL after deploying.

**OpenRouter:** the account's guardrail currently blocks the free Nemotron endpoints, so the chain falls back to other free models. To use Nemotron Ultra (preferred), allow free models at openrouter.ai/workspaces/default/guardrails.

## 5. Run locally

```bash
# Node 22+ (24 recommended): nvm install 24 && nvm use 24
npm install
cp server/.env.example server/.env    # paste keys
npm run dev                            # API http://localhost:8787 · web http://localhost:5173
npm run typecheck                      # server + web
npm run seed                           # force re-seed demo data (wipes deals/orders in the db)
```

Demo accounts (OTP `123456`): Amit Hosiery (buyer, Kolkata) `9000000001` · Lakshmi Garments (stitching unit, Tamil) `9000000002` · Sree Textiles `9000000003` · Ravi Knit Fashions `9000000004` · agents Meena `9000000901`, Arjun `9000000902`, Farida `9000000903`. The sign-in screen lists them under **Explore as a demo business**. Note: seeding sets Amit's language to Hindi; switch it in Profile → Language.

## 6. How the AI is used (free tier, quality first)

- `server/src/llm.ts`: max 19 requests/minute (rolling window), 1,000/day budget counted in Mongo (`kv` `openrouter:<date>`, 30 kept in reserve), retries on 429/5xx honouring `retry-after`, results cached in memory + `llm_cache` so identical requests never cost twice.
- Structured output via forced function calling, then JSON-in-text fallback, validated with zod.
- Model chain: `nvidia/nemotron-3-ultra-550b-a55b:free` first, then other free models if a model is unavailable (skipped for an hour). Vision (catalogue from photos): `nvidia/nemotron-3.5-super-vl:free` first.
- Rule-based fallbacks keep Claire working if the daily budget runs out.
- Translation: the server LLM (`/api/translate`, glossary-aware, native script) is preferred; Nexconn translation runs in parallel and is used when the server can't answer, only if every number survives.

## 7. Deployment (single service)

The server serves the built web app from `web/dist`, so one Node web service is enough.

### Render (recommended, free)
1. render.com → New → **Blueprint** → pick `nandini-kuppala/claire-connect` (uses `render.yaml`).
2. Fill the secret env vars when prompted: `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, `MONGODB_URI`, `OPENROUTER_API_KEY`, `SARVAM_API_KEY`. `JWT_SECRET` is generated.
3. After the first deploy, copy the URL (e.g. `https://claire-connect.onrender.com`) into `PUBLIC_WEB_URL` and `PUBLIC_SERVER_URL`, then redeploy.
4. Atlas → Network Access → add `0.0.0.0/0` (Render has no fixed IP on the free plan).
5. Nexconn console → Webhooks → `https://<your-url>/api/webhooks/nexconn` (message events).
6. Check `https://<your-url>/api/health` shows `"chat":"nexconn"`, then sign in with a demo account.

Manual setup instead of the blueprint: Build `npm ci --include=dev && npm run build`, Start `npm start`, Node 24, health check `/api/health`.

Notes: the free plan sleeps after 15 minutes idle (first request takes ~30–50 s; open the link before judging or use a paid instance). `server/uploads` (voice notes, TTS cache, photos) is ephemeral on Render; fine for a demo.

### Alternatives
Railway or Fly.io work the same way (Node 24, same build/start commands, same env vars). Mic recording needs **https**, which all of these provide.

## 8. Hackathon submission checklist (reskilll.com/hack/nexconn)

- [ ] Title + summary
- [ ] Nexconn packages (`@nexconn/engine`, `@nexconn/chat`, Server API), **App Key**, and "SDK features used and where" (table in §3)
- [ ] Live app link (Render URL)
- [ ] Public GitHub repo: https://github.com/nandini-kuppala/claire-connect
- [ ] Demo video link: upload `demo-video/renders/CLAIRE-Connect-demo.mp4` to YouTube (unlisted) / Drive / Loom / Vimeo
- [ ] PDF write-up ≤ 25 MB: why, problem, Nexconn features, App Key (use `docs/01`, `docs/02` and §3)
- [ ] Traction (significant bonus): real users signing in on the deployed app count as active users on your App Key
- [ ] Prior-work disclosure: the CLAIRE idea/landing page existed before; all CLAIRE Connect code and the Nexconn integration were built during the challenge

Judging: Completeness & UX 50% · Innovation 30% · Business & growth 20% · traction bonus.

## 9. Demo video

`demo-video/` holds the scripts. Rebuild with the app running locally:

```bash
cd demo-video && npm install && npx playwright install chromium
DOTENV_CONFIG_PATH=../server/.env npx tsx reset.ts   # fresh demo users + clean deals
python3 narrate.py segments.json voice --accent in --gender female-plain   # Neerja (plain) narration, needs edge-tts
node capture.mjs            # records every scene (Playwright)
node stages.mjs             # renders slides and frames
python3 compose.py          # composites → renders/CLAIRE-Connect-demo.mp4
```

## 10. Known issues and next steps

- Matching ignores colour preference (a "white" request can rank a green T-shirt first).
- Nexconn `translateTexts` (free text, e.g. voice transcripts) accepts requests but never returns results; the server translates those.
- The Call SDK is not integrated yet (call buttons are hidden).
- Renaming a user does not update their Nexconn profile name.
- Planning docs 03/04 describe Postgres/Anthropic; the build uses MongoDB/OpenRouter (see notes at the top of those files).
- The SDK's log upload to `logcollection.ronghub.com` is blocked by CORS on localhost; harmless console noise.

## 11. Security

- Never commit `server/.env`; rotate any key that leaks (Nexconn secret, Atlas password, OpenRouter, Sarvam).
- The Nexconn App **Secret** is server-only; the App **Key** is public by design (the browser uses it).
- Demo OTP login is for the hackathon; add a real SMS provider before real users rely on it.
