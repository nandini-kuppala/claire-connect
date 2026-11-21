// Strings for slice 9: offline records and stale lists. Tamil and Hindi are "to verify".
import { defineStrings } from '../../lib/localStrings';

export const OfflineS = defineStrings('goods_offline', {
  en: {
    offline: 'Offline', last_updated: 'Last updated {time}', waiting: '{n} records waiting to send', waiting_one: '1 record waiting to send',
    kept: 'Saved on this phone. It will send when you are back online.', sent: 'Sent: {label}', undo: 'Undo', undone: 'Undone.',
    check: 'Check this: you have less of this than recorded', failed: 'Could not send', retry: 'Try again', anyway: 'Record anyway', discard: 'Remove',
    needs_network: 'Needs network', sending: 'Sending…',
    l_send: 'Send for work', l_back: 'Got back', l_trade: 'Record', l_confirm: 'Received', l_output: 'Work done', l_count: 'Stock count', l_made: 'Made here', l_receive: 'Received for work', l_dispatch: 'Sent against order',
  },
  ta: {
    offline: 'இணையம் இல்லை', last_updated: 'கடைசியாகப் புதுப்பித்தது {time}', waiting: '{n} பதிவுகள் அனுப்பக் காத்திருக்கின்றன', waiting_one: '1 பதிவு அனுப்பக் காத்திருக்கிறது',
    kept: 'இந்த போனில் சேமித்தது. இணையம் வந்ததும் அனுப்பும்.', sent: 'அனுப்பியது: {label}', undo: 'ரத்து செய்', undone: 'ரத்து செய்தது.',
    check: 'சரிபாருங்கள்: பதிந்ததை விட உங்களிடம் குறைவாக உள்ளது', failed: 'அனுப்ப முடியவில்லை', retry: 'மீண்டும் முயலு', anyway: 'அப்படியே பதி', discard: 'நீக்கு',
    needs_network: 'இணையம் தேவை', sending: 'அனுப்புகிறது…',
    l_send: 'வேலைக்கு அனுப்பியது', l_back: 'திரும்ப வந்தது', l_trade: 'பதிவு', l_confirm: 'வந்தது', l_output: 'முடிந்த வேலை', l_count: 'ஸ்டாக் எண்ணிக்கை', l_made: 'இங்கே செய்தது', l_receive: 'வேலைக்கு வந்தது', l_dispatch: 'ஆர்டருக்கு அனுப்பியது',
  },
  hi: {
    offline: 'ऑफ़लाइन', last_updated: 'आख़िरी अपडेट {time}', waiting: '{n} एंट्री भेजने के इंतज़ार में', waiting_one: '1 एंट्री भेजने के इंतज़ार में',
    kept: 'इस फ़ोन पर सेव हुआ। इंटरनेट आने पर भेज दिया जाएगा।', sent: 'भेजा गया: {label}', undo: 'वापस लें', undone: 'वापस लिया।',
    check: 'जाँचें: दर्ज से कम माल आपके पास है', failed: 'भेज नहीं पाए', retry: 'फिर कोशिश करें', anyway: 'फिर भी दर्ज करें', discard: 'हटाएँ',
    needs_network: 'इंटरनेट चाहिए', sending: 'भेज रहे हैं…',
    l_send: 'काम पर भेजा', l_back: 'वापस आया', l_trade: 'एंट्री', l_confirm: 'मिला', l_output: 'काम पूरा', l_count: 'स्टॉक गिनती', l_made: 'यहाँ बना', l_receive: 'काम के लिए मिला', l_dispatch: 'ऑर्डर पर भेजा',
  },
});
