import { Worker } from 'bullmq';
import { connection, queues } from '../queue/index.js';
import { createScopedClient } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const createProcessWorker = (io) => {
    return new Worker('question-processing', async job => {
        const { jobId, userId, token, questions, testName, duration } = job.data;
        const supabase = createScopedClient(token);
        
        try {
            await supabase.from('jobs').update({ status: 'Processing Questions', progress: 85 }).eq('id', jobId);
            io.to(userId).emit('job-progress', { jobId, progress: 85 });
            
            // Validate and clean questions
            const cleanedQuestions = questions.map(q => {
                return {
                    id: `q_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    qNum: q.qNum || 0,
                    subject: ['Physics', 'Chemistry', 'Biology', 'Mathematics'].includes(q.subject) ? q.subject : 'Physics',
                    chapter: q.chapter || 'Uncategorized',
                    difficulty: q.difficulty || 'Medium',
                    question: q.question || '',
                    options: q.options || { A: '', B: '', C: '', D: '' },
                    correct: q.correct || 'A',
                    explanation: q.explanation || '',
                    imageBox: q.imageBox || null
                };
            }).filter(q => q.question.trim().length > 0);

            await queues.resultSaving.add('save-results', {
                jobId, userId, token, questions: cleanedQuestions, testName, duration
            });

        } catch (error) {
            logger.error(`Process Worker failed: ${error.message}`);
            io.to(userId).emit('job-failed', { jobId, error: error.message });
            await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
            throw error;
        }
    }, { connection, concurrency: 4 });
};
