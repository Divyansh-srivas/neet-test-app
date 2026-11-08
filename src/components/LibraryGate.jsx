import React from 'react'
import { motion } from 'framer-motion'
import { Lock, Check, Clock } from 'lucide-react'
import LibraryPage from '../pages/LibraryPage'
import { useBilling } from '../utils/BillingContext'
import { isLibraryUnlocked } from '../utils/libraryAccess'

// Flip to false when the Library is ready. Until then everyone (except admins) sees the glowing "Coming Soon".
export const LIBRARY_COMING_SOON = true

export default function LibraryGate() {
  const { status, openPlans } = useBilling()
  const unlocked = isLibraryUnlocked(status)
  const isAdmin = !!status?.unlimited

  // Real library: only when it is ready AND the user has access (admins can always preview it)
  if (isAdmin || (!LIBRARY_COMING_SOON && unlocked)) return <LibraryPage />

  const loaded = !!status
  return (
    <div className="lib-gate">
      <motion.div className="lib-card" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
        <div className="lib-orb">{LIBRARY_COMING_SOON ? <Clock size={30} /> : <Lock size={30} />}</div>
        {LIBRARY_COMING_SOON ? (
          <>
            <h2 className="lib-title">Coming Soon</h2>
            <p className="lib-sub">We are building the Library by hand, with care. It will be live very soon.</p>
          </>
        ) : (
          <>
            <h2 className="lib-title lock">Library is locked</h2>
            <p className="lib-sub">Unlock the Library with any paid plan.</p>
          </>
        )}
        {loaded && (unlocked
          ? <div className="lib-pill ok"><Check size={14} /> Included in your plan</div>
          : <button type="button" className="lib-btn" onClick={openPlans}><Lock size={14} /> Paid feature: unlock with any plan</button>)}
      </motion.div>
      <style>{`
        .lib-gate{min-height:70vh;display:flex;align-items:center;justify-content:center;padding:24px}
        .lib-card{width:100%;max-width:460px;text-align:center;padding:42px 28px;border-radius:24px;border:1px solid rgba(34,197,94,.35);
          background:radial-gradient(circle at 50% 0%,rgba(34,197,94,.14),var(--surface,#0f172a) 65%);animation:libBox 2.6s ease-in-out infinite}
        .lib-orb{width:72px;height:72px;margin:0 auto 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;
          background:linear-gradient(135deg,#15803d,#22c55e);animation:libBox 2.6s ease-in-out infinite}
        .lib-title{margin:0 0 10px;font-size:40px;font-weight:800;letter-spacing:-1px;color:#fff;animation:libText 2.6s ease-in-out infinite}
        .lib-title.lock{font-size:30px}
        .lib-sub{margin:0 0 22px;color:var(--muted,#94a3b8);font-size:14.5px;line-height:1.6}
        .lib-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.25);cursor:pointer;color:#fff;font-weight:700;font-size:13.5px;background:linear-gradient(135deg,#15803d,#22c55e)}
        .lib-pill.ok{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:99px;background:rgba(34,197,94,.14);color:#4ade80;font-size:13px;font-weight:600}
        @keyframes libBox{0%,100%{box-shadow:0 0 12px rgba(34,197,94,.35),0 0 30px rgba(34,197,94,.15)}50%{box-shadow:0 0 28px rgba(74,222,128,.75),0 0 64px rgba(34,197,94,.4)}}
        @keyframes libText{0%,100%{text-shadow:0 0 8px rgba(255,255,255,.45),0 0 18px rgba(34,197,94,.45)}50%{text-shadow:0 0 16px #fff,0 0 36px rgba(74,222,128,.95)}}
        @media (prefers-reduced-motion:reduce){.lib-card,.lib-orb,.lib-title{animation:none}}
        @media (max-width:520px){.lib-title{font-size:32px}}
      `}</style>
    </div>
  )
}
