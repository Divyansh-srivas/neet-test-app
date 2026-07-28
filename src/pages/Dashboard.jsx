import React, { useState, useEffect } from 'react'
import { getTests, deleteTest } from '../utils/storage'
import { useSettings } from '../utils/SettingsContext'
import { useAuth } from '../utils/useAuth.jsx'
import { Upload, Play, FileText, Clock, CheckCircle, Trash2, Target } from 'lucide-react'
import { getUserAnalytics } from '../api/performance'

export default function Dashboard({ setPage, setActiveTest }) {
  const { profile: authProfile } = useAuth()
  const [tests, setTests] = useState([])
  const [startingTest, setStartingTest] = useState(null)
  const { settings } = useSettings()
  const [customHours, setCustomHours] = useState(3)
  const [customMins, setCustomMins] = useState(0)

  const [perfSettings, setPerfSettings] = useState(null)
  const [userAnalytics, setUserAnalytics] = useState(null)

  useEffect(() => {
    setTests(getTests())
    if (authProfile?.id) {
      const settings = authProfile.accessibility_settings || {};
      setPerfSettings({
        perfAccuracy: settings.perfAccuracy ?? true,
        perfTime: settings.perfTime ?? true,
        perfSubject: settings.perfSubject ?? true,
        perfWeak: settings.perfWeak ?? true,
        perfRank: settings.perfRank ?? false,
      })
      getUserAnalytics(authProfile.id).then(setUserAnalytics).catch(console.error)
    }
  }, [authProfile?.id])

  const handleDeleteTest = (id) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      deleteTest(id)
      setTests(getTests())
    }
  }

  const initiateStart = (test) => {
    setStartingTest(test)
    const d = test.duration || 3 * 3600
    setCustomHours(Math.floor(d / 3600))
    setCustomMins(Math.floor((d % 3600) / 60))
  }

  const handleStart = () => {
    if (!startingTest) return
    const customDuration = (parseInt(customHours) || 0) * 3600 + (parseInt(customMins) || 0) * 60

    // Reset for fresh attempt if already completed, or resume if not
    const freshTest = startingTest.completed
      ? { ...startingTest, id: `test_${Date.now()}`, answers: {}, completed: false, startedAt: Date.now(), duration: customDuration }
      : { ...startingTest, startedAt: startingTest.startedAt || Date.now(), duration: customDuration }

    setActiveTest(freshTest)
    setPage('pretest')
  }

  const handleViewResult = (test) => {
    setActiveTest(test)
    setPage('analysis')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700 }}>
            My Tests
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 3 }}>
            Upload PDFs to generate tests and start your practice
          </p>
        </div>
        <button onClick={() => setPage('upload')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
          border: 'none', borderRadius: 12, padding: '12px 22px', cursor: 'pointer',
          fontWeight: 700, fontSize: 14
        }}>
          <Upload size={16} /> Upload PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Daily Questions</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>
              {tests.filter(t => t.completed).reduce((acc, t) => acc + (Object.keys(t.answers || {}).length), 0) % (settings.dailyGoal || 50)}
            </span>
            <span style={{ fontSize: 16, color: 'var(--muted)' }}>/ {settings.dailyGoal || 50}</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, ((tests.filter(t => t.completed).reduce((acc, t) => acc + (Object.keys(t.answers || {}).length), 0) % (settings.dailyGoal || 50)) / (settings.dailyGoal || 50)) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Daily Study Time</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>
              {(tests.filter(t => t.completed).reduce((acc, t) => acc + (t.duration || 3600), 0) / 3600 % (settings.dailyTimeGoal || 2)).toFixed(1)}h
            </span>
            <span style={{ fontSize: 16, color: 'var(--muted)' }}>/ {settings.dailyTimeGoal || 2}h</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (((tests.filter(t => t.completed).reduce((acc, t) => acc + (t.duration || 3600), 0) / 3600) % (settings.dailyTimeGoal || 2)) / (settings.dailyTimeGoal || 2)) * 100)}%`, height: '100%', background: 'var(--green)', borderRadius: 3 }} />
          </div>
        </div>
        {perfSettings?.perfAccuracy && userAnalytics && (
          <div style={{ flex: 1, minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Overall Accuracy</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>
                {userAnalytics.overall.attempted > 0 ? Math.round((userAnalytics.overall.correct / userAnalytics.overall.attempted) * 100) : 0}%
              </span>
              <Target size={20} color="var(--accent2)" style={{ transform: 'translateY(2px)' }} />
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${userAnalytics.overall.attempted > 0 ? Math.round((userAnalytics.overall.correct / userAnalytics.overall.attempted) * 100) : 0}%`, height: '100%', background: 'var(--accent2)', borderRadius: 3 }} />
            </div>
          </div>
        )}
      </div>

      {tests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <FileText size={48} color="var(--border)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 8, color: '#94a3b8' }}>
            No tests uploaded yet
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
            Upload your first PDF to generate a practice test.
          </p>
          <button onClick={() => setPage('upload')} style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
            border: 'none', borderRadius: 12, padding: '12px 28px', cursor: 'pointer',
            fontWeight: 600, fontSize: 15
          }}>Upload First Test →</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {tests.map(test => {
            const qCount = test.questions?.length || 0
            const scorePct = test.completed ? Math.round((test.finalScore / test.maxScore) * 100) : null
            return (
              <div key={test.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{test.name}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
                    <span>{qCount} Questions</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} />
                      {test.duration ? `${Math.floor(test.duration / 3600)}h ${Math.floor((test.duration % 3600) / 60)}m` : '3h 0m'}
                    </span>
                    {test.completed && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)' }}>
                        <CheckCircle size={13} /> Completed — {scorePct}%
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {test.completed && (
                    <button onClick={() => handleViewResult(test)} style={{
                      padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 13
                    }}>View Result</button>
                  )}
                  <button onClick={() => initiateStart(test)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
                    cursor: 'pointer', fontWeight: 700, fontSize: 13
                  }}>
                    <Play size={14} /> {test.completed ? 'Retake' : 'Start Test'}
                  </button>
                  <button onClick={() => handleDeleteTest(test.id)} title="Delete test" style={{
                    background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8
                  }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Custom Timer Modal for Students */}
      {startingTest && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <Clock size={40} color="var(--accent)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 20, marginBottom: 8 }}>Set Your Time Limit</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
              Customize how much time you want to allow yourself for this attempt.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Hours</label>
                <input
                  type="number" min="0"
                  value={customHours}
                  onChange={e => setCustomHours(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', background: 'var(--surface2)',
                    border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
                    fontSize: 14, outline: 'none'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Mins</label>
                <input
                  type="number" min="0" max="59"
                  value={customMins}
                  onChange={e => setCustomMins(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', background: 'var(--surface2)',
                    border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
                    fontSize: 14, outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStartingTest(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleStart} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Start Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
