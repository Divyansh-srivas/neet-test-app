import * as pdfjsLib from 'pdfjs-dist';

// Use CDN for the worker to avoid Vite build configuration issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts a cropped image from a specific page of a PDF file using a bounding box.
 * 
 * @param {ArrayBuffer} pdfArrayBuffer - The raw array buffer of the PDF file
 * @param {number} pageNumber - 1-indexed page number
 * @param {number[]} boundingBox - [ymin, xmin, ymax, xmax] normalized 0-1000
 * @returns {Promise<string>} Base64 Data URL of the cropped JPEG image
 */
export async function extractImageFromPdf(pdfArrayBuffer, pageNumber, boundingBox) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
    const pdf = await loadingTask.promise;
    
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`Invalid page number ${pageNumber}`);
    }
    
    const page = await pdf.getPage(pageNumber);
    
    // Render at 3x scale for high resolution (crisp vectors)
    const scale = 3.0;
    const viewport = page.getViewport({ scale });
    
    // Create an invisible canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render the page to the canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
    
    // Calculate cropping coordinates based on normalized bounding box (0-1000)
    const [ymin, xmin, ymax, xmax] = boundingBox;
    
    const cropX = (xmin / 1000) * canvas.width;
    const cropY = (ymin / 1000) * canvas.height;
    const cropWidth = ((xmax - xmin) / 1000) * canvas.width;
    const cropHeight = ((ymax - ymin) / 1000) * canvas.height;
    
    // Ensure valid crop dimensions
    if (cropWidth <= 0 || cropHeight <= 0) {
      throw new Error('Invalid bounding box dimensions');
    }
    
    // Create a new canvas for the cropped image
    const cropCanvas = document.createElement('canvas');
    const cropContext = cropCanvas.getContext('2d');
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    
    // Fill with white background (in case of transparent PDFs)
    cropContext.fillStyle = '#FFFFFF';
    cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // Draw the cropped section
    cropContext.drawImage(
      canvas,
      cropX, cropY, cropWidth, cropHeight, // Source coordinates
      0, 0, cropWidth, cropHeight          // Destination coordinates
    );
    
    // Return as Base64 PNG for best fidelity with vector graphics and chemical structures
    return cropCanvas.toDataURL('image/png', 1.0);
  } catch (error) {
    console.error('Error extracting image from PDF:', error);
    return null;
  }
}
