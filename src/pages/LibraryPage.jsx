import React from 'react'
import { BookOpen, Sparkles } from 'lucide-react'

export default function LibraryPage() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '60vh',
      textAlign: 'center',
      padding: '60px 24px'
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 24,
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28
      }}>
        <BookOpen size={36} color="#818cf8" />
      </div>

      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: 100,
        marginBottom: 20
      }}>
        <Sparkles size={14} color="#818cf8" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', letterSpacing: '1px', textTransform: 'uppercase' }}>Coming Soon</span>
      </div>

      <h2 style={{ 
        fontSize: 32, 
        fontWeight: 800, 
        color: 'var(--text)', 
        marginBottom: 12,
        letterSpacing: '-0.5px'
      }}>
        Library
      </h2>

      <p style={{ 
        color: 'var(--muted)', 
        fontSize: 16, 
        maxWidth: 420, 
        lineHeight: 1.6 
      }}>
        We're building something amazing for you. Study materials, notes, and resources — all in one place.
      </p>
    </div>
  )
}
