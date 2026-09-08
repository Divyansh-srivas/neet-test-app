import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabaseClient'
import { auth } from './firebase'
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth'

const AuthContext = createContext(null)

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung Browser';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  else if (ua.includes('Trident') || ua.includes('Edge') || ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'MacOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('like Mac')) os = 'iOS';

  const device_name = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)
    ? 'Mobile Device'
    : 'Desktop PC';
  return { browser, os, device_name };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser || null)
      if (firebaseUser) {
        setLoading(false) // Render app immediately
        await fetchProfile(firebaseUser.uid)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      if (!auth.currentUser) { setLoading(false); return; }
      const token = await auth.currentUser.getIdToken()
      const res = await fetch(`https://api.neogravix.in/api/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        if (data.accessibility_settings && Object.keys(data.accessibility_settings).length > 0) {
          import('./storage').then(({ getSettings, saveSettings }) => {
            const local = getSettings()
            saveSettings({ ...local, ...data.accessibility_settings })
          })
        }
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const updateProfile = async (updates) => {
    if (!user) return { data: null, error: { message: 'No user logged in' } }

    // Optimistic update
    setProfile(prev => ({ ...prev, ...updates }))

    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch(`https://api.neogravix.in/api/profile`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        return { data, error: null }
      } else {
        const err = await res.json()
        return { data: null, error: err }
      }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * STEP 1 — Send a sign-in link to the user's email.
   * Firebase sends a magic link. No OTP code to enter.
   */
  const sendEmailLink = async (email, fullName = '') => {
    if (!email || !email.trim()) {
      return { data: null, error: { message: 'Email address cannot be empty.' } }
    }

    const actionCodeSettings = {
      // Encode email and name in the URL so App.jsx can read it even if the link
      // opens in a new tab (sessionStorage is tab-scoped)
      url: `${window.location.origin}?signinEmail=${encodeURIComponent(email.trim())}&name=${encodeURIComponent(fullName.trim())}`,
      handleCodeInApp: true,
    }

    try {
      await sendSignInLinkToEmail(auth, email.trim(), actionCodeSettings)
      // Also keep in sessionStorage as a fallback for same-tab flow
      sessionStorage.setItem('emailForSignIn', email.trim())
      return { data: true, error: null }
    } catch (error) {
      console.error('[Firebase Email Link] Send failed:', error.code, error.message)
      let msg = 'Failed to send sign-in link. Please try again.'
      if (error.code === 'auth/invalid-email')
        msg = 'Invalid email address. Please enter a valid email.'
      else if (error.code === 'auth/too-many-requests')
        msg = 'Too many requests. Please wait a moment and try again.'
      else if (error.code === 'auth/operation-not-allowed')
        msg = 'Email link sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in methods.'
      else if (error.code === 'auth/unauthorized-domain')
        msg = 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.'
      else
        msg = `Failed to send sign-in link: ${error.message} (${error.code})`;
      return { data: null, error: { message: msg } }
    }
  }

  /**
   * STEP 2 — Complete sign-in when the user returns via the email link.
   * Called automatically by App.jsx when it detects the link in the URL.
   */
  const completeEmailSignIn = async (email, href, fullName) => {
    if (!isSignInWithEmailLink(auth, href)) {
      return { data: null, error: { message: 'Invalid or expired sign-in link.' } }
    }

    try {
      const result = await signInWithEmailLink(auth, email, href)
      const firebaseUser = result.user

      // Clean up stored email from sessionStorage
      sessionStorage.removeItem('emailForSignIn')
      sessionStorage.removeItem('emailSignInName')

      // Send fullName to backend to be upserted via the auth middleware and PUT
      if (fullName && fullName.trim()) {
        try {
          const token = await firebaseUser.getIdToken()
          await fetch(`https://api.neogravix.in/api/profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName.trim() })
          })
        } catch (err) {
          console.error("Error saving name:", err)
        }
      }

      // Track session
      try {
        const { browser, os, device_name } = getDeviceInfo()
        const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null)
        const ipData = ipRes ? await ipRes.json() : { ip: 'Unknown' }
        const { data: sessionData } = await supabase.from('user_sessions').insert({
          user_id: firebaseUser.uid,
          device_name, browser, os,
          ip_address: ipData.ip
        }).select().single()
        if (sessionData) sessionStorage.setItem('neogravix_session_id', sessionData.id)
      } catch (_) { }

      await fetchProfile(firebaseUser.uid)

      // Since Magic Link is strictly used for the Sign Up flow for new users,
      // we ALWAYS want them to set a password after clicking the link.
      return { data: { user: firebaseUser, needsPassword: true }, error: null }
    } catch (error) {
      console.error('[Firebase Email Link] Complete sign-in failed:', error.code, error.message)
      let msg = 'Sign-in failed. The link may be expired or already used.'
      if (error.code === 'auth/invalid-action-code')
        msg = 'This sign-in link is invalid or has already been used. Please request a new one.'
      else if (error.code === 'auth/expired-action-code')
        msg = 'This sign-in link has expired. Please request a new one.'
      else if (error.code === 'auth/invalid-email')
        msg = 'Email mismatch. Please use the same email you signed in with.'
      return { data: null, error: { message: msg } }
    }
  }

  const loginWithPassword = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)

      // Check if email is verified
      if (!result.user.emailVerified) {
        // Sign out the unverified user so they can't access the app
        await firebaseSignOut(auth)
        setUser(null)
        setProfile(null)
        return { data: null, error: { message: 'EMAIL_NOT_VERIFIED', unverifiedEmail: email } }
      }

      // Track session
      try {
        const { browser, os, device_name } = getDeviceInfo()
        const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null)
        const ipData = ipRes ? await ipRes.json() : { ip: 'Unknown' }
        const { data: sessionData } = await supabase.from('user_sessions').insert({
          user_id: result.user.uid,
          device_name, browser, os,
          ip_address: ipData.ip
        }).select().single()
        if (sessionData) sessionStorage.setItem('neogravix_session_id', sessionData.id)
      } catch (_) { }

      await fetchProfile(result.user.uid)
      return { data: { user: result.user }, error: null }
    } catch (error) {
      console.error('[Firebase Password Login] failed:', error)
      let msg = 'Failed to log in. Please check your credentials.'
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.'
      }
      return { data: null, error: { message: msg } }
    }
  }

  const signUpWithPassword = async (email, password, fullName) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      
      // Save name to backend profile
      if (fullName && fullName.trim()) {
        try {
          const token = await result.user.getIdToken()
          await fetch(`https://api.neogravix.in/api/profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName.trim() })
          })
        } catch (err) {
          console.error("Error saving name:", err)
        }
      }

      // Send ONE verification email
      await sendEmailVerification(result.user)

      // Sign out immediately so unverified user can't access the app
      await firebaseSignOut(auth)
      setUser(null)
      setProfile(null)

      return { data: { signedUp: true }, error: null }
    } catch (error) {
      console.error('[Firebase Password Signup] failed:', error)
      let msg = 'Failed to sign up.'
      if (error.code === 'auth/email-already-in-use') {
        msg = 'USER_ALREADY_EXISTS'
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.'
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Invalid email address.'
      }
      return { data: null, error: { message: msg } }
    }
  }

  /**
   * Resend verification email — used when login detects unverified email.
   * Signs in temporarily, sends verification, then signs out again.
   */
  const resendVerification = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      if (result.user.emailVerified) {
        // Already verified, no need to resend
        await firebaseSignOut(auth)
        setUser(null)
        setProfile(null)
        return { data: null, error: { message: 'Email is already verified. Please log in.' } }
      }
      await sendEmailVerification(result.user)
      await firebaseSignOut(auth)
      setUser(null)
      setProfile(null)
      return { data: true, error: null }
    } catch (error) {
      console.error('[Firebase Resend Verification] failed:', error)
      let msg = 'Failed to resend verification email.'
      if (error.code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a moment and try again.'
      }
      return { data: null, error: { message: msg } }
    }
  }

  const setPassword = async (password) => {
    if (!auth.currentUser) return { data: null, error: { message: 'Not authenticated.' } }
    try {
      await firebaseUpdatePassword(auth.currentUser, password)
      return { data: true, error: null }
    } catch (error) {
      console.error('[Firebase Set Password] failed:', error)
      let msg = 'Failed to set password.'
      if (error.code === 'auth/requires-recent-login') {
        msg = 'For security reasons, please log out and log in again before setting a password.'
      }
      return { data: null, error: { message: msg } }
    }
  }

  const resetPassword = async (email) => {
    try {
      await firebaseSendPasswordResetEmail(auth, email)
      return { data: true, error: null }
    } catch (error) {
      console.error('[Firebase Reset Password] failed:', error)
      return { data: null, error: { message: 'Failed to send reset email. Make sure the email is registered.' } }
    }
  }

  const signOut = async () => {
    try {
      const sessionId = sessionStorage.getItem('neogravix_session_id')
      if (sessionId) {
        await supabase.from('user_sessions').delete().eq('id', sessionId)
        sessionStorage.removeItem('neogravix_session_id')
      }
    } catch (_) { }
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, sendEmailLink, completeEmailSignIn, loginWithPassword, signUpWithPassword, resendVerification, setPassword, resetPassword, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
