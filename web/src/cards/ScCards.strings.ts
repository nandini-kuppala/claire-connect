// Strings for supply-chain cards in chat (movement, dispute) and the Goods conversation strip. "To verify" (glossary.md).
import { defineStrings } from '../lib/localStrings';

export const ScCardS = defineStrings('sc_cards', {
  en: {
    open_goods: 'Open Goods', goods_strip: 'What was sent, what came back, any differences.',
    sent_you: '{name} sent you', you_sent: 'You sent to {name}', sent_back_you: '{name} recorded getting back from you', you_got_back: 'You recorded getting back from {name}',
    for_work: 'for work', back: 'back from work', dc: 'DC {no}', theirs: 'They: {qty}', yours: 'You: {qty}',
    st_sent: 'Check and confirm', st_waiting: 'Waiting for {name}', st_confirmed: 'Confirmed', st_within: 'Confirmed · weighing difference recorded', st_disputed: 'Different numbers', st_cancelled: 'Undone',
    all_correct: 'All correct', different: 'Different number', open: 'Open', confirming: 'Saving…',
    dispute_title: 'Different numbers', sent_label: 'Sent', received_label: 'Received', diff: 'Difference {qty}', allowed: 'allowed {qty}',
    d_open: 'Needs settling', d_proposed: 'Proposal waiting', d_countered: 'Counter-proposal', d_escalated: 'With Trade Desk', d_resolved: 'Settled', d_cancelled: 'Cancelled',
  },
  ta: {
    open_goods: 'சரக்கைத் திற', goods_strip: 'அனுப்பியது, திரும்பியது, வித்தியாசங்கள்.',
    sent_you: '{name} உங்களுக்கு அனுப்பினார்', you_sent: 'நீங்கள் {name}-க்கு அனுப்பினீர்கள்', sent_back_you: '{name} உங்களிடமிருந்து திரும்பப் பெற்றதாகப் பதிந்தார்', you_got_back: '{name}-இடமிருந்து திரும்பப் பெற்றதாகப் பதிந்தீர்கள்',
    for_work: 'வேலைக்கு', back: 'வேலையிலிருந்து திரும்ப', dc: 'DC {no}', theirs: 'அவர்கள்: {qty}', yours: 'நீங்கள்: {qty}',
    st_sent: 'சரிபார்த்து உறுதி செய்', st_waiting: '{name} உறுதி செய்ய காத்திருக்கிறது', st_confirmed: 'உறுதி செய்தது', st_within: 'உறுதி · எடை வித்தியாசம் பதிவானது', st_disputed: 'எண்கள் வேறுபடுகின்றன', st_cancelled: 'ரத்து செய்தது',
    all_correct: 'எல்லாம் சரி', different: 'எண்ணிக்கை வேறு', open: 'திற', confirming: 'சேமிக்கிறது…',
    dispute_title: 'எண்கள் வேறுபடுகின்றன', sent_label: 'அனுப்பியது', received_label: 'பெற்றது', diff: 'வித்தியாசம் {qty}', allowed: 'அனுமதி {qty}',
    d_open: 'தீர்க்க வேண்டும்', d_proposed: 'முன்மொழிவு காத்திருக்கிறது', d_countered: 'எதிர் முன்மொழிவு', d_escalated: 'Trade Desk-இடம்', d_resolved: 'தீர்ந்தது', d_cancelled: 'ரத்து',
  },
  hi: {
    open_goods: 'माल खोलें', goods_strip: 'क्या भेजा, क्या वापस आया, कोई फ़र्क।',
    sent_you: '{name} ने आपको भेजा', you_sent: 'आपने {name} को भेजा', sent_back_you: '{name} ने आपसे वापस पाना दर्ज किया', you_got_back: 'आपने {name} से वापस पाना दर्ज किया',
    for_work: 'काम के लिए', back: 'काम से वापस', dc: 'DC {no}', theirs: 'उनका: {qty}', yours: 'आपका: {qty}',
    st_sent: 'जाँचें और पुष्टि करें', st_waiting: '{name} की पुष्टि का इंतज़ार', st_confirmed: 'पुष्टि हुई', st_within: 'पुष्टि · वज़न का फ़र्क दर्ज', st_disputed: 'आँकड़े अलग हैं', st_cancelled: 'वापस लिया',
    all_correct: 'सब सही', different: 'संख्या अलग', open: 'खोलें', confirming: 'सेव हो रहा है…',
    dispute_title: 'आँकड़े अलग हैं', sent_label: 'भेजा', received_label: 'मिला', diff: 'फ़र्क {qty}', allowed: 'मान्य {qty}',
    d_open: 'निपटाना है', d_proposed: 'प्रस्ताव का इंतज़ार', d_countered: 'जवाबी प्रस्ताव', d_escalated: 'Trade Desk के पास', d_resolved: 'निपट गया', d_cancelled: 'रद्द',
  },
});
