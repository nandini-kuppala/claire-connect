# UI research: designing the supply-chain feature so it does not look AI-generated

**Research note for CLAIRE Connect supply-chain tracking.** Date: 2026-11-21.
**Users:** Tiruppur knitwear owners, supervisors and workers. They use budget Android phones on patchy 4G, many are Tamil-first, literacy is mixed, and they also use Hindi and English.
**Screens in scope:** record movement, inventory (owned vs held for others), "what's with whom", per-order flow, supplier/job-worker performance, and the Claire assistant.

**Tags.** **[verified]**: I read it in the linked source, or tested it myself. **[likely]**: comes from a search snippet, a secondary source, or a vendor or blog post, or several weaker sources agree. **[opinion]**: my design judgement. It has no direct evidence and should be tested with users.
**Source quality.** Section 1 rests mostly on practitioner blogs and community catalogues, because no peer-reviewed work on "AI slop" exists yet. Sections 3–5 rest on NN/g, W3C, Google and web.dev. Indian SME apps have published almost no design write-ups (none from Khatabook, OkCredit or Vyapar design teams), so section 2 relies on product pages, founder posts and our own [existing-software.md](existing-software.md).

---

## 1. What "AI slop" UI looks like (2025–2026), and what to do instead

**The pattern.** Anthropic's own write-up says models fall back on "Inter fonts", "purple gradients on white backgrounds", "predictable layouts and component patterns" and admin dashboards with "minimal visual hierarchy". It calls the combined result the "AI slop" aesthetic [verified] ([Anthropic, Nov 2025](https://claude.com/resources/articles/improving-frontend-design-through-skills)). The usual explanation is that the output converges on the statistical average of "modern web UI", and that Tailwind's default palette leans purple [likely, blogs] ([Laith wiki](https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design), [Canatselis](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c)).

**DON'T**
- **Use purple→blue / violet→indigo gradients, gradient text or glowing CTAs.** This is the most-cited single tell. The gradients signal nothing. [verified] ([Anthropic](https://claude.com/resources/articles/improving-frontend-design-through-skills)); [likely] ([noqta, Jun 2026](https://noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026), [ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list))
- **Use Inter (or Roboto/Arial) for everything, in uniform weights.** It reads as "default". For us, Inter has no Tamil glyphs anyway, so Tamil falls back to whatever font the phone has. [verified] ([Anthropic](https://claude.com/resources/articles/improving-frontend-design-through-skills)); fallback point [opinion]
- **Apply glassmorphism, glow rings, neon on dark, or animated rainbow borders.** They cost GPU on budget phones and hurt contrast. [likely] ([ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list)); perf point [opinion]
- **Put the same big radius and the same soft shadow on every card, button, input and badge.** Uniform treatment erases hierarchy. [likely] ([noqta](https://noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026), [ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list))
- **Nest cards in cards, or use equal-weight card grids** where a key number sits next to a vanity stat. "The fastest generated layout is a grid of equal cards, which flattens importance." [likely, blog] ([saasui.design, Jun 2026](https://www.saasui.design/blog/saas-ui-looks-ai-generated))
- **Use three equal feature cards, centred heroes, everything centred, or icon-in-a-tinted-circle grids.** Centred text is slow to scan in lists of numbers. [likely] ([ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list)); tinted-circle icons [opinion: widely mocked, no primary source found]
- **Use ✨ sparkle icons, "AI-powered" badges or pulsing "Live/New" pills.** Google's study of 2,000 people found the sparkle reads as "AI" but "doesn't always convey granular meaning" [verified] ([Google Design](https://design.google/library/ai-sparkle-icon-research-pozos-schmidt)). Josh Clark argues sparkles now signal "beta / probably broken" ("Drop the sparkles") [verified, opinion piece] ([Big Medium, Sep 2024](https://bigmedium.com/ideas/your-sparkles-are-fizzling.html)). Fake "Live" pills are listed in [noqta](https://noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026) [likely].
- **Use emoji as section icons or functional icons** (📦 Inventory, 🚚 Dispatch, "Welcome back, Ravi 👋"). Emoji render differently on every Android OEM, and they look unserious next to money. [likely] ([ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list)); OEM rendering point [opinion]
- **Write vague or over-friendly microcopy**: "Welcome back!", "Manage your inventory here", "Something went wrong", "Unlock insights", "Empower your supply chain". [likely] ([saasui.design](https://www.saasui.design/blog/saas-ui-looks-ai-generated), [ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list))
- **Show walls of KPI tiles with no target, comparison or "so what".** AI dashboards "often display raw numbers without targets, benchmarks, or trend indicators" [likely] ([BI book](https://ljkelly3141.github.io/bi-book/15.7-ai-in-dashboard-development.html)). Stephen Few: a dashboard that doesn't deliver what people need "will never be used, no matter how cute its gauges, meters, and traffic lights" [likely] ([Few PDF mirror](https://blogs.ischool.berkeley.edu/i247s13/files/2013/02/WhyMostDashboardsFail.pdf)).
- **Use speedometer gauges or decorative progress rings.** Few says most gauges should be "largely abandoned" and replaced by bullet graphs or plain bars. [likely] ([Perceptual Edge blog](https://www.perceptualedge.com/blog/?p=1423), [Tableau](https://www.tableau.com/es-mx/blog/bullet-graphs-beat-gauge-charts))
- **Use rainbow categorical chart palettes.** Red/green pairs fail for about 1 in 12 men of N. European ancestry, and for roughly 4–6.5% of men in other studied groups. [verified] ([NEI](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness)); [likely] ([JOSA review](https://pubmed.ncbi.nlm.nih.gov/22472762/), [MedlinePlus](https://medlineplus.gov/genetics/condition/color%2Dvision%2Ddeficiency/))
- **Use round, fake-looking numbers** ("10,000+ users", "100%") or demo data that looks invented. In an ops app, one implausible number destroys trust in all the others. [likely] ([ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list)); trust point [opinion]
- **Add gratuitous entrance animations, skeleton shimmer everywhere, or generic spinners.** Blank empty states and generic spinners are listed as tells. [likely] ([saasui.design](https://www.saasui.design/blog/saas-ui-looks-ai-generated))
- **Default to a "dashboard" when the task is a list or a form.** [likely] ([saasui.design](https://www.saasui.design/blog/saas-ui-looks-ai-generated))

**DO**
- **Choose a font for Tamil first** (see §3), then a Latin face that matches it. Distinct type is the cheapest anti-slop move. [opinion], aligned with [Anthropic](https://claude.com/resources/articles/improving-frontend-design-through-skills) [verified]
- **Use one neutral surface, one brand accent, and semantic colours that are reserved for status only.** Colour should mean something. [opinion]
- **Use flat rows with hairline dividers instead of floating cards.** Keep shadows for the one thing that floats (the bottom action bar or a sheet). [opinion]
- **Write copy in the domain's words**: "Sent to Murugan Dyeing · 200 kg · 4 days ago", not "Recent activity". Empty states say what to do next ("No dispatches yet. Record one by voice →"). [opinion]
- **Use real-shaped sample data** (odd quantities like 187.5 kg, real Tiruppur process names) in mocks and demos. [opinion]

---

## 2. Dense, practical ops UIs worth copying (with an Indian SME focus)

**DO**
- **Use a two-verb entry with a running balance.** Khatabook's whole model is "You Gave / You Got" + amount (+ optional bill photo), a per-customer transaction list, and a net balance. That maps directly to "Sent / Received" per counterparty with a running "with them now" balance. [verified] ([Khatabook blog, 2020](https://khatabook.com/blog/khatabook-app-features)). A Khatabook redesign doc shows money-in green and money-out red, and notes that colours were inconsistent across screens before [likely, unofficial] ([Notion](https://app.notion.com/p/Khatabook-App-Redesign-a1a010ff4f878248b10381340c5741d0)).
- **Make "share/remind on WhatsApp" a first-class row action.** Khatabook and OkCredit send reminder links via WhatsApp/SMS, so the counterparty needs no app. A red dot on "send reminder" lifted first-time use about 40% at OkCredit. [verified] ([Khatabook](https://khatabook.com/blog/khatabook-app-features)); [likely] ([Mixpanel case study](https://mixpanel.com/customers/okcredit-relies-on-mixpanel-to-increase-user-engagement-and-long-term-retention)); see also [channels-offline.md](channels-offline.md)
- **Keep one primary action per screen**, a fixed bottom bar such as "+ Record movement". The Khatabook and OkCredit pattern is one big entry button on every ledger. [opinion, consistent with the apps' public screenshots]
- **Use big numbers with units and direction**: "1,240 kg with Murugan Dyeing · since 12 Nov". Put the unit next to the number, never in a column header far away. [opinion]
- **Use thresholds instead of charts for "act now".** Vyapar sets a per-item minimum quantity and shows a Low Stock Summary list. Zoho Inventory's mobile app sends a notification when stock drops below the reorder level. [likely, vendor] ([Vyapar](https://vyaparapp.in/use-cases/low-stock-alerts), [Zoho](https://www.zoho.com/inventory/blog/zoho-inventory-comes-to-your-pocket-with-an-all-new-android-app.html))
- **Build a hierarchical record view with actions inline.** Zoho Inventory puts order → packages → invoices in one view, and "any action you need to take can be done right from within this interface". [verified] ([Zoho design process](https://www.zoho.com/blog/inventory/zoho-inventory-ui-ux-design-process.html))
- **Use step-by-step shipment status** (picked → in transit → delivered) rather than a map or diagram, as in logistics tracking UIs. [likely, portfolio pieces only] ([Zoho 10 years](https://www.zoho.com/blog/inventory/zoho-inventory-turns-ten.html), [Invenio](https://contra.com/p/OkLWkAeo-invenio-inventory-and-shipment-tracking-app-uiux))
- **Give regional-language audio confirmation for events that matter.** Paytm Soundbox and PhonePe SmartSpeakers announce payments in Tamil and other languages, so a busy merchant doesn't have to read the screen. This is an argument for an optional Tamil TTS read-back on "movement saved". [likely, news] ([The News Minute](https://www.thenewsminute.com/news/phonepe-smartspeakers-offers-voice-payment-notifications-tamil-malayalam-telugu-kannada-1), [TechCrunch](https://techcrunch.com/2023/09/04/indian-fintechs-amplify-sound-box-pitches-to-woo-merchants))
- **Use Tally's vocabulary for the accountant view** (Material Out / Material In, Stock with Job Worker). [verified] (see [existing-software.md](existing-software.md))
- **Treat language as a per-role decision, not dogma.** OkCredit cut from 14 languages to English + Hindi and reports that 95% of users chose those two [verified as reported; founder post] ([Pokharna via StartupTalky](https://community.startuptalky.com/discussions/post/we-shut-down-okcredit-in-12-i-a18kbEQQJmE6lHJ)). Earlier, though, the same company said most users were semi-literate and preferred their own language [likely] ([KrASIA](https://kr-asia.com/indian-mom-and-pop-stores-use-okcredit-to-digitize-sales-records-startup-stories)). For us: Tamil is non-negotiable for capture screens used by supervisors and loaders, and owners may switch to English for analytics. [opinion]

**DON'T**
- **Don't copy Western SaaS ERP density** (sidebars, 12-column tables, filter panels) onto the phone. Zoho's mobile app is a reduced view, not a squeezed web app. [opinion]
- **Don't make the user build masters (items, BOMs, ledgers) before the first record.** [likely] (see [existing-software.md](existing-software.md) "Setup before value")
- **Don't expect published design case studies to exist.** I found none from Khatabook, OkCredit, Vyapar, myBillBook, Tally, PhonePe Business, Shiprocket or Delhivery. The only first-party ones are an old Zomato merchant-app write-up ([UX Planet, 2018](https://uxplanet.org/building-the-zomato-app-for-merchants-to-receive-online-orders-20efc6039c7)) and Zoho's. Inspect the real apps on a budget phone instead. [verified, absence after searching]

---

## 3. Low literacy, Tamil script and budget Android

**DO**
- **Label every icon with text, visibly and always.** NN/g: a text label "must be present alongside an icon". Few icons are universal (home, search, print), and hover tooltips don't exist on touch. [verified] ([NN/g Icon Usability](https://www.nngroup.com/articles/icon-usability/)). Google NBU: "Combine icons with text labels" and localise icon meaning [likely] ([Google Design, Medium](https://medium.com/google-design/improving-comprehension-through-intuitive-actions-f7e6336e12e6))
- **Minimise typed input.** Offer pickers, recent values, steppers and voice, and avoid hierarchies "understood only through language". [verified] ([Google NBU, Connectivity, Culture and Credit](https://design.google/library/connectivity-culture-and-credit)). Microsoft Research found text-only UIs "unusable by first-time low-literacy users". [likely] ([Medhi et al., ToCHI](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ToCHI2711_Medhi.pdf))
- **Design for Tamil string length, not English.** W3C: strings under 10 characters can grow 200–300% in translation, and "the smaller the source message, the higher the likely translation length". [verified] ([W3C](https://www.w3.org/International/articles/article-text-size/index.en)). Tamil specifically: practitioners report it running longer than German [likely, anecdotal] ([eChai summary](https://echai.ventures/startingup/r/why-text-expansion-breaks-your-ui-and-how-to-fix-it--r-why-text-expansion-breaks-your-ui-and-ho)). No measured percentage exists. **Test with the real ta.json.** Let buttons wrap to two lines rather than truncate. [opinion]
- **Give Tamil more line height.** W3C: non-Latin scripts "often require more vertical space between lines" (Thai uses about 150%). Google's font guide says Indic scripts with stacked marks break Latin-tuned metrics. [verified] ([W3C](https://www.w3.org/International/articles/article-text-size/index.en)); [likely] ([Google Fonts metrics guide](https://googlefonts.github.io/gf-guide/metrics.html), [Typedrawers, Tamil/Latin metrics](https://typedrawers.com/discussion/comment/59559)). Start at line-height 1.5–1.6 for Tamil body text and never use fixed-height rows that clip. [opinion]
- **Choose fonts with real Tamil + Latin pairing.** Noto Sans Tamil (multiple weights, unmodulated), Hind Madurai (designed for UI, Tamil + Latin, ITF), Mukta Malar (Ek Type, matches Latin weight) and Anek Tamil (variable) are all on Google Fonts. Note that plain "Mukta" and "Hind" are Devanagari-oriented. The Tamil cuts are *Mukta Malar* and *Hind Madurai*. [likely] ([Adobe: Hind Madurai](https://fonts.adobe.com/fonts/hind-madurai), [Fontsource: Noto Sans Tamil](https://fontsource.org/fonts/noto-sans-tamil/about), [fonttamil list](https://fonttamil.com/blog/10-best-free-tamil-google-fonts.html)). Subset and self-host one Tamil family, with two weights at most. [opinion]
- **Use Western Arabic digits 0–9 in the Tamil UI.** Tamil numerals have "mostly been supplanted by Arabic numerals in common usage". Mozilla's ta-IN guide mandates international digits. `Intl.NumberFormat('ta-IN')` resolves to `latn` digits by default. [likely] ([Wikipedia](https://en.wikipedia.org/wiki/Tamil_numerals)); [verified] ([Mozilla ta-IN style guide](https://wiki.mozilla.org/L10n:Teams:ta-IN/styleguide)); [verified, tested in Node 18 ICU]
- **Use Indian digit grouping everywhere**: 1,23,45,678 and ₹1,23,45,678.50. W3C documents 2-digit secondary grouping for India. `en-IN`, `ta-IN` and `hi-IN` all produce it via `Intl`. [verified] ([W3C](https://www.w3.org/International/questions/qa-number-format)); tested locally
- **Watch compact notation.** `ta-IN` compact gives "12மி" (millions), while `en-IN` gives "1.2Cr". Write your own lakh/crore formatter (e.g. "1.23 லட்சம்" / "1.23 L") instead of `notation:'compact'`. [verified, tested locally]
- **Use DD/MM/YYYY or "21 நவ. 2026"**, never US order. Prefer relative age for ops ("4 நாள் முன்பு / 4 days ago") with the absolute date on tap. `Intl.DateTimeFormat('ta-IN')` gives 21/11/2026. Mozilla's ta guide uses day-month-year. [verified] ([Mozilla](https://wiki.mozilla.org/L10n:Teams:ta-IN/styleguide)); tested locally
- **Use tabular numerals and right-align numbers in lists** so quantities line up (`font-variant-numeric: tabular-nums`). [verified] ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)); right-align [likely] ([Material data tables](https://material.io/components/data-tables))
- **Make tap targets ≥48×48 dp with ~8 dp spacing.** That's Android/Material. WCAG 2.2 AA's floor is only 24×24 CSS px. [likely] ([Android a11y help](https://support.google.com/accessibility/android/answer/7101858)); [verified] ([WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html))
- **Set a performance budget for a $100–150 Android.** Russell's 2024 baseline is a Galaxy A51-class phone at 7.2 Mbps / 94 ms RTT. A 3 s first load allows about 730 KiB total with ≤365 KiB of compressed JS for a JS app, and JS costs about 3× more per byte than HTML/CSS/images. [verified] ([Russell, Performance Inequality Gap 2024](https://infrequently.org/2024/01/performance-inequality-gap-2024/)). Tiruppur workers' phones are likely below this baseline. Entry-level supply in India is also shrinking, with phones above ₹20k shipping with 4 GB RAM [likely] ([Digit 2026](https://www.digit.in/features/mobile-phones/why-your-next-phone-will-cost-more-and-do-less-state-of-the-smartphone-industry-2026.html), [Beebom](https://gadgets.beebom.com/stories/budget-phones-are-getting-worse-i-think-android-go-can-fix-them))
- **Lazy-load analytics routes and draw charts as plain SVG/CSS bars**, rather than shipping a general chart library in the main bundle. [opinion, follows from the budget above]
- **Use offline / patchy-network patterns**: say whose fault an outage is; tell users what happens to queued work ("Will send when network returns"); show sync state without nagging; show the "last updated" time on cached numbers; and don't grey out the whole UI, only what needs the network. [verified] ([web.dev Offline UX guidelines](https://web.dev/articles/offline-ux-design-guidelines)). Queue requests and keep core functions offline [likely] ([Android "Building for Billions"](https://android-developers.googleblog.com/2016/06/building-for-billions.html)). Outbox design: see [channels-offline.md](channels-offline.md).
- **Save optimistically, with a per-row state**: "Saved on phone · sending…" → "Sent ✓" → "Failed – tap to retry". [opinion, consistent with web.dev]

**DON'T**
- **Don't use icon-only bottom navs, icon-only row actions or hamburger-hidden primary features.** [verified] ([NN/g](https://www.nngroup.com/articles/icon-usability/))
- **Don't use Tamil digits (௧௨௩), Western million/billion grouping, or `toLocaleString()` without an explicit locale.** A phone set to en-US would show 12,345,678. [verified, tested]
- **Don't hard-code widths or heights for labels, or use ALL-CAPS labels.** Tamil has no case, and fixed boxes clip vowel signs. [opinion]
- **Don't put heavy webfonts, background polling or autoplaying media on data-capped plans.** Users are sensitive to data cost: show sizes and offer low-data modes. [verified] ([Google NBU](https://design.google/library/connectivity-culture-and-credit), [web.dev](https://web.dev/articles/offline-ux-design-guidelines))

---

## 4. Data visualisation for operations

**DO**
- **Use lists or tables for "look up a value", and charts only for "see a shape" (a trend or comparison).** Most of our screens are lookups ("how much is with Murugan?"), so they are lists. [opinion, standard dataviz practice]
- **Turn tables into "row = record" lists on mobile.** A row has a primary label on the left and the key number right-aligned, with 1–2 secondary facts below. If a real table is needed, freeze the first column, keep headers visible, make horizontal scroll obvious (cut-off column), and let users pick columns. Users struggle beyond about 6 columns on any screen. [verified] ([NN/g Mobile Tables](https://www.nngroup.com/articles/mobile-tables/)); [likely] ([UXmatters](https://www.uxmatters.com/mt/archives/2020/07/designing-mobile-tables.php)). SAP Fiori: "sometimes, a solution without a table is more useful" [likely] ([Fiori](https://www.sap.com/design-system/fiori-design-web/v1-148/ui-elements/responsive-table/usage))
- **Show status as text + colour + shape**: "● Overdue 6 days", "◐ Part received", "✓ Closed". WCAG 1.4.1 requires information "in addition to color, such as shape or text". [verified] ([WCAG 1.4.1](https://w3.org/WAI/WCAG22/Understanding/use-of-color.html))
- **Use a colour-blind-safe palette with few colours.** Blue is the safest hue. Pair blue with orange or red, vary lightness (check the chart in greyscale), and label lines directly instead of using a legend. [verified] ([Datawrapper, Muth 2020](https://www.datawrapper.de/blog/colorblindness-part2)). Okabe–Ito is the standard categorical set if you need more than 3 categories [likely] ([R thematic docs](https://rdrr.io/github/rstudio/thematic/man/okabe_ito.html))
- **Compare suppliers and job workers with sorted horizontal bars or bullet graphs**: on-time %, average turnaround days vs promised, and process loss % vs norm. Each bar is labelled with the value and the sample size ("12 lots"). [likely] ([Tableau, bullet graphs](https://www.tableau.com/es-mx/blog/bullet-graphs-beat-gauge-charts)); sample-size label [opinion]
- **Show per-order flow as a vertical stepped list (swimlane by stage)**: Knitting → Dyeing → Compacting → Cutting → Stitching. Each step shows who has it, qty sent/received, loss, and days. Partial splits appear as indented sub-rows. Mobile Gantt products collapse to a grid or list with the chart on demand, and users mostly want to view, not edit, on the phone. [likely, vendor docs] ([SVAR compact mode](https://docs.svar.dev/svelte/gantt/guides/compact_mode/), [DHTMLX responsive](https://docs.dhtmlx.com/gantt/guides/responsive-ui/), [monday community](https://community.monday.com/t/using-gantt-charts-on-mobile-phone/123308))
- **If a timeline is needed, make it one horizontal strip per lot** (expected vs actual bar) that scrolls vertically. Never use a two-axis pan/zoom Gantt. [opinion]

**DON'T**
- **Don't use Sankey diagrams as the per-order view on mobile.** The evidence is mixed. Lay readers in one study found a Sankey easier than a stacked bar, but were "overwhelmed by the amount of data". Donors understood Sankeys better only after being taught how to read them. A standard Sankey "does not preserve the history of links", so you can't trace which input lot became which output. That traceability is exactly what a per-order flow needs. [likely] ([arXiv 2310.05752](https://arxiv.org/html/2310.05752v2), [NCCU thesis](https://thesis.lib.nccu.edu.tw/thesis/detail/9b47d124d3ec957e9af8638320a636a9), [hierarchical Sankey, NSF](https://par.nsf.gov/servlets/purl/10314748)). Mobile width makes it worse. [opinion] If you want one, offer it as an optional owner-level desktop view.
- **Don't use pie or donut charts for owned vs held-for-others.** Two numbers side by side are clearer. [opinion]
- **Don't rely on hover tooltips to reveal values.** Touch has no hover. [likely] ([Morningstar DS](https://designsystem.morningstar.com/legacy/v/2.34.0/ux-patterns/responsive-data-tables.html))
- **Don't show red/green as the only difference between "received" and "sent"**, or use colour-only map pins or dots. [verified] ([WCAG 1.4.1](https://w3.org/WAI/WCAG22/Understanding/use-of-color.html))

---

## 5. A conversational assistant (Claire) that isn't slop

**DO**
- **Have every write go through a confirmation card.** Claire drafts a structured card (what, qty + unit, from → to, lot/colour/size, expected date) with editable fields and one "Save" button. Nothing is written until the tap, and there's an Undo after saving. This matches HAX G9 "support efficient correction" (rich edits, undo automated actions). [likely] ([Microsoft HAX patterns](https://www.microsoft.com/en-us/haxtoolkit/library/pattern/)); and the [BRIEF](../BRIEF.md) requirement [verified]
- **Show the records behind every answer.** "Murugan has 1,240 kg" should be followed by the 3 movements that make up that total, each tappable. Users rarely check citations, so put the evidence inline and in a separate block from the prose, not behind a link. [likely] ([NN/g Explainable AI](https://nngroup.com/articles/explainable-ai/)). PAIR: don't show the "what" without the "why" when stakes are high [likely] ([PAIR Explainability + Trust](https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20Explainability%20+%20Trust.pdf))
- **Offer clickable suggested replies/chips** that fit the context ("Record dispatch", "What's with Murugan?", "Overdue lots"). Don't repeat chips the user has ignored. [verified] ([NN/g, 10 chatbot guidelines, Apr 2026](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/), [NN/g prompt suggestions](https://www.nngroup.com/articles/prompt-suggestions/))
- **State Claire's capabilities in the opening line, specific to the screen, without overpromising.** Use progressive disclosure for long answers, don't autoscroll during the response, and allow sharing an answer (e.g. to WhatsApp). [verified] ([NN/g](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/)); HAX G1 [likely] ([HAX](https://www.microsoft.com/en-us/haxtoolkit/library/example,guideline,pattern/3/26/))
- **Make voice one tap away, with a large, standard mic icon**, and support natural pauses and code-mixing (Tamil + English words like "single jersey", "kg"). [verified] ([Google voice-first playbook, 2021](https://blog.google/technology/next-billion-users/voice-users-playbook/))
- **Show the transcript, then the draft card, before saving.** Let the user fix a misheard number by tapping the field, not by re-recording. [opinion, follows HAX G9]. WhatsApp itself now shows voice-note transcripts in India [likely] ([Business Standard](https://business-standard.com/amp/technology/tech-news/whatsapp-starts-rolling-out-voice-message-transcripts-in-india-how-to-use-125022600312_1.html))
- **Default the mic to tap-to-start / tap-to-stop, with auto-stop on silence.** Android Voice Access defaults to tap-to-toggle and offers hold as an option. Holding is tiring for long dictation and hard for limited dexterity. Workers in Tiruppur are used to WhatsApp's hold-to-record, so accept a long-press too. [likely] ([Android Voice Access](https://support.google.com/accessibility/android/answer/6151843), [AppleVis thread](https://www.applevis.com/comment/48025)); WhatsApp habit [opinion]
- **Keep a non-voice path that is just as fast**: chips, steppers and number pads. A Stanford study found low-literacy users did better with, and preferred, touchtone over speech input. Voice is not automatically better. [likely] ([Patel dissertation](https://cs.stanford.edu/~neilp/pubs/patel-dissertation.pdf)). Voice notes are, however, the dominant habit in these communities [likely] ([ThePrint](https://theprint.in/ground-reports/voice-based-banking-for-low-literate-indians/2610584))
- **Offer Tamil TTS read-back of the saved record** ("Murugan Dyeing-க்கு 200 கிலோ அனுப்பப்பட்டது"). [opinion; cf. soundbox precedent in §2]

**DON'T**
- **Don't fake typing theatrics or add artificial delays.** Research shows typing indicators and slower replies make bots seem more human and "more useful". A 9-second delay scored highest in an NYU study. That makes faking delays a trust manipulation, not a feature. Stream real tokens, or show honest progress ("Checking 14 movements…"). [likely] ([NYU Tandon, Apr 2026](https://engineering.nyu.edu/news/faster-isnt-better-why-slower-chatbots-seem-more-intelligent), [arXiv 2510.08912](https://arxiv.org/html/2510.08912v1)); recommendation [opinion]
- **Don't give Claire a sparkle avatar, gradient bubble or "AI-powered" label.** Name it Claire and show what it can do. [verified] ([Big Medium](https://bigmedium.com/ideas/your-sparkles-are-fizzling.html), [Google sparkle study](https://design.google/library/ai-sparkle-icon-research-pozos-schmidt))
- **Don't let Claire write silently, write from a chat message without a card, or give answers that can't be traced to records.** [opinion, follows HAX G9 / PAIR]
- **Don't send long spoken or written paragraphs.** Break them into short sentences for TTS. [verified] ([Google voice playbook](https://blog.google/technology/next-billion-users/voice-users-playbook/))
- **Don't use chatty filler** ("Great question! 😊", "I'd be happy to help!"). Answer with the number first. [opinion]

---

## Top 15 rules for CLAIRE supply-chain screens

1. **Number first, with unit, Indian grouping and age**: "1,240 kg · with Murugan Dyeing · 9 days". Use custom lakh/crore formatting, never `notation:'compact'` for ta-IN. (§3)
2. **Show every status as text + colour + shape.** Use red/green only together with a word. (§4, WCAG 1.4.1)
3. **Use lists, not tables or charts, for lookups.** If a table is unavoidable: ≤4 columns, frozen first column, visible header. (§4, NN/g)
4. **Have one primary action per screen in a fixed bottom bar**, ≥48 dp tall, labelled in words. (§2, §3)
5. **Never use an icon alone.** Every icon has a visible Tamil/English label. No emoji as icons. (§1, §3)
6. **Treat Tamil as the layout's design language**: line-height ≥1.5, no fixed-height text boxes, labels may wrap to two lines, and test with real ta.json before sign-off. (§3)
7. **Use one Tamil-capable font family** (Noto Sans Tamil, Hind Madurai or Mukta Malar), self-hosted and subset to ≤2 weights. No Inter. (§1, §3)
8. **Route every Claire write through an editable confirmation card + Undo**, and keep a visible transcript for voice. (§5)
9. **Show the records behind every Claire answer** as tappable movement rows, not footnote links. (§5)
10. **Have no sparkles, gradients, glassmorphism, neon or "AI-powered" badges**, and no fake typing delays. (§1, §5)
11. **Save optimistically with a visible per-row sync state** ("on phone · sending · sent · failed–retry") and "updated 5 min ago" on cached totals. (§3, web.dev)
12. **Keep a JS budget of ≤365 KiB compressed for first load**, with analytics routes lazy-loaded and charts drawn as hand-rolled SVG bars. Test on a ₹8–10k Android on throttled 4G. (§3, Russell)
13. **Show the per-order flow as a vertical stepped list by stage**, with qty sent/received/lost per step. No Sankey or Gantt on mobile. (§4)
14. **Show supplier performance as sorted bars with the sample size** and a target line (bullet-graph style). No gauges, rings or KPI-tile walls. (§1, §4)
15. **Make WhatsApp share/remind a one-tap row action** with prefilled Tamil text, and give voice and tap-entry equal footing. Voice is not automatically better. (§2, §5)

---

## Sources

**Primary / official**
- Anthropic, Improving frontend design through Skills (Nov 2025): https://claude.com/resources/articles/improving-frontend-design-through-skills
- Google Design, All That Sparkles Is AI (Pozos, Schmidt): https://design.google/library/ai-sparkle-icon-research-pozos-schmidt
- Google NBU, Connectivity, Culture and Credit: https://design.google/library/connectivity-culture-and-credit
- Google, Voice-first playbook (2021): https://blog.google/technology/next-billion-users/voice-users-playbook/
- Google Design, Improving comprehension through intuitive actions: https://medium.com/google-design/improving-comprehension-through-intuitive-actions-f7e6336e12e6
- Android Developers, Building for Billions (2016): https://android-developers.googleblog.com/2016/06/building-for-billions.html
- Android accessibility, touch target size: https://support.google.com/accessibility/android/answer/7101858
- Android Voice Access settings: https://support.google.com/accessibility/android/answer/6151843
- web.dev, Offline UX design guidelines: https://web.dev/articles/offline-ux-design-guidelines
- W3C WCAG 2.2, 1.4.1 Use of Color: https://w3.org/WAI/WCAG22/Understanding/use-of-color.html
- W3C WCAG 2.2, 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C i18n, Text size in translation: https://www.w3.org/International/articles/article-text-size/index.en
- W3C i18n, Number, currency and unit formatting: https://www.w3.org/International/questions/qa-number-format
- Mozilla ta-IN localisation style guide: https://wiki.mozilla.org/L10n:Teams:ta-IN/styleguide
- Google Fonts, vertical metrics guide: https://googlefonts.github.io/gf-guide/metrics.html
- MDN, font-variant-numeric: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Material, data tables: https://material.io/components/data-tables
- NEI, Color blindness: https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness
- MedlinePlus, colour vision deficiency: https://medlineplus.gov/genetics/condition/color%2Dvision%2Ddeficiency/
- Birch, worldwide prevalence of red-green deficiency (JOSA A 2012): https://pubmed.ncbi.nlm.nih.gov/22472762/
- Microsoft HAX Toolkit patterns: https://www.microsoft.com/en-us/haxtoolkit/library/pattern/
- Google PAIR, Explainability + Trust: https://pair.withgoogle.com/chapter/People%20+%20AI%20Guidebook%20-%20Explainability%20+%20Trust.pdf
- Khatabook, app features (2020): https://khatabook.com/blog/khatabook-app-features
- Zoho Inventory, UI/UX design process: https://www.zoho.com/blog/inventory/zoho-inventory-ui-ux-design-process.html
- Zoho Inventory, Android app: https://www.zoho.com/inventory/blog/zoho-inventory-comes-to-your-pocket-with-an-all-new-android-app.html
- Zoho Inventory, 10 years: https://www.zoho.com/blog/inventory/zoho-inventory-turns-ten.html
- Vyapar, low stock alerts: https://vyaparapp.in/use-cases/low-stock-alerts

**Research**
- NN/g, Icon Usability (Harley 2014): https://www.nngroup.com/articles/icon-usability/
- NN/g, Mobile Tables (Schade 2017): https://www.nngroup.com/articles/mobile-tables/
- NN/g, 10 Guidelines for AI Chatbots (Apr 2026): https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
- NN/g, Explainable AI: https://nngroup.com/articles/explainable-ai/
- NN/g, Prompt suggestions: https://www.nngroup.com/articles/prompt-suggestions/
- Medhi et al., low-literacy UI (ToCHI): https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ToCHI2711_Medhi.pdf
- Patel, Stanford dissertation (speech vs touchtone): https://cs.stanford.edu/~neilp/pubs/patel-dissertation.pdf
- Public understanding of charts incl. Sankey (arXiv 2310.05752): https://arxiv.org/html/2310.05752v2
- Sankey vs financial reports, NCCU thesis: https://thesis.lib.nccu.edu.tw/thesis/detail/9b47d124d3ec957e9af8638320a636a9
- Hierarchical Sankey (NSF PAR): https://par.nsf.gov/servlets/purl/10314748
- Human-like typing in agents (arXiv 2510.08912): https://arxiv.org/html/2510.08912v1
- NYU Tandon, slower chatbots seem smarter (Apr 2026): https://engineering.nyu.edu/news/faster-isnt-better-why-slower-chatbots-seem-more-intelligent
- Russell, Performance Inequality Gap 2024: https://infrequently.org/2024/01/performance-inequality-gap-2024/
- Datawrapper, colour-blind-friendly charts (Muth 2020): https://www.datawrapper.de/blog/colorblindness-part2
- Stephen Few, Why Most Dashboards Fail (mirror): https://blogs.ischool.berkeley.edu/i247s13/files/2013/02/WhyMostDashboardsFail.pdf
- Few on gauges (Perceptual Edge): https://www.perceptualedge.com/blog/?p=1423
- UXmatters, Designing mobile tables: https://www.uxmatters.com/mt/archives/2020/07/designing-mobile-tables.php

**Blogs, community, news (weaker; used for "slop" catalogue and Indian-app context)**
- Big Medium, Your sparkles are fizzling (Clark 2024): https://bigmedium.com/ideas/your-sparkles-are-fizzling.html
- saasui.design, Why SaaS UI looks AI-generated (Jun 2026): https://www.saasui.design/blog/saas-ui-looks-ai-generated
- noqta, AI design slop patterns (Jun 2026): https://noqta.tn/blog/ai-design-slop-overused-ui-patterns-fix-2026
- Laith ux-skill wiki, anti-slop ban list: https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list
- Canatselis, Spot the slop: https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c
- BI book, AI in dashboard development: https://ljkelly3141.github.io/bi-book/15.7-ai-in-dashboard-development.html
- Tableau, bullet graphs beat gauges: https://www.tableau.com/es-mx/blog/bullet-graphs-beat-gauge-charts
- Pokharna (OkCredit) on dropping 12 languages: https://community.startuptalky.com/discussions/post/we-shut-down-okcredit-in-12-i-a18kbEQQJmE6lHJ
- KrASIA, OkCredit: https://kr-asia.com/indian-mom-and-pop-stores-use-okcredit-to-digitize-sales-records-startup-stories
- Mixpanel, OkCredit case study: https://mixpanel.com/customers/okcredit-relies-on-mixpanel-to-increase-user-engagement-and-long-term-retention
- Khatabook redesign (Notion, unofficial): https://app.notion.com/p/Khatabook-App-Redesign-a1a010ff4f878248b10381340c5741d0
- The News Minute, PhonePe SmartSpeakers in Tamil: https://www.thenewsminute.com/news/phonepe-smartspeakers-offers-voice-payment-notifications-tamil-malayalam-telugu-kannada-1
- TechCrunch, Indian soundbox devices (2023): https://techcrunch.com/2023/09/04/indian-fintechs-amplify-sound-box-pitches-to-woo-merchants
- ThePrint, voice banking for low-literate Indians: https://theprint.in/ground-reports/voice-based-banking-for-low-literate-indians/2610584
- Business Standard, WhatsApp voice transcripts in India: https://business-standard.com/amp/technology/tech-news/whatsapp-starts-rolling-out-voice-message-transcripts-in-india-how-to-use-125022600312_1.html
- UX Planet, Zomato merchant app (2018): https://uxplanet.org/building-the-zomato-app-for-merchants-to-receive-online-orders-20efc6039c7
- Invenio portfolio (shipment tracking UI): https://contra.com/p/OkLWkAeo-invenio-inventory-and-shipment-tracking-app-uiux
- SVAR Gantt compact mode: https://docs.svar.dev/svelte/gantt/guides/compact_mode/ ; DHTMLX responsive: https://docs.dhtmlx.com/gantt/guides/responsive-ui/
- monday.com community, Gantt on mobile: https://community.monday.com/t/using-gantt-charts-on-mobile-phone/123308
- SAP Fiori responsive table: https://www.sap.com/design-system/fiori-design-web/v1-148/ui-elements/responsive-table/usage
- Morningstar DS, responsive data tables: https://designsystem.morningstar.com/legacy/v/2.34.0/ux-patterns/responsive-data-tables.html
- AppleVis, push-to-talk modes: https://www.applevis.com/comment/48025
- Tamil fonts: https://fonts.adobe.com/fonts/hind-madurai ; https://fontsource.org/fonts/noto-sans-tamil/about ; https://fonttamil.com/blog/10-best-free-tamil-google-fonts.html
- Typedrawers, Tamil/Latin vertical metrics: https://typedrawers.com/discussion/comment/59559
- Tamil numerals (Wikipedia): https://en.wikipedia.org/wiki/Tamil_numerals
- eChai, text expansion (Tamil anecdote): https://echai.ventures/startingup/r/why-text-expansion-breaks-your-ui-and-how-to-fix-it--r-why-text-expansion-breaks-your-ui-and-ho
- Digit, smartphone industry 2026: https://www.digit.in/features/mobile-phones/why-your-next-phone-will-cost-more-and-do-less-state-of-the-smartphone-industry-2026.html ; Beebom: https://gadgets.beebom.com/stories/budget-phones-are-getting-worse-i-think-android-go-can-fix-them
- R thematic, Okabe–Ito: https://rdrr.io/github/rstudio/thematic/man/okabe_ito.html
