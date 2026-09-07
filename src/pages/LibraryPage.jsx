import React, { useState } from 'react';
import { Atom, FlaskConical, Dna, Sparkles, ArrowRight } from 'lucide-react';
import LibrarySubjectPage from './LibrarySubjectPage';

const subjects = [
  {
    title: 'Physics',
    desc: 'Chapter-wise JEE, NEET & random practice questions',
    icon: Atom,
    color: { icon: '#60a5fa', bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.5)', badgeBg: 'rgba(59,130,246,0.1)', badgeText: '#93c5fd', badgeBorder: 'rgba(59,130,246,0.3)', glow: 'rgba(59,130,246,0.1)' },
  },
  {
    title: 'Chemistry',
    desc: 'Chapter-wise JEE, NEET & random practice questions',
    icon: FlaskConical,
    color: { icon: '#34d399', bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.5)', badgeBg: 'rgba(16,185,129,0.1)', badgeText: '#6ee7b7', badgeBorder: 'rgba(16,185,129,0.3)', glow: 'rgba(16,185,129,0.1)' },
  },
  {
    title: 'Biology',
    desc: 'Chapter-wise NEET & random practice questions',
    icon: Dna,
    color: { icon: '#f472b6', bg: 'rgba(236,72,153,0.2)', border: 'rgba(236,72,153,0.5)', badgeBg: 'rgba(236,72,153,0.1)', badgeText: '#f9a8d4', badgeBorder: 'rgba(236,72,153,0.3)', glow: 'rgba(236,72,153,0.1)' },
  },
];

export default function LibraryPage() {
  const [selectedSubject, setSelectedSubject] = useState(null);

  if (selectedSubject) {
    return <LibrarySubjectPage subject={selectedSubject} onBack={() => setSelectedSubject(null)} />;
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 80px)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: 'white', overflow: 'hidden' }}>
      
      {/* Background Ambient Glow */}
      <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 350, backgroundColor: 'rgba(37,99,235,0.15)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Top Header */}
      <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 56px auto', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 9999, backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 20, boxShadow: '0 0 15px rgba(59,130,246,0.15)' }}>
          <Sparkles style={{ width: 14, height: 14 }} />
          Study Library
        </div>

        <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 14px 0', lineHeight: 1.1 }}>
          Explore by{' '}
          <span style={{ color: 'transparent', backgroundImage: 'linear-gradient(to right, #60a5fa, #a5b4fc, #22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
            Subject
          </span>
        </h1>
        
        <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.625, margin: 0 }}>
          Access chapter-wise study materials, important notes, and curated test modules for your NEET preparation.
        </p>
      </div>

      {/* Subject Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, maxWidth: 1024, width: '100%', position: 'relative', zIndex: 10 }}>
        {subjects.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                padding: 32,
                borderRadius: 24,
                backgroundColor: 'rgba(12,19,36,0.75)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedSubject(item.title.toLowerCase())}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)'
                e.currentTarget.style.borderColor = item.color.border
                e.currentTarget.style.boxShadow = `0 25px 60px -12px ${item.color.glow}`
                const iconBubble = e.currentTarget.querySelector('.icon-bubble')
                if (iconBubble) iconBubble.style.transform = 'scale(1.1)'
                const spotlight = e.currentTarget.querySelector('.spotlight')
                if (spotlight) spotlight.style.backgroundColor = 'rgba(59,130,246,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.25)'
                const iconBubble = e.currentTarget.querySelector('.icon-bubble')
                if (iconBubble) iconBubble.style.transform = 'scale(1)'
                const spotlight = e.currentTarget.querySelector('.spotlight')
                if (spotlight) spotlight.style.backgroundColor = 'rgba(255,255,255,0.03)'
              }}
            >
              {/* Internal Card Hover Radial Spotlight */}
              <div className="spotlight" style={{ position: 'absolute', top: -64, left: '50%', transform: 'translateX(-50%)', width: 176, height: 176, backgroundColor: 'rgba(255,255,255,0.03)', filter: 'blur(40px)', borderRadius: '50%', pointerEvents: 'none', transition: 'background-color 0.5s ease' }} />

              {/* Icon Bubble */}
              <div className="icon-bubble" style={{ position: 'relative', width: 80, height: 80, borderRadius: 16, backgroundColor: item.color.bg, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)', transition: 'transform 0.3s ease' }}>
                <Icon style={{ width: 40, height: 40, color: item.color.icon }} />
              </div>

              {/* Title & Description */}
              <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: 'white', marginBottom: 8, marginTop: 0 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.625, marginBottom: 24, minHeight: 40, margin: '0 0 24px 0' }}>
                {item.desc}
              </p>

              {/* Explore Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 9999, fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', border: `1px solid ${item.color.badgeBorder}`, backgroundColor: item.color.badgeBg, color: item.color.badgeText, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)', marginTop: 'auto', transition: 'all 0.3s ease' }}>
                Explore <ArrowRight size={14} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
