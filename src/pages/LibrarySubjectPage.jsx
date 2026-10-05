import React, { useState, useEffect } from 'react';
import { ArrowLeft, Target, GraduationCap, Shuffle, PlayCircle, Loader2, Sparkles } from 'lucide-react';
import { fetchAPI } from '../api/apiClient';
import './LibrarySubjectPage.css';

const tabs = [
  { key: 'neet',   label: 'NEET',       icon: Target,        color: '#60a5fa', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)' },
  { key: 'jee',    label: 'JEE',        icon: GraduationCap, color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
  { key: 'random', label: 'ChapterWise', icon: Shuffle,       color: '#f472b6', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)' },
];

const subjectThemes = {
  physics:   { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)'  },
  chemistry: { color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
  biology:   { color: '#f472b6', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)'  },
};

export default function LibrarySubjectPage({ subject, onBack, onStartPracticeQuiz }) {
  const [activeTab, setActiveTab]           = useState('random');
  const [chapters, setChapters]             = useState([]);
  const [loading, setLoading]               = useState(true);

  const theme = subjectThemes[subject?.toLowerCase()] || subjectThemes.physics;

  useEffect(() => {
    const loadChapters = async () => {
      setLoading(true);
      try {
        const res  = await fetchAPI(`/api/library/chapters/${subject}`);
        const data = await res.json();
        setChapters(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadChapters();
  }, [subject]);

  return (
    <div className="library-subject-page">
      {/* Background Glow */}
      <div className="bg-glow" style={{ backgroundColor: theme.bg }} />

      <div className="page-container">
        {/* Breadcrumb */}
        <button className="breadcrumb-link" onClick={onBack}>
          <ArrowLeft size={16} className="breadcrumb-icon" />
          Back to Library
        </button>

        {/* Title */}
        <div className="page-header">
          <h1 className="page-title">
            {subject} <span className="title-gradient">Modules</span>
          </h1>
          <p className="page-subtitle">Explore chapter-wise content or launch a full Practice Quiz.</p>
        </div>

        {/* Practice Quiz CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
          border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: '20px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 24, flexWrap: 'wrap', gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={20} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Practice Quiz</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Pick chapters, set a question count, and get instant feedback</div>
            </div>
          </div>
          <button
            onClick={() => onStartPracticeQuiz(subject)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 22px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(99,102,241,0.35)', transition: 'transform 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <PlayCircle size={18} /> Start Practice Quiz
          </button>
        </div>

        {/* Tabs */}
        <div className="filter-tabs-container">
          {tabs
            .filter(tab => !(subject?.toLowerCase() === 'biology' && tab.key === 'jee'))
            .map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon  = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`filter-tab ${isActive ? 'active' : ''}`}
                  style={{ '--tab-color': tab.color, '--tab-bg': tab.bg, '--tab-border': tab.border }}
                >
                  <TabIcon size={16} /> {tab.label}
                </button>
              );
            })}
        </div>

        {/* Content List */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading chapters...
            </div>
          ) : activeTab === 'random' ? (
            chapters.length > 0 ? chapters.map(chapter => (
              <div key={chapter.id} style={{
                background: 'rgba(12,19,36,0.5)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '18px 22px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(12px)'
              }}>
                <div>
                  <h3 style={{ color: 'white', margin: '0 0 4px 0', fontSize: 16, fontWeight: 600 }}>{chapter.name}</h3>
                  <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>
                    {chapter.question_count > 0 ? `${chapter.question_count} Questions` : 'Coming Soon'}
                  </p>
                </div>
                <button
                  onClick={() => onStartPracticeQuiz(subject)}
                  disabled={chapter.question_count === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, border: 'none',
                    background: chapter.question_count === 0 ? 'rgba(255,255,255,0.05)' : theme.bg,
                    color: chapter.question_count === 0 ? 'var(--muted)' : theme.color,
                    cursor: chapter.question_count === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
                    border: `1px solid ${chapter.question_count === 0 ? 'rgba(255,255,255,0.05)' : theme.border}`
                  }}
                >
                  <PlayCircle size={15} />
                  {chapter.question_count === 0 ? 'Coming Soon' : 'Practice'}
                </button>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', background: 'rgba(12,19,36,0.5)', borderRadius: 16 }}>
                No chapters available yet. Chapters will appear here once the admin publishes content.
              </div>
            )
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', background: 'rgba(12,19,36,0.5)', borderRadius: 16 }}>
              This section is under construction.
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
