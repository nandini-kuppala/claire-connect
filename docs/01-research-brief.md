# 01 · Research Brief

Research done 18 Nov 2026 from public sources. Trade-press numbers for Tiruppur often conflict; ranges are given where they do. Items marked **[verify]** should be checked with pilot partners before they go into the pitch.

---

## A. The hackathon — Nexconn Build Challenge 2026

| Item | Detail |
|------|--------|
| Organiser | Reskilll for Nexconn · online · free · teams of 1–4 · contact hackathon@nexconn.ai |
| **Deadline** | **Sun 22 Nov 2026, 11:59 PM IST** (submission editable until then). Judging 23–27 Nov. Results 1 Dec. No live finale. |
| Prizes | 5 overall winners share $5,000 (2,000 / 1,250 / 750 / 500 / 500) — **no per-track prizes**; tracks are "ideas, not limits". Winners also get 2 years of the Nexconn Free Chat Plan and 1 year of discounted AWS/Alibaba Cloud. |
| Our track | Marketplace & Support — buyer-seller 1-on-1 chat, human agent dispatch center, multi-language translated chat. (Humanitarian track also lists "voice-to-text chat", which our voice feature covers too.) |
| Must have | **Chat SDK** (Chat UI also counts); Call SDK optional. Usage verified via **App Key**. Platforms: Web, iOS, Android, Flutter only. |
| Submit | Title + summary · Nexconn packages used + App Key + "SDK features you used (where)" · live app link · **public GitHub repo** · demo video link (YouTube/Loom/Drive/Vimeo) · **PDF write-up ≤ 25 MB** (why, problem, Nexconn features, App Key) · optional traction proof + active users · prior-work disclosure |
| Judging | **Completeness & UX 50 %** · Innovation & scenario value 30 % · Business & growth 20 % · **traction is a "significant bonus"** (active users on your Nexconn app) |
| Rules | Existing projects allowed if a real Nexconn integration is added during the challenge and prior parts are disclosed. You keep IP; Nexconn may showcase the project. Support: GitHub issues on `NexconnAI-Dev/hackathon` (don't post App Keys publicly). |

Sources: reskilll.com/hack/nexconn, /rules (read via browser, 18 Nov 2026).

## B. Nexconn — what the platform gives us (and doesn't)

| Area | Available | Gap → our answer |
|------|-----------|------------------|
| Chat SDK (Web) | `@nexconn/engine` + `@nexconn/chat`; Direct, Group (300 members), Open, Community, System channels; text, image, file, HD voice, custom messages; typing, read receipts, presence, history, unread, pin | — |
| Server API | 168 `/v4/` endpoints: token issue, send as any user (bots), group create/join, stream messages, system channel broadcast; Node server SDK v0.1.2 | Young SDK → thin REST fallback |
| Webhooks | `message:send`, `user:connection_status`, group events; **pre-messaging** (sync, can modify/block) on Free/Pro; 5 s timeout | Ack + queue |
| Translation | Built-in, client-side, 211 languages incl. ta, hi, te, kn, ml, bn, or, mr, gu; mechanical only; 10 items/call; 10,000 chars free then $0.02/1k with a card | Mask numbers/terms; cache; Claude fallback |
| Speech-to-text | **None** for developers | Sarvam AI (Indian languages) |
| Customer service / agent routing / bots | **None** built in | Build Trade Desk on GroupChannel + targeted messages + presence + webhooks |
| Call SDK (Web) | `@nexconn/call` 1:1 and group audio/video; 10,000 free minutes with a card | P1 |
| Chat UI kit | Lit components, **en/zh strings only** | Build our own UI on Chat SDK |
| Moderation | Profanity filter (no Indian languages); auto-moderation (paid) | Own keyword list + pre-messaging scam guard |
| Region | Singapore (default), North America, Saudi Arabia — no India | Singapore |
| Free tier | Standard free plan 1 month; **Chat Growth Credit**: Pro features free up to 10K MAU, register by 31 Dec 2026, valid to 31 Dec 2027, one app per org | Activate on day 0 |
| AI coding skill | `nexconn-chat` skill: `npx skills add https://github.com/NexconnAI-Dev/nexconn-skills.git --skill nexconn-chat` | Install for every dev |

Nexconn's own marketplace solution page highlights buyer-seller DMs from product pages, order/shipment notifications via server API, product consultation calls and anti-scam moderation — all of which CLAIRE Connect demonstrates.

Sources: docs.nexconn.ai/llms.txt and linked pages; nexconn.ai/free-chat-api; nexconn.ai/blog/nexconn-chat-integration-skill; github.com/NexconnAI-Dev (22 repos).

## C. Tiruppur — the cluster

| Fact | Figure | Source |
|------|--------|--------|
| Exports | ₹42,500–46,000 cr in FY26 (two TEA-linked series disagree) | Apparel Resources Jun 2026; Construction World Jul 2026 |
| Domestic sales | **~₹35,000 cr (FY26)**, up from ~₹27,000 cr (FY25); TEA says older ₹25,000 cr estimate was "too low" | Deccan Herald 2026; Apparel Resources |
| Combined turnover | > ₹70,000 cr | AEPC, May 2026 |
| Share of India's cotton knitwear exports | ~90 % | Upstox 2026 |
| Units | ~20,000: 2,500 knitting · 360 dyeing · 50 bleaching · 400 printing · 600 embroidery · 790 compacting · 2,500 exporters + 1,700 domestic/job-work stitchers · 11,100 ancillary | TEA via Upstox 2026 |
| Workforce | > 10 lakh direct, ~65 % women; ~half migrants (Bihar, Jharkhand, Odisha, UP) | AEPC 2026; ThePrint 2025 |
| Migrant owners | ~10 % of migrants now own units, mostly printing/cutting/stitching job work; some prefer Hindi-speaking clients | ThePrint 2024 |
| Domestic mix | ~60 % innerwear, 40 % outerwear; ~40 % now synthetic | Apparel Resources Oct 2025 |
| Fragmentation | "Most firms specialise in one or two activities and outsource the rest"; one order can pass through ~8 vendors; 40–60 % of WIP sits at partner units, tracked on WhatsApp groups, paper challans, Excel | Outlook Business; BEE cluster profile; vendor blog 2026 |
| Distress | ~25 % of small units shut in 2 years to 2024; ~500 of 2,500 export units closed in the 2025 US tariff shock | The Hindu 2024; PeopleMatters 2025 |
| Pivot | Exporters moving to domestic (e.g. one plans domestic share 20 % → 35–40 %) after US tariffs (50 % in Aug 2025, cut later) | Apparel Resources Jun 2026 |
| Input volatility | Cotton yarn up to ~₹400/kg in 2026 (+60 % per TEA); dyeing +₹10–20/kg in May 2026; LPG costs tripled | KNN Sep 2026; Apparel Resources |

### The chain and how it's priced

| Stage | Pricing | Indicative range (verify) |
|-------|---------|---------------------------|
| Yarn | ₹/kg by count | Combed 10s ₹224 → 40s ₹352 (May 2026), spikes to ~₹400 |
| Knitting (job work) | ₹/kg by structure | Single jersey low, rib higher, interlock highest (historic ₹15–35/kg) |
| Knitted fabric | ₹/kg | Cotton single jersey 180 GSM ~₹420–480/kg; poly-cotton ₹270–280/kg |
| Dyeing / bleaching | ₹/kg by shade | Light / medium / dark; dye-lot min ~150–200 kg/colour |
| Compacting | ₹/kg | ~₹6–10/kg |
| Printing | ₹/pc + screen setup | Single-colour screen ₹15–50 |
| Embroidery | ₹/placement by stitch count | ₹30–150 |
| Cut-make-trim (stitching) | ₹/pc | ₹15–50 depending on garment and quality |
| Finished goods (wholesale) | ₹/pc | Round-neck cotton tee ₹90–170 · printed tee ₹120–199 · polo ₹160–350 · track pants ₹129–250 · shorts ₹61–180 · briefs ₹25–75 · vests ₹35–66 · kids sets ₹89–285 · nightwear ₹150–300 · leggings ₹100–225 |

## D. How domestic wholesale trade works today

- **Traders control distribution:** a group of Tiruppur traders buy from producers and resell nationally, handling "nearly 75 %" of domestic volume. A producer: manufacturers are "handicapped by the lack of Hindi knowledge" (Swarajya 2019, single source). **This is the gap CLAIRE Connect closes.**
- **Channels:** local traders/consolidators → outstation buyers visiting Khaderpet / Erode's Gani market (₹5–10 lakh per visit, mostly cash) → WhatsApp/YouTube direct selling ("₹27 T-shirt", WhatsApp catalog numbers, minimum order ₹5,000–10,000) → agents met at fairs (CMAI North India Garment Fair had its first Tiruppur pavilion in Nov 2025) → lead platforms.
- **Remote ordering is rising:** during the 2026 election cash curbs, buyer visits to Gani market fell ~90 % and buyers switched to digital payments + parcel dispatch (DT Next, Apr 2026).
- **Catalogs:** photo/video carousels per design on WhatsApp broadcasts (256-contact cap, ban risk), Status and groups. Buyers reply with voice notes ("XL zyada chahiye", "rate kam karo").
- **Units of sale:** outerwear in **size sets** (e.g. M:L:XL:XXL = 2:2:2:1), innerwear by **dozen/box**, inputs by **kg**. MOQ from 10 pcs (ready stock) to 100/colour (custom) to 500–1,500+ (factory runs).
- **Negotiation:** per piece in ₹2–5 steps; associations revise rates together (TIDGMA +5 % in 2026, SIKMA +7 %).
- **Credit:** new buyers pay 50–100 % advance; trusted traders get 30–90 days and slippage is common; credit grows after ~3 clean orders. **Section 43B(h)** (pay micro/small manufacturers within 45 days or lose the tax deduction) cut some orders sharply (Erode -70 %). Surat's trade body logged 3,000+ payment complaints worth ~₹170 cr in one month; deals there now need "valid references".
- **Payments:** UPI P2P capped at ₹1 lakh/day, so big tickets go by NEFT/RTGS.
- **GST:** 5 % on garments ≤ ₹2,500/pc since 22 Sep 2025; textile job work 5 %. E-way bill for inter-state consignments > ₹50,000; TN exempts intra-state job-work movement.
- **Logistics:** courier ₹90–120/kg (≈ ₹20 per tee); surface parcel Tiruppur → Delhi ~₹14/kg, → Kolkata ~₹15/kg; courier 3–5 days, part-load 5–8 days. Buyers release payment against a photo of the LR + invoice.

## E. Competitors and the white space

| Platform | Why it doesn't solve this |
|----------|---------------------------|
| WhatsApp Business (catalog, broadcast, Business AI in Indian languages, QR pay) — **the real incumbent** | No discovery beyond your contacts, no size-set orders, no cross-language voice between two people, no reputation, no ledger, broadcast caps |
| IndiaMART / TradeIndia | Lead directories; leads shared with 10+ sellers; fake-lead complaints; no ordering, no trust ledger |
| Udaan | Carried credit risk for thin-margin retailers, exited lifestyle; parent faced insolvency → **don't lend from our balance sheet** |
| Meesho / GlowRoad | Single-piece B2C/reseller; price race; no wholesale relationships |
| Fashinza / Bizongo | Heavy managed B2B models burned capital → **stay asset-light** |
| Bijnis | Closest analog (factory → retailer, low MOQ) but **does not list Tiruppur** |
| ONDC B2B | Very low B2B volume so far; possible later integration |
| Tiruppur-native | **No domestic B2B app and no job-work marketplace found** |

## F. Design implications we adopted

1. Chat-first, WhatsApp-like, cards instead of carts; every catalog item shareable to WhatsApp.
2. Voice in, structured data out; always show what was understood.
3. Tamil · Hindi · English first, 10 languages supported; translation also inside the cluster (Tamil owner ↔ Hindi-speaking job-work owner).
4. Size sets, dozens and kg as first-class units; minimum order value.
5. Trust from records + references ("vouched by") + two-way ratings; credit ladder after 3 clean orders; 45-day alert.
6. Work orders double as digital challans for job work.
7. Asset-light business model: no inventory, no lending; partners for payments/credit later.

## G. Open questions for pilot partners (ask on Saturday)

1. Typical credit days by buyer region; how often payments slip.
2. Broker/agent commission in domestic trade; do agents vouch for buyers?
3. Standard size sets per product.
4. Current stitching CMT rates (tee, track pants, innerwear) and printing rates.
5. Which transporters/parcel services they use to the North and East; typical freight.
6. Would they let Claire auto-reply to buyers? What must never be automated?
7. How many of their buyers would try ordering through a chat link?
