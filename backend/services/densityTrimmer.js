import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from 'canvas';
import { supabaseAdmin } from '../config/supabase.js';
import { randomUUID } from 'crypto';

/**
 * Renders the PDF page to canvas, trims text leakage from the top/bottom 
 * using density/gap analysis, crops the image, uploads to Supabase, 
 * and returns the signed image URL.
 *
 * TRIM RULES (applies only to the top edge and bottom edge, never to interior):
 *  - A boundary chunk is trimmed ONLY if ALL of:
 *      (a) It is thin: chunk pixel height < TEXT_MAX_H (60px @ scale 2.5 = ~1 text line)
 *      (b) It has text-like density: maxDensity > TEXT_MIN_DENSITY (0.015, i.e. >1.5% of row is ink)
 *      (c) It is separated from the next chunk by at least GAP_MIN_ROWS of pure whitespace
 *          (this prevents slicing off thin-looking diagram components like bond lines,
 *           graph axes tails, or partial letters that are physically attached to the diagram)
 */
export async function cropAndUploadDiagram(pdfBuffer, box, testId, qNum) {
    if (!box || box.length !== 4) return null;
    const [ymin, xmin, ymax, xmax] = box;
    
    // --- Tuning constants ---
    const TEXT_MAX_H      = 60;   // px @ scale 2.5: thin text line ~24px, allow up to 60
    const TEXT_MIN_DENSITY = 0.015; // fraction of row width covered by ink
    const GAP_MIN_ROWS    = 8;    // minimum pure-whitespace rows between boundary chunk and diagram
    const WHITESPACE_THRESHOLD = 0.001; // row density below this = "pure whitespace"
    // ------------------------

    try {
        const data = new Uint8Array(pdfBuffer);
        const doc = await getDocument({ data, disableFontFace: true, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise;
        const page = await doc.getPage(1);
        const scale = 2.5;
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const isScale1 = ymax <= 1 && xmax <= 1;
        const scaleDivisor = isScale1 ? 1 : 1000;

        const padY = 0.05 * scaleDivisor;
        const safeYmin = Math.max(0, ymin - padY);
        const safeYmax = Math.min(scaleDivisor, ymax + padY);

        let safeXmin = xmin;
        let safeXmax = xmax;

        const boxWidth = xmax - xmin;
        const centerX = (xmin + xmax) / 2;

        if (boxWidth > 0.6 * scaleDivisor) {
            safeXmin = 0.05 * scaleDivisor;
            safeXmax = 0.95 * scaleDivisor;
        } else if (centerX < 0.5 * scaleDivisor) {
            safeXmin = 0.05 * scaleDivisor;
            safeXmax = 0.48 * scaleDivisor;
        } else {
            safeXmin = 0.52 * scaleDivisor;
            safeXmax = 0.95 * scaleDivisor;
        }

        const pxYmin = Math.floor((safeYmin / scaleDivisor) * canvas.height);
        const pxYmax = Math.floor((safeYmax / scaleDivisor) * canvas.height);
        const pxXmin = Math.floor((safeXmin / scaleDivisor) * canvas.width);
        const pxXmax = Math.floor((safeXmax / scaleDivisor) * canvas.width);
        
        const width = pxXmax - pxXmin;
        if (width <= 0) return null;
        
        // Sample the full column strip (pxXmin to pxXmax) for density analysis
        const imgData = ctx.getImageData(pxXmin, 0, width, canvas.height);
        
        const getRowDensity = (y) => {
            if (y < 0 || y >= canvas.height) return 0;
            let inkPixels = 0;
            const rowOffset = y * width * 4;
            for (let x = 0; x < width; x++) {
                const idx = rowOffset + x * 4;
                const r = imgData.data[idx];
                const g = imgData.data[idx + 1];
                const b = imgData.data[idx + 2];
                if (r < 230 || g < 230 || b < 230) inkPixels++;
            }
            return inkPixels / width;
        };

        const rowDensities = [];
        for (let y = 0; y < canvas.height; y++) rowDensities.push(getRowDensity(y));
        
        // Find contiguous chunks of ink separated by whitespace
        const getChunks = (startY, endY) => {
            const chunks = [];
            let inChunk = false;
            let chunkStart = 0;
            let maxDensityInChunk = 0;
            
            for (let y = startY; y < endY; y++) {
                const d = rowDensities[y];
                if (d > WHITESPACE_THRESHOLD) { 
                    if (!inChunk) {
                        inChunk = true;
                        chunkStart = y;
                        maxDensityInChunk = d;
                    } else {
                        maxDensityInChunk = Math.max(maxDensityInChunk, d);
                    }
                } else {
                    if (inChunk) {
                        chunks.push({ start: chunkStart, end: y - 1, maxDensity: maxDensityInChunk });
                        inChunk = false;
                    }
                }
            }
            if (inChunk) chunks.push({ start: chunkStart, end: endY - 1, maxDensity: maxDensityInChunk });
            return chunks;
        };

        // Count consecutive pure-whitespace rows starting from `from` going toward `to`
        const countGap = (from, to, step) => {
            let count = 0;
            for (let y = from; y !== to; y += step) {
                if (rowDensities[y] <= WHITESPACE_THRESHOLD) count++;
                else break;
            }
            return count;
        };
        
        let currentYmin = pxYmin;
        let currentYmax = pxYmax;
        
        // TRIM TOP INWARD: only if boundary chunk is thin, text-like, AND has a gap below it
        let topChunks = getChunks(currentYmin, currentYmax);
        while (topChunks.length >= 2) {  // Need at least 2 chunks: the suspected text + the diagram
            const firstChunk = topChunks[0];
            const chunkH = firstChunk.end - firstChunk.start;
            // Gap = whitespace rows between end of first chunk and start of second chunk
            const gapBelow = countGap(firstChunk.end + 1, topChunks[1].start, 1);
            
            if (chunkH < TEXT_MAX_H && firstChunk.maxDensity > TEXT_MIN_DENSITY && gapBelow >= GAP_MIN_ROWS) {
                currentYmin = topChunks[1].start;  // Jump to start of next chunk (skips gap too)
                topChunks = getChunks(currentYmin, currentYmax);
            } else {
                break;
            }
        }
        
        // TRIM BOTTOM INWARD: same logic, from the bottom edge
        let bottomChunks = getChunks(currentYmin, currentYmax);
        while (bottomChunks.length >= 2) {
            const lastChunk = bottomChunks[bottomChunks.length - 1];
            const prevChunk = bottomChunks[bottomChunks.length - 2];
            const chunkH = lastChunk.end - lastChunk.start;
            // Gap = whitespace rows between end of second-to-last chunk and start of last chunk
            const gapAbove = countGap(lastChunk.start - 1, prevChunk.end, -1);
            
            if (chunkH < TEXT_MAX_H && lastChunk.maxDensity > TEXT_MIN_DENSITY && gapAbove >= GAP_MIN_ROWS) {
                currentYmax = prevChunk.end + 1;  // Cut at end of second-to-last chunk
                bottomChunks = getChunks(currentYmin, currentYmax);
            } else {
                break;
            }
        }
        
        if (currentYmax <= currentYmin) return null;
        
        // Add 8px visual padding so nothing is flush against the edge
        currentYmin = Math.max(pxYmin, currentYmin - 8);
        currentYmax = Math.min(pxYmax, currentYmax + 8);
        
        // TRIM HORIZONTAL WHITESPACE
        const getColDensity = (x) => {
            let inkPixels = 0;
            for (let y = currentYmin; y < currentYmax; y++) {
                const idx = (y * width + x) * 4;
                const r = imgData.data[idx];
                const g = imgData.data[idx + 1];
                const b = imgData.data[idx + 2];
                if (r < 230 || g < 230 || b < 230) inkPixels++;
            }
            return inkPixels / (currentYmax - currentYmin);
        };
        
        let relativeXmin = 0;
        let relativeXmax = width - 1;
        while (relativeXmin < relativeXmax && getColDensity(relativeXmin) <= WHITESPACE_THRESHOLD) relativeXmin++;
        while (relativeXmax > relativeXmin && getColDensity(relativeXmax) <= WHITESPACE_THRESHOLD) relativeXmax--;
        
        // Add 8px visual padding horizontally
        relativeXmin = Math.max(0, relativeXmin - 8);
        relativeXmax = Math.min(width - 1, relativeXmax + 8);

        const cropW = relativeXmax - relativeXmin;
        const cropH = currentYmax - currentYmin;
        const finalXmin = pxXmin + relativeXmin;
        
        const cropCanvas = createCanvas(cropW, cropH);
        const cropCtx = cropCanvas.getContext('2d');
        
        cropCtx.fillStyle = 'white';
        cropCtx.fillRect(0, 0, cropW, cropH);
        cropCtx.drawImage(
            canvas,
            finalXmin, currentYmin, cropW, cropH,
            0, 0, cropW, cropH
        );
        
        const pngBuffer = cropCanvas.toBuffer('image/png');
        
        // Upload to Supabase Storage
        const fileName = `diagrams/${testId || 'temp'}/${qNum}_${randomUUID()}.png`;
        const { error: uploadError } = await supabaseAdmin.storage
            .from('uploads')
            .upload(fileName, pngBuffer, { contentType: 'image/png', upsert: true });
            
        if (uploadError) throw new Error(`Supabase upload failed: ${uploadError.message}`);
        
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('uploads')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365);
            
        if (signedError) throw new Error(`Signed URL failed: ${signedError.message}`);
        
        return signedData.signedUrl;

    } catch (e) {
        console.error("cropAndUploadDiagram failed:", e);
        return null;
    }
}


export async function uploadSmartFallbackDiagram(pdfBuffer, box, testId, qNum) {
    try {
        const data = new Uint8Array(pdfBuffer);
        const doc = await getDocument({ data, disableFontFace: true, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise;
        const page = await doc.getPage(1);
        const scale = 2.0; // Slightly lower scale for fallback to save space/bandwidth
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        let [ymin, xmin, ymax, xmax] = [0, 0, 1, 1];
        if (box && box.length === 4) {
            const isScale1 = box[2] <= 1 && box[3] <= 1;
            const scaleDivisor = isScale1 ? 1 : 1000;
            ymin = box[0] / scaleDivisor;
            xmin = box[1] / scaleDivisor;
            ymax = box[2] / scaleDivisor;
            xmax = box[3] / scaleDivisor;
        }
        
        // Smart Columning
        const isLeftColumn = xmin < 0.5;
        const colXmin = isLeftColumn ? 0.0 : 0.48;
        const colXmax = isLeftColumn ? 0.52 : 1.0;
        
        // Smart Vertical Banding (Question Context)
        const bandYmin = Math.max(0, ymin - 0.15); // Add 15% page height margin above
        const bandYmax = Math.min(1, ymax + 0.2); // Add 20% page height margin below
        
        const pxXmin = Math.floor(colXmin * canvas.width);
        const pxXmax = Math.floor(colXmax * canvas.width);
        const pxYmin = Math.floor(bandYmin * canvas.height);
        const pxYmax = Math.floor(bandYmax * canvas.height);
        
        const w = pxXmax - pxXmin;
        const h = pxYmax - pxYmin;
        
        const cropCanvas = createCanvas(w, h);
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.fillStyle = 'white';
        cropCtx.fillRect(0, 0, w, h);
        cropCtx.putImageData(ctx.getImageData(pxXmin, pxYmin, w, h), 0, 0);
        
        const pngBuffer = cropCanvas.toBuffer('image/png');
        const fileName = `diagrams/${testId || 'temp'}/${qNum}_fallback_${randomUUID()}.png`;
        const { error: uploadError } = await supabaseAdmin.storage
            .from('uploads')
            .upload(fileName, pngBuffer, { contentType: 'image/png', upsert: true });
            
        if (uploadError) throw new Error(`Supabase fallback upload failed: ${uploadError.message}`);
        
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('uploads')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365);
            
        if (signedError) throw new Error(`Signed URL failed: ${signedError.message}`);
        
        return signedData.signedUrl;
    } catch (e) {
        console.error('uploadSmartFallbackDiagram Error:', e);
        return null;
    }
}
