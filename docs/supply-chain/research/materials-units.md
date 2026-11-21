# Materials, attributes and units per stage

**Phase 1 research input for CLAIRE Connect supply-chain tracking.** Researched 2026-11-20.

**Confidence tags.** Every claim carries one:
- **[verified]**: a cited source states it directly.
- **[likely]**: consistent with cited sources or standard textile practice, but not stated exactly for Tiruppur.
- **[uncertain]**: rough, derived by us, or found only in seller listings. Confirm with real Tiruppur users before using it as a default.

"Derived" means we did the arithmetic ourselves. The working is shown.

**Source quality.** No primary Tiruppur source (SITRA, TEA, Dyers Association) published the process-loss, roll-weight or piece-rate figures we were looking for. Most numbers below come from textbooks-by-proxy (Textile Learner, Online Clothing Study, Coats/Amann technical notes), BIS documents, Fibre2Fashion market reports and IndiaMART listings. **Treat every default number as a seed value the user can override, never as a rule.**

---

## (a) Attribute schemas per material type (built-in templates)

**Conventions.**
- **Types:** `enum` (allows a custom value), `number(unit)`, `text`, `percent`, `composition` (a list of {fibre, %} summing to 100), `ref` (a link to another record), `bool`, `date`.
- **Req:** R = required, O = optional, C = conditional (required when another attribute has a certain value).
- **Spec vs lot.** Attributes marked *(spec)* define what the material **is**. They form part of the SKU/variant key, so two stocks with different values must never be merged. Attributes marked *(lot)* identify **which physical batch** it is. Stock with the same spec but a different lot can be listed together, but it must stay traceable and must not be mixed silently in a production order (shade/lot segregation).
- **Quantity measures.** Each template declares a **base unit** (the stock unit) and the **allowed alternate units** (see section b).

### A1. Yarn

**Base unit:** kg. **Alternate units:** bag, cone (contextual).

| Attribute | Type | Example values | Req | Notes |
|---|---|---|---|---|
| fibre_composition *(spec)* | composition | 100% cotton; 65/35 poly/cotton (PC); 60/40 CVC; 50/50 cotton/modal; 92/8 cotton/spandex (core-spun) | R | Blends are expressed as %. Sold "excluding GST" per kg [verified, [F2F Jun-2025 Tiruppur yarn prices](https://www.fibre2fashion.com/news/textile-news/south-indian-cotton-yarn-prices-steady-exporters-gain-from-weak-inr-303447-newsdetails.htm)]. |
| count_system *(spec)* | enum | Ne (cotton count, spun yarns); denier (D, filament: polyester, nylon, spandex); tex; Nm | R | Ne is indirect (higher = finer). Denier/tex are direct (higher = coarser) [verified, [ApparelSearch](https://www.apparelsearch.com/education/measurements/textiles/yarn-thread/yarn_length.html)]. |
| count_value *(spec)* | number | 20, 24, 26, 30, 34, 40 (Ne); 75D/36F, 150D/48F (filament); 20D, 40D (spandex) | R | Tiruppur trade quotes 30s/34s/40s combed and carded [verified, [F2F](https://www.fibre2fashion.com/news/textile-news/south-indian-cotton-yarn-prices-steady-exporters-gain-from-weak-inr-303447-newsdetails.htm)]. Filament also needs a filament count ("/48F") [likely]. |
| ply *(spec)* | number | 1 (single, "30/1"), 2 ("2/40s") | R (default 1) | Knitting mostly uses singles. Thread and some yarn-dyed products use ply [likely]. |
| spinning_system *(spec)* | enum | ring carded; ring combed; compact combed; open-end (OE/rotor); vortex (MVS); air-jet; filament (textured/FDY) | R | "Combed vs carded" is a separate attribute from "compact vs ring". **Compact is a spinning method applied to combed (or carded) sliver**, so model it as {preparation: carded/combed/semi-combed, spinning: ring/compact/OE/vortex}, not as a single enum [likely]. |
| colour_type *(spec)* | enum | raw white/grey; melange (grey melange, ecru melange, anthra melange, coloured melange); dope-dyed; yarn-dyed (package-dyed); slub/neppy | R | Melange is made by blending dyed fibre into undyed fibre. The dyed-fibre share is called the **shade %** [verified, [Moghassem et al.](https://researchgate.net/profile/Abdolrasool-Moghassem/publication/235001472_Study_on_the_Dyed_Cotton_Fibers_Damage_in_Spinning_Processes_and_its_Effect_on_the_Cotton_Melange_Yarn_Properties/links/09e4151034c2c0fd18000000/Study-on-the-Dyed-Cotton-Fibers-Damage-in-Spinning-Processes-and-its-Effect-on-the-Cotton-Melange-Yarn-Properties.pdf)]. Fabric knitted from melange skips dyeing and only gets washed/compacted [likely]. |
| melange_shade_pct *(spec)* | percent | 3%, 10%, 30% | C (melange) | Supplier-specific. A max colour depth of about 95% is quoted [verified, [Messe Frankfurt exhibitor sheet](https://exhibitorsearch.messefrankfurt.com/images/original/document_downloads/10000000202501/0051996007/1667990339820_1987158737.pdf)]. |
| shade_code *(spec)* | text | mill shade no. "M-1023" | C (dyed/melange) | |
| certification *(spec)* | enum (multi) | GOTS organic, OCS, BCI, recycled (GRS) | O | Needed for export buyers. Carry it forward to fabric and garments [likely]. |
| twist / end-use *(spec)* | enum | hosiery (knitting), weaving, sewing | O | Mills sell "hosiery" yarn packages [verified, [Vardhman brochure](https://vardhman.com/document/Resources/Yarn_Brochure.pdf)]. |
| mill / brand | text | | O | |
| lot_no *(lot)* | text | "L-2611-07" | R | Mixing lots risks barré and shade differences in dyed fabric [likely]. |
| cone_weight | number(kg) | 1.5–2.0; 1.89; 3 | O | Seen in listings: 1.5–2.0 kg, 1.89 kg (24 cones/carton), 2 kg (30 cones/60 kg bag), 3 kg [uncertain, [search summary of IndiaMART/Alibaba listings](https://m.indiamart.com/impcat/yarn-cones.html)]. |
| package_weight | number(kg) | 46.5; 50; 60 | O | Vardhman's standard hosiery package is 46.5 kg [verified, [Vardhman](https://vardhman.com/document/Resources/Yarn_Brochure.pdf)]. Other mills use 50 or 60 kg [uncertain, listing]. Cones per bag is set by weighing within a tolerance, **not fixed** [verified, [Textiles Committee](https://textilescommittee.nic.in/sites/default/files/spin1.pdf)]. Packing per [IS 14463](https://law.resource.org/pub/in/bis/S12/is.14463.1997.pdf) [verified]. |
| package_type | enum | bag (HDPE), carton, pallet | O | |
| rate | number(₹/kg) | 255–263 (30s combed), 236–241 (30s carded), Jun-2025 | O | Indicative only, now about 17 months old [verified as of Jun-2025, [F2F](https://www.fibre2fashion.com/news/textile-news/south-indian-cotton-yarn-prices-steady-exporters-gain-from-weak-inr-303447-newsdetails.htm)]. |

### A2. Knitted fabric (grey and finished)

**Base unit:** kg. **Alternate units:** roll (contextual). Metre is only for open-width fabric, and only when the GSM and width are known.

| Attribute | Type | Example values | Req | Notes |
|---|---|---|---|---|
| state *(spec)* | enum | grey (greige, off-machine); RFD (scoured/bleached, ready for dyeing); dyed; finished (compacted/stentered); printed | R | **Changing state = a new spec.** Grey 160 GSM becomes finished 180 GSM, so they are different SKUs linked by lineage [likely]. |
| structure *(spec)* | enum | single jersey; lycra single jersey; interlock; rib 1×1; rib 2×2; lycra rib; pique (Lacoste/honeycomb); double pique; fleece/loopknit (2-thread or 3-thread); French terry; waffle/thermal; drop-needle; jacquard; mesh; flat-knit collar/cuff | R | Compactor settings differ by structure: SJ, rib, interlock, pique, lycra [verified, [Textile Learner compactor](https://textilelearner.net/?p=858)]. Flat-knit collars/cuffs are counted in **pieces**, not kg (see A2b). |
| fibre_composition *(spec)* | composition | 100% cotton; 95/5 cotton/spandex; PC 65/35 | R | Inherited from the yarn(s). A fabric can have several yarns (e.g. cotton plus plated spandex) [likely]. |
| yarn_refs | ref[] | yarn spec/lot IDs | O | Lineage: which yarn lots went in. |
| yarn_count_label *(spec)* | text | "30s combed compact", "30s + 20D lycra" | O | Denormalised for display and search. |
| gsm *(spec)* | number(g/m²) | grey 140–160; finished 160–180; fleece 240–320 | R | Test method: IS 1964 (mass per unit area) [verified, [BIS IS 1964](https://services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/Indian_standards/isdetails_mnd/8474)]. Store **grey_gsm** and **finished_gsm** as separate attributes on the respective states. |
| width_form *(spec)* | enum | tubular; open-width | R | Tubular fabric is slit to open width in processing [likely]. **A tubular dia and an open-width width are not the same number** (open width ≈ 2 × tubular dia, less slit trim) [likely]. |
| dia *(spec)* | number(inch) | 18"–40" tubular; 60"–72" open | R | Tubular dia shrinks in relax drying, so a wider tube is kept before compacting [verified, [F2F finishing param via search](https://www.slideshare.net/slideshow/parameters-of-finishing-machine/37598568)]. Overfeed adds dia, e.g. SJ +1.5–2", rib +2–2.5", interlock/pique +3–3.5" [verified, [Textile Learner](https://textilelearner.net/?p=858)]. In Tiruppur, **body-size tubular fabric** is knitted on smaller machines (e.g. "8 to 13 dia" for rib/innerwear) so the tube width ≈ half chest and side seams are not needed [likely, [IndiaMART Tiruppur knitting listing](https://m.indiamart.com/impcat/knitting-job-work.html)]. **So dia is often size-linked.** |
| machine_dia | number(inch) | 30, 34 | O | Cylinder diameter. Differs from fabric dia: at 160 GSM 26/1, finished dia = machine dia + 1 [verified, [slide deck via search](https://www.slideshare.net/slideshow/parameters-of-finishing-machine/37598568)]. |
| gauge *(spec)* | number(needles/inch) | 18G, 20G, 24G, 28G | O (R for knitting order) | Seen in Tiruppur listing as "24 gauge" [verified, [IndiaMART](https://m.indiamart.com/impcat/knitting-job-work.html)]. |
| stitch_length / loop_length | number(mm) | 2.6–3.0 mm (SJ) | O | Strongest driver of GSM: GSM ∝ 1/(count × stitch length) [verified, [Textile Learner/slideshare survey via search](https://www.slideshare.net/slideshow/relation-among-gsmyarn-countstitch-length-fabric-construction/47009412)]. A knitting-order attribute. |
| colour / shade_code *(spec)* | text | "Navy 19-3923", "Optical White", "Black" | C (dyed) | |
| shade_depth | enum | white/optical white; light; medium; dark; extra dark | O | Affects process loss and grey-GSM planning, since dark shades take up more dye [verified, [GSM study via search](https://www.scribd.com/document/486224346/GSM-Study)]. |
| finish *(spec)* | enum (multi) | compacted; raised/brushed; peached; bio-washed; silicone soft; heat-set; anti-pill; wicking | O | |
| shrinkage_length / width | percent | ≤5% / ≤5% | O | Formula: (orig − final)/orig × 100 [verified, [search summary](https://fr.slideshare.net/MdRaselHaque/fabric-shrinkage)]. The ±5% target is a common buyer spec [uncertain]. |
| spirality | percent | ≤5% | O | Significant for single jersey. Driven by stitch length [verified, [search summary](https://www.slideshare.net/slideshow/relation-among-gsmyarn-countstitch-length-fabric-construction/47009412)]. |
| dye_lot / batch_no *(lot)* | text | "D-4471" | C (dyed) | **Key for shade segregation at cutting.** |
| knit_lot *(lot)* | text | | O | |
| roll_no *(lot)* | text | "R-12" | O | |
| roll_weight | number(kg) | ~15–30 | O | **No source found.** Treat as per-roll measured data, not a constant [uncertain]. |
| rate | number(₹/kg) | knitting job work ₹12–30/kg | O | Seller listings: ₹14/kg at 24G, ₹12–30/kg [uncertain, [IndiaMART](https://m.indiamart.com/impcat/knitting-job-work.html)]. |

**A2b. Rib / collar / cuff (trim fabrics).** Neck rib (1×1 or 2×2 rib, often lycra) is knitted as tubular fabric and traded per **kg** [likely]. Flat-knit polo collars and cuffs are bought per **piece** or per **set** (collar + 2 cuffs). Their attributes are size, colour, tipping stripes and length [likely, e.g. [Tirupur Collars listing](https://www.textileinfomedia.com/Tirupur-Collars)]. Model these as separate material types, not as variants of body fabric.

### A3. Dyeing / processing job (process type, not a material)

A process type has **input spec, output spec, parameters and measurements**.

| Attribute | Type | Example values | Req | Notes |
|---|---|---|---|---|
| input_form | enum | yarn (cone/hank dyeing); grey fabric (tubular/open); garment (garment dyeing) | R | Dyeing applies to several material forms [likely]. |
| processes | enum (ordered multi) | scouring+bleaching (RFD); optical whitening; dyeing; soaping/wash-off; softening/silicone; slitting; stenter (open-width drying/setting); heat-set (pre-set for lycra); tubular compacting; open-width compacting; raising/brushing; peaching/sueding; bio-wash (enzyme/bio-polish); anti-pill; mercerising | R | Lycra-plated jersey is nearly always pre-heat-set before wet processing [verified, [patent EP1828458 via search](https://patentimages.storage.googleapis.com/c9/03/98/1201a6817ee76c/EP1828458B1.pdf)]. Example optimum for cotton/elastane SJ: 190 °C, 75 s [verified, [ICAR record](https://krishi.icar.gov.in/ohs-2.3.1/index.php/record/view/801210)]. |
| dye_class | enum | reactive (cotton/viscose/modal); disperse (polyester); disperse + reactive two-bath (PC); acid (nylon); pigment; vat; sulphur | O | Reactive exhaust dyeing is the cotton-knit norm [verified, [F2F lab-to-bulk article](https://www.fibre2fashion.com/industry-article/3511/lab-to-bulk-correlation-setting-in-reactive-exhaust-dyeing-method)]. |
| shade_name / shade_code | text | "Navy", Pantone "19-3923 TCX", buyer swatch ref | R | |
| lab_dip_ref | text | "LD-882 option B" | O | Lab-dip options are graded (A/B/C/D) before buyer approval [verified, [Textile Learner lab dip](https://textilelearner.net/?p=1844)]. |
| lab_dip_status | enum | submitted; approved; rejected; re-dip | O | |
| shade_tolerance_dE | number | 0.8–1.2 CMC ΔE | O | Kohl's uses 0.8 CMC for solids [verified, [Kohl's colour review](https://link.kohls.com/content/dam/klink/pdfs/Kohls-Color-Review-Process-Requirements.pdf)]. Small Tiruppur domestic jobs approve visually against a swatch [likely]. |
| batch_no / dye_lot | text | machine batch | R (output) | One batch is a machine load (e.g. 100–600 kg), and **one principal's lot may be split across batches or combined with others** [likely]. |
| target_gsm / target_dia / target_shrinkage | number | 180 / 36" / 5% | O | Compactor overfeed raises GSM; a larger dia lowers it [verified, [Textile Learner](https://textilelearner.net/?p=858)]. |
| grey_weight_in | number(kg) | 500 | R | **Charges are per kg of grey input** [likely]. |
| finished_weight_out | number(kg) | 445 | R | |
| process_loss_pct | computed percent | (in − out)/in | R | See section c. |
| shade_result | enum | OK; shade variation (re-dye/strip); rejected | O | |
| rate | number(₹/kg) | | O | |

### A4. Printing / embroidery (process type)

| Attribute | Type | Example values | Req | Notes |
|---|---|---|---|---|
| input_form | enum | fabric (all-over/rotary/table/digital); cut panels (placement); finished garments | R | Unit follows the form: fabric = kg or m; panels/garments = pieces [likely]. |
| technique | enum | screen: plastisol, water-based, discharge, puff, high-density, foil, glitter; sublimation; DTF; digital (DTG); heat transfer; embroidery (flat, applique, 3D, chenille) | R | |
| design_no / artwork_ref | text/file | "D-221" | R | |
| colours_count | number | 1–8 | R (print) | Screen print cost scales by colours [likely]. |
| placement | enum + text | centre front; left chest; back; sleeve; all-over | R (placement print) | |
| print_size | text | "10×12 in" | O | |
| stitch_count | number | 8,000 stitches | R (embroidery) | Embroidery is commonly priced per 1,000 stitches [likely]. |
| strike_off_status | enum | submitted; approved; rejected | O | Strike-off is the print equivalent of a lab dip [verified, [Racklify](https://racklify.com/encyclopedia/lab-dip-versus-strike-off-when-to-use-each-sample-type/)]. |
| size_colour_breakdown | matrix | panels per size × colour | C (panels) | Panels must come back in the same size/colour/bundle so they reunite with the other panels [likely]. |
| rejects / misprints | number(pcs) | | O | A misprinted panel needs a replacement panel cut, which feeds back to cutting [likely]. |

### A5. Cut panels / cutting (process + output material)

| Attribute | Type | Example values | Req | Notes |
|---|---|---|---|---|
| style_no *(spec)* | ref | "RN-180-M" | R | |
| component *(spec)* | enum | front; back; sleeve (L/R); neck rib; placket; pocket; hood; waistband; gusset | R | A garment = a **kit** of components (e.g. 1 front + 1 back + 2 sleeves + 1 rib). Tubular body-size fabric may produce "body" pieces without side seams [likely]. |
| size *(spec)* | enum | S, M, L, XL, XXL; 75/80/85/90/95/100/105/110 cm (innerwear); age 0–3M … 13–14Y (kids) | R | Indian vest sizes run 75–110 cm chest [verified, [Lux Cozi](https://www.luxinnerwear.com/men/lux-cozi/lux-cozi-xylo-single-rib)]. Kids sizes are listed by age (2–14Y) [verified, [F2F listing via search](https://www.fibre2fashion.com/garments/india-men-tees-suppliers-p2127-c71?Page=4)]. **The size set must be configurable per style.** |
| colour *(spec)* | text | | R | |
| dye_lot *(lot)* | ref | | R | Each lay should use one dye lot. Panels are numbered/stickered so they don't mix shades [likely]. |
| lay_no / cutting_docket | text | | O | |
| plies | number | 40–120 | O | |
| marker_length | number(m) | | O | |
| size_ratio_in_marker | ratio | S1:M2:L2:XL1 | O | More sizes in a marker = higher efficiency [verified, [search summary](https://de.slideshare.net/UtsoSaha/marker-and-marker-effiency)]. |
| marker_efficiency | percent | 80–90% | O | Formula: pattern area / marker area × 100. Above 80–85% is good [verified, [same](https://de.slideshare.net/UtsoSaha/marker-and-marker-effiency)]. Marker efficiency **excludes** end loss, width loss and end bits [verified, [Apparel Resources](https://apparelresources.com/business-news/manufacturing/performance-measurement-tools-3-cutting-production-planning/)]. |
| bundle_no | text | "B-0457" | O | Bundle ticket: style/size/colour/lot/qty/ply range [likely]. |
| bundle_qty | number(pcs) | 10, 20, 25 | O | |
| fabric_issued_kg | number(kg) | | R (cutting process) | |
| cut_waste_kg / end_bits_kg | number(kg) | | O | **By-products.** Cut waste is resold as "banian waste" or cutting waste at about ₹35–100/kg [uncertain, [IndiaMART listings](https://m.indiamart.com/impcat/banyan-waste.html)]. |

### A6. Garment (stitched / finished goods)

**Base unit:** piece. **Alternate units:** dozen, set, pack, carton (contextual).

| Attribute | Type | Example values | Req | Notes |
|---|---|---|---|---|
| style_no *(spec)* | ref | | R | |
| size *(spec)*, colour *(spec)* | enum/text | | R | |
| state *(spec)* | enum | stitched (unchecked); checked; ironed; packed | R | |
| grade | enum | A (first quality); B (seconds); alter/rework pending; reject (scrap) | R | B-grade goods are often sold separately as surplus or "seconds" [likely]. |
| defect_category | enum (multi) | stitching (skip, open seam, puckering); fabric (hole, stain, shade variation, barré); measurement out of tolerance; print/embroidery; trims missing | C (non-A) | |
| operations_done | enum (multi) | shoulder join; neck rib attach; neck tape; sleeve attach; side seam; sleeve hem; bottom hem; label attach; trimming; checking; ironing | O | Mostly a costing attribute: **piece rate per operation, or per full garment** [likely]. Listings show ₹25–80/pc outside Tiruppur [uncertain, [IndiaMART](https://m.indiamart.com/impcat/garment-stitching-service.html)]. |
| piece_rate | number(₹/pc or ₹/dozen) | | O | |

### A7. Trims and accessories

| Material | Key attributes (spec) | Base unit | Purchase pack (contextual) | Consumption spec | Notes / sources |
|---|---|---|---|---|---|
| Sewing thread | fibre (spun poly, core-spun poly-cotton, textured poly for loopers); ticket no. / tex (Tkt 120 ≈ Tex 25; Tex 25–30 common); shade no.; cone length | **metre** (stock in cones) | cone = 2,000 / 3,000 / 5,000 m | metres per piece by stitch type | 1 cm of 3-thread overlock uses about 14 cm of thread. 4-thread safety ≈ 18, 5-thread ≈ 20, lockstitch ≈ 2.5 [verified, [Coats/OCS via search](https://www.onlineclothingstudy.com/2018/10/sewing-thread-consumption-for-t-shirt.html)]. Ticket ≠ tex across thread types [verified, [Amann](https://www.amann.com/knowledgehub/amann-wiki/sewing-thread-numbering-explained-tex-nm-denier-and-ticket-numbers/ticket-numbers/)]. Put-ups of 2,000 and 5,000 m [verified, [Coats Astra sheet](https://cdn.shopify.com/s/files/1/0222/3324/files/Astra_Product_Information.pdf)]. A 3,000 m spool costs ₹300–350 [verified, [OCS](https://www.onlineclothingstudy.com/2018/10/sewing-thread-consumption-for-t-shirt.html)]. |
| Buttons | material (polyester, shell, metal, coconut); ligne size (16L, 18L, 20L); holes (2/4); colour; finish | piece | gross (144), great gross (1,728), packet | pcs per garment (polo: 2–3) | 40 ligne = 1 inch. Shirt buttons are about 17–18L [verified, [Kimsoncraft](https://kimsoncraft.freshdesk.com/support/solutions/articles/1000165982-button-ligne)]. Sold per gross [verified, [Wawak](https://www.wawak.com/Buttons-20L-Industrial)]. |
| Snaps / press buttons | type (prong/ring), size, finish | piece (or set: cap + socket + stud + post) | gross | | **Set ≠ piece ambiguity:** 1 snap set = 4 components [likely]. |
| Zips | type (coil/nylon, metal, vislon/moulded); tape colour; length (in/cm); closed/open-end; slider/puller | piece | dozen, bundle | pcs per garment | **Length is part of the spec**, so a 7" zip is not a 9" zip [likely]. Continuous zip chain is sold per metre plus loose sliders [likely]. |
| Labels | kind (main/brand, size, wash-care/content, flag, price); woven/printed/satin/heat-transfer; size text | piece | roll, 1,000 pcs | 1 main + 1 size + 1 care per piece | **Size label is size-specific**, so stock is per size [likely]. |
| Elastic | type (knitted, woven, braided, jacquard waistband); width (mm); colour; stretch % | **metre** | roll (25–50 m), kg | metres per piece (by size) | Tiruppur sellers quote per metre: ₹3–11/m [uncertain, [IndiaMART](https://m.indiamart.com/greentapes/elastic-tape.html)]. Woven elastic rolls are 30–50 m [uncertain, [TradeIndia](https://www.tradeindia.com/products/heavy-duty-elastic-tape-9676719.html)]. Some trade in kg. **kg ↔ m only through a measured g/m** [uncertain]. |
| Drawcord | material; length (cm); tipping (metal/plastic aglet); colour | piece (cut length) or metre (roll) | | 1 pc per garment | |
| Twill / neck tape | width (mm), colour | metre | roll | metres per piece | |
| Hang tags | design; size; with/without string | piece | 1,000s | 1 per piece | |
| Tag pins / loop pins (kimble) | length (mm) | piece | box (e.g. 5,000) | 1 per piece | [likely] |
| Polybags | material (LDPE/PP/BOPP); size (in); thickness (micron); flap/adhesive/print; suffocation warning print | piece | **kg** (often), 100 pcs | 1 per piece or per pack | pcs/kg derived from size × micron (section c) [uncertain]. |
| Cartons | ply (3/5/7); inner dimensions (in/cm); print; flap type | piece | bundle of 25/50 | per N garments | |
| Inner boxes | (for innerwear: box of 1/2/3 pcs or ½ dozen) | piece | | | [likely] |
| Interlining | fusible/non-fusible; woven/non-woven; GSM; width | **metre** | roll | cm² per piece (collar, placket) | Rare in basic knits. Used in polo plackets [likely]. |
| Tissue / butter paper, back board, collar stays, clips | size | piece (or kg for paper) | ream/kg | per piece | |

---

## (b) Units and conversions

### B1. Unit catalogue

| Unit | Dimension | Used for | Precision |
|---|---|---|---|
| kg, g, tonne | mass | yarn, fabric, rib, cut waste, polybags, paper | kg to 2–3 decimals |
| metre, cm, inch, yard | length | thread, elastic, tape, zip chain, interlining, open-width fabric (rare in Tiruppur domestic) | |
| m², GSM (g/m²) | area / areal density | spec attribute, not a stock unit | |
| inch (dia/width) | spec attribute | fabric dia | **never a quantity** |
| denier, tex, Ne, Nm, ticket | linear density | yarn/thread spec | **never a quantity** |
| piece (pc) | count | garments, panels, buttons, zips, labels, cartons | integer |
| pair | count (=2) | socks, cuffs | integer |
| dozen (dz) | count (=12) | garments, buttons, zips | |
| gross (gr) | count (=144) | buttons, snaps, small trims | |
| great gross | count (=1,728) | buttons (rare) | |
| set | count, **style-defined** | (i) size set = 1 of each size in the run; (ii) co-ord set (T-shirt + shorts); (iii) collar + cuffs; (iv) snap set | |
| pack | count, **style-defined** | multipacks (3-pack vests) | |
| cone | package | yarn (kg-weighed), thread (metre-rated) | |
| hank | package | hank yarn (handloom; rare in knit) | |
| bag | package | yarn (≈46.5–60 kg), polybags | |
| roll | package | fabric (weighed), elastic/tape/labels (metre- or pc-rated) | |
| bundle | package | cut panels (N pcs, ticketed), cartons | |
| lot / batch | **identifier, not a unit** | yarn lot, dye lot | |
| carton / box | package | packed garments (N pcs per assortment) | |
| lay | process grouping | plies × marker | not a stock unit |

### B2. Conversion classification

**VALID (fixed factor, always allowed)**

| From → To | Factor | Notes |
|---|---|---|
| kg ↔ g ↔ tonne | 1,000 | [verified, SI] |
| m ↔ cm ↔ mm; inch ↔ cm; yard ↔ m | 1 in = 2.54 cm; 1 yd = 0.9144 m | [verified, SI] |
| dozen ↔ pieces | 1 dz = 12 pcs | [verified] |
| gross ↔ pieces / dozen | 1 gr = 144 pcs = 12 dz | [verified, [Wawak](https://www.wawak.com/Buttons-20L-Industrial)] |
| great gross ↔ gross | 1 GG = 12 gr = 1,728 pcs | [likely] |
| pair ↔ pieces | 1 pair = 2 pcs | [verified] |
| Ne ↔ tex ↔ denier (**spec conversion, not quantity**) | tex = 590.5/Ne; Ne = 5315/denier; denier = 9 × tex | [verified, [Textile School](https://www.textileschool.com/179/yarn-count-conversions/)]. Constants vary by rounding (5314/5315, 590.5/590.6). Use for display and search, never for stock. |
| ligne ↔ inch/mm (**spec**) | 40 L = 1 inch; 1 L = 0.635 mm | [verified, [Kimsoncraft](https://kimsoncraft.freshdesk.com/support/solutions/articles/1000165982-button-ligne)] |

**CONTEXTUAL (allowed only with a stated factor from a specific record; the factor is stored with the movement)**

| From ↔ To | Factor source | Typical value | Notes |
|---|---|---|---|
| bag ↔ kg (yarn) | bag's weighed net weight | 46.5–60 kg | **Per bag, not per spec.** Cones per bag vary [verified, [Textiles Committee](https://textilescommittee.nic.in/sites/default/files/spin1.pdf)]. |
| cone ↔ kg (yarn) | cone weight on packing list | 1.5–3 kg | [uncertain] |
| roll ↔ kg (fabric) | each roll's weighed weight (roll ticket) | ~15–30 kg (no source) | Never use an average to *create* stock. Averages are OK for estimates [uncertain]. |
| kg ↔ m (open-width fabric) | GSM × width | m = kg × 1000 / (GSM × width_m) | Only for open-width fabric with known finished GSM and width [verified formula, [OCS](https://onlineclothingstudy.com/2020/04/how-do-we-calculate-fabric-consumption.html)]. Tubular: use 2 × dia as the effective width [likely]. |
| kg fabric ↔ pieces (garments/panels) | style × size × fabric spec consumption (g/pc incl. wastage) | 180 GSM men's RN tee L ≈ 210–230 g/pc ⇒ ≈ 4.3–4.8 pcs/kg (derived, section c) | **The most important contextual conversion.** The factor is a BOM line: (style, size, component, fabric spec) → g/pc. Use it for *planning and expected yield*. **Actual** pieces come from counting, and the difference is cutting variance [likely]. |
| kg yarn ↔ kg fabric | expected knitting loss | ~1–3% loss | [uncertain] |
| kg grey ↔ kg finished | expected process loss | ~8–15% loss | [uncertain]; see section c |
| cone ↔ metres (thread) | cone length on label | 2,000 / 3,000 / 5,000 m | [verified, [Coats Astra](https://cdn.shopify.com/s/files/1/0222/3324/files/Astra_Product_Information.pdf)] |
| metres thread ↔ pieces | thread BOM per style | 80–110 m/tee (+10% wastage) | [verified range, [OCS](https://www.onlineclothingstudy.com/2018/10/sewing-thread-consumption-for-t-shirt.html)] |
| roll ↔ metres (elastic/tape) | roll length on label | 25–50 m | [uncertain] |
| kg ↔ metres (elastic) | measured g/m for that elastic | (no source) | [uncertain] |
| kg ↔ pieces (polybags, labels, buttons) | measured pcs/kg or g/gross for that item | polybag 12×16" 40 µ ≈ 110 pcs/kg (derived) | [uncertain] |
| carton ↔ pieces | carton's assortment (pack spec) | e.g. 48 pcs (4 dz) or ratio 1:2:2:1 × 8 | Per carton, since solid and ratio cartons differ [verified concept, [textiledetails](https://textiledetails.com/folding-and-packing-in-the-garments-industry)] |
| set ↔ pieces | style's set definition | size set S–XXL = 5 pcs; co-ord = 2 pcs | **Must be defined per style/order** [likely] |
| pack ↔ pieces | pack spec | 3-pack = 3 | |
| bundle ↔ pieces | bundle ticket qty | 10–25 | Per bundle |
| pieces (garment) ↔ pieces (panels) | kit definition | 1 tee = 1 front + 1 back + 2 sleeves + 1 rib | Many-to-one assembly, not a unit conversion. **Model it as a BOM.** |

**INVALID (refuse, with a helpful message)**

| Attempt | Why |
|---|---|
| GSM, dia, gauge, count, denier, tex, ligne, micron, ply **as a quantity** | These are spec attributes, not quantities. |
| kg ↔ pieces with no style/size/spec consumption | Ambiguous: a 180 GSM XL and a 140 GSM S differ by about 40%. |
| kg yarn ↔ pieces garment directly | It must chain through fabric spec, process loss and consumption. Allow only as a **planning estimate** with every factor shown. |
| roll ↔ pieces, bag ↔ pieces, cone (yarn) ↔ pieces | No meaningful single factor. |
| lot/batch ↔ anything | A lot is an identifier, not a unit. |
| Converting across materials (thread metres ↔ elastic metres; buttons gross ↔ garments dozen) | Same unit name but different material. Conversions are scoped to a material spec. |
| dozen ↔ kg (garments) without a measured piece weight | Allowed only for freight estimates using a measured g/pc; never for stock. |
| GSM-based kg recomputation after processing | Finished kg must be **weighed**, not computed from grey kg × GSM ratio, because GSM rises while total weight falls (see section e). |
| tubular dia ↔ open width (as a hard factor) | Approximate (≈2×, minus slit/trim). Store both as measured attributes. |

---

## (c) Typical consumption, weight and loss numbers (seed defaults; all overridable)

| Quantity | Typical value | Tag / source |
|---|---|---|
| **Grey → finished GSM** | Finished GSM is about 15–30% higher than grey (wet processing adds ≥15%; compacting alone 10–15% via overfeed) | [verified, [Textile Learner](https://textilelearner.net/?p=858); [finishing params](https://www2.slideshare.net/sheshir/parameters-of-finishing-machine); [GSM study](https://www.scribd.com/document/486224346/GSM-Study)] |
| **Grey → finished weight (process loss)** for cotton reactive-dyed knit | ~8–15% weight loss. Scouring/bleaching alone causes 3–6% loss; enzyme/bio-wash adds ~3.5%. Dark shades are planned differently | Pretreatment 3–6% [verified, citing Choudhury 2006 via [search summary](https://core.ac.uk/download/492997543.pdf)]; bio-polish 3.5% [verified, same search]; total 8–15% [uncertain]. A costing example uses 12% dyeing loss [verified as an example, [slideshare](https://www.slideshare.net/slideshow/textile-calculations-and-equations/37598663)]. |
| Enzyme wash weight reduction | One source claims 20–25%, which seems high | [uncertain, [GSM study via search](https://www.scribd.com/document/486224346/GSM-Study)] |
| Yarn → grey knitting loss | ~1–3% (costing example uses 10%, which seems high) | [uncertain, [slideshare](https://www.slideshare.net/slideshow/textile-calculations-and-equations/37598663)] |
| Melange fabric (no dyeing) | Lower loss than dyed. Wash + compact only | [likely] |
| Shrinkage spec | ≤5% L/W after wash | [uncertain, common buyer spec] |
| Marker efficiency (knit) | 80–90% | [verified ">80–85% good", [marker deck](https://de.slideshare.net/UtsoSaha/marker-and-marker-effiency)] |
| Cutting-room loss | 4–15% (examples use 4% cutting + 2% shrinkage; one paper cites 10–15%) | [uncertain, [Apparel Resources](https://apparelresources.com/business-news/manufacturing/performance-measurement-tools-3-cutting-production-planning/); [INDJST](https://indjst.org/articles/reduction-of-garments-cutting-wastage-for-bulk-production-by-increasing-or-decreasing-pattern-size-matching-with-garments-size-tolerance)] |
| **Fabric consumption, 180 GSM men's round-neck tee, size L** | **≈ 210–230 g/pc including ~6% cutting wastage, plus ~5–8 g rib ⇒ ≈ 4.3–4.8 pcs per kg finished fabric** | [uncertain, derived]. Rectangle method (OCS-style): body 2 × (31" × 22") + sleeves 2 × (10" × 19") = 1,744 in² = 1.125 m² × 180 = 203 g; ×1.06 = 215 g; rib 1×1 ≈ 2" × 20" × ~220 GSM ≈ 6 g. Formula: [OCS](https://onlineclothingstudy.com/2020/04/how-do-we-calculate-fabric-consumption.html), [OCS calculator](https://www.onlineclothingstudy.com/2021/09/t-shirt-fabric-consumption-calculator.html) |
| **Finished garment weight**, same tee | **≈ 150–175 g** (panels ~0.85–0.9 m² × 180 + rib + ~3 g thread + labels) | [uncertain, derived]. Cross-check: a 160 GSM tee weighs about 112–128 g [uncertain, [Modaknits via search](https://modaknits.com/?p=63101)] |
| Yarn needed per tee (back-calculated) | ≈ 215 / 0.90 / 0.98 ≈ 245 g yarn ⇒ ≈ 4 tees per kg yarn | [uncertain, derived] |
| Sewing thread per tee | 80–110 m (+10% wastage). Coats gives ~45 m for a sports tee | [verified ranges, [OCS](https://www.onlineclothingstudy.com/2018/10/sewing-thread-consumption-for-t-shirt.html); [Coats via search](https://coats.com/industries/apparel/applications/sports-and-activewear---t-shirts)] |
| Thread cones per 1,000 tees | 3,000 m cone ⇒ ~1 cone per 27–37 tees ⇒ ~30–40 cones per 1,000 (all colours/positions combined; needle and looper threads are separate cones in practice) | [uncertain, derived] |
| Thread cost per tee | < ₹1 | [verified, [OCS](https://www.onlineclothingstudy.com/2018/10/sewing-thread-consumption-for-t-shirt.html)] |
| Thread weight per tee | 100 m × Tex 27 ≈ 2.7 g | [uncertain, derived from tex definition, [OCS tex vs tkt](https://www.onlineclothingstudy.com/2013/01/difference-between-tex-and-tkt-in.html)] |
| Polybag pcs/kg | 12"×16" LDPE 40 µ: 2 × 0.305 × 0.406 m × 40e-6 m × 920 kg/m³ ≈ 9.1 g ⇒ ~110 pcs/kg | [uncertain, derived] |
| Knitting job-work rate | ₹12–30/kg | [uncertain, listings, [IndiaMART](https://m.indiamart.com/impcat/knitting-job-work.html)] |
| Stitching job-work rate | ₹25–80/pc (non-Tiruppur listings) | [uncertain, [IndiaMART](https://m.indiamart.com/impcat/garment-stitching-service.html)] |
| Cut waste resale | ₹35–100/kg | [uncertain, [IndiaMART](https://m.indiamart.com/impcat/banyan-waste.html)] |
| Yarn price | 30s combed ₹255–263/kg; 40s combed ₹278–291/kg (Jun-2025, ex-GST) | [verified as of Jun-2025, [F2F](https://www.fibre2fashion.com/news/textile-news/south-indian-cotton-yarn-prices-steady-exporters-gain-from-weak-inr-303447-newsdetails.htm)] |
| Dyeing rejection rate, Tiruppur | 8–14% (vendor marketing claim) | [uncertain] |

**Process-loss definition (model it explicitly).** Merchandisers define process loss as **extra input needed per 1 kg of finished output**. It varies by fabric type, shade (light/dark/reactive/pigment) and fibre [verified, [search summary of merchandising guide](https://www.scribd.com/document/486224346/GSM-Study)]. Two conventions exist and must not be mixed:
- **Loss on input:** (in − out)/in.
- **Allowance on output:** in/out − 1.

10% loss on input equals an 11.1% allowance on output [derived]. **Store raw in/out weights and compute both. Label which one is shown.**

**Chained booking** (planning only): yarn_kg = finished_kg / (1 − dye_loss) / (1 − knit_loss) [likely; multiplicative chaining is our synthesis].

---

## (d) Corrections to the brief's hypothesis table

| Stage | Brief said | Correction / addition |
|---|---|---|
| Yarn | count, combed/carded, blend %, colour/melange, lot — kg, bags | (1) Add a **count system**: Ne for spun yarns; denier + filaments for polyester/spandex; tex for thread. (2) **Spinning method** (ring/compact/OE/vortex) is a separate axis from **preparation** (carded/combed). (3) Add **ply**, **certification**, **mill**, **shade %** for melange. (4) A "bag" is not a fixed factor: Vardhman uses 46.5 kg, others 50/60 kg, and cones per bag vary. Always weigh. (5) Add **cone** as a unit. (6) Prices are per kg ex-GST. |
| Knitting | structure, GSM, dia/width, gauge — kg, rolls | (1) Add **grey vs finished state**: GSM and dia are measured per state, and finished ≠ grey. (2) Separate **tubular dia** from **open width**, and **fabric dia** from **machine dia**. (3) Add **stitch length** (main GSM driver) and **yarn lot lineage**. (4) Add **lycra/plating**. (5) **Rib and flat-knit collars/cuffs are separate materials** (rib in kg; collars in pcs/sets). (6) Rolls are an identifier/package; quantity is always **weighed kg per roll**. (7) Body-size tubular fabric makes dia **size-dependent**. |
| Dyeing | shade, lab-dip, compacting/raising/washing, shrinkage, process loss — kg, batch/lot | (1) It is a **process type** applied to yarn, fabric or garments, not a material. (2) Add **dye class**, **shade depth**, **heat-set** (lycra), **slitting/stenter**, **bio-wash**, **peaching**, **silicone**. (3) Track **grey kg in, finished kg out, finished GSM and dia, and shrinkage** as measurements. (4) **GSM goes up while kg goes down.** (5) **Batch ≠ principal lot**: one lot can span batches, and a batch can mix principals. (6) The **lab dip** is a pre-approval event with options (A/B/C), and the bulk shade has its own result and possible re-dye. |
| Printing/embroidery | design, colours, placement — kg or pieces | Unit depends on **input form**: fabric (all-over) = kg/m; panels/garments = pcs. Add **technique**, **stitch count** (embroidery, priced per 1,000 stitches), **strike-off approval**, **size/colour/bundle breakdown** so panels reunite, and **misprints** that need replacement panels. |
| Cutting | style, size ratio, colour, marker efficiency, wastage — kg → pieces | (1) Output is **multiple components per garment** (a kit), not "pieces". (2) kg → pcs is a **per style × size × spec consumption factor**. Actual output is counted, and the variance is reported. (3) Add **dye lot per lay**, **bundles**, **plies**. (4) **Cut waste/end bits are a saleable by-product (kg)**, separate from invisible loss. (5) Marker efficiency ≠ total cutting loss. |
| Stitching | style, size, colour, operations, rejects — pieces | (1) **Multiple inputs** (panels + thread + labels + trims). (2) Rejects split into **alter/rework** (goes back), **B-grade** (sold as seconds), **scrap**, and **fabric-fault** (charged to the dyer/knitter). (3) Return of **leftover trims** (partial cones). (4) Piece rate is per garment or per operation; dozens are common in talk. |
| Packing | QC, tags, polybags, cartons — pcs, dozens, cartons | (1) A carton's content is defined by an **assortment**: solid (1 colour × 1 size), ratio/size-assorted (1 colour, sizes in ratio), or mixed (colours and sizes). (2) Add **inner pack/box** (½ dz, 1 dz) and **multipacks** (3-pack). (3) "Set" must be defined per style. |
| Trims | thread, buttons, zips, labels, elastic, tags, polybags, cartons; per-piece consumption — pcs, cones, kg, gross | (1) **Thread stock should be in metres** (cones are packages). (2) **Elastic/tape/interlining in metres**. (3) Polybags are bought per kg but issued per piece. (4) **Size labels and zips are size-specific variants.** (5) Add **snaps** (set of 4 parts), **tag pins**, **inner boxes**, **tissue/back board**. (6) Add **great gross** and **pair**. (7) Consumption depends on size (elastic length) and stitch type (thread). |
| (missing) | — | Add **Dispatch/Sale**, **Returns from retailer**, and **By-product/Waste** (cut waste, yarn waste, rejected fabric "fents") as first-class flows. |

---

## (e) Modelling pitfalls

1. **Mass is not conserved through processing.** Grey 500 kg can become finished 440 kg while GSM rises 160 → 180. Conservation checks must use **sent = returned + declared loss (+ by-product) + pending**. Loss is a **measured, recorded line** with an expected % for flagging, never silently computed.
2. **Unit changes break simple sums.** Cutting turns kg into pcs, so conservation per movement must happen in the **input's unit**: kg issued = kg in panels (estimated) + cut waste kg + end bits kg + unaccounted. The output side is checked separately in pcs against the expected yield.
3. **One input → many outputs (cutting).** A lay produces fronts, backs, sleeves and rib strips in different counts per size, plus by-products. **Inverse assembly (stitching):** many inputs (5 panels + 3 labels + ~100 m thread) → 1 garment. Use **BOM/kit definitions per style × size**, and track components separately until stitched. A missing sleeve blocks a garment.
4. **Panels must stay kit-matched.** Printing/embroidery often takes only the front panels away. When they return, they must re-join backs/sleeves of the **same size, colour and dye lot**.
5. **Lots must not mix silently.** Two dye lots in one order are allowed, but each **lay/bundle** should carry one lot, and the system must warn when a garment's panels come from two lots.
6. **Batch ≠ lot ≠ order.** A dyer merges several principals' fabric into one machine batch, or splits one lot across batches. The many-to-many link must keep **ownership per kg**.
7. **The spec changes identity across processes.** Grey SJ 160 GSM 30" tubular → finished SJ 180 GSM 36" open-width navy. Represent this as a **new material spec with lineage**, not an edit to the old record.
8. **Contextual factors must be snapshotted.** If the consumption (g/pc) for a style is revised, historical movements must keep the factor used at the time.
9. **"Set", "pack", "bundle" and "carton" are not universal numbers.** Store the definition on the order, style or carton.
10. **Dozen display vs piece storage.** Store integer pieces and display "10 dz 4 pcs". Never store fractional dozens.
11. **Packages vs consumables.** Thread is bought in cones and consumed in metres, and partial cones come back from stitching. Either track **cones with remaining-metre estimates** or move to metres at issue. Same for elastic rolls.
12. **Bought per kg, used per piece** (polybags, sometimes labels and buttons) needs a per-item pcs/kg factor. **Bought per gross, used per piece** is a fixed factor.
13. **Weighing differences between parties.** Two scales plus moisture (cotton picks up humidity) can give different weights for the same lot. Allow a **tolerance band**, and flag differences beyond it rather than treating them as loss.
14. **Rejects split into several routes.** Rework goes back to the same unit; B-grade goes to stock as a different grade; scrap is written off; fabric faults are claims against the dyer/knitter; replacement panels need cutting again. Each needs its own disposition.
15. **By-products have value.** Cut waste, yarn waste and rejected fabric ("fents") are sold per kg. Model them as **output materials**, not just loss, so the owner can record what the job worker returned or kept.
16. **The same process applies to different forms.** Dyeing works on yarn, fabric or garments; printing on fabric, panels or garments. A process type needs allowed input forms, each with its own unit rules.
17. **Size sets vary.** S–XXL, 75–110 cm (innerwear), age bands (kids), numeric kids sizes. The size set is **configurable per style**, ordered, and drives matrix UIs.
18. **Order expression.** Domestic orders come as colour × size matrices, often as "per dozen" quantities with a size ratio (e.g. 5 colours × S:M:L:XL:XXL = 1:2:2:2:1 × 10 dz). Store the **expanded matrix in pieces** plus the original ratio/multiplier for display. Rounding a ratio to whole cartons can leave remainders, so show them.
19. **Spec attributes as numbers vs text.** "30s" means Ne 30, and "2/40s" is 2-ply Ne 40. Parse to structured fields (system, value, ply), but keep the raw label for voice and chat input in Tamil/English.
20. **Kids/infant cm sizes (75–100) can collide with innerwear chest cm sizes.** Size codes must be scoped to a size set.

---

## (f) Sources

- BIS IS 1964 (mass per unit area of fabrics): https://services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/Indian_standards/isdetails_mnd/8474
- BIS IS 14463:1997 (packing cotton yarn/cloth): https://law.resource.org/pub/in/bis/S12/is.14463.1997.pdf
- Textiles Committee, spinning mill packing practice: https://textilescommittee.nic.in/sites/default/files/spin1.pdf
- Vardhman yarn brochure (46.5 kg hosiery package): https://vardhman.com/document/Resources/Yarn_Brochure.pdf
- Fibre2Fashion, South India yarn prices (Jun 2025): https://www.fibre2fashion.com/news/textile-news/south-indian-cotton-yarn-prices-steady-exporters-gain-from-weak-inr-303447-newsdetails.htm
- Moghassem et al., dyed-fibre damage and melange yarn: https://researchgate.net/profile/Abdolrasool-Moghassem/publication/235001472
- Textile School, count conversions: https://www.textileschool.com/179/yarn-count-conversions/
- ApparelSearch, yarn length/numbering: https://www.apparelsearch.com/education/measurements/textiles/yarn-thread/yarn_length.html
- Textile Learner, compactor GSM/dia/shrinkage control: https://textilelearner.net/?p=858
- Textile Learner, lab dip: https://textilelearner.net/?p=1844
- Finishing machine parameters (slides): https://www2.slideshare.net/sheshir/parameters-of-finishing-machine
- GSM study (grey vs finished, shade effects): https://www.scribd.com/document/486224346/GSM-Study
- Relation of GSM, count, stitch length: https://www.slideshare.net/slideshow/relation-among-gsmyarn-countstitch-length-fabric-construction/47009412
- Heat-setting cotton/elastane (ICAR): https://krishi.icar.gov.in/ohs-2.3.1/index.php/record/view/801210
- Spandex pre-setting (patent EP1828458): https://patentimages.storage.googleapis.com/c9/03/98/1201a6817ee76c/EP1828458B1.pdf
- Kohl's colour review (ΔE tolerance): https://link.kohls.com/content/dam/klink/pdfs/Kohls-Color-Review-Process-Requirements.pdf
- F2F lab-to-bulk reactive dyeing: https://www.fibre2fashion.com/industry-article/3511/lab-to-bulk-correlation-setting-in-reactive-exhaust-dyeing-method
- Racklify, lab dip vs strike-off: https://racklify.com/encyclopedia/lab-dip-versus-strike-off-when-to-use-each-sample-type/
- Online Clothing Study, fabric consumption: https://onlineclothingstudy.com/2020/04/how-do-we-calculate-fabric-consumption.html and https://www.onlineclothingstudy.com/2021/09/t-shirt-fabric-consumption-calculator.html
- Online Clothing Study, thread consumption for a T-shirt: https://www.onlineclothingstudy.com/2018/10/sewing-thread-consumption-for-t-shirt.html
- Online Clothing Study, Tex vs Ticket: https://www.onlineclothingstudy.com/2013/01/difference-between-tex-and-tkt-in.html
- Online Clothing Study / Textile Details, packing types (solid/ratio/mixed): https://onlineclothingstudy.com/2016/11/different-types-of-garment-packing.html , https://textiledetails.com/folding-and-packing-in-the-garments-industry
- Amann, ticket numbers: https://www.amann.com/knowledgehub/amann-wiki/sewing-thread-numbering-explained-tex-nm-denier-and-ticket-numbers/ticket-numbers/
- Coats Astra product information (put-ups): https://cdn.shopify.com/s/files/1/0222/3324/files/Astra_Product_Information.pdf
- Kimsoncraft, button ligne: https://kimsoncraft.freshdesk.com/support/solutions/articles/1000165982-button-ligne
- Wawak, buttons per gross: https://www.wawak.com/Buttons-20L-Industrial
- Marker efficiency: https://de.slideshare.net/UtsoSaha/marker-and-marker-effiency
- Apparel Resources, cutting performance measurement: https://apparelresources.com/business-news/manufacturing/performance-measurement-tools-3-cutting-production-planning/
- INDJST, cutting wastage reduction: https://indjst.org/articles/reduction-of-garments-cutting-wastage-for-bulk-production-by-increasing-or-decreasing-pattern-size-matching-with-garments-size-tolerance
- Lux Cozi vest size run (75–110 cm): https://www.luxinnerwear.com/men/lux-cozi/lux-cozi-xylo-single-rib
- IndiaMART category listings (indicative rates only): knitting job work https://m.indiamart.com/impcat/knitting-job-work.html ; stitching https://m.indiamart.com/impcat/garment-stitching-service.html ; banian waste https://m.indiamart.com/impcat/banyan-waste.html ; elastic https://m.indiamart.com/greentapes/elastic-tape.html ; yarn cones https://m.indiamart.com/impcat/yarn-cones.html
- Modaknits, T-shirt weight estimate: https://modaknits.com/?p=63101

**Gaps to close with real Tiruppur users:** typical roll weights; actual process-loss % per dyer and shade; local piece rates; how "set" is used in domestic orders; whether elastic and labels are bought per kg or per metre/piece; kids size codes in domestic trade.
