# 01 · Domain research — Tiruppur knitwear supply chain

Phase 1 of `BRIEF.md`. Written 20 Nov 2026 from six parallel research notes (full detail, every claim tagged and linked, in `research/`):

| Note | Topic |
|---|---|
| `research/value-chain.md` | Stages, who does them, multi-role firms, sub-contracting |
| `research/materials-units.md` | Attribute schemas per material, units and valid/contextual/invalid conversions, modelling pitfalls |
| `research/job-work-gst.md` | Current GST job-work rules, challans, ITC-04, e-way bills |
| `research/existing-software.md` | Tally, Tiruppur ERPs, ledger apps, why SMEs adopt or don't |
| `research/lead-times-losses.md` | Turnaround, loss %, rates, default templates, seasonality |
| `research/channels-offline.md` | WhatsApp/SMS/share links, offline PWA, phone identity, DPDP |

**Confidence tags:** **[verified]** a cited source states it · **[likely]** consistent with sources/standard practice · **[uncertain]** derived, listings-only or unconfirmed. **Biggest caveat:** almost no Tiruppur-specific process-loss, turnaround or job-work rate data is published. Every default number in this phase is a *seed value the user can override and the system learns from*, and should be checked with 3–5 local calls (field questions in §8).

---

## 1. Headline findings

1. **The gap is real and specific.** Every tool that models job work (Tally "Material Out/In", BUSY, Tiruppur ERPs like FactoStack/Smaac-Tex, VastraApp) keeps **only the principal's version**. Tools that reach both parties (Khatabook/OkCredit, WhatsApp) have **no material model**. Nobody offers a *shared, two-sided, vernacular job-work challan*. That is our wedge. [likely — `existing-software.md`]
2. **Status quo = WhatsApp + paper DC books + Excel**, with an estimated 40–60 % of work-in-progress sitting at partner units at any time. [uncertain — single vendor source]
3. **Adoption killers** are setup before value, English/desktop UI, forcing the counterparty to install, asking for value/HSN at capture, and leaking data to counterparties. ~80 % of MSMEs are reluctant to share data (CRISIL 2022). [verified/likely]
4. **Mass is not conserved through processing** (grey 500 kg → finished ~440–460 kg while GSM *rises* 15–30 %), and **units change** at cutting (kg → pieces) and stitching (kits → garments). Conservation must be *per movement in the input's unit*, with loss and by-products as recorded lines. [verified/likely — `materials-units.md` §e]
5. **Loss norms differ by process, shade and job worker:** knitting ~1.5 %, solid dyeing 6–12 % (typ. 8), cutting 8–18 % fabric not in panels, stitching 1 % reject + ~4 % rework. Compounded, ~23 % of yarn weight never becomes a first-quality garment. (The notes' other figures don't contradict this: job-work-gst's ~11–13 % is *knit + dye only*; materials-units' 8–15 % is the *dyeing* range around the 8 % default. The 23 % adds cutting, stitching and checking.) Weighing noise (cotton regain ~8.5 %) moves apparent loss ±2–3 points, so "suspiciously low loss" is a flag too. [likely/uncertain — `lead-times-losses.md`]
6. **Dyeing is the volatile node in 2026:** rate hikes (+₹10/15/20 per kg light/medium/dark, May 2026), dye/chemical prices up >100 %, a 460-unit strike on 5 Oct 2026. Crisis turnaround has historically gone from 10–12 days to 30–40. Expected dates need a "cluster event" override. [verified]
7. **Reaching off-platform counterparties costs ₹0** if the *user* sends a `wa.me` link from their own WhatsApp to a no-login challan page with **Received OK / Quantity differs**. CLAIRE sending from its own WhatsApp/SMS needs opt-in, templates and DLT, so later. [verified/likely — `channels-offline.md`]
8. **Rejects split four ways:** rework (back to the same unit), B-grade (sold as seconds), scrap (written off), and fabric faults (claimed against the dyer/knitter). Cut waste and "banian waste" are **saleable by-products** (~₹22–100/kg across sources), not just loss. [likely/uncertain]
9. **Real phone verification is a prerequisite for linking records.** Login today uses a fixed demo OTP, so anyone could sign up with a counterparty's number and claim their history. Any claim/link-up of off-platform records must wait for real OTP (SMS) or an inbound-WhatsApp verification. [verified — `00-current-state.md` §6]

## 2. Value chain: stages and who does them

Full stage table with sources: `research/value-chain.md` §a. Unit counts (TEA via Upstox, Sept 2026; sources disagree, treat as rough): ~2,500 knitting, 360 dyeing, 50 bleaching, **790 compacting/calendering**, ~400 printing, 250–600 embroidery, ~4,200 garment makers (1,700 domestic and job-work stitchers). Domestic is ~40–45 % of output (₹30–35k cr vs ₹46k cr exports, FY26), ~60 % of it innerwear.

**Corrected chain for a solid cotton tee** (↺ = can sit elsewhere):

```
spinning mill / yarn trader ──► [yarn dyeing ↺ for stripes] ──► knitting (job work, ₹/kg; knitters also sell fabric)
   ──► bleaching ──► dyeing ──► compacting / calendering / raising (often separate units; dyer → compactor directly)
   ──► [roll printing ↺ all-over only] ──► fabric inspection
   ──► cutting (usually in-house at the "maker") ──► [panel printing / embroidery ↺ on cut panels]
   ──► stitching (job work ₹/pc; sub-contracts to other units and homeworkers)   ◄── collars/cuffs (flat-knit units), trims (bought, issued by principal)
   ──► [kaja buttonhole/button ↺] ──► [garment washing/dyeing ↺]
   ──► checking/trimming/mending ──► ironing/tagging/packing (often kept in-house) ──► dispatch (agents, Khaderpet wholesalers, retailers, transporters)
reverse/side flows: shade rejection → re-dye · misprint → recut · alteration · retailer returns · export surplus → stock lots · cut/yarn waste → waste traders
```

**Corrections to the brief's §4 stage hypothesis** (13 in the note; the ones that change the model):
1. **Printing and embroidery mostly happen on cut panels**, *after* cutting and *before* stitching. Only all-over/roll printing comes before cutting. → Routes are a **configurable graph per style**, not a fixed sequence. [verified, Roy 2009]
2. **"Dyeing & processing" is 2–4 different businesses** (bleaching, dyeing, compacting/calendering, raising), each its own hop with its own challan, loss and turnaround; fabric often moves **dyer → compactor directly**. [verified]
3. **Missing branches:** yarn dyeing *before* knitting; garment washing/dyeing *after* stitching; collars/cuffs from flat-knit units and kaja buttonholing as parallel/extra job-work steps. [verified]
4. **Makers with no machines are real** (Cawthorne 1993's "cutting firm" with only a cutting table; merchant exporters), and an exporter quote — outsource stitching, keep checking/ironing/packing in-house — matches the brief's Scenario A exactly. [verified]
5. **Trims are issued by the principal to the job worker** and must be tracked as owned stock at the job worker, like fabric. Some "trims" are themselves job work (collars, kaja buttons, embroidery badges). [verified/likely]
6. **Job workers serve many principals and sub-contract, sometimes without telling the principal** (to other units and to homeworkers for trimming, sleeves, buttons). [verified]
7. **Domestic makers increasingly buy finished fabric** from traders/godowns instead of running yarn → knit → dye; knitters also sell fabric outright. [verified]
8. **Missing actors:** merchant exporters/buying agents, domestic sales agents, fabric traders/godowns, yarn merchants, waste traders, stock-lot buyers, Khaderpet wholesalers, transporters/parcel services, homeworker contractors. One owner may run several registered units. [verified]

## 3. Job work in practice and the current GST rules

Full rules, field list and alert design: `research/job-work-gst.md`. All rules checked against primary sources (CGST Act/Rules, CBIC circulars and notifications, EWB portal) as of Nov 2026.

| Rule | What it requires | Confidence |
|---|---|---|
| s.2(68) | "Job work" exists only if the **owner is GST-registered**. Unregistered owner → no s.143 procedure, no ITC-04, 18 % on processing (5 % "tailoring"). | verified |
| s.143 + Rule 45 | Principal sends goods **without tax under its own challan**; job worker → job worker moves and direct supplier → job worker deliveries are allowed. | verified |
| Rule 55 | Challan fields: serial ≤ 16 chars unique per FY, date, both parties (name, address, GSTIN), HSN, description, **quantity (provisional allowed)**, taxable value, place of supply if inter-state, signature; triplicate. | verified |
| Circular 38/2018 | **Piecemeal returns need a fresh challan from the job worker for each lot.** | verified |
| s.143(1)(a)/(b) | Return within **1 year (inputs) / 3 years (capital goods)**; moulds/dies/jigs/tools exempt. Missed → **deemed supply on the original dispatch date**, tax + 18 % interest. Extension up to +1 / +2 years. | verified |
| ITC-04 | **Annual (25 Apr) if previous-year turnover ≤ ₹5 cr; half-yearly (25 Oct, 25 Apr) above** — since 1 Oct 2021 (Notification 35/2021-CT). Needs per challan: job worker GSTIN (or *state* if unregistered), challan no./date, description, **UQC + quantity**, value, losses and wastes. Table 5B covers **returns from a different job worker** (direct hops). *(`value-chain.md` says "quarterly" — outdated; the GST note is authoritative.)* | verified |
| E-way bill | **Inter-state job work: always, regardless of value.** Intra-TN: ₹1 lakh limit; a 2018 TN exemption for yarn/fabric/garment job work could not be confirmed as still in force. 2FA mandatory (Apr 2025); base document ≤ 180 days old; max 360-day extension; Ship-To GSTIN mandatory from Aug 2026 [likely]. | verified / uncertain |
| Rates since 22 Sep 2025 | Textile job work for a registered principal **5 %**; residual job work 18 %; yarn/fabric 5 %; garments **5 % up to ₹2,500/pc, 18 % above**. | verified |
| E-invoice | AATO > ₹5 cr; applies to job-charge bills, **not challans**. | verified |
| Waste/scrap | May be supplied from the job worker's premises (by the job worker if registered, else by the principal). | verified |

**Practice** [uncertain — needs real samples]: handwritten DC books, a photo of the challan on WhatsApp, inward/outward notebooks. Compliance is loose among small units, but the law already demands exactly the record we want to keep — **the challan is the natural digital object**.

**Product consequences:**
- The dispatch record should capture the **Rule 55 + ITC-04 + EWB Part A field set** (full list in the note §b) — mostly optional at capture, filled later (by the accountant if need be). Quantity + unit + counterparty + date stay the only mandatory fields.
- **Different units in and out are legal and normal** (kg out, pieces back). Store both; never force a conversion into the recorded quantity.
- **Returns match open dispatch lines by spec and lot first**; FIFO (oldest challan first) only breaks ties *within* the same spec and lot. The user can override. Physical lineage (which lot became which) and the ITC-04 allocation view are kept separate, so a lot returned out of order never corrupts lineage.
- **Leftovers "kept and adjusted" and waste sold from the job worker's premises are taxable events** (a supply by the principal, or by the job worker if registered under s.143(5)); flag them for the accountant and route them to ITC-04 losses/5C, not just as a bill deduction.
- **DC numbers:** by default record the user's **existing paper DC number + photo**; generate a CLAIRE DC only after the user picks a dedicated series once (avoids duplicate/gapped series in GSTR-1 Table 13). Offline dispatches get no generated DC (serials are server-assigned).
- **CA questions to add:** whether TN Notification 09/2018 entry 60 ("job work *services*" for yarn/fabric/garments) is still in force *and* whether it covers the *goods movement* for e-way bills at all; HSN for cut panels.
- **Genuinely useful alerts:** 1-year return deadline per open line (day 300/330/350 with estimated tax + interest at risk); ITC-04 due dates with a readiness checklist; "inter-state job work → e-way bill required (any value)"; prompt for the job worker's challan number on every partial return.
- **Unregistered owner:** same data model, labelled "sent for processing", ITC-04 hidden.

## 4. Materials, attributes and units (summary)

Full schemas: `research/materials-units.md` §a (yarn, knitted fabric incl. rib/collars, dyeing job, printing/embroidery, cut panels, garments, 14 trim types).

- **Spec vs lot.** Every attribute is either *spec* (what the material **is**; different values never merge) or *lot* (which physical batch; same spec, different lot = listed together but never silently mixed in a lay/garment). This one distinction carries ownership, shade segregation and two-dye-lot orders.
- **Processing creates a new spec with lineage**, not an edit: grey SJ 160 GSM 30" tubular → finished SJ 180 GSM 36" navy, lot D-4471.
- **Units** — three classes (full table in the note):
  - **Valid (fixed):** kg/g/t, m/cm/inch/yard, dozen = 12, gross = 144, great gross = 1,728, pair = 2.
  - **Contextual (factor stored on the record, snapshotted):** bag/cone/roll ↔ kg (weighed per package), kg ↔ pieces via **style × size consumption** (180 GSM tee L ≈ 210–230 g/pc ⇒ 4.3–4.8 pcs/kg), cone ↔ metres, carton/set/pack/bundle ↔ pieces (defined per carton/style/order), kg ↔ m (open width with GSM × width).
  - **Invalid (refuse with a helpful message):** GSM/dia/count/denier/ligne as quantities; kg ↔ pieces without a style/size; yarn kg ↔ garments directly (planning estimate only); lot as a unit; conversions across materials; computing finished kg from GSM instead of weighing.
- **Store integers in the base unit** (pieces, grams or 0.01 kg), display "10 dz 4 pcs". Never store fractional dozens.
- **Trims:** thread and elastic stock in **metres** (cones/rolls are packages; partial cones come back); polybags bought per kg, issued per piece; **size labels and zips are size-specific variants**; snaps are a 4-part set.
- **Cartons** hold an *assortment*: solid (1 colour × 1 size), ratio (1 colour, sizes in ratio), or mixed.
- **Size sets are configurable per style** (S–XXL; 75–110 cm innerwear; kids by age) and scoped so "90" kids ≠ "90" vest.

## 5. Lead times, turnaround and loss defaults

Full tables and rationale: `research/lead-times-losses.md` §a–c.

**Two kinds of expected date** (as the brief said, confirmed):
- **Procurement lead time** = order date + lead (yarn from trader 1 d, from mill 7 d; ready dyed fabric 1 d; stock trims 1 d; made-to-order labels 8 d; printed polybags/cartons 10 d).
- **Processing turnaround** = dispatch date + turnaround (knitting 5 d, fabric dyeing 6–8 d by shade, compacting 2 d, panel printing 4 d, embroidery 4 d, cutting 2 d, stitching 6 d per 1–3k pcs, checking/packing 2 d, garment washing 4 d).

**Flags** (all measured against the counterparty's learned default, not a global constant):
- *Due soon* 1 day before; *late* when the expected date passes with quantity pending; *very late* after a per-process grace band (+2 to +5 days).
- *Abnormal loss* above norm + band; *suspiciously low loss* below a floor (weighing/moisture/unrecorded partial → "please re-check", not blame). Judged **only when a lot is closed**.
- Partial deliveries: turnaround measured to the **last** receipt; first-receipt date shown too.

**Learning:** after ≥ 3 closed lots with the same **counterparty + process + material class** (e.g. shade class for dyeing, style for stitching), `default = (n·median + 3·template)/(n + 3)`. Median, so one disaster lot doesn't skew it.

**Weighing tolerance** (sender's vs receiver's weight): default **±1.5 % for fabric/yarn by weight**, **0 for counted pieces**, learned per counterparty like the loss norms. A tighter band would open a discrepancy on almost every grey-to-dyer hop (moisture alone moves weight ±2–3 points) and users would learn to ignore them.

**Paused lateness:** a job worker can mark a lot **"ready, held for dues"** (dyers commonly hold goods until old bills are cleared). That stops the late clock and shows the real reason, instead of blaming turnaround.

**Calendar:** wet processing and knitting count 7 days/week; piece processes 6. Ship an editable Tiruppur holiday/event calendar (Deepavali +7–10 d for stitching, Pongal +4–5 d, Holi +5–7 d for migrant-heavy stitching, monsoon +1–2 d for drying) and a one-tap **"cluster event"** (strike, CETP shutdown) that shifts all open expected dates for a process.

**Rework loop:** stitching alteration 3 d; dye correction (topping) 4 d; strip and re-dye 7 d plus 2–4 % extra loss, recorded as **its own loss event**. Track **re-dye rate per dyer**.

## 6. Red-team of the brief's §4 modelling insights

| # | Brief's insight | Verdict | Correction / refinement |
|---|---|---|---|
| 1 | Ownership ≠ custody | **Confirmed; it needs custody *relations*, not a single field.** | Model each holding as a **custody relation**: *custodian X holds Q of material for owner Y, accountable to Z* (Z = whoever handed it over: the owner, or an upstream job worker when S1 sub-contracts to H). Accountability belongs to the relation, so it survives (a) **ownership changing in place** — F sells 200 of the 478 kg still at dyer D to father; D now holds 278 kg for F and 200 kg for father, with no physical move (ITC-04 5C; D registered or premises declared); (b) sub-contracting chains (M → S1 → H). Storage-only custody (bought, paid, still in the shop's godown) and **in transit** (custodian = transporter) are relations too. Receipts can include **the job worker's own material consumed** (S1's own thread or labels in M's garments), valued and billable. |
| 2 | Role is per step, not per account | **Confirmed.** | Real firms are principal on one movement and job worker on the next (a dyer that also knits; Lakshmi stitches Ravi's panels and sells her own plain tees). Account-level "capabilities" are still useful for **discovery** (who does dyeing), not for permissions. |
| 3 | Process step = inputs → outputs with ratios, loss, turnaround, rate, performer | **Confirmed, with three refinements.** | (a) Outputs include **by-products** (cut waste, end bits, fents) and **graded outputs** (A, B-grade, rework, scrap). (b) Ratios are **contextual factors** (consumption g/pc per style × size), snapshotted per step. (c) A step can be **partially done many times**; it is a container of receipts, not a single event. |
| 4 | A production flow is a DAG | **Mostly confirmed, but it has cycles in practice.** | Rework, shade rejection and retailer returns loop material **back** to an earlier node. Model the *material* graph as a DAG of **lots/movements** (every rework creates a new movement with its own dates), so the history is acyclic even when the physical route loops. Splits (sizes to different stitchers), merges (panels + trims) and kit re-joins after panel printing must all be representable. |
| 5 | Process types are data, not code | **Confirmed, with a small fixed vocabulary in code.** | Process *instances* are data; the few *behaviours* they choose from are a fixed enum in code, so no process needs special-case logic: **rate basis** (per kg of input, per good piece out, per piece per colour, per 1,000 stitches, per lot), **conservation kind** (mass-losing e.g. dyeing; count-preserving e.g. printing; unit-changing e.g. cutting; assembling e.g. stitching; packing/unpacking), **ITC-04 nature-of-job-work code**, allowed **input forms** (dyeing applies to yarn, fabric or garments) with unit rules, default turnaround/loss norms, and required measurements (grey kg in + finished kg out for dyeing). Built-in templates for ~15 processes; users can add e.g. "garment washing". |
| 6 | Quantity conservation: sent = received + accepted loss + rejected + pending | **Confirmed as the core invariant, with three fixes.** | (a) Conserve **per input line, in that line's unit** (a stitching step has kits in pcs, thread in m, labels in pcs — each balances separately). (b) Buckets: received (by grade), loss, **by-product** returned/kept/sold, **leftover** returned/kept-and-adjusted, **forwarded** to another party (hop), **consumed into output**, pending, and an explicit **unaccounted residual** with a threshold flag — never a plug. **Gains** (negative loss, e.g. moisture at knitting) are allowed and flagged. (c) The *output* side is checked separately against the **planned yield**; over-production from the excess-cutting allowance (1,030 kits for 1,000 ordered → 1,024 garments) is normal and shown, not an error. Cutting's "kg in panels" is an estimate, so the cutting residual is reported, not forced to zero. |

**Insights the brief didn't list, which the model must also carry:**
7. **Two scales disagree.** Sender's and receiver's weights legitimately differ (moisture, tare). Allow a tolerance band per material; beyond it, open a **discrepancy** owned by both sides. Never overwrite.
8. **Kit integrity.** Components (front, back, sleeves, rib) of one size × colour × dye lot must re-join; printing often takes only fronts away. Warn when a garment's panels come from two dye lots.
9. **Batch ≠ lot ≠ order.** A dyer may split one lot across batches and *may* merge several principals' same-shade fabric into one machine batch [uncertain — open field question]; if it happens, ownership per kg must survive the batch.
12. **Counts drift and users slip.** Physical counts disagree with the books (1,140 tees counted vs 1,180 recorded), and unit slips happen ("ஐம்பது டஜன்" = 600 pcs entered as 50). Needs an auditable **count adjustment** event with a reason, and plausibility checks (returned > sent; pieces/kg outside the style's range).
13. **Rates change mid-order.** Dyeing rates rose on 5 May 2026; 520 kg sent on 1 May at ₹70/kg and returned after the hike at ₹85. Rates are **effective-dated, snapshotted on the dispatch, overridable per receipt**.
10. **Two-sided records diverge before they converge.** The off-platform counterparty's confirmation is weaker evidence than a verified user's; label it as such.
11. **Direct hops are normal and legal.** Knitter → dyer → compactor → cutter without the goods returning to the principal; ITC-04 explicitly captures job-worker-to-job-worker moves.

## 7. Scenarios (the acceptance tests for Phase 2)

Scenarios A and B are from the brief. C–AD (28 scenarios) are added from research and the red team. Quantities are realistic seed values. Each will be walked through the domain model in Phase 2 **from every participant's view**.

**A. Father's unit (brief).** F buys grey from a knitter → job work at D → stock → sells dyed fabric to father. Father buys buttons/zips (T1) and thread (T2), cuts in-house, sends poly S+M panels + trims to S1 and other sizes + trims to S2, receives partially with rejects for rework, packs in-house, dispatches to 3 sellers.
**B. Split cutting and colour/size-wise stitching (brief).** M → cutting-only unit C → panels back → 3 stitchers, one per colour + size combination → in-house packing.

**C. Yarn trader's chain with direct hops.** Yarn trader Y buys 1,000 kg 30s combed (two mill lots: L1 560 kg + L2 440 kg). Sends 600 kg to knitter K (job work): **560 kg L1 + 40 kg L2**, recorded as two lines so lineage shows the grey made from two yarn lots (barré risk is flagged). K returns 588 kg grey SJ in three deliveries (210 / 200 / 178 kg; 12 kg = 2 % knitting loss). Y instructs K to send the grey **directly** to dyer D (hop: K → D, owner Y). D returns 540 kg navy finished (8.2 % loss). Y sells 300 kg to fabric shop F and 240 kg to manufacturer M. Y never touched the fabric between yarn and sale. *Tests:* direct hop, ownership through two custodians, chained loss, lot lineage yarn → grey → finished.

**D. Placement printing on cut panels, with misprints.** M cuts 2,000 tees (S/M/L/XL/XXL = 300/500/600/400/200, black and white). Sends **only the 2,000 front panels** to printer P. P returns 1,970 printed + 30 misprints (12 black M, 18 white L). M cuts 30 replacement fronts from reserve fabric and sends them; P returns 30. M re-kits fronts with backs/sleeves of the same size, colour and dye lot before sending kits to the stitcher. *Tests:* partial-kit movement, rejects causing a new cutting step, kit re-join, size × colour matrix.

**E. Dyed lot rejected for shade.** F sends 520 kg grey to D for navy against lab dip LD-882-B. D returns 478 kg in 20 rolls. F rejects 5 rolls (118 kg) as off-shade and returns them as rework. D re-dyes (strip + re-dye, 7 days) and returns 114 kg (another 4 kg, 3.4 % loss). D charges no fee; the extra loss is disputed. *Variant E2:* F instead decides to strip the 118 kg and re-dye it **black** (a different shade, charged as a fresh job) — a **spec change mid-flow**: the rework output is a new material spec linked to the navy lot. *Tests:* rejection as a new return movement (original receipt not edited), rework expected date, loss split between first pass and rework, discrepancy on who bears loss, re-dye rate per dyer.

**F. Job worker sub-contracting.** M sends 3,000 cut tee kits (+ 3,000 labels, 90 thread cones) to stitching unit S1. S1 sub-contracts 1,000 kits to home tailor H (off-platform, phone only). H returns 985 good + 15 for alteration to S1; alters 12, scraps 3. S1's own 2,000 kits yield 1,983 good + 14 rejects + **3 kits still pending** (missing sleeves). S1 returns 2,980 garments (1,983 + H's 985 + H's 12 altered) + 17 rejects (S1's 14 + H's 3 scrap) to M, and 3 kits stay open at S1. Balance: 2,980 + 17 + 3 = 3,000. *Tests:* M's view (all 3,000 "with S1", optionally "S1 sub-contracted 1,000"), S1's view (M's material held, part of it sent on), H's minimal view via share link, ownership never changes, the chain of accountability (M → S1 → H).

**G. One dyer holding material for many principals.** Dyer D holds at once: F 520 kg grey (navy), M 300 kg grey (navy), Y 588 kg grey (black), Ravi 150 kg rib (navy). *If* D runs one 600 kg machine batch combining F 300 kg + M 300 kg (same navy shade) — whether dyers really mix owners in a batch is an open field question — 552 kg comes out and D allocates 276 kg to each owner (loss shared pro-rata). The model must handle it, but v1 can defer the multi-owner batch UI (see §9). *Tests:* D's "held for others" by principal and batch, batch ≠ lot, loss allocation per owner, privacy (F never sees M's quantities).

**H. Leftovers: returned vs kept-and-adjusted.** After stitching 2,000 polos, S1 holds father's leftovers: 3 partial thread cones (~4,200 m), 240 buttons, 14 zips, 6 kg fabric end bits. Father takes back thread and buttons; lets S1 keep the zips at ₹6 each deducted from the stitching bill; S1 keeps end bits and sells them as banian waste, crediting ₹420. Both "kept at ₹6" and "waste sold from S1's premises" are **taxable events** flagged for the accountant. *Variant H2:* 20 kg of the father's leftover fabric is forgotten at a cutting unit for **10 months**; the 1-year return alert fires at day 300 showing the tax + interest at risk if it becomes a deemed supply. *Tests:* leftover dispositions (returned / kept-and-adjusted / written off / sold as by-product), conservation of trims issued vs consumed, money adjustment against a job bill without a payments system, statutory deadline alerts.

**I. One order from two dye lots.** M orders 1,000 navy polos. Fabric arrives as two lots: D-4471 (150 kg) and D-4502 (90 kg); visible shade difference. Cutting runs lays per lot (620 pcs from 4471, 380 from 4502). Stitcher S3 receives bundles labelled by lot. The packer must not mix lots in one carton for retailer R1. *Tests:* lot segregation through cutting → stitching → packing, warning when bundles from two lots are kitted together, lot-aware dispatch.

**J. Partial dispatches and retailer returns.** M dispatches 1,000 tees to three sellers: R1 600 (400 on day 1, 200 on day 8), R2 300 (one shipment), R3 102 (size ratio 1:2:2:1 = 17/34/34/17). Total 1,002 (2 extra from the cutting allowance). R1 returns 24 pcs after 10 days: 12 wrong size (XL instead of L, exchanged; M sends 12 L) and 12 defective (back to stock as B-grade 8; to S1 for rework 4). *Tests:* partial outbound, returns as new movements, exchange, grade change, retailer's own inbound view.

**K. Two scales disagree (weighing discrepancy).** F's challan says 500.0 kg grey to D. D's receiving scale says 488.0 kg (-2.4 %; fabric tolerance ±1.5 %). **Both on platform:** D confirms 488.0; a discrepancy opens with both numbers; F accepts D's weight (or they split). A second dispatch, 300.0 vs 297.0 kg (-1.0 %), is **within tolerance**: no discrepancy, the difference is recorded as a weighing difference. **D off platform:** D taps "Quantity differs: 488" on the share link. *Tests:* two-sided confirmation, tolerance band, discrepancy lifecycle, nothing overwritten, weaker-evidence labelling for link confirmations.

**L. Off-platform counterparty joins later.** Father records 15 movements over 2 months with "Murugan Dyeing" (name + phone, off platform). Murugan signs up. CLAIRE suggests the link; Murugan must **accept** before seeing father's records. Murugan had also typed 3 of the same movements himself during a trial; these must be **matched and merged**, not double-counted. *Tests:* phone matching as suggestion only, consent, de-duplication, history becoming two-sided.

**M. Procurement with partial and wrong delivery.** Father orders 50 gross buttons and 200 zips (7", black) from T1, expected next day. T1 delivers 30 gross + 200 zips today; 20 of the zips are navy (wrong colour) and go back; the other 20 gross arrive 4 days later (late flag after the grace band). *Tests:* procurement lead time vs processing turnaround, partial receipt, return to supplier, late flag on a purchase.

**N. Bought but not collected (storage custody).** Father buys and pays for 200 kg black SJ from F but leaves it in F's godown and draws 60–80 kg at a time over two weeks. *Tests:* ownership ≠ custody with no process involved; F's inventory shows "held for father, 200 → 140 → 60 kg"; father's shows "owned, at F".

**O. In-house QC sending rework back.** Father's in-house checking finds 60 of S2's 1,180 tees need alteration; sends them back to S2; S2 returns 58 OK + 2 scrap after 3 days. *Tests:* in-house step (performer = self), rework loop to an external unit, partial-receipt reconciliation against the original stitching step.

**P. Job worker who is also a buyer.** Lakshmi (stitching unit) holds Ravi's 1,000 tee kits and at the same time buys 300 kg white SJ from F for her own plain-tee stock and sells 600 tees to wholesaler W. *Tests:* one account with owned stock and held-for-others stock side by side, never mixed; her "what I owe back" view vs her own inventory; multi-role without role switching.

**Q. Expected date hit by a cluster event.** On 5 Oct 2026 the dyeing strike closes D for a day; on 8 Oct CETP maintenance closes it for four more days (8–11 Oct). Father applies two "cluster events: dyeing closed 5 Oct and 8–11 Oct". All his open dyeing movements shift their expected dates; delay flags are not raised for the shifted days. *Tests:* expected-date recalculation, holiday/event calendar, honest "late" metrics.

**R. Polo with parallel component flows and a post-stitch job-work step.** M makes 1,200 navy polos. Body fabric goes dyer → compactor directly (hop) → M cuts. Collars and cuffs (1,200 sets, S–XXL) are ordered from flat-knit unit CK and **delivered straight to stitcher S4**. After stitching, S4 sends the polos to kaja unit KB (job worker → job worker hop) for buttonholes and buttons. **Buttons (3/pc, 3,600 + 2 % spare = 3,672) are issued by M directly to KB**, the unit that attaches them; KB returns the polos to M (not to S4) plus 60 unused buttons. *Tests:* components arriving at a job worker from two other parties, kit completeness at S4 (can't stitch without collars), a post-stitch step, return to the principal from a job worker other than the one dispatched to (ITC-04 5B).

**S. Supplier delivers straight to the job worker.** Father buys 400 kg grey SJ from knitter K and has it delivered **straight to dyer D** (bill-to father, ship-to D). Father's challan accompanies K's invoice. D receives 397 kg on day 2. *Tests:* a purchase whose first custodian is a job worker; the statutory 1-year clock starts on **D's receipt date**, not the purchase date; K's view (sale), D's view (held for father), father's view (owned, at D, never at home).

*Added after the Phase 1 red team (§10). Every scenario's quantities must close to zero — the Phase 2 walkthrough checks this.*

**T. Parcel shortage and detention (in transit).** M dispatches 1,200 pcs in 100 boxes (12 pcs each) to Kerala wholesaler W via a parcel service; LR says 100 boxes. W receives 97; 3 boxes (36 pcs) are missing. M files a transit claim on the transporter; who bears the loss depends on agreed terms (to-pay, ex-works). Separately, a 1-box inter-state job-work consignment without an e-way bill is detained for 4 days. *Tests:* custodian = transporter, LR-based handover, transit claim, a "detained" state that pauses lateness.

**U. Physical count and a unit slip.** Father's monthly count finds 1,140 packed tees where the books say 1,180; S1 reports 2,950 kits left where CLAIRE says 2,980. Separately, a supervisor enters "50" for a stitcher's voice note "ஐம்பது டஜன் வந்துச்சு" (50 dozen = 600 pcs); the receipt then exceeds the dispatch by 1,100 %, and the plausibility check stops it. *Tests:* count adjustment as an auditable event with reason and recorder; plausibility checks; dozen-vs-piece parsing.

**V. Cancellation after cutting.** Retailer cancels 400 of 1,000 polos after cutting, when 400 kits are already at S2. S2 has stitched 180; father pays for 180 and takes back 220 kits, which go to stock for another buyer. *Tests:* cancellation mid-flow, partial billing, kits returning to owned stock.

**W. Rate change mid-order.** 520 kg sent to D on 1 May at ₹70/kg; the association hike takes effect 5 May; 240 kg returns on 8 May billed at ₹85/kg, the rest at ₹70 after negotiation. *Tests:* effective-dated rates snapshotted per dispatch, overridable per receipt; computed bill.

**X. Consignment (sale-or-return) to a retailer.** M consigns 600 innerwear pcs to R2; ownership stays with M. After 45 days R2 reports 410 sold (invoiced), returns 150, and 40 are unaccounted. *Tests:* custody without a process, sell-through reporting, 6-month invoice clock (s.31(7)), shrinkage at a retailer.

**Y. Held for dues, and netting across roles.** D finishes the father's 300 kg navy but holds it until ₹42,000 of old bills are paid; the lot shows "ready, held for dues" and the late clock pauses. Meanwhile the father sells 100 kg of fabric to S1 while S1 holds his 1,000 kits, and deducts the fabric bill from the stitching bill. *Tests:* paused lateness with a reason; a counterparty owing in two directions.

**Z. Stock-lot sale.** Wholesaler/maker sells 328 mixed pcs (18 defective, 30 seconds, 110 XL leftovers, 170 old season) to a stock-lot buyer at ~40 % of wholesale. *Tests:* selling across grades and specs in one movement; grade-aware inventory.

**AA. Coordinator with no premises.** Coordinator K owns no machines: buys fabric delivered to a cutter, panels go to a stitcher, packed goods are sold through a commission agent straight from the packer. All K's stock is always "at others". *Tests:* inventory with zero own location; sale from a job worker's premises (5C); agent as party.

**AB. Multiple premises and sister GSTINs.** Father moves 150 kg from his godown on Mangalam Road to his cutting floor 2 km away (a **location transfer**, same owner). His brother's firm (same family, different GSTIN) takes 2,000 kits for packing — a movement between **two legal entities**, needing a challan/invoice. *Tests:* locations within a business; related businesses that are still separate parties.

**AC. Fault traced upstream, and a purchase return.** At stitching, 40 tees show holes traced to knitter K, two hops back (K → D → father). Father raises a claim against K (credit note). Separately, 2 rolls (46 kg) with dye patches go back to fabric shop F for replacement. *Tests:* claims that cross hops via lineage; purchase return of fabric.

**AD. Packs, sets and samples.** KPR assembles 3-packs of vests (white + grey + black, size 90): three SKUs become one pack SKU; a retailer returns 12 broken packs, which are unpacked back into singles. Separately, 6 proto pieces cut from 2 kg go to a prospective buyer through a deal room and are never returned (written off as samples); lab-dip swatches likewise. *Tests:* assembly/disassembly; non-returnable samples.

## 8. Field questions to confirm with 3–5 Tiruppur users

1. Who physically writes the challan today (owner, supervisor, accountant)? Would they record on a phone?
2. Knitted fabric: kg or rolls? Stitching: pieces by size, or dozens?
3. Typical dyeing loss at *your* dyer, by shade; is it disputed; how is it settled?
4. Do dyers/compactors accept a WhatsApp link from a principal, or does it feel like surveillance?
5. Leftover trims and end bits: returned, adjusted against the bill, or kept?
6. Sub-contracting: do you tell the principal?
7. Would an owner pay ₹200–300/month for staff seats and exports?
8. Typical roll weight; how "set" is used in domestic orders.
9. Do dyers ever combine two owners' same-shade fabric in one machine batch?
10. Is sale-or-return (consignment) common for your innerwear/retail buyers?

## 8b. Brief requirements that need their own design work (flagged by the red team)

| Brief item | Status after Phase 1 | Where it gets designed |
|---|---|---|
| Voice and photo capture (§2.5, §5.8) — Tamil quantities ("அரை டஜன்", "ஐந்நூறு கிலோ"), handwritten DC OCR | Not researched yet. Existing Sarvam STT + LLM extraction pipeline is the base. | Phase 3 (conversation design) + Phase 4 (parser tests in ta/hi/en, OCR feasibility spike) |
| Capacity search ("500 kg navy by Friday", §2.1) | Research found minimum lots (~300 kg) and machine loads (100–600 kg/batch) | Phase 2: capacity, minimum lot and turnaround attributes on a business's process offerings; feeds existing `match.ts` |
| "What's running low" (§2.3) | Needs planned consumption | Phase 2: planned requirements from open orders × BOM (consumption per style/size) vs available stock incl. incoming |
| "Money tied up in WIP" (§6) | No valuation rule yet | Phase 2: optional value = purchase cost + job charges so far (when rates are recorded); hidden when unknown |
| DPDP (channels note) | Notice + stop/delete on the share page; obligations from May 2027 | Phase 3 (share page copy) + Phase 4 (deletion, retention) |

## 9. Recommendations for the decisions in BRIEF §12

| # | Decision | Recommendation | Why |
|---|---|---|---|
| 1 | **v1 scope: roles/stages** | **Generic model for every role from day one; v1 *templates and UI polish* for the fabric → cutting → stitching → packing → dispatch path** (Scenarios A, B, D, F, H, J, M, N, O, P) plus dyeing as the one wet process (E, K, Y). The multi-owner machine batch (G) and consignment (X) are modelled now but their UI ships in v1.1. Knitting, yarn, compacting, printing, kaja, washing work through the same generic "process" with plain templates; richer templates later. | The model is the hard part and must not be re-cut later; the screens and templates are where effort scales. Stitching and dyeing are where most WIP and disputes are. |
| 2 | **Costs, payments, invoicing for job work** | **Record rate (optional) and compute the job-work bill** (qty × rate − agreed deductions, e.g. leftovers kept, shortages); show "amount due to/from" per counterparty. **No payment collection or tax invoices in v1.** Existing order payments stay as they are. | Users want "what do I owe the stitcher"; collecting money and invoicing are a separate product with compliance weight. |
| 3 | **Generate GST documents or just record** | **Record everything in a compliance-ready structure.** By default record the user's **existing paper DC number + photo**. Offer a **printable delivery challan** only after the user picks a dedicated CLAIRE series once (no duplicate series); not offered to unregistered owners (wording becomes "sent for processing"); not offline. No filing. **v2: ITC-04 draft export** (CSV/Excel) and challan register for the CA. **Defer** e-way bill JSON; record the EWB number and link to the portal. Never file on portals or hold GST credentials. | Generating a printable DC is high value and low risk; filing is high risk; ITC-04 is annual for most SMEs, so an export can come later. |
| 4 | **Notification channels** | **In-app inbox + chat cards are the source of truth** (system channel and deal rooms). **The user sends WhatsApp links themselves** (`wa.me` prefilled in the counterparty's language). No CLAIRE-sent WhatsApp/SMS in v1. Web Push as a best-effort nudge later. | ₹0 cost, no Meta opt-in/DLT needed; budget Android suppresses push anyway. |
| 5 | **Offline** | **v1: app shell cached + an IndexedDB outbox for create-only writes** (dispatch, receipt, confirmation) with client idempotency keys enforced by a unique index. No offline edits/merges. | Godowns and loading bays have poor signal; create-only queueing is cheap and safe. |
| 6 | **Updates for off-platform counterparties** | **One standing statement link per counterparty** (long random token stored hashed, revocable, valid while any line is open, re-issued on demand) in ta/hi/en showing every open line with that party. The counterparty can **confirm** ("Received OK / Quantity differs") and **propose** a return ("I sent 300 back today"), which the user accepts. A **"send today's updates"** bulk action prepares one WhatsApp message per counterparty. Confirmation by POST (link-preview bots fetch GETs); labelled weaker evidence than a verified user. No prices unless the sender allows. Notice + "stop" on the page (DPDP). **Linking an off-platform record to a new sign-up requires real phone verification** (not the demo OTP). | Matches Khatabook/OkCredit's loop without 14 links per stitcher; returns are the most frequent event, so the job worker must be able to report them. |
| 7 | **Demo / deadline constraint** | **Hackathon submission is Sun 22 Nov 2026, 23:59 IST.** Recommend **not** shipping supply-chain code for the hackathon: keep it behind a flag, start Phase 6 after submission; mention it as the roadmap in the write-up. If you want a teaser for the judges, the safest is a static "coming next" mock in the PDF, not code. | Phases 2–5 have three checkpoints; rushing a half-model into the live app risks the existing demo. |
| 8 | **Existing retailer/manufacturer accounts → new role model** | Keep `businesses.sells/buys` (discovery) and `role_label` (display). Add a **capabilities** list derived from them (e.g. `service.stitching` → "stitching"), editable later. **Permissions never depend on roles** — only on the business that owns or is party to a record. No data migration beyond backfilling capabilities; nothing is lost or renamed. | The existing model already avoids one-role-per-account; the brief's multi-role rule is satisfied by per-movement roles. |

**Additional decisions I need from you:**

| # | Decision | Recommendation |
|---|---|---|
| 9 | Dev database | Use `MONGODB_DB=nexconn_sc_dev` on the same Atlas cluster for all supply-chain work (already used for today's tests). A separate free cluster is cleaner if you prefer. |
| 10 | Model for the personal Claire (tool calling) | Verify in Phase 4. The free Nemotron endpoint is currently blocked for this key and free fallbacks are unreliable at structured output (seen in today's logs). Expect to recommend a paid model for this assistant only (an `ANTHROPIC_API_KEY` already exists in `server/.env`), with deterministic server-side tools and a strict per-day cap. |
| 11 | Staff logins | Today it's one user per business, but the people who actually load and receive goods are supervisors. **Recommend a minimal staff identity in v1:** the owner adds a named staff member by phone; staff can only record dispatches/receipts/counts (no rates, no analytics, no Claire queries about money). Every event stores **who recorded it**. |
| 13 | Real phone verification | Today's login uses a fixed demo OTP. **Linking off-platform records to a new account (Scenario L) must wait for real verification** — SMS OTP via a provider, or an inbound WhatsApp "VERIFY" message to CLAIRE's number. Recommend making this a hard dependency of the claim slice. |
| 12 | Field validation | Before Phase 2 is finalised, ideally 15-minute calls with 3–5 real users (your father first) on the §8 questions. If not possible, I proceed with the research defaults and flag them as assumptions. |

## 10. Red team: what it found and what changed

**Self-review against the brief (Phase 1 asks):** five parallel research subagents ✓ (six run); sources and confidence tags ✓; §4 hypotheses corrected (stage order §2, modelling insights §6) ✓; ≥ 8 extra scenarios ✓ (C–AD, 28 added) covering every edge case the brief listed ✓; checkpoint decisions with recommendations ✓ (§9).

**Independent red team** (a separate agent that wrote none of this; briefed to break it with concrete counter-examples; spot-checked GST claims on the web) returned **24 findings: 6 high, 15 medium, 3 low.** All were judged valid on the merits and applied:

| Finding | Change |
|---|---|
| H1 Claiming off-platform records with a demo OTP lets anyone read a counterparty's history | Headline 9; decision 13; claim slice depends on real phone verification |
| H2 "One login per business" contradicts the research (supervisors record) and breaks the audit trail | Decision 11 changed to a minimal staff identity in v1; every event stores who recorded it |
| H3 Scenario F didn't conserve (3 kits missing); Scenario R issued buttons to the wrong unit | Both fixed; rule added: every scenario must close to zero |
| H4 Owner/custodian/accountable breaks when ownership changes in place or the job worker uses its own material | §6 row 1 rewritten as custody *relations*; "job worker's own material" receipt line |
| H5 No transit custody or transporter loss/detention | Scenario T; in-transit custody relation |
| H6 No physical count, adjustment or unit slip | Scenario U; insight 12 (count adjustment + plausibility checks) |
| M7–M13 Missing cancellation, rate change, consignment, held-for-dues/netting, stock lot, coordinator, multi-premises, upstream fault, purchase return, packs/samples; research scenarios dropped silently | Scenarios V–AD; E2 (spec change) and H2 (10-month leftover) variants |
| M14 FIFO matching conflicts with lot segregation | Match by spec + lot first, FIFO only as tie-break; ITC-04 allocation kept separate from lineage |
| M15 "One bucket in the input's unit" breaks with gains, over-cutting and multi-input steps; cutting residual was a plug | §6 row 6: conserve per input line; gains allowed and flagged; explicit unaccounted residual; output vs planned yield |
| M16 Process types lacked rate basis, conservation kind, ITC-04 code | §6 row 5: small fixed enums in code, instances as data |
| M17 Over-confident tags (40–60 % WIP, batch mixing, waste price, loss figures) | Downgraded/reconciled; batch mixing added to field questions |
| M18 0.5 % weighing tolerance would fire on almost every hop | ±1.5 % default for weighed goods, 0 for counted, learned per counterparty; Scenario K numbers changed |
| M19 Leftovers kept/adjusted and waste sold are taxable events | Flagged in §3 and Scenario H |
| M20 Printable DC: duplicate series, unregistered owners, offline serials | Decision 3: record existing DC + photo by default; generated DC only on a chosen series, registered owners, online |
| M21 Share link: 30-day expiry, one link per movement, job worker can't report returns, manual sends | Decision 6: standing per-counterparty statement link, job-worker-proposed returns, bulk send |
| M22 Voice/photo capture, capacity search, running low, WIP value, DPDP not addressed | §8b with the phase where each is designed |
| L23 Arithmetic/consistency (Q dates, J ratio, C yarn lots, learning key, G in v1) | Fixed; learning keyed by counterparty + process + material class; G's UI moved to v1.1 |
| L24 GST spot-checks confirmed; TN exemption wording ("services" vs goods) | Added to CA questions |
