import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { splitPdfIntoChunk } from '../services/pdf.service.js';
import { extractQuestionsFromChunk } from '../services/gemini.service.js';

export const createAiWorker = (io) => {
    return new Worker('ai-extraction', async job => {
        const { jobId, userId, filePath, storagePath, totalPages, token, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            await supabase.from('jobs').update({ status: 'processing' }).eq('id', jobId);
            
            const CHUNK_SIZE = 2;
            let chunkTasks = [];
            
            for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
                const endPage = Math.min(i + CHUNK_SIZE, totalPages) - 1;
                chunkTasks.push({ startPage: i, endPage });
            }
            
            let completedChunks = 0;
            let extractedCount = 0;
            let allExtractedRaw = [];
            
            const CONCURRENCY_LIMIT = 1; // Sequential - proven to work
            
            for (let i = 0; i < chunkTasks.length; i += CONCURRENCY_LIMIT) {
                const batch = chunkTasks.slice(i, i + CONCURRENCY_LIMIT);
                
                const batchResults = await Promise.all(batch.map(async (chunk) => {
                    const { startPage, endPage } = chunk;
                    
                    // Emit progress BEFORE starting extraction so user knows it's actively working on current chunk
                    const currentProgress = Math.round((completedChunks / chunkTasks.length) * 60) + 10;
                    const pagesDone = Math.min(completedChunks * CHUNK_SIZE, totalPages);
                    
                    io.to(userId).emit('job-progress', { 
                        jobId, 
                        progress: currentProgress, 
                        pagesCompleted: pagesDone, 
                        totalPages,
                        questionsExtracted: extractedCount 
                    });

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
                        extractedCount += adjustedQuestions.length;
                        
                        const updatedProgress = Math.round((completedChunks / chunkTasks.length) * 60) + 10;
                        const updatedPagesDone = Math.min(completedChunks * CHUNK_SIZE, totalPages);
                        
                        // Update database immediately for HTTP polling fallback
                        await supabase.from('jobs').update({ 
                            progress: updatedProgress, 
                            pages_completed: updatedPagesDone,
                            extracted_questions: extractedCount
                        }).eq('id', jobId);

                        io.to(userId).emit('job-progress', { 
                            jobId, 
                            progress: updatedProgress, 
                            pagesCompleted: updatedPagesDone, 
                            totalPages,
                            questionsExtracted: extractedCount 
                        });
                        
                        return adjustedQuestions;
                    } catch(chunkErr) {
                        logger.error(`Chunk ${startPage}-${endPage} extraction failed: ${chunkErr.message}`);
                        completedChunks++;
                        return []; // Proceed gracefully so questions from other chunks are preserved
                    }
                }));
                
                allExtractedRaw.push(...batchResults.flat());

                // 2-second rate limit pacing delay between back-to-back chunks
                if (i + CONCURRENCY_LIMIT < chunkTasks.length) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            
            if (allExtractedRaw.length === 0) {
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
