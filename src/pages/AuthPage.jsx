import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/useAuth.jsx'
import { Mail, User, GraduationCap, BookOpen, X, Sparkles, ArrowRight, Send, CheckCircle, RotateCcw } from 'lucide-react'
import bgImage from '../assets/bg.jpg'
import logoImg from '../assets/logo.jpg'

const QUOTES = [
  "Success is not final, failure is not fatal. - Winston Churchill",
  "The capacity to learn is a gift, the ability to learn is a skill, but the willingness to learn is a choice. - Brian Herbert",
  "Education is the most powerful weapon which you can use to change the world. - Nelson Mandela",
  "Knowledge is power. - Francis Bacon",
  "The beautiful thing about learning is that no one can take it away from you. - B.B. King",
  "Your limitation—it's only your imagination. Push yourself!",
  "Learning never exhausts the mind. - Leonardo da Vinci"
]

export default function AuthPage() {
  const { sendEmailLink } = useAuth()
  const [page, setPage] = useState('landing')
  const [form, setForm] = useState({ email: '', fullName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQuote, setShowQuote] = useState(true)
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)])

  const [linkSent, setLinkSent] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resendCount, setResendCount] = useState(0)
  const [isResending, setIsResending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const resetForm = (newPage) => {
    setPage(newPage)
    setError('')
    setSuccessMsg('')
    setForm({ email: '', fullName: '' })
    setLinkSent(false)
    setResendCountdown(0)
    setResendCount(0)
    sessionStorage.removeItem('emailLinkSentFlag')
    sessionStorage.removeItem('emailLinkResendExpiry')
    sessionStorage.removeItem('emailLinkResendCount')
  }

  const openGmailSupport = () => {
    const subject = 'Login Help Request'
    const body = `Hello Neogravix Support Team,\n\nI am having trouble accessing my account.\n\nRegistered Email:\n\nIssue Description:\n\nBrowser:\nDevice:\n\nThank you.`
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=Neogravix@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    const w = window.open(gmailUrl, '_blank', 'noopener,noreferrer')
    if (!w || w.closed || typeof w.closed === 'undefined') {
      window.location.href = `mailto:Neogravix@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setShowQuote(false), 5000)
    return () => clearTimeout(t)
  }, [])

  // Restore state if user navigates back to login page
  useEffect(() => {
    if (page === 'login') {
      const savedEmail = sessionStorage.getItem('emailForSignIn')
      const savedFlag = sessionStorage.getItem('emailLinkSentFlag')
      const savedExpiry = sessionStorage.getItem('emailLinkResendExpiry')
      const savedCount = sessionStorage.getItem('emailLinkResendCount')
      if (savedCount) setResendCount(parseInt(savedCount, 10))
      if (savedFlag === 'true' && savedEmail) {
        setForm(p => ({ ...p, email: savedEmail }))
        setLinkSent(true)
      }
      if (savedExpiry) {
        const rem = Math.floor((parseInt(savedExpiry, 10) - Date.now()) / 1000)
        if (rem > 0) setResendCountdown(rem)
      }
    }
  }, [page])

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) { sessionStorage.removeItem('emailLinkResendExpiry'); return }
    const t = setInterval(() => setResendCountdown(p => p - 1), 1000)
    return () => clearInterval(t)
  }, [resendCountdown])

  const startResendTimer = (secs = 60) => {
    setResendCountdown(secs)
    sessionStorage.setItem('emailLinkResendExpiry', (Date.now() + secs * 1000).toString())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    const { error } = await sendEmailLink(form.email.trim())
    if (error) {
      setError(error.message)
    } else {
      setLinkSent(true)
      startResendTimer()
      sessionStorage.setItem('emailLinkSentFlag', 'true')
      if (form.fullName.trim()) sessionStorage.setItem('emailSignInName', form.fullName.trim())
    }
    setLoading(false)
  }

  const handleResend = async () => {
    if (resendCount >= 5) { setError('Maximum resend limit reached. Please try again later.'); return }
    setIsResending(true)
    setError('')
    setSuccessMsg('')
    const { error } = await sendEmailLink(form.email.trim())
    if (error) {
      setError(error.message)
    } else {
      const n = resendCount + 1
      setResendCount(n)
      sessionStorage.setItem('emailLinkResendCount', n.toString())
      setSuccessMsg('A new sign-in link has been sent!')
      startResendTimer()
    }
    setIsResending(false)
  }

  // ── LANDING PAGE ──────────────────────────────────────────────────────────────
  if (page === 'landing') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        backgroundImage: `url(${bgImage})`, backgroundSize: 'cover',
        backgroundPosition: 'center', backgroundAttachment: 'fixed',
        position: 'relative', overflow: 'auto'
      }}>
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '100vh',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          pointerEvents: 'none', zIndex: 1
        }} />

        {showQuote && (
          <div style={{
            position: 'fixed', top: 30, left: 30, right: 30, maxWidth: 500,
            background: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24,
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)', zIndex: 110
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--surface2)', lineHeight: 1.6, flex: 1, marginRight: 12 }}>
                "{quote}"
              </p>
              <button onClick={() => setShowQuote(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={20} color="var(--muted)" />
              </button>
            </div>
          </div>
        )}

        <div style={{ position: 'fixed', top: 30, right: 30, zIndex: 105 }}>
          <button onClick={() => resetForm('login')} style={{
            padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
            fontWeight: 600, fontSize: 14, boxShadow: '0 10px 30px rgba(59,130,246,0.3)', transition: 'all 0.3s'
          }}>Login</button>
        </div>

        {/* Hero */}
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, position: 'relative', zIndex: 5
        }}>
          <div style={{ textAlign: 'center', maxWidth: 600 }}>
            <img src={logoImg} alt="Neogravix Logo" style={{ display: 'block', width: 80, height: 80, borderRadius: 20, margin: '0 auto 30px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', objectFit: 'cover' }} />
            <h1 style={{ fontSize: 56, fontWeight: 900, color: 'white', marginBottom: 16, fontFamily: 'Space Grotesk', letterSpacing: '-1px' }}>
              Neogravix
            </h1>
            <p style={{ fontSize: 20, color: '#e0e7ff', marginBottom: 32, fontWeight: 500, lineHeight: 1.6 }}>
              Master Your Studies with AI-Powered Preparation
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
              {[{ icon: Sparkles, text: 'Smart Learning' }, { icon: BookOpen, text: 'Rich Content' }, { icon: GraduationCap, text: 'Expert Guidance' }].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: 12,
                  backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <item.icon size={18} color="var(--accent2)" />
                  <span style={{ color: '#e0e7ff', fontWeight: 500 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => resetForm('login')} style={{
              padding: '16px 40px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
              fontWeight: 700, fontSize: 16, boxShadow: '0 15px 40px rgba(59,130,246,0.4)',
              display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.3s'
            }}>
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* About Section */}
        <div style={{ background: 'linear-gradient(135deg, var(--bg) 0%, #1a1f3a 100%)', padding: '80px 20px', position: 'relative', zIndex: 5 }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontSize: 42, fontWeight: 800, color: '#fff', marginBottom: 12, fontFamily: 'Space Grotesk', letterSpacing: '-0.5px' }}>Why Neogravix?</h2>
            <div style={{ width: 100, height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', marginBottom: 40, borderRadius: 2 }} />
            <p style={{ fontSize: 16, color: '#cbd5e1', lineHeight: 1.8, marginBottom: 32, textAlign: 'justify' }}>
              Neogravix is a comprehensive, AI-powered education platform designed to transform how students prepare for competitive exams. With our advanced technology and data-driven approach, we provide personalized learning experiences tailored to each student's unique needs and learning style.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, marginBottom: 32 }}>
              {[
                { title: 'Intelligent Analytics', desc: 'Real-time performance tracking and predictive analysis to identify weak areas and optimize study strategies' },
                { title: 'Expert Content', desc: 'Comprehensive study materials created by top educators and subject matter experts' },
                { title: 'Interactive Learning', desc: 'Engaging practice tests, live doubt sessions, and peer-to-peer learning communities' },
                { title: 'AI-Powered Guidance', desc: 'Personalized study recommendations and adaptive learning paths for maximum efficiency' },
                { title: 'Progress Monitoring', desc: 'Detailed performance reports and milestone tracking to keep you motivated' },
                { title: '24/7 Support', desc: 'Round-the-clock assistance from our expert mentors and AI chatbot' }
              ].map((item, i) => (
                <div key={i} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 16, padding: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent2)', marginBottom: 12 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => resetForm('login')} style={{
                padding: '16px 48px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
                fontWeight: 700, fontSize: 16, boxShadow: '0 15px 40px rgba(59,130,246,0.4)', transition: 'all 0.3s'
              }}>Start Your Journey Today</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(59,130,246,0.2)', padding: '40px 20px', textAlign: 'center', position: 'relative', zIndex: 5 }}>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>© 2026 Neogravix. All rights reserved.</p>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>Empowering students worldwide through intelligent learning</p>
        </div>
      </div>
    )
  }

  // ── LOGIN PAGE ────────────────────────────────────────────────────────────────
  if (page === 'login') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundImage: `url(${bgImage})`, backgroundSize: 'cover',
        backgroundPosition: 'center', backgroundAttachment: 'fixed',
        padding: 20, position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }} />

        <button onClick={() => resetForm('landing')} style={{
          position: 'fixed', top: 30, left: 30, zIndex: 100,
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
          width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)',
          color: 'white', fontSize: 20, fontWeight: 700, transition: 'all 0.3s'
        }}>←</button>

        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <img src={logoImg} alt="Neogravix Logo" style={{ display: 'block', width: 70, height: 70, borderRadius: 16, margin: '0 auto 24px', boxShadow: '0 15px 40px rgba(0,0,0,0.4)', objectFit: 'cover' }} />
            <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>
              Welcome to Neogravix
            </h1>
            <p style={{ color: '#e0e7ff', fontSize: 14, fontWeight: 500 }}>
              {linkSent ? 'Check your inbox to complete sign-in' : 'Log in or create a new account'}
            </p>
          </div>

          {/* Card */}
          <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, padding: 32, backdropFilter: 'blur(10px)' }}>

            {linkSent ? (
              /* ── CHECK INBOX STATE ── */
              <div>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(59,130,246,0.15))',
                    border: '1px solid rgba(34,197,94,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                  }}>
                    <CheckCircle size={34} color="#22c55e" />
                  </div>
                  <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Link Sent!</h2>
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
                    We sent a sign-in link to
                  </p>
                  <p style={{ color: 'var(--accent2)', fontSize: 14, fontWeight: 600, marginTop: 4, wordBreak: 'break-all' }}>
                    {form.email}
                  </p>
                </div>

                {/* Steps */}
                <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                  {[
                    { n: '1', t: 'Open your email inbox' },
                    { n: '2', t: 'Find the email from Neogravix / Firebase' },
                    { n: '3', t: 'Click the "Sign in to Neogravix" link' },
                    { n: '4', t: 'You\'ll be logged in automatically' },
                  ].map(({ n, t }, i, arr) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < arr.length - 1 ? 10 : 0 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: 'white'
                      }}>{n}</div>
                      <span style={{ color: '#cbd5e1', fontSize: 13 }}>{t}</span>
                    </div>
                  ))}
                </div>

                {/* Resend controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {resendCountdown > 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, color: 'var(--muted)', fontSize: 13 }}>
                      Resend in <strong style={{ color: '#94a3b8' }}>{resendCountdown}s</strong>
                    </div>
                  ) : (
                    <button onClick={handleResend} disabled={isResending || resendCount >= 5} style={{
                      width: '100%', padding: '12px', borderRadius: 10,
                      border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)',
                      color: '#93c5fd', fontWeight: 600, fontSize: 14,
                      cursor: (isResending || resendCount >= 5) ? 'not-allowed' : 'pointer',
                      opacity: (isResending || resendCount >= 5) ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.3s'
                    }}>
                      <RotateCcw size={15} />
                      {isResending ? 'Sending...' : resendCount >= 5 ? 'Limit Reached' : 'Resend Link'}
                    </button>
                  )}

                  <button onClick={() => { setLinkSent(false); setError(''); setSuccessMsg(''); setResendCountdown(0); sessionStorage.removeItem('emailLinkSentFlag') }} style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                    color: '#94a3b8', fontWeight: 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.3s'
                  }}>
                    ← Use a different email
                  </button>
                </div>

                {error && <div style={{ background: 'color-mix(in srgb, var(--red) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 10, padding: '12px 14px', marginTop: 16, fontSize: 13, color: '#fca5a5' }}>{error}</div>}
                {successMsg && <div style={{ background: 'color-mix(in srgb, var(--green) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: 10, padding: '12px 14px', marginTop: 16, fontSize: 13, color: '#86efac' }}>{successMsg}</div>}
              </div>
            ) : (
              /* ── SEND LINK FORM ── */
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Full Name <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional for existing users)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                    <input id="email-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" required style={inputStyle} />
                  </div>
                </div>

                {error && <div style={{ background: 'color-mix(in srgb, var(--red) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#fca5a5' }}>{error}</div>}

                <button type="submit" id="send-link-btn" disabled={loading} style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
                  fontWeight: 700, fontSize: 15, transition: 'all 0.3s', opacity: loading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                  <Send size={16} />
                  {loading ? 'Sending Link...' : 'Send Login Link'}
                </button>
              </form>
            )}

            <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <p style={{ textAlign: 'center', margin: 0 }}>
              <button onClick={openGmailSupport} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
                Need Help?
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

const inputStyle = {
  width: '100%', padding: '12px 14px 12px 44px', background: 'var(--surface2)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, outline: 'none', transition: 'all 0.3s', boxSizing: 'border-box'
}
