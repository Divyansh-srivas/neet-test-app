import React, { useMemo, useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Trophy, Target, Clock, TrendingUp, Bookmark, AlertTriangle } from 'lucide-react'
import { toggleBookmark, isBookmarked } from '../utils/storage'
import { getTestRanking, getUserAnalytics } from '../api/performance'
import { useAuth } from '../utils/useAuth'
import PdfImageCropper from '../components/PdfImageCropper'

const card = (style = {}) => ({ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, ...style })
const PIE_COLORS = ['var(--green)', 'var(--red)', 'var(--border)']
const SUB_COLORS = { physics: 'var(--accent)', chemistry: 'var(--green)', biology: 'var(--yellow)' }

export default function AnalysisPage({ test, setPage }) {
  const { profile: authProfile } = useAuth()
  const [perfSettings, setPerfSettings] = useState(null)
  const [rankings, setRankings] = useState(null)
  const [weakAreas, setWeakAreas] = useState([])

  const stats = useMemo(() => {
    if (!test) return null
    const subjects = { physics: { correct: 0, wrong: 0, skipped: 0, total: 0, score: 0 }, chemistry: { correct: 0, wrong: 0, skipped: 0, total: 0, score: 0 }, biology: { correct: 0, wrong: 0, skipped: 0, total: 0, score: 0 } }
    let total = { correct: 0, wrong: 0, skipped: 0, score: 0, max: 0 }

    test.questions?.forEach(q => {
      const sub = q.subject?.toLowerCase() || 'physics'
      const s = subjects[sub] || subjects.physics
      s.total++; total.max += 4
      const ans = test.answers?.[q.id]
      if (ans === undefined) { s.skipped++; total.skipped++ }
      else if (ans === q.correct) { s.correct++; total.correct++; s.score += 4; total.score += 4 }
      else { s.wrong++; total.wrong++; s.score -= 1; total.score -= 1 }
    })
    return { subjects, total, questions: test.questions, answers: test.answers }
  }, [test])

  useEffect(() => {
    if (authProfile?.id && stats) {
      const settings = authProfile.accessibility_settings || {};
      setPerfSettings({
        perfAccuracy: settings.perfAccuracy ?? true,
        perfTime: settings.perfTime ?? true,
        perfSubject: settings.perfSubject ?? true,
        perfWeak: settings.perfWeak ?? true,
        perfRank: settings.perfRank ?? false,
      })
      // Pass the actual test ID. If it's a generated ID starting with "test_", it might not be in DB yet depending on when it was saved.
      // But we will query it anyway.
      getTestRanking(test.id, stats.total.score).then(setRankings).catch(console.error)

      // Get historical weak areas
      getUserAnalytics(authProfile.id).then(data => {
        setWeakAreas(data.weakAreas || [])
      }).catch(console.error)
    }
  }, [authProfile?.id, stats, test?.id])

  if (!stats) return <div style={{ padding: 40, color: 'var(--muted)' }}>No test data found.</div>

  const { subjects, total } = stats
  const pct = (v, t) => t > 0 ? Math.round((v / t) * 100) : 0
  const accuracy = pct(total.correct, total.correct + total.wrong)

  const pieData = [
    { name: 'Correct', value: total.correct },
    { name: 'Wrong', value: total.wrong },
    { name: 'Skipped', value: total.skipped },
  ]

  const barData = ['physics', 'chemistry', 'biology'].map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    Correct: subjects[s].correct,
    Wrong: subjects[s].wrong,
    Skipped: subjects[s].skipped,
  }))

  const timeTaken = test.timeTaken || test.duration || 0 // duration might be custom duration, actually time_taken is the accurate one
  const actualTimeTaken = test.timeTaken || 0;
  const timeStr = `${Math.floor(actualTimeTaken / 3600)}h ${Math.floor((actualTimeTaken % 3600) / 60)}m`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700 }}>Test Analysis</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 3 }}>{test.name}</p>
        </div>
        <button onClick={() => setPage('upload')} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
          + New Test
        </button>
      </div>

      {/* Score Hero */}
      <div style={{ ...card({ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, transparent), color-mix(in srgb, var(--accent2) 13%, transparent))', borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }), textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#a5b4fc', marginBottom: 8, fontWeight: 600 }}>FINAL SCORE</div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 56, fontWeight: 700, color: total.score >= 0 ? '#a5b4fc' : 'var(--red)', lineHeight: 1 }}>{total.score}</div>
        <div style={{ color: 'var(--muted)', fontSize: 16, marginTop: 4 }}>out of {total.max}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            ...(perfSettings?.perfAccuracy ? [{ label: 'Accuracy', value: `${accuracy}%`, color: 'var(--green)' }] : []),
            { label: 'Correct', value: total.correct, color: 'var(--green)' },
            { label: 'Wrong', value: total.wrong, color: 'var(--red)' },
            { label: 'Skipped', value: total.skipped, color: 'var(--muted)' },
            ...(perfSettings?.perfTime ? [{ label: 'Time Taken', value: timeStr, color: 'var(--yellow)' }] : []),
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {perfSettings?.perfWeak && weakAreas.length > 0 && (
        <div style={{ ...card({ background: 'color-mix(in srgb, var(--red) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--red) 25%, transparent)' }), marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>AI Weak Area Prediction</h3>
          <p style={{ fontSize: 13, color: 'var(--text)' }}>
            Based on your historical performance, you should focus on revising <strong>{weakAreas.map(w => w.topic).join(', ')}</strong> before your next attempt.
          </p>
        </div>
      )}

      {perfSettings?.perfRank && rankings && (
        <div style={{ ...card({ background: 'color-mix(in srgb, var(--yellow) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--yellow) 25%, transparent)' }), marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, color: 'var(--yellow)', marginBottom: 8 }}>Rank Comparison</h3>
          <p style={{ fontSize: 13, color: 'var(--text)' }}>Your score places you in the <strong>Top {100 - rankings.percentile}%</strong> of students who took this mock test.</p>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: perfSettings?.perfSubject ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
        <div style={card()}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Overall Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }} itemStyle={{ color: 'var(--text)' }} />
              <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {perfSettings?.perfSubject && (
          <div style={card()}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Subject-wise</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} barSize={12}>
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }} itemStyle={{ color: 'var(--text)' }} />
                <Bar dataKey="Correct" fill="var(--green)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Wrong" fill="var(--red)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Skipped" fill="var(--border)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Subject Cards */}
      {perfSettings?.perfSubject && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {['physics', 'chemistry', 'biology'].map(sub => {
            const s = subjects[sub]
            const color = SUB_COLORS[sub]
            const acc = pct(s.correct, s.correct + s.wrong)
            return (
              <div key={sub} style={{ ...card(), borderColor: `${color}40` }}>
                <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{sub}</div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 700, color: s.score >= 0 ? color : 'var(--red)' }}>{s.score > 0 ? '+' : ''}{s.score}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Score · {s.total} questions</div>
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--green)' }}>✓{s.correct}</span>
                  <span style={{ color: 'var(--red)' }}>✗{s.wrong}</span>
                  <span style={{ color: 'var(--muted)' }}>—{s.skipped}</span>
                </div>
                <div style={{ marginTop: 8, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${acc}%`, background: color, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{acc}% accuracy</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Question Review */}
      <div style={card()}>
        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Question Review</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {test.questions?.map((q, i) => {
            const ans = test.answers?.[q.id]
            const isCorrect = ans === q.correct
            const isSkipped = ans === undefined
            const color = isSkipped ? 'var(--muted)' : isCorrect ? 'var(--green)' : 'var(--red)'
            const bkd = isBookmarked(q.id)

            return (
              <div key={q.id} style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 12, borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Q{i + 1}</span>
                      <span style={{ fontSize: 11, color: SUB_COLORS[q.subject?.toLowerCase()] || '#a5b4fc', background: `${SUB_COLORS[q.subject?.toLowerCase()] || 'var(--accent)'}20`, padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>{q.subject}</span>
                      <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                        {isSkipped ? 'Skipped' : isCorrect ? '+4' : '-1'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{q.question?.slice(0, 120)}{q.question?.length > 120 ? '...' : ''}</p>
                    {q.imageUrl ? (
                      <div style={{ marginTop: 8 }}>
                        <img src={q.imageUrl} alt="Diagram" style={{ maxHeight: 120, borderRadius: 4, border: '1px solid var(--border)' }} />
                      </div>
                    ) : (q.imageBox && (q.pdfUrl || test.pdfUrl || test.pdf_url)) ? (
                      <div style={{ marginTop: 8 }}>
                        <PdfImageCropper 
                          pdfUrl={q.pdfUrl || test.pdfUrl || test.pdf_url} 
                          pageNum={q.imageBox.page} 
                          box={q.imageBox.box} 
                        />
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>Your answer: <span style={{ color: isSkipped ? 'var(--muted)' : isCorrect ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{ans || 'Not attempted'}</span></span>
                      {!isCorrect && <span style={{ color: 'var(--muted)' }}>Correct: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{q.correct}</span></span>}
                    </div>
                    {q.explanation && !isSkipped && !isCorrect && (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: '#94a3b8' }}>
                        💡 {q.explanation}
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleBookmark(q)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bkd ? 'var(--yellow)' : 'var(--muted)', flexShrink: 0, padding: 4 }}>
                    <Bookmark size={16} fill={bkd ? 'var(--yellow)' : 'none'} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
