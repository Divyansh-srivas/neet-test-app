import { supabaseAdmin } from './config/supabase.js';

async function testJobsFull() {
    console.log("Running full query...");
    const { data, error } = await supabaseAdmin
        .from('jobs')
        .select('*')
        // Using a dummy UUID for test
        .eq('user_id', '123e4567-e89b-12d3-a456-426614174000')
        .order('created_at', { ascending: false });
        
    console.log("Data:", data);
    console.log("Error:", error);
}

testJobsFull();
