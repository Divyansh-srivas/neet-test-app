import fs from 'fs';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { queues } from '../queue/index.js';

// Hard global timeout for image extraction - if it takes more than 90s, skip all images and proceed
const IMAGE_EXTRACTION_TIMEOUT_MS = 90_000;

async function extractImagesWithTimeout(pdfBuffer, questions, jobId) {
    return new Promise(async (resolve) => {
        const timer = setTimeout(() => {
            logger.warn(`[imageProcessor] GLOBAL TIMEOUT: image extraction exceeded ${IMAGE_EXTRACTION_TIMEOUT_MS / 1000}s for job ${jobId}. Proceeding without images.`);
            resolve(0);
        }, IMAGE_EXTRACTION_TIMEOUT_MS);

        try {
            const { createPdfImageProcessor } = await import('../services/crop.service.js');
            let processedImages = 0;
            let processor = null;

            try {
                processor = await createPdfImageProcessor(pdfBuffer);

                for (const q of questions) {
                    if (q && q.imageBox && q.imageBox.page) {
                        try {
                            const croppedImageBuffer = await processor.cropRegion(q.imageBox.page, q.imageBox.box);
                            const fileName = `diagrams/${jobId}_p${q.imageBox.page}_q${q.qNum}_${Date.now()}.png`;

                            const { error: uploadError } = await supabaseAdmin.storage
                                .from('uploads')
                                .upload(fileName, croppedImageBuffer, { contentType: 'image/png', upsert: true });

                            if (!uploadError) {
                                const { data: publicUrlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName);
                                q.diagramUrl = publicUrlData.publicUrl;
                                processedImages++;
                                logger.info(`[imageProcessor] Uploaded diagram qNum=${q.qNum} (${processedImages} total)`);
                            }
                        } catch (cropErr) {
                            logger.error(`[imageProcessor] Skipping qNum=${q.qNum}: ${cropErr.message}`);
                        }
                    }
                }
            } finally {
                if (processor) {
                    try { await processor.cleanup(); } catch (e) {}
                }
            }

            clearTimeout(timer);
            resolve(processedImages);
        } catch (err) {
            logger.error(`[imageProcessor] extractImagesWithTimeout error: ${err.message}`);
            clearTimeout(timer);
            resolve(0);
        }
    });
}

export default async function (job) {
    const { jobId, userId, filePath, storagePath, token, questions, testName, duration } = job.data;

    try {
        await supabaseAdmin.from('jobs').update({ status: 'processing', progress: 75 }).eq('id', jobId);

        // Attempt image extraction - NEVER let this block the job from completing
        try {
            const pdfBuffer = fs.readFileSync(filePath);
            const count = await extractImagesWithTimeout(pdfBuffer, questions, jobId);
            logger.info(`[imageProcessor] Image extraction done: ${count} images for job ${jobId}`);
        } catch (fileErr) {
            // File not found on Render ephemeral disk — skip silently, images won't be shown
            logger.warn(`[imageProcessor] PDF not readable at ${filePath}, skipping image extraction: ${fileErr.message}`);
        }

        // ALWAYS proceed to next stage regardless of image extraction outcome
        await queues.questionProcessing.add('process-questions', {
            jobId, userId, token, storagePath, questions, testName, duration
        }, {
            attempts: 2,
            backoff: { type: 'fixed', delay: 5000 }
        });

        return { success: true };
    } catch (error) {
        logger.error(`[imageProcessor] fatal: ${error.message}`);
        await supabaseAdmin.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
        throw error;
    }
}
