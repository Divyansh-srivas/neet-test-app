import fs from 'fs';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { queues } from '../queue/index.js';
import { ensureLocalFile } from '../services/storageSync.js';
import { 
    findDeterministicDiagramBox, 
    getQuestionColumnBandBox, 
    isFigureRequired, 
    hasDegenerateOrVisualOptions 
} from '../services/diagramDetector.service.js';

// Hard global timeout for image extraction - if it takes more than 90s, skip all images and proceed
const IMAGE_EXTRACTION_TIMEOUT_MS = 90_000;

async function extractImagesWithTimeout(pdfBuffer, questions, jobId) {
    return new Promise(async (resolve) => {
        const timer = setTimeout(() => {
            logger.warn(`[imageProcessor] GLOBAL TIMEOUT: image extraction exceeded ${IMAGE_EXTRACTION_TIMEOUT_MS / 1000}s for job ${jobId}. Proceeding without images.`);
            resolve({ processedCount: 0, coverageReport: null });
        }, IMAGE_EXTRACTION_TIMEOUT_MS);

        try {
            const { createPdfImageProcessor } = await import('../services/crop.service.js');
            let processedImages = 0;
            let processor = null;

            try {
                processor = await createPdfImageProcessor(pdfBuffer);

                for (const q of questions) {
                    if (!q) continue;

                    const qNum = q.qNum || q.questionNumber;
                    const stem = q.question || q.questionText || '';

                    // RULE 1: Deterministic figure-reference trigger
                    const needsFigure = isFigureRequired(stem, q.options) || !!q.hasDiagram;
                    if (needsFigure) {
                        q.hasDiagram = true;
                    }
                    if (hasDegenerateOrVisualOptions(q.options)) {
                        q.hasVisualOptions = true;
                    }

                    // If question needs a diagram and has no imageBox yet, deterministically recover it
                    if (needsFigure && (!q.imageBox || !q.imageBox.page)) {
                        const recovered = findDeterministicDiagramBox(pdfBuffer, qNum, stem, -1);
                        if (recovered && recovered.page) {
                            q.imageBox = { page: recovered.page, box: recovered };
                            q.diagramBox = q.imageBox;
                            logger.info(`[imageProcessor] Deterministically recovered diagram for Q${qNum}: page ${recovered.page}, box=[${recovered.join(', ')}]`);
                        } else {
                            // Column band fallback
                            const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1);
                            if (fallbackBand && fallbackBand.page) {
                                q.imageBox = { page: fallbackBand.page, box: fallbackBand };
                                q.diagramBox = q.imageBox;
                                logger.info(`[imageProcessor] Applied column band fallback box for Q${qNum}: page ${fallbackBand.page}`);
                            }
                        }
                    }

                    // 1. Crop the main question diagram (stem image)
                    if (q.imageBox && q.imageBox.page && !q.diagramUrl) {
                        let croppedBuffer = null;
                        try {
                            croppedBuffer = await processor.cropRegion(q.imageBox.page, q.imageBox.box);
                        } catch (cropErr) {
                            logger.warn(`[imageProcessor] Primary crop failed for Q${qNum}: ${cropErr.message}. Trying column band fallback...`);
                            try {
                                const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1);
                                if (fallbackBand && fallbackBand.page) {
                                    croppedBuffer = await processor.cropRegion(fallbackBand.page, fallbackBand);
                                }
                            } catch (fbErr) {
                                logger.error(`[imageProcessor] Fallback crop also failed for Q${qNum}: ${fbErr.message}`);
                            }
                        }

                        if (croppedBuffer) {
                            const fileName = `diagrams/${jobId}_p${q.imageBox.page}_q${qNum}_${Date.now()}.png`;
                            let finalUrl = null;

                            try {
                                const { error: uploadError } = await supabaseAdmin.storage
                                    .from('uploads')
                                    .upload(fileName, croppedBuffer, { contentType: 'image/png', upsert: true });

                                if (!uploadError) {
                                    const { data: publicUrlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName);
                                    finalUrl = publicUrlData.publicUrl;
                                } else {
                                    logger.warn(`[imageProcessor] Supabase storage upload failed for Q${qNum} (${uploadError.message}), falling back to base64`);
                                }
                            } catch (uploadException) {
                                logger.warn(`[imageProcessor] Supabase storage upload exception for Q${qNum} (${uploadException.message}), falling back to base64`);
                            }

                            // RULE 2: No silent nulls! If storage failed, use data URL so image is NEVER null
                            if (!finalUrl) {
                                finalUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
                            }

                            q.diagramUrl = finalUrl;
                            processedImages++;
                            logger.info(`[imageProcessor] Set diagramUrl for Q${qNum} (${processedImages} total, isDataUrl=${finalUrl.startsWith('data:')})`);
                        }
                    }

                    // 2. Crop individual option images when options are visual diagrams
                    if (q.optionImageBoxes && typeof q.optionImageBoxes === 'object') {
                        q.optionImageUrls = q.optionImageUrls || {};
                        for (const [optKey, optBox] of Object.entries(q.optionImageBoxes)) {
                            if (!optBox || !optBox.page || !optBox.box) continue;
                            try {
                                const optBuffer = await processor.cropRegion(optBox.page, optBox.box);
                                const optFileName = `diagrams/${jobId}_p${optBox.page}_q${qNum}_opt${optKey}_${Date.now()}.png`;
                                let optUrl = null;

                                try {
                                    const { error: optUploadErr } = await supabaseAdmin.storage
                                        .from('uploads')
                                        .upload(optFileName, optBuffer, { contentType: 'image/png', upsert: true });

                                    if (!optUploadErr) {
                                        const { data: optUrlData } = supabaseAdmin.storage.from('uploads').getPublicUrl(optFileName);
                                        optUrl = optUrlData.publicUrl;
                                    }
                                } catch (e) {}

                                // Rule 2: Fallback to base64 if storage fails
                                if (!optUrl) {
                                    optUrl = `data:image/png;base64,${optBuffer.toString('base64')}`;
                                }

                                q.optionImageUrls[optKey] = optUrl;
                                processedImages++;
                                logger.info(`[imageProcessor] Set option image for Q${qNum} opt=${optKey}`);
                            } catch (optCropErr) {
                                logger.error(`[imageProcessor] Skipping option image qNum=${qNum} opt=${optKey}: ${optCropErr.message}`);
                            }
                        }
                        if (Object.keys(q.optionImageUrls).length === 0) {
                            q.optionImageUrls = null;
                        }
                    }
                }
            } finally {
                if (processor) {
                    try { await processor.cleanup(); } catch (e) {}
                }
            }

            // RULE 3: Per-job coverage report (permanent)
            const figureQuestions = questions.filter(q => {
                const stem = q.question || q.questionText || '';
                return isFigureRequired(stem, q.options) || !!q.hasDiagram;
            });

            const missingQNums = figureQuestions
                .filter(q => !q.diagramUrl && (!q.optionImageUrls || Object.keys(q.optionImageUrls).length === 0))
                .map(q => q.qNum || q.questionNumber);

            const coverageReport = {
                figureQuestionsCount: figureQuestions.length,
                withImageCount: figureQuestions.length - missingQNums.length,
                missingQNums: missingQNums,
                needsReview: missingQNums.length > 0
            };

            logger.info(`[imageProcessor] RULE 3 COVERAGE REPORT for job ${jobId}: totalFigureQuestions=${coverageReport.figureQuestionsCount}, withImage=${coverageReport.withImageCount}, missing=[${missingQNums.join(', ')}], needsReview=${coverageReport.needsReview}`);

            clearTimeout(timer);
            resolve({ processedCount: processedImages, coverageReport });
        } catch (err) {
            logger.error(`[imageProcessor] extractImagesWithTimeout error: ${err.message}`);
            clearTimeout(timer);
            resolve({ processedCount: 0, coverageReport: null });
        }
    });
}

export default async function (job) {
    const { jobId, userId, filePath, storagePath, token, questions, testName, duration } = job.data;

    try {
        await supabaseAdmin.from('jobs').update({ status: 'processing', progress: 75 }).eq('id', jobId);

        // Attempt image extraction - NEVER let this block the job from completing
        try {
            await ensureLocalFile(filePath, storagePath);
            const pdfBuffer = fs.readFileSync(filePath);
            const { processedCount, coverageReport } = await extractImagesWithTimeout(pdfBuffer, questions, jobId);
            logger.info(`[imageProcessor] Image extraction done: ${processedCount} images for job ${jobId}`);

            // Persist Rule 3 coverage report into job metadata
            if (coverageReport) {
                try {
                    const { data: currentJob } = await supabaseAdmin.from('jobs').select('metadata').eq('id', jobId).single();
                    const currentMetadata = currentJob?.metadata || {};
                    await supabaseAdmin.from('jobs').update({
                        metadata: {
                            ...currentMetadata,
                            coverageReport,
                            needsReview: coverageReport.needsReview
                        }
                    }).eq('id', jobId);
                } catch (metaErr) {
                    logger.warn(`[imageProcessor] Could not save coverageReport to metadata: ${metaErr.message}`);
                }
            }
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
