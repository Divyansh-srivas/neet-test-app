import React, { useEffect, useState } from 'react'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { listSeries } from '../api/testSeries'

// Small card on the Dashboard. Hidden when there is nothing published (or the API is unavailable).
export default function TestSeriesBanner({ setPage }) {
  const [items, setItems] = useState(null)
  useEffect(() => { let on = true; listSeries().then((d) => on && setItems(Array.isArray(d) ? d : [])).catch(() => {}); return () => { on = false } }, [])
  if (!items || items.length === 0) return null
  const live = items.filter((s) => s.live).length
  return (
    <button type="button" onClick={() => setPage('series')} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 20, padding: '16px 18px', borderRadius: 16,
      border: '1px solid rgba(34,197,94,0.35)', background: 'linear-gradient(135deg, rgba(34,197,94,0.14), var(--surface))',
      color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <span style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#15803d,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: 'none' }}><ClipboardList size={20} /></span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>Test Series</span>
        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
          {live > 0 ? `${live} live test${live === 1 ? '' : 's'} available` : 'Syllabus is out. Tests open soon'}
        </span>
      </span>
      <ChevronRight size={18} color="var(--muted)" />
    </button>
  )
}
