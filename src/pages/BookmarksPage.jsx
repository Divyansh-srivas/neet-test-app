import React, { useState, useEffect } from 'react'
import { getBookmarks, toggleBookmark } from '../utils/storage'
import { Bookmark, BookmarkX, Filter } from 'lucide-react'
import MathText from '../components/MathText'

const SUB_COLORS = { Physics: 'var(--accent)', Chemistry: 'var(--green)', Biology: 'var(--yellow)' }

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState([])
  const [filter, setFilter] = useState('All')

  useEffect(() => { setBookmarks(getBookmarks()) }, [])

  const handleRemove = (q) => {
    toggleBookmark(q)
    setBookmarks(getBookmarks())
  }

  const subjects = ['All', 'Physics', 'Chemistry', 'Biology']
  const filtered = filter === 'All' ? bookmarks : bookmarks.filter(b => b.subject === filter)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700 }}>Bookmarks</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 3 }}>{bookmarks.length} saved questions</p>
        </div>
        {/* Filter */}
        <div style={{ display: 'flex', gap: 8 }}>
          {subjects.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
              background: filter === s ? (SUB_COLORS[s] || 'var(--accent)') : 'var(--surface2)',
              color: filter === s ? 'white' : 'var(--muted)', fontWeight: filter === s ? 600 : 400
            }}>{s}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Bookmark size={48} color="var(--border)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 8, color: 'var(--muted)' }}>No bookmarks yet</h2>
          <p style={{ color: '#475569', fontSize: 14 }}>While attempting a test, tap the bookmark icon on any question to save it here for revision.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((q, i) => {
            const color = SUB_COLORS[q.subject] || 'var(--accent)'
            return (
              <div key={q.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color, background: `${color}20`, padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>{q.subject}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>Saved {new Date(q.savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.6, marginBottom: 12 }}><MathText text={q.question} /></p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <div key={opt} style={{
                          padding: '8px 12px', borderRadius: 8, fontSize: 13,
                          background: opt === q.correct ? 'color-mix(in srgb, var(--green) 13%, transparent)' : 'var(--surface2)',
                          border: `1px solid ${opt === q.correct ? 'color-mix(in srgb, var(--green) 25%, transparent)' : 'var(--border)'}`,
                          color: opt === q.correct ? '#6ee7b7' : '#94a3b8',
                          display: 'flex', gap: 8
                        }}>
                          <span style={{ fontWeight: 700, color: opt === q.correct ? 'var(--green)' : '#475569' }}>{opt}.</span>
                          <MathText text={q.options?.[opt] || `Option ${opt}`} />
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: '#94a3b8' }}>
                        💡 <MathText text={q.explanation} />
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleRemove(q)} title="Remove bookmark" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'color-mix(in srgb, var(--red) 50%, transparent)', padding: 4, flexShrink: 0 }}>
                    <BookmarkX size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
