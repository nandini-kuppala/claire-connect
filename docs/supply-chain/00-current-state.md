# 00 · Current state of CLAIRE Connect (Phase 0)

Written 20 Nov 2026 from reading `docs/*`, `server/src`, `web/src`, `shared/` and running the checks. No code was changed.
Code is the source of truth where it disagrees with the docs; the disagreements are listed in §9.

---

## 1. Architecture in one picture

```
Browser (React 19 PWA, max-width 480 column)          Express API (tsx, no build step)            External
 ├─ Nexconn Web SDK (@nexconn/engine+chat 26.5.1) ───► Nexconn cloud (SG) ◄── signed REST ── server/src/nexconn.ts
 │    direct channel → bot "claire"                    │                                       │
 │    group channel  → one per deal (deal_<id>)        │                                       ├─ MongoDB Atlas, db "nexconn"
 │    system channel → "claire_updates" notices        │                                       ├─ OpenRouter free tier (llm.ts)
 └─ HTTPS /api (same origin in prod) ─────────────────► routes/* → claire.ts, deals.ts, desk.ts ├─ Sarvam STT/TTS (voice.ts)
                                                                                                └─ (ANTHROPIC_API_KEY is in .env, unused)
```

- **One Render web service** (`render.yaml`, free plan, Singapore). The server serves `web/dist`. Uploads are ephemeral on Render.
- **Client → server notify pattern**: the client sends a chat message through the SDK, then POSTs to the server (`/api/claire/turn`, `/api/deals/:id/inbound`) so the server can react; the Nexconn webhook does the same in production. Both dedupe on message id via `claim()`.
- **Local relay**: if Nexconn credentials are missing/rejected, `chat.ts` falls back to SSE + Mongo (`dev_messages`). Useful for isolated testing.
- **Mobile**: a Flutter app in `mobile/` talks to the same API (not in scope for this feature; see §8 risk).

## 2. Data model (MongoDB, snake_case, string `_id` = `id`)

Helpers: `server/src/db/index.ts` (`col, insert, update, find, findOne, byId, count, kv, claim, bump`). There is **no schema layer and no migration framework**; indexes are created in `connectDb()`.

| Collection | Key fields | Notes for us |
|---|---|---|
| `users` | `phone` (unique, 10-digit local), `name`, `language`, `business_id`, `role:'owner'`, `chat_token`, `onboarded`, `is_seed` | **One user per business, always `owner`.** No staff/worker logins. |
| `businesses` | `slug`, `name`, `owner_name`, `language`, `city/state/area`, `role_label` (free English string), `sells[]`, `buys[]` (category ids), `capacity_note`, `gstin`, `is_manufacturer`, `gst_verified`, `unit_visited`, `reply_minutes`, `auto_reply`, `accent`, `is_seed` | Roles are already *not* exclusive: `sells`/`buys` arrays + a display label. This is the migration base for the new role model. |
| `listings` | `business_id`, `category`, `type` (product/material/service), `title`, `attrs{}`, `price`, `unit`, `moq`, `size_set{}`, `stock_qty`, `capacity_per_day`, `lead_days`, `active` | `stock_qty` is a single number, not variant/lot stock. `lead_days` is a listing-level lead time. |
| `requirements` | buyer needs (category, qty, budget, deadline, city…) | Feeds matching. |
| `conversations` | `kind: deal|combo|support`, `channel_id` (unique), `business_ids[]`, `user_ids[]`, `buyer_business_id`, `seller_business_id`, `requirement_id`, `agent_user_id` | **One deal conversation per buyer–seller pair** (`findOrCreateConversation`). |
| `offers` | `kind: purchase|job_work`, from/to business, `qty`, `unit`, `unit_price`, `dispatch_days`, `advance_pct`, `credit_days`, `freight`, `parent_id` (counter chain), `status` | |
| `orders` | `kind: purchase|sample|job_work`, `code`, buyer/seller business, `qty`, `unit`, `unit_price`, `total`, `gst_pct`, `eway_bill`, `status` (confirmed → advance_paid → in_production → dispatched → delivered → balance_paid → closed / cancelled / disputed), `qty_done`, `dispatch{transporter, lr, bundles}`, `group_id` (job-split parent), timestamps per status | **Job work today = one scalar `qty_done` progress counter.** No material sent, no receipts, no loss, no rejects, no sizes/colours, no lots. Status is overwritten in place (timestamps kept). |
| `ratings`, `vouches`, `tickets`, `agents` | trust and Trade Desk | Trust score = verification 20, ratings 40, reliability 25, responsiveness 10, disputes 5 (`trust.ts`). |
| `claire_sessions` | per-user slot-filling state | Claire's state machine. |
| `onboarding_sessions`, `kv`, `counters`, `llm_cache`, `dev_messages` | infra | `kv` also holds the daily LLM budget counter. |

## 3. Chat message and card types (`shared/cards.ts`, `docs/BUILD_CONTRACT.md`)

- Custom messages registered before connect: `CC:Card` (persisted, counted), `CC:Hint` (targeted private tip), `CC:Reply` (chip tap), `CC:Voice` (audio + transcript), `CC:Call` (call summary). Plain text = `RC:TxtMsg`.
- `CardPayload` is a discriminated union on `kind`: `chips, tiles, carousel, summary, results, requirement, offer, order, rating, orders, agent_joined, resolved, profile, notice, job_split`.
- Cards are **snapshots**; the client shows only the newest `order` card per `orderId` (a refreshed card is re-posted on each event). Actions on cards call REST endpoints, never chat messages.
- Rendering: `web/src/cards/CardRenderer.tsx` with `CardCtx {me, lang, chip, openDeal, openConversation, api, refresh…}`.
- **Reuse point:** new `dispatch`, `receipt`, `job_work_order`, `discrepancy`, `record_draft` cards fit this pattern exactly: new `kind`s in the union + renderers + REST actions + "newest card per id wins".

## 4. Claire's pipeline today

- `server/src/claire.ts`: **deterministic slot-filling state machine** (category → style → qty → budget → timing → results). The LLM only extracts intent + slots (`ai.ts understand()`, intents `BUY_PRODUCT, FIND_SERVICE, ADD_LISTING, UPDATE_STOCK, ORDER_STATUS, REORDER, TALK_TO_HUMAN, GREETING, UNKNOWN`). Replies are server-sent chat messages from bot `claire` over the user's **direct channel**; two NLU failures → Trade Desk handoff.
- `server/src/llm.ts`: OpenRouter **free tier**, 19 req/min rolling, **1,000 req/day shared by the whole app** (30 reserved), retries, Mongo + memory cache. `llmObject()` = forced single function call (structured output), then JSON-in-text fallback, zod-validated. **There is no multi-turn tool-calling loop anywhere.** Model chain: `nvidia/nemotron-3-ultra-550b-a55b:free` → ernie-5.5-flash → ling-3.2-flash → gemma-4-31b. HANDOVER says the account guardrail currently **blocks the free Nemotron endpoints**, so a fallback model is answering in production.
- Rule-based fallbacks (en/hi/ta keywords) when the budget is spent.
- Matching (`match.ts`): single sellers, 2–3 seller combos, `splitJob` for job work by capacity, market price band.
- Deal-room Claire: price detection, private `CC:Hint` tips, seller auto-reply (`deals.ts`).
- Voice: Sarvam STT/TTS for all 10 languages (`voice.ts`); translation via server LLM `/api/translate` (glossary-aware) with Nexconn SDK translation in parallel.

**Implication for the personal Claire:** the user's existing 1:1 Claire chat *is* already a private channel. The new "my business" assistant can live in the same direct channel as new intents (query + record), reusing the card/chip plumbing — no new bot needed. The free-tier daily budget and the lack of a proven tool-calling loop are the main risks (Phase 4 must verify models).

## 5. i18n

- Web: `web/src/i18n.ts` (`useT()`, namespace `app`) plus co-located `*.strings.ts` via `defineStrings('<ns>', {en, ta, hi})` (`web/src/lib/localStrings.ts`). Other 7 languages via lazy overlay JSON `web/src/locales/<lang>.json`. Lookup: inline → overlay → English → key.
- Server: `server/src/i18n.ts` (`t(lang, key)`), namespaces in `deals.ts`, `desk.ts`; overlays `server/src/locales/<lang>.json`.
- `npm run i18n:extract` regenerates `en.json`; `npm run i18n:check -- all` must stay 100%.
- New feature strings: en/ta/hi inline (brief requires these three); the other seven can follow via overlays (falls back to English, never blank).

## 6. Auth, roles, permissions

- Phone + **fixed demo OTP** (`DEMO_OTP`, no SMS provider). HMAC-signed token `{uid}` with no expiry (`util.ts`). `requireAuth` sets `req.uid`; every handler then loads the user and its single `business_id`.
- Authorisation is per handler (e.g. `assertMember(conv, user)` in `deals.ts`). There is **no central policy layer**. For the new feature, scoping by `business_id` derived from the token must be enforced in one place (repository functions that always take `bizId` from the session).
- "Roles" = `businesses.role_label` (display) + `sells[]/buys[]` (capability); agents are recognised by `isAgent` on the client and `agents` collection on the server.

## 7. Web app structure and design system in code

- Routes (`web/src/App.tsx`): `/login, /language, /onboarding, / (Home), /chats, /results/:id, /compare/:id, /chat/:conversationId, /updates, /store/:businessId, /orders, /me, /desk, /s/:slug`.
- Bottom nav: Home · Chats · Orders · (Store, only if the business sells) · Profile.
- Components to reuse: `AppShell`, `ScreenHeader`, `Button`, `Avatar/ClaireMark`, `TrustBadge`, `Sheet`, custom icon set `web/src/icons` (never lucide directly), cards `ui.tsx`.
- **Actual tokens** (`web/src/index.css`): white page/surface, primary teal-green `#1f8c73`, ink navy `#13203b`, marigold accent, clay for prices/alerts, plum for Claire; radii 8–26 px; flat colour, no gradients, Figtree + Bricolage Grotesque, Hind Madurai/Hind for ta/hi.
- Web bundle: main chunk **1.49 MB (407 KB gzip)** — already heavy for budget Android on patchy 4G. New screens must be lazy-loaded routes.

## 8. Checks run

| Check | Result |
|---|---|
| `npm run typecheck` (server + web) | Pass |
| `vite build` (web) | Pass; one warning (`call/service.ts` dynamic import ineffective); 1.49 MB main chunk |
| Tests | **None exist** for server or web (no test runner configured). Flutter has 46 tests. |
| Lint | **No lint script** configured. |
| Run locally | **Not run.** `server/.env` has no `MONGODB_DB`, so local dev uses db `nexconn` — the **same Atlas database as production** (HANDOVER §0 confirms). Starting the server would also register users with the production Nexconn app. Needs a decision (see §10). |

## 9. Doc drift found (fix in Phase 7)

1. `BUILD_CONTRACT.md` "Design tokens" lists blue `#0047FF`, `DESIGN_SYSTEM.md` lists "Tiruppur cotton" (`#F4EFE6` page, loom green `#1E5A4C`), and `index.css` actually ships white + teal-green `#1f8c73` + navy ink. **`index.css` is what users see**; the docs need one consistent token table.
2. `03-technical-design.md` describes Postgres + Anthropic; build is MongoDB + OpenRouter (noted at top of file already).
3. `00-README.md` decision #7 "Asset-light: **no inventory**" — the new brief deliberately reverses this for *tracking* (not holding) inventory. The business model stays asset-light; we record stock, we don't own it.
4. Product spec J7.1–J7.3 (job split, "progress by voice", "work order = digital challan") is the seed of this feature but was implemented only as `qty_done`.

## 10. Where the new feature plugs in

| Need | Reuse | New |
|---|---|---|
| Multi-role businesses | `businesses.sells/buys` + `role_label` | Capability list per business (roles derived per transaction, not per account); migrate existing labels. |
| Counterparties incl. off-platform | `businesses`, phone normalisation in `routes/auth.ts` | `contacts` (name + phone, owned by one business) that link to a `businesses` row when that phone signs up. |
| Job-work orders between platform users | `offers`/`orders` `kind:'job_work'`, deal rooms, offer/order card pattern | Movements (dispatch/receipt/return) with lines per spec × colour × size × lot; two-sided confirmation; discrepancy records. Existing `qty_done` becomes a derived value. |
| Cards in deal rooms | `CC:Card` union, `CardRenderer`, "newest card per id" | `dispatch`, `receipt`, `discrepancy`, `record_draft` (+ job-work order card evolves from `order`). |
| Notifications | `chat.system()` from `claire_updates` | Same channel for platform users; share links for off-platform (decision). |
| Personal Claire | Direct channel with `claire`, `claire_sessions`, chips, voice, translation | Query tools + "draft → confirm" record flow; scoping from token. |
| Search/discovery for new categories | `shared/taxonomy.ts`, `match.ts`, `ai.ts` NLU | New service/material categories (knitting, compacting, embroidery, cutting, checking/packing, trims, transport…). |
| Screens | `AppShell`, nav, cards, icons, `defineStrings` | Lazy routes: "With whom", Stock, Flow view, Analytics; a nav slot (Orders tab likely evolves into "Work"/"Production"). |
| Trade Desk | tickets on `problem`/disputes | Discrepancies can escalate to a ticket. |
| Feature flag | `/api/me` already returns `features` | Add `supplyChain` flag (env + per-business allowlist). |

## 11. Constraints and risks carried forward

1. **Hackathon deadline Sun 22 Nov 2026, 11:59 PM IST** (HANDOVER §0). The live app is the submission. All new work must stay behind a flag and must not destabilise main before then.
2. **Shared prod/dev database and Nexconn app.** We need an isolated dev DB (e.g. `MONGODB_DB=nexconn_sc_dev`) or the local relay before running anything.
3. **LLM budget**: 1,000 free requests/day for the whole app; a tool-calling assistant multiplies calls per question. Free-model tool-calling reliability is unverified; an Anthropic key exists in `.env` but is unused.
4. **No tests, no lint, no schema validation layer** today. Domain logic for conservation/isolation must come with a test runner (add `vitest` or Node's built-in `node:test` — the latter needs no new dependency).
5. **One user per business**: workers/supervisors can't log in separately. Many units have a supervisor who would record receipts. Out of scope for v1 unless decided otherwise.
6. **Flutter app** won't render new card kinds. Both clients already degrade: web `CardRenderer` → `<Fallback/>`; Flutter `card_payload.dart` → `OtherCard` showing `text ?? title ?? outcome`. So **every new card payload must carry a plain `text` (or `title`) summary** in the reader's language.
7. Bundle size and patchy 4G: new screens lazy-loaded, API responses paginated and small.
