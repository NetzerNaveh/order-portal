require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getProducts, getContactByPhone, createSalesOrder, getAssignedSalesRep, getOwnerPhone } = require('./zoho');

// מיפוי אימייל/ID של משתמש ZOHO → מספר טלפון
// ניתן להגדיר דרך env var: SALES_REP_PHONES={"email@x.com":"0521234567"}
const SALES_REP_PHONES = (() => {
  try { return JSON.parse(process.env.SALES_REP_PHONES || '{}'); } catch { return {}; }
})();

// שם בעברית + מגדר לכל מדריך
const SALES_REP_INFO = {
  'fidaa@noonaesthetics.com':  { name: 'פידאא',  verb: 'תעבור' },
  'ifat@noonaesthetics.com':   { name: 'יפעת',   verb: 'תעבור' },
  'mika@noonaesthetics.com':   { name: 'מיקה',   verb: 'תעבור' },
  'nava@beautyplus.co.il':     { name: 'נאווה',  verb: 'תעבור' },
  'smadar@beautyplus.co.il':   { name: 'סמדר',   verb: 'תעבור' },
  'yoav@beautyplus.co.il':     { name: 'יואב',   verb: 'יעבור'  },
  'tal@beautyplus.co.il':      { name: 'טל',     verb: 'תעבור' },
  'nelia@beautyplus.co.il':    { name: 'נליה',   verb: 'תעבור' },
};

async function getSalesRepPhone(owner) {
  if (!owner) return null;
  // חפש לפי אימייל קודם (env var)
  if (owner.email && SALES_REP_PHONES[owner.email]) return SALES_REP_PHONES[owner.email];
  // חפש לפי ID (env var)
  if (owner.id && SALES_REP_PHONES[owner.id]) return SALES_REP_PHONES[owner.id];
  // נסה ZOHO Users API
  const phone = await getOwnerPhone(owner.id);
  if (phone) return phone;
  return null;
}
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { sendOTP, verifyOTP } = require('./otp');

const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
// הגש תמונות מקומיות מתיקיית public/images
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Session store: { sessionToken: { phone, contactId, contact } }
const sessions = {};

function generateToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

// שלח OTP לטלפון
app.post('/api/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'נדרש מספר טלפון' });

  const contact = await getContactByPhone(phone);
  if (!contact) return res.status(404).json({ error: 'מספר טלפון לא נמצא במערכת' });

  await sendOTP(phone);
  res.json({ success: true });
});

// אמת OTP וצור session
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'נדרשים טלפון וקוד' });

  const valid = verifyOTP(phone, code);
  if (!valid) return res.status(401).json({ error: 'קוד שגוי או פג תוקף' });

  const contact = await getContactByPhone(phone);
  const token = generateToken();
  sessions[token] = { phone, contact };

  res.json({ token, contact: { name: contact.Full_Name || contact.First_Name, id: contact.id } });
});

// ─── Middleware ────────────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !sessions[token]) return res.status(401).json({ error: 'לא מחובר' });
  req.session = sessions[token];
  next();
}

// ─── מוצרים ───────────────────────────────────────────────────────────────────

app.get('/api/products', authenticate, async (req, res) => {
  const products = await getProducts();
  res.json(products);
});

// ─── הזמנה ────────────────────────────────────────────────────────────────────

app.post('/api/orders', authenticate, async (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'עגלה ריקה' });

  const contact = req.session.contact;
  const result = await createSalesOrder(contact, items);
  const orderId = result.details?.id;

  // שלח SMS למדריך (בעל החשבון ב-ZOHO)
  try {
    const repPhone = await getSalesRepPhone(contact.Owner);
    console.log(`[sms] owner=${JSON.stringify(contact.Owner)} repPhone=${repPhone}`);
    if (repPhone) {
      const customerName = contact.Full_Name || contact.Account_Name?.name || contact.First_Name || '';
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const itemLines = items.map(i => `• ${i.name || ''} x${i.quantity}`).join('\n');
      const msg = `הזמנה חדשה נכנסה מ-${customerName}\nסה"כ: ₪${total.toFixed(2)}\n${itemLines}\nיש לאשר ב-ZOHO CRM`;
      await twilioClient.messages.create({
        body: msg,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: repPhone.startsWith('+') ? repPhone : `+972${repPhone.replace(/^0/, '')}`,
      });
      console.log(`[sms] נשלח ל-${repPhone}`);
    } else {
      console.log('[sms] לא נמצא טלפון למדריך - הגדר SALES_REP_PHONES ב-Render');
    }
  } catch (e) {
    console.error('[sms] שגיאה:', e.message);
  }

  const repInfo = contact.Owner?.email ? SALES_REP_INFO[contact.Owner.email] : null;
  res.json({
    success: true,
    orderId,
    repName: repInfo?.name || null,
    repVerb: repInfo?.verb || null,
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
