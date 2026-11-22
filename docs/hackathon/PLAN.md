# Hackathon submission plan (Nexconn Build Challenge 2026)

**Deadline:** Sun 22 Nov 2026, 23:59 IST. Only the team leader (Vishal) can edit the submission.
**Resume rule:** any new session reads this file first, then continues at the first unchecked task.

## What the judges want (from reskilll.com/hack/nexconn/rules, read 22 Nov 17:20 IST)
- **Required:**
  - a functional app using the Nexconn **Chat SDK** (Chat UI counts; Call SDK optional);
  - a write-up PDF (why, which problem, which features use the Nexconn SDK, **App Key**);
  - a demo video (YouTube / Vimeo / Loom / Drive, anyone with the link);
  - a live URL;
  - a public GitHub repo.
- **Bonus:** user traction proof. Judges count **active users on the Nexconn app**, plus proof you give (analytics screenshots, user feedback).
- **Judging:**

  | Weight | Criterion | What it means |
  |---|---|---|
  | 50 % | Completeness and user experience | demo works fully and smoothly; clean UI; clear interaction |
  | 30 % | Innovation and scenario value | new idea; solves a real communication problem or adds a new interaction |
  | 20 % | Business and growth potential | traction, viability, can it be a real product |

- **Existing project:** allowed, but the write-up must say what existed before and what was built during the challenge.
- **Our track:** Marketplace & Support. Its ideas are buyer-seller 1-on-1 chat, a human agent dispatch center, and multi-language translated chat. We do all three, plus the supply-chain extension.

## State at the start (22 Nov 17:20 IST)
- **Code:**
  - `main` = PR #1 merged at `1eee572`.
  - `supply-chain` has one more commit, `4117286` (Flow view and follow-ups), **not in main yet**.
- **Live:** https://claire-connect.onrender.com is up, but `features.supplyChain` is **false** in production, so the Goods features are not live.
- **Old video:** `~/Desktop/claire-demo.mp4`, 6:31, marketplace only. Its pipeline is in `demo-video/`: `capture.mjs` (Playwright), `narrate.py` (edge-tts, voice `en-IN-NeerjaNeural` = "female-plain"), `compose.py` (ffmpeg), and `segments.json` (narration lines).

## Tasks
- [x] 1. Check git state after the merge.
- [x] 2. Research the rules and judging (above).
- [x] 3. Review the old video: scenes, pacing, what to keep.
- [x] 4. Run the app, retest, and write the feature list (`FEATURES.md`). Add 2 new test users that are not on the demo login list.
- [x] 5. Draft the 3-minute video: a scene list plus the voiceover script (`VIDEO-SCRIPT.md`). **CHECKPOINT: the owner reviews before recording.**
- [x] 6. Desktop backdrop: a tinted page background around a white app column (web change, then deploy with the owner's OK).
- [x] 7. Write-up PDF (`docs/hackathon/CLAIRE-Connect-writeup.pdf`), plus traction-proof ideas.
- [ ] 8. After the script is approved: record (Playwright), narrate (Neerja plain), compose a 3:00 cut, and upload (the owner does the upload).
- [ ] 9. Owner decisions:
  - merge `supply-chain` → `main` and deploy;
  - set `SC_ENABLED=1` and flag the demo businesses in production so Goods is live for the judges.

## Decisions / notes
- **Old video (`~/Desktop/claire-demo.mp4`, 6:31):** 24 lines, 792 words. Layout is a white stage, caption on the left, phone on the right, plus a desktop frame for the Trade Desk. It covers only the marketplace. The new cut keeps that look and goes problem-first.
  - Frame times, useful for reuse: home 128 s, compare 172 s, counter-offer 232 s, Trade Desk 310 s, Tamil home 330 s, translated deal 345 s.
- **Test users (dev DB only, not on the demo login list):**
  - Sri Senthil Dyeing (test) `9400000101` (Tamil, declared dyeing);
  - Anand Knit Exports (test) `9400000102` (cutting and packing, sends work).
  - Both are flagged for Goods. A two-sided job between them passed: 200 kg sent, dyer confirmed 198 (within tolerance), 186 kg came back, an outsider gets 404.
  - An earlier onboarding test also left `9399961041` "Onboard Test Unit (test)".
- **Retest (22 Nov):**
  - lint, 24 unit tests, all 15 smokes, the Claire smoke, scenarios A and B, ledger 0 problems.
  - The dev server stopped once mid-session; restart it from Bash with `SC_ENABLED=1 MONGODB_DB=nexconn_sc_dev PORT=8787 npm run dev`.
- **App Key** `m7ua80gbmcvhm`: checked, the live site hands out the same key. It is the public key sent to every client, not the secret.
- **Public stats** (live): `https://claire-connect.onrender.com/api/stats`. On 22 Nov, non-seed activity was 14 orders, 5 conversations, 74 messages, 2 tickets, 11 ratings.
- **Backdrop:** a new token `--color-backdrop: #edf1ef`, shown only above 480 px, around a white column with a soft shadow. Phones are unchanged.
- **Write-up:** `docs/hackathon/CLAIRE-Connect-writeup.pdf` (4 pages, A4), from `writeup.html` (screenshots in `img/`). Rebuild it with:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf=CLAIRE-Connect-writeup.pdf "file://$PWD/writeup.html"`

## Feature inventory (for the script and the write-up)
- **Marketplace:**
  - Claire search, in text or voice and 10 languages, with ranked suppliers and order splitting;
  - results, compare and insights;
  - deal rooms (group channel; translated; private tips; offer, counter-offer and order cards with GST and advance/balance; quick replies; voice notes; calls);
  - orders and tracking;
  - ratings and trust score;
  - storefronts, and catalogue from photos;
  - voice onboarding (now with a "what work do you do" step).
- **Support:**
  - Trade Desk console (queue, SLA, AI summary and next step, join the chat, earlier messages, resolve, re-post the order card, calls);
  - tickets from a button, from sentiment, from late payment, or from a short delivery.
- **Goods (beta, behind a flag):**
  - send for work and got back;
  - two-sided confirmation with tolerances and differences;
  - others' goods (the job-worker view), forwarding and sub-contracting;
  - made in-house (cut, pack, sets);
  - buy, sell, returns, samples;
  - stock with ownership and custody kept separate;
  - flow view; reports; bills, payments and due reminders; closed days;
  - statement links for off-platform partners (WhatsApp);
  - staff with a PIN; offline outbox and offline shell;
  - a private Claire (grounded answers; voice and text record drafts).

## Traction proof ideas (bonus, 20 % bucket)
1. **Nexconn Console:** a screenshot of active users and messages for App Key `m7ua80gbmcvhm`. Judges count active users on the Nexconn app.
2. **Live stats link:** `claire-connect.onrender.com/api/stats` as the proof link (live, non-demo counts). A small public `/stats` page would read better than JSON.
3. **Real pilot:** the owner's family unit in Tiruppur plus 2 partners (stitching and dyeing). A 30-second phone clip of them using it in Tamil, or 2–3 short written quotes, with their consent.
4. **Feedback form:** a Google Form linked from the app's Profile → Help. Share a screenshot of the responses.
5. **Community post:** a post in a Tiruppur garment WhatsApp or Facebook group or on LinkedIn, with replies and sign-ups. Link it.
