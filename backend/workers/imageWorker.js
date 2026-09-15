import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const createImageWorker = (io) => {
    return new Worker('image-extraction', async job => {
        const { jobId, userId, filePath, storagePath, token, questions, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            await supabase.from('jobs').update({ status: 'processing', progress: 75 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { jobId, progress: 75 });
            
            // Pass questions along to processor
            await queues.questionProcessing.add('process-questions', {
                jobId, userId, token, storagePath, questions, testName, duration
            });

        } catch (error) {
            logger.error(`Image Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection: getRedisConnection(), concurrency: 2 });
};
