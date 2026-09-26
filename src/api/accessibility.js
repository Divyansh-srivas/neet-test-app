import { supabase } from '../utils/supabaseClient'

/**
 * Simulates a GET /api/settings/accessibility endpoint
 */
export const getAccessibilitySettings = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('accessibility_settings')
    .eq('id', userId)
    .maybeSingle()
  
  if (error) throw error;
  return data?.accessibility_settings || {};
}

/**
 * Simulates a PUT /api/settings/accessibility endpoint
 */
export const updateAccessibilitySettings = async (userId, settings) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ accessibility_settings: settings })
    .eq('id', userId)
    .select('accessibility_settings')
    .maybeSingle()
    
  if (error) throw error;
  return data?.accessibility_settings || {};
}
