import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getUserSettings, updateUserSettings } from '../api/settings';
import { DEFAULT_SETTINGS } from './storage';

const SettingsContext = createContext({});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(() => {
    try {
      const local = localStorage.getItem('ntp_settings');
      return local ? { ...DEFAULT_SETTINGS, ...JSON.parse(local) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (user?.id) {
      getUserSettings(user.id).then(fetchedSettings => {
        setSettings(fetchedSettings);
        localStorage.setItem('ntp_settings', JSON.stringify(fetchedSettings));
      });
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [user?.id]);

  const showToast = (message, isError = false) => {
    setToastMessage({ message, isError });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const updateSetting = useCallback(async (key, value) => {
    const prev = { ...settings };
    const next = { ...prev, [key]: value };
    
    // Optimistic UI update
    setSettings(next);
    localStorage.setItem('ntp_settings', JSON.stringify(next));

    if (user?.id) {
      try {
        await updateUserSettings(user.id, next);
        showToast('Settings saved');
      } catch (err) {
        // Rollback
        setSettings(prev);
        localStorage.setItem('ntp_settings', JSON.stringify(prev));
        showToast('Failed to save settings', true);
      }
    }
  }, [settings, user?.id]);

  const updateMultipleSettings = useCallback(async (newSettingsPartial) => {
    const prev = { ...settings };
    const next = { ...prev, ...newSettingsPartial };
    
    setSettings(next);
    localStorage.setItem('ntp_settings', JSON.stringify(next));

    if (user?.id) {
      try {
        await updateUserSettings(user.id, next);
        showToast('Settings saved');
      } catch (err) {
        setSettings(prev);
        localStorage.setItem('ntp_settings', JSON.stringify(prev));
        showToast('Failed to save settings', true);
      }
    }
  }, [settings, user?.id]);

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
