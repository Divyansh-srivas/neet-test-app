import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Serve local or stored PDF file directly from backend.
 * Provides a reliable fallback when Supabase Storage public URLs are rejected (HTTP 400).
 */
export const getPdfFile = async (req, res) => {
    try {
        const { uploadId } = req.params;
        const localPath = path.resolve('uploads', `${uploadId}.pdf`);
        
        // Serve directly from server disk if available
        if (fs.existsSync(localPath)) {
            res.setHeader('Content-Type', 'application/pdf');
            return fs.createReadStream(localPath).pipe(res);
        }

        // Fallback to Supabase Storage download if file was cleaned up locally
        const userId = req.user?.id;
        let storagePath = `${uploadId}.pdf`;
        if (userId) {
            storagePath = `${userId}/${uploadId}.pdf`;
        }

        const { data, error } = await supabaseAdmin.storage.from('uploads').download(storagePath);
        
        if (error || !data) {
            return res.status(404).json({ error: 'PDF file not found' });
        }

        const buffer = Buffer.from(await data.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    } catch (err) {
        logger.error(`Error serving PDF ${req.params.uploadId}: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve PDF file' });
    }
};
