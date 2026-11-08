import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { creditsForPages } from './plans.js';

export const paywallEnabled = () => String(process.env.PAYWALL_ENABLED || 'false').toLowerCase() === 'true';

const bypassList = () =>
  (process.env.PAYWALL_BYPASS_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const isBypassed = (user) => !!user?.email && bypassList().includes(String(user.email).toLowerCase());

// Take extraction credits based on page count before any work is done.
// <=30 pages = 1 credit, 31-60 = 2 credits, >60 = 3 credits.
// Fails CLOSED: if billing is unreachable, no free extraction.
export async function reserveExtraction(user, jobId, pageCount = 1) {
  if (!paywallEnabled() || isBypassed(user)) return { ok: true, charged: false, credits: 0 };
  const creditsNeeded = creditsForPages(pageCount);

  let { data, error } = await supabaseAdmin.rpc('consume_extraction_credit', {
    p_user: user.id,
    p_job: jobId,
    p_credits: creditsNeeded
  });

  // Fallback for backwards compatibility if SQL function has 2 parameters in production
  if (error && creditsNeeded === 1) {
    const res2 = await supabaseAdmin.rpc('consume_extraction_credit', { p_user: user.id, p_job: jobId });
    if (!res2.error) {
      data = res2.data;
      error = null;
    }
  }

  if (error) {
    logger.error(`[billing] consume failed for ${user.id}: ${error.message}`);
    return { ok: false, status: 503, code: 'BILLING_ERROR', error: 'Billing is temporarily unavailable. Please try again in a minute.' };
  }
  if (!data) {
    return {
      ok: false,
      status: 402,
      code: 'NO_CREDITS',
      error: `This upload requires ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''}, but you do not have enough credits. Subscribe to a plan to extract more tests.`
    };
  }
  return { ok: true, charged: true, credits: creditsNeeded };
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
