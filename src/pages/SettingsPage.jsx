import React, { useState, useEffect } from 'react'
import { DEFAULT_SETTINGS } from '../utils/storage'
import { useSettings } from '../utils/SettingsContext'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../utils/useAuth'
import { updateAccessibilitySettings } from '../api/accessibility'
import { getPerformanceSettings, updatePerformanceSettings } from '../api/performance'
import { getNotificationSettings, updateNotificationSettings, subscribeToPush } from '../api/notifications'
import { getAppearanceSettings, updateAppearanceSettings } from '../api/appearance'
import {
  Key, CheckCircle, ExternalLink, Eye, EyeOff, Target, Bell,
  BookOpen, FileText, Layout, Palette, BarChart2, Accessibility, Shield, Info,
  RotateCcw, X, LogOut, Laptop, Smartphone
} from 'lucide-react'

// Reusable UI Components
const SectionCard = ({ icon: Icon, title, children }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color="#a5b4fc" />
      </div>
      <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {children}
    </div>
  </div>
)

const SettingRow = ({ title, desc, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{desc}</div>
    </div>
    <div>{children}</div>
  </div>
)

const Toggle = ({ checked, onChange, disabled, ariaLabel }) => (
  <button 
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    style={{ 
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: disabled ? 'wait' : 'pointer', position: 'relative', flexShrink: 0,
      background: checked ? 'var(--green)' : 'var(--border)', transition: 'all 0.3s',
      opacity: disabled ? 0.6 : 1
    }}
  >
    <div style={{ 
      position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, 
      borderRadius: '50%', background: 'white', transition: 'all 0.3s' 
    }} />
  </button>
)

const Select = ({ value, onChange, options }) => (
  <select 
    value={value} 
    onChange={e => onChange(e.target.value)}
    style={{ 
      padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, 
      color: 'var(--text)', fontSize: 14, outline: 'none', cursor: 'pointer', minWidth: 140
    }}
  >
    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
  </select>
)

const NumberInput = ({ value, onChange, min, max, step = 1 }) => (
  <input 
    type="number" min={min} max={max} step={step}
    value={value} onChange={e => onChange(parseInt(e.target.value) || min)}
    style={{ 
      width: 80, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', 
      borderRadius: 8, color: 'var(--text)', fontSize: 14, textAlign: 'center', outline: 'none' 
    }} 
  />
)

const TextInput = ({ value, onChange, type = "text" }) => (
  <input 
    type={type} value={value} onChange={e => onChange(e.target.value)}
    style={{ 
      width: 140, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', 
      borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none' 
    }} 
  />
)

const ActionButton = ({ onClick, children, variant = 'primary', disabled = false, title = '' }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{ 
      padding: '8px 16px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', 
      fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
      background: disabled ? 'var(--border)' : (variant === 'danger' ? 'color-mix(in srgb, var(--red) 13%, transparent)' : 'color-mix(in srgb, var(--accent) 13%, transparent)'), 
      color: disabled ? 'var(--muted)' : (variant === 'danger' ? 'var(--red)' : 'var(--accent2)'),
      opacity: disabled ? 0.7 : 1
    }}
  >
    {children}
  </button>
)

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0f172a', padding: 24, borderRadius: 16, width: 450, maxWidth: '90%', border: '1px solid var(--border)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: 18, fontFamily: 'Space Grotesk', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, signOut, signIn } = useAuth()
  
  const { settings, updateSetting, updateMultipleSettings } = useSettings()
  const [showKey, setShowKey] = useState(false)

  // Security Modal States
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false)
  
  // Password State
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confPwd, setConfPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  // Sessions State
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const currentSessionId = sessionStorage.getItem('neogravix_session_id')

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all preferences to their default values?')) {
      updateMultipleSettings(DEFAULT_SETTINGS)
    }
  }

  const update = (key) => (val) => updateSetting(key, val)

  const [accessLoading, setAccessLoading] = useState(false)
  const [perfLoading, setPerfLoading] = useState(false)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [appearLoading, setAppearLoading] = useState(false)

  useEffect(() => {
    if (user?.id) {
      Promise.all([
        getPerformanceSettings(user.id),
        getNotificationSettings(user.id),
        getAppearanceSettings(user.id)
      ]).then(([perfSettings, notifySettings, appearSettings]) => {
        updateMultipleSettings({ ...perfSettings, ...notifySettings, ...appearSettings });
      }).catch(err => console.error('Error loading settings', err));
    }
  }, [user?.id]);

  const announce = (message) => {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) liveRegion.textContent = message;
  }

  const updateAccess = (key) => async (val) => {
    const prev = { ...settings }
    updateSetting(key, val)
    
    setAccessLoading(true)
    try {
      const newSettings = {
        highContrast: key === 'highContrast' ? val : settings.highContrast,
        largerText: key === 'largerText' ? val : settings.largerText,
        reducedMotion: key === 'reducedMotion' ? val : settings.reducedMotion,
        keyboardNav: key === 'keyboardNav' ? val : settings.keyboardNav,
        screenReader: key === 'screenReader' ? val : settings.screenReader,
      }
      await updateAccessibilitySettings(user.id, newSettings);
      announce(`${key} setting updated successfully.`);
    } catch (err) {
      updateSetting(key, prev[key])
      announce(`Error updating ${key} setting.`);
    } finally {
      setAccessLoading(false)
    }
  }

  const updatePerf = (key) => async (val) => {
    const prev = { ...settings }
    updateSetting(key, val)
    
    setPerfLoading(true)
    try {
      const newSettings = {
        perfAccuracy: key === 'perfAccuracy' ? val : settings.perfAccuracy,
        perfTime: key === 'perfTime' ? val : settings.perfTime,
        perfSubject: key === 'perfSubject' ? val : settings.perfSubject,
        perfWeak: key === 'perfWeak' ? val : settings.perfWeak,
        perfRank: key === 'perfRank' ? val : settings.perfRank,
      }
      await updatePerformanceSettings(user.id, newSettings);
      announce(`${key} setting updated successfully.`);
    } catch (err) {
      updateSetting(key, prev[key])
      announce(`Error updating ${key} setting.`);
    } finally {
      setPerfLoading(false)
    }
  }

  const updateAppearance = (key) => async (val) => {
    const prev = { ...settings }
    updateSetting(key, val)
    
    setAppearLoading(true)
    try {
      const newSettings = {
        theme: key === 'theme' ? val : settings.theme,
        accentColor: key === 'accentColor' ? val : settings.accentColor,
        compactLayout: key === 'compactLayout' ? val : settings.compactLayout,
        animations: key === 'animations' ? val : settings.animations,
      }
      await updateAppearanceSettings(user.id, newSettings);
      announce(`${key} setting updated successfully.`);
    } catch (err) {
      updateSetting(key, prev[key])
      announce(`Error updating ${key} setting.`);
    } finally {
      setAppearLoading(false)
    }
  }

  const updateNotify = (key) => async (val) => {
    // Handling push notifications permission
    if (key === 'notifyPush' && val === true) {
      if (!('Notification' in window)) {
        announce('Browser does not support notifications.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        announce('Notification permission denied.');
        val = false; // Override the value to false
      } else {
        // If granted, we can try to subscribe via service worker
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            // Mock VAPID key for local development or if absent
            // const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: '...' })
            // await subscribeToPush(user.id, sub)
          } catch (e) {
            console.error(e)
          }
        }
      }
    }

    const prev = { ...settings }
    updateSetting(key, val)
    
    setNotifyLoading(true)
    try {
      const newSettings = {
        notifyPush: key === 'notifyPush' ? val : settings.notifyPush,
        notifyEmail: key === 'notifyEmail' ? val : settings.notifyEmail,
        notifyDaily: key === 'notifyDaily' ? val : settings.notifyDaily,
        dailyReminderTime: key === 'dailyReminderTime' ? val : settings.dailyReminderTime,
        dailyReminderTz: key === 'dailyReminderTz' ? val : settings.dailyReminderTz,
        notifyMockTest: key === 'notifyMockTest' ? val : settings.notifyMockTest,
        notifyNewTest: key === 'notifyNewTest' ? val : settings.notifyNewTest,
        notifyResult: key === 'notifyResult' ? val : settings.notifyResult,
      }
      await updateNotificationSettings(user.id, newSettings);
      announce(`${key} setting updated successfully.`);
    } catch (err) {
      updateSetting(key, prev[key])
      announce(`Error updating ${key} setting.`);
    } finally {
      setNotifyLoading(false)
    }
  }

  // --- Backend Security Methods ---

  const checkPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // 0 to 5
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError(''); setPwdSuccess('');
    
    if (newPwd.length < 8) return setPwdError('New password must be at least 8 characters.');
    if (checkPasswordStrength(newPwd) < 4) return setPwdError('Password must contain uppercase, lowercase, number, and special character.');
    if (newPwd !== confPwd) return setPwdError('New passwords do not match.');
    
    setPwdLoading(true);
    // 1. Verify current password
    const { error: verifyError } = await signIn(user.email, curPwd);
    
    if (verifyError) {
      setPwdError('Current password is incorrect.');
      setPwdLoading(false);
      return;
    }

    // 2. Update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPwd });
    
    if (updateError) {
      setPwdError(updateError.message);
      setPwdLoading(false);
    } else {
      setPwdSuccess('Password changed successfully! Logging you out...');
      setTimeout(() => {
        signOut();
      }, 2000);
    }
  }

  const fetchSessions = async () => {
    setSessionsLoading(true);
    const { data, error } = await supabase.from('user_sessions').select('*').eq('user_id', user.id).order('last_active', { ascending: false });
    if (!error && data) {
      setSessions(data);
    }
    setSessionsLoading(false);
  }

  const handleOpenSessions = () => {
    setSessionsModalOpen(true);
    fetchSessions();
  }

  const handleLogoutIndividualSession = async (id) => {
    if (window.confirm('Are you sure you want to log out this device?')) {
      await supabase.from('user_sessions').delete().eq('id', id);
      fetchSessions();
    }
  }

  const handleLogoutAll = async () => {
    if (window.confirm('WARNING: This action will sign you out from every device, including this one. Proceed?')) {
      try {
        // Delete all DB sessions
        await supabase.from('user_sessions').delete().eq('user_id', user.id);
        // Revoke tokens globally in Supabase
        await supabase.auth.signOut({ scope: 'global' });
      } catch (e) {}
      // Clear all local state
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
      
      {/* Modals */}
      <Modal isOpen={pwdModalOpen} onClose={() => setPwdModalOpen(false)} title="Change Password">
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pwdError && <div style={{ padding: 12, background: 'color-mix(in srgb, var(--red) 13%, transparent)', color: 'var(--red)', borderRadius: 8, fontSize: 13 }}>{pwdError}</div>}
          {pwdSuccess && <div style={{ padding: 12, background: 'color-mix(in srgb, var(--green) 13%, transparent)', color: 'var(--green)', borderRadius: 8, fontSize: 13 }}>{pwdSuccess}</div>}
          
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Current Password</label>
            <input type={showPwd ? 'text' : 'password'} value={curPwd} onChange={e=>setCurPwd(e.target.value)} required style={{ width: '100%', padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'white', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>New Password</label>
            <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e=>setNewPwd(e.target.value)} required style={{ width: '100%', padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'white', outline: 'none' }} />
            {newPwd && (
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= checkPasswordStrength(newPwd) ? (checkPasswordStrength(newPwd) > 3 ? 'var(--green)' : 'var(--yellow)') : 'var(--border)' }} />
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Confirm New Password</label>
            <input type={showPwd ? 'text' : 'password'} value={confPwd} onChange={e=>setConfPwd(e.target.value)} required style={{ width: '100%', padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'white', outline: 'none' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -4 }}>
            <input type="checkbox" id="showpwd" checked={showPwd} onChange={e=>setShowPwd(e.target.checked)} />
            <label htmlFor="showpwd" style={{ fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>Show Passwords</label>
          </div>

          <button disabled={pwdLoading || pwdSuccess} type="submit" style={{ padding: '12px', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: pwdLoading ? 'not-allowed' : 'pointer', marginTop: 8 }}>
            {pwdLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={sessionsModalOpen} onClose={() => setSessionsModalOpen(false)} title="Active Sessions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessionsLoading ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading sessions...</div> : 
            sessions.map(s => {
              const isCurrent = s.id === currentSessionId;
              return (
                <div key={s.id} style={{ padding: 16, background: isCurrent ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--surface2)', border: `1px solid ${isCurrent ? 'color-mix(in srgb, var(--accent) 31%, transparent)' : 'var(--border)'}`, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ padding: 8, background: '#0f172a', borderRadius: 8 }}>
                      {s.device_name === 'Mobile Device' ? <Smartphone size={20} color="#94a3b8" /> : <Laptop size={20} color="#94a3b8" />}
                    </div>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.os} - {s.browser} 
                        {isCurrent && <span style={{ fontSize: 10, background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: 10 }}>Current</span>}
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                        IP: {s.ip_address} &bull; Active: {new Date(s.last_active).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {!isCurrent && (
                    <button onClick={() => handleLogoutIndividualSession(s.id)} style={{ background: 'color-mix(in srgb, var(--red) 13%, transparent)', color: 'var(--red)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Logout
                    </button>
                  )}
                </div>
              )
            })
          }
          {sessions.length === 0 && !sessionsLoading && <div style={{ color: '#94a3b8', fontSize: 13 }}>No active sessions found.</div>}
        </div>
      </Modal>

      {/* Sticky Header */}
      <div style={{ 
        position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg)', 
        padding: '24px 0', marginBottom: 20, borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'
      }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 700, marginBottom: 6, color: 'white' }}>Settings</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Manage your application preferences and configuration.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleReset} style={{
            padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', 
            fontWeight: 600, fontSize: 14, background: 'var(--surface)', color: '#94a3b8', 
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
          }}>
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 60 }}>
        
        {/* 1. Study Preferences */}
        <SectionCard icon={BookOpen} title="Study Preferences">
          <SettingRow title="Daily Question Goal" desc="Target number of questions to solve daily">
            <NumberInput value={settings.dailyGoal} onChange={update('dailyGoal')} min={10} max={300} step={10} />
          </SettingRow>
          <SettingRow title="Daily Study Time Goal (hrs)" desc="Target hours to study daily">
            <NumberInput value={settings.dailyTimeGoal} onChange={update('dailyTimeGoal')} min={1} max={16} step={1} />
          </SettingRow>
          <SettingRow title="Preferred Study Time" desc="When do you usually practice?">
            <TextInput type="time" value={settings.preferredStudyTime} onChange={update('preferredStudyTime')} />
          </SettingRow>
          <SettingRow title="Study Reminder" desc="Receive daily notifications to reach your goal">
            <Toggle checked={settings.studyReminder} onChange={update('studyReminder')} />
          </SettingRow>
          <SettingRow title="Weekend Reminder" desc="Enable notifications during weekends">
            <Toggle checked={settings.weekendReminder} onChange={update('weekendReminder')} />
          </SettingRow>
        </SectionCard>

        {/* 2. Test Preferences */}
        <SectionCard icon={FileText} title="Test Preferences">
          <SettingRow title="Default Test Language" desc="Preferred language for questions">
            <Select value={settings.defaultLanguage} onChange={update('defaultLanguage')} options={['English', 'Hindi', 'Gujarati', 'Bengali', 'Tamil']} />
          </SettingRow>
          <SettingRow title="Font Size" desc="Text size during exam mode">
            <Select value={settings.fontSize} onChange={update('fontSize')} options={['Small', 'Medium', 'Large']} />
          </SettingRow>
          <SettingRow title="Auto Save Answers" desc="Automatically save progress during test">
            <Toggle checked={settings.autoSaveAnswers} onChange={update('autoSaveAnswers')} />
          </SettingRow>
          <SettingRow title="Confirm Before Submit" desc="Show confirmation dialog before ending test">
            <Toggle checked={settings.confirmSubmit} onChange={update('confirmSubmit')} />
          </SettingRow>
          <SettingRow title="Show Question Timer" desc="Display time spent on current question">
            <Toggle checked={settings.showTimer} onChange={update('showTimer')} />
          </SettingRow>
          <SettingRow title="Show Remaining Questions" desc="Display total questions remaining">
            <Toggle checked={settings.showRemaining} onChange={update('showRemaining')} />
          </SettingRow>
          <SettingRow title="Enable Keyboard Shortcuts" desc="Use arrows to navigate and A/B/C/D to answer">
            <Toggle checked={settings.enableShortcuts} onChange={update('enableShortcuts')} />
          </SettingRow>
          <SettingRow title="Default Calculator" desc="Enable on-screen calculator by default">
            <Toggle checked={settings.defaultCalculator} onChange={update('defaultCalculator')} />
          </SettingRow>
        </SectionCard>

        {/* 3. Question Palette */}
        <SectionCard icon={Layout} title="Question Palette">
          <SettingRow title="Palette Position" desc="Location of the question grid on screen">
            <Select value={settings.palettePosition} onChange={update('palettePosition')} options={['Left', 'Right', 'Bottom']} />
          </SettingRow>
          <SettingRow title="Group Questions Subject-wise" desc="Divide grid into Physics, Chemistry, Biology">
            <Toggle checked={settings.groupSubject} onChange={update('groupSubject')} />
          </SettingRow>
          <SettingRow title="Collapse Completed Subjects" desc="Auto-collapse subject sections when all answered">
            <Toggle checked={settings.collapseCompleted} onChange={update('collapseCompleted')} />
          </SettingRow>
          <SettingRow title="Show Subject Progress" desc="Show progress bar for each subject">
            <Toggle checked={settings.showSubjectProgress} onChange={update('showSubjectProgress')} />
          </SettingRow>
          <SettingRow title="Show Answered Count" desc="Display total questions answered per subject">
            <Toggle checked={settings.showAnsweredCount} onChange={update('showAnsweredCount')} />
          </SettingRow>
          <SettingRow title="Show Status Legend" desc="Display the color-coded guide at the top">
            <Toggle checked={settings.showStatusLegend} onChange={update('showStatusLegend')} />
          </SettingRow>
        </SectionCard>

        {/* 4. Appearance */}
        <SectionCard icon={Palette} title="Appearance">
          <SettingRow title="Theme" desc="Overall application theme color">
            <Select value={settings.theme} onChange={updateAppearance('theme')} options={['Dark Mode', 'Light Mode', 'System Default']} />
          </SettingRow>
          <SettingRow title="Accent Color" desc="Primary brand color">
            <Select value={settings.accentColor} onChange={updateAppearance('accentColor')} options={['Blue', 'Purple', 'Green', 'Red', 'Orange', 'Teal']} />
          </SettingRow>
          <SettingRow title="Compact Layout" desc="Reduce padding to fit more content">
            <Toggle checked={settings.compactLayout} onChange={updateAppearance('compactLayout')} disabled={appearLoading} />
          </SettingRow>
          <SettingRow title="UI Animations" desc="Enable page transitions and hover effects">
            <Toggle checked={settings.animations} onChange={updateAppearance('animations')} disabled={appearLoading} />
          </SettingRow>
        </SectionCard>

        {/* 5. Notifications */}
        <SectionCard icon={Bell} title="Notifications">
          <SettingRow title="Push Notifications" desc="Enable browser push notifications">
            <Toggle checked={settings.notifyPush} onChange={updateNotify('notifyPush')} disabled={notifyLoading} />
          </SettingRow>
          <SettingRow title="Email Notifications" desc="Receive important updates via email">
            <Toggle checked={settings.notifyEmail} onChange={updateNotify('notifyEmail')} disabled={notifyLoading} />
          </SettingRow>
          <SettingRow title="Daily Practice Reminder" desc="Notification to maintain study streak">
            <Toggle checked={settings.notifyDaily} onChange={updateNotify('notifyDaily')} disabled={notifyLoading} />
          </SettingRow>
          {settings.notifyDaily && (
            <div style={{ marginLeft: 24, padding: '16px 20px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>Reminder Time</div>
                <input 
                  type="time" 
                  value={settings.dailyReminderTime || '18:00'} 
                  onChange={(e) => updateNotify('dailyReminderTime')(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>Time Zone</div>
                <Select 
                  value={settings.dailyReminderTz || Intl.DateTimeFormat().resolvedOptions().timeZone} 
                  onChange={updateNotify('dailyReminderTz')} 
                  options={[
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo'
                  ]}
                />
              </div>
            </div>
          )}
          <SettingRow title="Mock Test Reminder" desc="Upcoming mock test alerts">
            <Toggle checked={settings.notifyMockTest} onChange={updateNotify('notifyMockTest')} disabled={notifyLoading} />
          </SettingRow>
          <SettingRow title="New Test Available" desc="Alert when teacher assigns a new mock test">
            <Toggle checked={settings.notifyNewTest} onChange={updateNotify('notifyNewTest')} disabled={notifyLoading} />
          </SettingRow>
          <SettingRow title="Result Notifications" desc="Get notified when test results are ready">
            <Toggle checked={settings.notifyResult} onChange={updateNotify('notifyResult')} disabled={notifyLoading} />
          </SettingRow>
        </SectionCard>

        {/* 6. Performance Dashboard */}
        <SectionCard icon={BarChart2} title="Performance Dashboard">
          <SettingRow title="Show Accuracy %" desc="Display total correct vs attempted ratio">
            <Toggle checked={settings.perfAccuracy} onChange={updatePerf('perfAccuracy')} disabled={perfLoading} ariaLabel="Toggle Accuracy" />
          </SettingRow>
          <SettingRow title="Show Time Analysis" desc="Display time spent per question and subject">
            <Toggle checked={settings.perfTime} onChange={updatePerf('perfTime')} disabled={perfLoading} ariaLabel="Toggle Time Analysis" />
          </SettingRow>
          <SettingRow title="Show Subject Analysis" desc="Display radar charts for subject performance">
            <Toggle checked={settings.perfSubject} onChange={updatePerf('perfSubject')} disabled={perfLoading} ariaLabel="Toggle Subject Analysis" />
          </SettingRow>
          <SettingRow title="Show Weak Areas" desc="AI-generated list of topics to focus on">
            <Toggle checked={settings.perfWeak} onChange={updatePerf('perfWeak')} disabled={perfLoading} ariaLabel="Toggle Weak Areas" />
          </SettingRow>
          <SettingRow title="Show Rank Comparison" desc="Compare your scores with top performers">
            <Toggle checked={settings.perfRank} onChange={updatePerf('perfRank')} disabled={perfLoading} ariaLabel="Toggle Rank Comparison" />
          </SettingRow>
        </SectionCard>

        {/* 7. Accessibility */}
        <SectionCard icon={Accessibility} title="Accessibility">
          <SettingRow title="High Contrast Mode" desc="Increase text contrast for better readability">
            <Toggle checked={settings.highContrast} onChange={updateAccess('highContrast')} disabled={accessLoading} ariaLabel="Toggle High Contrast Mode" />
          </SettingRow>
          <SettingRow title="Larger Text" desc="Scale up all UI text universally">
            <Toggle checked={settings.largerText} onChange={updateAccess('largerText')} disabled={accessLoading} ariaLabel="Toggle Larger Text" />
          </SettingRow>
          <SettingRow title="Reduced Motion" desc="Disable all non-essential animations">
            <Toggle checked={settings.reducedMotion} onChange={updateAccess('reducedMotion')} disabled={accessLoading} ariaLabel="Toggle Reduced Motion" />
          </SettingRow>
          <SettingRow title="Keyboard Navigation" desc="Enhance keyboard focus indicators">
            <Toggle checked={settings.keyboardNav} onChange={updateAccess('keyboardNav')} disabled={accessLoading} ariaLabel="Toggle Keyboard Navigation" />
          </SettingRow>
          <SettingRow title="Screen Reader Friendly" desc="Optimize ARIA labels for screen readers">
            <Toggle checked={settings.screenReader} onChange={updateAccess('screenReader')} disabled={accessLoading} ariaLabel="Toggle Screen Reader Friendly" />
          </SettingRow>
        </SectionCard>

        {/* 8. Security */}
        <SectionCard icon={Shield} title="Security">
          <SettingRow title="Change Password" desc="Update your account password regularly">
            <ActionButton onClick={() => setPwdModalOpen(true)}>Change</ActionButton>
          </SettingRow>
          <SettingRow title="Two-Factor Authentication" desc="Add an extra layer of security">
            <ActionButton disabled={true} title="Two-Factor Authentication will be available in a future update.">Coming Soon</ActionButton>
          </SettingRow>
          <SettingRow title="Active Sessions" desc="View devices currently logged in">
            <ActionButton onClick={handleOpenSessions}>View Devices</ActionButton>
          </SettingRow>
          <SettingRow title="Logout From All Devices" desc="Instantly end all active sessions globally">
            <ActionButton variant="danger" onClick={handleLogoutAll}>Logout All</ActionButton>
          </SettingRow>
        </SectionCard>

        {/* 9. About */}
        <SectionCard icon={Info} title="About">
          <SettingRow title="App Version" desc="Current build and release notes">
            <div style={{ fontSize: 13, color: '#a5b4fc', fontWeight: 600 }}>v2.5.0 (Stable)</div>
          </SettingRow>
          <SettingRow title="Privacy Policy" desc="How we handle and protect your data">
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ 
              display: 'inline-block', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', 
              fontSize: 13, fontWeight: 600, background: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent2)' 
            }}>
              View Policy
            </a>
          </SettingRow>
          <SettingRow title="Terms & Conditions" desc="Rules and guidelines for using the platform">
            <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" style={{ 
              display: 'inline-block', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', 
              fontSize: 13, fontWeight: 600, background: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent2)' 
            }}>
              View Terms
            </a>
          </SettingRow>
          <SettingRow title="Help & Support" desc="Contact our 24/7 student support team">
            <ActionButton onClick={(e) => {
              const subject = 'Help & Support Request';
              const body = `Hello Neogravix Support Team,\n\nI need help with:\n\nDevice:\nBrowser:\nRegistered Email:\nDescription:\n\nThank you.`;
              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=Neogravix@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              
              const newWindow = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
              if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                window.location.href = `mailto:Neogravix@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              }
            }}>Get Help</ActionButton>
          </SettingRow>
          <SettingRow title="Report Bug" desc="Found an issue? Let us know">
            <ActionButton onClick={(e) => {
              const subject = 'Bug Report';
              const body = `Hello Neogravix Team,\n\nBug Description:\n\nSteps to Reproduce:\n1.\n2.\n3.\n\nExpected Behaviour:\n\nActual Behaviour:\n\nBrowser:\nDevice:\nScreenshot (if any):`;
              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=Neogravix@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              
              const newWindow = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
              if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                window.location.href = `mailto:Neogravix@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              }
            }}>Report</ActionButton>
          </SettingRow>
        </SectionCard>



      </div>
    </div>
  )
}
