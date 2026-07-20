import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

// Service role client for background workers to bypass RLS securely
export const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

// Helper to create a user-scoped client for API routes
export const createScopedClient = (token) => {
    return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });
};
