// Strings for slice 7: staff in Setup, the phone PIN, and "Waiting for you". Tamil and Hindi are "to verify".
import { defineStrings } from '../../lib/localStrings';

export const StaffS = defineStrings('goods_staff', {
  en: {
    staff: 'Staff', staff_hint: 'People who record goods for you: they log in with their phone and OTP, and see Goods and Claire only. No prices, chats with buyers, orders or store.',
    add: 'Add staff', name: 'Name', phone: 'Mobile number', remove: 'Remove', has_pin: 'PIN set', added: 'Added. They can log in now with OTP.',
    other_business: 'This number already belongs to another business.', already: 'Already on your staff.',
    pin: 'PIN for this phone', pin_hint: 'On a shared phone, a 4-digit PIN shows who is recording. Asked once each time the app opens.', pin_set: 'Set PIN', pin_current: 'Current PIN', pin_clear: 'Remove PIN', pin_saved: 'PIN saved.', pin_removed: 'PIN removed.',
    waiting: 'Waiting for you', count_line: '{who} counted {counted} {label}; the book says {book}', approve: 'Approve', reject: 'Reject',
    suggest_line: '{who} suggests settling {label}: {outcome}', open: 'Open', o_sent: "use the sender's figure", o_received: "use the receiver's figure", o_split: 'split it', o_credit: 'settle by value',
    pending_sent: 'Sent to the owner to approve.', remove_sure: 'Tap again to remove', suggested: 'Suggested to the owner. Only the owner settles.',
  },
  ta: {
    staff: 'பணியாளர்கள்', staff_hint: 'உங்களுக்காக சரக்கைப் பதிபவர்கள்: போன், OTP-யுடன் உள்நுழைவார்கள்; சரக்கும் Claire-ம் மட்டுமே தெரியும். விலை, வாங்குபவர் அரட்டை, ஆர்டர், கடை தெரியாது.',
    add: 'பணியாளரைச் சேர்', name: 'பெயர்', phone: 'மொபைல் எண்', remove: 'நீக்கு', has_pin: 'PIN உள்ளது', added: 'சேர்த்தது. இப்போது OTP-யுடன் உள்நுழையலாம்.',
    other_business: 'இந்த எண் வேறொரு வியாபாரத்தைச் சேர்ந்தது.', already: 'ஏற்கனவே உங்கள் பணியாளர்.',
    pin: 'இந்த போனுக்கான PIN', pin_hint: 'பகிர்ந்த போனில், யார் பதிகிறார்கள் என்று 4 இலக்க PIN காட்டும். ஆப் திறக்கும் ஒவ்வொரு முறையும் ஒருமுறை கேட்கும்.', pin_set: 'PIN அமை', pin_current: 'தற்போதைய PIN', pin_clear: 'PIN-ஐ நீக்கு', pin_saved: 'PIN சேமித்தது.', pin_removed: 'PIN நீக்கியது.',
    waiting: 'உங்களுக்காகக் காத்திருக்கிறது', count_line: '{who} {counted} {label} எண்ணினார்; கணக்கில் {book}', approve: 'ஏற்கிறேன்', reject: 'வேண்டாம்',
    suggest_line: '{label}: {who} பரிந்துரை: {outcome}', open: 'திற', o_sent: 'அனுப்பியவர் எண்ணை ஏற்பது', o_received: 'பெற்றவர் எண்ணை ஏற்பது', o_split: 'பாதியாகப் பிரிப்பது', o_credit: 'பணமாகத் தீர்ப்பது',
    pending_sent: 'ஒப்புதலுக்காக உரிமையாளருக்கு அனுப்பியது.', remove_sure: 'நீக்க மீண்டும் தட்டவும்', suggested: 'உரிமையாளருக்குப் பரிந்துரைத்தது. உரிமையாளர் மட்டுமே தீர்ப்பார்.',
  },
  hi: {
    staff: 'स्टाफ़', staff_hint: 'आपके लिए माल दर्ज करने वाले: फ़ोन और OTP से लॉग इन करते हैं, सिर्फ़ माल और Claire देखते हैं। कीमत, खरीदारों से चैट, ऑर्डर या दुकान नहीं।',
    add: 'स्टाफ़ जोड़ें', name: 'नाम', phone: 'मोबाइल नंबर', remove: 'हटाएँ', has_pin: 'PIN है', added: 'जोड़ा गया। अब वे OTP से लॉग इन कर सकते हैं।',
    other_business: 'यह नंबर किसी और बिज़नेस का है।', already: 'पहले से आपके स्टाफ़ में।',
    pin: 'इस फ़ोन का PIN', pin_hint: 'साझा फ़ोन पर 4 अंकों का PIN बताता है कि कौन दर्ज कर रहा है। ऐप खुलने पर एक बार पूछा जाता है।', pin_set: 'PIN रखें', pin_current: 'मौजूदा PIN', pin_clear: 'PIN हटाएँ', pin_saved: 'PIN सेव हुआ।', pin_removed: 'PIN हटाया गया।',
    waiting: 'आपका इंतज़ार', count_line: '{who} ने {counted} {label} गिना; हिसाब में {book}', approve: 'मंज़ूर', reject: 'मना',
    suggest_line: '{label}: {who} का सुझाव: {outcome}', open: 'खोलें', o_sent: 'भेजने वाले का आँकड़ा', o_received: 'पाने वाले का आँकड़ा', o_split: 'आधा-आधा', o_credit: 'पैसे से निपटारा',
    pending_sent: 'मालिक की मंज़ूरी के लिए भेजा।', remove_sure: 'हटाने के लिए फिर टैप करें', suggested: 'मालिक को सुझाया। निपटारा सिर्फ़ मालिक करेंगे।',
  },
});
