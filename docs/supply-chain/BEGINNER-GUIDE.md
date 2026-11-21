# Goods on CLAIRE Connect: a beginner's guide

This guide explains, in plain words, what the **Goods** part of the app does and how to try every feature built so far. No coding knowledge is needed to follow the "Try it" steps; running the app locally needs a terminal.

## 1. What problem it solves
In Tiruppur knitwear, goods keep moving between units: yarn to a knitter, fabric to a dyer, cut kits to a stitching unit, garments to a packer. The owner's goods are often **somewhere else**. Weighing differences and process loss are normal, and records live in notebooks and WhatsApp.

Goods keeps one shared record of **what was sent, what came back, what is still out, and who agrees**. It works in English, Tamil and Hindi.

**Four ideas to know:**
- **Owner vs holder:** goods can belong to Ravi but sit at Lakshmi's unit. The app always knows both.
- **Both sides confirm:** when Ravi records "sent 200", Lakshmi can confirm "got 200" or give her own number. A difference beyond the allowance becomes a **difference to settle**, never a silent change.
- **Estimates are labelled:** "about 89 kg" means it is worked out from the usual process loss, not counted.
- **Nothing is deleted:** mistakes are undone within 10 minutes or corrected with a dated record.

## 2. Running it on your computer
1. Use Node 24: `source ~/.nvm/nvm.sh && nvm use 24`.
2. Start the app on the **dev database** (never the live one):
   ```bash
   SC_ENABLED=1 MONGODB_DB=nexconn_sc_dev npm run dev
   ```
3. Open http://localhost:5173 and log in with a demo phone; the code is always **123456**:

| Phone | Business | Role in the stories |
|---|---|---|
| 9000000004 | Ravi Knit Fashions | owner of goods; sends work out |
| 9000000002 | Lakshmi Garments | stitching unit (job worker) |
| 9000000003 | Sree Textiles | another business (buyer, sub-contractor) |

Tip: open a second browser window at http://[::1]:5173 to be logged in as two people at once.

## 3. The Goods tab
The bottom bar has **Goods**. It opens on three tabs:
- **Out with others:** your goods at other units, the latest first. Each row shows how much, since when and when it's expected, with a status: *on time*, *due today*, *late N days*, *ready to collect*, *held for dues*, or *stopped*.
- **In my unit:** **Mine** is your own stock; **Others' goods** is what other businesses left with you for work.
- **Coming in:** what you expect back, plus records others made that you need to **check and confirm**.

**Record** (the big button) opens every kind of entry, grouped as *Went out*, *Came in* and *Inside my unit*.

On a computer (1024 px or wider) the menu moves to the left, and lists become tables.

## 4. Feature by feature (with "Try it")

### 4.1 Setup
Goods → **Setup** holds:
- contacts (people not on CLAIRE);
- places (godown, cutting floor);
- materials and their short names;
- styles (sizes, trims per piece, weight per set);
- the work you take (process offerings);
- statement links.

**Try it:** add a contact "Noyyal Dyeing" with a phone number and Tamil as the language.

### 4.2 Send for work and get it back
- **Send for work:** pick who, the work (dyeing, stitching…), and the lines: material, quantity, lot, an optional DC number and photo.
  - **Sizes and colours** fills a grid (S, M, L… by colour) and can add trims from the style, e.g. 3 buttons per piece plus 2% spare.
- **Got back:** record what came back against the open job. "As sent" means it came back without work done.
- **The party page** (tap a unit) shows what is open with them, the history, and the terms (who bears weighing loss, the allowance).

**Try it:** as Ravi, send 200 kg grey fabric to Noyyal for dyeing, then record 92 kg navy back. Out with others now shows about 90 kg still there, after the usual 7% loss.

### 4.3 Two-sided records and differences
- When the other side is on CLAIRE, they get a card in a **Goods conversation** (separate from price chats) and can tap **All correct** or **Different number**.
- Weighed goods within the allowance (1.5% by default) record a weighing difference quietly. Counted goods allow 0.
- A difference beyond that opens **a difference to settle**. Four ways: *use my count*, *use theirs*, *split it*, *settle by value*. Using the other side's figure settles at once; anything else is a proposal they accept. **Ask Trade Desk** gets help.

**Try it:** as Ravi send 600 kits to Lakshmi; as Lakshmi confirm 598. Then settle it.

### 4.4 Job workers (Lakshmi's side)
- **Others' goods** lists what each client left with you: received, done here, sent back, still to work on.
- On a job: **Record work done**, **Mark ready**, **Hold for dues** (the late count pauses), **Send back to owner**, or **Forward to another unit**.
  - A **sub-contract**: the owner still sees it as "with Lakshmi". The sub-contractor sees plain names, without style codes.
  - An owner-asked **"send it on"**: the next unit works for the owner directly.

**Try it:** as Lakshmi, forward 100 kits to Sree; as Ravi, notice it still shows "with Lakshmi".

### 4.5 Made here, job details and closing
- **Made here:** cut, pack, check (grades), make sets, unpack, all done at your own unit. For cutting it checks the fabric: "50 kg in → about 46 kg in 200 pieces + 3.5 kg waste → about 0.5 kg unexplained". **Save and send for work** passes the kits straight to Send for work.
- **The job page** has a bar showing where every unit went (good, rejects, loss, still there, not accounted for), plus what came back, sub-contracts and bill adjustments.
- **Close job** asks what happened to leftover trims (used / they keep it and the bill is adjusted / kept for the next job / scrapped). It asks before recording missing pieces or high loss.
  - You can **close with the claim carried** if a difference is still open, and **reopen** later.
  - A figure arriving after closing reopens the job and closes it again by itself.
- **Stop this work** cancels a job; what is there should come back "as sent".

**Try it:** close a stitching job with 24 buttons left that the unit keeps at ₹6 each. The job page shows the ₹144 adjustment.

### 4.6 Buying, selling and correcting stock
- **Record kinds:**
  - **Sell**, **Return to supplier**, **Give / lend a sample**, **Move between my places**: picked from your stock.
  - **Buy**, **Buyer returned goods**, **Collect my goods**: for people not on CLAIRE.
- **Kept in place:** buy goods the supplier keeps for you, then collect in parts. Or sell and keep the goods for the buyer.
- **Sell part of a job:** goods at a dyer can be sold to someone else; their share becomes their own job.
- **Correct stock:** change grade, change material, split or change a lot, record found goods, write off (with a reason), count against the book.
- **Fire, theft or flood:** your own goods are written off. Each other owner gets a difference to settle, and nobody sees anyone else's.

**Try it:** buy 200 kg black fabric "kept at the supplier", then collect 60 kg into the godown.

### 4.7 Ask Claire
In Claire's chat (Home → ask box, or the chat tab), type or speak in any of the three languages.
- **Questions:** "நொய்யல்ல இன்னும் எவ்வளவு நேவி துணி இருக்கு?", "What's late?", "What did I send to Sree this month?". The answer is a card whose rows open the records, with a line saying what it's based on.
- **Records:** "லக்ஷ்மிக்கு 400 போலோ கிட் அனுப்பினேன், S M மட்டும்" gives a **draft**: 200 S + 200 M to Lakshmi Garments, for stitching.
  - Nothing is saved until **Save**. **Change** opens the form already filled in, and **Read out** speaks it.
  - Notes warn about likely mistakes (sizes split evenly, 10× your usual, already recorded today, not enough stock).
- **Questions are never recorded:** "அனுப்பியாச்சா?" (was it sent?) gets an answer, not a draft.

**Try it:** type the Tamil sentence above as Ravi, tap Save, and see it in Out with others.

### 4.8 Statement links for people not on CLAIRE
- On a contact's page, **Send statement on WhatsApp** opens WhatsApp with a ready message in their language. You send it; the app never messages anyone.
- They open a small page with no login, showing only your records with them and never prices. They can tap **Correct**, give a **Different number**, say **I returned some**, mark **Ready for pickup**, or **Stop these updates**.
- Their answers show to you as "Confirmed by … (via link)". On your own phone the page is view-only.

### 4.9 When a contact joins CLAIRE
- They see only "N businesses have records with your number" and can **ask to link**.
- You **approve** (or decline) on your Goods page. Their records then merge under their business, one row per unit, and they can confirm from their own account.

### 4.10 Staff
- **Adding staff:** the owner adds staff in Goods → Setup → **Staff**, with a name and phone number. The person logs in with that phone and the OTP.
- **What staff see:** Goods (opening on Coming in), Chats (Goods conversations only), Claire and a simple profile. They never see prices, buyers' chats, orders, the store or Trade Desk; the server refuses those even if someone tries.
- **Shared phones:** anyone can set a 4-digit **PIN for this phone** in Setup. The app then asks for it once each time it opens, so records show who made them.
- **Big counts wait:** if staff count stock more than 5 pcs or 2 kg away from the book, the count waits in the owner's **Waiting for you**, to approve or reject.
- **Differences:** staff can suggest how to settle a difference, but only the owner settles it. The other business never sees the suggestion.

**Try it:** log in as Kavitha (9600000001, OTP 123456, PIN 2468). Notice there is no Home or Orders tab, and that Goods opens on Coming in.

### 4.11 Reports and money
- **Where:** Goods → the chart icon (**Reports**), for owners only. Staff never see money.
- **Bills and dues:** one line per party with what you owe them or they owe you, the oldest unpaid bill in days, and how many jobs have no rate yet. Bills are worked out from the rates on your jobs, sales and purchases; nothing is typed in twice.
- **A party's page:** the net, each side, payments, and every billed line (tap one to open its job).
- **Record payment:** "I paid them", "They paid me", or, when you both owe each other, "Set off" one bill against the other. It is a record only: no money moves through the app. A mistake is marked **Wrong entry** (tap twice) and kept in history.
- **How units are doing:** for each unit and process, days taken against the days promised, loss against the usual loss and the best unit, rejects and differences. Days you held them up are not counted. Under 3 jobs it says "Not enough history yet".
- **GST:** goods out on job work for close to a year are listed at the top.
- **Download CSV** gives either report as a spreadsheet.

**Try it:** as Ravi, open Reports → Noyyal Dyeing, then **Record payment** → I paid them → ₹1,000 → UPI. The net drops by ₹1,000.

## 5. What is not built yet
- **Money extras:** reminders for unpaid bills, sharing a bill, closed days and per-receipt rate changes.
- **Orders:** linking marketplace orders to goods (8b).
- **Flow view** of a whole order (9).
- **Claire's paid backup model:** needs an Anthropic key.
- **Language:** Tamil and Hindi wording still needs a native speaker's check.

## 6. How it is tested
- **Automatic checks:** typecheck and style rules, unit tests, and one walkthrough script per slice that plays the stories above against the dev server:
  - `scripts/sc-smoke-s1.py`, `s2`, `s3`, `s4`, `s45`, `s6`, `s7`, `s8a`;
  - Claire's script.
- **Ledger check** (`npm run sc:verify -w server`): every record balances, and every stock figure equals its history.
- See **Test results** below for the latest run.

## Test results
**Retest on 21 Nov 2026**, local dev server on the dev database, with slices 0–8a active. **Everything passed:**

| Check | Result |
|---|---|
| Typecheck + style rules (`npm run lint`) | 84 files, 0 problems |
| Unit tests (`npm test`) | 24 pass, 0 fail |
| Slice 1 walkthrough | no errors |
| Slices 2, 3, 4, 4.5, 6, 7, 8a walkthroughs | all pass |
| Claire walkthrough | all pass |
| Ledger check (`sc:verify`) | 1173 event groups, 1133 stock rows, 0 problems |
| Web build | OK |

Browser passes were done per slice as each was built (slice 8a: Ravi at phone width, English and Tamil).
