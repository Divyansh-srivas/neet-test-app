import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/useAuth.jsx'
import { supabase } from '../utils/supabaseClient'
import { Phone, Lock, User, GraduationCap, BookOpen, X, Sparkles, ArrowRight } from 'lucide-react'
import bgImage from '../assets/bg.jpg'
import logoImg from '../assets/logo.jpg'

// Inspirational quotes
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
  const { sendPhoneOtp, verifyPhoneOtp, setupRecaptcha, resetRecaptcha } = useAuth()
  const [page, setPage] = useState('landing') // landing | login
  const [form, setForm] = useState({ identifier: '', fullName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQuote, setShowQuote] = useState(true)
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)])

  // OTP State for both Login and Signup
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)
  const [expiryCountdown, setExpiryCountdown] = useState(0)
  const [resendCount, setResendCount] = useState(0)
  const [verificationAttempts, setVerificationAttempts] = useState(0)
  const [successMsg, setSuccessMsg] = useState('')
  const [isResending, setIsResending] = useState(false)

  const resetForm = (newPage) => {
    setPage(newPage)
    setError('')
    setSuccessMsg('')
    setForm({ identifier: '', fullName: '' })
    setOtpSent(false)
    setOtp('')
    setResendCountdown(0)
    setExpiryCountdown(0)
    setResendCount(0)
    setVerificationAttempts(0)
    localStorage.removeItem('otpResendExpiry')
    localStorage.removeItem('otpExpiry')
    localStorage.removeItem('otpResendCount')
    localStorage.removeItem('otpVerAttempts')
    localStorage.removeItem('otpSentFlag')
    localStorage.removeItem('otpPhone')
  }

  const openGmailSupport = () => {
    const subject = 'Login Help Request'
    const body = `Hello Neogravix Support Team,\n\nI am having trouble accessing my account.\n\nRegistered Email:\n\nIssue Description:\n\nBrowser:\nDevice:\n\nThank you.`
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=Neogravix@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    
    const newWindow = window.open(gmailUrl, '_blank', 'noopener,noreferrer')
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = `mailto:Neogravix@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setShowQuote(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (page === 'login') {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
      }
      setupRecaptcha('recaptcha-container')
      
      const savedResendExpiry = localStorage.getItem('otpResendExpiry')
      const savedOtpExpiry = localStorage.getItem('otpExpiry')
      const savedResendCount = localStorage.getItem('otpResendCount')
      const savedVerAttempts = localStorage.getItem('otpVerAttempts')
      const savedOtpSent = localStorage.getItem('otpSentFlag')
      const savedPhone = localStorage.getItem('otpPhone')

      if (savedResendCount) setResendCount(parseInt(savedResendCount, 10))
      if (savedVerAttempts) setVerificationAttempts(parseInt(savedVerAttempts, 10))
      
      if (savedOtpSent === 'true' && savedPhone) {
        setForm(p => ({ ...p, identifier: savedPhone }))
        setOtpSent(true)
      }

      if (savedResendExpiry) {
        const remaining = Math.floor((parseInt(savedResendExpiry, 10) - Date.now()) / 1000)
        if (remaining > 0) setResendCountdown(remaining)
      }
      
      if (savedOtpExpiry) {
        const remaining = Math.floor((parseInt(savedOtpExpiry, 10) - Date.now()) / 1000)
        if (remaining > 0) setExpiryCountdown(remaining)
      }
    }
    return () => {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
      }
    }
  }, [page, setupRecaptcha])

  useEffect(() => {
    let resendInterval = null;
    let expiryInterval = null;

    if (resendCountdown > 0) {
      resendInterval = setInterval(() => setResendCountdown(prev => prev - 1), 1000)
    } else if (resendCountdown === 0) {
      localStorage.removeItem('otpResendExpiry')
    }

    if (expiryCountdown > 0) {
      expiryInterval = setInterval(() => setExpiryCountdown(prev => prev - 1), 1000)
    } else if (expiryCountdown === 0 && otpSent) {
      localStorage.removeItem('otpExpiry')
    }

    return () => {
      if (resendInterval) clearInterval(resendInterval)
      if (expiryInterval) clearInterval(expiryInterval)
    }
  }, [resendCountdown, expiryCountdown, otpSent])

  const startTimers = () => {
    setResendCountdown(30)
    setExpiryCountdown(300)
    localStorage.setItem('otpResendExpiry', (Date.now() + 30000).toString())
    localStorage.setItem('otpExpiry', (Date.now() + 300000).toString())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    if (!otpSent) {
      // Step 1: Send OTP
      const { error } = await sendPhoneOtp(form.identifier)
      if (error) {
        setError(error.message)
      } else {
        setOtpSent(true)
        setError('')
        setSuccessMsg('OTP sent successfully.')
        startTimers()
        localStorage.setItem('otpSentFlag', 'true')
        localStorage.setItem('otpPhone', form.identifier)
      }
    } else {
      // Step 2: Verify OTP
      if (verificationAttempts >= 5) {
        setError('Too many incorrect attempts. Please request a new OTP.')
        setLoading(false)
        return
      }

      if (expiryCountdown <= 0) {
        setError('OTP has expired. Please request a new OTP.')
        setLoading(false)
        return
      }

      const { error } = await verifyPhoneOtp(form.identifier, otp, form.fullName)
      if (error) {
        const newAttempts = verificationAttempts + 1
        setVerificationAttempts(newAttempts)
        localStorage.setItem('otpVerAttempts', newAttempts.toString())
        
        if (newAttempts >= 5) {
          setError('Too many incorrect attempts. Please request a new OTP.')
          setExpiryCountdown(0)
        } else {
          if (error.message.includes('code') || error.message.includes('invalid') || error.message.includes('Invalid OTP')) {
            setError('Incorrect OTP.')
          } else {
            setError(error.message)
          }
        }
      } else {
        // Success
        localStorage.removeItem('otpResendExpiry')
        localStorage.removeItem('otpExpiry')
        localStorage.removeItem('otpResendCount')
        localStorage.removeItem('otpVerAttempts')
        localStorage.removeItem('otpSentFlag')
        localStorage.removeItem('otpPhone')
      }
    }
    
    setLoading(false)
  }

  const handleResend = async () => {
    if (resendCount >= 5) {
      setError('Maximum resend limit reached. Please try again after 15 minutes.')
      return
    }
    
    setIsResending(true)
    setError('')
    setSuccessMsg('')
    
    // Completely reset reCAPTCHA for the new SMS request
    resetRecaptcha('recaptcha-container')
    
    const { error } = await sendPhoneOtp(form.identifier)
    
    if (error) {
      setError(error.message)
    } else {
      const newResendCount = resendCount + 1
      setResendCount(newResendCount)
      localStorage.setItem('otpResendCount', newResendCount.toString())
      
      setSuccessMsg('New OTP sent successfully.')
      setOtp('')
      startTimers()
    }
    setIsResending(false)
  }

  // LANDING PAGE
  if (page === 'landing') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
        position: 'relative', overflow: 'auto'
      }}>
        {/* Background Overlay - only for hero */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '100vh',
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)', pointerEvents: 'none', zIndex: 1
        }} />

        {/* Quote Popup */}
        {showQuote && (
          <div style={{
            position: 'fixed', top: 30, left: 30, right: 30, maxWidth: 500,
            background: 'rgba(255, 255, 255, 0.95)', borderRadius: 16, padding: 24,
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)', zIndex: 110,
            animation: 'slideIn 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <p style={{
                fontSize: 16, fontWeight: 600, color: 'var(--surface2)', lineHeight: '1.6',
                flex: 1, marginRight: 12
              }}>
                "{quote}"
              </p>
              <button onClick={() => setShowQuote(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <X size={20} color="var(--muted)" />
              </button>
            </div>
          </div>
        )}

        {/* Top Right Buttons */}
        <div style={{
          position: 'fixed', top: 30, right: 30, zIndex: 105,
          display: 'flex', gap: 12
        }}>
          <button onClick={() => resetForm('login')} style={{
            padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
            fontWeight: 600, fontSize: 14, boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.3s'
          }}>
            Login
          </button>
        </div>

        {/* Hero Section */}
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, position: 'relative', zIndex: 5
        }}>
          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: 600 }}>
            <img src={logoImg} alt="Neogravix Logo" style={{ display: 'block', width: 80, height: 80, borderRadius: 20, margin: '0 auto 30px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', objectFit: 'cover' }} />

            <h1 style={{
              fontSize: 56, fontWeight: 900, color: 'white', marginBottom: 16,
              fontFamily: 'Space Grotesk', letterSpacing: '-1px'
            }}>
              Neogravix
            </h1>

            <p style={{
              fontSize: 20, color: '#e0e7ff', marginBottom: 32, fontWeight: 500,
              lineHeight: 1.6
            }}>
              Master Your Studies with AI-Powered Preparation
            </p>

            <div style={{
              display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
              marginBottom: 40
            }}>
              {[
                { icon: Sparkles, text: 'Smart Learning' },
                { icon: BookOpen, text: 'Rich Content' },
                { icon: GraduationCap, text: 'Expert Guidance' }
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255, 255, 255, 0.1)', padding: '12px 20px',
                  borderRadius: 12, backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <item.icon size={18} color="var(--accent2)" />
                  <span style={{ color: '#e0e7ff', fontWeight: 500 }}>{item.text}</span>
                </div>
              ))}
            </div>

            <button onClick={() => resetForm('login')} style={{
              padding: '16px 40px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
              fontWeight: 700, fontSize: 16, boxShadow: '0 15px 40px rgba(59, 130, 246, 0.4)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'all 0.3s'
            }}>
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* About Section */}
        <div style={{
          background: 'linear-gradient(135deg, var(--bg) 0%, #1a1f3a 100%)',
          padding: '80px 20px', position: 'relative', zIndex: 5
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{
              fontSize: 42, fontWeight: 800, color: '#ffffff', marginBottom: 12,
              fontFamily: 'Space Grotesk', letterSpacing: '-0.5px'
            }}>
              Why Neogravix?
            </h2>

            <div style={{
              width: 100, height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
              marginBottom: 40, borderRadius: 2
            }} />

            <p style={{
              fontSize: 16, color: '#cbd5e1', lineHeight: 1.8, marginBottom: 32,
              textAlign: 'justify'
            }}>
              Neogravix is a comprehensive, AI-powered education platform designed to transform how students prepare for competitive exams. With our advanced technology and data-driven approach, we provide personalized learning experiences tailored to each student's unique needs and learning style.
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 24, marginBottom: 32
            }}>
              {[
                { 
                  title: 'Intelligent Analytics',
                  desc: 'Real-time performance tracking and predictive analysis to identify weak areas and optimize study strategies'
                },
                { 
                  title: 'Expert Content',
                  desc: 'Comprehensive study materials created by top educators and subject matter experts'
                },
                { 
                  title: 'Interactive Learning',
                  desc: 'Engaging practice tests, live doubt sessions, and peer-to-peer learning communities'
                },
                { 
                  title: 'AI-Powered Guidance',
                  desc: 'Personalized study recommendations and adaptive learning paths for maximum efficiency'
                },
                { 
                  title: 'Progress Monitoring',
                  desc: 'Detailed performance reports and milestone tracking to keep you motivated'
                },
                { 
                  title: '24/7 Support',
                  desc: 'Round-the-clock assistance from our expert mentors and AI chatbot'
                }
              ].map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 16, padding: 24, backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s'
                }}>
                  <h3 style={{
                    fontSize: 16, fontWeight: 700, color: 'var(--accent2)', marginBottom: 12
                  }}>
                    {item.title}
                  </h3>
                  <p style={{
                    fontSize: 14, color: '#cbd5e1', lineHeight: 1.6
                  }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <p style={{
              fontSize: 16, color: '#cbd5e1', lineHeight: 1.8, textAlign: 'justify',
              marginBottom: 40
            }}>
              Master your NEET preparation with Neogravix's comprehensive platform designed specifically for NEET aspirants. Our expert-curated content, intelligent analytics, and personalized learning paths are optimized to help you ace the NEET exam. Join thousands of successful NEET students who have transformed their preparation journey and achieved their dream medical colleges with Neogravix.
            </p>

            <div style={{ textAlign: 'center' }}>
              <button onClick={() => resetForm('login')} style={{
                padding: '16px 48px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
                fontWeight: 700, fontSize: 16, boxShadow: '0 15px 40px rgba(59, 130, 246, 0.4)',
                transition: 'all 0.3s'
              }}>
                Start Your Journey Today
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)', borderTop: '1px solid rgba(59, 130, 246, 0.2)',
          padding: '40px 20px', textAlign: 'center', position: 'relative', zIndex: 5
        }}>
          <p style={{
            color: '#94a3b8', fontSize: 14, marginBottom: 12
          }}>
            © 2026 Neogravix. All rights reserved.
          </p>
          <p style={{
            color: 'var(--muted)', fontSize: 12
          }}>
            Empowering students worldwide through intelligent learning
          </p>
        </div>
      </div>
    )
  }

  // LOGIN PAGE
  if (page === 'login') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
        padding: 20, position: 'relative'
      }}>
        {/* Overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(3px)'
        }} />

        {/* Back Button */}
        <button onClick={() => resetForm('landing')} style={{
          position: 'fixed', top: 30, left: 30, zIndex: 100,
          background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)',
          width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)',
          color: 'white', fontSize: 20, fontWeight: 700, transition: 'all 0.3s'
        }}>
          ←
        </button>

        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <img src={logoImg} alt="Neogravix Logo" style={{ display: 'block', width: 70, height: 70, borderRadius: 16, margin: '0 auto 24px', boxShadow: '0 15px 40px rgba(0,0,0,0.4)', objectFit: 'cover' }} />
            <h1 style={{
              fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 800,
              color: '#ffffff', letterSpacing: '-0.5px', marginBottom: 8
            }}>
              Welcome to Neogravix
            </h1>
            <p style={{ color: '#e0e7ff', fontSize: 14, fontWeight: 500 }}>
              Log in or create a new account
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 20, padding: 32, backdropFilter: 'blur(10px)'
          }}>
            <form onSubmit={handleSubmit}>
              {/* Full Name */}
              <div style={{ marginBottom: 16, opacity: otpSent ? 0.5 : 1, pointerEvents: otpSent ? 'none' : 'auto' }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Full Name (Optional for existing users)
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="var(--muted)" style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)'
                  }} />
                  <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                    placeholder="John Doe" style={inputStyle} />
                </div>
              </div>

              {/* Phone */}
              <div style={{ marginBottom: 18, opacity: otpSent ? 0.5 : 1, pointerEvents: otpSent ? 'none' : 'auto' }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Phone Number
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} color="var(--muted)" style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)'
                  }} />
                  <input type="text" value={form.identifier} onChange={e => setForm(p => ({ ...p, identifier: e.target.value }))}
                    placeholder="e.g. 9876543210" required style={inputStyle} />
                </div>
              </div>

              {/* OTP Field (Only shown if OTP is sent) */}
              {otpSent && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                      6-Digit OTP
                    </label>
                    <span style={{ fontSize: 12, color: expiryCountdown > 0 ? '#94a3b8' : '#fca5a5' }}>
                      {expiryCountdown > 0 ? `OTP expires in ${Math.floor(expiryCountdown / 60).toString().padStart(2, '0')}:${(expiryCountdown % 60).toString().padStart(2, '0')}` : 'OTP has expired'}
                    </span>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <Lock size={18} color="var(--muted)" style={{
                      position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)'
                    }} />
                    <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                      placeholder="123456" required style={inputStyle} disabled={expiryCountdown <= 0} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: '#94a3b8' }}>Didn't receive the OTP?</span>
                    {resendCountdown > 0 ? (
                      <span style={{ color: 'var(--muted)' }}>Resend OTP in {resendCountdown}s</span>
                    ) : (
                      <button 
                        type="button" 
                        onClick={handleResend}
                        disabled={isResending || resendCount >= 5}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          color: (isResending || resendCount >= 5) ? 'var(--muted)' : 'var(--accent2)',
                          cursor: (isResending || resendCount >= 5) ? 'not-allowed' : 'pointer',
                          fontWeight: 600, textDecoration: 'underline'
                        }}
                      >
                        {isResending ? 'Resending...' : (resendCount >= 5 ? 'Limit Reached' : 'Resend OTP')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  background: 'color-mix(in srgb, var(--red) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 10,
                  padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#fca5a5'
                }}>
                  {error}
                </div>
              )}

              {/* Success */}
              {successMsg && (
                <div style={{
                  background: 'color-mix(in srgb, var(--green) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: 10,
                  padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#86efac'
                }}>
                  {successMsg}
                </div>
              )}

              {/* reCAPTCHA */}
              <div id="recaptcha-container"></div>

              {/* Submit */}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white',
                fontWeight: 700, fontSize: 15, transition: 'all 0.3s',
                opacity: loading ? 0.7 : 1
              }}>
                {loading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify & Login' : 'Send OTP')}
              </button>
            </form>

            {/* Divider */}
            <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
            </div>

            {/* Need Help */}
            <p style={{ textAlign: 'center', margin: 0 }}>
              <button onClick={openGmailSupport} style={{
                background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
                fontSize: 12, textDecoration: 'underline'
              }}>
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
  fontSize: 14, outline: 'none', transition: 'all 0.3s'
}
