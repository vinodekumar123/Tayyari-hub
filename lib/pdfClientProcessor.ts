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
