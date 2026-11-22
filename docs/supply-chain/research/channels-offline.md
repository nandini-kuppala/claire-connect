# Reaching off-platform counterparties, notifications and offline support

**Research note for the CLAIRE Connect supply-chain feature.** Date: 2026-11-20.
**Scope:** how a CLAIRE user can reach a counterparty who is not on the platform (name + phone only); which notification channels to use; how much offline support the React PWA should have in v1; and the DPDP implications of storing and messaging third-party phone numbers.

**Confidence tags.** Each claim carries a tag. **[verified]** means read in a primary or official source. **[likely]** means it comes from a reputable secondary source or several sources that agree. **[uncertain]** means the sources conflict or it is my inference. Prices exclude 18% GST unless stated. I treat ₹1 ≈ US$0.0118.

---

## TL;DR

1. **v1 off-platform channel: links sent from the user's own WhatsApp (zero cost).** The app builds a `wa.me/<number>?text=` link, or uses the Web Share sheet. The prefilled text is in the counterparty's language and carries a **tokenised read-and-confirm link**. CLAIRE never sends to people who have not opted in, needs no DLT or Meta template approval, and pays nothing per message.
2. **Do not send from CLAIRE's own WhatsApp Business number or an SMS header to off-platform counterparties in v1.** Meta requires an opt-in that names the business sending the message [verified](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in). The counterparty has opted in to nothing from CLAIRE. SMS needs DLT entity, header and template registration, and every variable link must now be pre-tagged and whitelisted [likely](https://www.fonearena.com/blog/469120/trai-mandates-pre-tagging-sms-variables-curb-phishing-misuse.html). Both channels are viable later, once the counterparty has opted in.
3. **Notifications for on-platform users: the in-app inbox is the source of truth.** Web Push (PWA) and FCM (Flutter) are best-effort nudges only. Budget Xiaomi, Realme and Vivo phones regularly suppress background delivery.
4. **Offline v1:** precache the app shell, keep reference data in IndexedDB, and add an **IndexedDB outbox for create-type writes** (dispatch, receipt, confirmation). Each write carries a client-generated idempotency key, and the server enforces a unique index. Replay on `online`, on app start and via Background Sync where Chrome supports it. Leave full offline reads, offline edits with merge, and periodic sync until later.
5. **Identity:** normalise phones to E.164 with libphonenumber-js. Store an `ExternalContact` per *sender business*, never a global person record. A phone match on sign-up produces only a *suggestion*, and the counterparty must accept each relationship before seeing any records.
6. **DPDP:** CLAIRE is very likely a **Data Processor** for the counterparty details a user enters, and a **Data Fiduciary** for any cross-account matching or claim flow. The main Rules obligations (notice, consent, security, breach, erasure) commence **13 May 2027** [likely](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/). Build to them now.

---

## (a) Channel comparison

| Channel | Cost per message (INR) | Setup effort | Reliability on budget Android / patchy 4G | Compliance needs |
|---|---|---|---|---|
| **WhatsApp click-to-chat (`wa.me` + `?text=`)**, sent by the user from their own WhatsApp | **₹0**. The user's own data plan carries it. | Very low: build a URL. No Meta account needed. | High. Nearly every Tiruppur trader uses WhatsApp, and WhatsApp queues sends offline. But a human has to tap Send each time, and CLAIRE gets no delivery receipt. Opening the link is the only signal back to CLAIRE. | Minimal. It is a person-to-person message from the user. CLAIRE is only a link generator. The user can edit the text before sending [likely](https://bird.com/explained/whatsapp/what-is-a-whatsapp-click-to-chat-link). |
| **Web Share API / `sms:` URI** (the user's own SMS app or any other app) | ₹0 for the user, or their plan's SMS rate | Very low | Medium–high. SMS reaches feature phones and non-WhatsApp users. A P2P SMS sent from a personal SIM is not template-scrubbed [uncertain]. | Same as above. The user is the sender. |
| **WhatsApp Cloud API, utility template** (CLAIRE number → user) | **₹0.115** per delivered message (about US$0.0014), +18% GST ≈ ₹0.136 [likely](https://montymobile.com/blogs/whatsapp-business-api-pricing-in-india-inr-rates-gst-and-the-2026-currency-migration-deadline). Volume tiers lower the rate [verified](https://developers.facebook.com/docs/whatsapp/pricing). Utility messages *inside* an open 24-hour window are **charged from 1 Oct 2026**. They were free from Jul 2025 to Sep 2026 [verified](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md). | Medium. Needs a Meta Business portfolio, a dedicated number, display-name approval and per-language templates (Meta does not translate them). Review "can take up to 24 hours" [verified](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates). From **1 Jan 2027** a WABA must be billed in INR or it stops delivering [verified](https://developers.facebook.com/docs/whatsapp/pricing). | High delivery, with read receipts. | **Opt-in must name CLAIRE** [verified](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in). A utility template must be non-promotional and tied to the user's transaction. Meta re-categorises abusers to marketing [verified](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines). A new portfolio is limited to **250 unique users per 24 h** outside the service window, rising to 2,000 after business verification [verified](https://developers.facebook.com/docs/whatsapp/messaging-limits). |
| **WhatsApp Cloud API, service (free-form) reply** inside the 24-hour window | **First 1,000 per number per month are free.** After that ₹0.115 [verified](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md) for the free tier, [likely](https://www.ibtimes.co.in/whatsapp-business-messages-become-paid-october-1-india-prices-rules-what-changes-906727) for the rate. | As above | High | The window opens only when the user messages CLAIRE first [verified](https://developers.facebook.com/docs/whatsapp/pricing) |
| **WhatsApp Cloud API, marketing template** | **₹0.8631** (about US$0.0107), +GST ≈ ₹1.02 [likely](https://montymobile.com/blogs/whatsapp-business-api-pricing-in-india-inr-rates-gst-and-the-2026-currency-migration-deadline) | As above | High | Not needed for this feature. Avoid it. |
| **WhatsApp Cloud API, authentication (OTP)** | ₹0.115 [likely](https://www.ibtimes.co.in/whatsapp-business-messages-become-paid-october-1-india-prices-rules-what-changes-906727) | As above, plus an OTP template | High | Opt-in comes from the user requesting the OTP |
| **SMS via an aggregator** (MSG91, Exotel and similar) | **₹0.16–0.25** at list price (MSG91: ₹0.25 at 5k, ₹0.17 at 60k, +GST; down to ₹0.13 negotiated) [verified](https://msg91.com/in/pricing/sms) | **High for a startup.** DLT entity registration about ₹5,900 one-time, renewal varies [likely](https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-charges-cost-breakdown-in-india). Plus header and template registration, URL/CTA whitelisting, and **pre-tagged variables** (`#url#`, `#numeric#`, `#alphanumeric#`, max 40 chars). Non-compliant variables are rejected after a logger period (TRAI direction of 18 Nov 2025) [likely](https://www.fonearena.com/blog/469120/trai-mandates-pre-tagging-sms-variables-curb-phishing-misuse.html). | Medium–high when DLT-compliant. Template mismatches silently fail. Regional-language (Unicode) SMS uses a 70-char segment, so it costs 2–3× per message [likely]. | Commercial headers carry a `-S`/`-T`/`-P`/`-G` suffix (from May 2025) [likely](https://khaitanco.com/thought-leadership/Efforts-to-Curb-Spam-Continue-TRAI-Releases-Second-Amendment-to-the-TCCCPR-2018). Service Explicit templates were folded into Promotional on 10 Mar 2026 [likely](https://www.fast2sms.com/help/?p=16132). URL whitelisting has been mandatory since 1 Oct 2024 [likely](https://inc42.com/buzz/over-10k-entities-whitelist-2-75-lakh-urls-after-trai-directives). TRAI notified a TCCCPR **Third Amendment** in Sep 2026. Its final SMS clauses were not verified here [uncertain](https://www.policyedge.in/p/trai-draft-telecom-commercial-communications-customer-preference-third-amendment-regulations-2026). |
| **Web Push (PWA)** | ₹0. FCM carries it. | Low–medium: VAPID keys, a service worker and a permission prompt [verified](https://web.dev/articles/push-notifications-overview) | **Low–medium on Xiaomi, Realme, Vivo and Oppo.** OEM battery managers kill background work. dontkillmyapp ranks Xiaomi #2, Oppo #8, Vivo #11, realme #12 [verified](https://dontkillmyapp.com/). Delivery is not guaranteed, and messages expire after their TTL [verified](https://web.dev/articles/push-notifications-overview). | Users must grant permission. On-platform users only. |
| **FCM push (Flutter app)** | ₹0 | Low (the app exists) | Better than Web Push, but subject to the same OEM killers [likely](https://help.pushwoosh.com/hc/en-us/articles/26443659354653-Why-are-push-notifications-not-being-delivered-to-my-Xiaomi-device) | On-platform users only |
| **In-app inbox / badge** (pulled on open) | ₹0 | Low | **Highest.** It is always correct once the app syncs. | None |

**Main point.** For off-platform counterparties, the only channel that is cheap, compliant and familiar is a message the user sends from their own WhatsApp. Platform-sent WhatsApp or SMS is cheap per message (₹0.12–0.25). What blocks it is **opt-in and registration**, not cost.

### WhatsApp details (2026)
- Per-message pricing replaced conversation pricing on **1 Jul 2025**. Only business-initiated messages that are delivered are charged. Rates depend on category and the recipient's country code [verified](https://developers.facebook.com/docs/whatsapp/pricing).
- **1 Oct 2026 change:** service messages beyond 1,000 per number per month are charged. Utility messages inside an open window are now charged as well; they were free from Jul 2025 to Sep 2026 [verified](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md). Some vendor blogs still describe in-window utility messages as free. They are out of date.
- India marketing rates rose on 1 Jan 2026. India INR billing became mandatory: migrate by 31 Dec 2026, or delivery stops from 1 Jan 2027 [verified](https://developers.facebook.com/docs/whatsapp/pricing).
- Click-to-WhatsApp ads open a free entry window of up to 7 days [verified](https://developers.facebook.com/docs/whatsapp/pricing). This is not relevant here.
- **BSP vs direct Cloud API.** Direct Cloud API has no platform fee: you pay Meta's rates and Meta hosts the service. A BSP (Gupshup, Interakt, AiSensy, MSG91, Twilio and others) adds a monthly fee and/or a per-message markup. In return you get a UI, template management and support. Vendor blogs quote prices that are visibly higher than Meta's list, for example ₹1.09 against ₹0.8631 for marketing [likely](https://www.ibtimes.co.in/whatsapp-business-messages-become-paid-october-1-india-prices-rules-what-changes-906727). Since we already run an Express backend, **go direct to the Cloud API when we need it**.
- **Useful trick for later:** a counterparty who taps a `wa.me/<CLAIRE-number>?text=CONFIRM-AB12` link sends CLAIRE an inbound message. That gives us (1) proof they control the number, (2) a WhatsApp opt-in that names CLAIRE, and (3) an open 24-hour service window, where replies fall within the free 1,000 per month. This is cheaper and more compliant than an SMS OTP [uncertain: a design idea based on the verified rules above].

### Click-to-chat pros and cons
- **Pros:** ₹0. No onboarding with Meta or DLT. The message arrives from a number the counterparty already knows and trusts (their customer or principal), so it does not look like spam. It works in Tamil and Hindi script once URL-encoded. WhatsApp handles offline queueing on the sender's phone.
- **Cons:** each message needs one manual tap, so there are no automated reminders. CLAIRE gets no delivery or read status; link opens are the only signal. The user can edit or delete the link. Bulk sending is impractical. We cannot send at all if the user does not have WhatsApp. The number format must be digits only with the country code (`9198xxxxxxxx`, no `+`, no leading `0`) [likely](https://bird.com/explained/whatsapp/what-is-a-whatsapp-click-to-chat-link).
- **Fallback chain:** `wa.me` → `navigator.share()` (the Android share sheet: WhatsApp Business, SMS, Telegram) → `sms:+91…?body=` [likely]. **Do not prefill a WhatsApp Business-only intent.** Many traders use the green WhatsApp Business app; `wa.me` lets Android pick either app [likely].

### SMS feasibility for a small startup
- **Doable, but it takes 1–3 weeks of paperwork and has to be maintained.** You register a Principal Entity on one operator's DLT portal (shared across operators), register a header (6-character sender ID), and register each template per language, with every variable pre-tagged. Each link domain must be whitelisted [likely](https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-guide-2026-costs-process-requirements-smsgatewayhub), [likely](https://www.fonearena.com/blog/469120/trai-mandates-pre-tagging-sms-variables-curb-phishing-misuse.html).
- **Category problem.** "Service Implicit" covers updates to a customer *of the principal entity*. An off-platform counterparty is not CLAIRE's customer, so platform-sent SMS to them sits in a grey zone. Messages with any offer content go to Promotional, which brings DND scrubbing and a 10:00–21:00 sending window [likely](https://www.fast2sms.com/help/?p=16132), [uncertain] on category fit.
- **Recommendation:** defer platform SMS until we need phone OTP at scale. Even then, compare MSG91/Exotel against WhatsApp authentication templates (₹0.115).

---

## (b) Recommendations: v1 vs later

### Notifications (on-platform users)
| | v1 | Later |
|---|---|---|
| Source of truth | **In-app inbox** ("Needs your confirmation", "Overdue from X"). Pulled on app open and on regaining focus; badge on the home icon. | Same |
| Nudge | **Web Push** for PWA users who opt in, after a meaningful moment such as their first two-sided confirmation, not on first load. Set `Urgency: high` and a TTL of about 3 days on confirmation requests. Use `topic` to collapse repeated nudges [verified](https://web.dev/articles/push-notifications-overview). Flutter uses FCM. | A WhatsApp **utility template** from CLAIRE's number, sent only to users who opted in during onboarding ("Get CLAIRE alerts on WhatsApp"), for example a daily digest of pending confirmations. About ₹0.14 per message incl. GST. Budget: 1 digest per user per day × 1,000 users ≈ ₹4,100 per month. |
| Battery savers | Show a one-time, per-OEM help card ("Allow Chrome to run in background") only when we detect missed pushes. Never block a flow on push. [likely](https://intercom.help/progressier/en/articles/7212325-troubleshooting-web-push-notifications-for-pwas-on-android) | — |

**Do not rely on push.** CleverTap, a vendor with an interest, says about 40% of pushes are not visible on Chinese-OEM devices [uncertain](https://clevertap.com/blog/the-future-of-push-notifications-navigating-beyond-mi-push-deprecation/). Web push also has no delivery guarantee [verified](https://web.dev/articles/push-notifications-overview). Every push must duplicate something that already sits in the inbox.

### Off-platform updates
| | v1 | Later |
|---|---|---|
| Channel | **User-sent `wa.me` link** with localised prefilled text plus a share link. Web Share or `sms:` as fallback. Also a "Copy link" button. | Optional **platform-sent WhatsApp utility template** ("Murugan Textiles recorded sending you 200 kg…"), but **only after the counterparty has opted in to CLAIRE**, for example via the confirm page or the inbound `wa.me` trick above. |
| Reminders | The user taps "Remind on WhatsApp" (a new prefilled message, same token) | Automated reminders through the template, at most 1 per movement per 3 days |
| Feedback to sender | The link page records *opened* (excluding preview bots) and *confirmed / disputed* | WhatsApp delivered/read webhooks |

### Offline (React PWA)
| | v1 (realistic) | Later |
|---|---|---|
| App shell | `vite-plugin-pwa` / Workbox precache of the built assets, so the app opens with no network. Network-first for API GETs with a cached fallback. | — |
| Reference data | IndexedDB (via `idb`) copy of own counterparties, materials/specs, units, and the last 30–60 days of own movements, for pickers and "what's at Murugan" lookups | Full ledger offline with delta sync (`updatedAt` cursor) |
| Writes | An **outbox** in IndexedDB for *create* operations only: dispatch, receipt, receiver confirmation, quick note. Each item gets a `clientId` (UUIDv7) sent as an `Idempotency-Key`; the server keeps a unique index on `(businessId, clientId)` and returns the existing record on replay. The UI shows "Saved on phone · will sync". | Offline *edits* and deletes, with version checks and a merge UI |
| Replay triggers | `online` event, app start/visibility, a manual "Sync now" button, plus **Background Sync** (`sync` event) where available. Workbox's `BackgroundSyncPlugin` falls back to retrying on service-worker start [verified](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync). | Periodic Background Sync for an installed PWA (Chromium only) [uncertain] |
| Durability | Call `navigator.storage.persist()` after install or first outbox write. Chrome evicts best-effort storage LRU-first when the disk is low [verified](https://web.dev/articles/storage-for-the-web). Budget phones have little free storage, so keep the outbox small (text only; voice audio capped). | — |
| Conflicts | Model movements as **append-only events**: dispatch, receipt, adjustment, confirmation. Two offline devices then produce two events rather than a conflict. Edits (v1 online-only) carry `version`, and the server rejects stale ones with 409. A receiver's confirmation references `dispatchId`. If the dispatch was cancelled meanwhile, show "needs review". Order by server-assigned sequence, not device clock [likely](https://blog.openreplay.com/offline-form-submission-background-sync/). | Richer merge UI |
| Online-only in v1 | Claire/LLM answers, voice-to-record (Sarvam STT), search, share-link creation (the token is server-generated). *Option:* queue a voice note as an audio blob and transcribe on sync. | Same |

**Background Sync support.** The API has "Limited availability": Chromium only, no Firefox or Safari, HTTPS only [verified](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API). Chrome on Android is the main browser for our users, so it covers them. Android WebView is reported as unsupported [uncertain](https://blog.openreplay.com/offline-form-submission-background-sync/). That matters if the Flutter app ever embeds the web app. Do not test offline with the DevTools "offline" checkbox; it does not affect service-worker requests [verified](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync).

**Nexconn chat SDK and offline.** I found no Nexconn-branded offline documentation. Nexconn is the rebrand of RongCloud (RC), effective 27 Mar 2026 [likely](https://docs.rongcloud.io/react-native-imlib/message/manage-offline-message-duration). From the legacy RC docs and the installed `@nexconn/chat@26.5.1` typings:
- The SDK auto-reconnects and exposes `ConnectionStatusHandler` / `getConnectionStatus()` and an `onOfflineMessageSyncCompleted` event [verified](../../../node_modules/@nexconn/chat/index.d.ts) (local package typings).
- The server holds messages received while offline. Retention defaults to 7 days, configurable 1–7 days, for 1:1, group and system channels; open channels/chatrooms are not covered [likely](https://docs.rongcloud.io/react-native-imlib/message/manage-offline-message-duration).
- The **Web** SDK does not persist message history or the conversation list locally. They are fetched from the server [likely](https://docs.rongcloud.io/web-imlib/message/get-history). The engine bundle uses IndexedDB with a 168-hour value, which looks like log storage rather than a message store [uncertain].
- There is **no documented durable outbox for unsent chat messages** on web [uncertain].
- **Implication:** never use chat messages as the transport for ledger writes. Write to our own API through the outbox. Once the server accepts the write, *the server* posts the dispatch/receipt card into the deal-room channel through the Nexconn Server API. Cards then never duplicate or go missing because of a flaky client.

---

## (c) Proposed share-link and claim flow for off-platform counterparties

### Data model (sketch)
- `ExternalContact { _id, ownerBusinessId, displayName, businessName?, phonesE164[], rawPhones[], language?, createdBy, createdAt, linkedBusinessId?, linkState: none|suggested|accepted|rejected }`. It is **owned by the business that typed it in**, so each sender has its own copy. There is no global "person" record.
- `ShareLink { _id, tokenHash (SHA-256), scope: {type: 'movement'|'statement', ids[]}, ownerBusinessId, externalContactId, permissions: ['view','confirm'], expiresAt, revokedAt?, firstOpenedAt?, lastOpenedAt?, openCount, createdBy }`
- `Confirmation { movementId, by: 'verified_user'|'link_unverified'|'link_whatsapp_verified', qtyConfirmed, unit, status: received_full|received_partial|not_received|wrong_party, note?, at, ipHash, uaHash }`

### Flow
1. **Record.** The sender records a dispatch to "Murugan Dyeing, 98xxxxxxxx", picked with the **Contact Picker API** on Chrome Android 80+ (on demand, one contact at a time, nothing persisted by the browser) [verified](https://developer.chrome.com/docs/capabilities/web-apis/contact-picker), or typed or spoken. The phone is normalised to E.164.
2. **Create link (server).** Generate a token of **≥128 bits** from a CSPRNG (base64url, 22+ characters). **Store only its hash.** Scope it to that movement, or to an explicit "statement" set the sender picks. Default expiry is **30 days**; the sender can extend or revoke it. Create one link per (movement, contact); reminders reuse it.
3. **Send.** Open `https://wa.me/91XXXXXXXXXX?text=<encoded>`. The text is a short, localised message ("Murugan Textiles sent you 200 kg navy single jersey on 20 Nov. Please confirm: https://clr.example/r/<token>"), written in the language the sender chose for that contact. Fall back to `navigator.share()` or `sms:`.
4. **Open (recipient, no login).** A **server-rendered, very light page** (under about 50 KB, no JS framework needed, works on 2G). Language switch: தமிழ் / हिन्दी / English. It shows **only**: sender business name and city, material/spec, qty + unit, colour, size, lot, date sent, expected return date, and the sender's note *if marked shareable*.
   - **Never shown:** rates or prices (unless the sender explicitly toggles them on), the sender's other counterparties, inventory, other movements, internal notes, or the contact's own stored name or labels ("slow payer").
5. **Act.** The page offers "Received all", "Received different qty" (stepper + reason), "Not received", and "This isn't me / wrong number". These are **POST only, with a CSRF token**, because WhatsApp and other link-preview bots *GET* URLs, so a GET must never change state. Each confirmation records `by: link_unverified`. The sender sees it labelled "Confirmed via link", which is weaker than a confirmation by a verified CLAIRE user.
6. **Optional verification (no SMS OTP).** A "Verify with WhatsApp" button opens `wa.me/<CLAIRE number>?text=VERIFY <short code>`. The inbound message proves the phone and records a WhatsApp opt-in naming CLAIRE, and the confirmation is upgraded to `link_whatsapp_verified`. This is a v1.5 item, once a CLAIRE Cloud API number exists.
7. **Claim and join.** The page ends with "Track all your work with Murugan Textiles on CLAIRE → Join". After a normal phone sign-up and verification, if a verified number matches `phonesE164` on any `ExternalContact`, the new user sees "**3 businesses have recorded work with this number**", with business names only. For each one they choose **Accept** (link: past movements become two-sided, pending items move into their "To confirm" list) or **Not me / Decline**. The sender is notified either way. Nothing from a sender's records is visible to the new user until they accept, and the new user's other relationships are never shown to the sender.

### Security rules
- Tokens are unguessable (≥128-bit), stored hashed, scoped to the minimum (one movement by default), **expire after 30 days**, can be revoked, and are rate-limited per IP and per token. Return the same "link expired or invalid" page for wrong and expired tokens.
- Send `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Cache-Control: no-store`, and a strict CSP. Load no third-party analytics or fonts on the page, so the token is never leaked to third parties.
- **Link previews:** WhatsApp fetches the URL to build a preview. Serve generic Open Graph tags ("CLAIRE: delivery confirmation") with no quantities, names or prices. Do not count bot user agents as "opened" [likely].
- Once confirmed, a confirmation becomes immutable for the counterparty, though they can submit a correction event. Show a "dispute" option instead of letting them edit.
- Show the **sender's** business name prominently, so a forwarded link is obviously "someone else's record". Accept that anyone with the link can view and confirm, and label the confirmation's strength honestly.
- Audit every open and action with a timestamp and hashed IP/UA. Retain the logs for **≥1 year**, in line with DPDP Rule 8 [likely](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/).

### Precedent
- **OkCredit:** reminders reach customers "over SMS and WhatsApp" and customers do not need the app [verified](https://okcredit.in/payment-reminder-app). Whether the reminder includes a ledger view link is not stated [uncertain].
- **Khatabook:** reminders are shared from the merchant's own WhatsApp, one chat at a time, with a link. Users report that payment links expire [likely](https://richautomate.in/blog/khatabook-whatsapp-payment-reminders-india-2026).
- **Vyapar:** an invoice web link "opens in any standard mobile or desktop browser" without the app. Vyapar also offers auto-send via SMS/WhatsApp, including logging in with the user's personal WhatsApp [likely](https://vyaparapp.in/guides/how-to-enable-and-send-transaction-messages-in-vyapar).
- So "send from the user's own WhatsApp, with a read-only browser link" is the established Indian SME pattern. Our addition is the **confirm** action and the **claim** flow.

---

## (d) Phone identity linking and DPDP considerations

### Phone normalisation and matching
- Use **libphonenumber-js** (about 110 KB; a lighter "min" metadata build is available) with default region `IN`. Store `e164` plus the raw input, validate the number, and check `getNumberType` = MOBILE where possible [verified](https://github.com/google/libphonenumber). Indian mobiles are 10 digits starting 6–9 [likely]. Strip `0`, `+91`, `91`, spaces and dashes before parsing.
- **Multiple numbers per business:** the owner, the munshi/supervisor, and an accounts phone. Allow `phonesE164[]` on both `ExternalContact` and `Business`, with each business number verified separately.
- **Shared phones:** a supervisor's phone can serve several units, and a family phone can serve several businesses. A match is therefore **only a suggestion**, confirmed by the counterparty (accept) and visible to the sender ("linked to Murugan Dyeing (CLAIRE)").
- **Recycled numbers:** Indian operators may reassign a disconnected number after **90 days**. WhatsApp clears an account's data when a number reappears on a new device after 45 days of inactivity [likely](https://livelaw.in/top-stories/once-a-mobile-number-is-deactivated-it-is-not-assigned-to-a-new-user-for-90-days-trai-to-supreme-court-241506). So:
  - never auto-link;
  - show the business name the sender typed during the accept step;
  - offer "This isn't me";
  - mark contacts with no activity for 12+ months as stale and exclude them from claim suggestions.
- **No address-book upload or contact discovery.** Use the one-at-a-time Contact Picker only. Do not reveal to a sender whether a typed number belongs to a CLAIRE user unless that business has turned on "Let businesses find me by phone" (default on for businesses, off for individuals). This prevents phone enumeration.
- **Lookup index:** keep an HMAC (keyed hash) of the E.164 number for matching, separate from the encrypted number we use for messaging links. This limits exposure if a DB dump leaks [uncertain: best practice, not a legal requirement].

### DPDP Act 2023 / DPDP Rules 2025
- **Timeline.** The Rules were notified on **14 Nov 2025**. Rules 1, 2 and 17–21 (the Board) took effect immediately. Rule 4 (consent managers) follows later. **Rules 3, 5–16, 22 and 23 (notice, security, breach, erasure, rights) take effect 18 months after publication, about 13–14 May 2027** [likely](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/). In January–February 2026, MeitY proposed cutting this to 12 months, mainly for Significant Data Fiduciaries. I found no final notification [uncertain](https://chambers.com/articles/meity-plans-to-cut-short-dpdp-compliance-timeline-and-notify-cross-border-restrictions-for-sdfs). Design for compliance now.
- **Is it personal data?** Yes. The name and mobile number of an individual, including a sole proprietor's personal phone, count. The Act's exclusion covers only processing "by an individual for any personal or domestic purpose" and data the person made public [verified](https://www.dpdpa.com/dpdpa2023/chapter-1/section3.html). Recording a business counterparty is not domestic, so the exclusion does not help.
- **Roles.**
  - When a user records a counterparty in *their own* ledger, the user decides the purpose. The user is the Data Fiduciary and **CLAIRE is a Data Processor** acting on the user's instructions [uncertain: needs legal confirmation].
  - When CLAIRE itself uses the number to **match across accounts, suggest claims, or send from CLAIRE's own number**, CLAIRE decides the purpose and is a **Data Fiduciary** for that processing [uncertain].
- **Lawful basis.** The Act has only consent (s6) and the closed list of legitimate uses (s7). There is no "legitimate interests" ground [likely](https://www.taxmann.com/post/blog/legitimate-uses-section-7-dpdp-act).
  - **s7(a)** covers processing "for the specified purpose for which the Data Principal has voluntarily provided her personal data to the Data Fiduciary" where she has not objected [verified](https://dpdpa.com/dpdpa2023/chapter-2/section7.html). That fits the *user* keeping a counterparty's number for their mutual job-work dealings.
  - It does **not** clearly cover CLAIRE's cross-account matching or CLAIRE-sent messages, because the number was not given to CLAIRE. Treat those as **consent-based**: obtain consent on the share/claim page.
- **Practical rules for CLAIRE**
  1. **Purpose limitation.** Use counterparty phones only to (a) build share links the *user* sends, and (b) match a counterparty who signs up *and accepts*. Never use them for marketing, enrichment, or suggesting the counterparty to other users.
  2. **Notice on the share page** (Rule 3 style, standalone, plain language, ta/hi/en). Cover: what we hold (the name and phone the sender typed, plus movement details), why, who recorded it, and how to object, delete or complain. Include a **"Stop / delete my number"** button [likely](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/).
  3. **Objection handling.** "This isn't me / stop" detaches the phone from that `ExternalContact`, notifies the sender, and blocks further links to that number from that sender. This matches s7(a)'s "has not indicated … does not consent" condition [uncertain].
  4. **CLAIRE-sent WhatsApp/SMS only after opt-in from the counterparty**, which is required by Meta anyway [verified](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in).
  5. **Security (Rule 6):** encryption, access control and logging. **Breach (Rule 7):** tell affected people "without delay" and the Board within the prescribed hours. **Erasure (Rule 8):** delete once the purpose is served, with 48 h notice before deletion where applicable, and keep logs ≥1 year [likely](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/).
  6. **Terms of Service:** the user confirms they have a business relationship with each contact they add, and that they may share the contact's number with CLAIRE for this purpose. A **data processing clause** in our ToS backs the processor role.
  7. **Retention default:** an unclaimed `ExternalContact` with no movement in 24 months has its phone purged and keeps only the name in the user's historical records [uncertain: a product choice, tune it with counsel].
- **Get legal review** of the processor/fiduciary split and the claim flow before launch. This note is product research, not legal advice.

---

## (e) Sources

**Meta / WhatsApp**
- Pricing on the WhatsApp Business Platform: https://developers.facebook.com/docs/whatsapp/pricing and https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md
- Opt-in requirements: https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in
- Message templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
- Template categorisation (utility rules): https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines
- Messaging limits: https://developers.facebook.com/docs/whatsapp/messaging-limits
- Click-to-chat FAQ: https://faq.whatsapp.com/5913398998672934 (the page could not be fetched in full); format details from https://bird.com/explained/whatsapp/what-is-a-whatsapp-click-to-chat-link
- India INR rates and GST: https://montymobile.com/blogs/whatsapp-business-api-pricing-in-india-inr-rates-gst-and-the-2026-currency-migration-deadline ; Oct 2026 India changes: https://www.ibtimes.co.in/whatsapp-business-messages-become-paid-october-1-india-prices-rules-what-changes-906727

**TRAI / SMS**
- TRAI direction on pre-tagging variables (18 Nov 2025): https://trai.gov.in/sites/default/files/2025-11/Directions_18112025_0.PDF (a scanned PDF that could not be text-extracted); summary at https://www.fonearena.com/blog/469120/trai-mandates-pre-tagging-sms-variables-curb-phishing-misuse.html
- URL/APK/OTT whitelisting (Aug–Oct 2024): https://trai.gov.in/sites/default/files/Direction_20082024.pdf ; https://inc42.com/buzz/over-10k-entities-whitelist-2-75-lakh-urls-after-trai-directives
- TCCCPR Second Amendment 2025 (header suffixes): https://trai.gov.in/sites/default/files/2025-02/Regulation_12022025.pdf ; https://khaitanco.com/thought-leadership/Efforts-to-Curb-Spam-Continue-TRAI-Releases-Second-Amendment-to-the-TCCCPR-2018
- Service Explicit → Promotional migration (Mar 2026): https://www.fast2sms.com/help/?p=16132
- TCCCPR Third Amendment 2026 (final text not verified): https://www.trai.gov.in/sites/default/files/2026-09/PR_No119of2026.pdf ; https://www.policyedge.in/p/trai-draft-telecom-commercial-communications-customer-preference-third-amendment-regulations-2026
- DLT registration fees: https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-charges-cost-breakdown-in-india
- MSG91 SMS pricing: https://msg91.com/in/pricing/sms
- Number recycling (90 days, SC 2023): https://livelaw.in/top-stories/once-a-mobile-number-is-deactivated-it-is-not-assigned-to-a-new-user-for-90-days-trai-to-supreme-court-241506

**Web platform**
- Background Synchronization API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- workbox-background-sync: https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
- Storage for the web (quota/eviction): https://web.dev/articles/storage-for-the-web
- Push notifications overview: https://web.dev/articles/push-notifications-overview
- Contact Picker API: https://developer.chrome.com/docs/capabilities/web-apis/contact-picker
- Offline outbox / idempotency pattern: https://blog.openreplay.com/offline-form-submission-background-sync/
- OEM background killing: https://dontkillmyapp.com/ ; https://help.pushwoosh.com/hc/en-us/articles/26443659354653-Why-are-push-notifications-not-being-delivered-to-my-Xiaomi-device ; https://intercom.help/progressier/en/articles/7212325-troubleshooting-web-push-notifications-for-pwas-on-android ; https://clevertap.com/blog/the-future-of-push-notifications-navigating-beyond-mi-push-deprecation/
- libphonenumber: https://github.com/google/libphonenumber

**Nexconn / RongCloud**
- Offline message duration (legacy RC docs; rebrand notice): https://docs.rongcloud.io/react-native-imlib/message/manage-offline-message-duration
- Web SDK history (no local store): https://docs.rongcloud.io/web-imlib/message/get-history
- Local package: `node_modules/@nexconn/chat/index.d.ts` (v26.5.1): `ConnectionStatusHandler`, `onOfflineMessageSyncCompleted`

**Comparable apps**
- OkCredit reminders: https://okcredit.in/payment-reminder-app
- Khatabook reminders (third-party): https://richautomate.in/blog/khatabook-whatsapp-payment-reminders-india-2026
- Vyapar transaction messages / invoice link: https://vyaparapp.in/guides/how-to-enable-and-send-transaction-messages-in-vyapar

**DPDP**
- DPDP Rules 2025 highlights: https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/
- PIB explainer (PDF): https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf
- Proposed timeline compression: https://chambers.com/articles/meity-plans-to-cut-short-dpdp-compliance-timeline-and-notify-cross-border-restrictions-for-sdfs
- Act s3 and s7 text: https://www.dpdpa.com/dpdpa2023/chapter-1/section3.html ; https://dpdpa.com/dpdpa2023/chapter-2/section7.html
- Legitimate uses analysis: https://www.taxmann.com/post/blog/legitimate-uses-section-7-dpdp-act
