# W4 · Scenario walkthroughs U–AD

Verifies `02-domain-model.md` (20 Nov 2026) against scenarios U–AD of `01-domain-research.md` §7. Written by a verifier who did not write the model. Only model vocabulary is used; anything the model lacks is used where unavoidable and listed as a **gap** (IDs like `U-G1`). Consolidated gap list at the end.

## Notation

| Symbol | Meaning |
|---|---|
| **[B]** / **[C of X]** | on-platform Business / off-platform Contact owned by business X |
| `SPEC·lot·grade {owner \| custodian \| via \| state}` | holding key (§3.3). `self@GD` = the owner's own location GD. `–` = empty. |
| states | `avail`, `alloc(J)`, `transit(M)`, `disputed(D)`, `held(reason)` |
| pseudo-holdings | `LOSS(kind, attributed)`, `CONSUMED(J)`, `WRITTEN_OFF(reason)`, `SOLD_TO_MARKET`, `ADJUSTMENT(reason)` (§4.3; see U-G3) |
| evidence | `self`, `on_behalf`, `link`, `account` (§3.4, §9.1) |
| `→` in postings | `−q` from the left holding, `+q` to the right holding. Movements always pass through `transit(M)` (§4.1); written as `A → B` when sent = received on the same day. |
| quantities | stored in base atoms (pc, g, cm); shown as pc, kg (1 dp) and m |

---

## U · Physical count and a unit slip

### Setup

| Party | Kind | Role |
|---|---|---|
| FA, Father's unit (owner Arjun; staff Selvi, supervisor) | [B], GST registered | owner, principal |
| S1, stitching unit | [B] | performer of J-U2 |
| S2, Kumar's stitching unit | [C of FA], statement link | performer of J-U3 |

| Spec | Definition |
|---|---|
| TEE-P-{S,M,L,XL} | Garment · tee · RN-180 · navy · packed · size |
| TEE-L | Garment · tee · RN-180 · navy · L (unpacked) |
| KIT-L / KIT-XL | Cut kit · RN-180 · navy · L / XL |

Lots: cut lot C-40 (KIT-L), C-41 (KIT-XL). Opening on 1 Nov at FA godown (GD): TEE-P S 280, M 400, L 340, XL 160 = **1,180** A; KIT-L·C-40 3,000; KIT-XL·C-41 1,200.

### Events

**U1 (own count) and U2 (count by a custodian)**

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 2 Nov | Movement `job_work_out` FA→S1, job J-U2 (stitching, assembling) | Selvi (self); S1 receipt (account) | KIT-L·C-40·A 3,000 pc | `KIT-L {FA\|self@GD\|–\|avail}` → `{FA\|S1\|–\|alloc(J-U2)}` 3,000 |
| 2 | 12 Nov | Job event: output declared, J-U2 | S1 (account) | TEE-L·A 20 pc | +20 `{FA\|S1\|–\|avail}`. Inputs not reduced; pending **est.** 3,000 − 20 = 2,980 |
| 3 | 12 Nov | Movement `job_work_return` S1→FA | S1 sent (account); Selvi received (self) | TEE-L·A 20 | `{FA\|S1\|avail}` → `{FA\|self@GD\|avail}` 20 |
| 4 | 20 Nov | Adjustment `count` ×4 (one per size = per holding key), reason "monthly count" | Selvi, staff (self) | TEE-P counted S 280, M 380, L 330, XL 150 = 1,140; book 280/400/340/160 = 1,180 | M −20, L −10, XL −10 from `{FA\|self@GD\|–\|avail}` → +40 `ADJUSTMENT(count 20 Nov)`; S: count stored, delta 0 |
| 5 | 20 Nov | Adjustment `count` by custodian (S1 counts FA's kits) | S1 (account) | KIT-L·C-40 counted 2,950 | **No posting** (§4.3: custodian count = assertion). Discrepancy D-U2 `count_mismatch` opens: FA 2,980 (estimate) vs S1 2,950; tolerance 0 (counted). Which "book" applies is unclear (U-G1) |
| 6 | 21 Nov | D-U2 position update | S1 (account) | S1 recounts 2,968 (a bundle of 18 was under another principal's rack) | none; difference 12 |
| 7 | 22 Nov | D-U2 proposed by FA, accepted by S1 → resolved: S1 bears 12 kits at ₹95 | FA (self), S1 (account) | KIT-L 12 | −12 `{FA\|S1\|–\|alloc(J-U2)}` → +12 `LOSS(count_shortage, S1)` (U-G2); bill deduction 12 × ₹95 = ₹1,140 on J-U2 |

**U3 (unit slip)** — the scenario text is internally inconsistent: "supervisor enters 50 for the voice note" makes the *receipt* 50 (12× **below** the dispatch), but "+1,100 %" means receipt = 12 × dispatch. Both readings are walked.

*Reading A (matches "+1,100 %"): the dispatch was typed as 50, the receipt comes from the voice note.*

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 8 | 18 Nov | Movement M8 `job_work_out` FA→S2, J-U3. Physically 50 dz = 600 kits left; Selvi typed "50", unit defaulted to pc | Selvi (self) | KIT-XL·C-41·A sent 50 pc | `{FA\|self@GD\|avail}` −50 → `transit(M8)` +50. Book @GD 1,150 (physically 600) |
| 9 | 19 Nov | Receipt for M8 from S2's WhatsApp voice note "ஐம்பது டஜன் வந்துச்சு" | Selvi via Claire voice (on_behalf) | parsed {50, dozen} → 600 pc (§10.4) | would post −600 from `transit(M8)` (holds 50) → **−550 → REJECTED** |
| 10 | 19 Nov | Fix: M8 cancelled (no receipt yet, §6.1); M8′ re-recorded with the same paper DC no. (U-G6) | Selvi (self) | KIT-XL 600 | M8 reversed (+50 @GD, −50 transit); M8′: −600 @GD → +600 `transit(M8′)` |
| 11 | 19 Nov | Receipt M8′ | Selvi (on_behalf); S2 taps "Received OK" on statement link 20 Nov (link) | KIT-XL 600 | `transit(M8′)` −600 → `{FA\|S2\|–\|alloc(J-U3)}` +600 |

Which rule stops #9, in the order §10 applies them:

| Rule | Result for #9 |
|---|---|
| §10.1 unit rules | pass: dozen ↔ pc is a fixed conversion |
| §10.4 dozen parsing | stores 600 pc, displays "50 dz" |
| §10.3 plausibility "received > sent by more than tolerance" | **warns**: 600 vs 50 = +1,100 %, tolerance 0 for counted goods. Override with reason is allowed, so this alone does not stop it. |
| §10.3 "10× above the last 5 similar records" | silent: S2's last 5 receipts were 400–650 pc |
| **§10.2 / §5.4 never negative** | **hard stop**: `transit(M8)` would go to −550. The exception (receiver-first or link assertion about *someone else's* goods) does not apply: recorder FA, goods FA's. Message: "S2 received 600 but you sent 50. Was the dispatch 50 dozen?" |

*Reading A′:* if S2 had confirmed 600 **via the link** first, the §5.4 exception applies (link assertion about FA's goods), so it opens a discrepancy instead of rejecting. But §4.1's beyond-tolerance posting with r > s gives `−(s−r)` = +550 in transit and −550 disputed: a negative disputed holding. **Over-receipt posting is undefined** (U-G5).

*Reading B (literal "supervisor enters 50"): the dispatch was correct (600) and the receipt was typed as 50.*

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| B1 | 18 Nov | M9 `job_work_out` FA→S2 | Selvi (self) | KIT-XL 600 | @GD −600 → `transit(M9)` +600 |
| B2 | 19 Nov | Receipt typed "50" for the voice note | Selvi (on_behalf) | KIT-XL 50 | `transit` −50 → `{FA\|S2\|alloc(J-U3)}` +50; s−r = 550 > tolerance 0 → `transit` −550 → `disputed(D-U3b)` +550; D-U3b `qty_mismatch` opens **against S2** |

**Nothing stops Reading B**: §10.3 only checks received > sent and 10× *above*. A 12× shortfall becomes a false dispute with the stitcher (U-G4).

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| FA (owner) | t1: 19 Nov, after #9 blocked | GD: TEE-P 1,180; TEE-L 20; KIT-XL 1,150 (book) | S1: KIT-L 3,000 alloc J-U2 (pending est. 2,980); S2: KIT-XL 50 "at S2, unconfirmed" | — | J-U2 in_progress; J-U3 issued | J-U2 running (owner only) | "Receipt 600 > sent 50, not saved" | — |
| FA | t2: 20 Nov, after #4, #5, #11 | GD: TEE-P 1,140; TEE-L 20; KIT-XL 600 | S1: 3,000 (est. 2,980); S2: KIT-XL 600 alloc J-U3 (link) | — | J-U2, J-U3 | — | ADJUSTMENT −40 by Selvi, with reason; D-U2 open (2,980 vs 2,950) | — |
| FA | t3: 22 Nov, D-U2 resolved | as t2 | S1: KIT-L 2,988 alloc (pending est. 2,968) | — | J-U2, J-U3 | J-U2 deduction ₹1,140 | LOSS 12 attributed S1 | — |
| Selvi (FA staff) | t2 | same quantities as FA | same | — | same | **hidden** (staff: no rates or bills) | same | rates, the ₹1,140, analytics |
| S1 | t2 | own: none in this scenario | — | FA: KIT-L 3,000 (book), its own count 2,950 | J-U2 (performer) | J-U2 receivable (S1 side) | D-U2 | FA's godown, FA's count adjustment, S2 and J-U3 |
| S1 | t3 | — | — | FA: KIT-L 2,988 | J-U2 | deduction ₹1,140 | — | same |
| S2 (contact, link) | t2 | n/a | n/a | link shows: "600 cut kits XL from FA, 18 Nov" | — | no prices unless FA shares | — | S1, FA's stock, counts, adjustments, staff names |

### Balance check

| Check | Equation | Result |
|---|---|---|
| U1 TEE-P (per size) | book = holding + ADJUSTMENT: S 280 = 280 + 0; M 400 = 380 + 20; L 340 = 330 + 10; XL 160 = 150 + 10 | 1,180 = 1,140 + 40 ✓ |
| U2 J-U2 at 22 Nov (open, §5.2 assembling) | issued 3,000 = outputs 20 + shortage 12 + pending 2,968 (est.) + residual 0 | 3,000 ✓ (shortage has no column in the assembling row; U-G2) |
| U2 holding view | alloc(J-U2) = 3,000 − 12 = 2,988; pending = 2,988 − 20 = 2,968 = S1's recount | ✓ |
| U3-A M8 | cancelled: +50 − 50 = 0 | ✓ |
| U3-A M8′ (§5.1) | sent 600 = received 600 + 0 + 0 + 0 | ✓ |
| U3-A KIT-XL total | 1,200 = GD 600 + S2 600 | ✓ |
| U3-B M9 (§5.1) | sent 600 = received 50 + disputed 550 | balances, **but on a false dispute** |

### Model gaps

| ID | What broke (concrete) | Minimal fix |
|---|---|---|
| U-G1 | S1's count of 2,950 kits must be compared with a "book" figure. The holding `alloc(J-U2)` is 3,000 (inputs are not reduced until closure, §4.2), but CLAIRE shows 2,980 (an estimate). §3.6 "counted − book" doesn't say which. | A custodian's count of job inputs is compared with `pending` (issued − outputs × ratio) and stored as an assertion on the job; at closure, the agreed count replaces the estimate. |
| U-G2 | The 12-kit shortage at an *assembling* job: §5.2 sets loss = 0 for assembling/count-preserving, and the outcomes in §3.7 (accept_receiver/sender…) are worded for movements. The resolution has no named bucket in the job equation. | Add a `shortage(attributed_to)` bucket for count-based job inputs, fed only by discrepancy resolutions; define count_mismatch outcomes as `accept_count` / `accept_book` / `split`. |
| U-G3 | `ADJUSTMENT(reason)` is used in §4.3 but missing from the §4 pseudo-holding list and from §5.5 (a positive count = "found"; a negative count has no term). | Add `ADJUSTMENT(reason)` (signed) to §4 and §5.5. |
| U-G4 | Reading B: a dozen/pc slip 12× **below** (receipt 50 vs sent 600), or a dispatch typed 12× low, passes every check and opens a false `qty_mismatch` blaming S2. §10.3 checks only received > sent and "10× above". | Add a ratio check: if qty ÷ counterpart (or ÷ recent median) ≈ 12, 144, 1,000 or their inverses, ask "did you mean dozen / gross / kg?" before saving. Check both directions. |
| U-G5 | Over-receipt (r > s) via link: the §5.4 exception sends it to a discrepancy, but the §4.1 posting `−(s−r) transit, +(s−r) disputed` with s−r = −550 creates a negative disputed holding. Nothing says where the extra 550 comes from. | Over-receipt: post `+s` to the receiver; record the excess `r−s` on the discrepancy only (no holding) until resolved; resolution `short_shipped` in reverse = sender corrects its sent figure. |
| U-G6 | The sender's own typo (sent 50) can only be fixed by cancelling and re-creating the movement. That breaks the DC-number link and the audit trail. §3.4 has a single `sent` assertion. | Allow a superseding `sent` assertion (versioned, with reason, recorder) until the receiver has asserted. |
| U-G7 | P9 makes the unit mandatory, but a UI default (pc) makes the slip silent; `Quantity` doesn't record whether the unit was typed, defaulted or parsed. | Add `unit_source: typed \| defaulted \| parsed`; plausibility weighs defaulted units. |
| U-G8 | A staff member's count posts −40 tees (≈ ₹7,000) immediately; there is no owner review. A count by total only (1,140 across sizes) cannot post, because counts are per holding key. | Optional owner-review threshold on count adjustments by staff; allow an aggregate count that opens an internal `count_mismatch` until a per-key recount. |

---

## V · Cancellation after cutting

### Setup

| Party | Kind | Role |
|---|---|---|
| FA | [B], registered | principal, seller |
| R1, Sri Murugan Tex (retailer) | [B] | buyer, sale order O-V |
| S2, stitching unit | [B] (on platform here) | performer of J-V2 |
| S1 | [C of FA] | performer of J-V1 (background) |

| Spec | Definition |
|---|---|
| KIT-{S,M,L,XL} | Cut kit · polo PQ-220 · navy · size (lot C-50) |
| POLO-{size} | Garment · polo PQ-220 · navy · size |
| THR | Thread · spun poly · Tex 27 · navy; base cm; cone factor 4,000 m (source: label) |

Run RUN-V "1,000 navy polos for R1". Rates: sale ₹210/pc; S2 ₹28 per good output piece; thread planning factor 140 m/pc. Opening (6 Nov, from in-house cutting J-CUT, closed): FA cutting floor (CF) kits S 200, M 300, L 300, XL 200 = 1,000; GD thread 30 cones = 120,000 m.

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 3 Nov | Order O-V (sale) FA→R1 | FA (self); R1 accepts in deal room (account) | POLO S 200, M 300, L 300, XL 200 = 1,000 @ ₹210 | none (order = plan) |
| 2 | 7 Nov | Movement `job_work_out` FA→S1, J-V1 | FA (self); S1 (on_behalf) | KIT S 200, M 300, L 100 = 600 | `{FA\|self@CF\|avail}` → `{FA\|S1\|–\|alloc(J-V1)}` 600 |
| 3 | 7 Nov | Movement `job_work_out` FA→S2, J-V2 | FA (self); S2 received (account) | KIT-L 200, KIT-XL 200; THR 14 cones = 56,000 m | kits @CF → `{FA\|S2\|–\|alloc(J-V2)}` 400; THR @GD → `{FA\|S2\|–\|alloc(J-V2)}` 56,000 m |
| 4 | 12 Nov | Job event: outputs declared, J-V2 | S2 (account) | POLO-L 120 A, POLO-XL 60 A | +180 `{FA\|S2\|–\|avail}`; pending est. kits 400 − 180 = 220 |
| 5 | 13 Nov | O-V partly cancelled by R1: L 200, XL 200 | R1 (account), FA accepts | −400 | no holding change; plan 1,000 → 600 (S 200, M 300, L 100). No event type exists for this (V-G1) |
| 6 | 13 Nov | J-V2 cancelled → `cancelled_partial` (§4.2, §6.2) | FA (self); S2 notified | — | none yet |
| 7 | 14 Nov | Movement `job_work_return` S2→FA | S2 sent (account); FA received (self) | POLO-L 120, POLO-XL 60 (outputs); KIT-L 80, KIT-XL 140 (returned unprocessed); THR 7 full cones 28,000 m + 1 partial **est.** 2,500 m (factor source: user) | POLO `{FA\|S2\|avail}` → `{FA\|self@GD\|avail}` 180; kits `alloc(J-V2)` → `{FA\|self@GD\|avail}` 220; THR `alloc(J-V2)` → @GD 30,500 m |
| 8 | 14 Nov | J-V2 closure (as cancelled_partial; V-G3) | FA (self) | remaining kits 180; thread 25,500 m | `alloc(J-V2)` → `CONSUMED(J-V2)`: kits 180, THR 25,500 m. Thread est. 180 × 140 = 25,200 m → residual 300 m |
| 9 | 14 Nov | Bill J-V2 (derived) | — | 180 good × ₹28 | **₹5,040.00** due FA → S2 |

J-V1 (600 at S1) continues and matches the reduced order exactly.

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| FA | t1: 12 Nov | CF: kits 0; GD: THR 16 cones = 64,000 m | S1: 600 kits; S2: 400 kits (220 pending est.), 56,000 m thread, 180 polos ready | — | O-V 1,000 (0 delivered); J-V1, J-V2 in_progress | J-V2 running ₹5,040 | — | — |
| FA | t2: 14 Nov | GD: POLO L 120, XL 60; KIT-L 80, KIT-XL 140 (free stock); THR 94,500 m | S1: 600 kits | — | O-V 600 (S 200, M 300, L 100), 400 cancelled; J-V1; J-V2 cancelled_partial | J-V2 final ₹5,040 | thread residual 300 m (0.5 %, within norm); RUN-V still lists the 220 kits and 180 polos (V-G2) | — |
| R1 | t1 | own stock not in scope | — | — | O-V 1,000 open | sale ₹210,000 | — | S1, S2, jobs, kits, stitching rates |
| R1 | t2 | — | — | — | O-V 600 open, 400 cancelled 13 Nov | ₹126,000 | — | same |
| S2 | t1 | — | — | FA: 400 kits (pending est. 220), 56,000 m thread, 180 polos | J-V2 (performer) | receivable ₹5,040 | — | O-V, R1, sale price ₹210, S1 |
| S2 | t2 | — | — | FA: 0 | J-V2 cancelled_partial | ₹5,040 final | — | same |
| S1 (contact, link) | t2 | n/a | n/a | link: 600 kits from FA | — | — | — | S2's job, the cancellation, R1 |

### Balance check

| Check | Equation | Result |
|---|---|---|
| J-V2 KIT-L (§5.2 assembling) | issued 200 = outputs 120 + returned_unprocessed 80 + residual 0 | ✓ |
| J-V2 KIT-XL | 200 = 60 + 140 + 0 | ✓ |
| J-V2 THR (assembling, secondary) | 56,000 m = consumed est. 25,200 + leftover returned 30,500 + residual 300 | ✓ (residual explicit, not forced) |
| Output vs plan (§5.3) | plan 400 → 180; the shortfall of 220 is explained by cancellation | shown |
| FA kits overall | 1,000 = alloc J-V1 600 + CONSUMED(J-V2) 180 + GD 220 | ✓ |
| O-V | plan 1,000 = open 600 + cancelled 400 | ✓ (cancelled qty has no home; V-G1) |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| V-G1 | R1's cancellation of 400 (who, when, which lines) has no record. §6.5 has a `cancelled_partial` status but no cancelled quantity; orders aren't events. | Non-quantity `OrderAmendment {order, lines ±qty, by, at, reason, accepted_by}`; plan = original ± amendments. |
| V-G2 | The 220 kits and 180 polos returned to stock still carry `run_id` RUN-V through their movements, so the flow view counts them as part of the 1,000-polo run. There is no rule for releasing material from a run. | Run membership of a holding = the run tag of its latest event; a return can be marked `release_from_run`, which drops it from the run view. |
| V-G3 | §6.2 shows `cancelled_partial` as terminal, without the `close` step, so it's unclear whether loss/residual and the bill are computed and locked. | `cancelled_partial` passes through the same closure (dispositions, residual, final bill, lock). |

---

## W · Rate change mid-order (with bill)

### Setup

| Party | Kind | Role |
|---|---|---|
| F, fabric shop | [B], registered | principal |
| D, Sakthi Dyeing | [B] | performer of J-W |

| Spec | Definition |
|---|---|
| GREY | Knitted fabric · SJ · grey · 160 GSM · 30" tubular · 100 % cotton |
| NAVY | Knitted fabric · SJ · finished · 180 GSM · 36" open · 100 % cotton · navy |

Lots: G-21 (grey) → D-5101, D-5102 (parent G-21). ProcessType dyeing: `mass_losing`, `per_input_mass`, navy turnaround 8 d (7-day calendar), loss norm 8 %, very-late band +3 d.
RateCards (each private to its viewer, §3.9/§11): **F's card for D** ₹70/kg, effective 1 Apr 2026. **D's card for F** ₹70 from 1 Apr; **₹85 from 5 May 2026**.

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 1 May | Movement `job_work_out` F→D, J-W; rate snapshot **₹70/kg** (card effective on the issue date) | F (self); D received 520.0 (account) | GREY·G-21·A 520.0 kg (22 rolls) | `{F\|self@GD\|avail}` → `{F\|D\|–\|alloc(J-W)}` 520.0; expected 9 May |
| 2 | 5 May | D's RateCard ₹85 effective 5 May | D | — | none; J-W snapshot stays ₹70 |
| 3 | 8 May | Output declared, J-W | D (account) | NAVY·D-5101·A 240.0 kg (10 rolls) | +240.0 `{F\|D\|–\|avail}`; pending est. 520 − 240/0.92 = 259.1 kg grey |
| 4 | 8 May | Movement `job_work_return` D→F; **rate override on this receipt ₹85/kg** (agreed after negotiation) | D sent 240.0 (account); F received 240.0 (self) | NAVY·D-5101 240.0 | `{F\|D\|avail}` → `{F\|self@GD\|avail}` 240.0 |
| 5 | 11 May | Output declared + `job_work_return` (no override → ₹70) | D (account); F (self) | NAVY·D-5102·A 238.0 kg (10 rolls) | +238.0 `{F\|D\|avail}` → `{F\|self@GD\|avail}` |
| 6 | 11 May | J-W closure | F (self) | — | `alloc(J-W)` −520.0 → `CONSUMED(J-W)` +520.0; loss = 520.0 − 478.0 = **42.0 kg (8.08 %)**, within norm + band |

### Bill (§11: billable qty per `rate_basis` × rate)

| Basis | Receipt 1 (D-5101, ₹85) | Receipt 2 (D-5102, ₹70) | Total |
|---|---|---|---|
| (a) Scenario's words: 240 kg × ₹85 + "the rest" 280 kg × ₹70 (mixes finished kg with grey kg) | 20,400.00 | 19,600.00 | **40,000.00** |
| (b) Model: per_input_mass, grey equivalent at actual yield 478/520 = 91.92 % (after closure) | 240/0.9192 = 261.09 kg × 85 = 22,192.47 | 258.91 kg × 70 = 18,123.85 | **40,316.32** |
| (c) Model before closure: expected yield 92 % (estimate, P10) | 260.87 kg × 85 = 22,173.91 | 259.13 kg × 70 = 18,139.13 | 40,313.04 (est.) |
| reference: no override, 520 × 70 | | | 36,400.00 |
| reference: everything at ₹85, 520 × 85 | | | 44,200.00 |

The model's bill is **₹40,316.32 due F → D**, ₹316.32 more than what the parties agreed (₹40,000), and it moves between 8 May and closure (W-G1).

Lateness (§11): expected 9 May; first receipt 8 May; last receipt 11 May → turnaround 10 d (to the last receipt). `late` on 10 May (pending > 0); `very_late` would start on 12 May (not reached).

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| F | t1: 8 May, after #4 | GD: NAVY D-5101 240.0 | D: GREY 520.0 alloc J-W; pending est. 259.1 kg grey (≈ 238 kg finished) | — | J-W in_progress | draft: 22,173.91 (est.) + pending at ₹70 | due 9 May | D's other principals, D's rate cards for others |
| F | t2: 11 May, closed | GD: NAVY 478.0 (2 lots) | D: 0 | — | J-W closed | **₹40,316.32** due to D | late 1 day (10 May); loss 8.08 % | same |
| D | t1 | own dyes not tracked | — | F: GREY 520.0 alloc (pending est. 259.1) | J-W (performer) | receivable, same figures as F | — | F's own stock, F's sales, F's private card/notes |
| D | t2 | — | — | F: 0 | J-W closed | ₹40,316.32 receivable | — | same |

### Balance check

| Check | Equation | Result |
|---|---|---|
| Movement #1 (§5.1) | 520.0 = 520.0 + 0 + 0 + 0 | ✓ |
| Returns #4, #5 | 240.0 = 240.0; 238.0 = 238.0 | ✓ |
| J-W (§5.2 mass_losing) | issued 520.0 = outputs 478.0 + loss 42.0 + residual 0 | ✓ |
| Bill quantity | 261.09 + 258.91 = 520.00 kg grey | ✓ |
| §5.5 for owner F, GREY+NAVY | holdings 478.0 + CONSUMED 520.0 = inflows (GREY 520.0 + outputs 478.0) | 998.0 = 998.0 ✓ |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| W-G1 | A per-receipt rate override (§11) applies to a receipt of *finished* kg, but `per_input_mass` bills *grey* kg. The grey equivalent of a partial receipt is an estimate until closure, so the bill changes after closure (₹40,313.04 → ₹40,316.32) and never equals the ₹40,000 the parties agreed. | Let an override be expressed on input quantity ("first 240 kg grey at ₹85") or on the receipt's output quantity, with the basis named; otherwise allocate at closure and label it as an estimate before then. |
| W-G2 | RateCard is per viewer; the job has one rate snapshot. D's card says ₹85 from 5 May while F's says ₹70: whose card is snapshotted, and how does a rate disagreement show up? There is no two-sided rate assertion or `rate_dispute`. | The job rate gets `proposed_by` / `accepted_by` (like quantity assertions); add a discrepancy kind `rate_dispute`. |
| W-G3 | Bill basis when the two scales differ within tolerance (e.g. F 520.0 vs D 517.0): §11 doesn't say whether billable kg is the sender's or the receiver's figure (₹210 apart at ₹70). | `bill_qty_basis: sender \| receiver` on the RateCard/relationship; default receiver for per_input_mass. |

---

## X · Consignment (sale-or-return)

### Setup

| Party | Kind | Role |
|---|---|---|
| M, manufacturer | [B], registered | owner, consignor |
| R2, Lakshmi Textiles, Erode (retailer) | [C of M], statement link | consignee (custodian) |

Specs: VEST-{85,90,95,100} = Garment · vest · 1×1 rib · white · packed · size (cm). Order O-X `consignment`, ₹55/pc payable when sold.

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 1 Oct | Order O-X (consignment) M→R2 | M (self) | 4 sizes × 150 = 600 @ ₹55 | none |
| 2 | 1 Oct | Movement `consignment_out` M→R2 (M's own tempo) | M (self); R2 taps Received OK 2 Oct (link) | 85: 150, 90: 150, 95: 150, 100: 150 | `{M\|self@GD\|avail}` → `{M\|R2\|–\|avail}` 600 |
| 3 | 31 Oct | Sell-through report 1, as `sale_in_place` seller M → buyer R2 (custodian unchanged) | M (on_behalf, R2 phoned; link has no "sold" action, X-G2) | 85: 50, 90: 60, 95: 60, 100: 40 = 210 | `{M\|R2\|avail}` −210 → `{R2\|R2\|–\|avail}` +210 (X-G1); O-X billed ₹11,550 |
| 4 | 15 Nov | Sell-through report 2 (day 45) | M (on_behalf) | 85: 50, 90: 60, 95: 50, 100: 40 = 200 | same pattern, 200; billed ₹11,000 |
| 5 | 15 Nov | Movement `consignment_return` R2→M; R2 proposes "sent 150 back" on link, M accepts | R2 sent (link); M received, counted (self) | 85: 40, 90: 20, 95: 35, 100: 55 = 150 | `{M\|R2\|avail}` → `{M\|self@GD\|avail}` 150 |
| 6 | 15 Nov | R2 says nothing is left (custodian count) | M (on_behalf) | counted 0 vs book 85: 10, 90: 10, 95: 5, 100: 15 = 40 | none (assertion); D-X `count_mismatch` opens, tolerance 0 |
| 7 | 18 Nov | D-X resolved: R2 pays for the 40 at ₹55 | M proposes; R2 agrees by phone (on_behalf) | 40 | `{M\|R2\|avail}` −40 → `LOSS(shrinkage, R2)` +40; charge ₹2,200 added to O-X (X-G3) |

Bill O-X: 410 × ₹55 = 22,550.00 + shrinkage 40 × ₹55 = 2,200.00 → **₹24,750.00 due R2 → M**.
Statutory clock: s.31(7), invoice within 6 months of removal (1 Oct 2026 → 1 Apr 2027). The model has no such clock (X-G4); here it is moot because everything is settled by 18 Nov.

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| M | t1: 2 Oct | GD: other stock | R2: 600 (consigned) | — | O-X: 600 out, 0 sold | — | consignment age 1 d | — |
| M | t2: 15 Nov, after #6 | GD: +150 returned | R2: 40 | — | O-X: sold 410, returned 150, 40 open | ₹22,550 due from R2 | D-X: R2 says 0 left | — |
| M | t3: 18 Nov | — | R2: 0 | — | O-X fulfilled | **₹24,750** due from R2 | LOSS 40 attributed R2 | — |
| R2 (contact, link) | t1 | n/a | n/a | "600 vests from M, sale-or-return" | — | ₹55/pc shown only if M allows | — | M's other retailers' consignments, M's stock, M's notes |
| R2 | t2 | n/a | n/a | 40 by M's book, R2 said 0 ("differs") | — | 410 sold | D-X | same |

### Balance check

| Size | Consigned | Sold | Returned | Shrinkage | Check |
|---|---|---|---|---|---|
| 85 | 150 | 50 + 50 = 100 | 40 | 10 | 150 ✓ |
| 90 | 150 | 60 + 60 = 120 | 20 | 10 | 150 ✓ |
| 95 | 150 | 60 + 50 = 110 | 35 | 5 | 150 ✓ |
| 100 | 150 | 40 + 40 = 80 | 55 | 15 | 150 ✓ |
| **Total** | **600** | **410** | **150** | **40** | **600 ✓** |

Movements: #2 600 = 600; #5 150 = 150 ✓. §5.5 for owner M **does not close as written**: the 410 left M's ownership with no M-side pseudo-holding (see AD-G3).

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| X-G1 | Sell-through: `sale_in_place` M→R2 leaves 410 pcs as `{R2\|R2}` (owner and custodian both an off-platform contact) in M's ledger forever. R2's retail sales are never recorded, and `SOLD_TO_MARKET` would misstate the buyer (M invoices R2). | Add a `consignment_settle` purpose (= sale_in_place to the consignee). Holdings whose owner and custodian are both a contact (not the recorder) collapse into a pseudo-holding `TRANSFERRED_OUT(party)`. |
| X-G2 | The statement link's actions (confirm / differs / propose return) can't express "sold 200" or "100 left", which is all a consignee reports. | Add link proposals `report_sold(qty)` and `report_count(qty)` for consignment lines; they post only when M accepts. |
| X-G3 | Charging shrinkage to the consignee (an invoice, effectively a sale) isn't a §3.7 outcome, and §4.3 forbids transferring disputed qty. LOSS + an off-model charge was used. | Outcome `charged_as_sale(rate)`: posts sale_in_place of the disputed qty to the liable party at the agreed rate. |
| X-G4 | No statutory clock for consignment (s.31(7), 6 months); §11 alerts cover only the job-work 1-year/3-year clocks. | Generalise `StatutoryClock {purpose, start_event, period}`: job_work_out 1y/3y; consignment_out 6m. |

---

## Y · Held for dues, and netting across roles (with bills)

### Setup

| Party | Kind | Role |
|---|---|---|
| FA | [B], registered | principal (D, S1), seller (to S1) |
| D, Murugan Dyeing | [C of FA], statement link | performer of J-Y1 |
| S1 | [B] | performer of J-Y2; buyer of fabric |

Specs: GREY, NAVY (as W); KIT-POLO-M, POLO-M (Polo PQ-220 navy M). Lots: G-30 → D-7710.
Rates: FA's card for D: dyeing ₹85/kg grey (per_input_mass); FA–S1 polo stitching ₹42 per good piece; fabric sale FA→S1 ₹360/kg.
Prior: J-Y0 (Sept, closed): 600 kg grey × ₹70 = **₹42,000** unpaid.

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 2 Nov | Movement `job_work_out` FA→D, J-Y1 | FA (self); D "got 326" by phone (on_behalf) | GREY·G-30·A 326.0 kg | @GD → `{FA\|D\|–\|alloc(J-Y1)}` 326.0; expected 2 Nov + 8 d = 10 Nov |
| 2 | 4 Nov | Movement `job_work_out` FA→S1, J-Y2 | FA (self); S1 (account) | KIT-POLO-M 1,000 | @CF → `{FA\|S1\|–\|alloc(J-Y2)}` 1,000 |
| 3 | 9 Nov | Output declared, J-Y1 ("ready, 300 kg") | FA (on_behalf; D is off platform) | NAVY·D-7710·A 300.0 | +300.0 `{FA\|D\|–\|held(dues)}` (§4.2 says outputs post as avail; Y-G5). Pending est. 326 − 300/0.92 = −0.1 ≈ 0 |
| 4 | 9 Nov | Pause `held_for_dues` on J-Y1, reason "₹42,000 old bills (J-Y0)" | FA (on_behalf; the link has no hold action, Y-G3) | — | none; the late clock stops |
| 5 | 16 Nov | FA pays ₹42,000 outside CLAIRE; pause ends | FA (self) | — | none. J-Y0 **still shows ₹42,000 due** (no payments, Y-G1). Expected shifts 10 Nov + 8 paused days = 18 Nov |
| 6 | 17 Nov | Movement `job_work_return` D→FA | D sent (on_behalf, then link "OK" 17 Nov); FA received (self) | NAVY·D-7710 300.0 kg (12 rolls) | `{FA\|D\|held(dues)}` → `{FA\|self@GD\|avail}` 300.0 |
| 7 | 17 Nov | J-Y1 closure | FA (self) | — | `alloc(J-Y1)` −326.0 → `CONSUMED(J-Y1)`; loss 26.0 kg (7.98 %) |
| 8 | 18 Nov | Order O-Y (sale) + Movement `sale` FA→S1 | FA (self); S1 received 100.0 (account) | NAVY·D-7710·A 100.0 kg (4 rolls) @ ₹360 | `{FA\|self@GD\|avail}` −100.0 → `{S1\|self@S1\|–\|avail}` +100.0 |
| 9 | 19 Nov | Outputs declared + `job_work_return` S1→FA | S1 (account); FA (self) | POLO-M A 990, rework 10 | +1,000 `{FA\|S1\|avail}` → `{FA\|self@GD\|avail}` (990 A, 10 rework) |
| 10 | 19 Nov | J-Y2 closure (rework goes to a new job later) | FA | — | `alloc(J-Y2)` −1,000 → `CONSUMED(J-Y2)` |
| 11 | 20 Nov | Set-off: FA deducts the O-Y fabric bill from the J-Y2 stitching bill; S1 agrees in the deal room | FA, S1 (account) | — | no holding change; **no object can record it** (Y-G4) |

### Bills

| Bill | Basis | Amount (₹) | Direction |
|---|---|---|---|
| J-Y0 | 600 kg × 70 | 42,000.00 | FA → D (actually paid 16 Nov; model still shows it as due) |
| J-Y1 | 326.0 kg grey × 85 | 27,710.00 | FA → D |
| FA ↔ D as shown by the model | 42,000 + 27,710 | 69,710.00 | **wrong**: the real figure is 27,710.00 |
| J-Y2 | 990 good × 42 (10 rework unpaid) | 41,580.00 | FA → S1 |
| O-Y | 100.0 kg × 360 | 36,000.00 | S1 → FA |
| Net FA ↔ S1 (shown, not auto-applied, §11) | 41,580 − 36,000 | **5,580.00** | FA → S1 |

Lateness for J-Y1: template 8 d → 10 Nov; paused 9–16 Nov (8 days) → 18 Nov; received 17 Nov → **on time**. Without the pause: late from 11 Nov, very_late from 14 Nov. Actual turnaround 15 d; net of the pause 7 d. §11 doesn't say which one the norm learns.

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| FA | t1: 12 Nov | GD: other stock | D: NAVY 300.0 "ready, held for dues" (alloc GREY 326 still open); S1: 1,000 kits | — | J-Y1 paused; J-Y2 in_progress | D: 42,000 + 27,710 draft; S1: running | J-Y1 **paused, not late** | — |
| FA | t2: 20 Nov | GD: NAVY D-7710 200.0; POLO-M 990 A + 10 rework | — | — | O-Y fulfilled; J-Y1, J-Y2 closed | D 27,710 (+ stale 42,000); S1 net 5,580 to pay | Y-G1 stale due | — |
| D (contact, link) | t1 | n/a | n/a | link: 326 kg grey received; 300 kg navy "ready, on hold" (as told to FA) | — | dues only if FA shares prices | — | S1, the fabric sale, FA's stock |
| S1 | t1 | none | — | FA: KIT-POLO-M 1,000 | J-Y2 (performer) | running receivable | — | D's job, the dues, FA's stock |
| S1 | t2 | S1: NAVY 100.0 kg (owned, bought from FA) | — | FA: 0 | O-Y (buyer) | receivable 41,580; payable 36,000; net **5,580 receivable** | — | D, FA's remaining 200 kg, FA's dyeing cost (₹85/kg) |

### Balance check

| Check | Equation | Result |
|---|---|---|
| J-Y1 (mass_losing) | issued 326.0 = outputs 300.0 + loss 26.0 + residual 0 | ✓ |
| Lot D-7710 | 300.0 = FA GD 200.0 + sold to S1 100.0 | ✓ |
| J-Y2 (assembling) | issued 1,000 = outputs 990 A + 10 rework + residual 0 | ✓ |
| Money | 41,580 − 36,000 = 5,580; 42,000 + 27,710 = 69,710 | ✓ (arithmetic); 69,710 is wrong in substance |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| Y-G1 | There is no way to record that ₹42,000 was paid. "Amount due" only grows, and the held-for-dues pause has no release condition. | A minimal non-quantity `Settlement {counterparty, amount, date, bills[], recorded_by, evidence}`: a note, not payment processing. |
| Y-G2 | §11 defines `late` as "past expected with **pending > 0**". Once D declares outputs, pending ≈ 0, so a job whose goods sit at D is never late, and the pause has nothing to pause. | Late = past expected and (pending input > 0 **or** declared outputs not yet dispatched to the principal or the next hop). |
| Y-G3 | D is off platform; the statement link has no "held for dues / ready" action, so FA must enter D's hold on D's behalf. | Add link proposals `ready(qty)` and `hold(reason)` (posting on acceptance, like returns). |
| Y-G4 | The agreed set-off (fabric bill against stitching bill) can't be recorded; §11 says netting is "shown, not auto-applied". | `Settlement` (Y-G1) with `set_off` lines referencing both bills, confirmed by both sides. |
| Y-G5 | The job pause (`pauses[]`) and the holding state `held(reason)` duplicate each other; §4.2 posts outputs as `avail`. | A job pause sets `held(reason)` on that job's declared outputs at the performer; ending the pause sets them back to `avail`. |

---

## Z · Stock-lot sale

### Setup

| Party | Kind | Role |
|---|---|---|
| VG, Velu Garments (maker-wholesaler) | [B], registered | seller |
| SL, Ganapathi Stock Lots | [B] | buyer |

| Spec | Definition |
|---|---|
| TEE-NV-L | tee · RN-180 · navy · L |
| TEE-BK-M | tee · RN-180 · black · M |
| POLO-WH-XL | polo · PQ-220 · white · XL |
| TEE-S25-{M,L,XL} | tee · "Summer-25 print" (season is a spec attribute) · size |

Opening at VG godown, by grade:

| Spec | A | B | reject |
|---|---|---|---|
| TEE-NV-L | 520 | 0 | 18 |
| TEE-BK-M | 300 | 30 | 0 |
| POLO-WH-XL | 110 | 0 | 0 |
| TEE-S25 M / L / XL | 60 / 70 / 40 | 0 | 0 |

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 10 Nov | Order O-Z (sale). Agreed as a lump sum "about ₹27,000 for the lot"; entered as per-line rates (Z-G1) | VG (self); SL accepts (account) | 6 lines below | none |
| 2 | 12 Nov | Movement `sale` VG→SL, title at_dispatch; SL's own vehicle | VG sent (self); SL received (account) | TEE-NV-L reject 18 @30; TEE-BK-M B 30 @70; POLO-WH-XL A 110 @120; TEE-S25 M 60, L 70, XL 40 A @65 → **328** | per line: `{VG\|self@GD\|–\|avail}` −q → `{SL\|transit}` → `{SL\|self@SL\|–\|avail}` +q, grade kept |
| 3 | 13 Nov | SL in-house checking job J-Z (count_preserving, performer self) to sort the rejects (Z-G2) | SL (self) | in TEE-NV-L reject 18 → out B 10, scrap 8 | −18 avail → `alloc(J-Z)`; +10 B, +8 scrap avail; closure −18 → `CONSUMED(J-Z)` |
| 4 | 13 Nov | Adjustment `write_off` (sold as rag) | SL (self) | TEE-NV-L scrap 8 | −8 → `WRITTEN_OFF(rag)` |

| Line | Qty | Rate ₹ | Value ₹ | Wholesale ₹/pc | At wholesale ₹ |
|---|---|---|---|---|---|
| TEE-NV-L reject | 18 | 30 | 540 | 180 | 3,240 |
| TEE-BK-M B | 30 | 70 | 2,100 | 180 | 5,400 |
| POLO-WH-XL A | 110 | 120 | 13,200 | 290 | 31,900 |
| TEE-S25 (M 60 + L 70 + XL 40) A | 170 | 65 | 11,050 | 170 | 28,900 |
| **Total** | **328** | | **26,890** | | **69,440** → 38.7 % ≈ 40 % ✓ |

Bill O-Z: **₹26,890.00 due SL → VG**.

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| VG | t1: 11 Nov | opening table (grade split) | — | — | O-Z open | — | — | — |
| VG | t2: 12 Nov | TEE-NV-L A 520 / reject 0; TEE-BK-M A 300 / B 0; POLO-WH-XL 0; TEE-S25 0 | — | — | O-Z fulfilled | ₹26,890 receivable | — | SL's other stock, SL's resale prices, J-Z |
| SL | t2 | SL: 328 (reject 18, B 30, A 280) by spec | — | — | O-Z (buyer) | ₹26,890 payable | — | VG's remaining stock, VG's cost, VG's other buyers |
| SL | t3: 13 Nov | TEE-NV-L B 10 (8 written off); rest unchanged | — | — | J-Z closed | — | — | same |

### Balance check

| Check | Equation | Result |
|---|---|---|
| Movement #2 (per line) | sent = received for each of 6 lines; Σ 18 + 30 + 110 + 60 + 70 + 40 = 328 | ✓ |
| VG TEE-NV-L | 538 = A 520 + 0 remaining + 18 sold | ✓ |
| SL J-Z (count_preserving) | 18 = outputs 10 B + 8 scrap + residual 0 | ✓ |
| Value | 540 + 2,100 + 13,200 + 11,050 = 26,890 | ✓ |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| Z-G1 | Stock lots are priced as a lump sum; lines only carry `rate?` / `value?`. Allocating ₹27,000 across grades is invented data. | Header `total_value` with an optional allocation rule (by qty or by reference price); line values derived and marked as allocated. |
| Z-G2 | Regrading without a spec change (reject → B / scrap) needs a "job" (P2 defines jobs as spec changes) or an Adjustment kind that doesn't exist (count / correction / write_off / found). | Adjustment kind `regrade {from_grade, to_grade, qty, reason}` for own goods at own premises; regrading someone else's goods is an assertion (→ quality_claim). |
| Z-G3 | "~40 % of wholesale" needs a reference price; specs have none. Minor; analytics only. | Optional `list_price` per spec per business (private). |

---

## AA · Coordinator with no premises (with bills)

### Setup

| Party | Kind | Role |
|---|---|---|
| KC, Kavin Clothing (coordinator) | [B], registered, `locations = []` | owner, principal, seller |
| FT, Arun Tex (fabric trader) | [C of KC] | sells fabric (direct delivery) |
| C, Sri Cut (cutting unit) | [B] | performer of J-AC |
| ST, Pandian (stitcher) | [C of KC] | performer of J-AS |
| LS, label supplier | [C of KC] | sells labels (direct delivery) |
| PK, Anand Packing | [B] | performer of J-AP; dispatch point |
| RB, Bharathi Stores, Madurai | [B] | buyer |
| AG, Raja (commission agent) | [C of KC] | arranged the sale, 3 % |

| Spec | Definition |
|---|---|
| NAVY | as W, lot FT-88 |
| KIT-{M,L,XL} / TEE-{M,L,XL} / TEE-P-{…} | cut kit / tee / packed tee · RN-180 · navy · size |
| LBL | main label, woven "KC", pc |
| WASTE | cut waste, cotton, kg |
| PBAG / CTN | polybag 10×14 / carton 5-ply (owned by PK) |

Process rates (KC's cards): cutting ₹3 per output piece; stitching ₹18 per good piece; packing ₹2 per output piece plus PK's own material (polybag ₹1.20, carton ₹35). Consumption snapshot: M 0.205, L 0.215, XL 0.228 kg/pc.

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 1 Nov | Purchase + Movement `direct_delivery` FT→C (bill-to KC, ship-to C), tagged J-AC | KC (on_behalf for FT, sent 250.0); C received 250.0 (account) | NAVY·FT-88·A 250.0 kg @ ₹380 | owner FT→KC: → `{KC\|C\|–\|alloc(J-AC)}` 250.0. GST 1-year clock starts 1 Nov (C's receipt) |
| 2 | 3 Nov | Outputs declared, J-AC (cutting, unit_changing) | C (account) | KIT M 300, L 400, XL 300 = 1,000; WASTE 30.0 kg (by-product) | +1,000 `{KC\|C\|–\|avail}`; +30.0 WASTE `{KC\|C\|avail}` |
| 3 | 3 Nov | By-product kept-and-adjusted by C at ₹40/kg (KC has nowhere to take it back to) | KC proposes, C accepts (account) | WASTE 30.0 | `sale_in_place` KC→C: `{KC\|C}` −30.0 → `{C\|C}` +30.0; taxable flag; bill deduction ₹1,200 |
| 4 | 3 Nov | J-AC closure | KC | — | `alloc(J-AC)` −250.0 → `CONSUMED`; est. in kits 215.9, by-product 30.0, **residual 4.1 kg (1.64 %)** |
| 5 | 4 Nov | Movement `hop` C→ST for J-AS, instructed by the owner | KC creates (self); C sent (account); ST received (on_behalf, then link) | KIT 1,000 | `{KC\|C\|avail}` → `{KC\|ST\|–\|alloc(J-AS)}` 1,000. `via` left empty because this is owner-instructed, not a sub-contract (AA-G6) |
| 6 | 4 Nov | Movement `direct_delivery` LS→ST, J-AS | KC (on_behalf, both sides) | LBL 1,020 @ ₹0.80 | → `{KC\|ST\|–\|alloc(J-AS)}` 1,020 |
| 7 | 10 Nov | Outputs declared, J-AS | KC (on_behalf, ST by phone) | TEE M 298 A + 2 B; L 397 A + 3 B; XL 297 A + 3 B = **992 A + 8 B** | +1,000 `{KC\|ST\|avail}` |
| 8 | 10 Nov | Movement `hop` ST→PK, J-AP | ST sent (link); PK received (account) | TEE A 992, B 8 | → `{KC\|PK\|–\|alloc(J-AP)}` 992; `{KC\|PK\|–\|avail}` B 8 |
| 9 | 10 Nov | J-AS closure; leftover labels kept-for-next-job | KC | — | kits −1,000 → `CONSUMED`; LBL −1,000 → `CONSUMED`; LBL 20 `alloc` → `{KC\|ST\|avail}` |
| 10 | 12 Nov | Outputs declared, J-AP, plus PK's own material | PK (account) | TEE-P M 298, L 397, XL 297 = 992; PBAG 992 and CTN 25 (`jw_own_material`) | +992 `{KC\|PK\|avail}`; `{PK\|PK}` PBAG −992, CTN −25 → `CONSUMED(J-AP)`; closure: tees −992 alloc → `CONSUMED` |
| 11 | 14 Nov | Order O-AA2 (sale) KC→RB, arranged by AG (3 %, AA-G1); Movement `sale` from PK to RB, seller KC | KC (self); PK sent (account); RB received (account) | TEE-P M 288, L 384, XL 288 = 960 (24 ctn × 40, ratio 12:16:12) @ ₹150 | `{KC\|PK\|avail}` −960 → `{RB\|transit}` → `{RB\|self@RB\|avail}` +960 |

### Bills

| Bill | Basis | Amount (₹) | Direction |
|---|---|---|---|
| FT fabric | 250.0 kg × 380 | 95,000.00 | KC → FT |
| C cutting | 1,000 × 3 − waste 30.0 × 40 | 3,000.00 − 1,200.00 = 1,800.00 | KC → C |
| LS labels | 1,020 × 0.80 | 816.00 | KC → LS |
| ST stitching | 992 A × 18 (B unpaid?) | 17,856.00 (18,000.00 if B is paid; AA-G5) | KC → ST |
| PK packing | 992 × 2 + PBAG 992 × 1.20 + CTN 25 × 35 | 1,984.00 + 1,190.40 + 875.00 = 4,049.40 | KC → PK |
| RB sale | 960 × 150 | 144,000.00 | RB → KC |
| AG commission | 3 % × 144,000 | 4,320.00 | KC → AG (not representable) |

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| KC | t1: 4 Nov, after #5–6 | **none** (no locations; section hidden) | ST: 1,000 kits + 1,020 labels alloc J-AS | — | J-AS issued; purchase fulfilled | FT 95,000; C 1,800 | cutting residual 1.64 % | — |
| KC | t2: 14 Nov | none | PK: TEE-P 32 (M 10, L 13, XL 9) + TEE B 8; ST: LBL 20 | — | O-AA2 fulfilled | RB 144,000 receivable; ST, PK, LS payable | GST: sale from a job worker's premises (no rule, AA-G4) | — |
| C | t1 (just before #5) | C: WASTE 30.0 kg (bought by adjustment) | — | KC: 1,000 kits | J-AC closed | 1,800 receivable | — | FT's price, ST's phone (AA-G7), the sale |
| ST (contact, link) | t1 | n/a | n/a | link: 1,000 kits from C for KC; 1,020 labels | — | — | — | RB, PK's rates, sale price |
| ST | t2 | n/a | n/a | link: 20 labels kept for KC's next job | — | 17,856 (if KC shares) | — | same |
| PK | t2 | PK: own PBAG/CTN stock (−992 / −25) | — | KC: TEE-P 32, TEE B 8 | J-AP closed | 4,049.40 receivable | — | **sale rate ₹150 on the sale movement, which PK can see as the physical sender (AA-G2)**; KC's fabric cost; ST's rate |
| RB | t2 | RB: TEE-P 960 | — | — | O-AA2 (buyer) | 144,000 payable | — | KC's chain; but the movement shows `from: PK` (AA-G3) |
| AG, FT, LS (contacts) | t2 | n/a | n/a | only their own lines with KC via their link | — | — | — | everything else |

### Balance check

| Check | Equation | Result |
|---|---|---|
| J-AC fabric (unit_changing) | 250.0 = est. in kits (300 × 0.205 + 400 × 0.215 + 300 × 0.228 = 61.5 + 86.0 + 68.4 = 215.9) + by-product 30.0 + residual 4.1 | ✓ |
| J-AS kits (assembling) | 1,000 = 992 A + 8 B + 0 | ✓ |
| J-AS labels (secondary) | 1,020 = consumed 1,000 + kept_for_next 20 + 0 | ✓ |
| J-AP tees | 992 = 992 packed + 0 | ✓ |
| Packed tees | M 298 = 288 + 10; L 397 = 384 + 13; XL 297 = 288 + 9 → 992 = 960 sold + 32 at PK | ✓ |
| Cartons | 960 / 40 = 24 full + 1 carton of 32 = 25 | ✓ |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| AA-G1 | The commission agent AG has no role (§8 lists principal, performer, seller, buyer, custodian, transporter, via) and no field for commission; the ₹4,320 can't be billed. | `Order.intermediaries[] {party, role: agent \| broker, commission_pct \| amount}`; the agent sees only the order header and its own commission. |
| AA-G2 | The line `rate?` / `value?` on the sale movement is visible to PK, because §7 makes movements visible to their physical `from` party. That contradicts "rates only to the two parties of that order". | Field-level visibility: price fields on a movement line are visible only to its seller and buyer (or to principal and performer). |
| AA-G3 | RB sees `from: PK`, which exposes the coordinator's packer. Coordinators lose business when buyers bypass them. | The buyer's view shows "dispatched for KC", and the physical `from` is hidden unless the seller reveals it. |
| AA-G4 | A sale from a job worker's premises is lawful only if the job worker is registered or the principal declares the premises (s.143). §10 has no check. | §10 warning: purpose = sale, `from` = a custodian that isn't the seller, seller registered → "confirm PK is registered or declared as your place of business". |
| AA-G5 | `per_good_output_piece`: is grade B "good"? This is ₹144 at stake here. | The RateCard lists paid grades (default A + B), or gives a per-grade rate. |
| AA-G6 | The §4.1 `hop` row says the new holding has `via` = the forwarding job worker, which is right for a sub-contract (S1→H) but wrong for owner-instructed hops (C→ST, ST→PK). The rule doesn't distinguish them. | Hop carries `instructed_by: owner \| custodian`; set `via` only when the custodian sub-contracts. |
| AA-G7 | C records the hop to ST, but ST is a contact owned by **KC** (§3.1: contacts belong to exactly one business). C can't reference it without seeing KC's private contact (and its phone number). | A movement may reference another business's contact as a display-only party (name only); or only the owner records hops to its own contacts and the custodian confirms. |
| AA-G8 | §3.1 says a business has "one default" location; KC has none. | `locations[]` may be empty; views then hide "own premises". |

---

## AB · Multiple premises and sister GSTINs

### Setup

| Party | Kind | Role |
|---|---|---|
| FA | [B], GSTIN 33…A; locations GD (godown, Mangalam Road, default) and CF (cutting floor, 2 km away); staff Selvi (GD), Ramesh (CF) | owner, principal |
| BR, Senthil Packers (brother's firm) | [B], GSTIN 33…B; `related_business_ids` ↔ FA | performer of J-AB (packing) |

Owner user Arjun (FA) also keeps BR's books (AB-G1). Specs: NAVY·D-7710 (from Y); TEE-{M,L,XL} RN-180 navy; TEE-P packed; PBAG, CTN owned by BR. The scenario says "2,000 kits for packing"; packing applies to garments, so this reads it as **2,000 stitched tees** (AB-G3).
Opening: FA GD NAVY·D-7710 200.0 kg; FA GD TEE M 700, L 800, XL 500 = 2,000 A. BR's own stock: 5,000 packed vests (BR's own brand).

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 5 Nov | Movement `transfer` GD→CF (same owner, location only) | Selvi sent 150.0 (self); Ramesh received 149.2 (self) | NAVY·D-7710·A 150.0 kg | `{FA\|self@GD\|avail}` −150.0 → `{FA\|self\|–\|transit(M1)}` → `{FA\|self@CF\|avail}` +149.2; 0.8 kg (0.53 % < 1.5 %) → `LOSS(weighing_difference, self)` |
| 2 | 6 Nov | Movement `job_work_out` FA→BR, J-AB; DC FA/25-26/0412 (FA's series): two legal entities, so a challan is needed | FA (self); BR received (account) | TEE M 700, L 800, XL 500 = 2,000 | @GD → `{FA\|BR\|–\|alloc(J-AB)}` 2,000 |
| 3 | 8 Nov | Outputs declared, J-AB, plus BR's own material | BR (account) | TEE-P M 700, L 797, XL 499 = 1,996 A; TEE L 3, XL 1 = 4 reject (stained, unpacked); PBAG 1,996 @ ₹1.10, CTN 40 @ ₹32 (`jw_own_material`) | +1,996 TEE-P `{FA\|BR\|avail}`; +4 TEE reject `{FA\|BR\|avail}` (grade change; Z-G2); `{BR\|BR}` PBAG −1,996, CTN −40 → `CONSUMED(J-AB)` |
| 4 | 9 Nov | Movement `job_work_return` BR→FA (BR's return challan) | BR sent (account); Selvi received (self) | TEE-P 1,996; TEE reject 4 | → `{FA\|self@GD\|avail}` |
| 5 | 9 Nov | J-AB closure | FA | — | `alloc(J-AB)` −2,000 → `CONSUMED(J-AB)` |

Bill J-AB (per_output_piece ₹1.50 + own material): 1,996 × 1.50 = 2,994.00 + PBAG 1,996 × 1.10 = 2,195.60 + CTN 40 × 32 = 1,280.00 → **₹6,469.60 due FA → BR**.

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| FA | t1: 6 Nov | **GD:** NAVY 50.0, TEE 0; **CF:** NAVY 149.2 | BR: TEE 2,000 alloc J-AB | — | J-AB issued | — | internal weighing difference 0.8 kg | BR's own 5,000 vests, BR's other principals |
| FA | t2: 9 Nov | GD: TEE-P 1,996, TEE reject 4, NAVY 50.0; CF: NAVY 149.2 | — | — | J-AB closed | **₹6,469.60** to BR | 4 stained | same |
| BR | t1 | BR: 5,000 packed vests, PBAG/CTN stock | — | FA: TEE 2,000 | J-AB (performer) | — | — | FA's fabric at GD/CF, FA's goods at S1/D, FA's rates with others |
| BR | t2 | BR: vests 5,000; PBAG −1,996, CTN −40 | — | FA: 0 | J-AB closed | ₹6,469.60 receivable | — | same |

The link (`related_business_ids`) grants nothing. Every query is filtered by the session's business id; Arjun gets FA's data when logged in as FA and BR's data only from a separate BR session (AB-G1).

### Balance check

| Check | Equation | Result |
|---|---|---|
| Transfer M1 (§5.1) | sent 150.0 = received 149.2 + weighing difference 0.8 | ✓ |
| FA lot D-7710 | 200.0 = GD 50.0 + CF 149.2 + LOSS 0.8 | ✓ |
| J-AB per size | M 700 = 700 + 0; L 800 = 797 + 3; XL 500 = 499 + 1 | 2,000 = 1,996 + 4 ✓ |
| BR own material | PBAG 1,996 consumed; CTN ⌈1,996 / 50⌉ = 40 consumed | ✓ |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| AB-G1 | One person runs or keeps the books for both sister firms; §3.1 says staff belong to one business, and an owner user has one business. | `memberships[] {business_id, role}` per user, with an explicit business switch per session; data stays filtered by the session's business. |
| AB-G2 | An owner of both firms may want a combined (group) view; the model rightly forbids sharing by link alone, but there is no consented path. | Optional `group_view_grant`, accepted by both owners, read-only; parties stay separate. (Open question, not a defect.) |
| AB-G3 | The scenario's wording ("kits for packing") is inconsistent with the process; read as stitched tees. | Fix the wording in 01 §7. |

---

## AC · Fault traced upstream, and a purchase return

### Setup

| Party | Kind | Role |
|---|---|---|
| FA | [B], registered | buyer, principal, claimant |
| K, Velan Knits (knitter) | [B] | seller of grey; claim respondent |
| D, Murugan Dyeing | [C of FA] | performer of J-AC1 |
| S1 | [B] | performer of J-AC3 |
| F, fabric shop | [B] | seller of black fabric |

Specs: GREY, NAVY (as W); KIT-L, TEE-L (RN-180 navy L); WASTE; BLACK = SJ finished 180 GSM 36" open black.
Lineage: G-55 (grey, origin purchase from K) → D-8120 (output of J-AC1) → C-31 (output of in-house cutting J-AC2) → TEE-L output of J-AC3 (unlabelled; linked by the job). FB-61, FB-63 (black, purchased from F).
Rates: grey ₹230/kg; dyeing ₹85/kg grey; S1 ₹16 per good piece; black SJ ₹410/kg.

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 1 Oct | Purchase + Movement `direct_delivery` K→D (bill-to FA), tagged J-AC1 | K sent 400.0 (account); D received 397.0 (FA on_behalf) | GREY·G-55·A 400.0 kg @ ₹230 | `{K\|K}` −400.0 → `{FA\|transit}` → `{FA\|D\|–\|alloc(J-AC1)}` +397.0; 3.0 kg (0.75 %) → `LOSS(weighing_difference, per terms)` |
| 2 | 9 Oct | Output declared + `job_work_return` D→FA; J-AC1 closure | FA (on_behalf); D link OK | NAVY·D-8120·A 366.0 | → `{FA\|self@GD\|avail}` 366.0; `CONSUMED(J-AC1)` 397.0; loss 31.0 kg (7.81 %) |
| 3 | 12 Oct | In-house cutting J-AC2 (unit_changing, performer self), issue → outputs → closure | FA (self) | NAVY 366.0 → KIT-L·C-31 1,600 (0.220 kg/pc snapshot); WASTE 12.0 kg | @GD → `alloc` → `CONSUMED` 366.0; +1,600 kits; +12.0 waste; est. 352.0; **residual 2.0 kg (0.55 %)** |
| 4 | 14 Oct | Movement `job_work_out` FA→S1, J-AC3 | FA (self); S1 (account) | KIT-L·C-31 1,600 | → `{FA\|S1\|–\|alloc(J-AC3)}` |
| 5 | 22 Oct | Outputs + `job_work_return` S1→FA; J-AC3 closure | S1 (account); FA (self) | TEE-L A 1,560, reject 40 (holes; S1's note "fabric fault") | → `{FA\|self@GD\|avail}` 1,560 A + 40 reject; `CONSUMED(J-AC3)` 1,600 |
| 6 | 24 Oct | Discrepancy D-AC `upstream_fault`, FA vs K; refs: 40 TEE-L reject → C-31 → D-8120 → G-55 | FA (self) opens; K (account) | 40 pcs; fabric equivalent 40 × 0.220 = 8.8 kg finished ÷ (366/397) = 9.55 kg grey × 230 = **₹2,195.43** | none (a value claim; the goods stay with FA as reject) |
| 7 | 30 Oct | D-AC: FA ₹2,195 → K counters ₹1,500 → FA accepts ₹2,000 → resolved, outcome `credit` | FA, K (account) | — | no quantity change; credit ₹2,000 against K's purchase bill |
| 8 | 2 Nov | Purchase: Movement `sale` F→FA | F sent 231.5 (account); FA received 231.5 (self) | BLACK·FB-61·A 231.5 kg (10 rolls) @ ₹410 | → `{FA\|self@GD\|avail}` |
| 9 | 6 Nov | 2 rolls found with dye patches; D-AC2 `quality_claim` vs F | FA (self) | 46.0 kg | none. Changing grade A → reject has no event (Z-G2) |
| 10 | 7 Nov | Movement `return` FA→F (purchase return; owner FA→F at dispatch), disposition: replace (AC-G3) | FA sent 46.0 (23.4 + 22.6) (self); F received 45.6 (account) | BLACK·FB-61 46.0 kg | `{FA\|self@GD}` −46.0 → `{F\|transit}` → `{F\|self@F\|avail}` +45.6; 0.4 kg (0.87 %) → `LOSS(weighing_difference)` |
| 11 | 9 Nov | Movement `sale` F→FA (replacement, same order); D-AC2 resolved | F sent 46.8 (account); FA received 46.8 (self) | BLACK·**FB-63**·A 46.8 kg (2 rolls) @ ₹410 | → `{FA\|self@GD\|avail}` 46.8. Mixing lots FB-61 and FB-63 in one lay will raise the §10.5 warning |

### Bills

| Bill | Basis | Amount (₹) |
|---|---|---|
| K grey | 400.0 × 230 = 92,000.00 − credit 2,000.00 | **90,000.00** FA → K (on K's 400 kg; on D's 397 kg it would be 91,310.00 before credit; W-G3) |
| D dyeing | 397.0 × 85 | 33,745.00 FA → D |
| S1 stitching | 1,560 × 16 | 24,960.00 FA → S1 (25,600.00 if fabric-fault rejects are paid; AC-G2) |
| F black | 231.5 × 410 = 94,915.00 − return 46.0 × 410 = 18,860.00 + replacement 46.8 × 410 = 19,188.00 | **95,243.00** FA → F (95,407.00 if credited on F's 45.6 kg) |

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| FA | t1: 24 Oct | GD: TEE-L 1,560 A + 40 reject; WASTE 12.0 | — | — | D-AC open | K 92,000; D 33,745; S1 24,960 | lineage panel: 40 reject ← C-31 ← D-8120 (D, 7.81 %) ← G-55 (K, 1 Oct) | — |
| FA | t2: 9 Nov | GD: BLACK FB-61 185.5 + FB-63 46.8 = 232.3 | — | — | D-AC resolved (credit 2,000); D-AC2 resolved | K 90,000; F 95,243 | lot-mix warning at next cutting | — |
| K | t1 | K's own stock | — | — | D-AC (respondent); its sale to FA | 92,000 receivable | claim: 40 pcs, lot G-55, photos, ₹2,195 | **D's loss %, FA's dyeing rate, S1's identity and rate** (refs pass through jobs K isn't party to; AC-G1). K does know D, as the `to` of its own delivery |
| S1 | t1 | — | — | FA: 0 | J-AC3 closed | 24,960 receivable (S1 wants 25,600) | 40 rejects marked fabric fault | D-AC, K, D |
| D (contact, link) | t1 | n/a | n/a | link: 397 kg grey, 366 kg returned | — | — | — | D-AC (not a party), S1 |
| F | t2 | F: +45.6 kg returned FB-61 | — | — | sale, return, replacement on one order | 95,243 receivable | weighing difference 0.4 on the return | D-AC with K, FA's other suppliers |

### Balance check

| Check | Equation | Result |
|---|---|---|
| Direct delivery #1 (§5.1) | 400.0 = 397.0 + 3.0 | ✓ |
| J-AC1 (mass_losing) | 397.0 = 366.0 + loss 31.0 | ✓ |
| J-AC2 (unit_changing) | 366.0 = est. 352.0 + by-product 12.0 + residual 2.0 | ✓ |
| J-AC3 (assembling) | 1,600 = 1,560 A + 40 reject + 0 | ✓ |
| Return #10 | 46.0 = 45.6 + 0.4 | ✓ |
| FA black | 231.5 − 46.0 + 46.8 = 232.3 (185.5 FB-61 + 46.8 FB-63) | ✓ |
| Claim | 9.55 kg × 230 = 2,195.43 claimed; 2,000.00 credited; no quantity effect | ✓ |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| AC-G1 | The upstream_fault's refs chain through J-AC1 (D) and J-AC3 (S1), which K isn't party to; §7 gives K the discrepancy but says nothing about the referenced records. Either K can't see the evidence, or it sees third parties' loss and rates. | The discrepancy carries a frozen **lineage excerpt** (lot ids, specs, quantities, dates, photos) with third-party names and rates redacted. |
| AC-G2 | Output lines have a grade but no **cause**. With `per_good_output_piece`, S1 isn't paid for 40 pieces it stitched that failed because of the fabric (₹640). | `reject_cause: own \| input_fault(lot) \| unknown` on output lines; the RateCard says whether input-fault rejects are paid. |
| AC-G3 | A purchase return has no `disposition` (credit vs replace), and the replacement movement has no link to the returned line; the bill nets them only by convention. | `return` line `disposition: credit \| replace`; replacement movement carries `replaces: movement_line_id`. |

---

## AD · Packs, sets and samples

### Setup

| Party | Kind | Role |
|---|---|---|
| KPR (vest maker) | [B], registered | owner, performer (in-house), seller, sample sender |
| RT, Anbu Stores (retailer) | [B] | buyer; sales return |
| PB, Northstar Retail, Bengaluru (prospective buyer) | [B], deal room with KPR | sample receiver |
| SD, Selvam Dyeing | [C of KPR] | lab-dip sender |

| Spec | Definition |
|---|---|
| VEST-{W,G,B}-90 | vest · rib · white / grey / black · 90 cm |
| PACK3-90 | pack · 3-pack vest 90 = W + G + B (pack definition on the Style) |
| COVER | printed pack polybag (KPR stock) |
| GYM-FAB | SJ lycra 200 GSM black |
| GYM-KIT-L / PROTO-GYM-L | proto kit / proto gym vest L (sample) |
| SWATCH | lab-dip swatch card LD-901-{A,B,C} |

Opening at KPR godown: VEST W 1,500, G 1,400, B 1,300; COVER 2,000; GYM-FAB 12.0 kg.

### Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | 2 Nov | Movement `sample` SD→KPR, 3 lab-dip swatches | KPR (on_behalf for SD; received self) | SWATCH 3 pc (owner SD) | on receipt: +3 → `WRITTEN_OFF(sample, KPR)` (§4.1: "from the receiver's holding") |
| 2 | 3 Nov | In-house packing J-AD1 (assembling, performer self): issue | KPR staff (self) | W 1,200, G 1,200, B 1,200, COVER 1,210 | avail → `alloc(J-AD1)` @GD |
| 3 | 4 Nov | Outputs + dispositions, J-AD1 | self | PACK3-90 A 1,199; VEST-B 1 stained (→ reject); COVER 3 torn (scrap); leftover W 1, G 1, COVER 8 | +1,199 packs avail; B 1 `alloc` → reject avail (regrade, Z-G2); COVER 3 → `WRITTEN_OFF(scrap)`; leftovers `alloc` → avail |
| 4 | 4 Nov | J-AD1 closure | self | — | `alloc` → `CONSUMED(J-AD1)`: W 1,199, G 1,199, B 1,199, COVER 1,199 |
| 5 | 5 Nov | In-house proto cutting J-AD3 (unit_changing) | self | GYM-FAB 2.00 kg → GYM-KIT-L 6 (0.240 kg/pc); waste 0.40 kg | est. 1.44 + by-product 0.40 + **residual 0.16 kg (8.0 %)**, flagged above the cutting norm (a prototype, so expected) |
| 6 | 6 Nov | In-house proto stitching J-AD4 (assembling) | self | GYM-KIT-L 6 → PROTO-GYM-L 6 A | kits → `CONSUMED`; +6 protos avail |
| 7 | 6 Nov | Order + Movement `sale` KPR→RT | KPR (self); RT received (account) | PACK3-90 600 @ ₹240 | `{KPR\|self@GD}` −600 → `{RT\|self@RT\|avail}` +600 |
| 8 | 7 Nov | Order (kind sample) in the KPR–PB deal room + Movement `sample` KPR→PB | KPR sent (self); PB received (account) | PROTO-GYM-L 6 | @GD −6 → transit → on receipt `{PB\|PB}` +6 → −6 `WRITTEN_OFF(sample, PB)`. Whose books carry it is ambiguous (AD-G2) |
| 9 | 8 Nov | KPR tries to forward approved swatch LD-901-B to PB | KPR | SWATCH 1 | **rejected by §5.4**: written off on receipt (#1), so the holding is 0 (AD-G2) |
| 10 | 16 Nov | Movement `return` RT→KPR (sales return; owner RT→KPR), 12 broken packs | RT sent (account); KPR received (self) | PACK3-90 12 | `{RT\|self@RT}` −12 → `{KPR\|self@GD\|avail}` +12 |
| 11 | 17 Nov | In-house unpack J-AD2 (disassembling) | self | PACK3-90 12 → VEST-W 12 A; VEST-G 11 A + 1 B; VEST-B 12 A; COVER 12 torn | packs → `CONSUMED(J-AD2)`; +36 vests avail; COVER 12 → `WRITTEN_OFF(scrap)`: no bucket in the disassembling row (AD-G1) |

Bill RT: 600 × 240 = 144,000.00 − return 12 × 240 = 2,880.00 → **₹141,120.00 due RT → KPR**.

### Participant views

| Participant | Moment | Owned at own premises | Owned at others | Held for others | Open jobs / orders | Bills | Flags | Must NOT see |
|---|---|---|---|---|---|---|---|---|
| KPR | t1: 6 Nov, after #7 | W 301; G 201; B 100 A + 1 reject; PACK3 599; COVER 798; GYM-FAB 10.0; PROTO 6 | — | — | RT sale fulfilled; sample order open | RT 144,000 receivable | proto cutting residual 8 % | — |
| KPR | t2: 17 Nov | W 313; G 212 A + 1 B; B 112 A + 1 reject; PACK3 599; COVER 798; GYM-FAB 10.0 | — | — | J-AD2 closed | RT **141,120** | "Swatch can't be sent: written off" (#9) | — |
| RT | t1 / t2 | PACK3 600 / 588 | — | — | sale; return 12 | 144,000 / 141,120 payable | — | KPR's stock, PB, protos, KPR's cost |
| PB | t2 | **nothing**: the 6 protos were written off on receipt (AD-G2) | — | — | sample order fulfilled (deal room) | — | — | RT, KPR's stock and costs |
| SD (contact, link) | t1 | n/a | n/a | link: 3 swatches sent to KPR | — | — | — | everything else |

### Balance check

| Check | Equation | Result |
|---|---|---|
| J-AD1 W (assembling, primary) | 1,200 = consumed 1,199 + returned 1 | ✓ |
| J-AD1 G | 1,200 = 1,199 + 1 | ✓ |
| J-AD1 B | 1,200 = 1,199 + scrapped/regraded 1 | ✓ |
| J-AD1 COVER (secondary) | 1,210 = 1,199 + scrap 3 + leftover 8 | ✓ |
| Packs | 1,199 = KPR 599 + RT 588 + unpacked 12 | ✓ |
| J-AD2 (disassembling) | outputs = 12 × (1 W + 1 G + 1 B) = 12 / 12 / 12 (G: 11 A + 1 B) | ✓ |
| Vests at t2 | W 1,500 − 1,200 + 1 + 12 = 313; G 1,400 − 1,200 + 1 + 12 = 213 (212 A + 1 B); B 1,300 − 1,200 + 1 + 12 = 113 (112 A + 1 reject) | ✓ |
| J-AD3 | 2.00 = 1.44 + 0.40 + 0.16 | ✓ |
| J-AD4 → sample | 6 = 6 protos → 6 `WRITTEN_OFF(sample, PB)` | ✓ |
| §5.5 for owner KPR, PACK3 | holdings 599 + CONSUMED 12 = inflows 1,199 + 12 returned **− 600 sold** | closes only with an outflow term (AD-G3) |

### Model gaps

| ID | What broke | Minimal fix |
|---|---|---|
| AD-G1 | The pack definition (W + G + B) leaves out packaging, so unpacking leaves 12 torn covers with no bucket; §5.2's disassembling row allows loss 0 and outputs = input × definition only. | The pack definition lists packaging components; disassembly declares them as by-product, scrap or reusable. |
| AD-G2 | `sample` posts `WRITTEN_OFF` "from the receiver's holding" at receipt: (a) PB, the receiver, ends up with nothing, though it may want to track samples received; (b) a swatch that KPR received and then forwards (#9) is blocked; (c) it's unclear whose per-owner equation carries the write-off. | Write off in the **sender's** books at dispatch (`WRITTEN_OFF(sample, to party)`); the receiver gets a normal owned holding it can keep, forward or write off. |
| AD-G3 | §5.5 lists only inflows (purchases, outputs, found, gains) on the right-hand side; sales, purchase returns, samples given and consignment settlements reduce a seller's holdings with no seller-side term (X, Z, AC, AD). | RHS = inflows − ownership transferred out (sales, returns to supplier, samples), with transfers in counted as inflows. |
| AD-G4 | §5.2's "assembling primary" row assumes one primary input (kits → garments). A 3-pack has three primary inputs consumed 1:1:1. It works per line, but the rule doesn't say so. | Restate: each primary input line is consumed at outputs × BOM / pack ratio. |

---

## Consolidated gaps (U–AD)

| ID | One line | Severity |
|---|---|---|
| U-G1 | Custodian count of job inputs: "book" is either alloc (3,000) or pending estimate (2,980) | medium |
| U-G2 | No shortage bucket for count-based jobs; count_mismatch outcomes worded for movements | medium |
| U-G3 | ADJUSTMENT bucket missing from §4 list and §5.5 | low |
| U-G4 | Unit slips 12× low (or on dispatch) pass every check and open false disputes | **high** |
| U-G5 | Over-receipt (r > s) posting undefined; negative disputed holding | **high** |
| U-G6 | Sender can't amend own sent assertion before receipt (only cancel) | medium |
| U-G7 | No `unit_source` (typed / defaulted / parsed) on Quantity | low |
| U-G8 | Staff count adjustments post without owner review; no aggregate count | low |
| V-G1 | No order amendment / cancellation record | medium |
| V-G2 | No rule to release material from a run after cancellation | low |
| V-G3 | `cancelled_partial` skips closure (bill/lock unclear) | medium |
| W-G1 | Per-receipt rate override vs per_input_mass basis: bill ₹40,316.32 ≠ agreed ₹40,000 | **high** |
| W-G2 | Rate is one-sided (per-viewer RateCard); no rate agreement/dispute | medium |
| W-G3 | Bill qty basis (sender vs receiver weight) unspecified | medium |
| X-G1 | Consignment sell-through has no purpose; contact-owned holdings dangle in the ledger | **high** |
| X-G2 | Statement link can't report sold or remaining qty | medium |
| X-G3 | No outcome "charge shortage as sale" | low |
| X-G4 | No statutory clock for consignment (6 months) | medium |
| Y-G1 | No payment / settlement record: dues never clear | **high** |
| Y-G2 | `late` keyed on pending input; outputs held at the performer are never late | **high** |
| Y-G3 | Off-platform performer can't signal ready / held for dues | medium |
| Y-G4 | No record of an agreed cross-bill set-off | medium |
| Y-G5 | Job pause and `held(reason)` holding state duplicated / unlinked | low |
| Z-G1 | No lump-sum price for a mixed lot | low |
| Z-G2 | No regrade event (grade change without spec change) | medium |
| Z-G3 | No reference price for "% of wholesale" | low |
| AA-G1 | Agent / commission party not representable | medium |
| AA-G2 | Line rates leak to the physical `from` party (packer sees sale price) | **high** |
| AA-G3 | Buyer sees the coordinator's packer as `from` | medium |
| AA-G4 | No check for a sale from a job worker's premises (registration / APOB) | low |
| AA-G5 | per_good_output_piece: are B grades paid? | low |
| AA-G6 | Hop `via` rule doesn't distinguish owner-instructed hop vs sub-contract | medium |
| AA-G7 | A custodian can't reference the principal's contact (contacts are single-owner) | medium |
| AA-G8 | "One default location" contradicts a business with no premises | low |
| AB-G1 | One user can't belong to two businesses (sister firms) | medium |
| AB-G2 | No consented group view across sister firms (open question) | low |
| AB-G3 | Scenario wording: "kits for packing" should be garments | low |
| AC-G1 | Upstream claim refs reach third-party jobs; needs a redacted lineage excerpt | medium |
| AC-G2 | No reject cause; stitcher unpaid for fabric-fault rejects | medium |
| AC-G3 | Purchase return lacks credit/replace disposition and replacement link | low |
| AD-G1 | Pack definition omits packaging; disassembly leaves covers unbucketed | low |
| AD-G2 | Sample write-off at receiver: receiver has nothing, forwarding blocked, owner ambiguous | medium |
| AD-G3 | §5.5 global equation lacks ownership-transfer outflows | **high** |
| AD-G4 | Assembling rule assumes one primary input | low |
