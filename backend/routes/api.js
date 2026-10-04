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
import { deleteTest as deleteTestCtrl, getTests } from '../controllers/testsController.js';

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

// Debug endpoint to prove deployment
router.get('/debug/deploy', (req, res) => {
    if (req.query.secret !== 'neogravix_verify') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        import('child_process').then(cp => {
            const hash = cp.execSync('git rev-parse HEAD').toString().trim();
            let grepPass2 = "";
            try {
                grepPass2 = cp.execSync('grep -n "performPass2Hunt" services/gemini.service.js').toString();
            } catch (e) {
                grepPass2 = "No results found (grep failed/empty)";
            }
            res.json({
                commit: hash,
                pass2Grep: grepPass2,
                timestamp: new Date().toISOString()
            });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Debug start worker
// Debug endpoints removed
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
router.get('/tests', getTests);
router.delete('/tests/:id', deleteTestCtrl);

// Notes API
router.get('/notes/:testId', getNotes);
router.put('/notes/:testId', saveNotes);
// Profile API
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Sessions API
router.post('/sessions', async (req, res) => {
    try {
        const { device_name, browser, os, ip_address } = req.body;
        const { data, error } = await supabaseAdmin.from('user_sessions').insert({
            user_id: req.user.id,
            device_name, browser, os, ip_address
        }).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/sessions/:id', async (req, res) => {
    try {
        await supabaseAdmin.from('user_sessions').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Library API
router.get('/library/:subject', getStudyMaterials);

// PDF Download Proxy Route
router.get('/pdf/:uploadId', getPdfFile);

// Debug Route
router.get('/debug/schema', checkSchema);

export default router;
