# Supply-chain feature — handover (21 Nov 2026)

Read this first in a new session, then `PROGRESS.md` (a report per slice), `BUILD_CONTRACT.md` (every route) and `BRIEF.md` (the governing brief).

## Where things stand
- **Branch:** `supply-chain`, pushed to `origin` (GitHub `nandini-kuppala/claire-connect`). **Nothing is merged to `main`**: the brief says not before the hackathon deadline (22 Nov 23:59 IST), and never without the owner's say-so.
- **Feature flag:** everything is behind `SC_ENABLED=1` plus `businesses.flags.sc === true` per business. Production is untouched.
- **Slices done and committed** (each has a report in `PROGRESS.md`):

| Slice | Commit | What |
|---|---|---|
| 0 | 4e049ed | Domain core, transactional ledger (events + postings + holdings), flag, Goods tab |
| 0.5 | d4330ed | Contacts, places, specs, terms, rates, setup screen |
| 1 | e327bd2 / c989028 | Send for work, got back, Out with others, party ledger |
| 2 | a7541af | Two-sided records, disputes, the Goods conversation and cards |
| 3 | 1d41e8d | Job workers (Others' goods), forwarding (sub-contract / hop), size grid, desktop layout |
| 4 | 01fdb2c | Made here (cut, pack, check, sets), job detail, closing / reopening, late figures |
| 4.5 | 3f95171 | Buy / sell / returns / samples / move, sale in place, stock corrections, casualty |
| 5 | ab6a656 | Personal Claire: tools, model chain, cross-script names, answers, record drafts |
| 6 | 9ecc75e | Statement links (`/l/:token`), WhatsApp share, contact linking (`link_rekey`) |
| 7 | 20c3b64 | Staff: provisioning, PIN, staff guard on every route, count approvals, suggestions |
| 8a | 0ec68b3 | Reports and money: derived bills, record payment / set-off, balances and oldest unpaid, performance, GST clock, CSV |
| 8b | ff628ea | Orders ↔ goods: deliveries as movements, auto-delivered, returns, Send material, order prices in Bills, history in search, work profile, migration |
| 9 | 1018c9c | Offline outbox + Last updated, retry idempotency, all Goods strings in 7 more languages, bundle budget, accessibility pass |
| Phase 7 | see `git log` | Scenarios A and B seeded and run end to end from 15 demo accounts; independent audit; 9 fixes + minor; design token docs |

## Slice 7 (staff): done
Server, web, the 34-check smoke (`scripts/sc-smoke-s7.py`) and a browser pass are all complete; see the slice 7 report in `PROGRESS.md`. The demo staff user on the dev DB is **Kavitha, 9600000001, PIN 2468**, staff of Ravi.

## Slice 8a (reports and money): done
Server `sc/money.ts`, web `ReportsScreen` / `BillScreen`, the 27-check smoke (`scripts/sc-smoke-s8a.py`) and a browser pass; see the slice 8a report in `PROGRESS.md` for its known gaps (closed days, rate override, due reminders, bill share).

## Slice 8b (orders ↔ goods): done
Server `sc/orders.ts`, web `OrderGoodsScreen` (+ Orders line, chat card link, work card, history in search), the 34-check smoke (`scripts/sc-smoke-s8b.py`) and a browser pass; gaps in the slice 8b report in `PROGRESS.md`. The qty_done migration (`npm run sc:migrate-orders -w server`, dry run by default) has **not** been run on production; that's the owner's call at deploy time.

## Slice 9 (offline, translations, polish): done
See the slice 9 report in `PROGRESS.md` (gaps: no CPU-throttled pass, no service worker, overlay translations need native review).

## Phase 7: done
See the Phase 7 report in `PROGRESS.md`.
- **Demo accounts** (dev DB, OTP 123456), Scenario A:
  - Velan Fabrics 9000001001, Kongu Dyeing 9000001002;
  - Selvam Trims 9000001003, Annai Threads 9000001004;
  - **Murali Garments 9000001005** (the garment maker);
  - Priya Stitching 9000001006, Bharathi Stitching 9000001007;
  - sellers Kolkata Hosiery 9000001008, Chennai Retail 9000001009, Delhi Fashion Traders 9000001010.
- Scenario B:
  - **Nila Knitwear 9000002001**, Kumar Cutting 9000002002;
  - Sakthi Stitching 9000002003, Ganga Tailoring 9000002004, Vel Garments 9000002005.
- Re-seed or replay with `python3 scripts/sc-demo-scenarios.py` (dev server running). Each run adds a fresh set of records with its own lot codes.

## What is left
- **Flow view** (S9 in `03-product-ux.md`): the one-screen view of a whole order or run.
- **Nightly demo reset;** the demo businesses on the login demo list.
- Service worker (cold start offline); a 4× CPU-throttled pass on a real device.
- The gaps listed per slice in `PROGRESS.md` (e.g. Record payment replacing order milestone buttons, closed days, bill share).

## Open items needing the owner
- **Claude Haiku tier for personal Claire is off.** `ANTHROPIC_API_KEY` in `server/.env` is empty, and it's not in `render.yaml`. To enable it:
  1. Add the key yourself; never paste it into chat.
  2. Run `cd server && SC_CLAIRE_PAID=1 SC_TIER=haiku MONGODB_DB=nexconn_sc_dev npm run sc:claire-fixtures` (about $0.01).
  3. If it passes, set `SC_CLAIRE_PAID=1` (and in the Render dashboard for deploys).
- **T8:** a separate Atlas test cluster for integration tests (not created).
- Tamil/Hindi strings are all *to verify* by a native speaker (`glossary.md`).
- Turning the flag on for real users, any deploy, and any merge to `main` need the owner's approval.

## How to run (local, dev database only)
```bash
source ~/.nvm/nvm.sh && nvm use 24          # the shell default is Node 18, which can't run tsx
SC_ENABLED=1 MONGODB_DB=nexconn_sc_dev npm run dev   # API :8787, web :5173 (proxies /api, /uploads, /l/)
```
- Demo logins (OTP `123456`): Ravi `9000000004`, Lakshmi `9000000002`, Sree `9000000003` (all flagged in the dev DB).
- Flag a business: `MONGODB_DB=nexconn_sc_dev npm run sc:flag -w server -- <id|phone> on` (refuses non-dev DBs).
- Checks:
  - `npm run lint` (typecheck + `scripts/sc-lint.mjs`); `npm test` (24 unit tests);
  - smokes `python3 scripts/sc-smoke-s{1,2,3,4,45,6,7,8a,8b,9}.py` and `python3 scripts/sc-smoke-audit.py`; the scenarios `python3 scripts/sc-demo-scenarios.py` (dev server running);
  - `cd server && MONGODB_DB=nexconn_sc_dev SC_ENABLED=1 npx tsx src/sc/claire/smoke.mts`;
  - `MONGODB_DB=nexconn_sc_dev npm run sc:verify -w server` (ledger: every event balances, every holding equals its postings);
  - `npm run sc:budget` (after a build) and `npm run i18n:check -- all`;
  - Claire fixtures: `npm run sc:claire-fixtures -w server` (`SC_LLM_OFF=1` = rules only).

## Rules that still apply (from the brief)
- Never commit secrets or `.env`; secrets live only in `server/.env` and the Render dashboard.
- Do not push to `main`, deploy, or touch production data without asking. Local dev always uses `MONGODB_DB=nexconn_sc_dev`, never `nexconn`.
- Commit per slice; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- UI: no lucide, no blue, no gradients, no emoji (`sc-lint`). Every status is text + colour + icon. Tamil at 375 px must not truncate.

## Gotchas found along the way
- **Records:**
  - Records to a business are hidden from it for 10 minutes (undo window) unless `share-now` is called. Smokes call it before the other side acts.
  - Write handlers are plain functions (`sendForWork`, `gotBack`, `recordTrade` return `{status, body}`), so Claire drafts and statement accepts use the same write path. The draft id is the client id, which makes saves idempotent.
- **Browser and tooling:**
  - In-app browser screenshots of open bottom sheets can be stale; check the DOM, or use a zoom capture.
  - The dev DB has lots of smoke data (e.g. 41 open jobs Ravi → Lakshmi). Answers and pages cap their lists, and anything that loops over jobs must batch its reads: bills took 31 s before batching.
  - Smokes that assert "more than is there" must compute it from current stock; repeated runs pile stock up.
  - The free OpenRouter model (ERNIE) picks tools well but fails upstream about a third of the time; the rule tier backstops it.
