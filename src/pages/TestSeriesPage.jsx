import React, { useEffect, useState } from 'react'
import { ClipboardList, Clock, Play, Check, Lock, Loader } from 'lucide-react'
import { useAuth } from '../utils/useAuth.jsx'
import { useBilling } from '../utils/BillingContext'
import { getTest, saveTest } from '../utils/storage'
import { listSeries, startSeries } from '../api/testSeries'

export default function TestSeriesPage({ setPage, setActiveTest }) {
  const { user } = useAuth()
  const { openPlans } = useBilling()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () => listSeries().then(setItems).catch((e) => { setItems([]); setError(e.message) })
  useEffect(() => { load() }, [])

  const start = async (s) => {
    setBusyId(s.id); setError('')
    try {
      const { test: row, durationSeconds } = await startSeries(s.id)
      const local = getTest(user?.uid, row.id)
      const base = local
        ? { ...local, questions: row.questions, title: row.name }
        : { ...row, title: row.name, duration: durationSeconds }
      if (user?.uid) saveTest(user.uid, base)
      setActiveTest(base)
      if (base.completed) { setPage('analysis'); return }
      const ready = { ...base, startedAt: base.startedAt || Date.now(), duration: base.duration || durationSeconds }
      if (user?.uid) saveTest(user.uid, ready)
      setActiveTest(ready)
      setPage('pretest')
    } catch (e) {
      if (e.code === 'PLAN_REQUIRED') openPlans()
      setError(e.message)
    } finally { setBusyId(null) }
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><ClipboardList size={22} /> Test Series</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 22px' }}>Syllabus and live tests posted by Neogravix.</p>

      {error && <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {items === null && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}><Loader size={20} className="ts-spin" /></div>}
      {items && items.length === 0 && !error && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: 16 }}>Nothing posted yet. Check back soon.</div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {(items || []).map((s) => (
          <div key={s.id} style={{ background: 'var(--surface)', border: `1px solid ${s.live ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{s.title}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> {s.durationMinutes} min</span>
                  {s.live && <span>{s.questionCount} questions</span>}
                  <span style={{ padding: '2px 9px', borderRadius: 99, fontWeight: 700, fontSize: 11.5, background: s.live ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.14)', color: s.live ? '#4ade80' : '#fbbf24' }}>{s.live ? 'LIVE' : 'OPENING SOON'}</span>
                </div>
              </div>
              {s.live && (
                <button type="button" onClick={() => start(s)} disabled={busyId === s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#15803d,#22c55e)', opacity: busyId === s.id ? 0.7 : 1 }}>
                  {busyId === s.id ? <><Loader size={15} className="ts-spin" /> Opening…</> : s.startedTestId ? <><Check size={15} /> Open</> : <><Play size={15} /> Start Test</>}
                </button>
              )}
            </div>
            {s.syllabus && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Syllabus</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.65 }}>{s.syllabus}</div>
              </div>
            )}
            {!s.live && <div style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13} /> The test will open here once it goes live.</div>}
          </div>
        ))}
      </div>
      <style>{`.ts-spin{animation:tsSpin 1s linear infinite}@keyframes tsSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
