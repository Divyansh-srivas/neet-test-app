import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PLANS, getPlan, toPaise, publicPlans, packRemaining, summarizePacks, addDays } from './plans.js';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

t('catalog matches the agreed prices/credits/validity', () => {
  const m = Object.fromEntries(PLANS.map(p => [p.id, [p.priceInr, p.extractions, p.validDays]]));
  assert.deepEqual(m, { m1: [499, 7, 30], m3: [1599, 24, 90], m6: [2599, 45, 180], neet27: [2799, 50, 210] });
});
t('amounts are integer paise, unknown plan rejected', () => {
  assert.equal(toPaise(499), 49900); assert.equal(getPlan('hack'), null);
  assert.ok(publicPlans().every(p => Number.isInteger(p.amountPaise)));
});
t('pack usable only when paid, unexpired, credits left', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const ok = { status: 'paid', credits_total: 7, credits_used: 2, expires_at: '2026-12-01T00:00:00Z' };
  assert.equal(packRemaining(ok, now), 5);
  assert.equal(packRemaining({ ...ok, status: 'created' }, now), 0);
  assert.equal(packRemaining({ ...ok, expires_at: '2026-11-09T00:00:00Z' }, now), 0);
  assert.equal(packRemaining({ ...ok, credits_used: 7 }, now), 0);
});
t('summary adds packs and reports earliest expiry', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const s = summarizePacks([
    { status: 'paid', credits_total: 7, credits_used: 7, expires_at: '2026-12-01T00:00:00Z' },
    { status: 'paid', credits_total: 24, credits_used: 4, expires_at: '2027-02-01T00:00:00Z' },
    { status: 'paid', credits_total: 7, credits_used: 0, expires_at: '2026-12-05T00:00:00Z' },
  ], now);
  assert.equal(s.remaining, 27); assert.equal(s.activePacks, 2); assert.equal(s.nextExpiry, '2026-12-05T00:00:00.000Z');
});
t('NEET special expires 210 days after payment', () => {
  assert.equal(addDays('2026-11-06T00:00:00Z', 210).toISOString().slice(0, 10), '2027-06-04');
});
t('payment signature: valid passes; tampered/wrong secret/missing fail', () => {
  const secret = 's3cret', o = 'order_A', p = 'pay_B';
  const sig = hmac(secret, `${o}|${p}`);
  assert.equal(verifyPaymentSignature({ orderId: o, paymentId: p, signature: sig, secret }), true);
  assert.equal(verifyPaymentSignature({ orderId: o, paymentId: 'pay_X', signature: sig, secret }), false);
  assert.equal(verifyPaymentSignature({ orderId: 'order_Z', paymentId: p, signature: sig, secret }), false);
  assert.equal(verifyPaymentSignature({ orderId: o, paymentId: p, signature: sig, secret: 'other' }), false);
  assert.equal(verifyPaymentSignature({ orderId: o, paymentId: p, signature: 'zz', secret }), false);
  assert.equal(verifyPaymentSignature({ orderId: o, paymentId: p, signature: '', secret }), false);
  assert.equal(verifyPaymentSignature({ orderId: o, paymentId: p, signature: sig, secret: '' }), false);
});
t('webhook signature over raw bytes', () => {
  const secret = 'whsec', raw = Buffer.from('{"event":"payment.captured"}');
  const sig = hmac(secret, raw);
  assert.equal(verifyWebhookSignature({ rawBody: raw, signature: sig, secret }), true);
  assert.equal(verifyWebhookSignature({ rawBody: Buffer.from('{"event":"payment.captured" }'), signature: sig, secret }), false);
  assert.equal(verifyWebhookSignature({ rawBody: undefined, signature: sig, secret }), false);
});
console.log(`${n} tests passed`);
