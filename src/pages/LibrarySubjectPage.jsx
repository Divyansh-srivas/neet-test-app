import React, { useState } from 'react';
import { ArrowLeft, BookOpen, X, Maximize2, Target, GraduationCap, Shuffle } from 'lucide-react';
import libraryData from '../data/libraryData';
import './LibrarySubjectPage.css';
const tabs = [
  { key: 'neet', label: 'NEET', icon: Target, color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
  { key: 'jee', label: 'JEE', icon: GraduationCap, color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
  { key: 'random', label: 'ChapterWise', icon: Shuffle, color: '#f472b6', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)' },
];

export default function LibrarySubjectPage({ subject, onBack }) {
  const [activeTab, setActiveTab] = useState('neet');
  const [selectedPdf, setSelectedPdf] = useState(null);

  // Styling maps based on subject
  const subjectThemes = {
    physics: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
    chemistry: { color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    biology: { color: '#f472b6', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)' },
  };

  const theme = subjectThemes[subject.toLowerCase()] || subjectThemes.physics;
  const currentTab = tabs.find(t => t.key === activeTab);

  // Get chapters: libraryData.physics.neet, libraryData.physics.jee, etc.
  const subjectData = libraryData[subject.toLowerCase()] || {};
  const materials = (subjectData[activeTab] || []).filter(item => item.pdf_link);

  return (
    <div className="library-subject-page">
      
      {/* Background Glow */}
      <div 
        className="bg-glow" 
        style={{ backgroundColor: theme.bg }} 
      />

      <div className="page-container">
        
        {/* Top: Breadcrumb Section */}
        <button className="breadcrumb-link" onClick={onBack}>
          <ArrowLeft size={16} className="breadcrumb-icon" /> 
          Back to Library
        </button>
        
        {/* Middle: Title Section */}
        <div className="page-header">
          <h1 className="page-title">
            {subject} <span className="title-gradient">Modules</span>
          </h1>
          <p className="page-subtitle">Select a section and open chapter-wise questions.</p>
        </div>

        {/* Bottom: JEE / NEET / Random Tabs */}
        <div className="filter-tabs-container">
          {tabs.filter(tab => !(subject.toLowerCase() === 'biology' && tab.key === 'jee')).map((tab) => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`filter-tab ${isActive ? 'active' : ''}`}
                style={{
                  '--tab-color': tab.color,
                  '--tab-bg': tab.bg,
                  '--tab-border': tab.border,
                }}
              >
                <TabIcon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content List */}
        {materials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <BookOpen size={48} color={currentTab?.color || theme.color} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', background: currentTab?.bg || 'rgba(99,102,241,0.1)', border: `1px solid ${currentTab?.border || 'rgba(99,102,241,0.2)'}`, borderRadius: 9999, marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: currentTab?.color || '#818cf8', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Coming Soon</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px 0' }}>{currentTab?.label} — {subject}</h3>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Chapter-wise {currentTab?.label} questions for {subject} will be added soon.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {materials.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => setSelectedPdf(item.pdf_link)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '24px',
                  background: 'rgba(12, 19, 36, 0.6)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 16,
                  color: 'white',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(12, 19, 36, 0.9)';
                  e.currentTarget.style.border = `1px solid ${currentTab?.border || theme.border}`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 10px 30px -10px ${currentTab?.bg || theme.bg}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(12, 19, 36, 0.6)';
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: currentTab?.bg || theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentTab?.color || theme.color }}>
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px 0' }}>{item.chapter_name}</h3>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Chapter Module</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: currentTab?.color || theme.color, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Read <Maximize2 size={16} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{ width: '100%', maxWidth: 1200, display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button 
              onClick={() => setSelectedPdf(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 20px', borderRadius: 9999, cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            >
              <X size={18} /> Close Viewer
            </button>
          </div>
          <div style={{ width: '100%', maxWidth: 1200, height: 'calc(100vh - 120px)', background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <iframe src={selectedPdf.replace(/\/view.*$/, '/preview')} width="100%" height="100%" style={{ border: 'none' }} title="PDF Viewer" allow="autoplay" />
          </div>
        </div>
      )}
    </div>
  );
}
