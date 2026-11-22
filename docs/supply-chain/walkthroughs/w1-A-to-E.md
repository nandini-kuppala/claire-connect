# W1 · Walkthroughs A–E (incl. E2) against `02-domain-model.md`

Verifies the Phase 2 model by walking scenarios A, B (BRIEF §3) and C, D, E/E2 (01 §7) through it. Only model vocabulary is used; anything the model lacks is used *once, marked `[Gn]`*, and listed in §6.

## 0. Conventions

| Item | Meaning |
|---|---|
| Postings | `owner@custodian[/via] state ±qty`. States: `av` available · `alloc(J)` · `tr(#n)` in transit on event n · `disp(X)` disputed · `held(r)`. Spec · lot · grade are in the *Lines* column. Location omitted (all own premises are the default location). |
| Pseudo-holdings | `LOSS(kind)`, `CONSUMED(J)`, `WRITTEN_OFF(r)`, `ADJUSTMENT(r)` (§4). `EXT(party)` = source/sink for a party whose stock is not on the ledger — **not in the model [G1]**. |
| Evidence | `self`, `on_behalf`, `link`, `account` (§9.1); `rcv-only` = receiver recorded first (§4.1). |
| Units | kg shown to 0.1 kg (stored g); thread in m (cone = 3,000 m); pieces. |
| Book vs pending | Per §4.2 the input stays in `alloc(J)` at the full issued qty until **closure**. Views show the book and, beside it, *pending* (exact, or **≈ est** per P10). The double count this causes is gap [G2]. |
| "Issued" | taken as the **received** qty of the issuing movement (model is ambiguous [G8]). |
| Calendars | wet processing/knitting 7-day; piece work 6-day (Sunday off). Templates from `lead-times-losses.md`: dyeing 7 d / 8 %, knitting 5 d / 1.5 %, cutting 2 d / 12 %, stitching 6 d, alteration 3 d, panel printing 4 d / 1.5 %. |

---

## Scenario A — father's unit (BRIEF §3 A)

### A.1 Setup

| Party | Kind | On platform | Role(s) here |
|---|---|---|---|
| F | Business (fabric shop, GST reg.) | yes | buyer from K; principal at D; seller to FA |
| K | Contact of F (knitter) | **no** | seller of grey |
| D | Business (dyer) | yes | performer JD-N, JD-B; custodian for F |
| FA | Business (father's unit, GST reg.) | yes | buyer; principal (in-house + S1, S2); seller |
| T1 | Contact of FA (trims shop) | **no** | seller of buttons, zips |
| T2 | Business (thread shop) | yes | seller of thread |
| S1 | Business (stitching unit) | yes | performer JS1, JS1-RW |
| S2 | Contact of FA (stitching unit, phone only; statement link) | **no** | performer JS2, JS2-RW |
| R1, R2 | Businesses (retailers) | yes | buyers |
| R3 | Contact of FA (seller) | **no** | buyer |
| TR | Contact of FA (parcel service) | **no** | transporter to R1 |

| Spec code | Spec (material type + spec attributes) |
|---|---|
| GRY | Knitted fabric · single jersey · grey · PC 65/35 · 150 GSM · 30" tubular |
| NVY / BLK | Knitted fabric · SJ · finished · PC 65/35 · 170 GSM · 36" open · navy / black |
| KIT·sz·col | Cut kit · style FR-ZT (half-zip tee) · size · colour |
| TEE·sz·col | Garment · FR-ZT · size · colour |
| PKD·sz·col | Garment · FR-ZT · size · colour · packed (polybag) |
| ZIP4 / ZIP5 | Zip · nylon coil · black · 4" (S, M) / 5" (L–XXL) |
| BTN | Button · 4-hole · 14L · black |
| THN / THB | Thread · spun poly · Tex 27 · navy / black (m) |
| PBG | Polybag · LDPE · 12×16" |
| CWS | Waste · cut waste · PC |

Style FR-ZT BOM snapshot: fabric g/pc S 180 · M 190 · L 200 · XL 210 · XXL 220; per piece 1 zip, 2 buttons, 150 m thread; cutting loss plan 12 %; ratio 1:2:2:2:1 → plan per colour from 100 kg: 88,000 g ÷ 200 g avg = **440** (S55 M110 L110 XL110 XXL55).

Lots: G-1 (grey, purchase) → DN-1 navy, DB-1 black (job_output, parent G-1) → CN-1 / CB-1 cut lots. Trims unlabelled.

| Job | ProcessType (conservation_kind · rate_basis) | Principal → performer | Rate | Expected |
|---|---|---|---|---|
| JD-N | dyeing navy (mass_losing · per_input_mass) | F → D | ₹80/kg | 10 Sep |
| JD-B | dyeing black (same) | F → D | ₹90/kg | 10 Sep |
| JC | cutting (unit_changing) | FA → self | — | 15 Sep |
| JS1 | stitching (assembling · per_good_output_piece) | FA → S1 | ₹16/pc | 23 Sep |
| JS2 | stitching (same) | FA → S2 | ₹16/pc | 23 Sep |
| JCHK | checking (count_preserving) | FA → self | — | — |
| JS1-RW / JS2-RW | alteration (count_preserving), `rework_of` JS1 / JS2 [G5] | FA → S1 / S2 | ₹0 | 29 Sep / 1 Oct |
| JP | packing (assembling) | FA → self | — | — |

### A.2 Event table (Sep–Oct 2026)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Wed 2 Sep | Movement · purchase K→F | F recv `self` 600.0; K sent `on_behalf` (K's bill) 602.4 | GRY·G-1·A 602.4 sent / 600.0 recv (25 rolls) | EXT(K) −602.4 [G1]; F@K→F tr(#1) +602.4; tr −602.4; F@F av +600.0; LOSS(weighing_difference) +2.4 (0.40 % ≤ 1.5 %) |
| 2 | Thu 3 Sep | Movement · job_work_out F→D | F sent `account`; D recv `account` | GRY·G-1·A 300.0 → JD-N; GRY·G-1·A 300.0 → JD-B (same spec·lot·grade twice [G13]) | F@F av −600.0; F@D alloc(JD-N) +300.0; F@D alloc(JD-B) +300.0 |
| 3 | Wed 9 Sep | Job output JD-N + job_work_return D→F | D `account`; F recv `account` | NVY·DN-1·A 140.0 (6 rolls) | F@D av +140.0 → −140.0; F@F av +140.0 (alloc(JD-N) stays 300.0 [G2]) |
| 4 | Thu 10 Sep | Job output JD-B + job_work_return | D / F `account` | BLK·DB-1·A 150.0 | F@F av +150.0 |
| 5 | Fri 11 Sep | Job output JD-N (last) + return | D / F `account` | NVY·DN-1·A 137.0 | F@F av +137.0 (JD-N 1 day late) |
| 6 | Fri 11 Sep | Job closure JD-N | F | GRY 300.0 | F@D alloc(JD-N) −300.0; CONSUMED(JD-N) +300.0; loss 23.0 (7.67 %) stored |
| 7 | Sat 12 Sep | Job output JD-B, declared at D | D `account` | BLK·DB-1·A 128.0 | F@D av +128.0 |
| 8 | Sat 12 Sep | Movement · sale F→FA (FA collects at F's shop) | F sent `account`; FA recv `account` | NVY·DN-1·A 100.0 | F@F av −100.0; FA@FA av +100.0 (title at_dispatch) |
| 9 | Sat 12 Sep | Movement · sale **from D** → FA; seller F, buyer FA | D sent `account`; FA recv `account` | BLK·DB-1·A 100.0 | F@D av −100.0; FA@FA av +100.0 |
| 10 | Sat 12 Sep | Movement · job_work_return D→F | D / F `account` | BLK·DB-1·A 28.0 | F@D av −28.0; F@F av +28.0 |
| 11 | Sat 12 Sep | Job closure JD-B | F | GRY 300.0 | alloc(JD-B) −300.0; CONSUMED(JD-B) +300.0; loss 22.0 (7.33 %); 2 days late |
| 12 | Mon 14 Sep | Movement · purchase T1→FA | FA recv `self` (`rcv-only`) | BTN 1,872 (13 gross); ZIP4 340; ZIP5 560 | EXT(T1) −; FA@FA av +1,872 / +340 / +560 [G1] |
| 13 | Mon 14 Sep | Movement · purchase T2→FA | T2 sent `account`; FA recv `account` | THN 72,000 m (24 cones); THB 72,000 m (24 cones) | T2@T2 av −72,000 each (negative unless T2 has counted stock [G1]); FA@FA av +72,000 each |
| 14 | Mon 14 Sep | Adjustment · count (opening) | FA `self` | PBG 1,000 | FA@FA av +1,000; ADJUSTMENT(opening) −1,000 |
| 15 | Mon 14 Sep | Job issue (in-house) JC | FA `self` | NVY·DN-1 100.0; BLK·DB-1 100.0 | FA@FA av −100.0 → alloc(JC) +100.0 (each) |
| 16 | Tue 15 Sep | Job output JC + by-product + leftover kept | FA `self` | KIT navy (CN-1) S56 M112 L112 XL111 XXL56 = 447; KIT black (CB-1) S55 M111 L110 XL110 XXL55 = 441; CWS 9.20 + 10.40 kg; leftover NVY 0.80, BLK 0.90 | FA@FA av +447 / +441 kits; FA@FA av CWS +19.60; alloc(JC) → av: NVY 0.80, BLK 0.90 |
| 17 | Tue 15 Sep | Job closure JC | FA | NVY 100.0; BLK 100.0 | alloc(JC) −99.20 / −99.10 → CONSUMED(JC); est-in-panels 89.39 / 88.19; residual 0.61 / 0.51 kg |
| 18 | Wed 16 Sep | Movement · job_work_out FA→S1 | FA sent `account`; S1 recv `account` | KIT·S·nvy 56, KIT·M·nvy 112, KIT·S·blk 55, KIT·M·blk 111 (= 334); ZIP4 340; BTN 680; THN 27,000 (9 cones); THB 27,000 (9 cones) | FA@FA av − each; FA@S1 alloc(JS1) + each |
| 19 | Wed 16 Sep | Movement · job_work_out FA→S2 | FA sent `self` | KIT·L·nvy 112, XL·nvy 111, XXL·nvy 56, L·blk 110, XL·blk 110, XXL·blk 55 (= 554); ZIP5 560; BTN 1,128; THN 45,000 (15); THB 45,000 (15) | FA@FA av − each; FA tr(#19) + each ("at S2, unconfirmed") |
| 20 | Thu 17 Sep | S2 receiver assertion (statement link) | S2 `link` | all = sent **except** KIT·XL·blk recv 108 | tr(#19) → FA@S2 alloc(JS2); KIT·XL·blk: +108 alloc, +2 FA@? disp(DA-1) (custodian of disputed qty undefined [G11]); discrepancy DA-1 qty_mismatch (counted, tol 0) opens |
| 21 | Fri 18 Sep | DA-1 proposed `short_shipped` (FA found 2 kits on cutting table); S2's OK taken by phone | FA `self`; S2 `on_behalf` [G11] | KIT·XL·blk 2 | disp(DA-1) −2; FA@FA av +2; DA-1 resolved |
| 22 | Sat 19 Sep | Movement · job_work_out FA→S2 | FA `self`; S2 `link` | KIT·XL·blk 2 | FA@FA av −2; FA@S2 alloc(JS2) +2 |
| 23 | Mon 21 Sep | JS1 output + job_work_return (1) | S1 `account`; FA `account` | TEE·S·nvy A 55, reject 1; TEE·M·nvy A 60 (= 116) | FA@S1 av +116 → FA@FA av +116 (A 115, reject 1) |
| 24 | Mon 21 Sep | JCHK issue + output (in-house grading — the only way to regrade [G3]) | FA `self` | in TEE·S·nvy A 55, TEE·M·nvy A 60; out S·nvy A 55, M·nvy A 57 + **rework 3** | FA@FA av −115 → alloc(JCHK) +115; FA@FA av +112 A, +3 rework (same spec now counted twice until closure [G2]) |
| 25 | Tue 22 Sep | JS2 output + return (1) | FA recv `self`; S2 sent `on_behalf`, `link` 23 Sep | TEE·L·nvy A 111, reject 1 (= 112) | FA@FA av +111 A, +1 reject |
| 26 | Tue 22 Sep | JCHK | FA `self` | L·nvy A 111 → A 111 | alloc(JCHK) +111; av +111 A |
| 27 | Wed 23 Sep | JS1 return (2) | S1 / FA `account` | TEE·M·nvy A 52; TEE·S·blk A 55 (= 107) | FA@FA av +107 |
| 28 | Wed 23 Sep | JCHK | FA `self` | M·nvy 52 → A 52; S·blk 55 → A 55 | alloc(JCHK) +107; av +107 A |
| 29 | Thu 24 Sep | JS1 return (3, last) | S1 / FA `account` | TEE·M·blk A 110, reject 1 (= 111) | FA@FA av +111 (JS1 1 day late) |
| 30 | Thu 24 Sep | JS2 return (2) | FA `self`; S2 `link` | TEE·XL·nvy A 111; TEE·XXL·nvy A 56 (= 167) | FA@FA av +167 |
| 31 | Thu 24 Sep | JCHK | FA `self` | M·blk 110 → A 108 + rework 2; XL·nvy 111 → A 107 + rework 4; XXL·nvy 56 → A 56 | alloc +277; av +271 A, +6 rework |
| 32 | Fri 25 Sep | JS2 return (3) | FA `self`; S2 `link` | TEE·L·blk A 110; TEE·XL·blk A 60 (= 170) | FA@FA av +170 |
| 33 | Fri 25 Sep | JCHK | FA `self` | L·blk 110 → A 107 + rework 3; XL·blk 60 → A 60 | alloc +170; av +167 A, +3 rework |
| 34 | Fri 25 Sep | Movement · return (rework) FA→S1 → new job JS1-RW | FA `self`; S1 `account` | TEE·M·nvy rework 3; TEE·M·blk rework 2 | FA@FA av −5 → FA@S1 alloc(JS1-RW) +5 (purpose `return` [G17]) |
| 35 | Sat 26 Sep | JS2 return (4, last) | FA `self`; S2 `link` | TEE·XL·blk A 50; TEE·XXL·blk A 55 (= 105) | FA@FA av +105 (JS2 3 days late) |
| 36 | Sat 26 Sep | JCHK | FA `self` | XL·blk 50 → A 50; XXL·blk 55 → A 55 | alloc +105; av +105 A |
| 37 | Mon 28 Sep | JS1-RW output + return | S1 / FA `account` | TEE·M·nvy A 3; TEE·M·blk A 1, reject 1 | FA@FA av +4 A, +1 reject |
| 38 | Mon 28 Sep | Movement · job_work_return S1→FA, line_kind leftover | S1 / FA `account` | THN 1,500 m **est** (1 partial cone); THB 1,800 m **est**; BTN 10; ZIP4 6 (no estimate flag on a line [G10]) | FA@S1 alloc(JS1) − each; FA@FA av + each |
| 39 | Mon 28 Sep | Movement · return (rework) FA→S2 → JS2-RW | FA `self`; S2 `link` | TEE·XL·nvy rework 4; TEE·L·blk rework 3 | FA@FA av −7 → FA@S2 alloc(JS2-RW) +7 |
| 40 | Tue 29 Sep | Closure JS1, JS1-RW | FA | kits 334; ZIP4; BTN; THN; THB; JS1-RW 5 | alloc(JS1) → CONSUMED(JS1): kits −334, ZIP4 −334, BTN −670, THN −25,500, THB −25,200; alloc(JS1-RW) −5 → CONSUMED +5 |
| 41 | Wed 30 Sep | JS2-RW output + return | FA `self`; S2 `link` | TEE·XL·nvy A 4; TEE·L·blk A 2, reject 1 | FA@FA av +6 A, +1 reject |
| 42 | Wed 30 Sep | JS2 leftovers: ZIP5 returned; BTN **kept-and-adjusted** (sale_in_place FA→S2 @ ₹1, taxable flag); thread **kept_for_next** | FA `self`; S2 `link` | ZIP5 6; BTN 18; THN 3,000 m est; THB 3,600 m est | ZIP5: alloc(JS2) −6 → FA@FA av +6; BTN: FA@S2 alloc −18 → EXT(S2) +18 [G1]; THN/THB: FA@S2 alloc(JS2) → FA@S2 av +3,000 / +3,600 |
| 43 | Thu 1 Oct | Closure JS2, JS2-RW, JCHK | FA | | alloc(JS2) → CONSUMED: kits −554, ZIP5 −554, BTN −1,110, THN −42,000, THB −41,400; alloc(JS2-RW) −7; alloc(JCHK) −885 → CONSUMED(JCHK) |
| 44 | Thu 1 Oct | JP issue + output + closure (in-house) | FA `self` | in TEE A navy S55 M112 L111 XL111 XXL56 (445), black S55 M109 L109 XL110 XXL55 (438); PBG 883 · out PKD same matrix (883) | av −883 TEE, −883 PBG → alloc(JP) → CONSUMED(JP); FA@FA av PKD +883 |
| 45 | Fri 2 Oct | Movement · sale FA→R1 via TR (LR 5521, 8 cartons) | FA sent `account`; TR none; R1 recv `account` 5 Oct | PKD navy S25 M50 L50 XL50 XXL25 (200); black same (200) = 400 | FA@FA av −400; R1@TR tr(#45) +400 |
| 46 | Sat 3 Oct | Movement · sale FA→R2 | FA / R2 `account` | PKD navy S20 M40 L40 XL40 XXL20 (160); black S15 M35 L40 XL40 XXL10 (140) = 300 | FA@FA av −300; R2@R2 av +300 |
| 47 | Sat 3 Oct | Movement · sale FA→R3 | FA `self`; R3 none | PKD navy S10 M22 L21 XL21 XXL11 (85); black S15 M24 L19 XL20 XXL20 (98) = 183 | FA@FA av −183; R3 tr(#47) +183 ("at R3, unconfirmed"; sink is EXT(R3) [G1]) |
| 48 | Mon 5 Oct | R1 receiver assertion | R1 `account` | PKD 400 | tr(#45) −400; R1@R1 av +400 |

### A.3 Participant views

**F**

| Moment | Owned · own premises | Owned · at others | Held for others | Open jobs (pending) | Flags | Must NOT see |
|---|---|---|---|---|---|---|
| Fri 11 Sep 09:00 (before #5) | NVY·DN-1 140.0; BLK·DB-1 150.0 | at D: GRY 600.0 (book) | — | JD-N pending ≈147.8 kg grey (est, 92 %) → ≈136.0 navy; JD-B ≈137.0 grey → ≈126.0 black | JD-N, JD-B `late` (exp 10 Sep); K purchase weighing diff 2.4 kg (no discrepancy) | FA's cutting/stitching; D's other principals |
| Sat 12 Sep EOD | NVY 177.0; BLK 178.0 | — | — | closed: JD-N loss 23.0 (7.67 %), JD-B 22.0 (7.33 %) | none (template 8 %; PC norm 4–7 % not applied [G12]) | same; T1/T2/S1/S2 entirely |

**D**

| Moment | Owned | Held for others | Open jobs | Flags | Must NOT see |
|---|---|---|---|---|---|
| Fri 11 Sep 09:00 | (chemicals not tracked) | F: GRY 600.0 alloc (JD-N 300.0, JD-B 300.0); outputs held 0 | as F's row (same estimates) | `late` ×2 | F's price/qty from K; F's customers |
| Sat 12 Sep EOD | — | F: 0 | closed; bill to F ₹24,000 + ₹27,000 = ₹51,000 | — | #9 is visible ("100.0 kg black from your premises → FA, for F") **without** the F→FA rate (§7 rates row) |

**FA (father)**

| Moment | Owned · own premises | Owned · at others | Held for others | Open jobs (pending) | Flags | Must NOT see |
|---|---|---|---|---|---|---|
| Sat 12 Sep EOD | NVY·DN-1 100.0; BLK·DB-1 100.0 | — | — | — | — | F's JD-N/JD-B, loss, K, F's rates with D (FA sees D only as physical sender of #9) |
| Wed 23 Sep EOD | TEE A: S·nvy 55, M·nvy 109, L·nvy 111, S·blk 55 (330); rework M·nvy 3; reject S·nvy 1, L·nvy 1; NVY 0.80, BLK 0.90; CWS 19.60; BTN 64; PBG 1,000 (book also shows alloc(JCHK) 333 [G2]) | S1: kits 334 issued, 223 back as garments, **pending 111** (exact: KIT·M·blk); ZIP4 340, BTN 680, THN 27,000, THB 27,000 (book; est used ZIP 223, BTN 446, THN 25,200, THB 8,250). S2: kits 554, back 112, **pending 442**; ZIP5 560, BTN 1,128, THN/THB 45,000 each (book) | — | JS1, JS2 due today; JCHK open | DA-1 resolved 18 Sep (history) | S1/S2 other principals; F's dyeing |
| Mon 5 Oct | rejects 5 (S·nvy 1, M·blk 2, L·nvy 1, L·blk 1); PBG 117; BTN 74; ZIP4 6; ZIP5 6; THN 1,500 est; THB 1,800 est; NVY 0.80; BLK 0.90; CWS 19.60 | S2: THN 3,000 est, THB 3,600 est (kept for next job; 1-year GST clock from 16 Sep 2026) | — | all closed. Bills: S1 ₹5,296; S2 ₹8,814 | R3 unconfirmed (183) | — |

**S1**

| Moment | Owned | Held for FA | Open jobs | Flags | Must NOT see |
|---|---|---|---|---|---|
| Wed 23 Sep EOD | — | KIT·M·blk 111 (pending); ZIP4/BTN/THN/THB (book) | JS1: 223 returned of 334 | due today | JS2, S2, sizes L–XXL, FA's sales, F/D, FA's S2 rate |
| Tue 29 Sep | — | 0 | closed; residual BTN 2, THN 300 m, THB 300 m; bill 331 good × ₹16 = ₹5,296 [G4] | — | same |

**S2 (contact — statement link page)**

| Moment | What the link shows | Must NOT see |
|---|---|---|
| Thu 17 Sep | FA's DC for 10 lines; S2 tapped **Differs** on KIT·XL·blk = 108 | S1, S/M sizes, F/D |
| Wed 23 Sep | kits 554 (incl. 2 re-sent), returned 112, pending 442; trims issued | FA's sales, FA's notes on S2 |
| Thu 1 Oct | FA's thread at S2: THN 3,000, THB 3,600 (est); BTN 18 kept @ ₹1; bill ₹8,814 (if FA shares rates) | same |

**Others**

| Party | Moment | View | Must NOT see |
|---|---|---|---|
| T1 (contact) | 14 Sep (link if sent) | FA's purchase: BTN 1,872, ZIP4 340, ZIP5 560 — "Your record" side only; can confirm | where trims went; T2 |
| T2 | 14 Sep | sale to FA: THN 72,000, THB 72,000 (both sides `account`) | S1/S2, T1 |
| R1 | 3 Oct / 5 Oct | 3 Oct: 400 PKD "in transit with TR (LR 5521)"; 5 Oct: own premises PKD 400 (matrix) | R2/R3 qty, FA's costs, S1/S2, F |
| R2 | 3 Oct | own premises PKD 300 | same |
| R3 (contact) | 3 Oct (link) | "FA sent 183 pcs" — awaiting confirm | same |
| K (contact of F) | 2 Sep (F's link) | purchase 602.4 sent / 600.0 received, weighing difference 2.4 | D, FA |
| TR (contact) | — | named on #45 only | — |

### A.4 Balance check

**Movement lines** (`sent = received + weighing_difference + disputed + still_in_transit`)

| # | Line | Equation |
|---|---|---|
| 1 | GRY | 602.4 = 600.0 + 2.4 + 0 + 0 ✓ |
| 2 | GRY ×2 | 300.0 = 300.0 ✓ (each) |
| 3,4,5,8,9,10 | NVY/BLK | 140.0, 150.0, 137.0, 100.0, 100.0, 28.0 — s = r ✓ |
| 12 | trims | rcv-only: s := r (1,872 / 340 / 560) |
| 13 | THN, THB | 72,000 = 72,000 ✓ |
| 18 | 8 lines | s = r ✓ |
| 19 | KIT·XL·blk | 110 = 108 + 0 + 2 + 0 → after DA-1: 110 = 108 + 2 (short_shipped back to FA) ✓; other 9 lines s = r ✓ |
| 22 | KIT·XL·blk | 2 = 2 ✓ |
| 45 / 46 / 47 | PKD | 400 = 400 ✓; 300 = 300 ✓; 183 = 0 + 183 in transit (open) |

**Job input lines** (§5.2)

| Job · line | Equation | Output vs plan |
|---|---|---|
| JD-N · GRY | 300.0 = 277.0 out + 23.0 loss ✓ | plan 276.0 → +1.0 |
| JD-B · GRY | 300.0 = 278.0 + 22.0 ✓ | plan 276.0 → +2.0 |
| JC · NVY | 100.00 = 89.39 est + 9.20 by-product + 0.80 leftover + 0.61 residual ✓ (est = 56·180 + 112·190 + 112·200 + 111·210 + 56·220 = 89,390 g) | 447 vs 440 (+7, +1.6 %); 4.47 pcs/kg |
| JC · BLK | 100.00 = 88.19 + 10.40 + 0.90 + 0.51 ✓ (55·180 + 111·190 + 110·200 + 110·210 + 55·220 = 88,190 g) | 441 vs 440 (+1); 4.41 pcs/kg |
| JS1 · kits | S·nvy 56 = 55 A + 1 rej; M·nvy 112 = 112 A; S·blk 55 = 55 A; M·blk 111 = 110 A + 1 rej ✓ | 332 A declared |
| JS1 · trims | ZIP4 340 = 334 + 6 ret + 0; BTN 680 = 668 + 10 + 2 res; THN 27,000 = 25,200 (168 × 150) + 1,500 + 300 res; THB 27,000 = 24,900 (166 × 150) + 1,800 + 300 res ✓ | |
| JS2 · kits | L·nvy 112 = 111 + 1; XL·nvy 111; XXL·nvy 56; L·blk 110; XL·blk 110 (108 + 2); XXL·blk 55 ✓ | 553 A declared |
| JS2 · trims | ZIP5 560 = 554 + 6; BTN 1,128 = 1,108 + 18 kept_adjusted + 2 res; THN 45,000 = 41,850 (279 × 150) + 3,000 kept_for_next + 150 res; THB 45,000 = 41,250 (275 × 150) + 3,600 + 150 res ✓ | |
| JCHK | 885 in = 873 A + 12 rework ✓ (per line: M·nvy 112 = 109 + 3; M·blk 110 = 108 + 2; XL·nvy 111 = 107 + 4; L·blk 110 = 107 + 3; others in = out) | |
| JS1-RW | M·nvy 3 = 3 A; M·blk 2 = 1 A + 1 rej ✓ | |
| JS2-RW | XL·nvy 4 = 4 A; L·blk 3 = 2 A + 1 rej ✓ | |
| JP | TEE 883 = PKD 883; PBG 883 = 883 ✓ | |

**Global (§5.5)**: kits 888 = 883 A packed + 5 rejects ✓. PKD 883 = 400 + 300 + 183 ✓. BTN 1,872 = 74 at FA + 1,776 consumed + 4 residual + 18 sold-in-place ✓. THN 72,000 = 67,050 + 450 + 1,500 + 3,000 ✓. THB 72,000 = 66,150 + 450 + 1,800 + 3,600 ✓. PBG 1,000 = 883 + 117 ✓. F: GRY 602.4 = 600.0 + 2.4; NVY 277.0 = 100.0 + 177.0; BLK 278.0 = 100.0 + 28.0 + 150.0 ✓.

**Bills**: JD-N 300 × 80 = ₹24,000; JD-B 300 × 90 = ₹27,000. JS1 good = 332 declared − 5 downgraded + 4 rework A = 331 × 16 = ₹5,296 (a naive `per_good_output_piece` sum of JS1 + JS1-RW A gives 336 [G4]). JS2 good = 553 − 7 + 6 = 552 × 16 = ₹8,832 − 18 × ₹1 = ₹8,814.

### A.5 Model gaps hit

| Gap | What broke here |
|---|---|
| G1 | #1, #12: −602.4 from K's holding / T1's — no such holdings, §5.4 would reject; #13 T2 has no counted stock; #42/#47 sinks for contacts S2, R3 |
| G2 | #3–#5: F's book shows 600 kg grey at D after 427 kg navy returned; #24: JCHK leaves TEE·M·nvy in alloc **and** av |
| G3 | #24: no way to say "received 60 A, found 3 rework" except an in-house checking job |
| G4 | JS1 bill: 332 + 4 = 336 ≠ 331 good |
| G5 | JS1-RW input is garments, not kits — stitching ProcessType inputs don't fit; needs an alteration type |
| G10 | #38, #42: thread "1,500 m est" stored as exact |
| G11 | #20: custodian of 2 disputed kits undefined; #21: S2 (contact) can't accept a proposal via link |
| G12 | JD-N 7.67 % on PC (norm 4–7 %) not flagged |
| G13 | #2: two lines with the same spec·lot·grade |
| G17 | #34, #39: rework re-issue uses `return` |

---

## Scenario B — split cutting and colour/size-wise stitching (BRIEF §3 B)

### B.1 Setup

| Party | Kind | On platform | Role(s) |
|---|---|---|---|
| M | Business (manufacturer) | yes | buyer; principal everywhere; in-house packing |
| FT | Contact of M (fabric trader) | **no** | seller of fabric |
| C | Business (cutting-only unit) | yes | performer JC-B; buyer of its red cut waste |
| ST1 | Contact of M (stitching, phone) | **no** | performer JST1 (white S+M) |
| ST2 | Business (stitching) | yes | performer JST2 (white L+XL), JST2-RW |
| ST3 | Business (stitching) | yes | performer JST3 (red, all sizes); supplies own labels |

| Spec code | Spec |
|---|---|
| WHT / RED | Knitted fabric · SJ · finished · 100 % cotton · 180 GSM · 36" open · white / red |
| KIT·sz·col, TEE·sz·col, PKD·sz·col | Cut kit / garment / packed garment · style M-RN (round-neck tee) |
| THW / THR | Thread · spun poly · Tex 27 · white / red (m) |
| LBL | Size label · printed (ST3's own) |
| CWS / PBG | Cut waste · cotton / Polybag |

BOM M-RN: S 190 · M 200 · L 210 · XL 220 g/pc; ratio 1:2:2:1; 120 m thread/pc; cut loss 12 % → plan per colour: 150 kg × 0.88 = 132.0 kg ÷ 205 g ≈ 643 → **642** (S107 M214 L214 XL107; 131.61 kg).
Lots: DW-7, DR-3 (purchase) → CW-1, CR-1 (cut lots). Opening (prior counts): THW 90,000 m, THR 90,000 m, PBG 2,000 at M.

| Job | ProcessType | Principal → performer | Rate | Expected |
|---|---|---|---|---|
| JC-B | cutting (unit_changing · per_output_piece) | M → C | ₹2/pc | Thu 8 Oct |
| JST1 / JST2 / JST3 | stitching (assembling · per_good_output_piece) | M → ST1 / ST2 / ST3 | ₹13/pc | Sat 17 Oct |
| JST2-RW | alteration (count_preserving), rework_of JST2 | M → ST2 | ₹0 | Tue 20 Oct |
| JPK | packing (assembling) | M → self | — | — |

### B.2 Event table (Oct 2026)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Mon 5 Oct | Movement · purchase FT→M | M recv `self`; FT sent `on_behalf` (invoice) | WHT·DW-7·A 150.0; RED·DR-3·A 150.0 | EXT(FT) −300.0 [G1]; M@M av +150.0 each |
| 2 | Tue 6 Oct | Movement · job_work_out M→C | M sent `account`; C recv `account` | WHT 150.0 sent / **149.2** recv; RED 150.0 / 150.0 | M@M av −150.0 ×2; M@C alloc(JC-B) +149.2 / +150.0; LOSS(weighing_difference) +0.8 (0.53 %) — job issued = 149.2 or 150.0? [G8] |
| 3 | Thu 8 Oct | JC-B output + job_work_return (white) | C / M `account` | KIT·white (CW-1) S108 M216 L215 XL107 = 646; CWS·white 14.30 kg (by_product, returned); WHT leftover 1.60 kg | M@M av +646 kits, +14.30 CWS; M@C alloc(JC-B) −1.60 → M@M av +1.60 |
| 4 | Fri 9 Oct | JC-B output + return (red) | C / M `account` | KIT·red (CR-1) S107 M213 L214 XL106 = 640; RED leftover 2.20 kg | M@M av +640; alloc −2.20 → M@M av +2.20 |
| 5 | Fri 9 Oct | By-product declared at C + kept-and-adjusted (sale_in_place M→C @ ₹30/kg; taxable flag) | C / M `account` | CWS·red 15.10 kg | M@C av +15.10 → C@C av +15.10; bill credit ₹453 |
| 6 | Fri 9 Oct | Closure JC-B | M | WHT 149.2; RED 150.0 | alloc −147.60 / −147.80 → CONSUMED(JC-B); residual 0.89 / 1.51; 1 day late |
| 7 | Sat 10 Oct | job_work_out M→ST1 | M `self` | KIT·white S108 M216 (324); THW 42,000 (14 cones) | M@M av −; tr(#7) + ("at ST1, unconfirmed") |
| 8 | Sat 10 Oct | job_work_out M→ST2 | M / ST2 `account` | KIT·white L215 XL107 (322); THW 42,000 | M@M av −; M@ST2 alloc(JST2) + |
| 9 | Sat 10 Oct | job_work_out M→ST3 | M / ST3 `account` | KIT·red S107 M213 L214 XL106 (640); THR 81,000 (27 cones) | M@M av −; M@ST3 alloc(JST3) + |
| 10 | Mon 12 Oct | ST1 receiver assertion | ST1 `link` | all = sent | tr(#7) → M@ST1 alloc(JST1) |
| 11 | Wed 14 Oct | JST1 output + return (1) | M recv `self`; ST1 sent `on_behalf`, `link` 15 Oct | TEE·white S 107 A, M 93 A (200) | M@M av +200 |
| 12 | Thu 15 Oct | JST3 output + return (1) | ST3 / M `account` | TEE·red S 107 A, M 210 A, M reject 3 (320) | M@M av +317 A, +3 rej |
| 13 | Fri 16 Oct | JST2 output (L 213 A + **2 rework kept at ST2**); return 213 A | ST2 / M `account` | TEE·white·L A 213; TEE·white·L rework 2 | M@M av +213; M@ST2 av +2 rework |
| 14 | Fri 16 Oct | JST2-RW opened; **issue in place** at ST2 [G6] | ST2 `account` | TEE·white·L rework 2 | M@ST2 av −2 → alloc(JST2-RW) +2 |
| 15 | Sat 17 Oct | JST1 return (2, last) | M `self`; ST1 `link` | TEE·white M 121 A; S rej 1; M rej 2 (124) | M@M av +121 A, +3 rej |
| 16 | Sat 17 Oct | JST3 return (2) + pause `waiting_input` (2 XL kits missing sleeves) | ST3 / M `account` | TEE·red L 213 A + 1 rej; XL 104 A (318) | M@M av +317 A, +1 rej |
| 17 | Sat 17 Oct | JST2 return (2) | ST2 / M `account` | TEE·white XL 106 A + 1 rej (107) | M@M av +106 A, +1 rej |
| 18 | Mon 19 Oct | JST2-RW output + return | ST2 / M `account` | TEE·white·L A 2 | M@M av +2 |
| 19 | Tue 20 Oct | JST3 return (3, last); pause ends | ST3 / M `account` | TEE·red XL 2 A | M@M av +2 (not late: 17–20 Oct paused) |
| 20 | Tue 20 Oct | jw_own_material at JST3 | ST3 `account` | LBL (ST3-owned) 640 | ST3@ST3 av −640 (needs ST3 label stock on ledger [G1]); CONSUMED(JST3) +640; bill +₹256 |
| 21 | Tue 20 Oct | Leftovers: ST1, ST2 return; ST3 kept-and-adjusted (sale_in_place @ ₹0.05/m) | M `self` + ST1 `link`; ST2 / ST3 `account` | THW 3,000 est (ST1); THW 3,200 est (ST2); THR 4,000 est (ST3) [G10] | alloc(JST1/JST2) − → M@M av +3,000 / +3,200; M@ST3 alloc −4,000 → ST3@ST3 av +4,000 (deduct ₹200) |
| 22 | Tue 20 Oct | Closures JST1, JST2, JST2-RW, JST3 | M | | CONSUMED: JST1 kits 324, THW 39,000; JST2 kits 322, THW 38,800; JST2-RW 2; JST3 kits 640, THR 77,000 |
| 23 | Wed 21 Oct | JPK issue + output + closure | M `self` | TEE A white S107 M214 L215 XL106 (642), red S107 M210 L213 XL106 (636); PBG 1,278 | → PKD same matrix 1,278; CONSUMED(JPK) |

### B.3 Participant views

| Party | Moment | Owned · own premises | Owned · at others | Held for others | Open jobs (pending) / flags | Must NOT see |
|---|---|---|---|---|---|---|
| M | Thu 8 Oct EOD | KIT·white 646; CWS 14.30; WHT 1.60; THW 90,000; THR 90,000; PBG 2,000 | C: WHT 149.2 (book; pending ≈0, formula gives −1.27 [G9]); RED 150.0 (pending 150.0) | — | JC-B due today; weighing diff 0.8 kg recorded | — |
| M | Sat 17 Oct EOD | TEE·white A S107 M214 L213 XL106 (640), rej 4; TEE·red A S107 M210 L213 XL104 (634), rej 4; THW 6,000; THR 9,000; PBG 2,000; WHT 1.60; RED 2.20; CWS 14.30 | ST1: kits 324 → all back (pending 0); ST2: 320 back, 2 in rework at ST2; ST3: 638 back, **2 XL pending** | — | JST3 `paused waiting_input` (not late); JST2-RW due 20 Oct | — |
| M | Wed 21 Oct | PKD white 642, red 636 (1,278); rej 8; THW 12,200; THR 9,000; PBG 722; WHT 1.60; RED 2.20; CWS 14.30 | — | — | all closed; bills C ₹2,119, ST1 ₹4,173, ST2 ₹4,173, ST3 ₹8,324 | — |
| C | Thu 8 Oct EOD | — | — | M: RED 150.0 alloc; WHT 149.2 alloc (outputs all returned) | JC-B due today | stitchers, FT, M's other stock |
| C | Fri 9 Oct EOD | CWS·red 15.10 (bought in place @ ₹30) | — | M: 0 | closed; bill ₹2,572 − ₹453 = ₹2,119 | same |
| ST1 (link) | Sat 17 Oct | — | — | link: kits 324 (confirmed 12 Oct); returned 200 (confirmed) + 124 (awaiting); THW 42,000 issued | — | ST2, ST3, red, C |
| ST2 | Sat 17 Oct | — | — | M: TEE·white·L rework 2 (alloc JST2-RW); THW 42,000 (book) | JST2-RW due 20 Oct | ST1, ST3, S/M, red, others' rates |
| ST2 | Tue 20 Oct | — | — | 0 | closed; bill 321 × ₹13 = ₹4,173 | same |
| ST3 | Sat 17 Oct | LBL (own stock) | — | M: KIT·red·XL 2 (paused); THR 81,000 (book) | waiting_input | white, ST1/ST2, C |
| ST3 | Tue 20 Oct | THR 4,000 (now owned, kept-and-adjusted) | — | 0 | bill 636 × 13 + 256 − 200 = ₹8,324 | same |
| FT (link) | Mon 5 Oct | M's purchase: WHT 150.0, RED 150.0 | — | — | — | where fabric went |

### B.4 Balance check

| Line | Equation | Output vs plan |
|---|---|---|
| #2 WHT | 150.0 = 149.2 + 0.8 weighing ✓ | |
| #2 RED; #7–#9 all lines | s = r ✓ | |
| JC-B · WHT | 149.20 = 132.41 est (108·190 + 216·200 + 215·210 + 107·220 = 132,410 g) + 14.30 by-product + 1.60 leftover + 0.89 residual ✓ | 646 vs 642 (+4, +0.6 %) |
| JC-B · RED | 150.00 = 131.19 (107·190 + 213·200 + 214·210 + 106·220 = 131,190 g) + 15.10 (kept_adjusted) + 2.20 + 1.51 residual ✓ | 640 vs 642 (−2, −0.3 %) |
| JST1 kits | S 108 = 107 A + 1 rej; M 216 = 214 A + 2 rej ✓ | 321 A |
| JST1 THW | 42,000 = 38,880 (324 × 120) + 3,000 + 120 res ✓ | |
| JST2 kits | L 215 = 213 A + 2 rework (forwarded in place to JST2-RW); XL 107 = 106 A + 1 rej ✓ | |
| JST2 THW | 42,000 = 38,640 (322 × 120) + 3,200 + 160 res ✓ | |
| JST2-RW | 2 = 2 A ✓ | white A 107+214+215+106 = 642 vs plan 642 (0) |
| JST3 kits | S 107 = 107; M 213 = 210 + 3 rej; L 214 = 213 + 1 rej; XL 106 = 104 + 2 (pending → 0 on 20 Oct) ✓ | red A 636 vs 642 (−6, −0.9 %) |
| JST3 THR / LBL | 81,000 = 76,800 (640 × 120) + 4,000 kept_adjusted + 200 res ✓; LBL 640 = 640 consumed (jw_own) | |
| JPK | TEE 1,278 = PKD 1,278; PBG 1,278 ✓ | |
| Global M | WHT 150.0 = 0.8 + 147.60 + 1.60 ✓; RED 150.0 = 147.80 + 2.20 ✓; kits 646 = 324 + 322, 640 = 640 ✓; garments 642 + 4 = 646, 636 + 4 = 640 ✓; THW 90,000 = 12,200 + 77,520 + 280 ✓; THR 90,000 = 9,000 + 76,800 + 4,000 + 200 ✓; PBG 2,000 = 1,278 + 722 ✓ | |

Bills: C (646 + 640) × 2 = ₹2,572 − ₹453 = ₹2,119. ST1 321 × 13 = ₹4,173. ST2 (213 + 106 + 2) × 13 = ₹4,173. ST3 ₹8,268 + ₹256 − ₹200 = ₹8,324.

### B.5 Model gaps hit

| Gap | What broke here |
|---|---|
| G1 | #1 FT stock not on ledger; #20 ST3's own labels |
| G6 | #14: rework done at ST2 without a return — no issue-in-place event |
| G8 | #2: JC-B "issued" 150.0 or 149.2? (matters for per_input_mass jobs and for residual) |
| G9 | M at 8 Oct: unit_changing pending estimate undefined; naive formula −1.27 kg |
| G10 | #21: thread leftovers are estimates |

---

## Scenario C — yarn trader's chain with direct hops (01 §7 C)

### C.1 Setup

| Party | Kind | On platform | Role(s) |
|---|---|---|---|
| Y | Business (yarn trader) | yes | buyer; principal JK, JD-C; seller to F and M (never touches fabric) |
| MS | Contact of Y (spinning mill) | **no** | seller of yarn |
| K | Contact of Y (knitter) | **no** (statement link) | performer JK; sends grey straight to D |
| D | Business (dyer) | yes | performer JD-C; custodian for F after sale-in-place |
| F | Business (fabric shop) | yes | buyer 300 kg |
| M | Business (manufacturer) | yes | buyer 240 kg |

| Spec | Lots |
|---|---|
| YRN = Yarn · cotton · 30s Ne · combed · raw white | L1 560.0, L2 440.0 (purchase; 40 kg bags) |
| GRY = Knitted fabric · SJ · grey · 100 % cotton · 160 GSM · 30" tubular | G-Y1 (job_output, parents L1, L2) |
| NVY = Knitted fabric · SJ · finished · 180 GSM · 36" open · navy | DN-Y1 (job_output, parent G-Y1) |

| Job | ProcessType | Principal → performer | Rate | Expected |
|---|---|---|---|---|
| JK | knitting (mass_losing · per_input_mass) | Y → K | ₹12/kg | Sun 8 Nov (5 d, 7-day) |
| JD-C | dyeing navy (mass_losing · per_input_mass) | Y → D | ₹80/kg | 18 Nov if from last issue (14 Nov if from first) [G15] |

### C.2 Event table (Nov 2026)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Mon 2 Nov | Movement · purchase MS→Y | Y recv `self`; MS sent `on_behalf` (invoice) | YRN·L1·A 560.0 (14 bags); YRN·L2·A 440.0 (11 bags) | EXT(MS) −1,000.0 [G1]; Y@Y av +560.0, +440.0 |
| 2 | Tue 3 Nov | Movement · job_work_out Y→K | Y sent `self`; K `link` 4 Nov | YRN·L1 560.0; YRN·L2 40.0 → JK | Y@Y av −560.0, −40.0; Y@K alloc(JK) +560.0, +40.0; §10.5 lot-mix warning (barré risk) |
| 3 | Sat 7 Nov | JK output (implied by hop [G14]) + Movement · hop K→D, tagged JD-C | Y records K's sent `on_behalf`; D recv `account` | GRY·G-Y1·A 210.0 | Y@K av +210.0 → −210.0; Y@D alloc(JD-C) +210.0 (via empty: Y instructed the hop) |
| 4 | Mon 9 Nov | same | same | GRY·G-Y1 200.0 | Y@D alloc(JD-C) +200.0; JK `late` (exp 8 Nov) |
| 5 | Wed 11 Nov | same (last) | same | GRY·G-Y1 178.0 | Y@D alloc(JD-C) +178.0 |
| 6 | Wed 11 Nov | Closure JK | Y | YRN L1 560.0, L2 40.0 | alloc(JK) −600.0 → CONSUMED(JK); loss 12.0 (2.0 %); per-line split pro-rata [G7]; 3 days late |
| 7 | Tue 17 Nov | JD-C output at D | D `account` | NVY·DN-Y1·A 300.0 | Y@D av +300.0 |
| 8 | Tue 17 Nov | Movement · sale_in_place Y→F (custodian D) | Y seller `account`; F buyer `account` | NVY·DN-Y1 300.0 | Y@D av −300.0; F@D av +300.0 (D now holds for F, no job) |
| 9 | Wed 18 Nov | Movement · pickup D→F | D sent `account`; F recv `account` | NVY·DN-Y1 300.0 | F@D av −300.0; F@F av +300.0 |
| 10 | Thu 19 Nov | JD-C output (last) | D `account` | NVY·DN-Y1 240.0 | Y@D av +240.0 |
| 11 | Thu 19 Nov | Movement · sale from D → M; seller Y, buyer M | D sent `account` 240.0; M recv `account` 239.0 | NVY·DN-Y1 240.0 / 239.0 | Y@D av −240.0; M tr(#11) +240.0 → −240.0; M@M av +239.0; LOSS(weighing_difference, per terms) +1.0 (0.42 %) |
| 12 | Thu 19 Nov | Closure JD-C | Y | GRY 588.0 | alloc(JD-C) −588.0 → CONSUMED(JD-C); loss 48.0 (8.16 %) — no flag (template 8 %) |

### C.3 Participant views

| Party | Moment | Owned · own premises | Owned · at others | Held for others | Open jobs (pending) / flags | Must NOT see |
|---|---|---|---|---|---|---|
| Y | Mon 9 Nov EOD | YRN·L2 400.0 | K: YRN 600.0 (book); D: GRY·G-Y1 410.0 | — | JK pending ≈181.6 kg yarn (est, 98 %) → ≈178.0 kg grey; JD-C 410.0 issued, no output · flags: JK `late`, lot-mix warning | — |
| Y | Thu 19 Nov EOD | YRN·L2 400.0 | — | — | closed: JK loss 12.0 (2.0 %), JD-C 48.0 (8.16 %); sold F 300.0, M 240.0 (M recv 239.0, weighing diff 1.0); bills K ₹7,200, D ₹47,040; lineage DN-Y1 ← G-Y1 ← L1 (≈548.8), L2 (≈39.2) | — |
| K (link) | Mon 9 Nov | — | — | Y: yarn received 600.0 (L1 560, L2 40, confirmed by link); grey sent to D 210.0 + 200.0 (Y's record, can confirm/differ) | — | D's output/loss, Y's buyers, Y's remaining yarn, Y's yarn price |
| D | Mon 9 Nov EOD | — | — | Y: GRY 410.0 alloc(JD-C) | JD-C due 18 Nov | prices, K's rate, Y's yarn |
| D | Tue 17 Nov EOD | — | — | Y: GRY 588.0 (book), pending ≈261.9 kg grey (est) → ≈241.0 navy; **F: NVY 300.0 (no job, custody only)** | — | Y→F price |
| D | Thu 19 Nov EOD | — | — | 0 | closed; bill ₹47,040; sees #11 both sides (240.0 / 239.0) as `from` party | Y→M price |
| F | Tue 17 Nov EOD | — | NVY·DN-Y1 300.0 at D ("bought, at D") | — | — | M's 240; Y's job losses; K; lineage beyond DN-Y1? [G16] |
| F | Wed 18 Nov | NVY 300.0 | — | — | — | same |
| M | Thu 19 Nov | NVY·DN-Y1 239.0 | — | — | purchase 240.0 sent / 239.0 received — weighing diff, no discrepancy | F's 300; Y's costs |
| MS (link) | Mon 2 Nov | Y's purchase L1 560.0, L2 440.0 | — | — | — | Y's onward use |

### C.4 Balance check

| Line | Equation | Output vs plan |
|---|---|---|
| #1 | rcv-only: s := r (560.0 / 440.0) | |
| #2, #3–#5, #9 | 560 = 560; 40 = 40; 210, 200, 178, 300 s = r ✓ | |
| #11 | 240.0 = 239.0 + 1.0 + 0 + 0 ✓ | |
| JK pooled | 600.0 = 588.0 out + 12.0 loss ✓ | plan 600 × 0.985 = 591.0 → −3.0 |
| JK · L1 (pro-rata [G7]) | 560.0 = 548.8 (588 × 560/600) + 11.2 ✓ | |
| JK · L2 | 40.0 = 39.2 (588 × 40/600) + 0.8 ✓ | |
| JD-C · GRY | 588.0 = 540.0 + 48.0 ✓ | plan 588 × 0.92 = 540.96 → −0.96 |
| Global Y | YRN 1,000.0 = 400.0 + 600.0 consumed ✓; GRY 588.0 = 588.0 consumed ✓; NVY 540.0 = 300.0 (F) + 240.0 (M) ✓; M: 240.0 = 239.0 + 1.0 ✓ | |

### C.5 Model gaps hit

| Gap | What broke here |
|---|---|
| G1 | #1 mill MS (contact) as source |
| G7 | JK: one grey output from two input lines; per-line conservation needs an allocation the model doesn't define |
| G14 | #3–#5: K's output is implied by a **hop** recorded by Y, but §3.5 only implies outputs from a principal-recorded `job_work_return` |
| G15 | JD-C inputs arrived 7, 9, 11 Nov: expected = 14 or 18 Nov → "5 days late" vs "1 day late" |
| G16 | F/M see lot DN-Y1; §7 silent on whether they see G-Y1, L1/L2 or K |

---

## Scenario D — placement printing on cut panels, with misprints (01 §7 D)

### D.1 Setup

| Party | Kind | On platform | Role(s) |
|---|---|---|---|
| M | Business (manufacturer) | yes | principal; cuts and kits in-house |
| P | Business (panel printer) | yes | performer JP-D, JP-D2 |
| ST | Contact of M (stitching unit) | **no** | performer JST-D (receives kits) |

| Spec code | Spec |
|---|---|
| BLK9 / WHT9 | Knitted fabric · SJ · finished · 100 % cotton · 160 GSM · black / white |
| FRT·sz·col | Cut panel · style RN-200 · front · size · colour |
| BCK, SLV, RIB ·sz·col | Cut panel · RN-200 · back / sleeve pair / neck rib |
| FRTP·sz·col | Cut panel · RN-200 · front · printed "TIGER-1" (1 colour) |
| KIT·sz·col | Cut kit · RN-200 · printed |
| CWS | Cut waste · cotton |

Matrix **Q** (per colour): S 150 · M 250 · L 300 · XL 200 · XXL 100 = 1,000 (2,000 total; per size 300/500/600/400/200).
BOM snapshot: kit g/pc S 170 · M 180 · L 190 · XL 200 · XXL 210 → 188,500 g per colour; front-only snapshot M 68 g, L 72 g (not in the model [G18]).
Lots: DB-9, DW-9 (opening holding 215.0 kg each at M) → cut lots CB-9, CW-9; replacement cut lots CB-9R ← DB-9, CW-9R ← DW-9.

| Job | ProcessType | Principal → performer | Rate | Expected |
|---|---|---|---|---|
| JC-D | cutting (unit_changing) | M → self | — | — |
| JP-D | panel printing (count_preserving · per_piece_per_colour) | M → P | ₹4 × 1 colour | Mon 9 Nov |
| JC-D2 | cutting replacements, caused by JP-D misprints [G5] | M → self | — | — |
| JP-D2 | panel printing, caused by JP-D [G5] | M → P | ₹0 | Sat 14 Nov |
| JK-D | kitting (assembling) | M → self | — | — |
| JST-D | stitching (assembling) | M → ST | ₹13/pc | — |

### D.2 Event table (Nov 2026)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Mon 2 Nov | JC-D issue (in-house) | M `self` | BLK9·DB-9 215.0; WHT9·DW-9 215.0 | M@M av −215.0 → alloc(JC-D) +215.0 (each) |
| 2 | Tue 3 Nov | JC-D output + by-product + leftover kept + closure | M `self` | per colour FRT, BCK, SLV, RIB each in matrix Q (4 × 1,000); CWS black 23.8, white 24.1; leftover BLK9 2.0, WHT9 1.8 | M@M av +8,000 panels; CWS +47.9; alloc → av 2.0 / 1.8; alloc −213.0 / −213.2 → CONSUMED(JC-D); est 188.5 each on 1,000 kit-equivalents [G18]; residual 0.7 / 0.6 |
| 3 | Wed 4 Nov | Movement · job_work_out M→P (partial kit: fronts only) | M / P `account` | FRT black Q (1,000); FRT white Q (1,000) — 10 lines | M@M av −2,000; M@P alloc(JP-D) +2,000. BCK/SLV/RIB stay at M |
| 4 | Fri 6 Nov | JP-D output + job_work_return (black) | P / M `account` | FRTP black A S150 M238 L300 XL200 XXL100 (988); FRTP·M·black reject 12 | M@M av +988 A, +12 reject |
| 5 | Fri 6 Nov | JK-D issue + output (black) | M `self` | in FRTP A 988 + BCK/SLV/RIB black 988 each (S150 M238 L300 XL200 XXL100); out KIT black 988 | M@M av −3,952 → alloc(JK-D); KIT +988; line black M flagged `waiting_input` (12 fronts) |
| 6 | Mon 9 Nov | JP-D output + return (white) | P / M `account` | FRTP white A S150 M250 L282 XL200 XXL100 (982); FRTP·L·white reject 18 | M@M av +982 A, +18 reject |
| 7 | Mon 9 Nov | JK-D issue + output (white) | M `self` | in 982 × 4 components; out KIT white 982 | white L `waiting_input` (18) |
| 8 | Mon 9 Nov | Closure JP-D | M | FRT 2,000 | alloc(JP-D) −2,000 → CONSUMED(JP-D); misprints 30 = 1.5 % (= template, no flag); bill ₹7,880 or ₹8,000? [G4] |
| 9 | Mon 9 Nov | JC-D2 issue + output + closure (replacement fronts from reserve, same dye lots) | M `self` | in BLK9·DB-9 1.000 kg, WHT9·DW-9 1.600 kg; out FRT·M·black 12 (CB-9R), FRT·L·white 18 (CW-9R); CWS 0.150 + 0.260 | alloc → CONSUMED(JC-D2) 1.000 / 1.600; est 0.816 / 1.296 (front-only g/pc [G18]); residual 0.034 / 0.044 |
| 10 | Tue 10 Nov | Movement · job_work_out M→P (JP-D2) | M / P `account` | FRT·M·black 12; FRT·L·white 18 | M@M av −30 → M@P alloc(JP-D2) +30 |
| 11 | Thu 12 Nov | JP-D2 output + return + closure | P / M `account` | FRTP·M·black A 12; FRTP·L·white A 18 | M@M av +30; alloc(JP-D2) −30 → CONSUMED |
| 12 | Thu 12 Nov | JK-D issue + output (last) + closure | M `self` | in FRTP 30 + BCK/SLV/RIB 30 each; out KIT·M·black 12, KIT·L·white 18 | CB-9R/CW-9R share dye lots with CB-9/CW-9 → no §10.5 warning; alloc(JK-D) −8,000 → CONSUMED |
| 13 | Thu 12 Nov | Adjustment · write_off (misprints) | M `self` | FRTP·M·black reject 12; FRTP·L·white reject 18 | M@M av −30 → WRITTEN_OFF(misprint) +30 |
| 14 | Fri 13 Nov | Movement · job_work_out M→ST | M sent `self`; ST recv `on_behalf` (phone "got 2,000") | KIT black Q (1,000); KIT white Q (1,000) | M@M av −2,000 → M@ST alloc(JST-D) +2,000 |

### D.3 Participant views

| Party | Moment | Owned · own premises | Owned · at others | Held for others | Open jobs / flags | Must NOT see |
|---|---|---|---|---|---|---|
| M | Fri 6 Nov EOD | KIT black 988; BCK/SLV/RIB·M·black 12 each (waiting); BCK/SLV/RIB white 1,000 each; FRTP·M·black reject 12; BLK9 2.0; WHT9 1.8; CWS 47.9 | P: FRT white 1,000 pending (exact); book alloc(JP-D) still 2,000 [G2] | — | JK-D `waiting_input` (black M, 12 fronts); JP-D due 9 Nov | — |
| M | Mon 9 Nov EOD | KIT black 988, white 982; components waiting: black M 12 × 3, white L 18 × 3; FRT replacements 30 (unprinted); rejects 30; BLK9 1.0; WHT9 0.2; CWS 48.31 | — | — | JP-D closed (30 misprints, 1.5 %); JK-D waiting_input (30) | — |
| M | Fri 13 Nov | BLK9 1.0; WHT9 0.2; CWS 48.31 | ST: KIT 2,000 (pending, `on_behalf` only) | — | JST-D open; bill P ₹7,880/₹8,000 + ₹0 | — |
| P | Fri 6 Nov | — | — | M: FRT white 1,000 alloc(JP-D) | JP-D due 9 Nov | backs/sleeves/ribs, fabric, ST, M's other printers |
| P | Thu 12 Nov | — | — | 0 | JP-D 2,000 = 1,970 A + 30 rej; JP-D2 30 = 30 A | same |
| ST (link) | Fri 13 Nov | — | — | M: KIT 2,000 by matrix — "Told by phone", can confirm/differ | — | P, misprints, M's fabric |

### D.4 Balance check

| Line | Equation | Output vs plan |
|---|---|---|
| #3, #10, #14 movements | 2,000 = 2,000; 30 = 30; 2,000 = 2,000 ✓ | |
| JC-D · BLK9 | 215.0 = 188.5 est + 23.8 + 2.0 leftover + 0.7 residual ✓ (150·170 + 250·180 + 300·190 + 200·200 + 100·210 = 188,500 g) | 1,000 kit-equivalents vs Q 1,000 (0) |
| JC-D · WHT9 | 215.0 = 188.5 + 24.1 + 1.8 + 0.6 ✓ | 1,000 (0) |
| JP-D (count_preserving) | black M 250 = 238 A + 12 rej; white L 300 = 282 A + 18 rej; other 8 lines in = A out; total 2,000 = 1,970 + 30, residual 0 ✓ | |
| JC-D2 | black 1.000 = 0.816 (12 × 68 g) + 0.150 + 0.034 ✓; white 1.600 = 1.296 (18 × 72 g) + 0.260 + 0.044 ✓ | 12 / 18 as needed |
| JP-D2 | 30 = 30 A ✓ | |
| JK-D (assembling, per component line) | e.g. FRTP·M·black 238 + 12 = 250 → KIT 250; BCK·M·black 250 = 250 consumed; FRTP·L·white 282 + 18 = 300 → KIT 300; each of 40 lines in = kits out, 4 × 2,000 = 8,000 → 2,000 kits ✓ | 2,000 vs Q 2,000 |
| Global | BLK9 215.0 = 213.0 + 1.000 + 1.0 left ✓; WHT9 215.0 = 213.2 + 1.600 + 0.2 ✓; CWS 23.8 + 24.1 + 0.15 + 0.26 = 48.31 ✓; FRT·M·black 250 + 12 = 262 = 250 in kits + 12 written off ✓; FRT·L·white 300 + 18 = 318 = 300 + 18 ✓ | |

### D.5 Model gaps hit

| Gap | What broke here |
|---|---|
| G2 | M at 6 Nov: P shows 2,000 fronts allocated though 1,000 are back |
| G4 | JP-D bill: per_piece_per_colour on 2,000 or on 1,970 good? |
| G5 | JC-D2 / JP-D2 are not rework of the rejects (misprints are written off) — `rework_of` doesn't fit; misprint-rate per printer can't count them |
| G18 | JC-D outputs 4 component specs; consumption snapshot is per garment, so the estimate needs "kit-equivalents"; JC-D2 cuts fronts only and needs a per-component g/pc |

---

## Scenario E — dyed lot rejected for shade (01 §7 E), with variant E2

### E.1 Setup

| Party | Kind | On platform | Role(s) |
|---|---|---|---|
| F | Business (fabric shop) | yes | principal |
| D | **Contact of F** (dyer, phone; statement link in Tamil) — off-platform in this scenario | **no** | performer JE1, JE2 (E) / JE2b (E2) |

| Spec | Lots |
|---|---|
| GRY = Knitted fabric · SJ · grey · 100 % cotton · 160 GSM · 30" tubular | G-E1 (520.0 kg, 22 rolls; opening holding) |
| NVY = Knitted fabric · SJ · finished · 180 GSM · 36" open · navy (lab dip LD-882-B) | DN-E1 (← G-E1); DN-E1R re-dyed (← DN-E1) |
| BLK = same · black (E2 only) | DB-E2 (← DN-E1) |

| Job | ProcessType | Principal → performer | Rate | Expected |
|---|---|---|---|---|
| JE1 | dyeing navy (mass_losing · per_input_mass) | F → D | ₹80/kg | Thu 8 Oct (7 d) |
| JE2 (E) | strip & re-dye (mass_losing), `rework_of` JE1 | F → D | ₹0 | Mon 19 Oct (7 d) |
| JE2b (E2) | strip & re-dye black (mass_losing · per_input_mass), fresh job, caused by JE1 off-shade [G5] | F → D | ₹105/kg | Mon 19 Oct |

### E.2 Event table (Oct 2026)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 1 | Thu 1 Oct | Movement · job_work_out F→D | F sent `self`; D recv `link` 2 Oct | GRY·G-E1·A 520.0 (22 rolls) | F@F av −520.0 → F@D alloc(JE1) +520.0 |
| 2 | Wed 7 Oct | JE1 output (implied) + job_work_return | F recv `self` (`rcv-only`, s := r); D `link` 8 Oct | NVY·DN-E1·A 240.0 (10 rolls) | F@F av +240.0 |
| 3 | Fri 9 Oct | same (last) | same; D `link` 10 Oct | NVY·DN-E1·A 238.0 (10 rolls) | F@F av +238.0; JE1 1 day late |
| 4 | Sat 10 Oct | Closure JE1 | F | GRY 520.0 | alloc(JE1) −520.0 → CONSUMED(JE1); loss 42.0 (8.08 %) |
| 5 | Sat 10 Oct | F rejects 5 rolls off-shade: **regrade** A → rework [G3]; Discrepancy QE-1 `quality_claim` vs JE1 | F `self` | NVY·DN-E1 118.0 (5 rolls) | F@F av(A) −118.0; F@F held(off-shade) rework +118.0 — original receipts #2/#3 untouched |
| 6 | Mon 12 Oct | Movement · return (rework) F→D [G17]; new job JE2 `rework_of` JE1; QE-1 resolved "re-dye free" (D agrees by phone) | F `self`; D `link` (recv) / `on_behalf` (QE-1) [G11] | NVY·DN-E1·rework 118.0 (5 rolls) | F@F −118.0 → F@D alloc(JE2) +118.0; QE-1 outcome not in §3.7 list [G11] |
| 7 | Wed 21 Oct | JE2 output + return | F recv `self`; D `link` | NVY·DN-E1R·A 114.0 (5 rolls) | F@F av +114.0; JE2 2 days late (exp 19 Oct) |
| 8 | Wed 21 Oct | Closure JE2 + Discrepancy LE-1 `loss_dispute` | F `self`; D position `on_behalf` | NVY 118.0 | alloc(JE2) −118.0 → CONSUMED(JE2); loss 4.0 (3.39 %); positions: F "D bears 4.0 kg (₹1,240 @ ₹310/kg)"; D "normal strip loss" |
| 9 | Sat 24 Oct | LE-1 resolved: `credit` (split value, 2.0 kg × ₹310) | F `self`; D accepts on link [G11] | — | no quantity change; JE1 bill ₹41,600 − ₹620 = ₹40,980 |

**Variant E2** (replaces #6–#9; #1–#5 unchanged, but QE-1 is withdrawn: F decides to change the shade)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| 6′ | Mon 12 Oct | Movement · job_work_out F→D; **fresh** job JE2b (input spec = finished navy; output spec black) | F `self`; D `link` | NVY·DN-E1·rework 118.0 | F@F −118.0 → F@D alloc(JE2b) +118.0 |
| 7′ | Tue 20 Oct | JE2b output + return | F `self`; D `link` | BLK·DB-E2·A 113.0 (5 rolls) | F@F av +113.0; 1 day late |
| 8′ | Tue 20 Oct | Closure JE2b | F | NVY 118.0 | alloc −118.0 → CONSUMED(JE2b); loss 5.0 (4.24 %); bill 118.0 × ₹105 = ₹12,390; lineage DB-E2 ← DN-E1 ← G-E1; not counted in D's re-dye rate (no `rework_of`) [G5] |

### E.3 Participant views

| Party | Moment | Owned · own premises | Owned · at others | Held for others | Open jobs (pending) / flags | Must NOT see |
|---|---|---|---|---|---|---|
| F | Sat 10 Oct EOD | NVY·DN-E1 A 360.0; rework (held, off-shade) 118.0 | — | — | JE1 closed, loss 42.0 (8.08 %); QE-1 open | — |
| F | Wed 14 Oct | NVY A 360.0 | D: NVY rework 118.0 alloc(JE2); pending 118.0 → ≈114.5 navy (est, 3 % strip loss) | — | JE2 due 19 Oct | — |
| F | Sat 24 Oct (E) | NVY A 474.0 (DN-E1 360.0 + DN-E1R 114.0) | — | — | JE2 closed, loss 4.0 (3.39 %); LE-1 → credit ₹620; navy chain 520.0 → 474.0 (loss 46.0, 8.85 % = 42.0 + 4.0); D re-dye rate (F-private norm): 1 of 1 jobs, 118/478 kg = 24.7 % | — |
| F | Tue 20 Oct (E2) | NVY A 360.0; BLK·DB-E2 113.0 | — | — | JE2b closed; bill ₹12,390; re-dye rate unchanged [G5] | — |
| D (link) | Fri 2 Oct | — | — | F: "520.0 kg grey, 22 rolls" → confirmed | — | F's customers, notes, F's re-dye-rate norm on D |
| D (link) | Mon 12 Oct | — | — | F: JE1 520.0 in / 478.0 back (confirmed 8 & 10 Oct); 118.0 back for re-dye, no charge (confirm) | JE2 due 19 Oct | same |
| D (link) | Wed 21 Oct | — | — | F: 0 | JE2 118.0 in / 114.0 back; LE-1 with F's position; actions confirm / differs / propose | same |

### E.4 Balance check

| Line | Equation | Output vs plan |
|---|---|---|
| #1, #2, #3, #6, #7 | 520.0, 240.0, 238.0, 118.0, 114.0: s = r ✓ (rcv-only/link) | |
| JE1 · GRY | 520.0 = 478.0 + 42.0 ✓ | plan 520 × 0.92 = 478.4 → −0.4 |
| JE2 · NVY rework | 118.0 = 114.0 + 4.0 ✓ | |
| F navy | 478.0 = 360.0 + 118.0 (to JE2) ✓; chain 520.0 = 474.0 + 42.0 + 4.0 ✓ | |
| E2: JE2b · NVY | 118.0 = 113.0 + 5.0 ✓ | |
| E2: F global | 520.0 = 360.0 navy + 113.0 black + 42.0 + 5.0 ✓ | |

### E.5 Model gaps hit

| Gap | What broke here |
|---|---|
| G3 | #5: owner downgrades 118 kg after receipt; no regrade event |
| G5 | E2: fresh charged job caused by off-shade can't be linked except as `rework_of` (which implies free rework and re-dye stats) |
| G11 | #6: quality_claim outcome "rework free" not in outcome list; #6/#9: D (contact) cannot accept a proposal on the link |
| G17 | #6: rework re-issue under `return` (commercial wording) instead of a job-work challan |

---

## 6. Consolidated model gaps and proposed minimal fixes

| # | Gap (what broke, concrete) | Proposed minimal fix |
|---|---|---|
| G1 | Purchases from contacts/untracked parties post `−s` on a supplier holding that doesn't exist (A#1 K, A#12 T1, B#1 FT, C#1 MS); §5.4 rejects it. Same for sales to contacts (R3, S2 buttons) and a job worker's own material with no counted stock (B#20). | Pseudo-holding `EXTERNAL(party)` as source/sink for any party whose stock isn't on the recorder's ledger; exempt from §5.4; §5.5 inflows = EXTERNAL outflows. |
| G2 | Inputs stay in `alloc(J)` at full issued qty until closure → holdings double-count (A: 600 kg grey + 427 kg navy at once; JCHK same-spec in and out; D: 2,000 fronts "at P" with 1,000 back). | Post consumption at each output: exact for count_preserving/assembling (1:1 or BOM), labelled estimate for mass_losing/unit_changing; true-up at closure. |
| G3 | No regrade: receiver's assertions are qty-only, so "received 60, 3 need rework" (A#24) and post-receipt shade rejection (E#5) need an artificial job. | Adjustment kind `regrade` (owner, own premises, only grade changes) + optional per-grade split in the received assertion (difference → discrepancy). |
| G4 | Billing: `per_good_output_piece` double-counts rework (A JS1: 332 + 4 = 336 vs 331 good); unclear whether rejects bill under per_output_piece / per_piece_per_colour (D JP-D ₹7,880 vs ₹8,000). | Rate card field `billable_grades`; good count of J = A(J) − regraded-from-J + A(rework_of J); rework jobs bill at their own rate (default 0). |
| G5 | Only `rework_of` links jobs: replacement cutting/printing (D) and a charged re-dye to another shade (E2) can't be linked to the causing job; rework job's ProcessType (garments in, not kits) is unspecified (A JS1-RW). | Add `caused_by {job_id, reason}` on Job; rework jobs default to an "alteration/re-process" type (count_preserving or mass_losing). Re-dye/misprint rates count `rework_of` ∪ `caused_by`. |
| G6 | Issue only via movement or in-house: rework at the job worker that already holds the goods (B#14) has no event. | `issue_in_place` event: `av → alloc(J′)` at same custodian, recorded by principal or performer (other side confirms). |
| G7 | mass_losing job with several input lines of the same unit and one output (C JK: L1 560 + L2 40 → 588 grey) — per-line conservation needs an allocation. | Output declaration may name input lines; else pro-rata by issued mass, stored on closure. |
| G8 | "Issued" = sent or received is undefined (B#2 150.0 vs 149.2); matters for per_input_mass bills and residuals. | Issued = received; weighing difference stays on the movement; rate card states billing mass basis `sent` or `received`. |
| G9 | Pending estimate only defined as `issued − o/expected_yield`; meaningless for unit_changing (kg → pcs) and can go negative (B: −1.27 kg). | Per conservation_kind estimate formula; clamp at 0 and show "≈0, ready to close". |
| G10 | Leftover thread (partial cones) and kept-for-next qty are estimates but movement/disposition quantities have no estimate flag (A#38, #42; B#21), against P10. | `qty.estimated: bool` + `basis` on lines and dispositions. |
| G11 | Discrepancies with contacts: disputed holding's custodian undefined (A#20); statement link has no "accept/counter proposal" action (A#21, E#9); quality_claim outcomes lack `rework(job)` / `replace` (E#6). | Disputed holding keeps sender as custodian until resolved; add link action "accept proposal" (evidence `link`); add outcomes `rework`, `replace`. |
| G12 | ProcessType template has one `loss_norm_pct`; norms differ by material class (PC 4–7 %, poly 2–4 %, dark 8–12 %). A's 7.67 % on PC isn't flagged until n ≥ 3 learned. | Template norms keyed by material class (shade class / fibre). |
| G13 | Line key "spec × lot × grade" can't hold the same grey lot for two jobs in one challan (A#2). | Line key = spec × lot × grade × job_id. |
| G14 | Outputs are implied only by a principal-recorded `job_work_return`; a hop of output spec from the performer (C#3–#5) doesn't imply K's output. | Any outbound movement of an output spec from the performer, tagged with the job, implies the output. |
| G15 | Expected date = "issue date + turnaround" is undefined when inputs arrive in parts (C JD-C: 14 vs 18 Nov → 5 vs 1 day late). | Rule: from the last issue (or each part gets its own expected date); store `expected_basis`. |
| G16 | §7 silent on lineage: may buyers F/M see parent lots (G-Y1, yarn L1/L2) and upstream parties (K)? | Lineage visible up to the first lot the viewer doesn't own; beyond that "supplier lot" without party names unless the owner shares. |
| G17 | `return` purpose covers both commercial returns (ownership/debit note) and re-sending goods for rework (a job-work challan under s.143) — wrong wording/GST mapping (A#34, #39; E#6). | Add purpose `rework_out` (custody only, job-work challan); keep `return` commercial. |
| G18 | unit_changing consumption is per garment; cutting into separate component specs (D: front/back/sleeves/rib) and cutting fronts only (D#9) have no consumption basis. | BOM consumption per component (g/pc), estimate = Σ component pcs × component g/pc; garment g/pc = Σ components. |
