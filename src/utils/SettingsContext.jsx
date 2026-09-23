import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getUserSettings, updateUserSettings } from '../api/settings';
import { DEFAULT_SETTINGS } from './storage';

const SettingsContext = createContext({});

export const useSettings = () => useContext(SettingsContext);

// Helper to get the user-scoped settings key
const settingsKey = (uid) => uid ? `ntp_settings_${uid}` : null;

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [toastMessage, setToastMessage] = useState(null);

  // When user changes, load their scoped settings
  useEffect(() => {
    if (user?.uid) {
      // Load from user-scoped localStorage first for instant render
      try {
        const key = settingsKey(user.uid);
        const local = key ? localStorage.getItem(key) : null;
        if (local) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(local) });
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }

      // Then fetch from server
      getUserSettings(user.id || user.uid).then(fetchedSettings => {
        setSettings(fetchedSettings);
        const key = settingsKey(user.uid);
        if (key) localStorage.setItem(key, JSON.stringify(fetchedSettings));
      });
    } else {
      // No user — reset to defaults, don't touch localStorage
      setSettings(DEFAULT_SETTINGS);
    }
  }, [user?.uid]);

  const showToast = (message, isError = false) => {
    setToastMessage({ message, isError });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const updateSetting = useCallback(async (key, value) => {
    const prev = { ...settings };
    const next = { ...prev, [key]: value };
    
    // Optimistic UI update
    setSettings(next);
    const storageKeyStr = settingsKey(user?.uid);
    if (storageKeyStr) localStorage.setItem(storageKeyStr, JSON.stringify(next));

    if (user?.id || user?.uid) {
      try {
        await updateUserSettings(user.id || user.uid, next);
        showToast('Settings saved');
      } catch (err) {
        // Rollback
        setSettings(prev);
        if (storageKeyStr) localStorage.setItem(storageKeyStr, JSON.stringify(prev));
        showToast('Failed to save settings', true);
      }
    }
  }, [settings, user?.uid, user?.id]);

  const updateMultipleSettings = useCallback(async (newSettingsPartial) => {
    const prev = { ...settings };
    const next = { ...prev, ...newSettingsPartial };
    
    setSettings(next);
    const storageKeyStr = settingsKey(user?.uid);
    if (storageKeyStr) localStorage.setItem(storageKeyStr, JSON.stringify(next));

    if (user?.id || user?.uid) {
      try {
        await updateUserSettings(user.id || user.uid, next);
        showToast('Settings saved');
      } catch (err) {
        setSettings(prev);
        if (storageKeyStr) localStorage.setItem(storageKeyStr, JSON.stringify(prev));
        showToast('Failed to save settings', true);
      }
    }
  }, [settings, user?.uid, user?.id]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, updateMultipleSettings, showToast }}>
      {children}
      {/* Toast UI */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          background: toastMessage.isError ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '12px 24px', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: 14, fontWeight: 600,
          animation: 'toast-fadein 0.3s, toast-fadeout 0.3s 2.7s'
        }}>
          {toastMessage.message}
          <style>{`
            @keyframes toast-fadein { from { bottom: 0; opacity: 0; } to { bottom: 20px; opacity: 1; } }
            @keyframes toast-fadeout { from { bottom: 20px; opacity: 1; } to { bottom: 0; opacity: 0; } }
          `}</style>
        </div>
      )}
    </SettingsContext.Provider>
  );
};
