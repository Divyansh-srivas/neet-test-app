import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://lroblmoznwogphurrxst.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Mark all stale "processing" / "queued" jobs as "failed" 
// so the frontend stops showing phantom progress widgets
const { data, error } = await supabase
    .from('jobs')
    .update({ 
        status: 'failed', 
        error_message: 'Job was orphaned (backend restarted). Please re-upload.',
        progress: 0 
    })
    .in('status', ['processing', 'queued'])
    .select('id, status');

if (error) {
    console.error('Error cleaning jobs:', error.message);
} else {
    console.log(`Cleaned ${data?.length || 0} orphaned jobs:`, data?.map(j => j.id));
}

process.exit(0);
