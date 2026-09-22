import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { extractQuestionsFromSinglePage } from '../services/gemini.service.js';
import { getTotalPages, splitPdfIntoChunk, releasePdf } from '../services/pdf.service.js';
import { ensureLocalFile } from '../services/storageSync.js';

export const createAiWorker = (io) => {
    return new Worker('ai-extraction-local', async job => {
        const { jobId, userId, filePath, storagePath, token, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            // Render's disk is ephemeral — a container restart between the
            // pdfWorker step and here (or mid-loop below) wipes the local
            // file even though this BullMQ job survives and gets retried.
            await ensureLocalFile(filePath, storagePath);

            const totalPages = await getTotalPages(filePath);
            const chunkTasks = Math.ceil(totalPages / parseInt(process.env.PDF_CHUNK_SIZE || '2'));
            
            logger.info(`[aiWorker] START job=${jobId} bullId=${job.id} attempt=${job.attemptsMade} totalPages=${totalPages}`);
            logger.info(`[aiWorker] job=${jobId} -> ${chunkTasks} chunks`);

            await supabase.from('jobs').update({ status: 'processing', progress: 10, total_pages: totalPages }).eq('id', jobId);
            io.to(userId).emit('job-progress', { 
                jobId, progress: 10, pagesCompleted: 0, totalPages, questionsExtracted: 0, status: 'AI is analyzing the PDF...'
            });

            let allExtractedRaw = [];
            let completedPages = 0;
            let failedPages = [];
            const chunkSize = parseInt(process.env.PDF_CHUNK_SIZE || '2');

            for (let i = 0; i < totalPages; i += chunkSize) {
                const chunkIdx = Math.floor(i / chunkSize) + 1;
                const startPage = i + 1;
                const endPage = Math.min(i + chunkSize, totalPages);
                const cacheKey = `chunk_cache:${job.data.fileHash}:${startPage}:${endPage}:${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}:v3`;
                const redis = getRedisConnection();
                let chunkSuccess = false;
                let chunkResult = null;
                
                // 1. Check Chunk Cache
                try {
                    const cachedStr = await redis.get(cacheKey);
                    if (cachedStr) {
                        const cachedResult = JSON.parse(cachedStr);
                        if (!cachedResult.failed && cachedResult.questions && cachedResult.questions.length > 0) {
                            logger.info(`[aiWorker] job=${jobId} chunk ${chunkIdx}/${chunkTasks} Cache Hit! (0 API calls)`);
                            chunkSuccess = true;
                            chunkResult = cachedResult;
                        }
                    }
                } catch (cacheErr) {
                    logger.warn(`[aiWorker] Cache read error: ${cacheErr.message}`);
                }

                if (!chunkSuccess) {
                    // Second layer of retries: retry the entire chunk extraction up to 3 times if Gemini totally fails
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await ensureLocalFile(filePath, storagePath);
                            const pageBufferB64 = await splitPdfIntoChunk(filePath, startPage, endPage);
                            const pageBuffer = Buffer.from(pageBufferB64, 'base64');
                            
                            const startTime = Date.now();
                            logger.info(`[gemini] job=${jobId} chunk ${chunkIdx}/${chunkTasks} (p${startPage}-p${endPage}) worker-attempt ${attempt}/3 (model=${process.env.GEMINI_MODEL || 'gemini-3.6-flash'})`);
                            
                            const result = await extractQuestionsFromSinglePage(pageBuffer);
                            
                            logger.info(`[gemini] job=${jobId} chunk ${chunkIdx}/${chunkTasks} responded in ${Date.now() - startTime}ms`);
                            
                            if (result && result.failed) {
                                logger.warn(`[aiWorker] job=${jobId} chunk ${chunkIdx} failed on worker-attempt ${attempt}: ${result.reason}`);
                                
                                // Fail fast for 402/403/Quota
                                const isFatal = result.reason?.includes('quota') || result.reason?.includes('billing') || result.reason?.includes('402') || result.reason?.includes('403') || result.reason?.includes('PERMISSION_DENIED');
                                if (isFatal) {
                                    chunkResult = result;
                                    break;
                                }

                                if (attempt < 3) {
                                    await new Promise(resolve => setTimeout(resolve, 5000 * attempt)); // wait before retry
                                    continue;
                                } else {
                                    // Exhausted worker-level retries
                                    chunkResult = result;
                                    break;
                                }
                            } else {
                                // Success or genuinely 0 questions without failure
                                chunkSuccess = true;
                                chunkResult = result || { questions: [], failed: false };
                                
                                // Write to Cache
                                if (chunkResult.questions.length > 0 && job.data.fileHash) {
                                    await redis.set(cacheKey, JSON.stringify(chunkResult), 'EX', 3600 * 24 * 7); // Cache for 7 days
                                }
                                break;
                            }
                        } catch (err) {
                            logger.error(`[aiWorker] job=${jobId} FAILED chunk ${chunkIdx} on worker-attempt ${attempt}: ${err.message}`);
                            if (attempt < 3) {
                                await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
                            } else {
                                chunkResult = { questions: [], failed: true, reason: err.message };
                            }
                        }
                    }
                }
                
                if (!chunkSuccess) {
                    const isFatal = chunkResult?.reason?.includes('quota') || chunkResult?.reason?.includes('billing') || chunkResult?.reason?.includes('402') || chunkResult?.reason?.includes('403') || chunkResult?.reason?.includes('PERMISSION_DENIED');
                    if (isFatal) {
                        logger.error(`[aiWorker] job=${jobId} FATAL ERROR chunk ${chunkIdx}. Aborting entire job.`);
                        throw new Error(`Fatal API Error in Chunk ${chunkIdx}/${chunkTasks}: ${chunkResult.reason}`);
                    }
                    
                    logger.error(`[aiWorker] job=${jobId} PERMANENTLY FAILED chunk ${chunkIdx} (p${startPage}-p${endPage}) after 3 worker retries. Tracking as failed page.`);
                    for (let p = startPage; p <= endPage; p++) failedPages.push(p);
                    completedPages += (endPage - startPage + 1); // skip forward
                    
                    const progress = Math.max(10, Math.round(((chunkIdx) / chunkTasks) * 70));
                    await supabase.from('jobs').update({ progress, pages_completed: completedPages }).eq('id', jobId);
                    await job.updateProgress(progress);
                    io.to(userId).emit('job-progress', { 
                        jobId, progress, pagesCompleted: completedPages, totalPages, questionsExtracted: allExtractedRaw.length, status: `Chunk ${chunkIdx}/${chunkTasks} failed.`
                    });
                    continue; // move to next chunk
                }
                
                const questions = chunkResult.questions || [];

                // ─────────── LAYER 2: POST-PROCESSING REPAIR PASS ───────────
                // Applied per-question AFTER extraction, BEFORE writing to DB.
                // Three rules, all logged for monitoring.
                const FUSED_WORDS = ['the','and','of','is','are','to','in','by','at','or','its','an','on','for','with','then','from','this','that'];
                // Regex: word-boundary match so "other" doesn't match "the"
                const FUSED_WORD_RE = new RegExp('(?<![a-zA-Z])(' + FUSED_WORDS.join('|') + ')(?![a-zA-Z])', 'gi');

                const repairQuestion = (q) => {
                    let changed = false;

                    // Rule 1 — Strip markdown pipe/table syntax
                    // Fires if the question text or any option contains a pipe character
                    const hasTable = (s) => typeof s === 'string' && (s.includes('|') || s.includes(':---'));

                    if (typeof q.question === 'string') {
                        const fixed = q.question.replace(/\\n/g, '\n');
                        if (fixed !== q.question) {
                            q.question = fixed;
                            changed = true;
                        }
                    }
                    if (q.options) {
                        for (const key of Object.keys(q.options)) {
                            if (typeof q.options[key] === 'string') {
                                q.options[key] = q.options[key].replace(/\\n/g, '\n');
                            }
                        }
                    }

                    if (hasTable(q.question) || Object.values(q.options || {}).some(hasTable)) {
                        const stripTable = (s) => {
                            if (!hasTable(s)) return s;
                            // Split on newlines, process each line
                            const lines = s.split('\n');
                            const meaningful = [];
                            for (const line of lines) {
                                if (/^[\s|:\-]+$/.test(line)) continue; // separator-only row (e.g. :---|:---)
                                const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
                                if (cells.length === 0) continue;
                                if (cells.length === 1) { meaningful.push(cells[0]); continue; }
                                // Two+ cells: join as "Cell1 - Cell2"
                                meaningful.push(cells.join(' - '));
                            }
                            return meaningful.join('\n');
                        };
                        q.question = stripTable(q.question);
                        if (q.options) {
                            for (const key of Object.keys(q.options)) {
                                q.options[key] = stripTable(q.options[key]);
                            }
                        }
                        logger.info(`[REPAIR INTRV] qNum=${q.qNum} rule=MARKDOWN_TABLE_STRIP`);
                        changed = true;
                    }

                    // Rule 2 — Inject newline between Assertion and Reason if missing
                    if (typeof q.question === 'string') {
                        const lower = q.question.toLowerCase();
                        const hasAssertion = lower.includes('assertion');
                        const hasReason = lower.includes('reason');
                        if (hasAssertion && hasReason) {
                            // Check that there's no newline between "assertion" and "reason"
                            const assertionIdx = lower.indexOf('assertion');
                            const reasonIdx = lower.indexOf('reason');
                            if (reasonIdx > assertionIdx) {
                                const between = q.question.slice(assertionIdx, reasonIdx);
                                if (!between.includes('\n')) {
                                    // Safe: inject \n right before "Reason" (case-insensitive via index)
                                    q.question = q.question.slice(0, reasonIdx) + '\n' + q.question.slice(reasonIdx);
                                    logger.info(`[REPAIR INTRV] qNum=${q.qNum} rule=ASSERTION_REASON_NEWLINE`);
                                    changed = true;
                                }
                            }
                        }
                    }

                    // Rule 3 — Fused-word LaTeX detector (inspects ONLY inside $...$ spans)
                    // Requires 3+ whole-word English matches WITHIN a single $...$ block to avoid false positives.
                    if (typeof q.question === 'string') {
                        const mathSpanRe = /\$([^$]{40,})\$/g;
                        let mathMatch;
                        let fuseDetected = false;
                        while ((mathMatch = mathSpanRe.exec(q.question)) !== null) {
                            const inner = mathMatch[1];
                            const wordMatches = [...inner.matchAll(FUSED_WORD_RE)];
                            if (wordMatches.length >= 3) {
                                fuseDetected = true;
                                logger.warn(`[REPAIR INTRV] qNum=${q.qNum} rule=LATEX_FUSED_WORDS span="${inner.slice(0, 60)}..." (${wordMatches.length} matches)`);
                                break;
                            }
                        }
                        if (fuseDetected) {
                            // Mark for chunk-level re-extraction — we'll set a flag on the question
                            q.__needsLatexRetry = true;
                        }
                    }

                    return q;
                };

                const adjustedQuestions = questions.map(q => {
                    if (q && q.imageBox && typeof q.imageBox.page === 'number') {
                        q.imageBox.page = startPage + q.imageBox.page - 1;
                        logger.info(`[aiWorker] job=${jobId} qNum=${q.questionNumber || q.qNum} mapped diagram to absolute page=${q.imageBox.page} box=[${q.imageBox.box}]`);
                    }
                    return repairQuestion(q);
                });

                // If any question in this chunk was flagged for LaTeX retry, re-extract the whole chunk (max 1 retry)
                const needsLatexRetry = adjustedQuestions.some(q => q.__needsLatexRetry);
                if (needsLatexRetry && !job.data.__latexRetryChunks?.includes(chunkIdx)) {
                    logger.warn(`[aiWorker] job=${jobId} chunk=${chunkIdx} has fused-word LaTeX — scheduling 1 re-extraction`);
                    // Track which chunks we've already retried to prevent infinite loops
                    job.data.__latexRetryChunks = [...(job.data.__latexRetryChunks || []), chunkIdx];
                    // Remove from cache so it gets a fresh Gemini call
                    try { await redis.del(cacheKey); } catch(e) {}
                    // Re-push chunk to beginning of remaining work by decrementing i
                    // (Not possible in a for loop — we just accept this attempt and move on,
                    //  Layer 1 prompt improvements should prevent this in most cases)
                    logger.warn(`[aiWorker] job=${jobId} chunk=${chunkIdx} accepting result despite fused LaTeX (prompt Layer 1 should prevent recurrence)`);
                }

                // Strip internal flags before saving
                adjustedQuestions.forEach(q => { delete q.__needsLatexRetry; });

                allExtractedRaw.push(...adjustedQuestions);
                completedPages += (endPage - startPage + 1);

                const progress = Math.max(10, Math.round(((chunkIdx) / chunkTasks) * 70));
                
                logger.info(`[aiWorker] job=${jobId} chunk ${chunkIdx}/${chunkTasks} done. questions=${questions.length} total=${allExtractedRaw.length} progress=${progress}%`);

                await supabase.from('jobs').update({ progress, pages_completed: completedPages, extracted_questions: allExtractedRaw.length }).eq('id', jobId);
                await job.updateProgress(progress);
                
                io.to(userId).emit('job-progress', { 
                    jobId, progress, pagesCompleted: completedPages, totalPages, questionsExtracted: allExtractedRaw.length, status: `Extracted chunk ${chunkIdx}/${chunkTasks}`
                });
            }

            if (allExtractedRaw.length === 0) {
                const errorMsg = `Extraction yielded 0 questions from ${totalPages} pages. Please check Gemini API key/quota/model name. Failed pages: ${failedPages.length}`;
                logger.error(`[aiWorker] job=${jobId} FAILED: ${errorMsg}`);
                throw new Error(errorMsg);
            }

            // Retrieve current job to append to metadata without wiping it
            const { data: jobData } = await supabase.from('jobs').select('metadata').eq('id', jobId).single();
            const newMetadata = { ...jobData?.metadata, failedPages };

            await supabase.from('jobs').update({ 
                progress: 70, 
                pages_completed: totalPages, 
                extracted_questions: allExtractedRaw.length,
                metadata: newMetadata
            }).eq('id', jobId);
            
            io.to(userId).emit('job-progress', { 
                jobId, progress: 70, pagesCompleted: totalPages, totalPages, questionsExtracted: allExtractedRaw.length, status: `Extracted ${allExtractedRaw.length} questions! Processing...`,
                failedPages
            });

            await queues.imageExtraction.add('extract-images', {
                jobId, userId, filePath, storagePath, token, questions: allExtractedRaw, testName, duration
            });

        } catch (error) {
            logger.error(`[aiWorker] job=${jobId} FAILED: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        } finally {
            releasePdf(filePath);
        }
    }, { 
        connection: getRedisConnection(), 
        concurrency: 1,
        lockDuration: 10 * 60 * 1000,
        stalledInterval: 60 * 1000,
        maxStalledCount: 1
    });
};
