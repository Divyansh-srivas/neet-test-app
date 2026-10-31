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

// ─── Figure crop box helpers ───
export function expandCropBox(box, pad = 0.02) {
    // box = [ymin, xmin, ymax, xmax] normalized 0-1
    const [y1, x1, y2, x2] = box;
    return [Math.max(0, y1 - pad), Math.max(0, x1 - pad), Math.min(1, y2 + pad), Math.min(1, x2 + pad)];
}

export function unionBox(a, b) {
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

export function normalizeBox(box) {
    if (!box) return null;
    let b = Array.isArray(box) ? [...box] : [box.ymin, box.xmin, box.ymax, box.xmax];
    if (b.length < 4 || b.some(v => v === undefined || isNaN(v))) return null;
    let [y1, x1, y2, x2] = b;
    if (y1 > 1 || x1 > 1 || y2 > 1 || x2 > 1) {
        y1 /= 1000;
        x1 /= 1000;
        y2 /= 1000;
        x2 /= 1000;
    }
    return [y1, x1, y2, x2];
}

export function isSaneBox(box) {
    const norm = normalizeBox(box);
    if (!norm) return false;
    const [ymin, xmin, ymax, xmax] = norm;
    // Inverted coordinates
    if (ymax <= ymin || xmax <= xmin) return false;
    // Sliver (< 1% in either dimension)
    if ((ymax - ymin) < 0.01 || (xmax - xmin) < 0.01) return false;
    // Whole page (> 95% area)
    if ((ymax - ymin) * (xmax - xmin) > 0.95) return false;
    return true;
}

function isImplausibleBox(box) {
    return !isSaneBox(box);
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

                // ─── EXPAND FIGURE CROP BOXES (Union with detector box + padding) ───
                const boxSource = q.imageBox || q.diagramBox;
                const rawGeminiBox = boxSource?.box || (Array.isArray(boxSource) ? boxSource : null);
                const geminiPage = boxSource?.page;
                const geminiBox = rawGeminiBox ? normalizeBox(rawGeminiBox) : null;

                if (geminiBox && isSaneBox(geminiBox) && geminiPage) {
                    let detectorBox = null;
                    try {
                        detectorBox = findDeterministicDiagramBox(pdfBuffer, qNum, stem, geminiPage - 1);
                    } catch (detErr) {
                        logger.warn(`[imageProcessor] findDeterministicDiagramBox failed for Q${qNum}: ${detErr.message}`);
                    }

                    let finalBox;
                    if (detectorBox && detectorBox.page === geminiPage) {
                        const normDetBox = normalizeBox(detectorBox);
                        const candidateBox = expandCropBox(unionBox(geminiBox, normDetBox));
                        const geminiArea = (geminiBox[2] - geminiBox[0]) * (geminiBox[3] - geminiBox[1]);
                        const candidateArea = (candidateBox[2] - candidateBox[0]) * (candidateBox[3] - candidateBox[1]);

                        // Safety rule: if the resulting box area is more than 0.55 of the page,
                        // or it is larger than 2.5x the Gemini box area, fall back to expandCropBox(geminiBox, 0.03) instead.
                        if (candidateArea > 0.55 || (geminiArea > 0 && candidateArea > 2.5 * geminiArea)) {
                            logger.warn(`[imageProcessor] Q${qNum}: union box exceeded safety limit (candidateArea=${candidateArea.toFixed(3)}, geminiArea=${geminiArea.toFixed(3)}). Falling back to expandCropBox(geminiBox, 0.03)`);
                            finalBox = expandCropBox(geminiBox, 0.03);
                        } else {
                            finalBox = candidateBox;
                        }
                    } else {
                        finalBox = expandCropBox(geminiBox, 0.03);
                    }

                    q.imageBox = { page: geminiPage, box: finalBox };
                    q.diagramBox = q.imageBox;
                    logger.info(`[imageProcessor] Q${qNum}: geminiBox=[${geminiBox.map(n => n.toFixed(4)).join(', ')}], detectorBox=${detectorBox ? `[${detectorBox.map(n => n.toFixed(4)).join(', ')}] (p${detectorBox.page})` : 'null'}, finalBox=[${finalBox.map(n => n.toFixed(4)).join(', ')}]`);
                } else if (q.imageBox && q.imageBox.box && !isSaneBox(q.imageBox.box)) {
                    logger.warn(`[imageProcessor] Rejecting implausible Gemini imageBox for Q${qNum}: [${q.imageBox.box}]. Recovering with deterministic detection.`);
                    const recovered = findDeterministicDiagramBox(pdfBuffer, qNum, stem, -1);
                    if (recovered && recovered.page && isSaneBox(recovered)) {
                        const finalBox = expandCropBox(normalizeBox(recovered), 0.02);
                        q.imageBox = { page: recovered.page, box: finalBox };
                        q.diagramBox = q.imageBox;
                        logger.info(`[imageProcessor] Q${qNum}: geminiBox=rejected, detectorBox=[${recovered.map(n => n.toFixed(4)).join(', ')}], finalBox=[${finalBox.map(n => n.toFixed(4)).join(', ')}]`);
                    } else {
                        const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1, stem);
                        if (fallbackBand && fallbackBand.page) {
                            q.imageBox = { page: fallbackBand.page, box: fallbackBand };
                            q.diagramBox = q.imageBox;
                            logger.info(`[imageProcessor] Applied column band fallback box for Q${qNum}: page ${fallbackBand.page}`);
                        } else {
                            q.imageBox = null;
                        }
                    }
                }

                // If question needs a diagram and has no imageBox yet, deterministically recover it
                if (needsFigure && (!q.imageBox || !q.imageBox.page)) {
                    const recovered = findDeterministicDiagramBox(pdfBuffer, qNum, stem, -1);
                    if (recovered && recovered.page && isSaneBox(recovered)) {
                        const finalBox = expandCropBox(normalizeBox(recovered), 0.02);
                        q.imageBox = { page: recovered.page, box: finalBox };
                        q.diagramBox = q.imageBox;
                        logger.info(`[imageProcessor] Q${qNum}: geminiBox=null, detectorBox=[${recovered.map(n => n.toFixed(4)).join(', ')}], finalBox=[${finalBox.map(n => n.toFixed(4)).join(', ')}]`);
                    } else {
                        const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1, stem);
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
                        logger.warn(`[imageProcessor] Primary crop failed for Q${qNum}: ${cropErr.message} | stack: ${(cropErr.stack || '').split('\n').slice(0, 6).join(' <- ')}. Trying column band fallback...`);
                        cropFailures++;
                        try {
                            const fallbackBand = getQuestionColumnBandBox(pdfBuffer, qNum, -1, stem);
                            if (fallbackBand && fallbackBand.page) {
                                croppedBuffer = await processor.cropRegion(fallbackBand.page, fallbackBand);
                            }
                        } catch (fbErr) {
                            logger.error(`[imageProcessor] Fallback crop also failed for Q${qNum}: ${fbErr.message} | stack: ${(fbErr.stack || '').split('\n').slice(0, 6).join(' <- ')}`);
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
                            logger.error(`[imageProcessor] Skipping option image qNum=${qNum} opt=${optKey}: ${optCropErr.message} | stack: ${(optCropErr.stack || '').split('\n').slice(0, 6).join(' <- ')}`);
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
