import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { fetchAPI } from '../api/apiClient';

export default function LibrarySubjectPage({ subject, onBack }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Styling maps based on subject
  const subjectThemes = {
    physics: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
    chemistry: { color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    biology: { color: '#f472b6', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)' },
  };

  const theme = subjectThemes[subject.toLowerCase()] || subjectThemes.physics;

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const response = await fetchAPI(`/api/library/${subject}`);
        const data = await response.json();
        setMaterials(data.materials || []);
      } catch (error) {
        console.error('Failed to fetch materials:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, [subject]);

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 80px)', width: '100%', padding: '48px 24px', color: 'white', overflow: 'hidden' }}>
      
      {/* Background Glow */}
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translate(-50%, -50%)', width: 800, height: 400, backgroundColor: theme.bg, filter: 'blur(150px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 10 }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <button 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db', padding: '8px 16px', borderRadius: 9999, cursor: 'pointer', transition: 'all 0.2s ease', marginRight: 24 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#d1d5db'; }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, textTransform: 'capitalize', margin: 0, color: 'white', letterSpacing: '-0.02em' }}>
              {subject} <span style={{ color: theme.color }}>Modules</span>
            </h1>
            <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: 14 }}>Select a chapter below to open the study material.</p>
          </div>
        </div>

        {/* Content List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 className="animate-spin" size={32} color={theme.color} />
          </div>
        ) : materials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <BookOpen size={48} color={theme.color} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px 0' }}>No modules found</h3>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Study materials for {subject} will appear here soon.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {materials.map((item, idx) => (
              <a 
                key={item.id || idx}
                href={item.pdf_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '24px',
                  background: 'rgba(12, 19, 36, 0.6)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 16,
                  textDecoration: 'none',
                  color: 'white',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(12, 19, 36, 0.9)';
                  e.currentTarget.style.border = `1px solid ${theme.border}`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 10px 30px -10px ${theme.bg}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(12, 19, 36, 0.6)';
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.color }}>
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px 0' }}>{item.chapter_name}</h3>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Chapter Module</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.color, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Open PDF <ExternalLink size={16} />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
