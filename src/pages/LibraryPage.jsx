import React from 'react'
import { Atom, FlaskConical, Dna, Sparkles } from 'lucide-react'

export default function LibraryPage() {
  const subjects = [
    {
      id: 'physics',
      title: 'Physics',
      description: 'Master mechanics, thermodynamics, electromagnetism & more',
      icon: Atom,
      color: '#60a5fa',
      bg: 'rgba(96, 165, 250, 0.1)',
      border: 'rgba(96, 165, 250, 0.2)',
      glow: 'rgba(96, 165, 250, 0.08)'
    },
    {
      id: 'chemistry',
      title: 'Chemistry',
      description: 'Organic, inorganic & physical chemistry concepts',
      icon: FlaskConical,
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.1)',
      border: 'rgba(52, 211, 153, 0.2)',
      glow: 'rgba(52, 211, 153, 0.08)'
    },
    {
      id: 'biology',
      title: 'Biology',
      description: 'Botany, zoology & human physiology practice',
      icon: Dna,
      color: '#f472b6',
      bg: 'rgba(244, 114, 182, 0.1)',
      border: 'rgba(244, 114, 182, 0.2)',
      glow: 'rgba(244, 114, 182, 0.08)'
    }
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48, marginTop: 10 }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px', 
          background: 'rgba(99, 102, 241, 0.1)', 
          color: '#818cf8', 
          borderRadius: 100, 
          fontSize: 12, 
          fontWeight: 600, 
          letterSpacing: '1px', 
          textTransform: 'uppercase',
          marginBottom: 20,
          border: '1px solid rgba(99, 102, 241, 0.2)'
        }}>
          <Sparkles size={14} color="#818cf8" />
          Study Library
        </div>
        
        <h1 style={{ 
          fontSize: 'clamp(28px, 4vw, 40px)', 
          fontWeight: 800, 
          color: 'var(--text)', 
          marginBottom: 12, 
          letterSpacing: '-1px',
          lineHeight: 1.2
        }}>
          Explore by Subject
        </h1>
        <p style={{ 
          color: 'var(--muted)', 
          fontSize: 15, 
          maxWidth: 500, 
          margin: '0 auto', 
          lineHeight: 1.6 
        }}>
          Access chapter-wise study materials, important notes, and curated resources for your NEET preparation.
        </p>
      </div>

      {/* Subject Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: 24 
      }}>
        {subjects.map((s) => (
          <div 
            key={s.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 28,
              padding: '44px 28px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)'
              e.currentTarget.style.borderColor = s.border
              e.currentTarget.style.boxShadow = `0 20px 50px -12px ${s.glow}, 0 0 0 1px ${s.border}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {/* Icon Circle */}
            <div style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: s.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 28px',
              border: `1px solid ${s.border}`,
              transition: 'transform 0.3s ease'
            }}>
              <s.icon size={40} color={s.color} strokeWidth={1.5} />
            </div>
            
            {/* Title */}
            <h2 style={{ 
              fontSize: 24, 
              fontWeight: 700, 
              color: 'var(--text)', 
              marginBottom: 12,
              letterSpacing: '-0.3px'
            }}>
              {s.title}
            </h2>
            
            {/* Description */}
            <p style={{ 
              color: 'var(--muted)', 
              fontSize: 14, 
              lineHeight: 1.6, 
              padding: '0 8px',
              margin: '0 0 20px 0'
            }}>
              {s.description}
            </p>

            {/* Coming Soon Tag */}
            <div style={{
              display: 'inline-block',
              padding: '5px 14px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 600,
              color: '#818cf8',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              Coming Soon
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
