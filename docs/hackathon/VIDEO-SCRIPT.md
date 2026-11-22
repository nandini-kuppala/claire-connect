# CLAIRE Connect: hackathon video (v2, the production script)

**v3 (owner's corrections, 22 Nov evening):**
- **Deal in Hindi and Tamil:** Amit uses the app in Hindi, Lakshmi in Tamil, and the phones stay in the same positions. The labels now say "Amit's phone" and "Lakshmi's phone".
- **The deal:**
  1. Lakshmi quotes ₹98.
  2. A sample is delivered to Amit's door.
  3. He asks for the maximum discount on 1,000 pieces.
  4. Claire's private tip: sellers settle 3–6 % lower (₹92–95.5), so offer ₹90.
  5. Lakshmi counters at ₹94 (4 % under list) and the order with GST appears on both phones.
  6. The voiceover adds that two people without a shared language closed a deal.
- **New ratings scene:** Lakshmi's seller rating and Amit's buyer rating, side by side.
- **Bridge animation:** reworded to "bridge the gap between buyers and sellers". The tiles turn into circles, are absorbed into the centre, and the logo pops up higher.
- **WhatsApp cards:** now read "Can you send photos?" and "Price for 500 pieces?".
- **Hand-off scene:** both phones end on 200 sent / 198 received.
- **Flow scene:** shows the redesigned Overview, Stages and Buyers tabs.
- **Wording:** "from his own records" and "most of its businesses are small".
- **Length:** 3:41.
- **The scene and voiceover lines below are v2.** The current lines are in `demo-video/v2/segments.json`.


v1 was reviewed by the owner on 22 Nov. This version:
- opens with researched market facts and the real pain (trade fairs, unsold stock, WhatsApp selling);
- explains the app in simple words before the demo;
- shows two phones side by side for live chat;
- includes the sample → bulk order story;
- shows the supply chain animated backwards from the order;
- keeps the Trade Desk short and near the end, Nexconn short, and market potential last;
- uses a simple end card.

**Voice:** Neerja plain (`en-IN-NeerjaNeural`), about 1.3× the old pace (edge-tts rate +25 %).
**Length:** about 3:15 (cap 3:30).
**Look:** the same brand as the old video (white, logo teal `#3DB394`, Bricolage Grotesque and Figtree). Illustrations are animated HTML or SVG, rendered frame by frame. App footage is real, recorded with Playwright against the local app, with both phones connected to Nexconn at once.

## Research used (sources)
- **Exports:** Tiruppur knitwear exports hit a record ₹46,000 crore in FY26, up 3 % from ₹44,747 crore. The target is ₹1 lakh crore by 2030 (Tiruppur Exporters' Association, via [Business Standard, 28 Jun 2026](https://www.business-standard.com/industry/news/tiruppur-clocks-record-46-000-cr-exports-in-fy26-eyes-1-trn-by-2030-126062800619_1.html)). Analysts call the target a stretch, so the video says "aims for".
- **Domestic sales:** about ₹35,000 crore in 2025-26 (industry estimate, [Deccan Herald](https://www.deccanherald.com/business/how-tiruppur-s-booming-domestic-market-grew-into-a-powerhouse-4194920)). Shown on screen as "~₹35,000 cr (est.)".
- **Workforce and firms:** 6–10 lakh direct jobs; about 95 % of the apparel industry is MSMEs ([Apparel Resources](https://apparelresources.com/business-news/manufacturing/tirupur-rewires-growth-playbook-amid-global-uncertainty/), industry estimates).
- **Old stock:** in one festival season, about 70 % of garments sold came from older stock and only about 30 % from new production (TEMA president, [DT Next](https://www.dtnext.in/news/tamilnadu/tamil-nadu-domestic-garment-market-yet-to-catch-up-with-deepavali-buzz)). Separately, about 25 % of small and medium units shut in two years as demand dipped (TEMA, The Hindu, May 2024).
- **Trade fairs:** domestic and export orders are still won at physical trade fairs (India International Knit Fair, 51st edition 2024; Knit Show, Tiruppur). Buyers have to travel to see the goods.
- **Order complexity:** one order passes through about 8 vendors (Outlook Business; BEE cluster profile; in `docs/01-research-brief.md`).

## Scenes and voiceover

| # | On screen | Voiceover |
|---|---|---|
| 1. Capital | Animated map of India, with a pin dropping on Tiruppur. Counters roll up: **₹46,000 cr** exports (FY26), **~₹35,000 cr** domestic (est.), **6–10 lakh** jobs, **95 %** small businesses. | Tiruppur, in Tamil Nadu, is India's knitwear capital. Last year it exported forty-six thousand crore rupees of garments, and it sells thousands of crores more inside India, almost all through small businesses. |
| 2. Fairs | Knit-fair photo (credited). A buyer icon travels Kolkata → Tiruppur, with ₹ and a clock ticking. Then a second path: buyer → local wholesaler → reseller, with a "+ markup" tag at each hop. | Yet the trade still runs on trade fairs. Buyers travel to Tiruppur to see the goods. Those who can't, buy through local wholesalers and resell, paying extra at every step. |
| 3. Old stock | A warehouse of cartons stacks up; a "70 % from old stock" bar fills. | Meanwhile, makers sit on unsold and over-produced stock. In one festival season, seventy percent of garments sold came from old stock. |
| 4. WhatsApp | One seller phone sends the same photo set to 10 chats, a counter ticks to 10, call icons ring, and messages arrive in Hindi, Bengali and English. | And every day, a seller sends the same photos to ten different buyers on WhatsApp, and chases each one on the phone, often in a language they don't share. |
| 5. Bridge | Fair, stock and WhatsApp icons slide into one chat bubble with the logo, captioned "Built on the Nexconn Chat SDK". | What if we could bridge that gap? That's why we built CLAIRE Connect, one chat app for the whole trade, built on Nexconn. |
| 6. How it works | Three animated tiles: 1 **Ask Claire** (find makers) · 2 **Deal in your language** (translated chat, sample, order) · 3 **Track production** (every hand-off). | Buyers ask Claire, our AI assistant, to find the right makers. Both sides deal in their own language, from sample to order. And makers track every step of production. |
| 7. Ask | Two phones. **Left: Amit, buyer, Kolkata (English). Right: Lakshmi, maker, Tiruppur (Tamil).** Amit types "1000 cotton T-shirts under ₹120". Claire answers with ranked makers. | Here's Amit, a buyer in Kolkata. He asks Claire for a thousand cotton T-shirts. Claire finds makers in Tiruppur, ranked by price, trust and delivery. |
| 8. Live translated chat | Amit opens a chat with Lakshmi Garments. His English message appears on Lakshmi's phone in Tamil; her Tamil reply appears on his phone in English. Callouts show "Nexconn group channel · live" and "Tamil → English". | He opens a chat with Lakshmi Garments. Two phones, live on one Nexconn channel. Amit writes in English, Lakshmi reads it in Tamil, and her reply reaches him in English. |
| 9. Sample → order | Amit taps **Request sample** (S, M, L); a sample order card appears on both phones. A "3 days later · sample approved" chip. He offers ₹90 for 1,000 pcs; Claire's private tip shows only on his phone. Lakshmi counters ₹94; Amit accepts; the order card with GST appears on both. | First, a sample, to check the fabric and the stitching. The quality is good, so he offers ninety rupees for a thousand pieces. Claire gives him a private tip that only he sees. Lakshmi counters at ninety-four, he accepts, and the order, with GST, appears on both phones. |
| 10. Backwards chain | Animated chain, built right to left from the order: **Buyer ← Pack ← Stitch ← Print ← Cut ← Dye ← Fabric ← Yarn**. Each step has a unit icon; the "in-house" steps (cut, pack) are green and the "outside" steps are amber, with trucks moving between them. | Winning the order is only the start. Murali, the maker, cuts and packs in his own unit, but everything else happens outside. He buys fabric, sends it to a dyer, cuts it, sends pieces for printing and stitching, packs, and delivers. Every one of those hand-offs can be tracked. |
| 11. Hand-off | Two phones: **Murali** and **Priya Stitching**. Murali sends 400 cut pieces (S, M) for stitching. The card arrives in their shared chat on Priya's phone; she confirms 398. Both phones show **Difference: 2 pcs**. | He sends cut pieces to a stitching unit in a few taps. The record lands in their shared chat. Priya confirms what she actually got, and if two pieces are short, both of them see it. |
| 12. Flow | Murali's flow view: the bar and the list (150 at Priya, 100 late at Bharathi, 90 in his unit, 30 on the way, 118 with a buyer, 2 not received), with callouts. | And at any moment, he can see where all five hundred pieces are: at which unit, in his shop, on the way, or with a buyer. |
| 13. Private Claire | Murali asks his own Claire, in Tamil, "how much fabric is still with Kongu Dyeing?" The answer card shows the source records. | He can even ask his own Claire, in Tamil, and the answer comes only from his own records. |
| 14. Trade Desk | Desktop console: a ticket, the agent joins, the "Before you joined" panel, resolve. | If something goes wrong, like a late payment or a short delivery, the Trade Desk sends a human agent. She joins the same chat, reads what happened before she joined, and sorts it out. |
| 15. Nexconn | Grid of Nexconn elements, each with an icon: Chat SDK · Direct channels · Group channels · System channel · Custom message cards · Targeted messages · Translation (10 languages) · History and read receipts · Typing · Call SDK (voice and video) · Webhooks. App Key shown. | All of this runs on Nexconn: channels, message cards, translation and calls. |
| 16. Potential | Bars animate: ₹46,000 cr exports now → ₹1 lakh cr target by 2030; ~₹35,000 cr domestic (est.); 6–10 lakh workers; 95 % MSMEs. "Every one of them is a user." | Tiruppur aims to reach one lakh crore rupees in exports by 2030, and almost every business in it is small. CLAIRE Connect gives each of them a direct line to buyers, and to each other. |
| 17. End card | Logo, "Every business in the chain, in its own language, in one chat.", **claire-connect.onrender.com** (on screen only). | CLAIRE Connect. Every business in the chain, in its own language, in one chat. |

## Judge's checklist (self-review before rendering)
- **Within 30 s,** the viewer knows the place, the size and three concrete pains.
- **Within 60 s,** the viewer knows what the app does in one sentence and in three steps.
- **Nexconn proof:** live two-device chat, a group channel, a targeted message (the tip), custom cards, translation, and the call/Trade Desk; named once at the end with all the elements visible.
- **No feature shown twice.** Search, chat, sample/order, chain, hand-off, flow, private Claire, desk: each appears once.
- **Captions are on screen for muted viewing.** Every number has a unit and a source on screen.
