import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { authenticate } from '../middlewares/auth.js';
import { apiLimiter, uploadLimiter } from '../middlewares/rateLimiter.js';
import { uploadPdf } from '../controllers/uploadController.js';
import { getJobs, getJobStatus, deleteJob } from '../controllers/jobsController.js';
import { getNotes, saveNotes } from '../controllers/notesController.js';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { getStudyMaterials } from '../controllers/libraryController.js';
import { getPdfFile } from '../controllers/pdfController.js';
import { checkSchema } from '../controllers/debugController.js';
import { deleteTest as deleteTestCtrl } from '../controllers/testsController.js';

const router = express.Router();

// Ensure uploads directory exists (crucial for Render production)
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ 
    dest: uploadDir,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDFs are allowed'));
    }
});

// Debug route
router.get('/debug/workers', async (req, res) => {
    if (!global.myWorkers) return res.json({ error: 'No workers started' });
    const states = await Promise.all(global.myWorkers.map(async w => {
        return {
            name: w.name,
            isRunning: w.isRunning(),
            isPaused: w.isPaused,
            closing: w.closing,
            concurrency: w.opts.concurrency,
            redisStatus: w.client && w.client.client ? w.client.client.status : 'no client',
            hasClient: !!w.client
        };
    }));
    res.json(states);
});

// Debug start worker
router.get('/debug/start-worker', async (req, res) => {
    try {
        const { Worker } = await import('bullmq');
        const { getRedisConnection } = await import('../queue/index.js');
        const qName = 'ai-extraction-test-123';
        const w = new Worker(qName, async job => {
            console.log('MANUAL WORKER PROCESSING', job.id);
            return { message: 'hello from manual worker' };
        }, { connection: getRedisConnection() });
        
        w.on('active', (job) => console.log('MANUAL ACTIVE', job.id));
        w.on('completed', (job) => console.log('MANUAL COMPLETED', job.id));
        w.on('failed', (job, err) => console.log('MANUAL FAILED', job.id, err.message));
        
        res.json({ started: true, msg: `Manual worker started on ${qName}` });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// Debug REDIS
router.get('/debug/redis', async (req, res) => {
    const { config } = await import('../config/env.js');
    res.json({
        hasRedisUrl: !!config.REDIS_URL,
        redisUrlEnd: config.REDIS_URL ? config.REDIS_URL.slice(-10) : null,
        hasUpstash: config.REDIS_URL ? config.REDIS_URL.includes('upstash') : false
    });
});

// Debug Counts
router.get('/debug/counts', async (req, res) => {
    try {
        const { Queue } = await import('bullmq');
        const { getRedisConnection } = await import('../queue/index.js');
        const conn = getRedisConnection();
        const pdfQueue = new Queue('pdf-upload', { connection: conn });
        const aiQueue = new Queue('ai-extraction', { connection: conn });
        
        const pdfCounts = await pdfQueue.getJobCounts();
        const aiCounts = await aiQueue.getJobCounts();
        
        const lastCompleted = await aiQueue.getCompleted(0, 0);
        const lastFailed = await aiQueue.getFailed(0, 0);
        
        res.json({ 
            pdfCounts, 
            aiCounts,
            lastCompleted: lastCompleted.length ? { id: lastCompleted[0].id, returnvalue: lastCompleted[0].returnvalue } : null,
            lastFailed: lastFailed.length ? { id: lastFailed[0].id, failedReason: lastFailed[0].failedReason } : null
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// Protect all API routes
router.use(authenticate);
router.use(apiLimiter);

// Upload API
router.post('/upload', uploadLimiter, upload.single('file'), uploadPdf);

// Jobs API
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJobStatus);
router.delete('/jobs/:id', deleteJob);

// Tests API
router.delete('/tests/:id', deleteTestCtrl);

// Notes API
router.get('/notes/:testId', getNotes);
router.put('/notes/:testId', saveNotes);
// Profile API
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Library API
router.get('/library/:subject', getStudyMaterials);

// PDF Download Proxy Route
router.get('/pdf/:uploadId', getPdfFile);

// Debug Route
router.get('/debug/schema', checkSchema);

export default router;
