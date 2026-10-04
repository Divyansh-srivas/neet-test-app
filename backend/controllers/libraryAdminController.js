import { supabaseAdmin } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const ADMIN_EMAIL = 'gauravpatel5876@gmail.com';

const isAdmin = (req) => {
    return req.user && req.user.email === ADMIN_EMAIL;
};

export const getSubjects = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { data, error } = await supabaseAdmin.from('library_subjects').select('*').order('id');
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const getChapters = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { data, error } = await supabaseAdmin.from('library_chapters').select('*').order('order_index');
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const createChapter = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { subject_id, name, order_index } = req.body;
        const { data, error } = await supabaseAdmin.from('library_chapters').insert({ subject_id, name, order_index }).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const updateChapter = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { name, order_index } = req.body;
        const { data, error } = await supabaseAdmin.from('library_chapters').update({ name, order_index }).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const deleteChapter = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin.from('library_chapters').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const getQuestions = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { chapter_id } = req.query;
        let query = supabaseAdmin.from('library_questions').select('*').order('created_at');
        if (chapter_id) query = query.eq('chapter_id', chapter_id);
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const createQuestion = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const questionData = req.body;
        const { data, error } = await supabaseAdmin.from('library_questions').insert(questionData).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const updateQuestion = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const questionData = req.body;
        const { data, error } = await supabaseAdmin.from('library_questions').update(questionData).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const deleteQuestion = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin.from('library_questions').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const uploadImage = async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileName = `library-images/${uuidv4()}_${Date.now()}.png`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('uploads')
            .upload(fileName, fileBuffer, { contentType: req.file.mimetype, upsert: true });

        // Clean up temp file
        try { fs.unlinkSync(req.file.path); } catch (e) {}

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName);
        res.json({ url: publicUrlData.publicUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
