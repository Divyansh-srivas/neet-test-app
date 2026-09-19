import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import { getTotalPages, splitPdfDocIntoChunk } from '../services/pdf.service.js';
import { PDFDocument } from 'pdf-lib';
import { extractQuestionsFromSinglePage } from '../services/gemini.service.js';
import { config } from '../config/env.js';
import fs from 'fs';

export const uploadAndExtractDirect = async (req, res) => {
    try {
        const file = req.file;
        const testName = req.body.testName || 'Untitled Test';
        const duration = parseInt(req.body.duration) || 120;
        const userId = req.user.id;

        if (!file) {
            return res.status(400).json({ error: 'No PDF file provided.' });
        }

        const uploadId = uuidv4();
        const jobId = `job_${uploadId}`;
        const finalPath = file.path;

        // Ensure database insertion doesn't block the instant 200 OK response
        const { error: jobInsertErr } = await supabaseAdmin.from('jobs').insert({
            id: jobId,
            user_id: userId,
            upload_id: uploadId,
            status: 'processing',
            progress: 10,
            total_pages: 0 // Will be updated asynchronously
        });

        if (jobInsertErr) {
            logger.error(`[DIRECT] Job insert failed: ${jobInsertErr.message}`);
            return res.status(500).json({ error: 'Failed to initialize extraction job' });
        }

        // Return immediately so frontend doesn't hang
        res.status(200).json({
            success: true,
            jobId,
            message: 'Upload complete. Extraction is running in the background.',
        });

        // ─── Background Execution ────────────────────────────────────
        setImmediate(async () => {
            const fileBuffer = fs.readFileSync(finalPath);
            console.log(`[WORKER START] Triggered for Job: ${jobId}, Buffer Size: ${fileBuffer?.length || 0}`);
            if (!fileBuffer || fileBuffer.length === 0) {
                console.error(`[WORKER FATAL] Buffer is empty for ${jobId}`);
                await supabaseAdmin.from('jobs').update({ status: 'failed', error_message: 'File buffer is empty' }).eq('id', jobId).catch(()=>{});
                return;
            }

            const startTime = Date.now();

            try {
                console.log(`[WORKER] Loading PDF with pdf-lib to count pages...`);
                const pdfBytes = fs.readFileSync(finalPath);
                const loadedPdfDoc = await PDFDocument.load(pdfBytes);
                const totalPages = loadedPdfDoc.getPageCount();
                console.log(`[WORKER] Total pages found: ${totalPages}`);
                
                // Set total pages in DB
                await supabaseAdmin.from('jobs').update({ total_pages: totalPages }).eq('id', jobId);

                logger.info(`[DIRECT] Starting extraction: ${totalPages} pages, ${fileBuffer.length} bytes`);

                const io = req.app.get('io');
                let completedPages = 0;
                let accumulatedQuestions = [];
                let pdfUrl = null;

                const storagePath = `pdfs/${uploadId}.pdf`;
                const storageUploadPromise = supabaseAdmin.storage
                    .from('uploads')
                    .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true });

                // Fire and forget storage upload and generate URL early
                storageUploadPromise.then(async () => {
                    const { data: signedData } = await supabaseAdmin.storage
                        .from('uploads')
                        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
                    pdfUrl = signedData?.signedUrl || `/api/pdf/${uploadId}`;
                }).catch(() => {
                    pdfUrl = `/api/pdf/${uploadId}`;
                });

                // The AST is already loaded in loadedPdfDoc above
                console.log(`[WORKER] Using loaded AST for slicing...`);
                
                // Process pages with a simple native concurrency limit
                const concurrency = 2; // Reduced back to 2 to safely balance CPU/RAM on Render
                for (let i = 0; i < totalPages; i += concurrency) {
                    const chunk = Array.from({ length: Math.min(concurrency, totalPages - i) }, (_, idx) => i + idx + 1);
                    
                    const pageTasks = [];
                    
                    for (const pageNum of chunk) {
                        console.log(`[WORKER] ---> Slicing Page ${pageNum}/${totalPages}`);
                        try {
                            // Slice sequentially to prevent pdf-lib concurrent mutation deadlocks
                            const pageB64 = await splitPdfDocIntoChunk(loadedPdfDoc, pageNum, pageNum);
                            const pageBuffer = Buffer.from(pageB64, 'base64');
                            
                            // Push Gemini extraction to run concurrently
                            pageTasks.push((async () => {
                                console.log(`[WORKER] Sending Page ${pageNum} to Gemini (${pageBuffer.length} bytes)...`);
                                try {
                                    // 1. Extract from Gemini (Sequential zero-loss retry happens inside here)
                                    const questions = await extractQuestionsFromSinglePage(pageBuffer);
                                    console.log(`[WORKER] Page ${pageNum} extracted: ${questions.length} questions`);
                                    
                                    // 2. Process Diagram Cropping (Non-blocking array)
                                    const cropPromises = questions.map(async (q) => {
                                        if (q.hasDiagram && q.diagramBox) {
                                            try {
                                                const { cropPdfRegionToImage } = await import('../services/crop.service.js');
                                                const croppedImageBuffer = await cropPdfRegionToImage(pageBuffer, q.diagramBox);
                                                const fileName = `diagrams/${jobId}_p${pageNum}_q${q.qNum}_${Date.now()}.png`;
                                                
                                                const { error: uploadError } = await supabaseAdmin.storage
                                                    .from('uploads')
                                                    .upload(fileName, croppedImageBuffer, { contentType: 'image/png', upsert: true });

                                                if (!uploadError) {
                                                    const { data: publicUrlData } = supabaseAdmin.storage
                                                        .from('uploads')
                                                        .getPublicUrl(fileName);
                                                    q.diagramUrl = publicUrlData.publicUrl;
                                                }
                                            } catch (cropErr) {
                                                logger.warn(`Failed to crop diagram for p${pageNum} q${q.qNum}: ${cropErr.message}`);
                                            }
                                        }
                                    });
                                    
                                    await Promise.all(cropPromises);

                                    // 3. Incrementally Persist
                                    for (const q of questions) {
                                        await supabaseAdmin.from('questions').insert({
                                            id: q.id,
                                            job_id: jobId,
                                            q_num: q.qNum,
                                            subject: q.subject,
                                            chapter: q.chapter,
                                            difficulty: q.difficulty,
                                            question_text: q.question,
                                            options: q.options,
                                            correct_option: q.correct,
                                            explanation: q.explanation,
                                            diagram_url: q.diagramUrl || null
                                        });
                                    }
                                    
                                    accumulatedQuestions.push(...questions);
                                    completedPages++;
                                    
                                    const progress = Math.min(95, Math.round((completedPages / totalPages) * 100));
                                    await supabaseAdmin.from('jobs').update({ progress }).eq('id', jobId);
                                    
                                    if (io) {
                                        io.to(userId).emit('job-progress', { 
                                            jobId, progress, pagesCompleted: completedPages, totalPages, 
                                            questionsExtracted: accumulatedQuestions.length,
                                            status: `Extracted page ${completedPages}/${totalPages}` 
                                        });
                                    }
                                } catch (err) {
                                    console.error(`[PAGE EXTRACT ERROR] Page ${pageNum} failed: ${err.message}`);
                                    throw err; // Re-throw to make the Promise.all fail early if a page totally fails
                                }
                            })());
                        } catch (err) {
                            console.error(`[PAGE SLICE ERROR] Page ${pageNum} failed: ${err.message}`);
                            throw err; // Fail early if PDF slicing fails
                        }
                    }

                    await Promise.all(pageTasks);
                }

                if (accumulatedQuestions.length === 0) {
                    throw new Error("Extraction completed but 0 questions were found. The Gemini API might be overloaded or the PDF contains no parseable MCQs.");
                }

                // Wait for the full PDF storage upload to finish just in case
                await storageUploadPromise.catch(() => {});
                if (!pdfUrl) pdfUrl = `/api/pdf/${uploadId}`;

                const questionsWithPdf = accumulatedQuestions.map(q => ({ ...q, pdfUrl }));

                // ─── Create test record ───────────────────────────────────
                const { data: testRecord, error: testErr } = await supabaseAdmin.from('tests').insert({
                    teacher_id: userId,
                    name: testName || 'AI Extracted Test',
                    questions: questionsWithPdf,
                    total_questions: questionsWithPdf.length,
                    is_published: true
                }).select().single();

                if (testErr) logger.warn(`Test record error: ${testErr.message}`);

                const finalTestId = testRecord?.id || null;

                // ─── Mark job complete ───────────────────────────────────
                await supabaseAdmin.from('jobs').update({
                    status: 'completed',
                    progress: 100,
                    extracted_questions: questionsWithPdf.length,
                    test_id: finalTestId,
                    completed_at: new Date().toISOString()
                }).eq('id', jobId);

                if (io) {
                    io.to(userId).emit('job-completed', {
                        jobId,
                        testId: finalTestId,
                        testName,
                        duration,
                        questions: questionsWithPdf,
                        pdfUrl
                    });
                }

                console.log(`[WORKER COMPLETE] All pages extracted for ${jobId}`);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                logger.info(`[DIRECT] ✅ Job ${jobId} completed: ${questionsWithPdf.length} questions in ${elapsed}s`);
                
            } catch (err) {
                console.error(`[WORKER FATAL CRASH for ${jobId}]:`, err.stack || err.message);
                logger.error(`[DIRECT] Background extraction error: ${err.message}`);
                await supabaseAdmin.from('jobs').update({ status: 'failed', error_message: err.message }).eq('id', jobId).catch(() => {});
                const io = req.app.get('io');
                if (io) io.to(userId).emit('job-failed', { jobId, error: err.message });
            }
        });

    } catch (error) {
        logger.error(`[DIRECT] Upload error: ${error.message}`);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to process PDF upload.' });
        }
    }
};
