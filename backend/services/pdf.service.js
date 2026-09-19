import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

const pdfCache = new Map();

const getCachedPdf = async (filePath) => {
    if (pdfCache.has(filePath)) {
        return pdfCache.get(filePath);
    }
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfCache.set(filePath, pdfDoc);
    return pdfDoc;
};

export const releasePdf = (filePath) => {
    pdfCache.delete(filePath);
};

export const splitPdfIntoChunk = async (filePath, startPage, endPage) => {
    const pdfDoc = await getCachedPdf(filePath);
    return splitPdfDocIntoChunk(pdfDoc, startPage, endPage);
};

export const splitPdfDocIntoChunk = async (pdfDoc, startPage, endPage) => {
    const chunkPdf = await PDFDocument.create();
    const pagesToCopy = Array.from({ length: endPage - startPage + 1 }, (_, idx) => startPage + idx - 1);
    const copiedPages = await chunkPdf.copyPages(pdfDoc, pagesToCopy);
    copiedPages.forEach((page) => chunkPdf.addPage(page));
    
    const chunkBytes = await chunkPdf.save();
    return Buffer.from(chunkBytes).toString('base64');
};

export const getTotalPages = async (filePath) => {
    const pdfDoc = await getCachedPdf(filePath);
    return pdfDoc.getPageCount();
};
