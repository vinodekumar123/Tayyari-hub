
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

// Helper to strip HTML tags for simple text
const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export async function exportToPDF(questions: any[], title: string = 'Tayyari_Hub_Questions') {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.setFont("helvetica", "bold");
    doc.text("Tayyari Hub - Question Bank", 15, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, currentY);
    currentY += 15;

    questions.forEach((q, idx) => {
        // Check for page overflow
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        // Question Number & Text
        doc.setFontSize(12);
        doc.setTextColor(30);
        doc.setFont("helvetica", "bold");
        doc.text(`Q${idx + 1}.`, 15, currentY);

        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(stripHtml(q.question), pageWidth - 40);
        doc.text(lines, 25, currentY);
        currentY += (lines.length * 7) + 5;

        // Options
        q.options.forEach((opt: string, optIdx: number) => {
            const optLabel = String.fromCharCode(65 + optIdx) + ")";
            doc.text(`${optLabel} ${stripHtml(opt)}`, 30, currentY);
            currentY += 7;
        });

        // Answer & Explanation
        currentY += 3;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129); // Emerald-600
        doc.text(`Correct Answer: ${q.answer}`, 25, currentY);
        currentY += 7;

        if (q.explanation) {
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100);
            const expLines = doc.splitTextToSize(`Explanation: ${stripHtml(q.explanation)}`, pageWidth - 40);
            doc.text(expLines, 25, currentY);
            currentY += (expLines.length * 6) + 12;
        } else {
            currentY += 10;
        }
    });

    doc.save(`${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

export async function exportToWord(questions: any[], title: string = 'Tayyari_Hub_Questions') {
    const sections = questions.map((q, idx) => {
        const children: any[] = [
            new Paragraph({
                children: [
                    new TextRun({ text: `Q${idx + 1}. `, bold: true, size: 24 }),
                    new TextRun({ text: stripHtml(q.question), size: 24 }),
                ],
                spacing: { before: 240, after: 120 },
            }),
            ...q.options.map((opt: string, optIdx: number) =>
                new Paragraph({
                    children: [
                        new TextRun({ text: `${String.fromCharCode(65 + optIdx)}) `, bold: true, size: 22 }),
                        new TextRun({ text: stripHtml(opt), size: 22 }),
                    ],
                    indent: { left: 720 },
                    spacing: { after: 80 },
                })
            ),
            new Paragraph({
                children: [
                    new TextRun({ text: "Correct Answer: ", bold: true, color: "10B981", size: 22 }),
                    new TextRun({ text: q.answer, bold: true, size: 22 }),
                ],
                spacing: { before: 120, after: 80 },
            }),
        ];

        if (q.explanation) {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: "Explanation: ", bold: true, italics: true, color: "6B7280", size: 20 }),
                        new TextRun({ text: stripHtml(q.explanation), italics: true, color: "6B7280", size: 20 }),
                    ],
                    spacing: { after: 240 },
                })
            );
        }

        return children;
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: sections.flat(),
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title.replace(/\s+/g, '_')}_${Date.now()}.docx`);
}
