# 03 · Technical Design — CLAIRE Connect

> **Note (implementation):** this was the planning design. The shipped build uses **MongoDB Atlas** (not Postgres/Supabase) and **OpenRouter** (not Anthropic). `BUILD_CONTRACT.md` and `HANDOVER.md` describe what is actually built.


> Read `02-product-spec.md` first. Every Nexconn API name below was checked against `docs.nexconn.ai` (llms.txt index) on 18 Nov 2026. Before coding a feature, install the official **nexconn-chat** skill (see §1.3) and let your coding agent re-read the exact page — the server SDK is v0.1.2 and may move.

## 1. Platform decisions

### 1.1 Constraints from the challenge and from Nexconn

| Constraint | Source | Consequence for us |
|-----------|--------|--------------------|
| Chat SDK usage is mandatory and verified through our **App Key** | Rules | One Nexconn app, same App Key in the demo, the PDF and the form. Every core feature runs through Chat SDK channels so usage is measurable. |
| Only **Web, iOS, Android, Flutter** SDKs; no React Native | Docs | **Web PWA** (React + Vite + TypeScript). One codebase covers Android phones (install to home screen), the desktop Trade Desk, the public storefront, and a link judges can open. |
| Chat UI kit ships only en/zh strings and is not meant to be mixed with direct Chat SDK calls | Docs | Use **Chat SDK directly** with our own React components. We need custom cards, 10 Indian-language UIs and voice transcripts anyway. |
| Built-in translation is **client-side only**, mechanical mode, 10 items per call, results arrive async; free plan includes **10,000 characters**, then needs a card ($0.02 / 1,000 chars) | Docs | Receiver-side translation via `NCEngine.translateModule`; cache aggressively; **add a card to the Nexconn account before the traction push** or translation stops. Claude fallback for glossary-heavy or failed translations. |
| **No speech-to-text API** in the Chat SDK | Docs | Third-party STT/TTS for Indian languages (Sarvam AI recommended; see §10). |
| **No agent routing / customer-service product** and no bot framework | Docs | We build Trade Desk from GroupChannel + server send + targeted messages + presence + webhooks. This is a strength in the write-up: "built a dispatch center on Nexconn primitives". |
| Webhooks time out at **5 s**, 3 attempts | Docs | Webhook handler verifies the signature, enqueues, returns 200 immediately. Idempotency key = message UID. |
| Pre-messaging webhook (sync, can modify/block) is on Free and Pro plans, not Starter | Docs | Activate the **Chat Growth Credit** (Pro features free to 10K MAU; register by 31 Dec 2026, integrate and send one message). Use pre-messaging for a light scam guard (P1). |
| Data centres: Singapore (default), North America, Saudi Arabia — no India | Docs | Create the app in **Singapore** (lowest latency to India). Cannot be migrated later. |
| Profanity filter doesn't cover Indian languages | Docs | Our own keyword list + Claude sentiment in the async pipeline. |
| Client rate limit 5 msg/s; server direct send 6,000/min, group send 20/s | Docs | RFQ broadcasts and combo fan-outs go through a small server-side queue. |

### 1.2 Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Client | React 18 + Vite + TypeScript, Tailwind, `vite-plugin-pwa`, Zustand for state, React Router | Fast to build, installable PWA, Web Share Target for "Share to CLAIRE" from WhatsApp |
| Chat | `@nexconn/engine` + `@nexconn/chat` (Chat SDK Web); `@nexconn/call` (Call SDK Web, P1) | Required SDK; calls are a strong demo moment |
| Server | Node 20 + TypeScript + Fastify; `@nexconn/server-sdk` (Node, v0.1.2 from git) | Token issuing, bot sends, group management |
| Database | Postgres (Supabase) + Drizzle ORM; Supabase Storage for images/audio | One managed service for DB + files; generous free tier |
| Queue / jobs | `pg-boss` (Postgres-backed) | Webhook fan-out, auto-reply timers, SLA cron, no Redis to run |
| AI | Claude via `@anthropic-ai/sdk` (`claude-opus-5-5`) | Extraction, vision catalog, auto-reply, triage (§9) |
| Voice | Sarvam AI speech-to-text + text-to-speech (Indian languages, handles code-mixed Tanglish/Hinglish); browser Web Speech API as offline fallback for live captions | No STT in Nexconn |
| Hosting | Client on Vercel; server on Railway or Render (paid/always-on instance — webhooks must not hit a sleeping server) | Simple HTTPS for webhooks |

### 1.3 Developer setup

```bash
# Nexconn coding-agent skill (works with Claude Code / Cursor)
npx skills add https://github.com/NexconnAI-Dev/nexconn-skills.git --skill nexconn-chat
# optional: Nexconn Console MCP for Claude Code (access key from Console > App Key)
claude mcp add --transport http nexconn-console https://console-mcp.nexconn.ai/mcp/v1/endpoint --header "Authorization: ${NEXCONN_MCP_ACCESS_KEY}"

# client
npm i @nexconn/engine@latest @nexconn/chat@latest @nexconn/call@latest
# server
npm i "git+https://github.com/NexconnAI-Dev/nexconn-server-sdk-node.git#v0.1.2" @anthropic-ai/sdk zod fastify pg-boss drizzle-orm
```

Nexconn Console checklist (owner does this once, day 0):
1. Create app → region **Singapore** → note App Key / App Secret (secret only in server env).
2. Activate **Chat Growth Credit** (free-chat-api page) for Pro features.
3. Chat settings → Messages → **Translation: ON**. Add a card if the team agrees (needed past 10,000 characters and for Call SDK free minutes).
4. Chat settings → **Webhooks** → `https://<server>/api/webhooks/chat` → events: `message:send`, `user:connection_status`, `group_channel:changed`; pre-messaging for direct + group (P1).
5. Create users `claire` (bot), `claire-updates` (system sender), `desk` (Trade Desk system) via token issue.

Server env:
```
NEXCONN_APP_KEY, NEXCONN_APP_SECRET, NEXCONN_API_BASE=https://api.sg-light-api.com, NEXCONN_API_BACKUP=https://api-b.sg-light-api.com
ANTHROPIC_API_KEY, SARVAM_API_KEY
DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, PUBLIC_WEB_URL
```

---

## 2. Architecture

```
           ┌──────────────────────── Web PWA (React) ────────────────────────┐
 Buyer /   │ Inbox · Claire chat · Deal chats · Storefront · Orders · Me     │
 Seller    │ NCEngine + Chat SDK (channels, custom cards, translation,       │
 phones    │ typing, read receipts, presence)  ·  Call SDK (P1)              │
           └──────┬───────────────────────────────▲──────────────────────────┘
                  │ REST (JWT)                    │ realtime messages
                  ▼                               │
 ┌──────────────────────── CLAIRE server (Node/Fastify) ───────────────────────┐
 │ Auth+token ─► Nexconn token issue        Webhook in (verify, enqueue, 200)  │
 │ Claire orchestrator (flows, NLU)         Deal pipeline (auto-reply timers,  │
 │ Matcher + combo builder                    price detection, sentiment)      │
 │ Orders / offers / ratings / trust        Trade Desk dispatcher + SLA cron   │
 │ Voice: STT / TTS / translate fallback    Nexconn sender (direct, group,     │
 │                                            stream, system channel)          │
 └───┬───────────────┬──────────────────┬──────────────────────┬──────────────┘
     │               │                  │                      │
 Postgres +      Claude API          Sarvam AI           Nexconn platform
 Storage        (extraction,        (speech-to-text,     (Singapore DC: channels,
 (Supabase)      vision, triage)     text-to-speech)      webhooks, translation, calls)
                                                                ▲
 Trade Desk console (same PWA, /desk) ──── Chat SDK ────────────┘
```

### 2.1 Which Nexconn channel for which conversation

| Conversation | Nexconn channel | Members | Why |
|--------------|-----------------|---------|-----|
| User ↔ Claire | `DirectChannel` (target `claire`) | user, claire bot | Simple 1-on-1; server replies as `fromUserId: "claire"` |
| **Deal chat** (buyer ↔ seller) | `GroupChannel` created by server, shown in UI as a 1-on-1 | buyer user(s), seller user(s), `claire` | A group lets Claire post **targeted** hints (`directedUserIds`) and lets a Trade Desk agent **join** later without starting a new chat |
| Combo chat | `GroupChannel` | buyer, 2–3 sellers, claire | Shared timeline; each seller's price card is targeted to that seller only |
| Partner chat | `GroupChannel` (existing deal chat upgraded) | both businesses, claire | Standing price card pinned |
| Support (no deal) | `GroupChannel` | user, desk agent, claire | Same mechanics as deal chat |
| Order / payment notifications | System channel (`/v4/system-channel/message/send`) from `claire-updates` | — | Nexconn's recommended pattern for order and shipment notices |
| Agent alerts | `DirectChannel` from `desk` to agent | agent | New-ticket pings in the console |

### 2.2 Nexconn feature map (also the text for the submission form's "SDK features you used")

| Nexconn feature | API (Web / REST) | Where it appears in CLAIRE Connect |
|-----------------|------------------|-------------------------------------|
| Token issue | REST `POST /v4/auth/access-token/issue` (server SDK `UserManagementApi.issueAccessToken`) | Login; bot users |
| Init / connect / connection status | `NCEngine.initialize({appKey, areaCode})`, `NCEngine.connect({token})`, `addConnectionStatusHandler` | App boot; "Reconnecting…" banner |
| Direct channel | `DirectChannel`, `channel.sendMessage(new SendTextMessageParams({text}))` | Claire assistant chat |
| Group channel | REST `/v4/group-channel/create`, `/join`, `/leave`, `/member/list` | Deal, combo, partner and support chats; agent joins |
| Targeted messages in groups | `params.directedUserIds = [...]` | Claire's private hints, agent whispers, per-seller combo price cards |
| Custom messages | `NCEngine.registerCustomMessages([...])` (before connect), `new SendMessageParams(content, 'CC:OfferCard')` | All cards in §7 |
| Server send as bot | REST `/v4/direct-channel/message/send` (`fromUserId: "claire"`), group send | Every Claire reply and system card |
| Streaming messages | REST `/v4/direct-channel/message/stream/send` (`seq`, `complete`); client `onStreamMessageRequestInit/Delta/Complete` | Claire's longer answers (summaries, "why this seller") stream in like typing |
| System channel | REST `/v4/system-channel/message/send` | "CLAIRE Updates": order, payment, dispatch notices |
| Media messages | `channel.sendMediaMessage` with `Helper.createSendImageMessageParams` / `createSendHDVoiceMessageParams` | Product photos and raw voice notes |
| **Built-in translation** | `NCEngine.translateModule.translateMessages({list:[new TranslateMessageParam(id,'auto',lang,text)]})`, `translateTexts(...)`, `TranslateHandler.onTranslationCompleted`, `setTranslationLanguage`, `setAutoTranslateEnabled`, `setTranslateStrategy` | Every message, transcript and free-text card field, in 10 Indian languages |
| Typing indicator | `channel.sendTypingStatus(...)`, `onTypingStatusChanged` | "typing…" / "recording a voice note…" |
| Read receipts | `channel.sendReadReceiptResponse([ids])`, `onMessageReceiptResponse` | ✓✓ seen on offers (did the buyer see my quote?) |
| Online status | `subscribe_online` + `user:connection_status` webhook | Trade Desk knows which agents are online; "online now" dot on sellers |
| Message history / channel list / unread / pin | `getHistory`, `createChannelsQuery`, unread APIs, pin channel | Inbox; Claire pinned on top |
| Webhook `message:send` | Console webhook | Routes messages to Claire, auto-reply timers, ticket triggers |
| Pre-messaging webhook (P1) | Console webhook | Scam guard: blocks bank-account / "pay outside" messages before an order exists; masks phone numbers |
| Call SDK (P1) | `@nexconn/call`, `NCCallEngine`, `NCCallType.SINGLE`, `NCCallMediaType.AUDIO` | 📞 in deal chat header; agent calls buyer/seller from the desk |

---

## 3. Key sequences

### 3.1 Login and connect
```
PWA ── POST /api/auth/otp/verify ──► server
server: upsert user; if new → Nexconn token issue (userId = u_<uuid>, name, avatar) → store chat_user_id
server ──► {jwt, chatToken, appKey}
PWA: NCEngine.registerCustomMessages(CC_TYPES) → NCEngine.initialize({appKey, areaCode:SG}) → NCEngine.connect({token})
PWA: setTranslationLanguage(user.language); setAutoTranslateEnabled(true)
```

### 3.2 User talks to Claire
```
PWA (DirectChannel→claire) sends text, or CC:Voice {audioUrl, transcript, lang}
Nexconn ── message:send webhook ──► server (verify sig → enqueue → 200 OK in <100 ms)
worker: ClaireOrchestrator.handle → NLU (Claude) → flow.nextStep → messages[]
worker ── REST direct send (fromUserId: claire, messageType: CC:Chips / CC:MatchResults / RC:TxtMsg / stream) ──► Nexconn ──► PWA
```
Chip taps are sent **as normal messages** (text = chip label, `CC:ChipReply` with `{chipId,value}`) so the conversation history reads naturally and the same webhook path handles taps and speech.

### 3.3 Open a deal chat
```
Buyer taps "Chat & negotiate" ── POST /api/conversations/deal ──► server
server: find existing group for (buyer, seller) or REST group-channel/create {groupId: deal_<uuid>, members:[buyer, seller, claire]}
server: group send CC:RequirementCard (from buyer, via server) ; CC:PrivateHint to seller (directedUserIds)
server ──► {groupId} ── PWA opens chat
```

### 3.4 Translated voice note (Hindi → Tamil)
```
Amit holds mic ── MediaRecorder (webm/opus) ── POST /api/voice/transcribe ──► server
server: store audio (Supabase) → Sarvam STT (hi) → {audioUrl, transcript, lang:"hi", durationMs}
PWA (Amit) sends CC:Voice {audioUrl, transcript, lang, durationMs} to the deal GroupChannel
PWA (Lakshmi) onMessageReceived → translateTexts([TranslateTextParam(transcript,'hi','ta')])
   → onTranslationCompleted → render Tamil text under the waveform
Lakshmi taps "▶ Listen in Tamil" ── POST /api/voice/tts {text, lang:"ta"} ── cached mp3 URL ── play
server (async, from webhook): price/qty detection → CC:PrivateHint to Amit "Make this a counter-offer at ₹165?"
```

### 3.5 Escalation → agent joins
```
trigger (user tap / sentiment / overdue) → tickets.insert → Claude triage summary (agent language)
dispatcher picks agent (languages, skills, load, online via presence) → desk DirectChannel alert to agent
agent clicks "Join" ── POST /api/desk/tickets/:id/join ── REST group-channel/join {groupId, userId: agent}
server: conversations.human_takeover_agent_id = agent → Claire auto-replies paused
server: group send CC:AgentJoined to all; CC:PrivateHint (summary + suggested replies) to agent only
```

---

## 4. Environments and deployment

| Env | Client | Server | Nexconn |
|-----|--------|--------|---------|
| local | `vite` on :5173 | `fastify` on :8080 behind an `ngrok`/`cloudflared` tunnel (webhooks need public HTTPS) | same app as prod during the hackathon (one App Key, as the rules require) |
| prod | Vercel `claire-connect.vercel.app` (+ `/s/:slug` public storefront, `/desk`) | Railway/Render always-on, `/api/*` | Singapore DC app; webhook → prod URL |

- Use **one Nexconn app** for dev and demo so all usage counts toward the App Key the judges check. Prefix test user ids with `t_` and seed ids with `seed_` so they can be filtered out of traction numbers.
- Health page `/api/health` checks DB, Nexconn token issue, Claude, Sarvam.
- Public stats page `/stats` (businesses onboarded by role and language, messages today, translations, orders) — doubles as the "traction proof link" in the submission form.

---

## 5. Data model (PostgreSQL)

Prisma or Drizzle schema can be generated from this. All ids are `uuid` (default `gen_random_uuid()`), all tables have `created_at timestamptz default now()`. Money is stored in **paise** (`bigint`) to avoid float errors; quantities are integers (pieces) or `numeric(12,2)` (kg).

```sql
-- ─── Identity ──────────────────────────────────────────────
create table businesses (
  id uuid primary key,
  slug text unique not null,                -- storefront: claire.app/s/{slug}
  name text not null,
  owner_name text,
  about text,
  language text not null default 'ta',      -- BCP-47-ish: ta, hi, en, te, kn, ml, bn, or, mr, gu
  city text, area text, state text,
  lat double precision, lng double precision,
  gstin text, gst_verified boolean default false,
  udyam_no text,
  unit_visited_at timestamptz,
  website_url text,                         -- optional external site ("view more")
  is_manufacturer boolean,                  -- manufacturer vs trader badge
  referred_by_business_id uuid,             -- invite link source (growth + "vouched by")
  auto_reply_mode text not null default 'suggest' check (auto_reply_mode in ('off','suggest','auto')),
  auto_reply_delay_sec int not null default 120,
  working_hours jsonb,                      -- {"mon":["09:00","20:00"],...}
  onboarding_source text                    -- invite:<businessId> | field:<agentId> | organic
);

create table users (
  id uuid primary key,
  business_id uuid references businesses(id),
  phone text unique not null,
  name text,
  language text not null default 'ta',
  role text not null default 'owner' check (role in ('owner','staff','agent','supervisor','admin','bot')),
  chat_user_id text unique not null         -- id registered with Nexconn
);

-- What a business sells / buys (drives matching + Claire tile order)
create table capabilities (
  id uuid primary key,
  business_id uuid references businesses(id) on delete cascade,
  direction text not null check (direction in ('sell','buy')),
  category_id text references categories(id),
  note text
);

create table categories (
  id text primary key,                      -- 'garment.track_pants', 'fabric.single_jersey', 'service.stitching'
  parent_id text references categories(id),
  kind text not null check (kind in ('product','material','service')),
  unit text not null check (unit in ('piece','kg','meter','roll')),
  names jsonb not null,                     -- {"en":"Track pants","ta":"டிராக் பேண்ட்","hi":"ट्रैक पैंट"}
  attr_schema jsonb                         -- allowed attributes per category (fabric, gsm, colours, ...)
);

-- ─── Supply ───────────────────────────────────────────────
create table listings (
  id uuid primary key,
  business_id uuid references businesses(id) on delete cascade,
  category_id text references categories(id),
  type text not null check (type in ('product','material','service')),
  title jsonb not null,                     -- multilingual
  attrs jsonb not null default '{}',        -- {"fabric":"cotton","gsm":240,"colours":["black","navy"],"print":"plain","sizes":["M","L","XL","XXL"]}
  images text[] not null default '{}',
  price_paise bigint not null,              -- per unit
  floor_price_paise bigint,                 -- auto-reply never quotes below this (never shown to buyers)
  unit text not null,
  moq int not null default 1,               -- in pieces / kg
  size_set jsonb,                           -- {"M":2,"L":2,"XL":2,"XXL":1}  → 7 pcs per set; null for kg items
  pack_unit text,                           -- 'set' | 'dozen' | 'box' | null
  min_order_value_paise bigint,             -- many ready-stock sellers use ₹5,000–₹10,000 minimum instead of MOQ
  stock_qty int not null default 0,         -- products/materials (pieces or kg)
  capacity_per_day int not null default 0,  -- make-to-order or service capacity
  lead_time_days int not null default 0,
  embedding vector(1024),                   -- optional (pgvector) for "photo search"/similar styles
  active boolean not null default true,
  stock_updated_at timestamptz default now()
);
create index on listings (category_id) where active;

-- ─── Demand ───────────────────────────────────────────────
create table requirements (
  id uuid primary key,
  buyer_business_id uuid references businesses(id),
  type text not null check (type in ('product','material','service')),
  category_id text references categories(id),
  attrs jsonb not null default '{}',
  liked_listing_ids uuid[] default '{}',
  qty numeric(12,2) not null,
  unit text not null,
  size_ratio jsonb,                         -- {"S":1,"M":1,"L":1,"XL":1}
  budget_paise bigint,                      -- per unit; null = no limit
  deadline date,
  delivery_city text,
  material_supplied boolean,                -- job work: buyer gives fabric/cut panels
  status text not null default 'draft' check (status in ('draft','searching','matched','rfq_sent','ordered','closed')),
  source_conversation_id text
);

create table matches (
  id uuid primary key,
  requirement_id uuid references requirements(id) on delete cascade,
  kind text not null check (kind in ('single','combo','made_to_order')),
  rank int not null,
  score real not null,
  lines jsonb not null,                     -- [{"listing_id","business_id","qty","unit_price_paise","ready_by"}]
  blended_price_paise bigint not null,
  est_total_paise bigint not null,
  est_freight_paise bigint,
  ready_by date
);

-- ─── Conversations (mirror of Nexconn conversations + our metadata) ─────
create table conversations (
  id uuid primary key,
  chat_type text not null check (chat_type in ('direct','group')),
  chat_target_id text not null,             -- Nexconn target id (peer user id or group id)
  purpose text not null check (purpose in ('claire','deal','combo','partner','support')),
  requirement_id uuid references requirements(id),
  order_id uuid,
  participant_business_ids uuid[] not null,
  human_takeover_agent_id uuid,             -- non-null → Claire auto-replies paused
  last_seller_reply_at timestamptz,
  last_buyer_message_at timestamptz
);

-- Claire's per-user dialogue state (one row per user)
create table claire_sessions (
  user_id uuid primary key references users(id),
  intent text,
  slots jsonb not null default '{}',
  step text,                                -- 'category' | 'style' | 'quantity' | 'budget' | 'timing' | 'results' | ...
  draft_requirement_id uuid,
  fail_count int not null default 0,
  updated_at timestamptz default now()
);

-- Translation / transcript cache per message
create table message_meta (
  chat_msg_uid text primary key,            -- Nexconn message UID
  conversation_id uuid references conversations(id),
  sender_user_id uuid references users(id),
  source_lang text,
  transcript text,                          -- voice → text in source_lang
  translations jsonb default '{}',          -- {"ta": "...", "hi": "..."}
  tts_urls jsonb default '{}',              -- {"ta": "https://.../ta.mp3"}
  extracted jsonb,                          -- numbers/prices detected (for "make this a counter-offer")
  auto_reply boolean default false
);

-- ─── Deals ────────────────────────────────────────────────
create table offers (
  id uuid primary key,
  conversation_id uuid references conversations(id),
  requirement_id uuid references requirements(id),
  from_business_id uuid references businesses(id),
  to_business_id uuid references businesses(id),
  listing_id uuid references listings(id),
  qty numeric(12,2) not null,
  unit_price_paise bigint not null,
  dispatch_days int,
  advance_pct int default 0,
  credit_days int default 0,
  freight text check (freight in ('paid','to_pay','extra')),
  parent_offer_id uuid references offers(id),  -- counter-offer chain
  status text not null default 'pending' check (status in ('pending','countered','accepted','declined','expired')),
  created_by text not null default 'user' check (created_by in ('user','claire_auto'))
);

create table orders (
  id uuid primary key,
  code text unique not null,                -- human-readable: CC-24-00123
  kind text not null check (kind in ('purchase','sample','job_work')),
  parent_order_id uuid references orders(id),  -- combo / job-work split group
  offer_id uuid references offers(id),
  buyer_business_id uuid references businesses(id),
  seller_business_id uuid references businesses(id),
  listing_id uuid references listings(id),
  qty numeric(12,2) not null,
  unit_price_paise bigint not null,
  total_paise bigint not null,
  advance_pct int default 0,
  credit_days int default 0,
  status text not null check (status in
    ('confirmed','advance_paid','in_production','dispatched','delivered','balance_paid','closed','cancelled','disputed')),
  qty_done numeric(12,2) default 0,         -- job-work progress
  qty_rejected numeric(12,2) default 0,
  dispatch jsonb,                           -- {"transporter":"KPN","lr_no":"55821","bundles":12,"photo":"..."}
  delivered_at timestamptz,
  balance_due_at timestamptz,
  conversation_id uuid references conversations(id)
);

create table order_events (
  id uuid primary key,
  order_id uuid references orders(id) on delete cascade,
  type text not null,                       -- status change, progress, note
  payload jsonb,
  actor_user_id uuid references users(id)
);

create table payments (
  id uuid primary key,
  order_id uuid references orders(id),
  kind text not null check (kind in ('advance','balance','sample','job_work')),
  amount_paise bigint not null,
  method text,                              -- upi | neft | cash | razorpay_test
  reference text,
  proof_url text,
  due_at timestamptz,
  recorded_by_payer_at timestamptz,
  confirmed_by_payee_at timestamptz
);

-- ─── Trust ────────────────────────────────────────────────
create table ratings (
  id uuid primary key,
  order_id uuid references orders(id),
  rater_business_id uuid references businesses(id),
  ratee_business_id uuid references businesses(id),
  direction text not null check (direction in ('buyer_to_seller','seller_to_buyer')),
  scores jsonb not null,                    -- {"quality":5,"value":4,"on_time":5,"communication":4} | {"paid_on_time":5,"clarity":4,"fair_returns":5}
  would_repeat boolean,
  comment_text text, comment_audio_url text,
  revealed_at timestamptz                   -- set when both rated or after 7 days
);

create table trust_scores (
  business_id uuid primary key references businesses(id),
  score int not null,
  components jsonb not null,                -- {"verification":12,"ratings":31,"reliability":21,"responsiveness":7,"disputes":5}
  badges text[] not null default '{}',
  median_reply_minutes int,
  updated_at timestamptz default now()
);

create table vouches (                      -- "Vouched by" references
  id uuid primary key,
  voucher_business_id uuid references businesses(id),
  vouched_business_id uuid references businesses(id),
  note text,                                -- "Traded for 3 years"
  weight real not null default 1,           -- reduced if voucher later loses a dispute against vouched party
  unique (voucher_business_id, vouched_business_id)
);

create table partnerships (
  id uuid primary key,
  buyer_business_id uuid references businesses(id),
  seller_business_id uuid references businesses(id),
  status text not null default 'proposed' check (status in ('proposed','active','ended')),
  price_list jsonb,                         -- [{"listing_id","price_paise","valid_till"}]
  credit_days int default 0,
  conversation_id uuid references conversations(id),
  unique (buyer_business_id, seller_business_id)
);

-- ─── Trade Desk ───────────────────────────────────────────
create table agents (
  user_id uuid primary key references users(id),
  languages text[] not null,
  skills text[] not null,                   -- help, dispute, quality_dispute, payment_followup, concierge, onboarding_assist, verification_visit, seller_nudge
  region text,
  max_concurrent int not null default 5,
  status text not null default 'offline' check (status in ('online','busy','offline')),
  last_assigned_at timestamptz
);

create table tickets (
  id uuid primary key,
  code text unique not null,                -- TD-00042
  type text not null,
  priority text not null check (priority in ('P1','P2','P3')),
  status text not null default 'new' check (status in ('new','assigned','in_progress','waiting_user','resolved')),
  language_needed text[] not null,
  region text,
  business_ids uuid[] not null,
  order_id uuid references orders(id),
  conversation_id uuid references conversations(id),
  trigger text not null,                    -- user_request | nlu_fail | sentiment | overdue | problem_report | high_value | ...
  ai_summary jsonb,                         -- {"en": "...", "ta": "...", "hi": "..."}
  suggested_next_step text,
  assigned_agent_id uuid references agents(user_id),
  sla_due_at timestamptz not null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  resolution jsonb                          -- {"outcome":"partial_payment","note":"...","trust_adjustments":[...]}
);
```

---

## 6. REST API (backend)

All endpoints under `/api`, JSON, auth via our own JWT (issued at OTP verify). Every response that represents a chat side-effect also **sends the corresponding chat message through Nexconn**, so the UI is driven by chat events, not by polling.

### Auth & onboarding
| Method | Path | Body → Result |
|--------|------|---------------|
| POST | `/auth/otp/send` | `{phone}` → `{ok}` (demo: fixed OTP `123456`) |
| POST | `/auth/otp/verify` | `{phone, otp}` → `{jwt, user, chatToken, appKey}` — registers user with Nexconn on first login |
| POST | `/onboarding/language` | `{language}` or audio → `{language}` |
| POST | `/onboarding/turn` | multipart `audio` (webm/opus) or `{text}` → `{transcript, profileDraft, nextQuestion: {text, ttsUrl}, done}` |
| POST | `/onboarding/complete` | `{profileDraft}` → `{business, trust}` |
| POST | `/catalog/from-photos` | multipart `images[]` → `{drafts: ListingDraft[]}` (vision) |
| POST | `/catalog/apply-voice` | `{draftIds, audio|text}` → `{drafts}` (price/MOQ/sizes applied) |
| POST | `/catalog/publish` | `{drafts}` → `{listings, storefrontUrl}` |

### Claire
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/claire/action` | Chip / card button pressed: `{action, payload, conversationId}`. Server advances the state machine and replies through Nexconn as Claire. |
| POST | `/webhooks/chat` | Nexconn message callback (all messages). Routes: messages to Claire → orchestrator; deal-chat messages → translation, price detection, auto-reply timer, sentiment check. **Must verify the webhook signature.** |

### Catalog, matching, storefront
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/listings?category=&q=&business=` | Browse |
| PATCH | `/listings/:id` | Edit price / stock / capacity |
| GET | `/businesses/:id` | Storefront data (listings, trust, badges, reviews) |
| GET | `/public/s/:slug` | Public storefront (no auth, SEO, OG image) |
| POST | `/requirements` | Create from slots |
| POST | `/requirements/:id/match` | Run matcher → `{singles, combos, madeToOrder, marketBand}` |
| POST | `/requirements/:id/rfq` | Broadcast to top N sellers → opens N deal chats with a requirement card |
| POST | `/search/photo` | Image → similar listings (vision tags + attribute match; embeddings optional) |

### Deals & orders
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/conversations/deal` | `{sellerBusinessId, requirementId?, listingId?}` → opens/returns the 1-on-1 chat and posts the Requirement card |
| POST | `/conversations/combo` | `{matchId}` → creates group chat, posts allocation cards |
| POST | `/offers` | Create offer (seller quote or buyer counter) |
| POST | `/offers/:id/accept` · `/counter` · `/decline` | Negotiation; accept creates order(s) |
| POST | `/samples` | Sample request → order kind `sample` |
| POST | `/volume-requests` | "Can you make N more by date" |
| POST | `/orders/:id/events` | `{type: advance_paid|in_production|progress|dispatched|delivered|balance_paid|problem, payload}` |
| POST | `/orders/:id/payments` | Record payment (payer) / confirm (payee) |
| POST | `/orders/:id/reorder` | Clone into requirement + offer |
| POST | `/ratings` | Submit rating |
| GET | `/trust/:businessId` | Score + breakdown + badges |
| POST | `/partnerships` · PATCH `/partnerships/:id` | Propose / accept / update price list |

### Voice & translation
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/voice/transcribe` | audio → `{text, lang}` |
| POST | `/voice/tts` | `{text, lang}` → `{url}` (cached in object storage) |
| POST | `/translate` | `{text, from?, to[]}` → `{translations}` (glossary-protected) |

### Trade Desk
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/desk/tickets?status=&lang=` | Queue |
| POST | `/desk/tickets` | Manual create (also created internally by triggers) |
| POST | `/desk/tickets/:id/accept` · `/join` · `/resolve` | Agent actions; `join` adds the agent to the deal conversation and sets `human_takeover_agent_id` |
| POST | `/desk/tickets/:id/call` | `{target: buyer|seller}` → starts in-app call |
| POST | `/desk/agents/me/status` | online / busy / offline |
| GET | `/desk/supervisor` | Load, SLA breaches, language coverage |

---

## 7. Chat message types

All rich UI in chats is a **custom message** whose `content` is JSON. The client registers one renderer per type. Payloads carry **data, not display strings** (except free text), so each side renders labels in its own language.

| Type id | Sent by | Payload (abridged) | Buttons → action |
|---------|---------|--------------------|------------------|
| `CC:Chips` | Claire | `{prompt:{i18nKey,vars}, chips:[{id,labelKey,value}], allowVoice:true}` | tap → `claire.chip` |
| `CC:CategoryTiles` | Claire | `{tiles:[{categoryId,image}]}` | `claire.category` |
| `CC:CatalogCarousel` | Claire / seller | `{listings:[{id,image,titleI18n,priceRange,businessName}], likeable:true}` | `claire.like`, `claire.done`, `listing.open` |
| `CC:ProductCard` | seller | `{listingId,image,title,price,unit,moq,stock}` | `listing.open`, `deal.askAbout` |
| `CC:RequirementCard` | buyer (via Claire) | `{requirementId,category,attrs,qty,unit,budget,deadline,city}` | seller: `offer.quote`, `deal.sendCatalog`, `deal.decline`, `deal.letClaire` |
| `CC:MatchResults` | Claire | `{requirementId, singles[], combos[], madeToOrder[], marketBand}` | `storefront.open`, `deal.open`, `sample.request`, `combo.open`, `rfq.send` |
| `CC:OfferCard` | either | `{offerId,parentOfferId,qty,unitPrice,dispatchDays,advancePct,creditDays,freight,status}` | `offer.accept`, `offer.counter`, `offer.decline` |
| `CC:OrderCard` | system | `{orderId,code,status,timeline[],amounts,dispatch}` | `order.markPaid`, `order.confirmPayment`, `order.dispatch`, `order.delivered`, `order.problem` |
| `CC:SampleCard` | buyer | `{orderId,sizes,colours,samplePrice,courierCharge,address,tracking}` | `sample.accept`, `sample.received`, `sample.approve`, `sample.changes` |
| `CC:VolumeRequest` | buyer | `{qty,byDate}` → reply `CC:CapacityReply {lines:[{qty,byDate}]}` | `volume.reply`, `volume.toOffer` |
| `CC:JobWorkOffer` | garment owner | `{orderId?,service,garment,qty,rate,deadline,materialSupplied,styleImage}` | `job.accept`, `job.counter`, `job.decline` |
| `CC:Progress` | job worker | `{orderId,qtyDone,qtyTotal}` | — |
| `CC:RatingPrompt` | system | `{orderId,direction,questions[]}` | `rating.submit` |
| `CC:QuoteCompare` | Claire | `{requirementId,quotes:[{businessId,offerId,price,dispatchDays,trust}]}` | `offer.accept`, `deal.open` |
| `CC:PrivateHint` | Claire (targeted to one user) | `{textKey,vars}` | — |
| `CC:AgentJoined` | system | `{agentName,languages,ticketCode}` | — |
| `CC:ProfileCard` | Claire | `{business draft}` | `onboarding.confirm`, `onboarding.fix` |
| `CC:Voice` | any user | `{audioUrl, durationMs, lang, transcript}` | ▶ original · ▶ listen in my language · show transcript |
| `CC:ChipReply` | any user (chip tap) | `{chipId, value, label}` | — (rendered as the user's bubble) |
| `CC:AutoReply` | Claire on behalf of a seller | `{onBehalfOf: businessId, text, lang, cards[]}` | buyer sees "Auto-reply by Claire for Sree Textiles" |

Registration (client, before `connect`): every `CC:*` type with `isPersited: true`; `isCounted: true` for everything except `CC:PrivateHint`, `CC:Progress` and `CC:ChipReply`. Plain text stays `RC:TxtMsg` so built-in `translateMessages` works on it directly. Every user-authored message carries its author's language: the client sends `RC:TxtMsg` as usual, and the language is known from the sender's profile (cached in the client from `/api/businesses/:id`), so receivers translate with `'auto'` or the known source.

Order cards change state many times. The server posts a fresh `CC:OrderCard` on each change and the client renders **only the newest card per `orderId`** (older ones collapse into a one-line history), which avoids depending on message editing for server-sent messages.

---

## 8. Claire orchestrator (server)

```
Nexconn webhook ─► router
                    ├─ to Claire bot? ───────────► ClaireOrchestrator.handle(user, msg)
                    ├─ deal / combo chat? ───────► DealPipeline.handle(msg)
                    └─ support chat? ────────────► DeskPipeline.handle(msg)

ClaireOrchestrator.handle(user, msg):
  text  = msg.voice ? stt(msg.audioUrl, user.language) : msg.text
  sess  = load claire_sessions[user]
  nlu   = extract(text, sess)                       // Claude, structured output (schema below)
  if nlu.intent == TALK_TO_HUMAN or sess.fail_count >= 2 → createTicket(...) ; return
  sess  = mergeSlots(sess, nlu)                     // new values override; corrections handled
  next  = FlowRegistry[sess.intent].nextStep(sess)  // pure function: returns the step + message spec
  for m in next.messages: nexconn.sendAs('claire', user, m)   // CC:* cards, localised
  save sess

DealPipeline.handle(msg):
  1. (translation happens in each receiver's client via Nexconn built-in translation — §10.2;
     the server only records message_meta and serves the /api/translate fallback)
  2. voice notes arrive already transcribed (CC:Voice); tts generated lazily when a receiver taps ▶
  3. detect price/qty in text → CC:PrivateHint "make this an offer?" to sender
  4. if sender is buyer and seller.auto_reply_mode != off and no human takeover:
        schedule AutoReplyJob(conversation, delay = seller.auto_reply_delay_sec)
        (cancel the job if the seller replies first)
  5. sentiment/keyword check → maybe createTicket(type='dispute')
  6. update last_*_at for responsiveness metrics
```

**Flows are pure functions** (`nextStep(session) → {step, messages[]}`) so they are unit-testable without chat or AI.

```ts
// flows/buyProduct.ts (sketch)
export const buyProduct: Flow = {
  required: ['category', 'quantity', 'budget'],
  order: ['category', 'style', 'quantity', 'budget', 'timing'],
  nextStep(s) {
    if (!s.slots.category) return ask('category', categoryTiles(s.user));
    if (s.slots.style === undefined && !s.skipped.includes('style'))
      return ask('style', catalogCarousel(s.slots.category, s.slots.attrs));
    if (!s.slots.quantity) return ask('quantity', quantityChips(s.slots.category));
    if (s.slots.budget === undefined) return ask('budget', budgetChips(marketBand(s.slots)));
    if (!s.slots.deadline && !s.skipped.includes('timing')) return ask('timing', timingChips(s.user.city));
    return { step: 'results', messages: [summaryCard(s), matchResults(runMatcher(s))] };
  },
};
```

---

## 9. AI layer (Claude)

### 9.1 Where AI is used

| Use | Input | Output | Notes |
|-----|-------|--------|-------|
| Intent + slot extraction | transcript text, current step, current slots, user language | `NluResult` (structured output) | every Claire turn |
| Onboarding profile extraction | transcript turns | `ProfileDraft` | live profile card |
| Catalog from photos | 1–20 images | `ListingDraft[]` | vision; group near-duplicate angles of the same product |
| Voice price/MOQ parse | "all 180, minimum 500, M to XXL" | `{rules[]}` | applied per category |
| Auto-reply drafting | buyer message + seller catalog/stock/rules + last 10 messages | `{reply, cards[], proposedOffer?}` | grounded only on provided data; floor-price check in code |
| Translation (fallback / glossary) | text, from, to[] | translations | used only if Nexconn translation is unavailable for a language pair |
| Ticket triage + summary | conversation + order timeline | `{type, priority, summary{lang}, suggestedNextStep}` | in agent's language |
| Agent whisper | ticket + last messages | 3 suggested replies | |
| Call summary | call transcript (stretch) | bullet summary in both languages | |

### 9.2 Model and call settings

- Model: **`claude-opus-5-5`** for every call above, via the official `@anthropic-ai/sdk` (TypeScript).
- Latency-sensitive routes (extraction, translation fallback, whisper): `output_config: { effort: "low" }`. Vision cataloguing, auto-reply, triage: `effort: "medium"`.
- Structured outputs with Zod: `client.messages.parse({ ..., output_config: { format: zodOutputFormat(Schema) } })` and read `response.parsed_output`. Always check `stop_reason` (handle `"refusal"`), and treat `parsed_output === null` as an extraction failure (counts toward `fail_count`).
- Refusal fallback: add `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"` (beta Messages endpoint) so a policy decline is retried on a fallback model in the same call.
- Prompt caching: keep the system prompt + category taxonomy + glossary as a frozen prefix with `cache_control` so per-turn cost is mostly the user's sentence.
- Never put API keys in the client; all AI calls go through the backend.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const NluResult = z.object({
  intent: z.enum(["BUY_PRODUCT","FIND_SERVICE","FIND_WORK","ADD_LISTING","UPDATE_STOCK","ORDER_STATUS",
                  "REORDER","PROGRESS_UPDATE","PAYMENT_UPDATE","TALK_TO_HUMAN","SMALLTALK","UNKNOWN"]),
  confidence: z.number(),
  slots: z.object({
    category_id: z.string().nullable(),         // must be one of the provided taxonomy ids
    attrs: z.object({
      fabric: z.string().nullable(), gsm: z.number().nullable(),
      colours: z.array(z.string()), print: z.string().nullable(), fit: z.string().nullable(),
      sizes: z.array(z.string()),
    }),
    quantity: z.number().nullable(),
    unit: z.enum(["piece","kg","meter","roll"]).nullable(),
    budget_per_unit_inr: z.number().nullable(),
    no_budget_limit: z.boolean(),
    deadline_days: z.number().nullable(),
    delivery_city: z.string().nullable(),
    service_rate_inr: z.number().nullable(),
    material_supplied: z.boolean().nullable(),
  }),
  corrections: z.array(z.string()),            // slot names the user explicitly corrected
  sentiment: z.enum(["positive","neutral","negative","angry"]),
});

const client = new Anthropic();
const res = await client.messages.parse({
  model: "claude-opus-5-5",
  max_tokens: 2048,
  output_config: { effort: "low", format: zodOutputFormat(NluResult) },
  system: [{ type: "text", text: CLAIRE_NLU_SYSTEM /* taxonomy + glossary + rules */, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: JSON.stringify({ step, slots, language, utterance }) }],
});
```

**Vision cataloguing call (sketch):** send up to 20 `{type:"image", source:{type:"url", url}}` blocks + instructions; output `ListingDraft[] = {imageIndexes[], category_id, attrs, title{en,ta,hi}, confidence}`. Images are uploaded to object storage first; the URLs are signed and short-lived.

### 9.3 Guardrails

- The extractor may only output `category_id`s from the taxonomy passed in the prompt; anything else → null → Claire asks.
- **Numbers are verified in code:** before a quote or order is sent, the parsed number is echoed back in a summary card the user must confirm.
- Auto-reply prompt receives only that seller's data. Code (not the model) enforces `floor_price_paise`, refuses credit terms and order acceptance.
- PII: phone numbers and GSTIN never go into prompts unless needed (GST certificate OCR); logs redact them.

---

## 10. Voice and translation pipeline

### 10.1 Speech-to-text and text-to-speech

Nexconn has no public speech API, so voice goes through our server.

| Need | Primary | Fallback |
|------|---------|----------|
| Speech-to-text (voice notes, Claire voice turns) | **Sarvam AI** STT — Indian languages incl. ta, hi, te, kn, ml, bn, or, mr, gu, pa, en; copes with code-mixed speech | Google Cloud Speech-to-Text; for live captions only, browser `webkitSpeechRecognition` (`ta-IN`, `hi-IN`) |
| Language detection from voice (onboarding "just speak") | Sarvam STT with auto language detection | Ask with language tiles |
| Text-to-speech (Claire speaks; "Listen in Tamil") | **Sarvam AI** TTS (Indian voices) | Browser `speechSynthesis` (voice availability varies per phone) |

Check Sarvam's current model names and limits in their docs on day 0 (they version models frequently). Keep the STT/TTS behind one interface (`voice/provider.ts`) so the provider can be switched in one file.

- Recording: `MediaRecorder` → `audio/webm;codecs=opus` (Chrome/Android) or `audio/mp4` (iOS Safari); max 60 s; show a live waveform and a "slide to cancel".
- Upload → server stores the original in Supabase Storage (`voice/{conversation}/{uuid}.webm`) and returns a signed URL valid for 7 days.
- STT result cached in `message_meta`; TTS output cached per `(text hash, lang)` so replays cost nothing.
- Target latency: transcript visible ≤ 3 s after release for a 10 s note. Show an optimistic "Transcribing…" bubble immediately.

### 10.2 Translation

**Primary: Nexconn built-in translation (client, receiver side).**
1. On `onMessageReceived` (or when a chat opens with history), collect untranslated text messages and `CC:Voice` transcripts whose `srcLang ≠ myLang`.
2. Mask protected tokens (see 10.3), batch ≤ 10 per call: `translateMessages` for text messages, `translateTexts` for transcripts and free-text card fields.
3. `TranslateHandler.onTranslationCompleted` → unmask → store in an IndexedDB cache keyed `(messageUid, lang)` → render.
4. User-level preference saved with `setTranslationLanguage(myLang)` and `setAutoTranslateEnabled(true)`; per-chat "Translate: on/off" uses `setTranslateStrategy` (the SDK only stores the strategy; our code does the translating).

**Fallback: server `/api/translate` (Claude)** when a placeholder comes back damaged, the language pair fails, or the Nexconn quota is exhausted. The fallback is also used for Claire's own outgoing messages, which are generated directly in the user's language.

### 10.3 Protecting numbers and trade terms

```
"Bhaiya 165 mein de do, 1000 piece, 240 GSM black"
   ↓ mask
"Bhaiya ⟦0⟧ mein de do, ⟦1⟧ piece, ⟦2⟧ black"      tokens: [ "₹165"?, "1000", "240 GSM" ]
   ↓ translate (hi → ta)
"அண்ணா ⟦0⟧க்கு கொடுங்க, ⟦1⟧ பீஸ், ⟦2⟧ கருப்பு"
   ↓ unmask + verify all ⟦n⟧ present (else fallback)
"அண்ணா 165க்கு கொடுங்க, 1000 பீஸ், 240 GSM கருப்பு"
```

Protected: integers/decimals with optional ₹ / Rs / units (pcs, kg, dozen, set, GSM, %), sizes (S, M, L, XL, XXL, 2XL…), yarn counts (30s, 40s), and glossary terms (`packages/shared/glossary.json`: GSM, combed, carded, compacting, interlock, rib, fleece, lycra, kora, loopknit, job work, MOQ, LR, to-pay, set).

### 10.4 Cost guardrails
- Nexconn translation: 10,000 free characters, then $0.02 per 1,000 (needs a card). 5,000 messages × 60 chars ≈ 300,000 chars ≈ $6. Cache, never re-translate on scroll, and don't translate messages the user wrote.
- Sarvam/Claude: log per-request usage to a `usage_log` table; `/stats` shows totals so we notice runaway costs during the traction push.

---

## 11. Trade Desk dispatcher (server)

```ts
async function dispatch(ticket: Ticket) {
  const agents = await db.agents.findOnline();
  const langOK  = (a: Agent) => ticket.language_needed.every(l => a.languages.includes(l));
  const anyLang = (a: Agent) => ticket.language_needed.some(l => a.languages.includes(l));
  const free    = (a: Agent) => a.currentLoad < a.max_concurrent && a.skills.includes(ticket.type);

  const pick = (pool: Agent[]) =>
    pool.filter(free).sort((x, y) =>
      x.currentLoad - y.currentLoad ||
      +(x.last_assigned_at ?? 0) - +(y.last_assigned_at ?? 0))[0];

  const agent = pick(agents.filter(langOK)) ?? pick(agents.filter(anyLang)) ?? pick(agents);
  if (!agent) return queueWithSla(ticket);                 // user sees "we'll reply within N min"
  await assign(ticket, agent, { autoTranslate: !langOK(agent) });
  notifyAgent(agent, ticket);                              // console toast + sound
}

// cron every 30 s
for (const t of await db.tickets.breachingSla()) { await redispatch(t); alertSupervisor(t); }
```

Ticket triggers are emitted from: `ClaireOrchestrator` (TALK_TO_HUMAN, fail_count), `DealPipeline` (sentiment), order scheduler (overdue, high value), problem reports and onboarding.

---

## 12. Security, privacy, abuse

- Webhook signature verification; reject unsigned callbacks.
- Chat tokens are issued per user by the backend; app secret never reaches the client.
- Floor prices, partner price lists and private hints are only sent as targeted messages / API responses to their owner.
- Rate-limit RFQ broadcasts (max 3 per buyer per day in MVP) to stop spam.
- Phone numbers hidden between businesses until an order is confirmed (calls go through in-app calling).
- Seed data and demo accounts are clearly fake; no real business data without consent (pilot partners only with permission).

---

## 13. Repository layout

```
claire-connect/
├── apps/
│   ├── web/                 # React + Vite PWA (buyer/seller app) + /desk console
│   │   ├── src/chat/        # Nexconn client wrapper, message renderers (CC:* cards)
│   │   ├── src/claire/      # Claire chat screen, chips, mic, live profile
│   │   ├── src/storefront/  # in-app + public storefront
│   │   ├── src/desk/        # Trade Desk console
│   │   └── src/i18n/        # UI strings: en, ta, hi (+ others)
│   └── server/              # Node + Fastify
│       ├── src/nexconn/     # server API client, webhook verify, sendAs()
│       ├── src/claire/      # orchestrator, flows/*, nlu.ts
│       ├── src/ai/          # claude client, prompts/, schemas/
│       ├── src/voice/       # stt, tts, translate (+ glossary)
│       ├── src/match/       # matcher, combo builder, market band
│       ├── src/trust/       # score, badges
│       ├── src/desk/        # tickets, dispatcher, sla cron
│       └── src/db/          # schema, migrations, seed/
├── packages/shared/         # types, CC:* payload schemas (zod), i18n keys
└── docs/                    # this plan
```
