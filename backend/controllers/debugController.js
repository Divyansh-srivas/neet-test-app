import { supabaseAdmin } from '../config/supabase.js';

export const checkSchema = async (req, res) => {
    try {
        // Fallback: try an invalid uuid query to see if it throws
        const { error: queryErr } = await supabaseAdmin.from('jobs').select('id').eq('user_id', 'tM5Rz1p5B6V0abcdefghijklmnop').limit(1);
        
        res.json({ 
            queryError: queryErr ? queryErr.message : 'No error with text query' 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
