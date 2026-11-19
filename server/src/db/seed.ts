// Demo data: a believable slice of the Tiruppur supply chain. Every seed record is tagged
// is_seed = 1 and shown with a "Demo" label in the app so it is never mistaken for traction.
import { col, connectDb, closeDb, count } from './index.js';
import { now } from '../util.js';
import { BOT } from '../config.js';

type B = {
  key: string; name: string; owner: string; lang: string; city: string; state: string; area?: string; role: string;
  sells: string[]; buys: string[]; about: string; gst?: boolean; udyam?: boolean; mfr?: boolean; visited?: boolean;
  reply: number; auto?: string; accent: string; capacity?: string; phone?: string;
};

const BUSINESSES: B[] = [
  // Buyers / resellers (out of state)
  { key: 'amit', name: 'Amit Hosiery', owner: 'Amit Agarwal', lang: 'hi', city: 'Kolkata', state: 'West Bengal', area: 'Burrabazar', role: 'Reseller', sells: [], buys: ['garment.trackpants', 'garment.tshirt', 'garment.innerwear'], about: 'Supplies 40+ shops in north Kolkata.', gst: true, reply: 25, accent: '#C89B3C', phone: '9000000001' },
  { key: 'rahul', name: 'Rahul Traders', owner: 'Rahul Gupta', lang: 'hi', city: 'Delhi', state: 'Delhi', area: 'Gandhi Nagar', role: 'Wholesaler', sells: ['garment.tshirt'], buys: ['garment.tshirt', 'garment.polo'], about: 'Gandhi Nagar wholesale, ships across North India.', gst: true, reply: 40, accent: '#1D4ED8' },
  { key: 'biswas', name: 'Biswas Hosiery Store', owner: 'Subrata Biswas', lang: 'bn', city: 'Kolkata', state: 'West Bengal', role: 'Retailer', sells: [], buys: ['garment.innerwear', 'garment.vest'], about: 'Family retail since 1994.', reply: 60, accent: '#BE185D' },
  { key: 'sai', name: 'Sai Fashions', owner: 'Srinivas Rao', lang: 'te', city: 'Hyderabad', state: 'Telangana', role: 'Reseller', sells: [], buys: ['garment.kids', 'garment.nightwear'], about: 'Kidswear for Begum Bazaar retailers.', gst: true, reply: 35, accent: '#7C3AED' },
  { key: 'kumar', name: 'Kumar Retail', owner: 'Kiran Kumar', lang: 'kn', city: 'Bengaluru', state: 'Karnataka', role: 'Retailer', sells: [], buys: ['garment.tshirt', 'garment.leggings'], about: 'Three stores in Chickpet.', reply: 50, accent: '#15803D' },
  { key: 'patil', name: 'Patil Garments', owner: 'Sachin Patil', lang: 'mr', city: 'Pune', state: 'Maharashtra', role: 'Reseller', sells: [], buys: ['garment.trackpants', 'garment.hoodie'], about: 'Sportswear for gyms and schools.', gst: true, reply: 45, accent: '#9A3412' },

  // Garment makers & wholesalers (Tiruppur)
  { key: 'sree', name: 'Sree Textiles', owner: 'Sadhasivam R', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', area: 'Kangeyam Road', role: 'Manufacturer', sells: ['garment.trackpants', 'garment.shorts'], buys: ['fabric.knit', 'service.stitching'], about: 'Cotton and loopknit track pants since 2009. 60 machines.', gst: true, udyam: true, mfr: true, visited: true, reply: 6, auto: 'auto', accent: '#0D9488', phone: '9000000003' },
  { key: 'kavin', name: 'Kavin Knits', owner: 'Kavin Kumar', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', area: 'Avinashi Road', role: 'Manufacturer', sells: ['garment.trackpants', 'garment.tshirt'], buys: ['fabric.knit'], about: 'Basics in cotton and poly-cotton.', gst: true, udyam: true, mfr: true, reply: 12, accent: '#1F2A44' },
  { key: 'rsg', name: 'RS Garments', owner: 'Rajasekar S', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', area: 'PN Road', role: 'Manufacturer', sells: ['garment.trackpants', 'garment.hoodie'], buys: ['fabric.knit', 'service.printing'], about: 'Fleece and loopknit specialists.', gst: true, mfr: true, reply: 18, accent: '#B4552F' },
  { key: 'anand', name: 'Anand Knitwear', owner: 'Anand P', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', area: 'Mangalam Road', role: 'Manufacturer', sells: ['garment.trackpants', 'garment.tshirt'], buys: ['yarn.cotton', 'service.dyeing'], about: 'Make-to-order runs from 500 pieces.', gst: true, udyam: true, mfr: true, visited: true, reply: 22, accent: '#4B5563' },
  { key: 'velan', name: 'Velan Apparels', owner: 'Velmurugan', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Manufacturer', sells: ['garment.trackpants', 'garment.leggings'], buys: ['fabric.knit'], about: 'Lycra track pants and leggings.', gst: true, mfr: true, reply: 30, accent: '#7C3AED' },
  { key: 'muru', name: 'Murugan Fashions', owner: 'Murugan K', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', area: 'Khaderpet', role: 'Wholesaler', sells: ['garment.trackpants', 'garment.tshirt', 'garment.vest'], buys: ['garment.trackpants', 'garment.tshirt'], about: 'Khaderpet wholesale shop. Minimum order ₹5,000.', gst: true, reply: 15, accent: '#0F766E' },
  { key: 'ravi', name: 'Ravi Knit Fashions', owner: 'Ravi Shankar', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', area: 'Veerapandi', role: 'Brand owner', sells: ['garment.tshirt', 'garment.polo', 'garment.trackpants'], buys: ['garment.tshirt', 'service.stitching', 'service.printing', 'fabric.knit'], about: 'Printed tees and polos under the "RKF" label.', gst: true, udyam: true, mfr: true, visited: true, reply: 10, accent: '#1D4ED8', phone: '9000000004' },
  { key: 'devi', name: 'Devi Exports', owner: 'Devi Priya', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Manufacturer', sells: ['garment.tshirt', 'garment.polo'], buys: ['fabric.knit'], about: 'Export-surplus quality for domestic buyers.', gst: true, mfr: true, reply: 20, accent: '#BE185D' },
  { key: 'kpr', name: 'KPR Basics', owner: 'Prakash R', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Manufacturer', sells: ['garment.innerwear', 'garment.vest'], buys: ['yarn.cotton'], about: 'Briefs, trunks and vests by the dozen.', gst: true, udyam: true, mfr: true, reply: 25, accent: '#374151' },
  { key: 'mithra', name: 'Mithra Kids', owner: 'Mithra S', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Manufacturer', sells: ['garment.kids', 'garment.nightwear'], buys: ['fabric.knit', 'service.printing'], about: 'Kids sets ages 2–12, soft cotton.', gst: true, mfr: true, reply: 14, accent: '#C89B3C' },
  { key: 'jaya', name: 'Jaya Garments', owner: 'Jayanthi M', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Manufacturer', sells: ['garment.nightwear', 'garment.leggings'], buys: ['fabric.knit'], about: 'Ladies nightwear and leggings.', gst: true, mfr: true, reply: 28, accent: '#9A3412' },

  // Job work & inputs
  { key: 'lakshmi', name: 'Lakshmi Garments', owner: 'Lakshmi', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', area: 'Anupparpalayam', role: 'Stitching unit', sells: ['service.stitching', 'garment.tshirt'], buys: ['fabric.knit'], about: '20 machines. Track pants and T-shirt job work; plain tees.', udyam: true, mfr: true, reply: 9, accent: '#0D9488', capacity: '20 machines', phone: '9000000002' },
  { key: 'raju', name: 'Raju Stitching Works', owner: 'Raju Kumar', lang: 'hi', city: 'Tiruppur', state: 'Tamil Nadu', area: 'Palladam Road', role: 'Stitching unit', sells: ['service.stitching'], buys: [], about: 'Owner from Bihar. 18 machines, track pants and shorts.', udyam: true, reply: 11, accent: '#1F2A44', capacity: '18 machines' },
  { key: 'srivelan', name: 'Sri Velan Stitching', owner: 'Velan', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Stitching unit', sells: ['service.stitching'], buys: [], about: 'Overlock + flatlock lines.', reply: 16, accent: '#B4552F', capacity: '14 machines' },
  { key: 'elango', name: 'Elango Job Works', owner: 'Elango', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Stitching unit', sells: ['service.stitching'], buys: [], about: 'T-shirts and polos.', reply: 40, accent: '#4B5563', capacity: '10 machines' },
  { key: 'colour', name: 'Colour Craft Prints', owner: 'Imran', lang: 'hi', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Printing unit', sells: ['service.printing'], buys: [], about: 'Screen and DTF printing.', gst: true, reply: 20, accent: '#7C3AED' },
  { key: 'noyyal', name: 'Noyyal Dyeing', owner: 'Senthil Nathan', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Dyeing unit', sells: ['service.dyeing'], buys: [], about: 'ZLD-compliant dyeing, 3 tonnes/day.', gst: true, visited: true, reply: 35, accent: '#15803D' },
  { key: 'arul', name: 'Arul Knitting Mills', owner: 'Arul', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Knitting unit', sells: ['fabric.knit'], buys: ['yarn.cotton'], about: 'Single jersey, rib, interlock, fleece.', gst: true, mfr: true, reply: 25, accent: '#0F766E' },
  { key: 'senthil', name: 'Senthil Yarn Agency', owner: 'Senthil', lang: 'ta', city: 'Tiruppur', state: 'Tamil Nadu', role: 'Yarn agent', sells: ['yarn.cotton'], buys: [], about: 'Combed and carded cotton yarn, 20s to 40s.', gst: true, reply: 18, accent: '#C89B3C' },
];

type L = { b: string; cat: string; title: string; price: number; floor?: number; unit?: string; moq: number; stock?: number; cap?: number; lead?: number; attrs: Record<string, unknown>; art: { shape: string; color: string; pattern?: string }; set?: Record<string, number>; mov?: number };

const SET_TEE = { M: 2, L: 2, XL: 2, XXL: 1 };
const SET_TP = { S: 1, M: 1, L: 1, XL: 1, XXL: 1 };
const SET_KIDS = { '2-4': 1, '4-6': 1, '6-8': 1, '8-10': 1, '10-12': 1 };

const LISTINGS: L[] = [
  // Track pants
  { b: 'sree', cat: 'garment.trackpants', title: 'Cotton loopknit track pants, 240 GSM', price: 168, floor: 162, moq: 300, stock: 1200, cap: 400, lead: 3, attrs: { fabric: 'cotton loopknit', gsm: 240, colours: ['black', 'navy', 'grey melange'] }, art: { shape: 'trackpants', color: '#1F2A44' }, set: SET_TP },
  { b: 'sree', cat: 'garment.trackpants', title: 'Cotton joggers with zip pockets, 260 GSM', price: 196, floor: 188, moq: 200, stock: 500, cap: 250, lead: 4, attrs: { fabric: 'cotton loopknit', gsm: 260, colours: ['black', 'olive'] }, art: { shape: 'trackpants', color: '#3F4A2F', pattern: 'pocket' }, set: SET_TP },
  { b: 'sree', cat: 'garment.shorts', title: 'Cotton bermuda shorts', price: 118, floor: 110, moq: 300, stock: 900, cap: 300, lead: 3, attrs: { fabric: 'cotton loopknit', gsm: 220, colours: ['grey', 'navy'] }, art: { shape: 'shorts', color: '#4B5563' }, set: SET_TP },
  { b: 'kavin', cat: 'garment.trackpants', title: 'Cotton track pants, side stripe, 230 GSM', price: 165, floor: 158, moq: 200, stock: 600, cap: 200, lead: 4, attrs: { fabric: 'cotton loopknit', gsm: 230, colours: ['black', 'navy'] }, art: { shape: 'trackpants', color: '#111827', pattern: 'stripe' }, set: SET_TP },
  { b: 'rsg', cat: 'garment.trackpants', title: 'Cotton track pants, rib cuff, 240 GSM', price: 172, floor: 166, moq: 200, stock: 450, cap: 180, lead: 4, attrs: { fabric: 'cotton loopknit', gsm: 240, colours: ['navy', 'black', 'charcoal'] }, art: { shape: 'trackpants', color: '#273449' }, set: SET_TP },
  { b: 'rsg', cat: 'garment.hoodie', title: 'Fleece hoodie, 320 GSM', price: 345, floor: 330, moq: 150, stock: 300, cap: 120, lead: 6, attrs: { fabric: 'cotton fleece', gsm: 320, colours: ['black', 'maroon'] }, art: { shape: 'hoodie', color: '#7F1D1D' } },
  { b: 'anand', cat: 'garment.trackpants', title: 'Cotton track pants, made to order', price: 158, floor: 152, moq: 500, stock: 0, cap: 120, lead: 3, attrs: { fabric: 'cotton loopknit', gsm: 240, colours: ['any colour'] }, art: { shape: 'trackpants', color: '#374151' }, set: SET_TP },
  { b: 'anand', cat: 'garment.tshirt', title: 'Plain round-neck tee, 180 GSM combed', price: 112, floor: 106, moq: 500, stock: 0, cap: 400, lead: 3, attrs: { fabric: 'cotton single jersey', gsm: 180, colours: ['any colour'] }, art: { shape: 'tshirt', color: '#E5E7EB' }, set: SET_TEE },
  { b: 'velan', cat: 'garment.trackpants', title: 'Lycra track pants, slim fit', price: 189, floor: 180, moq: 200, stock: 2000, cap: 300, lead: 2, attrs: { fabric: 'cotton lycra', gsm: 250, colours: ['black', 'navy', 'grey'] }, art: { shape: 'trackpants', color: '#0B1220', pattern: 'piping' }, set: SET_TP },
  { b: 'velan', cat: 'garment.leggings', title: 'Ankle leggings, 4-way lycra', price: 132, floor: 125, moq: 300, stock: 1800, cap: 400, lead: 2, attrs: { fabric: 'cotton lycra', gsm: 220, colours: ['black', 'navy', 'maroon', 'beige'] }, art: { shape: 'leggings', color: '#7F1D1D' } },
  { b: 'muru', cat: 'garment.trackpants', title: 'Polyester track pants, value range', price: 149, floor: 142, moq: 100, stock: 3000, cap: 0, lead: 1, attrs: { fabric: 'polyester', gsm: 200, colours: ['black', 'navy', 'grey'] }, art: { shape: 'trackpants', color: '#334155', pattern: 'stripe' }, set: SET_TP, mov: 5000 },
  { b: 'muru', cat: 'garment.tshirt', title: 'Assorted round-neck tees (mixed colours)', price: 92, floor: 86, moq: 100, stock: 5000, cap: 0, lead: 1, attrs: { fabric: 'cotton', gsm: 160, colours: ['assorted'] }, art: { shape: 'tshirt', color: '#0D9488' }, set: SET_TEE, mov: 5000 },
  { b: 'muru', cat: 'garment.vest', title: 'White cotton vests (dozen)', price: 480, floor: 456, unit: 'dozen', moq: 10, stock: 400, cap: 0, lead: 1, attrs: { fabric: 'cotton rib', colours: ['white'] }, art: { shape: 'vest', color: '#F5F5F4' }, mov: 5000 },

  // T-shirts / polos
  { b: 'kavin', cat: 'garment.tshirt', title: 'Plain round-neck tee, 180 GSM', price: 118, floor: 112, moq: 300, stock: 2500, cap: 500, lead: 2, attrs: { fabric: 'cotton single jersey', gsm: 180, colours: ['white', 'black', 'navy', 'red', 'bottle green'] }, art: { shape: 'tshirt', color: '#B91C1C' }, set: SET_TEE },
  { b: 'ravi', cat: 'garment.tshirt', title: 'Printed graphic tee, 180 GSM', price: 165, floor: 158, moq: 200, stock: 1200, cap: 350, lead: 3, attrs: { fabric: 'cotton single jersey', gsm: 180, print: 'screen print', colours: ['black', 'white', 'navy'] }, art: { shape: 'tshirt', color: '#111827', pattern: 'print' }, set: SET_TEE },
  { b: 'ravi', cat: 'garment.polo', title: 'Cotton pique polo, 220 GSM', price: 238, floor: 228, moq: 150, stock: 700, cap: 200, lead: 4, attrs: { fabric: 'cotton pique', gsm: 220, colours: ['navy', 'white', 'maroon'] }, art: { shape: 'polo', color: '#1E3A8A' }, set: SET_TEE },
  { b: 'devi', cat: 'garment.tshirt', title: 'Export-surplus combed tee, 200 GSM', price: 135, floor: 128, moq: 200, stock: 1600, cap: 0, lead: 2, attrs: { fabric: 'combed cotton', gsm: 200, colours: ['heather grey', 'olive', 'sky blue'] }, art: { shape: 'tshirt', color: '#6B7280' }, set: SET_TEE },
  { b: 'devi', cat: 'garment.polo', title: 'Tipped collar polo, 210 GSM', price: 212, floor: 204, moq: 200, stock: 900, cap: 150, lead: 3, attrs: { fabric: 'cotton pique', gsm: 210, colours: ['white', 'black'] }, art: { shape: 'polo', color: '#F3F4F6', pattern: 'tipped' }, set: SET_TEE },
  { b: 'lakshmi', cat: 'garment.tshirt', title: 'Plain tee, 160 GSM (own stitching)', price: 98, floor: 94, moq: 300, stock: 800, cap: 600, lead: 2, attrs: { fabric: 'cotton single jersey', gsm: 160, colours: ['white', 'black', 'navy'] }, art: { shape: 'tshirt', color: '#F8FAFC' }, set: SET_TEE },

  // Innerwear, kids, nightwear
  { b: 'kpr', cat: 'garment.innerwear', title: 'Men’s cotton briefs (dozen)', price: 420, floor: 400, unit: 'dozen', moq: 20, stock: 900, cap: 150, lead: 2, attrs: { fabric: 'cotton rib', colours: ['assorted'] }, art: { shape: 'brief', color: '#1D4ED8' } },
  { b: 'kpr', cat: 'garment.innerwear', title: 'Men’s trunks, elastic waist (dozen)', price: 516, floor: 492, unit: 'dozen', moq: 20, stock: 600, cap: 120, lead: 2, attrs: { fabric: 'cotton lycra', colours: ['black', 'grey', 'navy'] }, art: { shape: 'brief', color: '#111827' } },
  { b: 'kpr', cat: 'garment.vest', title: 'Men’s RN vests, 100% cotton (dozen)', price: 456, floor: 438, unit: 'dozen', moq: 20, stock: 800, cap: 150, lead: 2, attrs: { fabric: 'cotton', colours: ['white'] }, art: { shape: 'vest', color: '#FAFAF9' } },
  { b: 'mithra', cat: 'garment.kids', title: 'Kids tee + shorts set, printed', price: 165, floor: 158, moq: 200, stock: 1400, cap: 300, lead: 3, attrs: { fabric: 'cotton', gsm: 170, colours: ['assorted prints'] }, art: { shape: 'kidsset', color: '#F59E0B', pattern: 'print' }, set: SET_KIDS },
  { b: 'mithra', cat: 'garment.nightwear', title: 'Kids pyjama set, full sleeve', price: 175, floor: 168, moq: 200, stock: 800, cap: 200, lead: 3, attrs: { fabric: 'cotton', colours: ['assorted'] }, art: { shape: 'nightwear', color: '#60A5FA', pattern: 'dots' }, set: SET_KIDS },
  { b: 'jaya', cat: 'garment.nightwear', title: 'Ladies nightwear set, cotton', price: 245, floor: 235, moq: 150, stock: 650, cap: 150, lead: 4, attrs: { fabric: 'cotton', colours: ['peach', 'lavender', 'mint'] }, art: { shape: 'nightwear', color: '#F9A8D4', pattern: 'dots' } },
  { b: 'jaya', cat: 'garment.leggings', title: 'Churidar leggings, cotton lycra', price: 118, floor: 112, moq: 300, stock: 1500, cap: 400, lead: 2, attrs: { fabric: 'cotton lycra', colours: ['assorted 12 colours'] }, art: { shape: 'leggings', color: '#0F766E' } },

  // Inputs
  { b: 'arul', cat: 'fabric.knit', title: 'Cotton single jersey, 180 GSM (white/RFD)', price: 445, floor: 430, unit: 'kg', moq: 100, stock: 3000, cap: 1500, lead: 3, attrs: { knit: 'single jersey', gsm: 180, count: '30s combed', colours: ['white RFD'] }, art: { shape: 'fabric', color: '#F1F5F9' } },
  { b: 'arul', cat: 'fabric.knit', title: 'Cotton loopknit, 240 GSM', price: 470, floor: 455, unit: 'kg', moq: 100, stock: 1800, cap: 1000, lead: 3, attrs: { knit: 'loopknit', gsm: 240, colours: ['grey melange', 'black'] }, art: { shape: 'fabric', color: '#9CA3AF' } },
  { b: 'arul', cat: 'fabric.knit', title: 'Poly-cotton jersey, 160 GSM', price: 278, floor: 268, unit: 'kg', moq: 150, stock: 2500, cap: 1200, lead: 2, attrs: { knit: 'single jersey', gsm: 160, colours: ['navy', 'black'] }, art: { shape: 'fabric', color: '#1E3A8A' } },
  { b: 'senthil', cat: 'yarn.cotton', title: '30s combed cotton yarn', price: 342, floor: 334, unit: 'kg', moq: 200, stock: 8000, cap: 0, lead: 2, attrs: { count: '30s', type: 'combed' }, art: { shape: 'yarn', color: '#F5F5F4' } },
  { b: 'senthil', cat: 'yarn.cotton', title: '20s carded cotton yarn', price: 289, floor: 282, unit: 'kg', moq: 200, stock: 6000, cap: 0, lead: 2, attrs: { count: '20s', type: 'carded' }, art: { shape: 'yarn', color: '#E7E5E4' } },

  // Services
  { b: 'lakshmi', cat: 'service.stitching', title: 'Track pants & tee stitching (job work)', price: 22, floor: 20, moq: 500, stock: 0, cap: 220, lead: 1, attrs: { garments: ['track pants', 'T-shirts'], machines: 20 }, art: { shape: 'sewing', color: '#0D9488' } },
  { b: 'raju', cat: 'service.stitching', title: 'Track pants & shorts stitching', price: 21, floor: 19.5, moq: 500, stock: 0, cap: 200, lead: 1, attrs: { garments: ['track pants', 'shorts'], machines: 18 }, art: { shape: 'sewing', color: '#1F2A44' } },
  { b: 'srivelan', cat: 'service.stitching', title: 'Flatlock / overlock stitching', price: 23, floor: 21, moq: 300, stock: 0, cap: 140, lead: 1, attrs: { garments: ['track pants', 'leggings'], machines: 14 }, art: { shape: 'sewing', color: '#B4552F' } },
  { b: 'elango', cat: 'service.stitching', title: 'T-shirt & polo stitching', price: 16, floor: 15, moq: 500, stock: 0, cap: 260, lead: 1, attrs: { garments: ['T-shirts', 'polos'], machines: 10 }, art: { shape: 'sewing', color: '#4B5563' } },
  { b: 'colour', cat: 'service.printing', title: 'Screen print, up to 4 colours', price: 18, floor: 15, moq: 300, stock: 0, cap: 2000, lead: 2, attrs: { method: 'screen', colours: 4 }, art: { shape: 'print', color: '#7C3AED' } },
  { b: 'colour', cat: 'service.printing', title: 'DTF print, full colour A4', price: 38, floor: 34, moq: 100, stock: 0, cap: 800, lead: 2, attrs: { method: 'DTF' }, art: { shape: 'print', color: '#DB2777' } },
  { b: 'noyyal', cat: 'service.dyeing', title: 'Reactive dyeing, light–dark shades', price: 95, floor: 85, unit: 'kg', moq: 150, stock: 0, cap: 3000, lead: 3, attrs: { shades: ['light ₹80', 'medium ₹95', 'dark ₹115'] }, art: { shape: 'dye', color: '#15803D' } },
];

const AGENTS = [
  { key: 'meena', name: 'Meena', phone: '9000000901', langs: ['ta', 'hi', 'en'], skills: ['help', 'dispute', 'quality_dispute', 'payment_followup', 'onboarding_assist', 'concierge'] },
  { key: 'arjun', name: 'Arjun', phone: '9000000902', langs: ['ta', 'te', 'kn', 'en'], skills: ['help', 'onboarding_assist', 'verification_visit', 'payment_followup'] },
  { key: 'farida', name: 'Farida', phone: '9000000903', langs: ['hi', 'bn', 'en'], skills: ['help', 'dispute', 'quality_dispute', 'payment_followup', 'concierge'] },
];

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seed(force = false) {
  const existing = await count('businesses', { is_seed: 1 });
  if (existing > 0 && !force) return false;
  if (force) {
    for (const t of ['ratings', 'order_events', 'orders', 'offers', 'tickets', 'conversations', 'requirements', 'listings', 'vouches', 'agents', 'claire_sessions', 'dev_messages', 'businesses', 'users']) await col(t).deleteMany({});
  }
  const bag: Record<string, any[]> = {};
  const insert = (table: string, row: Record<string, any>) => { (bag[table] ||= []).push({ _id: row.id ?? row.user_id ?? `${row.voucher_business_id}>${row.vouched_business_id}`, ...row }); };
  const rnd = prng(42);
  const t0 = now() - 1000 * 60 * 60 * 24 * 200;
  const bizId = (k: string) => `b_${k}`;

  for (const b of BUSINESSES) {
    insert('businesses', {
      id: bizId(b.key), slug: b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), name: b.name, owner_name: b.owner,
      language: b.lang, city: b.city, state: b.state, area: b.area ?? null, about: b.about, role_label: b.role,
      sells: b.sells, buys: b.buys, capacity_note: b.capacity ?? null, gstin: b.gst ? `33ABCDE${Math.floor(rnd() * 9000 + 1000)}F1Z${Math.floor(rnd() * 9)}` : null,
      gst_verified: b.gst ? 1 : 0, udyam: b.udyam ? 1 : 0, is_manufacturer: b.mfr ? 1 : 0, unit_visited: b.visited ? 1 : 0,
      reply_minutes: b.reply, auto_reply: b.auto ?? 'suggest', accent: b.accent, is_seed: 1, created_at: t0,
    });
    insert('users', {
      id: `u_${b.key}`, phone: b.phone ?? `90000${String(10000 + Math.floor(rnd() * 89999)).slice(0, 5)}`, name: b.owner, language: b.lang,
      business_id: bizId(b.key), role: 'owner', onboarded: 1, is_seed: 1, created_at: t0,
    });
  }

  for (const a of AGENTS) {
    insert('users', { id: `u_${a.key}`, phone: a.phone, name: a.name, language: a.langs[0], role: 'agent', onboarded: 1, is_seed: 1, created_at: t0 });
    insert('agents', { user_id: `u_${a.key}`, languages: a.langs, skills: a.skills, max_concurrent: 5, status: 'offline' });
  }

  LISTINGS.forEach((l, i) => {
    const type = l.cat.startsWith('service') ? 'service' : l.cat.startsWith('garment') ? 'product' : 'material';
    insert('listings', {
      id: `l_${String(i + 1).padStart(3, '0')}`, business_id: bizId(l.b), category: l.cat, type, title: l.title, attrs: l.attrs, images: [], art: l.art,
      price: l.price, floor_price: l.floor ?? Math.round(l.price * 0.95), unit: l.unit ?? (l.cat.startsWith('fabric') || l.cat.startsWith('yarn') ? 'kg' : 'piece'),
      moq: l.moq, size_set: l.set ?? null, min_order_value: l.mov ?? null, stock_qty: l.stock ?? 0, capacity_per_day: l.cap ?? 0, lead_days: l.lead ?? 3,
      active: 1, created_at: t0,
    });
  });

  // Historical orders + two-way ratings so trust scores and badges look lived in.
  const buyers = ['amit', 'rahul', 'biswas', 'sai', 'kumar', 'patil', 'muru', 'ravi'];
  const sellerListings = LISTINGS.map((l, i) => ({ ...l, id: `l_${String(i + 1).padStart(3, '0')}` })).filter((l) => !l.cat.startsWith('service'));
  const lateBuyers = new Set(['biswas', 'patil']);
  const slowSellers = new Set(['velan', 'jaya', 'elango']);
  let n = 1;
  for (let k = 0; k < 90; k++) {
    const buyer = buyers[Math.floor(rnd() * buyers.length)];
    const l = sellerListings[Math.floor(rnd() * sellerListings.length)];
    if (l.b === buyer) continue;
    const qty = l.unit === 'dozen' ? 20 + Math.floor(rnd() * 60) : l.unit === 'kg' ? 200 + Math.floor(rnd() * 600) : 200 + Math.floor(rnd() * 12) * 100;
    const created = t0 + Math.floor(rnd() * 170) * 86400000;
    const delivered = created + (3 + Math.floor(rnd() * 6)) * 86400000;
    const credit = rnd() < 0.5 ? 0 : 15;
    const due = delivered + credit * 86400000;
    const late = lateBuyers.has(buyer) ? rnd() < 0.55 : rnd() < 0.08;
    const paid = due + (late ? (5 + Math.floor(rnd() * 20)) * 86400000 : -Math.floor(rnd() * 3) * 86400000);
    const oid = `o_seed${n}`;
    insert('orders', {
      id: oid, code: `CC-24-${String(n).padStart(5, '0')}`, kind: 'purchase', buyer_business_id: bizId(buyer), seller_business_id: bizId(l.b), listing_id: l.id,
      title: l.title, qty, unit: l.unit ?? 'piece', unit_price: l.price, total: qty * l.price, advance_pct: 30, credit_days: credit, status: 'closed',
      created_at: created, dispatched_at: delivered - 2 * 86400000, delivered_at: delivered, balance_due_at: due, paid_at: paid,
    });
    const slow = slowSellers.has(l.b);
    const q5 = () => (rnd() < 0.75 ? 5 : 4);
    insert('ratings', {
      id: `r_s${n}`, order_id: oid, rater_business_id: bizId(buyer), ratee_business_id: bizId(l.b), direction: 'buyer_to_seller',
      scores: { quality: slow ? (rnd() < 0.5 ? 4 : 3) : q5(), value: q5(), on_time: slow ? 3 : q5(), communication: q5() }, would_repeat: slow ? (rnd() < 0.6 ? 1 : 0) : 1, created_at: delivered + 86400000,
    });
    insert('ratings', {
      id: `r_b${n}`, order_id: oid, rater_business_id: bizId(l.b), ratee_business_id: bizId(buyer), direction: 'seller_to_buyer',
      scores: { paid_on_time: late ? 2 + Math.floor(rnd() * 2) : 5, clarity: q5(), fair_returns: q5() }, would_repeat: late ? (rnd() < 0.5 ? 1 : 0) : 1, created_at: paid + 86400000,
    });
    n++;
  }

  for (const [a, b, note] of [
    ['muru', 'amit', 'Trading with Amit ji for 3 years'], ['ravi', 'amit', 'Pays on time, clear orders'], ['sree', 'ravi', 'Reliable brand owner'],
    ['muru', 'sree', 'Consistent quality'], ['ravi', 'lakshmi', 'Good stitching, on time'], ['sree', 'lakshmi', 'Does our overflow work'],
  ]) insert('vouches', { voucher_business_id: bizId(a), vouched_business_id: bizId(b), note, created_at: t0 });

  for (const [table, rows] of Object.entries(bag)) if (rows.length) await col(table).insertMany(rows);
  await col('kv').updateOne({ _id: 'seeded_at' } as any, { $set: { v: String(now()) } }, { upsert: true });
  console.log(`[seed] ${BUSINESSES.length} businesses, ${LISTINGS.length} listings, ${n - 1} past orders, ${AGENTS.length} agents`);
  return true;
}

export const BOT_USERS = [
  { id: BOT.claire, name: 'Claire' },
  { id: BOT.updates, name: 'CLAIRE Updates' },
  { id: BOT.desk, name: 'CLAIRE Trade Desk' },
];

if (process.argv[1]?.endsWith('seed.ts')) {
  await connectDb();
  await seed(true);
  await closeDb();
}
