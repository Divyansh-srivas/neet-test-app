import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { logger } from '../utils/logger.js';

const leakedDocs = [];

class NapiCanvasFactory {
    create(width, height) {
        if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
        const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
        return { canvas, context: canvas.getContext('2d') };
    }
    reset(cc, width, height) {
        cc.canvas.width = Math.ceil(width);
        cc.canvas.height = Math.ceil(height);
    }
    destroy(cc) {
        cc.canvas.width = 0;
        cc.canvas.height = 0;
        cc.canvas = null;
        cc.context = null;
    }
}

/**
 * Renders a specific region of a 1-page PDF to a PNG buffer.
 * @param {Buffer} pdfBuffer - The single-page PDF buffer
 * @param {Object} bbox - { ymin, xmin, ymax, xmax } (normalized 0-1000)
 * @returns {Promise<Buffer>} PNG Buffer
 */
export const cropPdfRegionToImage = async (pdfBuffer, bbox) => {
    const uint8Array = new Uint8Array(pdfBuffer);
    
    let pdfDocument = null;
    let page = null;
    let timeoutFired = false;
    
    try {
        // Load PDF
        const loadingTask = getDocument({
            data: uint8Array,
            useSystemFonts: true,
            disableFontFace: true,
            CanvasFactory: NapiCanvasFactory
        });
        
        pdfDocument = await loadingTask.promise;
        page = await pdfDocument.getPage(1);
        
        // Get viewport at 150 DPI (approx scale 2.0)
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        // Calculate pixel coordinates from normalized 0-1000 coordinates
        const top = (bbox.ymin / 1000) * viewport.height;
        const left = (bbox.xmin / 1000) * viewport.width;
        const bottom = (bbox.ymax / 1000) * viewport.height;
        const right = (bbox.xmax / 1000) * viewport.width;
        
        const width = right - left;
        const height = bottom - top;
        
        // Create a canvas exactly the size of the crop region
        const canvas = createCanvas(Math.round(width), Math.round(height));
        const context = canvas.getContext('2d');
        
        // Create a rendering context where we transform the context so that 
        // the target region is drawn at (0, 0)
        context.translate(-left, -top);
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        const timeoutId = setTimeout(() => {
            timeoutFired = true;
            try { renderTask.cancel(); } catch (e) {}
        }, 15000);
        
        try {
            await renderTask.promise;
        } finally {
            clearTimeout(timeoutId);
        }

        if (timeoutFired) {
            throw new Error('PDF render timed out after 15 seconds');
        }
        
        // CRITICAL FIX: Allow PDF.js microtasks to finish writing to the canvas context
        // before we lock it for encoding in Rust. This prevents the "Failed to unwrap exclusive reference" crash.
        await new Promise(r => setTimeout(r, 50));
        
        // Encode to PNG buffer
        return await canvas.encode('png');
    } catch (e) {
        throw new Error(`PDF render failed in cropPdfRegionToImage: ${e.message}`);
    } finally {
        if (!timeoutFired) {
            try {
                if (page) page.cleanup();
                if (pdfDocument) await pdfDocument.destroy();
            } catch (cleanupErr) {
                // Ignore cleanup errors
            }
        }
    }
};

/**
 * Renders a specific region of a multi-page PDF to a PNG buffer.
 * @param {Buffer} pdfBuffer - The multi-page PDF buffer
 * @param {number} pageNum - The page number to extract from (1-indexed)
 * @param {Array|Object} bbox - [ymin, xmin, ymax, xmax] OR {ymin, xmin, ymax, xmax}
 * @returns {Promise<Buffer>} PNG Buffer
 */
export const cropMultiPagePdfRegionToImage = async (pdfBuffer, pageNum, bbox) => {
    const uint8Array = new Uint8Array(pdfBuffer);
    
    let pdfDocument = null;
    let page = null;
    let timeoutFired = false;
    
    try {
        // Load PDF
        const loadingTask = getDocument({
            data: uint8Array,
            useSystemFonts: true,
            disableFontFace: true,
            CanvasFactory: NapiCanvasFactory
        });
        
        pdfDocument = await loadingTask.promise;
        page = await pdfDocument.getPage(pageNum);
        
        // Get viewport at 150 DPI (approx scale 2.0)
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        // Handle both array and object formats for bbox
        let ymin, xmin, ymax, xmax;
        if (Array.isArray(bbox) && bbox.length === 4) {
            [ymin, xmin, ymax, xmax] = bbox;
        } else {
            ({ ymin, xmin, ymax, xmax } = bbox);
        }

        // Auto-detect coordinate scale: Gemini returns 0-1, legacy code used 0-1000
        const scale1000 = (ymin > 1 || xmin > 1 || ymax > 1 || xmax > 1);
        const divisor = scale1000 ? 1000 : 1;

        // Calculate pixel coordinates
        const top = (ymin / divisor) * viewport.height;
        const left = (xmin / divisor) * viewport.width;
        const bottom = (ymax / divisor) * viewport.height;
        const right = (xmax / divisor) * viewport.width;
        
        const width = right - left;
        const height = bottom - top;
        
        // Create a canvas exactly the size of the crop region
        const canvas = createCanvas(Math.round(width), Math.round(height));
        const context = canvas.getContext('2d');
        
        // Create a rendering context where we transform the context so that 
        // the target region is drawn at (0, 0)
        context.translate(-left, -top);
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        const timeoutId = setTimeout(() => {
            timeoutFired = true;
            try { renderTask.cancel(); } catch (e) {}
        }, 15000);

        try {
            await renderTask.promise;
        } finally {
            clearTimeout(timeoutId);
        }

        if (timeoutFired) {
            throw new Error('PDF render timed out after 15 seconds');
        }
        
        // CRITICAL FIX: Allow PDF.js microtasks to finish writing to the canvas context
        // before we lock it for encoding in Rust. This prevents the "Failed to unwrap exclusive reference" crash.
        await new Promise(r => setTimeout(r, 50));
        
        return await canvas.encode('png');
    } catch (e) {
        throw new Error(`PDF render failed in cropMultiPagePdfRegionToImage: ${e.message}`);
    } finally {
        if (!timeoutFired) {
            try {
                if (page) page.cleanup();
                if (pdfDocument) await pdfDocument.destroy();
            } catch (cleanupErr) {
                // Ignore cleanup errors
            }
        }
    }
};

// ─── Render each page once (white bg, scale 2.5, LRU of 3 pages),
// crop using loadImage or sharp fallback. Validate bbox, throw on degenerate sizes. ───

export const createPdfImageProcessor = async (pdfBuffer) => {
    const uint8Array = new Uint8Array(pdfBuffer);
    
    const loadingTask = getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true,
        CanvasFactory: NapiCanvasFactory
    });
    
    // Wrapper timeout for the entire loading process to prevent infinite hangs
    const pdfDocument = await Promise.race([
        loadingTask.promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF document loading timed out after 15 seconds')), 15000))
    ]);
    
    // LRU cache for rendered full-page canvases (max 3 pages)
    const PAGE_RENDER_SCALE = 2.5;
    const MAX_CACHED_PAGES = 3;
    const renderedPages = new Map(); // pageNum → { canvas, viewport, page, usedAt, image }

    async function getRenderedPage(pageNum) {
        if (renderedPages.has(pageNum)) {
            const entry = renderedPages.get(pageNum);
            entry.usedAt = Date.now();
            return entry;
        }

        // Evict LRU if at capacity
        if (renderedPages.size >= MAX_CACHED_PAGES) {
            let oldestKey = null, oldestTime = Infinity;
            for (const [key, val] of renderedPages) {
                if (val.usedAt < oldestTime) {
                    oldestTime = val.usedAt;
                    oldestKey = key;
                }
            }
            if (oldestKey !== null) {
                renderedPages.delete(oldestKey);
            }
        }

        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: PAGE_RENDER_SCALE });

        // Create full-page canvas with WHITE background
        const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
        const context = canvas.getContext('2d');
        // Fill white background first
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({ canvasContext: context, viewport });
        let timeoutFired = false;
        const timeoutId = setTimeout(() => {
            timeoutFired = true;
            try { renderTask.cancel(); } catch (e) {}
        }, 20000);

        try {
            await renderTask.promise;
        } finally {
            clearTimeout(timeoutId);
        }

        if (timeoutFired) {
            throw new Error(`Page ${pageNum} render timed out after 20 seconds`);
        }

        // Allow PDF.js microtasks to settle
        await new Promise(r => setTimeout(r, 50));

        const entry = { canvas, viewport, page, usedAt: Date.now(), image: null };
        renderedPages.set(pageNum, entry);
        return entry;
    }
    
    return {
        cropRegion: async (pageNum, bbox) => {
            let ymin, xmin, ymax, xmax;
            if (Array.isArray(bbox) && bbox.length === 4) {
                [ymin, xmin, ymax, xmax] = bbox;
            } else {
                ({ ymin, xmin, ymax, xmax } = bbox);
            }

            // Auto-detect coordinate scale: Gemini returns 0-1, legacy code used 0-1000
            const scale1000 = (ymin > 1 || xmin > 1 || ymax > 1 || xmax > 1);
            const divisor = scale1000 ? 1000 : 1;

            // Normalize to 0-1
            const ny1 = ymin / divisor;
            const nx1 = xmin / divisor;
            const ny2 = ymax / divisor;
            const nx2 = xmax / divisor;

            // Validate bbox
            // Reject inverted coordinates
            if (ny2 <= ny1 || nx2 <= nx1) {
                throw new Error(`Degenerate bbox: inverted coordinates [${ymin}, ${xmin}, ${ymax}, ${xmax}]`);
            }
            // Reject sliver crops (< 1% of page in either dimension)
            if ((ny2 - ny1) < 0.01 || (nx2 - nx1) < 0.01) {
                throw new Error(`Degenerate bbox: sliver crop [${ymin}, ${xmin}, ${ymax}, ${xmax}]`);
            }
            // Reject whole-page crops (> 95% of page area)
            if ((ny2 - ny1) * (nx2 - nx1) > 0.95) {
                throw new Error(`Degenerate bbox: whole-page crop [${ymin}, ${xmin}, ${ymax}, ${xmax}]`);
            }

            // Get pre-rendered full page
            const entry = await getRenderedPage(pageNum);
            const pageCanvas = entry.canvas;
            const viewport = entry.viewport;

            // Calculate pixel coordinates on the full-page canvas
            const top = ny1 * viewport.height;
            const left = nx1 * viewport.width;
            const bottom = ny2 * viewport.height;
            const right = nx2 * viewport.width;

            const sx = Math.round(left);
            const sy = Math.round(top);
            const sw = Math.round(right - left);
            const sh = Math.round(bottom - top);

            // Reject degenerate pixel sizes
            if (sw < 10 || sh < 10) {
                throw new Error(`Degenerate bbox: pixel size ${sw}x${sh} too small`);
            }

            try {
                if (!entry.image) {
                    entry.image = await loadImage(await pageCanvas.encode('png'));
                }
                const out = createCanvas(sw, sh);
                const outCtx = out.getContext('2d');
                outCtx.fillStyle = '#ffffff';
                outCtx.fillRect(0, 0, sw, sh);
                outCtx.drawImage(entry.image, sx, sy, sw, sh, 0, 0, sw, sh);
                return await out.encode('png');
            } catch (drawErr) {
                logger.warn(`[crop.service] drawImage path failed (${drawErr.message}); falling back to raw-pixel crop via sharp`);
                const sharp = (await import('sharp')).default;
                const px = pageCanvas.getContext('2d').getImageData(sx, sy, sw, sh);
                return await sharp(
                    Buffer.from(px.data.buffer, px.data.byteOffset, px.data.byteLength),
                    { raw: { width: sw, height: sh, channels: 4 } }
                ).flatten({ background: '#ffffff' }).png().toBuffer();
            }
        },
        cleanup: async () => {
            for (const entry of renderedPages.values()) {
                try { entry.page.cleanup(); } catch (e) {}
            }
            renderedPages.clear();
            try { await pdfDocument.destroy(); } catch (e) {}
        }
    };
};
