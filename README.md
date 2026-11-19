# CLAIRE Connect

**The trade chat for India's garment supply chain.** Buyers and sellers find each other, negotiate and trade with trust, each in their own language. Built on the **Nexconn Chat SDK** for the Nexconn Build Challenge 2026 (Marketplace & Support track).

Tiruppur makes nearly 90% of India's cotton knitwear exports across ~20,000 small units, but trade still runs on phone calls and WhatsApp: Hindi-speaking buyers, Tamil-speaking makers, no prices, no trust signals. CLAIRE Connect puts an AI trade assistant, **Claire**, inside a translated trade chat.

## What it does

- **Ask Claire** in any language, by text or voice: "500 cotton T-shirts under ₹120". She asks one quick question and returns ranked suppliers, or splits a big order across 2–3 suppliers.
- **Results, Compare, Insights**: trust score, ratings, stock, ready-in days, side-by-side comparison, market price band and freight.
- **Deal rooms** (Nexconn group channels): every message translated for the reader, private negotiation tips from Claire (targeted messages), offer / counter-offer / order cards (custom messages), quick replies.
- **Orders** with GST, advance/balance steps and progress, plus **two-way ratings** (sellers on quality, buyers on paying on time).
- **Seller tools**: voice onboarding in Indian languages, catalogue from product photos, storefront.
- **Trade Desk**: human agent dispatch centre with a priority queue, language matching, AI summaries and one-click join into the deal room.
- **Multilingual UI** in English, Tamil and Hindi; chat translation for 10 Indian languages.

## Demo

- Video: [`demo-video/renders/CLAIRE-Connect-demo.mp4`](demo-video/renders/CLAIRE-Connect-demo.mp4)
- Demo accounts (OTP `123456`): Amit Hosiery, buyer `9000000001` · Lakshmi Garments, seller `9000000002` · Sree Textiles `9000000003` · Ravi Knit Fashions `9000000004` · Trade Desk agent Meena `9000000901`. Or tap **Explore as a demo business** on the sign-in screen.

## Run locally

Requires Node 22+ (24 recommended), a Nexconn app, MongoDB Atlas, OpenRouter and Sarvam keys.

```bash
npm install
cp server/.env.example server/.env   # then paste your keys
npm run dev                          # API :8787 + web :5173 → http://localhost:5173
```

Production (single service: the API also serves the built web app):

```bash
npm run build && npm start
```

## Stack

React 19 + Vite + Tailwind v4 (web) · Express + TypeScript (server) · **Nexconn Web Chat SDK** `@nexconn/chat` + Nexconn Server API · MongoDB Atlas · OpenRouter (Nemotron and free fallbacks) · Sarvam AI (speech-to-text / text-to-speech).

## Docs

| Doc | What it covers |
|---|---|
| [docs/HANDOVER.md](docs/HANDOVER.md) | **Start here**: architecture, setup, deployment, operations, known issues |
| [docs/BUILD_CONTRACT.md](docs/BUILD_CONTRACT.md) | API, message types and module contracts |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI rules, palette, components |
| [docs/01-research-brief.md](docs/01-research-brief.md) · [02-product-spec.md](docs/02-product-spec.md) | Market research and product spec |
| [docs/03-technical-design.md](docs/03-technical-design.md) · [04-build-plan.md](docs/04-build-plan.md) | Original planning design and sprint plan |
| [docs/flow-guide.html](docs/flow-guide.html) | Illustrated user-flow guide |
