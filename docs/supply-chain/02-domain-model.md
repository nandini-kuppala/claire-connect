# 02 · Domain model — supply-chain tracking (v3.1)

Phase 2 of `BRIEF.md`. Builds on `01-domain-research.md` (approved 20 Nov 2026, all 13 recommended defaults). Concepts, rules and invariants only; storage, APIs and UI come in Phases 3–4. Field names are indicative.

**History.**
- **v1** (20 Nov) — walked through all 30 scenarios by four independent verifiers (`walkthroughs/w1…w4`): ~110 gaps.
- **v2** (21 Nov) — folded those fixes in.
- **v3 / v3.1** (21 Nov) — answers an independent red team of v2 (28 findings, §16): splits job *owner* from *client*, drops estimated-consumption postings in favour of read-time estimates, snapshots terms on shared records, blocks closure during disputes, closes privacy leaks, adds correction/respec/casualty events, and defines a **smaller v1 vocabulary** (§3.10) over an extensible model.

§14 maps every walkthrough gap to its fix; §16 maps every red-team finding (rounds 2 and 3). §15 lists the decisions for the checkpoint.

---

## 1. Principles

| # | Principle |
|---|---|
| P1 | **Every quantity change is an immutable event.** Balances are derived. Corrections are new events (or superseding assertions) with who, when and why. |
| P2 | **Three event families:** *Movement* (custody and/or ownership changes), *Job events* (inputs consumed → outputs produced), *Adjustment* (count, regrade, respec, correction, casualty). Everything else is a non-quantity object. |
| P3 | **Every holding has owner, custodian and via** (the intermediary still accountable for sub-contracted goods). |
| P4 | **Two sides, two assertions, never overwritten.** Differences become weighing differences (within tolerance) or discrepancies. |
| P5 | **Conserve per input line in its base unit**; unexplained remainders post to an explicit `RESIDUAL`. |
| P6 | **Quantity basis:** a job's *issued* quantity is what the performer **received** (after resolution); its *output* is what the performer **declared** (or, for an off-platform performer, what came back). **Orders** (purchase/sale) count fulfilment by the **risk terms** (received + losses the buyer bears). **Jobs** bill on the received (post-resolution) quantity unless the terms say "bill on sender's weight". Road differences are never process loss. |
| P7 | **The ledger records physical facts only.** Inputs are consumed when a job closes; "approx. still at the performer" is computed **at read time** (issued − output-equivalents − by-products − dispositions) and labelled as an estimate. Views never add allocated inputs and outputs together. |
| P8 | **Shared records post once, under one snapshot of terms** (tolerance, loss bearer, bill basis) taken from the agreed order, else the first recorder's terms, else the template. The snapshot is a **shared field** of the record (both parties see it); the relationship it came from stays private. Differing terms show as a conflict, never as two postings. |
| P9 | **Roles belong to records, not accounts.** A job has an **owner** (of the goods, derived from the input holdings) and a **client** (who pays the performer). They differ in sub-contracting. |
| P10 | **Types are data; behaviours are a fixed vocabulary in code** (conservation kind, rate basis, billable grades, ITC-04 code). |
| P11 | **Works single-player:** every counterparty may be an off-platform contact; untracked stock is the explicit `EXTERNAL` source/sink. |
| P12 | **Only quantity, unit, counterparty and date are mandatory.** Material can start as an *unspecified* spec and be re-specced later. |
| P13 | **Privacy is per line and per field, and per role.** Physical involvement never reveals prices, other owners' lines or upstream parties; staff never see money; Claire uses the same masked queries. |
| P14 | **Two clocks:** every event has a *business date* (IST, what the user says happened) and a *record time* (server, for ordering). Counts and balances "as of" a date use business dates. |

## 2. Big picture

```
 non-quantity objects: Party (Business | Contact) · Relationship(terms) · MaterialType · Spec · Lot · Style(BOM)
                       ProcessType · Job(owner, client) · Run · Order(+amendments) · Discrepancy · Batch(private)
                       Norm · RateCard · CalendarEvent(private) · Settlement (one money ledger) · Bill (derived)
 events (immutable) ──post──► ledger entries ──Σ──► Holdings  (spec · lot · grade · owner · custodian · via · location · state)
   Movement (versioned assertions, terms snapshot)      read-time views: what's with whom (incl. approx. pending at performers)
   Job events (issue, issue-in-place, output, ready, close, reopen)   inventory · flow graph · bills · lateness · GST clocks
   Adjustment (count, regrade, respec, relabel, correct_line, casualty, found, opening)
   Resolution (discrepancy outcomes)
```

---

## 3. Entities

### 3.1 Parties

**Business** (existing). Adds:
- `capabilities[]` — derived from `sells/buys`, discovery only.
- `process_offerings[]` — process, material classes, capacity/day, minimum lot, typical turnaround, indicative rate.
- `locations[]` — optional.
- `gst {gstin?, registered, turnover_band?, apob_addresses[]}`.
- `related_business_ids[]` — separate parties.
- `tracking_scope` — families it tracks; anything else flows via `EXTERNAL`.
- `phones[]` — several numbers per business allowed.

**User**. `role: owner | staff | agent`.
- **Staff** record movements, receipts, outputs and counts; they see no rates, bills, settlements or analytics, and Claire answers them under the same mask.
- **Approval:** a staff count difference above *N* units (per material class, default 5 pcs / 2 kg) waits for owner approval.
- **Audit:** every event stores `recorded_by_user_id`.

**Contact** (off-platform; owned by one business): `{name, phones[], language?, address?, linked_business_id?, link_state}`.

**Party reference**: `{business_id}` | `{contact_id}` | `self` | `EXTERNAL(party)` | `market`. Canonical resolution at read time (a linked contact reads as its business); stored references are never rewritten.

**Ship-to snapshot** on a movement when a job worker must deliver to someone it doesn't know: `{name, phone?, address}`, copied from the principal's contact; the contact record stays private.

**Relationship** (recording business × counterparty, private):
- language; rate cards; norms; private notes; the statement-link token;
- **terms** `{weighing_loss_bearer, transit_risk, freight, bill_basis: received (default) | sender_weight, billable_reject_causes[], tolerance_by_class (manual; template default)}`.
- `disclose_subcontractors` is a setting of the **performer** (the one who sub-contracts), not of its client's terms.
- Terms are **snapshotted onto each shared record** (P8): from the agreed order, else from the sender.

### 3.2 Material catalogue

- **MaterialType** (data):
  - fields: `form`, `base_dimension`, `base_unit`, `allowed_units[]`, `material_class_key?`;
  - attributes with `role: spec | lot | info`;
  - built-in templates from `research/materials-units.md` §a, plus `unspecified-mass`, `unspecified-count` and `unspecified-length` placeholders.
- **Spec** — content-addressed: material type + normalised spec attributes; local aliases per business.
- **Grade** — `A | B | rework | reject | scrap`, plus an optional `reject_cause`.
- **Lot** — `{spec, label, origin, parent_lot_ids[]}`. Lineage edges are visibility-filtered (§7).
- **Style** (optional): size set; components per garment with consumption per size; trims BOM; pack definitions including packaging; co-ord sets with several primary components. Snapshotted onto jobs.
- **Quantity** — `{base_qty (g | cm | pc), entered {value, unit}, unit_source: typed|defaulted|parsed, factor?, secondary?, approx}`. Tolerance class follows `factor.source`.

### 3.3 Holding (derived) and pseudo-holdings

Key: `(spec, lot, grade, owner, custodian, via, location, state)`.

`state`:
- `available`
- `allocated(job)`
- `in_transit(movement)`
- `disputed(discrepancy)`
- `ready(job)`
- `held(reason)`, where reason ∈ `qc | rejected_on_receipt | dues | detained | customer_hold | found_pending`

**Pseudo-holdings** (may go negative):
- `EXTERNAL(party)`
- `CONSUMED(job)`
- `LOSS(kind, attributed_to)`
- `RESIDUAL(job)`
- `ADJUSTMENT(reason)`
- `WRITTEN_OFF(reason)`
- `SOLD_TO_MARKET`

### 3.4 Movement

**Header:**
- `id`, `purpose` (§3.4.1)
- `from {party, location?}`, `to {party, location?, ship_to_snapshot?}`
- `seller?`, `buyer?`, `title_passes`
- `transport? {mode, transporter_party?, lr_no, vehicle, packages_count}`
- `documents[] {kind, number?, date?, url?, generated?, shared?}`
- `order_id?`, `run_id?`
- **`terms_snapshot`**
- `business_date`, `recorded_at`, `recorded_by`
- `visible_to_counterparty_at` — record time + an **undo window** (default 10 minutes) before the counterpart sees it

**Lines** (one per spec × lot × grade × job):
- `spec`, `lot?`, `grade`, `reject_cause?`, `qty`
- `owner_before`, `owner_after`, `job_id?`, `release_from_run?`
- `rate?`, `value?`, `hsn?`
- `line_kind: goods | jw_own_material | by_product | leftover | sample`
- `packages[]?` — v1.1

**Assertions** (`sent[]`, `received[]`, versioned):
- Each is `{base_qty, grade?, spec_override?, by, evidence, business_date, recorded_at, reason?}`.
- **Evidence levels defined:**
  - `account` — the party itself, from its verified account, about its own side;
  - `link` — the party via the statement link;
  - `on_behalf` — the recorder typing the other side's figure ("told by phone");
  - `self` — the recorder about its own side when the other side is off-platform;
  - `provisional` — only one side exists so far;
  - `implied` — inferred from a later event.
- **Which counts:** the highest evidence rank wins (`account > link > on_behalf > self > provisional > implied`); recency (server record time) breaks ties within a rank.
- **Superseding:** a side may supersede its own assertion until the other side has **responded to that specific assertion** (confirmed or disputed it). A recorder can always supersede its own `on_behalf` entry before the counterparty confirms. So a typo is fixed directly, not through a dispute.
- **Ownership-only movements** carry `accepted[]` instead.
- **Rejected on receipt:** a receiver may record a line as `rejected_on_receipt`.

#### 3.4.1 Purposes — v1 surface and internal meaning

Users see **six** actions. Flags map them to the internal purposes the rules use.

| v1 action (user sees) | Flags | Internal purpose | Custody | Ownership | via |
|---|---|---|---|---|---|
| **Send for work** | `rework_of?` | `job_work_out` | ✓ | — | — |
| **Return from work** | from a job or child job | `job_work_return` / `subcontract_return` | ✓ | — | cleared |
| **Forward to another unit** | `instructed_by_owner` (requires the owner's assertion; default **false**) | `hop` (true) / `subcontract_out` (false) | ✓ | — | — (hop) / sender (subcontract) |
| **Move between my places** | — | `transfer` | location | — | — |
| **Buy / Sell** | `in_place`, `return {credit|replace}`, `consignment {out|return|sale}`, `from_job_worker_premises`, `direct_to_job_worker` | `purchase`/`sale`, `sale_in_place`, `purchase_return`/`sales_return`, `consignment_*`, `sold_from_premises`, `direct_delivery` | ✓ / — | ✓ / — | — |
| **Give sample** | `returnable?` | `sample` / `returnable_sample` | ✓ | ✓ / — | — |

Rework inside a sub-contract is a **Forward** with `rework_of` (keeps `via`). Consignment UI ships in v1.1; the model supports it now.

### 3.5 ProcessType and Job

**ProcessType** (data): `{input_forms[], output_forms[], conservation_kind, rate_basis, billable_grades, itc04_nature, default_turnaround_days, rework_turnaround_days, rework_extra_loss_pct, calendar, loss_norms_by_class, required_measurements[]}`; built-in rework variants per process.

**Job** fields:
- `id`, `process_type`
- **`owner`** — derived: the owner of the input holdings at each output; normally fixed, it changes only through a sale-in-place of allocated goods, which must name the job.
- **`client`** — who pays the performer: the owner for a direct job; the intermediary for a sub-contract.
- `performer`, `parent_job_id?`, `rework_of?`, `caused_by?`, `run_id?`, `order_id?`
- `plan` — the factors snapshot
- `rate {basis, value, status: unilateral|proposed|agreed|disputed}`
- `promised_at?`, `expected_at`, `pauses[]`, `status`

**Events:**
- `issue` and `issue_in_place` (goods already at the performer; after a purchase in place it **starts the GST clock**, §12).
- `output` — spec, lot, grade, qty, measurements, `qty_basis: weighed|counted|allocated`.
- `ready`, `hold`/`release`, `close`, **`reopen`** (dated, with reason), `cancel`.

**Implied events:**
- *Implied output:* any movement out of a performer for a job (`job_work_return`, `subcontract_return`, `hop`, `sold_from_premises`) that carries output specs implies the matching `output` (evidence `implied`).
- *Implied receipt:* the first output or return from a performer implies receipt of that job's unconfirmed issue lines (evidence `implied`).
- *Precedence:* implied evidence never overrides an account, link or on-behalf assertion (§3.4 ranking).

**Roll-up:** the owner's view aggregates child and rework descendants (quantities, outputs, dates). Each job's **bill** stays between its client and performer (§11.4). Unprocessed returns from a child to its intermediary go back into the parent's allocation and reduce `forwarded`.

**Batch** (performer-private): a machine batch combining several owners' inputs.
- **Sub-lots:** each owner gets its own output sub-lot (`D-5010/F`).
- **What the principal sees:** "allocated by dyer"; never the word *batch*, never other owners.
- **Audit:** batch input/output totals open to audit only on escalation.
- **Norms:** allocated losses are excluded from learned norms.

### 3.6 Adjustment

`{kind, scope, qty|counted, reason, recorded_by, business_date, approval?}`. Kinds:

| Kind | Meaning |
|---|---|
| `count` | Physical total for `(spec, lot, custodian, location)`, as of its business date. Within tolerance, the difference goes to the custodian's own holding first. If the count touches another owner's goods, a `count_mismatch` opens per owner, **attributed to the custodian by default** unless the owner accepts a share. Each owner sees only its own book and allocated share. Counts of goods allocated to an open job compare with the read-time approx. pending and are stored on the job. An event back-dated before a count posts as a **count variance**, not a silent change. |
| `regrade` | Grade change; nets to zero. |
| `respec` | Moves quantity between specs (typo, "unspecified" → real spec), keeping lot lineage; GST clocks and job matching follow the respec chain. |
| `relabel` / `split_lot` | Fix lot identity (two lots mixed in one rack → split by agreement). |
| `correct_line` | Changes a posted line's `owner`, `job` or `counterparty` (misdelivery, wrong recipient): reversal + re-post, **acknowledged by both sides**. |
| `casualty` | Fire, theft or flood at a custodian. Raised by the custodian, it opens one discrepancy per affected owner (outcome `destroyed` → `WRITTEN_OFF`, attributed per terms), puts affected jobs into **`cancelled_awaiting_resolution`** (they close once their casualty discrepancy resolves), and flags a GST input-credit review. |
| Shared-rack count rule | The custodian's **own** holding absorbs the difference first. Any remainder: the custodian **proposes a per-owner split**, and each owner accepts or disputes its own share. Accepted shares post `holding → LOSS(count_shortage, attributed_to)` (or `ADJUSTMENT(found)` for a surplus). Counts of goods allocated to an open job post `allocated(J) → LOSS(count_shortage, attributed_to)` once agreed. |
| Aggregate count | "1,140 across all sizes" is accepted as an **internal** mismatch, with no posting, until a per-key recount. |
| Count variance | An event back-dated before a count re-states the as-of book. The difference posts to `ADJUSTMENT(count_variance)` with a link to both events. |
| `found` / `opening_balance` / `write_off` / `correction` | As named; opening balance draws from `EXTERNAL(self)`. |

### 3.7 Discrepancy

**Kinds:** `qty_mismatch`, `spec_mismatch`, `count_mismatch`, `loss_dispute`, `quality_claim`, `transit_claim`, `upstream_fault`, **`ownership_dispute`**, **`casualty`**.

**v1 outcomes**, shown to users:
- `accept_mine`
- `accept_theirs`
- `split`
- `credit` (value only)

Internally these map onto effects. Several outcomes may apply; their quantities sum to the disputed quantity.

**Outcome mapping per kind**, so each choice has exactly one posting:

| Kind | "Accept the receiver's figure" | "Accept the sender's figure" |
|---|---|---|
| `qty_mismatch`, weighed line | difference → `LOSS(weighing_difference, terms bearer)` | receiver's books gain the difference (`ADJUSTMENT(found)` at the receiver) |
| `qty_mismatch`, counted line | sender confirms **short-shipped**: difference back to the sender's holding | receiver gains the difference (`found`) |
| `count_mismatch` | `LOSS(count_shortage, attributed_to)` | book stands; the counter recounts |
| `transit_claim` | `LOSS(transit, transporter or terms bearer)` + optional value credit | — |

- `split` applies the two columns pro-rata to the agreed quantities.
- `credit` changes value only.

**Resolving:**
- **Conceding** is unilateral.
- Off-platform parties accept or decline proposals on the statement link.

**Upstream claims go hop by hop:** father → F, then F → K. Each hop sees only its own counterparty and its own lineage excerpt.

### 3.8 Run, Order, Amendments

**Run** — the owner's flow container. A holding's run membership = the run tag of its latest event. `release_from_run` drops a line from the run view.

**Order** fields:
- `kind`, counterparty, optional `agent {party, commission_pct}`
- lines, optional lump-sum price
- `terms` (agreed snapshot), `promised_at`, `calendar`, `band_days`, status

**Fulfilment:** received + losses borne by the buyer under the terms (P6).

**OrderAmendment:** `{lines ±qty, by, at, reason, accepted_by?}`.

### 3.9 Money (record-only; one ledger)

**Settlement** — the only money record:
- **fields:** `{counterparty, amount, business_date, mode: cash|upi|neft|cheque|adjustment, ref?, applied_to: [{order|job|bill, amount}] | unapplied (advance), recorded_by, evidence}`;
- **set-off:** a set-off between two bills is a Settlement with mode `adjustment`;
- **order milestones:** existing order milestones (advance paid, balance paid) become **views over Settlements**, so nothing is counted twice.

**Bill** — derived (§11.4).

### 3.10 v1 vocabulary (what users see vs what the model keeps)

| Area | Model (extensible) | v1 user surface |
|---|---|---|
| Movement purposes | 17 internal purposes | **6 actions** with flags (§3.4.1) |
| Evidence | 6 levels | **3 badges:** "Your record" · "Confirmed by them" (link or account) · "Not confirmed" |
| Discrepancy outcomes | ~12 effects | **4:** accept mine · accept theirs · split · value credit |
| Norms | blended learning | template until 3 closed jobs, then **median of the last 5** |
| Tolerance | per class | **fixed per material class** (template ±1.5 % weighed, 0 counted), manual override only |
| Calendar events | — | **private** to the recording business |
| Carton contents (`packages[]`), consignment clock & UI, multi-owner batch UI | modelled | **v1.1** |
| Merge of pre-link records | — | data created before phone verification is **never merge-eligible**; after linking, the counterparty confirms on the survivor and the duplicate is archived |

---

## 4. Posting rules

`±q` in base atoms; every posting nets to zero including pseudo-holdings.

### 4.1 Movements

| Event | Postings |
|---|---|
| `sent = s` | `−s H(owner_before, from)` (or `EXTERNAL(from)` if untracked) · `+s H(owner*, in_transit(M))` |
| Transporter recorded | in-transit custodian = transporter; handover package count is an assertion |
| `received = r ≤ s` | `−r in_transit` · `+r H(owner_after, to, available | allocated(job) | held)` (or `EXTERNAL(to)`) |
| `s − r` within the snapshot tolerance | `→ LOSS(weighing_difference, terms.weighing_loss_bearer)` |
| `s − r` beyond tolerance | the **whole** difference stays on the in-transit key as `disputed(D)` (no part goes to weighing loss until resolved), visible to both sides |
| Over-receipt `r > s` | receiver `+s`; excess `r − s` → `held(found_pending)` at the receiver (usable only after resolution) via `ADJUSTMENT(found_pending)`; D opens |
| Receiver-first | posts `s = r` (provisional). The receiver is first offered to **attach** it to an open inbound movement from that party (same spec family, ±1 business day), the same duplicate check inside one business. |
| `rejected_on_receipt` | `+r H(owner = seller, custodian = receiver, held(rejected_on_receipt))` |
| `sale_in_place` / consignment sale | **posts nothing until accepted**; then `−q H(seller, custodian)` · `+q H(buyer, custodian)`. If the goods are allocated to a job, the job's owner changes too and outputs follow the new owner. |
| `hop` | new holding `via = —` (owner-instructed) |
| `subcontract_out` | `via = sender`; `subcontract_return` clears it |
| `sold_from_premises` | `−q H(owner, JW)` · `+q EXTERNAL(buyer)` or buyer's holding; proceeds credit the client's bill |
| `sample` | like any movement through `in_transit` to the receiver (ownership passes); if the receiver never confirms, the in-transit quantity is written off to `WRITTEN_OFF(sample)` after 30 days |
| `returnable_sample` | custody only (the sender keeps ownership); not returned by the agreed date → the sender converts it to `sample` or a sale |
| `jw_own_material` | `−q H(performer's own)` (or `EXTERNAL(self)` if untracked) · `+q CONSUMED(J)` |
| Disputed quantity | cannot change owner or be sold until resolved |

### 4.2 Jobs

| Event | Postings |
|---|---|
| `issue` / `issue_in_place` | the inbound movement's **receipt** posts into `allocated(J)` at the performer; there is no separate issue posting (in-house: `available → allocated(J)`) |
| `output` o | `+o H(spec_out, lot_out, grade, owner, performer, via, available|ready)`; **inputs are not reduced** (P7) |
| By-product | a job output holding (e.g. cut waste kg); **never also posted as LOSS** |
| Leftover returned / forwarded / scrapped / kept-for-next / kept-and-adjusted | movement, write-off, `allocated → available`, or `sale_in_place` to the performer (taxable flag) |
| reaching **`completed`** (no input pending) | the residual is computed; if it is above threshold, a **shortage discrepancy opens now**, before closure |
| **`close`** (blocked while **any** discrepancy linked to the job is open: its lines, counts, shortage, casualty) | `−c allocated(J)` · `+into_output CONSUMED(J)` · `+loss LOSS(process)` · `+residual RESIDUAL(J)` per §5.2; locks the numbers and the bill. Escape hatch: **"close with claim carried"** (dated) locks the job and keeps the dispute open as a value receivable/payable, so an off-platform party who just declines can't block closure forever. |
| `reopen` | dated; reverses the closure postings, accepts late events (a resolution, a merge, rework scrap), then re-closes; the bill shows a dated **bill adjustment** against the locked figure |
| Rework | rejects return (grade `rework`) and are re-sent with `rework_of`; J is never edited |
| `cancel` | goes through closure (`cancelled_partial`) |

### 4.3 Adjustments and resolutions

Owner's own count at own premises → `±` `ADJUSTMENT(reason)` (pending if staff above threshold). A count touching others' goods → `count_mismatch`. Regrade, respec, relabel → paired postings that net to zero. `correct_line` → reversal + re-post. `casualty` → per-owner discrepancies. Resolutions post their outcomes from `disputed(D)` / `held(found_pending)`.

---

## 5. Conservation invariants

### 5.1 Movement line
`sent = received + weighing_difference + disputed + in_transit` (over-receipt excess lives in `held(found_pending)`, not on the line).

### 5.2 Job input line, at closure
```
issued (received basis) = into_output + loss + residual
                        + returned_unprocessed + forwarded(net of child returns)
                        + leftover(returned | kept_adjusted | kept_for_next | sold | written_off)
                        + scrapped_input + shortage(resolved)
```
Same-dimension by-products are counted inside `into_output` for the conservation sum but stay holdings (never `LOSS`). In the table, **`consumed`** means the job-closure figure `issued − returned_unprocessed − forwarded − leftover − scrapped_input − shortage`. That is exactly the quantity that posts out of `allocated(J)` at close, split into into_output + loss + residual.

| Kind | into_output | loss | residual (posted to `RESIDUAL(J)`; above threshold opens a shortage discrepancy) |
|---|---|---|---|
| `mass_losing` | Σ outputs (all grades) + same-dimension by-products | `consumed − into_output`; negative = **gain**, flagged | 0 |
| `count_preserving` | Σ outputs (all grades incl. reject/scrap) | 0 | `consumed − into_output` (e.g. 10 missing fronts) |
| `unit_changing` (cutting) | Σ (output pcs × component g/pc) + measured cut waste/end bits | 0 | `consumed − into_output`; **either sign flagged** against the cutting norm |
| `assembling` | primary inputs 1 : 1 per output (several primaries allowed); secondary by BOM factor | declared trims scrap | `consumed − into_output − loss` per line |
| `disassembling` | input × pack definition | packaging disposition | must be 0 |

**Read-time approx. pending** (P7) = `issued − output-equivalents − by-products − dispositions`, never below 0 (a negative value is shown as "over-yield, check").

### 5.3 Output side
Σ outputs vs planned yield (± amendments); over-production from the cutting allowance is shown, not an error.

### 5.4 Never negative
Real holdings never go negative; violating events are rejected unless they are assertions about someone else's goods (→ discrepancy) or draw from a pseudo-holding.

### 5.5 Global (per owner and spec)
```
Σ holdings = EXTERNAL_in + ownership_in + outputs + ADJUSTMENT(+) + gains
           − ownership_out − CONSUMED − LOSS − RESIDUAL − WRITTEN_OFF − ADJUSTMENT(−) − EXTERNAL_out
```

---

## 6. State machines

### 6.1 Movement
```
draft ─record─► sent (counterpart sees it after the undo window) ─(transporter)─► in_transit
  ─receiver = / within tol─► received ✓
  ─beyond tol / over-receipt / spec mismatch─► received ⚠ ─discrepancy─► settled
  ─rejects lines─► received (part held as rejected_on_receipt)
  ─cancel (before any receipt)─► cancelled
receiver-first: received(provisional) ─sender = ─► ✓ ; ≠ ─► ⚠      implied: later output/return ─► received ✓ (implied)
correct_line (both acknowledge) re-points owner / job / counterparty without editing history
```

### 6.2 Job
```
planned ─issue─► issued ─output─► in_progress ─all inputs accounted─► completed (residual checked) ─close*─► closed ─reopen─► in_progress …
 (* close is blocked while any discrepancy linked to the job is open, unless "close with claim carried")
cancel ─► cancelled_partial ─close─► closed        casualty ─► cancelled_awaiting_resolution ─resolved─► closed
pauses: line-level waiting_input; job-level held_for_dues, detained, cluster_event
outputs: available → ready → returned / forwarded
links: parent_job (sub-contract) · rework_of · caused_by
```

### 6.3 Discrepancy
`open → proposed ⇄ countered → resolved`; `concede → resolved`; `escalate → escalated (Trade Desk) → resolved`.

### 6.4 Contact link (explicit two-sided consent)
```
unlinked ─verified sign-up with a matching phone─► suggested
   suggested: the new business sees only "a business has records with your number" (no name, no data)
   ─new business requests─► pending_recorder ─recorder explicitly approves─► linked   (silence never approves)
                                              ─recorder declines─► declined
linked: shared view per §7; statement link retired when both use accounts
```

### 6.5 Order
`open → partially_fulfilled → fulfilled → closed`; `amended`; `cancelled_partial`. Fulfilment per P6 terms.

---

## 7. Visibility and privacy

Every query is scoped by **(business id, user role) from the session** with server-side field masks; Claire's tools call the same functions; tests cover staff and cross-business attempts.

| Data | Who sees it |
|---|---|
| Movement lines | **per line:** an owner sees only its own lines; the physical `from`/`to` see all lines they handle, but owner fields only as allowed below; commercial seller/buyer see the lines of their trade. The **sub-contracting mask applies here too**: lines of child jobs returned to the owner show the intermediary ("with S1"), never the sub-contractor or its job, unless disclosed. |
| Prices (line rate/value, order rates, lump sums, job rates) | only the commercial parties of that trade, or the client and performer of that job; never physical-only parties, never staff |
| Documents (DC, invoice photos) | parties to the movement; for records created while the counterparty was a contact, only if the recorder marks them `shared` (photos carry values) |
| Dispatch point of a sale | buyer sees "seller's dispatch point" unless it is the seller itself or disclosed |
| Sub-contracting | the **via** sees what it forwarded; the sub-contractor sees the owner as "for S1"; the owner sees "with S1" (silent roll-up) or "a sub-contractor of S1" + name when S1's `disclose_subcontractors` is on. **If the owner is GST-registered, disclosure is required** for ITC-04 (job worker → job worker); S1 is told this when forwarding. Disclosure exposes only a **snapshot** (name, state, GSTIN if any), never S1's contact record. |
| Transporter | packages count, addresses and its own LR only; no contents, values or owners |
| Holdings | owner (incl. custodian/via per the sub-contracting row), custodian, and via for goods it forwarded |
| Lineage | a viewer sees a lot's parents only where it owned or held them or they were on its movements; **hidden parents are omitted entirely** (no placeholder); batches are private and owners get sub-lots. The **sub-contracting mask overrides ownership**: an owner sees lots made at an undisclosed sub-contractor as made "at S1". |
| Counts and count discrepancies | each owner sees only its own book and allocated share, never the physical total of a shared rack |
| Contacts, relationships, norms, notes, analytics, calendar events | recording business only |
| Linked contacts | before both approve: nothing. After: quantities, dates and shared documents of records naming them; never rates or notes unless shared |
| Discrepancies, claims | involved parties; Trade Desk once escalated; upstream claims hop by hop |
| Other principals' goods at the same job worker | never |

## 8. Roles

Per record: owner, client, performer, seller, buyer, custodian, transporter, intermediary (via), agent. Capabilities and process offerings are discovery-only.

## 9. Off-platform counterparties and two-sided records

- **Evidence:** six internal levels (§3.4), three v1 badges (§3.10).
- **Linking:** real phone verification (decision 13) + explicit two-sided consent (§6.4). Several phones per business; a phone shared by two businesses (sister firms) links only where each recorder approves.
- **Merge:** only post-verification data; counterparty confirms on the survivor; duplicate archived (§3.10).
- **Tolerance:** fixed per material class from the snapshot terms (§3.10).
- **Statement link:** one standing token per (recording business, counterparty), also offered for **on-platform accounts that never open the app** ("silent accounts"). Shows open movement lines, open order lines (pending, promised date), open consignment balances. Actions: confirm; differs (qty or spec); propose a return/receipt/output; mark ready for pickup or held for dues; report sold/remaining; accept / decline / **counter (qty)** on proposals. Proposals post only when accepted. DPDP notice and "stop" on the page.

## 10. Validation and plausibility

1. Unit rules (valid / contextual / invalid) with plain-language refusals.
2. Never-negative (§5.4).
3. **Unit-slip check:** compare the quantity with the **open remainder** of the line it settles (or the other side's assertion). If the ratio is within ±5 % of 12, 144, 1,000 or their inverses, **always** ask "did you mean dozen / gross / kg / g?", even when the entry is below the remainder (50 against 600 open is a ratio of 1/12, so it prompts). Partial deliveries whose ratio does not match a unit factor are not flagged. When `unit_source = defaulted`, the check widens to ±10 % (prompts more readily).
4. Plausibility warnings (override with reason): over-yield; pieces/kg outside the style range; loss outside the norm band at closure; received > sent beyond tolerance.
5. Lot-mixing check at the output level (output lot / kit / carton).
6. Kit completeness per size → line-level `waiting_input`.
7. Dozens/gross stored as pieces.
8. Duplicate check on receiver-first entries (§4.1).
9. GST checks (§12).

## 11. Dates, norms, rates, bills

### 11.1 Expected dates
- **Start:** each issue line's clock starts at the performer's receipt business date (`sent` if unconfirmed); the job's expected date = the latest line.
- **Promise vs expectation:** `promised_at` (agreed, revisions kept) vs `expected_at` (promise → norm → template). On shared jobs only the agreed promise is common.
- **Calendars:** processes use their own calendar; purchases use the procurement template's (default 6-day). Bands use the same calendar. Calendar events are private.
- **Lateness covers everything not yet back** (pending inputs or outputs at the performer). Reasons: *processing* / *ready not collected* / *held for dues* / *detained* / *waiting input*. Only *processing* counts against turnaround norms. `due_soon` is suppressed for leads ≤ 1 day.

### 11.2 Norms
Per (viewer, counterparty, process, material class): net working days (pauses excluded, rounded up) and loss %. Template until 3 closed jobs, then median of the last 5. Allocated (batch) losses excluded; rework descendants roll into the performer's rework %.

### 11.3 Rates
RateCard (private, effective-dated) → snapshotted on the job (`unilateral` with contacts; `proposed → agreed | disputed` on platform). Per-receipt overrides apply to that receipt's input-equivalent or pieces. An **agreed total** may replace the computed bill, with a reason.

### 11.4 Bills (between a job's client and performer)
- **Which jobs count toward a bill:** a job's billable quantity includes its own outputs **plus outputs of its sub-contract descendants that come back through the intermediary**, all at the job's own rate. In F, M's bill to S1 = 2,980 good pieces × ₹14 = ₹41,720. Child jobs keep their own bills (S1 → H: 997 × ₹11 = ₹10,967). "Parent" below means the **rework** parent.
- **Billable quantity** follows `rate_basis`. For `per_input_mass` it is the **received (post-resolution)** quantity unless `bill_basis = sender_weight` (K: 785 kg × ₹85 = ₹66,725).
- **`per_good_output_piece`:**
  - each physical piece is billed **once, by its final grade across the rework chain**, if that grade is in `billable_grades`;
  - a deduction applies only to pieces the parent had already billed;
  - rejects whose cause is in `billable_reject_causes` are billable and become an upstream claim.
- **Adjustments:** `+` the job worker's own material; `−` agreed deductions (leftovers kept, resolved shortages); `+/−` sold-from-premises proceeds to the owner.
- **Bill adjustments after reopening** are dated lines against the locked figure.
- **Settlements:** Settlements (incl. advances and set-offs) reduce the outstanding balance. States: `open | part_settled | settled`.

## 12. GST clocks and checks (registered owners)

- **Job-work clock** attaches to each **job-work DC line** and is carried through **job lineage**:
  - **What it covers:** the line's quantity not yet returned in any form.
  - **What closes it:** outputs or leftovers returned to the owner, sales from premises, write-offs, and at closure the loss and by-products within the norm (pro-rata).
  - **What carries it:** respec and hop chains. Outputs still at the performer, e.g. held for dues, stay under the clock.
  - **Alerts:** day 300 / 330 / 350, with tax + interest at risk; 3 years for capital goods.
- **Start points:** a purchase in place followed by `issue_in_place`, and a direct delivery, both start the clock on the performer's receipt.
- **E-way bill:** an inter-state job-work movement without an e-way bill number gets a warning. `detained` pauses the job.
- **APOB check:** applies to `sold_from_premises` **and** to `sale_in_place` at a job worker's premises.
- **Taxable-event flags:**
  - leftovers kept-and-adjusted
  - waste sold from premises
  - consignment sales
  - casualty (input-credit review)
- **Consignment clock** (v1.1): invoice due within 6 months.

## 13. Migration from today's data

| Today | Becomes |
|---|---|
| `businesses.sells/buys`, `role_label` | unchanged; `capabilities[]` derived; `gst.registered` from `gstin`; `tracking_scope` default from sells/buys; `phones[]` from the owner's phone |
| `users.role = 'owner'` | unchanged; `staff` added |
| `orders` (purchase, sample, job_work; `qty_done`; advance/balance milestones) | stay; new jobs and movements link via `order_id`; milestones become views over Settlements for new orders (legacy orders keep their fields) |
| `listings.stock_qty` | unchanged |
| deal-room conversations | where shared movements, jobs and discrepancies post their cards |

No existing record is rewritten or deleted.

## 14. Gap register (v1 walkthrough gaps → fix)

Walkthrough files: `walkthroughs/w1-A-to-E.md` (G1–G18), `w2-F-to-L.md` (F1–L6), `w3-M-to-T.md` (M-G…, #1–#24), `w4-U-to-AD.md` (U-G…–AD-G…).

| Theme | Gap IDs | Fixed in |
|---|---|---|
| Untracked parties make holdings negative | w1 G1 · M-G3 · P-G1 · X-G1 · w3 #1 | P11, `EXTERNAL`, `tracking_scope`, §4.1 |
| Double counting until closure; pending estimate | w1 G2, G7, G9 · G4 · U-G1 | **P7 (read-time pending)**, §5.2 |
| Sent vs received basis | w1 G8 · K2 · W-G3 · w3 #19, #22 | P6, §11.4, §3.8 |
| Regrade; receipts with grade; held(qc) | w1 G3 · J1 · O-G4 · Z-G2 | §3.6, §3.4, §3.3 |
| Sub-contracting, disclosure, roll-up | F1–F5 · AA-G6 · w3 #14 | §3.4.1 Forward + flag, §3.5 owner/client + roll-up, §7 |
| Job links, issue-in-place, rework types | w1 G5, G6, G17 · O-G1, O-G3 | §3.5, §3.4.1 |
| Line structure | F4 · w1 G10, G13 · I2 · w3 #20 | §3.4 (line per job, `approx`, documents; packages v1.1) |
| Field-level price privacy; dispatch point | G3 · AA-G2, AA-G3 · w3 #18 · L5 | P13, §7 |
| Lineage; batch | G1, G2 · w1 G16 · AC-G1 | §3.5 Batch (sub-lots), §7, §3.7 hop-by-hop |
| Disputes | K1, K3 · U-G2, U-G5 · w1 G11 · M-G2, M-G5 · X-G3 · w3 #23 | §3.7, §4.1, §6.3, §9 |
| Assertion versioning; evidence | U-G6 · M-G4 · N-G3 | §3.4 |
| Unit slips | U-G4, U-G7 | §3.2, §10.3 |
| Counts | U-G1, U-G8 · N-G1 | §3.6, §3.1 |
| Dates | Y-G2, Y-G5 · M-G1, M-G6 · w1 G15 · w3 #4, #10–#12, #15, #16 | §11.1, §11.2, §6.2 |
| GST | H3 · X-G4 · AA-G4 · w3 #17, #24 | §12 |
| Transit, terms | N-G2 · w3 #7, #21 | §3.1 terms snapshot, §4.1, §7 |
| Consignment | X-G1, X-G2 | §3.4.1 (v1.1 UI), §9 |
| Money and bills | Y-G1, Y-G4 · W-G1, W-G2 · w1 G4 · O-G2 · AA-G5 · AC-G2 | §3.9, §11.3, §11.4 |
| Orders, runs, cancel | V-G1, V-G2, V-G3 | §3.8, §4.2 |
| Linking, merge, canonical parties, implied receipt | L1–L6 | §6.4, §9, §3.1, §3.5 |
| Packs, multiple primaries, samples | AD-G1, AD-G2, AD-G4 | §3.2, §5.2, §4.1 |
| Global equation | AD-G3 · U-G3 | §3.3, §5.5 |
| Sold from premises; by-product dimension; return-all; tolerance by factor | H1, H2, H4 | §3.4.1, §4.2, §3.2 |
| Lot-mixing false positive | I1 | §10.5 |
| Agent; no premises; lump sum | AA-G1, AA-G8 · Z-G1 | §3.8, §3.1 |
| Ship-to for contacts | AA-G7 · w3 #13 | §3.1 |
| Implied output; norms per class; cutting per component | w1 G14 · L6 · w1 G12, G18 | §3.5, §3.2 |
| **Deferred** (not model changes) | AB-G1 (one user in two businesses) · AB-G2 (group view) · Z-G3 (reference price) · AB-G3 (scenario wording) | §15 |

**Effect on walkthrough numbers:**
- **Holdings during open jobs:** read-time pending, not posted. In G, D shows ~1,435 kg physically present, not 2,991.5.
- **Bills:** each piece billed once by its final grade (w1 G4: 331, not 336; F: 2,980 pieces → ₹41,720).
- **K:** closes at 8.0 % / ₹66,725 only after its discrepancy is resolved (closure is blocked until then).
- **W:** agreed total ₹40,000.
- Conservation at closure is otherwise unchanged.

## 15. Decisions for the Phase 2 checkpoint (with recommendations)

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | **Record payments** (Settlements: cash/UPI/NEFT, advances, set-offs), still with **no collection** | **Yes.** It narrows decision 2 ("no payments"). Without it, "amount due" never clears and advances double-count with order milestones. | Walkthrough Y-G1; red team #25 |
| D2 | **Sub-contracting disclosure** | Default **silent roll-up** ("with S1"); naming the sub-contractor is required only when the owner is GST-registered (ITC-04). S1 is told when it forwards. | Matches practice (sub-contracting is often undisclosed) and the law |
| D3 | **Contact linking needs the recorder's explicit "yes"** | **Yes.** It is slower for network growth, but recycled and shared phone numbers make silent consent unsafe. | Red team #7 |
| D4 | **10-minute undo window** before the counterparty sees a new movement | **Yes** (configurable). | Misaddressed dispatches (red team #21) |
| D5 | **Staff count approval** above 5 pcs / 2 kg | **Yes**, per material class, editable. | Audit without slowing daily use |
| D6 | **v1 surface vocabulary** (§3.10): 6 actions, 3 evidence badges, 4 dispute outcomes, fixed tolerances, simple norms; consignment, carton contents and the multi-owner batch UI in v1.1 | **Yes.** | Keeps v1 learnable; the model stays extensible |
| D7 | **GST clock ends for in-norm process loss** (pro-rata at closure) | Proceed, and **confirm with a CA** before relying on alerts. Listed with the other CA questions in 01 §3. | Legal interpretation |
| D8 | **One person in two businesses** (sister firms) | **Defer** to after v1; v1 uses one business per login. | AB-G1; not needed for scenarios A and B |

## 16. Red team: what it found and what changed

**Self-review against the brief (Phase 2 asks):**

| Phase 2 ask | Where |
|---|---|
| Entities and relationships | §3 |
| State machines for movements, steps and orders | §6 |
| Quantity-conservation rules | §5 |
| Ownership vs custody | P3, §3.3, §7 |
| Multi-role businesses | P9, §8 |
| Off-platform counterparty model | §9 |
| Every scenario walked from each participant's view, as worked tables | `walkthroughs/`; 30 scenarios, all close or show explicit residuals |
| Devil's advocate attacked until the model holds | two rounds: four verifiers plus one red team |

**Round 1 — scenario verifiers** (four agents who did not write the model) found ~110 gaps in v1. All were fixed in v2 (§14), except 4 deferred.

**Round 2 — red team of v2** (independent agent; it re-walked F, G, K and L under v2 and attacked consistency, edge cases, privacy and complexity) found **28 findings**. All were accepted and fixed in v3:

| # | Finding | v3 change |
|---|---|---|
| 1 | One `principal` = owner and payer; breaks sub-contract (F) and sale of goods in process | Job `owner` (derived) vs `client` (P9, §3.5); sale-in-place of allocated goods moves the job's owner |
| 2 | Per-business tolerance/terms make one shared movement post differently on each side | Terms snapshot on shared records (P8, §3.1) |
| 3 | GST clock lost on outputs; never ended by process loss | Clock on DC line through job lineage; ends pro-rata at closure for in-norm loss (§12) |
| 4 | Closure locks numbers; late resolutions/merges/rework scrap have nowhere to go | Closure blocked during open discrepancies; dated `reopen` + bill adjustments (§4.2, §6.2) |
| 5 | Merge folding loses to implied receipts; duplicate outputs | Evidence ranking before recency; implied never overrides (§3.4); merge simplified (§3.10) |
| 6 | Movement lines leak other owners; sub-contractor learns owner | Per-line visibility; owner masked as "for S1" (§7) |
| 7 | Silent consent links contacts; recycled phones; documents leak prices | Explicit recorder approval; count-only reveal; documents only if marked shared (§6.4, §7) |
| 8 | "Consumed" ambiguous; residual never posted | `into_output` / `loss` / `residual`, `RESIDUAL(J)` pseudo-holding (§5.2) |
| 9 | Cutting by-products not netted; negative residual | By-products inside `into_output`, never LOSS; either-sign residual flag (§5.2) |
| 10 | `subcontract_return` didn't imply outputs; rework inside sub-contract dropped via | Implied output from any movement out of a job; rework inside a sub-contract = Forward with `rework_of` (§3.5, §3.4.1) |
| 11 | "Final scrap deducts from parent" double-deducts | Bill each piece once by final grade; deduct only what the parent billed (§11.4) |
| 12 | Via can't see forwarded holdings; transporter over-exposed; ITC-04 vs disclosure | Via and transporter rows in §7; disclosure required for registered owners |
| 13 | Lineage placeholder and batch basis reveal multi-owner batch; uneven split | Hidden parents omitted; owner sub-lots; "allocated by dyer"; audit on escalation (§3.5, §7) |
| 14 | Upstream claims need lineage the claimant can't see; leak downstream customers | Claims hop by hop (§3.7) |
| 15 | Count discrepancies expose shared physical totals; pro-rata blames principal | Owner sees only own share; default attribution to custodian (§3.6, §7) |
| 16 | Staff and Claire not role-filtered | (business, role) scoping with field masks + tests (P13, §7) |
| 17 | Received-basis fulfilment contradicts risk terms | Fulfilment and bill basis follow risk terms (P6, §3.8) |
| 18 | Learned tolerance normalises chronic short-weighing | Tolerance fixed per class, manual override only (§3.10) |
| 19 | Back-dated/offline/concurrent entries | Business date vs record time; counts as-of; back-dated events become count variances (P14, §3.6) |
| 20 | Duplicates inside one business | Attach-to-open-inbound check on receiver-first (§4.1, §10.8) |
| 21 | Misdelivery and misaddressing uncorrectable | `correct_line` with both acknowledgements; 10-minute undo window (§3.6, §3.4) |
| 22 | Spec not mandatory but keys everything; typos split holdings | Unspecified placeholder specs + `respec` (P12, §3.6) |
| 23 | Ownership disputes; sale in place at a dyer-seller skips checks | Sale-in-place posts only when accepted; `ownership_dispute`; APOB check; clock on issue-in-place (§4.1, §3.7, §12) |
| 24 | Fire/theft at a job worker | `casualty` adjustment (§3.6) |
| 25 | Advance before goods move: two money systems | One money ledger (Settlement, unapplied advances); order milestones are views (§3.9) |
| 26a–g | Own material vs tracking scope; self-declared hop; silent on-platform JW; slip false positives; over-receipt limbo; lot mixing; phones | `EXTERNAL(self)` for own material; hop needs owner assertion; statement link for silent accounts; slip check vs open remainder; `found_pending`; relabel/split_lot; `phones[]` (§3–§10) |
| 27 | Estimated-consumption postings over-engineered and the root of #3/#9 | Removed: read-time approx. pending (P7) |
| 28 | Too much vocabulary for v1 | v1 surface: 6 actions, 3 badges, 4 outcomes, simple norms, fixed tolerances, private calendars, deferrals (§3.10) |

**Round 3 — final consistency check of v3** (independent agent; re-walked F, K, U): conservation **holds** in all three; F's rate privacy holds; K's tolerance handling holds; U's owner count and staff approval hold. 13 rule-wording issues found, all fixed in **v3.1**:

| # | Issue | v3.1 change |
|---|---|---|
| 1 | Parent bill didn't include sub-contract descendants (F billed ₹27,762, not ₹41,720) | §11.4 roll-up for bills through the intermediary |
| 2 | K bill basis ambiguous (₹66,725 vs ₹68,000) | P6 split: orders by risk terms, jobs on received unless `bill_basis = sender_weight` |
| 3 | Closure block deadlocked with shortage and casualty | residual checked at `completed`; block on any linked discrepancy; `cancelled_awaiting_resolution`; "close with claim carried" |
| 4 | Unit-slip rule self-contradictory; U's slip could pass | always prompt on unit-factor ratios, including below the remainder |
| 5 | Typos unfixable once the other side had asserted | supersede until the other side responds to *that* assertion; own `on_behalf` always supersedable |
| 6 | Lineage and movement lines bypassed the sub-contract mask | mask applied to both rows (§7) |
| 7 | ITC-04 disclosure vs private contact; whose setting | disclosure = snapshot; setting belongs to the performer (§3.1, §7) |
| 8 | K: what is disputed; what outcomes post | whole difference disputed; outcome-mapping table (§3.7) |
| 9 | Shared-rack count split unimplementable | custodian absorbs first, then a per-owner split each owner accepts; postings defined (§3.6) |
| 10 | No sender terms when the sender is a contact; snapshot privacy | snapshot source order → first recorder → template; snapshot is a shared field (P8) |
| 11 | Off-platform party could block closure forever | counter on the statement link; "close with claim carried" |
| 12 | Sample posting contradicted itself | through in-transit; written off after 30 days unconfirmed; returnable samples keep ownership |
| 13 | Undefined terms (evidence self vs account; "consumed"; "parent"; count variance; aggregate count; issue vs receipt) | one-line definitions added (§3.4, §5.2, §11.4, §3.6, §4.2) |

**Verdict:** after three rounds (~110 + 28 + 13 findings), the last round found only wording issues and no conservation breaks. The model holds for all 30 scenarios.
