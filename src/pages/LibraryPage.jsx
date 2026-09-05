import React from 'react'

export default function LibraryPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>Library</h1>
      <div style={{ 
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32,
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>Coming Soon</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>The Library section is currently under construction.</p>
      </div>
    </div>
  )
}
