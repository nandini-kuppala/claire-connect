# UI principles for the supply-chain screens

This is the do/don't list every new screen is checked against (BRIEF §8). It **extends `docs/DESIGN_SYSTEM.md` and the tokens in `web/src/index.css`; it doesn't fork them.**
- The research behind each rule, with confidence tags and all links, is in `research/ui-research.md`. The links below are the main sources.
- §4 is the checklist used to critique each mockup at 360–375 px (en + ta) and 1280 px.

---

## 1. Don't

| Don't | Why | Source |
|---|---|---|
| Purple/blue gradients, gradient text, glowing CTAs, glassmorphism, neon on dark | The most-cited "AI slop" tells; they also cost GPU on budget phones. The app already bans gradients and blue. | [Anthropic, Nov 2025](https://claude.com/resources/articles/improving-frontend-design-through-skills), [ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list) |
| ✨ sparkle icons, "AI-powered" badges, pulsing "Live/New" pills | Sparkle reads as "AI" but carries no meaning; it now signals "beta". Claire is a name, not a badge. | [Google Design sparkle study](https://design.google/library/ai-sparkle-icon-research-pozos-schmidt), [Big Medium](https://bigmedium.com/ideas/your-sparkles-are-fizzling.html) |
| Emoji as icons or in copy ("Welcome back, Ravi 👋") | Renders differently per Android OEM; looks unserious next to money and quantities. | [ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list) |
| The same radius + shadow on every element; cards nested in cards; equal card grids | Uniform treatment erases hierarchy. Use flat rows with hairlines; only sheets and toasts float. | [saasui.design](https://www.saasui.design/blog/saas-ui-looks-ai-generated), [noqta](https://noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026) |
| Feature grids of icons in tinted circles; centred everything | Slow to scan; generic. **Note:** `DESIGN_SYSTEM.md` §4 allows tinted icon tiles. Keep them on existing Home quick actions only, not in lists or reports. | [ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list) (opinion) |
| Walls of KPI tiles, gauges, progress rings | Numbers without target or "so what" are never used. Use bullet bars against a norm. | [Few](https://www.perceptualedge.com/blog/?p=1423), [Tableau bullet graphs](https://www.tableau.com/es-mx/blog/bullet-graphs-beat-gauge-charts) |
| Rainbow chart palettes; red vs green as the only difference | ~1 in 12 men can't tell them apart; WCAG 1.4.1. | [NEI](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness), [WCAG 1.4.1](https://w3.org/WAI/WCAG22/Understanding/use-of-color.html) |
| Sankey diagrams or two-axis Gantt for the order flow on mobile | Lay readers are overwhelmed, and a Sankey can't trace which lot became which. Use a stepped list. | [arXiv 2310.05752](https://arxiv.org/html/2310.05752v2), [NN/g mobile tables](https://www.nngroup.com/articles/mobile-tables/) |
| Pie/donut for owned vs held-for-others | Two numbers side by side are clearer. | research §4 (opinion) |
| Icon-only buttons, icon-only nav, hover-only tooltips | Few icons are universal; touch has no hover. | [NN/g icon usability](https://www.nngroup.com/articles/icon-usability/) |
| Vague or chatty copy ("Unlock insights", "Something went wrong", "Great question!") | Says nothing; erodes trust. | [saasui.design](https://www.saasui.design/blog/saas-ui-looks-ai-generated) |
| Fake typing delays or "thinking…" theatre | Slower bots *seem* smarter; faking it is manipulation. Show honest progress. | [NYU Tandon 2026](https://engineering.nyu.edu/news/faster-isnt-better-why-slower-chatbots-seem-more-intelligent) |
| Round or invented-looking numbers, lorem ipsum | One implausible number destroys trust in the rest. Use real-shaped data (198.6 kg). | research §1 |
| Gratuitous animation, shimmer everywhere, heavy webfonts, chart libraries | Budget phones and data-capped plans. | [Russell 2024](https://infrequently.org/2024/01/performance-inequality-gap-2024/), [Google NBU](https://design.google/library/connectivity-culture-and-credit) |
| Fixed-width or fixed-height text boxes, ALL CAPS labels, truncated button labels | Tamil runs long and has stacked vowel signs; it has no case. | [W3C text size](https://www.w3.org/International/articles/article-text-size/index.en) |
| Tamil digits, Western million grouping, `toLocaleString()` without a locale, `notation:'compact'` in ta-IN ("12மி") | Wrong numbers for this audience. | [Mozilla ta-IN guide](https://wiki.mozilla.org/L10n:Teams:ta-IN/styleguide), [W3C number format](https://www.w3.org/International/questions/qa-number-format) |

## 2. Do

| Do | Applied here | Source |
|---|---|---|
| **Number first, with unit, Indian grouping and age** | "402 pcs polo kits · since 12 Nov (9 days)". Our own lakh/crore formatter. | research rule 1; [W3C](https://www.w3.org/International/questions/qa-number-format) |
| **Status as text + colour + icon** | `.st` pills: Late 2 days ⏱, Due today, Ready to collect ✓, Held for dues, Disputed ⚖. | [WCAG 1.4.1](https://w3.org/WAI/WCAG22/Understanding/use-of-color.html) |
| **Lists for lookups; tables only where comparing columns** | Mobile: row = record (label left, number prominent, 1–2 facts below). Desktop ≥ 1024 px: real tables, frozen first column. | [NN/g mobile tables](https://www.nngroup.com/articles/mobile-tables/) |
| **A Khatabook-style ledger per counterparty** | "Sent / Got back" with a running "still with them" balance (S2). | [Khatabook](https://khatabook.com/blog/khatabook-app-features) |
| **One primary action per screen in a fixed bottom bar, in words** | Goods: **Record** + **Say it**; forms: **Save**. ≥ 48 px. | research rule 4 |
| **Every icon labelled** | The nav keeps labels; header icons get text ("Reports", "Find"); the mic says "Say it". | [NN/g](https://www.nngroup.com/articles/icon-usability/) |
| **Tamil as the layout's design language** | line-height ≥ 1.5 for ta/hi; labels wrap; status sits under the title, not in a squeezed right column; every mockup rendered in Tamil at 375 px. | [W3C](https://www.w3.org/International/articles/article-text-size/index.en) |
| **Western digits, DD Mon dates, relative age first** | "21 Nov" / "21 நவ." / "21 नव॰"; "2 days late". | [Mozilla ta-IN](https://wiki.mozilla.org/L10n:Teams:ta-IN/styleguide) |
| **Every Claire write via an editable card + Undo; voice shows its transcript** | §8.5 of `03-product-ux.md`. | [Microsoft HAX G9](https://www.microsoft.com/en-us/haxtoolkit/library/pattern/) |
| **Show the records behind an answer inline**, as tappable rows | Claire's answer table rows *are* the records; the source line says how many and as of when. | [NN/g explainable AI](https://nngroup.com/articles/explainable-ai/) |
| **Suggested-reply chips that fit the context** | Claire: What's late · Out with others · Coming in. Don't repeat ignored chips. | [NN/g chatbot guidelines, 2026](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/) |
| **Tap-to-start / tap-to-stop mic, long-press also accepted** | Matches Android Voice Access; WhatsApp users hold. | [Android Voice Access](https://support.google.com/accessibility/android/answer/6151843) |
| **Tap entry as fast as voice** | Recents, unit chips, number pad, size grid. Low-literacy users sometimes do better with keypads. | [Patel, Stanford](https://cs.stanford.edu/~neilp/pubs/patel-dissertation.pdf) |
| **WhatsApp share/remind as a one-tap action with pre-filled text in the contact's language** | Statement link; "Remind". | [Khatabook](https://khatabook.com/blog/khatabook-app-features), [OkCredit/Mixpanel](https://mixpanel.com/customers/okcredit-relies-on-mixpanel-to-increase-user-engagement-and-long-term-retention) |
| **Optimistic save with per-row sync state; "updated 10:42" on cached numbers** | Outbox (§6.4 of 03). | [web.dev offline UX](https://web.dev/articles/offline-ux-design-guidelines) |
| **Performance against the norm as bullet bars with sample size** | Performance report: "9 vs 7 days · 4 jobs". "Not enough history" below 3. | [Tableau](https://www.tableau.com/es-mx/blog/bullet-graphs-beat-gauge-charts) |
| **Flow as a vertical stepped list; branches as indented rows** | S9. | research §4 |
| **Copy in the trade's words** | "Sent to Noyyal Dyeing · 200 kg · 7 days ago", not "Recent activity". Empty states say the next action. | research §1 |
| **Language per person, not per app** | Tamil for capture screens (supervisors); owners may switch to English for reports. (OkCredit found 95 % chose English or Hindi; their users are not ours, but it's a warning against forcing Tamil.) | [OkCredit founder via StartupTalky](https://community.startuptalky.com/discussions/post/we-shut-down-okcredit-in-12-i-a18kbEQQJmE6lHJ) |

## 3. Budgets
- **JS:** new routes lazy-loaded; the Goods chunk ≤ 150 KB gzipped; no chart library.
  - The overall first-load target is ≤ 365 KiB compressed JS ([Russell 2024](https://infrequently.org/2024/01/performance-inequality-gap-2024/)). Today's app already exceeds it (1.49 MB bundle), which is a pre-existing debt noted for Phase 4. The feature must not add to the first load.
- **Statement link page:** < 50 KB, no framework.
- **Touch targets:** ≥ 44 px (Button), ≥ 48 px for the record bar and grid cells.
- **Animation:** ≤ 200 ms fades only.

## 4. Critique checklist (applied to every mockup)
1. Can I name the question this screen answers and the decision it supports?
2. Does every number have a unit? Are kg and pcs ever summed?
3. Is every status text + colour + icon?
4. Is there exactly one primary action, and is it a plain verb?
5. Does every icon have a visible label? The only exceptions are the back arrow and the chat composer's mic/send, which follow WhatsApp's convention and carry an `aria-label`.
6. Tamil at 375 px: nothing truncated, nothing clipped, no squeezed columns?
7. Desktop 1280 px: does the wide layout use the space (tables, two panes), or is it a stretched phone?
8. Any slop tell (§1)?
9. Are estimates marked (≈) and explained? Are both sides' numbers visible where they differ?
10. Privacy: could this screen show a price to staff or a physical-only party, or one principal's goods to another?
