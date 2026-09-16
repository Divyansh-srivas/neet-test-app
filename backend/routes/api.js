import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { authenticate } from '../middlewares/auth.js';
import { apiLimiter, uploadLimiter } from '../middlewares/rateLimiter.js';
import { uploadPdf } from '../controllers/uploadController.js';
import { uploadAndExtractDirect } from '../controllers/directExtractController.js';
import { getJobs, getJobStatus, deleteJob } from '../controllers/jobsController.js';
import { getNotes, saveNotes } from '../controllers/notesController.js';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { getStudyMaterials } from '../controllers/libraryController.js';

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

// Protect all API routes
router.use(authenticate);
router.use(apiLimiter);

// Upload API — uses direct extraction (no Redis/BullMQ dependency)
router.post('/upload', uploadLimiter, upload.single('file'), uploadAndExtractDirect);

// Jobs API
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJobStatus);
router.delete('/jobs/:id', deleteJob);

// Notes API
router.get('/notes/:testId', getNotes);
router.put('/notes/:testId', saveNotes);
// Profile API
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Library API
router.get('/library/:subject', getStudyMaterials);

export default router;
