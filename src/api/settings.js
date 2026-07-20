import { supabase } from '../utils/supabaseClient';
import { DEFAULT_SETTINGS } from '../utils/storage';

export const getUserSettings = async (userId) => {
  let settings = { ...DEFAULT_SETTINGS };

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('accessibility_settings')
        .eq('id', userId)
        .single();

      if (!error && data?.accessibility_settings) {
        settings = { ...DEFAULT_SETTINGS, ...data.accessibility_settings };
      }
    } catch (err) {
      console.error("Failed to fetch user settings:", err);
    }
  }
  return settings;
};

export const updateUserSettings = async (userId, settings) => {
  if (!userId) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ accessibility_settings: settings })
      .eq('id', userId);

    if (error) throw error;
  } catch (err) {
    console.error("Failed to update user settings:", err);
    throw err;
  }
};
