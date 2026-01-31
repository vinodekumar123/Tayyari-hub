'use server';

import { PDFDocument } from 'pdf-lib';

/**
 * Split a PDF into individual pages.
 * Returns an array of base64-encoded single-page PDFs.
 * This is more reliable than image conversion and Gemini can process PDFs directly.
 */
export async function splitPdfToPages(pdfBase64: string): Promise<{
    success: boolean;
    pages?: { pageNumber: number; base64: string; mimeType: string }[];
    totalPages?: number;
    error?: string;
}> {
    try {
        // Decode base64 to Buffer (Node.js native handling)
        const pdfBytes = Buffer.from(pdfBase64, 'base64');

        // Load the PDF
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        if (totalPages === 0) {
            return { success: false, error: "PDF has no pages" };
        }

        const pages: { pageNumber: number; base64: string; mimeType: string }[] = [];

        // Extract each page as a separate PDF
        for (let i = 0; i < totalPages; i++) {
            // Create a new PDF with just this page
            const singlePagePdf = await PDFDocument.create();
            const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
            singlePagePdf.addPage(copiedPage);

            // Convert to bytes
            const singlePageBytes = await singlePagePdf.save();

            // Convert to base64 using Buffer (safe for large files)
            const base64 = Buffer.from(singlePageBytes).toString('base64');

            pages.push({
                pageNumber: i + 1,
                base64,
                mimeType: 'application/pdf'
            });
        }

        return {
            success: true,
            pages,
            totalPages
        };

    } catch (error: any) {
        console.error("PDF Split Error:", error);
        return {
            success: false,
            error: error.message || "Failed to split PDF"
        };
    }
}
