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

export const getLibraryChapters = async (req, res) => {
    try {
        const { subject } = req.params; // Physics, Chemistry, Biology
        
        // Find subject id
        const { data: subjectData } = await supabaseAdmin.from('library_subjects').select('id').ilike('name', subject).single();
        if (!subjectData) return res.json([]);

        // Get chapters
        const { data: chapters } = await supabaseAdmin.from('library_chapters').select('*').eq('subject_id', subjectData.id).order('order_index');
        
        // Get question counts per chapter
        const { data: questions } = await supabaseAdmin.from('library_questions').select('chapter_id');
        const counts = {};
        questions.forEach(q => { counts[q.chapter_id] = (counts[q.chapter_id] || 0) + 1; });
        
        const enhancedChapters = chapters.map(c => ({ ...c, question_count: counts[c.id] || 0 }));
        res.json(enhancedChapters);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getLibraryPractice = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { data: questions, error } = await supabaseAdmin.from('library_questions').select('*').eq('chapter_id', chapterId).order('created_at');
        if (error) throw error;
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
