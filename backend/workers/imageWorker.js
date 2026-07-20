import { Worker } from 'bullmq';
import { connection, queues } from '../queue/index.js';
import { createScopedClient } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const createImageWorker = (io) => {
    return new Worker('image-extraction', async job => {
        const { jobId, userId, filePath, token, questions, testName, duration } = job.data;
        const supabase = createScopedClient(token);
        
        try {
            await supabase.from('jobs').update({ status: 'Extracting Images', progress: 75 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { jobId, progress: 75 });
            
            // Simulating image extraction logic for this architecture. 
            // In a real scenario, we'd use poppler/pdf2pic or pdfjs to crop the imageBoxes.
            // For now, we pass the questions along to the processor.
            
            await queues.questionProcessing.add('process-questions', {
                jobId, userId, token, questions, testName, duration
            });

        } catch (error) {
            logger.error(`Image Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection, concurrency: 2 });
};
