import React, { useState, useEffect } from 'react'
import { getProfile, saveProfile } from '../utils/storage'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import { User, Edit2, Save, Trophy, Target, TrendingUp, BookOpen, Clock, AlertTriangle, Award } from 'lucide-react'
import { getPerformanceSettings, getUserAnalytics, getRankings } from '../api/performance'
import { useAuth } from '../utils/useAuth'

const card = (style = {}) => ({ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, ...style })

export default function ProfilePage() {
  const { profile: authProfile, updateProfile } = useAuth()
  const [profile, setProfile] = useState({ target: 'NEET 2025', avatar: null })
  const [analytics, setAnalytics] = useState(null)
  const [tests, setTests] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', target: 'NEET 2025' })
  
  const [perfSettings, setPerfSettings] = useState(null)
  const [rankings, setRankings] = useState(null)

  useEffect(() => {
    if (authProfile) {
      setForm(p => ({ ...p, name: authProfile.full_name || '' }))
    }
  }, [authProfile])

  useEffect(() => {
    if (authProfile?.id) {
      getPerformanceSettings(authProfile.id).then(setPerfSettings).catch(console.error)
      getUserAnalytics(authProfile.id).then(data => {
        setAnalytics(data)
        setTests(data.tests || [])
      }).catch(console.error)
      getRankings(authProfile.id).then(setRankings).catch(console.error)
    }
  }, [authProfile?.id])

  const handleSave = async () => {
    if (authProfile?.id && updateProfile) {
      // Optimistic update of local form target if any
      setProfile(p => ({ ...p, target: form.target }))
      setEditing(false)
      
      // Update global context & DB without refreshing
      await updateProfile({ full_name: form.name })
    } else {
      setEditing(false)
    }
  }

  const pct = (v, t) => t > 0 ? Math.round((v / t) * 100) : 0

  const radarData = analytics ? [
    { subject: 'Physics', score: pct(analytics.subjects.physics.correct, analytics.subjects.physics.total) },
    { subject: 'Chemistry', score: pct(analytics.subjects.chemistry.correct, analytics.subjects.chemistry.total) },
    { subject: 'Biology', score: pct(analytics.subjects.biology.correct, analytics.subjects.biology.total) },
  ] : []

  const lineData = tests.slice().reverse().map((t, i) => ({
    name: `T${i + 1}`,
    Score: t.finalScore,
    Max: t.maxScore,
    Pct: pct(t.finalScore, t.maxScore),
  }))

  const formatTime = (secs) => {
    if (!secs) return '0s';
    if (secs < 60) return `${Math.round(secs)}s`;
    return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  }

  return (
    <div>
      {/* Profile Header */}
      <div style={{ ...card({ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent), color-mix(in srgb, var(--accent2) 8%, transparent))', borderColor: 'color-mix(in srgb, var(--accent) 19%, transparent)' }), marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={28} color="white" />
          </div>
          {editing ? (
            <div style={{ flex: 1, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name"
                style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontWeight: 600, flex: 1 }} />
              <input value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} placeholder="Target exam"
                style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, flex: 1 }} />
              <button onClick={handleSave} style={{ padding: '10px 18px', background: 'linear-gradient(135deg,var(--accent),var(--accent2))', border: 'none', borderRadius: 10, color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={15} /> Save
              </button>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 700 }}>{authProfile?.full_name || 'Student'}</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>🎯 {profile.target}</p>
            </div>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Edit2 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {!analytics || !perfSettings ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          <Trophy size={40} color="var(--border)" style={{ margin: '0 auto 12px' }} />
          <p>Complete some tests to see your scorecard!</p>
        </div>
      ) : (
        <>
          {/* Rank Section */}
          {perfSettings.perfRank && rankings && (
            <div style={{ ...card({ background: 'color-mix(in srgb, var(--yellow) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--yellow) 25%, transparent)', padding: 24 }), marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700, color: 'var(--yellow)', marginBottom: 4 }}>Platform Ranking</h3>
                <p style={{ color: '#fcd34d', fontSize: 14, margin: 0 }}>You are in the top {100 - rankings.percentile}% of all students.</p>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 600, textTransform: 'uppercase' }}>Percentile</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 700, color: 'white' }}>{rankings.percentile}th</div>
                </div>
                <div style={{ width: 1, background: 'color-mix(in srgb, var(--yellow) 19%, transparent)' }}></div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 600, textTransform: 'uppercase' }}>Overall Rank</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 700, color: 'white' }}>#{rankings.rank}</div>
                </div>
              </div>
            </div>
          )}

          {/* Overall Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={card()}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 13%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <BookOpen size={15} color="var(--accent)" />
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700 }}>{analytics.testCount}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Tests Done</div>
            </div>
            
            <div style={card()}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--yellow) 13%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Trophy size={15} color="var(--yellow)" />
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700 }}>{analytics.overall.score}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Total Score</div>
            </div>

            {perfSettings.perfAccuracy && (
              <div style={card()}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--green) 13%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Target size={15} color="var(--green)" />
                </div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700 }}>{pct(analytics.overall.correct, analytics.overall.attempted)}%</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Avg Accuracy</div>
              </div>
            )}

            <div style={card()}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent2) 13%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <TrendingUp size={15} color="var(--accent2)" />
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700 }}>{analytics.overall.attempted}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Qs Attempted</div>
            </div>
          </div>

          {/* Time Analysis */}
          {perfSettings.perfTime && (
            <div style={{ ...card(), marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Clock size={18} color="var(--yellow)" />
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600 }}>Time Analysis</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Total Time Spent</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{formatTime(analytics.overall.totalTime)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>Avg Time / Question</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {formatTime(analytics.overall.totalTime / Math.max(analytics.overall.attempted, 1))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Weak Areas */}
          {perfSettings.perfWeak && analytics.weakAreas?.length > 0 && (
            <div style={{ ...card({ background: 'color-mix(in srgb, var(--red) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--red) 19%, transparent)' }), marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <AlertTriangle size={18} color="var(--red)" />
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, color: 'var(--red)' }}>Identified Weak Areas</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analytics.weakAreas.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', padding: '12px 16px', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{w.topic}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Subject: {w.subject} · {w.mistakes} mistakes</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: w.accuracy < 40 ? 'var(--red)' : 'var(--yellow)' }}>{w.accuracy}%</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Accuracy</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: perfSettings.perfSubject ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
            {perfSettings.perfSubject && (
              <div style={card()}>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Subject Mastery</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                    <Radar dataKey="score" stroke="var(--accent2)" fill="var(--accent2)" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={card()}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Score Trend</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={lineData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }} itemStyle={{ color: 'var(--text)' }} />
                  <Line type="monotone" dataKey="Pct" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 4 }} name="Score %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Averages */}
          {perfSettings.perfSubject && (
            <div style={{ ...card(), marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Subject-wise Average</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  { sub: 'Physics', color: 'var(--accent)', data: analytics.subjects.physics },
                  { sub: 'Chemistry', color: 'var(--green)', data: analytics.subjects.chemistry },
                  { sub: 'Biology', color: 'var(--yellow)', data: analytics.subjects.biology },
                ].map(({ sub, color, data }) => {
                  const avg = pct(data.correct, data.total)
                  return (
                    <div key={sub} style={{ textAlign: 'center', padding: '16px 12px', background: 'var(--surface2)', borderRadius: 12 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 700, color }}>{avg}%</div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>{sub}</div>
                      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${avg}%`, background: color, borderRadius: 2 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8, fontSize: 12 }}>
                        <span style={{ color: 'var(--green)' }}>✓{data.correct}</span>
                        <span style={{ color: 'var(--red)' }}>✗{data.wrong}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All Tests Table */}
          <div style={card()}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>All Attempted Tests</h3>
            {tests.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No completed tests yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Test Name', 'Date', 'Score', ...(perfSettings.perfAccuracy ? ['Accuracy'] : []), ...(perfSettings.perfSubject ? ['Phy', 'Chem', 'Bio'] : [])].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((testAttempt, i) => {
                      const test = testAttempt.tests || testAttempt; 
                      // Wait, getUserAnalytics returns tests mapped slightly differently?
                      // Let's assume test is the attempts row and test.tests is the test data
                      const answers = testAttempt.answers || {};
                      const finalScore = testAttempt.final_score || testAttempt.score || 0;
                      const maxScore = testAttempt.max_score || testAttempt.maxScore || 0;
                      
                      const subStats = { physics: { c: 0, t: 0 }, chemistry: { c: 0, t: 0 }, biology: { c: 0, t: 0 } }
                      test.questions?.forEach(q => {
                        const s = q.subject?.toLowerCase()
                        if (subStats[s]) { subStats[s].t++; if (answers?.[q.id] === q.correct) subStats[s].c++ }
                      })
                      const acc = pct(test.questions?.filter(q => answers?.[q.id] === q.correct).length || 0, Object.keys(answers).length)
                      const scoreColor = pct(finalScore, maxScore) >= 60 ? 'var(--green)' : pct(finalScore, maxScore) >= 40 ? 'var(--yellow)' : 'var(--red)'
                      return (
                        <tr key={testAttempt.id} style={{ borderBottom: '1px solid var(--surface2)' }}>
                          <td style={{ padding: '10px 10px', color: '#e2e8f0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.name}</td>
                          <td style={{ padding: '10px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(testAttempt.completed_at || testAttempt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td style={{ padding: '10px 10px', fontWeight: 700, color: scoreColor }}>{finalScore}/{maxScore}</td>
                          {perfSettings.perfAccuracy && <td style={{ padding: '10px 10px', color: '#94a3b8' }}>{acc}%</td>}
                          {perfSettings.perfSubject && (
                            <>
                              <td style={{ padding: '10px 10px', color: '#a5b4fc' }}>{pct(subStats.physics.c, subStats.physics.t)}%</td>
                              <td style={{ padding: '10px 10px', color: '#6ee7b7' }}>{pct(subStats.chemistry.c, subStats.chemistry.t)}%</td>
                              <td style={{ padding: '10px 10px', color: '#fcd34d' }}>{pct(subStats.biology.c, subStats.biology.t)}%</td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
