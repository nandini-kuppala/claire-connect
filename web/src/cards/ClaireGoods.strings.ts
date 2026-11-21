// Buttons on Claire's goods cards (answers and record drafts). The card text itself comes from the server in the
// reader's language. Tamil and Hindi are "to verify" (docs/supply-chain/glossary.md).
import { defineStrings } from '../lib/localStrings';

export const ClaireGoodsS = defineStrings('claire_goods', {
  en: { draft: 'Draft · not saved yet', save: 'Save', saving: 'Saving…', change: 'Change', complete: 'Complete in the form', cancel: 'Cancel', read: 'Read out', saved: 'Saved', not_saved: 'Not saved', expired: 'Too old to save here', open: 'Open' },
  ta: { draft: 'வரைவு · இன்னும் சேமிக்கவில்லை', save: 'சேமி', saving: 'சேமிக்கிறது…', change: 'மாற்று', complete: 'படிவத்தில் முடி', cancel: 'வேண்டாம்', read: 'படித்துக் காட்டு', saved: 'சேமித்தது', not_saved: 'சேமிக்கவில்லை', expired: 'இங்கே சேமிக்க மிகப் பழையது', open: 'திற' },
  hi: { draft: 'ड्राफ़्ट · अभी सेव नहीं', save: 'सेव करें', saving: 'सेव हो रहा है…', change: 'बदलें', complete: 'फ़ॉर्म में पूरा करें', cancel: 'रहने दें', read: 'पढ़कर सुनाएँ', saved: 'सेव हुआ', not_saved: 'सेव नहीं किया', expired: 'यहाँ सेव करने के लिए बहुत पुराना', open: 'खोलें' },
});
