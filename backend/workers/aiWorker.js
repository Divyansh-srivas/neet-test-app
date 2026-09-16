import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { extractQuestionsFromPDFBuffer } from '../services/gemini.service.js';
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

            // ─── STEP 4: Send ENTIRE PDF to Gemini natively ─────────────
            // NO chunking, NO local image conversion, NO sharp/canvas.
            // Gemini reads the PDF pages directly including diagrams.
            logger.info(`[AI WORKER] Sending entire PDF to Gemini (${totalPages} pages)...`);
            
            const allExtractedRaw = await extractQuestionsFromPDFBuffer(pdfBuffer, (progressUpdate) => {
                // Optional progress callback from the extraction function
                if (progressUpdate) {
                    io.to(userId).emit('job-progress', { 
                        jobId, 
                        progress: Math.min(25 + Math.round(progressUpdate * 40), 65),
                        pagesCompleted: Math.round(progressUpdate * totalPages), 
                        totalPages,
                        questionsExtracted: 0,
                        status: 'AI is extracting questions...'
                    });
                }
            });

            // ─── STEP 5: Validate extraction results ────────────────────
            console.log(`[AI WORKER] Extraction complete. Total questions recovered: ${allExtractedRaw.length}`);
            
            if (allExtractedRaw.length === 0) {
                const debugInfo = `TotalPages: ${totalPages}, PDFSize: ${pdfBuffer.length} bytes`;
                const errorMsg = `Extraction yielded 0 questions (${debugInfo}). The Gemini API processed the PDF but found no parseable MCQs. Please verify the PDF contains standard NEET MCQ format.`;
                console.error(`[CRITICAL] ${errorMsg}`);
                logger.error(`[AI WORKER] ${errorMsg}`);
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
