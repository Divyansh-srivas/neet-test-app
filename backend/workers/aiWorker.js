import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { extractQuestionsFromSinglePage } from '../services/gemini.service.js';
import { getTotalPages, splitPdfIntoChunk, releasePdf } from '../services/pdf.service.js';
import { ensureLocalFile } from '../services/storageSync.js';

export const createAiWorker = (io) => {
    return new Worker('ai-extraction', async job => {
        const { jobId, userId, filePath, storagePath, token, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            // Render's disk is ephemeral — a container restart between the
            // pdfWorker step and here (or mid-loop below) wipes the local
            // file even though this BullMQ job survives and gets retried.
            await ensureLocalFile(filePath, storagePath);

            const totalPages = await getTotalPages(filePath);
            const chunkTasks = Math.ceil(totalPages / parseInt(process.env.PDF_CHUNK_SIZE || '1'));
            
            logger.info(`[aiWorker] START job=${jobId} bullId=${job.id} attempt=${job.attemptsMade} totalPages=${totalPages}`);
            logger.info(`[aiWorker] job=${jobId} -> ${chunkTasks} chunks`);

            await supabase.from('jobs').update({ status: 'processing', progress: 10, total_pages: totalPages }).eq('id', jobId);
            io.to(userId).emit('job-progress', { 
                jobId, progress: 10, pagesCompleted: 0, totalPages, questionsExtracted: 0, status: 'AI is analyzing the PDF...'
            });

            let allExtractedRaw = [];
            let completedPages = 0;
            const chunkSize = parseInt(process.env.PDF_CHUNK_SIZE || '1');

            for (let i = 0; i < totalPages; i += chunkSize) {
                const chunkIdx = Math.floor(i / chunkSize) + 1;
                const startPage = i + 1;
                const endPage = Math.min(i + chunkSize, totalPages);
                
                try {
                    await ensureLocalFile(filePath, storagePath);
                    const pageBufferB64 = await splitPdfIntoChunk(filePath, startPage, endPage);
                    const pageBuffer = Buffer.from(pageBufferB64, 'base64');
                    
                    const startTime = Date.now();
                    logger.info(`[gemini] job=${jobId} chunk ${chunkIdx}/${chunkTasks} (p${startPage}-p${endPage}) attempt 1/4 (model=${process.env.GEMINI_MODEL || 'gemini-3.6-flash'})`);
                    
                    const questions = await extractQuestionsFromSinglePage(pageBuffer);
                    
                    logger.info(`[gemini] job=${jobId} chunk ${chunkIdx}/${chunkTasks} responded in ${Date.now() - startTime}ms`);

                    const adjustedQuestions = questions.map(q => {
                        if (q && q.imageBox && typeof q.imageBox.page === 'number') {
                            // Gemini thinks it's processing a 1-page PDF, so it returns page: 1.
                            // We adjust it by adding (startPage - 1) to get the absolute PDF page.
                            q.imageBox.page = startPage + q.imageBox.page - 1;
                            logger.info(`[aiWorker] job=${jobId} qNum=${q.questionNumber || q.qNum} mapped diagram to absolute page=${q.imageBox.page} box=[${q.imageBox.box}]`);
                        }
                        return q;
                    });

                    allExtractedRaw.push(...adjustedQuestions);
                    completedPages += (endPage - startPage + 1);

                    const progress = Math.max(10, Math.round(((chunkIdx) / chunkTasks) * 70));
                    
                    logger.info(`[aiWorker] job=${jobId} chunk ${chunkIdx}/${chunkTasks} done. questions=${questions.length} total=${allExtractedRaw.length} progress=${progress}%`);

                    await supabase.from('jobs').update({ progress, pages_completed: completedPages, extracted_questions: allExtractedRaw.length }).eq('id', jobId);
                    await job.updateProgress(progress);
                    
                    io.to(userId).emit('job-progress', { 
                        jobId, progress, pagesCompleted: completedPages, totalPages, questionsExtracted: allExtractedRaw.length, status: `Extracted chunk ${chunkIdx}/${chunkTasks}`
                    });
                } catch (err) {
                    logger.error(`[aiWorker] job=${jobId} FAILED chunk ${chunkIdx}: ${err.message}`);
                    // Continue to next chunk on failure (defect 5)
                }
            }

            if (allExtractedRaw.length === 0) {
                const errorMsg = `Extraction yielded 0 questions from ${totalPages} pages. Please check Gemini API key/quota/model name.`;
                logger.error(`[aiWorker] job=${jobId} FAILED: ${errorMsg}`);
                throw new Error(errorMsg);
            }

            await supabase.from('jobs').update({ progress: 70, pages_completed: totalPages, extracted_questions: allExtractedRaw.length }).eq('id', jobId);
            
            io.to(userId).emit('job-progress', { 
                jobId, progress: 70, pagesCompleted: totalPages, totalPages, questionsExtracted: allExtractedRaw.length, status: `Extracted ${allExtractedRaw.length} questions! Processing...`
            });

            await queues.imageExtraction.add('extract-images', {
                jobId, userId, filePath, storagePath, token, questions: allExtractedRaw, testName, duration
            });

        } catch (error) {
            logger.error(`[aiWorker] job=${jobId} FAILED: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        } finally {
            releasePdf(filePath);
        }
    }, { 
        connection: getRedisConnection(), 
        concurrency: 1,
        lockDuration: 10 * 60 * 1000,
        stalledInterval: 60 * 1000,
        maxStalledCount: 1
    });
};
