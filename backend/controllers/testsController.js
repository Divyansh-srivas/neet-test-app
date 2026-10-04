import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const deleteTest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id; // From Firebase auth middleware

        // Delete test where id matches AND teacher_id matches the authenticated user
        const { error } = await supabaseAdmin
            .from('tests')
            .delete()
            .eq('id', id)
            .eq('teacher_id', userId);

        if (error) {
            logger.error(`Failed to delete test ${id} for user ${userId}: ${error.message}`);
            return res.status(500).json({ success: false, error: error.message });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        logger.error(`Error in deleteTest: ${error.message}`);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

export const getTests = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const { data, error } = await supabaseAdmin
            .from('tests')
            .select('*')
            .eq('teacher_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) {
            logger.error(`Failed to fetch tests for user ${userId}: ${error.message}`);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        res.status(200).json(data || []);
    } catch (error) {
        logger.error(`Error in getTests: ${error.message}`);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};
