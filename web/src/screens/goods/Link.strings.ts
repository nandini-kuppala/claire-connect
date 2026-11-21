// Strings for slice 6: statement links, WhatsApp share and contact linking. Tamil and Hindi are "to verify".
import { defineStrings } from '../../lib/localStrings';

export const LinkS = defineStrings('goods_link', {
  en: {
    send_statement: 'Send statement on WhatsApp', copy: 'Copy link', copied: 'Copied', seen: 'Opened {date}', not_seen: 'Not opened yet', stopped_party: 'They stopped updates', stopped_me: 'Stopped', stop: 'Stop',
    links: 'Statement links', links_hint: 'Pages you shared with people not using CLAIRE. They show only your records with that person, never prices.',
    asks_link: '{biz} says they are your contact "{contact}" and asks to link.', asks_hint: 'Approve to share your records with them as a business on CLAIRE. Your contact entry merges into them.', approve: 'Approve', decline: 'Decline',
    suggest: '{n} businesses on CLAIRE have records with your phone number.', suggest_hint: 'Ask to link: each one decides. You see nothing until they approve.', ask: 'Ask to link', asked: 'Asked. Each business will decide.',
    returned_some: '{name} says they returned {qty}', returned_hint: 'From your statement link. Accept to record it as got back.', accept: 'Accept', pick: 'Pick what came back',
    approved: 'Linked. Their records are under {biz} now.',
  },
  ta: {
    send_statement: 'WhatsApp-ல் கணக்கு அனுப்பு', copy: 'இணைப்பை நகலெடு', copied: 'நகலெடுத்தது', seen: '{date} திறந்தார்கள்', not_seen: 'இன்னும் திறக்கவில்லை', stopped_party: 'அவர்கள் நிறுத்தினார்கள்', stopped_me: 'நிறுத்தியது', stop: 'நிறுத்து',
    links: 'கணக்கு இணைப்புகள்', links_hint: 'CLAIRE பயன்படுத்தாதவர்களுடன் பகிர்ந்த பக்கங்கள். அந்த நபருடனான உங்கள் பதிவுகள் மட்டும் தெரியும்; விலை ஒருபோதும் தெரியாது.',
    asks_link: '{biz} தாங்கள் உங்கள் தொடர்பு "{contact}" என்று சொல்லி இணைக்கக் கேட்கிறார்கள்.', asks_hint: 'ஏற்றால், CLAIRE-ல் உள்ள அந்த வியாபாரத்துடன் உங்கள் பதிவுகள் பகிரப்படும். உங்கள் தொடர்பு அவர்களுடன் இணையும்.', approve: 'ஏற்கிறேன்', decline: 'வேண்டாம்',
    suggest: 'CLAIRE-ல் {n} வியாபாரங்களிடம் உங்கள் தொலைபேசி எண்ணுடன் பதிவுகள் உள்ளன.', suggest_hint: 'இணைக்கக் கேளுங்கள்: ஒவ்வொருவரும் முடிவு செய்வார்கள். அவர்கள் ஏற்கும் வரை நீங்கள் எதுவும் பார்க்க முடியாது.', ask: 'இணைக்கக் கேள்', asked: 'கேட்டாகிவிட்டது. ஒவ்வொரு வியாபாரமும் முடிவு செய்யும்.',
    returned_some: '{name} {qty} திருப்பிக் கொடுத்ததாகச் சொல்கிறார்', returned_hint: 'உங்கள் கணக்கு இணைப்பிலிருந்து. ஏற்றால் திரும்ப வந்ததாகப் பதியும்.', accept: 'ஏற்கிறேன்', pick: 'என்ன வந்தது என்று தேர்ந்தெடு',
    approved: 'இணைந்தது. அவர்களின் பதிவுகள் இப்போது {biz}-இன் கீழ்.',
  },
  hi: {
    send_statement: 'WhatsApp पर हिसाब भेजें', copy: 'लिंक कॉपी करें', copied: 'कॉपी हुआ', seen: '{date} को खोला', not_seen: 'अभी नहीं खोला', stopped_party: 'उन्होंने बंद किया', stopped_me: 'बंद', stop: 'बंद करें',
    links: 'हिसाब लिंक', links_hint: 'CLAIRE न इस्तेमाल करने वालों से साझा किए पेज। उनमें सिर्फ़ उस व्यक्ति के साथ आपके रिकॉर्ड दिखते हैं, कीमत कभी नहीं।',
    asks_link: '{biz} कहते हैं कि वे आपका संपर्क "{contact}" हैं और जोड़ना चाहते हैं।', asks_hint: 'मंज़ूर करने पर आपके रिकॉर्ड CLAIRE पर उस बिज़नेस के साथ साझा होंगे। आपका संपर्क उनमें मिल जाएगा।', approve: 'मंज़ूर', decline: 'मना',
    suggest: 'CLAIRE पर {n} बिज़नेस के पास आपके फ़ोन नंबर के साथ रिकॉर्ड हैं।', suggest_hint: 'जोड़ने को कहें: हर एक तय करेगा। उनके मंज़ूर करने तक आपको कुछ नहीं दिखेगा।', ask: 'जोड़ने को कहें', asked: 'कहा गया। हर बिज़नेस तय करेगा।',
    returned_some: '{name} कहते हैं उन्होंने {qty} लौटाया', returned_hint: 'आपके हिसाब लिंक से। मंज़ूर करें तो वापस आया दर्ज होगा।', accept: 'मंज़ूर', pick: 'क्या आया, चुनें',
    approved: 'जुड़ गया। उनके रिकॉर्ड अब {biz} के नीचे हैं।',
  },
});
