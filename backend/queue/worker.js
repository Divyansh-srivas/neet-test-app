import { Worker } from 'bullmq';
import { connection } from './queue.js';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// Helper to wait
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function createWorker(io) {
  const worker = new Worker('pdf-extraction', async job => {
    const { uploadId, userId, filePath, testName, duration, token } = job.data;
    
    // We create a Supabase client that acts as the user if we have their token
    let userSupabase = supabase;
    if (token) {
        userSupabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
    }

    try {
      // 1. Create Job Record
      const { data: jobRecord, error: jobErr } = await userSupabase.from('jobs').insert({
        user_id: userId,
        upload_id: uploadId,
        status: 'processing',
        progress: 0,
        started_at: new Date().toISOString()
      }).select().single();

      if (jobErr) throw jobErr;
      const dbJobId = jobRecord.id;

      // Notify Frontend
      io.to(userId).emit('job-started', { jobId: dbJobId });

      // 2. Load PDF
      const pdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();
      const fullPdfBase64 = Buffer.from(pdfBytes).toString('base64');
      
      await userSupabase.from('jobs').update({ total_pages: totalPages }).eq('id', dbJobId);

      const prompt = `You are an expert NEET exam question extractor. Extract ALL questions from this PDF chunk.
Return ONLY a valid JSON array. No explanation.
Each question MUST have this exact structure:
{
  "qNum": 17,
  "subject": "Physics",
  "chapter": "Kinematics",
  "question": "Full question text",
  "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
  "correct": "A",
  "explanation": "Explanation or answer key note",
  "difficulty": "Medium",
  "imageBox": { "page": 1, "box": [ymin, xmin, ymax, xmax] }
}
CRITICAL INSTRUCTIONS:
1. Extract EVERY SINGLE QUESTION. Do not skip any questions!
2. Extract the EXACT question number into "qNum".
3. Extract "imageBox" if the question contains ANY diagram. "page" in imageBox is 1-indexed for THIS chunk.`;

      const CHUNK_SIZE = 2;
      let allQuestions = [];
      let extractedImagesCount = 0;

      for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
        const startPage = i;
        const endPage = Math.min(i + CHUNK_SIZE, totalPages) - 1;

        const chunkPdf = await PDFDocument.create();
        const pagesToCopy = Array.from({ length: endPage - startPage + 1 }, (_, idx) => startPage + idx);
        const copiedPages = await chunkPdf.copyPages(pdfDoc, pagesToCopy);
        copiedPages.forEach((page) => chunkPdf.addPage(page));
        
        const chunkBytes = await chunkPdf.save();
        const chunkBase64 = Buffer.from(chunkBytes).toString('base64');

        let success = false;
        let retries = 3;
        let response;
        
        while(retries > 0 && !success) {
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{ inlineData: { data: chunkBase64, mimeType: 'application/pdf' } }, prompt],
                    config: { responseMimeType: 'application/json' }
                });
                success = true;
            } catch(e) {
                if (e.status === 429 || e.message?.includes('429')) {
                    await delay(10000);
                    retries--;
                } else {
                    throw e;
                }
            }
        }

        if (success && response?.text) {
             let jsonStr = response.text.trim().replace(/^```json\n?/g, '').replace(/```\n?$/g, '');
             try {
                let chunkQs = JSON.parse(jsonStr);
                
                // Save to DB in real-time
                for (const q of chunkQs) {
                    const qId = `q_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                    
                    await userSupabase.from('questions').insert({
                        id: qId,
                        job_id: dbJobId,
                        q_num: q.qNum,
                        subject: ['Physics', 'Chemistry', 'Biology', 'Mathematics'].includes(q.subject) ? q.subject : 'Physics',
                        chapter: q.chapter,
                        difficulty: q.difficulty,
                        question_text: q.question,
                        options: q.options || { A: '', B: '', C: '', D: '' },
                        correct_option: q.correct,
                        explanation: q.explanation
                    });
                    
                    if (q.imageBox) {
                        extractedImagesCount++;
                        // In a real app we'd extract the actual image buffer and upload to S3/Supabase Storage.
                        // Here we just save the metadata bounding box since we don't have the pdfImages.js context yet,
                        // or we could adapt it. For now, store the raw box data.
                        await userSupabase.from('question_images').insert({
                           question_id: qId,
                           image_url: JSON.stringify(q.imageBox), // placeholder
                           page_number: startPage + q.imageBox.page
                        });
                    }
                }
                allQuestions.push(...chunkQs);
             } catch(err) {
                 console.error("Failed to parse chunk JSON:", err);
             }
        }
        
        const progress = Math.round(((endPage + 1) / totalPages) * 100);
        await userSupabase.from('jobs').update({ 
            progress, 
            pages_completed: endPage + 1,
            extracted_questions: allQuestions.length,
            extracted_images: extractedImagesCount
        }).eq('id', dbJobId);

        io.to(userId).emit('job-progress', { 
            jobId: dbJobId, 
            progress, 
            pagesCompleted: endPage + 1, 
            totalPages,
            questionsExtracted: allQuestions.length
        });
        
        await delay(4000); // Rate limit buffer
      }

      // Finish job
      await userSupabase.from('jobs').update({ 
          status: 'completed', 
          progress: 100,
          completed_at: new Date().toISOString()
      }).eq('id', dbJobId);

      io.to(userId).emit('job-completed', { jobId: dbJobId, testId: null });

    } catch (error) {
      console.error(error);
      io.to(userId).emit('job-failed', { error: error.message });
      // Try to mark job as failed
      try {
          await userSupabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('upload_id', uploadId);
      } catch(e) {}
      throw error;
    }
  }, { connection });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`);
  });

  console.log('✅ BullMQ Worker started');
  return worker;
}
