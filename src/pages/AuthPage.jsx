import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/useAuth.jsx'
import { Mail, User, GraduationCap, BookOpen, X, Sparkles, ArrowRight, Send, CheckCircle, RotateCcw, Lock, KeyRound, Eye, EyeOff, HelpCircle } from 'lucide-react'
import bgImage from '../assets/bg.jpg'
import logoImg from '../assets/logo.jpg'
import LibraryPage from './LibraryPage.jsx'

export default function AuthPage({ forceSetPassword }) {
  const { user, sendEmailLink, loginWithPassword, setPassword, resetPassword } = useAuth()
  
  // Default to signup to get the users to convert immediately
  const [page, setPage] = useState(forceSetPassword ? 'setPassword' : 'signup')
  
  const [form, setForm] = useState({ email: '', fullName: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Magic Link states for signup
  const [linkSent, setLinkSent] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resendCount, setResendCount] = useState(0)
  const [isResending, setIsResending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (forceSetPassword) setPage('setPassword')
  }, [forceSetPassword])

  const resetForm = (newPage) => {
    setPage(newPage)
    setError('')
    setSuccessMsg('')
    setForm({ email: '', fullName: '', password: '', confirmPassword: '' })
    setLinkSent(false)
    setResetSent(false)
    setResendCountdown(0)
    setResendCount(0)
  }

  // Restore state if user navigates back to signup page
  useEffect(() => {
    if (page === 'signup') {
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

  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }
    if (!form.fullName.trim()) {
      setError('Please enter your full name.')
      setLoading(false)
      return
    }

    const { error } = await sendEmailLink(form.email.trim(), form.fullName.trim())
    if (error) {
      setError(error.message)
    } else {
      setLinkSent(true)
      startResendTimer()
      sessionStorage.setItem('emailLinkSentFlag', 'true')
      sessionStorage.setItem('emailSignInName', form.fullName.trim())
    }
    setLoading(false)
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!form.email || !form.password) {
      setError('Please enter both email and password.')
      setLoading(false)
      return
    }

    const { error } = await loginWithPassword(form.email.trim(), form.password)
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  const handleSetPasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const { error } = await setPassword(form.password)
    if (error) {
      setError(error.message)
    } else {
      window.location.reload()
    }
    setLoading(false)
  }

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    const { error } = await resetPassword(form.email.trim())
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
      setSuccessMsg('Password reset email sent!')
    }
    setLoading(false)
  }

  const handleResend = async () => {
    if (resendCount >= 5) { setError('Maximum resend limit reached. Please try again later.'); return }
    setIsResending(true)
    setError('')
    setSuccessMsg('')
    const { error } = await sendEmailLink(form.email.trim(), form.fullName.trim())
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

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <div style={heroSectionStyle}>
        <div style={overlayStyle} />

        {/* 2-Column Split Layout */}
        <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
        maxWidth: 1200,
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 60,
        position: 'relative',
        zIndex: 10
      }}>
        
        {/* LEFT COLUMN: Modern Hero Copy */}
        <div style={{ flex: '1 1 500px', maxWidth: 540 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <img src={logoImg} alt="Neogravix" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
            <span style={{ fontSize: 24, fontWeight: 800, color: 'white', fontFamily: 'Space Grotesk', letterSpacing: '-0.5px' }}>Neogravix</span>
          </div>

          <div style={{ 
            display: 'inline-block', 
            padding: '6px 16px', 
            background: 'rgba(99, 102, 241, 0.1)', 
            color: '#818cf8', 
            borderRadius: 100, 
            fontSize: 12, 
            fontWeight: 600, 
            letterSpacing: '1px', 
            textTransform: 'uppercase',
            marginBottom: 24,
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            ✨ Intelligence in Practice
          </div>
          
          <h1 style={{ 
            fontSize: 'clamp(40px, 5vw, 64px)', 
            fontWeight: 800, 
            color: 'white', 
            marginBottom: 24, 
            letterSpacing: '-1.5px',
            lineHeight: 1.1,
            fontFamily: 'Space Grotesk'
          }}>
            Practice Smarter.<br />
            <span style={{ 
              background: 'linear-gradient(to right, #818cf8, #22d3ee)', 
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent' 
            }}>
              Score Higher.
            </span>
          </h1>

          <p style={{ 
            color: '#94a3b8', 
            fontSize: 'clamp(16px, 2vw, 18px)', 
            marginBottom: 36, 
            lineHeight: 1.6 
          }}>
            Stop grinding blindly. Master your NEET preparation with 450,000+ hand-picked MCQs and AI-driven insights designed to maximize your rank.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[{ icon: Sparkles, text: 'Smart Learning' }, { icon: BookOpen, text: '450K+ MCQs' }, { icon: GraduationCap, text: 'Rank Booster' }].map((item, i) => (
              <div key={i} style={featurePillStyle}><item.icon size={18} color="#818cf8" /><span style={{ color: '#e0e7ff', fontWeight: 500 }}>{item.text}</span></div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Auth Box */}
        <div style={{ flex: '1 1 400px', maxWidth: 440, width: '100%' }}>
          <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 24, padding: 36, backdropFilter: 'blur(12px)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                {page === 'login' && 'Welcome Back'}
                {page === 'signup' && 'Create an Account'}
                {page === 'forgotPassword' && 'Reset Password'}
                {page === 'setPassword' && 'Account Verified!'}
              </h2>
              <p style={{ color: '#94a3b8', fontSize: 14 }}>
                {page === 'login' && 'Log in to continue your preparation'}
                {page === 'signup' && 'Register as a new student'}
                {page === 'forgotPassword' && 'Enter your email to receive a reset link'}
                {page === 'setPassword' && 'Set a password to complete your registration'}
              </p>
            </div>

            {/* === LOGIN === */}
            {page === 'login' && (
              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="var(--muted)" style={inputIconStyle} />
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" required style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} color="var(--muted)" style={inputIconStyle} />
                    <input type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" required style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={showPwdBtnStyle}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                  <button type="button" onClick={() => resetForm('forgotPassword')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, cursor: 'pointer', padding: 0 }}>Forgot Password?</button>
                </div>

                {error && <div style={errorStyle}>{error}</div>}

                <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, width: '100%', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Logging in...' : 'Log In'}
                </button>

                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--muted)' }}>
                  Don't have an account? <button type="button" onClick={() => resetForm('signup')} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign up</button>
                </div>
              </form>
            )}

            {/* === SIGN UP === */}
            {page === 'signup' && (
              linkSent ? (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ width: 68, height: 68, borderRadius: 20, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <CheckCircle size={34} color="#22c55e" />
                    </div>
                    <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Link Sent!</h2>
                    <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>We sent a sign-up link to <strong style={{ color: '#818cf8' }}>{form.email}</strong></p>
                  </div>
                  <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                    {[ 'Open your email inbox', 'Click the verification link', 'Set your password to finish' ].map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 10 : 0 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>{i + 1}</div>
                        <span style={{ color: '#cbd5e1', fontSize: 13 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                  {resendCountdown > 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>Resend in <strong style={{ color: '#94a3b8' }}>{resendCountdown}s</strong></div>
                  ) : (
                    <button onClick={handleResend} disabled={isResending || resendCount >= 5} style={{ ...outlineBtnStyle, width: '100%', marginBottom: 10, display: 'flex', justifyContent: 'center', gap: 8, opacity: (isResending || resendCount >= 5) ? 0.5 : 1 }}>
                      <RotateCcw size={15} /> {isResending ? 'Sending...' : 'Resend Link'}
                    </button>
                  )}
                  {error && <div style={errorStyle}>{error}</div>}
                  {successMsg && <div style={successStyle}>{successMsg}</div>}
                  <button onClick={() => { setLinkSent(false); sessionStorage.removeItem('emailLinkSentFlag') }} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>← Use a different email</button>
                </div>
              ) : (
                <form onSubmit={handleSignupSubmit}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Full Name</label>
                    <div style={{ position: 'relative' }}>
                      <User size={18} color="var(--muted)" style={inputIconStyle} />
                      <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" required style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={18} color="var(--muted)" style={inputIconStyle} />
                      <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" required style={inputStyle} />
                    </div>
                  </div>
                  {error && <div style={errorStyle}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, width: '100%', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Sending...' : 'Start Your Smart Practice →'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--muted)' }}>
                    Already have an account? <button type="button" onClick={() => resetForm('login')} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Log In</button>
                  </div>
                </form>
              )
            )}

            {/* === SET PASSWORD === */}
            {page === 'setPassword' && (
              <form onSubmit={handleSetPasswordSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Verified Email</label>
                  <input type="text" value={user?.email || form.email || ''} disabled style={{ ...inputStyle, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', cursor: 'not-allowed', paddingLeft: 14 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Create Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} color="var(--muted)" style={inputIconStyle} />
                    <input type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="At least 6 characters" required style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={showPwdBtnStyle}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} color="var(--muted)" style={inputIconStyle} />
                    <input type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Confirm password" required style={inputStyle} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={showPwdBtnStyle}>
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {error && <div style={errorStyle}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, width: '100%', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Saving...' : 'Create Account & Login'}
                </button>
              </form>
            )}

            {/* === FORGOT PASSWORD === */}
            {page === 'forgotPassword' && (
              resetSent ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 68, height: 68, borderRadius: 20, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle size={34} color="#22c55e" />
                  </div>
                  <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Check your email</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                    If an account exists for that email, we have sent password reset instructions.
                  </p>
                  <button onClick={() => resetForm('login')} style={{ ...primaryBtnStyle, width: '100%' }}>Back to Login</button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit}>
                  <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>Registered Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={18} color="var(--muted)" style={inputIconStyle} />
                      <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" required style={inputStyle} />
                    </div>
                  </div>
                  {error && <div style={errorStyle}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, width: '100%', opacity: loading ? 0.7 : 1, marginBottom: 16 }}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <div style={{ textAlign: 'center' }}>
                    <button type="button" onClick={() => resetForm('login')} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 14 }}>← Back to Login</button>
                  </div>
                </form>
              )
            )}
          </div>
        </div>
      </div>

      <LibraryPage />

      <a href="mailto:Neogravix@gmail.com?subject=Support%20Request%3A%20Neogravix&body=Please%20describe%20your%20issue%20below%3A%0A%0A" 
         style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 105, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, color: '#e0e7ff', textDecoration: 'none', fontWeight: 500, fontSize: 14, backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
        <HelpCircle size={18} color="#818cf8" /> Help & Support
      </a>
    </div>
  )
}

const heroSectionStyle = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', position: 'relative' }
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '100vh', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', pointerEvents: 'none', zIndex: 1 }
const outlineBtnStyle = { padding: '12px 28px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.3s' }
const primaryBtnStyle = { padding: '14px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', color: 'white', fontWeight: 600, fontSize: 15, transition: 'all 0.3s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 24px -8px rgba(79, 70, 229, 0.6)' }
const featurePillStyle = { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '10px 18px', borderRadius: 100, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 14 }
const inputStyle = { width: '100%', padding: '14px 44px 14px 44px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }
const inputIconStyle = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }
const showPwdBtnStyle = { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }
const labelStyle = { fontSize: 13, color: '#cbd5e1', display: 'block', marginBottom: 8, fontWeight: 500 }
const errorStyle = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: 13, color: '#fca5a5' }
const successStyle = { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: 13, color: '#86efac' }
