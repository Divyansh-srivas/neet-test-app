import express from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.js';
import { apiLimiter, uploadLimiter } from '../middlewares/rateLimiter.js';
import { uploadPdf } from '../controllers/uploadController.js';
import { getJobs, getJobStatus, deleteJob } from '../controllers/jobsController.js';
import { getNotes, saveNotes } from '../controllers/notesController.js';
import { getProfile, updateProfile } from '../controllers/profileController.js';

const router = express.Router();

const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDFs are allowed'));
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

// Notes API
router.get('/notes/:testId', getNotes);
router.put('/notes/:testId', saveNotes);
// Profile API
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;
