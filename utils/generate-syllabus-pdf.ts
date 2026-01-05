
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { syllabusData } from '../app/dashboard/student/syllabus/data';

export const generateSyllabusPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    let finalY = margin;

    // --- Helper for Colors ---
    type RGB = [number, number, number];
    const primaryColor: RGB = [37, 99, 235]; // Blue-600
    const secondaryColor: RGB = [79, 70, 229]; // Indigo-600
    const darkColor: RGB = [30, 41, 59]; // Slate-800

    // Using placeholder to force text logo fallback due to base64 issues
    const logoBase64 = "LOGO_PLACEHOLDER";

    // --- Header ---
    if (logoBase64 && logoBase64 !== "LOGO_PLACEHOLDER") {
        const logoWidth = 40;
        const logoHeight = 10;
        doc.addImage(logoBase64, 'PNG', margin, finalY, logoWidth, logoHeight);
    } else {
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text("TayyariHub", margin, finalY + 8);
    }

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.setFont("helvetica", "normal");
    doc.text("www.tayyarihub.com", pageWidth - margin - 40, finalY + 8);

    finalY += 20;

    // --- Title & Description ---
    doc.setFontSize(18);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("PMDC 2025 Official Syllabus", margin, finalY);

    finalY += 7;
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.setFont("helvetica", "normal");
    doc.text("Comprehensive breakdown of subjects, topics, and weightage for the 2025 session.", margin, finalY);

    finalY += 10;

    // --- Disclaimer Box ---
    doc.setFillColor(255, 251, 235); // Amber-50
    doc.setDrawColor(252, 211, 77); // Amber-300
    doc.rect(margin, finalY, pageWidth - (margin * 2), 14, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.setFont("helvetica", "bold");
    doc.text("IMPORTANT NOTE:", margin + 5, finalY + 5);

    doc.setFont("helvetica", "normal");
    doc.text("This syllabus follows the latest PMDC 2025 guidelines. Please ensure you cover all subtopics detailed below.", margin + 5, finalY + 9);

    finalY += 20;

    // --- Sanitize Helper ---
    const sanitizeText = (text: string): string => {
        if (!text) return '';
        // Replace common non-ASCII characters
        let clean = text
            .replace(/–/g, '-')
            .replace(/—/g, '-')
            .replace(/→/g, 'to')
            .replace(/“/g, '"')
            .replace(/”/g, '"')
            .replace(/‘/g, "'")
            .replace(/’/g, "'")
            .replace(/…/g, '...');

        // Strip remaining non-ASCII
        clean = clean.replace(/[^\x20-\x7E\n]/g, '');
        return clean;
    };

    // --- Generate Tables for Each Subject ---
    syllabusData.forEach((subject) => {
        // Subject Header (e.g. BIOLOGY (45% - 81 MCQs))
        // Combining subject name and weight for the header title
        // Removing emoji from subject name for PDF cleanliness
        const subjectName = subject.subject.replace(/[\u{1F600}-\u{1F6FF}|[\u{2600}-\u{26FF}]/gu, '').trim();
        const title = `${sanitizeText(subjectName)}  (${sanitizeText(subject.weight)})`;

        // Check page break
        if (finalY > 250) {
            doc.addPage();
            finalY = margin + 10;
        }

        // Section Header
        doc.setFontSize(14);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, finalY);
        finalY += 2; // small gap before table

        // Prepare Table Rows
        const tableRows = subject.topics.map(topic => {
            const topicTitle = sanitizeText(topic.title);
            // Bullet points for details
            const topicDetails = topic.details.map(d => `• ${sanitizeText(d)}`).join("\n");
            return [topicTitle, topicDetails];
        });

        // Determine specific header color based on subject color if desired, 
        // but consistently carrying primary color is cleaner for branding.
        // We will stick to the primary/secondary theme.

        autoTable(doc, {
            startY: finalY + 4,
            head: [['Topic / Chapter', 'Detailed Curriculum']],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: secondaryColor,
                textColor: 255,
                fontSize: 10,
                font: 'helvetica',
                fontStyle: 'bold',
                halign: 'left'
            },
            styles: {
                font: 'helvetica',
                fontSize: 9,
                cellPadding: 4,
                textColor: 50,
                overflow: 'linebreak',
                valign: 'top' // align text to top
            },
            columnStyles: {
                0: { cellWidth: 50, fontStyle: 'bold' }, // Topic Title column
                1: { cellWidth: 'auto' } // Details column
            },
            // Add page break logic handled by autoTable automatically, just capture finalY
        });

        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 15;
    });

    // --- Footer ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);

        const footerY = doc.internal.pageSize.height - 10;

        // Left: Website
        doc.setFont("helvetica", "normal");
        doc.text("www.tayyarihub.com", margin, footerY);

        // Center: WhatsApp
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 211, 102); // WhatsApp Green
        const waText = "WhatsApp Info: 03237507673";
        const waWidth = doc.getTextWidth(waText);
        doc.text(waText, (pageWidth - waWidth) / 2, footerY);

        // Right: Page Number
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, footerY);
    }

    doc.save("TayyariHub_PMDC_Syllabus_2025.pdf");
};
