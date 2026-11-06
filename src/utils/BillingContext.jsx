import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './useAuth.jsx'
import { getBillingStatus } from '../api/billing'

const BillingContext = createContext({
  status: null, refresh: async () => null, plansOpen: false, openPlans: () => {}, closePlans: () => {},
})

export function BillingProvider({ children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState(null)
  const [plansOpen, setPlansOpen] = useState(false)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    if (!user) { setStatus(null); return null }
    try {
      const s = await getBillingStatus()
      if (alive.current) setStatus(s)
      return s
    } catch { return null } // older backend / offline: pill simply stays hidden
  }, [user])

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', refresh)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', refresh) }
  }, [refresh])

  return (
    <BillingContext.Provider value={{ status, refresh, plansOpen, openPlans: () => setPlansOpen(true), closePlans: () => setPlansOpen(false) }}>
      {children}
    </BillingContext.Provider>
  )
}

export const useBilling = () => useContext(BillingContext)
