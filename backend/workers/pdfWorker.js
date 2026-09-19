import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { splitPdfIntoChunk, getTotalPages } from '../services/pdf.service.js';
import { ensureLocalFile } from '../services/storageSync.js';

export const createPdfWorker = (io) => {
    return new Worker('pdf-upload', async job => {
        const { uploadId, userId, filePath, storagePath, token, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        io.to(userId).emit('job-started', { jobId: job.id });
        
        try {
            // Render's disk is ephemeral — recover the file from Supabase
            // Storage if a container restart wiped it before this ran.
            await ensureLocalFile(filePath, storagePath);

            // 1. Create Job Record in DB
            const { data: jobRecord, error: jobErr } = await supabase.from('jobs').insert({
                id: job.id,
                user_id: userId,
                upload_id: uploadId,
                status: 'processing',
                progress: 5
            }).select().single();
            if (jobErr) throw jobErr;

            io.to(userId).emit('upload-progress', { jobId: job.id, progress: 10 });
            
            const totalPages = await getTotalPages(filePath);
            
            await supabase.from('jobs').update({ total_pages: totalPages, status: 'processing', progress: 10 }).eq('id', job.id);
            
            io.to(userId).emit('job-progress', { 
                jobId: job.id, 
                progress: 10, 
                pagesCompleted: 0, 
                totalPages,
                questionsExtracted: 0 
            });
            
            // Queue up AI extraction job
            await queues.aiExtraction.add('extract-pdf', {
                jobId: job.id,
                userId,
                filePath,
                storagePath,
                totalPages,
                token,
                testName,
                duration
            });

        } catch (error) {
            logger.error(`PDF Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId: job.id, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', job.id);
            throw error;
        }
    }, { connection: getRedisConnection() });
};
