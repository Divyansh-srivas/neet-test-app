import React, { useState, useEffect } from 'react'
import { getSettings } from './utils/storage'
import { AuthProvider, useAuth } from './utils/useAuth.jsx'
import AuthPage from './pages/AuthPage'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/UploadPage'
import PreTestPage from './pages/PreTestPage'
import ExamPage from './pages/ExamPage'
import AnalysisPage from './pages/AnalysisPage'
import BookmarksPage from './pages/BookmarksPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import { LogOut } from 'lucide-react'
import NotificationCenter from './components/NotificationCenter'
import { SettingsProvider } from './utils/SettingsContext'
import { JobProvider } from './utils/JobContext'
import JobProgressWidget from './components/JobProgressWidget'

function AppContent() {
  const { user, profile, loading, signOut } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [activeTest, setActiveTest] = useState(null)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(err => console.error('Service Worker registration failed:', err));
    }
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--muted)' }}>Loading...</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  const isExam = page === 'exam' || page === 'pretest'

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div aria-live="polite" id="aria-live-region" className="sr-only"></div>
      
      {!isExam && <Navbar page={page} setPage={setPage} />}

      <main id="main-content" style={{
        flex: 1,
        marginLeft: isExam ? 0 : 220,
        padding: isExam ? 0 : '28px 28px 100px',
        minHeight: '100vh',
      }} className="main-content">

        {!isExam && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <NotificationCenter align="right" direction="down" />
            <button onClick={signOut} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
              color: '#94a3b8', cursor: 'pointer', fontSize: 13
            }}>
              <LogOut size={14} /> Logout ({profile?.full_name?.trim() ? profile.full_name : 'Student'})
            </button>
          </div>
        )}

        {page === 'dashboard' && <Dashboard setPage={setPage} setActiveTest={setActiveTest} />}
        {page === 'upload' && <UploadPage setPage={setPage} setActiveTest={setActiveTest} />}
        {page === 'pretest' && activeTest && <PreTestPage test={activeTest} setPage={setPage} />}
        {page === 'exam' && activeTest && <ExamPage test={activeTest} setPage={setPage} setActiveTest={setActiveTest} />}
        {page === 'analysis' && activeTest && <AnalysisPage test={activeTest} setPage={setPage} />}
        {page === 'bookmarks' && <BookmarksPage />}
        {page === 'profile' && <ProfilePage />}
        {page === 'settings' && <SettingsPage />}

        <JobProgressWidget />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; padding: ${isExam ? '0' : '20px 16px 90px'} !important; }
        }
      `}</style>
    </div>
  )
}



import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

import { getAppearanceSettings } from './api/appearance'

export default function App() {
  const isPrivacy = window.location.pathname === '/privacy-policy'
  const isTerms = window.location.pathname === '/terms-and-conditions'
  const isReset = window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery')

  useEffect(() => {
    let mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyAppearance = async (overrideSettings = null) => {
      let s = overrideSettings;
      if (!s) {
         // Load from cache first
         const cached = localStorage.getItem('ntp_appearance');
         s = cached ? JSON.parse(cached) : await getAppearanceSettings();
      }

      document.body.className = '';
      
      // Theme
      if (s.theme === 'Light Mode') {
        document.body.classList.add('theme-light');
      } else if (s.theme === 'System Theme' || s.theme === 'System Default') {
        if (!mediaQuery.matches) {
          document.body.classList.add('theme-light');
        }
      }

      // Accent
      if (s.accentColor) document.body.classList.add('accent-' + s.accentColor);
      
      // Layout
      if (s.compactLayout) document.body.classList.add('layout-compact');
      
      // Animations
      if (s.animations === false) document.body.classList.add('motion-reduced');
    };
    
    applyAppearance();

    const handleSystemChange = () => {
      applyAppearance(); // Re-evaluate if system theme changes
    };
    
    const handleSettingsUpdate = (e) => {
      applyAppearance(e.detail);
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    window.addEventListener('appearanceUpdated', handleSettingsUpdate);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener('appearanceUpdated', handleSettingsUpdate);
    };
  }, []);

  if (isPrivacy) {
    return <PrivacyPolicyPage />
  }

  if (isTerms) {
    return <TermsPage />
  }

  if (isReset) {
    return <ResetPasswordPage />
  }

  return (
    <AuthProvider>
      <SettingsProvider>
        <JobProvider>
          <AppContent />
        </JobProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
