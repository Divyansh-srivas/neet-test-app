import React, { useState, useEffect, useCallback } from 'react';
import { Atom, FlaskConical, Dna, ChevronDown, ChevronUp, Check, AlertCircle, Loader2, Sparkles, Clock, X } from 'lucide-react';
import { fetchAPI } from '../api/apiClient';

const SUBJECTS = [
  { name: 'Physics',   icon: Atom,         color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)'  },
  { name: 'Chemistry', icon: FlaskConical,  color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  { name: 'Biology',   icon: Dna,          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)'  },
];

export default function PracticeQuizSetup({ initialSubject, onGenerate, onCancel }) {
  const [chaptersMap, setChaptersMap] = useState({}); // subject -> chapters[]
  const [loadingMap, setLoadingMap] = useState({});
  const [expanded, setExpanded] = useState(initialSubject || null);

  // Auto-load chapters for the initial subject on mount
  useEffect(() => {
    if (initialSubject) {
      const subj = SUBJECTS.find(s => s.name === initialSubject);
      if (subj) toggleSubject(subj);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selections, setSelections] = useState({}); // { Physics: { chapterIds: Set, count: 10 } }
  const [timed, setTimed] = useState(false);
  const [timerMins, setTimerMins] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const toggleSubject = async (subj) => {
    const isOpen = expanded === subj.name;
    setExpanded(isOpen ? null : subj.name);
    
    // Load chapters if not yet loaded
    if (!chaptersMap[subj.name] && !loadingMap[subj.name]) {
      setLoadingMap(p => ({ ...p, [subj.name]: true }));
      try {
        const res = await fetchAPI(`/api/library/chapters/${subj.name}`);
        const data = await res.json();
        setChaptersMap(p => ({ ...p, [subj.name]: data }));
        // Default: all chapters selected
        if (!selections[subj.name]) {
          setSelections(p => ({
            ...p,
            [subj.name]: {
              chapterIds: new Set(data.map(c => c.id)),
              count: 10
            }
          }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMap(p => ({ ...p, [subj.name]: false }));
      }
    } else if (!selections[subj.name] && chaptersMap[subj.name]) {
      setSelections(p => ({
        ...p,
        [subj.name]: {
          chapterIds: new Set(chaptersMap[subj.name].map(c => c.id)),
          count: 10
        }
      }));
    }
  };

  const toggleChapter = (subjName, chapId) => {
    setSelections(p => {
      const cur = p[subjName] || { chapterIds: new Set(), count: 10 };
      const next = new Set(cur.chapterIds);
      if (next.has(chapId)) next.delete(chapId);
      else next.add(chapId);
      return { ...p, [subjName]: { ...cur, chapterIds: next } };
    });
  };

  const setCount = (subjName, val) => {
    const n = Math.max(1, Math.min(50, Number(val) || 1));
    setSelections(p => ({
      ...p,
      [subjName]: { ...(p[subjName] || { chapterIds: new Set() }), count: n }
    }));
  };

  const selectAll = (subjName) => {
    const chapters = chaptersMap[subjName] || [];
    setSelections(p => ({
      ...p,
      [subjName]: { ...(p[subjName] || { count: 10 }), chapterIds: new Set(chapters.map(c => c.id)) }
    }));
  };

  const deselectAll = (subjName) => {
    setSelections(p => ({
      ...p,
      [subjName]: { ...(p[subjName] || { count: 10 }), chapterIds: new Set() }
    }));
  };

  // Computed summary
  const activeSubs = Object.entries(selections).filter(([, v]) => v.chapterIds && v.chapterIds.size > 0);
  const totalQuestions = activeSubs.reduce((acc, [, v]) => acc + (v.count || 0), 0);

  const handleGenerate = async () => {
    setError('');
    if (activeSubs.length === 0) { setError('Please select at least one subject and chapter.'); return; }
    setGenerating(true);
    try {
      const payload = {
        selections: activeSubs.map(([subjectName, v]) => ({
          subjectName,
          chapterIds: [...v.chapterIds],
          count: v.count
        }))
      };
      const res = await fetchAPI('/api/library/practice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to generate quiz.'); return; }
      onGenerate({ questions: data.questions, notices: data.notices, timed, timerMins: timed ? timerMins : null });
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 900, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Back to Library
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} color="#6366f1" />
            </div>
            <div>
              <h1 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 800, margin: 0 }}>Practice Quiz Setup</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Select subjects, chapters, and how many questions you want</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          {/* Left: Subject configurator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {SUBJECTS.map(subj => {
              const Icon = subj.icon;
              const isOpen = expanded === subj.name;
              const sel = selections[subj.name];
              const chapters = chaptersMap[subj.name] || [];
              const loading = loadingMap[subj.name];
              const selectedCount = sel?.chapterIds?.size || 0;
              const isActive = selectedCount > 0;

              return (
                <div key={subj.name} style={{
                  background: 'var(--surface)', border: `1px solid ${isActive ? subj.border : 'var(--border)'}`,
                  borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s',
                  boxShadow: isActive ? `0 0 20px ${subj.bg}` : 'none'
                }}>
                  {/* Subject Header — click to expand */}
                  <button onClick={() => toggleSubject(subj)} style={{
                    width: '100%', padding: '20px 24px', background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', textAlign: 'left'
                  }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: subj.bg, border: `1px solid ${subj.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={24} color={subj.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>{subj.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                        {isOpen ? `${selectedCount} chapter${selectedCount !== 1 ? 's' : ''} selected` : 'Click to configure'}
                      </div>
                    </div>
                    {isActive && !isOpen && (
                      <div style={{ padding: '4px 12px', background: subj.bg, border: `1px solid ${subj.border}`, borderRadius: 999, color: subj.color, fontSize: 12, fontWeight: 600 }}>
                        {sel.count} Qs
                      </div>
                    )}
                    {isOpen ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
                  </button>

                  {/* Expanded Configuration */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px' }}>
                      {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', padding: '16px 0' }}>
                          <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading chapters...
                        </div>
                      ) : chapters.length === 0 ? (
                        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No chapters available yet for this subject.</p>
                      ) : (
                        <>
                          {/* Count Input */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <label style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Questions from {subj.name}</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button onClick={() => setCount(subj.name, (sel?.count || 10) - 1)} style={counterBtnStyle}>−</button>
                              <input
                                type="number" min={1} max={50}
                                value={sel?.count || 10}
                                onChange={e => setCount(subj.name, e.target.value)}
                                style={{ width: 56, textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 8px', fontSize: 15, fontWeight: 700 }}
                              />
                              <button onClick={() => setCount(subj.name, (sel?.count || 10) + 1)} style={counterBtnStyle}>+</button>
                            </div>
                          </div>

                          {/* Chapter checkboxes */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chapters</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => selectAll(subj.name)} style={linkBtnStyle(subj.color)}>All</button>
                              <span style={{ color: 'var(--border)' }}>·</span>
                              <button onClick={() => deselectAll(subj.name)} style={linkBtnStyle('#ef4444')}>None</button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                            {chapters.map(ch => {
                              const checked = sel?.chapterIds?.has(ch.id);
                              return (
                                <label key={ch.id} style={{
                                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                  background: checked ? subj.bg : 'var(--surface2)', borderRadius: 10,
                                  border: `1px solid ${checked ? subj.border : 'var(--border)'}`,
                                  cursor: 'pointer', transition: 'all 0.15s'
                                }}>
                                  <div style={{
                                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                    background: checked ? subj.color : 'var(--bg)', border: `1.5px solid ${checked ? subj.color : 'var(--border)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
                                  }}>
                                    {checked && <Check size={12} color="white" strokeWidth={3} />}
                                  </div>
                                  <input type="checkbox" checked={!!checked} onChange={() => toggleChapter(subj.name, ch.id)} style={{ display: 'none' }} />
                                  <span style={{ color: checked ? 'var(--text)' : 'var(--muted)', fontSize: 13, fontWeight: checked ? 600 : 400 }}>{ch.name}</span>
                                  <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 11, flexShrink: 0 }}>{ch.question_count}</span>
                                </label>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Timer toggle */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={22} color="#f59e0b" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>Timed Practice</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>Off by default — turn on to add a countdown timer</div>
              </div>
              {timed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" min={1} max={180} value={timerMins}
                    onChange={e => setTimerMins(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                    style={{ width: 60, textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 8px', fontSize: 14 }}
                  />
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>min</span>
                </div>
              )}
              <button onClick={() => setTimed(p => !p)} style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: timed ? '#f59e0b' : 'var(--surface2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute',
                  top: 3, left: timed ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                }} />
              </button>
            </div>
          </div>

          {/* Right: Live summary */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Quiz Summary</h3>

              {activeSubs.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Select a subject to get started</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {activeSubs.map(([subjName, v]) => {
                    const subj = SUBJECTS.find(s => s.name === subjName);
                    const chaps = chaptersMap[subjName] || [];
                    const selectedChaps = chaps.filter(c => v.chapterIds.has(c.id));
                    return (
                      <div key={subjName} style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, borderLeft: `3px solid ${subj?.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ color: subj?.color, fontWeight: 700, fontSize: 14 }}>{subjName}</span>
                          <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: 15 }}>{v.count} Q</span>
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.5 }}>
                          {selectedChaps.length === 0 ? 'No chapters selected' : selectedChaps.map(c => c.name).join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
                  <span>Total Questions</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>{totalQuestions}</span>
                </div>
                {timed && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 13 }}>
                    <span>Time Limit</span>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{timerMins} min</span>
                  </div>
                )}
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button onClick={handleGenerate} disabled={generating || activeSubs.length === 0} style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: activeSubs.length === 0 ? 'not-allowed' : 'pointer',
                background: activeSubs.length === 0 ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: 'white', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: activeSubs.length === 0 ? 0.5 : 1, transition: 'all 0.2s'
              }}>
                {generating ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Sparkles size={18} /> Generate Quiz</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .quiz-setup-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const counterBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const linkBtnStyle = (color) => ({
  background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0
});
