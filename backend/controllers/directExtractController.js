import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import { extractQuestionsFromPDFBuffer, normalizeQuestions } from '../services/gemini.service.js';
import { getTotalPages } from '../services/pdf.service.js';
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';

/**
 * Direct PDF upload + extraction — NO BullMQ/Redis dependency.
 * Reads file → sends to Gemini → saves to DB → returns result.
 * Used for local dev and as fallback when Redis is unavailable.
 */
export const uploadAndExtractDirect = async (req, res, next) => {
    const startTime = Date.now();
    let jobId = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const userId = req.user.id;
        const { testName, duration } = req.body;
        const uploadId = uuidv4();
        jobId = uuidv4();

        // ─── 1. Save file locally ────────────────────────────────────
        const uploadDir = path.resolve('uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const finalPath = path.join(uploadDir, `${uploadId}.pdf`);
        fs.renameSync(req.file.path, finalPath);

        logger.info(`[DIRECT] PDF saved: ${finalPath}`);

        // ─── 2. Upload to Supabase Storage (non-blocking) ───────────
        const fileBuffer = fs.readFileSync(finalPath);
        const storagePath = `${userId}/${uploadId}.pdf`;
        
        supabaseAdmin.storage
            .from('uploads')
            .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: false })
            .then(({ error }) => { if (error) logger.warn(`Storage upload failed: ${error.message}`); })
            .catch(() => {});

        // ─── 3. Create upload + job records ──────────────────────────
        await supabaseAdmin.from('uploads').insert({
            id: uploadId,
            user_id: userId,
            original_name: req.file.originalname || 'upload.pdf',
            file_path: storagePath
        }).then(({ error }) => { if (error) logger.warn(`Upload record insert: ${error.message}`); });

        const totalPages = await getTotalPages(finalPath);

        await supabaseAdmin.from('jobs').insert({
            id: jobId,
            user_id: userId,
            upload_id: uploadId,
            status: 'processing',
            progress: 10,
            total_pages: totalPages
        });

        // Return immediately with jobId — frontend will poll for status
        res.status(202).json({ success: true, jobId });

        // ─── 4. Extract questions (async, after response sent) ───────
        logger.info(`[DIRECT] Starting extraction: ${totalPages} pages, ${fileBuffer.length} bytes`);

        // Emit socket progress
        const io = req.app.get('io');
        if (io) {
            io.to(userId).emit('job-progress', { 
                jobId, progress: 20, pagesCompleted: 0, totalPages, questionsExtracted: 0,
                status: 'AI is analyzing the PDF...' 
            });
        }

        await supabaseAdmin.from('jobs').update({ progress: 20 }).eq('id', jobId);

        // ─── 5. Call Gemini directly ─────────────────────────────────
        const rawQuestions = await extractQuestionsFromPDFBuffer(fileBuffer);
        
        logger.info(`[DIRECT] Gemini returned ${rawQuestions.length} questions`);

        if (rawQuestions.length === 0) {
            const errorMsg = `Extraction yielded 0 questions from ${totalPages} pages. Please verify PDF format.`;
            await supabaseAdmin.from('jobs').update({ status: 'failed', error_message: errorMsg }).eq('id', jobId);
            if (io) io.to(userId).emit('job-failed', { jobId, error: errorMsg });
            return;
        }

        // ─── 6. Process & normalize questions ────────────────────────
        if (io) {
            io.to(userId).emit('job-progress', { 
                jobId, progress: 70, pagesCompleted: totalPages, totalPages, 
                questionsExtracted: rawQuestions.length, status: 'Processing questions...' 
            });
        }

        const cleanedQuestions = rawQuestions.map(q => {
            let optionsObj = {};
            if (Array.isArray(q.options)) {
                q.options.forEach(opt => {
                    if (opt && opt.id) optionsObj[opt.id] = opt.text || '';
                });
            } else if (typeof q.options === 'object' && q.options !== null) {
                optionsObj = q.options;
            }

            if (!optionsObj.A) optionsObj.A = 'Option A';
            if (!optionsObj.B) optionsObj.B = 'Option B';
            if (!optionsObj.C) optionsObj.C = 'Option C';
            if (!optionsObj.D) optionsObj.D = 'Option D';

            return {
                id: uuidv4(),
                qNum: q.qNum || q.questionNumber || 0,
                subject: ['Physics', 'Chemistry', 'Biology'].includes(q.subject) ? q.subject : 'Physics',
                chapter: q.chapter || 'Uncategorized',
                difficulty: q.difficulty || 'Medium',
                question: (q.question || q.questionText || '').trim(),
                options: optionsObj,
                correct: (q.correct || q.correctAnswer || 'A').toString().toUpperCase().trim(),
                explanation: q.explanation || null,
                imageBox: q.imageBox || null,
                hasDiagram: q.hasDiagram || !!q.imageBox
            };
        }).filter(q => q.question.length > 0);

        // ─── 7. Save questions to DB ─────────────────────────────────
        if (io) {
            io.to(userId).emit('job-progress', { 
                jobId, progress: 85, pagesCompleted: totalPages, totalPages, 
                questionsExtracted: cleanedQuestions.length, status: 'Saving to database...' 
            });
        }

        for (const q of cleanedQuestions) {
            await supabaseAdmin.from('questions').insert({
                id: q.id,
                job_id: jobId,
                q_num: q.qNum,
                subject: q.subject,
                chapter: q.chapter,
                difficulty: q.difficulty,
                question_text: q.question,
                options: q.options,
                correct_option: q.correct,
                explanation: q.explanation
            });
        }

        // ─── 8. Get PDF URL ──────────────────────────────────────────
        let pdfUrl = null;
        const { data: signedData } = await supabaseAdmin.storage
            .from('uploads')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
        if (signedData?.signedUrl) {
            pdfUrl = signedData.signedUrl;
        } else {
            pdfUrl = `${config.SUPABASE_URL}/storage/v1/object/public/uploads/${storagePath}`;
        }

        const questionsWithPdf = cleanedQuestions.map(q => ({ ...q, pdfUrl }));

        // ─── 9. Create test record ───────────────────────────────────
        const { data: testRecord, error: testErr } = await supabaseAdmin.from('tests').insert({
            teacher_id: userId,
            name: testName || 'AI Extracted Test',
            questions: questionsWithPdf,
            total_questions: questionsWithPdf.length,
            is_published: true
        }).select().single();

        if (testErr) logger.warn(`Test record error: ${testErr.message}`);

        const finalTestId = testRecord?.id || null;

        // ─── 10. Mark job complete ───────────────────────────────────
        await supabaseAdmin.from('jobs').update({
            status: 'completed',
            progress: 100,
            extracted_questions: questionsWithPdf.length,
            test_id: finalTestId,
            completed_at: new Date().toISOString()
        }).eq('id', jobId);

        if (io) {
            io.to(userId).emit('job-completed', {
                jobId,
                testId: finalTestId,
                testName,
                duration,
                questions: questionsWithPdf,
                pdfUrl
            });
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info(`[DIRECT] ✅ Job ${jobId} completed: ${questionsWithPdf.length} questions in ${elapsed}s`);

    } catch (error) {
        logger.error(`[DIRECT] Fatal error: ${error.message}`);
        if (jobId) {
            await supabaseAdmin.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId).catch(() => {});
            const io = req.app.get('io');
            if (io) io.to(req.user?.id).emit('job-failed', { jobId, error: error.message });
        }
        // Don't call next(error) since response was already sent
    }
};
