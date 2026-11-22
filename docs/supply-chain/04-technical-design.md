# 04 · Technical design: supply-chain tracking

Phase 4 of `BRIEF.md`. It implements the approved domain model (`02-domain-model.md` v3.1) and the approved product design (`03-product-ux.md`, U1–U9) inside the existing monorepo, with no regressions and behind a feature flag. Field names here are binding for Phase 6 unless a slice report changes them.

**How to read this.**
- §1 states the architectural choices.
- §2–4 cover storage.
- §5 covers the write path.
- §6 covers reads, views and performance.
- §7 covers the API.
- §8 covers chat cards and the Goods conversation.
- §9 covers Claire, including the model verification done for this phase.
- §10 covers permissions and privacy.
- §11–12 cover migration and the flag.
- §13 covers failure modes, §14 testing, §15 decisions and §16 the red team.

---

## 1. Architecture choices (and why)

| # | Choice | Why | Rejected alternative |
|---|---|---|---|
| A1 | **Event log + ledger postings + a materialized holdings table, written in one MongoDB transaction** | Every write is atomic, so a crash leaves nothing half-done. Balances are read in O(1). The log replays to rebuild and verify balances. | Computing balances from events on every read: correct, but cost grows with history, and the "What's with whom" list scans every posting. Snapshots only: these lose the audit trail (BRIEF §5.10). |
| A2 | **All new collections prefixed `sc_`**, with existing collections touched only additively | The feature is isolated and easy to drop, and the flag-off app is provably untouched. | Extending `orders` or `listings` in place. |
| A3 | **Prices live in a separate collection** (`sc_prices`), keyed by record and line, with an explicit list of parties | A price can't leak through a query that forgot a mask. Physical parties never load the price collection at all (model P13, §7). | Price fields on movement lines, masked per view. |
| A4 | **Domain core as pure TypeScript in `shared/sc/`** (posting rules, conservation, tolerance, unit conversion, read-time estimates, masks) with no I/O | Unit-testable without a database; the same code runs on the server and in the web form previews (the live balance strip). | Logic in route handlers, as today. |
| A5 | **One repository layer** (`server/src/sc/repo.ts`) that takes a `Ctx {businessId, userId, role}` built only from the auth token | Scoping is enforced in one place, as BRIEF §7 requires; Claire's tools call the same functions. | Per-handler checks, as `deals.ts` does today. |
| A6 | **Visibility is computed at read time from `visible_at`**, with no cron needed for correctness. A 30-second in-process ticker posts the chat cards that are due. | The undo window works even when Render's free plan sleeps; cards catch up on wake. | Scheduled jobs. |
| A7 | **Personal Claire makes one LLM call per turn, and that call only picks a tool and its arguments.** The server runs the tool and renders the answer from a template in the user's language. | Grounded by construction. The model never sees records, so injected text from counterparties can't reach it. One call instead of two halves the free-tier budget use (§9). | A multi-turn tool loop with results fed back to the model. |
| A8 | **At most one new runtime dependency** (`@anthropic-ai/sdk`, only if T1 is approved). Tests use Node's built-in `node:test` through `tsx`; photos use MongoDB GridFS through the existing `mongodb` driver. | BRIEF §11 asks for a justification per dependency. | vitest, mongodb-memory-server, S3. |

---

## 2. Collections

All documents follow today's convention: string `_id` equal to `id`, snake_case fields, `created_at`/`updated_at` in epoch ms. **Business dates** (`business_date`) are `YYYY-MM-DD` strings in IST (model P14); `recorded_at` is the server time in ms.

### 2.1 Parties and setup

| Collection | Shape (abridged) | Notes |
|---|---|---|
| `sc_contacts` | `{id, owner_business_id, name, name_script?, phones[], language?, address?, gstin?, linked_business_id?, link_state: unlinked\|suggested\|pending_recorder\|linked\|declined, created_by}` | Off-platform counterparty owned by one business (model §3.1). |
| `sc_relationships` | `{id, business_id, party:{k:'b'\|'c', id}, language?, terms:{weighing_loss_bearer, transit_risk, freight, bill_basis, billable_reject_causes[], tolerance_by_class}, disclose_subcontractors, norms:{[process\|class]:{turnaround_days, loss_pct, n}}, notes?, statement_token_hash?}` | Private to `business_id`. `norms` is a cache refreshed when a job closes. |
| `sc_rate_cards` | `{id, business_id, party, process?, spec_family?, basis, value, effective_from, effective_to?}` | Private, effective-dated (W). |
| `sc_places` | `{id, business_id, name, kind: godown\|floor\|shop, address?}` | "My places" (AB). |
| `sc_calendar_events` | `{id, business_id, process?, from, to, reason}` | Closed days (Q), private. |
| `sc_staff` | rows in existing `users` with `role: 'staff'` and the same `business_id`, plus `users.pin_hash?` | §10.2. |

### 2.2 Material catalogue

| Collection | Shape | Notes |
|---|---|---|
| `sc_material_types` | `{id, owner_business_id: null\|bizId, key, form, base_dimension: mass\|count\|length, base_unit: g\|pc\|cm, allowed_units[], material_class_key, attributes:[{key, role: spec\|lot\|info, type, enum?, required?}], labels:{en,ta,hi}}` | Built-in templates have `owner_business_id: null` (from `research/materials-units.md`); businesses may add their own. |
| `sc_specs` | `{id: 'sp_'+sha1(type+normalised spec attrs), material_type_id, attrs:{...}, family_key}` | Content-addressed (model §3.2), so the same spec typed twice is one row. |
| `sc_aliases` | `{id, business_id, spec_id, alias}` | "Navy 180" → spec. Private, never shown to forwarded parties. |
| `sc_lots` | `{id, spec_id, label, origin:{event_id}, parent_lot_ids[], created_by_business_id}` | Lineage edges are filtered at read time (§10). |
| `sc_styles` | `{id, business_id, code, size_set[], components:[{key, per_size:{S:g…}}], trims:[{spec_id, per_piece, spare_pct}], packs?}` | Snapshotted onto jobs. |
| `sc_process_types` | `{id, owner_business_id: null\|bizId, key, input_forms[], output_forms[], conservation_kind, rate_basis, billable_grades[], itc04_nature, default_turnaround_days, rework_turnaround_days, calendar, loss_norms_by_class, labels}` | Data, not code (BRIEF §5.1); behaviours come from the fixed `conservation_kind` / `rate_basis` vocabulary (P10). |

### 2.3 Records (shared between parties)

| Collection | Shape | Notes |
|---|---|---|
| `sc_movements` | `{id, client_id, purpose, flags, from:{party, place_id?}, to:{party, place_id?, ship_to_snapshot?}, seller?, buyer?, title_passes, transport?:{transporter_party?, lr_no?, vehicle?, packages_count?}, order_id?, run_ids:{[bizId]: runId}, terms_snapshot, business_date, recorded_at, recorded_by_user_id, recorder_business_id, visible_at, cancelled_at?, party_business_ids[], lines:[{line_id, spec_id, lot_id?, grade, reject_cause?, owner_before, owner_after, job_id?, line_kind, viewer_business_ids[], sent:[Assertion], received:[Assertion], accepted?:[Assertion], packages?}], version}` | **One shared document** per movement. Assertion arrays are **append-only**. `viewer_business_ids` per line implements per-line privacy (model §7). `version` provides optimistic concurrency. |
| `Assertion` | `{a_id, base_qty, entered:{value, unit}, unit_source, factor?, approx, grade?, spec_override?, by:{business_id?, contact_id?, user_id?}, evidence: account\|link\|on_behalf\|self\|provisional\|implied, business_date, recorded_at, reason?, responds_to?, device_hint?}` | The model's §3.4. `device_hint` is a salted hash of IP + user agent, used to flag a link confirmation made from the recorder's device (§10.4). |
| `sc_jobs` | `{id, process_type_id, owner_party, client_party, performer_party, parent_job_id?, rework_of?, caused_by?, run_id?, order_id?, plan:{style_snapshot?, factors}, rate_ref?, promised_at?, expected_at, pauses:[{from,to?,reason}], status, events:[JobEvent], closure?:{at, figures, residual, claim_carried?}, reopened:[{at, reason}], party_business_ids[], version}` | Job events (`issue_in_place`, `output`, `ready`, `hold`, `release`, `close`, `reopen`, `cancel`) are appended to `events` **and** written to `sc_events`. |
| `sc_adjustments` | `{id, business_id, kind, scope, qty?, counted?, reason, business_date, recorded_by_user_id, approval?:{state: pending\|approved\|rejected, by?, at?}}` | count, regrade, respec, relabel, split_lot, correct_line, casualty, found, opening, write_off. |
| `sc_discrepancies` | `{id, kind, refs:{movement_id?, line_id?, job_id?, adjustment_id?}, parties[], figures:{a, b}, tolerance, state: open\|proposed\|countered\|resolved\|escalated, proposals:[{by, outcome, parts[], at}], resolution?, ticket_id?, opened_at}` | The model's §3.7. |
| `sc_orders_ext` | `{id: order_id, lines:[{spec_id, sizes?, qty}], terms_snapshot, amendments[]}` | Adds lines and terms to existing `orders` without changing that collection's shape. |
| `sc_runs` | `{id, business_id, title, style_id?, order_ids[], created_at, closed_at?}` | Private flow container. |
| `sc_settlements` | `{id, business_id, party, amount, business_date, mode: cash\|upi\|neft\|cheque\|adjustment, ref?, applied_to:[{kind, id, amount}], recorded_by_user_id}` | The single money ledger, record-only (D1). Owner only. |
| `sc_prices` | `{id, record:{kind: movement\|job\|order, id, line_id?}, parties:[bizId], basis, value, status: unilateral\|proposed\|agreed\|disputed, effective_from?, history[]}` | Read only by `parties` and only by role `owner` (A3). |
| `sc_documents` | `{id, record_ref, kind: dc\|invoice\|lr\|photo, number?, date?, gridfs_id?, shared_with:[bizId]}` | Photos in the GridFS bucket `sc_files` (≤ 300 KB after client-side compression). **Capped at 200 photos / 50 MB per business**: the M0 cluster's 512 MB is shared with production. Served through **short-lived signed URLs** (HMAC, 10 min), never `?token=`. Before real users are enabled, photos move to object storage (decision T9). A multi-owner DC photo is shared only with the custodian parties. |

### 2.4 Ledger

| Collection | Shape | Notes |
|---|---|---|
| `sc_events` | `{id, type, business_id (actor), user_id, ref:{kind, id}, payload, business_date, recorded_at, client_id?, supersedes?}` | Immutable audit log of every user-visible action, including undo, link, approve, settle, and drafts saved by Claire. |
| `sc_postings` | `{id, event_id, key, owner, delta_base, dimension: mass\|count\|length, line_ref?:{movement_id, line_id}, job_id?, origin_dc_line?, business_date, recorded_at}`, where `key = {spec_id, lot_id\|null, grade, owner, custodian, via\|null, place_id\|null, state, state_ref\|null}` and `owner` is the party | Immutable. **Σ = 0 per (event, dimension)**, pseudo-holdings included (§5.12). `origin_dc_line` carries the GST clock through lineage (model §12). |
| `sc_holdings` | `{_id: hash(canonical key), key fields…, qty_base, last_event_id, updated_at, viewer_business_ids[], visible_at?, provisional_by?}` | Materialized `Σ delta_base` per key, updated with `$inc` in the same transaction. Rows reaching 0 are kept, but list queries filter them out. |

### 2.5 Linking, links, drafts, infrastructure

| Collection | Shape |
|---|---|
| `sc_link_requests` | `{id, contact_id, recorder_business_id, requester_business_id, phone, state, decided_at?}` (model §6.4) |
| `sc_statement_links` | `{id, token_hash, recorder_business_id, contact_id, language, created_at, stopped_at?, last_opened_at?}`. The token is 128-bit random and only its SHA-256 is stored. |
| `sc_drafts` | `{id, business_id, user_id, source: claire\|photo, intent, payload, business_date, expires_at, saved_event_id?}` (03 §8.5) |
| `sc_notify` | the outbox for chat cards and system notices: `{id, due_at, channel, payload, attempts, sent_at?}` |
| `sc_idempotency` | unique `(business_id, client_id)` covering offline retries (§5.4) |

### 2.6 Additive changes to existing collections

| Collection | Change | Flag-off effect |
|---|---|---|
| `users` | `role: 'owner'\|'staff'` (existing rows are already `owner`), `pin_hash?` | none |
| `businesses` | `flags.sc?: boolean`, `capabilities[]` (derived from `sells/buys`), `process_offerings[]`, `gst:{registered, turnover_band?, apob[]}`, `tracking_scope[]` | none: unread when the flag is off |
| `conversations` | new `kind: 'goods'` with `channel_id: 'goods_<bizA>_<bizB>'` (sorted ids) | none |
| `orders` | none; extended through `sc_orders_ext` | none |

---

## 3. Indexes

Created in `connectDb()` beside today's indexes, only when `SC_ENABLED` is set, so the flag-off boot is unchanged.

| Collection | Index | Serves |
|---|---|---|
| `sc_holdings` | `{viewer_business_ids:1, qty_base:1}`; `{owner.id:1, custodian.id:1}`; `{custodian.id:1, owner.id:1}` | Out with others, In my unit, Others' goods |
| `sc_movements` | `{party_business_ids:1, business_date:-1}`; `{"lines.job_id":1}`; `{recorder_business_id:1, client_id:1}` **unique, partial** | party ledger, job detail, idempotency |
| `sc_jobs` | `{party_business_ids:1, status:1, expected_at:1}`; `{parent_job_id:1}` | late list, roll-up |
| `sc_postings` | `{event_id:1}`; `{"key.owner.id":1, business_date:1}` | rebuild, as-of reports |
| `sc_events` | `{business_id:1, recorded_at:-1}`; `{ref.kind:1, ref.id:1}` | audit, history |
| `sc_discrepancies` | `{parties:1, state:1}` | dispute chips |
| `sc_prices` | `{"record.kind":1, "record.id":1}`; `{parties:1}` | bills |
| `sc_specs` | `_id` only (content hash) | |
| `sc_aliases` | `{business_id:1, alias:1}` unique | voice and text resolution |
| `sc_contacts` | `{owner_business_id:1, phones:1}`; `{phones:1}` | linking suggestions |
| `sc_statement_links` | `{token_hash:1}` unique | public page |
| `sc_notify` | `{sent_at:1, due_at:1}` | ticker |
| `sc_drafts` | `{expires_at:1}` TTL | expiry |

---

## 4. Shared types and the domain core (`shared/sc/`)

```
shared/sc/
  types.ts        PartyRef, SpecRef, Qty, Assertion, Movement, Job, Holding key, Discrepancy, Settlement, Ctx-free DTOs
  units.ts        base units, allowed units per material, conversions (valid/contextual/invalid), dozen/gross, Indian formatting helpers
  postings.ts     postMovement(), postReceipt(), postJobClose(), postAdjustment(), postResolution() → Posting[]  (pure; Σ = 0 asserted)
  conservation.ts lineBalance(), jobInputBalance(kind), residual(), approxPending()   (model §5, P7)
  tolerance.ts    classify(sent, received, snapshot) → within | beyond | over (model §4.1)
  evidence.ts     winningAssertion(assertions[])  (rank, then recency; model §3.4)
  plausibility.ts unitSlip(), tenX(), neverNegative(), overYield()   (model §10, 03 §6.5)
  bills.ts        billForJob(job, outputs, price, settlements) (model §11.4)
  dates.ts        expectedDate(start, days, calendar, events), lateness(job) with reasons
  mask.ts         per-view field masks (§10): maskMovementFor(viewer), maskJobFor(viewer), statementView()
  vocab.ts        v1 action ↔ internal purpose map (03 S3 table), badges, outcomes
```

The server imports it with relative NodeNext paths (`../../shared/sc/*.js`), as it imports `shared/cards.js` today; the web uses its `@shared` alias. Model fields that must not be dropped: `release_from_run` and `hsn` on movement lines; `line_kind: unprocessed_return` (the UI's "As sent (unprocessed)" chip is a disposition, not a grade). The web uses only `units`, `conservation.approxPending`, `tolerance` and `plausibility`, for live form previews. Both clients still trust only the server's result.

---

## 5. The write path

### 5.1 One write = one transaction
```
POST /api/sc/... ─► validate (zod) ─► ctx from token ─► load affected docs (version) ─► domain core computes:
   new event(s) + postings + doc patches ─► session.withTransaction:
       insert sc_events, insert sc_postings, $inc sc_holdings (upsert), update record with version check,
       insert sc_notify rows (due_at = visible_at) ─► commit ─► 200 {record (masked for ctx)}
```
- Postings are asserted to sum to zero per event before commit; any failure aborts the transaction.
- **Never negative** (model §5.4) is checked inside the transaction against `sc_holdings`. The owner override posts from `EXTERNAL(self)` with the typed reason (03 S4).
- Optimistic concurrency: **assertions are appended with `$push` without a version check**, then winners are recomputed inside the transaction, so a queued offline confirmation never fails on a stale version. `version` checks apply only to edits, approvals, resolutions and job state changes (a stale one → 409, and the client reloads).
- Atlas transactions are retried on `TransientTransactionError` (driver default with `withTransaction`).

### 5.2 Assertions and supersession
- A new assertion is appended. The winning assertion per side is recomputed (`evidence.winningAssertion`). If the winner's quantity changed, the transaction posts a **reversal of the old receipt postings plus the new ones** (both events linked through `supersedes`), so the ledger always equals the winners.
- Superseding one's own assertion is refused once the other side has answered it (`responds_to`), as the model requires.

### 5.3 Undo window (D4)
- `visible_at = recorded_at + 10 min`. Until then, the counterparty's reads exclude the movement (`visible_at <= now` in the query) and no card is sent.
- **Undo** inside the window writes an `undo` event and reverses the postings; the movement gets `cancelled_at`.
- **Share now** sets `visible_at = now`.
- **Receiver acted first** (receiver-first entry during the window): when the sender's record becomes visible, the ticker runs `matchReceiverFirst()` (same parties, same spec family, ±1 business day, model §4.1). On a match it attaches the receiver's provisional figure as the `received` assertion of the sender's movement, cancels the duplicate with linked postings, and sends one combined card (03 §7.2). After that the sender's Undo is gone.

### 5.4 Offline outbox and idempotency
- **Create-only operations** queue in IndexedDB on the device: send, receive, confirm, output, count, and Claire draft save (approved decision 5; 03 §6.4).
- Each queued operation carries a `client_id` (ULID), and the unique `(business_id, client_id)` makes retries safe.
- `visible_at` is computed from the **sync** time; the checks re-run on the server, and failures come back as `{saved:true, flags:[...]}` so the record is never lost.
- Disputes, settlements, edits and approvals are online-only.

### 5.5 Discrepancy resolution
`POST /api/sc/disputes/:id/propose {outcome, parts}` → the counterparty runs `accept` or `counter`. An accepted outcome posts once from `disputed(D)` via the mapping table (model §3.7). Conceding ("use their figure") resolves immediately. Only owners can resolve; staff can propose quantities only (03 §4.4).

### 5.6 Ledger rules added after review (binding)

**5.6.1 Canonical parties and linking.**
- Holding keys hash the **canonical** party: a linked contact resolves to its business.
- When a contact links (model §6.4), one transaction writes a `link_rekey` event that:
  - moves every holding row keyed on the contact to the business key (−q old, +q new: two postings per row, history intact);
  - recomputes `viewer_business_ids` / `party_business_ids` on affected movements and jobs;
  - stamps duplicates found by the merge check with `merged_into` / `archived_at`.
- Stored references in old events are never rewritten (model §3.1).

**5.6.2 Receiver-first entries about someone else's goods.**
- They post `EXTERNAL(from) → H(owner=from, custodian=me, state=held(unmatched))`, with `provisional_by = me` and the recorder as the only viewer. No job is created yet.
- The owner never sees an unmatched row.
- On a match (ticker or read), the server:
  - reverses that posting;
  - attaches the figure as the `received` assertion of the sender's movement;
  - posts the receipt into the sender's job.
- Unmatched after 2 business days, the recorder sees "Ravi hasn't recorded this yet" with **Ask Ravi** (chat or WhatsApp).

**5.6.3 Late assertions on closed jobs.**
- If a winning assertion changes on a line of a closed job (a later link confirmation outranks an on-behalf figure), the server **auto-reopens** the job with a dated reason (model §4.2).
- It then reposts the receipt and re-closes. The bill shows a dated adjustment.
- The never-negative check runs after the reposting, never between reversal and repost.

**5.6.4 Partial receipts.**
- A `received` assertion is the side's **cumulative total**, with a `final` flag. The receive form shows "received so far" and asks "Is this everything?".
- Tolerance is classified only when the receiver marks the line final, or after expected date + grace, or immediately for single-package lines.
- Until then the remainder stays `in_transit`, not disputed.
- Order dispatches that leave on different days are **separate movements**.

**5.6.5 Count variance.**
`repo.post()` looks up the latest count with `business_date ≥ event.business_date` for each key it touches. If one exists, it adds an `ADJUSTMENT(count_variance)` pair linked to both events and raises an Updates item (model §3.6).

**5.6.6 Sale in place of allocated goods.**
Selling part of goods allocated to an open job splits off a **child job** for the buyer's share:
- owner = buyer; client by agreement, default the buyer;
- the parent's allocated quantity is reduced;
- the buyer becomes a viewer of the child job and of the sold lines only.

A partial sale without the split is refused.

**5.6.7 Postings balance per dimension.**
- Σ = 0 holds per (event, dimension).
- **Outputs** post `+o H(output)` / `−o CONSUMED(J)` in the output's dimension.
- **Closure** posts `−c allocated(J)` / `+into_output CONSUMED(J)` / `+loss LOSS` / `+residual RESIDUAL(J)` in the input's dimension (model §4.2, §5.2).
- **A respec** posts −q/+q between specs in the same dimension.
- A posting whose unit doesn't match its key's dimension is rejected.
- **Reversals** carry the original's `business_date` for corrections, and the new assertion's date when they supersede it.

**5.6.8 Single-player receipts.**
- For an off-platform receiver with no receipt recorded, the read-time pending uses **the sender's own figure** and says so ("based on 200 kg you sent").
- The Send and Got back forms offer **"They told me they got …"** (an on-behalf assertion, model §3.4), which replaces it.
- The first return implies the receipt (model §3.5).

---

## 6. Reads, views and performance

### 6.1 Views and their queries
| View (03) | Query | Cost |
|---|---|---|
| Out with others (A1) | `sc_holdings` where `owner = me`, `custodian ≠ me`, `qty>0`, grouped by custodian; joins open jobs for read-time `approxPending` and lateness | one indexed scan of open holdings (tens to hundreds of rows) + open jobs |
| In my unit (A3/A4) | `sc_holdings` where `custodian = me`, split by `owner = me` / `≠ me` | same |
| Coming in (A2) | open movements to me (`in_transit`, not yet received) + open jobs where `owner = me` (expected outputs) | indexed |
| Party ledger | `sc_movements` by `party_business_ids` + pair, paged 30; bills from `sc_jobs` + `sc_prices` + `sc_settlements` | paged |
| Job detail (A6) | one `sc_jobs` + its movements; `conservation.jobInputBalance` | O(lines) |
| Flow (A5) | `sc_runs` → jobs + movements tagged with the run | O(run size) |
| Performance (A9) | closed `sc_jobs` for (me, party, process), last 12 months, computed on read; cached per business for 10 min | bounded |
| GST clock (A10) | open job-work DC lines with `business_date < today − 300` via `sc_postings` as-of | indexed, daily |

### 6.1b One read path: `repo.positions()`
Every view, Claire tool and export reads goods through `repo.positions(ctx, filter)`, never `sc_holdings` directly. It:
- **replaces `allocated(J)` rows with the read-time `approxPending`** in the input's unit, so a job's input and its outputs are never added together (P7). Stale allocations of never-closed jobs show as "≈ 0 left · close this job?";
- hides in-transit rows whose `visible_at` is in the future from the counterparty (undo window), and hides `provisional_by` rows from everyone but the recorder;
- applies the sub-contract grouping and masks (§10.3).

A test asserts that every holdings-reading endpoint equals `positions()` for all 30 scenario fixtures.

### 6.2 Events vs snapshots: the trade-off, stated
- **Chosen:** materialized `sc_holdings` updated inside the write transaction.
  - Reads are fast and simple, and Claire's tools reuse them.
  - **Cost:** two extra writes per posting, plus the risk of drift if any code path writes postings without updating holdings.
- **Mitigation:**
  - (a) only `repo.post()` writes postings, and it always updates holdings;
  - (b) a **verify job** recomputes `Σ postings` per key for each business on a schedule (daily, and on demand in dev) and alerts on any mismatch;
  - (c) `rebuildHoldings(businessId)` replays postings, for recovery.
- **As-of queries** (counts with a business date, GST clock) read `sc_postings` filtered by `business_date`, not the materialized table.
- **Scale check:** a busy dyer at 15 lots a day × 2 movements × about 6 postings ≈ 180 postings/day ≈ 66 k/year. Trivial for Atlas M0/M10. Demo data is a few thousand rows.

### 6.3 Payload budgets
List endpoints return ≤ 30 rows per page with only the fields a row needs (about 300 bytes per row). The Goods route chunk stays ≤ 150 KB gzipped (03 §13). Charts are CSS/SVG.

---

## 7. API routes

All under `/api/sc`, behind `requireAuth` + `requireSc` (flag check). Bodies are validated with zod at the boundary; responses are already masked for `ctx`. Errors use today's `{error: string}` shape, with `code` added for the cases the UI handles (`stale`, `negative`, `needs_owner`, `window_closed`).

| Method & path | Purpose |
|---|---|
| `GET  /sc/home` | chips (late, to confirm, disputes, approvals) + badge count |
| `GET  /sc/goods?tab=out\|in\|coming&party&material&status&cursor` | S1 / S10 / S1c lists |
| `GET  /sc/parties` · `POST /sc/contacts` · `PATCH /sc/contacts/:id` | party picker, contacts |
| `GET  /sc/parties/:ref` | party ledger: open, history; bills and terms for owners only |
| `GET/PUT /sc/parties/:ref/terms` · `GET/POST /sc/rates` | terms, effective-dated rate cards (owner) |
| `GET  /sc/specs?q=` · `POST /sc/specs/resolve` · `POST /sc/aliases` | spec search, text → spec, aliases |
| `GET/POST /sc/styles` · `GET/POST /sc/places` · `GET/POST /sc/calendar` | setup |
| `POST /sc/movements` (`action` = send\|return\|forward\|move\|sell\|buy\|sample\|receive_for_work, `client_id`) | create a movement (S4) |
| `POST /sc/movements/:id/receive` · `/confirm` · `/differs` · `/reject-lines` · `/undo` · `/share-now` | receiver and sender actions (S5, S6) |
| `GET  /sc/movements/:id` | detail with history and terms snapshot |
| `POST /sc/jobs` (in-house "Made here") · `POST /sc/jobs/:id/output` · `/ready` · `/hold` · `/release` · `/close` · `/reopen` · `/cancel` · `/leftovers` | job lifecycle (S7, J17) |
| `GET  /sc/jobs/:id` | job detail with conservation per line, bill (masked) |
| `POST /sc/adjustments` (count\|regrade\|respec\|relabel\|correct_line\|casualty\|write_off) · `POST /sc/adjustments/:id/approve` | adjustments, D5 approvals |
| `GET  /sc/disputes` · `GET /sc/disputes/:id` · `POST /sc/disputes/:id/propose\|accept\|counter\|escalate` | S8 |
| `GET/POST /sc/settlements` | record payments (owner, D1) |
| `GET  /sc/runs` · `GET /sc/runs/:id/flow` · `POST /sc/runs` | S9 |
| `GET  /sc/reports/performance\|bills\|gst` | S13, S14, A10 |
| `POST /sc/links/:contactId` (create or rotate) · `DELETE /sc/links/:id` | statement links (owner) |
| `GET  /api/l/:token` · `POST /api/l/:token/confirm\|differs\|propose\|ready\|stop` | **public** statement page actions (rate-limited, §10.4) |
| `GET  /sc/link-requests` · `POST /sc/link-requests/:id/approve\|decline` | contact linking (model §6.4) |
| `POST /sc/files` (multipart, ≤ 300 KB) · `GET /sc/files/:id` | DC photos (GridFS), access checked against `sc_documents.shared_with` |
| `POST /sc/claire/turn` | personal Claire (§9); the existing `/api/claire/turn` routes here when the flag is on and the router says "data" |
| `POST /sc/drafts/:id/save` · `DELETE /sc/drafts/:id` | save or cancel a Claire draft |
| `GET  /sc/export?kind=movements\|jobs&from&to` | CSV for the accountant (owner). Built from the same masked `repo` DTOs; cells starting with `= + - @` are escaped (CSV injection). |

**Contract changes recorded in `BUILD_CONTRACT.md`** when slice 0 lands: the `/api/sc` and `/api/l` route families, the `goods` conversation kind, the card kinds in §8, and `features.supplyChain` on `/api/me`.

---

## 8. Chat: the Goods conversation and cards

### 8.1 Goods conversation (U5)
- **One Nexconn group channel per business pair:** `goods_<min(bizA,bizB)>_<max>`. It has its own `conversations` row with `kind:'goods'`, members are the owners plus the staff of both businesses, and `buyer/seller` is unset.
- It is created lazily on the first shared record between two businesses with the flag on.
- Seller auto-reply, price detection and negotiation hints **skip** `kind:'goods'` (`deals.ts` early return).
- The deal room shows a link chip "Goods with Lakshmi" when a Goods conversation exists for the pair.
- A counterparty without the flag gets cards in the Goods conversation through the generic fallback (`text`), which is enough to read. Actions go through the statement link the user sends privately (03 §4.6).

### 8.2 New `CardPayload` kinds (`shared/cards.ts`)
```ts
| { kind: 'movement'; movementId: string; action: V1Action; title: string; text: string /* reader's language, no prices */;
    lines: { lineId: string; label: string; qty: string; theirs?: string; yours?: string }[];
    dcNo?: string; date: string; status: 'check_and_confirm'|'confirmed'|'within_tolerance'|'disputed'|'undoable'|'cancelled';
    badge?: 'your_record'|'confirmed_by'|'not_confirmed'; badgeName?: string; actions: ('confirm'|'differs'|'undo'|'open')[] }
| { kind: 'dispute'; disputeId: string; title: string; text: string; figures: { a: string; b: string; diff: string; allowed: string };
    state: string; outcomes?: ('mine'|'theirs'|'split'|'value'|'transporter')[]; blocksJob?: string }
| { kind: 'job_status'; jobId: string; title: string; text: string; status: string; summary: string }
| { kind: 'record_draft'; draftId: string; text: string; header: string /* "You sent · today, 21 Nov" */;
    fields: { label: string; value: string; usual?: boolean }[]; warnings?: string[]; expired?: boolean }
| { kind: 'link_request'; requestId: string; text: string; recordCount: number }
```
- **Per-reader language:** a card is rendered once per language and sent as a **targeted group message** to that language's members. This reuses `targeted()` in `server/src/deals.ts`, which calls `chat.group(channel, from, type, content, {onlyTo})` → Nexconn `toUserIds` (or the local relay's `directed`). It is the mechanism that already delivers `CC:Hint` and per-language notices. `text` is the full fallback sentence for Flutter `OtherCard` and flag-off readers (00 §11.6).
- **No prices in any card or `text`**, ever. Bills open in the app, behind the owner role.
- **Newest card per id wins**, as for `order` today: each state change re-posts the card.
- **Recipients are grouped by (business, language)**, not language alone, because the two sides get different badges and actions.

### 8.3 Delivery (after review)
- **Spike first (slice 2, day 1):** verify that Nexconn keeps *targeted* group messages in remote history (new device, cleared PWA). If it doesn't, Goods cards are sent **untargeted and language-neutral**, the web renders their text from i18n keys plus parameters, and `text` holds a short trilingual line for Flutter and fallback readers.
- **The notify outbox is claimed atomically** (`findOneAndUpdate` with `claimed_at` + a 60 s lease), so two server instances during a Render deploy can't both send.
- Each card has an **idempotency key** (record, state, reader); a resend after a crash replaces rather than duplicates on the web.
- **Undo** cancels the pending notify row; **Share now** moves its `due_at` to now.
- **Time-based transitions** run as a lazy "due sweep" on server wake, on the ticker and on reads of the affected records. A6 needs no cron for correctness. These are: short-shipped → value claim after 7 days; returnable sample overdue; unconfirmed sample written off at 30 days; GST alerts at 300/330/350 days; draft expiry.
- **Drafts expire softly** (`expired: true`, shown as "Expired, make a new one"); the TTL index deletes them 7 days later.
- **Trade Desk tickets for disputes** get their own support group with only the two parties' owners and the agent. They are never attached to the Goods conversation, so the agent sees only the dispute's records.

---

## 9. Personal Claire

### 9.1 Model verification (done 21 Nov 2026)
- **Method:** six synthetic prompts (en, ta, hi; ask / late / analytics / record by Tamil voice transcript / record in Hindi / an ambiguous Tamil question) against the four configured text models through OpenRouter.
  - Each request offered four tools: `query_holdings`, `query_jobs`, `compute_analytics`, `draft_record`.
  - Settings: `tool_choice:auto`, temperature 0, 3.5 s between calls.
- **Script:** `research/llm-toolcall-check.mjs` (results in `research/llm-toolcall-results-2026-11-21.json`), about 24 requests, no user data.

| Model | Result |
|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` (configured primary) | **6/6 refused**, 404 "0 endpoints… guardrail restrictions and data policy". This confirms HANDOVER: the primary is unusable for this key. |
| `baidu/ernie-5.5-flash-preview:free` | **6/6 correct tool + arguments**, 1.0–2.2 s. Tamil "அனுப்பினேன்" → `send_for_work`, qty 400, tense past. Hindi → `got_back`, 92 kg. The ambiguous Tamil question → a query, not a draft. Weaknesses: put sizes "S, M" into `colour`; spelled "Nooyyal". |
| `inclusionai/ling-3.2-flash:free` | 2/2 correct when answered; **4/6 HTTP 429** from the upstream provider; one 12 s response. |
| `google/gemma-4-31b-it:free` | **6/6 HTTP 429** (upstream provider rate-limited). |

**Conclusion.** Tool selection is good when a model answers, but **free-tier availability is the real risk**: one usable model, and a fallback chain that mostly returns 429. For an assistant users rely on to record goods, that is not enough. Hence §9.3.

### 9.2 Turn pipeline (A7)
```
text or voice transcript ─► deterministic pre-router (regex/keywords in en/ta/hi):
     exact chip ("What's late") → tool directly, no LLM
     else ─► ONE LLM call: system prompt (frozen, cached) + glossary + tool schemas (strict) + the user's sentence
             → {tool, args}  validated by zod; unknown → clarify chips
─► server resolves entities: party (fuzzy over my contacts/parties + aliases, never the model's ID), spec (aliases → specs), dates (IST)
─► tool runs through repo with ctx (owner/staff allow-list) ─► answer rendered from a TEMPLATE in the user's language
     (number + unit first; records inline; source line; estimates in words)  ─► CC:Card / text
draft_record → sc_drafts row + record_draft card (header: verb · tense · business date) → user taps Save → POST /sc/drafts/:id/save → normal write path
```
- **Tools** (strict JSON schemas, `additionalProperties:false`):
  - `query_holdings {scope, party?, material?, colour?, size?}`
  - `query_jobs {status, party?, process?, period?}`
  - `query_movements {party?, direction?, period?}`
  - `compute_analytics {metric, process?}` (owner only)
  - `explain_job {party?, job_ref?}` (templated from events)
  - `draft_record {action, party, lines[{material?, colour?, sizes?{S:n}, qty?, unit}], tense, expected_date?, dc_no?}`
  - `find_suppliers {…}` (the existing search intent).
- **Questions never draft.** `draft_record` carries `mood: statement|question|plan`, and only `statement` + `past` produce a draft. "அனுப்பியாச்சா?" (was it sent?) is past tense but a question, so it becomes a query. `plan` ("need to send") gets "Record it when you send it"; planned sends are not a v1 object.
- **Follow-ups keep context:** a pending draft and its open question live in `claire_sessions`. A chip answer ("Noyyal Dyeing") is routed deterministically into that draft, not treated as a fresh turn.
- **Cross-script names:** contacts store the name in both scripts, transliterated with Sarvam (existing key) when they are created. Party resolution is fuzzy and phonetic over both, plus aliases.
- **The model sees only the user's sentence**: no records, notes or counterparty text. Prompt injection from counterparty data therefore can't reach it. User text is still bounded (2,000 characters) and the output is validated.
- **Existing intents stay separate.** `BUY_PRODUCT` / `UPDATE_STOCK` paths fire only from their own chips or confirmation cards when the flag is on (03 §8.5).

### 9.3 Model chain and cost

| Order | Model | When |
|---|---|---|
| 0 | Deterministic chips and pre-router | Always first; also the fallback when everything else fails |
| 1 | `baidu/ernie-5.5-flash-preview:free` (OpenRouter) | Primary. Verified 6/6. Free, but shares the app's 1,000 req/day. |
| 2 | **Claude Haiku 5.5** (`claude-haiku-5-5`, Anthropic API; the key already in `server/.env` is unused today, and **is not in `render.yaml`**, so it would need adding in the Render dashboard) | On a free-model 429/5xx/timeout (> 4 s) or a schema failure. Called with `tool_choice:auto`, `strict:true` tools, `thinking:{type:"disabled"}` with `effort:"low"` (allowed at effort ≤ high), **no `temperature`** (non-default sampling returns 400 on this model), a `refusal` stop reason handled as a fall-through to tier 3, and a cached system + tools prefix. Needs `@anthropic-ai/sdk` (one new dependency, justified by reliability). |
| 3 | Rule parser (`ai.ts` keyword fallbacks extended for goods verbs) | The budget is spent, or both models fail |

**Cost of tier 2** (Anthropic list price, 3 Nov 2026: Haiku 5.5 $0.10 per 1M input tokens, $0.50 per 1M output):
- A turn is about 2,000 input tokens (system, glossary, 7 tool schemas) plus about 150 output tokens. That is about $0.0002 + $0.000075 ≈ **$0.0003 per question (₹0.025)** before caching. Cache reads lower the input part further.
- At a pessimistic 100% fallback rate, 200 active businesses × 30 questions/day ≈ 6,000 turns/day ≈ **$1.70/day**.
- **Proposed hard cap:** a `CLAIRE_PAID_DAILY_USD` budget, default **$1/day**, tracked in `kv` like today's free budget. Above the cap, tier 3 answers.

**Separate client:** personal Claire uses its own `scLlm` client, not `llmObject()`:
- a hard 4 s budget per turn;
- no 429 sleeps (fall through instead);
- **budget counted per HTTP request**, capped at **400 of the 1,000** free requests/day (`SC_LLM_DAILY`), so it can't starve deal rooms and search.

The data-vs-legacy routing happens inside `claireTurn` (the webhook path calls it directly), with one LLM call per turn, never `understand()` plus a second call.

**Re-verification in slice 5** with the exact 7-tool schema, since `query_holdings`, `query_jobs` and `query_movements` are easy to confuse.

**Data posture:** the user's sentence (party names, quantities, sometimes amounts) goes to the model provider. The OpenRouter account's own guardrail already restricts it to endpoints matching its data policy (which is why Nemotron is blocked), and the Anthropic API does not train on API inputs by default. This goes in the in-app privacy note (DPDP).

**Not yet verified:** Haiku's tool selection on the same six prompts. It wasn't run because it spends money from your key. Slice 5 runs it (about $0.01) before enabling the tier, and the slice report gives the numbers.

### 9.4 Staff and safety
- **Staff tool allow-list:** `query_holdings`, `query_jobs`, `query_movements`, `explain_job`, `draft_record`. Responses use the staff mask (no rates, bills, settlements or analytics).
- **Adversarial tests** (Phase 6, all three languages):
  - cross-business requests ("Sree Textiles' stock at Noyyal");
  - price requests from staff;
  - injection in contact names and notes (the names reach only templates, never the model);
  - "record" phrased as a question;
  - number slips (ஐம்பது / ஐநூறு).

---

## 10. Permissions and privacy

### 10.1 Ctx and the repository
- `ctx = {businessId, userId, role}` is built only by `requireAuth` from the HMAC token.
- Every `repo.*` read takes `ctx` and adds the scope filter itself: `viewer_business_ids: ctx.businessId`, or the party/owner fields.
- Handlers never pass a business ID taken from the request body; route params naming a business are checked against the scope.

### 10.2 Roles
- **Owner:** everything for their business.
- **Staff:** a phone login that the owner adds in Settings (same demo OTP flow; real OTP is a pre-existing gap noted in HANDOVER). Optional **4-digit PIN per person** on shared phones, so `recorded_by_user_id` is right (03 J13).
  - Staff can't read `sc_prices`, `sc_settlements`, bills, analytics or settings.
  - Staff can't resolve disputes or override never-negative.
  - Staff counts above 5 pcs / 2 kg are `pending` (D5).
- **Agent** (Trade Desk): reads a dispute and its records through the ticket only.

### 10.3 Masks (`shared/sc/mask.ts`, applied in `repo`)
| Viewer | Movement line | Job | Holding | Lineage |
|---|---|---|---|---|
| Owner of the line | all fields | all fields | all | own and visible parents |
| Physical party (from/to) only | spec, qty, grade, dates; owner shown as allowed by §7 of the model; **no price ever** (prices are separate) | performer sees its job; client sees its child job only through roll-up | custodian sees held goods by principal | only lots it held |
| Sub-contractor | lines it received; owner shown as "for S1"; **generic spec name** (no aliases, style codes or lot labels) | its own job | its holdings | none upstream |
| Staff | as its owner minus money | minus rate/bill | as its owner | as its owner |
| Statement link viewer | only lines between recorder and that contact, generic names, no prices | — | "still with you (recorder's record)" | none |

**Sub-contract mask at key level (D2):**
- The owner's views group a holding by `via ?? custodian`, so goods at Selvi through Lakshmi read "with Lakshmi".
- The custodian's views group by `via ?? owner` when `via` is set, so Selvi sees "for Lakshmi".
- The owner is **excluded** from `viewer_business_ids` and `party_business_ids` of `subcontract_out` / `subcontract_return` lines unless disclosure applies. Ravi's history therefore never shows "Lakshmi → (masked)".
- Claire and exports use the same `positions()`.

**Per-line privacy:** `viewer_business_ids` is computed at write time from the posting rules: owner_before, owner_after, from/to custodians, the via, and the disclosed sub-contractor. Every list and detail query filters lines by it. Unit tests assert that none of the 30 scenarios leaks a line to a non-viewer (§14).

### 10.3b Staff on the existing app (after review)
Today every route trusts `users.business_id`, so a staff login would see deal rooms, prices, orders and the store. With staff enabled:
- **Every existing route gets a role guard:** staff are refused on deals/offers/counter-offers, order money events (advance, balance, delivered by status), listings and store edits, catalogue, Trade Desk requests, and business profile edits.
- **`usersOf()` excludes staff** when building deal-room groups; staff join only Goods conversations.
- **Inbox** lists only `kind:'goods'` conversations for staff.
- **Provisioning:**
  - The owner adds a phone.
  - If that phone already has a user with **another** business, the add is refused (one user in two businesses is deferred, D8).
  - If it has a user with no business, it is attached as staff.
  - If it has no user, one is created with `role:'staff'` and `onboarded:1`.
- The staff isolation suite (slice 7) covers every existing route, not only `/api/sc`.

### 10.4 Statement link (public)
- **Token:** 128-bit random, stored as SHA-256; one per (recorder, contact); rotatable and stoppable.
- **Path:** `/l/:token`, served by a server-rendered route registered **before** the SPA fallback (never the 1.49 MB bundle). Its form posts go to `/api/l/:token/*`.
- **"Seen"** is recorded only on the first interaction (a tiny beacon on load or a POST), never on a bare GET or HEAD, so WhatsApp's link-preview crawler doesn't mark it seen.
- **A link for an on-platform business that hasn't enabled the feature** (or never opens the app, model §9) is keyed by `party:{k:'b', id}` as well as by contacts.
- **Rate limit:** 30 requests/min per token and IP.
- **Responses** are server-rendered HTML under 50 KB (no SPA bundle), in the contact's language.
- **Recorder's own device:** if the request carries a valid session of the recorder's business, or its `device_hint` matches one of the recorder's recent sessions, the page is **view-only** and says so. Confirmations from it are refused.
- **This guard is best-effort.** The page has no session cookie (auth is a Bearer token in JS), so it relies on the IP + UA hash. It may wrongly block a shop sharing the recorder's Wi-Fi, and it doesn't stop mobile data.
- **What this does not stop:** a recorder on a second phone. Such confirmations are labelled "via link" (evidence rank below account), and Trade Desk sees the label.
- **Legal notice:** the page carries the DPDP notice and **Stop these updates**.

---

## 11. Migration of existing users and data

| What | How | When |
|---|---|---|
| `businesses.capabilities` | derived from `sells/buys` + `role_label` (a mapping table in `shared/sc/vocab.ts`); shown for confirmation on the first Goods visit | lazily, on first read with the flag on |
| `process_offerings` | seeded from `service.*` listings (capacity/day, lead_days) | same |
| `users.role` | missing means `owner` | no write needed |
| `job_work` orders | for each open `job_work` order **where both parties are flagged**: create a job (owner = buyer, performer = seller, client = buyer) with an **opening position**: `issue_in_place` of the order qty plus outputs = `qty_done`, all marked `migrated`. Later returns are **cumulative** (§5.6.4) and are matched against it, so the 200 already counted aren't counted again. While either party is unflagged, the legacy path keeps writing `qty_done` / `status`, and the job reads them. | migration script `server/src/sc/migrate.ts`, idempotent, dry-run by default |
| order deliveries | with both parties flagged, the delivery button records a receipt against a movement created from `orders.dispatch` (partial receipts cumulative). **When receipts cover the order, the same transaction sets `status:'delivered'` and `delivered_at`**, which the balance-due notice, the rating card and Trade Desk's overdue checks depend on. | slice 8b |
| advance/balance milestones (D1) | orders created after both parties are flagged are "new": their milestone buttons are replaced by **Record payment** (Settlements). Legacy milestone taps on older orders are mirrored as read-only settlements, so Bills never counts an advance twice. | slice 8a |
| contacts | none exist; created by users | — |
| Store listing `stock_qty` | untouched; labelled "shown to buyers" and optionally linked to a Goods item | slice 8 |

Rollback: the flag goes off, and the `sc_*` collections are ignored. Migrated orders still have their original fields (we never overwrite `qty_done`; we only read it).

---

## 12. Feature flag
- **Server:**
  - `SC_ENABLED=1` (env) turns the module on.
  - Per business, `businesses.flags.sc = true`. An allowlist is set via `npm run sc:flag -- <businessId> on`, a dev script.
  - `requireSc` returns 404 for unflagged businesses.
  - `/api/me` returns `features.supplyChain` = env && business flag.
- **Web:** the nav, routes and cards render only when `features.supplyChain` is true. `CardRenderer` has renderers for the new kinds regardless, so a flagged counterparty's cards show for unflagged users (as fallback text plus an "Open" link to the statement page).
- **Index creation and the notify ticker** start only when `SC_ENABLED` is set.
- **Default:** off everywhere, including Render. Turning it on in any shared environment is your call (BRIEF §11).
- **Half-on:** a Goods conversation is created when the **recorder** is flagged and the counterparty is an on-platform business, whatever its flag. The inbox and chat code must render `kind:'goods'` for every user (as a plain conversation with fallback cards), so that is tested with the flag **off** for the viewer.
- **Turning a business's flag off after use** makes its records **read-only** (GET plus answers to open disputes and links still work), so counterparties are never stuck. New records are refused.

---

## 13. Failure modes

| Failure | Effect | Handling |
|---|---|---|
| Transaction aborts (transient) | none | driver retry; then 503 "try again", and the outbox keeps the record on the device |
| Holdings drift from postings | wrong balances | verify job alerts; `rebuildHoldings`; posting writes only via `repo.post()` |
| Two people confirm the same card | double receipt | `version` check → 409 → reload shows it already confirmed |
| Offline retry duplicates | double movement | unique `(business_id, client_id)` |
| Nexconn send fails | card missing | `sc_notify` outbox with backoff (3 tries, then a system notice); the Goods tab is the source of truth, not chat |
| Render sleeps during the undo window | card late | visibility is computed at read time; the ticker posts the backlog on wake |
| Free LLM 429 / blocked | Claire can't parse | tier 2 (if enabled) → tier 3 rules → chips; the record forms always work |
| Paid budget spent | tier 2 off | tier 3 + chips; a notice in the dev log |
| Speech-to-text slip (50/500) | wrong quantity | ×10 check, words read back, draft card (03 §6.5) |
| Clock or date confusion (offline for days) | wrong business date | the business date is user-visible and editable on the draft; record time is the server's |
| Photo store fills up | uploads fail | 300 KB cap, GridFS; uploads are optional evidence |
| Statement token leaked or forwarded | stranger confirms | link evidence is labelled; rotate/stop; rate limits; the page shows no prices |
| Bug posts a non-zero-sum event | ledger broken | assert Σ = 0 before commit (abort); property tests (§14) |
| Migration script reruns | duplicates | idempotent: keyed on `order_id` |
| A scenario the UI didn't foresee | user stuck | the owner can record via `correct_line` / `write_off` / `found` with a reason; nothing is silently edited |

---

## 14. Testing strategy

No test runner exists today (00 §8). Add **`node:test` run through `tsx`** (no new dependency): `npm run test -w server` → `node --import tsx --test 'src/**/*.test.ts' '../shared/sc/**/*.test.ts'`.

| Layer | What | How |
|---|---|---|
| Domain core (pure) | posting rules (every event Σ = 0); conservation per kind; tolerance; evidence ranking; unit conversions and refusals; plausibility (unit slip, ×10); bills incl. rework chains and sub-contract roll-up; expected dates with calendars; masks | table tests + **property tests** with a tiny in-house generator: random movement/job sequences → Σ holdings = Σ postings, never-negative, conservation at closure |
| Scenario tests | **all 30 scenarios A–AD** from `walkthroughs/`, replayed as API calls against a fresh database; every participant's expected view asserted (quantities, badges, what is hidden) | integration, per scenario file |
| Isolation | for each scenario, every other business and every staff user queries every endpoint and must not see lines, prices or parties beyond §10.3; the statement page shows only its own lines | generated from the scenario fixtures |
| Claire | the six-prompt set grown to ~60 (three languages × intents × adversarial), recorded as fixtures; tool choice and args asserted; staff refusals; injection names | runs against fixtures in CI (no tokens); a manual "live" mode re-records with real models |
| Regression | today's smoke test (25 checks from `docs/web-test-report-2026-11-20.md`) runs with the flag **off** and **on** | script |
| UI | each slice: run the app, render the new screens at 375/1280 px in en/ta, critique against `ui-principles.md` §4 | browser pane, as in Phase 3 |

**Node and runner:** `.nvmrc` = 24 plus an `engines` check, because the shell's default Node 18 can't expand quoted globs in `--test`. Tests run with `--test-concurrency=1`.

**Test database:**
- **One database per run**, `nexconn_sc_test_<RUN_ID>`, with the `RUN_ID` set by the npm script (not per file). Fixture ids are namespaced per file, and test databases older than 1 h are swept at start.
- About 35 `sc_` collections per run, under M0's 500-collection limit.
- A guard refuses to run if `MONGODB_DB` lacks `_test_`.
- **Pure domain tests need no database** and run anywhere.
- **Integration and scenario tests** load the cluster. Until a separate free test cluster exists (decision T8), they don't run against the production cluster during the hackathon window (until 22 Nov 23:59 IST).

**Smoke tests** run with `OPENROUTER_API_KEY` unset and Nexconn off (local relay), so they don't spend production's LLM budget. There is one live run per checkpoint.

**Also added:** `npm run lint` (`tsc --noEmit` + a tiny no-lucide/no-blue/no-gradient grep for new files). There is no ESLint today, and adding it is out of scope.

---

## 15. Decisions for the checkpoint (with recommendations)

| # | Decision | Recommendation |
|---|---|---|
| T1 | Paid fallback model for personal Claire | **Yes:** Claude Haiku 5.5 as tier 2, with your existing Anthropic key and a **$1/day cap**. About $0.0003 per question. The free primary is verified but its fallbacks are mostly rate-limited. Adds one dependency (`@anthropic-ai/sdk`). |
| T2 | Claire architecture | **One LLM call that only picks a tool; answers from server templates** (A7). The model never sees your records. |
| T3 | Balances | **Event log + postings + materialized holdings in one transaction**, with a daily verify job (A1, §6.2). |
| T4 | Tests | **`node:test` + `tsx`, integration tests on a throwaway `_test_` database** on the same Atlas cluster (no new dependency). |
| T5 | Photos of DCs | **MongoDB GridFS**, ≤ 300 KB each (Render's disk is wiped on deploy). |
| T6 | Staff login | **Per-person phone login, plus an optional 4-digit PIN** on shared phones. |
| T8 | Where integration tests run | **A separate free Atlas cluster for tests** (you'd create it; I can't). Until then, only pure domain tests, plus integration tests against the shared cluster after the hackathon deadline, one run at a time. |
| T9 | DC photos at scale | GridFS with caps for demo and pilot; **move to object storage before real users** are enabled (a provider choice for later). |
| T7 | Where the code lives until you approve turning it on | **A local branch `supply-chain`; nothing pushed, merged or deployed** without your go-ahead. The flag defaults to off everywhere. Not before the 22 Nov hackathon deadline. |

---

## 16. Red team: what it found and what changed

**Self-review before the red team:**
- The model check (§9.1) showed the configured primary model is blocked and two of the three fallbacks are rate-limited. That changed the Claire design to one call per turn with templated answers, plus an optional paid tier.
- I checked that per-reader cards can reuse `targeted()` in `deals.ts`.

**Independent red team: 29 findings (13 high), all accepted.** It read the real code as well as the docs.

| # | Sev. | Finding | What changed |
|---|---|---|---|
| 1 | high | Staff logins would see deal rooms, prices and store edits through **existing** routes that trust `business_id` | §10.3b: role guards on every existing route, staff out of deal groups, provisioning rules; S7 suite covers existing routes |
| 2 | high | Sub-contract leaked: the owner saw the forward line, and holdings grouped by the real custodian | Key-level grouping `via ?? custodian` / `via ?? owner`; the owner is excluded from sub-contract lines (§10.3) |
| 3 | high | Linking a contact split one dyer into two holding rows and blocked returns | Canonical party in keys + a `link_rekey` event (§5.6.1) |
| 4 | high | Receiver-first entries created phantom stock or double counts | Unmatched held rows visible only to the recorder; attach on match (§5.6.2) |
| 5 | high | A late link confirmation on a closed job drove allocated stock negative | Auto-reopen, repost, re-close (§5.6.3) |
| 6 | high | Partial deliveries read as superseding figures and opened false disputes | Cumulative receipts + `final`; tolerance only when final; separate movements per dispatch (§5.6.4) |
| 7 | high | Holdings views double-counted inputs and outputs (P7) | One read path, `positions()`, with `approxPending` (§6.1b) |
| 8 | high | Single-player pending was 0 because the off-platform receiver never asserts | Use the sender's figure, labelled; "They told me they got…" (§5.6.8) |
| 9 | high | Back-dated events silently invalidated counts | Count-variance check in `post()` (§5.6.5) |
| 10 | high | Sale in place of allocated goods broke the single job owner | Child-job split (§5.6.6) |
| 11 | high | `qty_done` backfill double-counted; rerouted delivery buttons skipped `delivered_at` (ratings, balance, desk) | Opening position + cumulative matching; legacy writes kept while either side is unflagged; `delivered_at` set in the same transaction (§11) |
| 12 | high | Tests: Node 18 default, one database per file breaks M0 limits, load on the production cluster | `.nvmrc`, one database per run, concurrency 1, sweep, separate test cluster T8 (§14) |
| 13 | high | Missing scope and non-credible sizes | S0.5, S4.5 and S8b added, S8 split, every scenario assigned, about 9–11 weeks (05) |
| 14 | med | "Was it sent?" is past tense, so it would draft | `mood` field; drafts only for statement + past (§9.2) |
| 15 | med | Budget accounting and timeouts didn't match `llm.ts` | Separate `scLlm` client, 4 s, per-request budget, routing inside `claireTurn`; re-verify 7 tools (§9.3) |
| 16 | med | Haiku specifics (thinking, no temperature, refusals, deploy env) | Specified in the tier row; A8 wording fixed (§9.3, §1) |
| 17 | med | Data posture; cross-script names; follow-up context | DPDP note; transliterated names; `claire_sessions` follow-ups (§9.2–9.3) |
| 18 | med | Targeted message persistence unverified; per-side cards; Desk saw the whole Goods history | S2 spike + fallback; group by (business, language); separate dispute support group (§8.3) |
| 19 | med | Outbox duplicates, Undo still sent cards, timers need a scheduler | Leased claim, idempotency keys, Undo/Share-now update the row, lazy due sweep, soft draft expiry (§8.3) |
| 20 | med | Undo window leaked through holdings | `visible_at` on in-transit holdings; filtered in `positions()` |
| 21 | med | Offline confirmations would 409 on version | `$push` assertions without a version (§5.1) |
| 22 | med | Σ = 0 ambiguous across dimensions; postings lacked lineage | Σ per (event, dimension); `line_ref`, `job_id`, `origin_dc_line`; reversal dates (§5.6.7, §2.4) |
| 23 | med | Half-on and off-after-use flag behaviour undefined | Creation rule; unflagged rendering tested; read-only when turned off (§12) |
| 24 | med | Link preview marks "seen"; wrong path; device guard overstated | `/l/:token` before the SPA; seen on interaction; guard labelled best-effort (§10.4) |
| 25 | med | GridFS on a shared 512 MB M0; token in image URLs | Caps, signed URLs, object storage before real users (T9) |
| 26 | med | Advance could count twice (legacy milestone + settlement) | "New" orders use Record payment; legacy milestones mirrored read-only (§11) |
| 27 | low | Export leaks and CSV injection; multi-owner DC photos | Masked DTOs, cell escaping, custodian-only sharing |
| 28 | low | Smoke tests spending production's LLM budget | LLM off and local relay, one live run per checkpoint (§14) |
| 29 | low | Implementer guesses: import paths, dropped fields, "unprocessed", planned sends | Listed explicitly (§4, §9.2) |

