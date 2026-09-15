import { Worker } from 'bullmq';
import { getRedisConnection, queues } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export const createProcessWorker = (io) => {
    return new Worker('question-processing', async job => {
        const { jobId, userId, token, storagePath, questions, testName, duration } = job.data;
        const supabase = supabaseAdmin;
        
        try {
            await supabase.from('jobs').update({ status: 'processing', progress: 85 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { jobId, progress: 85 });
            
            // Validate and normalize questions
            const cleanedQuestions = questions.map(q => {
                let optionsObj = {};
                if (Array.isArray(q.options)) {
                    q.options.forEach(opt => {
                        if (opt && opt.id) optionsObj[opt.id] = opt.text || '';
                    });
                } else if (typeof q.options === 'object' && q.options !== null) {
                    optionsObj = q.options;
                }
                
                // Fallback default options if missing
                if (!optionsObj.A) optionsObj.A = 'Option A';
                if (!optionsObj.B) optionsObj.B = 'Option B';
                if (!optionsObj.C) optionsObj.C = 'Option C';
                if (!optionsObj.D) optionsObj.D = 'Option D';

                return {
                    id: uuidv4(),
                    qNum: q.qNum || q.questionNumber || 0,
                    subject: ['Physics', 'Chemistry', 'Biology', 'Mathematics'].includes(q.subject) ? q.subject : 'Physics',
                    chapter: q.chapter || 'Uncategorized',
                    difficulty: q.difficulty || 'Medium',
                    question: (q.question || q.questionText || '').trim(),
                    options: optionsObj,
                    correct: (q.correct || q.correctAnswer || 'A').toString().toUpperCase().trim(),
                    explanation: q.explanation || null,
                    imageBox: q.imageBox || null,
                    hasDiagram: q.hasDiagram || !!q.imageBox
                };
            }).filter(q => q.question.length > 0);

            await queues.resultSaving.add('save-results', {
                jobId, userId, token, storagePath, questions: cleanedQuestions, testName, duration
            });

        } catch (error) {
            logger.error(`Process Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection: getRedisConnection(), concurrency: 4 });
};
