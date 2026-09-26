import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from '@napi-rs/canvas';

/**
 * Renders a specific region of a 1-page PDF to a PNG buffer.
 * @param {Buffer} pdfBuffer - The single-page PDF buffer
 * @param {Object} bbox - { ymin, xmin, ymax, xmax } (normalized 0-1000)
 * @returns {Promise<Buffer>} PNG Buffer
 */
export const cropPdfRegionToImage = async (pdfBuffer, bbox) => {
    const uint8Array = new Uint8Array(pdfBuffer);
    
    // Load PDF
    const loadingTask = getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true
    });
    
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(1);
    
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
    
    await page.render(renderContext).promise;
    
    // Encode to PNG buffer
    return await canvas.encode('png');
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
    
    // Load PDF
    const loadingTask = getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true
    });
    
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(pageNum);
    
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
    
    await page.render(renderContext).promise;
    
    return await canvas.encode('png');
};
