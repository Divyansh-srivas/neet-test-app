import { v4 as uuidv4 } from 'uuid';
import { queues } from '../queue/index.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';

export const uploadPdf = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const userId = req.user.id;
        const token = req.token;
        const { testName, duration } = req.body;
        const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const jobId = `job_${uuidv4()}`;

        // Ensure uploads directory exists
        const uploadDir = path.resolve('uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const finalPath = path.join(uploadDir, `${uploadId}.pdf`);
        fs.renameSync(req.file.path, finalPath);

        logger.info(`Received PDF upload from user ${userId}. Uploading to Supabase Storage...`);

        // Upload to Supabase Storage
        const fileBuffer = fs.readFileSync(finalPath);
        const { error: storageError } = await supabaseAdmin.storage
            .from('uploads')
            .upload(`${userId}/${uploadId}.pdf`, fileBuffer, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (storageError) {
            logger.warn(`Failed to upload to Supabase Storage: ${storageError.message}`);
            // Continue processing locally even if storage fails, to ensure robustness
        }

        // Add to the first queue in the pipeline
        await queues.pdfUpload.add('process-pdf', {
            uploadId,
            jobId,
            userId,
            filePath: finalPath,
            storagePath: `${userId}/${uploadId}.pdf`,
            token,
            testName,
            duration
        }, { jobId }); // Use custom jobId for tracking

        res.status(202).json({ success: true, jobId });
    } catch (error) {
        next(error);
    }
};
