import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const deleteTest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { error } = await supabaseAdmin.from('tests').delete().eq('id', id).eq('teacher_id', userId);

        if (error) {
            logger.error(Failed to delete test  for user : );
            return res.status(500).json({ success: false, error: error.message });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        logger.error(Error in deleteTest: );
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};
