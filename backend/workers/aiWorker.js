import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { splitPdfIntoChunk } from '../services/pdf.service.js';
import { extractQuestionsFromChunk } from '../services/gemini.service.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const createAiWorker = (io) => {
    return new Worker('ai-extraction', async job => {
        const { jobId, userId, filePath, storagePath, totalPages, token, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            await supabase.from('jobs').update({ status: 'processing', progress: 10 }).eq('id', jobId);
            
            const CHUNK_SIZE = 2;
            let chunkTasks = [];
            
            for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
                const endPage = Math.min(i + CHUNK_SIZE, totalPages) - 1;
                chunkTasks.push({ startPage: i, endPage });
            }
            
            let completedChunks = 0;
            let allExtractedRaw = [];
            
            const CONCURRENCY_LIMIT = 2; // Process 2 chunks concurrently
            
            for (let i = 0; i < chunkTasks.length; i += CONCURRENCY_LIMIT) {
                const batch = chunkTasks.slice(i, i + CONCURRENCY_LIMIT);
                
                const currentPageStart = Math.min(completedChunks * CHUNK_SIZE, totalPages);
                const currentProgress = Math.min(Math.round((currentPageStart / totalPages) * 60) + 10, 70);

                io.to(userId).emit('job-progress', { 
                    jobId, 
                    progress: currentProgress, 
                    pagesCompleted: currentPageStart, 
                    totalPages,
                    questionsExtracted: allExtractedRaw.length 
                });

                const batchResults = await Promise.all(batch.map(async (chunk) => {
                    const { startPage, endPage } = chunk;
                    try {
                        const chunkBase64 = await splitPdfIntoChunk(filePath, startPage, endPage);
                        const rawQuestions = await extractQuestionsFromChunk(chunkBase64);
                        
                        const adjustedQuestions = rawQuestions.map(q => {
                            if (q.imageBox) {
                                q.imageBox.page = startPage + q.imageBox.page;
                            }
                            return q;
                        });
                        
                        completedChunks++;
                        return adjustedQuestions;
                    } catch (chunkErr) {
                        logger.error(`[WORKER WARNING] Chunk ${startPage}-${endPage} failed: ${chunkErr.message}. Continuing with other pages.`);
                        completedChunks++;
                        return []; // Keep questions from other pages!
                    }
                }));

                const newQuestions = batchResults.flat();
                allExtractedRaw.push(...newQuestions);

                const pagesDone = Math.min(completedChunks * CHUNK_SIZE, totalPages);
                const updatedProgress = Math.min(Math.round((pagesDone / totalPages) * 60) + 10, 70);

                // Monotonic & Persistent State: Update database immediately after EVERY completed batch
                await supabase.from('jobs').update({ 
                    progress: updatedProgress, 
                    pages_completed: pagesDone,
                    extracted_questions: allExtractedRaw.length
                }).eq('id', jobId);

                io.to(userId).emit('job-progress', { 
                    jobId, 
                    progress: updatedProgress, 
                    pagesCompleted: pagesDone, 
                    totalPages,
                    questionsExtracted: allExtractedRaw.length 
                });

                // Adaptive Throttling: 1000ms pause between batches to prevent TPM/RPM exhaustion
                if (i + CONCURRENCY_LIMIT < chunkTasks.length) {
                    await delay(1000);
                }
            }
            
            console.log(`[DEBUG] Extraction finished across ${totalPages} pages. Total questions recovered:`, allExtractedRaw.length);
            
            if (allExtractedRaw.length === 0) {
                console.log(`[DEBUG] Final total of all questions across document is strictly 0. File: ${filePath}`);
                logger.error(`[DEBUG] Extraction completed with 0 questions across ${totalPages} pages.`);
                throw new Error('No questions could be extracted from this PDF. Please verify PDF format.');
            }
            
            await supabase.from('jobs').update({ 
                progress: 70, 
                pages_completed: totalPages,
                extracted_questions: allExtractedRaw.length
            }).eq('id', jobId);

            // Enqueue to Image Extraction
            await queues.imageExtraction.add('extract-images', {
                jobId, userId, filePath, storagePath, token, questions: allExtractedRaw, testName, duration
            });

        } catch (error) {
            logger.error(`AI Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection: getRedisConnection(), concurrency: 1 });
};
