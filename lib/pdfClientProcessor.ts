/**
 * Client-side PDF splitting using pdf-lib (browser-compatible)
 * This runs entirely in the browser, so we never send the full PDF to the server.
 */
import { PDFDocument } from 'pdf-lib';

export interface PageData {
    pageNumber: number;
    base64: string;
    mimeType: string;
}

export interface SplitResult {
    success: boolean;
    pages?: PageData[];
    totalPages?: number;
    error?: string;
}

/**
 * Split a PDF into individual pages on the client-side.
 * Returns an array of base64-encoded single-page PDFs.
 * 
 * @param file - The PDF File object from input[type=file]
 * @returns Promise with split result
 */
export async function splitPdfClientSide(file: File): Promise<SplitResult> {
    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load the PDF using pdf-lib (works in browser)
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();

        if (totalPages === 0) {
            return { success: false, error: "PDF has no pages" };
        }

        const pages: PageData[] = [];

        // Extract each page as a separate PDF
        for (let i = 0; i < totalPages; i++) {
            // Create a new PDF with just this page
            const singlePagePdf = await PDFDocument.create();
            const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
            singlePagePdf.addPage(copiedPage);

            // Convert to bytes
            const singlePageBytes = await singlePagePdf.save();

            // Convert to base64 (browser-compatible way)
            const base64 = arrayBufferToBase64(singlePageBytes);

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

/**
 * Get the page count of a PDF without fully splitting it.
 * Useful for progress calculation before processing.
 */
export async function getPdfPageCount(file: File): Promise<number> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        return pdfDoc.getPageCount();
    } catch (error) {
        console.error("Could not read PDF page count:", error);
        return 0;
    }
}

/**
 * Convert ArrayBuffer to base64 string (browser-compatible)
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert a File (image) to base64 for server processing
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const [header, base64] = result.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export interface ChapterRange {
    startPage: number; // 1-indexed
    endPage: number;   // 1-indexed
    name: string;
}

/**
 * Split a PDF into multiple files based on ranges.
 * Returns an array of Blobs with filenames.
 */
export async function splitPdfByRanges(file: File, ranges: ChapterRange[]): Promise<{ success: boolean; files?: { name: string; blob: Blob }[]; error?: string }> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();

        const resultFiles: { name: string; blob: Blob }[] = [];

        for (const range of ranges) {
            // Validate range
            if (range.startPage < 1 || range.endPage > totalPages || range.startPage > range.endPage) {
                console.warn(`Invalid range skipped: ${range.name} (${range.startPage}-${range.endPage})`);
                continue;
            }

            const subDoc = await PDFDocument.create();
            // copyPages takes 0-indexed indices
            const indices = [];
            for (let i = range.startPage - 1; i < range.endPage; i++) {
                indices.push(i);
            }

            const copiedPages = await subDoc.copyPages(pdfDoc, indices);
            copiedPages.forEach(page => subDoc.addPage(page));

            const pdfBytes = await subDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });

            // Sanitize filename
            const cleanName = range.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            resultFiles.push({ name: `${cleanName}.pdf`, blob });
        }

        return { success: true, files: resultFiles };

    } catch (error: any) {
        console.error("Split Ranges Error:", error);
        return { success: false, error: error.message };
    }
}
