import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from '@napi-rs/canvas';

const leakedCanvases = [];
const leakedDocs = [];

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
            disableFontFace: true
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
        
        await Promise.race([
            renderTask.promise,
            new Promise((_, reject) => setTimeout(() => {
                timeoutFired = true;
                leakedCanvases.push(canvas);
                leakedDocs.push({ pdfDocument, page });
                try { renderTask.cancel(); } catch (e) {}
                reject(new Error('PDF render timed out after 15 seconds'));
            }, 15000))
        ]);
        
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
            disableFontFace: true
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

        // Calculate pixel coordinates from normalized 0-1000 coordinates
        const top = (ymin / 1000) * viewport.height;
        const left = (xmin / 1000) * viewport.width;
        const bottom = (ymax / 1000) * viewport.height;
        const right = (xmax / 1000) * viewport.width;
        
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
        
        await Promise.race([
            renderTask.promise,
            new Promise((_, reject) => setTimeout(() => {
                timeoutFired = true;
                leakedCanvases.push(canvas);
                leakedDocs.push({ pdfDocument, page });
                try { renderTask.cancel(); } catch (e) {}
                reject(new Error('PDF render timed out after 15 seconds'));
            }, 15000))
        ]);
        
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

export const createPdfImageProcessor = async (pdfBuffer) => {
    const uint8Array = new Uint8Array(pdfBuffer);
    
    const loadingTask = getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true
    });
    
    // Wrapper timeout for the entire loading process to prevent infinite hangs
    const pdfDocument = await Promise.race([
        loadingTask.promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF document loading timed out after 15 seconds')), 15000))
    ]);
    
    const pageCache = {};
    
    return {
        cropRegion: async (pageNum, bbox) => {
            let timeoutFired = false;
            let page = pageCache[pageNum];
            if (!page) {
                page = await pdfDocument.getPage(pageNum);
                pageCache[pageNum] = page;
            }
            
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            
            let ymin, xmin, ymax, xmax;
            if (Array.isArray(bbox) && bbox.length === 4) {
                [ymin, xmin, ymax, xmax] = bbox;
            } else {
                ({ ymin, xmin, ymax, xmax } = bbox);
            }

            const top = (ymin / 1000) * viewport.height;
            const left = (xmin / 1000) * viewport.width;
            const bottom = (ymax / 1000) * viewport.height;
            const right = (xmax / 1000) * viewport.width;
            
            const width = right - left;
            const height = bottom - top;
            
            const canvas = createCanvas(Math.round(width), Math.round(height));
            const context = canvas.getContext('2d');
            context.translate(-left, -top);
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            const renderTask = page.render(renderContext);
            
            await Promise.race([
                renderTask.promise,
                new Promise((_, reject) => setTimeout(() => {
                    timeoutFired = true;
                    leakedCanvases.push(canvas);
                    try { renderTask.cancel(); } catch (e) {}
                    reject(new Error('PDF render timed out after 15 seconds'));
                }, 15000))
            ]);
            
            return await canvas.encode('png');
        },
        cleanup: async () => {
            for (const page of Object.values(pageCache)) {
                try { page.cleanup(); } catch (e) {}
            }
            try { await pdfDocument.destroy(); } catch (e) {}
        }
    };
};
