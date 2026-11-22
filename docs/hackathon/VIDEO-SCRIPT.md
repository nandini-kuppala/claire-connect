# CLAIRE Connect: 3-minute hackathon video (draft 1, for review)

**Status:** for the owner's review. Nothing is recorded yet.
**Target:** 3:00 at most. 1920×1080, the same look as the old video (white stage, caption on the left, phone on the right; desktop frame for the Trade Desk). Voice is Neerja plain (`en-IN-NeerjaNeural`, rate −4 %) via the narrate-demo pipeline in `demo-video/`. Captions are burned in, because judges often watch muted.

## Why this shape
Judging is 50 % completeness and UX, 30 % innovation and real problem, 20 % business potential. So the video:
- **Opens with the problem.** The first 12 seconds show a real, specific pain.
- **Proves the track features first:** buyer-seller chat, translated chat, human agent dispatch. That's the Marketplace & Support track.
- **Spends the middle on what nobody else has:** two-sided tracking of goods across the production chain, the flow view, and a personal Claire.
- **Names the Nexconn SDK features on screen,** because judges check SDK use first.
- **Ends with the live URL and a demo login,** so a judge can try it in 10 seconds.

The old video (6:31) walked through every screen. This one cuts the compare, insights, profile and storefront screens; they are still in the app and the write-up.

## Scenes

| # | Time | On screen | Caption (left panel) | Voiceover |
|---|---|---|---|---|
| 1 | 0:00–0:12 | Title card: a simple chain diagram, yarn → knit → dye → cut → stitch → pack → buyer, with phone and WhatsApp icons between steps | **One T-shirt. Eight businesses. Zero shared records.** | In Tiruppur, India's knitwear capital, one T-shirt can pass through eight small businesses. They run it all on phone calls and WhatsApp, in Tamil, Hindi and English. Goods go missing, and nobody knows where an order really is. |
| 2 | 0:12–0:19 | Logo, then the sign-in screen with "Explore as a demo business" | **CLAIRE Connect** · Built on the Nexconn Chat SDK | CLAIRE Connect puts that whole trade into one chat app, built on Nexconn. |
| 3 | 0:19–0:36 | Amit (buyer, Kolkata, Hindi UI) on Claire's home. Types or taps "500 cotton T-shirts under ₹120". Claire asks one question, then shows ranked suppliers with trust scores | **Ask Claire, in your language** · Nexconn direct channel | Amit, a buyer in Kolkata, tells Claire what he needs, in Hindi. Claire finds makers in Tiruppur and ranks them on price, trust and delivery time. |
| 4 | 0:36–0:58 | Split screen. Left: Amit's deal room (Hindi). Right: Lakshmi's phone (Tamil). Amit asks for ₹90; it appears in Tamil for Lakshmi. Claire's private tip on Amit's side only. Lakshmi counters ₹94 as a card; Amit accepts; the order card appears with GST | **One deal room, two languages** · group channel · custom message cards · targeted messages · translation | One tap opens a deal room, a Nexconn group channel. Amit writes in Hindi, and Lakshmi reads it in Tamil. Claire gives Amit a price tip that only he can see. Offers, counter-offers and the order with GST are message cards, so the deal closes right in the chat. |
| 5 | 0:58–1:05 | Deal room header: tap the call button; a voice call connects; then the "Voice call · 0:42" summary card | **Or just call** · Nexconn Call SDK | And when typing is too slow, they call, right from the deal. |
| 6 | 1:05–1:25 | Desktop: Trade Desk console. A "Short delivery" ticket arrives; agent Meena joins; the "Before you joined" panel shows earlier messages; she replies; the buyer sees it in Hindi; resolve; the order card updates in the chat | **A human when it matters** · agent dispatch · history · translation | If something goes wrong, like a short delivery, the Trade Desk sends a human agent who speaks the right language. She joins the same chat, reads what happened before she joined, and sorts it out. |
| 7 | 1:25–1:31 | Text card: "After the order: making it" | **Beyond the marketplace** | Winning the order is only the start. Now Murali has to get it made. |
| 8 | 1:31–1:53 | Murali (manufacturer): Goods → Send for work → Priya Stitching, sizes S and M, 400 pcs, saved in 3 taps. Cut to Priya's phone: the card in their shared chat, she taps "Got 398". Both phones show "Difference: 2 pcs" | **Every hand-off, confirmed by both sides** · cards in a shared group channel | He sends cut pieces to his stitching units in three taps. The record arrives in their shared chat. Priya confirms what she actually got, and if it's two pieces short, both of them see it. Nothing is changed quietly. |
| 9 | 1:53–2:13 | Flow view of style FL55QO: the "Where everything is now" bar (150 at Priya, 100 at Bharathi · late, 90 in the unit, 30 on the way, 118 with Kolkata, 2 not received), then the stages scrolling | **Where is everything, right now** | The flow view shows where all five hundred pieces are right now: at which unit, in his own shop, on the way, or with a buyer. Late work is flagged, and every number adds up. |
| 10 | 2:13–2:32 | Murali's private Claire, in Tamil. He asks "how much fabric is still at Kongu Dyeing?" and gets an answer card with the source records. Then he types "sent 200 kg navy to Kongu Dyeing, back Friday"; a draft card appears; tap Save | **A private Claire for every business** · grounded in your own records | He can just ask his own Claire, in Tamil: how much fabric is still at the dyer? The answer comes only from his own records. He can even record work by saying it, and save it with one tap. |
| 11 | 2:32–2:48 | Card listing the Nexconn features with icons: direct, group and system channels; custom messages; targeted messages; typing and read receipts; message history; translation in 10 Indian languages; voice and video calls | **All on Nexconn** | Under the hood, it's all Nexconn. Direct, group and system channels. Custom message cards and private messages. Read receipts, history, translation in ten Indian languages, and voice calls. |
| 12 | 2:48–3:00 | End card: logo, "claire-connect.onrender.com", "Tap *Explore as a demo business*", GitHub link | **Try it now** | CLAIRE Connect. Every business in the chain, in its own language, in one chat. Try it with a demo login, at claire-connect dot onrender dot com. |

## Voiceover only (for reading aloud)
1. In Tiruppur, India's knitwear capital, one T-shirt can pass through eight small businesses. They run it all on phone calls and WhatsApp, in Tamil, Hindi and English. Goods go missing, and nobody knows where an order really is.
2. CLAIRE Connect puts that whole trade into one chat app, built on Nexconn.
3. Amit, a buyer in Kolkata, tells Claire what he needs, in Hindi. Claire finds makers in Tiruppur and ranks them on price, trust and delivery time.
4. One tap opens a deal room, a Nexconn group channel. Amit writes in Hindi, and Lakshmi reads it in Tamil. Claire gives Amit a price tip that only he can see. Offers, counter-offers and the order with GST are message cards, so the deal closes right in the chat.
5. And when typing is too slow, they call, right from the deal.
6. If something goes wrong, like a short delivery, the Trade Desk sends a human agent who speaks the right language. She joins the same chat, reads what happened before she joined, and sorts it out.
7. Winning the order is only the start. Now Murali has to get it made.
8. He sends cut pieces to his stitching units in three taps. The record arrives in their shared chat. Priya confirms what she actually got, and if it's two pieces short, both of them see it. Nothing is changed quietly.
9. The flow view shows where all five hundred pieces are right now: at which unit, in his own shop, on the way, or with a buyer. Late work is flagged, and every number adds up.
10. He can just ask his own Claire, in Tamil: how much fabric is still at the dyer? The answer comes only from his own records. He can even record work by saying it, and save it with one tap.
11. Under the hood, it's all Nexconn. Direct, group and system channels. Custom message cards and private messages. Read receipts, history, translation in ten Indian languages, and voice calls.
12. CLAIRE Connect. Every business in the chain, in its own language, in one chat. Try it with a demo login, at claire-connect dot onrender dot com.

About 375 words. At Neerja's pace (about 140 words a minute with pauses) that is about 2:50. Lines are measured after voicing and the scenes are timed to them, so the total stays at 3:00 or less.

## Open questions for the owner
1. **Goods in production.** Scenes 7–10 show the supply-chain features, which are off on the live site today (`supplyChain: false`). To let judges try what they see, the recommendation is:
   - merge `supply-chain` (commit `4117286`) to `main`;
   - set `SC_ENABLED=1` on Render;
   - seed and flag Scenario A's demo businesses in the production database.

   Alternatively, record those scenes locally and say "beta" on screen.
2. **Real voice input vs typed.** Scenes 3 and 10 can show real voice input (Sarvam speech-to-text), but a recorded browser can't speak. **Recommended:** show the typed text and a mic tap. Alternatively, record those two scenes on your phone.
3. **Call scene (5).** It needs two signed-in browsers and a call that connects. If it isn't reliable on camera, we drop it and gain 7 seconds.
4. **Numbers in scene 1.** The sources are in `docs/01-research-brief.md`:
   - "one order can pass through about 8 vendors" (Outlook Business; BEE cluster profile);
   - about 20,000 units and about 90 % of India's cotton knitwear exports (TEA via Upstox 2026).

   The draft uses only "eight businesses", to keep the hook short.
