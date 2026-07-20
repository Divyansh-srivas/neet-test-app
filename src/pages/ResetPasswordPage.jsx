import React, { useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { Lock, CheckCircle } from 'lucide-react'
import bgImage from '../assets/bg.jpg'
import logoImg from '../assets/logo.jpg'

export default function ResetPasswordPage() {
  const [newPwd, setNewPwd] = useState('')
  const [confPwd, setConfPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const checkPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // 0 to 5
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    
    if (newPwd.length < 8) return setError('New password must be at least 8 characters.')
    if (checkPasswordStrength(newPwd) < 4) return setError('Password must contain uppercase, lowercase, number, and special character.')
    if (newPwd !== confPwd) return setError('Passwords do not match.')

    setLoading(true)
    
    // Supabase will automatically pick up the access_token from the URL hash
    // and establish a temporary session. We just need to update the user.
    const { error: updateError } = await supabase.auth.updateUser({ password: newPwd })
    
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
    } else {
      setSuccess('Password changed successfully. Please sign in.')
      // Invalidate the recovery session so they have to log in manually
      await supabase.auth.signOut()
      
      setTimeout(() => {
        window.location.href = '/'
      }, 3000)
    }
  }

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

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src={logoImg} alt="Neogravix Logo" style={{ display: 'block', width: 70, height: 70, borderRadius: 16, margin: '0 auto 24px', boxShadow: '0 15px 40px rgba(0,0,0,0.4)', objectFit: 'cover' }} />
          <h1 style={{
            fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 800,
            color: '#ffffff', letterSpacing: '-0.5px', marginBottom: 8
          }}>
            Set New Password
          </h1>
          <p style={{ color: '#e0e7ff', fontSize: 14, fontWeight: 500 }}>
            Enter a strong password for your account
          </p>
        </div>

        <div style={{
          background: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 20, padding: 32, backdropFilter: 'blur(10px)'
        }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={48} color="var(--green)" style={{ marginBottom: 16 }} />
              <h3 style={{ color: 'var(--text)', fontSize: 18, marginBottom: 8 }}>Success!</h3>
              <p style={{ color: '#94a3b8', fontSize: 14 }}>{success}</p>
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} required style={inputStyle} />
                </div>
                {newPwd && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= checkPasswordStrength(newPwd) ? (checkPasswordStrength(newPwd) > 3 ? 'var(--green)' : 'var(--yellow)') : 'rgba(255,255,255,0.1)' }} />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type={showPwd ? 'text' : 'password'} value={confPwd} onChange={e => setConfPwd(e.target.value)} required style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <input type="checkbox" id="showpwd2" checked={showPwd} onChange={e=>setShowPwd(e.target.checked)} />
                <label htmlFor="showpwd2" style={{ fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>Show Passwords</label>
              </div>

              {error && (
                <div style={{ background: 'color-mix(in srgb, var(--red) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontWeight: 700, fontSize: 15, transition: 'all 0.3s', opacity: loading ? 0.7 : 1
              }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '12px 14px 12px 44px', background: 'var(--surface2)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, outline: 'none', transition: 'all 0.3s'
}
