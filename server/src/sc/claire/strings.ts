// Templates for personal Claire's goods answers (04 §9.2): number + unit first, records inline, a source line, and
// estimates in words. Tamil and Hindi are "to verify" (docs/supply-chain/glossary.md), like the app's other strings.
type L = 'en' | 'ta' | 'hi';
const S = {
  en: {
    about: 'about', at_title: 'Your goods at {name}', out_title: 'Your goods out with others', in_title: 'In your unit', coming_title: 'Coming in', late_title: 'Late work', ready_title: 'Ready to collect', open_title: 'Open work', closed_title: 'Recently closed work',
    moves_title: 'Recent records', analytics_title: 'Loss % by unit', turnaround_title: 'Days taken by unit', rejects_title: 'Rejects % by unit', job_title: '{process} at {name}',
    being: '{qty} {label} being {process}', still_there: 'still there', since: 'since {date}', expected: 'expected {date}', late_n: 'late {n} days', due_today: 'due today', ready: 'ready to collect', held: 'held for dues',
    jobs_n: '{n} jobs', not_enough: 'not enough history ({n} jobs)', usual: 'usual {pct} %', with_them: 'with them (not for work)', to_confirm: 'to check and confirm', expected_back: 'expected back',
    nothing_at: 'Nothing of yours is at {name} now.', nothing_match: 'Nothing matching "{what}" at {name}; this is everything there.', nothing: 'Nothing to show.', unknown_party: 'I don\'t know "{name}" in your records.',
    which_party: 'Which one?', source: 'From your records · {n} · as of {time}', source_est: 'From your records · {n} · as of {time} · "about" = after the usual loss',
    owner_only: 'Only the owner can see this.', plan: 'Record it when you send it. I\'ll keep it ready.', open_form: 'Open the form', saved: 'Saved.', cancelled: 'Not saved.', expired: 'This draft is older than a day; check it in the form.',
    d_send_for_work: 'Sent for {process}', d_got_back: 'Got back', d_buy: 'Bought', d_sell: 'Sold', d_to: 'to {name}', d_from: 'from {name}', d_past: 'past', today: 'today', yesterday: 'yesterday',
    n_split: 'Split evenly across sizes; change it if not.', n_pick_material: 'Choose the material.', n_pick_party: 'Choose who it is with.', n_pick_job: 'Choose which work this is for.', n_tenx: '{qty} is about 10 times your usual; check it.', n_dup: 'You recorded the same today; check it is not twice.',
    n_no_unit: 'Check the unit.', n_short: 'Your unit has less of this than that; Save will stop. Use Change to record it anyway.', save: 'Save', change: 'Change', cancel: 'Cancel', read_back: '{verb} {lines} {party} · {date}', d_header: '{verb} · {tense} · {date}',
    late_chip: "What's late", out_chip: 'Out with others', coming_chip: 'Coming in', processes: 'process', and_more: '+{n} more',
  },
  ta: {
    about: 'சுமார்', at_title: '{name}-இல் உங்கள் சரக்கு', out_title: 'வெளியே உள்ள உங்கள் சரக்கு', in_title: 'உங்கள் யூனிட்டில்', coming_title: 'வர வேண்டியது', late_title: 'தாமதமான வேலை', ready_title: 'எடுக்க தயார்', open_title: 'நடக்கும் வேலை', closed_title: 'சமீபத்தில் முடிந்த வேலை',
    moves_title: 'சமீபத்திய பதிவுகள்', analytics_title: 'யூனிட் வாரியாக லாஸ் %', turnaround_title: 'யூனிட் வாரியாக எடுத்த நாட்கள்', rejects_title: 'யூனிட் வாரியாக ரிஜெக்ட் %', job_title: '{name}-இல் {process}',
    being: '{qty} {label} {process} நடக்கிறது', still_there: 'இன்னும் அங்கே', since: '{date} முதல்', expected: 'வர வேண்டியது {date}', late_n: '{n} நாள் தாமதம்', due_today: 'இன்று வர வேண்டும்', ready: 'எடுக்க தயார்', held: 'பாக்கிக்காக நிறுத்தியது',
    jobs_n: '{n} வேலைகள்', not_enough: 'போதிய வரலாறு இல்லை ({n} வேலைகள்)', usual: 'வழக்கம் {pct} %', with_them: 'அவர்களிடம் (வேலைக்கு அல்ல)', to_confirm: 'சரிபார்த்து உறுதி செய்ய', expected_back: 'திரும்ப வர வேண்டியது',
    nothing_at: 'இப்போது {name}-இல் உங்கள் சரக்கு எதுவும் இல்லை.', nothing_match: '{name}-இல் "{what}" எதுவும் இல்லை; அங்கே உள்ளது இவ்வளவுதான்.', nothing: 'காட்ட எதுவும் இல்லை.', unknown_party: 'உங்கள் பதிவுகளில் "{name}" இல்லை.',
    which_party: 'எந்த ஒன்று?', source: 'உங்கள் பதிவுகளிலிருந்து · {n} · {time} நிலவரம்', source_est: 'உங்கள் பதிவுகளிலிருந்து · {n} · {time} நிலவரம் · "சுமார்" = வழக்கமான லாஸுக்குப் பிறகு',
    owner_only: 'இதை உரிமையாளர் மட்டுமே பார்க்க முடியும்.', plan: 'அனுப்பும்போது பதியுங்கள். நான் தயாராக வைத்திருக்கிறேன்.', open_form: 'படிவத்தைத் திற', saved: 'சேமித்தது.', cancelled: 'சேமிக்கவில்லை.', expired: 'இந்த வரைவு ஒரு நாளுக்கு மேல் பழையது; படிவத்தில் சரிபாருங்கள்.',
    d_send_for_work: '{process}-க்கு அனுப்பியது', d_got_back: 'திரும்ப வந்தது', d_buy: 'வாங்கியது', d_sell: 'விற்றது', d_to: '{name}-க்கு', d_from: '{name}-இடமிருந்து', d_past: 'நடந்தது', today: 'இன்று', yesterday: 'நேற்று',
    n_split: 'சைஸ்களுக்குச் சமமாகப் பிரித்தேன்; இல்லையென்றால் மாற்றுங்கள்.', n_pick_material: 'பொருளைத் தேர்ந்தெடுங்கள்.', n_pick_party: 'யாரிடம் என்று தேர்ந்தெடுங்கள்.', n_pick_job: 'எந்த வேலைக்கு என்று தேர்ந்தெடுங்கள்.', n_tenx: '{qty} உங்கள் வழக்கத்தை விட சுமார் 10 மடங்கு; சரிபாருங்கள்.', n_dup: 'இன்று இதையே பதிந்திருக்கிறீர்கள்; இரண்டு முறை இல்லையா என்று பாருங்கள்.',
    n_no_unit: 'அலகைச் சரிபாருங்கள்.', n_short: 'உங்கள் யூனிட்டில் இதை விடக் குறைவாக உள்ளது; சேமிக்க முடியாது. இருந்தாலும் பதிய "மாற்று" பயன்படுத்துங்கள்.', save: 'சேமி', change: 'மாற்று', cancel: 'வேண்டாம்', read_back: '{party} {lines} {verb} · {date}', d_header: '{verb} · {tense} · {date}',
    late_chip: 'என்ன தாமதம்', out_chip: 'வெளியே உள்ளது', coming_chip: 'வர வேண்டியது', processes: 'வேலை', and_more: '+{n} மேலும்',
  },
  hi: {
    about: 'करीब', at_title: '{name} पर आपका माल', out_title: 'दूसरों के पास आपका माल', in_title: 'आपकी यूनिट में', coming_title: 'आने वाला', late_title: 'देर वाला काम', ready_title: 'लेने को तैयार', open_title: 'चल रहा काम', closed_title: 'हाल में बंद काम',
    moves_title: 'हाल के रिकॉर्ड', analytics_title: 'यूनिट के हिसाब से लॉस %', turnaround_title: 'यूनिट के हिसाब से लगे दिन', rejects_title: 'यूनिट के हिसाब से रिजेक्ट %', job_title: '{name} पर {process}',
    being: '{qty} {label} की {process} चल रही है', still_there: 'अभी वहीं', since: '{date} से', expected: '{date} तक आना है', late_n: '{n} दिन देर', due_today: 'आज आना है', ready: 'लेने को तैयार', held: 'बकाया के लिए रोका',
    jobs_n: '{n} काम', not_enough: 'पूरा इतिहास नहीं ({n} काम)', usual: 'आम तौर पर {pct} %', with_them: 'उनके पास (काम के लिए नहीं)', to_confirm: 'जाँच कर पुष्टि करें', expected_back: 'वापस आना है',
    nothing_at: 'अभी {name} पर आपका कोई माल नहीं है।', nothing_match: '{name} पर "{what}" कुछ नहीं; वहाँ बस इतना है।', nothing: 'दिखाने को कुछ नहीं।', unknown_party: 'आपके रिकॉर्ड में "{name}" नहीं है।',
    which_party: 'कौन सा?', source: 'आपके रिकॉर्ड से · {n} · {time} तक', source_est: 'आपके रिकॉर्ड से · {n} · {time} तक · "करीब" = आम लॉस के बाद',
    owner_only: 'यह सिर्फ़ मालिक देख सकते हैं।', plan: 'भेजते समय दर्ज करें। मैं तैयार रखूँगी।', open_form: 'फ़ॉर्म खोलें', saved: 'सेव हुआ।', cancelled: 'सेव नहीं किया।', expired: 'यह ड्राफ़्ट एक दिन से पुराना है; फ़ॉर्म में जाँचें।',
    d_send_for_work: '{process} के लिए भेजा', d_got_back: 'वापस आया', d_buy: 'खरीदा', d_sell: 'बेचा', d_to: '{name} को', d_from: '{name} से', d_past: 'हो चुका', today: 'आज', yesterday: 'कल',
    n_split: 'साइज़ों में बराबर बाँटा; अलग हो तो बदलें।', n_pick_material: 'माल चुनें।', n_pick_party: 'किसके साथ, चुनें।', n_pick_job: 'किस काम के लिए, चुनें।', n_tenx: '{qty} आपके आम से करीब 10 गुना है; जाँचें।', n_dup: 'आज यही दर्ज किया है; दो बार तो नहीं?',
    n_no_unit: 'इकाई जाँचें।', n_short: 'आपकी यूनिट में इससे कम है; सेव नहीं होगा। फिर भी दर्ज करने के लिए "बदलें" दबाएँ।', save: 'सेव करें', change: 'बदलें', cancel: 'रहने दें', read_back: '{party} {lines} {verb} · {date}', d_header: '{verb} · {tense} · {date}',
    late_chip: 'क्या देर है', out_chip: 'दूसरों के पास', coming_chip: 'आने वाला', processes: 'काम', and_more: '+{n} और',
  },
};
export type SKey = keyof (typeof S)['en'];
export function tr(lang: string, key: SKey, vars: Record<string, string | number> = {}): string {
  const l = (['en', 'ta', 'hi'].includes(lang) ? lang : 'en') as L;
  return (S[l][key] ?? S.en[key]).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
