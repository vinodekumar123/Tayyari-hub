export async function extractTextFromPdf(file: File): Promise<string> {
    try {
        // Dynamic import to avoid SSR/Build issues with DOMMatrix/Canvas
        const pdfjsLib = await import('pdfjs-dist');

        // Set worker to CDN
        // @ts-ignore
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        let fullText = '';

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        return fullText;
    } catch (error: any) {
        console.error("PDF Text Extraction Error:", error);
        throw new Error("Failed to extract text from PDF: " + error.message);
    }
}
