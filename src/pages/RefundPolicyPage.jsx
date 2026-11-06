import React from 'react'

const S = { h: { fontSize: 18, margin: '26px 0 8px', color: '#e2e8f0' }, p: { color: '#94a3b8', lineHeight: 1.7, fontSize: 14.5, margin: '0 0 8px' } }

// NOTE for the site owner: this is a sensible default for a digital service. Please read it and adjust to what you actually promise.
export default function RefundPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0b1120', padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ color: '#4ade80', fontSize: 13, textDecoration: 'none' }}>← Back to Neogravix</a>
        <h1 style={{ color: '#fff', fontSize: 30, margin: '14px 0 4px' }}>Refund & Cancellation Policy</h1>
        <p style={S.p}>Last updated: November 2026</p>

        <h2 style={S.h}>What you buy</h2>
        <p style={S.p}>Neogravix plans are prepaid packs of PDF-to-test extractions (for example 7, 24, 45 or 50 extractions) that stay valid for the period shown on the plan. Prices are in Indian Rupees and payments are processed securely by Razorpay.</p>

        <h2 style={S.h}>Failed extractions</h2>
        <p style={S.p}>If an extraction fails on our side, the credit is returned to your plan automatically. You do not need to contact us.</p>

        <h2 style={S.h}>Refunds</h2>
        <p style={S.p}>Because extractions use paid AI processing as soon as you start them, used extractions cannot be refunded. If you have not used any extraction from a plan and contact us within 7 days of purchase, we will refund that plan in full. A double charge or a payment that was deducted but did not activate your plan is always refunded in full.</p>

        <h2 style={S.h}>How long refunds take</h2>
        <p style={S.p}>Approved refunds go back to the original payment method and normally reach your account in 5 to 7 working days, depending on your bank.</p>

        <h2 style={S.h}>Cancellation and expiry</h2>
        <p style={S.p}>Plans do not renew automatically, so there is nothing to cancel. Unused extractions expire at the end of the validity period.</p>

        <h2 style={S.h}>Contact</h2>
        <p style={S.p}>Write to <a href="mailto:Neogravix@gmail.com" style={{ color: '#4ade80' }}>Neogravix@gmail.com</a> with your registered email and Razorpay payment ID.</p>
      </div>
    </div>
  )
}
