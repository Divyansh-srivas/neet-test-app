import { Worker } from 'bullmq';
import { connection, queues } from '../queue/index.js';
import { createScopedClient } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { splitPdfIntoChunk } from '../services/pdf.service.js';
import { extractQuestionsFromChunk } from '../services/gemini.service.js';

export const createAiWorker = (io) => {
    return new Worker('ai-extraction', async job => {
        const { jobId, userId, filePath, totalPages, token, testName, duration } = job.data;
        const supabase = createScopedClient(token);
        
        try {
            await supabase.from('jobs').update({ status: 'Calling Gemini' }).eq('id', jobId);
            
            const CHUNK_SIZE = 2;
            let allExtractedRaw = [];

            for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
                const endPage = Math.min(i + CHUNK_SIZE, totalPages) - 1;
                
                const chunkBase64 = await splitPdfIntoChunk(filePath, i, endPage);
                const rawQuestions = await extractQuestionsFromChunk(chunkBase64);
                
                // Add the chunk offset to the imageBox pages
                const adjustedQuestions = rawQuestions.map(q => {
                    if (q.imageBox) {
                        q.imageBox.page = i + q.imageBox.page;
                    }
                    return q;
                });
                
                allExtractedRaw.push(...adjustedQuestions);

                const progress = Math.round(((endPage + 1) / totalPages) * 70); // Up to 70% for AI phase
                await supabase.from('jobs').update({ 
                    progress, 
                    pages_completed: endPage + 1
                }).eq('id', jobId);

                io.to(userId).emit('job-progress', { jobId, progress, pagesCompleted: endPage + 1, totalPages });
            }

            // Enqueue to Image Extraction
            await queues.imageExtraction.add('extract-images', {
                jobId, userId, filePath, token, questions: allExtractedRaw, testName, duration
            });

        } catch (error) {
            logger.error(`AI Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection, concurrency: 1 });
};
