# CLAIRE Connect — Nexconn Build Challenge 2026

**Voice-first, multilingual trade chat for the whole Tiruppur knitwear supply chain.**
Built on CLAIRE's WholeSale Connect idea, for the Nexconn Build Challenge (Marketplace & Support track).

> ⏰ **Submission deadline: Sunday 22 Nov 2026, 11:59 PM IST** — 4 days from 18 Nov. Plan in `04-build-plan.md` is a 4-day sprint.

## One-paragraph pitch

Tiruppur makes ~90 % of India's cotton knitwear exports and sells ~₹35,000 crore a year inside India, but that domestic trade runs on WhatsApp photo floods, phone calls and traders who sit in the middle because Tamil-speaking makers and Hindi/Bengali/Telugu-speaking buyers can't talk to each other. **CLAIRE Connect** puts every business in the chain — yarn agents, knitting and stitching units, garment makers, wholesalers and resellers — in one chat app where they buy and sell **by voice, in their own language**. Claire, the AI assistant, onboards a business from a 2-minute spoken conversation, turns WhatsApp photos into a catalog, and turns a buyer's one sentence ("1,000 cotton track pants under ₹170, Kolkata, 2 weeks") into matched sellers — combining 2–3 sellers when none can fill the order alone. Buyers and sellers negotiate with translated voice notes and offer cards, rate each other on quality and on paying on time, and reorder in one tap. When things go wrong, a Trade Desk agent who speaks both languages is dispatched into the same chat.

> **New here? Start with `HANDOVER.md` §0** (current status, priorities and next steps).

## Documents

| File | For | What's inside |
|------|-----|---------------|
| `01-research-brief.md` | Everyone, PDF write-up | Hackathon rules & judging, Nexconn capabilities and gaps, Tiruppur market and supply chain, how wholesale trade works, competitors, open questions |
| `02-product-spec.md` | Designers, all devs | Principles, personas, app map, onboarding, Claire's step-by-step conversation design, 9 user journeys, translation behaviour, matching & combo engine, trust score, Trade Desk |
| `03-technical-design.md` | Devs | Platform decisions, architecture, Nexconn feature map, key sequences, data model (SQL), REST API, chat message types, Claire orchestrator, AI layer, voice & translation pipeline, dispatcher, security, repo layout |
| `04-build-plan.md` | Team lead, everyone | Judging → plan, P0/P1/P2 scope with acceptance criteria, team split, day-by-day schedule, seed data, demo video script, PDF outline, form text, traction plan, risks |
| `flow-guide.html` | Quick visual understanding | Illustrated, one-page walkthrough of all flows (also published as an artifact) |

## Decisions already made (change only with a team discussion)

1. **Web PWA** (React + TypeScript) on the **Nexconn Chat SDK** directly — not Chat UI, not React Native (unsupported).
2. Deal chats are Nexconn **GroupChannels** shown as 1-on-1, so Claire can whisper and agents can join.
3. Translation via **Nexconn built-in translation** (client side), with numbers/trade terms masked and Claude as fallback.
4. Voice via **Sarvam AI** STT/TTS (Nexconn has no speech API).
5. AI via **Claude** (`claude-opus-5-5`) for extraction, vision cataloguing, auto-replies and ticket triage.
6. **No buyer/seller role choice** — every business can buy and sell; supply chain = same rails for products, materials and job-work services.
7. **Asset-light**: no inventory, no lending. Trust comes from records, references and two-way ratings.
8. **Traction is a feature**: real onboarding with pilot partners on Saturday/Sunday.

## Supply-chain ("Goods") feature
Built on branch `supply-chain`. Start with `docs/supply-chain/HANDOVER.md`, then `docs/supply-chain/PROGRESS.md`.
