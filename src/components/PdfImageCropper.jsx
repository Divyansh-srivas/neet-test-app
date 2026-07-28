import React, { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker. Note: The exact URL might need to match the version in package.json (3.11.174)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function PdfImageCropper({ pdfUrl, pageNum, box }) {
    const [imgData, setImgData] = useState(null);
    const [error, setError] = useState(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        
        async function extractImage() {
            try {
                if (!pdfUrl) throw new Error("No PDF URL provided");
                
                // Fetch and parse the PDF
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;
                
                if (pageNum < 1 || pageNum > pdf.numPages) {
                    throw new Error(`Page ${pageNum} out of bounds`);
                }
                
                const page = await pdf.getPage(pageNum);
                
                // Render at a high scale for good resolution
                const scale = 2.0; 
                const viewport = page.getViewport({ scale });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                
                await page.render(renderContext).promise;

                // Box coordinates from Gemini are typically normalized [ymin, xmin, ymax, xmax] scaled by 1000
                const [ymin, xmin, ymax, xmax] = box;
                
                const cropY = (ymin / 1000) * canvas.height;
                const cropX = (xmin / 1000) * canvas.width;
                const cropH = ((ymax - ymin) / 1000) * canvas.height;
                const cropW = ((xmax - xmin) / 1000) * canvas.width;

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropW;
                cropCanvas.height = cropH;
                const cropCtx = cropCanvas.getContext('2d');
                
                // Ensure a white background (in case of transparent PDFs)
                cropCtx.fillStyle = '#ffffff';
                cropCtx.fillRect(0, 0, cropW, cropH);
                
                cropCtx.drawImage(
                    canvas, 
                    cropX, cropY, cropW, cropH, 
                    0, 0, cropW, cropH
                );
                
                if (isMounted.current) {
                    setImgData(cropCanvas.toDataURL('image/jpeg', 0.9));
                }
            } catch (err) {
                console.error("Failed to extract PDF image", err);
                if (isMounted.current) setError(err.message);
            }
        }
        
        extractImage();
        
        return () => { isMounted.current = false; };
    }, [pdfUrl, pageNum, box]);

    if (error) {
        return (
            <div style={{ padding: 10, background: 'var(--surface-hover)', borderRadius: 8, fontSize: 12, color: 'var(--red)', marginTop: 10 }}>
                [Diagram extraction failed: {error}]
            </div>
        );
    }

    if (!imgData) {
        return (
            <div style={{ height: 120, width: '100%', display: 'flex', alignItems:'center', justifyContent: 'center', background: 'var(--surface-hover)', borderRadius: 8, marginTop: 10, color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)'}}>
                Extracting diagram...
            </div>
        );
    }

    return (
        <div style={{ marginTop: 12, marginBottom: 12, background: '#fff', padding: 8, borderRadius: 8, border: '1px solid var(--border)', display: 'inline-block' }}>
            <img 
                src={imgData} 
                alt="Question Diagram" 
                style={{ 
                    maxWidth: '100%', 
                    maxHeight: 350, 
                    objectFit: 'contain', 
                    display: 'block'
                }} 
            />
        </div>
    );
}
