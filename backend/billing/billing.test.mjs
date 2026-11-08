import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PLANS, getPlan, toPaise, publicPlans, packRemaining, summarizePacks, addDays, creditsForPages } from './plans.js';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay.js';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key-test';
const { supabaseAdmin } = await import('../config/supabase.js');
const { reserveExtraction, refundExtraction } = await import('./entitlement.js');

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

await t('catalog matches the agreed prices/credits/validity', () => {
  const m = Object.fromEntries(PLANS.map(p => [p.id, [p.priceInr, p.extractions, p.validDays]]));
  assert.deepEqual(m, { m1: [499, 7, 30], m3: [1599, 24, 90], m6: [2599, 45, 180], neet27: [2799, 50, 210] });
});
await t('amounts are integer paise, unknown plan rejected', () => {
  assert.equal(toPaise(499), 49900); assert.equal(getPlan('hack'), null);
  assert.ok(publicPlans().every(p => Number.isInteger(p.amountPaise)));
});
await t('per-extraction pricing is removed from publicPlans', () => {
  const plans = publicPlans();
  assert.ok(plans.every(p => p.perExtractionInr === undefined));
});
await t('pack usable only when paid, unexpired, credits left', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const ok = { status: 'paid', credits_total: 7, credits_used: 2, expires_at: '2026-12-01T00:00:00Z' };
  assert.equal(packRemaining(ok, now), 5);
  assert.equal(packRemaining({ ...ok, status: 'created' }, now), 0);
  assert.equal(packRemaining({ ...ok, expires_at: '2026-11-09T00:00:00Z' }, now), 0);
  assert.equal(packRemaining({ ...ok, credits_used: 7 }, now), 0);
});
await t('summary adds packs and reports earliest expiry', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const s = summarizePacks([
    { status: 'paid', credits_total: 7, credits_used: 7, expires_at: '2026-12-01T00:00:00Z' },
    { status: 'paid', credits_total: 24, credits_used: 4, expires_at: '2027-02-01T00:00:00Z' },
    { status: 'paid', credits_total: 7, credits_used: 0, expires_at: '2026-12-05T00:00:00Z' },
  ], now);
  assert.equal(s.remaining, 27); assert.equal(s.activePacks, 2); assert.equal(s.nextExpiry, '2026-12-05T00:00:00.000Z');
});
await t('planActive stays true after credits are used up, false after expiry/unpaid', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const base = { status: 'paid', credits_total: 7, credits_used: 7, expires_at: '2026-12-01T00:00:00Z' };
  assert.equal(summarizePacks([base], now).planActive, true);
  assert.equal(summarizePacks([base], now).remaining, 0);
  assert.equal(summarizePacks([{ ...base, expires_at: '2026-11-01T00:00:00Z' }], now).planActive, false);
  assert.equal(summarizePacks([{ ...base, status: 'created' }], now).planActive, false);
  assert.equal(summarizePacks([], now).planActive, false);
});
await t('NEET special expires 210 days after payment', () => {
  assert.equal(addDays('2026-11-06T00:00:00Z', 210).toISOString().slice(0, 10), '2027-06-04');
});
await t('payment signature: valid passes; tampered/wrong secret/missing fail', () => {
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
await t('webhook signature over raw bytes', () => {
  const secret = 'whsec', raw = Buffer.from('{"event":"payment.captured"}');
  const sig = hmac(secret, raw);
  assert.equal(verifyWebhookSignature({ rawBody: raw, signature: sig, secret }), true);
  assert.equal(verifyWebhookSignature({ rawBody: Buffer.from('{"event":"payment.captured" }'), signature: sig, secret }), false);
  assert.equal(verifyWebhookSignature({ rawBody: undefined, signature: sig, secret }), false);
});

await t('pages-per-credit: <=30 pages = 1 credit, 31-60 = 2 credits, >60 = 3 credits', () => {
  assert.equal(creditsForPages(1), 1);
  assert.equal(creditsForPages(15), 1);
  assert.equal(creditsForPages(30), 1);
  assert.equal(creditsForPages(31), 2);
  assert.equal(creditsForPages(54), 2);
  assert.equal(creditsForPages(60), 2);
  assert.equal(creditsForPages(61), 3);
  assert.equal(creditsForPages(100), 3);
  assert.equal(creditsForPages(0), 1);
  assert.equal(creditsForPages(null), 1);
});

await t('54-page PDF consumes 2 credits and a failed job refunds 2', async () => {
  process.env.PAYWALL_ENABLED = 'true';
  process.env.PAYWALL_BYPASS_EMAILS = '';

  let userCredits = 7;
  const ledger = new Map();

  supabaseAdmin.rpc = async (fn, params) => {
    if (fn === 'consume_extraction_credit') {
      const needed = params.p_credits || 1;
      if (userCredits < needed) {
        return { data: null, error: null };
      }
      userCredits -= needed;
      ledger.set(params.p_job, { credits: needed, status: 'consumed' });
      return { data: 'pack-uuid-1', error: null };
    }
    if (fn === 'refund_extraction_credit') {
      const entry = ledger.get(params.p_job);
      if (entry && entry.status === 'consumed') {
        entry.status = 'refunded';
        userCredits += entry.credits;
        return { data: true, error: null };
      }
      return { data: false, error: null };
    }
    return { data: null, error: null };
  };

  const user = { id: 'usr_test_1', email: 'student@example.com' };
  const jobId = 'job-54page-test';

  // Reserve extraction for a 54-page PDF (should require 2 credits)
  const res = await reserveExtraction(user, jobId, 54);
  assert.equal(res.ok, true);
  assert.equal(res.charged, true);
  assert.equal(res.credits, 2);
  assert.equal(userCredits, 5); // 7 - 2 = 5
  assert.equal(ledger.get(jobId).credits, 2);
  assert.equal(ledger.get(jobId).status, 'consumed');

  // Failed extraction job refunds 2 credits
  await refundExtraction(jobId);
  assert.equal(userCredits, 7); // 5 + 2 = 7
  assert.equal(ledger.get(jobId).status, 'refunded');

  // Idempotent refund: calling refund again does not grant extra credits
  await refundExtraction(jobId);
  assert.equal(userCredits, 7);
});

await t('insufficient credits blocks with a clear message', async () => {
  process.env.PAYWALL_ENABLED = 'true';
  process.env.PAYWALL_BYPASS_EMAILS = '';

  let userCredits = 1; // Only 1 credit available
  supabaseAdmin.rpc = async (fn, params) => {
    if (fn === 'consume_extraction_credit') {
      const needed = params.p_credits || 1;
      if (userCredits < needed) {
        return { data: null, error: null };
      }
      userCredits -= needed;
      return { data: 'pack-uuid-1', error: null };
    }
    return { data: null, error: null };
  };

  const user = { id: 'usr_test_2', email: 'student2@example.com' };

  // Attempt 54-page PDF (requires 2 credits, user has 1) -> blocked with clear message
  const res54 = await reserveExtraction(user, 'job-blocked-54', 54);
  assert.equal(res54.ok, false);
  assert.equal(res54.status, 402);
  assert.equal(res54.code, 'NO_CREDITS');
  assert.ok(res54.error.includes('requires 2 credits'));
  assert.ok(res54.error.includes('do not have enough credits'));

  // Attempt 65-page PDF (requires 3 credits, user has 1) -> blocked with clear message
  const res65 = await reserveExtraction(user, 'job-blocked-65', 65);
  assert.equal(res65.ok, false);
  assert.equal(res65.status, 402);
  assert.equal(res65.code, 'NO_CREDITS');
  assert.ok(res65.error.includes('requires 3 credits'));

  // Attempt 20-page PDF (requires 1 credit, user has 1) -> succeeds
  const res20 = await reserveExtraction(user, 'job-ok-20', 20);
  assert.equal(res20.ok, true);
  assert.equal(res20.charged, true);
  assert.equal(res20.credits, 1);
  assert.equal(userCredits, 0);

  // Now user has 0 credits, attempt 20-page PDF -> blocked
  const resZero = await reserveExtraction(user, 'job-blocked-zero', 20);
  assert.equal(resZero.ok, false);
  assert.equal(resZero.status, 402);
  assert.equal(resZero.code, 'NO_CREDITS');
  assert.ok(resZero.error.includes('requires 1 credit'));
});

console.log(`${n} tests passed`);
