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
| 8a | see `git log` | Reports and money: derived bills, record payment / set-off, balances and oldest unpaid, performance, GST clock, CSV |

## Slice 7 (staff): done
Server, web, the 34-check smoke (`scripts/sc-smoke-s7.py`) and a browser pass are all complete; see the slice 7 report in `PROGRESS.md`. The demo staff user on the dev DB is **Kavitha, 9600000001, PIN 2468**, staff of Ravi.

## Slice 8a (reports and money): done
Server `sc/money.ts`, web `ReportsScreen` / `BillScreen`, the 27-check smoke (`scripts/sc-smoke-s8a.py`) and a browser pass; see the slice 8a report in `PROGRESS.md` for its known gaps (closed days, rate override, due reminders, bill share).

## After slice 8a (from `05-build-plan.md`)
- **8b** orders ↔ goods (job-work orders, deliveries)
- **9** flow view
- Then Phase 7 (field test, polish).

Demo stops agreed: after S1, S2, S4.5 and S5 (all passed).

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
  - smokes `python3 scripts/sc-smoke-s{1,2,3,4,45,6,7,8a}.py` (dev server running);
  - `cd server && MONGODB_DB=nexconn_sc_dev SC_ENABLED=1 npx tsx src/sc/claire/smoke.mts`;
  - `MONGODB_DB=nexconn_sc_dev npm run sc:verify -w server` (ledger: every event balances, every holding equals its postings);
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
