# Supply-chain ("Goods") feature: handover for the next session

*Written 22 Nov 2026 at the end of the build session. The next session starts on a different account with no memory of this one, so everything it needs is written here or linked from here.*

**Read in this order:**
1. This file.
2. `PROGRESS.md`: a dated report for every slice, the audits, the bug hunt and both load tests, each with what was built, how it was checked, what was fixed and the known gaps.
3. `BUILD_CONTRACT.md` (`docs/BUILD_CONTRACT.md`): every route and payload.
4. `BRIEF.md`: the owner's governing brief.
5. `BEGINNER-GUIDE.md`: a plain-language tour of every Goods feature, with "Try it" steps and the latest test results.

---

## 1. Where things stand (one paragraph)
The whole build plan is done and pushed: slices 0 → 9, Phase 7 (final verification), a load test, a full bug hunt and a 30-connection stress test.
- **Branch and repo:** everything is on `supply-chain` in GitHub repo `nandini-kuppala/claire-connect`, which matches `origin`. **Nothing is merged to `main`.** The brief forbade merging before the hackathon deadline (22 Nov 2026, 23:59 IST), and any merge needs the owner's approval.
- **Feature flag:** the feature is behind `SC_ENABLED=1` plus a per-business flag `businesses.flags.sc`. Production is untouched.
- **Checks:** all automated checks pass (section 6).

## 2. Hard rules (from the owner; still in force)
- **Secrets:**
  - Never commit secrets or `.env` files. Secrets live only in `server/.env` (local) and the Render dashboard.
  - `ANTHROPIC_API_KEY` is empty. The owner must add it themselves; never ask for it in chat.
- **Production and pushing:**
  - Don't deploy, touch production data, or push to `main` without asking.
  - Push only `supply-chain`, and only when the owner says so, at a slice end, or when nearly out of usage.
- **Databases:**
  - Local work always uses `MONGODB_DB=nexconn_sc_dev`, never `nexconn` (production).
  - `server/src/db/index.ts` now refuses to start without `MONGODB_DB`.
  - The dev tools (`sc:flag`, `demo-cli`, `migrate-cli`) refuse non-dev databases.
- **Commits:**
  - One commit per slice or task.
  - Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - `.claude/` stays untracked.
- **UI** (enforced by `scripts/sc-lint.mjs`):
  - Icons only from `web/src/icons`; no lucide, no blue, no gradients, no emoji.
  - Every status is text + colour + icon. Touch targets are ≥ 44 px.
  - Tamil at 375 px must not truncate.
- **Strings:** every user-visible string lives in a `defineStrings` table (en + ta + hi inline). Run `npm run i18n:extract`, then add the key to the 7 overlay files `web/src/locales/{te,kn,ml,bn,or,mr,gu}.json`; `npm run i18n:check -- all` must stay 100 %.
- **Web first:** Flutter is on hold.

## 3. What was built, by commit (all on `supply-chain`)
| Commit | What |
|---|---|
| 03ff898 | Planning docs (phases 0–5: current state, domain research, model, UX, technical design, build plan) and the 20 Nov web test report |
| 4e049ed | **S0** Domain core, transactional double-entry ledger (`sc_events` + `sc_postings` + `sc_holdings`), feature flag, Goods tab |
| d4330ed | **S0.5** Contacts, places, specs (content-addressed), terms, rate cards, setup screen |
| e327bd2 / c989028 | **S1** Send for work, Got back, Out with others, party ledger |
| a7541af | **S2** Two-sided records (assertions), tolerances, disputes, the Goods conversation and chat cards |
| 1d41e8d | **S3** Job workers' views (Others' goods), forwarding (sub-contract / hop), size grid, desktop layout |
| 01fdb2c | **S4** Made here (cut, pack, check, sets), job detail, closing / reopening, late figures |
| 3f95171 | **S4.5** Buy / sell / returns / samples / move, sale in place, stock corrections, casualty (fire/theft/flood) |
| ab6a656 | **S5** Personal Claire: tool calls, model chain (OpenRouter → Claude Haiku → rules), cross-script names, record drafts |
| 9ecc75e | **S6** Statement links `/l/:token` for people not on CLAIRE, WhatsApp share, contact → business linking |
| 180c150 / 20c3b64 | **S7** Staff accounts, PIN on shared phones, staff guard on every route, count approvals |
| a934521 | Beginner's guide |
| 0ec68b3 | **S8a** Reports and money: derived bills, Record payment / set-off, balances, oldest unpaid, performance, GST clock, CSV |
| ff628ea | **S8b** Orders ↔ goods: deliveries as movements, auto-delivered, returns, Send material, order prices in bills, history in search, work profile, qty_done migration |
| 1018c9c | **S9** Offline outbox + "Last updated", retry idempotency, all Goods strings in 7 more languages, bundle budget, accessibility pass |
| fdde598 | **Phase 7** Scenarios A and B seeded and run end to end from 15 demo accounts; independent audit; 9 fixes + minor; design-token docs |
| 718ce85 | **Load test**: 10 new businesses, 1/10/20 concurrent workers |
| 2e3e16f | **Bug hunt**: 48 Goods defects + 18 logged marketplace bugs fixed, safe DB default, Out-with-others cap 200 → 1,000 |
| 6147c91 | **Stress test with Nexconn chat**: 30 concurrent connections over 20 users |

Code map:
- **Server:** `server/src/sc/*` (routes and ledger) and `server/src/staffGuard.ts`.
- **Shared domain core:** `shared/sc/*`.
- **Web:** `web/src/screens/goods/*` (screens), `web/src/lib/offline.ts`, `web/src/cards/ScCards.tsx` and `ClaireGoodsCards.tsx`.
- **Claire:** `server/src/sc/claire/*`.

## 4. Experiments and their results (details in `PROGRESS.md`)
- **Claire model tiers:**
  - Free OpenRouter model (ERNIE): 28/28 valid tool calls were correct, but 17 of 47 failed upstream.
  - Rule tier: 48/48.
  - Claude Haiku tier: unverified (no key).
- **Independent audits:**
  - **Phase 7:** 9 defects, all fixed; no regressions with the flag off.
  - **Bug hunt (22 Nov):** four parallel reviews, fixed as follows.
    - Ledger core: 17.
    - Money / orders / staff / links / Claire: 14.
    - Goods screens: 17.
    - Logged bugs: B1–B9, B11–B19 fixed; B10 open.
- **Load test (21 Nov):**
  - **Setup:** 10 test businesses, mixed reads and writes, no think time.
  - **Results:** about **10 req/s with 0 errors** at 10–20 workers; median 1–2 s. **Database-bound**: about 74 ms per Atlas round trip × 10–20 sequential queries per request. Server CPU stayed under 10 %.
  - A first run showed ~20 s stalls (likely the shared Atlas tier). A fix came out of it: simultaneous Received taps now answer "unchanged".
- **Nexconn SDK headless probe:** the web chat SDK (`@nexconn/chat` NCEngine) runs in Node with browser shims (`window`, `localStorage`, an `XMLHttpRequest` built on `fetch`). Connect takes ~1 s and a send ~0.2 s. The same user can hold several connections at once (multi-device).
- **Stress test with Nexconn (22 Nov):**
  - **Setup:** 30 workers over 20 users, 90 s, each with a real SDK connection plus the Goods HTTP mix.
  - **HTTP:** 8.4 req/s, **0 errors**, median 2.6 s.
  - **Chat:** **308 messages, 0 send failures, delivery median 317 ms**; ledger clean.
  - **Harness limit:** 4 of 30 workers crashed inside the SDK's protobuf decoder under Node ("pb decode error … Illegal buffer"; forcing `binaryType='arraybuffer'` didn't help). This is not an app fault.
- **Translations:**
  - All Goods strings (about 800 per language) were machine-translated into te, kn, ml, bn, or, mr and gu by parallel agents, with placeholders checked. **All ten languages, including ta/hi, still need native review.**

## 5. Accounts on the dev database (OTP `123456`, dev server only)
| Who | Phones |
|---|---|
| Original demo owners | Ravi Knit Fashions 9000000004 (main test user), Lakshmi Garments 9000000002 (Tamil), Sree Textiles 9000000003, Amit (buyer, Hindi) 9000000001 |
| Support agents | 9000000901–9000000903 |
| Staff | Created and removed by the smokes as needed (staff of Ravi, phone 96…); the old demo staff was Kavitha 9600000001, PIN 2468 |
| Scenario A (demo) | Velan Fabrics 9000001001, Kongu Dyeing 9000001002, Selvam Trims 9000001003, Annai Threads 9000001004, **Murali Garments 9000001005**, Priya Stitching 9000001006, Bharathi Stitching 9000001007, Kolkata Hosiery 9000001008, Chennai Retail 9000001009, Delhi Fashion Traders 9000001010 |
| Scenario B (demo) | **Nila Knitwear 9000002001**, Kumar Cutting 9000002002, Sakthi Stitching 9000002003, Ganga Tailoring 9000002004, Vel Garments 9000002005 |
| Load / stress test (not demo) | Load Test Unit 01–20: 9300000001–9300000020 |

Notes:
- **Demo data accumulates:** every smoke and scenario run adds records with fresh lot and style codes. There is no reset.
- **Ravi has hundreds of open jobs.**
- **Login screen:** the demo login list (`server/src/routes/misc.ts` `DEMO_PHONES`) is unchanged by design; log in by phone.

## 6. How to run and verify (local only)
Prerequisites:
- **Node 24:** `source ~/.nvm/nvm.sh && nvm use 24`. The shell default is Node 18, which can't run `tsx`.
- **Environment:** `server/.env` needs `MONGODB_URI` and the Nexconn and OpenRouter keys (the owner has them; never paste them in chat). Set `MONGODB_DB=nexconn_sc_dev` on the command line or in `.env`.

```bash
SC_ENABLED=1 MONGODB_DB=nexconn_sc_dev npm run dev
```
API on :8787, web on :5173 (proxies `/api`, `/uploads`, `/l/`).

- **Claude Code desktop preview:** `.claude/launch.json` has a `goods-dev` entry (`SC_ENABLED=1 MONGODB_DB=nexconn_sc_dev PORT=8787 npm run dev`).
  - **`PORT=8787` is required:** the preview tool exports `PORT=5173`, and the API would otherwise try to take the web port.
  - `.claude/` is untracked, so recreate the entry on a new machine.
- **Flag a business:** `MONGODB_DB=nexconn_sc_dev npm run sc:flag -w server -- <id|phone> on`.
- **Static checks:** `npm run lint` (typecheck + style lint), `npm test` (24 unit tests).
- **Smokes** (dev server running): `python3 scripts/sc-smoke-s{1,2,3,4,45,6,7,8a,8b,9}.py`, `scripts/sc-smoke-audit.py`, `scripts/sc-smoke-ledger.py`, `scripts/sc-smoke-money2.py`.
- **Scenarios end to end:** `python3 scripts/sc-demo-scenarios.py` (43 checks; re-runnable).
- **Claire:** `cd server && MONGODB_DB=nexconn_sc_dev SC_ENABLED=1 npx tsx src/sc/claire/smoke.mts`; fixtures with `npm run sc:claire-fixtures -w server` (`SC_LLM_OFF=1` = rules only).
- **Ledger:** `MONGODB_DB=nexconn_sc_dev npm run sc:verify -w server`. Every event balances and every holding equals its postings; expected result: 0 problems.
- **Build checks:** `npm run build -w web`, then `npm run sc:budget` (largest Goods route about 42 KB gzipped of 150 KB), then `npm run i18n:check -- all` (100 %).
- **Load:** `python3 scripts/sc-load-test.py` (HTTP only, 1/10/20 workers) and `node scripts/sc-load-nexconn.mjs [workers=30] [seconds=90]` (with Nexconn chat).
- **Migration:** `npm run sc:migrate-orders -w server` (dry run; `--apply` writes; dev DBs only). It has **not** been run on production.

**Last full regression (22 Nov):**
- lint OK, 24/24 unit tests;
- all smokes pass, scenarios pass twice;
- Claire smoke passes;
- ledger 0 problems;
- build OK, budget OK, i18n 14/14.

## 7. What is left (open items)
- **Bugs still open:**
  - **B10** (marketplace): a Trade Desk agent sees no chat history from before joining. It needs a Nexconn server-side history API or the late-joiner history setting.
  - After a Trade Desk ticket resolves, the order card in chat still shows the dispute line, because it isn't re-posted.
  - The desk-only labels "Short delivery" and "Late delivery" are English.
- **Not built (from the plan):**
  - The **Flow view** (S9 in `03-product-ux.md`).
  - A nightly demo reset.
  - A service worker (cold start offline).
  - Record payment replacing the legacy order advance/balance buttons.
  - Closed days and per-receipt rate overrides.
  - Due reminders, and bill share/PDF.
  - The onboarding "What work do you do?" step (only the Goods home card exists).
  - Search ranking by declared work.
  - A 4× CPU-throttled device pass.
- **Performance:** about 10 req/s is a database round-trip limit. To speed it up:
  - host the API in the same region as Atlas;
  - check the Atlas tier;
  - batch sequential queries in Coming in, confirm, send and bills.
- **Owner decisions:**
  - native review of strings in all languages;
  - adding `ANTHROPIC_API_KEY` and verifying the Haiku tier (`SC_CLAIRE_PAID=1 SC_TIER=haiku npm run sc:claire-fixtures -w server`, about $0.01);
  - creating the T8 test cluster;
  - merging to `main`, deploying, enabling the flag for real users, and running the `qty_done` migration on production.

## 8. Gotchas learned the hard way
- **Records and orders:**
  - Records to a business are hidden from it for 10 minutes (the undo window). Smokes call `POST /api/sc/movements/:id/share-now` before the other side acts.
  - Order delivery and the statement link ignore records still in that window. The card job (every 30 s, plus share-now) re-checks when the window closes.
  - Write handlers are plain functions (`sendForWork`, `gotBack`, `recordTrade` return `{status, body}`), so Claire drafts, statement accepts and order routes share one write path.
  - The draft id is the client id, which makes saves idempotent.
- **Dev server and tooling:**
  - The dev server hot-reloads on every server file save. Agents editing server code in parallel make smokes fail with "connection refused": wait, then re-run.
  - The preview server is stopped when the session pauses for a usage limit. Restart it with `preview_start goods-dev`.
  - Lists must batch reads: bills once took 31 s from per-job lookups.
  - Smokes asserting "more than is there" must compute it from current stock, because repeated runs pile stock up.
  - In-app browser screenshots of open sheets can be stale; check the DOM.
  - The Nexconn SDK under Node needs the shims in `scripts/sc-load-nexconn.mjs`.
- **Usage limits:** spawning several parallel agents can use the whole 5-hour window. Agents stopped by a limit keep their work; resume them with SendMessage rather than restarting.
- **Rule from the previous account:** when usage nears ~95 %, push everything and write a handover (this file).
