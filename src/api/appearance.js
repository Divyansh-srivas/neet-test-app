import { supabase } from '../utils/supabaseClient';

const DEFAULT_SETTINGS = {
  theme: 'Dark Mode',
  accentColor: 'Blue',
  compactLayout: false,
  animations: true
};

// User-scoped appearance key
const appearanceKey = (uid) => uid ? `ntp_appearance_${uid}` : null;

export const getAppearanceSettings = async (userId, uid) => {
  // uid is the Firebase UID for localStorage scoping
  // userId is the Supabase profile ID for DB fetch
  const key = appearanceKey(uid || userId);
  const cached = key ? localStorage.getItem(key) : null;
  let settings = cached ? JSON.parse(cached) : DEFAULT_SETTINGS;

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('appearance_settings')
        .eq('id', userId)
        .single();

      if (!error && data?.appearance_settings) {
        settings = { ...DEFAULT_SETTINGS, ...data.appearance_settings };
        if (key) localStorage.setItem(key, JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent('appearanceUpdated', { detail: settings }));
      }
    } catch (err) {
      console.error("Failed to fetch appearance settings:", err);
    }
  }
  return settings;
};

export const updateAppearanceSettings = async (userId, settings, uid) => {
  const key = appearanceKey(uid || userId);
  if (key) localStorage.setItem(key, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('appearanceUpdated', { detail: settings }));

  if (!userId) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ appearance_settings: settings })
      .eq('id', userId);

    if (error) throw error;
  } catch (err) {
    console.error("Failed to update appearance settings:", err);
    throw err;
  }
};
