# Supply-chain feature — progress log

Governing brief: `docs/supply-chain/BRIEF.md` (re-read at the start of every phase and after any context compaction).

## Current phase
**Phase 6 — slices 0 to 5 done. Next: slice 6 (off-platform reach and linking). The Haiku tier of personal Claire is built but off: it needs `ANTHROPIC_API_KEY` in `server/.env` and a verification run (see slice 5).** Work stays on local branch `supply-chain`. Phase 0 done: `00-current-state.md`.

## Phase status
| Phase | Doc | Status |
|---|---|---|
| 0 Current state | `00-current-state.md` | Done 2026-11-20 |
| 1 Domain research | `01-domain-research.md`, raw notes in `research/` | Done 2026-11-20, red-teamed, **approved** (all 13 defaults) |
| 2 Domain model | `02-domain-model.md` (v3.1), `walkthroughs/` | Done 2026-11-21, three review rounds, **approved** (D1–D8 defaults) |
| 3 Product & UX | `03-product-ux.md`, `ui-principles.md`, `mockups/` (16 screens) | Done 2026-11-21, rendered at 375/1280 px en+ta, red-teamed, **approved** (U1–U9 defaults) |
| 4 Technical design | `04-technical-design.md` | Done 2026-11-21, model check run, red-teamed, **approved** (T1–T9 defaults) |
| 5 Build plan | `05-build-plan.md` (v2) | Done 2026-11-21, red-teamed, **approved** (B1–B3 defaults) |
| 6 Implementation | slices on branch `supply-chain` | Slices 0–5 done 2026-11-21 |
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

## Open questions
- T8: a separate free Atlas cluster for integration tests needs to be created by the user (not blocking slice 0's pure tests).

## Next
Slice 6 (off-platform reach and linking: statement links, WhatsApp share, contact linking). Optional before it: add the Anthropic key and verify the Haiku tier.
