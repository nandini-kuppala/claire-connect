# Lead times, turnaround, process loss and job-work rates (Tiruppur knitwear)

Research note for CLAIRE Connect supply-chain tracking (Phase 1). Written 2026-11-20.
Purpose: realistic defaults for built-in process templates (expected turnaround, loss norm, rate) and demo seed data, plus "late" and "abnormal loss" flag bands.

## How to read this

- **[verified]**: the number appears in a dated, reasonably authoritative source (trade press, government, association statement) that I read.
- **[likely]**: consistent across several secondary sources or practitioner guides, or derived from a verified number by simple arithmetic. Not Tiruppur-specific in every case.
- **[uncertain]**: practitioner or industry estimate, a single marketplace listing, or my own synthesis of how the cluster works. Use for defaults only, and let per-counterparty history replace it quickly.

**Main finding: almost nothing about turnaround or loss is published for Tiruppur specifically.** Associations publish rate *changes* (for example, "+₹10/15/20 per kg"), not rate cards. Published loss figures come from generic or Bangladesh knit-costing guides. So every default below is a starting point that the learning mechanism must overwrite. That is exactly why per-counterparty learning matters. Recommended defaults are in section (c).

Units: turnaround is in calendar days from dispatch to the first full receipt for a "normal" lot. Normal lots are 300–1,500 kg of fabric, or 1,000–5,000 pieces. Loss % is **weight in minus weight out, divided by weight in** for kg processes, and **rejects divided by pieces in** for piece processes. Rates are job-work charges excluding GST, for 2024–26.

---

## (a) Process table: turnaround, loss, rate

| Process (input → output) | Turnaround days, min / typical / max | Loss %, min / typical / max | Typical rate (₹, unit) | Confidence | Notes and sources |
|---|---|---|---|---|---|
| **Circular knitting** (yarn → grey fabric, job work) | 2 / 4 / 10 | 0.5 / 1.5 / 3 | Single jersey 24–28G: ₹8–16/kg. Rib/lycra: ₹18–30/kg. Interlock: ₹20–40/kg. 3-thread fleece: ₹20–35/kg. | Rate [likely] (listings); turnaround and loss [likely] | Knitting loss is "normally 2%" in knit costing ([Textile Blog / costing guides via search, n.d.](https://www.textileblog.com/wastage-calculation-in-apparel-industry/)). Tiruppur listings: ₹8/kg for 24/28GG, ₹14/kg for 24GG, ₹40/kg for interlock 160–320 GSM, ₹13/m for hosiery ([IndiaMART Tiruppur knitting job work, accessed 2026-11](https://dir.indiamart.com/tiruppur/knitting-job-work.html)). Knitting associations pushed a 20–25% per-kg hike after a strike over overheads; date unclear, about 2022 ([DT Next](https://www.dtnext.in/amp/story/news/tamilnadu/strike-tirupur-units-incur-rs-200-cr-loss)) [uncertain]. One machine makes roughly 150–400 kg/day depending on count and dia. Queue time, not machine time, drives turnaround [uncertain]. |
| **Yarn dyeing** (grey yarn → dyed yarn, cone or hank) | 7 / 12 / 21 | 3 / 5 / 8 | ₹80–180/kg by shade and count | [uncertain] | Includes lab-dip approval (2–5 days) if the shade is new. Costing guides put total process loss for yarn-dyed fabric at 12–15%, against 8–10% for solid dyeing ([costing summary via search](https://www.onlineclothingstudy.com/2015/10/product-and-process-costing-in-garment.html)) [likely]. That figure covers more than the yarn-dyeing step. Few Tiruppur yarn dyers; much yarn dyeing is done in Erode, Karur and Salem [uncertain]. |
| **Fabric dyeing, solid** (grey → dyed, dried, tubular compacted; the standard "dyeing" job) | 4 / 7 / 15 (normal); 30–40 in a capacity crisis | White/bleach 6–9; light 6–9; medium 7–10; dark 8–12; 100% polyester 2–4; PC/melange 4–7. **Typical 8** | Cluster average about **₹60/kg** (derived). By shade (estimates): white/bleach ₹45–60, light ₹55–70, medium ₹65–85, dark (navy/black/red) ₹75–105, special (turquoise, fluorescent, lycra, reactive black) ₹100–140. Rising through 2026. | Average [likely]; shade ranges [uncertain]; 2026 hikes [verified] | Solid-dyeing process loss 8–10% in knit costing guides [likely]. Derived average: 2,800 t/day of fabric dyed, with dyeing charges of about ₹16.8 cr/day ([Apparel Resources, 2026-10-07](https://in.apparelresources.com/business-news/manufacturing/tirupur-dyeing-units-shut-operations-soaring-dye-chemical-prices/); [DT Next, 2026-10-06](https://www.dtnext.in/news/tamilnadu/tirupur-dyeing-units-halt-operations-against-soaring-price-of-raw-materials)) works out to about ₹60/kg. Dyers Association of Tiruppur (DAT) raised rates by ₹10 (light), ₹15 (medium) and ₹20 (dark) per kg ([Apparel Resources, 2026-05-05](https://apparelresources.com/business-news/trade-business-news/tirupur-hit-sharp-yarn-price-surge/)) [verified]. A further +₹7/15/25 effective 2026-09-15 is claimed only in an unverified LinkedIn post [uncertain]. Dye and chemical prices rose more than 100% (2026), and 460 units struck for a day on 2026-10-05 [verified]. Single listing: ₹63/kg, 300 kg minimum ([IndiaMART Tiruppur, accessed 2026-11](https://dir.indiamart.com/tiruppur/cotton-fabric-dyeing-service.html)). Historical: bleach ₹70–80/kg and black ₹100–120/kg during the 2011 closures ([DNA, 2011](https://www.dnaindia.com/business/report-dyeing-costs-shoot-up-30-as-700-tirupur-units-shut-shop-1528343)). Dyeing lead time went from 10–12 days to 30–40 days when units shut ([DNA, 2011](https://www.dnaindia.com/business/report-dyeing-costs-shoot-up-30-as-700-tirupur-units-shut-shop-1528343)) [verified, historical]. |
| **Compacting** (tubular or open-width, if billed separately) | 1 / 2 / 4 | 0.5 / 1 / 2 (open-width slitting and edge trim: 1–3) | Tubular ₹5–10/kg; open-width ₹8–14/kg | [uncertain] | Often bundled into the dyeing job and quoted as one price. Compacting raises GSM by about 10–15% through overfeed ([GSM study, Scribd, n.d.](https://www.scribd.com/document/486224346/GSM-Study)), so it changes length but not weight. Weight loss is small. |
| **Raising / brushing** (fleece, loop-back) | 1 / 3 / 5 | 2 / 4 / 7 (fly loss) | ₹10–20/kg | [uncertain] | Separate "raising" units exist in Tiruppur (for example, "Sri Krishna Raising" and "Shri Shivam Raising" on [IndiaMART](https://dir.indiamart.com/tiruppur/knitting-job-work.html)). |
| **Fabric printing, all-over** (rotary or table on fabric) | 3 / 7 / 14 | 2 / 3 / 5 | ₹30–80/kg or per metre equivalent, by colours and coverage | [uncertain] | Add 2–4 days for strike-off approval. Costing guides say allow higher wastage than the 9% knit baseline for AOP and rotary print ([ORDNUR](https://ordnur.com/industrial-engineering-ie/costing-of-knit-garments/)). |
| **Panel printing** (screen print on cut panels, chest or back) | 2 / 4 / 8 | 0.5 / 1.5 / 3 (pieces) | ₹2–6 per colour per piece for a small placement print; ₹8–25 per piece for large, puff, HD or foil | [uncertain] | About 400 printing job-work units in Tiruppur ([Apparel Resources](https://apparelresources.com/business-news/sourcing/tirupur-enough-scope-for-all-kinds-of-printing)). A buyer-facing guide quotes screen print at $0.15–0.30 per shirt plus $15–30 setup ([Modaknits, 2025-08](https://modaknits.com/?p=65038)). Setup per colour (screen) is often charged separately. |
| **Embroidery** (computerised, on panels) | 2 / 4 / 7 | 0.5 / 1 / 2 (pieces) | Small chest logo (5–8k stitches) ₹3–10 per piece; or about ₹0.5–1.2 per 1,000 stitches | [uncertain] | No Tiruppur per-stitch rate is published. Buyer-facing guides say $0.60–1.20 per piece including setup ([Modaknits, 2025-08](https://modaknits.com/?p=65043)). |
| **Cutting** (fabric kg → panels, pieces) | 1 / 2 / 4 (per 1,000–3,000 pcs) | Fabric not in panels: 8 / 12 / 18. Basic tee 5–8 to 10; multi-panel 15–20 | ₹1–3 per piece (tee), or ₹3–6/kg | Loss [likely]; rate [uncertain] | Cutting loss 5–8% for a basic T-shirt and 15–20% for multi-panel garments; "flat cutting loss 8%" in costing guides ([costing guides via search](https://www.textileblog.com/wastage-calculation-in-apparel-industry/)). Knit marker efficiency benchmark is 85–92% (practitioner post, unsourced) [uncertain]. Tubular layouts increase edge waste. End bits use about 2 cm per ply end. |
| **Stitching** (panels + trims → garments) | 3 / 5 / 10 for 1,000–5,000 pcs; 1–2 line-days per 1,000 basic tees | Alteration / rework 2 / 4 / 8; final reject 0.5 / 1 / 2 | Basic round-neck tee ₹10–18 per piece (domestic), ₹15–25 (export quality); polo ₹25–45; track pant ₹15–30; hoodie or sweatshirt ₹35–60 | [uncertain] | One Tiruppur listing: T-shirt stitching ₹45/pc, small-lot CMT ([IndiaMART Tiruppur, accessed 2026-11](https://dir.indiamart.com/tiruppur/stitching-services.html)). Delhi ₹25/pc and Surat ₹40–55/pc listings. These are marketplace asking prices and run high for bulk. Basic tee SMV is about 6–8 minutes, so a 35-operator line makes roughly 1,200–1,500 tees per day at 60% efficiency [uncertain]. Tiruppur tailors earn about ₹15–20k a month ([Quikr listings 2025–26](https://www.quikr.com/jobs/tailor-job+tirupur+zwqxj4157493934)). |
| **Checking, ironing, packing** | 1 / 2 / 4 | B-grade 1 / 2 / 4; unrepairable reject 0.2 / 0.5 / 1 | Checking ₹0.5–1.5, ironing ₹1–2.5, fold and polybag ₹1–2 per piece; combined ₹3–6 per piece | [uncertain] | Packing material is billed separately. |
| **Garment washing** (enzyme or silicone softener) | 2 / 4 / 7 | 1 / 2 / 5 (pieces); garments also shrink 2–5% | ₹8–25 per piece | [uncertain] | Pigment-dyed or garment-dyed goods have a "very high" reject rate; add 25–30% fabric allowance ([ORDNUR](https://ordnur.com/industrial-engineering-ie/costing-of-knit-garments/)) [likely]. |

### Overall yield (yarn → packed garment)

Compounding typical losses (knit 2% → dye 8% → compact 1% → cut 12% → stitch and check 2%) gives a yield of 0.98 × 0.92 × 0.99 × 0.88 × 0.98 ≈ **0.77**. So about **23% of yarn weight** does not end up in first-quality garments [likely]. Costing guides give an additive 20–21% and recommend compounding stage by stage ([costing summary via search](https://collectivestudioltd.com/resources/fabric-consumption-calculator)). For the fabric-in-hand to garment step alone, use **85–90%**, plus a separate 1–3% for rejects.

**Excess cutting allowance:** cut **2–3%** over order quantity for domestic basics, **3–5%** for export or with print and embroidery, and more for garment-dyed goods [uncertain; common practice, not published for Tiruppur].

**Measurement noise, which matters for flags:** cotton regain is about 8.5%. Grey fabric weighed damp, or finished fabric weighed straight off the dryer, can swing apparent loss by ±2–3 points. Roll tare (cores, polybags) adds about 0.5–1%. A recorded dyeing loss of 3% or 15% is more often a weighing or recording problem than a real process result [likely].

---

## (b) Procurement lead times (buying ready material)

Measured from order or confirmation to goods at the buyer's unit, within Tiruppur.

| Item | Source type | Lead time, min / typical / max (days) | Confidence | Notes |
|---|---|---|---|---|
| Cotton hosiery yarn, standard counts (20s–40s combed or carded) | Yarn trader / agent (stock) | 0 / 1 / 3 | [uncertain] | Traders hold stock and deliver same or next day. Prices move monthly: combed 10s–40s ₹224–352/kg, May 2026 ([Apparel Resources, 2026-05-05](https://apparelresources.com/business-news/trade-business-news/tirupur-hit-sharp-yarn-price-surge/)) [verified]. |
| Same yarn, direct from spinning mill | Mill | 3 / 7 / 15 | [uncertain] | Mills often want advance payment or tight terms. In 2025 traders cut credit because of payment stress ([Fibre2Fashion, 2025](https://www.fibre2fashion.com/news/textile-news/cotton-yarn-demand-slows-in-south-india-amid-payment-woes-300940-newsdetails.htm)) [verified]. |
| Special yarn (melange, slub, organic/GOTS, lycra-core, specific lot) | Mill | 7 / 15 / 30 | [uncertain] | |
| Polyester / PC yarn | Trader or mill | 1 / 3 / 10 | [uncertain] | Polyester yarn rose 35% in 15 days in spring 2026, so expect volatility ([Apparel Resources, 2026-05](https://apparelresources.com/business-news/trade-business-news/tirupur-hit-sharp-yarn-price-surge/)). |
| Grey fabric, standard construction (from stock) | Knitter or grey-fabric trader | 1 / 2 / 4 | [uncertain] | If knitted to order, use the knitting turnaround plus yarn lead time. |
| Ready dyed fabric, stock colour | Fabric shop | 0 / 1 / 3 | [uncertain] | Typical in Scenario A: the shop holds dyed stock. |
| Dyed fabric, dyed to order | Fabric shop (outsources the dyeing) | 7 / 12 / 20 | [uncertain] | Shop's knitting (if needed) plus dyeing turnaround plus handling. |
| Sewing thread, standard shades (cones) | Local trims shop | 0 / 0 / 1 | [uncertain] | |
| Sewing thread, dyed to match | Thread company dealer | 3 / 5 / 10 | [uncertain] | |
| Buttons, zips (stock) | Local trims shop | 0 / 1 / 3 | [uncertain] | Branded or custom zips: 10–20 days. |
| Elastic (stock widths) | Local elastic maker or shop | 1 / 2 / 5 | [uncertain] | Custom jacquard or logo elastic: 7–15 days. |
| Woven / main labels, made to order | Label maker | 5 / 8 / 14 | [uncertain] | Add 2–4 days for artwork and sample approval on a first order. |
| Printed care / size labels, hang tags | Label or tag printer | 3 / 5 / 10 | [uncertain] | |
| Plain polybags | Packing-material shop | 0 / 1 / 3 | [uncertain] | |
| Printed polybags (brand print) | Polybag manufacturer | 7 / 10 / 20 | [uncertain] | Cylinder or plate making for a first order adds time. |
| Cartons, stock size | Carton shop | 1 / 2 / 4 | [uncertain] | |
| Cartons, custom size or printed | Corrugated box maker | 4 / 7 / 12 | [uncertain] | |

### Credit and payment terms (for context; not used for dates)

- **Statutory:** buyers must pay micro and small suppliers within 45 days of acceptance when there is a written agreement, and 15 days without one (MSMED Act s.15). Since 1 April 2024, unpaid amounts past that are disallowed as a tax deduction under Income Tax s.43B(h) ([Tally, n.d.](https://tallysolutions.com/accounting/section-43b-h-msme-payment-rules-compliance/); [KPMG, 2024-06](https://assets.kpmg.com/content/dam/kpmg/in/pdf/2024/06/boards-imperative-in-implementing-clause-h-under-section-43b-for-msmes.pdf)) [verified]. An illustrative Tiruppur analysis (2026-07) models about 85% of job-work bills paid within 45 days ([Terra Insight](https://www.terra-insight.com/insights/tiruppur-knitwear-cluster-reconciliation-msme-msme43bh)) [uncertain; illustrative].
- **Practice** [uncertain]:
  - Stitching fabricators pay workers weekly, so they want weekly or fortnightly settlement, often with an advance.
  - Knitting and dyeing job work is usually settled 15–45 days after delivery. Dyers may hold goods until old dues are cleared.
  - Fabric shops and yarn traders give 30–60 days, and up to 90 to trusted buyers.
  - Mills want advance payment, or 0–15 days.
  - Credit tightens when yarn prices spike.

---

## (c) Recommended DEFAULT values for built-in process templates

Design rules behind the numbers:

1. **Expected date = dispatch date + default turnaround** (processing), or **order date + default lead time** (procurement). Default turnaround is the *typical* figure, rounded up a little, because SMEs quote optimistic dates.
2. **"Late" flag:** raise "due soon" one day before the expected date. Raise **late** when the expected date passes with quantity still pending. Raise **very late** once the expected date plus the tolerance band passes. The band absorbs normal variance so the screen does not turn red every week.
3. **Loss flags:** compare against the norm **only after the lot is closed** (fully received, or explicitly closed). Flag **abnormal loss** above norm + band. Flag **suspiciously low** below the low threshold. That usually means a weighing error, moisture, or an unrecorded partial; ask for a re-check, not blame.
4. **Learning:** after **3 or more closed lots** with the same counterparty and process, use a blend, `default = (n·median_history + k·template) / (n + k)` with k = 3. Recompute the band from that counterparty's spread, clamped to at least the template band. Use the median, not the mean, so one disaster lot does not shift the default.
5. Defaults are **per material type where it matters**: dyeing loss by shade class, and stitching rate by style.

| Template | Unit basis | Default turnaround / lead (days) | "Very late" band | Loss norm (%) | Abnormal-loss flag above | Suspiciously-low flag below | Default rate (₹, demo only) | Rationale |
|---|---|---|---|---|---|---|---|---|
| Knitting (yarn → grey) | kg | 5 | +3 days | 1.5 | 3.5 | 0.2 (or a gain) | 12/kg (single jersey) | A queue of a few days is normal; real loss is small. A gain usually means added moisture. |
| Yarn dyeing | kg | 12 | +5 days | 5 | 9 | 1.5 | 120/kg | Lab dip plus batch; fewer local vendors. |
| Fabric dyeing, white/bleach | kg | 6 | +3 days | 7 | 11 | 3 | 55/kg | Bleaching removes impurities. |
| Fabric dyeing, light/medium | kg | 7 | +4 days | 8 | 12 | 3 | 70/kg | Midpoint of 8–10% costing norms, rounded down for Tiruppur reactive dyeing on combed cotton. |
| Fabric dyeing, dark/special | kg | 8 | +5 days | 9 | 13 | 4 | 90/kg | Longer cycles and more shade corrections. |
| Fabric dyeing, polyester/PC | kg | 7 | +4 days | 4 | 7 | 1 | 75/kg | Low fibre weight loss. |
| Compacting (standalone) | kg | 2 | +2 days | 1 | 3 | 0 | 8/kg | Usually bundled into dyeing. Offer as an optional step. |
| Raising / brushing | kg | 3 | +2 days | 4 | 8 | 1 | 15/kg | Fly loss. |
| AOP fabric printing | kg | 8 | +4 days | 3 | 6 | 0.5 | 50/kg | Strike-off approval drives the time. |
| Panel printing | pcs | 4 | +3 days | 1.5 (rejects) | 4 | — | 4 per piece per colour | |
| Embroidery | pcs | 4 | +3 days | 1 (rejects) | 3 | — | 6 per piece (small logo) | |
| Cutting | kg in → pcs out | 2 | +2 days | 12 (fabric not in panels) | 18 | 6 | 2 per piece | The template should express output as an **expected piece yield per kg** (consumption per piece), not only loss %. Flag when actual pieces are more than 5% below expected. |
| Stitching | pcs | 6 (per 1,000–3,000 pcs; add 1 day per extra 1,500) | +4 days | Final reject 1; returned for rework 4 | Reject over 3, or rework over 10 | — | Tee 13, polo 32, track pant 22, hoodie 45 (per piece) | Partial deliveries are normal. Measure turnaround to the **last** receipt, and show the first-receipt date too. |
| Checking / ironing / packing | pcs | 2 | +2 days | B-grade 2 | 5 | — | 4 per piece (combined) | |
| Garment washing | pcs | 4 | +3 days | 2 (rejects) | 5 | — | 15 per piece | |
| **Procurement:** yarn from trader | kg | 1 | +2 days | — | — | — | — | |
| **Procurement:** yarn from mill | kg | 7 | +5 days | — | — | — | — | |
| **Procurement:** ready dyed fabric from fabric shop | kg | 1 | +2 days | — | — | — | — | |
| **Procurement:** grey fabric | kg | 2 | +2 days | — | — | — | — | |
| **Procurement:** stock trims (thread, buttons, zips, elastic, plain polybags, stock cartons) | various | 1 | +2 days | — | — | — | — | |
| **Procurement:** made-to-order labels / tags | pcs | 8 | +4 days | — | — | — | — | |
| **Procurement:** printed polybags / printed cartons | pcs | 10 | +5 days | — | — | — | — | |

Additional defaults:
- **Excess cutting allowance:** default **3%**, editable per order (2% for domestic basics, 5% when decorated).
- **Fabric planning yield (fabric kg → first-quality pieces):** derive it from consumption per piece and apply a 12% cutting loss plus 1% stitching reject. Do not use a single garment-level percentage.
- **Holiday-aware expected dates:** skip Sundays for piece processes (stitching, checking), and skip the festival windows in section (d). Dyeing and knitting run seven days a week, so count calendar days for them.
- **Rework loop:** expected return for a reworked lot = **3 days** for stitching alteration; **4 days** for dyeing shade correction (topping or adding); **7 days** for strip and re-dye. Re-dyeing adds an extra **2–4% loss** and must be recorded as a separate loss event, not merged into the first one.

### Reject and rework practice (shade, re-dye)

- **Right first time (RFT) for reactive dyeing** is commonly 65–80% of batches. Mills with good process control get above 90% ([iFactory, vendor blog, n.d.](https://ifactoryapp.com/industries/textile-manufacturing/right-first-time-dyeing-rft-improvement)) [uncertain; vendor source]. So **20–35% of dye batches need some correction**, mostly in-house additions (topping) that the principal never sees. The share of lots **rejected by the principal** after delivery for shade is lower: an estimated **3–10% of lots**, higher for dark and special shades and for repeat orders matched to an old lot [uncertain; practitioner estimate].
- One dyehouse case study measured reject material at 10.2% of mass, reduced to 7.9% ([UCT case study](https://open.uct.ac.za/server/api/core/bitstreams/40885086-4198-492c-ae67-7341a4d84135/content)) [uncertain; not Tiruppur].
- **Cost of re-dyeing:** a reworked batch costs about 98–169% more than the original dyeing (research cited in a LinkedIn post) [uncertain].
- **Who pays (Tiruppur practice)** [uncertain]:
  - Shade off from the approved lab dip: the dyer re-processes free, but the principal bears the extra weight loss in practice. This is the usual dispute.
  - Shade changed by the principal, or a grey-fabric fault (holes, yarn contamination): the principal pays a re-process charge, typically 50–100% of the original rate.
  - Stripping and re-dyeing to a darker shade: charged as a fresh job.
- **Product implication:** model the shade rejection as a return movement that goes back to the dyer as rework, with its own expected date and loss. Do not edit the original receipt. Track **re-dye rate per dyer** (lots reworked divided by lots delivered) as a performance metric.

---

## (d) Delay causes and seasonality

### Recurring delay causes (what to let users tag on a late item)

1. **Dyeing capacity and ZLD constraints.**
   - Tiruppur has about 400–460 dyeing units on 18 CETPs plus about 100 individual ETPs, processing about 1,800–2,800 t/day ([Apparel Views, 2018](https://www.apparelviews.com/tirupur-garment-makers-shifting-mysuru-fabric-dyeing/); [Apparel Resources, 2026-10](https://in.apparelresources.com/business-news/manufacturing/tirupur-dyeing-units-shut-operations-soaring-dye-chemical-prices/)) [verified].
   - When a CETP is down or over capacity, all member dyers stop together. The 2011 court-ordered closures pushed dyeing lead times from 10–12 days to 30–40 days, and 25–30% of garments were airlifted between 2011 and 2014 [verified, historical].
   - ZLD compliance costs about ₹3/kg of fabric (5.5 MLD CETP case study, n.d.) [uncertain]. Some fabric moves to non-compliant processors elsewhere (for example, around Mysuru) to save about 20% ([Apparel Views, 2018](https://www.apparelviews.com/tirupur-garment-makers-shifting-mysuru-fabric-dyeing/)) [verified].
2. **Input-cost shocks and strikes.**
   - 2026: West Asia crisis, LPG shortage (dyehouses rely on LPG for about 50% of fuel), and dye and chemical prices up more than 100%.
   - A 460-unit dyeing strike on 2026-10-05 [verified]. Rate revisions follow these shocks.
   - Yarn price spikes cause knitwear units to halt production. There was a 6-day halt in 2021–22 ([Apparel Resources](https://apparelresources.com/business-news/trade/yarn-prices-hiked-rs-40-per-kg-apparel-exporters-reiterate-banning-cotton-cotton-yarn-exports/)) [verified].
3. **Labour availability.**
   - Migrants (largely from north India) take about a month around Deepavali. In 2019 only 30–40% had returned weeks later, and the labour shortage was "pegged at about 40%" ([DT Next, 2019-11-04](https://www.dtnext.in/news/tamilnadu/workers-long-holidays-hit-tirupur-garment-units)) [verified, 2019].
   - Holi takes about 2 extra weeks.
   - In April–May 2026, elections cut output about 40% ([DT Next, 2026-05-01](https://www.dtnext.in/amp/story/news/tamilnadu/raw-material-price-spike-labour-crunch-push-tirupur-garment-output-down-40)) [verified].
   - Stitching and checking are hit hardest. Dyeing and knitting are less affected.
4. **Rain and drying.**
   - Dyed fabric is often dried in open yards or drying sheds. Fabric from out-of-town dyers is trucked back to Tiruppur for drying ([Apparel Views, 2018](https://www.apparelviews.com/tirupur-garment-makers-shifting-mysuru-fabric-dyeing/)).
   - The north-east monsoon (Oct–Dec) and cyclones slow drying and transport. Rain has damaged stored garments (SIPCOT, 2015) and port-bound shipments ([inkl / The Hindu](https://inkl.com/news/rain-affects-tiruppur-garment-shipments-in-thoothukudi)) [verified that it happens; impact in days uncertain].
5. **Shade re-dyes and lab-dip approvals:** add 3–7 days per round (section c).
6. **Power:** Tamil Nadu scheduled power cuts are much less severe than in 2008–2014. Disruption today is mostly local outages and tariff pressure; units run diesel generators [uncertain]. Low priority as a tagged cause.
7. **Payment holds:** job workers delay delivery, or hold goods, until old dues are paid [uncertain; common practice].
8. **Queueing behind bigger customers:** small principals lose their slot in peak season [uncertain].

### Seasonality calendar (for adjusting expected dates)

| Window (approx.) | Effect | Suggested default adjustment |
|---|---|---|
| Deepavali (Oct/Nov; 8 Nov 2026) through about 3 weeks after | Units close 3–7 days; migrant labour away up to a month | Stitching and checking turnaround +7 to +10 days. Dyeing and knitting +3 to +5 days. |
| Ayudha Pooja / Vijayadashami (Oct) | 1–2 days closed | +2 days |
| Pongal (about 14–17 Jan) | Local workers off 3–5 days. Some southern-district workers away from Deepavali until Pongal. | +4 to +5 days for all processes |
| Holi (Mar) | North-Indian migrants away 2–3 weeks | Stitching +5 to +7 days |
| Aug–Oct (pre-Deepavali domestic peak) | Dyeing and stitching capacity tight; small lots queue | +2 to +3 days for dyeing and stitching |
| Oct–Dec (north-east monsoon) | Drying and transport delays | +1 to +2 days for dyeing and raising |
| Elections, strikes, CETP closures | Ad hoc | Manual "cluster event" banner that shifts open expected dates |

Product suggestion: ship a small **editable holiday and event calendar** per region (Tiruppur default). Expected dates are computed in working days per process type (seven days a week for wet processing and knitting, six days for piece processes). A cluster-wide event, such as the 2026-10-05 dyeing strike, can be applied once and shifts every open dyeing expected date.

---

## (e) Sources

Dated, primary or trade press:
- Apparel Resources, "Tirupur hit by sharp yarn price surge," 2026-05-05: DAT +₹10/15/20 per kg; TIDGMA +5%; yarn ₹224–352/kg. https://apparelresources.com/business-news/trade-business-news/tirupur-hit-sharp-yarn-price-surge/
- Apparel Resources, "Tirupur dyeing units shut operations over soaring dye/chemical prices," 2026-10-07: 460 units, 2,800 t/day, ₹16.8 cr/day. https://in.apparelresources.com/business-news/manufacturing/tirupur-dyeing-units-shut-operations-soaring-dye-chemical-prices/
- DT Next, "Tirupur dyeing units halt operations…," 2026-10-06. https://www.dtnext.in/news/tamilnadu/tirupur-dyeing-units-halt-operations-against-soaring-price-of-raw-materials
- Apparel Views, Oct 2026 dyeing shutdown (via search). https://www.apparelviews.com/tirupur-dyeing-units-shut-down-over-soaring-raw-material-costs/
- DT Next, "Raw material price spike, labour crunch push Tirupur garment output down 40%," 2026-05-01. https://www.dtnext.in/amp/story/news/tamilnadu/raw-material-price-spike-labour-crunch-push-tirupur-garment-output-down-40
- DT Next, "Workers' long holidays hit Tirupur garment units," 2019-11-04. https://www.dtnext.in/news/tamilnadu/workers-long-holidays-hit-tirupur-garment-units
- DNA India, "Dyeing costs shoot up 30% as 700 Tirupur units shut shop," 2011. https://www.dnaindia.com/business/report-dyeing-costs-shoot-up-30-as-700-tirupur-units-shut-shop-1528343
- Apparel Views, "Tirupur garment makers shifting to Mysuru for fabric dyeing," 2018-03-07. https://www.apparelviews.com/tirupur-garment-makers-shifting-mysuru-fabric-dyeing/
- Textile Excellence, "Tiruppur on Edge," 2026 (seen in search results only; certificate error on fetch). https://textileexcellence.com/single-news/6842/tiruppur-on-edge
- Apparel Resources, yarn price hike and production halt (2021–22). https://apparelresources.com/business-news/trade/yarn-prices-hiked-rs-40-per-kg-apparel-exporters-reiterate-banning-cotton-cotton-yarn-exports/
- DT Next, knitting units' strike and 20–25% job-charge hike (undated, about 2022). https://www.dtnext.in/amp/story/news/tamilnadu/strike-tirupur-units-incur-rs-200-cr-loss
- Fibre2Fashion, South India cotton yarn payment stress, 2025. https://www.fibre2fashion.com/news/textile-news/cotton-yarn-demand-slows-in-south-india-amid-payment-woes-300940-newsdetails.htm
- KPMG, Section 43B(h) note, 2024-06. https://assets.kpmg.com/content/dam/kpmg/in/pdf/2024/06/boards-imperative-in-implementing-clause-h-under-section-43b-for-msmes.pdf
- Terra Insight, Tiruppur cluster MSME 43B(h) reconciliation (illustrative), 2026-07-06. https://www.terra-insight.com/insights/tiruppur-knitwear-cluster-reconciliation-msme-msme43bh
- Singhania, M., "Who Pays When Shared Infrastructure Fails? ZLD … Textile and Tannery Clusters," arXiv 2609.32377, 2026 (abstract only; CETP under-utilisation raises cost). https://arxiv.org/abs/2609.32377

Marketplace listings (asking prices, single suppliers, accessed 2026-11):
- IndiaMART Tiruppur knitting job work. https://dir.indiamart.com/tiruppur/knitting-job-work.html
- IndiaMART Tiruppur cotton fabric dyeing service. https://dir.indiamart.com/tiruppur/cotton-fabric-dyeing-service.html
- IndiaMART Tiruppur stitching services / garment job work. https://dir.indiamart.com/tiruppur/stitching-services.html, https://dir.indiamart.com/tiruppur/garment-job-work.html
- Quikr Tiruppur tailor jobs (wages), 2025–26. https://www.quikr.com/jobs/tailor-job+tirupur+zwqxj4157493934

Secondary and costing guides (generic or Bangladesh; used for loss norms):
- ORDNUR, "Costing of knit garments." https://ordnur.com/industrial-engineering-ie/costing-of-knit-garments/
- Online Clothing Study, product and process costing. https://www.onlineclothingstudy.com/2015/10/product-and-process-costing-in-garment.html
- Textile Blog, wastage calculation in the apparel industry. https://www.textileblog.com/wastage-calculation-in-apparel-industry/
- Collective Studio, fabric consumption calculator (compounded losses). https://collectivestudioltd.com/resources/fabric-consumption-calculator
- Modaknits, Tirupur T-shirt cost guides, 2025-08. https://modaknits.com/?p=65038, https://modaknits.com/?p=65043
- Apex Fashion Lab, garment dyeing guide, 2026 (Tirupur reactive dyeing $1–3/kg; garment dyeing). https://www.apexfashionlab.com/glossary/garment-dyeing
- iFactory, RFT dyeing (vendor). https://ifactoryapp.com/industries/textile-manufacturing/right-first-time-dyeing-rft-improvement
- UCT dyehouse case study (reject mass 10.2% → 7.9%). https://open.uct.ac.za/server/api/core/bitstreams/40885086-4198-492c-ae67-7341a4d84135/content
- GSM study, grey to finished (Scribd). https://www.scribd.com/document/486224346/GSM-Study

### Gaps and how to close them

- No published Tiruppur rate card for knitting, compacting, printing, embroidery, cutting or stitching. **Validate with 3–5 phone calls** (a dyer, a knitter, a stitching fabricator, a fabric shop) before treating the defaults as more than [uncertain]. The user's father's own records are the best first source.
- The BEE Tiruppur cluster PDF (2018) and the CPCB Tiruppur ZLD assessment could not be text-extracted here. They may hold batch cycle times.
- Dyeing loss by shade is industry folklore, not measured data. The learning mechanism should treat it as a weak prior (k = 3).
