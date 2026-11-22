# Supply-chain feature — progress log

> **Start here: `HANDOVER.md`** (state, accounts, how to run, open items, experiments). This file is the dated report per slice.

Governing brief: `docs/supply-chain/BRIEF.md` (re-read at the start of every phase and after any context compaction).

## Current phase
**Phase 6 — slices 0 to 7 done. Next: slice 8a (reports and money). The Haiku tier of personal Claire is still off until `ANTHROPIC_API_KEY` is set and verified (slice 5).** Work stays on branch `supply-chain` (pushed; not merged to main). `HANDOVER.md` and `BEGINNER-GUIDE.md` sit next to this file.

## Phase status
| Phase | Doc | Status |
|---|---|---|
| 0 Current state | `00-current-state.md` | Done 2026-11-20 |
| 1 Domain research | `01-domain-research.md`, raw notes in `research/` | Done 2026-11-20, red-teamed, **approved** (all 13 defaults) |
| 2 Domain model | `02-domain-model.md` (v3.1), `walkthroughs/` | Done 2026-11-21, three review rounds, **approved** (D1–D8 defaults) |
| 3 Product & UX | `03-product-ux.md`, `ui-principles.md`, `mockups/` (16 screens) | Done 2026-11-21, rendered at 375/1280 px en+ta, red-teamed, **approved** (U1–U9 defaults) |
| 4 Technical design | `04-technical-design.md` | Done 2026-11-21, model check run, red-teamed, **approved** (T1–T9 defaults) |
| 5 Build plan | `05-build-plan.md` (v2) | Done 2026-11-21, red-teamed, **approved** (B1–B3 defaults) |
| 6 Implementation | slices on branch `supply-chain` | Slices 0–7 done 2026-11-21 |
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

### Slice 3 — Job workers, forwarding and the size grid (2026-11-21)
- **Built:**
  - **Server (`work.ts`, plus `setup.ts` and `views.ts`):**
    - **Others' goods**: the job worker's side, grouped by client; received, done here, sent back, sent on, still to work on, done but not sent back.
    - **Work done**, **Mark ready** and **Hold for dues**. Holding pauses the lateness clock, and the owner sees Ready / Held on Out with others.
    - **Send back to owner**: any shortfall becomes an implied output. Everything returned rolls up into the parent job.
    - **Forward**, in two forms:
      - **Sub-contract**: keeps `via`, so the owner still sees "with Lakshmi" and the sub-contractor sees "for Lakshmi". The owner is excluded from the record unless they are GST-registered (ITC-04 disclosure). The sub-contractor sees a plain name without style codes.
      - **Hop**: the owner's "Tell them to send it on". It drops `via`; the new unit works for the owner directly and sees the real style.
    - **Size × colour grid** (`POST /sc/specs/resolve-grid`) and **styles** with trims per piece (`GET/POST /sc/styles`; trims come back resolved).
    - Trims are secondary input lines and are left out of job counts.
  - **Web:**
    - **In my unit** has a Mine / Others' goods switch. Job workers with nothing out open on Others' goods.
    - **Work screen** with sheets for Work done, Send back and Forward. The forward sheet carries the disclosure and plain-name notes.
    - Desktop return table with Save returns; **Tell them to send it on** on the party ledger.
    - **Sizes and colours** sheet in Send for work, with trims added from the style (pieces × per piece × (1 + spare %), rounded up) and a **lot-mixing warning**.
    - **Styles** and **Work you take** (process offerings) in Setup.
    - **Desktop layout at ≥ 1024 px** (`AppShell variant="wide"`):
      - a labelled left rail instead of the bottom nav;
      - Record in the header and the toast in the corner;
      - Out with others as a table;
      - the party ledger in two panes (open + terms | history).
- **Checks:**
  - typecheck + lint green; 16/16 unit tests; web build OK (Goods chunk 7.6 KB gzipped).
  - **`scripts/sc-smoke-s3.py`: 34/34**, covering:
    - the grid and style trims (400 kits, not 1,624);
    - Others' goods, ready, and held for dues;
    - the disclosed forward: plain name for Sree, real style and "Receipt confirmed" for Ravi;
    - no Undo after the other side confirmed;
    - roll-up 220 → 120 → returned 280 with no double count;
    - **hop**: 60 kits leave Lakshmi's job, 60 with Sree, and Sree works for Ravi directly;
    - **undisclosed chain** Lakshmi → Sree → Ravi: Lakshmi gets 404, her history has no trace, she sees "with Sree", and Ravi sees "for Sree";
    - **principal vs principal** at one job worker.
  - s1 and s2 still pass; `sc:verify` 0 problems.
  - **Browser**:
    - Lakshmi in Tamil at 375 px: Others' goods, work screen, forward sheet with the disclosure note.
    - Ravi at 1280 px: rail, Out table, two-pane ledger.
    - Ravi at 375 px: the size grid in Tamil (S 100 + M 120 → 674 buttons).
- **Fixed during checks:**
  - The in-transit key carried `via`, so confirming a sub-contractor's return failed. Transit now sits with the carrier only.
  - The `wide` shell had no bottom nav; the header Record button showed on phones.
  - The owner of a disclosed hop was asked to "Check and confirm" a record they aren't party to. It now shows "Receipt confirmed" or "Not confirmed".
  - Undo was offered on records the other side had already confirmed.
  - The raw `a_forward` key showed in the ledger.
  - The owner and the forwarder saw the plain name. Lines now keep the real label, and only the sub-contractor sees `label_generic`; goods-chat cards, shared by both sides, use the plain name.
  - Hops weren't subtracted from the parent job. Forwarded jobs now record `sent_inputs` / `sent_outputs`.
- **Decisions in implementation:**
  - Disclosure to the owner = GST-registered owner or an owner-instructed hop.
  - Forwarding again from a sub-contract is refused (`nested`) for now.
  - Lot-mixing is a warning, never a block.
- **Known gaps:**
  - Sub-contracting work already done (e.g. outsourcing checking of stitched garments) isn't modelled; forwards are of kits/inputs. Slice 4, with Made here.
  - Bulk "Mark all ready" across principals is per client group, not across groups (batch UI is v1.1 per the plan).
  - Keyboard-first receive on desktop is only the return table.
  - Tamil/Hindi strings for slice 3 are still marked *to verify* (glossary).
  - Screenshots of open sheets in the in-app browser came back stale; sheets were verified through the DOM and zoomed captures instead.

### Slice 4 — Made here, job detail and closing (2026-11-21)
- **Built:**
  - **Closure plan (`shared/sc/conservation.ts` → `planClosure`)**, pure and unit-tested:
    - It splits every allocated(J) line into consumed = into output + loss + residual (model §5.2).
    - Rules per process kind:
      - mass-losing: loss prorated over lots, negative = gain;
      - count-preserving and assembling: outputs matched by size first; a top and a bottom each go into one set;
      - cutting: pieces × weight per set + waste, either sign;
      - unpacking: not checked;
      - trims: used up.
    - The phone's "Does it add up?" strip runs the same function.
  - **Server (`jobs.ts`):**
    - **Close**: one event that first takes leftovers out (kept and adjusted → the job worker's own, with a ₹ bill line; kept for the next job; scrapped), then posts the closure.
      - It asks first when pieces are missing, cutting is off by more than 2 %, or the loss is well above the norm.
      - It is blocked by open differences unless the owner chooses **close with the claim carried**.
    - **Reopen**: reverses the stored closure postings, with a dated reason.
    - **Late figures (04 §5.6.3)**: a receipt or sender figure on a closed job, or settling a carried claim, reopens the job, applies the change and closes it again (`withLateFigure`). If closing again fails, the job stays open with the reason.
    - **Stop this work (V)**: lateness stops and "Stopped" shows on Out. What comes back "as sent" now leaves the job on both sides; it previously didn't count as gone.
    - **Job detail**: conservation bar segments, outputs by spec × grade, sub-contract / hop / rework children, open differences, bill adjustments and a dated bill change, reopen history.
    - **Made here** (`POST /sc/made`): cut, pack, check, make sets and unpack as an in-house job, recorded and closed in one write. It uses a stock check with the owner override, plus a new **Waste** material type and in-house-only **Make sets / Unpack** processes.
    - **Smaller additions**:
      - `rework_of` on Send for work;
      - styles carry an optional weight per set;
      - movement detail links to its job for the owner or client;
      - undo is refused on a closed job.
  - **Web:**
    - **Job screen**:
      - stacked conservation bar with every segment named in text;
      - What came back / What went / Sent on / Bill / Changes;
      - **Got back** or **Close job** as the one action;
      - Reopen and Stop this work;
      - two panes at ≥ 1024 px.
    - **Close sheet**: "What happened to the rest?" per trim, the shortage / loss / cutting question, and close with the claim carried.
    - **Made here form**:
      - process chips;
      - taken from stock / what came out (size grid, grades for QC);
      - cut waste and the live check;
      - **Save and send for work** hands the kits to Send for work.
    - **Record sheet** has a Made here entry. The style editor has weight per set. Out shows **Stopped**. The party ledger and movement screen open the job.
- **Checks:**
  - typecheck + lint green; 21/21 unit tests (5 new closure tests).
  - **`scripts/sc-smoke-s4.py`: 32/32**, covering:
    - cut 100 kg → 400 sets + 7.5 kg waste → 0.5 kg unexplained; the stock check;
    - send / back / close-preview: shortage 10, buttons as a leftover candidate;
    - close asks first; Lakshmi can't close; closed with 24 buttons kept at ₹6 → ₹144 bill line and Lakshmi owns them; Sree gets 404;
    - reopen and close again;
    - Lakshmi's late sender figure (192) → automatic reopen, the difference carried, closed again; settling it → reopened and closed again: 392 good + 8 unaccounted;
    - pack, QC (1 unaccounted), make sets (2 + 2), unpack, Made here history;
    - stop → "as sent" back → nothing left → closes;
    - dyeing 300 → 280 kg closes at 6.7 %; 300 → 250 kg (16.7 %) needs a yes.
  - s1, s2 and s3 still pass; `sc:verify` 0 problems after every close and reopen.
  - **Browser** (Ravi, Tamil, 375 px):
    - Made here cut with the size grid: trims stay out, and the strip reads "50 kg → about 46 kg in 200 pieces + 3.5 kg waste → about 0.5 kg (1 %) unexplained".
    - Save and send → Send for work prefilled with S 100 / M 100 kits, with in-house-only processes hidden.
    - Job screen closed / open; the close sheet asks "7 pcs not accounted for at Lakshmi Garments".
    - 1280 px two-pane job screen.
- **Fixed during checks:**
  - Unprocessed returns weren't subtracted from "still there" for either side.
  - Re-saving a style without a weight erased it; an omitted weight now keeps it and the editor sends `null` to clear it.
  - "Record anyway" forgot "and send for work".
  - The bill list repeated struck-through lines per reopen; it now shows one dated "was ₹X, now ₹Y" line, only when it changed.
  - Lot codes broke at the hyphen; the desktop action bar overflowed.
- **Decisions in implementation:**
  - Closing and reopening are owner-role actions by the job's client.
  - Made here closes at once. In-house shortages are recorded without a question (they are your own) but shown on the strip before saving.
  - A shortage at a job worker is recorded against them (`RESIDUAL` attributed) only after the owner says yes. The two-sided shortage discrepancy with the job worker is not built; see known gaps.
- **Known gaps:**
  - **Shortage as a two-sided discrepancy** (the job worker accepts or disputes the missing pieces) and **leftovers "coming back"** (use Got back "as sent" instead) are not built.
  - **Bills** (rate × billable quantity, settlements) remain slice S14; slice 4 records only the leftover adjustments and the dated change.
  - The **rework chain** links and shows children, but there is no "Send for rework" button yet (Send for work accepts `rework_of` through the API).
  - "Kept for the next job" goods sit at the job worker as available stock; Out with others lists jobs only, so they don't show there yet.
  - Cancelled-and-closed jobs and in-house jobs are reached from the Made here history, movement and ledger links. There is no "Closed jobs" list yet.

### Slice 4.5 — The other record forms and adjustments (2026-11-21)
- **Built:**
  - **Server (`trade.ts`):** one `POST /sc/movements/trade` for eight kinds.
    - **Who records**: whoever has the goods.
    - **Outgoing** (sell, return to supplier, give or lend a sample, move between my places) draws from a picked stock row with the never-negative check and the owner override.
      - A business on CLAIRE confirms what arrived, and **title passes on its receipt**. `destOf` now carries `ownerAfter`; confirmations and dispute outcomes post the EXTERNAL pair.
      - Selling to someone not on CLAIRE closes the goods out of my books through EXTERNAL.
    - **Incoming** (buy, buyer returned) and **collect** are for parties not on CLAIRE. A business on CLAIRE gets `409 they_record`: it records its own sale and I confirm it, so nobody draws down a stock they can't see.
    - **In place**:
      - **N**: bought, kept at the seller (mine, at Sri Amman), then collected in parts.
      - Sold and kept for the buyer at my unit: the buyer's goods sit at my unit.
    - **AA**: sell my goods from a job worker's premises. **Z**: grade per line. **AD**: a lent sample stays mine at their unit; a given one is theirs once confirmed.
    - The rate is stored apart from the movement (owner only, never shown to the buyer). `GET /sc/stock` lists my goods at my unit and with others.
  - **Sale in place of allocated goods (04 §5.6.6)**: `POST /sc/jobs/:id/sell-part` splits off a child job (`split_from_job_id`).
    - The buyer is its owner and client; the performer is unchanged.
    - The parent's allocation shrinks, and every summary (owner, job worker, job detail) counts the sold share as gone.
    - The buyer sees only the child job and the sold lines. Undo cancels the child job.
  - **Adjustments (`adjust.ts`, model §3.6)**: change grade, change material (respec, same measure only, E2), change or split lot, found, write off (reason required), and count against the book.
    - Counts and found goods apply only at my own unit.
    - Respec, found and write off are owner-only.
  - **Casualty**: fire, theft or flood at my unit.
    - My own goods are written off.
    - Each other owner's goods move to `held(casualty)`, with **one difference per owner**. Under a sub-contract it is per client I work for, never the owner behind it.
    - A casualty difference blocks closing that owner's job. "Accept the loss" writes the goods off against the unit where it happened and records `casualty_lost` on the job, so "still there" drops. "Not lost" puts them back.
  - **Web:**
    - **Record sheet**: Went out (Send, Sell, Return to supplier, Give / Lend a sample, Move); Came in (Got back, Received for work, Buy, Buyer returned, Collect); Inside my unit (Made here, Correct stock, Fire / theft / flood).
    - **One trade form** for all eight kinds: party, pick from stock (one place at a time) or name the material, grade per line, "their bill says", kept-in-place toggle, give-back date for lent samples, DC no., owner-only rate, owner override with reason.
    - **Correct stock screen**: tap a row for count (live "3 pcs less than the book"), grade, lot, material, write off; Found goods; the fire / theft / flood sheet listing everything at my unit, with "for {name}" on others' goods.
    - **Job screen**: "Sell part of this", plus "sold where it is" and "lost" segments.
    - **Dispute screen** for a casualty: "Lost (flood) · 2 kg", Accept the loss / They were not lost.
    - The party ledger and chat cards name the new record types.
- **Checks:**
  - typecheck + lint green; 21/21 unit tests; build OK (new screens 3.4 KB and 3.9 KB gzipped).
  - **`scripts/sc-smoke-s45.py`: 39/39**, covering:
    - N: buy 200 kg kept at Sri Amman → collect 60 → 140 there; can't collect more than is there; buying from a business on CLAIRE is refused.
    - M: buy zips (bill 102, counted 100 → difference), return 20 → 80.
    - Z: buyer returned 50 pcs grade B.
    - Selling to Lakshmi: 29.8 of 30 kg confirmed, hers now, weighing loss within tolerance, and she never sees the rate. Selling to Mani and keeping 5 kg for Mani: Mani's 5 kg show at my unit "for Mani Exports".
    - AD lend / AA sell 5 from Lakshmi's premises / AD give to Sree; AB move.
    - Sale in place of 40 of 100 kg at the dyer: Ravi 60, Sree 40 as her own job, Lakshmi holds 60 for Ravi and 40 for Sree, and Sree gets 404 on Ravi's job.
    - E2 found → respec; respec across measures refused; regrade; lot split; write off needs a reason; count −3; counting goods with others refused.
    - Fire at Lakshmi's unit: her own written off, one difference each for Ravi and Sree; neither sees the other's; Ravi's job can't close; Ravi accepts → bar 40 sold + 10 lost + about 50 still there; Sree says not lost → Lakshmi accepts → restored.
  - s1–s4 still pass; `sc:verify` 0 problems (570 holdings).
  - **Browser** (Ravi, Tamil, 375 px): Record sheet with all entries; sold 7.5 kg cut waste to Mani from the form with a rate; the stock picker includes goods at Lakshmi; the count sheet's live difference; the casualty dispute screen.
- **Fixed during checks:**
  - A casualty loss didn't reduce "still there" on the job.
  - "Made here" appeared as both a section heading and a row; the section is now "Inside my unit".
  - A Tamil case ending was glued onto a noun.
- **Decisions in implementation:**
  - Selling in place and buying in place post at once. The buyer's acceptance step (model §4.1 "posts nothing until accepted") is not built; the buyer can dispute instead.
  - Collect works with parties not on CLAIRE only.
  - The rate is in `sc_prices`, apart from the shared movement.
- **Known gaps:**
  - **`correct_line`** (re-point a posted line's owner, job or counterparty, acknowledged by both sides) is not built. Undo within 10 minutes and a difference on the line cover the common cases today.
  - A business on CLAIRE handing over goods it keeps for someone (the counterpart of Collect) is not built.
  - Unconfirmed given samples are not yet written off after 30 days.
  - Casualty differences are not yet forwarded upstream (a sub-contractor's fire reaches the intermediary, not the owner).
  - Casualty doesn't flag a GST input-credit review.
  - Stopped jobs are not moved to `cancelled_awaiting_resolution`; the open difference blocks closing instead.

### Slice 5 — Personal Claire (2026-11-21)
- **Built** (`server/src/sc/claire/`):
  - **Turn pipeline (04 §9.2)**: `scClaireTurn` runs first inside `claireTurn` when the flag is on, and returns null for anything that isn't about goods, so the marketplace flow still answers.
  - **Tier 0, deterministic**: chips (`What's late`, `Out with others`, `Coming in` on Claire's home card) and plain phrases in en/ta/hi go straight to a tool with no model call.
  - **Seven tools** (`tools.ts`): `query_holdings`, `query_jobs`, `query_movements`, `compute_analytics`, `explain_job`, `draft_record` with `mood` + `tense`, and `find_suppliers`. One JSON schema serves every tier (`additionalProperties:false`, no numeric constraints); zod validates every call.
  - **Tier 1, free model**: `openrouter.ts` uses ERNIE, its own client, a 4 s budget, no 429 sleeps, and 400 of the app's 1,000 requests a day, counted per HTTP request.
  - **Tier 2, Claude Haiku 5.5** (`haiku.ts`, official `@anthropic-ai/sdk` 1.12, the one new dependency):
    - It is called only when tier 1 fails.
    - Settings: `thinking:{type:"disabled"}`, `output_config.effort:"low"`, no temperature, `strict` tools, `tool_choice:auto` with no parallel calls, and a cached system prefix.
    - A refusal (`stop_reason:"refusal"`) falls through to the rules.
    - A $1/day cap (`CLAIRE_PAID_DAILY_USD`) is tracked from reported usage.
    - **Off unless `ANTHROPIC_API_KEY` is set and `SC_CLAIRE_PAID=1`.**
  - **Tier 3, rules** (`rules.ts`): record verbs, questions, plans, units, sizes, periods and analytics words in three languages, plus **spoken numbers** (ஐம்பது / ஐநூறு, पचास).
  - **Resolution** (`resolve.ts`): the model never gives ids.
    - A built-in Tamil/Devanagari romanizer and phonetic keys match party names across scripts and spellings ("லக்ஷ்மிக்கு", "நொய்யல்ல", "नोय्यल", "Nooyyal"), with case endings stripped and generic trade words ignored.
    - Ties become a "Which one?" choice that routes back into the same question or draft.
    - Materials, colours and sizes map to specs this business holds or has used.
  - **Answers** (`answer.ts`, `strings.ts`) run through the same scoped reads as the Goods screens (`jobSummaries`, `positions`, `toConfirmFor`):
    - template text in en/ta/hi, number + unit first, "about" on estimates;
    - "about 89 kg finished navy … (about 95 kg grey being dyed)" from the P7 estimate;
    - rows that open the job or movement, and a source line with the count and the time;
    - analytics are owner-only, with "not enough history" under 3 jobs.
  - **Questions never draft**: "அனுப்பியாச்சா?" is answered from the records, and plans get "Record it when you send it".
  - **Drafts** (`drafts.ts`):
    - A `record_draft` card shows a "verb · tense · date" header, the lines, notes and a read-back; Read out uses Sarvam TTS.
    - Sizes said without quantities are split evenly, with a note.
    - The process comes from the words, else the last work this party did that takes this material, else the usual work for it.
    - Notes cover ×10 against the last send, the same record already today, and too little stock at my unit.
    - Drafts expire softly after 24 h.
    - **Save** runs the same write functions as the forms: Send for work, Got back and the trade handlers, lifted into `sendForWork` / `gotBack` / `recordTrade`. The draft id is the client id, so a double tap, a retry, or saving via **Change** (Send for work opens pre-filled from `?draft=`) never records twice.
  - **Web**: `goods_answer` and `record_draft` cards; Save / Change / Cancel / Read out; the card refreshes its state from the server after a reload.
  - Each turn logs its tier, model, outcome and time to `sc_claire_log`, never the user's text.
- **Checks:**
  - typecheck + lint green; **24/24** unit tests (3 new for cross-script matching).
  - **Fixtures** (`npm run sc:claire-fixtures -w server`, 48 synthetic prompts: en 20, ta 14, hi 9, adversarial 5):
    - **Rules alone: 48/48.** These are fixtures I wrote, so it is optimistic for free phrasing.
    - **ERNIE on the exact 7-tool schema: every one of the 28 schema-valid calls was right**: 1 invalid call and 2 text replies, which fall to the rules. **But 17 of 47 requests failed upstream (429 / provider errors)**, so availability is again the risk (04 §9.1). Median 1.8 s.
    - Model, then rules: 48/48.
  - **Claire smoke** (`npm run sc:claire-smoke -w server`, rule tier, HTTP save): all pass. Covered:
    - the Tamil demo sentence → a draft (S 200 + M 200 for stitching, nothing written) → Save → in Out with others; a second Save doesn't record twice;
    - Change → saved from the form → the card shows saved;
    - "அனுப்பியாச்சா?" → an answer; a plan isn't drafted; got back finds the open job;
    - the answer about Lakshmi matches Out with others; "What's late" with no model; in my unit;
    - staff: loss % → owner only, drafting allowed;
    - two Lakshmis → a choice → the same draft finished;
    - injection text → no draft and no prices; "Sree Textiles' fabric at Noyyal" → only my parties or my goods.
  - s1–s4.5 still pass; `sc:verify` 0 problems.
  - **Browser** (Ravi, Tamil, 375 px, through the real chat):
    - typed the demo sentence → a draft card in Tamil, answered by **ERNIE in 2.5 s**, with the "same record today" note (correct, the smoke had saved it) → Save → Saved + Open;
    - "லக்ஷ்மி கிட்ட இன்னும் எவ்வளவு கிட் இருக்கு?" → an answer card of the kit jobs at Lakshmi with "சுமார்" estimates and the source line.
- **Fixed during checks:**
  - The process was taken from the party's last job even when that work doesn't take the material (dyeing for kits).
  - A Tamil name form "ஸ்ரீ" escaped the generic-word filter and matched "Sree".
  - A plan with a present-tense "send" fell through to the marketplace flow.
  - Short stock was only found at Save; the draft now warns and picks the lot with the most stock.
  - The card kept saying "not saved yet" after Save.
  - The source line counted the rows shown instead of all records.
- **Decisions in implementation:**
  - A non-goods message that reaches tier 1 costs one extra model call before the marketplace flow's own call. 04 §9.3 wanted one call per turn; folding `understand()` into the same call is left for later.
  - Got back is drafted against one open job (matching the material); several outputs or grades go through Change.
- **Known gaps:**
  - **The Haiku tier is unverified and off.** `ANTHROPIC_API_KEY` in `server/.env` is empty, and it isn't in `render.yaml`. To enable it: add the key (and in the Render dashboard for deploys), run `SC_CLAIRE_PAID=1 SC_TIER=haiku MONGODB_DB=nexconn_sc_dev npm run sc:claire-fixtures -w server` (about $0.01), and set `SC_CLAIRE_PAID=1` if it passes.
  - `explain_job` gives the open jobs at the party, not a narrative of one job's events.
  - Drafts cover send for work, got back, buy and sell; Made here, returns and samples go through the forms.
  - Voice uses the existing mic → Sarvam STT → text path; the transcript is the user's bubble.
  - Tamil and Hindi templates are *to verify*, like the other strings.

### Slice 6 — Off-platform reach and linking (2026-11-21)
- **Built:**
  - **Statement links** (`statement.ts`, 04 §10.4) for a contact or a business that doesn't use Goods:
    - The token is 128-bit and only its SHA-256 is stored. There is one link per (recorder, party); creating it again rotates the token.
    - **The page at `/l/:token`**:
      - server-rendered HTML mounted before the API and the SPA fallback (the dev proxy forwards `/l/`), so no app bundle; about 5–21 KB in the dev data;
      - in the contact's language with a ta / hi / en switch, light and dark;
      - only the lines between the recorder and that party, plain names (no style codes), no prices, no other parties;
      - the 20 newest open items, with a note for older ones;
      - footer: what this is, no prices, the DPDP notice, **Stop these updates**.
    - **Actions** (plain HTML form posts, 303 back with a thank-you):
      - **Correct** / **Different number**: a receipt or the sender's figure with **`link` evidence**, so the recorder sees "Confirmed by Selvi" ranked below an account;
      - **I returned some**: a proposal the recorder accepts (records Got back on their word) or declines; a job with no output yet sends the recorder to the Got back form;
      - **Ready for pickup**;
      - **Stop**.
    - "Seen" is set only by a beacon after load or by an action, never by a bare GET, so link previews don't count.
    - **30 requests a minute** per token and IP.
    - **Best-effort recorder guard**: authenticated Goods requests remember the device (IP + UA hash). From such a device the page is view-only and refuses answers.
    - A link stopped by the recorder, rotated away, or retired by linking says it no longer works (404).
    - Owner routes: create / rotate (returns the `wa.me` URL with a pre-filled message in the contact's language to their number; **the app never messages anyone**), list (seen, stopped by whom), stop, and proposals with accept / decline.
  - **Contact linking** (`link.ts`, model §6.4, 04 §5.6.1):
    - A business that joins with a phone others saved as a contact sees only **"N businesses have records with your number"**: no names, no data.
    - **Ask to link** → each recorder sees "{business} says they are your contact {name}" → **Approve** or **Decline**; silence never approves.
    - **Approve = one `link_rekey` event**:
      - every holding keyed on the contact (owner / custodian / via / attributedTo) moves to the business, −q/+q with history intact;
      - the recorder's movements and jobs are re-pointed (the original is kept in `linked_from`), and the business is added to viewers and parties, including open disputes;
      - duplicate contacts with the same phone are merged (`merged_into`, `archived_at`);
      - the statement link retires.
    - The party list and Claire's name matching then use the business, not the contact.
  - **Web**:
    - "Send statement on WhatsApp" + Copy link on a contact's ledger.
    - Statement links in Setup (opened / not yet / stopped by them, with Stop).
    - On the Goods home: link requests to approve, the "records with your number" invitation, and "they say they returned …" proposals to accept.
- **Checks:**
  - typecheck + lint green; 24/24 unit tests.
  - **`scripts/sc-smoke-s6.py`: all pass**:
    - **Statement flow (Lakshmi → Selvi)**:
      - WhatsApp message in Tamil to her number; page < 50 KB, server-side;
      - no ₹, no other parties, no style codes; a WhatsApp preview GET is not "seen", the beacon is;
      - the recorder's device can't answer (403); Selvi confirms 200 → "confirmed by" with `link` evidence;
      - "returned 150" → proposal → accept asks what came back → accepted → 50 still with Selvi;
      - ready → Lakshmi sees ready; Hindi switch; Stop → "stopped by them";
      - unknown token → 404 page; the rate limit returns 429.
    - **Scenario L**: Ravi's contact Kaveri Dyeing joins with that phone:
      - she sees a count only and nothing before approval;
      - Ravi sees the request and approves → holdings re-keyed → **one row under the business** in Out with others;
      - Kaveri sees Ravi's 120 kg as others' goods and confirms the old record (119.2 kg) from her account;
      - the old link 404s, the party list shows the business, and there are no more suggestions.
  - s1–s5 smokes and the Claire smoke still pass; `sc:verify` 0 problems after the rekeys.
  - **Browser** (Ravi's device, Tamil, 375 px, dark):
    - the statement page shows the view-only note on the recorder's own phone, with buttons disabled;
    - the footer and DPDP notice read well;
    - "WhatsApp-ல் கணக்கு அனுப்பு" on a contact's ledger.
- **Fixed during checks:**
  - Dark-mode buttons had white text on light green.
  - A page with 50 open items reached 40 KB; it's now capped at 20 items (21 KB).
  - A link retired by linking still showed "stopped" instead of no longer working.
  - The smoke's flag step ran on the shell's default Node 18; it now loads Node 24 through nvm.
- **Decisions in implementation:**
  - The contacts API already refuses a second contact with the same phone, so merging duplicates covers entries that predate that check.
  - Re-pointing movements and jobs rewrites their party fields (keeping `linked_from`). Events (`sc_events`) are never rewritten.
  - A statement-link proposal is accepted against the job's last output, or what the recorder picks.
- **Known gaps:**
  - The recorder guard is device-based and best-effort (04 §10.4): a second phone still works, and its answers are labelled "via link".
  - Statement pages for businesses without Goods work through the API, but the party ledger only offers "Send statement" on contacts.
  - Silent accounts (a business on CLAIRE that never opens the app) aren't suggested automatically.
  - The contact's side can't propose dispute outcomes from the page yet; the recorder settles one-sided differences.
  - The "seen" beacon needs JavaScript; without it, seen is set on the first answer.

### Slice 7 — Staff (2026-11-21)
- **Built:**
  - **Provisioning** (`sc/staff.ts`, 04 §10.3b): the owner adds staff by name and phone.
    - A phone already in another business → refused. A phone with no business → attached as staff. A new phone → a staff user (`role:'staff'`, `onboarded:1`) who logs in with the normal OTP.
    - Staff join every Goods conversation of the business; new Goods conversations include both sides' staff. Deal rooms never include staff (`usersOf` returns owners only).
    - Removing staff detaches them.
  - **A staff guard on every API route** (`staffGuard.ts`, mounted before all routes): an allow-list of sign-in, own profile (not the business's auto-reply), Claire, voice, Goods, and Goods conversations only. Every other route, including future ones, returns 403 `staff_forbidden`.
    - The inbox lists Goods conversations only.
    - Claire answers staff about goods only; the marketplace flow says "buying and selling are for the owner".
  - **PIN on a shared phone**: set or remove it in Setup; asked once per session by a full-screen keypad (`PinGate`); locked after 5 wrong tries in 5 minutes.
    - Hashed with the server secret; `/me` returns `has_pin`, never the hash.
  - **D5 count approvals**: a staff count differing from the book by more than 5 pcs / 2 kg / 2 m waits for the owner (202 `pending`, nothing posted). The owner approves (posts against the book as it is then) or rejects in **Waiting for you** on the Goods home.
  - **Staff suggest, the owner settles**: a staff "use their count" on a difference becomes a suggestion shown only to the owner (the other side never sees it). Accept and escalate stay owner-only.
  - **Web**:
    - Staff land on Goods → Coming in, with tabs Goods · Chats · Claire · Profile.
    - Home, orders, store, Trade Desk and onboarding redirect away.
    - A simple staff profile: name, whose staff, language, PIN, log out.
    - Setup has Staff (owner: add, list with "PIN set", remove) and "PIN for this phone" (everyone).
    - "Waiting for you" (owner) shows staff counts and suggestions.
    - The count sheet and the dispute screen tell staff "Sent to the owner" / "Suggested to the owner".
- **Checks:**
  - typecheck + lint green; 24/24 unit tests.
  - **`scripts/sc-smoke-s7.py`: 34/34**:
    - add Kavitha; again → `already`; another business's phone → `other_business` (both ways);
    - she logs in as staff, onboarded; no PIN hash in `/me`; staff can't add staff;
    - **19 existing routes refuse her**: deals open / combo, offers, orders and order events, requirements, listings, catalog, desk, business profile, auto-reply, onboarding, ratings, samples, job offers, and a deal-room conversation;
    - her inbox is Goods only; she can change her language;
    - she reads Out / Coming / In / stock, but rates, links, staff, approvals, close, reopen, write-off, casualty and sell-part refuse her; no prices in what she reads;
    - **scenario U**: she confirms Lakshmi's 180 at the gate; her count 40 short waits (book unchanged); 3 short posts at once; Ravi sees "Kavitha counted …" and approves → the book becomes her count; staff can't approve;
    - her dispute suggestion stays open, is hidden from Lakshmi and shown to Ravi; staff can't accept;
    - PIN: set, wrong refused, right accepted, locked after repeats, Ravi sees "PIN set";
    - removed → her login no longer reaches Ravi's goods.
  - s1–s6, the Claire smoke and `sc:verify` still pass (see the commit).
  - **Browser** (Kavitha, Tamil, 375 px): home redirects to Goods → Coming in with the staff tabs; the staff profile; the PIN keypad (2468 → in). Owner Setup shows "Kavitha · PIN set".
- **Fixed during checks:**
  - The owner's profile page (trust score, store listing call refused with an error banner) showed for staff; staff now get their own profile.
  - A staff suggestion would have shown in the red error box; it's now a green notice.
- **Known gaps:**
  - A staff member belongs to one business (D8: one person in two businesses is deferred).
  - The PIN is per browser session, not per device lock.
  - Staff can view Setup (owner controls are disabled server-side).
  - Size-by-size voice receiving at the gate uses the existing confirm screen and mic; a dedicated "Arrived" flow is not built.
  - The demo staff user "Kavitha" (9600000001, PIN 2468) is on the dev DB only.

### Slice 8a — Reports and money (2026-11-21)
- **Built** (`sc/money.ts`, owner only; record only, nothing is paid through the app):
  - **Bills, derived, never stored** (model §3.9, §11.4):
    - Jobs either way: work I gave (I owe the performer) and work I did (the client owes me). In-house jobs are free.
    - The rate is the one agreed on the job (`sc_prices`), else the client's rate card in force on the job's date (process-specific before general).
    - Billable quantity by basis: `per_input_mass` = issued kg, billed once the job is completed or closed; `per_output_piece` = all pieces back; `per_good_output_piece` = the process's billable grades; `lump_sum` = the amount.
    - Closing adjustments (leftovers the worker kept) are added on the other side.
    - Sales and purchases with a rate, converted through the unit the rate was typed in. Returns are negative lines on the same side.
    - Jobs with no rate are counted ("16 jobs have no rate yet"), not guessed.
  - **Settlements** (`sc_settlements`, the only money record): paid / received / **set-off** (Y: both work for each other).
    - Modes: cash, UPI, bank transfer, cheque, adjustment.
    - Idempotent by client id.
    - A set-off can't exceed the smaller side (409).
    - A wrong entry is voided (dated), never deleted.
    - Between two businesses, one record serves both sides: Ravi's "received from Lakshmi" reads "paid" for Lakshmi.
  - **Balances per party**: billed − settled each way; net = they owe me − I owe them; **oldest unpaid** in working days, first in, first out.
  - **Performance** (S13), per unit × process over 12 months of closed or completed jobs:
    - median days against the promised days (else the process default), with paused days excluded and listed;
    - median loss against the usual loss and the best unit (lowest median among units with ≥ 3 jobs);
    - rejects % and difference count;
    - fewer than 3 jobs → "Not enough history yet", with no numbers.
  - **GST clock** (`/sc/reports/gst`): goods out on job work for 300+ days, with the one-year due date.
  - **CSV export** (`/sc/reports/bills.csv`, `/performance.csv`): UTF-8 BOM, quoted cells. A cell starting like a formula (`= + - @`) is written as text; plain negative numbers stay numbers.
  - Indexes: settlements by party and date, a unique client id, prices by movement.
- **Web:**
  - Goods header → **Reports** (owner only; a chart icon on phones, with a label for screen readers).
    - `/goods/reports`: tabs **Bills and dues** and **How units are doing**, the GST alert box and Download CSV.
    - `/goods/reports/bills/:k/:id`: net, each side, paid / received / set off, oldest unpaid, payments (with a two-tap **Wrong entry**) and what was billed (each line opens its job or record).
    - **Record payment** sheet: I paid them / They paid me / Set off (only when both owe); prefilled with what's owed.
  - Staff are redirected away from `/goods/reports`.
- **Checks:**
  - typecheck + lint green.
  - **`scripts/sc-smoke-s8a.py`: 27/27.** It uses a fresh contact named `=SUM(1,1) Dyers …`:
    - a ₹40/kg card → 100 kg dyed = ₹4,000;
    - a job still out isn't billed;
    - the job's own ₹50 rate beats the card;
    - items link to jobs; oldest unpaid shows;
    - paid ₹3,000 (a duplicate tap records once); void → back to ₹6,500;
    - sell 10 kg at ₹200 → they owe ₹2,000; a set-off over the smaller side is refused; set off ₹2,000 → net −₹1,500;
    - a business-to-business payment reads "paid" on the other side; Lakshmi can't open or pay Ravi's contact;
    - performance: 2 jobs → not enough; 3 → loss 6 % against 7 %;
    - CSV: text/csv; the `=SUM` name is written as text; −5500.00 stays a number;
    - staff get 403 on all 7 money and report routes.
  - **Browser** (Ravi, 375 px): bills list, the bill page, record ₹1,500 (net ₹5,500 → ₹4,000), two-tap wrong entry, performance tab, Tamil.
- **Fixed during checks:**
  - **Bills took 31 s for Ravi** (several lookups per job across ~1,000 smoke jobs). They're now batched: about 1 s.
  - CSV escaped negative amounts as formulas.
  - **The success message shifted rows** as it vanished, so a second tap could land on the wrong payment. It's now a floating toast.
  - **Long Tamil labels squeezed party names**; the direction now sits under the name.
  - The GST hint said "two years for some goods" (it's three years for capital goods).
  - **Smoke s45 failed** after many runs: leftover stock at Sri Amman made "collect 1000 kg" possible. It now asks for more than is there.
- **Known gaps:**
  - Bills are each side's own view: trade prices are private to whoever recorded them, so two businesses can see different totals until 8b shares agreed prices.
  - Not built:
    - closed days (Q) and a per-receipt rate override (W);
    - a due sweep or reminders for unpaid bills;
    - a bill PDF or WhatsApp share of a bill;
    - capital goods' 3-year GST clock (all goods use one year);
    - Claire answers about money.
  - Performance days are 0 in the demo data (smokes send and return on the same day).

### Slice 8b — Orders ↔ goods, history and the work profile (2026-11-21)
- **Built** (`sc/orders.ts`; everything only when **both** businesses use Goods, otherwise the order works exactly as before):
  - **Deliveries as movements (J8):** the seller's **Send goods** on an order records a sale movement linked to it (`order_id`).
    - Each dispatch is its own movement; receipts add up. The buyer confirms with the usual Received.
    - The first dispatch moves the order to `dispatched` through the existing order flow, in the background.
    - **When receipts cover the order**, the existing `orderEvent('delivered')` runs once (a claim guards two receipts landing together). It sets `delivered_at` and the balance due date, and posts the rating card, so Trade Desk's overdue checks keep working unchanged.
    - The hook is in `afterChange` (confirmations, figures, dispute outcomes) and in `gotBack`.
  - **Return some (J8):** the buyer returns part of an order, with a reason (wrong size, defect, other). It's a movement back, linked to the order.
  - **Job-work orders (J15):**
    - **Send material** opens Send for work with the order's seller filled in, and saves through `/sc/orders/:id/send-material`. The server forces the recipient to be the seller, whatever the body says.
    - The job carries `order_id`. When the work back covers the order, it's marked delivered.
  - **Order prices in Bills (D1):**
    - Goods sent against an order are billed **to both sides** at the agreed order price with GST added, on what arrived (or what was sent, until it arrives). Returns are negative lines; job-work order jobs use the order price.
    - Advance and balance taps on the order buttons show in Bills as **read-only mirrored payments** (never stored, can't be voided). Nothing is counted twice.
  - **Orders tab:** "600 of 600 pcs received · 12 pcs returned", from one `goods-summary` call.
  - **Chat order card:** a **Goods** link.
  - **Order Goods page** `/goods/order/:id`: progress bar, deliveries with state, returns, the job-work order's jobs and opening position, and Send goods / Return some / Send material.
  - **Your history with them (J15):** `GET /sc/history?ids=` returns my own jobs with each business: count, usual days (≥ 2 finished), loss % (≥ 2 closed).
    - Search result supplier cards show "You: 4 jobs · usually 6 days · 7.1% loss". It's private to the viewer, and requests are batched per screen.
  - **"What work does your unit do?" (S18):** a one-time owner card on the Goods home: twelve chips, Save or Not now. Stored as `businesses.sc_work`.
  - **Migration** (`npm run sc:migrate-orders -w server`, dry run by default, `--apply` to write; refuses non-dev databases):
    - Open job-work orders where both use Goods get an **opening position** from `qty_done` in `sc_order_openings`. Later work adds to it, so nothing is counted twice.
    - `orders` is never written (qty_done is only read). Idempotent by order id.
- **Checks:**
  - typecheck + lint green.
  - **`scripts/sc-smoke-s8b.py`: 34/34, and again on a second run.** Orders are created through the real deal → offer → accept flow:
    - the Goods view and who can do what; the buyer can't dispatch;
    - 400 sent → "dispatched", "400 on the way" → Received → 400 of 600, not delivered;
    - 200 more → delivered, with the due date and the rating card; the Orders summary;
    - return 12 (wrong size); the seller can't return;
    - both sides billed ₹92,610 (588 × ₹150 + 5 %); the advance mirrored as ₹28,350 and not voidable;
    - job-work order: Send material goes to the seller even when the body names someone else; 60 back → not delivered; 100 → delivered; billed ₹1,260;
    - history is private and per business; the work profile saves, bad keys → 400;
    - migration dry run, then apply twice → the second creates nothing.
  - **Browser:**
    - Ravi: the Orders line, the order Goods page (600 of 600, deliveries, the return), the work card on Goods.
    - Lakshmi (Tamil): an order's Send goods (picker → 20 → the short-stock notice → record anyway → "20 pcs on the way").
- **Fixed during checks:**
  - **New routes returned 500 on bad input** (zod used directly); they now give 400. The 8a money routes had the same problem.
  - **The first dispatch waited about 8 s** for the order's chat card; it now runs in the background.
  - "600 pcs of 600 pcs" now reads "600 of 600 pcs".
  - The history hook requested the same business twice.
  - **Smoke fixes:**
    - A re-run reused the deal conversation, whose job-work requirement made the next offer job work; the smoke now offers a product listing.
    - The buyer's return sat in the 10-minute undo window, so the seller's bill didn't include it yet. That's correct behaviour; the smoke now shares it first.
- **Known gaps:**
  - New orders still show the legacy advance and balance buttons (mirrored into Bills); replacing them with Record payment for "new" orders is not done.
  - Process offerings (`sc_work`) are stored but not yet used by marketplace search ranking.
  - Not built: the onboarding step itself (the card covers existing businesses), the store listing stock label, the Home "Today" strip, and the exchange flow for a wrong-size return (send the right size as a new dispatch).
  - History shows on single-supplier cards only, not on combined (split) cards. In the demo data no search lists a business Ravi has jobs with, so it was checked through the API and the request, not on screen.

### Slice 9 — Offline, translations and polish (2026-11-21)
- **Built:**
  - **Offline outbox** (`web/src/lib/offline.ts`, 04 §5.4, 03 §6.4):
    - Create-only records queue in IndexedDB when there is no network: send for work, got back, trade, confirm / sender figure, work done, send back, count, made here, receive first, order dispatch / send material.
    - They are sent oldest first when the network returns, when the app comes back to the front, and every 30 s.
    - Each carries its client id, so a retry that already reached the server is recorded once. The undo window starts when the server receives it (at sync).
    - Checks re-run on the server. A refused record is kept and marked: **Check this** (short stock: the owner can Record anyway) or **Could not send** (Try again / Remove).
    - Disputes, settlements, edits and approvals stay online-only.
    - The queue and cached lists are per login, so a shared phone never shows one person's queue or copies to another.
  - **Last updated:** Goods home lists read through a device copy. Offline they show the last copy, with "Offline · Last updated 19:47".
  - **The strip on Goods home:** records waiting with their time and state, then a "Sent: …" toast with **Undo** once each one syncs.
  - The forms using it: Send for work (incl. order Send material), Got back, Trade, the movement screen, the chat card's Received, Work done, Correct stock, Made here, Received for work, order Send goods.
  - **Server idempotency gaps closed:**
    - `POST /sc/jobs/:id/output` takes a client id (the retry → `duplicate`).
    - Receive-first and adjust answer `duplicate` instead of a second 201.
    - **A staff count waiting for the owner is no longer queued twice on retry** (it now stores its client id).
  - **Translations:** all Goods strings (752–793 new keys per language) translated into te, kn, ml, bn, or, mr and gu; `i18n:check all` is 100 % (1,725 / 1,725 web, 123 / 123 server). Made by model, placeholder-checked; *to verify* by native speakers like ta / hi.
  - **Budget:** Vite writes a manifest; `npm run sc:budget` sums each Goods route's own chunks (gzipped) beyond the app shell. The largest is Goods home at 41.3 KB (budget 150 KB).
  - **Accessibility:** an in-page audit of 8 Goods screens found no unnamed buttons, unlabelled fields or images without alt text. The Goods home status chips were 36 px and are now 44 px.
- **Checks:**
  - typecheck + lint green.
  - **`scripts/sc-smoke-s9.py`: 15/15, and again on a second run.** Every queueable record is sent twice with the same body:
    - send, work done, got back, sale, made here and count → "duplicate"; the book moved by 1, not 2;
    - receive-first;
    - a queued confirmation after the job changed → 200, the retry "unchanged", one receipt assertion;
    - a staff count waiting for approval → one approval;
    - the budget and `i18n:check` pass.
  - **Browser:**
    - Ravi, network cut in the page: a stock count went to the outbox; Goods home showed the saved copy with "Offline · Last updated 19:47 · 1 record waiting".
    - Network back: it synced within about 2 s ("Sent: Count · …"), and the server had exactly one count.
    - Telugu renders on Goods and Reports.
- **Fixed during checks:**
  - The "saved on this phone" toast overlapped the "Sent" toast; it now clears when a record sends.
  - The dev server hung once during an auto-restart (not a code fault; a clean restart was fine).
- **Known gaps:**
  - **No 4× CPU-throttled pass:** the in-app browser can't throttle the CPU. Unthrottled, the money pages answer in about 1 s on the dev DB.
  - Offline reads cover the Goods home lists only. Detail pages (a job, a movement, a party) need the network.
  - No service worker, so a cold start with no network can't load the app shell.
  - The offline queue lives in one browser profile; clearing site data loses records not yet sent.
  - **Translations of the seven overlay languages are machine-made and need native review**, like Tamil and Hindi.

### Phase 7 — Final verification (2026-11-21)
- **Demo data and end-to-end runs** (`scripts/sc-demo-scenarios.py`, `server/src/sc/demo-cli.ts`):
  - 15 demo businesses onboarded through the normal flow, flagged and marked demo (`is_seed: 1`, `sc_demo: 'A' | 'B'`) on the dev DB only.
  - **Scenario A** (BRIEF §3): fabric shop Velan → dyer Kongu → garment maker Murali; trims from Selvam (buttons, zips) and Annai (thread); in-house cutting; S/M to Priya Stitching, L/XL to Bharathi Stitching, back in parts with rejects; in-house packing; three sellers in Kolkata, Chennai and Delhi.
  - **Scenario B:** Nila Knitwear → Kumar Cutting (cutting only) → one stitcher per colour + size (Sakthi navy S/M, Ganga navy L/XL, Vel black S/M) → packing in-house.
  - **Every step is recorded by the participant who would record it, through the API.** 43 checks: exact quantities at every step (500 kg bought, 7 % dyeing loss, 165 / 300 kg after the sale, 1,100 kits, 25 cones left, 1,085 packed, 500 / 350 / 235 to the sellers with a 2-piece difference at Delhi, 940 kits and 938 packed in B).
  - **Isolation from every account:** the fabric shop, dyer, trims shops, stitchers and sellers each see only their own records; no one sees another's prices; scenario B can't see A.
  - The ledger check is clean afterwards. Each run uses its own lot and style codes, so it can be re-run (it passed twice in a row).
  - Logins: phones 9000001001–9000001010 (A) and 9000002001–9000002005 (B), OTP 123456 on the dev server. See HANDOVER.
- **Independent audit** (a reviewer agent; correctness, isolation, regressions, UX). **No regressions with the flag off.** Found and fixed:
  1. **Any business could write a payment into another business's Bills.** Now only with a business you trade with (a shared record or order); otherwise 404.
  2. **An undisclosed sub-contractor's name leaked to the owner** (job detail children, and the child job itself). Now masked ("Sub-contract", no name or link), and the owner gets 404 on the child job.
  3. **"I returned some" on a statement link could be booked in the wrong unit** (2 kg of a cutting job became 2,000 kits). Accepting now refuses to convert between units and asks the owner to record it in Got back; the metres label is fixed.
  4. **Approving one staff count several times at once posted it several times** (book 100 → 20 instead of 80). The approval now has a unique client id and changes state inside the transaction; dispute resolution has the same guard (settles once).
  5. **Job-work orders weren't marked delivered when the worker sent the work back.** Coverage now also runs on send-back and on confirmations of returns on an order's job.
  6. **Staff could read leftover rates** in job closures. Now stripped for staff and non-parties.
  7. **Linking a contact split its Bills.** Payments, rate cards and agreed terms now move to the business in the same transaction.
  8. **The offline queue was lost after logging in again** (tagged by token). It's now tagged by user id; tested in the browser: queued, then sent about 1 s after reconnecting.
  9. **Returns on ordinary sales and purchases didn't reduce the bill.** An unpriced return is valued at the latest price recorded with that party for the same item.
  10. **Minor:**
      - Search history is cached per login.
      - Staff can no longer list statement links, link requests (phones) or history.
- **Also fixed:** the In my unit list showed goods on the way or in dispute as "Your goods here". Each now carries a status (text + colour + icon): "On the way, not received yet", "Difference open", "On hold".
- **Found in the final regression:**
  - **Claire's draft picked a style it couldn't send.** "Send 400 polo kits, S and M" took the newest matching style even with too little stock. It now takes the style whose stock in the requested sizes covers the most (rule fixtures still 48/48).
  - The s2 receive-first match check waited a fixed 3 s; under load the background match can take longer, so it now polls up to 10 s.
- **Docs:** `DESIGN_SYSTEM.md` §1 and `BUILD_CONTRACT.md` "Design tokens" now list the tokens `index.css` actually ships (the "Tiruppur cotton" and blue palettes are removed), plus Goods UI rules.
- **Checks:**
  - **`scripts/sc-smoke-audit.py`: 15/15**, one or more checks per finding.
  - **Browser:** Murali's In my unit with the new status labels, Priya's (stitcher) empty own stock, the offline retest.
  - Full regression in the commit message.
- **Not done / known gaps:**
  - **No nightly demo reset:** demo data accumulates per run.
  - The **Flow view** (S9) is still unbuilt.
  - The demo businesses aren't on the login screen's demo list (that list is fixed in `routes/misc.ts`); log in by phone.
  - The order card's Goods link shows even when the other side doesn't use Goods (the page then says so).
  - All overlay and ta/hi translations need native review.

### Load test (2026-11-21)
`scripts/sc-load-test.py`: 10 new test businesses (phones 9300000001–9300000010; flagged for Goods, **not** demo, not on the demo logins), each acting as one business in a ring (sends work to the next, confirms what the previous sent, records returns, sales and payments, reads lists, bills and reports). The mix is 60 % reads, 40 % writes, each worker back to back with no think time. Measured against the **local dev server** (one Node process, tsx dev mode, on a 10-core Mac) using the **remote Atlas dev database** (about 74 ms per round trip from this machine).

| Concurrent workers | Requests/s | p50 | p95 | p99 | Errors | Server CPU (avg / max) | Memory | `/api/health` (no DB) |
|---|---|---|---|---|---|---|---|---|
| 1 | 1.3 | 0.66 s | 1.4 s | 1.8 s | 0 | 4 % / 25 % | 179 MB | 3 ms |
| 10 | 8.7 | 0.97 s | 2.0 s | 2.1 s | 0 | 8 % / 21 % | 252 MB | 2 ms |
| 20 | 9.5 | 1.85 s | 3.8 s | 3.9 s | 0 | 6 % / 20 % | 259 MB | 2 ms |

- **Correctness held under load:**
  - 103 concurrent sends → 103 unique movements;
  - replaying 30 of them with the same business and client id made 0 new records;
  - ledger check 0 problems.
- **Throughput levels off at about 10 requests/s, and latency doubles from 10 to 20 workers.** The bottleneck is the database, not the server: server CPU stays under 10 % and `/api/health` answers in 2–3 ms throughout. Each request makes 10–20 sequential round trips at about 74 ms each, and writes add a transaction.
- **The first run (before the fix below) had about 20-second stalls** hitting every endpoint at once. The server had nothing in its log, and the second run had none. This points at the shared database (possibly a shared-tier operations limit; the cluster tier isn't readable with this user), so worth watching.
- **Fixed:** two people tapping Received on the same delivery at once got a 409 "not enough in stock" for the second tap (the ledger was right; the message was wrong). It now answers "unchanged" (audit smoke check 11).
- **To make it fast** (not done):
  - host the API in the same region as the database (round trips of ~1 ms instead of ~74 ms);
  - check the Atlas tier and move off a shared tier if it is one;
  - batch the sequential queries in the hottest routes (coming, confirm, send, bills).

### Bug hunt and logged-bug fixes (2026-11-22)
Four independent reviews (ledger core; money/orders/staff/links/Claire; the Goods screens; every bug logged in the docs). Each finding was verified, then fixed. Regression smokes: `scripts/sc-smoke-ledger.py` (10 checks), `scripts/sc-smoke-money2.py` (8 checks), plus the existing suites.

- **Ledger core (17):**
  - **Goods created or lost on the books:**
    - Got back no longer re-counts output already recorded by Work done or a sub-contract roll-up (a shared "done but not yet returned" helper; send-back uses it too, now by item *and grade*).
    - "Sender figure" only on a return the other side recorded.
    - Undo is refused once the worker has acted (work done, forward, split, ready).
    - Undoing a sub-contract return also leaves the parent job.
  - **Closing and late figures:**
    - A parent job can't close while work is with a sub-contractor, and a late child return no longer flips a closed parent.
    - A refused late figure never reopens a closed job (checks run before reopening; the re-close runs in a `finally` with the owner's own choices, never auto-accepting a shortage).
    - A settled difference is final for its line.
  - **Receipts, forwards and counts:**
    - Going back to an earlier figure counts as a change.
    - Finished work can be forwarded (drawn from available, not allocated).
    - A casualty blocks every job it touched.
    - A sub-contractor's unprocessed return lands back in the parent job.
    - Counts compare-and-set against the book.
    - Undo applies the same trims filter as the original record.
    - A settled shortage's remainder goes back to the state it left from.
    - The job page subtracts held-for-dues days like the lists.
- **Money, orders, staff, links, Claire (14):**
  - **Bills:**
    - Piece bills count pieces only.
    - Order prices are exact (rounded once).
    - Priced sales and purchases use the settled figure per line and unit.
    - Migrated opening positions are billed.
    - Prices are read newest first.
  - **Orders:**
    - Coverage ignores records still in their undo window and re-checks when the window ends (card job), so an Undo can't leave an order "delivered".
    - Coverage counts only the order's unit.
    - Order returns are capped at received − returned and refused on cancelled orders.
  - **Statement links:**
    - Rate-limited per link, not per (forgeable) address.
    - The page and its answers skip records in the undo window.
    - The recorder's own phone doesn't mark it "seen".
    - `trust proxy` is set to one hop.
  - **Staff:**
    - Support agents can't be added as staff.
    - Staff get 403 on order goods and no link proposals.
    - Changing or removing a PIN needs the current one, or a sign-in within 15 minutes.
  - **Reports:** performance figures each need their own 3 data points; Claire's analytics use the same median and working days; the GST clock includes completed jobs with goods still out.
- **Goods screens (17):**
  - **Forms:**
    - The tolerance input keeps decimals ("1.5" no longer becomes 10).
    - The rate label follows the process's billing basis.
    - Change grade preselects a valid grade.
  - **Feedback:**
    - The Undo toast expires.
    - The "Difference open" chip loads disputes.
    - Errors show inside sheets.
    - A failed Got back load explains itself.
    - A queued chat-card confirmation says "Saved on this phone".
    - An undone movement shows "Cancelled".
  - **Actions:**
    - "Mark all ready" skips jobs with nothing done (the server refuses too).
    - Desktop return saves can't double-post.
    - Remove staff takes two taps.
  - **Party ledger:** shows sent figures until confirmed, plus a "Sent on" line (new `sent_on` in the ledger response).
  - **Offline:** In my unit works offline.
- **Logged in the docs:**
  - **The production database default:** a local `npm run dev` without `MONGODB_DB` used production. It now refuses to start; production sets it in `render.yaml`, and `.env.example` points at `nexconn_sc_dev`.
  - **Marketplace bugs B1–B19 from `docs/web-test-report-2026-11-20.md`:** 18 fixed. B1 is the chat offer quantity; the counter sheet now edits quantity too. **B10** (agent history from before joining) needs a Nexconn server-side history capability and stays open.
- **Found in the final regression:** "Out with others" loaded only the first 200 open jobs, so a busy unit's newest work disappeared. The cap is now 1,000.
- **Still open:**
  - B10.
  - After a Trade Desk ticket resolves, the order card in chat keeps the dispute line (it isn't re-posted).
  - The desk-only labels "Short delivery" and "Late delivery" are English.

### Stress test with Nexconn chat: 30 concurrent connections (2026-11-22)
`scripts/sc-load-nexconn.mjs 30 90`. 20 test businesses (9300000001–9300000020; the last 10 created for this run; none deleted, none on the demo logins). Each of 30 worker processes is one virtual user:
- it logs in and opens a real **Nexconn Web SDK** connection (`@nexconn/chat` NCEngine, the app's own SDK, in Node with browser shims);
- it runs the Goods mix over HTTP (60 % reads, 40 % writes, no think time);
- every 3–5 s it sends a chat message in its Goods conversation, and its partner times delivery.

The 30 workers run over 20 users, so 10 owners are on two devices at once. Local dev server against the remote Atlas dev database.

| | Result |
|---|---|
| HTTP | 843 requests, **8.4 req/s, 0 errors**; median 2.6 s, p95 5.0 s, max 6.1 s |
| Chat (Nexconn) | 26 connections up (connect median 1.0 s); **308 messages sent, 0 failures** (send median 155 ms, p95 177 ms); 573 deliveries to partners, **delivery median 317 ms, p95 361 ms, max 450 ms**; 0 connection drops |
| Server | CPU 6 % avg / 34 % max; 286 MB; `/api/health` 1 ms median |
| Data | ledger check 0 problems after the run |

- **Throughput stays at about 8–10 requests/s from 10 to 30 workers, and latency grows with load.** The bottleneck is still the database (remote round trips), not the API server or Nexconn, as in the 21 Nov test.
- **Chat delivery through Nexconn stayed fast** (about 0.3 s) throughout.
- **Harness limit:** 4 of 30 workers crashed inside the Nexconn Web SDK's protobuf decoder under Node ("pb decode error … Illegal buffer") on a downstream batch. Forcing `binaryType = 'arraybuffer'` didn't help. This is the browser SDK running in Node, not the app; their HTTP and chat stats are missing from the totals.

### Follow-ups: the open items built and verified (2026-11-22)
An earlier session built the remaining HANDOVER §7 items but left them uncommitted and untested. This session ran everything, had an independent reviewer audit the diff, fixed what it and the browser pass found, and committed.

- **Built:**
  - **Flow view (S9):** `/goods/flow` and `/goods/run/style|order/:id` (owner only). It shows:
    - where every piece is now;
    - buyers;
    - what is still to come back;
    - open differences;
    - each stage, with the conservation line ("sent = back + rejects + still there + loss").
  - **Closed days (Q):** weekly off days and holidays, applied to every `/api/sc` request and to Claire turns.
  - **Due reminders and Share bill:**
    - credit days per party;
    - hourly due reminders, at most one a day per party, seen by the owner only;
    - Share bill on WhatsApp, plus a print view.
  - **Record payment on orders:** replaces the advance/balance buttons for new orders when both sides use Goods.
  - **Receipt rates:** a per-receipt rate in Got back.
  - **Onboarding:** a "What work do you do?" step.
  - **Search:** ranking by declared work and Goods history.
  - **Trade Desk:**
    - B10 earlier-messages archive;
    - the order card re-posted after a ticket resolves;
    - localized type labels.
  - **Offline:** a service worker for offline cold start.
  - **Demo:** a demo reset CLI.
- **Independent review:** 7 findings, all verified and fixed.
  - **Closed days didn't reach Claire:** turns come in outside `/api/sc`. They now run inside `withCalendar`.
  - **A receipt rate could block the whole receipt:** this happened on order-linked or weight-billed jobs, and broke offline replays. Now:
    - the server drops a rate that doesn't apply (`rate_ignored`);
    - the form shows the field only when `rate_applies`.
  - **The paid-order sweep could stall:** after 50 partly-paid orders it stopped reaching new ones. It now picks only orders whose settlements cover the total. The lock is a timestamp that expires after 5 minutes.
  - **Onboarding could return 400:** a long voice-captured capacity or more than 90 days made it fail. Now:
    - the client and server shorten the text and clamp the days;
    - `service.checking` maps to `checking_packing`.
  - **58 `goods_money3` strings were missing in the 7 overlay languages:** now translated, with placeholders checked.
  - **Database-name guards were substring matches:** now anchored (`<name>_dev` / `<name>_test_<x>`). This also stops shell injection through `MONGODB_DB` in the scenario script.
  - **Two small items:**
    - a failed reminder send now releases the day's run, so the next hour retries;
    - Flow no longer counts same-unit by-products as both waste and loss.
- **Found in the browser pass:**
  - **"Where everything is now" was 2 short:** it summed to 498 of 500, leaving out pieces sent to a buyer that never arrived (an open difference). A new `not_received` row brings it to 500.
  - **Wrong sizes in "Still to come back":** it showed the sizes *sent* next to the count still at the unit. It now names only the sizes.
  - **Plural:** "1 differences" became "Differences: 1".
  - **The flow smoke's own expectations were wrong:**
    - Kolkata received 98 S + 20 M = 118, not 98.
    - A buyer opening the style sees only its own 118 pcs. That is its own data, checked: no Murali jobs, buyers or material.
- **Checks:**
  - lint and 24/24 unit tests;
  - all 15 smokes;
  - Claire smoke (including the injection and isolation checks);
  - scenarios A and B;
  - ledger 0 problems;
  - build, budget 41.6 KB, i18n 100 %.
  - Browser:
    - Flow at 375 px and 1280 px, in English and Tamil, with no overflow.
    - The in-app pane can't register a service worker, so that was checked in headless Chrome (`scripts/sc-sw-check.mjs`): it registers, precaches 37 shell files with no `/api` responses, and the offline cold start renders.
- **Device pass** (`scripts/sc-device-pass.mjs`):
  - **Setup:** production build, 4× CPU, slow 4G (150 ms, 1.6 Mbps), 360×740.
  - **Results** (screen ready with data; service worker warm, so these are return visits):

    | Screen | Ready |
    |---|---|
    | Goods home | 1.4–1.8 s |
    | Flow index | 0.9 s |
    | A style's flow | 1.2–1.3 s |
    | Reports | 1.3 s |
    | Send for work | 0.4 s |

  - Remote-database round trips dominate.
- **Left:**
  - installing the nightly reset schedule (owner's machine);
  - native review of the new overlay strings;
  - closed days across two businesses can differ by a day (each side uses its own calendar).

## Open questions
- T8: a separate free Atlas cluster for integration tests needs to be created by the user (not blocking slice 0's pure tests).

## Next
All slices, Phase 7 and the follow-ups (Flow view and the rest of HANDOVER §7) are done. Remaining, with the owner: native review of strings, the Anthropic key for the Haiku tier, the T8 test cluster, installing the nightly demo reset schedule, and the decision to merge or enable the flag for real users.
