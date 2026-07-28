import { Worker } from 'bullmq';
import { connection } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export const createSaveWorker = (io) => {
    return new Worker('result-saving', async job => {
        const { jobId, userId, token, storagePath, questions, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            await supabase.from('jobs').update({ status: 'processing', progress: 95 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { jobId, progress: 95 });
            
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

            // Create the Test object in Supabase
            // We need to fetch the teacher's profile first, or if student, they can create tests? 
            // In the DB schema, tests have `teacher_id`. Assuming the user is a teacher.
            // If they are a student, RLS might block it. Let's use supabaseAdmin to create the test for them.
            
            const { data: testRecord, error: testErr } = await supabaseAdmin.from('tests').insert({
                teacher_id: userId,
                name: testName || 'AI Extracted Test',
                questions: questions, // store full JSON for backward compatibility with frontend
                total_questions: questions.length,
                is_published: true
            }).select().single();

            if (testErr) {
                logger.warn("Failed to create test record in Supabase:", testErr.message);
            }

            const finalTestId = testRecord ? testRecord.id : null;

            await supabase.from('jobs').update({ 
                status: 'completed', 
                progress: 100,
                extracted_questions: questions.length,
                extracted_images: extractedImagesCount,
                test_id: finalTestId,
                completed_at: new Date().toISOString()
            }).eq('id', jobId);

            let pdfUrl = null;
            if (storagePath) {
                const { data: signedData, error: signedError } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 60 * 60 * 24 * 365);
                if (signedData && signedData.signedUrl) {
                    pdfUrl = signedData.signedUrl;
                } else {
                    pdfUrl = `${config.SUPABASE_URL || 'https://rtngewpxtuayymmldmsu.supabase.co'}/storage/v1/object/public/uploads/${storagePath}`;
                }
            }

            io.to(userId).emit('job-completed', { 
                jobId, 
                testId: finalTestId,
                testName,
                duration,
                questions,
                pdfUrl
            });
            logger.info(`Job ${jobId} completed successfully.`);

        } catch (error) {
            logger.error(`Save Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection, concurrency: 2 });
};
