import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

export const splitPdfIntoChunk = async (filePath, startPage, endPage) => {
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const chunkPdf = await PDFDocument.create();
    const pagesToCopy = Array.from({ length: endPage - startPage + 1 }, (_, idx) => startPage + idx);
    const copiedPages = await chunkPdf.copyPages(pdfDoc, pagesToCopy);
    copiedPages.forEach((page) => chunkPdf.addPage(page));
    
    const chunkBytes = await chunkPdf.save();
    return Buffer.from(chunkBytes).toString('base64');
};

export const getTotalPages = async (filePath) => {
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
};
