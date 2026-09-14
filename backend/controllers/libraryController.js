import { supabaseAdmin } from '../config/supabase.js';

export const getStudyMaterials = async (req, res) => {
    try {
        const { subject } = req.params;
        
        // Fetch from Supabase
        const { data, error } = await supabaseAdmin
            .from('study_materials')
            .select('*')
            .eq('subject', subject.toLowerCase())
            .order('chapter_name', { ascending: true });

        if (error) {
            console.error('Supabase error fetching study materials:', error);
            return res.status(500).json({ error: 'Failed to fetch study materials' });
        }

        res.json({ materials: data || [] });
    } catch (error) {
        console.error('Error in getStudyMaterials:', error);
        res.status(500).json({ error: 'Server error fetching materials' });
    }
};
