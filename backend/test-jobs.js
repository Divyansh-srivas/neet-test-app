import { supabaseAdmin } from './config/supabase.js';

async function testJobs() {
    const { data, error } = await supabaseAdmin.from('jobs').select('*').limit(1);
    console.log("Jobs data:", data);
    console.log("Jobs error:", error);
}

testJobs();
