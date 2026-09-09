import React, { useState } from 'react';
import { ArrowLeft, BookOpen, X, Maximize2, Target, GraduationCap, Shuffle, Sparkles } from 'lucide-react';
import libraryData from '../data/libraryData';
import './LibrarySubjectPage.css';
const tabs = [
  { key: 'neet', label: 'NEET', icon: Target, color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
  { key: 'jee', label: 'JEE', icon: GraduationCap, color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
  { key: 'random', label: 'ChapterWise', icon: Shuffle, color: '#f472b6', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)' },
];

export default function LibrarySubjectPage({ subject, onBack }) {
  const [activeTab, setActiveTab] = useState('neet');

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

        {/* Content List - Coming Soon State */}
        <div style={{
          marginTop: 24,
          padding: '80px 24px',
          background: 'rgba(12, 19, 36, 0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 20px 40px -20px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle glowing orb behind the content */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 300,
            height: 300,
            background: currentTab?.color || theme.color,
            opacity: 0.05,
            filter: 'blur(80px)',
            pointerEvents: 'none',
            borderRadius: '50%'
          }} />

          <div style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: currentTab?.bg || theme.bg,
            border: `1px solid ${currentTab?.border || theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentTab?.color || theme.color,
            marginBottom: 24,
            boxShadow: `0 0 30px ${currentTab?.bg || theme.bg}`
          }}>
            <Sparkles size={40} />
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 9999,
            marginBottom: 20
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: currentTab?.color || theme.color, boxShadow: `0 0 10px ${currentTab?.color || theme.color}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Coming Soon</span>
          </div>

          <h3 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: '0 0 12px 0' }}>
            Interactive Question Bank Under Construction
          </h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: 15, lineHeight: 1.6, maxWidth: 480 }}>
            We are currently curating verified NTA-pattern chapter-wise questions and interactive CBT mocks for this section. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  );
}
