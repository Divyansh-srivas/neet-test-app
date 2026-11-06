import crypto from 'crypto';

const keyId = () => process.env.RAZORPAY_KEY_ID;
const keySecret = () => process.env.RAZORPAY_KEY_SECRET;

export const razorpayConfigured = () => Boolean(keyId() && keySecret());
export const publicKeyId = () => keyId() || null;

const safeEqualHex = (a, b) => {
  try {
    const A = Buffer.from(String(a || ''), 'hex');
    const B = Buffer.from(String(b || ''), 'hex');
    return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B);
  } catch { return false; }
};

// Checkout success signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export const verifyPaymentSignature = ({ orderId, paymentId, signature, secret = keySecret() }) => {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
};

// Webhook signature: HMAC_SHA256(raw request body, webhook_secret)
export const verifyWebhookSignature = ({ rawBody, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET }) => {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
};

export const createRazorpayOrder = async ({ amountPaise, receipt, notes }) => {
  if (!razorpayConfigured()) throw new Error('Razorpay keys are not configured on the server');
  const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay order failed: ${body?.error?.description || res.status}`);
  return body; // { id, amount, currency, ... }
};
