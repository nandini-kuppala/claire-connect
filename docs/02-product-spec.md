# 02 · Product Spec — CLAIRE Connect

> Voice-first, multilingual trade chat for the whole Tiruppur supply chain.
> Every business can buy and sell. Claire (the AI) does the typing, translating and matching. A human Trade Desk is one tap away.

This document defines **what** we build and **how each flow behaves, step by step**. The technical "how" is in `03-technical-design.md`; the schedule is in `04-build-plan.md`.

---

## 1. Product principles

These are the rules every screen and every Claire message must follow. When a design decision is unclear, check it against this list.

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| P1 | **Chat is the app** | The home screen is an inbox, like WhatsApp. Claire is a pinned contact. Search, ordering, quotes and support all happen inside conversations as tappable cards. No multi-field forms anywhere. |
| P2 | **Speak, don't type** | A large mic button is on every screen. Every question Claire asks can be answered by voice. Voice notes between users are transcribed, translated and can be played back in the listener's language. |
| P3 | **Everyone in their own language** | Each user has one language. Every message, card and voice note reaches them in that language. The original is one tap away. Trade terms (GSM, combed, interlock, MOQ, job work) are never mistranslated. |
| P4 | **One business, both sides** | Nobody chooses "buyer" or "seller" at signup. A business says what it makes, what it sells and what it buys. Lakshmi buys fabric and sells stitching; Ravi buys stitching and sells finished garments. The role comes from the action. |
| P5 | **One question at a time, with answers ready** | Claire asks one thing per message and always offers 3–5 answer chips plus the mic. If a single sentence answers three questions, Claire skips those three questions. |
| P6 | **Show, don't describe** | Photos before text. Catalogs are image carousels. Results are cards with a photo, a price and one number that matters. |
| P7 | **Trust is visible and two-way** | Sellers are rated by buyers, buyers are rated by sellers. Payment and delivery punctuality are measured from records, not only from opinions. Badges show on every card. |
| P8 | **A human is always one tap away** | "Talk to a person" is on every Claire message menu. Escalations route to a Trade Desk agent who speaks the user's language. |
| P9 | **Meet them where they are** | WhatsApp is the acquisition channel, not the enemy. Sellers share their storefront link on WhatsApp; buyers who tap it land in a chat with that seller. |

---

## 2. Who uses it — supply-chain roles and personas

### 2.1 The chain we model

```
Yarn ──► Knitting ──► Dyeing / processing ──► Printing / embroidery ──► Cutting & stitching ──► Garment owner / brand ──► Wholesaler ──► Reseller / retailer
(per kg)   (per kg)        (per kg)                 (per piece)              (per piece, job work)      (per piece)          (per piece)     (per piece)
```

Every node is a **Business** on CLAIRE Connect. Each business has:

- **Sells** — products (garments, fabric, yarn, trims) and/or services (knitting, dyeing, printing, embroidery, stitching job work).
- **Buys** — the same taxonomy, from the other side.
- **Capacity** — stock on hand (products) or free capacity per day/week (services).

### 2.2 Personas used throughout the spec and the demo

| Persona | Business | Language | Sells | Buys | Main job on CLAIRE |
|---------|----------|----------|-------|------|--------------------|
| **Senthil** | Senthil Yarn Agency, Tiruppur | Tamil | Cotton yarn 20s–40s combed (per kg) | — | Get enquiries from knitting units without phone calls |
| **Lakshmi** | Lakshmi Garments, 20-machine stitching unit, Tiruppur | Tamil | Plain stitched garments; stitching job work (per piece) | Knitted fabric, thread, elastic | Find fabric sellers; fill idle machines with job work; sell plain stock |
| **Ravi** | Ravi Knit Fashions (garment owner/brand), Tiruppur | Tamil, some English | Printed/branded track pants & T-shirts | Plain garments, stitching job work, printing | Split a 5,000-piece job across several units; sell to wholesalers and resellers |
| **Sadhasivam** | SS Garments, wholesaler, Khaderpet | Tamil | Assorted knitwear from many makers | Finished garments from makers | Respond fast to many buyers without living on WhatsApp |
| **Amit** | Amit Hosiery, reseller, Kolkata | Hindi (also Bengali) | — (sells offline to shops) | Track pants, T-shirts, innerwear from several wholesalers | Find reliable sellers at his price; get samples; reorder |
| **Meena** | CLAIRE Trade Desk agent, Tiruppur | Tamil, Hindi, English | — | — | Resolve disputes, help onboarding, chase payments, verify units |

### 2.3 Category taxonomy (seed)

| Group | Categories | Unit | Listing type |
|-------|-----------|------|--------------|
| Finished garments | T-shirts (round neck, polo, V-neck), track pants / joggers, shorts, innerwear (briefs, vests, trunks), nightwear, kidswear sets, leggings, sweatshirts / hoodies, sportswear | piece | product |
| Fabric | Single jersey, interlock, rib, fleece, loopknit, lycra jersey, pique | kg | product |
| Yarn | Cotton combed / carded (20s, 24s, 30s, 34s, 40s), polyester, cotton-lycra, melange | kg | product |
| Trims & packing | Elastic, thread, labels, tags, poly bags, cartons | piece / kg / roll | product |
| Services | Knitting, dyeing & bleaching, compacting, screen printing, DTF / sublimation printing, embroidery, cutting, stitching job work, checking & packing | kg or piece | service |

---

## 3. App map

```
CLAIRE Connect (mobile PWA)
├── Inbox (home)
│   ├── 📌 Claire  — AI assistant chat (sourcing, listing, orders, help)
│   ├── Deal chats — 1-on-1 with each buyer / seller (translated)
│   ├── Combo chats — group chat for a multi-seller order (buyer + sellers + Claire)
│   └── Trade Desk — support chat with a human agent (appears only when opened)
├── Discover — category tiles, trending, saved sellers, "photo search"
├── Orders — active / samples / job work / completed  (each opens its chat)
├── My business — profile, catalog, capacity, trust score, partners, auto-reply settings
└── (floating) 🎤 Talk — hold to speak to Claire from anywhere

Public web (no login)
└── claire.app/s/{seller-slug} — storefront page shared on WhatsApp; "Chat with seller" deep-links into the app

Trade Desk console (desktop web, agents only)
├── Queue — tickets by priority, language, SLA timer
├── Ticket workspace — AI summary, translated conversation, order timeline, call button
└── Supervisor — agent load, SLA breaches, language coverage
```

**Bottom navigation:** Inbox · Discover · 🎤 · Orders · Me. The mic sits in the centre and is the biggest target on screen.

---

## 4. Onboarding — "under 2 minutes, zero typing"

### 4.1 Goals

- No role selection, no forms. Profile is built from one spoken conversation.
- Language is chosen once, by tapping its script or simply by speaking.
- A seller leaves onboarding with a live catalog made from photos they already have on WhatsApp.
- A buyer leaves onboarding with a first set of matching sellers on screen.

### 4.2 Entry points

1. **Invite link** — a seller already on CLAIRE shares their storefront on WhatsApp; a buyer taps "Chat with seller" → onboarding starts with that seller pre-attached (the first chat is ready the moment onboarding ends).
2. **QR at markets** — Trade Desk field staff put QR standees at Khaderpet / Kamaraj Road shops; scanning opens onboarding with an `ref=field-agent-id` tag.
3. **"Call me" onboarding** — user taps "I need help, call me"; a Trade Desk ticket of type `onboarding_assist` is created and an agent calls in-app (Nexconn call) and fills the profile while talking.
4. **Direct install** of the PWA.

### 4.3 Step by step

| Step | Screen | What the user does | What the system does |
|------|--------|--------------------|----------------------|
| O1 | **Phone** | Types mobile number (the only typing in onboarding); OTP auto-reads on Android (WebOTP API) | Creates `user` + empty `business`; registers the user with Nexconn and returns a chat token |
| O2 | **Language** | Taps one big tile: தமிழ் · हिन्दी · English · తెలుగు · ಕನ್ನಡ · മലയാളം · বাংলা · ଓଡ଼ିଆ · मराठी · ગુજરાતી — or taps 🎤 "Just speak" | If spoken, language is detected from the audio. Sets `user.language`. All UI strings switch immediately. |
| O3 | **Talk to Claire** (voice interview) | Holds the mic and answers Claire's spoken questions (below). Can tap "Type instead". | Each turn: audio → speech-to-text → Claude extraction → **live profile card fills in on screen** while she speaks → Claire's next question is spoken back (TTS) |
| O4 | **Confirm** | Sees a profile card (name, business, what you sell, what you buy, location, capacity). Taps ✓ "Yes, correct" or says what to fix. | Saves business, capabilities, categories. Computes initial trust score (phone verified). |
| O5a | **Seller: add products** (if they sell anything) | Taps "Add photos" → multi-selects photos from gallery / WhatsApp Images folder, or uses Android "Share → CLAIRE" from WhatsApp. Then speaks one sentence: "All are 180 rupees, minimum 500, sizes M to XXL." | Vision model groups the photos into products, tags category, fabric guess, colours, print type, neck/fit, writes multilingual titles. The spoken sentence is parsed into price / MOQ / sizes and applied to the whole batch. Storefront link is generated. |
| O5b | **Buyer: first need** (if they buy anything) | Sees "Here's what Tiruppur has for you today" — matches for the categories they said they buy | Runs the matcher with category only; shows 6 top sellers. |
| O6 | **Inbox** | Lands on Inbox. Claire is pinned with a welcome card; if they came via an invite link, the seller's chat is already open. | Sends welcome card and a "Share your shop on WhatsApp" card (sellers). |

#### Claire's onboarding interview (O3)

Claire asks **at most 4 questions**, and skips any already answered. Example in Tamil, shown in English:

1. **"Vanakkam! What's your name and your business name?"**
   → `owner_name`, `business_name`
2. **"What does your business do? What do you make or sell, and what do you buy?"**
   → `sells[]`, `buys[]`, `services[]`, rough `capacity` ("20 machines", "5,000 pieces a week")
   e.g. *"I have a stitching unit with 20 machines, we do track pants and T-shirts job work, I also sell plain T-shirts, and I buy fabric."*
   → sells: stitching job work (track pants, T-shirts), plain T-shirts · buys: knitted fabric · capacity: 20 machines ≈ 1,200–1,500 pieces/day (estimate shown for confirmation)
3. **"Where is your unit or shop?"** — or tap "Use my location"
   → `city`, `area`, `geo`
4. **"Do you have a GST number? You can say it, show the certificate, or skip."**
   → `gstin` (validated by checksum; verified later) — skip is one tap and never blocks.

If the user stays silent for 8 s or Claire fails to understand twice, Claire offers: **"Shall someone from our team call you?"** → creates an `onboarding_assist` ticket (see §10).

### 4.4 Onboarding acceptance criteria

- A first-time seller can go from phone number to a live catalog of ≥ 5 products in **≤ 120 s** with **≤ 15 taps** and only the phone number typed.
- A first-time buyer sees matching sellers in **≤ 60 s**.
- Works fully in Tamil and Hindi in the demo; the other 8 languages work for text and UI strings.

---

## 5. Claire — the conversation design

### 5.1 Claire's voice

- Warm, short, respectful. Uses the right honorific per language ("-nga" in Tamil, "ji" in Hindi).
- Max **two short lines** of text per message, then cards / chips.
- Indian number formatting (1,00,000), ₹ prices with unit (/pc, /kg).
- **Never invents** a price, stock figure, rating or delivery date. Every number comes from the database or from the user.
- Confirms money and quantities in a summary card before anything is sent to another business.
- Every Claire message has a "⋯" menu with **Talk to a person** and **Start over**.

### 5.2 Claire's home message (what Claire shows when opened)

> **"Good morning Amit ji. What do you need today?"**
>
> [ 👕 Buy garments ] [ 🧵 Fabric · yarn · trims ] [ 🪡 Get work done ]
> [ 📷 Sell / add products ] [ 📦 My orders ] [ 🔁 Reorder last ]
>
> 🎤 *Or just tell me — "1000 track pants under 170, Kolkata, in 2 weeks"*

The tiles are re-ordered by what this business usually does (a reseller sees Buy first; a job worker sees "Find work" first).

### 5.3 Intents

| Intent | Triggered by | Flow |
|--------|-------------|------|
| `BUY_PRODUCT` | "Buy garments", "Fabric · yarn", any sentence with a product + quantity | §6 Journey J1 |
| `FIND_SERVICE` | "Get work done", "need stitching / printing / dyeing for N pieces" | J7 Job-work split |
| `FIND_WORK` | Job worker: "I have free machines", "need job work" | J7 (reverse — capacity post) |
| `ADD_LISTING` | "Sell / add products", photo shared to Claire | J2.1 |
| `UPDATE_STOCK` | "2,000 track pants ready", "machines free this week" | J2.3 |
| `ORDER_STATUS` | "Where is my order", "My orders" | J4 |
| `REORDER` | "Reorder last", "same as last time from Sree" | J6 |
| `PROGRESS_UPDATE` | Job worker: "600 done today" | J7.4 |
| `PAYMENT_UPDATE` | "Paid 50,000 by UPI", "payment received" | J4 |
| `TALK_TO_HUMAN` | "Talk to a person", 2 failed understandings, angry tone | J9 |
| `SMALLTALK / HELP` | Greetings, "what can you do" | Home message |

### 5.4 Slot filling — the core rule

Every user turn (voice or text) is sent to the extractor, which returns **all** slots it can find plus the intent. Claire then asks only for the **first missing required slot**, in this order:

| Order | Slot | Required? | Default if skipped | Answer chips |
|-------|------|-----------|--------------------|--------------|
| 1 | `category` | yes | — | Category tiles with photos |
| 2 | `style` (liked catalog items / reference photo) | no | "any style" | Catalog carousel with ❤, "Any style", "📷 Upload a photo" |
| 3 | `quantity` (+ `size_ratio`) | yes | — | 300 · 500 · 1,000 · 2,000 · 5,000+ ; size set line "Packed in sets M:L:XL:XXL = 2:2:2:1 ✓ change". Innerwear asks in **dozens / boxes**, fabric and yarn in **kg**. |
| 4 | `budget_per_unit` | yes (can be "no limit") | — | Three chips from the market band (p25, median, p75) + "No limit". Hint: *"Most sellers: ₹150–₹210"* |
| 5 | `deadline` + `delivery_city` | no | flexible · profile city | This week · 2 weeks · 1 month · Flexible · Change city |
| 6 | `sample_first` | no | ask later | — (offered on result cards) |

**How the trade actually counts quantity** (from research): outerwear is sold as **size sets** (one design × colour, e.g. M:L:XL:XXL = 2:2:2:1, or one of each size), innerwear by the **dozen / box**, inputs by the **kg**. Ready-stock sellers often set a **minimum order value** (₹5,000–₹10,000) instead of a piece MOQ. The listing model stores `size_set` and `min_order_value`, and Claire converts "1,000 pieces" into whole sets (e.g. 1,001 pcs = 143 sets of 7) and shows both numbers.

**Example of skipping:** Amit says *"1000 cotton track pant chahiye, 170 tak, Kolkata, do hafte mein"* → category, specs, quantity, budget, deadline and city are all filled → Claire jumps straight to **results**.

### 5.5 Conversation fallbacks

| Situation | Claire does |
|-----------|-------------|
| Could not understand (confidence < 0.5) | Re-asks the same question once with chips only: *"Sorry, I didn't catch that. Tap one:"* |
| Fails twice in a row | *"Let me connect you to Meena from our team — she speaks Hindi."* → `TALK_TO_HUMAN` |
| User changes topic mid-flow | New intent wins; old draft requirement saved as "Draft" and offered later (*"Continue your track pants search?"*) |
| User corrects a value ("no, 2000") | Update slot, show updated summary, rerun matching |
| Abusive / fraud keywords ("cheated", "not paid", "fake") | Flag sentiment, offer Trade Desk immediately |

---

## 6. User journeys

Each journey lists **trigger → steps → outcome**. The steps are written as the actual chat exchange so designers and developers build the same thing.

### J1 · Buyer sources a product (Amit needs 1,000 track pants)

**Trigger:** Amit opens Claire and taps *Buy garments* (or speaks).

| # | Claire / system | Amit |
|---|-----------------|------|
| 1 | "Namaste Amit ji. What do you need?" + category tiles | Taps **Track pants** (or says "track pant") |
| 2 | "Here are cotton track pants on CLAIRE. Tap ❤ on styles you like." — carousel of 10 photos from different sellers, each with price band | ❤ two styles → **Done** (or *Any style*, or 📷 upload a photo of a style he wants) |
| 3 | "How many pieces?" chips 300 · 500 · **1,000** · 2,000 · 5,000+ · *Sizes S-M-L-XL equal ✓* | Taps **1,000** |
| 4 | "Your budget per piece? Most sellers for this style: ₹150–₹210" chips ₹150 · **₹170** · ₹190 · No limit | Taps **₹170** |
| 5 | "When do you need it in Kolkata?" chips This week · **2 weeks** · 1 month · Flexible · Change city | Taps **2 weeks** |
| 6 | Summary card: *1,000 cotton track pants · ≤ ₹170/pc · Kolkata · by 2 Dec* — "Finding sellers…" | — |
| 7 | **Results** (see 6.1) | Taps a card → seller storefront |
| 8 | Storefront with actions: **Chat & negotiate · Request sample · Order now · Need more volume? · Save as partner** | Taps **Chat & negotiate** → J3 |

#### 6.1 Results card layout

```
┌───────────────────────────────────────────────┐
│ 1,000 cotton track pants · ≤ ₹170 · 2 weeks   │
├───────────────────────────────────────────────┤
│ READY FROM ONE SELLER                         │
│ [photo] Sree Textiles  ✓GST  Trust 86          │
│         ₹168/pc · 1,200 in stock · ships 3 d   │
│         ★4.6 quality · on-time dispatch 92%    │
│         Est. ₹1,68,000 + 5% GST + freight ~₹5,000 │
│         [Chat] [Sample] [View]                 │
├───────────────────────────────────────────────┤
│ COMBINE 2 SELLERS — same fabric & colours     │
│ Kavin Knits 600 × ₹165  +  RS Garments 400 × ₹172 │
│ Avg ₹167.8/pc · Est. ₹1,67,800 · ready in 5 d │
│         [View combo] [Request both samples]    │
├───────────────────────────────────────────────┤
│ CHEAPER IF MADE TO ORDER                      │
│ Anand Knitwear · ₹158/pc · ready in 12 d       │
├───────────────────────────────────────────────┤
│ [See all 7] [Change budget] [Ask all sellers for quotes] │
└───────────────────────────────────────────────┘
```

- **Ready from one seller** — sellers whose stock + producible quantity before the deadline ≥ requested quantity.
- **Combine 2–3 sellers** — shown when fewer than 2 single sellers qualify, or when a combo is ≥ 3% cheaper. Only sellers with matching specs (same category, fabric, GSM ± 10, overlapping colours) and similar trust tier are combined. Algorithm in §8.
- **Made to order** — sellers with capacity but no stock, usually cheaper and slower.
- **Ask all sellers for quotes** (RFQ broadcast) — sends the requirement card to the top 10 matching sellers at once; their quotes stack up in a **Quote comparison card** in Amit's Claire chat. This replaces today's "send the same message to 20 WhatsApp contacts".

#### 6.2 Combo order

Choosing a combo opens a **combo chat** (Nexconn group) with Amit, both sellers and Claire. Claire posts one card per seller with their allocation. Each seller accepts or adjusts their own line. Amit sees one combined order with child orders per seller. Sellers see only their own price and allocation; the group exists so dispatch and quality questions happen in one place.

> **Design choice:** sellers in a combo do not see each other's prices. Claire renders each seller's allocation card privately (targeted message) and the shared group only shows the combined timeline.

### J2 · Seller lists products and handles leads (Lakshmi / SS Garments)

**J2.1 Add products from photos**
1. Seller sends photos to Claire (or taps *Sell / add products*). Up to 20 at a time; Android Share-to-CLAIRE from WhatsApp supported (PWA Web Share Target).
2. Claire: "I found **6 products**: 4 track pants, 2 T-shirts. Check them:" → swipeable draft cards with auto-filled title, category, colours, fabric guess.
3. Claire: "What price and minimum order? You can say it once for all." Seller: *"Track pants 180, T-shirt 120, minimum 500, sizes M to XXL."*
4. Claire applies per category, shows the final cards → **Publish**. Storefront link + "Share on WhatsApp" card.

**J2.2 A buyer enquiry arrives**
- Seller gets a push and a **Lead card** in both the deal chat and their Claire chat:
  > *New enquiry · Amit Hosiery, Kolkata · Trust 78 · pays on time 9/10*
  > *1,000 cotton track pants · budget ₹170 · by 2 Dec*
  > [ Quote ₹172 ] [ Send catalog ] [ Can't do this ] [ Let Claire handle ]
- **Quote by voice:** seller says *"172, four days dispatch, 30 percent advance"* → Claire turns it into an Offer card draft → seller taps **Send**.

**J2.3 Keep stock and capacity fresh by voice**
- *"Track pants 2,000 pieces ready"* → updates `stock_qty` on the matching listing (Claire confirms which one).
- *"This week machines free for 3,000 pieces"* → updates service capacity.
- Weekly nudge: "Is your stock still right? 3 listings not updated in 14 days." Stale listings rank lower.

**J2.4 Claire auto-reply (seller's assistant)**

| Mode | Behaviour |
|------|-----------|
| **Off** | Nothing automatic. |
| **Suggest** (default) | When a buyer writes, Claire drafts a reply and shows it to the seller as "Suggested reply · Send / Edit". |
| **Auto** | If the seller hasn't replied in **2 min** (or outside working hours), Claire replies to the buyer on the seller's behalf, grounded only on that seller's catalog, stock and price rules. The message is labelled *"Auto-reply by Claire for Sree Textiles"*. |

Auto mode can: greet, share catalog cards, answer price / MOQ / sizes / stock from data, collect the buyer's requirement, propose a quote **only at or above the seller's floor price**. Auto mode never: accepts an order, agrees credit terms, or goes below the floor. Those always need the seller's tap.

Seller settings (one screen, voice-editable): floor price per listing, max discount %, working hours, auto-reply delay, "always send catalog first".

**J2.5 Rate revision (one tap)** — associations revise rates together when yarn prices move (e.g. +5 %). Seller says *"Increase all track pants by 5 percent from Monday"* → Claire shows old → new prices → **Apply**. Open quotes get a notice card in each deal chat; partners get a heads-up first.

**J2.6 Seller daily digest** (morning Claire message)
> 3 new enquiries · 1 offer waiting for you · Raj Traders payment ₹42,000 overdue 5 days
> [ Open enquiries ] [ Remind Raj Traders ] [ Ask Trade Desk to follow up ]

### J3 · Chat, negotiate, sample, ask for more volume

**The deal chat** is a 1-on-1 Nexconn conversation between two businesses, opened with a **Requirement card** at the top.

| Action | How it looks | Rules |
|--------|-------------|-------|
| **Text / voice message** | Normal bubbles, auto-translated. Voice notes show the waveform + translated transcript + "▶ Listen in Tamil". | See §7 |
| **Offer** | Card: price/pc · qty · dispatch days · advance % · credit days · freight (paid / to-pay). Buttons: Accept · Counter · Chat | Counter can be spoken: *"165 kar do"* → counter-offer card at ₹165. Each counter links to the previous one (negotiation thread shown as a mini-timeline). |
| **Sample request** | Card: sizes/colours wanted · sample price · courier charge · address (from profile) | Seller accepts → adds courier + tracking number by voice ("ST Courier 4471…") → buyer marks *Received* → **Approve & order bulk** or **Request changes**. |
| **More volume** | Card: "Can you make 3,000 more by 15 Dec?" | Seller answers with a capacity card: "2,000 by 15 Dec, 1,000 by 22 Dec" → buyer can turn it into an offer. |
| **Catalog** | Seller taps 📎 → Catalog → picks items → product cards in chat | Buyer taps a card → product view → "Ask about this" quotes it in chat. |
| **Call** | 📞 in header — in-app voice call (Nexconn call SDK) | Live captions in the other language are a stretch goal; post-call, Claire posts a translated summary of what was agreed. |
| **Claire's private hint** | Small grey card only visible to one side: "Market median for this spec is ₹168. Your last 3 orders were at ₹170." | Never shown to the other party. |

**Outcome:** accepted Offer → Order created (J4).

### J4 · Order lifecycle and payments

```
Offer accepted
   └─► ORDER CONFIRMED ─► ADVANCE PAID ─► IN PRODUCTION / PACKING ─► DISPATCHED ─► DELIVERED ─► BALANCE PAID ─► CLOSED ─► RATINGS
                         (buyer marks,      (optional progress        (transporter,  (buyer        (due date =
                          seller confirms)   updates by voice)         LR no., photo)  confirms)     delivery + credit days)
```

- **Order card** lives at the bottom of the deal chat and updates in place; each change also posts a short system line in both languages.
- **Payments (hackathon):** buyer records payment (UPI / NEFT reference or screenshot); seller confirms receipt with one tap. Razorpay test-mode / UPI intent is a stretch goal. The point is the **record**: `due_at` vs `confirmed_at` feeds the buyer's "pays on time" score automatically. (UPI person-to-person is capped at ₹1 lakh/day, so most wholesale tickets go by NEFT/RTGS — the card accepts any reference.)
- **Credit ladder (default terms Claire proposes):** first order with a new seller → 50–100 % advance; after **3 clean orders** (paid on time, no upheld dispute) Claire tells the seller *"Amit has paid on time 3 times. Offer 15 days credit?"*; partners can go to 30 days. This mirrors how trust is built today (small first orders, credit that grows) without CLAIRE lending money.
- **45-day alert (Section 43B(h)):** when the seller is a Udyam-registered micro/small **manufacturer or job worker** (the rule does not cover traders), the order card shows *"Pay within 45 days to claim this as an expense"* to the buyer and a days-outstanding counter to the seller. This is a real, current pain point in the cluster.
- **Dispatch:** seller says *"Sent by KPN, LR 55821, 12 bundles"* → dispatch card with transporter, LR number and a photo of the LR copy and invoice. Buyers today release balance against exactly this photo.
- **Paperwork hints:** order card shows GST (5 % for garments ≤ ₹2,500/pc since 22 Sep 2025) and flags *"E-way bill needed"* for inter-state consignments above ₹50,000. Auto-generating invoice / e-way bill is post-hackathon.
- **Overdue logic:** balance overdue by 3 days → Claire nudges the buyer; 7 days → seller gets "Ask Trade Desk to follow up" button; 15 days → automatic P2 ticket (J9).
- **Disputes:** buyer taps *Report a problem* on a delivered order (short / damaged / wrong colour / quality) → photos + voice note → P2 ticket with both parties.

### J5 · Ratings and trust (both directions)

After `DELIVERED` (buyer) and `BALANCE PAID` (seller), each side gets a rating card. One screen, big stars, one optional voice comment.

| Buyer rates seller | Seller rates buyer |
|--------------------|--------------------|
| Quality matches sample ★ | Paid on time ★ (pre-filled from records, editable) |
| Value for money ★ | Clear requirements ★ |
| Delivered on time ★ (pre-filled from records) | Fair on returns / no cancellations ★ |
| Communication ★ | Would sell again? 👍 / 👎 |
| Would reorder? 👍 / 👎 | |

Ratings are revealed only when both sides have rated or after 7 days (prevents retaliation). Trust score formula is in §9.

**Badges** (shown on every card): ✓ GST verified · 🏭 Manufacturer (vs Trader) · 🏭 Unit visited · ⚡ Replies in < 10 min · 💰 Pays on time · ⭐ Top quality · 🤝 N repeat buyers.

**Vouched by (references):** wholesale trade runs on references ("who introduced you?"). Any business with 2+ completed orders can **vouch** for another business it has traded with ("I have traded with Amit Hosiery for 3 years"). Vouches show on the profile as *"Vouched by SS Garments, Ravi Knit Fashions"*. A vouch from a business that later has an upheld dispute against the vouched party loses weight. This replaces the broker's role of vouching for a buyer, without the commission.

### J6 · Reorder and partnerships

- **Reorder:** Orders → completed order → **Reorder** (or say *"same as last time from Sree"*). Creates a Requirement + Offer pre-filled with last quantity and price; seller gets a **Reorder card**: [Accept at ₹168] [Quote new price].
- **Smart reminder:** if Amit reordered every ~30 days twice, Claire asks on day 28: *"Time to reorder 1,000 track pants from Sree Textiles?"*
- **Partner:** after 2 completed orders with ratings ≥ 4, Claire suggests **"Make Sree Textiles a partner?"** Partners get:
  - a pinned partner chat with a **standing price card** (agreed prices per item, valid till date);
  - priority in matching (partners show first, labelled 🤝);
  - optional credit terms (e.g. 15 days) recorded on the partnership;
  - seller can push **"New stock for partners"** broadcasts that reach partners before the open market.

### J7 · Multi-tier supply chain: job work split and raw material

**J7.1 Ravi splits a stitching job across units**
1. Ravi tells Claire: *"Need stitching for 5,000 track pants, fabric cut and ready, in 10 days, around 22 rupees a piece."*
2. Extractor → intent `FIND_SERVICE`, service = stitching, garment = track pants, qty = 5,000, rate = ₹22/pc, deadline = 10 days, material = buyer-supplied.
3. Matcher looks at **service listings** with free capacity: `capacity_per_day × working days before deadline`.
4. Claire: *"No single unit can finish 5,000 in 10 days. Best split:"*
   - Lakshmi Garments — 2,000 pcs · ₹22 · Trust 81
   - Raju Stitching Works (owner from Bihar, speaks Hindi) — 1,800 pcs · ₹21 · Trust 77
   - Sri Velan Stitching — 1,200 pcs · ₹23 · Trust 74
   - Total 5,000 · avg ₹21.9 · ready in 9 days
   [ Send job offers to all 3 ] [ Change split ]
5. Each unit receives a **Job-work offer card** (garment, qty, rate, deadline, material provided, sample photo of the style). Accept / counter / decline. If one declines, Claire proposes a replacement from the next-best unit.
6. Accepted lines become **work orders** (orders with `kind = job_work`), grouped under one parent. Ravi writes in Tamil; Raju reads and answers in Hindi — about 1 in 10 job-work units in Tiruppur is now run by a migrant owner, so translation matters **inside** the cluster too, not only for out-of-state buyers.
7. Each work order is also a **digital delivery challan**: pieces/kg sent, pieces returned, rejects, process loss. Today this lives on paper challans, Excel and WhatsApp groups while 40–60 % of work-in-progress sits at partner units.

**J7.2 Progress by voice** — Lakshmi says *"Today 600 done"* → progress bar on the work order updates (Ravi sees 600 / 2,000). Claire asks job workers once a day for progress if nothing came in.

**J7.3 Return, pay, rate** — job worker marks *Returned 1,980 / rejected 20* → Ravi confirms → payment due = pieces × rate → both rate each other.

**J7.4 Raw material** — Lakshmi tells Claire: *"Need 300 kg single jersey 180 GSM white, this week."* → the same J1 flow, with unit = kg and fabric attributes (knit type, GSM, colour, yarn count). Senthil's yarn listings work the same way for knitting units.

**J7.5 Job workers looking for work** — Lakshmi says *"I have 20 machines free next week"* → Claire posts her capacity into the matcher and pings garment owners who searched for stitching recently: *"Lakshmi Garments has free capacity next week — 1,500 pcs/day."*

> **Why this matters for judging:** it shows CLAIRE Connect is not just a catalog for finished goods. The same chat, matcher and trust layer work for every hop of the chain, which nobody else does for this cluster.

### J8 · Cross-language voice and text (applies to every chat)

1. Amit holds the mic and says in Hindi: *"Bhaiya, 165 mein de do, 1000 piece pakka lenge."*
2. Lakshmi receives a voice bubble with:
   - Tamil text: *"அண்ணா, 165க்கு கொடுங்க, 1000 பீஸ் கண்டிப்பா எடுப்போம்."*
   - **▶ Listen in Tamil** (TTS) · **▶ Original** · "Show Hindi"
   - Claire detects a price and offers Amit a one-tap "Make this a counter-offer at ₹165?" (only on Amit's side).
3. Lakshmi replies by voice in Tamil; Amit gets Hindi text + Hindi audio.

Rules: numbers, prices, quantities and sizes are extracted and **re-inserted verbatim** after translation (never re-phrased). Trade terms come from a glossary and are kept as-is.

### J9 · Trade Desk — human agent dispatch (support track)

**Why a human desk:** low digital literacy, payment disputes, quality complaints, very large orders and unit verification all need people. Claire handles the routine; humans handle trust.

**Ticket triggers**

| Trigger | Type | Priority |
|---------|------|----------|
| User taps *Talk to a person* / says it | `help` | P3 (P2 if inside an active order) |
| Claire fails twice | `help` | P3 |
| Angry / fraud language detected | `dispute` | P2 |
| *Report a problem* on delivery | `quality_dispute` | P2 |
| Balance overdue 15 days | `payment_followup` | P2 |
| Order value > ₹5,00,000 | `concierge` | P2 |
| Seller unanswered enquiry > 2 h (Auto mode off) | `seller_nudge` | P3 |
| "Call me" during onboarding | `onboarding_assist` | P3 |
| Unit verification requested | `verification_visit` | P3 |

**Dispatch (routing) rule** — for each new ticket:
1. Candidate agents = online agents whose `languages` include the user's language (for disputes: both parties' languages if possible) and whose `skills` include the ticket type.
2. Drop agents at `max_concurrent`.
3. Pick the lowest load; tie-break by longest idle; region match for `verification_visit`.
4. If nobody qualifies: assign the best bilingual agent and turn on auto-translate for them; if still nobody, queue with SLA timer and show "We'll reply within 10 min" to the user.
5. SLA for first response: P1 5 min · P2 15 min · P3 1 h. Breach → re-dispatch + supervisor alert.

**What the user sees:** *"Meena from CLAIRE Trade Desk (speaks Hindi, Tamil) has joined."* The agent joins the existing deal chat (or a support chat if there is no deal), so nobody repeats the story.

**What the agent sees (console):**
- **Left:** AI summary in the agent's language (what happened, what each side wants, amounts, dates), both businesses' trust profiles, order timeline.
- **Centre:** the full conversation, translated to the agent's language, voice notes transcribed.
- **Right:** actions — Call buyer / Call seller (in-app call), Send template, Mark payment received, Raise payment reminder, Schedule unit visit, Apply trust penalty (with reason), Resolve with outcome.
- **Claire "whisper":** suggested replies the agent can send with one tap.

**Handoff rule:** when an agent joins a conversation, Claire's auto-replies in that conversation pause. On *Resolve*, Claire posts the outcome in both languages and resumes.

**Supervisor view:** queue by language, SLA breaches, agent load, CSAT from the 1-tap "Was this resolved?" card.

---

## 7. Translation and voice — behaviour spec

| Item | Behaviour |
|------|-----------|
| Language per user | Set in onboarding; changeable in Me. Used for UI strings, Claire, translation target and TTS voice. |
| Text messages | Translated on arrival into the reader's language (Nexconn built-in translation, in the reader's app); reader sees translated text by default with a small "Translated from Hindi · Show original" line. |
| Voice notes | Recorded (max 60 s) → speech-to-text in the speaker's language → translated → stored with the message. Receiver sees transcript in their language + ▶ Listen in their language (TTS, generated on first play and cached) + ▶ Original. |
| Cards | Card payloads hold structured data; each client renders labels in its own language. Only free-text fields are machine-translated. |
| Numbers and units | Extracted before translation, re-inserted after. ₹ amounts, quantities, sizes, GSM, counts never change. |
| Glossary | Domain glossary (GSM, combed, carded, interlock, rib, fleece, lycra, kora, compacting, job work, MOQ, set, LR, to-pay) — kept or transliterated, never translated literally. |
| Failure | If translation fails, show original with "Translation unavailable · Retry". Never block delivery. |

---

## 8. Matching and combo engine

### 8.1 Inputs

`Requirement { type: product|material|service, category, attrs, qty, unit, budget_per_unit?, deadline?, delivery_city, liked_listing_ids[] }`

### 8.2 Candidate filter

1. Listings in the same category (or child category), active, seller not blocked.
2. Attribute compatibility score ≥ 0.6 (fabric, GSM ± 10, colours overlap, print type, fit). Liked styles add their attributes as soft targets.
3. Price ≤ budget × 1.05 (results between 100 % and 105 % are labelled "slightly above budget").
4. **Available by deadline** = `stock_qty + capacity_per_day × working_days_until(deadline − transit_days(city))`. For services, stock is 0 and only capacity counts.
5. Each seller's allocation must be ≥ their MOQ.

### 8.3 Score (0–1) for ranking single sellers

```
score = 0.30·price_fit + 0.25·trust + 0.15·coverage + 0.10·lead_time_fit
      + 0.10·responsiveness + 0.05·freight_fit + 0.05·relationship
price_fit       = clamp((budget − price) / budget + 0.5, 0, 1)        // cheaper → higher
trust           = trust_score / 100
coverage        = min(1, available / qty)
lead_time_fit   = 1 if ready ≤ deadline else 0.3
responsiveness  = 1 − min(1, median_reply_minutes / 120)
freight_fit     = 1 − freight_per_unit / price
relationship    = 1 if partner, 0.5 if ordered before, else 0
```

### 8.4 Combo builder (2–3 sellers)

Run when fewer than 2 single sellers cover the quantity, or always (to find a cheaper combo).

```
pool = top 12 candidates by score whose attrs are mutually compatible (pairwise attr score ≥ 0.75)
       and whose trust tiers differ by ≤ 1 (tiers: <60, 60–79, ≥80)
for k in [2, 3]:
  for each combination C of size k from pool:
     if Σ available(C) < qty: continue
     allocate qty greedily: cheapest seller first, up to its available, respecting each MOQ
     if any allocated line < that seller's MOQ: try next allocation order; else skip
     blended_price = Σ(alloc_i × price_i) / qty
     ready_by      = max(ready_by_i)
     combo_score   = 0.45·price_fit(blended_price) + 0.30·min(trust_i)/100
                   + 0.15·lead_time_fit(ready_by) + 0.10·(1 − (k−2)·0.5)   // prefer fewer sellers
keep top 3 combos by combo_score
```

With ≤ 12 candidates this is ≤ 66 + 220 combinations — cheap to brute-force per request.

### 8.5 Output

`{ singles: Match[≤5], combos: Combo[≤3], madeToOrder: Match[≤3], marketBand: {p25, median, p75} }` — `marketBand` also feeds the budget chips in step 4.

---

## 9. Trust score (0–100)

| Component | Weight | Source |
|-----------|--------|--------|
| Verification | 20 | Phone 5 · GST checked 7 · Udyam 3 · Unit visited / video KYC by Trade Desk 5 |
| Ratings | 40 | Bayesian average of the 4 sub-ratings received, prior = 3.5 with weight 5 orders, scaled to 0–40 |
| Reliability (records) | 25 | Sellers: on-time dispatch %; Buyers: on-time payment %; job workers: on-time return % and rejection rate |
| Responsiveness | 10 | Median first-reply time over last 30 days (auto-replies count half) |
| Disputes | 5 | Starts at 5, −2 per upheld dispute in last 90 days (floor 0) |

- New businesses start around 40–50 (phone + whatever is verified + rating prior) and are labelled **New on CLAIRE** rather than shown as low.
- Score and its breakdown are visible to the business itself ("Why is my score 74? → Reply faster: +4").
- Tiers: < 60 · 60–79 · ≥ 80 (used by the combo builder).

---

## 10. Trade Desk — data the dispatcher needs

| Field | Example |
|-------|---------|
| `type` | `payment_followup` |
| `priority` | P2 |
| `language_needed` | [hi, ta] |
| `region` | Tiruppur North |
| `parties` | Amit Hosiery (buyer), Sree Textiles (seller) |
| `order_id`, `conversation_id` | links |
| `ai_summary` | "Balance ₹1,17,600 due 2 Dec, unpaid 15 days. Buyer says goods were 40 pcs short. Seller says count was 1,000 at dispatch, LR 55821." |
| `suggested_next_step` | "Ask transporter for weight slip; offer partial payment of ₹1,12,900 pending recount." |
| `sla_due_at` | created + 15 min |

---

## 11. Notifications

| Event | To | Channel |
|-------|----|---------|
| New enquiry / offer / counter | Seller / buyer | Push + chat card |
| Order status change | Both | Chat card update + push |
| Payment due in 2 days / overdue | Buyer | Claire message + push |
| Auto-reply sent on your behalf | Seller | Silent badge in deal chat |
| Agent joined | Ticket parties | Chat system message |
| Partner new stock | Partner buyers | Claire message |

---

## 12. What makes this stand out (for the pitch)

1. **Voice onboarding that builds a live profile while you talk** — and a catalog from the photos already on your phone.
2. **Hindi voice in, Tamil voice out** — two people with no shared language negotiate a ₹1.7 lakh order.
3. **Combo orders** — "no one has 1,000? Here are 2 sellers with the same fabric that together do."
4. **Whole-chain marketplace** — yarn, fabric, stitching job work and finished goods on the same rails; job work split across 3 units with progress by voice.
5. **Two-way trust from records** — buyers are rated on paying on time, computed from actual payment dates.
6. **Trade Desk** — AI triage + language-skill dispatch + agent joins the existing chat with a translated summary.
7. **Seller auto-reply** — buyers get an answer in minutes even when the owner is on the factory floor.
