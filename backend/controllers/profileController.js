import { supabaseAdmin } from '../config/supabase.js';

export const getProfile = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', req.user.id).single();
        if (error) {
            if (error.code === 'PGRST116') {
                // Return a default profile if not found
                return res.json({ id: req.user.id, full_name: 'Student', role: 'student' });
            }
            throw error;
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const updates = { ...req.body };
        const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.user.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
