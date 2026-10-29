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

// ─── BUG 3a FIX: Configurable deadline (default 420s = 7 min) checked between questions ───
const IMAGE_EXTRACTION_TIMEOUT_MS = parseInt(process.env.IMAGE_EXTRACTION_TIMEOUT_MS || '420000', 10);

// ─── BUG 3b FIX: Reject implausible Gemini imageBox ───
function isImplausibleBox(box) {
    if (!box || !Array.isArray(box) || box.length < 4) return true;
    const [ymin, xmin, ymax, xmax] = box;
    // Inverted coordinates
    if (ymax <= ymin || xmax <= xmin) return true;
    // Sliver (< 1% in either dimension)
    if ((ymax - ymin) < 0.01 || (xmax - xmin) < 0.01) return true;
    // Whole page (> 95% area)
    if ((ymax - ymin) * (xmax - xmin) > 0.95) return true;
    return false;
}

// ─── BUG 3c FIX: Retry storage upload once ───
async function uploadWithRetry(bucket, fileName, buffer, options, maxRetries = 1) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const { error } = await supabaseAdmin.storage
                .from(bucket)
                .upload(fileName, buffer, options);
            if (!error) {
                const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
                return publicUrlData.publicUrl;
            }
            if (attempt < maxRetries) {
                logger.warn(`[imageProcessor] Upload attempt ${attempt + 1} failed: ${error.message}, retrying...`);
                await new Promise(r => setTimeout(r, 2000));
            } else {
                logger.warn(`[imageProcessor] Upload failed after ${maxRetries + 1} attempts: ${error.message}`);
                return null;
            }
        } catch (e) {
            if (attempt < maxRetries) {
                logger.warn(`[imageProcessor] Upload exception attempt ${attempt + 1}: ${e.message}, retrying...`);
                await new Promise(r => setTimeout(r, 2000));
            } else {
                logger.warn(`[imageProcessor] Upload exception after ${maxRetries + 1} attempts: ${e.message}`);
                return null;
            }
        }
    }
    return null;
}

async function extractImages(pdfBuffer, questions, jobId) {
    const startTime = Date.now();
    const deadline = startTime + IMAGE_EXTRACTION_TIMEOUT_MS;
    let processedImages = 0;
    let base64Fallbacks = 0;
    let cropFailures = 0;
    let processor = null;

    try {
        const { createPdfImageProcessor } = await import('../services/crop.service.js');
        processor = await createPdfImageProcessor(pdfBuffer);

        for (const q of questions) {
            if (!q) continue;

            // ─── BUG 3a FIX: Check deadline between questions ───
            if (Date.now() > deadline) {
                logger.warn(`[imageProcessor] DEADLINE EXCEEDED after ${Math.round((Date.now() - startTime) / 1000)}s for job ${jobId}. Processed ${processedImages} images so far. Stopping gracefully.`);
                break;
            }

            const qNum = q.qNum || q.questionNumber;
            const stem = q.question || q.questionText || '';

            // ─── Per-question try/catch (BUG 3c) ───
            try {
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
                        // ─── BUG 3b FIX: Reject implausible box ───
                        if (!isImplausibleBox(recovered)) {
                            q.imageBox = { page: recovered.page, box: recovered };
                            q.diagramBox = q.imageBox;
                            logger.info(`[imageProcessor] Deterministically recovered diagram for Q${qNum}: page ${recovered.page}, box=[${recovered.join(', ')}]`);
                        } else {
                            logger.warn(`[imageProcessor] Rejected implausible deterministic box for Q${qNum}: [${recovered.join(', ')}]`);
                            // Fall through to column band fallback
                        }
                    }
                }

                // If still no valid imageBox but needs figure, try column band fallback
                if (needsFigure && (!q.imageBox || !q.imageBox.page)) {
                    const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1, stem);
                    if (fallbackBand && fallbackBand.page) {
                        q.imageBox = { page: fallbackBand.page, box: fallbackBand };
                        q.diagramBox = q.imageBox;
                        logger.info(`[imageProcessor] Applied column band fallback box for Q${qNum}: page ${fallbackBand.page}`);
                    }
                }

                // ─── BUG 3b FIX: Validate existing Gemini imageBox before cropping ───
                if (q.imageBox && q.imageBox.box && isImplausibleBox(q.imageBox.box)) {
                    logger.warn(`[imageProcessor] Rejecting implausible Gemini imageBox for Q${qNum}: [${q.imageBox.box}]. Recovering with deterministic detection.`);
                    const recovered = findDeterministicDiagramBox(pdfBuffer, qNum, stem, -1);
                    if (recovered && recovered.page && !isImplausibleBox(recovered)) {
                        q.imageBox = { page: recovered.page, box: recovered };
                    } else {
                        const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1, stem);
                        if (fallbackBand && fallbackBand.page) {
                            q.imageBox = { page: fallbackBand.page, box: fallbackBand };
                        } else {
                            q.imageBox = null;
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
                        cropFailures++;
                        try {
                            const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1, stem);
                            if (fallbackBand && fallbackBand.page) {
                                croppedBuffer = await processor.cropRegion(fallbackBand.page, fallbackBand);
                            }
                        } catch (fbErr) {
                            logger.error(`[imageProcessor] Fallback crop also failed for Q${qNum}: ${fbErr.message}`);
                            cropFailures++;
                        }
                    }

                    if (croppedBuffer) {
                        const fileName = `diagrams/${jobId}_p${q.imageBox.page}_q${qNum}_${Date.now()}.png`;

                        // ─── BUG 3c FIX: Upload with retry ───
                        let finalUrl = await uploadWithRetry('uploads', fileName, croppedBuffer, { contentType: 'image/png', upsert: true });

                        // RULE 2: No silent nulls! If storage failed, use data URL so image is NEVER null
                        if (!finalUrl) {
                            finalUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
                            base64Fallbacks++;
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

                            let optUrl = await uploadWithRetry('uploads', optFileName, optBuffer, { contentType: 'image/png', upsert: true });

                            // Rule 2: Fallback to base64 if storage fails
                            if (!optUrl) {
                                optUrl = `data:image/png;base64,${optBuffer.toString('base64')}`;
                                base64Fallbacks++;
                            }

                            q.optionImageUrls[optKey] = optUrl;
                            processedImages++;
                            logger.info(`[imageProcessor] Set option image for Q${qNum} opt=${optKey}`);
                        } catch (optCropErr) {
                            logger.error(`[imageProcessor] Skipping option image qNum=${qNum} opt=${optKey}: ${optCropErr.message}`);
                            cropFailures++;
                        }
                    }
                    if (Object.keys(q.optionImageUrls).length === 0) {
                        q.optionImageUrls = null;
                    }
                }
            } catch (qErr) {
                // ─── BUG 3c FIX: Per-question try/catch ───
                logger.error(`[imageProcessor] Error processing Q${qNum}: ${qErr.message}`);
                cropFailures++;
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

    const durationMs = Date.now() - startTime;

    const coverageReport = {
        figureQuestionsCount: figureQuestions.length,
        withImageCount: figureQuestions.length - missingQNums.length,
        missingQNums: missingQNums,
        needsReview: missingQNums.length > 0
    };

    // ─── BUG 3d FIX: Full imageExtraction metadata ───
    const imageExtractionMeta = {
        status: missingQNums.length === 0 ? 'complete' : 'partial',
        processedImages,
        base64Fallbacks,
        cropFailures,
        durationMs,
        coverageReport
    };

    logger.info(`[imageProcessor] RULE 3 COVERAGE REPORT for job ${jobId}: totalFigureQuestions=${coverageReport.figureQuestionsCount}, withImage=${coverageReport.withImageCount}, missing=[${missingQNums.join(', ')}], needsReview=${coverageReport.needsReview}, duration=${durationMs}ms`);

    return { processedCount: processedImages, coverageReport, imageExtractionMeta };
}

export default async function (job) {
    const { jobId, userId, filePath, storagePath, token, questions, testName, duration } = job.data;
    let imageExtractionMeta = null;

    try {
        await supabaseAdmin.from('jobs').update({ status: 'processing', progress: 75 }).eq('id', jobId);

        // Attempt image extraction - NEVER let this block the job from completing
        try {
            await ensureLocalFile(filePath, storagePath);
            const pdfBuffer = fs.readFileSync(filePath);
            const result = await extractImages(pdfBuffer, questions, jobId);
            logger.info(`[imageProcessor] Image extraction done: ${result.processedCount} images for job ${jobId}`);
            imageExtractionMeta = result.imageExtractionMeta;

            // ─── BUG 3d FIX: Persist FULL imageExtraction metadata on success ───
            try {
                const { data: currentJob } = await supabaseAdmin.from('jobs').select('metadata').eq('id', jobId).single();
                const currentMetadata = currentJob?.metadata || {};
                await supabaseAdmin.from('jobs').update({
                    metadata: {
                        ...currentMetadata,
                        imageExtraction: imageExtractionMeta,
                        coverageReport: result.coverageReport,
                        needsReview: result.coverageReport.needsReview
                    }
                }).eq('id', jobId);
            } catch (metaErr) {
                logger.warn(`[imageProcessor] Could not save imageExtraction metadata: ${metaErr.message}`);
            }
        } catch (fileErr) {
            // ─── BUG 3d FIX: Persist error metadata ───
            logger.warn(`[imageProcessor] PDF not readable at ${filePath}, skipping image extraction: ${fileErr.message}`);
            imageExtractionMeta = {
                status: 'error',
                error: `PDF not readable: ${fileErr.message}`,
                processedImages: 0,
                base64Fallbacks: 0,
                cropFailures: 0,
                durationMs: 0
            };
            try {
                const { data: currentJob } = await supabaseAdmin.from('jobs').select('metadata').eq('id', jobId).single();
                const currentMetadata = currentJob?.metadata || {};
                await supabaseAdmin.from('jobs').update({
                    metadata: { ...currentMetadata, imageExtraction: imageExtractionMeta }
                }).eq('id', jobId);
            } catch (metaErr) {
                logger.warn(`[imageProcessor] Could not save error metadata: ${metaErr.message}`);
            }
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
        // ─── BUG 3d FIX: Persist fatal error metadata ───
        logger.error(`[imageProcessor] fatal: ${error.message}`);
        try {
            const { data: currentJob } = await supabaseAdmin.from('jobs').select('metadata').eq('id', jobId).single();
            const currentMetadata = currentJob?.metadata || {};
            await supabaseAdmin.from('jobs').update({
                status: 'failed',
                error_message: error.message,
                metadata: {
                    ...currentMetadata,
                    imageExtraction: imageExtractionMeta || {
                        status: 'fatal_error',
                        error: error.message,
                        processedImages: 0,
                        base64Fallbacks: 0,
                        cropFailures: 0,
                        durationMs: 0
                    }
                }
            }).eq('id', jobId);
        } catch (metaErr) {
            await supabaseAdmin.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
        }
        throw error;
    }
}
