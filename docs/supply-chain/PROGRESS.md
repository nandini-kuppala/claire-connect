# Supply-chain feature — progress log

Governing brief: `docs/supply-chain/BRIEF.md` (re-read at the start of every phase and after any context compaction).

## Current phase
**Phase 6 — slices 0, 0.5, 1 and 2 done. DEMO STOP after slice 2 (B2): waiting for the user's go-ahead to continue with slice 3** (job workers, forwarding, size grid) on local branch `supply-chain`. Phase 0 done: `00-current-state.md`.

## Phase status
| Phase | Doc | Status |
|---|---|---|
| 0 Current state | `00-current-state.md` | Done 2026-11-20 |
| 1 Domain research | `01-domain-research.md`, raw notes in `research/` | Done 2026-11-20, red-teamed, **approved** (all 13 defaults) |
| 2 Domain model | `02-domain-model.md` (v3.1), `walkthroughs/` | Done 2026-11-21, three review rounds, **approved** (D1–D8 defaults) |
| 3 Product & UX | `03-product-ux.md`, `ui-principles.md`, `mockups/` (16 screens) | Done 2026-11-21, rendered at 375/1280 px en+ta, red-teamed, **approved** (U1–U9 defaults) |
| 4 Technical design | `04-technical-design.md` | Done 2026-11-21, model check run, red-teamed, **approved** (T1–T9 defaults) |
| 5 Build plan | `05-build-plan.md` (v2) | Done 2026-11-21, red-teamed, **approved** (B1–B3 defaults) |
| 6 Implementation | slices on branch `supply-chain` | Slices 0, 0.5, 1, 2 done 2026-11-21 — demo stop |
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

### Slice 0.5 — Setup data (2026-11-21)
- **Built:**
  - Server (`server/src/sc/setup.ts`, mounted behind the same auth + flag check):
    - contacts, with name forms in en/ta/hi via Sarvam transliteration (best-effort, 3 s timeout) and duplicate-phone refusal;
    - the party picker (my contacts + businesses I trade with + name search; never another business's contacts);
    - places (owner);
    - content-addressed specs (`shared/sc/specs.ts` normalisation; same fabric typed two ways = one spec), aliases and recent specs;
    - terms per party (defaults: weighing loss borne by the owner, bill on received, ±1.5 % / 0);
    - effective-dated rate cards (owner; a newer card closes the previous one);
    - process offerings; capabilities derived from sells/buys + role label, confirmed once.
  - Web: **Goods → Setup** with people you work with (add contact), your places, what your unit does (capability chips, owner confirms), your materials (aliases); the **material picker sheet** (your names, recent, new material → kind → details, required first) for slice 1.
  - Material templates now ordered (fabric, yarn, components, garments, trims, other).
- **Checks:**
  - typecheck + lint green; 15/15 tests (spec identity and validation, capability derivation added).
  - API exercised against the dev database (contact create + duplicate refused, picker search, spec resolve twice = same id, incomplete spec names its missing fields, alias search).
  - Browser at 375 px in Tamil (setup screen, picker kinds list, fabric details form).
- **Findings:**
  - Sarvam transliteration is lossy ("நொய்யல்" → "Neel"), so Claire's party matching must be fuzzy across scripts (already in 04 §9.2). Stored name forms are search aids only.
  - "Noyyal Dyeing" now exists both as Ravi's contact and as a platform business in the dev database. That is the case contact linking (slice 6) handles; the demo seed (Phase 7) will decide which one Ravi uses.
- **Deferred by plan:**
  - the terms and rate editors' UI → the party ledger in slice 1;
  - the process-offerings editor → slice 3 (job workers);
  - Tamil/Hindi labels for material choice values (grey, rfd, single jersey…) → slice 1, with the glossary.

### Slice 1 — Out with others, single-player (2026-11-21)
- **Built:**
  - **Server** (`server/src/sc/records.ts`, `views.ts`):
    - **Send for work** to an off-platform contact: lines with units and lots, an optional "They told me they got" figure, and DC no.
    - **Owner-only rate**, kept in `sc_prices`.
    - **Expected date** from the process turnaround in working days.
    - **Never-negative**: 409 with the stock available, and an owner override with a reason that posts from `EXTERNAL(self)`.
    - **Got back from work**: output = the performer's figure if given, else what came back (P6). A weighing difference within tolerance → `LOSS(weighing_difference)` borne per terms; beyond → an open discrepancy. "As sent (unprocessed)" returns. Last / more coming.
    - **The receiver's figure later**: supersession with reversal and resettlement.
    - **Undo** within 10 min: reverses all of the movement's postings, and is refused once goods came back.
    - **Read views**: read-time approx pending (P7); Out with others grouped by party, late first; Coming in; In my unit; party ledger; job detail with a default output spec.
  - **Web**: Goods lists, the Record sheet, the **Send for work** form (party picker with inline new contact, work chips, material picker, qty + unit chips, lot, their figure, expected date, DC, owner rate, short-stock sheet), the **Got back** form (live balance strip from the shared core, grade, rolls, their figure, unprocessed, completion question), the **party ledger** (open jobs, history with Undo, terms with the owner's editor), and the Undo toast. `formatQty` now drops trailing zeros (1.4 kg).
- **Checks:**
  - typecheck + lint green; 15/15 tests.
  - **API walkthrough of J-0412** (`scripts/sc-smoke-s1.py`, dev server only) reproduces the dataset: 0.7 % weighing difference within tolerance; ≈ 95.4 kg grey / ≈ 88.7 kg navy after 96 kg back; the last 92 kg (Noyyal said 93) → 1 kg weighing difference and dyeing loss 4.8 % vs the usual 7 %. Also: duplicate retry, undo, wrong-unit refusal.
  - **Browser at 375 px** (en, ta): send flow incl. the short-stock sheet and Undo toast, ledger, Got back with the strip, Coming in, Out with others in Tamil.
- **Fixed during the browser check:**
  - "loss so far 51.7 %" was shown while goods were still at the dyer; loss now shows only when nothing is estimated to be left;
  - "about" only on estimates;
  - "1 places";
  - the ledger header says "Your contact";
  - the Got back output material defaults to what this unit last returned for the same work.
- **Known gaps:**
  - material names are English-only;
  - the Work chips list all 13 processes (should show the party's and recent ones first);
  - DC photo upload moved to slice 2;
  - Undo uses a repeat icon;
  - desktop wide layout is slice 3;
  - integration tests wait for T8.

### Slice 2 — Two-sided records and disputes (2026-11-21)
- **Built:**
  - **Server:**
    - `ledgerOps.ts`: shared receipt and sender-figure supersession, settlement, and discrepancy docs that carry their posting context.
    - Sends and returns with businesses on CLAIRE: shared record, per-line viewers, `visible_at` on the movement and its in-transit holdings.
    - Receiver **confirm / different number**, appended without a version check; a repeat confirm is a no-op.
    - The performer's **sender figure** on returns the owner recorded (P6: output and dispatch re-posted).
    - **Receiver-first** entries: unmatched held rows visible only to the recorder, matched when the sender's record becomes visible.
    - **Share now**; **Undo** refused once the other side acted.
    - **Disputes** (`disputes.ts`): four absolute outcomes, each with one posting set (short → loss, short-shipped or gain; over → found-pending); conceding or one-sided settles at once; propose/accept; Trade Desk ticket with no conversation attached.
    - **Goods conversation per pair** + `movement`/`dispute` cards via a leased, idempotent outbox and a 30 s ticker; deal auto-reply and tips skip goods conversations.
    - **DC photos**: GridFS, capped, signed 10-minute URLs, shared with both parties of the movement.
    - **`npm run sc:verify`**: every event balances per dimension and every holding equals its postings.
  - **Web:**
    - Movement and dispute **cards** that render the reader's side (Check and confirm / All correct / Different number), newest per id.
    - The Goods conversation reuses the deal chat (no offers, quick replies or deal strip; an "Open Goods" strip).
    - **Record screen** (confirm or give your figure per line, photos); **dispute screen** (two figures, allowance, four outcomes labelled from your side with their effect, proposal + Accept, Trade Desk).
    - Coming in: **To check and confirm** and **Waiting for them to record it**; clickable chips (late, to confirm, disputes sheet).
    - **Received for work** form; the party picker now takes businesses; ledger **badges** (Confirmed by X / by you / Check and confirm / Not confirmed + why); **Share now** in the toast; DC photo capture with on-phone compression.
- **Checks:**
  - typecheck + lint green; 16/16 unit tests.
  - **`scripts/sc-smoke-s2.py`: 25/25 checks** on the dev server: hidden during the undo window; Share now; no price fields for the receiver; a third business gets 404 on the movement and dispute; to-confirm chip; 598/600 counted → dispute; undo refused after the receiver acted; split proposed then accepted → issued 599; 297/300 kg within tolerance; repeat confirm no-op; badges both sides; receiver-first matched on visibility and never shown to the owner; sender figure 592 vs 590 → dispute → conceded → output 592.
  - The slice 1 walkthrough still passes; `sc:verify` 0 problems.
  - **Browser** with two origins (Ravi, Lakshmi in Tamil): the Goods conversation in Lakshmi's inbox, Tamil cards, Different number → dispute screen, her proposal, Ravi accepts → settled.
  - Photos: upload 201, signed GET 200, tampered 403, no login 401.
- **Decisions in implementation:**
  - Cards are **untargeted, one payload for both sides**, with the side worked out on the device (04 §8.3 fallback chosen up front), so no reliance on Nexconn persisting targeted messages.
  - DC photos are shared with both businesses of the movement.
- **Fixed during checks:**
  - raw ISO dates on cards;
  - style codes and sizes now in capitals, and piece goods say what they are ("Navy RKF-P22 M · Cut kits");
  - a shorter Goods strip text.
- **Known gaps:**
  - the job worker's own views (Others' goods, Send back, Forward) are slice 3, so in slice 2 Lakshmi confirms from chat and Coming in;
  - transporter / LR and the transit-claim outcome come with the Sent-through field in slice 4.5;
  - integration tests still wait for T8.

## Open questions
- T8: a separate free Atlas cluster for integration tests needs to be created by the user (not blocking slice 0's pure tests).

## Next
Slice 0 (Foundations), then slice 0.5 (setup data), then slice 1 — demo stop after slice 1.
