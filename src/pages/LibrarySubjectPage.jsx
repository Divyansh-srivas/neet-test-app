import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, X, Maximize2, Target, GraduationCap, Shuffle, Sparkles, PlayCircle, Loader2 } from 'lucide-react';
import { fetchAPI } from '../api/apiClient';
import './LibrarySubjectPage.css';
const tabs = [
  { key: 'neet', label: 'NEET', icon: Target, color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
  { key: 'jee', label: 'JEE', icon: GraduationCap, color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
  { key: 'random', label: 'ChapterWise', icon: Shuffle, color: '#f472b6', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.4)' },
];

export default function LibrarySubjectPage({ subject, onBack, setPage, setActiveTest }) {
  const [activeTab, setActiveTab] = useState('random');
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingPractice, setStartingPractice] = useState(null);

  useEffect(() => {
    const loadChapters = async () => {
      setLoading(true);
      try {
        const data = await fetchAPI(`/api/library/chapters/${subject}`);
        setChapters(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadChapters();
  }, [subject]);

  const handleStartPractice = async (chapter) => {
    if (chapter.question_count === 0) return;
    setStartingPractice(chapter.id);
    try {
        const questions = await fetchAPI(`/api/library/practice/${chapter.id}`);
        const mockTest = {
            id: `practice-${chapter.id}-${Date.now()}`,
            testName: `${subject} - ${chapter.name}`,
            duration: Math.max(30, questions.length * 2), // 2 mins per question, min 30
            questions: questions.map((q, idx) => ({
                id: q.id,
                qNum: idx + 1,
                questionText: q.question_text,
                options: {
                    A: q.option_a,
                    B: q.option_b,
                    C: q.option_c,
                    D: q.option_d,
                },
                correctOption: q.correct_option,
                explanation: q.explanation,
                diagramUrl: q.image_url,
            })),
            isPractice: true
        };
        setActiveTest(mockTest);
        setPage('pretest');
    } catch (e) {
        console.error(e);
        alert('Failed to load practice quiz.');
    } finally {
        setStartingPractice(null);
    }
  };

  // Styling maps based on subject
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
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', marginBottom: 12 }} /> Loading chapters...</div>
            ) : activeTab === 'random' ? (
                chapters.length > 0 ? chapters.map(chapter => (
                    <div key={chapter.id} style={{ 
                        background: 'rgba(12, 19, 36, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(12px)'
                    }}>
                        <div>
                            <h3 style={{ color: 'white', margin: '0 0 4px 0', fontSize: 18 }}>{chapter.name}</h3>
                            <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>{chapter.question_count} Questions</p>
                        </div>
                        <button 
                            onClick={() => handleStartPractice(chapter)}
                            disabled={chapter.question_count === 0 || startingPractice === chapter.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, border: 'none',
                                background: chapter.question_count === 0 ? 'rgba(255,255,255,0.05)' : theme.color,
                                color: chapter.question_count === 0 ? 'var(--muted)' : 'white', cursor: chapter.question_count === 0 ? 'not-allowed' : 'pointer',
                                fontWeight: 600, transition: 'all 0.2s'
                            }}>
                            {startingPractice === chapter.id ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
                            {chapter.question_count === 0 ? 'Coming Soon' : 'Start Practice'}
                        </button>
                    </div>
                )) : (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', background: 'rgba(12,19,36,0.5)', borderRadius: 16 }}>No chapters available yet.</div>
                )
            ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', background: 'rgba(12,19,36,0.5)', borderRadius: 16 }}>
                    This section is under construction. Please check the ChapterWise tab.
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
