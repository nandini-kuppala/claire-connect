// Chat moderation notices (Nexconn profanity filter; server/src/moderation.ts holds the word list).
import { defineStrings } from '../lib/localStrings';

export const ModerationStrings = defineStrings('moderation', {
  en: {
    blocked: "Not delivered. This message has words that aren't allowed in CLAIRE chats.",
    blocked_label: 'Blocked by moderation',
    masked: 'Some words were hidden by chat moderation.',
  },
  ta: {
    blocked: 'அனுப்பப்படவில்லை. CLAIRE அரட்டைகளில் அனுமதிக்கப்படாத சொற்கள் இந்தச் செய்தியில் உள்ளன.',
    blocked_label: 'கண்காணிப்பால் தடுக்கப்பட்டது',
    masked: 'அரட்டை கண்காணிப்பால் சில சொற்கள் மறைக்கப்பட்டன.',
  },
  hi: {
    blocked: 'नहीं भेजा गया। इस संदेश में ऐसे शब्द हैं जिनकी CLAIRE चैट में अनुमति नहीं है।',
    blocked_label: 'मॉडरेशन ने रोका',
    masked: 'चैट मॉडरेशन ने कुछ शब्द छिपा दिए।',
  },
});

/** The mask Nexconn puts in place of a masked word (server/src/moderation.ts MASK). */
export const MODERATION_MASK = '***';
