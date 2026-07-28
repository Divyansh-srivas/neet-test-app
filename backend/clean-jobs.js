import { supabaseAdmin } from './config/supabase.js';

async function cleanJobs() {
    console.log("Cleaning up stuck processing jobs...");
    const { data, error } = await supabaseAdmin
        .from('jobs')
        .update({ status: 'failed', error_message: 'Job cancelled due to server restart.' })
        .in('status', ['processing', 'queued']);
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Cleanup complete!");
    }
}

cleanJobs();
