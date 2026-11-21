# CLAIRE Connect — Supply Chain Network & Production Tracking

**Brief for Claude Code.** Save this file at `docs/supply-chain/BRIEF.md`. Re-read it at the start of every phase and again after any context compaction.

---

## 0. Mission

CLAIRE Connect is currently a working base version. It connects **retailers with wholesale manufacturers** through multilingual, voice-first trade chat with Claire, our AI assistant. We are now expanding it into a platform that connects and tracks **the whole Tiruppur knitwear supply chain**, from yarn to the retailer's shelf. Every participant (yarn traders, knitters, dyers, fabric shops, trims suppliers, cutting units, stitching units, packers, manufacturers, retailers) should be able to:

1. **Find and talk to** anyone else in the chain.
2. **Track every movement of material** they send, receive, process or hold: what, how much, which colour, which size, with whom, since when, and when it's expected back.
3. **Manage inventory**, including stock that is physically sitting at someone else's unit.
4. **See their whole flow visually** and get analytics that actually help them decide things.
5. **Ask their own private Claire** questions about their own data, get analytics on demand, and record things by just saying them.

This is a large, complex feature. I care more about it being **logically correct, flexible and genuinely usable by Tiruppur SMEs** than about shipping fast. Research, design, verify, red-team, and only then build, phase by phase.

---

## 1. What exists today (verify all of this yourself in Phase 0)

- **Monorepo:** `web/` (React 19, Vite, Tailwind v4), `server/` (Express, TypeScript), `shared/` (shared types/code).
- **Chat:** Nexconn Web Chat SDK (`@nexconn/chat`) and the Nexconn Server API.
- **DB:** MongoDB Atlas. **LLMs:** OpenRouter (Nemotron plus free fallbacks). **Speech:** Sarvam AI (STT/TTS).
- **Features:** Claire assistant (supplier ranking, order splitting), results/comparison/insights, deal rooms (per-reader translation, negotiation tips, offer/counter-offer/order cards, quick replies), orders (GST, advance/balance, tracking, ratings), seller tools (voice onboarding, catalogue from photos, storefront), Trade Desk (human agent dispatch), UI in en/ta/hi, chat translation for 10 Indian languages.
- **Deployment:** a single service on Render (`render.yaml`). The API serves the built web app.
- **Docs you must read first:** `docs/HANDOVER.md`, `docs/BUILD_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/01-research-brief.md`, `docs/02-product-spec.md`, `docs/03-technical-design.md`, `docs/04-build-plan.md`, `docs/flow-guide.html`.

All new work **extends** this app: same conventions, same design system, same contracts, same chat infrastructure. It is not a separate app bolted on.

---

## 2. What I want (my intent, with details I may not have spelled out)

### 2.1 Connect the whole chain, not just retailer ↔ manufacturer
- Today there are effectively two kinds of users. I want **every kind of participant** in garment manufacturing to be a first-class user: yarn suppliers, knitting units, dyeing/processing units, printing/embroidery units, fabric shops, trims and accessory suppliers (thread, buttons, zips, labels, elastic, packing material), cutting units, stitching units, checking/ironing/packing units, manufacturers, wholesalers, retailers, transporters, and anyone else your research finds.
- **One business often plays several roles.** My father buys fabric, cuts in-house, outsources stitching and packs in-house. Roles must not be one-per-account.
- **Search and discovery** (the existing Claire search and supplier ranking) should cover all these categories, e.g. "dyeing unit near Tiruppur that can do 500 kg navy by Friday".
- **Reuse the existing chat and deal rooms** for these new relationships instead of building a second messaging system. New kinds of structured cards (e.g. job-work order, dispatch, receipt) should follow the existing offer/order card pattern and `BUILD_CONTRACT.md`.

### 2.2 Track every flow, for every participant
- Every business should be able to record and see what came in, from whom, what went out, to whom, what was processed into what, and what is still pending, broken down by **material/spec, quantity + unit, colour, size, lot/batch, dates (sent, expected, actually received), rate/cost, and process loss**.
- **Expected dates** need two different kinds of lead time:
  - **Procurement lead time:** buying ready material, e.g. trims arriving from a shop.
  - **Processing turnaround:** material sent out for a process and coming back transformed, e.g. dyeing or stitching.
  - Defaults should come per counterparty and process, improve from history, and be shown as expected vs actual, with delays flagged.
- This applies to **all participants**, not only manufacturers. A dyeing unit needs to track which principal's fabric is in which batch just as much as my father needs to track what's at the dyer.

### 2.3 Inventory management
- Stock **by material/spec, colour, size, lot and location**.
- Clear answers to: *what do I own*, *where is it physically right now*, *what am I holding that belongs to someone else*, *what's coming in and when*, *what's running low*.

### 2.4 Flow dashboard and analytics
- A **visual flow view** of each production run/order: where every piece of material is right now, what's done, what's pending, what's late.
- **Inventory views** and **analytics that are useful, not decorative.** Every chart or number must answer a question the user would actually act on (see §6).

### 2.5 A private Claire for every user
- Separate from the Claire that sits inside deal rooms, each user gets a **personal one-to-one chat with Claire** for questions, analytics and record-keeping about **their own** business:
  - "How much black fabric is still with Murugan Dyeing?"
  - "Which stitching orders are late this week?"
  - "What's my average process loss at each dyer?"
- **Strongly consider (propose it to me):** letting users **create records by voice or chat**. For example, "sent 200 kg navy single jersey to Murugan Dyeing, expected Friday" would produce a confirmation card, and the user taps to save. For our users, talking will beat forms.
- It must work in Tamil, Hindi and English using the existing translation and Sarvam pipeline.

### 2.6 UI quality
A **neat, clean, professional UI with no "AI slop"** (see §8). It must suit Tiruppur SME owners and workers: mobile-first, budget Android phones, patchy 4G, mixed literacy, Tamil-first for many.

---

## 3. Real scenarios the design must handle exactly

These are the acceptance tests for the domain model. You must be able to represent each one end-to-end, from every participant's point of view, without hacks.

**Scenario A — my father's unit**
1. **Fabric Shop F** buys white/grey fabric from a knitting source, sends it to **Dyeing Unit D**, gets it back dyed, and sells dyed fabric to my father. (F's own flow: purchase → job work at D → stock → sale.)
2. My father buys **buttons and zips from Trims Shop T1** and **thread from Trims Shop T2**.
3. He **cuts the fabric in-house** into panels by style, size and colour.
4. He sends **polyester S and M panels plus the required thread, buttons and zips to Stitching Unit S1**, and the **remaining sizes plus trims to Stitching Unit S2**.
5. Stitched garments come back. They may arrive **partially, over several days, with some rejects** sent back for rework.
6. He **packs in-house**.
7. He dispatches to **3 different sellers** in different quantities.

Each of F, D, T1, T2, S1, S2, my father and the 3 sellers should see **their own correct slice** of this flow.

**Scenario B — split cutting and colour/size-wise stitching**
Manufacturer M gives fabric to **Cutting Unit C (cutting only)** and gets panels back. M then sends panels to **3 stitching units, one per colour + size combination**. Packing is done in-house.

**You must add at least 8 more scenarios from your research**, including edge cases such as:
- A yarn → knitting → dyeing chain run by a yarn trader.
- Printing or embroidery on cut panels between cutting and stitching.
- A dyed lot rejected for shade mismatch.
- A job worker sub-contracting part of the work to another unit.
- One job worker holding material for many principals at once.
- Leftover fabric or trims returned to the owner versus kept and adjusted.
- One order using fabric from two different dye lots.
- Partial dispatches to a retailer and returns from a retailer.

---

## 4. Domain primer: starting hypotheses, NOT facts

This is my and my assistant's understanding of the Tiruppur knitwear chain. **Treat every line as a hypothesis to verify with research**, then correct, expand or remove it. Cite sources in your research doc.

**Likely stages:**

| Stage | Main inputs → outputs | Typical attributes | Typical units |
|---|---|---|---|
| Yarn | cotton/poly/viscose/blends → yarn | count (e.g. 20s/30s/40s), combed/carded, blend %, colour/melange, lot | kg, bags |
| Knitting (often job work) | yarn → grey fabric | structure (single jersey, interlock, rib, pique, fleece), GSM, dia/width, gauge | kg, rolls |
| Dyeing & processing | grey fabric (or yarn) → dyed/finished fabric | shade/colour code, lab-dip approval, compacting/raising/washing, shrinkage, process loss % | kg, batch/lot |
| Printing / embroidery | fabric or cut panels → printed/embroidered | design, colours, placement | kg or pieces |
| Cutting | fabric → cut panels | style, size ratio/size set, colour, marker efficiency, wastage | kg → pieces |
| Stitching (often job work, per-piece rate) | panels + trims → garments | style, size, colour, operations, rejects | pieces |
| Checking, ironing, packing | garments + packing material → packed goods | QC pass/fail, tags, polybags, cartons | pieces, dozens, cartons |
| Trims & accessories | purchased | thread, buttons, zips, labels, elastic, tags, polybags, cartons; consumption per piece | pieces, cones, kg, gross |
| Dispatch & sale | packed goods → buyer | buyer, transporter, quantities by size/colour | pieces, cartons |

**Cross-cutting realities to verify:**
- **Job work.** The owner sends material to a job worker, keeps ownership, and gets processed goods back. Check how this is documented in practice (delivery challans, any GST job-work rules and forms, return time limits, e-way bills), and confirm the **current** rules rather than relying on memory.
- **Process loss and yield** are normal and expected (dyeing shrinkage, cutting wastage, stitching rejects). They differ by process and by job worker.
- **Partial quantities everywhere.** Send 500 kg; get back 220 kg on Tuesday and 260 kg on Friday; 20 kg is loss.
- **Mixed units and conversions.** Fabric is traded in kg and garments in pieces or dozens, with size–colour matrices and size ratios.
- **Relationships are informal and phone-based.** Credit terms are common, and many players are not digitally savvy.
- Look at **existing tools** (garment ERPs, Tally job-work features, Zoho Inventory and the like, local Tiruppur software, WhatsApp-based workflows) for what they do well and why SMEs still don't use them.

**Modelling insights I believe matter. Red-team these too; don't accept them blindly:**
1. **Ownership ≠ custody.** Material owned by A can sit at B's unit. Inventory must be able to answer both questions.
2. **Role is per step or transaction, not per account.** One business can be buyer, job worker and seller on different days.
3. **A process step = inputs consumed → outputs produced**, with expected ratios, process loss, turnaround, rate, and who performs it (in-house or a job worker).
4. **A production flow is a graph (DAG), not a straight line.** Things split (sizes to different stitchers), merge (panels + trims) and run in parallel.
5. **Process types must be data, not code.** A new kind of process (say, "garment washing") should not need a code change.
6. **Quantity conservation.** For every movement or step: sent = received + accepted loss + rejected + still pending. The system must always be able to show where every unit went.

---

## 5. Hard requirements

1. **Flexible, not hard-coded.** No fixed chain of stages and no fixed set of material attributes. Material types and process types are configurable, with validated attribute schemas per type and sensible built-in templates for common Tiruppur materials and processes.
2. **Ownership vs custody**, as above.
3. **Multi-role businesses.** Existing retailer/manufacturer roles must migrate cleanly into whatever role model you design.
4. **Partial, lossy, split and merged movements** are first-class. Rejects, rework loops and returns are supported.
5. **Variants.** Size–colour matrices and lots/batches, with unit conversions where they make sense (and refused where they don't).
6. **Works single-player, gets better multiplayer.** A user must be able to record a counterparty who is **not on the platform** (name + phone) and track everything on their own. When the counterparty joins or is invited, records link up. When both sides are on the platform, use **two-sided confirmation** (sender records a dispatch, receiver confirms the quantity received). Discrepancies are **surfaced and tracked, never silently overwritten**.
7. **Expected dates**, per §2.2: procurement vs processing lead times, per-counterparty defaults that learn from history, expected vs actual, delay flags.
8. **Effortless data entry.** Voice, chat or photo first. Minimal typing, smart defaults (last counterparty, last spec, usual rate), and common actions in ≤3 taps. Fully localized in en/ta/hi through the existing i18n.
9. **Privacy and isolation.** A business sees only its own data plus exactly what is shared with it through a shared flow or deal room. The personal Claire obeys the same rules (see §7).
10. **Audit trail.** Quantities are never silently edited. Corrections are new events with who, when and why.
11. **No regressions.** Every existing feature (retailer ↔ manufacturer flow, deal rooms, orders, seller tools, Trade Desk, demo login) keeps working.

---

## 6. Dashboards and analytics: useful, not vanity

For every screen and chart, write down **the question it answers and the decision it helps make**. If you can't, drop it. Candidates to evaluate:

- **What's with whom right now:** quantity, since when, expected back, overdue. This is probably the single most important view.
- **Inventory:** owned vs held for others, by material, colour, size and location; low stock relative to upcoming needs.
- **Incoming/outgoing this week**, and late items.
- **Flow view per order or production run:** a visual graph or timeline showing each branch's status, quantities and dates.
- **Job worker and supplier performance:** turnaround vs promised, process loss vs norm, reject rate, discrepancy rate.
- **Trims consumption** vs plan per style.
- **Order progress** for retailers and manufacturers; optionally the money tied up in work-in-progress, if costs are recorded.

Charts must use real data (seed data in demo mode), units on every number, accessible colours, and text plus colour for status (never colour alone).

---

## 7. The personal Claire assistant

- **Grounded, never invented.** Every number comes from a server-side tool or query over the user's own data. If data is missing, Claire says so. Where useful, show which records an answer is based on.
- **Tool design.** Define a small, well-typed set of tools: query inventory, query movements/pending, query flow status, compute analytics, and draft a record for confirmation.
- **Scoping is enforced on the server** from the authenticated business. Never trust a business ID or filter supplied by the model. Test that one user cannot get another user's data through prompts.
- **Writes require explicit confirmation.** Natural language becomes a draft card, the user confirms, and only then is the record saved.
- **Verify the model setup.** Check that the currently configured OpenRouter models (Nemotron and the free fallbacks) actually handle tool/function calling reliably. If not, propose a fallback, e.g. a stronger model for this assistant only, or structured JSON output with server-side execution, with the cost implications spelled out.
- **Multilingual and voice.** Reuse the existing Sarvam STT/TTS and translation pipeline.
- It is separate from the deal-room Claire but shares code where sensible.

---

## 8. UI: clean, professional, zero AI slop

1. **Research first.** Search the web for what designers currently call "AI slop" or generic AI-generated UI patterns, and for good examples of dense, practical operations UIs (inventory, logistics, ERP-lite, fintech apps for small businesses in India). Write a short do/don't list into `docs/supply-chain/ui-principles.md`, with links.
2. **Starting "don't" list (expand it):** purple/blue gradients and gradient text; glassmorphism; sparkle ✨ icons and "AI-powered" badges everywhere; emoji as section icons; vague hero copy ("Unlock the power of…"); cards nested in cards; the same rounded-2xl + shadow on everything; everything centre-aligned; walls of KPI tiles nobody uses; rainbow chart palettes; gratuitous animation; dark neon dashboards; lorem ipsum or fake-looking numbers.
3. **Do:** follow and extend `docs/DESIGN_SYSTEM.md` (don't fork it); clear hierarchy; tables where tables are right; plain verbs on buttons; numbers with units; generous tap targets; layouts that survive long Tamil strings; empty states that teach the next action; fast on low-end Android.
4. If a frontend-design skill or browser/screenshot tooling is available to you, **use it**. Render each new screen at mobile and desktop widths, screenshot it, critique it against `ui-principles.md`, and fix it before calling the screen done.

---

## 9. How to work: phases, gates and checkpoints

Write all planning docs to `docs/supply-chain/`. Keep a running `docs/supply-chain/PROGRESS.md` (current phase, decisions made, open questions, what's next) so work can resume cleanly in a new session.

**Every phase ends with a verification gate:**
- (a) Self-review against this brief.
- (b) An **independent devil's-advocate subagent** that did not write the work, briefed to break it with concrete counter-examples.
- (c) Fixes.
- (d) A short "what the red team found and what changed" note in the phase doc.

**Checkpoint** means: stop, give me a summary of at most one page, list the decisions you need from me (each with your recommendation), and **wait for my go-ahead**.

**Phase 0 — Understand the current app** (no code changes)
Read every doc in `docs/` and the relevant code in `server/`, `web/` and `shared/`. Run the app locally if possible. Write `00-current-state.md`: architecture, data model, message/card types, how Claire's pipeline works, i18n setup, auth/roles, and exactly where the new feature should plug in (reuse points, risks, constraints). Continue straight to Phase 1.

**Phase 1 — Domain research** → `01-domain-research.md` → **CHECKPOINT**
Use parallel research subagents:
- Value-chain stages and who does them in Tiruppur.
- Materials, attributes and units per stage.
- Job-work practice and paperwork, including current GST rules.
- Existing software and why SMEs do or don't adopt it.
- Typical lead times and loss percentages.

Cite sources and mark confidence (verified / likely / uncertain). Correct my hypotheses in §4. Draft the 8+ extra scenarios.

**Phase 2 — Domain model** → `02-domain-model.md` → **CHECKPOINT**
Cover entities, relationships, state machines (movements, steps, orders), the quantity-conservation rules, ownership vs custody, multi-role handling and the off-platform counterparty model. **Walk every scenario in §3 plus your new ones through the model step by step, from each participant's view**, as worked tables. The devil's-advocate subagent should attack it with edge cases until it holds.

**Phase 3 — Product and UX design** → `03-product-ux.md` + `ui-principles.md` → **CHECKPOINT**
Cover personas, key user journeys per role, information architecture and navigation, and the screens (text wireframes or simple static HTML mockups). Show how this integrates with existing chat, deal rooms, search, onboarding and Trade Desk. Specify the personal Claire conversation design, the dashboard/analytics list with the question each answers, and the localization plan.

**Phase 4 — Technical design** → `04-technical-design.md`
Cover:
- MongoDB collections, schemas and indexes.
- API routes.
- New chat card/message types, added to `BUILD_CONTRACT.md`.
- Shared types in `shared/`.
- Claire tool definitions and server-side scoping.
- Permissions.
- Migration of existing users and roles.
- A feature flag.
- Performance (e.g. computing inventory from events vs maintaining snapshots, with the trade-offs stated).
- Failure modes and the testing strategy.

**Phase 5 — Build plan** → `05-build-plan.md` → **CHECKPOINT** (together with Phase 4)
Break the work into **vertical slices**, each demoable on its own and ordered so the most valuable, least risky slice comes first. A likely first slice: record a job-work dispatch and its receipts for one business, plus the "what's with whom" view. Don't write production code until I approve this phase.

**Phase 6 — Implementation, slice by slice**
For each slice: implement → typecheck/lint/build → tests (especially quantity-conservation invariants and data isolation) → run it and check the UI in a browser → update docs → commit with a clear message → short report in `PROGRESS.md` → continue to the next slice. Stop and ask only if you're blocked or a decision would change the approved design.

**Phase 7 — Final verification**
Seed demo data for Scenarios A and B (clearly marked demo, consistent with the existing "Explore as a demo business" login) and run both end-to-end from every participant's account. Have an independent reviewer subagent audit correctness, security/isolation, UX and regressions. Fix what it finds. Update `HANDOVER.md`, `BUILD_CONTRACT.md` and `DESIGN_SYSTEM.md`.

---

## 10. Using subagents well

- Use them **in parallel** for independent research questions and for review. Give each one a precise brief, the files to read, and the exact output format you want back.
- **Red-team subagents must not be the author.** Brief them adversarially, e.g. "Find 10 realistic Tiruppur situations this model cannot represent or would get wrong. Give concrete quantities." Then judge their findings on the merits; don't just accept or dismiss them.
- Use web search freely for research. Prefer primary sources (government/GST portals, industry bodies such as TEA, academic or industry reports) over SEO blogs.

---

## 11. Engineering rules

- Read before you write. Match existing patterns, naming, folder structure and error handling.
- TypeScript strict. Shared types live in `shared/`. Validate at the API boundary.
- Add a new dependency only with a one-line justification in the PR/commit notes.
- Run all new user-facing strings through the existing i18n setup (en/ta/hi).
- Write tests for domain logic: conservation, partial receipts, splits/merges, loss, rework, unit conversion, isolation.
- Keep typecheck, lint, build and existing tests green after every slice.
- Never commit secrets or `.env`. **Do not push, deploy, or touch production data without asking me.**
- Ship behind a feature flag until I approve turning it on.

---

## 12. Questions and communication

- **Ask me when the answer changes what you build**, never for things you can find out yourself. Batch questions, and give each one your recommended default so I can just say "go with your defaults".
- I often type fast and informally, with typos. Interpret my intent; ask only if it's genuinely ambiguous and matters.
- Be honest. If something in this brief is wrong, unrealistic or over-scoped, say so and propose a better approach.

**Decisions I haven't made yet. Raise these at the Phase 1 checkpoint with recommendations:**
1. v1 scope: which roles/stages to support first.
2. Whether costs, payments and invoicing are in scope for job work.
3. Whether to generate GST documents (delivery challans, e-way bill data) or just record them.
4. Notification channels: in-app/chat only, or also WhatsApp/SMS.
5. Offline support.
6. How off-platform counterparties receive updates (share link? SMS?).
7. Any demo/deadline constraint that should shape scope.
8. How existing retailer/manufacturer accounts map onto the new role model.

---

## 13. Definition of done

- Scenarios A and B plus all research scenarios work end-to-end in the app, from every participant's view, with correct quantities at every step.
- The "what's with whom", inventory, flow view and analytics screens answer real questions. Every number reconciles with the underlying records.
- The personal Claire answers questions and records movements accurately in en/ta/hi, and cannot access another business's data.
- The UI passes the `ui-principles.md` review at mobile and desktop widths.
- There are no regressions in existing features, all checks pass, and the docs are updated.

---

**Start now with Phase 0.** Don't write any production code yet.
