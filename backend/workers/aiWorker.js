import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { extractQuestionsFromSinglePage } from '../services/gemini.service.js';
import { getTotalPages, splitPdfDocIntoChunk } from '../services/pdf.service.js';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

export const createAiWorker = (io) => {
    return new Worker('ai-extraction', async job => {
        const { jobId, userId, filePath, storagePath, totalPages, token, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            // ─── STEP 1: Update status to processing ────────────────────
            await supabase.from('jobs').update({ status: 'processing', progress: 10 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { 
                jobId, 
                progress: 15, 
                pagesCompleted: 0, 
                totalPages,
                questionsExtracted: 0,
                status: 'Reading PDF...'
            });

            // ─── STEP 2: Read the entire PDF file into a buffer ─────────
            logger.info(`[AI WORKER] Reading PDF from: ${filePath}`);
            const pdfBuffer = await fs.readFile(filePath);
            logger.info(`[AI WORKER] PDF buffer size: ${pdfBuffer.length} bytes (${Math.round(pdfBuffer.length / 1024)} KB)`);

            if (!pdfBuffer || pdfBuffer.length === 0) {
                throw new Error('PDF file is empty or could not be read');
            }

            // ─── STEP 3: Update progress — sending to Gemini ────────────
            await supabase.from('jobs').update({ progress: 20 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { 
                jobId, 
                progress: 25, 
                pagesCompleted: 0, 
                totalPages,
                questionsExtracted: 0,
                status: 'AI is analyzing the PDF...'
            });

            // ─── STEP 4: Sequential Page-by-Page Extraction ─────────────
            const pdfBytes = await fs.readFile(filePath);
            const loadedPdfDoc = await PDFDocument.load(pdfBytes);
            const totalPages = loadedPdfDoc.getPageCount();
            console.log(`[WORKER] Total pages found: ${totalPages}`);

            await supabase.from('jobs').update({ total_pages: totalPages }).eq('id', jobId);

            let allExtractedRaw = [];
            let completedPages = 0;

            // The AST is already loaded in loadedPdfDoc above
            console.log(`[WORKER] Using loaded AST for slicing...`);

            // Process pages with a simple native concurrency limit
            const concurrency = 2; // Reduced back to 2 to safely balance CPU/RAM on Render
            for (let i = 0; i < totalPages; i += concurrency) {
                const chunk = Array.from({ length: Math.min(concurrency, totalPages - i) }, (_, idx) => i + idx + 1);
                
                const pageTasks = chunk.map(pageNum => {
                    return (async () => {
                        console.log(`[WORKER] ---> Slicing Page ${pageNum}/${totalPages}`);
                    try {
                        const pageB64 = await splitPdfDocIntoChunk(loadedPdfDoc, pageNum, pageNum);
                        const pageBuffer = Buffer.from(pageB64, 'base64');
                        
                        console.log(`[WORKER] Sending Page ${pageNum} to Gemini (${pageBuffer.length} bytes)...`);
                        const questions = await extractQuestionsFromSinglePage(pageBuffer);
                        console.log(`[WORKER] Page ${pageNum} extracted: ${questions.length} questions`);

                        allExtractedRaw.push(...questions);
                        completedPages++;

                        const currentPercent = Math.min(95, Math.round((completedPages / totalPages) * 100));
                        await supabase.from('jobs').update({ progress: currentPercent }).eq('id', jobId);
                        
                        io.to(userId).emit('job-progress', { 
                            jobId, 
                            progress: currentPercent,
                            pagesCompleted: completedPages, 
                            totalPages,
                            questionsExtracted: allExtractedRaw.length,
                            status: `Extracted page ${completedPages}/${totalPages}`
                        });
                    } catch (err) {
                        console.error(`[PAGE EXTRACT ERROR] Page ${pageNum} failed: ${err.message}`);
                        throw err; // Fail early if API crashes completely
                    }
                    })();
                });

                await Promise.all(pageTasks);
            }

            // ─── STEP 5: Validate extraction results ────────────────────
            console.log(`[WORKER COMPLETE] All pages extracted for ${jobId}. Total questions: ${allExtractedRaw.length}`);
            
            if (allExtractedRaw.length === 0) {
                const errorMsg = `Extraction yielded 0 questions from ${totalPages} pages. Please verify the PDF contains standard NEET MCQ format.`;
                console.error(`[CRITICAL] ${errorMsg}`);
                throw new Error(errorMsg);
            }

            // ─── STEP 6: Update progress — extraction done ──────────────
            await supabase.from('jobs').update({ 
                progress: 70, 
                pages_completed: totalPages,
                extracted_questions: allExtractedRaw.length
            }).eq('id', jobId);

            io.to(userId).emit('job-progress', { 
                jobId, 
                progress: 70, 
                pagesCompleted: totalPages, 
                totalPages,
                questionsExtracted: allExtractedRaw.length,
                status: `Extracted ${allExtractedRaw.length} questions! Processing...`
            });

            logger.info(`[AI WORKER] ✅ Successfully extracted ${allExtractedRaw.length} questions from ${totalPages} pages`);

            // ─── STEP 7: Enqueue to Image Extraction ────────────────────
            await queues.imageExtraction.add('extract-images', {
                jobId, userId, filePath, storagePath, token, questions: allExtractedRaw, testName, duration
            });

        } catch (error) {
            logger.error(`AI Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { 
        connection: getRedisConnection(), 
        concurrency: 1,
        lockDuration: 300000 // 5 minute lock — Gemini can take time on large PDFs
    });
};
