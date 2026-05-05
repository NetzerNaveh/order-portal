const axios = require('axios');

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  });

  accessToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
  return accessToken;
}

async function zohoGet(path, params = {}) {
  const token = await getAccessToken();
  const response = await axios.get(`https://www.zohoapis.com/crm/v2/${path}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    params,
  });
  return response.data;
}

async function zohoPost(path, data) {
  const token = await getAccessToken();
  const response = await axios.post(`https://www.zohoapis.com/crm/v2/${path}`, data, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  return response.data;
}

// מיפוי תמונות לפי מילות מפתח בשם המוצר (אנגלית/עברית)
// תמונות נאספו מ-noonaesthetics.com
const PRODUCT_IMAGE_MAP = [
  // Brush & Go SPF 50
  { keywords: ['brush', 'go'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-Brush-Go-SPF-50-All-Skin-Closed.webp' },
  // TrioLift
  { keywords: ['triolift'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/TrioLift-copy.webp' },
  // Reform Eye Cream
  { keywords: ['reform'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/02/NOON-Reform-Eye-Cream-20200701-2-copy.webp' },
  // In-Depth Filler Serum (לפני Filler Cream)
  { keywords: ['filler', 'serum'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/In-Depth-Filler-Serum-close.webp' },
  // In-Depth Filler Cream
  { keywords: ['filler', 'cream'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/In-Depth-Filler-Cream-close.webp' },
  { keywords: ['filler'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/In-Depth-Filler-Serum-close.webp' },
  // Restart Serum
  { keywords: ['restart'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/04/Restart-Serum3-1.webp' },
  // Halo-Ronic Serum
  { keywords: ['halo'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Halo-Ronic-Serum.webp' },
  { keywords: ['הלו'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Halo-Ronic-Serum.webp' },
  // Igloo Mask (לפני Igloo Moist)
  { keywords: ['igloo', 'mask'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/04/Igloo3.webp' },
  { keywords: ['igloo', 'מסכ'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/04/Igloo3.webp' },
  { keywords: ['מסכת', 'איגלו'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/04/Igloo3.webp' },
  // Igloo Moist
  { keywords: ['igloo'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Igloo-Moist-close.webp' },
  { keywords: ['איגלו'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Igloo-Moist-close.webp' },
  // MicroSoft Cleanser
  { keywords: ['microsoft'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/MicroSoft-Cleanser-1.webp' },
  { keywords: ['micro', 'soft'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/MicroSoft-Cleanser-1.webp' },
  { keywords: ['מיקרו'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/MicroSoft-Cleanser-1.webp' },
  // CosmoClear Cleanser
  { keywords: ['cosmo', 'clear'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-CosmoClear-Cleanser.webp' },
  { keywords: ['cosmoclear'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-CosmoClear-Cleanser.webp' },
  { keywords: ['קוסמו'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-CosmoClear-Cleanser.webp' },
  // MultiVit Sun Protector SPF 30
  { keywords: ['multivit'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-Multi-Vit-Sun-Protector-SPF-30-close.webp' },
  { keywords: ['מולטי', 'ויט'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-Multi-Vit-Sun-Protector-SPF-30-close.webp' },
  // TXA-Bright Complex
  { keywords: ['txa'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/03/TXA-Brightening-Complex-NEW.webp' },
  // NAM-Bright Complex
  { keywords: ['nam'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/03/NAM-Brightening-Complex-NEW.webp' },
  // Anti-Aging Peptide Complex
  { keywords: ['peptide'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Anti-Aging-Peptide-Complex-NEW.webp' },
  { keywords: ['פפטיד'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Anti-Aging-Peptide-Complex-NEW.webp' },
  // Post Procedure Program
  { keywords: ['post', 'procedure'], url: '/images/post-procedure.jpg' },
  { keywords: ['לאחר', 'טיפול'], url: '/images/post-procedure.jpg' },
  // ThermoGel
  { keywords: ['thermo'], url: '/images/thermogel.jpg' },
  { keywords: ['תרמו'], url: '/images/thermogel.jpg' },
  // Double White
  { keywords: ['double', 'white'], url: '/images/double-white.jpg' },
  { keywords: ['דאבל', 'ווייט'], url: '/images/double-white.jpg' },
  // MediClay Mask
  { keywords: ['mediclay'], url: '/images/mediclay-mask.jpg' },
  { keywords: ['מדיקליי'], url: '/images/mediclay-mask.jpg' },
  // G-Peel Nano (לפני G-Peel)
  { keywords: ['g-peel', 'nano'], url: '/images/g-peel-nano.jpg' },
  { keywords: ['g peel', 'nano'], url: '/images/g-peel-nano.jpg' },
  { keywords: ['g-peel', 'nanocon'], url: '/images/g-peel-nano.jpg' },
  // G-Peel
  { keywords: ['g-peel'], url: '/images/g-peel.jpg' },
  { keywords: ['g peel'], url: '/images/g-peel.jpg' },
  // J-Peel Delicate
  { keywords: ['j-peel'], url: '/images/j-peel.jpg' },
  { keywords: ['j peel'], url: '/images/j-peel.jpg' },
  // P-Peel 20
  { keywords: ['p-peel', '20'], url: '/images/p-peel-20.jpg' },
  { keywords: ['p peel', '20'], url: '/images/p-peel-20.jpg' },
  // P-Peel 40
  { keywords: ['p-peel', '40'], url: '/images/p-peel-40.jpg' },
  { keywords: ['p peel', '40'], url: '/images/p-peel-40.jpg' },
  // P-Peel (fallback)
  { keywords: ['p-peel'], url: '/images/p-peel-20.jpg' },
  // Pre-Peel Conditioner
  { keywords: ['pre-peel'], url: '/images/pre-peel.jpg' },
  { keywords: ['pre', 'peel', 'cond'], url: '/images/pre-peel.jpg' },
  // Peel Neutralizer
  { keywords: ['neutralizer'], url: '/images/peel-neutralizer.jpg' },
  { keywords: ['neutral'], url: '/images/peel-neutralizer.jpg' },
  // Pre Procedure Program
  { keywords: ['pre', 'procedure'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/03/Pre-Procedure-Program-Box-2.webp' },
  { keywords: ['הכנה', 'טיפול'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/03/Pre-Procedure-Program-Box-2.webp' },
  // Lacto-C 15
  { keywords: ['lacto', 'c', '15'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Lacto-C-15-close.webp' },
  { keywords: ['lacto', 'c'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Lacto-C-15-close.webp' },
  // Lacto-S
  { keywords: ['lacto', 's'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-Lacto-S-close.webp' },
  // Lacto 10
  { keywords: ['lacto', '10'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Lacto-10-1.webp' },
  { keywords: ['lacto'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Lacto-C-15-close.webp' },
  // Retinol Charisma
  { keywords: ['retinol'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Retinol-Charisma-1.0-close.webp' },
  // Vitamin C Serum
  { keywords: ['vitamin', 'c'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Vitamin-C-Serum-close.webp' },
  { keywords: ['ויטמין', 'c'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Vitamin-C-Serum-close.webp' },
  // Smart Occlusive System (גם SOS)
  { keywords: ['smart'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Smart-Occulsive-System.webp' },
  { keywords: ['sos'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Smart-Occulsive-System.webp' },
  { keywords: ['אס.או.אס'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Smart-Occulsive-System.webp' },
  // Optimal Moisturizing Guardian (גם OMG)
  { keywords: ['optimal'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Optimal-Moisturizing-Guardian-1.webp' },
  { keywords: ['omg'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Optimal-Moisturizing-Guardian-1.webp' },
  { keywords: ['או.אמ.ג'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Optimal-Moisturizing-Guardian-1.webp' },
  // DeFlame
  { keywords: ['deflame'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-DeFlame-close.webp' },
  { keywords: ['de-flame'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-DeFlame-close.webp' },
  { keywords: ['דפלים'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-DeFlame-close.webp' },
  // Benzo-Azeline
  { keywords: ['benzo'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Benzo-Azeline-10-close.webp' },
  // Azelaic-S (לפני Azelaic-BR)
  { keywords: ['azelaic', 's'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-Azelaic-S-13-close.webp' },
  { keywords: ['azelaic', 'br'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Azelaic-Br-13.webp' },
  { keywords: ['azelaic'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/US-Azelaic-S-13-close.webp' },
  // HydroCalming Vit Complex
  { keywords: ['hydro'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/HydroCalming-Vit-Complex-NEW.webp' },
  { keywords: ['הידרו'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/HydroCalming-Vit-Complex-NEW.webp' },
  // CYS Brightening Complex
  { keywords: ['cys'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/03/CYS-Brightening-Complex-NEW.webp' },
  // Antioxidant Complex
  { keywords: ['antioxidant'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Antioxidant-Complex-NEW.webp' },
  { keywords: ['אנטיאוקסידנט'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/Antioxidant-Complex-NEW.webp' },
  // AcNo Complex
  { keywords: ['acno'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/AcNo-Complex-NEW.webp' },
  { keywords: ['אקנו'], url: 'https://noonaesthetics.com/wp-content/uploads/2025/01/AcNo-Complex-NEW.webp' },
];

function getImageForProduct(name) {
  if (!name) return null;
  const lname = name.toLowerCase();
  for (const entry of PRODUCT_IMAGE_MAP) {
    if (entry.keywords.every(kw => lname.includes(kw.toLowerCase()))) {
      return entry.url;
    }
  }
  return null;
}

// סדר המוצרים לפי קובץ Excel - עם קודי ZOHO האמיתיים
const EXCEL_SKU_ORDER = [
  // Home Care - Brush & Go
  '610180230000','610280230000','924011','924012','923021','923022','924021','924022',
  // Home Care - טיפולים
  '643205030000','621005000000','621205030000','621505000000',
  '631305030000','632005030000','631405000000','632105030000',
  '911901','912902','645805000000','640605000000','640805000000','642205030000',
  '692200000000','692400030000','645404000000',
  '910401','910501','910502',
  '640405000000','911401','645604000000',
  '660304000000','661004000000','910303',
  '625212000000','625612000000','625412030000',
  '640205000000','911101','641505030000',
  '915011','915012','915013',
  '915101','635601500000','635201500000','635301500000',
  '635101500000','635501500000','635401500000','635801500000',
  '914001','914002','914003','914004',
  // In-Clinic
  '621015000000','640215000000','621215030000','621515000000',
  '645810000000','641515030000','640415000000',
  '660312000000','661012000000','642215030000','640615000000','640815000000',
  '625220000000','625620000000','625420030000',
  '915001','915002','915003','644220000000',
  '918003','918021','918022','918121','918024','918016','918027',
  '915301','915401',
  // Travel Size
  '625203000000','625403030000','625601500000','642201530000',
  '621001500000','621501500000','621201530000','640201500000',
  '645401500000','640401500000','645601500000','660301500000',
  '661001500000','640801500000','640601500000','645801500000','641501530000',
  '631301530000','632001530000','631401500000','632101530000',
  '911204','910904','911824','911004',
  // Devices
  '950001',
];

async function getProducts() {
  const data = await zohoGet('Products', { per_page: 200, fields: 'Product_Name,Unit_Price,Product_Active,Product_Code,Description,Image_URL,Usage_Unit' });
  const products = (data.data || []).filter(p => p.Product_Active !== false);

  const mapped = products.map(p => ({
    id: p.id,
    sku: String(p.Product_Code || ''),
    name: p.Product_Name,
    price: p.Unit_Price,
    description: p.Description,
    image: p.Image_URL || getImageForProduct(p.Product_Name),
    unit: p.Usage_Unit || '',
  }));

  // מיין לפי סדר Excel
  mapped.sort((a, b) => {
    const ai = EXCEL_SKU_ORDER.indexOf(a.sku);
    const bi = EXCEL_SKU_ORDER.indexOf(b.sku);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return mapped;
}

async function getContactByPhone(phone) {
  const normalized = phone.replace(/\D/g, '');

  // בנה כל הפורמטים האפשריים
  const variants = new Set([normalized]);
  if (normalized.startsWith('972')) {
    variants.add('0' + normalized.slice(3));
    variants.add('+' + normalized);
  } else if (normalized.startsWith('0')) {
    const withCountry = '972' + normalized.slice(1);
    variants.add(withCountry);
    variants.add('+' + withCountry);
  }
  // פורמטים עם מקף ורווח
  if (normalized.startsWith('0') && normalized.length === 10) {
    variants.add(normalized.slice(0,3) + '-' + normalized.slice(3));
    variants.add('(' + normalized.slice(0,3) + ') ' + normalized.slice(3,6) + '-' + normalized.slice(6));
  }

  console.log(`[phone-search] variants: ${[...variants].join(', ')}`);

  for (const num of [...variants]) {
    // חיפוש לפי phone (שדה Phone)
    try {
      const data = await zohoGet('Contacts/search', { phone: num });
      console.log(`[phone-search] search phone=${num} found=${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) return data.data[0];
    } catch (e) { console.log(`[phone-search] search phone error: ${e.message}`); }

    // חיפוש לפי Mobile בשדה נפרד
    try {
      const data = await zohoGet('Contacts/search', { criteria: `(Mobile:equals:${num})` });
      console.log(`[phone-search] criteria Mobile=${num} found=${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) return data.data[0];
    } catch (e) { console.log(`[phone-search] criteria Mobile error: ${e.message}`); }

    // חיפוש לפי Phone בשדה נפרד
    try {
      const data = await zohoGet('Contacts/search', { criteria: `(Phone:equals:${num})` });
      console.log(`[phone-search] criteria Phone=${num} found=${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) return data.data[0];
    } catch (e) { console.log(`[phone-search] criteria Phone error: ${e.message}`); }
  }

  // חיפוש word על 9 הספרות האחרונות
  const last9 = normalized.slice(-9);
  console.log(`[phone-search] trying word search last9=${last9}`);
  try {
    const data = await zohoGet('Contacts/search', { word: last9 });
    console.log(`[phone-search] word search last9=${last9} found=${data.data?.length || 0} raw=${JSON.stringify(data).slice(0,200)}`);
    if (data.data && data.data.length > 0) return data.data[0];
  } catch (e) { console.log(`[phone-search] word search error: ${e.message}`); }

  // חיפוש ב-Accounts module
  for (const num of [...variants]) {
    try {
      const data = await zohoGet('Accounts/search', { phone: num });
      console.log(`[phone-search] Accounts phone=${num} found=${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) {
        const account = data.data[0];
        // מצא Contact שמשויך ל-Account זה
        try {
          const contacts = await zohoGet('Contacts/search', { criteria: `(Account_Name:equals:${account.id})` });
          if (contacts.data && contacts.data.length > 0) {
            console.log(`[phone-search] found contact via Account`);
            return contacts.data[0];
          }
        } catch {}
        // אם אין Contact, בנה אובייקט מה-Account
        return {
          id: account.id,
          Full_Name: account.Account_Name,
          Account_Name: { id: account.id, name: account.Account_Name },
          Owner: account.Owner,
          Mobile: num,
          _fromAccount: true,
        };
      }
    } catch (e) { console.log(`[phone-search] Accounts error: ${e.message}`); }

    try {
      const data = await zohoGet('Accounts/search', { criteria: `(Phone:equals:${num})` });
      console.log(`[phone-search] Accounts criteria Phone=${num} found=${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) {
        const account = data.data[0];
        try {
          const contacts = await zohoGet('Contacts/search', { criteria: `(Account_Name:equals:${account.id})` });
          if (contacts.data && contacts.data.length > 0) return contacts.data[0];
        } catch {}
        return {
          id: account.id,
          Full_Name: account.Account_Name,
          Account_Name: { id: account.id, name: account.Account_Name },
          Owner: account.Owner,
          Mobile: num,
          _fromAccount: true,
        };
      }
    } catch (e) { console.log(`[phone-search] Accounts criteria error: ${e.message}`); }
  }

  return null;
}

async function createSalesOrder(contact, items) {
  const lineItems = items.map(item => ({
    product: { id: item.productId },
    quantity: item.quantity,
    unit_price: item.price,
    total: item.price * item.quantity,
    Discount: 0,
    list_price: item.price,
  }));

  // Account_Name חייב להיות אובייקט עם id
  const accountName = contact.Account_Name && typeof contact.Account_Name === 'object' && contact.Account_Name.id
    ? { id: contact.Account_Name.id, name: contact.Account_Name.name }
    : null;

  const orderData = {
    Subject: `הזמנה - ${contact.Full_Name || contact.First_Name || contact.Last_Name}`,
    Status: 'טיוטא',
    Product_Details: lineItems,
  };
  if (accountName) orderData.Account_Name = accountName;

  const payload = { data: [orderData] };

  const result = await zohoPost('Sales_Orders', payload);
  return result.data[0];
}

async function getOwnerPhone(ownerId) {
  // שולף את מספר הטלפון של משתמש ZOHO לפי ID
  try {
    const data = await zohoGet(`users/${ownerId}`);
    const user = data.users?.[0];
    return user?.mobile || user?.phone || null;
  } catch (e) {
    console.log(`[owner-phone] error: ${e.message}`);
    return null;
  }
}

async function getAssignedSalesRep(contact) {
  // Returns the Owner of the contact's Account (sales rep assigned to customer)
  if (!contact.Owner) return null;
  return contact.Owner;
}

module.exports = { getProducts, getContactByPhone, createSalesOrder, getAssignedSalesRep, getOwnerPhone };
