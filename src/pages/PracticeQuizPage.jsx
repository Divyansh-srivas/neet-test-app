import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, ChevronRight, AlertTriangle, Clock, BarChart3 } from 'lucide-react';
import MathText from '../components/MathText';

export default function PracticeQuizPage({ questions, notices, timed, timerMins, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: 'A' | 'B' | 'C' | 'D' | null }
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timed ? timerMins * 60 : null);
  const [ended, setEnded] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const timerRef = useRef(null);

  const currentQ = questions[idx];
  const answered = currentQ && answers[currentQ.id] !== undefined;
  const selectedOption = currentQ ? answers[currentQ.id] : null;

  // ── Timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (!timed || timeLeft === null) return;
    if (timeLeft <= 0) { endQuiz(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timed, timeLeft]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const timerColor = !timed ? null : timeLeft < 60 ? '#ef4444' : timeLeft < 180 ? '#f59e0b' : '#10b981';

  // ── Answer selection ───────────────────────────────────────
  const handleAnswer = (opt) => {
    if (answered) return;
    setAnswers(p => ({ ...p, [currentQ.id]: opt }));
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (idx + 1 >= questions.length) {
      endQuiz();
    } else {
      setIdx(i => i + 1);
    }
  };

  const endQuiz = () => {
    clearTimeout(timerRef.current);
    setEnded(true);
    setConfirmEnd(false);
    onFinish(answers);
  };

  // ── Option styling ─────────────────────────────────────────
  const getOptionStyle = (opt) => {
    const base = {
      width: '100%', textAlign: 'left', padding: '14px 20px', borderRadius: 12,
      border: '1.5px solid', cursor: answered ? 'default' : 'pointer',
      display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'all 0.18s',
      fontSize: 15, lineHeight: 1.5
    };
    if (!answered) {
      return { ...base, background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' };
    }
    if (opt === currentQ.correct_option) {
      return { ...base, background: 'rgba(16,185,129,0.12)', borderColor: '#10b981', color: 'var(--text)' };
    }
    if (opt === selectedOption) {
      return { ...base, background: 'rgba(239,68,68,0.12)', borderColor: '#ef4444', color: 'var(--text)' };
    }
    return { ...base, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)', opacity: 0.6 };
  };

  const getOptionLabel = (opt) => {
    if (!answered) return <span style={{ minWidth: 22, height: 22, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{opt}</span>;
    if (opt === currentQ.correct_option) return <CheckCircle size={22} color="#10b981" style={{ flexShrink: 0 }} />;
    if (opt === selectedOption) return <XCircle size={22} color="#ef4444" style={{ flexShrink: 0 }} />;
    return <span style={{ minWidth: 22, height: 22, borderRadius: 6, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{opt}</span>;
  };

  if (ended) return null; // parent handles summary

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Practice Quiz</div>
          <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>
            Question {idx + 1} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>of {questions.length}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, maxWidth: 300, margin: '0 24px' }}>
          <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((idx + 1) / questions.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{Object.keys(answers).length} answered</span>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{questions.length - Object.keys(answers).length} remaining</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {timed && timeLeft !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--surface2)', borderRadius: 8, border: `1px solid ${timerColor}` }}>
              <Clock size={15} color={timerColor} />
              <span style={{ color: timerColor, fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(timeLeft)}</span>
            </div>
          )}
          <button onClick={() => setConfirmEnd(true)} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            End Quiz
          </button>
        </div>
      </div>

      {/* Subject tag if question has one */}
      {currentQ?._subject && (
        <div style={{ padding: '12px 28px 0', display: 'flex', gap: 8 }}>
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', background: 'var(--surface2)', color: 'var(--muted)' }}>{currentQ._subject}</span>
        </div>
      )}

      {/* Question Content */}
      <div style={{ flex: 1, maxWidth: 780, width: '100%', margin: '0 auto', padding: '28px 24px' }}>
        {/* Notices */}
        {idx === 0 && notices?.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notices.map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, color: '#fbbf24', fontSize: 13 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {n}
              </div>
            ))}
          </div>
        )}

        {/* Question text */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '24px 28px', marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text)', fontSize: 17, lineHeight: 1.7 }}>
            <MathText text={currentQ?.question_text || ''} />
          </div>
          {currentQ?.image_url && (
            <img src={currentQ.image_url} alt="Question diagram" style={{ marginTop: 20, maxWidth: '100%', maxHeight: 300, borderRadius: 10, border: '1px solid var(--border)' }} />
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {['A', 'B', 'C', 'D'].map(opt => (
            <button key={opt} onClick={() => handleAnswer(opt)} style={getOptionStyle(opt)}>
              {getOptionLabel(opt)}
              <span><MathText text={currentQ?.[`option_${opt.toLowerCase()}`] || ''} /></span>
            </button>
          ))}
        </div>

        {/* Explanation — visible immediately after answering */}
        {answered && currentQ?.explanation && (
          <div style={{ padding: '18px 22px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, marginBottom: 20 }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Explanation</div>
            <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }}>
              <MathText text={currentQ.explanation} />
            </div>
          </div>
        )}

        {/* Result feedback line */}
        {answered && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedOption === currentQ.correct_option ? (
                <><CheckCircle size={20} color="#10b981" /><span style={{ color: '#10b981', fontWeight: 700, fontSize: 15 }}>Correct!</span></>
              ) : (
                <><XCircle size={20} color="#ef4444" /><span style={{ color: '#ef4444', fontWeight: 700, fontSize: 15 }}>Incorrect — correct answer: <strong>{currentQ.correct_option}</strong></span></>
              )}
            </div>
            <button onClick={handleNext} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15
            }}>
              {idx + 1 >= questions.length ? <><BarChart3 size={18} /> View Results</> : <>Next Question <ChevronRight size={18} /></>}
            </button>
          </div>
        )}
      </div>

      {/* Confirm End Modal */}
      {confirmEnd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 32, maxWidth: 420, width: '90%', border: '1px solid var(--border)' }}>
            <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: 16 }} />
            <h3 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>End Quiz Early?</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              You still have {questions.length - idx - 1} question{questions.length - idx - 1 !== 1 ? 's' : ''} left. Remaining questions will be marked as unattempted.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmEnd(false)} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={endQuiz} style={{ flex: 1, padding: '12px', background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>End Quiz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
