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
    image: p.Image_URL || null,
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

  console.log(`[phone-search] variants: ${[...variants].join(', ')}`);

  for (const num of [...variants]) {
    // חיפוש לפי phone API
    try {
      const data = await zohoGet('Contacts/search', { phone: num });
      console.log(`[phone-search] search api phone=${num} found=${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) return data.data[0];
    } catch (e) { console.log(`[phone-search] search api error: ${e.message}`); }

    // חיפוש COQL על Mobile וגם Phone
    try {
      const token = await getAccessToken();
      const q = `SELECT id, Full_Name, First_Name, Last_Name, Mobile, Phone, Account_Name, Owner FROM Contacts WHERE Mobile = '${num}' OR Phone = '${num}' LIMIT 1`;
      const r = await axios.post('https://www.zohoapis.com/crm/v2/coql', { select_query: q }, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      console.log(`[phone-search] coql exact num=${num} found=${r.data.data?.length || 0}`);
      if (r.data.data && r.data.data.length > 0) {
        const contact = r.data.data[0];
        if (contact.Account_Name && typeof contact.Account_Name === 'string') {
          const accData = await zohoGet('Contacts/search', { phone: num });
          if (accData.data && accData.data.length > 0) return accData.data[0];
        }
        return contact;
      }
    } catch (e) { console.log(`[phone-search] coql exact error: ${e.message}`); }
  }

  // חיפוש LIKE על 9 הספרות האחרונות
  const last9 = normalized.slice(-9);
  console.log(`[phone-search] trying LIKE with last9=${last9}`);
  if (last9.length === 9) {
    try {
      const token = await getAccessToken();
      const q = `SELECT id, Full_Name, First_Name, Last_Name, Mobile, Phone, Account_Name, Owner FROM Contacts WHERE Mobile like '%${last9}%' OR Phone like '%${last9}%' LIMIT 1`;
      const r = await axios.post('https://www.zohoapis.com/crm/v2/coql', { select_query: q }, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      console.log(`[phone-search] coql LIKE last9=${last9} found=${r.data.data?.length || 0} err=${JSON.stringify(r.data.info || r.data.message || '')}`);
      if (r.data.data && r.data.data.length > 0) {
        const contact = r.data.data[0];
        if (contact.Account_Name && typeof contact.Account_Name === 'string') {
          try {
            const accData = await zohoGet('Contacts/search', { phone: normalized });
            if (accData.data && accData.data.length > 0) return accData.data[0];
          } catch {}
        }
        return contact;
      }
    } catch (e) { console.log(`[phone-search] coql LIKE error: ${e.message}`); }
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

async function getAssignedSalesRep(contact) {
  // Returns the Owner of the contact's Account (sales rep assigned to customer)
  if (!contact.Owner) return null;
  return contact.Owner;
}

module.exports = { getProducts, getContactByPhone, createSalesOrder, getAssignedSalesRep };
