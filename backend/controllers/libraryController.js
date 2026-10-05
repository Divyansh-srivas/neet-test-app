import { supabaseAdmin } from '../config/supabase.js';

export const getStudyMaterials = async (req, res) => {
    try {
        const { subject } = req.params;
        
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
        const { subject } = req.params;
        
        const { data: subjectData } = await supabaseAdmin.from('library_subjects').select('id').ilike('name', subject).single();
        if (!subjectData) return res.json([]);

        const { data: chapters } = await supabaseAdmin.from('library_chapters').select('*').eq('subject_id', subjectData.id).order('order_index');
        
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

/**
 * POST /api/library/practice/generate
 * Body: {
 *   selections: [
 *     { subjectName: "Physics", chapterIds: ["uuid1", "uuid2"], count: 10 },
 *     { subjectName: "Chemistry", chapterIds: ["uuid3"], count: 5 }
 *   ]
 * }
 */
export const generatePracticeQuiz = async (req, res) => {
    try {
        const { selections } = req.body;
        if (!selections || !Array.isArray(selections) || selections.length === 0) {
            return res.status(400).json({ error: 'No selections provided' });
        }

        const allQuestions = [];
        const notices = [];

        for (const sel of selections) {
            const { subjectName, chapterIds, count } = sel;
            if (!chapterIds || chapterIds.length === 0 || !count || count < 1) continue;

            // Fetch all questions from the selected chapters for this subject
            const { data: pool, error } = await supabaseAdmin
                .from('library_questions')
                .select('*')
                .in('chapter_id', chapterIds);

            if (error) throw error;

            // Fisher-Yates shuffle
            const shuffled = [...(pool || [])];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            const actualCount = Math.min(count, shuffled.length);
            if (actualCount < count) {
                notices.push(`Only ${actualCount} question${actualCount !== 1 ? 's' : ''} available for ${subjectName} — using all ${actualCount}.`);
            }

            const sampled = shuffled.slice(0, actualCount).map(q => ({ ...q, _subject: subjectName }));
            allQuestions.push(...sampled);
        }

        if (allQuestions.length === 0) {
            return res.status(422).json({ error: 'No questions available for the selected chapters.' });
        }

        res.json({ questions: allQuestions, notices });
    } catch (error) {
        console.error('generatePracticeQuiz error:', error);
        res.status(500).json({ error: error.message });
    }
};
