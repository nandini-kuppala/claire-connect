# 04 · Build Plan — 4-day sprint to submission

> **Note (implementation):** this was the planning design. The shipped build uses **MongoDB Atlas** (not Postgres/Supabase) and **OpenRouter** (not Anthropic). `BUILD_CONTRACT.md` and `HANDOVER.md` describe what is actually built.


**Deadline: Sunday 22 Nov 2026, 11:59 PM IST.** The submission can be edited until then, so we submit a complete draft on **Saturday night** and keep improving it. Judging runs 23–27 Nov; results 1 Dec.

## 0. How we will be judged, and what that means for the plan

| Criterion | Weight | What we do about it |
|-----------|--------|---------------------|
| Completeness & user experience | **50 %** | A smaller set of flows that work end to end on a real Android phone beats many half-flows. Feature freeze Saturday 11 PM. Every P0 flow has acceptance criteria (below). |
| Innovation & scenario value | 30 % | Voice + translation between Tamil sellers and Hindi buyers; combo orders; whole-chain (job work) on the same rails; Trade Desk built on Nexconn primitives. |
| Business & growth potential | 20 % | Real pilot partners, WhatsApp invite loop, clear revenue model, research numbers in the PDF. |
| **Traction bonus** ("significant") | bonus | Judges count **active users on our Nexconn App Key**. Real onboarding with pilot partners on Saturday and Sunday is a core task, not an afterthought. |

Hard requirements: Chat SDK used in a measurable way · same App Key in demo, form and PDF · public GitHub repo · live web link · demo video link (YouTube/Loom/Drive/Vimeo, viewable by anyone with the link) · PDF write-up ≤ 25 MB · disclosure of anything that existed before the challenge.

---

## 1. Scope tiers

### P0 — the demo spine (must work end to end by Saturday 12 PM)

| # | Feature | Done when |
|---|---------|-----------|
| P0-1 | Phone login (demo OTP), language tiles, Nexconn connect, inbox with Claire pinned | New user reaches inbox in < 30 s; reconnect banner works when Wi-Fi drops |
| P0-2 | Voice onboarding with live profile card | Tamil and Hindi speakers get a correct profile card from ≤ 4 spoken answers; "type instead" works |
| P0-3 | Catalog from photos + voice price | 6 photos → ≥ 5 correct drafts; "all 180, minimum 500, M to XXL" applies to all; publish creates storefront link |
| P0-4 | Claire buyer flow: category → style → quantity → budget → timing → results (single + combo + made-to-order) | Same flow works by tapping only and by one spoken sentence; results in < 4 s |
| P0-5 | Storefront (in-app + public `/s/:slug`) with Chat / Sample / Order actions | Public link opens without login and deep-links into chat after login |
| P0-6 | Deal chat (GroupChannel) with text + voice notes, translated both ways, typing, read receipts | Hindi voice → Tamil text + Tamil audio ≤ 5 s; numbers unchanged; "Show original" works |
| P0-7 | Offer → counter → accept → order card → status updates (advance paid, dispatched with LR, delivered, balance paid) | Order card updates in both chats; system notices arrive in "CLAIRE Updates" |
| P0-8 | Ratings both ways + trust score + badges | Ratings revealed after both rate; trust score updates; badges show on cards |
| P0-9 | Trade Desk: tickets (talk to person, problem report, overdue), dispatch by language/skill/load, agent joins chat, AI summary, resolve | Ticket created → right agent alerted < 5 s → join → summary visible → resolve posts outcome in both languages |
| P0-10 | Seed data + demo reset script | One command resets demo accounts without touching real users |

### P1 — build in this order if P0 is green by Saturday noon

1. Job-work split (J7.1–7.2) — reuses the combo builder with service listings; job offer cards; progress by voice.
2. Seller auto-reply (Suggest + Auto modes).
3. Sample request card.
4. Call SDK 1:1 audio call from deal chat header and from the desk.
5. Reorder (one tap) + partner suggestion.
6. RFQ broadcast + quote comparison card.
7. Claire streaming messages for long answers.
8. Credit ladder nudge, 45-day alert, rate revision broadcast.
9. Pre-messaging scam guard.

### P2 — after the hackathon (mention in the PDF roadmap)

UPI/Razorpay payments and escrow-lite · GSTIN verification API · invoice + e-way bill generation · logistics booking & tracking · live call captions · WhatsApp Business API bridge · NBFC/TReDS partners using trade history (no balance-sheet lending) · CLAIRE Trend Intelligence inside Claire ("what will sell in Kolkata next month") · deeper Production Control for job work · native Android via Flutter SDK.

---

## 2. Team split (4 people)

| Role | Owns | Repo areas |
|------|------|-----------|
| **A · Frontend lead** | PWA shell, chat UI on Chat SDK, card renderers, Claire screen, mic + waveform, translation module, i18n, polish | `apps/web/src/{chat,claire,storefront,i18n}` |
| **B · Backend lead** | Fastify, DB, auth + token issue, webhooks + queue, Nexconn sender, deals/orders/ratings/trust APIs, seed, deploy | `apps/server/src/{nexconn,db,trust}`, deals/orders routes |
| **C · AI & voice** | Sarvam STT/TTS, Claude NLU + vision + auto-reply + triage, Claire orchestrator + flows, matcher + combo builder | `apps/server/src/{claire,ai,voice,match}` |
| **D · Desk, design & traction** | Visual design, Trade Desk console + dispatcher, public storefront, pilot partner onboarding, demo video, PDF, form | `apps/web/src/desk`, `apps/server/src/desk`, `docs/submission` |

If the team is smaller: merge C into B for the backend parts and give D's console work to A after P0-6.

---

## 3. Day-by-day

### Day 0 · Wed 18 Nov (tonight, 2–3 h)
- **Everyone:** read `00-README.md` and `02-product-spec.md`; agree P0 list; agree demo personas.
- **B:** create Nexconn app (Singapore) → App Key/Secret; activate Chat Growth Credit; turn on translation; decide on adding a card (translation beyond 10,000 chars, call minutes). Create Supabase, Railway/Render, Vercel projects; public GitHub repo `claire-connect`; monorepo skeleton; CI lint.
- **C:** get Anthropic and Sarvam API keys; check Sarvam STT/TTS model names and languages; write 30 test utterances (Tamil, Hindi, English, Tanglish, Hinglish) for the extractor.
- **A:** install the `nexconn-chat` skill; run the official `nexconn-chat-sample-web` locally with the new App Key (proves token + connect works).
- **D:** message pilot partners (SS Garments, Barath Garments, Janshi Text) to book Saturday onboarding; ask for 30–50 product photos **with permission** and 5–10 buyer contacts each; draft visual tokens from the CLAIRE brand.

### Day 1 · Thu 19 Nov — "hello chat"
| A | B | C | D |
|---|---|---|---|
| PWA shell, routing, i18n (en/ta/hi), login + language screens, `NCEngine` init/connect, custom message registration, inbox (channel list, unread, pin), chat screen (text, typing, read receipts), card renderer registry with `CC:Chips`, `CC:CategoryTiles` | Schema + migrations, OTP-demo auth + Nexconn token issue, webhook (verify → pg-boss → 200), Nexconn sender (direct, group, system, stream), group create/join, seed v1 (taxonomy, 45 businesses, 160 listings) | Voice provider (`/voice/transcribe`, `/voice/tts`), NLU extractor + tests, `buyProduct` flow (pure function) + tests, matcher + combo builder + tests | Design system (colors, type, card components), storefront page, desk console layout, demo script v1, photo collection |

**10 PM checkpoint:** user logs in → talks to Claire → Claire answers with chips through the webhook loop; two users exchange text in a deal GroupChannel.

### Day 2 · Fri 20 Nov — core flows
| A | B | C | D |
|---|---|---|---|
| Claire UI complete (chips, carousel with ❤, results card, hold-to-talk + waveform), `CC:Voice` bubble with translation + ▶ listen, translation module (mask/unmask, cache, fallback), in-app storefront | Requirements/match/deal endpoints, offers → orders → payments → ratings, order state machine, system channel notices, trust score job + badges | Onboarding interview (live profile), vision catalog + voice price apply, orchestrator wired end to end, `/translate` fallback | Desk: tickets, dispatcher, join, triage summary (with C), resolve; public `/s/:slug`; **first prod deploy** |

**10 PM checkpoint:** on prod, a Tamil seller phone and a Hindi buyer phone complete J1 → J3 → J4 (search, chat by voice, offer, order).

### Day 3 · Sat 21 Nov — finish, P1, real users
- **9–11 AM:** bug bash the P0 spine on real Android phones (one low-end), on 4G. Fix list ranked by "would a judge notice?".
- **A:** loading/empty/error states, offline banner, orders tab, ratings UI, Me + trust breakdown; Call SDK button (P1-4).
- **B:** job-work split + `CC:JobWorkOffer` + progress (P1-1); reorder + partner (P1-5); `/stats` page.
- **C:** seller auto-reply (P1-2); sample card (P1-3); streaming summaries (P1-7).
- **D:** **field onboarding with pilot partners** (target 15–30 real businesses today), collect feedback and permission for screenshots/quotes; record b-roll of the market and units.
- **9 PM:** submit a complete draft (form + PDF v1 + video v0) so something valid is in.
- **11 PM: feature freeze.**

### Day 4 · Sun 22 Nov — ship
- **9 AM–12 PM:** fixes only; reset demo accounts; Lighthouse/performance pass; check every link in an incognito window.
- **12–3 PM:** record the final demo video (script §5).
- **12–5 PM:** PDF write-up (outline §6), README, screenshots, architecture diagram.
- **5–7 PM:** update the submission form; traction numbers from `/stats` and Nexconn Console.
- **Target final submit: 8 PM IST** (4-hour buffer before 11:59 PM).

---

## 4. Seed data

| Segment | Count | Languages | Examples |
|---------|------:|-----------|----------|
| Yarn agents / spinning | 4 | ta | Combed cotton ₹280–400/kg by count (20s → 40s; very volatile in 2026) |
| Knitting units (fabric sellers + knitting job work) | 5 | ta | Single jersey 180 GSM cotton ~₹420–480/kg; poly-cotton ₹270–280/kg; knitting job work ₹15–35/kg by structure |
| Dyeing / processing | 4 | ta | ₹55–130/kg by shade (light / medium / dark); dye-lot minimum ~150 kg per colour; compacting ~₹6–10/kg |
| Printing / embroidery | 4 | ta, hi | Single-colour screen print ₹15–50/pc; embroidery ₹30–150 per placement |
| Stitching job-work units | 10 | ta; 3 run by Hindi-speaking owners | T-shirt ₹15–30/pc, track pants ₹20–35/pc; 600–2,500 pcs/day |
| Garment manufacturers / brands | 10 | ta, en | Round-neck tees ₹90–170, polos ₹160–280, track pants ₹129–250, briefs ₹25–75, vests ₹35–66, kids sets ₹89–285, nightwear ₹150–300, leggings ₹100–225 |
| Wholesalers (Khaderpet) | 6 | ta | Mixed catalogs, minimum order value ₹5,000–₹10,000 |
| Resellers (out of state) | 6 | hi (Kolkata, Delhi, Patna), bn, te (Hyderabad), kn (Bengaluru), mr (Pune) | Order sizes ₹50,000–₹3,00,000 |
| Trade Desk agents | 3 | Meena (ta, hi, en) · Arjun (ta, te, kn, en) · Farida (hi, bn, en) | — |

- 120 historical orders with ratings so trust scores, badges and "repeat buyers" look lived-in; a few late payments so "pays on time" varies.
- Size sets: men's tees M:L:XL:XXL = 2:2:2:1; track pants S–XXL one each; kids by age 2–4 … 10–12; innerwear by dozen.
- Photos: pilot partners' photos with written OK, or photos the team shoots. **Do not scrape** IndiaMART/WhatsApp images.
- All seed ids prefixed `seed_`; all seed businesses carry a small "Demo" tag in the UI so judges never mistake them for traction.

---

## 5. Demo video script (target 3:30, hard max 4:00)

| Time | Scene | Shows |
|------|-------|-------|
| 0:00–0:20 | Hook: Tiruppur stall, WhatsApp photo floods. VO: "₹35,000 crore of domestic trade runs on WhatsApp. Sellers speak Tamil, buyers speak Hindi, and middlemen live in the gap." | Problem |
| 0:20–0:55 | Lakshmi (Tamil) onboards by voice; profile fills live; shares 6 WhatsApp photos → catalog in seconds | Voice onboarding, vision catalog |
| 0:55–1:35 | Amit (Hindi, Kolkata) says one sentence to Claire → results with a **combo** of 2 sellers; opens a storefront | Slot filling, matching, combo |
| 1:35–2:20 | Deal chat: Amit's Hindi voice → Tamil text + Tamil audio for Lakshmi; she answers in Tamil voice → Hindi; counter-offer card from the voice note; accept → order card | Translation, voice, offers (Nexconn custom messages, translation, typing, receipts) |
| 2:20–2:50 | Balance overdue → ticket → routed to Meena (Hindi + Tamil) → joins the same chat with an AI summary → resolves | Human agent dispatch |
| 2:50–3:10 | Both rate each other → trust badges; Ravi splits 5,000-piece stitching job across 3 units | Two-way trust, whole supply chain |
| 3:10–3:30 | Nexconn features list + real traction numbers + pilot partner quote; close on logo | Business & traction |

Record on real phones (screen recording) side by side, plus the desk on a laptop. Add burned-in English subtitles for every Tamil/Hindi line.

---

## 6. PDF write-up outline (required: why, problem, Nexconn features, App Key)

1. **Cover** — CLAIRE Connect, team, **App Key**, live link, repo, video.
2. **Problem** — Tiruppur domestic trade, language gap, trader dependence, payment risk (numbers from `01-research-brief.md`).
3. **Who it serves** — supply-chain diagram (yarn → reseller) and the six personas.
4. **What we built** — 6 screenshots with one-line captions (onboarding, Claire results, translated voice chat, order card, Trade Desk, job-work split).
5. **How we use Nexconn** — the feature map from `03-technical-design.md` §2.2, each row tied to a screen.
6. **Architecture** — one diagram.
7. **Traction** — real businesses onboarded (by role, language, state), messages, translations, orders; pilot partner quotes; `/stats` link.
8. **Business model** — free for buyers; seller subscription (CLAIRE plan) for auto-reply, storefront, analytics; small success fee on combo/RFQ orders; paid verification visit; later, lending-partner referral fees. Asset-light: no inventory, no credit on our balance sheet (lessons from Udaan/Fashinza).
9. **Prior work disclosure** — CLAIRE brand, landing page and the trend-intelligence engine (patent application 202541092811 A) existed before; the chat marketplace, Claire assistant, translation/voice pipeline, matcher, trust layer and Trade Desk were built during the challenge.
10. **Roadmap** — P2 list.

### Submission form draft text

- **Title:** CLAIRE Connect — voice-first, multilingual trade chat for India's knitwear supply chain
- **Summary:** Tiruppur makes most of India's knitwear, but its domestic trade runs on WhatsApp photo floods, phone calls and middlemen, because sellers speak Tamil and buyers across India speak Hindi, Bengali or Telugu. CLAIRE Connect is a chat-first marketplace where every business in the chain — yarn agents, knitting and stitching units, garment makers, wholesalers and resellers — can buy and sell by voice in their own language. Claire, an AI assistant, onboards a business from a short spoken conversation, turns WhatsApp photos into a catalog, and matches a buyer's one-sentence need to sellers who have the stock at their price, combining 2–3 sellers when no one can fill the order alone. Buyers and sellers negotiate in translated text and voice notes with offer and order cards, rate each other on quality and on paying on time, and reorder in one tap. When something goes wrong, a Trade Desk agent who speaks both languages is dispatched into the same chat with an AI summary.
- **SDK features used:** paste the feature map rows (§2.2 of the technical design), each with "where in the app".

---

## 7. Traction plan (real users only)

- **Target by Sunday 6 PM:** 30–60 real businesses on our App Key, 300+ messages, at least 3 languages in real use, at least 1 real buyer–seller conversation across languages.
- **Saturday:** team member(s) in Tiruppur with the three pilot partners; onboard each owner and 3–5 of their staff/job workers by voice; each partner shares their storefront link with 5–10 out-of-state buyers on WhatsApp ("see my catalog and chat with me in Hindi").
- **QR standee** at one cooperative Khaderpet shop: "Scan → talk to Claire in your language".
- **Remote buyers:** friends and family who run shops in other states try a real enquiry.
- **Proof:** `/stats` page + Nexconn Console MAU screenshot + 2–3 short quotes (with permission).
- **Rules:** real consent, no fake accounts, seed accounts excluded and labelled. Inflated numbers would be visible to judges through the App Key and would hurt us.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Four days is short | P0 only until Saturday noon; vertical slices integrated daily; feature freeze Saturday 11 PM |
| Server SDK v0.1.2 has gaps | Thin REST client with the documented signature (`sha1(AppSecret+Nonce+Timestamp)`) as a fallback |
| Translation quota (10,000 chars free) | Add a card if the team agrees; cache per message; Claude fallback |
| STT errors on Tamil / code-mixed speech | Claire always shows what it heard ("You said: 1,000 track pants") with chips to correct; voice notes keep the original audio |
| Webhook 5 s timeout | Ack immediately, process in queue, idempotent on message UID |
| Low-end phones / slow networks | Compress images (WebP, ≤ 800 px), lazy-load carousels, audio as opus |
| iOS Safari recording quirks | Android Chrome is the primary target; test iOS once on Day 3 |
| Live demo fails | The video is the main artifact; demo accounts on prod; one-command reset |
| Privacy | Consent screen for real users; no phone/GSTIN in AI prompts or logs; phone numbers hidden until an order exists |
