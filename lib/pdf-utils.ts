import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addHeader, addFooter } from '@/utils/pdf-style-helper';
import { SubjectStats } from '@/hooks/useQuizResult';

interface PDFData {
    title: string;
    studentName: string;
    totalQuestions: number;
    score: number;
    wrongAnswers: number;
    skippedQuestions: number;
    percentage: number;
    remark: string;
    subjectStats: SubjectStats[];
}

export const generateResultPDF = (data: PDFData) => {
    const doc = new jsPDF();

    // --- Header ---
    const subtitle = `Student: ${data.studentName} | Date: ${new Date().toLocaleDateString()}`;
    let currentY = addHeader(doc, `${data.title} - Result Card`, subtitle);

    // --- Overview Stats Table ---
    (autoTable as any)(doc, {
        startY: currentY,
        head: [['Total Questions', 'Correct', 'Wrong', 'Skipped', 'Score %']],
        body: [[
            data.totalQuestions,
            data.score,
            data.wrongAnswers,
            data.skippedQuestions,
            `${data.percentage.toFixed(1)}%`
        ]],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], halign: 'center' },
        styles: { halign: 'center', fontSize: 12, fontStyle: 'bold' }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 15;

    // --- Subject Analysis Table ---
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("Subject Analysis", 15, currentY);
    currentY += 7;

    (autoTable as any)(doc, {
        startY: currentY,
        head: [['Subject', 'Total', 'Correct', 'Wrong', 'Percentage']],
        body: data.subjectStats.map(s => [
            s.subject,
            s.total,
            s.correct,
            s.wrong,
            `${s.percentage.toFixed(1)}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 10 }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 20;

    // --- Remark ---
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.setFont("helvetica", "bold");
    const remarkText = `Performance Remark: ${data.remark.replace(/[^ -~]/g, '').trim()}`; // Strip emojis
    doc.text(remarkText, 15, currentY);

    // --- Footer ---
    const pageCount = doc.getNumberOfPages();
    addFooter(doc, pageCount);

    doc.save(`${data.title.replace(/[^a-z0-9]/gi, '_')}_Result_Card.pdf`);
};
