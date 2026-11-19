// Category taxonomy shared by server and web.
export type Lang = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml' | 'bn' | 'or' | 'mr' | 'gu';
export type Unit = 'piece' | 'kg' | 'dozen';
export type ListingType = 'product' | 'material' | 'service';
export type Shape =
  | 'tshirt' | 'polo' | 'trackpants' | 'shorts' | 'brief' | 'vest' | 'kidsset' | 'nightwear' | 'leggings' | 'hoodie'
  | 'fabric' | 'yarn' | 'sewing' | 'print' | 'dye';

export interface Category {
  id: string;
  group: 'garment' | 'fabric' | 'yarn' | 'service';
  type: ListingType;
  unit: Unit;
  shape: Shape;
  names: Record<'en' | 'ta' | 'hi', string>;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { id: 'garment.tshirt', group: 'garment', type: 'product', unit: 'piece', shape: 'tshirt', names: { en: 'T-shirts', ta: 'டி-ஷர்ட்', hi: 'टी-शर्ट' }, keywords: ['tshirt', 't-shirt', 't shirt', 'tee', 'round neck', 'टी शर्ट', 'टीशर्ट', 'டி-ஷர்ட்', 'டிஷர்ட்', 'banian'] },
  { id: 'garment.polo', group: 'garment', type: 'product', unit: 'piece', shape: 'polo', names: { en: 'Polo T-shirts', ta: 'போலோ டி-ஷர்ட்', hi: 'पोलो टी-शर्ट' }, keywords: ['polo', 'collar', 'पोलो', 'போலோ'] },
  { id: 'garment.trackpants', group: 'garment', type: 'product', unit: 'piece', shape: 'trackpants', names: { en: 'Track pants', ta: 'டிராக் பேண்ட்', hi: 'ट्रैक पैंट' }, keywords: ['track', 'trackpant', 'track pant', 'jogger', 'lower', 'ट्रैक', 'लोअर', 'டிராக்', 'ட்ராக்'] },
  { id: 'garment.shorts', group: 'garment', type: 'product', unit: 'piece', shape: 'shorts', names: { en: 'Shorts', ta: 'ஷார்ட்ஸ்', hi: 'शॉर्ट्स' }, keywords: ['short', 'bermuda', 'शॉर्ट', 'ஷார்ட்'] },
  { id: 'garment.innerwear', group: 'garment', type: 'product', unit: 'dozen', shape: 'brief', names: { en: 'Innerwear', ta: 'உள்ளாடை', hi: 'इनरवियर' }, keywords: ['inner', 'brief', 'trunk', 'underwear', 'जांघिया', 'इनर', 'உள்ளாடை', 'ஜட்டி'] },
  { id: 'garment.vest', group: 'garment', type: 'product', unit: 'dozen', shape: 'vest', names: { en: 'Vests', ta: 'பனியன்', hi: 'बनियान' }, keywords: ['vest', 'banyan', 'baniyan', 'sando', 'बनियान', 'பனியன்'] },
  { id: 'garment.kids', group: 'garment', type: 'product', unit: 'piece', shape: 'kidsset', names: { en: 'Kids wear', ta: 'குழந்தைகள் உடை', hi: 'बच्चों के कपड़े' }, keywords: ['kid', 'child', 'baby', 'बच्चों', 'बच्चे', 'குழந்தை'] },
  { id: 'garment.nightwear', group: 'garment', type: 'product', unit: 'piece', shape: 'nightwear', names: { en: 'Nightwear', ta: 'நைட்வேர்', hi: 'नाइटवियर' }, keywords: ['night', 'pyjama', 'pajama', 'nighty', 'नाइट', 'पजामा', 'நைட்டி'] },
  { id: 'garment.leggings', group: 'garment', type: 'product', unit: 'piece', shape: 'leggings', names: { en: 'Leggings', ta: 'லெக்கிங்ஸ்', hi: 'लेगिंग्स' }, keywords: ['legging', 'लेगिंग', 'லெக்கிங்'] },
  { id: 'garment.hoodie', group: 'garment', type: 'product', unit: 'piece', shape: 'hoodie', names: { en: 'Sweatshirts', ta: 'ஸ்வெட்ஷர்ட்', hi: 'स्वेटशर्ट' }, keywords: ['hoodie', 'sweatshirt', 'fleece top', 'हुडी', 'स्वेटशर्ट'] },
  { id: 'fabric.knit', group: 'fabric', type: 'material', unit: 'kg', shape: 'fabric', names: { en: 'Knitted fabric', ta: 'பின்னல் துணி', hi: 'निटेड कपड़ा' }, keywords: ['fabric', 'cloth', 'jersey', 'interlock', 'rib', 'fleece', 'कपड़ा', 'फैब्रिक', 'துணி', 'ஃபேப்ரிக்'] },
  { id: 'yarn.cotton', group: 'yarn', type: 'material', unit: 'kg', shape: 'yarn', names: { en: 'Yarn', ta: 'நூல்', hi: 'धागा / यार्न' }, keywords: ['yarn', 'thread', 'count', 'combed', 'धागा', 'यार्न', 'நூல்'] },
  { id: 'service.stitching', group: 'service', type: 'service', unit: 'piece', shape: 'sewing', names: { en: 'Stitching job work', ta: 'தையல் ஜாப் வொர்க்', hi: 'सिलाई जॉब वर्क' }, keywords: ['stitch', 'tailor', 'job work', 'jobwork', 'sewing', 'सिलाई', 'जॉब', 'தையல்', 'ஜாப்'] },
  { id: 'service.printing', group: 'service', type: 'service', unit: 'piece', shape: 'print', names: { en: 'Printing', ta: 'பிரிண்டிங்', hi: 'प्रिंटिंग' }, keywords: ['print', 'screen', 'dtf', 'प्रिंट', 'பிரிண்ட்'] },
  { id: 'service.dyeing', group: 'service', type: 'service', unit: 'kg', shape: 'dye', names: { en: 'Dyeing', ta: 'சாயமிடுதல்', hi: 'रंगाई' }, keywords: ['dye', 'dyeing', 'bleach', 'रंगाई', 'சாயம்'] },
];

export const catById = (id?: string | null) => CATEGORIES.find((c) => c.id === id);

export const LANGS: { code: Lang; native: string; english: string }[] = [
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'en', native: 'English', english: 'English' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'or', native: 'ଓଡ଼ିଆ', english: 'Odia' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
];

export const unitLabel = (u: string, n = 2) =>
  u === 'kg' ? 'kg' : u === 'dozen' ? (n === 1 ? 'dozen' : 'dozen') : n === 1 ? 'pc' : 'pcs';

export const PALETTE = ['#1F2A44', '#0D9488', '#B4552F', '#C89B3C', '#4B5563', '#7C3AED', '#1D4ED8', '#BE185D', '#15803D', '#0F766E', '#9A3412', '#374151', '#E5E7EB', '#F5F5F4'];
