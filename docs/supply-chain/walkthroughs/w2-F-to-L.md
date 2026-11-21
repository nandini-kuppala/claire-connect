# Walkthrough 2 · Scenarios F – L through `02-domain-model.md`

Verifier walkthrough (written by an agent that did not write the model). Vocabulary is only what `02-domain-model.md` defines; anything extra is used **and** listed as a gap (tagged **⟨gap Xn⟩** where it appears).

## 0. Notation

| Symbol | Meaning |
|---|---|
| `[spec·lot·grade \| owner/custodian/via \| state]` | Holding key (§3.3). `via` `–` = empty. Location omitted unless it matters. |
| `av` · `al(J)` · `it(MV)` · `dsp(DQ)` · `hd(x)` | states available · allocated(job) · in_transit(movement) · disputed(discrepancy) · held(reason) |
| `→` | posting pair: left side `−q`, right side `+q` (same q unless stated) |
| `CONSUMED(J)` · `LOSS(kind→party)` · `WRITTEN_OFF(r)` · `SOLD(p)` | pseudo-holdings (§4) |
| Evidence | `self` · `on_behalf` · `link` · `account` (§9.1). `implied` = not in model ⟨gap L6⟩ |
| Units | displayed kg (1 dp), m, pc; stored in base atoms g / cm / pc (500.0 kg = 500,000 g; 4,200 m = 420,000 cm). |
| `(c)` | the party is an off-platform **Contact** owned by the business named after it, e.g. `H(c of S1)` |
| Est | estimate per P10 / §5.2 |

Size × colour matrices are expanded into per-size lines only where size matters to the scenario (I, J). In F and H the kit matrix is collapsed to one spec for readability; every per-size line conserves the same way.

---

## F. Job worker sub-contracting (M → S1 → H)

### F.1 Setup

| Party | Kind | Role in F |
|---|---|---|
| M | Business (on-platform, GST-registered) | principal / owner of everything |
| S1 | Business (on-platform, registered) | performer of J; `via` of J′, J′r |
| H | **Contact of S1** (off-platform, phone only; statement link S1↔H, Tamil) | performer of child jobs J′, J′r. M has **no** contact record for H. |

| Spec code | Spec | Unit (base) |
|---|---|---|
| KIT | Cut kit · tee RN-180 · navy · M (matrix collapsed) | pc |
| TEE | Tee RN-180 · navy · M | pc |
| LBL | Main label · woven · M brand · size M | pc |
| THR | Thread · spun poly · Tex 27 · navy; factor `cone = 5,000 m (label)` | cm, shown m |

Lots: KIT lot `K-0901` (cut lot); garment output lots unlabelled (`–`).

| Job | Process (kind / rate basis) | Principal → Performer | Links | Rate | Expected |
|---|---|---|---|---|---|
| J | stitching (assembling / per_good_output_piece) | M → S1 | — | ₹14/good pc (M↔S1) | Tue 1 Dec + 6 working days (6-day cal.) = **Tue 8 Dec** |
| J′ | stitching | M → H(c of S1) | parent J, via S1 | ₹11/good pc (S1↔H) | 2 Dec + 5 d agreed = 8 Dec |
| J′r | alteration (count_preserving / per_good_output_piece) | M → H(c of S1) | rework_of J′, via S1 | ₹11/good pc (paid once good) | 9 Dec + 3 d = 12 Dec |

Factors snapshot on J and J′: thread 140 m/pc; label 1/pc.

### F.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| F1 | 1 Dec | Movement `job_work_out` MV1 M→S1, job J | M sent (self); S1 received (account) | KIT·K-0901·A 3,000 pc; LBL 3,000 pc; THR 90 cone = 450,000 m | each line: `[·\|M/M/–\|av] → [·\|M/M→S1/–\|it(MV1)] → [·\|M/S1/–\|al(J)]` (3,000 / 3,000 / 450,000 m) |
| F2 | 2 Dec | Movement MV2 S1→H, creates child job J′ (parent J, via S1). Purpose `hop`? ⟨gap F5⟩ | S1 sent (self); H received (link "Received OK") | KIT 1,000; LBL 1,000; THR 30 cone = 150,000 m | `[·\|M/S1/–\|al(J)] → it(MV2) → [·\|M/H/S1\|al(J′)]`; J bucket `forwarded` +1,000 / +1,000 / +150,000 m |
| F3 | 5 Dec | J output declared | S1 (account) | TEE·–·A 1,200 | `+1,200 [TEE·A\|M/S1/–\|av]`; inputs not reduced (§4.2) |
| F4 | 8 Dec | J output declared | S1 (account) | TEE·A 783; TEE·reject 14 | `+783 [TEE·A\|M/S1/–\|av]`, `+14 [TEE·reject\|M/S1/–\|av]` |
| F5 | 8 Dec | J pause `waiting_input` (3 kits missing sleeves) | S1 | — | none; late clock paused (§11) |
| F6 | 8 Dec | Movement MV3 H→S1 (purpose ⟨gap F5⟩); **implied outputs of J′** | S1 received (self); H sent (link: proposal "985 + 15" accepted by S1) | TEE·A 985; TEE·rework 15 | output: `+985 [TEE·A\|M/H/S1\|av]`, `+15 [TEE·rework\|M/H/S1\|av]`; movement: `→ it(MV3) → [TEE·A\|M/S1/–\|av]` 985, `[TEE·rework\|M/S1/–\|av]` 15 (via cleared) |
| F7 | 9 Dec | Movement MV4 S1→H purpose `return` (rework back to job worker); new job J′r rework_of J′ | S1 sent (self); H received (link) | TEE·rework 15 | `[TEE·rework\|M/S1/–\|av] → it(MV4) → [TEE·rework\|M/H/S1\|al(J′r)]` |
| F8 | 10 Dec | Movement MV5 S1→M `job_work_return`, partial 1 | S1 sent (account); M received (account) | TEE·A 1,983 (job J) · TEE·A 985 (job J′) ⟨gap F4⟩ · TEE·reject 14 (J) | `[TEE·g\|M/S1/–\|av] → it(MV5) → [TEE·g\|M/M/–\|av]` for 2,968 A + 14 reject |
| F9 | 11 Dec | Movement MV6 H→S1: J′r outputs + J′ leftover thread | S1 received (self; thread weighed 264.6 g ÷ 27 g/km = 9,800 m, factor `weighed`); H sent (link: "12 good, 3 spoilt, thread back" — no metres) | TEE·A 12 (J′r); TEE·scrap 3 (J′r); THR leftover 9,800 m (J′) | outputs `+12 [TEE·A\|M/H/S1\|av]`, `+3 [TEE·scrap\|M/H/S1\|av]` → MV6 → `[·\|M/S1/–\|av]`; thread `[THR\|M/H/S1\|al(J′)] → it(MV6) → [THR\|M/S1/–\|al(J)]` ⟨gap F3⟩ |
| F10 | 11 Dec | Closure J′ | S1 | — | `[KIT\|M/H/S1\|al(J′)] 1,000 → CONSUMED(J′)`; LBL 1,000 → CONSUMED(J′); THR 140,200 m → CONSUMED(J′) (est in output 140,000 m, residual 200 m) |
| F11 | 11 Dec | Closure J′r | S1 | — | `[TEE·rework\|M/H/S1\|al(J′r)] 15 → CONSUMED(J′r)` |
| F12 | 12 Dec | Movement MV7 S1→M `job_work_return`, partial 2 | S1 (account); M (account) | TEE·A 12 (J′r); TEE·scrap 3 (J′r) | `[·\|M/S1/–\|av] → it(MV7) → [·\|M/M/–\|av]` |
| — | 12 Dec | **J stays open**: 3 kits + 3 labels + thread at S1, status `in_progress`, paused `waiting_input` | | | |

### F.3 Participant views

Moments: **A** = 2 Dec (after hop) · **B** = 10 Dec (after MV5) · **C** = 12 Dec (after MV7).

**M**

| | Owned @ own premises | Owned @ others | Open jobs (pending) | Flags | Bill (M→S1) |
|---|---|---|---|---|---|
| A | — | **S1:** KIT 2,000 · LBL 2,000 · THR 300,000 m (al J). **"H via S1"** (name ⟨gap F1⟩): KIT 1,000 · LBL 1,000 · THR 150,000 m | J issued 3,000 kits, pending 3,000 (of which 1,000 at child J′ — quantities visible, rate not) | — | ₹0 |
| B | TEE A 2,968 · reject 14 | S1: KIT 3 · LBL 3 · THR 300,000 m raw (est left 20,420 m). H via S1: TEE rework 15 (J′r), THR est 10,000 m | J pending 3 kits; J′r 15 pcs | J `waiting_input` (paused, not late); output 2,968 vs plan 3,000 | 2,968 × 14 = **₹41,552** only with roll-up; model as written: 1,983 × 14 = ₹27,762 ⟨gap F2⟩ |
| C | TEE A 2,980 · reject 14 · scrap 3 | S1: KIT 3 · LBL 3 · THR est 30,220 m | J pending 3 kits | waiting_input; J′ thread residual 200 m (0.13 %, below threshold, shown) | 2,980 × 14 = **₹41,720** (roll-up) |

Must NOT see: S1↔H rate ₹11 and S1's bill with H; H's phone / S1's contact record; S1's other principals' goods.

**S1**

| | Owned | Held for others @ own premises | Held for others, sent on | Jobs | Bills |
|---|---|---|---|---|---|
| A | — | M: KIT 2,000 · LBL 2,000 · THR 300,000 m | M's goods at H(c): KIT 1,000 · LBL 1,000 · THR 150,000 m | performer J (pending 3,000 incl. 1,000 forwarded); via on J′ (due 8 Dec) | from M ₹0; to H ₹0 |
| B | — | M: KIT 3 · LBL 3 · THR raw 300,000 m (est 20,420 m) | at H: TEE rework 15, THR est 10,000 m | J paused; J′r due 12 Dec | from M ₹41,552 (roll-up); to H 985 × 11 = ₹10,835 |
| C | — | M: KIT 3 · LBL 3 · THR est 30,220 m | — | J paused | from M ₹41,720; to H 997 × 11 = ₹10,967 (J′ 985 + J′r 12) |

Must NOT see: M's stock elsewhere, M's other job workers.

**H** (statement link S1↔H only; no account)

| | Open lines shown | Amount (only if S1 shares rates) |
|---|---|---|
| A | "From S1, 2 Dec: 1,000 kits, 1,000 labels, 30 cones — you confirmed". Owner shown as "for S1" (default per ⟨gap F1⟩) | — |
| B | returned 985 + 15 (accepted by S1); 15 back for alteration; 30 cones still open | ₹10,835 |
| C | all lines closed; thread back | ₹10,967 |

Must NOT see: M's 2,000 kits at S1; ₹14 rate; S1's other contacts.

### F.4 Balance check

| Line | Equation (§5.1 / §5.2) | Numbers | Closes |
|---|---|---|---|
| MV1–MV7 every line | sent = received | all sent = received (e.g. MV5: 2,968 A = 2,968; 14 = 14) | ✓ |
| J · KIT (assembling primary) | issued = outputs (all grades) + forwarded + pending + residual | 3,000 = 1,997 (1,983 A + 14 rej) + 1,000 + 3 + 0 | ✓ |
| J · LBL (secondary) | issued = consumed + forwarded + pending (formula in §5.2 table omits the last two ⟨gap F5⟩) | 3,000 = 1,997 + 1,000 + 3 | ✓ |
| J · THR (open) | issued = consumed est + forwarded (net) + pending est | 450,000 = 279,580 (1,997 × 140) + 140,200 (150,000 − 9,800 back) + 30,220 (20,420 + 9,800) | ✓ (est) |
| J′ · KIT | issued = outputs | 1,000 = 985 A + 15 rework | ✓ |
| J′ · LBL | issued = consumed | 1,000 = 1,000 (1,000 garments) | ✓ |
| J′ · THR | issued = consumed est + leftover returned + residual | 150,000 = 140,000 + 9,800 + **200 residual** (alteration thread drawn from J′ stock; weight→metre estimate) | residual 200 m |
| J′r · TEE rework (count_preserving) | issued = outputs | 15 = 12 A + 3 scrap | ✓ |
| Output side | returned + pending vs 3,000 | 2,980 A + 14 reject + 3 scrap + 3 kits pending = 3,000 | ✓ |
| Global TEE (M) | inflows − consumed = holdings | outputs 1,997 + 1,000 + 15 = 3,012; − CONSUMED(J′r) 15 = 2,997 at M | ✓ |

### F.5 Gaps

| # | What broke | Minimal fix |
|---|---|---|
| F1 | §7 says M sees its goods "with H, via S1", but H is S1's **private contact** (§3.1, §7 "contacts … only the recording business"). Reverse direction too: custodian H "sees owner's name" (M) though S1 may not want H to learn its customer. Research says sub-contracting is often undisclosed ("optionally" in 01 F). | Add `disclosure` on the via leg: owner sees `custodian = "sub-contractor of S1"` plus name only if S1 shares; sub-custodian sees owner as "for S1" unless S1 shares. Quantities always flow up to the owner. |
| F2 | J's outputs are only 1,983 + 14; the 997 good garments came from child jobs. M's job balance ("how many of my 3,000 are done") and the bill (`per_good_output_piece` × ₹14) need the **subtree**. Not specified. | Define principal-facing job balance and bill as roll-ups over `parent_job_id` descendants (rework_of descendants included); performer↔sub-performer bills stay per child job. |
| F3 | Leftover thread returning from child J′ to S1 (the via) — unclear whether it re-enters `al(J)` and nets against J's `forwarded`, or is a new issue. | Rule: unprocessed returns from a child job to its via post into the parent's `al(J)` and reduce `forwarded` (net). |
| F4 | Movement line has a single `job_id`, and lines are "one per spec × lot × grade". MV5's 2,968 A tees are outputs of J **and** J′ (and MV7's of J′r). | Allow several lines with the same spec/lot/grade differing by `job_id`, or `job_allocations[{job_id, qty}]` on a line. |
| F5 | §3.4.1 purposes assume an owner's instruction (`hop`) or a return **to the principal** (`job_work_return`). S1→H (S1's own decision) and H→S1 (back to the via, not the principal) fit neither; outputs are "implied by the **principal** recording a return" but S1 is not the principal. Also the §5.2 "assembling secondary" formula `issued − consumed − leftover` omits `forwarded` and `pending`. | Add purposes `subcontract_out` / `subcontract_return` (custody change, owner unchanged, via set/cleared); let the **via** imply child outputs; restate secondary formula with all §5.2 buckets. |

---

## G. One dyer holding material for many principals

### G.1 Setup

| Party | Kind | Role |
|---|---|---|
| D | Business (registered) | performer for all four jobs; custodian |
| F | Business | principal J_F; buyer (sale_in_place) |
| M | Business | principal J_M |
| Y | Business | principal J_Y; seller (sale_in_place) |
| K | Business (knitter, Y's job worker) | sender of hop |
| Ravi | **Contact of D** (off-platform; statement link D↔Ravi) | principal J_R |

| Spec | | Lots in |
|---|---|---|
| GSJ | Grey SJ 160 GSM 30″ tubular cotton | GF-17 (F), GM-22 (M), GY-5 (Y) |
| GRB | Grey 1×1 rib 220 GSM cotton | – (Ravi, unlabelled) |
| FSN | Finished SJ 180 GSM navy | out: D-5010 (batch B-1), D-5011 |
| FSB | Finished SJ 180 GSM black | out: D-5012 |
| FRN | Finished rib navy | out: D-5013 |

| Job | Principal | Rate (per_input_mass) | Loss norm | Expected (7-day cal., 7 d) |
|---|---|---|---|---|
| J_F | F | ₹85/kg | 8 % | 9 Dec |
| J_M | M | ₹85/kg | 8 % | 9 Dec |
| J_Y | Y | ₹95/kg | 8 % | 8 Dec |
| J_R | Ravi(c of D) | ₹90/kg | 7 % (rib) | 10 Dec |

Machine batches (D-internal, **not a model concept** ⟨gap G1⟩): B-1 = F 300 + M 300 navy; B-2 = F 220 navy; B-3 = Y 588 black; B-4 = Ravi 150 rib.

### G.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| G1 | 1 Dec | Movement `hop` MG1 K→D (owner Y), job J_Y | Y (instruction, self); K sent (account); D received (account) | GSJ·GY-5·A 588.0 kg | `[GSJ·GY-5\|Y/K/–\|av] → it(MG1) → [·\|Y/D/–\|al(J_Y)]` |
| G2 | 2 Dec | `job_work_out` MG2 F→D, J_F | F (self); D (account) | GSJ·GF-17 520.0 kg | `[·\|F/F/–\|av] → it → [·\|F/D/–\|al(J_F)]` |
| G3 | 2 Dec | `job_work_out` MG3 M→D, J_M | M (self); D (account) | GSJ·GM-22 300.0 kg | `→ [·\|M/D/–\|al(J_M)]` |
| G4 | 3 Dec | `job_work_out` MG4 Ravi→D, J_R | D received (self); Ravi sent (on_behalf: "Ravi's chit says 150") | GRB·– 150.0 kg | `[GRB\|Ravi/Ravi/–\|av] → it → [GRB\|Ravi/D/–\|al(J_R)]` |
| G5 | 4 Dec | J_F output (batch B-1, **allocated** pro-rata ⟨gap G1⟩) | D (account) | FSN·D-5010·A 276.0 | `+276.0 [FSN·D-5010\|F/D/–\|av]` |
| G6 | 4 Dec | J_M output (batch B-1, allocated) | D (account) | FSN·D-5010·A 276.0 | `+276.0 [FSN·D-5010\|M/D/–\|av]` — same lot, two owners ⟨gap G2⟩ |
| G7 | 5 Dec | J_F output (B-2, weighed) | D | FSN·D-5011 202.0 | `+202.0 [·\|F/D/–\|av]` |
| G8 | 5 Dec | J_Y output (B-3) | D | FSB·D-5012 540.0 | `+540.0 [·\|Y/D/–\|av]` |
| G9 | 6 Dec | J_R output (B-4) | D | FRN·D-5013 139.5 | `+139.5 [·\|Ravi/D/–\|av]` |
| G10 | 7 Dec | `job_work_return` MG5 D→F | D (account); F (account) | FSN·D-5010 276.0 | `[·\|F/D/–\|av] → it → [·\|F/F/–\|av]` |
| G11 | 7 Dec | `job_work_return` MG6 D→M | D; M (account) | FSN·D-5010 276.0 | `→ [·\|M/M/–\|av]` |
| G12 | 8 Dec | `job_work_return` MG7 D→F | D; F (account) | FSN·D-5011 202.0 | `→ [·\|F/F/–\|av]` |
| G13 | 8 Dec | `sale_in_place` MG8 Y→F at D (seller Y, buyer F), rate ₹330/kg on line ⟨gap G3⟩ | Y (account); F (account) | FSB·D-5012 300.0 | `[FSB·D-5012\|Y/D/–\|av] → [·\|F/D/–\|av]` (custodian unchanged) |
| G14 | 9 Dec | `job_work_return` MG9 D→Ravi (Ravi collects) | D sent (self); Ravi received (on_behalf) | FRN·D-5013 139.5 | `[·\|Ravi/D/–\|av] → it → [·\|Ravi/Ravi/–\|av]` |
| G15 | 9 Dec | Closure J_F | F reviews, D | — | `[GSJ·GF-17\|F/D/–\|al(J_F)] 520.0 → CONSUMED(J_F)`; stored: into output 478.0, loss 42.0 (8.08 %) |
| G16 | 9 Dec | Closure J_M | M, D | — | 300.0 → CONSUMED(J_M); output 276.0, loss 24.0 (8.00 %, **allocated**) |
| G17 | 10 Dec | Closure J_Y | Y, D | — | 588.0 → CONSUMED(J_Y); output 540.0, loss 48.0 (8.16 %) |
| G18 | 10 Dec | Closure J_R | D (Ravi via link) | — | 150.0 → CONSUMED(J_R); output 139.5, loss 10.5 (7.00 %) |

Still at D after G18: Y FSB 240.0 (owner Y); F FSB 300.0 (owner F, storage custody, no job).

### G.3 Participant views

Moments: **t1** = 3 Dec (all received) · **t2** = 6 Dec (all outputs declared, nothing returned) · **t3** = 10 Dec (all closed).

**D** (performer / custodian)

| | Owned | Held for others (by principal) | By batch (D only) | Jobs / pending | Bills (due from) |
|---|---|---|---|---|---|
| t1 | (dyes/chemicals not tracked) | F GSJ 520.0 · M GSJ 300.0 · Y GSJ 588.0 · Ravi(c) GRB 150.0 = **1,558.0 kg** | — | 4 open, pending 520/300/588/150 | — |
| t2 | — | finished: F 478.0 (276.0 D-5010 + 202.0 D-5011) · M 276.0 · Y 540.0 · Ravi 139.5 = 1,433.5 kg. Pending est: F 520 − 478/0.92 = 0.4 · M 0.0 · Y 588 − 540/0.92 = 1.0 · Ravi 150 − 139.5/0.93 = 0.0. **Raw ledger still shows 1,558.0 kg grey al(·)** ⟨gap G4⟩ | B-1 600.0→552.0 (F 300/276, M 300/276) · B-2 220.0→202.0 · B-3 588.0→540.0 · B-4 150.0→139.5 | 4 in_progress | accruing |
| t3 | — | Y FSB 240.0 · F FSB 300.0 ("bought from Y, held for F") | — | all closed; losses within 6–12 % band | F ₹44,200 · M ₹25,500 · Y ₹55,860 · Ravi ₹13,500 = ₹139,060 |

Must NOT see: Y→F sale price ₹330/kg (D is a movement party of MG8 ⟨gap G3⟩).

**F**

| | Owned @ own | Owned @ others | Jobs | Flags | Bills |
|---|---|---|---|---|---|
| t1 | — | D: GSJ 520.0 (al J_F) | J_F due 9 Dec | — | — |
| t2 | — | D: FSN 478.0 (D-5010 276.0, D-5011 202.0) | J_F pending est 0.4 kg | — | accrued 520 × 85 = ₹44,200 |
| t3 | FSN 478.0 | D: FSB 300.0 (bought, storage) | J_F closed, loss 42.0 (8.08 %) | — | to D ₹44,200; to Y ₹99,000 |

Must NOT see: M's 300/276 in the same dye lot; batch size 600/552; that D-5010 has a second parent GM-22 ⟨gap G2⟩; Y's 240 remaining; Ravi.

**M**

| | Owned @ own | Owned @ others | Jobs | Bill |
|---|---|---|---|---|
| t1 | — | D: GSJ 300.0 | J_M | — |
| t2 | — | D: FSN 276.0 (D-5010) | pending est 0.0 | ₹25,500 |
| t3 | FSN 276.0 | — | J_M closed 24.0 (8.00 %) — **allocated loss**, not weighed ⟨gap G1⟩ | ₹25,500 |

Must NOT see: F's quantities, batch partner, Y, Ravi.

**Y**

| | Owned @ others | Jobs | Commercial |
|---|---|---|---|
| t1 | D: GSJ 588.0 (from K by hop) | J_Y | — |
| t2 | D: FSB 540.0 | pending est 1.0 | — |
| t3 | D: FSB 240.0 | J_Y closed 48.0 (8.16 %); bill to D ₹55,860 | sold 300.0 to F in place, ₹99,000 due from F |

Must NOT see: F's navy jobs, F's 300 after the sale except as "sold to F, at D"; M; Ravi.

**Ravi** (statement link D↔Ravi)

| | Shown |
|---|---|
| t1 | "D received 150 kg rib from you on 3 Dec — Confirm / Differs" |
| t2 | "Ready: 139.5 kg" |
| t3 | "Collected 139.5 kg on 9 Dec; loss 10.5 kg (7.0 %)"; ₹13,500 only if D shares |

Must NOT see: any other principal at D.

### G.4 Balance check

| Line | Equation | Numbers | |
|---|---|---|---|
| MG1–MG9 | sent = received | all equal (588.0, 520.0, 300.0, 150.0, 276.0, 276.0, 202.0, 300.0, 139.5) | ✓ |
| J_F · GSJ (mass_losing) | issued = Σ outputs + loss | 520.0 = (276.0 + 202.0) + 42.0 | ✓ |
| J_M | | 300.0 = 276.0 + 24.0 | ✓ |
| J_Y | | 588.0 = 540.0 + 48.0 | ✓ |
| J_R | | 150.0 = 139.5 + 10.5 | ✓ |
| Batch B-1 (outside model) | 600.0 = 552.0 + 48.0; 48.0 = 24.0 (F) + 24.0 (M) | | ✓ |
| Y global FSB | outputs = holdings + sold | 540.0 = 240.0 + 300.0 | ✓ |
| D custody at t3 | | 240.0 + 300.0 = 540.0 | ✓ |

### G.5 Gaps

| # | What broke | Minimal fix |
|---|---|---|
| G1 | No **Batch** object: a 600 kg machine batch across two owners is split into J_F and J_M by hand; the 276/276 split is an allocation, but the output line has no basis, so M's 8.00 % "loss" looks measured and feeds M's learned norm. | D-private `batch_id` on output events + `qty_basis: weighed \| allocated(pro_rata_input)`; norms ignore allocated losses (or weight them down). |
| G2 | Lot lineage leaks across owners: `D-5010.parent_lot_ids = [GF-17, GM-22]` tells F that M had fabric in its lot. Same leak downstream (R1 tracing a garment lot to F's grey lot in I). | Lineage edges are visibility-filtered (show only parents the viewer may see), or the dyer's output lot is split per owner (`D-5010/F`, `D-5010/M`) with the batch as a private grouping. |
| G3 | `rate`/`value` live on the movement line; §7 makes a movement visible to its physical parties, so custodian D would see Y's ₹330/kg sale price. | Field-level visibility: line rate/value visible only to seller and buyer (or job parties). |
| G4 | §4.2 posts outputs at declaration but reduces inputs only at closure, so between output and closure raw `Σ holdings` at D is 1,558.0 grey + 1,433.5 finished = 2,991.5 kg for 1,433.5 kg physically present. Views must use the estimate; anything summing holdings (global invariant §5.5, Claire "how much do I hold") double counts. | At each output, post estimated consumption `al(J) → CONSUMED_EST(J)` (o ÷ expected yield); true-up at closure. |

---

## H. Leftovers: returned vs kept-and-adjusted (+ H2 forgotten 10 months)

### H.1 Setup

| Party | Kind | Role |
|---|---|---|
| FA (father's unit) | Business, GST-registered | principal |
| S1 | Business, registered | performer J_H |
| WT (waste trader) | **Contact of S1** (off-platform) | buyer of banian waste |
| CU "Selvam Cutting" (H2) | **Contact of FA**, unregistered | performer J_CU |

| Spec | | Unit |
|---|---|---|
| PK / PKZ | Polo kit FP-220 navy, button placket / zip placket (matrix collapsed) | pc |
| PO / POZ | Polo FP-220 / FP-220Z navy | pc |
| THR | Thread Tex 27 navy; cone = 5,000 m (label) | cm, shown m |
| BTN | Button 4-hole 18L navy; gross = 144 | pc |
| ZIP | Zip #3 6″ navy | pc |
| WST | Waste · cotton cut bits (banian waste) | g |
| FAB (H2) | Finished SJ 180 GSM navy, lot D-4410 | g |

Job **J_H**: stitching (assembling, per_good_output_piece ₹18), FA → S1, issued Mon 5 Oct, expected 5 Oct + 6 working days = **Mon 12 Oct**. BOM: thread 158 m/pc; buttons 3/pc (PK only); zip 1/pc (PKZ only).

### H.2 Events (H)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| H1 | 5 Oct | `job_work_out` MV-H1 FA→S1 (DC 0311), J_H | FA (self); S1 (account) | PK 1,400; PKZ 600; THR 64 cone = 320,000 m; BTN 31 gross = 4,464; ZIP 615 | each: `[·\|FA/FA/–\|av] → it → [·\|FA/S1/–\|al(J_H)]` |
| H2 | 12 Oct | J_H output | S1 (account) | PO·A 800; POZ·A 400 | `+800 [PO·A\|FA/S1/–\|av]`, `+400 [POZ·A\|…]` |
| H3 | 12 Oct | `job_work_return` MV-H2 S1→FA | S1; FA (account) | PO·A 800; POZ·A 400 | `→ it → [·\|FA/FA/–\|av]` |
| H4 | 15 Oct | J_H output + by-product + trim scrap | S1 (account) | PO·A 586, PO·reject 14; POZ·A 194, POZ·reject 6; **by-product** WST 6.0 kg; scrap BTN 24, ZIP 1 | outputs `+` at `[·\|FA/S1/–\|av]`; `+6,000 g [WST\|FA/S1/–\|av]` (inflow, not in any input line ⟨gap H2⟩); `[BTN\|FA/S1/–\|al(J_H)] 24 → WRITTEN_OFF(scrap_input)`; ZIP 1 same |
| H5 | 15 Oct | `job_work_return` MV-H3 S1→FA | S1; FA (account) | PO·A 586, PO·rej 14, POZ·A 194, POZ·rej 6 | `→ [·\|FA/FA/–\|av]` |
| H6 | 16 Oct | Leftover declared (count by S1); dispositions agreed in deal room | S1 (account); FA accepts | THR ~4,200 m (3 partial cones, by weight); BTN 240; ZIP 14 | none (still al(J_H)) |
| H7 | 17 Oct | `job_work_return` MV-H4 S1→FA, line_kind `leftover` | S1 sent (account) THR 4,200 m; FA received (account, weighed) THR 4,150 m (−1.19 %, ≤ 1.5 % — tolerance class assumed ⟨gap H4⟩); BTN 240 = 240 | THR 4,200 m; BTN 240 | THR: `[·\|FA/S1/–\|al(J_H)] 4,200 → it(MV-H4)`; `it → [THR\|FA/FA/–\|av] 4,150` + `LOSS(weighing_difference→FA) 50 m`. BTN `240 → [·\|FA/FA/–\|av]` |
| H8 | 17 Oct | Leftover **kept-and-adjusted**: `sale_in_place` FA→S1, ₹6/pc, **taxable flag** (supply by FA) | FA (account); S1 (account) | ZIP 14 | `[ZIP\|FA/S1/–\|al(J_H)] → [ZIP\|S1/S1/–\|av]`; bill deduction ₹84 |
| H9 | 17 Oct | By-product **sold from S1's premises** to WT, ₹70/kg, credited to FA; **taxable flag**; purpose ⟨gap H1⟩ | S1 sent (self); WT received (on_behalf) | WST 6.0 kg | `[WST\|FA/S1/–\|av] 6,000 g → SOLD(WT)` (S1's ledger also `+[WST\|WT/WT]`, S1-only); credit ₹420 |
| H10 | 18 Oct | Closure J_H | FA reviews; S1 | — | PK 1,400 → CONSUMED; PKZ 600 → CONSUMED; THR 320,000 − 4,200 = **315,800 m** → CONSUMED (est 316,000, residual −200 m); BTN 4,464 − 24 − 240 = 4,200 → CONSUMED; ZIP 615 − 1 − 14 = 600 → CONSUMED. Bill final. |

Lateness: expected 12 Oct, pending > 0 on 13–14 Oct, last receipt 15 Oct → **late** (2 working days); turnaround to last receipt 10 days, first receipt 7 days.

### H.2b Events (H2 — 20 kg forgotten at a cutting unit)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| H2-1 | 15 Jan 2026 | `job_work_out` FA→CU (DC 0412), J_CU cutting (unit_changing, per_output_piece ₹4) | FA (self); CU received (link) | FAB·D-4410 500.0 kg | `[FAB\|FA/FA/–\|av] → it → [FAB\|FA/CU/–\|al(J_CU)]` |
| H2-2 | 21 Jan | J_CU outputs (implied by FA's receipt) + by-product | FA (self) | tee kits 2,000 pc (BOM avg 210 g/pc); WST 52.0 kg | `+2,000 [KIT\|FA/CU/–\|av]`; `+52,000 g [WST\|FA/CU/–\|av]` |
| H2-3 | 22 Jan | `job_work_return` CU→FA | FA received (self); CU sent (link) | kits 2,000; WST 52.0 kg | `→ [·\|FA/FA/–\|av]` |
| H2-4 | 22 Jan | Leftover 20.0 kg end rolls, disposition **kept_for_next** | FA (self; CU told by phone) | FAB 20.0 kg | `[FAB\|FA/CU/–\|al(J_CU)] → [FAB\|FA/CU/–\|av]` |
| H2-5 | 25 Jan | Closure J_CU | FA | — | `al(J_CU)` 480.0 kg → CONSUMED(J_CU); stored: est in kits 420.0, by-product 52.0, residual 8.0 (1.6 %). Bill 2,000 × ₹4 = ₹8,000 |
| H2-6 | **11 Nov 2026 (day 300)** | GST 1-year alert: "20.0 kg at Selvam Cutting since DC 0412 (15 Jan). Becomes a deemed supply dated 15 Jan 2026 if not back by 15 Jan 2027. At risk ≈ ₹340 tax (5 % on ₹6,800 at ₹340/kg) + ≈ ₹61 interest (18 % p.a. × 1 yr), +₹0.17/day after." Model as written: **does not fire** — J_CU is closed and the clock is on "open job-work input lines" ⟨gap H3⟩. Shown here with the proposed fix. | system | — | none |
| H2-7 | 26 Nov 2026 (day 315) | `job_work_return` CU→FA (leftover) | FA received (self, weighed 19.8 kg); CU no assertion | FAB 20.0 kg book / 19.8 kg weighed | Model as written (receiver-only ⇒ s = r): `[FAB\|FA/CU/–\|av] 19.8 → it → [FAB\|FA/FA/–\|av] 19.8` — **leaves 0.2 kg at CU forever** ⟨gap H4⟩. With fix (`sent = whole holding`): s = 20.0, r = 19.8 → `LOSS(weighing_difference→FA) 0.2` (1.0 %, within tol). Clock stops. |

### H.3 Participant views

**FA** — moments t1 = 12 Oct (after MV-H2), t2 = 16 Oct (leftovers declared), t3 = 18 Oct (closed); t4 = 11 Nov 2026 (H2 alert)

| | Owned @ own | Owned @ others | Jobs | Flags | Bill (FA→S1) |
|---|---|---|---|---|---|
| t1 | PO A 800 · POZ A 400 | S1: PK pending 600, PKZ pending 200; trims raw THR 320,000 m (est used 189,600) · BTN 4,464 (est used 2,400) · ZIP 615 (est used 400) | J_H due today | due today | 1,200 × 18 = ₹21,600 |
| t2 | PO A 1,386 + rej 14 · POZ A 594 + rej 6 | S1: THR ~4,200 m · BTN 240 · ZIP 14 · WST 6.0 kg | J_H completed (no pending) | **late** 2 working days; 2 taxable events pending decision | 1,980 × 18 = ₹35,640 |
| t3 | + THR 4,150 m · BTN 240 | — | J_H closed | accountant flags: ZIP kept (₹84), waste sold from S1 premises (₹420); thread residual −200 m (BOM high) | **₹35,640 − 84 − 420 = ₹35,136** due to S1 |
| t4 | — | CU: FAB 20.0 kg (since 15 Jan) | — | **day-300 GST alert**, ₹≈401 at risk | — |

Must NOT see: WT's identity/phone (S1's contact) — FA sees "sold to a waste buyer by S1" (same disclosure issue as F1).

**S1**

| | Owned | Held for FA | Bills (from FA) |
|---|---|---|---|
| t1 | — | PK 600 · PKZ 200 pending; trims raw as above | ₹21,600 |
| t2 | — | THR ~4,200 m · BTN 240 · ZIP 14 · WST 6.0 kg | ₹35,640 |
| t3 | ZIP 14 (own stock now) | — | ₹35,136 net; waste sale ₹420 is S1's taxable supply if S1 is seller under s.143(5) |

Must NOT see: FA's stock at other units (CU), FA's GST alerts.

**WT**: contact of S1, no view (could see S1's statement link line "6 kg waste, 17 Oct").

**CU** (statement link FA↔CU): t4 "Open with you: 20.0 kg navy SJ since 15 Jan — Return / Differs"; must NOT see FA's tax-at-risk numbers or FA's other units.

### H.4 Balance check

| Line | Equation | Numbers | |
|---|---|---|---|
| MV-H1 … MV-H3 | sent = received | all equal | ✓ |
| MV-H4 THR | sent = received + weighing | 4,200 = 4,150 + 50 m | ✓ |
| J_H · PK | issued = outputs | 1,400 = 1,386 A + 14 rej | ✓ |
| J_H · PKZ | | 600 = 594 A + 6 rej | ✓ |
| J_H · THR (secondary) | issued = consumed est + leftover returned + residual | 320,000 = 316,000 (2,000 × 158) + 4,200 + **(−200)** | residual −200 m (−0.06 %) |
| J_H · BTN | issued = consumed + scrapped + leftover returned + residual | 4,464 = 4,200 (1,400 × 3) + 24 + 240 + 0 | ✓ |
| J_H · ZIP | issued = consumed + scrapped + leftover kept_adjusted | 615 = 600 + 1 + 14 | ✓ |
| WST (by-product) | inflow = sold | 6.0 = 6.0 kg | ✓ |
| Bill | 1,980 × 18 − 14 × 6 − 6 × 70 | 35,640 − 84 − 420 = 35,136 | ✓ |
| J_CU · FAB (unit_changing) | issued = est in output + by_product + leftover(kept_for_next) + residual | 500.0 = 420.0 + 52.0 + 20.0 + 8.0 | residual 8.0 (1.6 %) |
| H2 return (with fix) | sent = received + weighing | 20.0 = 19.8 + 0.2 | ✓ |

### H.5 Gaps

| # | What broke | Minimal fix |
|---|---|---|
| H1 | "Sold from premises" is in §4.2 but **not a purpose** in §3.4.1; the seller (S1 under s.143(5)) is neither `owner_before` (FA) nor the buyer; how the ₹420 credit reaches FA's bill is not stated; WT is S1's private contact yet FA owns the line. | Purpose `sale` with `seller ≠ owner_before` allowed when `sold_by_job_worker` flag set; proceeds create a bill credit on the job; buyer shown to the owner as "waste buyer (S1's)" unless shared. |
| H2 | A by-product in a dimension no input line has (6 kg waste from pc kits) appears in no §5.2 line equation. | State: by-products of a different dimension are **job outputs** (inflows under §5.5), not an input-line bucket. |
| H3 | §11 attaches the 1-year clock to "each **open** job-work input line". Leftover `kept_for_next` leaves `al(J)` and J_CU closes, so the 20 kg loses its clock — the H2 alert never fires. | Clock belongs to every holding where `owner ≠ custodian` and owner is registered, inheriting the originating DC date(s) (spec+lot match first, FIFO tie-break) regardless of job status. |
| H4 | (a) Receiver-only return posts s = r (19.8), leaving a 0.2 kg stub at CU forever. (b) §9.3 tolerance covers "weighed" and "counted", not lengths estimated from weight (thread 4,200 vs 4,150 m). | (a) `sent = whole_holding` option for "return all" recorded by the receiver. (b) Tolerance class follows the **factor source** (`weighed` → weighed band). |

---

## I. One order from two dye lots

### I.1 Setup

| Party | Kind | Role |
|---|---|---|
| M | Business, registered | buyer of fabric, cutter (in-house), principal, seller |
| F | Business | fabric seller |
| D | Business | dyer that created lots D-4471/D-4502 for F earlier (appears only via lineage) |
| S3 | Business | stitcher |
| R1 | Business | retailer; Order O-R1 1,000 navy polos @ ₹260 |

Run **RN-I** "1,000 navy polos for R1" (owner M). Order O-R1 sale 1,000 (S/M/L/XL 200/300/300/200).

| Spec | | Lots |
|---|---|---|
| FP | Finished pique 220 GSM 72″ open navy cotton | D-4471 (150.0 kg), D-4502 (90.0 kg; note "visibly lighter") |
| KIT·s | Cut kit polo NP-220 navy, size s | K-4471, K-4502 (parents D-4471 / D-4502) |
| PO·s | Polo NP-220 navy, size s | G-4471, G-4502 |
| WST | Cut waste cotton | – |

Consumption snapshot (g/pc): S 190 · M 200 · L 210 · XL 220. Stitching J_S3: assembling, ₹16/good pc.

### I.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| I1 | 1 Dec | `sale` MV-I1 F→M (O-F ₹360/kg) | F sent (account); M received (account) | FP·D-4471 150.0 kg | `[FP·D-4471\|F/F/–\|av] → it → [·\|M/M/–\|av]` |
| I2 | 3 Dec | `sale` MV-I2 F→M; M records lot note "lighter shade" | F; M (account) | FP·D-4502 90.0 kg | same |
| I3 | 4 Dec | In-house cutting job JC-a (performer self): issue, outputs, by-product, closure | M (self) | in FP·D-4471 150.0 kg → out KIT·K-4471 S124 M186 L186 XL124 = 620; WST 19.0 kg | `[FP·D-4471\|M/M\|av] → al(JC-a)` 150.0; `+620 KIT`; `+19.0 kg WST`; closure `al 150.0 → CONSUMED(JC-a)` (est in kits 127.1, residual 3.9) |
| I4 | 5 Dec | Cutting JC-b | M | in FP·D-4502 90.0 → out KIT·K-4502 S76 M114 L114 XL76 = 380; WST 11.2 kg | as I3; est 77.9, residual 0.9 |
| I5 | 6 Dec | `job_work_out` MV-I3 M→S3, J_S3; 8 lines (bundles by lot × size). §10.5 **lot-mixing warning fires** (J_S3 inputs span two lots of the same spec) — false positive; M overrides "separate bundles" ⟨gap I1⟩ | M (self); S3 (account) | KIT·K-4471 124/186/186/124; KIT·K-4502 76/114/114/76 | `[KIT·lot·s\|M/M\|av] → it → [·\|M/S3/–\|al(J_S3)]` |
| I6 | 9 Dec | J_S3 output (lot G-4471) + `job_work_return` MV-I4 | S3 (account); M (account) | PO·G-4471·A S123 M184 L184 XL123 = 614; ·reject S1 M2 L2 XL1 = 6 | `+` at `[PO\|M/S3/–\|av]` → it → `[PO\|M/M/–\|av]` |
| I7 | 11 Dec | J_S3 output (G-4502) + MV-I5 | S3; M | PO·G-4502·A 75/113/113/75 = 376; ·reject 1/1/1/1 = 4 | same |
| I8 | 11 Dec | Closure J_S3 | M, S3 | — | KIT lines 1,000 → CONSUMED(J_S3); output 990 A vs plan 1,000 (−10 shown) |
| I9 | 12 Dec | Packing: carton C-31 (size M, 24 pcs) filled with 16 × G-4471 + 8 × G-4502 (184 M = 7 × 24 + 16). **Not representable**: no carton contents in the model, so no warning ⟨gap I2⟩. With fix: warning, packer repacks C-31 as 16 + C-32 as 8. | M (self) | — | none |
| I10 | 13 Dec | `sale` MV-I6 M→R1 (O-R1), lot-aware | M (account); R1 (account) | PO·G-4471·A 123/184/184/123 = 614 | `[PO·G-4471\|M/M\|av] → it → [·\|R1/R1/–\|av]` |
| I11 | 14 Dec | `sale` MV-I7 M→R1 | M; R1 | PO·G-4502·A 75/113/113/75 = 376 | same |

### I.3 Participant views

Moments: t1 = 5 Dec (cut) · t2 = 9 Dec (half back) · t3 = 14 Dec (dispatched).

| Participant | t1 | t2 | t3 | Must NOT see |
|---|---|---|---|---|
| **M** | own: KIT K-4471 620 · K-4502 380 · WST 30.2 kg; flags: shade note on D-4502; cutting residual 3.9 kg (2.6 %), 0.9 kg (1.0 %); fabric not in panels 15.3 % / 13.4 % (within 8–18 %) | own: PO G-4471 A 614 + rej 6; at S3: KIT K-4502 380 (al J_S3); flag: lot-mix warning (overridden) | own: rej 10 (S2 M3 L3 XL2), WST 30.2 kg; O-R1 990/1,000 (−10); bills: to S3 990 × 16 = ₹15,840; from R1 990 × 260 = ₹257,400; to F 240 × 360 = ₹86,400 | — |
| **F** | sold M 150.0 + 90.0 kg = ₹86,400 | — | — | M's cutting, S3, R1 |
| **D** | nothing (made the lots for F's job earlier) | — | — | anything at M, S3, R1 |
| **S3** | — | held for M: KIT K-4502 380 (per size); J_S3 pending 380 | J_S3 closed; due from M ₹15,840 | fabric price, R1, lineage to F/D |
| **R1** | — | — | own: PO G-4471 614, G-4502 376 (per size, lot on each line → shelves kept apart); O-R1 990 of 1,000 | lineage to D/F ⟨gap G2⟩, M's costs, S3 |

### I.4 Balance check

| Line | Equation | Numbers | |
|---|---|---|---|
| MV-I1, MV-I2 | sent = received | 150.0 = 150.0; 90.0 = 90.0 | ✓ |
| JC-a (unit_changing) | issued = est + by_product + residual | 150.0 = 127.1 (124×190 + 186×200 + 186×210 + 124×220 = 127,100 g) + 19.0 + 3.9 | residual 3.9 |
| JC-b | | 90.0 = 77.9 (76×190 + 114×200 + 114×210 + 76×220 = 77,900 g) + 11.2 + 0.9 | residual 0.9 |
| J_S3 · K-4471 per size | issued = outputs | S 124 = 123+1 · M 186 = 184+2 · L 186 = 184+2 · XL 124 = 123+1 | ✓ |
| J_S3 · K-4502 per size | | S 76 = 75+1 · M 114 = 113+1 · L 114 = 113+1 · XL 76 = 75+1 | ✓ |
| MV-I3 … MV-I7 | sent = received | 1,000; 620; 380; 614; 376 | ✓ |
| Output vs plan (§5.3) | 990 A vs 1,000 | under by 10 (rejects) | shown |

### I.5 Gaps

| # | What broke | Minimal fix |
|---|---|---|
| I1 | §10.5 warns when "one job's inputs … span lots of the same spec" — fires on J_S3 although bundles are lot-pure; the real risk (one garment or carton from two lots) is at the **output** level. | Move the check to lineage: warn when an output lot (garment, kit, carton) would have parents of the same spec from different lots. |
| I2 | No package/carton contents in the model (`transport.packages` is a count). "Don't mix lots in one carton" can't be checked or shown to R1, unless cartons become specs via a packing job — which forces R1 to "unpack" to get pieces. | `packages[] {no, contents: [{line_ref, qty}]}` on movements (and on packing outputs); lot check runs per package. |

---

## J. Partial dispatches and retailer returns

### J.1 Setup

| Party | Kind | Role |
|---|---|---|
| M | Business | seller; principal of rework |
| R1 | Business (on-platform) | buyer O-R1 600 (S100 M200 L200 XL100) |
| R2 | **Contact of M** (Kerala wholesaler, off-platform, statement link) | buyer O-R2 300 (50/100/100/50) |
| R3 | Business | buyer O-R3 102 (ratio 1:2:2:1 = 17/34/34/17) |
| KPN | **Contact of M** (parcel transporter) | custodian in transit to R2 |
| S1 | Business | original stitcher (job J_S1-orig, earlier); performer of rework J_RW |

Spec TEE·s = Tee RN-160 white, size s ∈ {S, M, L, XL}. Price ₹145/pc all sizes. `title_passes = at_dispatch`.
M's stock 1 Oct (A, own godown): S 170 · M 340 · L 340 · XL 180 = 1,030.

### J.2 Events

| # | Date | Event | Recorded by (evidence) | Lines (A unless stated) | Postings |
|---|---|---|---|---|---|
| J1 | 1 Oct | `sale` MV-J1 M→R1 (O-R1), day 1. Packer sent 12 XL in place of L; DC is accurate | M sent (account); R1 received (account) | S60 M140 L128 XL72 = 400 | `[TEE·s\|M/M/–\|av] → [·\|R1/M→R1\|it] → [·\|R1/R1/–\|av]` |
| J2 | 2 Oct | `sale` MV-J2 M→R2 via KPN (LR) | M (account) | S50 M100 L100 XL50 = 300 | `[·\|M/M\|av] → [·\|R2/KPN/–\|it(MV-J2)]` (owner R2 at dispatch, custodian transporter) |
| J3 | 3 Oct | `sale` MV-J3 M→R3 | M; R3 (account) | 17/34/34/17 = 102 | `→ [·\|R3/R3/–\|av]` |
| J4 | 5 Oct | R2 confirms MV-J2 | R2 (link "Received OK") | 300 | `it(MV-J2) → [·\|R2/R2/–\|av]` |
| J5 | 8 Oct | `sale` MV-J4 M→R1, day 8 | M; R1 (account) | S40 M60 L60 XL40 = 200 | as J1. O-R1 now S100 M200 **L188 XL112** → order flag L −12 / XL +12 |
| J6 | 18 Oct | `return` MV-J5 R1→M (sales return; owner R1→M). M receives defectives into `hd(qc)` (not in posting rule ⟨gap J1⟩) | R1 sent (account); M received (account) | XL 12 (wrong size); S2 M4 L4 XL2 (defective, line grade A + note ⟨gap J1⟩) | XL 12: `[·\|R1/R1\|av] → it → [·\|M/M\|av]`; 12 defective: `→ [·\|M/M\|hd(qc)]` |
| J7 | 18 Oct | `sale` MV-J6 M→R1 (exchange; linked only via O-R1) | M; R1 received 19 Oct (account) | L 12 | `[L\|M/M\|av] → it → [L\|R1/R1\|av]` |
| J8 | 19 Oct | In-house checking job JK (count_preserving, performer self) used as **regrade** ⟨gap J1⟩ | M (self) | in: S2 M4 L4 XL2 (hd qc) = 12 → out B: S2 M3 L2 XL1 = 8; rework: M1 L2 XL1 = 4 | `hd(qc) 12 → al(JK) → CONSUMED(JK)`; `+8 [TEE·B\|M/M\|av]`, `+4 [TEE·rework\|M/M\|av]` |
| J9 | 20 Oct | `job_work_out` MV-J7 M→S1, new job J_RW (alteration, rework_of J_S1-orig, ₹0) | M (self); S1 (account) | rework M1 L2 XL1 = 4 | `[·rework\|M/M\|av] → it → [·rework\|M/S1/–\|al(J_RW)]` |
| J10 | 23 Oct | J_RW output + `job_work_return` MV-J8 S1→M; closure J_RW | S1; M (account) | A M1 L2 XL1 = 4 | `+4 [TEE·A\|M/S1\|av] → it → [·\|M/M\|av]`; `al(J_RW) 4 → CONSUMED(J_RW)` |

### J.3 Participant views

Moments: t1 = 8 Oct (all dispatched) · t2 = 19 Oct (returns, exchange, regrade) · t3 = 23 Oct (rework back).

**M**

| | Owned @ own | Owned @ others | Orders | Flags | Receivables |
|---|---|---|---|---|---|
| t1 | A S3 M6 L18 XL1 = 28 | — | O-R1 600/600 (L 188/200, XL 112/100); O-R2 300 (link); O-R3 102 | size mismatch on O-R1 | R1 ₹87,000 · R2 ₹43,500 · R3 ₹14,790 |
| t2 | A S3 M6 L6 XL13 = 28 · B S2 M3 L2 XL1 = 8 · rework M1 L2 XL1 = 4 | — | O-R1 net 588 (S98 M196 L196 XL98); 12 credited | O-R1 short 12 vs order (defectives not replaced) | R1 588 × 145 = **₹85,260** (credit ₹1,740 for 12 defective; exchange nets ₹0) |
| t3 | A S3 M7 L8 XL14 = 32 · B 8 | — | — | — | unchanged |

(Between t2 and t3, rework 4 is at S1 under J_RW.) Must NOT see: R-side resale.

**R1**

| | Owned @ own | Orders | Must NOT see |
|---|---|---|---|
| t1 | S100 M200 L188 XL112 = 600 | O-R1: L short 12, XL over 12 | R2/R3 shipments, M's stock, S1 |
| t2 | S98 M196 L196 XL98 = 588 | returns 24 (12 exchanged, 12 credited); payable ₹85,260 | same |

**R2** (link): "300 pcs from M, sent 2 Oct via KPN, LR …: you confirmed 5 Oct". No prices unless M shares. Must NOT see: R1/R3, M's stock.
**R3**: owned 17/34/34/17 = 102; payable ₹14,790. Must NOT see: R1/R2.
**S1**: 20–23 Oct held for M: rework M1 L2 XL1 (J_RW, ₹0, rework_of its own job). Must NOT see: R1 or why returned beyond the job note.
**KPN** (contact): no view.

### J.4 Balance check

| Line | Equation | Numbers | |
|---|---|---|---|
| MV-J1 … MV-J8 | sent = received | 400; 300; 102; 200; 24; 12; 4; 4 | ✓ |
| M per size (S) | stock − out + back | 170 − 60 − 50 − 17 − 40 + 2 = 5 → A 3 + B 2 | ✓ |
| M per size (M) | | 340 − 140 − 100 − 34 − 60 + 4 = 10 → A 6 + B 3 + rework 1 → A 7, B 3 | ✓ |
| M per size (L) | | 340 − 128 − 100 − 34 − 60 + 4 − 12 = 10 → A 6 + B 2 + rework 2 → A 8, B 2 | ✓ |
| M per size (XL) | | 180 − 72 − 50 − 17 − 40 + 12 + 2 = 15 → A 13 + B 1 + rework 1 → A 14, B 1 | ✓ |
| M total | 1,030 − 1,002 − 12 + 24 = 40 | A 32 + B 8 = 40 | ✓ |
| R1 per size | | S 60+40−2 = 98 · M 140+60−4 = 196 · L 128+60−4+12 = 196 · XL 72+40−12−2 = 98 → 588 | ✓ |
| JK (count_preserving) | issued = outputs | 12 = 8 B + 4 rework | ✓ |
| J_RW | | 4 = 4 A | ✓ |
| Bill R1 | (400 + 200 + 12 − 24) × 145 | 588 × 145 = 85,260 | ✓ |

### J.5 Gaps

| # | What broke | Minimal fix |
|---|---|---|
| J1 | **Regrade** has no event: a return line carries one grade, which must match the sender's holding (R1 holds A), so "defective" can only be a note; the receiver posting rule (§4.1) allows only `available` or `allocated`, not `held(qc)`; turning 12 A into 8 B + 4 rework needed a full in-house checking job. | Adjustment kind `regrade` (same key except grade, net zero, reason, recorder); allow receiver to post into `held(reason)`. |

(Exchange works as two movements on the same order; no gap beyond an optional `exchange_of` link for display.)

---

## K. Two scales disagree

### K.1 Setup

| Party | Kind | Role |
|---|---|---|
| F | Business | principal |
| D | Business (main) / **Contact of F** (variant K-off) | performer J_K |

Specs: GSJ = Grey SJ 160 GSM 30″ tubular, lot G-21 (F); FSN = Finished SJ navy, lot D-4520. Job J_K dyeing navy (mass_losing, per_input_mass ₹85/kg, norm 8 %), issued Mon 14 Sep (7-day cal., 7 d → 21 Sep; second issue 16 Sep → 23 Sep — which one? ⟨gap K2⟩). Tolerance ±1.5 % (weighed).

### K.2 Events (both on platform)

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| K1 | 14 Sep | `job_work_out` MV-K1 F→D (DC 0731) | F sent 500.0 (self) | GSJ·G-21 500.0 kg | `[GSJ\|F/F/–\|av] 500.0 → [GSJ\|F/F→D\|it(MV-K1)]` |
| K2 | 14 Sep | D receives 488.0; s − r = 12.0 > 7.5 (1.5 % of 500) → **Discrepancy DQ-1** (qty_mismatch) opens with positions F 500.0 / D 488.0 | D (account) | 488.0 | `it → [GSJ\|F/D/–\|al(J_K)] 488.0`; `it → [GSJ\|F/?/–\|dsp(DQ-1)] 12.0` (custodian undefined ⟨gap K1⟩) |
| K3 | 16 Sep | MV-K2 F→D 300.0; D receives 297.0; 3.0 ≤ 4.5 → weighing difference, no discrepancy | F (self); D (account) | 300.0 / 297.0 | `[·\|F/F\|av] 300.0 → it`; `it → al(J_K) 297.0`; `it → LOSS(weighing_difference→F) 3.0` |
| K4 | 17 Sep | DQ-1: F proposes `accept_receiver`; D accepts → resolved | F, D (account) | — | `dsp(DQ-1) 12.0 → LOSS(shortage→F)`. *Alt. split at 494.0:* `dsp 6.0 → al(J_K)` + `6.0 → LOSS(→F)` |
| K5 | 21 Sep | J_K output + `job_work_return` MV-K3 D→F | D output & sent 449.0 (account); F received 448.2 (account; −0.18 %) | FSN·D-4520 449.0 | `+449.0 [FSN\|F/D\|av] → it`; `it → [FSN\|F/F\|av] 448.2` + `LOSS(weighing_difference) 0.8` |
| K6 | 24 Sep | J_K output + MV-K4 | D 273.2; F 273.2 | FSN·D-4520 273.2 | `+273.2 … → [FSN\|F/F\|av] 273.2` |
| K7 | 25 Sep | Closure J_K. **Issued basis undefined** ⟨gap K2⟩: received/agreed basis 785.0 → loss 62.8 (8.0 %), bill ₹66,725; sent basis 800.0 → loss 77.8 (9.73 %, may trip abnormal band) and bill ₹68,000, while 15.0 kg is already in transit loss buckets (double count) | F reviews; D | — | `al(J_K) 785.0 → CONSUMED(J_K)`; stored output 722.2, loss 62.8 |

### K.2b Variant K-off (D is F's contact)

| # | Date | Event | Recorded by (evidence) | Postings / effect |
|---|---|---|---|---|
| K1′ | 14 Sep | MV-K1 F→D 500.0 | F (self) | as K1 |
| K2′ | 14 Sep | D taps "Quantity differs: 488" on F's statement link | D (link) — badge "Confirmed by link" (weaker) | as K2; DQ-1 visible in F's app; on the link D sees "You said 488, F said 500 — being checked" |
| K4′ | 17 Sep | F concedes (accept D's 488). §6.3 requires "other accepts", but the link has no "accept proposal" action and a concession should not need one ⟨gap K3⟩ | F (self) | as K4 only if the concession resolves unilaterally |
| K3′ | 16 Sep | D taps "Quantity differs: 297" | D (link) | within tol → weighing difference, no discrepancy |

### K.3 Participant views

Moments: t1 = 14 Sep (after K2) · t2 = 17 Sep (resolved, both dispatches in) · t3 = 25 Sep (closed).

| | **F** | **D** |
|---|---|---|
| t1 | owned @ D: GSJ 488.0 (al J_K) + **12.0 disputed** (DQ-1, −2.4 %); D's figure "Confirmed" (account; "by link" in K-off) | held for F: GSJ 488.0; DQ-1 open (F 500.0 / D 488.0) |
| t2 | @ D: 785.0 (al J_K); losses: shortage 12.0 (resolved), weighing 3.0; J_K due 21/23 Sep | held for F: 785.0 |
| t3 | own: FSN 721.4; J_K closed, loss 62.8 (8.0 %); bill to D ₹66,725; weighing diff on return 0.8 | nothing held for F; due from F ₹66,725 |

Must NOT see (both): any other principal's goods at D; in K-off, D (link) sees only lines between F and D, no prices unless shared.

### K.4 Balance check

| Line | Equation | Numbers | |
|---|---|---|---|
| MV-K1 | sent = received + weighing + disputed + in_transit | 500.0 = 488.0 + 0 + 12.0 + 0 → after DQ-1: 12.0 → LOSS(shortage) | ✓ |
| MV-K2 | | 300.0 = 297.0 + 3.0 | ✓ |
| MV-K3 | | 449.0 = 448.2 + 0.8 | ✓ |
| MV-K4 | | 273.2 = 273.2 | ✓ |
| J_K (received basis) | issued = outputs + loss | 785.0 = 722.2 (449.0 + 273.2) + 62.8 | ✓ (8.0 %) |
| F global GSJ | sent = consumed + shortage + weighing | 800.0 = 785.0 + 12.0 + 3.0 | ✓ |
| F global FSN | outputs = held + weighing | 722.2 = 721.4 + 0.8 | ✓ |

### K.5 Gaps

| # | What broke | Minimal fix |
|---|---|---|
| K1 | §4.1 posts `+(s−r) H(…, disputed(D))` without saying who is **custodian** (and owner after title passes) of the disputed quantity — it may not exist. | Disputed holding keeps the in-transit key (`custodian = from→to`), state `dsp`; views show it on both sides as "in dispute". |
| K2 | Job **issued basis** is undefined (sent 800.0 vs received 785.0): loss 9.73 % vs 8.0 %, bill ₹68,000 vs ₹66,725, and transit losses double counted under sent basis. Likewise output basis (performer's sent vs principal's received) and expected date with two issue dates. | Issued = received (post-resolution) quantity; output = performer's declaration (sender side); expected date per issue line (job shows latest). |
| K3 | §6.3 needs "other accepts" even when a party concedes to the other's figure; an off-platform counterparty (link) has no accept/decline action for proposals. | A party may resolve in the other's favour unilaterally; add "accept / decline" for proposals on the statement link. |

---

## L. Off-platform counterparty joins later

### L.1 Setup

| Party | Kind | Role |
|---|---|---|
| FA (father's unit) | Business | principal; recorded 15 movements |
| MD(c) "Murugan Dyeing" | **Contact of FA** (name + phone), statement link FA↔MD | performer, pre-link |
| MDB | Murugan's **Business** — trial account 27 Oct (demo OTP, unverified), real phone verification 20 Nov | performer after link |
| FA(c) | **Contact of MDB** for father (created in the trial) | — |

Specs: GSJ = grey SJ 160 GSM (lots unlabelled); FS = finished SJ (navy / black / maroon per job). Rate FA↔MD ₹85/kg per input (FA's rate card). Dyeing norm 8 %.

| Job | Out (date, kg) | Returns (date, kg) |
|---|---|---|
| J1 | 22 Sep 300.0 | 28 Sep 150.0 · 1 Oct 126.0 |
| J2 | 26 Sep 250.0 | 3 Oct 120.0 · 6 Oct 108.0 |
| J3 | 10 Oct 400.0 | 18 Oct 200.0 · 21 Oct 168.0 |
| J4 | 28 Oct 200.0 | 4 Nov 100.0 · 6 Nov 84.0 |
| J5 | 12 Nov 350.0 | 17 Nov 180.0 · *(23 Nov 142.0, post-link)* |
| J6 | 18 Nov 280.0 | *(26 Nov 257.6, post-link)* |

Pre-link movements: J1–J4 × 3 + J5 × 2 + J6 × 1 = **15**.

### L.2 Events

| # | Date | Event | Recorded by (evidence) | Lines | Postings |
|---|---|---|---|---|---|
| L1–L3 | 22 Sep / 28 Sep / 1 Oct | J1 out; 2 returns | FA (self); out confirmed by MD via link 23 Sep; returns receiver-only | GSJ 300.0; FS 150.0; FS 126.0 | out: `[GSJ\|FA/FA\|av] → it → [·\|FA/MD(c)/–\|al(J1)]`; returns: implied output `+[FS\|FA/MD(c)\|av]` → it → `[FS\|FA/FA\|av]` (s = r provisional) |
| L4–L6 | 26 Sep / 3 Oct / 6 Oct | J2 | same pattern | 250.0; 120.0; 108.0 | same |
| L7–L9 | 10 / 18 / 21 Oct | J3 | same | 400.0; 200.0; 168.0 | same |
| T1 | 27 Oct | MDB trial account created (demo OTP); MDB creates contact FA(c) | MDB | — | none |
| L10 | 28 Oct | J4 out. **No receiver assertion** on FA's record (Murugan used his trial app, not the link) → stays `it` "at receiver, unconfirmed" | FA (self) | GSJ 200.0 | `[GSJ\|FA/FA\|av] → it(L10)`; model leaves it in transit forever ⟨gap L6⟩ |
| T2 | 28 Oct | MDB trial: receipt from FA(c), own job J4′ | MDB (self) | GSJ 199.2 | in MDB's books: `→ [GSJ\|FA(c)/MDB/–\|al(J4′)] 199.2` |
| L11 | 4 Nov | J4 return 1 | FA received (self) | FS 100.0 | implied output 100.0 (s = r) → `[FS\|FA/FA\|av]` |
| T3 | 4 Nov | MDB trial: output + sent to FA(c) | MDB (self) | FS 100.4 | MDB books: `+100.4 [FS\|FA(c)/MDB\|av] → it` |
| L12 | 6 Nov | J4 return 2 | FA (self) | FS 84.0 | as L11 |
| L13 | 12 Nov | J5 out (unconfirmed by FA's record) | FA (self) | GSJ 350.0 | `→ it(L13)` |
| T4 | 13 Nov | MDB trial: receipt from FA(c) (+1 day) | MDB (self) | GSJ 348.5 | MDB books: `→ al(J5′) 348.5` |
| L14 | 17 Nov | J5 return 1 | FA (self) | FS 180.0 | as L11 |
| L15 | 18 Nov | J6 out | FA (self) | GSJ 280.0 | `→ it(L15)` |
| L16 | 20 Nov | Murugan completes **real** phone verification → MDB verified; contact MD(c) phone matches → **suggested**; MDB **accepts** → `linked` (FA not asked ⟨gap L1⟩). Mirror: FA(c) matches FA → FA accepts. | system; MDB; FA | — | none (nothing rewritten); holding keys still name MD(c) / FA(c) ⟨gap L4⟩ |
| L17 | 20 Nov | 3 **merge suggestions** (same direction, date ±1, same spec family, qty within tol): L10↔T2 (200.0 / 199.2, 0.4 %), L11↔T3 (100.0 / 100.4, 0.4 %), L13↔T4 (350.0 / 348.5, +1 day, 0.43 %). Accepted (by whom? ⟨gap L2⟩); T2, T3, T4 marked `duplicate_of`. Jobs J4′/J5′ not covered ⟨gap L3⟩. Shown **with proposed fix**: the duplicate's own side is folded in as the counterparty assertion (evidence `account`). | MDB, FA | L10 received 199.2; L11 sent 100.4; L13 received 348.5 | L10: `it → al(J4) 199.2` + `LOSS(weighing_difference) 0.8`. L11: implied output +0.4 (100.0 → 100.4), `it → LOSS(weighing) 0.4`. L13: `it → al(J5) 348.5` + `LOSS(weighing) 1.5`. MDB's T2–T4 stop posting; J4′/J5′ retired into J4/J5 (fix). |
| L18 | 20 Nov | MDB confirms J6 out on the shared record | MDB (account) | GSJ 280.0 | `it(L15) → [GSJ\|FA/MDB/–\|al(J6)] 280.0` |
| L19 | 23 Nov | J5 output + return 2 | MDB sent (account); FA received (account) | FS 142.0 | `+142.0 → it → [FS\|FA/FA\|av]` |
| L20 | 26 Nov | J6 output + return | MDB (account); FA (account) | FS 257.6 | same |
| L21 | 26 Nov | Closures J4 (re-closed with merged figures), J5, J6 | FA | — | J4 `al 199.2 → CONSUMED` (out 184.4, loss 14.8); J5 `al 348.5 → CONSUMED` (out 322.0, loss 26.5); J6 `al 280.0 → CONSUMED` (out 257.6, loss 22.4) |

(J1–J3 closed in Oct with link-confirmed inputs: J1 300.0 → 276.0 + 24.0; J2 250.0 → 228.0 + 22.0; J3 400.0 → 368.0 + 32.0.)

### L.3 Participant views

**FA**

| | Owned @ others | Jobs / pending | Flags | Bill to Murugan |
|---|---|---|---|---|
| 19 Nov (pre-link) | "Murugan Dyeing (contact)": J4 out 200.0 **unconfirmed since 28 Oct** (in transit) though 184.0 came back; J5 350.0 unconfirmed, pending est 350.0 − 180.0/0.92 = 154.3; J6 280.0 unconfirmed | J4 cannot close cleanly (input not at performer) ⟨gap L6⟩; J5 due 19 Nov | 3 unconfirmed dispatches | J1–J3 ₹80,750 (25,500 + 21,250 + 34,000); J4 ₹17,000 (sent basis) |
| 20 Nov (linked + merged) | "Murugan Dyeing ✓ linked": J5 348.5 (account), pending est 348.5 − 195.7 = 152.8; J6 280.0 (account) | J4 closed: loss 14.8 (7.43 %) on 199.2 (was 16.0 / 8.0 % on 200.0) | J5 late from 20 Nov (pending > 0) | J4 revised ₹16,932 (199.2 × 85) ⟨gap K2⟩ |
| 26 Nov | — | J5 closed 26.5 (7.60 %); J6 closed 22.4 (8.0 %) | — | J5 ₹29,622.50; J6 ₹23,800 |

Must NOT see (pre-link): MDB's trial records. Post-link: MDB's other customers, MDB's notes.

**Murugan / MDB**

| | What he sees | Held for others |
|---|---|---|
| 23 Sep (contact) | statement link: "300 kg grey from FA, 22 Sep — Confirm / Differs" → confirmed | — |
| 19 Nov (trial, unlinked) | only his own T2–T4 | for "FA (my contact)": J4′ 199.2 in, 100.4 out → pending est 199.2 − 100.4/0.92 = 90.1 (stale: he never recorded the 84.0 return); J5′ 348.5 |
| 20 Nov (after accepting link + merges) | FA's 15 movements naming him, **without** FA's notes; rates hidden unless FA shares ⟨gap L5⟩; his own assertions folded in | for FA: J5 pending est 152.8; J6 280.0 |
| 26 Nov | all returned; bills only if rates shared | — |

Must NOT see: anything of FA's before accepting; after: FA's other dyers, FA's stock elsewhere, FA's rate card/notes (unless shared).

### L.4 Balance check

| Line | Equation | Numbers | |
|---|---|---|---|
| L1 (J1 out) | sent = received | 300.0 = 300.0 (link) | ✓ |
| L10 (J4 out, merged) | sent = received + weighing | 200.0 = 199.2 + 0.8 | ✓ |
| L11 (J4 ret 1, merged) | | 100.4 = 100.0 + 0.4 | ✓ |
| L13 (J5 out, merged) | | 350.0 = 348.5 + 1.5 | ✓ |
| L15/L18 (J6 out) | | 280.0 = 280.0 | ✓ |
| Other returns | receiver-only, s = r | equal | ✓ (provisional) |
| J1 | issued = outputs + loss | 300.0 = 276.0 + 24.0 (8.0 %) | ✓ |
| J2 | | 250.0 = 228.0 + 22.0 (8.8 %) | ✓ |
| J3 | | 400.0 = 368.0 + 32.0 (8.0 %) | ✓ |
| J4 | | 199.2 = 184.4 (100.4 + 84.0) + 14.8 (7.43 %) | ✓ |
| J5 | | 348.5 = 322.0 (180.0 + 142.0) + 26.5 (7.60 %) | ✓ |
| J6 | | 280.0 = 257.6 + 22.4 (8.0 %) | ✓ |
| No double count | MDB's T2–T4 and jobs J4′/J5′ post nothing after merge (with fix L3); FA grey: sent = consumed + weighing | 300 + 250 + 400 + 200 + 350 + 280 = 1,780.0; consumed 300 + 250 + 400 + 199.2 + 348.5 + 280 = 1,777.7; weighing 0.8 + 1.5 = 2.3 → 1,777.7 + 2.3 = 1,780.0 | ✓ |

### L.5 Gaps

| # | What broke | Minimal fix |
|---|---|---|
| L1 | §6.4 asks only the **new business** to accept; the recorder (FA) whose 2 months of records are exposed is not asked or notified; mirror links (MDB's contact FA(c) → FA) need their own flow; fate of the FA↔MD statement-link token after linking is unstated. | Two-sided: new business accepts, recorder is notified and can decline/unlink within N days; mirror suggestions generated together; statement link auto-retired once both sides are on accounts. |
| L2 | §9.2 merge marks one record `duplicate_of` and stops it posting, but the duplicate holds the **other side's assertion** (199.2, 100.4, 348.5) — dropping it loses real weighing data. Who accepts the merge is unstated. | Merge folds the duplicate's own-side assertion into the survivor (original timestamp, evidence `account`); both parties confirm the merge. |
| L3 | Merge covers **movements only**. MDB's trial jobs J4′/J5′ (and output declarations) still exist; once their input movements become duplicates, their holdings go negative or double count. | Merge suggestion extends to jobs linked to merged movements (`job duplicate_of`), retiring the duplicate job's postings. |
| L4 | Holding keys name contacts (`custodian = MD(c)`, `owner = FA(c)`); after linking, both sides see the same goods under two party ids. | Canonical party resolution (contact → linked business) at read time for keys, views and visibility; nothing rewritten. |
| L5 | Rate visibility contradicts itself: §7 "Rates, bills: the two parties of that job" (so Murugan would see FA's ₹85) vs §7 last row "prices unless shared" after linking. | One rule: job rates visible to both parties only when the recorder marks them shared; default hidden for records created while the party was a contact. |
| L6 | When an off-platform receiver never confirms, the dispatch stays `in_transit` forever; outputs coming back from that performer prove receipt, but closure only consumes `allocated(J)`, so J4 cannot close cleanly. | First output/return from the performer implies receipt of the open dispatch (`received = sent`, evidence `implied`), replaceable by a later real assertion. |

---

## Summary of gaps (F–L)

| # | One line |
|---|---|
| F1 | Via-chain disclosure vs contact privacy (owner sees H? H sees M?) undefined |
| F2 | No parent/child job roll-up for principal balance and bill |
| F3 | Child-job leftovers returning to the via: re-entry into parent job undefined |
| F4 | Movement line has one job_id; returns mix outputs of several jobs |
| F5 | No purpose for sub-contract legs; secondary-input formula omits forwarded/pending |
| G1 | No batch; allocated vs weighed outputs indistinguishable |
| G2 | Lot lineage leaks other owners / upstream parties |
| G3 | Line rate/value visible to all movement parties (custodian) |
| G4 | Outputs before closure double count raw holdings |
| H1 | "Sold from premises" not a purpose; seller ≠ owner; credit to bill |
| H2 | By-product in a foreign dimension not in any line equation |
| H3 | GST clock lost when leftover outlives a closed job |
| H4 | Receiver-only "return all" leaves stubs; tolerance class for estimated lengths |
| I1 | Lot-mixing warning at job-input level gives false positives |
| I2 | No carton/package contents |
| J1 | No regrade event; receipts can't post to held(qc) |
| K1 | Disputed holding custodian unspecified |
| K2 | Issued/output basis (sent vs received) and expected date with several issues undefined |
| K3 | Concession needs counter-acceptance; link can't accept proposals |
| L1 | Link consent one-sided; mirror links; statement-link fate |
| L2 | Merge drops the duplicate's assertion; merge approver unstated |
| L3 | Merge doesn't cover duplicated jobs |
| L4 | Contact vs business ids in holding keys after linking |
| L5 | Contradictory rate-visibility defaults |
| L6 | Unconfirmed dispatch stays in transit forever; no implied receipt |
