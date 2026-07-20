import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { auth } from './firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'

// Initialize strictly for production SMS delivery
auth.useDeviceLanguage();
auth.settings.appVerificationDisabledForTesting = false;

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

  const device_name = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua) ? 'Mobile Device' : 'Desktop PC';
  return { browser, os, device_name };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser || null)
      if (firebaseUser) {
        // Firebase token is automatically injected into Supabase via our custom fetch in supabaseClient.js
        fetchProfile(firebaseUser.uid)
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
    if (!user) return { data: null, error: { message: "No user logged in" } };
    
    // Update DB and immediately select the updated row
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.uid)
      .select()
      .single();
      
    if (!error && data) {
      // Instantly update the global profile state across all components
      setProfile(data);
    }
    return { data, error };
  }

  const setupRecaptcha = useCallback((containerId) => {
    try {
      if (!window.recaptchaVerifier) {
        console.log('[Firebase Auth] Initializing RecaptchaVerifier on container:', containerId);
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
          size: 'invisible',
          callback: (response) => {
            console.log('[Firebase Auth] Recaptcha verified successfully. Token received.');
          },
          'expired-callback': () => {
            console.warn('[Firebase Auth] Recaptcha expired. Clearing verifier.');
            if (window.recaptchaVerifier) {
              window.recaptchaVerifier.clear();
              window.recaptchaVerifier = null;
            }
          }
        });
        // Force render immediately to catch misconfiguration early
        window.recaptchaVerifier.render().then(widgetId => {
          console.log('[Firebase Auth] RecaptchaVerifier rendered. Widget ID:', widgetId);
        }).catch(err => {
          console.error('[Firebase Auth] Failed to render RecaptchaVerifier:', err);
        });
      } else {
        console.log('[Firebase Auth] RecaptchaVerifier already exists. Skipping initialization.');
      }
    } catch (err) {
      console.error('[Firebase Auth] Error initializing RecaptchaVerifier:', err);
    }
  }, []);

  const resetRecaptcha = useCallback((containerId) => {
    console.log('[Firebase Auth] Resetting RecaptchaVerifier completely...');
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      window.recaptchaVerifier = null;
    }
    setupRecaptcha(containerId);
  }, [setupRecaptcha]);

  const sendPhoneOtp = async (phone) => {
    console.log('[Firebase Auth] Starting OTP request for phone:', phone);
    
    if (!phone || phone.trim() === '') {
      console.error('[Firebase Auth] Phone number is empty.');
      return { data: null, error: { message: "Phone number cannot be empty." } };
    }

    // Convert to proper E.164 format. Assuming Indian numbers if no country code.
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone; // Attempt to just add + for other formats
      }
    }
    
    console.log('[Firebase Auth] Formatted phone number (E.164):', formattedPhone);

    try {
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) {
        console.error('[Firebase Auth] RecaptchaVerifier is missing before sending OTP!');
        return { data: null, error: { message: "Security check failed. Please refresh the page and try again." } };
      }

      console.log('[Firebase Auth] Calling signInWithPhoneNumber...');
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      
      console.log('[Firebase Auth] OTP request SUCCESS! Firebase backend accepted the request.');
      window.confirmationResult = confirmationResult;
      
      return { data: true, error: null };
    } catch (error) {
      console.error('[Firebase Auth] OTP request FAILED!', error);
      console.error('[Firebase Auth] Error Code:', error.code);
      console.error('[Firebase Auth] Error Message:', error.message);
      
      let errorMsg = error.message;
      if (error.code === 'auth/invalid-phone-number') {
        errorMsg = 'Invalid phone number format. Please enter a valid 10-digit number.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'Too many requests. Firebase has blocked this device temporarily. Try again later.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMsg = 'SMS quota exceeded on Firebase. Please check your Blaze plan billing settings.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMsg = 'This domain is not authorized for Firebase Auth. Add it in Firebase Console -> Auth -> Settings.';
      } else if (error.code === 'auth/app-not-authorized') {
        errorMsg = 'App Check failed. Verify your App Check configuration in Firebase Console.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMsg = 'reCAPTCHA verification failed. Please try again.';
      } else if (error.code === 'auth/invalid-app-credential') {
        errorMsg = 'Invalid Firebase configuration. Please check your API keys.';
      } else if (error.code === 'auth/internal-error') {
        errorMsg = 'Firebase internal error. This often means SMS region policy is blocking India.';
      }
      
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
      }
      
      return { data: null, error: { message: errorMsg } };
    }
  }

  const verifyPhoneOtp = async (phone, token, fullName) => {
    try {
      const result = await window.confirmationResult.confirm(token);
      const firebaseUser = result.user;
      
      // Ensure profile exists for the logged in user
      const { data: existingProfile } = await supabase.from('profiles').select('id, full_name').eq('id', firebaseUser.uid).single();
      
      if (!existingProfile) {
        // Create profile for new users implicitly
        await supabase.from('profiles').insert({
          id: firebaseUser.uid,
          full_name: fullName || 'Student',
          role: 'student'
        });
      } else {
        // If they provided a name on the login screen, always update it to remove the glitch
        if (fullName && fullName.trim() !== '') {
          await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', firebaseUser.uid);
        } 
        // If they left it blank, but their DB name is glitched (empty), fix it
        else if (!existingProfile.full_name || existingProfile.full_name.trim() === '' || existingProfile.full_name === 'New Student') {
          await supabase.from('profiles').update({ full_name: 'Student' }).eq('id', firebaseUser.uid);
        }
      }
      
      // Track Session
      try {
        const { browser, os, device_name } = getDeviceInfo();
        const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null);
        const ipData = ipRes ? await ipRes.json() : { ip: 'Unknown' };
        
        const { data: sessionData } = await supabase.from('user_sessions').insert({
          user_id: firebaseUser.uid,
          device_name,
          browser,
          os,
          ip_address: ipData.ip
        }).select().single();
        
        if (sessionData) {
          localStorage.setItem('neogravix_session_id', sessionData.id);
        }
      } catch (err) {}
      
      // Fetch the freshly updated profile to sync React state immediately
      await fetchProfile(firebaseUser.uid);
      
      return { data: { user: firebaseUser }, error: null };
    } catch (error) {
      console.error(error);
      return { data: null, error: { message: "Invalid OTP code." } };
    }
  }

  const signOut = async () => {
    try {
      const sessionId = localStorage.getItem('neogravix_session_id');
      if (sessionId) {
        await supabase.from('user_sessions').delete().eq('id', sessionId);
        localStorage.removeItem('neogravix_session_id');
      }
    } catch (e) {}
    
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, setupRecaptcha, resetRecaptcha, sendPhoneOtp, verifyPhoneOtp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
