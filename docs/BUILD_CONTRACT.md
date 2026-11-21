# Build contract (for parallel builders)

Read with `docs/02-product-spec.md` (flows) and `docs/03-technical-design.md` (design). Where they disagree with this file, **this file wins** (stack changed: MongoDB Atlas + OpenRouter).

## Stack (fixed)
- Node 24 (`source ~/.nvm/nvm.sh && nvm use 24`), npm workspaces at repo root: `server/`, `web/`, plus `shared/` (plain TS imported by relative path from both).
- Server: Express 4 + TypeScript run by `tsx` (`npm run dev -w server`, port 8787). ESM — **import local files with `.js` suffix** (e.g. `import { q } from './db/index.js'`), shared as `../../shared/cards.js`.
- DB: **MongoDB Atlas** via `server/src/db/index.ts` (`connectDb, col, insert, update, find, findOne, byId, count, kv`). Docs use our string id as `_id` and `id`. Field names are snake_case (see `db/seed.ts`). Arrays/objects stored natively.
- Chat: **Nexconn**. Server REST client `server/src/nexconn.ts`; delivery abstraction `server/src/chat.ts` (`chat.direct/group/system/stream/createGroup/joinGroup/ensureUser`, plus local relay fallback when Nexconn keys are missing). Keys ARE configured, so prod path = Nexconn.
- AI: **OpenRouter free tier** via `server/src/llm.ts` (`llmObject`, `llmText`) — rate limited (19/min, 1000/day). Domain helpers in `server/src/ai.ts`. Never call OpenRouter from the browser.
- Voice: Sarvam via `server/src/voice.ts` (`transcribe`, `speak`, `saveUpload`, `uploadsDir`).
- Web: Vite + React 19 + TS + Tailwind v4 (`@tailwindcss/vite`), zustand, react-router-dom 7, lucide-react, `@nexconn/engine` + `@nexconn/chat` 26.5.1. Dev proxy `/api` and `/uploads` → `http://localhost:8787`.

## Identities
- Every app user id (`u_…`) is also their Nexconn userId. Bots: `claire`, `claire_updates` (system notices), `trade_desk`.
- Seed demo logins (OTP `123456`): Amit buyer HI `9000000001`, Lakshmi stitching TA `9000000002`, Sree Textiles TA `9000000003`, Ravi brand TA `9000000004`, agents Meena `9000000901`, Arjun `9000000902`, Farida `9000000903`.

## Chat message types (register on client BEFORE `NCEngine.connect`)
`NCEngine.registerCustomMessages([{messageType, isPersisted, isCounted}])` — note the field is `isPersisted`.
| type | persisted | counted | content |
|---|---|---|---|
| `CC:Card` | yes | yes | `CardPayload` from `shared/cards.ts` |
| `CC:Hint` | yes | no | `HintPayload` (targeted, only one side sees) |
| `CC:Reply` | yes | yes | `ReplyPayload {chipId,label}` — a chip tap shown as the user's bubble |
| `CC:Voice` | yes | yes | `VoicePayload {audioUrl,durationMs,lang,transcript}` |
Plain text = `RC:TxtMsg` (client `SendTextMessageParams({text})`; server REST content `{content}`; client receives `message.content.text` or `.content` — handle both).

## Conversations
- Claire chat = Nexconn **DirectChannel** with targetId `claire`.
- Deal / combo / support chat = **GroupChannel**, id `deal_<id>` etc., created server-side; stored in Mongo `conversations` {id, kind, channel_id, title, business_ids, user_ids, buyer_business_id, seller_business_id, requirement_id, agent_user_id, created_at, updated_at}. UI shows deal groups like 1-on-1 with the counterpart business.
- Order/payment notices = **SystemChannel** from `claire_updates`.

## Client → server notify pattern (no public webhook needed locally)
After the client sends a message through the SDK it also POSTs to the server so the server can react:
- Claire chat: `POST /api/claire/turn {text?, chipId?}` → server replies via Nexconn as `claire`.
- Deal chat text/voice: `POST /api/deals/:conversationId/inbound {text, lang, messageId}` → price detection hints, auto-reply timer, sentiment → ticket.
Webhook route `POST /api/webhooks/nexconn` also exists for production (verify `sha1(AppSecret+Nonce+Timestamp)` headers `AppKey, Nonce, Timestamp, Signature`; ack within 5 s; dedupe by message id).

## REST API (all JSON, `Authorization: Bearer <token>` except auth/public)
Auth & me
- `POST /api/auth/otp {phone}` → `{ok:true, demo:true}`
- `POST /api/auth/verify {phone, otp}` → `{token, user, business|null, chat:{mode:'nexconn'|'local', appKey, area, token}, isNew}` (issues Nexconn token via `chat.ensureUser`, caches in `users.chat_token`; new phone → creates user with `onboarded:0`)
- `GET /api/me` → `{user, business, trust, chat:{...}, features:{nexconn,llm,sarvam}}`
- `PATCH /api/me {language?, name?}`
- `GET /api/demo-accounts` → list of seed logins (for the login screen "Try a demo account")
Onboarding
- `POST /api/onboarding/turn` multipart `audio` OR json `{text}` + `step` + `draft` → `{transcript, lang, draft: ProfileDraft, next:{key, text, ttsUrl|null}, done:boolean}` (≤4 questions: name+business, what you make/sell/buy, location, GST optional)
- `POST /api/onboarding/complete {draft, language}` → creates/updates business, sets onboarded, sends Claire welcome → `{business, user}`
Claire
- `POST /api/claire/turn {text?, chipId?}` → `{ok}` (replies arrive as chat messages)
- `POST /api/claire/welcome` → sends home card
Catalog / listings / businesses
- `POST /api/catalog/photos` multipart `images[]` (≤12) → `{drafts:[{tempId, imageUrls[], category, title, attrs, price:null, moq:null, sizes:[]}]}`
- `POST /api/catalog/apply {drafts, text}` → `{drafts}` (price/MOQ/sizes from one sentence)
- `POST /api/catalog/publish {drafts}` → `{listings, storefrontUrl}`
- `GET /api/listings?category=&business=` · `PATCH /api/listings/:id`
- `GET /api/businesses/:id` → `{business: publicBiz, listings, reviews:[{rater, scores, comment, at}]}`
- `GET /api/public/s/:slug` → same, no auth
Deals, offers, orders, ratings
- `POST /api/deals/open {sellerBusinessId, requirementId?, listingId?}` → `{conversation}` (creates Nexconn group buyer+seller+claire if needed; posts `requirement` card from buyer and a targeted `CC:Hint` to seller)
- `POST /api/deals/combo {requirementId, lines}` → `{conversations:[...]}` (one deal chat per seller, each with its allocation)
- `GET /api/conversations` → inbox list `[{id, kind, channelId, title, counterpart:{id,name,accent,city,trust,language}, lastAt, unread?}]` plus Claire + Updates entries are added by the client
- `GET /api/conversations/:id` → `{conversation, counterpart, me, requirement, offers, orders, agent}`
- `POST /api/deals/:id/inbound {text, lang, messageId}`
- `POST /api/offers {conversationId, qty, unitPrice, dispatchDays, advancePct, creditDays, freight, listingId?, title?}` → posts `offer` card from my user
- `POST /api/offers/:id/respond {action:'accept'|'decline'|'counter', unitPrice?}` → accept creates order + posts `order` card + system notice
- `POST /api/orders/:id/event {type:'advance_paid'|'payment_confirmed'|'in_production'|'dispatched'|'delivered'|'balance_paid'|'problem', payload}` → updates status, posts refreshed `order` card (client shows only the newest card per orderId), rating prompts after delivered/balance_paid, `problem` creates ticket
- `GET /api/orders` → my orders
- `POST /api/ratings {orderId, scores, wouldRepeat, comment?}`
- `POST /api/samples {conversationId, listingId?, sizes, note}` · `POST /api/jobs/offer {requirementId, lines}` (job-work split → deal chats + offer cards)
Trade Desk
- `server/src/desk.ts` MUST export `createTicket({type, trigger, requesterUserId?, businessIds, description?, languages, orderId?, conversationId?, priority?})` (used by `claire.ts`) and `dispatch(ticketId)`.
- `GET /api/desk/tickets?status=` · `GET /api/desk/tickets/:id` · `POST /api/desk/status {status}` · `POST /api/desk/tickets/:id/join` (Nexconn `joinGroup`, creates support group if no conversation, sets `agent_user_id`, posts `agent_joined` card + targeted hint with AI summary) · `POST /api/desk/tickets/:id/resolve {outcome, upheld?}` · `POST /api/desk/simulate-overdue {orderId?}` (demo trigger) · `GET /api/desk/stats`
Voice & translation
- `POST /api/voice/stt` multipart `audio` (+`lang` hint) → `{text, lang, audioUrl, durationMs}`
- `POST /api/voice/tts {text, lang}` → `{url|null}`
- `POST /api/translate {texts[], to, from?}` → `{translations[]}` (fallback; primary is Nexconn client translation)
Local relay (only when chat.mode === 'local')
- `GET /api/dev/stream?token=` (SSE `message` events with `WireMessage`) · `POST /api/dev/send {channelType, targetId, type, content}` · `GET /api/dev/history?channelType=&targetId=&before=`
Misc: `GET /api/health`, `GET /api/stats` (public traction counters: businesses by role/language, messages, orders, AI usage today), static `/uploads/*`.

## Web module interfaces (shared between web builders)
- `web/src/lib/api.ts` — `api.get/post/patch(path, body?)`, `api.upload(path, FormData)`; token in localStorage `cc_token`.
- `web/src/store/session.ts` — zustand: `{user, business, chat, features, token, setSession, logout}`.
- `web/src/chat/engine.ts` — single chat facade over Nexconn SDK (or local relay):
  `connect()`, `onMessage(cb) → unsubscribe`, `history(channel, before?)`, `sendText(channel, text)`, `sendCard(channel, type, content)`, `sendVoice(channel, VoicePayload)`, `sendTyping(channel)`, `onTyping(cb)`, `translate(items[{id,text,from?}], to) → Promise<Map<id,text>>`, `markRead(channel, messageIds)`, `listChannels()`.
  `type Channel = {type:'direct'|'group'|'system', targetId:string}`; normalized `ChatMessage = {id, channel, senderId, type, content, metadata?, sentAt, mine:boolean}`.
- `web/src/cards/CardRenderer.tsx` — `export function CardRenderer({message, payload, ctx}: {message: ChatMessage; payload: CardPayload; ctx: CardCtx})`; `CardCtx = {me, lang, chip(chipId, label), openStorefront(businessId), openDeal(sellerBusinessId, opts), openConversation(id), api, refresh()}`. Also exports `HintBubble`, `ReplyBubble`.
- `web/src/components/GarmentArt.tsx` — `<GarmentArt shape color pattern size />` SVG illustrations for listings without photos (shapes in `shared/taxonomy.ts`).
- `web/src/i18n.ts` — `useT()` → `t(key)` for UI strings in en/ta/hi (others fall back to en).

## Design tokens (Nexconn-compatible; see UI brief in docs/04 + agent brief)
primary `#0047FF`, primary-tint `#ECF1FF`, primary-hover `#D0DDFF`, bubble-own `#D2E1FE`, bubble-other `#F3F5FA`, surface `#FFFFFF`, page `#F7F8FB`, ink `#020814`, ink-2 `#41464F`, meta `#5B6270`, border `#E4E7ED`, chip-border `#6E8CF0`, success `#15803D`, danger `#D92D20`, warning `#B45309`, note `#FFF7E0`, Claire accent marigold `#F59E0B` (fill only). CLAIRE brand mark: teal `#0D9488` tag shape. Fonts: Poppins (headings), Inter (body), Noto Sans Tamil/Devanagari/Bengali/Telugu fallbacks. Radius: 8 / 12 / 16 / 20 (bubbles, composer) / full (chips). 4px spacing scale. Targets ≥ 44px, chips 44–48px. Bubbles max 78% width. Lucide icons only, no emoji icons. ₹ with Indian grouping (`toLocaleString('en-IN')`). Mobile-first (max-width 480px app column centred on desktop), desktop layout only for `/desk`.

## Supply-chain module (behind a flag; docs/supply-chain/04-technical-design.md)
- Server env `SC_ENABLED=1` turns the module on; then only businesses with `businesses.flags.sc = true` get it (dev: `npm run sc:flag -w server -- <businessId|phone> on`, refuses non-dev databases).
- `GET /api/me` → `features.supplyChain` (env && business flag). Web shows the Goods tab and `/goods` route only when it is true.
- Routes under `/api/sc/*` (requireAuth + requireSc; 404 when off): `GET /api/sc/home` → `{today, chips:{late,toConfirm,disputes}, badge, role}`; `GET /api/sc/goods?tab=out|in|coming` → `{tab, rows}`; `GET /api/sc/templates` → `{materials, processes}` (ordered). Setup (slice 0.5): `GET/POST /api/sc/contacts`, `PATCH /api/sc/contacts/:id`; `GET /api/sc/parties?q=` (my contacts + businesses I trade with, or a name search); `GET/POST(owner) /api/sc/places`; `POST /api/sc/specs/resolve {material_type_id, attrs, alias?}` → content-addressed spec (400 `spec_incomplete` with `missing[]`); `GET /api/sc/specs?q=` (my aliases + recent); `GET/PUT(owner) /api/sc/parties/:k/:id/terms`; `GET/POST(owner) /api/sc/rates` (effective-dated; posting a newer card closes the previous one); `GET/PUT(owner) /api/sc/offerings`; `GET/POST(owner) /api/sc/capabilities`. Slice 1: `POST /api/sc/movements/send` (send for work to a contact; 409 `negative` with `lines[{index,available,needed}]` unless the owner passes `allow_untracked` + reason; `they_got` = the receiver's figure); `POST /api/sc/movements/:id/their-figure`; `POST /api/sc/movements/:id/undo` (10 min, 409 `window_closed`/`has_returns`); `POST /api/sc/jobs/:id/return` (got back; `they_sent` = performer's figure, P6); `POST /api/sc/jobs/:id/complete {last}`; `GET /api/sc/jobs/:id`; `GET /api/sc/goods/out|coming|in`; `GET /api/sc/parties/:k/:id/ledger`. Slice 2 (two-sided): sends/returns may name a business on CLAIRE (`to:{k:'b',id}`); the record stays hidden from them for 10 min (`visible_at`) unless `POST /api/sc/movements/:id/share-now`. `POST /api/sc/movements/:id/confirm {lines:[{line_id, qty?, unit?}]}` (receiver; no qty = "all correct"); `POST /api/sc/movements/:id/sender-figure` (the performer's figure on a return the owner recorded, P6); `POST /api/sc/movements/receive-first` (receiver records first; visible only to it until matched); `GET /api/sc/movements/:id` (per-line privacy, signed photo URLs, never prices); `GET /api/sc/disputes`, `GET /api/sc/disputes/:id`, `POST /api/sc/disputes/:id/propose {outcome: sent|received|split|credit}` (conceding or one-sided settles at once), `/accept`, `/escalate` (Trade Desk ticket, no conversation attached). `POST /api/sc/files` (photo ≤ 350 KB, 200/business) → `{id, url}`; `GET /api/sc-files/:id?exp&sig` (signed, 10 min). `GET /api/sc/goods/coming` adds `toConfirm[]` and `unmatched[]`. Slice 3 (job workers): `GET /api/sc/goods/others` → `{groups:[{client, name, jobs:[WorkRow]}]}` (performer side; `instructions[]` with `to_name`); `GET /api/sc/work/:id` (+ `disclosureTo`); `POST /api/sc/jobs/:id/output {lines, ready?}`, `/ready {on}`, `/hold {on, reason?}` (pauses lateness); `GET /api/sc/jobs/:id/ready-lines`; `POST /api/sc/jobs/:id/send-back {lines, client_id}` (shortfall = implied output; rolls up to the parent); `POST /api/sc/jobs/:id/instruct {to, process_key}` (owner/client: "tell them to send it on"); `POST /api/sc/jobs/:id/forward {to, lines, instruction_id?, client_id}` (sub-contract keeps `via`, hop drops it; `disclosed` = hop or GST-registered owner; 400 `nested`); `POST /api/sc/specs/resolve-grid {material_type_id, base, colours[], sizes[]}` → `{cells[colour][size], dimension, units, class}`; `GET/POST(owner) /api/sc/styles` (trims returned with `resolved`). Ledger badges add `receipt_confirmed` (onlooker); lines may carry `label_generic` shown only to `generic_viewer`. More routes land slice by slice (04 §7).
- Conversations: `kind: 'goods'`, `channel_id: goods_<bizA>_<bizB>` (sorted), owners of both businesses + Claire; deal auto-reply, price tips and sentiment desk skip it. Cards `CC:Card` kinds `movement` and `dispute` (`shared/cards.ts`): one untargeted payload for both sides, no prices, short trilingual `text`; the web renders the reader's side and keeps only the newest card per movement/dispute.
- Collections are prefixed `sc_`; all writes go through `server/src/sc/repo.ts` `post()` (one transaction: event + postings + holdings).
- Shared domain core: `shared/sc/*` (pure TypeScript; server imports it with relative `.js` paths, web with `@shared/sc`).
- Tests: `npm test` (node:test via tsx, Node 24 — see `.nvmrc`). Lint: `npm run lint` (typecheck + `scripts/sc-lint.mjs`).

## Rules for builders
- Stay inside your owned files. If you need something from another area, code against the interface above.
- Never print or log secrets from `server/.env`. Don't commit or push (no git operations).
- No mock data in UI code — fetch from the API (seed data lives in Mongo).
