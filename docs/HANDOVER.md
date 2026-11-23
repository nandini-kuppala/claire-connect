# CLAIRE Connect — Handover

Everything a new developer (or the submitting team) needs to run, change, deploy and submit CLAIRE Connect.
Status on 20 Nov 2026: the web app is feature-complete for the Nexconn Build Challenge and runs live at https://claire-connect.onrender.com on Nexconn, MongoDB Atlas, OpenRouter and Sarvam. Submission deadline **Sun 22 Nov 2026, 11:59 PM IST**.

---

## 0. Where things stand (read this first)

**Done and deployed (web + server):**
- Full buy/sell flow: Claire chat, results and combos, deal chats with offers and counter-offers, orders, ratings, samples, storefront, Trade Desk.
- All 10 languages (en, ta, hi, te, kn, ml, bn, or, mr, gu) on every trader screen and in Claire's replies. `npm run i18n:check -- all` is 100% (§12).
- Nexconn voice and video calls in deal chats and the Trade Desk (§13). Built, but **not yet seen connecting**: the Call service is off in the console (error 80006).
- Live smoke test: `python3 demo-video/smoke_live.py <url>` (25 checks).

**In progress, priority 2: Flutter mobile app** in `mobile/` (§14). Code complete for the core flow and pushed; no Android or iOS build produced yet.

**Next steps, in order:**
1. **Feature development** (priority 1): new work starts here. Read §1–§3, §12 and `docs/DESIGN_SYSTEM.md` before changing UI; every new string needs en/ta/hi inline and the other seven in the overlay files.
2. **Submission** (§8): PDF write-up, video upload, form. Add the Flutter plugin and Call SDK to the "features used" list.
3. **Mobile app** (§14): build the APK and iOS app, then device testing.
4. **Testing, deferred** (do in one pass later):
   - Calls: once the owner enables Audio/Video Calling in the console, run the two-browser test (Amit + Lakshmi, same deal): connected voice call, voice ↔ video switch, `CC:Call` line arriving on the other side.
   - Mobile: on a device or simulator, send text to Claire, tap a chip, Accept / Counter an offer, an order step, a deal chat in Tamil and Telugu.

**Working notes for whoever picks this up:**
- **Git:** push as `nandini-kuppala` (repo owner). If `git push` returns 403 for `Nandini-FH`, run `gh auth switch --user nandini-kuppala`. Short commit messages, one change per commit.
- **Disk:** the build Mac was at ~2 GB free. Mobile builds need ~4 GB free (§14).
- **Shared database:** production and local dev use the same Atlas db; create only demo data. QA runs leave demo requests and offers in the Amit ↔ Sree deal; decline stale pending offers if the smoke test fails on them. Demo users' languages: Amit en, Lakshmi ta, Sree ta, Ravi ta, Meena en.
- **Secrets:** only in `server/.env` and the Render dashboard. Never in `web/` or `mobile/`.

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
│   ├── src/locales/   overlay translations of Claire's replies and notices (te kn ml bn or mr gu)
│   └── src/db/        MongoDB helpers + demo seed (25 businesses, 38 listings, 88 past orders, 3 agents)
├── web/               React 19 + Vite + Tailwind v4 app (mobile-first, desk is desktop)
│   ├── src/chat/      engine.ts (Nexconn Web SDK), translate.ts, ChatView, Composer, voice
│   ├── src/cards/     custom message cards (results, offer, order, rating, hint …)
│   ├── src/screens/   Login, Home, Claire, Results, Compare, Deal, Inbox, Orders, Profile, Storefront, Desk …
│   ├── src/icons/     custom icon set (no third-party icon library)
│   ├── src/locales/   overlay translations of every screen (te kn ml bn or mr gu), lazy-loaded
│   └── src/components Button, Avatar/logo, TrustBadge, BottomNav, Sheet, CatalogSheet, GarmentArt
├── mobile/            Flutter app (Android + iOS) on the Nexconn Flutter Chat SDK, same server API (§14)
├── shared/            types shared by server and web (card payloads, category taxonomy)
├── scripts/           i18n-extract.mjs / i18n-check.mjs (language files)
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
| Built-in translation (`translateTexts`, translation language, auto-translate): the **default** engine since 22 Nov; server LLM is the fallback | `web/src/chat/translate.ts` |
| Profanity filter (`/v4/profanity-word/*`, `onMessageBlocked`): block / mask words, "Not delivered" and "Some words were hidden" notices | `shared/moderation.ts`, `server/src/chatops/moderation-cli.ts`, `web/src/chat/MessageBubble.tsx` |
| File storage (Web SDK uploader, headless worker) + group history query: daily encrypted chat archives, `chat_archives` collection | `server/src/chatArchive.ts`, `server/src/nexconn-node/*`, `server/src/routes/archives.ts` |
| History query, typing status, read receipts, unread | `web/src/chat/engine.ts`, `ChatView.tsx` |
| Server API: access-token issue, direct/group/system send, group create/join, stream send | `server/src/nexconn.ts` |
| Webhook receiver with signature check | `server/src/routes/webhooks.ts` |
| **Flutter Chat SDK** `ai_nexconn_chat_plugin` 26.2.11: init (SG), connect, custom messages, direct / group / system channels, history, unread, typing, read receipts | `mobile/lib/chat/chat_engine.dart` (table in `mobile/README.md`) |
| **Call SDK** `@nexconn/call` 26.2.1: 1:1 voice + video calls (deal chat header, Trade Desk "Call buyer / seller"), incoming / in-call screens, mute, camera, flip, voice ↔ video switch, `CC:Call` summary in the chat | `web/src/call/*`, init in `web/src/chat/engine.ts` |

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

**Nexconn console settings to keep on:** **Audio/Video Calling** (Call service; without it every call shows "Calling isn't switched on for this workspace yet" and the console logs `80006 VOIP_SERVICE_UNAVAILABLE`, see §13), translation (otherwise SDK translation returns 28400 and the server fallback is used), **Targeted Group cloud retention** (so private tips and rating cards survive a reload), Chat Growth Credit (Pro features free up to 10K MAU), and the webhook URL after deploying.

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
- [ ] Nexconn packages (`@nexconn/engine`, `@nexconn/chat`, `@nexconn/call`, Server API, Flutter `ai_nexconn_chat_plugin`), **App Key**, and "SDK features used and where" (table in §3)
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
- Nexconn translation (re-checked 22 Nov): `translateMessages` and `translateTexts` both return results now. The app uses `translateTexts` for everything (`translateMessages` garbled 4 of 6 trade lines: spaces dropped, ₹ → £). Hinglish / Tanglish answer 28401, and output that changes a number is rejected; those fall back to the server. Checks: `node scripts/nexconn-features-smoke.mjs [--calls]`.
- Chat archive: `npm run chat:archive -w server` (dev DBs) or `CHAT_ARCHIVE_EVERY_MIN=60` on the server. Nexconn download URLs are unauthenticated, so files are AES-256-GCM encrypted with `CHAT_ARCHIVE_KEY` (falls back to `JWT_SECRET`; set a fixed key before production, or old archives become unreadable when the secret changes).
- Moderation words: `npm run chat:moderation -w server -- list|sync|remove-all`. The list is app-wide in Nexconn (same App Key = production too).
- Calls need the Call service enabled in the Nexconn console (§13). Group calls are not used (deals are 1:1 business ↔ business).
- Renaming a user does not update their Nexconn profile name.
- Planning docs 03/04 describe Postgres/Anthropic; the build uses MongoDB/OpenRouter (see notes at the top of those files).
- The SDK's log upload to `logcollection.ronghub.com` is blocked by CORS on localhost; harmless console noise.
- Product and offer titles ("Cotton t-shirts", "Job work · … · material provided" in `server/src/deals.ts`) stay English: one stored title is shared by a buyer and seller who may read different languages. Fixing it needs a per-viewer title.
- Older chat notices stay in the language the reader had when they were sent.
- The rule-based fallbacks in `server/src/ai.ts` (used only when the daily AI budget is spent) understand English, Hindi and Tamil words only.
- Small "…" cut-offs on a few long header subtitles (e.g. Tamil Claire subtitle, the language pair + status line in the deal header).
- One deal conversation per buyer–seller pair, so repeated test offers pile into the same chat.

## 11. Security

- Never commit `server/.env`; rotate any key that leaks (Nexconn secret, Atlas password, OpenRouter, Sarvam).
- The Nexconn App **Secret** is server-only; the App **Key** is public by design (the browser uses it).
- Demo OTP login is for the hackathon; add a real SMS provider before real users rely on it.

## 12. Adding or editing a language

All ten languages (ta, hi, en, te, kn, ml, bn, or, mr, gu) are full app languages: the Language screen and the sign-in pill offer every one.

- **English, Tamil, Hindi** live inline in the code: `web/src/i18n.ts` (namespace `app`), `web/src/cards/strings.ts` (`cards`), the co-located `*.strings.ts` files (`defineStrings('<namespace>', { en, ta, hi })`), `server/src/i18n.ts` (`claire`, `units`), `server/src/deals.ts` (`deals`, `deal_units`), `server/src/desk.ts` (`desk`), `server/src/routes/requirements.ts` (`reasons`) and `shared/taxonomy.ts` (category names, `taxonomy`).
- **Telugu, Kannada, Malayalam, Bengali, Odia, Marathi, Gujarati** come from overlay JSON: `web/src/locales/<lang>.json` (screens) and `server/src/locales/<lang>.json` (Claire's replies, deal notices, reasons). Shape: `{ "<namespace>": { "<key>": "<text>" } }`.
- Every lookup goes: inline table for the language → overlay JSON → English → key. A missing key shows English, never a blank.
- `en.json` (web and server) is generated. After changing any English string, run `npm run i18n:extract`. Never edit `en.json` by hand.
- Check a language: `npm run i18n:check -- te` (or `all`). It lists missing and extra keys, placeholder mismatches, empty strings and likely untranslated text, and exits non-zero until the language is complete.
- New screen copy: add it to a `defineStrings('<namespace>', …)` table (en + ta + hi), run `npm run i18n:extract`, then translators fill the other seven.
- Web overlay files are loaded lazily (one small chunk per language); the server reads its JSON at start-up, so restart the server after editing it.
- Translator rules (what stays in English, placeholders, tone): `docs/TRANSLATING.md`.
- Fonts: Noto Sans Telugu, Kannada, Malayalam, Bengali, Oriya and Gujarati load from Google Fonts in `web/index.html` (Devanagari, so Hindi and Marathi, uses Hind; Tamil uses Hind Madurai). Voice: Sarvam STT/TTS covers all ten (`server/src/voice.ts`; Odia is `od-IN` there).

## 13. Voice and video calls (Nexconn Call SDK)

- Package `@nexconn/call` 26.2.1 (web). It declares peer `@nexconn/chat`/`engine` 26.2.0; the app uses 26.5.1 (the APIs it needs are unchanged), so the repo root `.npmrc` sets `legacy-peer-deps=true`. Keep that file, or `npm ci` on Render fails with ERESOLVE.
- Order (in `web/src/chat/engine.ts`): `NCEngine.initialize` → `initCallEngine()` (lazy chunk, `NCCallEngine.initialize` + `setCallEventHandler`) → `NCEngine.connect`. The call chunk is awaited for at most 6 s before connecting.
- `web/src/call/service.ts`: zustand store + actions (`startCall`, `acceptCall`, `hangUp`, `toggleMic`, `toggleCamera`, `flipCamera`, `cycleSpeaker`, `switchMedia`, `answerVideoRequest`). The callee learns the caller's name, trust and deal from `extra`. The caller posts one `CC:Call` message (`shared/cards.ts`) into the deal group when the call ends: "Voice call · 2:31", "Missed video call", "Call declined".
- `web/src/call/CallLayer.tsx` (mounted in `App.tsx`) draws every phase; `CallButtons.tsx` has the header buttons and the chat line. Strings: `web/src/call/call.strings.ts`, namespace `call`, all ten languages inline (the i18n check counts inline tables).
- Trade Desk: ticket parties now carry `userIds` (`server/src/desk.ts`), so agents can call the buyer or seller from the context panel; the summary goes into the deal chat once the agent has joined it.
- Browser needs https (or localhost) and microphone / camera permission; the app explains each case instead of failing.
- Ending: every end path (onCallEnded, hang-up fallback, busy) goes through one `finish()` that runs once per call id, so the summary is posted once. If Nexconn's end signal is lost on one side, the remote-left event (`onRemoteUserStateChanged` ≥ ENDED, 1.5 s grace) or a 2 s watchdog on `getCurrentCallSession()` ends the call there too. Another of your own devices answering or hanging up (1011 / 1151) closes the ringing screen silently.
- Call webhooks (`/api/webhooks/nexconn`) are acknowledged and logged only (signature from headers or query string); the phones own call state and the summary. Webhooks cannot reach localhost, so local tests never depend on them.
- Test: `node scripts/calls-smoke.mjs` (Playwright from `demo-video/`, dev servers up): caller / callee hang-up, decline, cancel, missed (≈1 min server timeout), voice ↔ video, lost end signal (dev-only `window.__ccCallDrop` hook), back-to-back calls; `--runs=2` by default, `--skip-missed`, `--only=a,b`, `--verbose`.

**Enable calling (owner, once):** console.nexconn.ai → your app (the same environment as the App Key in `server/.env`, development or production) → **Audio/Video Calling** (Call) → enable the service (accept the plan / add a payment card if the console asks; free minutes apply). It can take up to 15 minutes to take effect; then clear the site's local storage (or use a fresh browser profile) and reload, because the SDK caches the old "service off" navigation data. Test: two browsers, Amit and Lakshmi in the same deal, tap the phone icon.

## 14. Mobile app (Flutter) — priority 2, in progress

Full developer guide: `mobile/README.md` (run, build, SDK call table, machine notes).

**Done (pushed):**
- Flutter 3.50.1 app in `mobile/` on `ai_nexconn_chat_plugin` 26.2.11. Talks to the same server (`--dart-define=API_BASE`, default the Render URL); gets the App Key and Nexconn token from `/api/me`, so no secrets ship in the app.
- Screens: Login (logo, phone + OTP, demo accounts), Language, Onboarding (form, no voice), Home, Claire chat (chips, tiles, results, summary, notice, orders, requirement, carousel cards), Results (+ combos), Inbox (Claire pinned, CLAIRE Updates, All/Buying/Selling), Deal chat (translation with "Show original", offer Accept/Counter/Decline, order actions, Claire's private tips, quick replies), Orders, Profile (trust ring, badges, language, log out). Bottom nav Home · Chats · Orders · Profile.
- Strings in all 10 languages (`mobile/assets/i18n/*.json`, 273 keys each); `test/i18n_locales_test.dart` fails on any missing key or placeholder mismatch.
- `flutter analyze` clean; `flutter test` 46 passing. `integration_test/live_smoke_test.dart` (read-only, live server) passed on the iOS simulator: demo login → Nexconn connected (SG) → Claire history → inbox unread → every screen opens.
- Offscreen renders of the screens in 10 languages: `mobile/screenshots/render/` (bold weights draw as blocks there; that is the test font, not the app).

**Not done:**
1. **No APK or iOS build yet.** Both stopped when the disk filled. Free ~4 GB first, then `flutter build apk --debug --target-platform android-arm64` and `flutter build ios --simulator --no-codesign`. Android is set to AGP 9.1.1 / Gradle 9.3.1 / NDK 27.1 (pinned in `android/build.gradle.kts` so the `jni` plugin doesn't pull NDK 28.2). An empty `~/Library/Android/sdk/ndk/28.2.13676358` folder from an aborted download can be deleted.
2. **Device testing (deferred, see §0):** sending text, chip taps (`CC:Reply`), Accept/Counter, order steps and translation have not been tapped through on a device.
3. **Not ported from web:** voice notes (CC:Voice shows the transcript only), voice onboarding, rating / sample / support sheets, storefront and compare screens, calls (the Flutter Call plugin is not added), app icon and splash.

**Gotchas:**
- iOS simulator must be an x86_64 (Rosetta) simulator: the RongCloud wrapper under the Nexconn plugin has no arm64-simulator slice. Real devices are fine.
- Run `pod install` with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (Ruby 4 / CocoaPods 1.16 fails otherwise); run it directly before `flutter build ios` if the build stalls unzipping RongCloudIM.
- History `pageSize` must be ≤ 20 (the SDK returns -101 above that).
- `CC:Card` content arrives as maps on iOS; the parser also accepts stringified JSON in case Android differs.
- `mobile/build-artifacts/` is git-ignored; run `flutter clean` after builds to give the disk back.
