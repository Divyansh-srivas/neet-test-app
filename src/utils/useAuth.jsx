import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabaseClient'
import { auth } from './firebase'
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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
        await fetchProfile(firebaseUser.uid)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!error && data) {
      setProfile(data)
      // Hydrate accessibility settings from backend to local storage
      if (data.accessibility_settings && Object.keys(data.accessibility_settings).length > 0) {
        import('./storage').then(({ getSettings, saveSettings }) => {
          const local = getSettings()
          saveSettings({ ...local, ...data.accessibility_settings })
        })
      }
    }
    setLoading(false)
  }

  const updateProfile = async (updates) => {
    if (!user) return { data: null, error: { message: 'No user logged in' } }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.uid)
      .select()
      .single()
    if (!error && data) setProfile(data)
    return { data, error }
  }

  /**
   * STEP 1 — Send a sign-in link to the user's email.
   * Firebase sends a magic link. No OTP code to enter.
   */
  const sendEmailLink = async (email) => {
    if (!email || !email.trim()) {
      return { data: null, error: { message: 'Email address cannot be empty.' } }
    }

    const actionCodeSettings = {
      // Encode email in the URL so App.jsx can read it even if the link
      // opens in a new tab (sessionStorage is tab-scoped)
      url: `${window.location.origin}?signinEmail=${encodeURIComponent(email.trim())}`,
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

      // Create or update Supabase profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', firebaseUser.uid)
        .single()

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: firebaseUser.uid,
          full_name: fullName?.trim() || 'Student',
          role: 'student'
        })
      } else {
        if (fullName && fullName.trim()) {
          await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', firebaseUser.uid)
        } else if (!existingProfile.full_name || !existingProfile.full_name.trim()) {
          await supabase.from('profiles').update({ full_name: 'Student' }).eq('id', firebaseUser.uid)
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
      } catch (_) {}

      await fetchProfile(firebaseUser.uid)
      return { data: { user: firebaseUser }, error: null }
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

  const signOut = async () => {
    try {
      const sessionId = sessionStorage.getItem('neogravix_session_id')
      if (sessionId) {
        await supabase.from('user_sessions').delete().eq('id', sessionId)
        sessionStorage.removeItem('neogravix_session_id')
      }
    } catch (_) {}
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, sendEmailLink, completeEmailSignIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
