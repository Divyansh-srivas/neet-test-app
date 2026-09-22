import { Worker } from 'bullmq';
import { getRedisConnection } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export const createSaveWorker = (io) => {
    return new Worker('result-saving-local', async job => {
        const { jobId, userId, token, storagePath, testName, duration, dedupeSourceTestId } = job.data;
        let { questions } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            await supabase.from('jobs').update({ status: 'processing', progress: 95 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { jobId, progress: 95 });
            
            if (dedupeSourceTestId && (!questions || questions.length === 0)) {
                logger.info(`[DEDUPE] Fetching source questions from test ${dedupeSourceTestId} for job ${jobId}`);
                const { data: sourceTest, error: err } = await supabase.from('tests').select('questions').eq('id', dedupeSourceTestId).single();
                if (err || !sourceTest || !sourceTest.questions) {
                    throw new Error(`Dedupe source test ${dedupeSourceTestId} not found or has no questions.`);
                }
                const { v4: uuidv4 } = await import('uuid');
                questions = sourceTest.questions.map(q => ({ ...q, id: uuidv4() }));
            }
            
            let extractedImagesCount = 0;

            for (const q of questions) {
                await supabase.from('questions').insert({
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
                
                if (q.imageBox) {
                    extractedImagesCount++;
                    await supabase.from('question_images').insert({
                        question_id: q.id,
                        image_url: JSON.stringify(q.imageBox),
                        page_number: q.imageBox.page
                    });
                }
            }

            let pdfUrl = null;
            if (storagePath) {
                const { data: signedData, error: signedError } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 60 * 60 * 24 * 365);
                if (signedData && signedData.signedUrl) {
                    pdfUrl = signedData.signedUrl;
                } else {
                    const uploadId = storagePath.split('/').pop().replace('.pdf', '');
                    pdfUrl = `/api/pdf/${uploadId}`;
                }
            }

            const questionsWithPdf = questions.map(q => ({
                ...q,
                pdfUrl: pdfUrl
            }));

            // Create the Test object in Supabase
            const { data: testRecord, error: testErr } = await supabaseAdmin.from('tests').insert({
                teacher_id: userId,
                name: testName || 'AI Extracted Test',
                questions: questionsWithPdf,
                total_questions: questionsWithPdf.length,
                is_published: true
            }).select().single();

            if (testErr) {
                logger.warn("Failed to create test record in Supabase:", testErr.message);
            }

            const finalTestId = testRecord ? testRecord.id : null;

            await supabase.from('jobs').update({ 
                status: 'completed', 
                progress: 100,
                extracted_questions: questionsWithPdf.length,
                extracted_images: extractedImagesCount,
                test_id: finalTestId,
                completed_at: new Date().toISOString()
            }).eq('id', jobId);

            io.to(userId).emit('job-completed', { 
                jobId, 
                testId: finalTestId,
                testName,
                duration,
                questions: questionsWithPdf,
                pdfUrl
            });
            logger.info(`Job ${jobId} completed successfully.`);

        } catch (error) {
            logger.error(`Save Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection: getRedisConnection(), concurrency: 2 });
};
