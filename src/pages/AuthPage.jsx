import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/useAuth.jsx'
import { Mail, User, GraduationCap, BookOpen, X, Sparkles, ArrowRight, Send, CheckCircle, RotateCcw, Lock, KeyRound, Eye, EyeOff, HelpCircle } from 'lucide-react'
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

export default function AuthPage({ forceSetPassword }) {
  const { user, sendEmailLink, loginWithPassword, setPassword, resetPassword } = useAuth()
  
  // States: 'landing', 'login', 'signup', 'setPassword', 'forgotPassword'
  const [page, setPage] = useState(forceSetPassword ? 'setPassword' : 'landing')
  
  const [form, setForm] = useState({ email: '', fullName: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQuote, setShowQuote] = useState(true)
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)])

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

  useEffect(() => {
    const t = setTimeout(() => setShowQuote(false), 5000)
    return () => clearTimeout(t)
  }, [])

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
      // Success! App.jsx will automatically redirect because needsPassword becomes false
      // actually, user.providerData might not update instantly in local state without a reload
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

  // ── RENDERERS ──────────────────────────────────────────────────────────────
  
  if (page === 'landing') {
    return (
      <div style={layoutStyle}>
        <div style={overlayStyle} />
        {showQuote && (
          <div style={quoteStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--surface2)', lineHeight: 1.6, flex: 1, marginRight: 12 }}>"{quote}"</p>
              <button onClick={() => setShowQuote(false)} style={iconBtnStyle}><X size={20} color="var(--muted)" /></button>
            </div>
          </div>
        )}

        <div style={{ position: 'fixed', top: 30, right: 30, zIndex: 105, display: 'flex', gap: 12 }}>
          <button onClick={() => resetForm('login')} style={outlineBtnStyle}>Log In</button>
          <button onClick={() => resetForm('signup')} style={primaryBtnStyle}>Sign Up</button>
        </div>

        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', zIndex: 5 }}>
          <div style={{ textAlign: 'center', maxWidth: 600 }}>
            <img src={logoImg} alt="Neogravix" style={{ display: 'block', width: 80, height: 80, borderRadius: 20, margin: '0 auto 30px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', objectFit: 'cover' }} />
            <h1 style={{ fontSize: 56, fontWeight: 900, color: 'white', marginBottom: 16, fontFamily: 'Space Grotesk', letterSpacing: '-1px' }}>Neogravix</h1>
            <p style={{ fontSize: 20, color: '#e0e7ff', marginBottom: 32, fontWeight: 500, lineHeight: 1.6 }}>Master Your Studies with AI-Powered Preparation</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
              {[{ icon: Sparkles, text: 'Smart Learning' }, { icon: BookOpen, text: 'Rich Content' }, { icon: GraduationCap, text: 'Expert Guidance' }].map((item, i) => (
                <div key={i} style={featurePillStyle}><item.icon size={18} color="var(--accent2)" /><span style={{ color: '#e0e7ff', fontWeight: 500 }}>{item.text}</span></div>
              ))}
            </div>
            <button onClick={() => resetForm('signup')} style={{ ...primaryBtnStyle, padding: '16px 40px', fontSize: 16 }}>
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={layoutStyle}>
      <div style={overlayStyle} />
      {page !== 'setPassword' && (
        <button onClick={() => resetForm('landing')} style={{ ...iconBtnStyle, position: 'fixed', top: 30, left: 30, zIndex: 100, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 }}>
          ←
        </button>
      )}

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img src={logoImg} alt="Neogravix" style={{ display: 'block', width: 70, height: 70, borderRadius: 16, margin: '0 auto 20px', objectFit: 'cover' }} />
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            {page === 'login' && 'Welcome Back'}
            {page === 'signup' && 'Create an Account'}
            {page === 'forgotPassword' && 'Reset Password'}
            {page === 'setPassword' && 'Account Verified!'}
          </h1>
          <p style={{ color: '#e0e7ff', fontSize: 14 }}>
            {page === 'login' && 'Log in to continue your preparation'}
            {page === 'signup' && 'Register as a new student'}
            {page === 'forgotPassword' && 'Enter your email to receive a reset link'}
            {page === 'setPassword' && 'Set a password to complete your registration'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, padding: 32, backdropFilter: 'blur(10px)' }}>

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
                <button type="button" onClick={() => resetForm('forgotPassword')} style={{ background: 'none', border: 'none', color: '#93c5fd', fontSize: 13, cursor: 'pointer', padding: 0 }}>Forgot Password?</button>
              </div>

              {error && <div style={errorStyle}>{error}</div>}

              <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, width: '100%', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Logging in...' : 'Log In'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--muted)' }}>
                Don't have an account? <button type="button" onClick={() => resetForm('signup')} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign up</button>
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
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>We sent a sign-up link to <strong style={{ color: 'var(--accent2)' }}>{form.email}</strong></p>
                </div>
                <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                  {[ 'Open your email inbox', 'Click the verification link', 'Set your password to finish' ].map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 10 : 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>{i + 1}</div>
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
                  {loading ? 'Sending...' : 'Send Verification Link'}
                </button>
                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--muted)' }}>
                  Already have an account? <button type="button" onClick={() => resetForm('login')} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Log In</button>
                </div>
              </form>
            )
          )}

          {/* === SET PASSWORD (After Link) === */}
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
                  <button type="button" onClick={() => resetForm('login')} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 14 }}>← Back to Login</button>
                </div>
              </form>
            )
          )}
        </div>
      </div>

      <a href="mailto:Neogravix@gmail.com?subject=Support%20Request%3A%20Neogravix&body=Please%20describe%20your%20issue%20below%3A%0A%0A" 
         style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 105, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, color: '#e0e7ff', textDecoration: 'none', fontWeight: 500, fontSize: 14, backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
        <HelpCircle size={18} color="#93c5fd" /> Help & Support
      </a>
    </div>
  )
}

const layoutStyle = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', position: 'relative', overflow: 'auto' }
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', pointerEvents: 'none', zIndex: 1 }
const quoteStyle = { position: 'fixed', top: 30, left: 30, right: 30, maxWidth: 500, background: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.3)', zIndex: 110 }
const iconBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', padding: 0 }
const outlineBtnStyle = { padding: '12px 28px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.3s' }
const primaryBtnStyle = { padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontWeight: 600, fontSize: 14, transition: 'all 0.3s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
const featurePillStyle = { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: 12, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }
const inputStyle = { width: '100%', padding: '12px 44px 12px 44px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const inputIconStyle = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }
const showPwdBtnStyle = { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }
const labelStyle = { fontSize: 13, color: '#cbd5e1', display: 'block', marginBottom: 8, fontWeight: 500 }
const errorStyle = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: 13, color: '#fca5a5' }
const successStyle = { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: 13, color: '#86efac' }
