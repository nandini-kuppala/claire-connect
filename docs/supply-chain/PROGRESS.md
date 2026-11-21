# Supply-chain feature — progress log

Governing brief: `docs/supply-chain/BRIEF.md` (re-read at the start of every phase and after any context compaction).

## Current phase
**Phase 6 — slice 0 done; next slice 0.5 (setup data)** on local branch `supply-chain`. Phase 0 done: `00-current-state.md`.

## Phase status
| Phase | Doc | Status |
|---|---|---|
| 0 Current state | `00-current-state.md` | Done 2026-11-20 |
| 1 Domain research | `01-domain-research.md`, raw notes in `research/` | Done 2026-11-20, red-teamed, **approved** (all 13 defaults) |
| 2 Domain model | `02-domain-model.md` (v3.1), `walkthroughs/` | Done 2026-11-21, three review rounds, **approved** (D1–D8 defaults) |
| 3 Product & UX | `03-product-ux.md`, `ui-principles.md`, `mockups/` (16 screens) | Done 2026-11-21, rendered at 375/1280 px en+ta, red-teamed, **approved** (U1–U9 defaults) |
| 4 Technical design | `04-technical-design.md` | Done 2026-11-21, model check run, red-teamed, **approved** (T1–T9 defaults) |
| 5 Build plan | `05-build-plan.md` (v2) | Done 2026-11-21, red-teamed, **approved** (B1–B3 defaults) |
| 6 Implementation | slices on branch `supply-chain` | Slice 0 done 2026-11-21 |
| 7 Final verification | | Not started |

## Decisions made
- 2026-11-20: Docs live in `docs/supply-chain/`. Raw research notes per topic in `docs/supply-chain/research/`.
- 2026-11-20: Did **not** run the server locally: local `.env` points at the production Atlas db `nexconn` and the production Nexconn app. Needs an isolated dev db before any run (open question).

- 2026-11-20: Local runs use an **isolated db** `MONGODB_DB=nexconn_sc_dev` (auto-seeded). Start with `MONGODB_DB=nexconn_sc_dev npm run dev` from a shell (the app's preview launcher can't read ~/Desktop). `.claude/launch.json` holds the same commands.
- 2026-11-20: User direction: **web only; Flutter on hold.** Verify by smoke test + live multi-user browser sessions on separate origins (localhost / 127.0.0.1 / [::1]).
- 2026-11-20: Existing web app tested: smoke 25/25 pass; 4 live conversation types; 19 findings in `docs/web-test-report-2026-11-20.md` (B1 high: offer qty defaults to 100). Not fixed yet (awaiting go-ahead).
- 2026-11-20: User chose "log only" for the web test findings; bugs are not being fixed now.
- 2026-11-20: Phase 1 research complete: six notes in `research/`, synthesis in `01-domain-research.md` (17 added scenarios C–S, red-team of §4 insights, recommendations for 12 decisions). ITC-04 frequency conflict between notes resolved in favour of `job-work-gst.md` (annual/half-yearly since Oct 2021).
- 2026-11-20: Phase 1 red team: 24 findings (6 high), all applied; scenarios now A–AD (30). Key changes: custody relations, staff identity in v1, real phone verification before record linking, statement link per counterparty, conserve per input line.

- 2026-11-20: **Phase 1 checkpoint: user approved all 13 recommended defaults** in `01-domain-research.md` §9 — generic model, polished fabric→cut→stitch→pack→dispatch + dyeing first; optional rates + computed job bill, no payments; record DC no. + photo, printable DC only on a dedicated series; in-app + user-sent wa.me links; create-only offline outbox; standing per-counterparty statement link with confirm/propose-return; no supply-chain code for the 22 Nov hackathon; capabilities derived from sells/buys; dev db nexconn_sc_dev; Claire model verified in Phase 4; minimal staff identity in v1; proceed on research defaults if no field calls; real phone verification before record linking.

- 2026-11-21: Phase 2: model v1 walked through all 30 scenarios by 4 independent verifiers (`walkthroughs/`), ~110 gaps; model rewritten as v2 with every accepted fix mapped in `02-domain-model.md` §14 (4 deferred). Key v2 additions: EXTERNAL source/sink, estimated consumption at each output, received-basis rule (P6), regrade, hop vs subcontract + disclosure + roll-up, field-level price privacy, versioned assertions, settlements (record-only), GST clock on custody not job. Red team of v2 running.

- 2026-11-21: Red team of v2: 28 findings → v3 (job owner vs client, read-time pending, terms snapshot, closure blocked during disputes, per-line/role privacy, respec/correct_line/casualty, one money ledger, v1 vocabulary §3.10). Final consistency check of v3: conservation holds for F/K/U; 13 wording issues fixed in v3.1.

- 2026-11-21: **Phase 2 checkpoint: user approved D1–D8 defaults** (`02-domain-model.md` §15): record-only settlements (cash/UPI/NEFT/advance/set-off, no collection); sub-contract roll-up shown as "with S1" by default, sub-contractor disclosed only for GST-registered owners; record linking needs the recorder's explicit yes; 10-min undo before the counterparty sees a movement; staff count variance > 5 pcs / 2 kg needs owner approval; the v1 vocabulary of §3.10; GST 1-year clock treats in-norm loss as returned (CA to confirm); one user in two businesses deferred past v1.

- 2026-11-21: Phase 3: UI research (`research/ui-research.md`) → `ui-principles.md`; design in `03-product-ux.md` (9 personas, 17 journeys, IA with a Goods tab, 18 screens, Claire design, 14 analytics views each with its question, localization plan); 16 static mockups in `mockups/` on one shared dataset (`mockups/DATA.md`, also the Phase 7 seed basis). Mockup builders + consistency pass fixed ~25 data/spec contradictions; render critique fixed layout issues; red team 30 findings (14 high), all addressed (§15). Key changes: in-house "Made here" jobs, separate Goods conversation per pair (staff-safe), one rate-visibility rule, ×10 voice check, link self-confirm blocked, transit/LR, fixed performance yardsticks, offline confirmations.
- Mockups are served for review with `python3 -m http.server 8790 --bind 127.0.0.1` from `docs/supply-chain/mockups` (add `?lang=ta` or `?lang=hi`).

- 2026-11-21: **Phase 3 checkpoint: user approved U1–U9 defaults** (`03-product-ux.md` §14): nav Home · Chats · Goods · Orders · Profile (Store into Profile/Home); wide desktop for Goods/party/reports/flow + keyboard-first receive/return; one personal Claire thread with data tools (deal-room Claire separate); tab name Goods/சரக்கு/माल (field-test vs ஸ்டாக்); Goods conversation per business pair (staff-safe, no prices); Claire morning summary off by default; DC photo as evidence only until OCR proves itself; in-house "Made here" jobs in v1; performance judged on promise/template/best unit.

- 2026-11-21: Phase 4: tool-calling check of the configured OpenRouter models (`research/llm-toolcall-check.mjs`, results json): Nemotron blocked for this key (6/6 404), ERNIE 6/6 correct, Ling 2/2 correct but 4/6 HTTP 429, Gemma 6/6 HTTP 429. → Claire design = one call that picks a tool + templated answers; optional Haiku 5.5 tier (~$0.0003/question, $1/day cap). Design: event log + postings + materialized holdings in one Mongo transaction, `sc_` collections, prices in a separate collection, pure domain core in `shared/sc/`, Goods conversation per pair. Red team 29 findings (13 high), all accepted (04 §16). Build plan v2: 13 slices, ~9–11 weeks, every scenario assigned.

- 2026-11-21: **Phases 4+5 checkpoint: user approved T1–T9 and B1–B3 defaults**: Haiku 5.5 paid fallback for Claire ($1/day cap; re-verify on the 7-tool schema in slice 5 first); one-call tool picking + templated answers; event log + postings + materialized holdings; node:test; GridFS photos with caps; per-person staff login + optional PIN; local branch, nothing pushed/merged/deployed without asking; separate free Atlas test cluster (user to create; until then pure tests only and integration tests after the deadline); object storage before real users; slice order, demo stops after S1/S2/S4.5/S5; ~9–11 weeks accepted.

## Slice reports
### Slice 0 — Foundations (2026-11-21)
- **Built:**
  - `shared/sc/` pure domain core: types, units, postings (Σ = 0 per dimension), tolerance, evidence, conservation (closure split, read-time approx pending), plausibility (unit slip, ×10, never-negative), dates (IST, working days, closed days, lateness), vocab (v1 actions → purposes), mask (sub-contract key-level grouping).
  - `server/src/sc/`: the flag, Ctx and `requireSc`/`requireOwner`; `repo.post()` (one Mongo transaction: event + postings + materialized holdings; idempotent on `client_id`; never-negative aborts the whole write); `positions()`; indexes; 16 material + 13 process built-in templates; `/api/sc/home|goods|templates`; the `sc:flag` dev CLI.
  - Web: Goods tab (nav U1) and lazy `/goods` route behind `features.supplyChain`, with tabs and the first-run guide in en/ta/hi.
  - `.nvmrc` 24, `npm test`, `npm run lint` (`scripts/sc-lint.mjs`), `glossary.md`. `BUILD_CONTRACT.md` updated.
- **Checks:**
  - typecheck + lint green; 12/12 domain tests incl. a 200-seed property test (Σ = 0, holdings = postings, never negative); the J-0412 figures reproduce (≈ 95 kg grey / ≈ 89 kg navy).
  - Against Atlas (`nexconn_sc_dev`): idempotent retry, overdraw refused with no partial write, positions read; smoke data removed afterwards.
  - API: flagged Ravi 200; unflagged Lakshmi 404 (and `features.supplyChain:false`); no auth 401.
  - Build: Goods chunk 3.2 KB gz, lazy; main bundle unchanged (407.6 KB gz).
  - Browser at 375 px in ta and en.
- **Not done here (by plan):** integration tests on a separate cluster (T8, waiting); the desktop wide layout (slice 3).
- **Local dev now runs with** `SC_ENABLED=1 MONGODB_DB=nexconn_sc_dev npm run dev`, with Ravi (`b_ravi`) flagged in the dev database only.

## Open questions
- T8: a separate free Atlas cluster for integration tests needs to be created by the user (not blocking slice 0's pure tests).

## Next
Slice 0 (Foundations), then slice 0.5 (setup data), then slice 1 — demo stop after slice 1.
