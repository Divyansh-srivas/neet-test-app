import React from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useBilling } from '../utils/BillingContext'

// Small glowing green box in the top bar. Hidden until the backend says the paywall is on.
export default function SubscribePill() {
  const { status, openPlans } = useBilling()
  if (!status || !status.paywallEnabled || status.unlimited) return null
  const left = status.remaining || 0
  const label = left > 0 ? `${left} extraction${left === 1 ? '' : 's'} left` : 'Subscribe to Extract'

  return (
    <>
      <motion.button
        type="button"
        onClick={openPlans}
        className="ng-pill"
        initial={{ scale: 0.2, opacity: 0, y: -12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.25 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        aria-label={left > 0 ? `${label}. Open plans` : 'Subscribe to Extract. Open plans'}
      >
        <Zap size={14} fill="#fff" strokeWidth={0} />
        <span className="ng-pill-text">{label}</span>
      </motion.button>
      <style>{`
        .ng-pill{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.28);
          background:linear-gradient(135deg,#15803d,#22c55e);color:#fff;cursor:pointer;font-weight:700;font-size:13px;letter-spacing:.2px;
          animation:ngPillGlow 2.2s ease-in-out infinite;white-space:nowrap}
        .ng-pill-text{color:#fff;animation:ngTextGlow 2.2s ease-in-out infinite}
        @keyframes ngPillGlow{0%,100%{box-shadow:0 0 6px rgba(34,197,94,.55),0 0 14px rgba(34,197,94,.25)}50%{box-shadow:0 0 14px rgba(74,222,128,.95),0 0 30px rgba(34,197,94,.55)}}
        @keyframes ngTextGlow{0%,100%{text-shadow:0 0 4px rgba(255,255,255,.55)}50%{text-shadow:0 0 10px #fff,0 0 18px rgba(255,255,255,.85)}}
        @media (prefers-reduced-motion:reduce){.ng-pill,.ng-pill-text{animation:none}}
      `}</style>
    </>
  )
}
