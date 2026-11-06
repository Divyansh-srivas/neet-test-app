import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const paywallEnabled = () => String(process.env.PAYWALL_ENABLED || 'false').toLowerCase() === 'true';

const bypassList = () =>
  (process.env.PAYWALL_BYPASS_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const isBypassed = (user) => !!user?.email && bypassList().includes(String(user.email).toLowerCase());

// Take one extraction credit before any work is done. Fails CLOSED: if billing is unreachable, no free extraction.
export async function reserveExtraction(user, jobId) {
  if (!paywallEnabled() || isBypassed(user)) return { ok: true, charged: false };
  const { data, error } = await supabaseAdmin.rpc('consume_extraction_credit', { p_user: user.id, p_job: jobId });
  if (error) {
    logger.error(`[billing] consume failed for ${user.id}: ${error.message}`);
    return { ok: false, status: 503, code: 'BILLING_ERROR', error: 'Billing is temporarily unavailable. Please try again in a minute.' };
  }
  if (!data) {
    return { ok: false, status: 402, code: 'NO_CREDITS', error: 'No extractions left. Subscribe to a plan to extract more tests.' };
  }
  return { ok: true, charged: true };
}

// Give the credit back (idempotent). Never throws.
export async function refundExtraction(jobId) {
  try {
    const { error } = await supabaseAdmin.rpc('refund_extraction_credit', { p_job: jobId });
    if (error) logger.error(`[billing] refund failed for job ${jobId}: ${error.message}`);
  } catch (e) {
    logger.error(`[billing] refund threw for job ${jobId}: ${e.message}`);
  }
}
