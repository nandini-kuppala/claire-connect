# Web app test report — 20 Nov 2026

Tested the existing web app (no code changes) on a local server against an **isolated database** (`MONGODB_DB=nexconn_sc_dev`, freshly seeded), with real Nexconn chat, OpenRouter and Sarvam. Three browser sessions on separate origins (`localhost`, `127.0.0.1`, `[::1]`), so two or three users could talk live.

## 1. Automated smoke test
`python3 demo-video/smoke_live.py http://localhost:8787` → **25/25 PASS** (login ×5, Claire search, results, deal, offer → counter → accept, full order lifecycle to closed, two-way ratings, sample, job-work split, Trade Desk, inbox, orders, stats). One Claire turn took 20.9 s (all of it the LLM call).

## 2. Live conversations tested

| # | Who (language) | Flow | Result |
|---|---|---|---|
| 1 | Amit (hi) ↔ Sree Textiles (ta) | Claire search in Hindi → results → open deal → Hindi message → Claire private tip + draft offer ₹158 → Sree counters ₹162 → Amit accepts (confirm step) → order CC-26-00003 → advance paid (30 % = ₹40,824) → payment confirmed → in production → dispatched (KPN Parcel, LR, 8 bundles) | Works end to end, real-time on both sides, Hindi⇄Tamil translation accurate |
| 2 | Amit → Trade Desk Meena (ta/hi/en) → Sree | "Short quantity" problem (760 of 800) → ticket + accurate AI summary → agent joins chat → English message translated to Tamil and Hindi → Sree replies in Tamil → resolved "Replacement or credit note" | Works; several language/labelling issues below |
| 3 | Ravi (ta) via Claire | Tamil request "3,000 tees stitching job work, ₹20/pc, 8 days" → 2-unit job split → offers sent | Works, but split quality issues below |
| 4 | Ravi (ta) ↔ Lakshmi Garments (ta) | Storefront → chat → "1,000 pcs at ₹19" → offer → Lakshmi counters ₹21 → Ravi accepts → order CC-26-00004 | Flow works, **but the order is for 100 pcs, not 1,000** (bug B1) |

## 3. Findings (severity: High / Medium / Low)

> **Status 22 Nov 2026:** B1–B9 and B11–B19 are fixed on the `supply-chain` branch (see `docs/supply-chain/PROGRESS.md`, "Bug hunt and logged-bug fixes"). **B10 is still open**: it needs a Nexconn server-side history API, or the group setting that lets late joiners see history.

### Bugs
| ID | Sev | What happened | Where / likely cause |
|---|---|---|---|
| B1 | **High** | Ravi wrote "1,000 pieces at ₹19"; the one-tap offer became **100 pcs × ₹19 = ₹1,900**, titled "Order", kind `purchase` (not job work). The counter sheet can't change quantity, so the wrong qty flows into the order (CC-26-00004: 100 pcs, ₹2,205). | `server/src/deals.ts:528` `qty = input.qty ?? … ?? listing?.moq ?? 100`; chat opened from a storefront has no requirement/listing; `detectPrice` reads price only, never qty; kind defaults to purchase. Counter sheet (`web/src/cards/OfferSheet.tsx`) locks qty. |
| B2 | Medium | Seller auto-reply is shown **to the seller in the buyer's language** (Sree, Tamil, sees her own auto-reply in Hindi); the "auto-reply by Claire" notice is also Hindi on her Tamil screen. She can't read what was said on her behalf. | `deals.ts` `autoReply` / notice built in buyer language for both sides |
| B3 | Medium | Header product strip "list price" shows the **latest offer price** (₹166, later ₹21), not the listing price (₹168 / ₹22). | Deal header in `DealScreen.tsx` |
| B4 | Medium | Inbox status pill shows the **old closed order** ("completed") while a new ₹158 offer is pending; no unread badge for the new offer. | `deals.ts` `inbox()` status selection |
| B5 | Medium | Job split assigns T-shirt stitching to **Raju (track pants/shorts only)** at **₹21 > ₹20 cap**, and omits Lakshmi (T-shirt job work). Summary drops the 8-day deadline. | `match.ts` `splitJob` ignores garment type and budget cap |
| B6 | Medium | Claire recommends Sree at **₹168 when the budget is ≤ ₹165** with no "above budget" note (cheaper in-budget option exists). | `claire.ts` / `match.ts` recommendation |
| B7 | Medium | **Tamil layout:** order card title wraps one word per line next to the long status pill "முன்பணம் செலுத்தப்பட்டது"; home tile "மாதிரியைப் பயன்படுத்துங்கள்" breaks mid-word. | `cards/Order.tsx` header flex; Home tiles need `hyphens`/word-safe wrapping or shorter labels |
| B8 | Medium | Trade Desk resolution outcome + note stay **English** for Hindi/Tamil readers (only the heading is localised). | `desk.ts` resolve → `resolved` card |
| B9 | Low | Agent's English message labelled "translated **from Tamil**" for Amit (source language = agent's first language, not the message's). | `web/src/chat/translate.ts` source-lang label |
| B10 | Low | Agent chat pane shows **no history** from before the agent joined (Nexconn group history for late joiners). Claire's summary compensates. | `web/src/desk/*` — could load history via server API |
| B11 | Low | Shortage ticket classified "Quality dispute". | `desk.ts` triage mapping for `short_qty` |
| B12 | Low | Stale quick replies: "Accept ₹158" still offered after countering; Desk "Claire suggests" still offers the intro line after the agent introduced herself. | chip refresh |
| B13 | Low | Counter shows a reply bubble "counter ₹158" (the price countered *from*). | `ReplyBubble` label |
| B14 | Low | Auto-reply already in Hindi shows "translation not available · retry" to the Hindi reader. | translate.ts: skip when same language |
| B15 | Low | Claire tip range "₹21–₹21" (rounding collapses the range). | `deals.ts` `buyerOfferHint` |
| B16 | Low | "New messages · 1" pill in Claire chat doesn't scroll when tapped, and covers the primary button label. | `ChatView.tsx` |
| B17 | Low | Both order cards say "waiting for the other party" during a dispute (Amit: waiting for Sree; Sree: waiting for Amit). | `cards/Order.tsx` |
| B18 | Low | Storefront "About" text not translated for the viewer. | `Storefront.tsx` |
| B19 | Low | One private tip lost: `targeted CC:Hint failed … aborted` (Nexconn timeout, no retry). | `deals.ts` `targeted()` — add one retry |

### Performance
- Cross-language messages take **10–20 s** to appear translated on the other side; Claire turns ~10–21 s (free-tier LLM). Nemotron is blocked for this key ("unavailable … trying the next model"); a fallback model once failed schema validation.

### Gaps relevant to the supply-chain brief (not bugs)
- Dispatch has no quantity field → **no partial dispatch**; shortages can only be reported as a free-text "problem", not recorded as received-vs-sent.
- Job work = one `qty_done` counter; no sizes/colours, no material sent, no rejects/loss.
- One deal conversation per buyer–seller pair: earlier orders and new negotiations pile into the same chat.

## 4. Not tested
Voice notes and voice onboarding (no microphone in the test browser), calls (Call service off in console), catalogue-from-photos, Flutter app (on hold by request).

## 5. Data
All test data is in the isolated `nexconn_sc_dev` database. Nexconn demo users are shared with production (same Nexconn app), so Claire chat history for Amit/Sree/Ravi/Lakshmi now includes these test messages.
