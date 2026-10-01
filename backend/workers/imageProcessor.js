import fs from 'fs';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { queues } from '../queue/index.js';

export default async function (job) {
    const { jobId, userId, filePath, storagePath, token, questions, testName, duration } = job.data;
    const supabase = supabaseAdmin;
    
    try {
        await supabase.from('jobs').update({ status: 'processing', progress: 75 }).eq('id', jobId);
        
        let pdfBuffer = null;
        try {
            pdfBuffer = fs.readFileSync(filePath);
        } catch (err) {
            logger.warn(`Could not read PDF file at ${filePath} for image extraction. Diagrams will be skipped.`);
        }

        if (pdfBuffer) {
            const { createPdfImageProcessor } = await import('../services/crop.service.js');
            
            let processedImages = 0;
            let processor = null;
            
            try {
                logger.info(`[imageProcessor] Initializing PDF image processor (this takes a few seconds)...`);
                processor = await createPdfImageProcessor(pdfBuffer);
                
                for (const q of questions) {
                    if (q && q.imageBox && q.imageBox.page) {
                        try {
                            const pageNum = q.imageBox.page; 
                            const bbox = q.imageBox.box;     
                            
                            logger.info(`[imageProcessor] Cropping diagram for qNum=${q.qNum} on page=${pageNum}`);
                            const croppedImageBuffer = await processor.cropRegion(pageNum, bbox);
                        
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
                            logger.error(`[imageProcessor] Failed to upload diagram: ${uploadError.message}`);
                        }
                    } catch (cropErr) {
                        logger.error(`[imageProcessor] Failed to crop diagram for qNum=${q.qNum}: ${cropErr.message}`);
                    }
                }
            }
            logger.info(`[imageProcessor] Cropped and uploaded ${processedImages} diagrams for job ${jobId}`);
            
            if (processor) {
                await processor.cleanup();
            }
        } catch (procErr) {
            logger.error(`[imageProcessor] PDF initialization or fatal error: ${procErr.message}`);
            if (processor) await processor.cleanup();
        }
    }
        
        await queues.questionProcessing.add('process-questions', {
            jobId, userId, token, storagePath, questions, testName, duration
        }, {
            attempts: 2,
            backoff: { type: 'fixed', delay: 5000 }
        });
        
        return { success: true };
    } catch (error) {
        logger.error(`[imageProcessor] failed: ${error.message}`);
        await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
        throw error;
    }
}
