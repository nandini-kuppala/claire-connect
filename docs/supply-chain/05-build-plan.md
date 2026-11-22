# 05 · Build plan: vertical slices

Phase 5 of `BRIEF.md`. It turns `04-technical-design.md` into slices, each **demoable on its own** and ordered so the most valuable, least risky one comes first. No production code is written until this plan and Phase 4 are approved together. This is v2, after the red team (04 §16): it adds missing scope and re-estimates honestly.

---

## 1. Ground rules for every slice

1. **Branch:** all work goes on a local branch `supply-chain` cut from `main`. **Nothing is pushed, merged or deployed** without your go-ahead (T7). Nothing touches `main` before the hackathon deadline (Sun 22 Nov 2026, 23:59 IST).
2. **Database:** local runs use `MONGODB_DB=nexconn_sc_dev`. Tests follow 04 §14 (one `_test_` database per run; integration tests off the shared cluster during the hackathon window, T8). The production `nexconn` database is never touched.
3. **Flag:** `SC_ENABLED` plus a per-business flag, off by default. Every slice proves the flag-off app is unchanged with the smoke test (LLM off, local relay).
4. **Definition of done per slice:**
   - (a) code;
   - (b) `npm run typecheck` + `npm run lint` + `npm run build` green;
   - (c) new tests green, especially the conservation and isolation tests;
   - (d) the app run and the new screens checked in the browser at 375 and 1280 px in en and ta against `ui-principles.md` §4;
   - (e) `BUILD_CONTRACT.md` and docs updated;
   - (f) one commit per slice with a clear message;
   - (g) a short report in `PROGRESS.md`.
5. **Stop and ask** only when blocked, or when a decision would change the approved design (BRIEF §9).
6. **Strings:** every new string goes into `*.strings.ts` (en/ta/hi) and `npm run i18n:extract` is run. The trade glossary (`glossary.md`, made in slice 0) marks every term *to verify* until a native speaker signs it off.

---

## 2. Slices

**Sizes** are working days for one developer working with agents. They include tests and the browser check: S = 1–2 days, M = 3–4 days, L = 5–7 days. The total is about **9–11 weeks**. The first version of this plan said 15 days, which the red team rightly called not credible.

### Slice 0: Foundations (M)
**Build:**
- Branch, `.nvmrc` 24, flag plumbing (`SC_ENABLED`, `businesses.flags.sc`, `features.supplyChain`, `requireSc`), the `sc:flag` dev script.
- `shared/sc/` core: types, units, postings (Σ = 0 per event and dimension, §5.6.7), conservation, tolerance (cumulative receipts with a `final` flag, §5.6.4), evidence, plausibility (unit slip, ×10, never-negative), dates, masks (incl. sub-contract key-level grouping), vocab.
- `repo.ts` with `Ctx`, the transactional `post()` (incl. the count-variance check, §5.6.5), `positions()` (§6.1b), and holdings upsert.
- Collections and indexes; built-in material types and process templates; content-addressed specs.
- `node:test` runner, test-db guard, lint script, `glossary.md`.

**Tests:**
- Property tests: random sequences → Σ = 0 per dimension, holdings = postings, never negative, `positions()` never double-counts.
- Unit conversions and refusals; tolerance incl. partial cumulative receipts; evidence ranking.

**Demo:** the domain suite is green; a flagged business sees an empty Goods tab with the first-run guide.

### Slice 0.5: Setup data (M)
**Build:**
- **Contacts** (name + phone, transliterated to both scripts via Sarvam).
- **Spec picker** (material type → attributes, recents, aliases; "unspecified" placeholder).
- **My places**; **terms per party** (tolerance, who bears weighing loss, bill basis); **rate cards** (effective-dated, owner); **process offerings** for job workers.
- **Capability migration** shown for confirmation on the first Goods visit (04 §11).

**Tests:** spec content-addressing (the same spec typed twice is one row), alias resolution, terms snapshots, rate effective dates (W).

**Demo:** Ravi adds Noyyal as a contact, sets ₹70/kg and "weighing loss: owner", and his alias "Navy 180" resolves to Navy SJ 180 GSM.

### Slice 1: Out with others, single-player (L) — *the brief's "likely first slice"*
**Build:**
- **Send for work** (S4, without the size grid), with DC no. + photo (GridFS, capped, signed URLs) and "They told me they got …".
- **Got back from work** (S5): cumulative receipts, live balance strip, loss from the declared output, completion prompt, "As sent (unprocessed)".
- **Goods tab** with nav U1 behind the flag: Out with others (S1, late first, reasons), Coming in (S1c).
- **Party ledger** (S2): Open + History + Terms. **Undo** for 10 minutes. Off-platform counterparties only.

**Tests:**
- Scenario K (single side).
- Single-player pending (§5.6.8): "based on 200 kg you sent" → ≈ 97 kg; with "they told me 198.6" → ≈ 95 kg grey / ≈ 89 kg navy.
- Undo reverses postings. Isolation: a second business sees nothing.

**Demo:** Ravi records J-0412 to Noyyal by form, gets 96 kg back, and sees "≈ 95 kg grey still being dyed · due today". Mobile and desktop.

### Slice 2: Two-sided records and disputes (L)
**Build:**
- **Day 1 spike:** Nexconn persistence of targeted group messages (04 §8.3); choose targeted vs language-neutral cards.
- Movements between two flagged businesses; the **Goods conversation per pair** (U5; renders for unflagged viewers too); `movement` / `dispute` cards grouped by (business, language), no prices.
- `visible_at` on movements **and** in-transit holdings; the notify outbox with a lease and idempotency keys; Undo cancels and Share now advances the card.
- Receiver actions (all correct / different / reject lines) with `$push` assertions; tolerance → weighing difference or dispute.
- **Receiver-first entry** with unmatched held rows and match-on-visibility (§5.6.2).
- **Dispute** screen (four outcomes + transporter), propose / accept / counter; **Ask Trade Desk** as a separate support group.
- Three badges, "Check and confirm", "Confirmed by you".

**Tests:**
- Scenario K (both sides), T (transit claim, detained), AC (upstream claim, hop by hop).
- Concurrent confirm; undo-window race; undo leaves no trace for the counterparty (holdings, Claire, cards).
- Isolation incl. card `text` (no prices) and the Desk ticket scope.

**Demo:** two browser origins: Ravi sends to Lakshmi; Lakshmi confirms one line and differs on another; settled by "split".

### Slice 3: Job workers, forwarding and the size grid (L)
**Build:**
- **In my unit**, Mine / Others' goods (S10/S11); job workers open on Others' goods; bulk **Mark ready / Hold for dues / Return what's ready**.
- **Send back to owner**; **Forward**: hop with "Tell a unit to send on", sub-contract with `via`, the owner excluded from sub-contract lines, disclosure for registered owners, generic names.
- **Received for work**; the **size × colour grid**; trims from a style (minimal style editor); lots and the lot-mixing warning.
- Desktop wide layout and keyboard-first receive/return (U2).

**Tests:**
- Scenarios A (stitching part), B, C (hop), F (three-party mask: Ravi sees "with Lakshmi", Selvi sees "for Lakshmi", Ravi's history has no masked line), G (multi-principal; batch UI v1.1), I, P, R, S, Y (held for dues).
- Isolation: principal vs principal at one dyer.

**Demo:** Noyyal's clerk at 1280 px sees five principals, marks Sree's lot ready and returns Ravi's 92 kg. Lakshmi forwards 200 kits to a home tailor, and Ravi still sees "with Lakshmi".

### Slice 4: Made here, job detail and closing (M)
**Build:**
- **Made here** (U8): Cut · Pack · Check · Make sets/unpack as in-house jobs.
- **Job detail** (S7) with conservation bars; outputs by size and grade; the rework chain.
- **Close job** with the shortage discrepancy, leftovers step, close-with-claim-carried and reopen.
- **Auto-reopen on late assertions** (§5.6.3); cancellation (V).

**Tests:** scenarios A (cut, pack), D, H, O, V, AD; conservation at closure for every kind; late link confirmation after close reopens and re-closes; bill adjustment.

**Demo:** Ravi cuts R-13, sends it to Lakshmi, collects, packs, and closes J-0415 with the leftover buttons kept at ₹6.

### Slice 4.5: The other record forms and adjustments (M)
**Build:**
- **Buy / Sell**: kept for the buyer at the seller (N), direct to a job worker (S), sell from a job worker's premises (AA), grade per line (Z).
- **Return to supplier / Buyer returned goods** (M, J, AC).
- **Give a sample** (returnable or not, AD); **Move between my places** (AB).
- **Sale in place of allocated goods** with the child-job split (§5.6.6).
- Adjustments: **Change grade, respec** (E2), **relabel/split lot**, **correct_line** (acknowledged by both sides), **casualty**, **found**, **write-off**.

**Tests:** scenarios E (incl. E2 respec), J, M, N, S, Z, AA, AB, AD (samples); the casualty → per-owner discrepancies; correct_line visible only after both sides acknowledge.

**Demo:** Ravi buys 200 kg black SJ kept at Sri Amman, collects 60 kg, and returns 20 navy zips to Kumaran.

### Slice 5: Personal Claire (L)
**Build:**
- The `scLlm` client (4 s budget, per-request accounting, 400/day cap); a pre-router inside `claireTurn`.
- One-call tool selection with **`mood`** (statement / question / plan); cross-script phonetic party matching.
- Templated answers in en/ta/hi with records inline; `record_draft` cards (verb · tense · date header, soft expiry, duplicate check, ×10, read-back); follow-ups via `claire_sessions`; voice via Sarvam.
- Model chain: ERNIE → **Claude Haiku 5.5 if T1 is approved** (first re-verified on the exact 7-tool schema, about $0.01; thinking disabled, no temperature, refusal handling, $1/day cap) → rules → chips.
- Staff tool allow-list.

**Tests:** about 60 fixture prompts (three languages × intents × adversarial: cross-business, staff money, injection in contact names, question-vs-record "அனுப்பியாச்சா?", 50/500); answers reconcile with `positions()`.

**Demo:** in Tamil by voice, "லக்ஷ்மிக்கு 400 போலோ கிட் அனுப்பினேன், S M மட்டும்" → draft → Save → it shows in Out with others. "நொய்யல்ல இன்னும் எவ்வளவு நேவி துணி இருக்கு?" → ≈ 89 kg navy (≈ 95 kg grey being dyed).

### Slice 6: Off-platform reach and linking (M)
**Build:**
- **Statement link** at `/l/:token`: server-rendered, < 50 KB, in the contact's language, "seen" only on interaction, party-keyed (for contacts and silent accounts), best-effort recorder guard, "via link" labels, DPDP notice and Stop.
- **WhatsApp share** (`wa.me`, pre-filled in the contact's language).
- **Contact linking:** suggestion → request → recorder approval (D3) → **`link_rekey`** (§5.6.1) and merge rules.

**Tests:** scenario L (join later, de-duplication, holdings re-keyed into one row per dyer); the link shows only its lines; preview crawler doesn't mark seen; rate limits.

**Demo:** Lakshmi sends Selvi a link; Selvi confirms 200 and proposes "returned 150"; Lakshmi accepts. Then Noyyal signs up, Ravi approves the link, and Noyyal's records merge.

### Slice 7: Staff (M)
**Build:**
- Owner adds staff by phone (provisioning rules, 04 §10.3b); staff login; optional PIN.
- **Role guards on every existing route**; staff excluded from deal-room groups; inbox shows Goods conversations only.
- Staff masks on `/api/sc` and Claire; count approvals (D5) in **Updates → Waiting for you**; staff-proposed dispute quantities.

**Tests:** scenario U; the **staff isolation suite across every existing and new route** (deal rooms, offers, orders money events, listings, desk, `sc`), plus every Claire intent.

**Demo:** Kavitha receives Lakshmi's 180 at the gate by voice, size by size; her count of 1,140 vs 1,180 waits for Ravi. Opening a deal room as Kavitha is refused.

### Slice 8a: Reports and money (L)
**Build:**
- **Performance** (S13: promise / template / best-unit yardsticks, excluded days, n ≥ 3).
- **Bills and dues** (S14) with **Record payment** (settlements, set-off, Y netting).
- **GST clock** alerts (via `origin_dc_line`) and APOB/e-way warnings; closed days (Q); per-receipt rate override.
- **Flow view** (S9) per run with per-buyer shortfall by size.
- **CSV export** (masked, injection-escaped); the lazy due-sweep transitions (short-shipped → value claim, samples, GST).

**Tests:** scenarios H2 (GST clock), Q, W, Y, flow totals reconcile.

**Demo:** Performance shows Raju "9 vs 7 days · 2 days excluded: waiting for your buttons"; R-11 shows Amit's L/XL/XXL waiting on Raju.

### Slice 8b: Integration with orders, search and onboarding (M)
**Build:**
- **Orders**: deliveries as movements, cumulative partial receipts, `delivered_at` set when covered; returns; the `job_work` order ↔ job link; **`qty_done` opening-position migration** (dry-run first); "new" orders use Record payment while legacy milestones mirror into settlements (D1).
- **Job-work order card** gains Send material and Progress (J15).
- **Search**: process offerings searchable, results show "your history with them" (private).
- **Onboarding** step "What work does your unit do?" and first contact (S18).
- Store listing stock label; Home "Today" strip.

**Tests:** migration idempotency and no double count with later cumulative returns; **flag-on smoke covers the balance-due notice, the rating card and Trade Desk's overdue detection**; the flag-off order flow is unchanged.

**Demo:** Amit's order shows "400 of 600 received", the rating card appears once all 600 arrive, and a dyer search shows "you: 4 jobs, usually 6 days".

### Slice 9: Offline, polish and performance (M)
**Build:**
- IndexedDB outbox for create-only operations (incl. confirmations), per-row sync state, "Last updated", undo window from sync.
- Bundle check (Goods chunk ≤ 150 KB gz); 4× CPU-throttled pass.
- All strings in en/ta/hi, with the other seven languages via overlays; empty states; accessibility pass.

**Tests:** offline-retry idempotency; queued confirmations never 409; `i18n:check` 100%; budget check on the Goods route.

**Demo:** airplane mode → record two receipts and one confirmation → reconnect → each syncs once.

### Then Phase 7: final verification (BRIEF §9)
- Seed Scenarios A and B from `mockups/DATA.md` (marked demo, non-routable phones, WhatsApp off in demo, nightly reset), and run both end-to-end from every participant's account.
- Independent audit (correctness, isolation, UX, regressions); fix what it finds.
- Update `HANDOVER.md`, `BUILD_CONTRACT.md`, `DESIGN_SYSTEM.md` (incl. the token drift).

---

## 3. Order and dependencies

```
S0 ─► S0.5 ─► S1 ─► S2 ─► S3 ─► S4 ─► S4.5 ─► S5 ─► S6 ─► S7 ─► S8a ─► S8b ─► S9 ─► Phase 7
                     │                   │      ▲             ▲
                     │                   └──────┴─ S5 answers from S1–S4.5 data; S8a needs closed jobs (S4)
                     └─ S6 needs S2's assertions; S7 needs S2–S4.5 actions; S8b needs S2 (receipts) and S4 (jobs)
```
**Why this order:**
- S1 is the most valuable view with the least risk.
- S2 takes on the hardest correctness area (two-sided records) while the code is small.
- S3–S4.5 make every scenario recordable by form.
- Claire comes once there is real data to answer from.
- Reach, staff, reports, integration and offline build on all of that.

**Every scenario is assigned:**

| Scenario | Slice |
|---|---|
| A | S3, S4 |
| B | S3 |
| C | S3 |
| D | S4 |
| E | S2 (dispute), S4.5 (respec) |
| F | S3 |
| G | S3 |
| H | S4, S8a |
| I | S3 |
| J | S4.5, S8b |
| K | S1, S2 |
| L | S6 |
| M | S4.5 |
| N | S4.5 |
| O | S4 |
| P | S3 |
| Q | S8a |
| R | S3 |
| S | S3, S4.5 |
| T | S2 |
| U | S7 |
| V | S4 |
| W | S0.5, S8a |
| X | model only (UI v1.1) |
| Y | S3, S8a |
| Z | S4.5 |
| AA | S4.5 |
| AB | S4.5 |
| AC | S2, S4.5 |
| AD | S4, S4.5 |

**Demo stops for you:** after S1 (single player), S2 (two-sided), S4.5 (Scenarios A and B fully recordable by form) and S5 (Claire).

---

## 4. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| Breaking the live app near the hackathon deadline | Separate branch, flag off by default, no push without you; the flag-off smoke test in every slice; integration tests off the shared cluster until after the deadline |
| Free-tier LLM unreliable | Claire is S5; every Claire action also exists as a form; deterministic chips; optional paid tier with a cap (T1) |
| Ledger drift or conservation bugs | Pure core + property tests from S0; Σ = 0 per dimension asserted before commit; one `positions()` read path; verify job |
| Privacy leaks | Prices in a separate collection; per-line viewers; key-level sub-contract mask; isolation suite from all 30 scenarios; staff suite across **existing** routes in S7 |
| Nexconn targeted messages not persisted | Spike on S2 day 1, with the language-neutral card fallback designed in (04 §8.3) |
| Shared M0 cluster limits (storage, collections, throughput) | Photo caps, one test database per run, separate test cluster (T8), object storage before real users (T9) |
| Scope (30 scenarios, about 10 weeks) | Every scenario assigned above; consignment and multi-owner batch UI stay v1.1; demo stops let you re-prioritise |
| Tamil/Hindi wording wrong | Glossary marked *to verify*; field test of சரக்கு vs ஸ்டாக் and லாஸ் vs சேதாரம் before the flag goes on for real users |

---

## 5. Decisions for the checkpoint
- **B1:** slice order as above, S1 (single-player Out with others) after foundations and setup. Recommended.
- **B2:** demo stops after S1, S2, S4.5 and S5. I show you each, then continue unless you say stop. Recommended.
- **B3:** accept the honest estimate of about **9–11 weeks** for the full v1. If that is too long, the cut I'd suggest is to ship through S5 (about 6 weeks: recording, two-sided, job workers, in-house work, Claire) and defer S6–S9.

(Technical decisions T1–T9 are in `04-technical-design.md` §15.)

---

## 6. Red team
One review covered Phases 4 and 5; see `04-technical-design.md` §16. Changes to this plan:
- added S0.5, S4.5 and S8b (missing record forms, adjustments, setup, integration);
- split S8;
- moved the C, E and M tests to the slices that build their actions;
- assigned N;
- added the Nexconn spike, the staff guards on existing routes, migration-safety tests and a test-cluster plan;
- re-estimated from about 3 weeks to 9–11 weeks.
