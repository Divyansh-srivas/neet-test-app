import React from 'react'
import { Atom, FlaskConical, Dna } from 'lucide-react'

export default function LibraryPage() {
  const subjects = [
    {
      id: 'physics',
      title: 'Physics',
      description: 'Master mechanics, thermodynamics, electromagnetism & more',
      icon: Atom,
      color: '#60a5fa',
      bg: 'rgba(96, 165, 250, 0.1)',
      border: 'rgba(96, 165, 250, 0.2)'
    },
    {
      id: 'chemistry',
      title: 'Chemistry',
      description: 'Organic, inorganic & physical chemistry concepts',
      icon: FlaskConical,
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.1)',
      border: 'rgba(52, 211, 153, 0.2)'
    },
    {
      id: 'biology',
      title: 'Biology',
      description: 'Botany, zoology & human physiology practice',
      icon: Dna,
      color: '#f472b6',
      bg: 'rgba(244, 114, 182, 0.1)',
      border: 'rgba(244, 114, 182, 0.2)'
    }
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header Section matching TrackPrep's look */}
      <div style={{ textAlign: 'center', marginBottom: 60, marginTop: 20 }}>
        <div style={{ 
          display: 'inline-block', 
          padding: '6px 16px', 
          background: 'rgba(99, 102, 241, 0.1)', 
          color: '#818cf8', 
          borderRadius: 100, 
          fontSize: 12, 
          fontWeight: 600, 
          letterSpacing: '1px', 
          textTransform: 'uppercase',
          marginBottom: 24,
          border: '1px solid rgba(99, 102, 241, 0.2)'
        }}>
          ✨ Intelligence in Practice
        </div>
        
        <h1 style={{ 
          fontSize: 'clamp(36px, 5vw, 56px)', 
          fontWeight: 800, 
          color: 'var(--text)', 
          marginBottom: 16, 
          letterSpacing: '-1.5px',
          lineHeight: 1.1
        }}>
          Precision <span style={{ color: '#818cf8' }}>Practice.</span><br />
          Proven Success.
        </h1>
        <p style={{ 
          color: 'var(--muted)', 
          fontSize: 17, 
          maxWidth: 600, 
          margin: '0 auto', 
          lineHeight: 1.6 
        }}>
          Access 450,000+ hand-picked MCQs designed to challenge, teach, and transform your NEET 2025 preparation.
        </p>
      </div>

      {/* Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: 30 
      }}>
        {subjects.map((s) => (
          <div 
            key={s.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 32,
              padding: '48px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.borderColor = s.border
              e.currentTarget.style.boxShadow = `0 20px 40px -12px ${s.bg}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: s.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
              border: `1px solid ${s.border}`
            }}>
              <s.icon size={44} color={s.color} strokeWidth={1.5} />
            </div>
            
            <h2 style={{ 
              fontSize: 28, 
              fontWeight: 700, 
              color: 'var(--text)', 
              marginBottom: 16,
              letterSpacing: '-0.5px'
            }}>
              {s.title}
            </h2>
            
            <p style={{ 
              color: 'var(--muted)', 
              fontSize: 15, 
              lineHeight: 1.6, 
              padding: '0 8px',
              margin: 0
            }}>
              {s.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
