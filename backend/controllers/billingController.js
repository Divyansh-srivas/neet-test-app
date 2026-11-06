import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { getPlan, publicPlans, toPaise, addDays, summarizePacks } from '../billing/plans.js';
import {
  razorpayConfigured, publicKeyId, createRazorpayOrder,
  verifyPaymentSignature, verifyWebhookSignature,
} from '../billing/razorpay.js';
import { paywallEnabled, isBypassed } from '../billing/entitlement.js';

export const getPlans = (req, res) => {
  res.json({ plans: publicPlans(), keyId: publicKeyId(), ready: razorpayConfigured() });
};

export const getStatus = async (req, res) => {
  try {
    const unlimited = isBypassed(req.user);
    const { data, error } = await supabaseAdmin
      .from('plan_purchases')
      .select('status, credits_total, credits_used, expires_at')
      .eq('user_id', req.user.id)
      .eq('status', 'paid');
    if (error) throw error;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ paywallEnabled: paywallEnabled(), unlimited, ...summarizePacks(data || []) });
  } catch (e) {
    logger.error(`[billing] status failed: ${e.message}`);
    res.status(500).json({ error: 'Could not load plan status' });
  }
};

export const createOrder = async (req, res) => {
  try {
    const plan = getPlan(req.body?.planId);
    if (!plan) return res.status(400).json({ error: 'Unknown plan' });
    if (!razorpayConfigured()) return res.status(503).json({ error: 'Payments are not available right now' });

    const amountPaise = toPaise(plan.priceInr);
    const order = await createRazorpayOrder({
      amountPaise,
      receipt: `ng_${Date.now()}_${req.user.id.slice(0, 8)}`,
      notes: { user_id: req.user.id, plan_id: plan.id },
    });

    const { error } = await supabaseAdmin.from('plan_purchases').insert({
      user_id: req.user.id,
      plan_id: plan.id,
      credits_total: plan.extractions,
      valid_days: plan.validDays,
      amount_paise: amountPaise,
      currency: 'INR',
      status: 'created',
      razorpay_order_id: order.id,
    });
    if (error) throw error;

    res.json({ orderId: order.id, amount: amountPaise, currency: 'INR', keyId: publicKeyId(), plan: { id: plan.id, name: plan.name, extractions: plan.extractions } });
  } catch (e) {
    logger.error(`[billing] createOrder failed: ${e.message}`);
    res.status(500).json({ error: 'Could not start the payment. You have not been charged. Please try again.' });
  }
};

// Idempotent: flips created -> paid exactly once; later calls just return the paid row.
async function activatePurchase({ orderId, paymentId, userId = null, amountPaise = null, currency = null }) {
  let q = supabaseAdmin.from('plan_purchases').select('*').eq('razorpay_order_id', orderId);
  if (userId) q = q.eq('user_id', userId);
  const { data: row, error } = await q.maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.status === 'paid') return { ok: true, purchase: row, already: true };
  if (amountPaise != null && (Number(amountPaise) !== row.amount_paise || (currency && currency !== row.currency))) {
    logger.error(`[billing] amount mismatch for order ${orderId}: got ${amountPaise}/${currency}, expected ${row.amount_paise}/${row.currency}`);
    return { ok: false, reason: 'amount_mismatch' };
  }
  const now = new Date();
  const { data: updated, error: upErr } = await supabaseAdmin
    .from('plan_purchases')
    .update({ status: 'paid', razorpay_payment_id: paymentId, paid_at: now.toISOString(), expires_at: addDays(now, row.valid_days).toISOString() })
    .eq('id', row.id).eq('status', 'created')
    .select().maybeSingle();
  if (upErr) throw upErr;
  if (!updated) { // lost a race with the webhook/verify — it is paid now
    const { data: again } = await supabaseAdmin.from('plan_purchases').select('*').eq('id', row.id).single();
    return { ok: !!again && again.status === 'paid', purchase: again, already: true };
  }
  logger.info(`[billing] activated order ${orderId} user ${row.user_id} plan ${row.plan_id}`);
  return { ok: true, purchase: updated, already: false };
}

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return res.status(400).json({ error: 'Payment signature could not be verified' });
    }
    const r = await activatePurchase({ orderId, paymentId, userId: req.user.id });
    if (!r.ok) return res.status(404).json({ error: 'Order not found for this account' });
    res.json({ success: true, credits: r.purchase.credits_total, expiresAt: r.purchase.expires_at });
  } catch (e) {
    logger.error(`[billing] verify failed: ${e.message}`);
    res.status(500).json({ error: 'Verification is delayed. If money was deducted, your plan activates automatically within a few minutes.' });
  }
};

// Safety net: Razorpay calls this even if the student closes the tab right after paying.
export const webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!verifyWebhookSignature({ rawBody: req.rawBody, signature })) return res.status(400).json({ error: 'bad signature' });
    const event = req.body?.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const p = req.body?.payload?.payment?.entity;
      if (p?.order_id && p?.id) {
        await activatePurchase({ orderId: p.order_id, paymentId: p.id, amountPaise: p.amount, currency: p.currency });
      }
    }
    res.json({ received: true });
  } catch (e) {
    logger.error(`[billing] webhook failed: ${e.message}`);
    res.status(500).json({ error: 'retry' }); // non-2xx makes Razorpay retry
  }
};
