require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getProducts, getContactByPhone, createSalesOrder, getAssignedSalesRep } = require('./zoho');
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { sendOTP, verifyOTP } = require('./otp');

const app = express();
app.use(cors());
app.use(express.json());

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

  // שלח WhatsApp לאיש המכירות
  try {
    const salesRep = contact.Owner;
    if (salesRep?.phone) {
      const customerName = contact.Full_Name || contact.First_Name || '';
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const msg = `הזמנה חדשה מ-${customerName} נקלטה במערכת (טיוטה).\nסה"כ: ₪${total.toFixed(2)}\nיש לטפל בהזמנה ב-ZOHO CRM.`;
      await twilioClient.messages.create({
        body: msg,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: salesRep.phone,
      });
    }
  } catch (e) {
    console.error('שגיאה בשליחת SMS לאיש מכירות:', e.message);
  }

  res.json({ success: true, orderId });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
