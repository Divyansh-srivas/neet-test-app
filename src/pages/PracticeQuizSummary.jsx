import React, { useMemo } from 'react';
import { CheckCircle, XCircle, Minus, BarChart3, RotateCcw, BookOpen } from 'lucide-react';
import MathText from '../components/MathText';

export default function PracticeQuizSummary({ questions, answers, onBack, onRetryWrong }) {
  const stats = useMemo(() => {
    let correct = 0, incorrect = 0, unattempted = 0;
    const wrongQs = [];
    questions.forEach(q => {
      const ans = answers[q.id];
      if (!ans) {
        unattempted++;
        wrongQs.push({ q, ans: null, status: 'unattempted' });
      } else if (ans === q.correct_option) {
        correct++;
      } else {
        incorrect++;
        wrongQs.push({ q, ans, status: 'incorrect' });
      }
    });
    return { correct, incorrect, unattempted, wrongQs, total: questions.length };
  }, [questions, answers]);

  const pct = Math.round((stats.correct / stats.total) * 100);

  const scoreColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>
            {pct >= 70 ? '🎉' : pct >= 40 ? '📚' : '💪'}
          </div>
          <h1 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Practice Complete!</h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>Here's how you did</p>
        </div>

        {/* Score card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 32px', marginBottom: 24, display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Big score circle */}
          <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
            <svg viewBox="0 0 110 110" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="55" cy="55" r="48" fill="none" stroke="var(--surface2)" strokeWidth="8" />
              <circle cx="55" cy="55" r="48" fill="none" stroke={scoreColor} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 48}`}
                strokeDashoffset={`${2 * Math.PI * 48 * (1 - pct / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: scoreColor, fontWeight: 900, fontSize: 24 }}>{pct}%</span>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>Score</span>
            </div>
          </div>

          {/* Stat boxes */}
          <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
            {[
              { label: 'Correct',     val: stats.correct,     color: '#10b981', icon: CheckCircle },
              { label: 'Incorrect',   val: stats.incorrect,   color: '#ef4444', icon: XCircle     },
              { label: 'Unattempted', val: stats.unattempted, color: '#64748b', icon: Minus        },
              { label: 'Total',       val: stats.total,       color: 'var(--text)',  icon: BarChart3   },
            ].map(({ label, val, color, icon: Icon }) => (
              <div key={label} style={{ flex: '1 1 100px', padding: '16px', background: 'var(--surface2)', borderRadius: 12, textAlign: 'center' }}>
                <Icon size={20} color={color} style={{ marginBottom: 6 }} />
                <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: 24 }}>{val}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Review section */}
        {stats.wrongQs.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              Review — Incorrect & Unattempted ({stats.wrongQs.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stats.wrongQs.map(({ q, ans, status }, i) => (
                <div key={q.id} style={{ background: 'var(--surface)', border: `1px solid ${status === 'incorrect' ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`, borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      {status === 'incorrect' ? <XCircle size={18} color="#ef4444" /> : <Minus size={18} color="#64748b" />}
                      <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Q{i + 1} · {status === 'incorrect' ? 'Incorrect' : 'Unattempted'}
                        {q._subject ? ` · ${q._subject}` : ''}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: 15, lineHeight: 1.7 }}>
                      <MathText text={q.question_text} />
                    </div>
                    {q.image_url && <img src={q.image_url} alt="Diagram" style={{ marginTop: 12, maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid var(--border)' }} />}
                  </div>
                  <div style={{ padding: '14px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {ans && (
                      <div>
                        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Answer</div>
                        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>
                          {ans}) <MathText text={q[`option_${ans.toLowerCase()}`] || ''} />
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correct Answer</div>
                      <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>
                        {q.correct_option}) <MathText text={q[`option_${q.correct_option.toLowerCase()}`] || ''} />
                      </div>
                    </div>
                  </div>
                  {q.explanation && (
                    <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.06)', borderTop: '1px solid rgba(99,102,241,0.15)' }}>
                      <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Explanation</div>
                      <div style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.7 }}>
                        <MathText text={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ flex: '1 1 200px', padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <BookOpen size={18} /> Back to Library
          </button>
          {stats.wrongQs.filter(w => w.status === 'incorrect').length > 0 && onRetryWrong && (
            <button onClick={onRetryWrong} style={{ flex: '1 1 200px', padding: '14px', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', border: 'none', color: 'white', borderRadius: 12, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <RotateCcw size={18} /> Retry Incorrect Only ({stats.wrongQs.filter(w => w.status === 'incorrect').length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
