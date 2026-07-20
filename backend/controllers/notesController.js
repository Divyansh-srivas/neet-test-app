import { createScopedClient } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const getNotes = async (req, res, next) => {
    try {
        const supabase = createScopedClient(req.token);
        const { testId } = req.params;
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('test_notes')
            .select('content')
            .eq('user_id', userId)
            .eq('test_id', testId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({ notes: data ? data.content : '' });
    } catch (error) {
        next(error);
    }
};

export const saveNotes = async (req, res, next) => {
    try {
        const supabase = createScopedClient(req.token);
        const { testId } = req.params;
        const userId = req.user.id;
        const { content } = req.body;

        const { error } = await supabase
            .from('test_notes')
            .upsert({ 
                user_id: userId, 
                test_id: testId, 
                content,
                updated_at: new Date().toISOString()
            });

        if (error) {
            throw error;
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};
