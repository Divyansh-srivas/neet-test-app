import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Check, Zap, Loader, Lock, Star, AlertCircle } from 'lucide-react'
import { useAuth } from '../utils/useAuth.jsx'
import { useBilling } from '../utils/BillingContext'
import { getPlans, createOrder, verifyPayment, loadRazorpay } from '../api/billing'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function PlansModal({ setPage }) {
  const { plansOpen, closePlans, refresh, status } = useBilling()
  const { user, profile } = useAuth()
  const [plans, setPlans] = useState(null)
  const [selected, setSelected] = useState('m3')
  const [phase, setPhase] = useState('select') // select | starting | checkout | verifying | success | pending
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const phaseRef = useRef('select')
  const beforeRef = useRef(0)
  const go = (p) => { phaseRef.current = p; setPhase(p) }

  useEffect(() => {
    if (!plansOpen) return
    go('select'); setError(''); setResult(null)
    refresh()
    getPlans().then((d) => setPlans(d.plans)).catch(() => setError('Could not load plans. Please check your connection and reopen.'))
  }, [plansOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const busy = phase === 'starting' || phase === 'verifying'
  const close = useCallback(() => { if (!busy) closePlans() }, [busy, closePlans])

  useEffect(() => {
    if (!plansOpen) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [plansOpen, close])

  const finishVerified = async (credits, expiresAt) => {
    await refresh()
    setResult({ credits, expiresAt })
    go('success')
  }

  const onPaid = async (resp) => {
    go('verifying')
    beforeRef.current = status?.remaining || 0
    for (let i = 0; i < 4; i++) {
      try {
        const v = await verifyPayment({
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
        })
        return finishVerified(v.credits, v.expiresAt)
      } catch { await sleep(1200 * (i + 1)) }
    }
    // verify call kept failing: the webhook may still activate it, so poll for the balance to go up
    for (let i = 0; i < 10; i++) {
      const s = await refresh()
      if (s && s.remaining > beforeRef.current) return finishVerified(s.remaining - beforeRef.current, s.nextExpiry)
      await sleep(3000)
    }
    go('pending')
  }

  const pay = async () => {
    const plan = plans?.find((p) => p.id === selected)
    if (!plan || busy) return
    setError(''); go('starting')
    try {
      const ok = await loadRazorpay()
      if (!ok) throw new Error('Could not load the payment window. Check your internet and try again.')
      const order = await createOrder(plan.id)
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Neogravix',
        description: `${plan.name} · ${plan.extractions} extractions`,
        prefill: { name: profile?.full_name || '', email: user?.email || '' },
        theme: { color: '#16a34a' },
        handler: onPaid,
        modal: { ondismiss: () => { if (phaseRef.current === 'checkout') go('select') } },
      })
      rzp.on('payment.failed', (r) => {
        setError(`${r?.error?.description || 'Payment failed'}. No money is lost if it was deducted, it is refunded by your bank automatically. You can try again.`)
        go('select')
      })
      go('checkout')
      rzp.open()
    } catch (e) {
      setError(e.message || 'Something went wrong. You have not been charged.')
      go('select')
    }
  }

  const startExtracting = () => { closePlans(); setPage && setPage('upload') }
  const selPlan = plans?.find((p) => p.id === selected)

  return (
    <AnimatePresence>
      {plansOpen && (
        <motion.div
          className="ng-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label="Extraction plans" className="ng-modal"
            initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <button className="ng-x" onClick={close} disabled={busy} aria-label="Close"><X size={18} /></button>

            <AnimatePresence mode="wait">
              {(phase === 'select' || phase === 'starting' || phase === 'checkout') && (
                <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}>
                  <div className="ng-head">
                    <h2>Unlock extractions</h2>
                    <p>Turn any PDF into a full mock test. Pick a plan, pay securely, extractions open instantly.</p>
                    {status?.remaining > 0 && <span className="ng-have"><Zap size={12} /> You have {status.remaining} left{status.nextExpiry ? ` · earliest expiry ${fmtDate(status.nextExpiry)}` : ''}</span>}
                  </div>

                  {!plans && !error && <div className="ng-center"><Loader size={22} className="ng-spin" /></div>}

                  <div className="ng-grid">
                    {plans?.map((p, i) => {
                      const on = selected === p.id
                      return (
                        <motion.button
                          key={p.id} type="button" onClick={() => !busy && setSelected(p.id)}
                          className={`ng-card ${on ? 'on' : ''} ${p.id === 'neet27' ? 'special' : ''}`}
                          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i, type: 'spring', stiffness: 300, damping: 22 }}
                          whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }} aria-pressed={on}
                        >
                          {p.badge && <span className="ng-badge">{p.id === 'neet27' && <Star size={10} fill="currentColor" />} {p.badge}</span>}
                          <div className="ng-name">{p.name}</div>
                          <div className="ng-price">₹{p.priceInr.toLocaleString('en-IN')}</div>
                          <div className="ng-ext"><b>{p.extractions}</b> extractions</div>
                          <ul>
                            <li><Check size={13} /> Valid {p.validDays >= 180 ? `${Math.round(p.validDays / 30)} months` : p.validDays === 90 ? '3 months' : '1 month'}</li>
                            <li><Check size={13} /> ≈ ₹{p.perExtractionInr} per extraction</li>
                            <li><Check size={13} /> Failed extraction = credit back</li>
                          </ul>
                          <div className="ng-tag">{p.tagline}</div>
                          <AnimatePresence>{on && <motion.span className="ng-tick" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={14} /></motion.span>}</AnimatePresence>
                        </motion.button>
                      )
                    })}
                  </div>

                  {error && <div className="ng-err" role="alert"><AlertCircle size={15} /> {error}</div>}

                  <div className="ng-bar">
                    <div className="ng-secure"><Lock size={12} /> Secure payment by Razorpay · UPI, cards, netbanking · <a href="/refund-policy" target="_blank" rel="noopener noreferrer">Refund policy</a></div>
                    <motion.button className="ng-pay" type="button" onClick={pay} disabled={!selPlan || busy} whileTap={{ scale: 0.97 }}>
                      {phase === 'starting' ? <><Loader size={16} className="ng-spin" /> Opening payment…</>
                        : phase === 'checkout' ? <><Loader size={16} className="ng-spin" /> Complete payment in the window…</>
                        : selPlan ? `Pay ₹${selPlan.priceInr.toLocaleString('en-IN')} & unlock ${selPlan.extractions}` : 'Choose a plan'}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {phase === 'verifying' && (
                <motion.div key="ver" className="ng-state" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Loader size={44} className="ng-spin" color="#22c55e" />
                  <h3>Confirming your payment…</h3>
                  <p>Please do not close or refresh this window.</p>
                </motion.div>
              )}

              {phase === 'success' && (
                <motion.div key="ok" className="ng-state" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
                  <div className="ng-burst">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <motion.i key={i} style={{ background: ['#22c55e', '#86efac', '#fbbf24', '#60a5fa'][i % 4] }}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                        animate={{ x: Math.cos((i / 16) * 6.283) * 90, y: Math.sin((i / 16) * 6.283) * 90, opacity: 0, scale: 0.4 }}
                        transition={{ duration: 0.9, ease: 'easeOut' }} />
                    ))}
                    <motion.div className="ng-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45 }} />
                      </svg>
                    </motion.div>
                  </div>
                  <h3>Payment successful!</h3>
                  <p><b>{result?.credits}</b> extractions unlocked{result?.expiresAt ? ` · valid till ${fmtDate(result.expiresAt)}` : ''}</p>
                  <p className="ng-sub">You now have {status?.remaining ?? result?.credits} extractions available.</p>
                  <motion.button className="ng-pay" onClick={startExtracting} whileTap={{ scale: .97 }}>Start extracting →</motion.button>
                </motion.div>
              )}

              {phase === 'pending' && (
                <motion.div key="pend" className="ng-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Check size={44} color="#22c55e" />
                  <h3>Payment received</h3>
                  <p>Your plan is being activated and will show up in a minute or two. Your money is safe. If it does not appear in 10 minutes, write to Neogravix@gmail.com with your payment ID.</p>
                  <motion.button className="ng-pay" onClick={() => { refresh(); closePlans() }} whileTap={{ scale: .97 }}>Okay</motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <style>{`
            .ng-overlay{position:fixed;inset:0;z-index:1000;background:rgba(2,6,12,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
            .ng-modal{position:relative;width:100%;max-width:980px;max-height:calc(100vh - 32px);overflow-y:auto;background:var(--surface,#0f172a);border:1px solid var(--border,#1e293b);border-radius:22px;padding:28px 26px;color:var(--text,#e2e8f0)}
            .ng-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:10px;border:1px solid var(--border,#1e293b);background:var(--surface2,#111c30);color:var(--muted,#94a3b8);cursor:pointer;display:flex;align-items:center;justify-content:center}
            .ng-x:disabled{opacity:.4;cursor:not-allowed}
            .ng-head h2{margin:0 0 6px;font-size:26px;font-weight:800;letter-spacing:-.5px}
            .ng-head p{margin:0;color:var(--muted,#94a3b8);font-size:14px}
            .ng-have{display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:4px 10px;border-radius:99px;background:rgba(34,197,94,.12);color:#4ade80;font-size:12px;font-weight:600}
            .ng-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0 8px}
            .ng-card{position:relative;text-align:left;cursor:pointer;padding:20px 16px 16px;border-radius:16px;border:1.5px solid var(--border,#1e293b);background:var(--surface2,#111c30);color:inherit;font:inherit;transition:border-color .2s,box-shadow .2s}
            .ng-card:hover{border-color:rgba(34,197,94,.55)}
            .ng-card.on{border-color:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18),0 10px 30px rgba(34,197,94,.14)}
            .ng-card.special{background:linear-gradient(160deg,rgba(34,197,94,.14),var(--surface2,#111c30) 60%)}
            .ng-badge{position:absolute;top:-10px;left:14px;display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.3px}
            .ng-name{font-size:14px;font-weight:700;color:var(--muted,#94a3b8)}
            .ng-price{font-size:32px;font-weight:800;letter-spacing:-1px;margin:4px 0 2px}
            .ng-ext{font-size:14px;color:#4ade80;margin-bottom:12px}
            .ng-card ul{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:7px;font-size:12.5px;color:var(--muted,#94a3b8)}
            .ng-card li{display:flex;gap:7px;align-items:center}.ng-card li svg{color:#22c55e;flex:none}
            .ng-tag{font-size:11.5px;color:var(--muted,#94a3b8);opacity:.8}
            .ng-tick{position:absolute;top:12px;right:12px;width:24px;height:24px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center}
            .ng-err{display:flex;gap:8px;align-items:flex-start;margin:12px 0 0;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;font-size:13px}
            .ng-err svg{flex:none;margin-top:2px}
            .ng-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;flex-wrap:wrap}
            .ng-secure{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted,#94a3b8);flex:1;min-width:220px}
            .ng-secure a{color:#4ade80}
            .ng-pay{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:240px;padding:14px 22px;border-radius:13px;border:none;cursor:pointer;color:#fff;font-weight:800;font-size:15px;background:linear-gradient(135deg,#15803d,#22c55e);box-shadow:0 8px 24px rgba(34,197,94,.3)}
            .ng-pay:disabled{opacity:.7;cursor:not-allowed}
            .ng-state{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:50px 10px 30px}
            .ng-state h3{margin:6px 0 0;font-size:24px;font-weight:800}.ng-state p{margin:0;color:var(--muted,#94a3b8);max-width:420px;font-size:14px}
            .ng-sub{opacity:.85}.ng-state .ng-pay{margin-top:14px}
            .ng-burst{position:relative;width:84px;height:84px;display:flex;align-items:center;justify-content:center}
            .ng-burst i{position:absolute;width:8px;height:8px;border-radius:50%}
            .ng-check{width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,#15803d,#22c55e);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(34,197,94,.6)}
            .ng-center{display:flex;justify-content:center;padding:60px 0}
            .ng-spin{animation:ngSpin 1s linear infinite}@keyframes ngSpin{to{transform:rotate(360deg)}}
            @media (max-width:900px){.ng-grid{grid-template-columns:repeat(2,1fr)}}
            @media (max-width:520px){.ng-modal{padding:22px 14px}.ng-grid{grid-template-columns:1fr}.ng-pay{width:100%}.ng-head h2{font-size:22px}}
            @media (prefers-reduced-motion:reduce){.ng-spin{animation-duration:2s}}
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
