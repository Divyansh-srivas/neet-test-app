import { supabase } from '../utils/supabaseClient';

const DEFAULT_SETTINGS = {
  theme: 'Dark Mode',
  accentColor: 'Blue',
  compactLayout: false,
  animations: true
};

export const getAppearanceSettings = async (userId) => {
  const cached = localStorage.getItem('ntp_appearance');
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
        localStorage.setItem('ntp_appearance', JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent('appearanceUpdated', { detail: settings }));
      }
    } catch (err) {
      console.error("Failed to fetch appearance settings:", err);
    }
  }
  return settings;
};

export const updateAppearanceSettings = async (userId, settings) => {
  localStorage.setItem('ntp_appearance', JSON.stringify(settings));
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

