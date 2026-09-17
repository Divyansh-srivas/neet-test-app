import { createClient } from '@supabase/supabase-js';
import { config as envConfig } from './env.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || envConfig.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || envConfig.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey.includes('placeholder')) {
  console.error('[CRITICAL ENV ERROR] Supabase credentials missing or invalid:', {
    hasUrl: Boolean(supabaseUrl),
    hasKey: Boolean(supabaseServiceKey),
  });
}

// Service role client for background workers to bypass RLS securely
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Helper to create a user-scoped client for API routes
export const createScopedClient = (token) => {
    return createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder-key', {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false }
    });
};
