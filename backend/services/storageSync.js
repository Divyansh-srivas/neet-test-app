import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Render's filesystem is EPHEMERAL. If the background worker container
 * restarts (crash, OOM, deploy, health-check restart) mid-job, any file
 * written to local disk (backend/uploads/*) is gone, even though the
 * BullMQ job itself survives in Redis and gets retried.
 *
 * This guarantees the PDF is present locally before we try to read it,
 * re-downloading from Supabase Storage (which IS persistent) if needed.
 */
export const ensureLocalFile = async (filePath, storagePath) => {
    try {
        await fs.access(filePath);
        return filePath; // still there, nothing to do
    } catch {
        // fall through to re-download
    }

    if (!storagePath) {
        throw new Error(
            `Local file missing (${filePath}) and no storagePath to recover it from. ` +
            `The container likely restarted mid-job and the original upload cannot be recovered.`
        );
    }

    logger.warn(`[storageSync] Local file missing, re-downloading from Supabase Storage: ${storagePath}`);

    const { data, error } = await supabaseAdmin.storage.from('uploads').download(storagePath);
    if (error || !data) {
        throw new Error(`Failed to recover PDF from Supabase Storage (${storagePath}): ${error?.message || 'no data'}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    logger.info(`[storageSync] Recovered ${filePath} from Supabase Storage (${buffer.length} bytes)`);
    return filePath;
};

export const fileExistsSync = (filePath) => fsSync.existsSync(filePath);
