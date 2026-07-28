import { supabaseAdmin } from './config/supabase.js';

async function test() {
    const { data, error } = await supabaseAdmin.from('uploads').insert({
        id: '123e4567-e89b-12d3-a456-426614174001',
        user_id: 'A166eykMtzZ508e6hZHlW5QviOj2',
        file_path: 'test.pdf'
    }).select();
    
    console.log("Insert Test:", data, error ? error.message : "Success");
}

test();
