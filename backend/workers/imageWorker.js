import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';

export const createImageWorker = (io) => {
    return new Worker('image-extraction-local', async job => {
        const { jobId, userId, filePath, storagePath, token, questions, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            await supabase.from('jobs').update({ status: 'processing', progress: 75 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { jobId, progress: 75, status: 'Extracting diagrams...' });
            
            // Read PDF buffer once for cropping
            let pdfBuffer = null;
            try {
                pdfBuffer = fs.readFileSync(filePath);
            } catch (err) {
                logger.warn(`Could not read PDF file at ${filePath} for image extraction. Diagrams will be skipped.`);
            }

            if (pdfBuffer) {
                const { cropMultiPagePdfRegionToImage } = await import('../services/crop.service.js');
                
                let processedImages = 0;
                
                // Crop and upload diagrams
                for (const q of questions) {
                    if (q && q.imageBox && q.imageBox.page) {
                        try {
                            const pageNum = q.imageBox.page; // 1-indexed page number of the full PDF
                            const bbox = q.imageBox.box;     // [ymin, xmin, ymax, xmax]
                            
                            logger.info(`[imageWorker] Cropping diagram for qNum=${q.qNum} on page=${pageNum}`);
                            const croppedImageBuffer = await cropMultiPagePdfRegionToImage(pdfBuffer, pageNum, bbox);
                            
                            const fileName = `diagrams/${jobId}_p${pageNum}_q${q.qNum}_${Date.now()}.png`;
                            
                            const { error: uploadError } = await supabase.storage
                                .from('uploads')
                                .upload(fileName, croppedImageBuffer, { contentType: 'image/png', upsert: true });

                            if (!uploadError) {
                                const { data: publicUrlData } = supabase.storage
                                    .from('uploads')
                                    .getPublicUrl(fileName);
                                
                                q.diagramUrl = publicUrlData.publicUrl;
                                processedImages++;
                            } else {
                                logger.error(`[imageWorker] Failed to upload cropped diagram to Supabase: ${uploadError.message}`);
                            }
                        } catch (cropErr) {
                            logger.error(`[imageWorker] Failed to crop diagram for qNum=${q.qNum}: ${cropErr.message}`);
                        }
                    }
                }
                logger.info(`[imageWorker] Successfully cropped and uploaded ${processedImages} diagrams for job ${jobId}`);
            }
            
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
