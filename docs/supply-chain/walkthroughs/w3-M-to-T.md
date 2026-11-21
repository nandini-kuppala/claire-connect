# W3 · Scenario walkthroughs M–T

Walks scenarios **M, N, O, P, Q, R, S, T** (`01-domain-research.md` §7) through `02-domain-model.md` as written on 20 Nov 2026. Reviewer did not write the model. Only model vocabulary is used; anything the model lacks is used once, marked **(gap X)**, and listed in that scenario's gap table.

## Legend

| Item | Meaning |
|---|---|
| `[B]` / `[C:X]` | on-platform business / off-platform contact owned by business X |
| `H(spec·lot·grade \| owner/custodian/via/state)` | holding key (§3.3). `via —` = empty. States: `avail`, `alloc(J)`, `transit(MV)`, `disputed(D)`, `held(reason)`. `@loc` shown only to the custodian. |
| Units | Display units; all sums checked in base atoms (kg→g, m→cm, pc). |
| Evidence | `self`, `on_behalf`, `link`, `account` (§3.4); `rcv-only` = §4.1 receiver-first provisional |
| `(est)` | estimate per P10 |
| `EXT(X)` | **not in the model** — external source/sink for a party whose own stock nobody tracks (gap M-G3) |
| Calendars | 7-day (dyeing, knitting, compacting, flat-knit); 6-day (stitching, checking, embroidery, kaja, shops; Sunday off). Day 1 = the calendar day after the anchor. |
| Flags | Evaluated per calendar date: `due_soon` = expected − 1 d; `late` = date > expected and pending > 0; `very_late` = date > expected + band, band counted in the same calendar (assumption, gap M-G1). Templates from `research/lead-times-losses.md` §c. |

Weekdays used (2026): Tue 1 Sep, Mon 7 Sep, Fri 11 Sep, Mon 14 Sep, Mon 21 Sep, Thu 1 Oct, Mon 5 Oct, Mon 12 Oct (Sundays: 6, 13, 20, 27 Sep; 4, 11, 18 Oct).

---

## Scenario M — Procurement with partial and wrong delivery

### M.1 Setup

| Party | Kind | Role |
|---|---|---|
| Father (Fa) | [B], GST registered | buyer |
| T1 trims shop | [C:Fa], phone only | seller |

| Spec code | Spec | Unit |
|---|---|---|
| BTN | Button · polyester 4-hole · 18L · black | pc (entered as gross) |
| ZIP-BK | Zip · nylon coil #3 · 7" · closed-end · black | pc |
| ZIP-NV | Zip · nylon coil #3 · 7" · closed-end · navy | pc |

Lots: unlabelled (—). Order **O-M1** (kind purchase, T1): BTN 7,200 pc (50 gross), ZIP-BK 200 pc. Ordered **Fri 11 Sep**. Expected = order date + template "stock trims" 1 d → **Sat 12 Sep**, band +2 d, 6-day calendar (assumed; gap M-G1). Assumption: T1 sends 20 black zips as replacement with the second delivery.

### M.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Fri 11 Sep | Order O-M1 created (non-quantity) | Fa (self) | BTN 7,200 pc; ZIP-BK 200 pc | none. Order pending BTN 7,200, ZIP-BK 200; expected Sat 12 Sep |
| 2 | Sat 12 Sep | Movement MV-M1 · `purchase` T1→Fa · order O-M1 · title at_dispatch · receiver-first | Fa received (self); sent = rcv-only | L1 BTN 4,320 pc (30 gross); L2 ZIP-BK 180 pc; L3 ZIP-NV 20 pc | L1: −4,320 `EXT(T1)` → +4,320 H(BTN·—·A \| Fa/Fa/—/avail @godown). L2: −180 EXT(T1) → +180 H(ZIP-BK \| Fa/Fa/—/avail). L3: −20 EXT(T1) → +20 H(ZIP-NV \| Fa/Fa/—/held(wrong_spec)) **(gap M-G2)**. Order: BTN fulfilled 4,320, pending 2,880; ZIP-BK fulfilled 180, pending 20; L3 matches no order line (warning) |
| 3 | Sat 12 Sep | T1 opens Fa's statement link, taps **confirm** on MV-M1 lines | T1 (link) | L1 4,320; L2 180; L3 20 | none (s = r). Sent side evidence rcv-only → link |
| 4 | Mon 14 Sep | MV-M2 · `return` (purchase return) Fa→T1 · owner_after T1 | Fa sent (self); T1 confirms receipt via link (link) | ZIP-NV 20 pc | sent: −20 H(ZIP-NV \| Fa/Fa/held) → +20 H(ZIP-NV \| T1/Fa→T1/transit(MV-M2)); received: −20 transit → +20 EXT(T1) |
| 5 | Wed 16 Sep | MV-M3 · `purchase` T1→Fa · order O-M1 | Fa received (self); T1 confirms via link (link) | L1 BTN 2,880 pc (20 gross); L2 ZIP-BK 20 pc | −2,880 EXT(T1) → +2,880 H(BTN \| Fa/Fa/avail); −20 EXT(T1) → +20 H(ZIP-BK \| Fa/Fa/avail). Order O-M1 → fulfilled |

### M.3 Expected date and flags (procurement)

| Date | BTN pending | ZIP-BK pending | Flag (band in working days) | Flag if band counted in calendar days |
|---|---|---|---|---|
| Fri 11 Sep | 7,200 | 200 | `due_soon` (fires on the order day itself, gap M-G6) | same |
| Sat 12 Sep | 2,880 | 20 | none (expected day) | none |
| Sun 13 Sep | 2,880 | 20 | `late` (non-working day; flag still raised) | `late` |
| Mon 14 Sep | 2,880 | 20 | `late` | `late` (band end Mon 14) |
| Tue 15 Sep | 2,880 | 20 | `late` (band end: Mon 14 = 1, Tue 15 = 2) | **`very_late`** |
| Wed 16 Sep | 0 after MV-M3 | 0 | **`very_late`** until receipt, then cleared | `very_late` until receipt |

Result stored on O-M1: first receipt Sat 12 Sep (on time, 60 % of buttons, 90 % of black zips); last receipt Wed 16 Sep → actual lead **5 calendar days (4 working)** vs expected 1 d → **4 d late (3 working)**. Feeds Fa's Norm(T1, procurement, trims).

| | Procurement (M) | Processing (contrast) |
|---|---|---|
| Lives on | Order O-M1 (`expected_at`) | Job (`expected_at`) |
| Anchor | order date Fri 11 Sep | issue date |
| Pending | ordered − Σ received lines of the same spec | issued − outputs / yield (est) |
| Partial | measured to last receipt; first receipt shown | same |

### M.4 Participant views

| Participant | Moment | Owned @ own premises | Owned @ others | Held for others | Open orders/jobs (pending, expected, flag) | Must NOT see |
|---|---|---|---|---|---|---|
| Fa | Sat 12 Sep, after MV-M1 | BTN 4,320 (30 gross); ZIP-BK 180; ZIP-NV 20 *held: wrong colour, to return* | — | — | O-M1 / T1: BTN 2,880 (20 gross), ZIP-BK 20; exp Sat 12 Sep; due today. Evidence "Confirmed by link" after #3 | — |
| Fa | Tue 15 Sep | BTN 4,320; ZIP-BK 180; ZIP-NV 0 (return confirmed by link) | — | — | O-M1 pending BTN 2,880, ZIP-BK 20; `late` (very late tomorrow) | — |
| Fa | Wed 16 Sep | BTN 7,200; ZIP-BK 200 | — | — | O-M1 fulfilled; T1 lead 5 d vs 1 d | — |
| T1 (link only, no account) | Sat 12 Sep | not tracked | — | — | Link shows MV-M1 lines (30 gross, 180 black, 20 navy) with confirm/differs. Order pending (20 gross still owed) **not shown** (gap M-G5) | Fa's stock, other suppliers (T2), Fa's norm "T1 4 d late", Fa's notes, rates unless Fa shares |
| T1 | Wed 16 Sep | — | — | — | Link shows MV-M2 (20 navy returned, confirmed), MV-M3 | same |

### M.5 Balance check

| Line | Equation (§5.1 sent = received + weighing + disputed + transit) | Result |
|---|---|---|
| MV-M1 L1 BTN | 4,320 = 4,320 + 0 + 0 + 0 | 0 |
| MV-M1 L2 ZIP-BK | 180 = 180 + 0 + 0 + 0 | 0 |
| MV-M1 L3 ZIP-NV | 20 = 20 + 0 + 0 + 0 | 0 |
| MV-M2 ZIP-NV | 20 = 20 | 0 |
| MV-M3 L1 / L2 | 2,880 = 2,880; 20 = 20 | 0 |
| Order BTN | ordered 7,200 = 4,320 + 2,880 | 0 |
| Order ZIP-BK | ordered 200 = 180 + 20 | 0 |
| §5.5 Fa BTN | inflow 7,200 = holding 7,200 | 0 |
| §5.5 Fa ZIP-NV | inflow 20 − return 20 = holding 0 | 0 |
| EXT(T1) | BTN −7,200; ZIP-BK −200; ZIP-NV −20 + 20 = 0 | balances only with the proposed EXT bucket |

### M.6 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| M-G1 | §11 counts expected dates "in the process's calendar", but a purchase has no ProcessType; band unit (calendar vs working days) unstated → very_late is Tue 15 or Wed 16 Sep depending on reading. Same for O-CK in R (no template for agreed made-to-order dates). | Order gets `calendar` and `band_days` from the procurement template / supplier relationship (default 6-day for shops); band always counted in the same calendar. |
| M-G2 | 20 navy zips were never bought, but title_passes at_dispatch makes Fa their owner; the only state available is `held(wrong_spec)`. | Receiver line disposition `rejected_on_receipt`: owner stays seller (custody relation "Fa holds for T1"), cleared by a `return`. |
| M-G3 | §4.1 posts `−s H(owner_before T1, custodian T1)` but nobody tracks T1's stock → holding would go negative and §5.4 rejects it. Same for sales to contacts (P: W; M: return to T1) and for an on-platform seller that never recorded opening stock. §5.5 counts "purchases" as inflows but §4 names no bucket. | Pseudo-holding `EXTERNAL(party)` as source/sink for untracked parties, exempt from never-negative; opening-balance `found` adjustment for on-platform sellers. |
| M-G4 | §4.1 uses evidence `receiver_only`; §3.4 evidence enum is `self/on_behalf/link/account`. | Add `provisional` (receiver_only) to the enum, or keep `sent` null until asserted. |
| M-G5 | Statement link shows movement lines only; T1 cannot see "20 gross still owed" on O-M1. Assertions carry qty only, so "I sent 200 black, not navy" cannot be recorded. | Link also lists open order lines with pending + expected date; discrepancy kind `spec_mismatch` with spec positions. |
| M-G6 | `due_soon` = expected − 1 d fires on the order day for 1-day leads (noise). | Suppress due_soon when lead ≤ 1 d. |

---

## Scenario N — Bought but not collected (storage custody)

### N.1 Setup

| Party | Kind | Role |
|---|---|---|
| F fabric shop | [B] | seller, custodian |
| Father (Fa) | [B] | buyer, owner |

Spec SJ-BK = Knitted fabric · single jersey · finished · 180 GSM · 36" open · 100 % cotton · black. Lot **D-5120** (origin job_output of F's dye job; parent G-88). Grade A. Opening: H(SJ-BK·D-5120·A \| F/F/—/avail @F-godown) = 480.0 kg. Order O-N1 (sale/purchase, F↔Fa): 200.0 kg @ ₹340/kg = ₹68,000, paid (deal-room milestone; no payments in v1). Rolls ≈ 20 kg (secondary qty).

### N.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Mon 7 Sep | MV-N1 · `sale_in_place` · seller F, buyer Fa · from = to = F godown · order O-N1 | F (account); Fa accepts (account) | SJ-BK·D-5120·A 200.0 kg (10 rolls) | −200.0 H(… \| F/F/—/avail @F-godown) · +200.0 H(… \| Fa/F/—/avail). O-N1 fulfilled (title passed) |
| 2 | Tue 8 Sep | MV-N2 · `pickup` F→Fa (owner Fa unchanged) | F sent 60.0 (account); Fa received 59.4 (account) | 60.0 kg (3 rolls) | sent: −60.0 H(Fa/F/avail) → +60.0 H(Fa/F→Fa/transit(MV-N2)). received: −59.4 transit → +59.4 H(Fa/Fa/—/avail @Fa-godown). s − r = 0.6 kg = 1.0 % ≤ 1.5 % → −0.6 transit → +0.6 LOSS(weighing_difference, attributed Fa — "per terms" has no terms, gap N-G2) |
| 3 | Sat 12 Sep | ADJ-N1 · `count` by F of rack D-5120 @F-godown | F (self) | counted 418.5 kg vs book 420.0 (F own 280.0 + Fa 140.0) | Model has no rule for a commingled count (gap N-G1). Applied: −1.5 kg (0.36 %, within tolerance) to F's **own** holding → H(F/F) 278.5; counterpart ADJUSTMENT(count). Fa's 140.0 untouched |
| 4 | Tue 15 Sep | MV-N3 · `pickup` | F 80.0 (account); Fa 80.0 (account) | 80.0 kg (4 rolls) | −80.0 H(Fa/F/avail) → transit → +80.0 H(Fa/Fa/avail) |
| 5 | Sat 19 Sep | MV-N4 · `pickup` | F 60.0 (account); Fa 60.2 (account) | 60.0 kg (3 rolls) | −60.0 H(Fa/F) → transit → +60.2 H(Fa/Fa); s − r = −0.2 kg (gain 0.33 %, within tolerance) → LOSS(weighing_difference) −0.2 |

No expected dates: pickups are on demand (no Job, no open job-work line → no GST 1-year clock; correct, this is not job work).

### N.3 Participant views

| Participant | Moment | Owned @ own premises | Owned @ others | Held for others | Open | Must NOT see |
|---|---|---|---|---|---|---|
| F | Mon 7 Sep | SJ-BK D-5120 280.0 kg | — | Fa: SJ-BK D-5120 200.0 kg (since 7 Sep) | O-N1 fulfilled | Fa's other holdings, what Fa cuts from it, Fa's other suppliers |
| F | Tue 15 Sep | 278.5 kg (after count) | — | Fa: **200 → 140 → 60 kg** (pickups 8 Sep 60.0, 15 Sep 80.0; Fa's receipts 59.4, 80.0 visible as Fa's assertions) | — | same |
| F | Sat 19 Sep | 278.5 kg | — | Fa: 0 (relation closed) | — | same |
| Fa | Mon 7 Sep | — | **F: SJ-BK D-5120 200.0 kg** (bought ₹340/kg, since 7 Sep) | — | — | F's own 280 kg of the same lot, F's count, F's dye cost/dyer |
| Fa | Tue 15 Sep | 139.4 kg (59.4 + 80.0) | F: 60.0 kg | — | — | same |
| Fa | Sat 19 Sep | 199.6 kg | F: 0 | — | weighing differences −0.6 / +0.2 = −0.4 kg net | same |

### N.4 Balance check

| Check | Equation | Result |
|---|---|---|
| MV-N1 (ownership only) | −200.0 (F) + 200.0 (Fa) | 0 |
| MV-N2 | 60.0 = 59.4 + 0.6 + 0 + 0 | 0 |
| MV-N3 | 80.0 = 80.0 | 0 |
| MV-N4 | 60.0 = 60.2 + (−0.2) | 0 |
| Custody relation F-for-Fa | 200.0 − 60.0 − 80.0 − 60.0 | 0 |
| §5.5 Fa | inflow 200.0 = holding 199.6 + LOSS 0.4 | 0 |
| §5.5 F | opening 480.0 = sold 200.0 + holding 278.5 + ADJUSTMENT 1.5 | 0 |

### N.5 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| N-G1 | F counts one rack holding its own 280.0 kg and Fa's 140.0 kg of the same spec·lot. §4.3 has "owner counts own goods" and "custodian counts others' goods (assertion)" but no rule to split one physical count across owners; −1.5 kg was assigned to F by assumption. | Count on (spec, lot, custodian, location) total; within tolerance → custodian's own holding absorbs first; beyond → `count_mismatch` per affected owner, pro-rata, for the owner to accept. |
| N-G2 | §4.1 "LOSS(weighing_difference, attributed per terms)" — no terms field exists on Order, Movement or Relationship. | `terms.weighing_loss_bearer` (default: owner after the movement) on Relationship, overridable on Order. |
| N-G3 | `sale_in_place` has no physical sides; the sent/received assertions of §3.4 do not say what the buyer confirms. | Ownership-only movements carry `accepted {by, evidence, at}` instead of sent/received. |

---

## Scenario O — In-house QC sending rework back

### O.1 Setup

| Party | Kind | Role |
|---|---|---|
| Father (Fa) | [B] | principal; performer of in-house checking |
| S2 stitching unit | [B] | performer of J2 and J2R |

| Spec code | Spec |
|---|---|
| KIT | Cut kit · style FA-RN-160 · navy · {L, XL, XXL} (3 specs) |
| TEE | Tee · FA-RN-160 · navy · {L, XL, XXL} (3 specs; grade A / rework / scrap) |

Lot C-0904 (Fa's cut lot). Sizes L 480 · XL 400 · XXL 300 = 1,180.

| Job | Process (kind, rate basis) | Principal / performer | Plan | Expected |
|---|---|---|---|---|
| J2 | stitching (assembling, per_good_output_piece ₹13) | Fa / S2 | 1,180 KIT → 1,180 TEE A | Mon 7 Sep + 6 working d → **Mon 14 Sep**, band +4 |
| J-QC | checking (count_preserving) | Fa / self | 1,180 TEE A in | Tue 15 + 2 d → Thu 17 Sep |
| J2R | stitching alteration (count_preserving, ₹0), `rework_of = J2` | Fa / S2 | 60 TEE rework | Wed 16 + 3 working d (rework-loop default, gap O-G3) → **Sat 19 Sep** |

### O.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Mon 7 Sep | MV-O1 · `job_work_out` Fa→S2 · J2 | Fa sent (account); S2 received (account) | KIT·C-0904 L 480 / XL 400 / XXL 300 = 1,180 | −1,180 H(KIT \| Fa/Fa/—/avail @cutting) → transit → +1,180 H(KIT \| Fa/S2/—/alloc(J2)) |
| 2 | Sat 12 Sep | J2 output + MV-O2 · `job_work_return` S2→Fa | S2 output + sent (account); Fa received (account) | TEE A L 300 / XL 250 / XXL 150 = 700 | +700 H(TEE A \| Fa/S2/—/avail) → −700 → transit → +700 H(TEE A \| Fa/Fa/avail @packing). J2 pending ≈ 480 kits (est) |
| 3 | Mon 14 Sep | J2 output + MV-O3 · `job_work_return` | same | TEE A L 180 / XL 150 / XXL 150 = 480 | same pattern +480. J2 → completed; Fa closes: −1,180 H(KIT \| alloc(J2)) → +1,180 CONSUMED(J2). Bill 1,180 × ₹13 = ₹15,340 |
| 4 | Tue 15 Sep | J-QC in-house issue | Fa (self) | TEE A 1,180 | −1,180 H(TEE A \| Fa/Fa/avail) → +1,180 H(TEE A \| Fa/Fa/alloc(J-QC)) |
| 5 | Wed 16 Sep | J-QC outputs + closure | Fa (self) | TEE A L 455 / XL 380 / XXL 285 = 1,120; TEE rework L 25 / XL 20 / XXL 15 = 60 | +1,120 H(TEE A \| Fa/Fa/avail); +60 H(TEE rework \| Fa/Fa/avail); closure −1,180 alloc(J-QC) → +1,180 CONSUMED(J-QC) (same spec in and out, gap O-G4) |
| 6 | Wed 16 Sep | MV-O4 · `job_work_out` Fa→S2 · J2R (`rework_of J2`) (purpose ambiguous, gap O-G1) | Fa sent (account); S2 received (account) | TEE rework L 25 / XL 20 / XXL 15 = 60 | −60 H(TEE rework \| Fa/Fa) → transit → +60 H(TEE rework \| Fa/S2/—/alloc(J2R)) |
| 7 | Sat 19 Sep | J2R outputs + MV-O5 · `job_work_return` S2→Fa | S2 (account); Fa (account) | TEE A L 24 / XL 20 / XXL 14 = 58; TEE scrap L 1 / XXL 1 = 2 | +58 A, +2 scrap at S2 → transit → +58 H(TEE A \| Fa/Fa); +2 H(TEE scrap \| Fa/Fa). Closure −60 alloc(J2R) → CONSUMED(J2R) |
| 8 | Sat 19 Sep | ADJ-O1 · `write_off` | Fa (self) | TEE scrap 2 | −2 H(TEE scrap \| Fa/Fa) → +2 WRITTEN_OFF(scrap) |

Reconciliation against J2 (via `rework_of` + lot C-0904): 1,180 kits → S2 declared 1,180 A → QC 1,120 A + 60 rework → J2R 58 A + 2 scrap → **final 1,178 A, 2 scrap**. S2 rework rate 60/1,180 = 5.08 % (norm 4, flag > 10: ok); final reject 2/1,180 = 0.17 % (norm 1). J2 turnaround: first receipt Sat 12 Sep, last Mon 14 Sep = on time. J2R: on time (Sat 19 Sep).

### O.3 Participant views

| Participant | Moment | Owned @ own | Owned @ others | Held for others | Open (pending, expected, flag) | Must NOT see |
|---|---|---|---|---|---|---|
| Fa | Sat 12 Sep | TEE A 700 (L300/XL250/XXL150) | S2: KIT ≈ 480 (est = 1,180 − 700) | — | J2 exp Mon 14 Sep (due_soon Sun 13) | — |
| Fa | Wed 16 Sep, after #6 | TEE A 1,120 | S2: TEE rework 60 (J2R) | — | J2 closed, bill ₹15,340; J-QC closed (private); J2R pending 60, exp Sat 19 Sep | — |
| Fa | Sat 19 Sep | TEE A 1,178 | — | — | none; S2 rework rate 5.1 % | — |
| S2 | Sat 12 Sep | — | — | Fa: KIT ≈ 480 (est), alloc(J2) | J2 exp Mon 14 Sep, rate ₹13/good pc | J-QC, Fa's TEE stock, Fa's other stitcher S1 and its rates |
| S2 | Wed 16 Sep | — | — | Fa: TEE rework 60 (J2R, rework_of J2) | J2R exp Sat 19 Sep, ₹0; J2 bill ₹15,340 | how many passed QC (1,120), Fa's QC notes |
| S2 | Sat 19 Sep | — | — | Fa: 0 | none | same |

### O.4 Balance check

| Check | Equation | Result |
|---|---|---|
| MV-O1 per size | L 480 = 480; XL 400 = 400; XXL 300 = 300 | 0 |
| MV-O2 / MV-O3 | 700 = 700; 480 = 480 | 0 |
| J2 KIT (assembling primary) | issued 1,180 = outputs (700 + 480) + returned 0 + pending 0 + residual 0 | 0 |
| J-QC TEE (count_preserving), per size | L 480 = 455 + 25; XL 400 = 380 + 20; XXL 300 = 285 + 15 | residual 0 |
| MV-O4 | 60 = 60 | 0 |
| J2R TEE rework (count_preserving) | 60 = 58 + 2; L 25 = 24 + 1; XL 20 = 20; XXL 15 = 14 + 1 | residual 0 |
| MV-O5 | 60 = 60 | 0 |
| §5.5 Fa TEE (all grades) | inflow J2 1,180 = holding A 1,178 + WRITTEN_OFF 2 (J-QC and J2R outputs replace what they consume) | 0 |

### O.5 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| O-G1 | §3.4.1 lists "rework back to job worker" under `return`, but §4.2 says rejects are re-issued to a **new job** (which needs `job_work_out` for the challan/ITC-04). Two valid purposes for the same send. | Rework re-issue = `job_work_out` with `rework_of`; reserve `return` for ownership-changing returns (purchase/sales returns). |
| O-G2 | J2 is billed per good piece and was closed at 1,180 × ₹13 = ₹15,340; 2 pieces later scrapped in J2R → correct bill 1,178 × ₹13 = ₹15,314 (₹26). Closed J2 is never edited, so the deduction is manual. | Bill for `per_good_output_piece` follows `rework_of` descendants: final scrap of a rework job deducts from the parent's billable qty (shown as an agreed deduction). |
| O-G3 | ProcessType has one `default_turnaround_days`; the rework-loop defaults (alteration 3 d, topping 4 d, strip and re-dye 7 d) have no home, so J2R's 3 d is unsourced. | `rework_turnaround_days` (and `rework_extra_loss_pct`) on ProcessType. |
| O-G4 | A grade-only change (QC) needs a full in-house job: issue → outputs → CONSUMED 1,180 of a spec that never changed; "consumed" analytics double-count. Adjustment kinds have no `regrade`. | `count_preserving` jobs with identical in/out spec are excluded from consumption analytics, or add Adjustment kind `regrade {from_grade, to_grade, job_ref}`. |
| O-G5 | No rule whether rework found by the principal after J2 closed counts in S2's performance (rework % norm). | Performer metrics aggregate `rework_of` descendants back to the original job. |

---

## Scenario P — Job worker who is also a buyer (Lakshmi)

### P.1 Setup

| Party | Kind | Role |
|---|---|---|
| Lakshmi (L) | [B] stitching unit | performer for Ravi; buyer from F; maker; seller to W |
| Ravi (R) | [B] | principal |
| F fabric shop | [B] | seller |
| W wholesaler | [C:L] | buyer |

| Spec code | Spec | Owner |
|---|---|---|
| SJ-WH | Knitted fabric · SJ · finished · 180 GSM · 36" open · cotton · white, lot F-W-312 | F → L |
| R-KIT / R-TEE | Cut kit / Tee · style RV-RN-180 · white · {M, L, XL}, lot RC-11 | R |
| R-LBL | Main label · Ravi brand | R |
| L-KIT / L-TEE | Cut kit / Tee · style LK-PL-180 · white · {M, L, XL}, lot LC-03 | L |
| THR | Thread · spun poly · Tex 27 · white (m; cone = 5,000 m) | L; opening 400,000 m (80 cones) |
| WASTE | Cut waste · cotton · white (kg) | L |

| Job | Kind / rate | Principal / performer | Expected |
|---|---|---|---|
| JR | stitching, assembling; ₹13/good pc + L's thread (`jw_own_material`, BOM 130 m/pc, ₹0.035/m) | R / L | Mon 5 Oct + 6 working d → **Mon 12 Oct**, band +4 |
| JL1 | cutting, unit_changing; consumption 195 g/pc | L / self | Sat 3 Oct (same day) |
| JL2 | stitching, assembling (kits + THR 130 m/pc) | L / self | Mon 5 Oct + 6 working d → Mon 12 Oct |

### P.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Thu 1 Oct | MV-P1 · `sale`/`purchase` F→L · title at_dispatch · ₹330/kg | F sent 300.0 (account); L received 298.5 (account) | SJ-WH·F-W-312·A 300.0 kg (15 rolls) | −300.0 H(F/F/avail) → +300.0 H(L/F→L/transit) → +298.5 H(SJ-WH \| L/L/—/avail @cutting); 1.5 kg (0.50 %) → LOSS(weighing, L) |
| 2 | Sat 3 Oct | JL1 issue, outputs, by-product, closure (in-house) | L (self) | in SJ-WH 298.5 kg; out L-KIT M 450 / L 500 / XL 400 = 1,350; by-product WASTE 31.5 kg | −298.5 avail → +298.5 alloc(JL1); +1,350 H(L-KIT \| L/L/avail); +31.5 H(WASTE \| L/L/avail); closure −298.5 alloc → CONSUMED(JL1): est in panels 1,350 × 195 g = 263.25 kg, by-product 31.5, residual 3.75 kg (1.26 %) |
| 3 | Mon 5 Oct | MV-P2 · `job_work_out` R→L · JR | R sent (account); L received (account) | R-KIT·RC-11 M 300 / L 400 / XL 300 = 1,000; R-LBL 1,000 | −1,000 H(R-KIT \| R/R) → transit → +1,000 H(R-KIT \| R/L/—/alloc(JR)); same for R-LBL |
| 4 | Mon 5 Oct | JL2 in-house issue | L (self) | L-KIT 1,350; THR 180,000 m (36 cones) | −1,350 H(L-KIT \| L/L/avail) → alloc(JL2); −180,000 m H(THR \| L/L/avail) → alloc(JL2) |
| 5 | Sat 10 Oct | JR output 600 A + `jw_own_material` + MV-P3 · `job_work_return` L→R | L (account); R received (account) | R-TEE A M 180 / L 240 / XL 180 = 600; THR (L's own) 78,000 m | +600 H(R-TEE A \| R/L/avail) → transit → +600 H(R-TEE A \| R/R/avail). −78,000 m H(THR \| **L/L**/avail) → +78,000 CONSUMED(JR); bill line 78,000 × ₹0.035 = ₹2,730 |
| 6 | Mon 12 Oct | JR output 392 A + 8 reject + own thread + MV-P4 · `job_work_return` | L (account); R (account) | R-TEE A M 117 / L 157 / XL 118 = 392; reject M 3 / L 3 / XL 2 = 8; THR 52,000 m | +400 to R (as #5); −52,000 m H(THR \| L/L) → CONSUMED(JR) (₹1,820). JR completed; R closes: −1,000 R-KIT alloc(JR) → CONSUMED(JR); −1,000 R-LBL → CONSUMED(JR). Bill 992 × ₹13 = ₹12,896 + thread ₹4,550 = **₹17,446** |
| 7 | Tue 13 Oct | JL2 outputs, leftover, closure | L (self) | L-TEE A M 446 / L 497 / XL 397 = 1,340; B M 2 / L 2 / XL 2 = 6; reject M 2 / L 1 / XL 1 = 4; THR leftover 4,500 m (partial cones, est) | +1,340 A, +6 B, +4 reject H(L-TEE \| L/L/avail); THR −4,500 alloc(JL2) → +4,500 avail (kept_for_next); closure −1,350 L-KIT → CONSUMED(JL2); −175,500 m THR → CONSUMED(JL2). JL2 1 d late (own view only) |
| 8 | Wed 14 Oct | MV-P5 · `sale` L→W · title at_dispatch · ₹95/pc | L sent (account); W confirms via L's link Thu 15 Oct (link) | L-TEE A M 200 / L 220 / XL 180 = 600 | −600 H(L-TEE A \| L/L) → +600 H(W/L→W/transit) → −600 → +600 `EXT(W)` (gap M-G3) |

### P.3 Participant views

| Participant | Moment | Owned @ own premises ("mine") | Owned @ others | Held for others ("what I owe back") | Open (pending, expected, flag) | Must NOT see |
|---|---|---|---|---|---|---|
| L | Mon 5 Oct | L-KIT 1,350 (alloc JL2); THR 220,000 m avail + 180,000 m alloc(JL2); WASTE 31.5 kg | — | **Ravi:** R-KIT 1,000 (M300/L400/XL300), R-LBL 1,000 | JR exp Mon 12 Oct, ₹13/good pc; JL2 exp Mon 12 Oct | — |
| L | Sat 10 Oct | THR 142,000 m avail + 180,000 alloc; L-KIT 1,350 alloc(JL2); WASTE 31.5 kg | — | Ravi: R-KIT ≈ 400 (est), R-LBL ≈ 400 (est) | JR exp Mon 12 Oct (due_soon Sun 11); bill so far 600 × ₹13 + ₹2,730 = ₹10,530 | — |
| L | Wed 14 Oct | L-TEE A 740 (M246/L277/XL217), B 6, reject 4; THR 94,500 m; WASTE 31.5 kg | — | Ravi: 0 | due from Ravi ₹17,446; sold W 600 (confirmed by link 15 Oct) | — |
| R | Mon 5 Oct | — | **L:** R-KIT 1,000, R-LBL 1,000 (alloc JR) | — | JR exp Mon 12 Oct | L's own kits, tees, thread balance; F purchase; W sale; JL1/JL2 |
| R | Sat 10 Oct | R-TEE A 600 | L: R-KIT ≈ 400 (est), R-LBL ≈ 400 (est) | — | JR exp Mon 12 Oct, due_soon | same |
| R | Mon 12 Oct | R-TEE A 992, reject 8 | — | — | JR closed; bill ₹17,446 incl. L's thread 130,000 m (sees the consumed qty, not L's balance) | same |
| F | Thu 1 Oct | (F's own stock, not in scope) | — | — | MV-P1 300.0 sent / 298.5 received, weighing 1.5 kg within tolerance; O fulfilled | what L does with it; Ravi; W |
| W (link only) | Thu 15 Oct | not tracked | — | — | link: MV-P5 600 tees by size, confirm/differs; price only if L shares | anything else of L's |

Multi-role check: L never switches mode; "mine" vs "what I owe back" is only the `owner` dimension (§8). An attempt to sell 800 L-TEE A on 14 Oct would be refused by §5.4 (owner L has 1,340), even though R's tees (same building) once existed — selling Ravi's goods would require choosing owner R, which a `sale` by L cannot do.

### P.4 Balance check

| Check | Equation | Result |
|---|---|---|
| MV-P1 | 300.0 = 298.5 + 1.5 + 0 + 0 | 0 |
| JL1 SJ-WH (unit_changing) | issued 298,500 g = est 263,250 + by-product 31,500 + residual 3,750 | residual 3.75 kg (1.26 %); not-in-panels 35.25 kg = 11.8 % vs norm 12 ok. Output 1,350 vs planned 298.5 × 0.88 / 0.195 = 1,347 (+3) |
| MV-P2 | kits 1,000 = 1,000; labels 1,000 = 1,000 | 0 |
| JR R-KIT (assembling primary), per size | M 300 = 180 + 117 + 3; L 400 = 240 + 157 + 3; XL 300 = 180 + 118 + 2 | residual 0 |
| JR R-LBL (secondary, BOM 1) | 1,000 = 1,000 × 1 + leftover 0 | 0 |
| MV-P3 / MV-P4 | 600 = 600; 400 = 400 | 0 |
| JL2 L-KIT, per size | M 450 = 446 + 2 + 2; L 500 = 497 + 2 + 1; XL 400 = 397 + 2 + 1 | 0 |
| JL2 THR (secondary) | 180,000 = 1,350 × 130 (175,500) + kept_for_next 4,500 | residual 0 |
| L THR global | 400,000 = holding 94,500 + CONSUMED(JR) 130,000 + CONSUMED(JL2) 175,500 | 0 |
| L L-TEE global | 1,350 = A 740 + B 6 + reject 4 + sold 600 | 0 |
| MV-P5 | 600 = 600 | 0 (needs EXT(W)) |

### P.5 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| P-G1 | Sale to off-platform W: receipt would create H(W/W) in L's ledger that nobody will ever reduce. | Same as M-G3 (`EXTERNAL(party)` sink). |
| P-G2 | No new structural gap: owned vs held-for-others separation, own material in a principal's job (`jw_own_material` draws from L's own holding) and in-house jobs all post cleanly. One UX risk only: separation relies on the recorder picking the right owner when two owners' goods of similar specs sit in one building. | None needed in the model; keep §5.4 and default the owner from the job/order the line belongs to. |

---

## Scenario Q — Expected date hit by a cluster event

### Q.1 Setup

| Party | Kind | Role |
|---|---|---|
| Father (Fa) | [B] | principal |
| D Murugan Dyeing | [C:Fa] | performer J-Q1, J-Q2; member of the CETP closed 8–11 Oct |
| D2 dyer | [B] | performer J-Q3; on a **different** CETP |

| Spec code | Spec | Lot |
|---|---|---|
| GSJ | Knitted fabric · SJ · grey · 160 GSM · 30" tubular · cotton | G-41 (opening 650.0 kg at Fa) |
| GRIB | Rib 1×1 · grey · 220 GSM · cotton | GR-9 (opening 180.0 kg at Fa) |
| FSJ-NV / FSJ-WH | SJ · finished · navy 180 GSM / white 170 GSM · 36" open | DN-901 / DW-902 (job_output) |
| FRIB-BK | Rib · finished · black | DB-77 |

| Job | Performer | Shade class | Input | Turnaround source | Band | Calendar |
|---|---|---|---|---|---|---|
| J-Q1 | D | dark | GSJ 400.0 kg, issued Thu 1 Oct | **learned**: Fa's Norm(D, dyeing, dark) n = 4, lots 8/9/9/10 d, median 9 → (4·9 + 3·8)/(4+3) = 8.57 → 9 d (ceil, gap Q-G5) | +5 d | 7-day |
| J-Q2 | D | white | GSJ 250.0 kg, issued Tue 6 Oct | template 6 d | +3 d | 7-day |
| J-Q3 | D2 | dark | GRIB 180.0 kg, issued Sat 3 Oct | template 8 d | +5 d | 7-day |

Calendar events entered by Fa (fields not defined in the model, gap Q-G1): **CE1** "dyeing closed" Mon 5 Oct (cluster-wide strike, all dyers). **CE2** "CETP maintenance, dyeing closed" Thu 8–Sun 11 Oct (4 days), correct scope = D only. No other calendar events 1–21 Oct assumed.

### Q.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Thu 1 Oct | MV-Q1 · `job_work_out` Fa→D · J-Q1 | Fa sent (self); D taps OK on link (link) | GSJ·G-41 400.0 kg | −400.0 H(GSJ \| Fa/Fa/avail) → transit → +400.0 H(GSJ \| Fa/D/—/alloc(J-Q1)). Exp **Sat 10 Oct** |
| 2 | Sat 3 Oct | MV-Q3 · `job_work_out` Fa→D2 · J-Q3 | Fa (account); D2 (account) | GRIB·GR-9 180.0 kg | → +180.0 H(GRIB \| Fa/D2/—/alloc(J-Q3)). Exp **Sun 11 Oct** |
| 3 | Mon 5 Oct | CalendarEvent CE1 | Fa | — | no posting. J-Q1 10 → **11 Oct**; J-Q3 11 → **12 Oct** |
| 4 | Tue 6 Oct | MV-Q2 · `job_work_out` Fa→D · J-Q2 | Fa (self); D (link) | GSJ·G-41 250.0 kg | → +250.0 H(GSJ \| Fa/D/—/alloc(J-Q2)). Exp **Mon 12 Oct** (CE1 is before issue: no effect) |
| 5 | Wed 7 Oct | CalendarEvent CE2 (8–11 Oct, scope D) | Fa | — | no posting. J-Q1 11 → **15 Oct**; J-Q2 12 → **16 Oct**; J-Q3 stays 12 Oct |
| 6 | Tue 13 Oct | J-Q1 output (implied) + MV-Q4 · `job_work_return` D→Fa | Fa received (self); D's sent `on_behalf` (D's DC photo) | FSJ-NV·DN-901 180.0 kg (8 rolls) | +180.0 H(FSJ-NV \| Fa/D/avail) → transit → +180.0 H(FSJ-NV \| Fa/Fa/avail). J-Q1 pending = 400 − 180/0.91 = **202.2 kg grey (est)** |
| 7 | Wed 14 Oct | J-Q3 output + MV-Q5 · `job_work_return` D2→Fa | D2 (account); Fa (account) | FRIB-BK·DB-77 165.6 kg | → +165.6 H(FRIB-BK \| Fa/Fa/avail). Closure: −180.0 alloc(J-Q3) → CONSUMED; loss 14.4 kg (8.0 %) |
| 8 | Fri 16 Oct | J-Q2 output + MV-Q6 · `job_work_return` D→Fa | Fa (self); D on_behalf, then link confirm | FSJ-WH·DW-902 231.0 kg | → +231.0 H(FSJ-WH \| Fa/Fa/avail). Closure: −250.0 → CONSUMED; loss 19.0 kg (7.6 %) |
| 9 | Sat 17 Oct | J-Q1 output + MV-Q7 · `job_work_return` D→Fa | same | FSJ-NV·DN-901 186.0 kg | → +186.0 H(FSJ-NV \| Fa/Fa). Closure: −400.0 → CONSUMED; outputs 366.0, loss 34.0 kg (8.5 %) |

### Q.3 Expected-date recalculation (7-day calendar, day 1 = day after issue)

| Job | Count with events | Expected | Without events | Shift |
|---|---|---|---|---|
| J-Q1 (9 d) | 2,3,4 (1–3) · **5 skip** · 6,7 (4–5) · **8–11 skip** · 12,13,14,15 (6–9) | **Thu 15 Oct** | Sat 10 Oct | +5 d |
| J-Q2 (6 d) | 7 (1) · **8–11 skip** · 12–16 (2–6) | **Fri 16 Oct** | Mon 12 Oct | +4 d |
| J-Q3 (8 d), CE2 correctly out of scope | 4 (1) · **5 skip** · 6–12 (2–8) | **Mon 12 Oct** | Sun 11 Oct | +1 d |
| J-Q3 if CE2 entered literally as "dyeing closed" for all dyers | 4 (1) · 5 skip · 6,7 (2–3) · 8–11 skip · 12–16 (4–8) | Fri 16 Oct | — | +5 d (wrong) |

### Q.4 Flags by date

| Date | J-Q1 (exp 15 Oct, very_late > 20 Oct) | J-Q2 (exp 16 Oct, very_late > 19 Oct) | J-Q3 (exp 12 Oct, very_late > 17 Oct) |
|---|---|---|---|
| Fri 9 Oct | none (with no events it would be `due_soon`) | — | — |
| Sun 11 Oct | none | none | `due_soon` |
| Tue 13 Oct | none (180.0 received) | none | `late` (pending 180.0) |
| Wed 14 Oct | `due_soon` | none | received: **late 2 d** (within band) |
| Thu 15 Oct | due today | `due_soon` | — |
| Fri 16 Oct | `late` (≈ 202.2 kg grey est) | received: **on time** | — |
| Sat 17 Oct | received: **late 2 d** (within band) | — | — |

Honest metrics: without the events J-Q1 (exp 10 Oct, band to 15 Oct) would show **very_late** on 16–17 Oct and J-Q2 (exp 12 Oct, band to 15 Oct) **very_late** on 16 Oct. With CE2 mis-scoped, J-Q3 would show "on time" and hide a real 2-day delay. J-Q1 turnaround: raw 16 d (1 → 17 Oct), net of 5 event days 11 d; first receipt 13 Oct. Norm update with net 11 d: lots {8, 9, 9, 10, 11}, median 9, blend (5·9 + 3·8)/8 = 8.6 → 9 d (raw 16 d gives the same median here; not in general, gap Q-G4). Losses: J-Q1 8.5 % (dark norm 9), J-Q2 7.6 % (white 7), J-Q3 8.0 % — none flagged.

### Q.5 Participant views

| Participant | Moment | Owned @ own | Owned @ others | Held for others | Open (pending, expected, flag) | Must NOT see |
|---|---|---|---|---|---|---|
| Fa | Sun 4 Oct | GSJ 250.0 kg | D: GSJ 400.0 (J-Q1); D2: GRIB 180.0 (J-Q3) | — | J-Q1 exp Sat 10 Oct (learned 9 d); J-Q3 exp Sun 11 Oct (template) | — |
| Fa | Thu 15 Oct | FSJ-NV 180.0; FRIB-BK 165.6 | D: J-Q1 ≈ 202.2 kg grey (est), J-Q2 250.0 | — | J-Q1 due today, banner "shifted +5 d: strike 5 Oct, CETP 8–11 Oct"; J-Q2 due_soon; J-Q3 closed, late 2 d | — |
| Fa | Sat 17 Oct | FSJ-NV 366.0; FSJ-WH 231.0; FRIB-BK 165.6 | — | — | all closed; J-Q1 late 2 d, J-Q2 on time, J-Q3 late 2 d | — |
| D (link only) | Thu 15 Oct | not tracked | — | (as custodian, via link) Fa's open lines MV-Q1 400.0, MV-Q2 250.0, returned 180.0 | can confirm, mark "differs", propose "sent 186 today" | D2, J-Q3, Fa's norm about D, Fa's calendar events, other principals |
| D2 | Sun 4 Oct | — | — | Fa: GRIB 180.0 alloc(J-Q3) | J-Q3 exp Sun 11 Oct — date computed from **Fa's** template/calendar; D2's own strike entry ignored (gap Q-G3) | Fa's jobs at D, Fa's norms, CE2 |
| D2 | Wed 14 Oct | — | — | Fa: 0 | J-Q3 closed; loss 14.4 kg (8.0 %); late 2 d? (whether D2 sees Fa's flag is undefined, gap Q-G3) | same |

### Q.6 Balance check

| Check | Equation | Result |
|---|---|---|
| MV-Q1 / MV-Q2 / MV-Q3 | 400.0 = 400.0; 250.0 = 250.0; 180.0 = 180.0 | 0 |
| J-Q1 (mass_losing) | 400.0 = 180.0 + 186.0 + loss 34.0 | 0 (8.5 %) |
| J-Q2 | 250.0 = 231.0 + 19.0 | 0 (7.6 %) |
| J-Q3 | 180.0 = 165.6 + 14.4 | 0 (8.0 %) |
| §5.5 Fa GSJ | opening 650.0 = CONSUMED 400.0 + 250.0 | 0 |
| Returns | MV-Q4 180.0, MV-Q5 165.6, MV-Q6 231.0, MV-Q7 186.0 — each sent = received | 0 |

### Q.7 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| Q-G1 | `CalendarEvent` is named (§2, §11) but has no fields: no owner, no scope. Entered literally ("dyeing closed 8–11 Oct"), CE2 shifts D2 12 → 16 Oct and hides a 2-day delay. | `CalendarEvent {owner (business or platform cluster), scope: process_types[] + counterparties[] or region/CETP group, dates[], reason}`. |
| Q-G2 | §3.5 stores `expected_at`; §11 computes it. A shift must not erase the original promise (10 Oct). | Store `expected_base` (promise) and derive `expected_effective` from calendar + pauses; show "shifted +5 d (reason)". |
| Q-G3 | The job is shared, but its date comes from Fa's private norm and events. D2 sees a date it did not agree to, and its own strike entry is ignored. Unclear whether D2 sees Fa's "late" flag. | Job carries a shared `agreed_at`; each party computes its own expected date and flags from its own norms/events; flags are per viewer. |
| Q-G4 | Unstated whether norms learn raw turnaround (16 d) or net of events/pauses (11 d); repeated crises skew the norm. | Norms learn net working-day turnaround. |
| Q-G5 | Blend gives 8.57 d; rounding unstated. | Round up to whole days (matches research "rounded up a little"). |

---

## Scenario R — Polo: parallel component flows and a post-stitch job-work step

### R.1 Setup

| Party | Kind | Role |
|---|---|---|
| M manufacturer | [B], GST registered | principal, owner throughout |
| DY dyer | [B] | J-DY |
| CP compactor | [C:M] | J-CP |
| CK flat-knit unit | [B] | seller of collar/cuff sets (direct delivery to S4) |
| S4 stitcher | [B] | J-S4 |
| KB kaja unit | [C:M] (S4 also keeps its own contact "KB′" for the same unit) | J-KB |

| Spec code | Spec | Lot |
|---|---|---|
| GPQ | Pique · grey · 200 GSM · 40" tubular · cotton | G-31 (opening 420.0 kg at M) |
| DPQ | Pique · dyed, not compacted · navy | DN-77 ← G-31 |
| CPQ | Pique · finished compacted · 220 GSM · navy | CN-77 ← DN-77 |
| P-KIT | Cut kit (front, back, 2 sleeves) · M-PL-220 · navy · {S, M, L, XL, XXL} | CL-12 ← CN-77 |
| CC | Collar + 2 cuffs set · flat-knit · navy · size (counted per set) | CK-551 |
| P-ST / P-FN | Polo · M-PL-220 · navy · size · stitched / finished (buttonholed, 3 buttons) | — |
| BTN-P | Button · 4-hole · 16L · navy | — (opening 3,672 at M) |
| WASTE-PQ | Cut waste · navy pique (kg) | — |

Run RUN-R1: 1,200 polos, S 150 / M 300 / L 350 / XL 250 / XXL 150. Order O-CK (purchase, CK, ship-to S4): 1,200 CC, same size split, ordered Tue 1 Sep, agreed lead 10 d → **Fri 11 Sep**, band +4 (made-to-order template, see M-G1), 7-day.

| Job | Kind, rate | Expected |
|---|---|---|
| J-DY | dyeing dark, mass_losing, ₹90/kg input | Tue 1 Sep + 8 → Wed 9 Sep, band +5 |
| J-CP | compacting, mass_losing, ₹8/kg input | receipt Tue 8 Sep + 2 → Thu 10 Sep, band +2 |
| J-CUT | cutting in-house, unit_changing; g/pc S 235, M 255, L 275, XL 295, XXL 315 | in-house |
| J-S4 | stitching, assembling; ₹32/good pc; inputs P-KIT + CC (BOM 1) | Mon 14 Sep + 6 working d → Mon 21 Sep; with pause → Wed 23 Sep, band +4 |
| J-KB | kaja, count_preserving on polos; buttons BOM 3/pc; ₹3/output pc; agreed 3 d | anchored on last polo arrival Wed 23 Sep → **Sat 26 Sep** (anchor undefined, gap R-G4) |

### R.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Tue 1 Sep | MV-R1 · `job_work_out` M→DY · J-DY; Order O-CK created | M (account); DY (account) | GPQ·G-31 420.0 kg | −420.0 H(GPQ \| M/M/avail) → transit → +420.0 H(GPQ \| M/DY/—/alloc(J-DY)) |
| 2 | Tue 8 Sep | J-DY output declared | DY (account) | DPQ·DN-77 383.0 kg | +383.0 H(DPQ \| M/DY/—/avail) |
| 3 | Tue 8 Sep | MV-R2 · `hop` DY→CP (M's instruction; output of J-DY → input of J-CP). `to` = performer of J-CP (gap R-G1) | DY sent 383.0 (account); CP received 381.6 via M's link (link) | DPQ·DN-77 | −383.0 H(DPQ \| M/DY) → transit → +381.6 H(DPQ \| M/CP/**via —** (gap R-G2)/alloc(J-CP)); 1.4 kg (0.37 %) → LOSS(weighing). J-DY closure: −420.0 alloc → CONSUMED; loss 37.0 kg (8.81 %). Turnaround end = hop sent date (gap R-G7) |
| 4 | Thu 10 Sep | J-CP output + MV-R3 · `job_work_return` CP→M | M received (self); CP output/sent on_behalf, confirmed by link | CPQ·CN-77 378.0 kg | +378.0 H(CPQ \| M/CP) → transit → +378.0 H(CPQ \| M/M/avail @cutting). J-CP closure: −381.6 → CONSUMED; loss 3.6 kg (0.94 %) |
| 5 | Fri 11–Sat 12 Sep | J-CUT in-house: issue, outputs, by-product, closure | M (self) | in CPQ 378.0 kg; out P-KIT S 153 / M 306 / L 357 / XL 255 / XXL 153 = 1,224; WASTE-PQ 38.4 kg | −378.0 avail → alloc(J-CUT); +1,224 H(P-KIT \| M/M/avail); +38.4 H(WASTE-PQ \| M/M); closure → CONSUMED: est 335.58 kg, by-product 38.4, residual 4.02 kg (1.06 %) |
| 6 | Mon 14 Sep | MV-R4 · `job_work_out` M→S4 · J-S4 | M (account); S4 (account) | P-KIT S 150 / M 300 / L 350 / XL 250 / XXL 150 = 1,200 | → +1,200 H(P-KIT \| M/S4/—/alloc(J-S4)). §10.6 kit check: CC 0/1,200 → J-S4 Pause `waiting_input` from 14 Sep |
| 7 | Tue 15 Sep | MV-R5 · `direct_delivery` CK→S4 · seller CK, buyer M · order O-CK · line tagged J-S4 · title at_dispatch | CK sent (account); S4 received (account) | CC·CK-551 S 150 / M 300 / L 250 = 700 | −700 H(CC \| CK/CK/avail) → +700 H(CC \| M/CK→S4/transit) → +700 H(CC \| M/S4/—/alloc(J-S4)). S, M complete; L 250/350; XL, XXL 0 → pause stays (job-level, gap R-G3) |
| 8 | Thu 17 Sep | MV-R6 · `direct_delivery` CK→S4 | CK (account); S4 (account) | CC L 100 / XL 250 / XXL 150 = 500 | → alloc(J-S4). Kits complete → pause ends; J-S4 exp 21 → **Wed 23 Sep**. O-CK fulfilled |
| 9 | Sat 19 Sep | MV-R7 · `job_work_out` M→KB · J-KB | M sent (self); KB via link (link) | BTN-P 3,672 (3 × 1,200 + 2 %) | −3,672 H(BTN-P \| M/M) → +3,672 H(BTN-P \| M/KB/—/alloc(J-KB)) |
| 10 | Mon 21 Sep | J-S4 output + MV-R8 · `hop` S4→KB | S4 (account; `to` = its own contact KB′, gap R-G1); KB confirms on M's link (link) | P-ST A S 150 / M 300 / L 150 = 600 | +600 H(P-ST \| M/S4/avail) → transit → +600 H(P-ST \| M/KB/—/alloc(J-KB)) |
| 11 | Wed 23 Sep | J-S4 output + MV-R9 · `hop` S4→KB | same | P-ST A L 200 / XL 250 / XXL 150 = 600 | as #10. J-S4 completed; M closes: −1,200 P-KIT → CONSUMED(J-S4); −1,200 CC → CONSUMED(J-S4). Bill 1,200 × ₹32 = ₹38,400 |
| 12 | Thu 24 Sep | J-KB output + MV-R10 · `job_work_return` KB→M (ITC-04 5B: back from a job worker other than the one the kits went to) | M received (self); KB sent on_behalf | P-FN A S 150 / M 300 / L 150 = 600 | +600 H(P-FN \| M/KB) → transit → +600 H(P-FN \| M/M/avail @packing) |
| 13 | Sat 26 Sep | J-KB output + MV-R11 · `job_work_return` KB→M (+ leftover buttons); scrap declared | M (self); KB on_behalf, confirmed by link | P-FN A L 200 / XL 250 / XXL 150 = 600; BTN-P leftover 60; BTN-P scrap 12 (broken) | +600 P-FN → M; −60 alloc(J-KB) → +60 H(BTN-P \| M/M/avail); −12 → WRITTEN_OFF(scrap at KB); closure −1,200 P-ST → CONSUMED(J-KB); −3,600 BTN-P → CONSUMED(J-KB). Bill 1,200 × ₹3 = ₹3,600 |

Spare kits: M keeps P-KIT 24 (S 3 / M 6 / L 7 / XL 5 / XXL 3) at own premises.

### R.3 Expected dates and flags

| Item | Expected | Actual | Flag |
|---|---|---|---|
| J-DY | Wed 9 Sep | output hopped Tue 8 Sep | on time |
| J-CP | Thu 10 Sep | Thu 10 Sep | on time |
| O-CK (procurement) | Fri 11 Sep; band to Tue 15 Sep | 700 on 15 Sep, 500 on 17 Sep | `late` 12–15 Sep; `very_late` 16 Sep; final **6 d late** (first receipt 15 Sep) |
| J-S4 | Mon 21 Sep → **Wed 23 Sep** (paused 15–16 Sep: 17,18,19,21,22,23 = days 1–6, Sun 20 skipped) | first 21 Sep, last 23 Sep | on time |
| J-KB | Sat 26 Sep (anchor 23 Sep: 24, 25, 26) | first 24 Sep, last 26 Sep | on time. If anchored on first issue (buttons 19 Sep → 21, 22, 23) exp Wed 23 Sep → falsely **late 3 d** (gap R-G4) |

### R.4 Participant views

| Participant | Moment | Owned @ own | Owned @ others | Held for others | Open (pending, expected, flag) | Must NOT see |
|---|---|---|---|---|---|---|
| M | Tue 15 Sep | P-KIT 24; WASTE-PQ 38.4 kg; BTN-P 3,672 | S4: P-KIT 1,200 + CC 700 (from CK) | — | O-CK: 500 CC pending (L 100, XL 250, XXL 150), exp 11 Sep, `late`, very late tomorrow. J-S4 `waiting_input` (missing CC for L 100, XL 250, XXL 150), exp moves daily (base Mon 21 Sep) | — |
| M | Wed 23 Sep | P-KIT 24; WASTE 38.4 kg | KB: P-ST 1,200 (600 since 21 Sep, 600 since 23 Sep), BTN-P 3,672 | — | J-KB exp Sat 26 Sep; J-S4 completed (₹38,400); O-CK fulfilled, 6 d late | — |
| M | Sat 26 Sep | P-FN A 1,200; BTN-P 60; P-KIT 24; WASTE 38.4 kg | — | — | all closed; buttons scrap 12 (0.33 %) | — |
| DY | Tue 8 Sep | — | — | M: 0 after hop | J-DY closed; bill 420 kg × ₹90 = ₹37,800; sees CP's receipt 381.6 on MV-R2 (DY is from party) | J-CP output and loss, CK, S4, KB, every rate but its own |
| CP (link only) | Thu 10 Sep | — | — | via link: MV-R2 in 383.0 / confirmed 381.6; MV-R3 out 378.0 | J-CP open until 10 Sep | DY's rate or loss, everything downstream |
| CK | Tue 15 Sep | (own CC stock: 500 left, assumed tracked) | — | — | O-CK sale to M: 700 delivered to S4 (confirmed by S4), 500 pending, `late` | J-S4, S4's rate, M's other stock |
| CK | Thu 17 Sep | — | — | — | O-CK fulfilled, 6 d late | same |
| S4 | Tue 15 Sep | — | — | M: P-KIT 1,200; CC 700. Kit check: S 150/150, M 300/300, L 250/350, XL 0/250, XXL 0/150 | J-S4 `waiting_input`, rate ₹32 | **CK's price on MV-R5 line** (line `rate` visible to movement parties, gap R-G6), J-KB, BTN-P issue, J-DY/J-CP |
| S4 | Wed 23 Sep | — | — | M: 0 | J-S4 completed, ₹38,400; hops MV-R8/R9 to "KB′" | KB's rate ₹3 |
| KB (link only) | Wed 23 Sep | — | — | via M's link: BTN-P 3,672; P-ST 600 + 600 (from S4) | can propose returns ("600 sent today") | S4's rate, CK. Also gets S4's link for KB′ → duplicate confirmations (gap R-G1) |

### R.5 Balance check

| Check | Equation | Result |
|---|---|---|
| MV-R1 | 420.0 = 420.0 | 0 |
| MV-R2 | 383.0 = 381.6 + weighing 1.4 | 0 |
| MV-R3 | 378.0 = 378.0 | 0 |
| J-DY (mass_losing) | 420.0 = 383.0 + loss 37.0 | 0 (8.81 %, norm 9) |
| J-CP | 381.6 = 378.0 + 3.6 | 0 (0.94 %, norm 1) |
| J-CUT (unit_changing) | 378,000 g = est (153·235 + 306·255 + 357·275 + 255·295 + 153·315 = 335,580) + 38,400 + residual 4,020 | residual 4.02 kg (1.06 %); not in panels 42.42 kg = 11.2 % (norm 12). Output 1,224 vs run 1,200 = +2 % allowance (normal, §5.3) |
| MV-R4 per size | 150/300/350/250/150 = same | 0 |
| MV-R5 + MV-R6 | 700 + 500 = 1,200 = O-CK ordered | 0 |
| J-S4 P-KIT | 1,200 = outputs 600 + 600 + pending 0 | residual 0 |
| J-S4 CC (BOM 1) | 1,200 = 1,200 × 1 + leftover 0 | 0 |
| MV-R8, R9, R10, R11 | 600 each, sent = received | 0 |
| J-KB P-ST (count_preserving) | 1,200 = 1,200 | residual 0 |
| J-KB BTN-P (secondary) | 3,672 = 1,200 × 3 (3,600) + leftover 60 + scrap 12 | residual 0 |
| §5.5 M P-KIT | 1,224 = CONSUMED(J-S4) 1,200 + holding 24 | 0 |
| §5.5 M BTN-P | 3,672 = CONSUMED 3,600 + WRITTEN_OFF 12 + holding 60 | 0 |
| Run | P-FN A 1,200 = target 1,200 | 0 |

### R.6 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| R-G1 | KB and CP are M's private contacts (§7). S4 must record a hop to "KB" but cannot see M's contact, so it makes its own contact KB′: two ids for one unit, the hop's `to` ≠ J-KB's performer, and KB gets two statement links with the same lines. Same for DY→CP. | A movement line tagged with a job may set `to = job.performer` by reference; movement parties see a display snapshot (name, town) only, the contact record stays private. |
| R-G2 | `hop` covers both owner-instructed hops (DY→CP, S4→KB) and sub-contracting (S1→H), but §4.1 sets `via = sender` for every hop. | `via = from` only when the receiving job has `parent_job_id`; owner-instructed hops leave via empty. |
| R-G3 | `waiting_input` pauses the whole job, though S and M were complete and stitchable on 15 Sep; the clock stops for all sizes (21 → 23 Sep). | Pause scoped to matrix lines, or count a day as paused only when no line is startable. |
| R-G4 | "Expected = issue date + turnaround" is undefined when inputs arrive at different dates (buttons 19 Sep, polos 21 + 23 Sep): 23 Sep vs 26 Sep → a false "late 3 d". | Anchor = receipt of the job's primary input line (last tranche for partial issues); secondary inputs do not start the clock. |
| R-G5 | §11 GST 1-year clock sits on open job-work **input lines**. J-DY and J-S4 close (inputs consumed) while M's goods are still at CP / KB, so the clock disappears before goods return to M (5B). | Clock follows the original challan line through lineage until a `job_work_return` reaches the principal (or deemed supply). |
| R-G6 | Movement line has `rate?`/`value?`; §7 lets every physical party see the movement, so S4 would see CK's sale price on MV-R5 (and D sees K's price in S). | Line rate/value visible only to commercial parties (seller, buyer). |
| R-G7 | Turnaround end for a job whose output hops onward (J-DY) is undefined: output declaration, hop sent, or next receipt. | Ends at the hop's `sent` date (or output declaration if earlier). |
| R-G8 | `per_input_mass` billing does not say which assertion counts: CP bills 381.6 × ₹8 = ₹3,052.80 (received) or 383.0 × ₹8 = ₹3,064.00 (sent). | Billable input mass = the performer's received assertion, unless agreed otherwise on the job. |

---

## Scenario S — Supplier delivers straight to the job worker

### S.1 Setup

| Party | Kind | Role |
|---|---|---|
| Father (Fa) | [B], GST registered | buyer; principal of J-S |
| K knitter | [B] | seller |
| D Murugan Dyeing | [C:Fa] | performer of J-S; ship-to |

Specs: GSJ (grey SJ 160 GSM 30" tubular cotton), lot **GK-208**; K's opening H(GSJ·GK-208 \| K/K/avail) = 1,250.0 kg. FSJ-NV (finished navy), lot DN-512 ← GK-208.
Order O-S (purchase, K): 400.0 kg @ ₹260/kg = ₹1,04,000, ship-to D, ordered Mon 7 Sep; procurement template grey fabric 2 d → Wed 9 Sep. Documents travelling with the goods: K's tax invoice INV-K-1182 **and** Fa's job-work DC FA/26-27/0412 (gap S-G1).
Job J-S: dyeing dark, Fa / D, ₹90/kg input, template 8 d, band +5, 7-day; anchor = D's receipt (gap S-G2).

### S.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Mon 7 Sep | Order O-S; Job J-S planned (input line: GSJ 400.0 kg via direct delivery) | Fa (self) | GSJ 400.0 kg | none |
| 2 | Mon 7 Sep | MV-S1 · `direct_delivery` · seller K, buyer Fa · from K → to D · title at_dispatch · line tagged J-S · order O-S | K sent 400.0 (account) | GSJ·GK-208·A 400.0 kg (18 rolls) | −400.0 H(GSJ \| K/K/avail) → +400.0 H(GSJ \| **Fa**/K→D/transit(MV-S1)). O-S fulfilled (title passed) |
| 3 | Tue 8 Sep | D receives; taps **"Quantity differs: 397"** on Fa's statement link | D (link) | 397.0 kg | −397.0 transit → +397.0 H(GSJ \| Fa/D/—/alloc(J-S)); 3.0 kg (0.75 %) within tolerance → +3.0 LOSS(weighing, Fa — title passed; "per terms" undefined, N-G2). J-S → issued. **GST 1-year clock starts Tue 8 Sep 2026** (§4.1) |
| 4 | Wed 16 Sep | J-S output (implied) + MV-S2 · `job_work_return` D→Fa | Fa received 365.2 (self); D's sent on_behalf, D confirms on link | FSJ-NV·DN-512 365.2 kg (16 rolls) | +365.2 H(FSJ-NV \| Fa/D/avail) → transit → +365.2 H(FSJ-NV \| Fa/Fa/avail @godown). Closure: −397.0 alloc(J-S) → CONSUMED; loss 31.8 kg (8.01 %). GST clock closed (day 8) |

### S.3 Dates

| Item | Anchor | Expected | Actual | Flag |
|---|---|---|---|---|
| O-S (procurement) | order Mon 7 Sep + 2 d | Wed 9 Sep | delivered to D Tue 8 Sep | on time |
| J-S (processing), anchor D's receipt | Tue 8 Sep + 8 | **Wed 16 Sep** (very_late from Tue 22 Sep) | Wed 16 Sep | on time |
| J-S if anchored on K's dispatch | Mon 7 Sep + 8 | Tue 15 Sep | Wed 16 Sep | late 1 d (wrong, gap S-G2) |
| GST clock (had J-S stayed open) | Tue 8 Sep 2026 | 1-year mark Wed 8 Sep 2027; alerts day 300 Mon 5 Jul 2027, day 330 Wed 4 Aug 2027, day 350 Tue 24 Aug 2027 | closed 16 Sep 2026 | — |

### S.4 Participant views

| Participant | Moment | Owned @ own | Owned @ others | Held for others | Open | Must NOT see |
|---|---|---|---|---|---|---|
| Fa | Mon 7 Sep (evening) | — | in transit K→D: GSJ 400.0 kg, shown "at D, unconfirmed" | — | O-S dispatched; J-S planned | K's own stock |
| Fa | Tue 8 Sep | — | **D: GSJ·GK-208 397.0 kg** (J-S, exp Wed 16 Sep; GST clock day 0, mark 8 Sep 2027); weighing −3.0 kg recorded | — | J-S issued | — |
| Fa | Wed 16 Sep | FSJ-NV 365.2 kg | — | — | J-S closed, 8.01 %; bill 397.0 × ₹90 = ₹35,730 (or 400.0 × ₹90 = ₹36,000, R-G8). Grey never at Fa's premises | — |
| K | Mon 7 Sep | GSJ·GK-208 850.0 kg | — | — | sale O-S 400.0 kg to Fa, ship-to D | J-S (rate, output, loss), Fa's other holdings, D's contact record (sees ship-to name/address only, gap S-G4) |
| K | Tue 8 Sep | 850.0 kg | — | — | D's receipt 397.0 "Confirmed by link"; within-tolerance difference 3.0 kg on its sale line | same |
| D (link only) | Tue 8 Sep | not tracked | — | via link: Fa's GSJ 400.0 kg inbound from K → marked 397 | J-S open | K's price ₹260/kg on the line (R-G6), Fa's other dyers |
| D (link) | Wed 16 Sep | — | — | Fa: 0 | MV-S2 365.2 confirmed | same |

### S.5 Balance check

| Check | Equation | Result |
|---|---|---|
| MV-S1 | sent 400.0 = received 397.0 + weighing 3.0 + disputed 0 + transit 0 | 0 |
| J-S (mass_losing) | 397.0 = 365.2 + loss 31.8 | 0 (8.01 %, dark norm 9, low floor 4) |
| MV-S2 | 365.2 = 365.2 | 0 |
| §5.5 Fa GSJ | inflow 400.0 = CONSUMED 397.0 + LOSS 3.0 | 0 |
| §5.5 Fa FSJ-NV | output 365.2 = holding 365.2 | 0 |
| §5.5 K GSJ | 1,250.0 = 850.0 + sold 400.0 | 0 |
| Order O-S | ordered 400.0 = sent 400.0 (title at dispatch) | 0 |

### S.6 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| S-G1 | One physical shipment carries two documents from two issuers (K's tax invoice, Fa's job-work DC); movement header has a single `dc`. | `documents[]: {kind: tax_invoice \| dc \| ewb \| lr, number, date, issuer_party, photo_url}`. |
| S-G2 | §4.1 starts the GST clock at D's receipt, but §11 anchors processing dates on "issue date" — 7 Sep (exp 15 Sep, falsely late 1 d) or 8 Sep (exp 16 Sep). | Processing expected date anchors on the performer's receipt of the primary input (same as R-G4), consistent with the GST clock. |
| S-G3 | Had D's 397 been beyond tolerance, the physical sides (K sender, D receiver) differ from the bearer of the commercial claim (Fa vs K); a discrepancy has `parties[]` and `positions[]` but no "who bears". | Discrepancy gets `bearer` derived from title_passes + terms; buyer/owner Fa auto-included even when not a physical side. |
| S-G4 | K must see where to deliver, but D is Fa's private contact (§7). | Same as R-G1: display snapshot (name, address) on the movement; contact record private. |

---

## Scenario T — Parcel shortage and detention (in transit)

### T.1 Setup

| Party | Kind | Role |
|---|---|---|
| M manufacturer (Tamil Nadu) | [B], GST registered | seller; principal of J-T |
| W wholesaler (Kochi, Kerala) | [B] | buyer |
| TP parcel service | [C:M], `transporter` | carrier for both consignments |
| EB embroidery unit (Bengaluru, Karnataka) | [C:M] | performer of J-T |

| Spec code | Spec |
|---|---|
| VST | Vest · rib 1×1 · white · {85, 90, 95} cm (pc; box = 12 pc, solid boxes) |
| FP / FP-E | Cut front panel · M-TS-01 · black · L / same, embroidered chest logo |

Sale O-T: W, VST 85: 432 (36 boxes) / 90: 480 (40) / 95: 288 (24) = 1,200 pc = 100 boxes, ₹62/pc = ₹74,400; terms ex-works, freight to-pay → `title_passes = at_dispatch` (main walk). EWB recorded (inter-state, > ₹50,000). LR 77815.
Job J-T: embroidery, count_preserving, ₹6/pc, template 4 d, band +3, 6-day; inter-state job work, **no EWB** (LR 77840, 1 box).

### T.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Mon 21 Sep | MV-T1 · `sale` M→W · transport {TP, LR 77815, 100 boxes} · title at_dispatch | M sent (account) | VST 85: 432; 90: 480; 95: 288 (secondary 36/40/24 boxes) | −1,200 H(VST \| M/M/avail @packing) → +1,200 H(VST \| **W**/**TP** (custodian rule missing, gap T-G1)/transit(MV-T1)) |
| 2 | Mon 21 Sep | LR photo: TP booked 100 boxes | M (on_behalf of TP) | 100 boxes | no posting — the model has no carrier handover assertion (gap T-G1) |
| 3 | Tue 22 Sep | MV-T2 · `job_work_out` M→EB · J-T · transport {TP, LR 77840, 1 box} · **no EWB** (no §10 warning, gap T-G6) | M sent (account) | FP 240 pc | −240 H(FP \| M/M/avail) → +240 H(FP \| M/TP/transit(MV-T2)). Exp **Sat 26 Sep** (23, 24, 25, 26). GST clock from DC date 22 Sep |
| 4 | Wed 23 Sep | W receives 97 boxes | W (account) | 85: 432 (36 boxes); 90: 456 (38); 95: 276 (23) = 1,164 | −1,164 transit → +1,164 H(VST \| W/W/avail). Counted goods, tolerance 0 → −36 transit → +36 H(VST \| W/**TP?**/disputed(DQ-T1)) (90: 24, 95: 12); DQ-T1 `transit_claim` opens (custodian of the missing 36 undefined, gap T-G5) |
| 5 | Wed 23 Sep | MV-T2 side flag `detained` (GST squad: no EWB) + J-T Pause `detained` 23–26 Sep | M (self; TP told by phone → on_behalf) | — | no quantity change; link flag → pause is manual (gap T-G8). J-T exp → **Thu 1 Oct** (27 Sun skip; 28, 29, 30, 1 = days 1–4) |
| 6 | Thu 24 Sep | M files transit claim with TP (LR copy, claim letter) on DQ-T1 | M (self); TP position on_behalf "searching" | — | positions: M sent 1,200 / 100 boxes; W received 1,164 / 97; TP booked 100, delivered 97 |
| 7 | Mon 28 Sep | EB receives (released Sat 26, Sunday in transit) | EB taps OK on M's link (link) | FP 240 | −240 transit → +240 H(FP \| M/EB/—/alloc(J-T)) |
| 8 | Thu 1 Oct → Fri 2 Oct | J-T output + MV-T3 · `job_work_return` EB→M via TP (sent 1 Oct, received 2 Oct) | M received (self); EB sent on_behalf, confirmed by link | FP-E A 238; reject 2 (misembroidered) | +240 at EB → transit → +238 H(FP-E A \| M/M) + 2 H(FP-E reject \| M/M). Closure −240 alloc(J-T) → CONSUMED; residual 0 |
| 9 | Mon 12 Oct | DQ-T1 resolved: TP accepts liability for 3 boxes, 36 × ₹62 = ₹2,232, paid as claim proceeds to W | M records outcome; W accepts (account) | VST 90: 24; 95: 12 | −36 H(disputed(DQ-T1)) → +36 LOSS(transit, attributed TP) **and** value credit ₹2,232 (two outcomes, gap T-G4) |

Variant T-b (door delivery, `title_passes = at_receipt`): in-transit and disputed holdings stay owned by M; DQ-T1 resolution posts the loss from M; W owns 1,164; O-T stays pending 36 → M ships 3 replacement boxes (MV-T4, 36 pc). The order's fulfilled qty differs between variants (1,200 vs 1,164 + 36), gap T-G3.

### T.3 Dates and flags (J-T, 6-day)

| | Without pause | With pause `detained` 23–26 Sep |
|---|---|---|
| Expected | Sat 26 Sep | **Thu 1 Oct** |
| very_late from | Thu 1 Oct (band 28, 29, 30) | Tue 6 Oct (band 2, 3, 5; Sun 4 skipped) |
| Last receipt Fri 2 Oct | **very_late** | **late 1 d** (within band) |

Turnaround raw 10 calendar days (22 Sep → 2 Oct); net of 4 detained days, 6 days.

### T.4 Participant views

| Participant | Moment | Owned @ own | Owned @ others | Held for others | Open (pending, expected, flag) | Must NOT see |
|---|---|---|---|---|---|---|
| M | Mon 21 Sep | (VST sold; not M's from dispatch) | FP 240 — not yet sent | — | MV-T1 "dispatched, in transit with TP, LR 77815, 100 boxes" (not M's stock any more) | W's onward sales |
| M | Thu 24 Sep | — | FP 240 in transit with TP, **detained since 23 Sep** | — | DQ-T1 open (36 pc, 3 boxes), claim filed; J-T exp shifting → Thu 1 Oct | W's stock |
| M | Mon 12 Oct | FP-E A 238, reject 2 | — | — | J-T closed, late 1 d net of detention; DQ-T1 resolved: 36 lost, TP liable ₹2,232 | — |
| W | Mon 21 Sep | — | VST 1,200 in transit, owned from dispatch (ex-works), TP LR 77815 | — | incoming 100 boxes, exp Wed 23 Sep | M's J-T, EB, M's stock, M's freight dealings |
| W | Wed 23 Sep | VST 85: 432, 90: 456, 95: 276 = 1,164 | — | — | DQ-T1: 36 disputed (with TP) | same |
| W | Mon 12 Oct | 1,164 | — | — | DQ-T1 resolved: 36 lost in transit, ₹2,232 claim proceeds | same |
| TP (contact; view undefined in §7, gap T-G2) | proposed: package level only | — | — | (custodian in transit) LR 77815 100 boxes, LR 77840 1 box | LR 77815 booked 100 / delivered 97 → claim ₹2,232; LR 77840 detained 23–26 Sep, delivered 28 Sep | specs, sizes, ₹62/pc beyond the declared value per LR; W's and EB's other dealings |
| EB (link only) | Mon 28 Sep | not tracked | — | via M's link: FP 240 (J-T) | can propose return "240 sent 1 Oct" | the sale to W, DQ-T1, TP claim |

### T.5 Balance check

| Check | Equation | Result |
|---|---|---|
| MV-T1, size 85 | 432 = 432 + 0 + 0 + 0 | 0 |
| MV-T1, size 90 | 480 = 456 + 0 + disputed 24 + 0 | 0 |
| MV-T1, size 95 | 288 = 276 + 0 + disputed 12 + 0 | 0 |
| MV-T1 total / boxes | 1,200 = 1,164 + 36; 100 boxes = 97 + 3 | 0 |
| After resolution | disputed 36 → LOSS(transit, TP) 36; 1,200 = 1,164 + 36 | 0 |
| MV-T2 | 240 = 240 (detention changes no quantity) | 0 |
| J-T (count_preserving) | 240 = 238 + 2 | residual 0 |
| MV-T3 | 240 = 240 | 0 |
| §5.5 W VST | inflow 1,200 = holding 1,164 + LOSS 36 | 0 |
| §5.5 M VST | 1,200 out = sold 1,200 | 0 |

### T.6 Gaps

| # | What broke | Proposed minimal fix |
|---|---|---|
| T-G1 | §4.1 posts in-transit holdings with custodian "from→to"; nothing makes the transporter the custodian when `transport.transporter_party` is set, and the LR count (100 boxes booked) has no place → cannot tell loss at M's loading from loss in TP's custody. | In-transit custodian = transporter when recorded; optional third assertion `carrier_received {packages, evidence: lr_photo}`. |
| T-G2 | §7 lists from/to, seller/buyer, owners — not the transporter; the statement link is "per contact with open lines", and TP has no lines. | Transporter sees a package-level view (LR, packages, declared value, status, claims) of movements naming it; no specs or rates. |
| T-G3 | Order fulfilment is "derived from movements" without saying sent or received: 1,200 (ex-works) or 1,164 + 36 pending (door delivery). | Fulfilled qty = qty whose title passed to the buyer (sent if at_dispatch, received if at_receipt). |
| T-G4 | Discrepancy `resolution.outcome` is single-valued; a transit claim needs a quantity outcome (36 → LOSS(transit, TP)) **and** a value credit (₹2,232) passed to W. | `resolution.outcomes[]`. |
| T-G5 | The disputed 36 pc need a custodian on their holding key; the model does not say whose (W never had them). | Disputed holdings keep the last asserted custodian (TP). |
| T-G6 | 01 §3 requires an e-way bill for every inter-state job-work movement; §10 has no such check, so MV-T2 went out unwarned. | §10 rule: inter-state `job_work_out`/`hop` without `ewb` → warning before save. |
| T-G7 | "Ex-works, freight to-pay, who bears transit loss" is only partly expressed by `title_passes`; "attributed per terms" has nothing to read (= N-G2). | `terms {delivery: ex_works \| door, freight: paid \| to_pay, transit_risk: buyer \| seller}` on Order/Movement. |
| T-G8 | `detained` is a movement side flag, Pause is a job object; nothing links them, and the pause end (release 26 Sep vs delivery 28 Sep) is unstated. | A `detained {from, to}` flag on a movement auto-creates `Pause(detained)` on its jobs; it ends at release. |

---

## Consolidated gap list (M–T)

| # | Gap | Seen in |
|---|---|---|
| 1 | No external source/sink for untracked parties (`EXTERNAL(party)`); opening balances for on-platform sellers | M, P |
| 2 | Wrong-spec receipt: no `rejected_on_receipt`, title passes anyway; no spec-mismatch assertion | M |
| 3 | Evidence enum lacks `receiver_only`/provisional | M |
| 4 | Procurement has no calendar/band; band unit (calendar vs working days) unstated; due_soon noise for 1-day leads | M, R |
| 5 | Statement link omits open order lines | M |
| 6 | Commingled count across owners has no split rule | N |
| 7 | No `terms` (weighing/transit loss bearer, ex-works/to-pay); discrepancy has no `bearer` | N, S, T |
| 8 | `sale_in_place` has no buyer acceptance assertion | N |
| 9 | Rework: purpose `return` vs `job_work_out`; no rework turnaround; per-good-piece bill not adjusted by later scrap; no light regrade; rework not attributed to the original performer | O |
| 10 | CalendarEvent has no owner/scope | Q |
| 11 | `expected_at` stored vs derived (promise lost); shared job dates come from one party's private norms/events | Q |
| 12 | Norms: raw vs net turnaround; rounding of the blend | Q |
| 13 | Off-platform contacts on shared movements: identity (KB vs KB′) and privacy vs ship-to display | R, S |
| 14 | `hop` sets `via` even for owner-instructed hops | R |
| 15 | Pause is job-level (partial kit completeness) | R |
| 16 | Expected-date anchor undefined (multi-input jobs, direct delivery, hop end) | R, S |
| 17 | GST 1-year clock dies with the input line instead of following lineage until return | R |
| 18 | Line rate/value visible to non-commercial physical parties | R, S |
| 19 | `per_input_mass` billing: sent or received mass | R, S |
| 20 | One movement, many documents (invoice + DC + EWB + LR) | S |
| 21 | Transit: transporter as custodian, carrier handover assertion, transporter visibility, disputed custodian | T |
| 22 | Order fulfilment basis (sent vs received) | T |
| 23 | Resolution needs several outcomes (quantity + value credit) | T |
| 24 | No e-way bill check for inter-state job work; detention flag not linked to job pause | T |
