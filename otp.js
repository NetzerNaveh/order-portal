const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// In-memory OTP store: { phone: { code, expiry } }
const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(phone) {
  const code = generateOTP();
  otpStore[phone] = { code, expiry: Date.now() + 5 * 60 * 1000 }; // 5 minutes

  await client.messages.create({
    body: `קוד האימות שלך הוא: ${code}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });

  return true;
}

function verifyOTP(phone, code) {
  const entry = otpStore[phone];
  if (!entry) return false;
  if (Date.now() > entry.expiry) {
    delete otpStore[phone];
    return false;
  }
  if (entry.code !== code) return false;
  delete otpStore[phone];
  return true;
}

module.exports = { sendOTP, verifyOTP };
