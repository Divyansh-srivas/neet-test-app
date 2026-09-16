import React, { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker using CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Global in-memory cache for parsed PDF documents so the PDF is fetched & parsed ONLY ONCE per test session
const pdfDocumentCache = new Map();

/**
 * Helper to load PDF Document in-memory with caching.
 * Supports URL string, Base64 Data URL, ArrayBuffer, and Uint8Array.
 */
async function loadPdfDocument(pdfSource) {
    if (!pdfSource) throw new Error('No PDF source provided');

    const cacheKey = typeof pdfSource === 'string' ? pdfSource : 'in_memory_buffer';
    if (pdfDocumentCache.has(cacheKey)) {
        return pdfDocumentCache.get(cacheKey);
    }

    const docPromise = (async () => {
        let pdfData = null;

        if (typeof pdfSource === 'string') {
            // Handle Base64 Data URLs
            if (pdfSource.startsWith('data:application/pdf;base64,')) {
                const base64Data = pdfSource.split(',')[1];
                const binaryStr = atob(base64Data);
                pdfData = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    pdfData[i] = binaryStr.charCodeAt(i);
                }
            } else {
                // Determine full URL if relative
                let fetchUrl = pdfSource;
                if (fetchUrl.startsWith('/')) {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.neogravix.in';
                    fetchUrl = `${backendUrl}${fetchUrl}`;
                }

                // Try fetching with credentials/auth token first
                try {
                    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                    const headers = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const res = await fetch(fetchUrl, { headers });
                    if (res.ok) {
                        const arrayBuf = await res.arrayBuffer();
                        pdfData = new Uint8Array(arrayBuf);
                    } else if (fetchUrl.startsWith('http')) {
                        // Direct loading via pdfjsLib for external URLs
                        const loadingTask = pdfjsLib.getDocument({
                            url: fetchUrl,
                            useSystemFonts: true,
                            disableFontFace: true
                        });
                        return await loadingTask.promise;
                    } else {
                        throw new Error(`HTTP ${res.status} while fetching PDF`);
                    }
                } catch (fetchErr) {
                    if (fetchUrl.startsWith('http')) {
                        const loadingTask = pdfjsLib.getDocument({
                            url: fetchUrl,
                            useSystemFonts: true,
                            disableFontFace: true
                        });
                        return await loadingTask.promise;
                    }
                    throw fetchErr;
                }
            }
        } else if (pdfSource instanceof ArrayBuffer) {
            pdfData = new Uint8Array(pdfSource);
        } else if (pdfSource instanceof Uint8Array) {
            pdfData = pdfSource;
        }

        if (pdfData) {
            const loadingTask = pdfjsLib.getDocument({
                data: pdfData,
                useSystemFonts: true,
                disableFontFace: true
            });
            return await loadingTask.promise;
        }

        throw new Error('Unsupported PDF source type');
    })();

    pdfDocumentCache.set(cacheKey, docPromise);
    // Remove failed attempts from cache so retries can occur
    docPromise.catch(() => pdfDocumentCache.delete(cacheKey));

    return docPromise;
}

export default function PdfImageCropper({ pdfUrl, pageNum, box }) {
    const [imgData, setImgData] = useState(null);
    const [error, setError] = useState(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        
        async function extractImage() {
            try {
                if (!pdfUrl) throw new Error("No PDF URL provided");
                if (!box || !Array.isArray(box) || box.length < 4) {
                    throw new Error("Invalid bounding box");
                }

                // Load cached PDF document from in-memory buffer / URL
                const pdf = await loadPdfDocument(pdfUrl);

                const targetPage = pageNum || 1;
                if (targetPage < 1 || targetPage > pdf.numPages) {
                    throw new Error(`Page ${targetPage} out of bounds (1-${pdf.numPages})`);
                }
                
                const page = await pdf.getPage(targetPage);
                
                // Scale 2.5 for sharp, high-res vector/text rendering
                const scale = 2.5; 
                const viewport = page.getViewport({ scale });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;

                // Box coordinates from Gemini are normalized [ymin, xmin, ymax, xmax] scaled 0-1000
                const [ymin, xmin, ymax, xmax] = box;
                
                const cropY = Math.max(0, (ymin / 1000) * canvas.height);
                const cropX = Math.max(0, (xmin / 1000) * canvas.width);
                const cropH = Math.min(canvas.height - cropY, ((ymax - ymin) / 1000) * canvas.height);
                const cropW = Math.min(canvas.width - cropX, ((xmax - xmin) / 1000) * canvas.width);

                if (cropW <= 0 || cropH <= 0) {
                    throw new Error("Zero crop dimensions");
                }

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropW;
                cropCanvas.height = cropH;
                const cropCtx = cropCanvas.getContext('2d');
                
                // White background to prevent transparent black box artefacts
                cropCtx.fillStyle = '#ffffff';
                cropCtx.fillRect(0, 0, cropW, cropH);
                
                cropCtx.drawImage(
                    canvas, 
                    cropX, cropY, cropW, cropH, 
                    0, 0, cropW, cropH
                );
                
                if (isMounted.current) {
                    setImgData(cropCanvas.toDataURL('image/png', 0.95));
                }
            } catch (err) {
                console.warn("[PdfImageCropper] Diagram extraction warning:", err.message);
                if (isMounted.current) setError(err.message);
            }
        }
        
        extractImage();
        
        return () => { isMounted.current = false; };
    }, [pdfUrl, pageNum, box]);

    // NEVER inject raw red error stack traces directly onto student exam screen
    if (error) {
        return (
            <div style={{ padding: '6px 12px', background: 'var(--surface2)', borderRadius: 6, fontSize: 12, color: 'var(--muted)', marginTop: 8, fontStyle: 'italic', display: 'inline-block' }}>
                [Diagram unavailable]
            </div>
        );
    }

    if (!imgData) {
        return (
            <div style={{ height: 100, width: '100%', display: 'flex', alignItems:'center', justifyContent: 'center', background: 'var(--surface-hover)', borderRadius: 8, marginTop: 10, color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)'}}>
                Loading diagram...
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
                    maxHeight: 380, 
                    objectFit: 'contain', 
                    display: 'block'
                }} 
            />
        </div>
    );
}
