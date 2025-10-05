'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/app/firebase';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Download } from 'lucide-react';

interface Question {
  id: string;
  subject?: string;
  correctAnswer?: string;
}

interface QuizData {
  title: string;
  subjects?: string[] | { name: string }[];
  chapters?: string[] | { name: string }[];
  selectedQuestions: Question[];
}

interface Score {
  id: string;
  name: string;
  fatherName: string;
  district: string;
  answers: Record<string, string>;
}

export default function QuizStudentScores() {
  const router = useRouter();
  const params = useSearchParams();
  const quizId = params.get('id');

  // Data state
  const [quizTitle, setQuizTitle] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showSubjects, setShowSubjects] = useState(true);
  const [showChapters, setShowChapters] = useState(true);
  const [sortByScore, setSortByScore] = useState<'asc' | 'desc'>('desc');
  const [districtFilter, setDistrictFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const platformName = 'Tayyari Hub';
  const currentDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
    []
  );

  const extractNames = (raw: any): string[] => {
    if (Array.isArray(raw)) {
      return raw
        .map((s: any) => (typeof s === 'string' ? s : s?.name || ''))
        .filter(Boolean);
    }
    if (raw && typeof raw === 'object' && raw.name) return [raw.name];
    if (typeof raw === 'string') return [raw];
    return [];
  };

  const fetchMetadata = useCallback(async () => {
    if (!quizId) return;
    const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
    if (!quizDoc.exists()) return;
    const data = quizDoc.data() as QuizData;
    setQuizTitle(data.title || 'Untitled');
    setSubjects(extractNames(data.subjects || (data as any).subject));
    setChapters(extractNames(data.chapters || (data as any).chapter).join(', '));
    setQuizQuestions(data.selectedQuestions || []);
  }, [quizId]);

  const countCorrectAnswers = useCallback(
    (answers: Record<string, string>) =>
      quizQuestions.filter(q => answers[q.id] === q.correctAnswer).length,
    [quizQuestions]
  );

  const calculateSubjectScores = useCallback(
    (score: Score) => {
      const subjectScores: Record<string, number> = {};
      subjects.forEach(subj => (subjectScores[subj] = 0));
      quizQuestions.forEach(q => {
        if (q.subject && q.correctAnswer && score.answers[q.id] === q.correctAnswer) {
          subjectScores[q.subject] = (subjectScores[q.subject] || 0) + 1;
        }
      });
      const totalCorrect = countCorrectAnswers(score.answers);
      const totalQuestions = quizQuestions.length;
      const totalWrong = totalQuestions - totalCorrect;
      return { subjectScores, totalCorrect, totalWrong, totalQuestions };
    },
    [subjects, quizQuestions, countCorrectAnswers]
  );

  const fetchScores = useCallback(async () => {
    if (!quizId || quizQuestions.length === 0) return;
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const scorePromises = usersSnap.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        const resultRef = doc(
          db,
          'users',
          userId,
          'quizAttempts',
          quizId,
          'results',
          quizId
        );
        const resultSnap = await getDoc(resultRef);
        if (!resultSnap.exists()) return null;
        const userData = userDoc.data();
        const resultData = resultSnap.data();
        return {
          id: userId,
            name: userData.fullName || 'Unknown',
            fatherName: userData.fatherName || '-',
            district: userData.district || '-',
            answers: resultData.answers || {}
        } as Score;
      });

      const list = (await Promise.all(scorePromises)).filter(
        (s): s is Score => s !== null
      );

      list.sort((a, b) => {
        const aC = countCorrectAnswers(a.answers);
        const bC = countCorrectAnswers(b.answers);
        return sortByScore === 'desc' ? bC - aC : aC - bC;
      });

      setScores(list);
    } catch (e) {
      console.error('Error fetching scores:', e);
    } finally {
      setLoading(false);
    }
  }, [quizId, quizQuestions, sortByScore, countCorrectAnswers]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const filteredScores = useMemo(
    () =>
      scores.filter(
        s =>
          (!districtFilter ||
            s.district?.toLowerCase().includes(districtFilter.toLowerCase())) &&
          (!searchTerm ||
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [scores, districtFilter, searchTerm]
  );

  // CSV export
  const exportToCSV = useCallback(() => {
    if (filteredScores.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = [
      'S.No',
      'Name',
      "Father's Name",
      'District',
      ...subjects,
      'Total Correct',
      'Total Wrong',
      'Total Questions'
    ];

    const rows = filteredScores.map((s, index) => {
      const {
        subjectScores,
        totalCorrect,
        totalWrong,
        totalQuestions
      } = calculateSubjectScores(s);
      return [
        index + 1,
        s.name,
        s.fatherName,
        s.district,
        ...subjects.map(subj => subjectScores[subj] || 0),
        totalCorrect,
        totalWrong,
        totalQuestions
      ]
        .map(field => `"${String(field).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quizTitle.replace(/\s+/g, '_')}_Results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredScores, subjects, calculateSubjectScores, quizTitle]);

  /**
   * Enhanced Professional PDF Export
   */
  const exportDataPDF = useCallback(async () => {
    if (generatingPDF) return;
    if (filteredScores.length === 0) {
      alert('No data to export.');
      return;
    }
    setGeneratingPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      // Attempt to load custom font (Roboto) dynamically
      const loadFont = async (doc: any) => {
        try {
          const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto-Regular.ttf';
          const res = await fetch(fontUrl);
          if (!res.ok) throw new Error('Font fetch failed');
            const fontBuffer = await res.arrayBuffer();
            // Convert to base64
            const bytes = new Uint8Array(fontBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const base64 = btoa(binary);
            doc.addFileToVFS('Roboto-Regular.ttf', base64);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto');
            return true;
        } catch (err) {
          console.warn('Custom font load failed, falling back to Helvetica.', err);
          return false;
        }
      };

      // Professional palette (accessible-friendly)
      const colors = {
        ink: [34, 40, 49],            // Primary dark text
        inkSoft: [85, 96, 110],
        backgroundBand: [245, 247, 252],
        backgroundAlt: [250, 252, 255],
        headerDark: [20, 36, 66],
        headerAccent: [31, 61, 122],
        accent: [34, 102, 204],
        accentSoft: [210, 228, 250],
        accentMid: [140, 176, 223],
        gold: [219, 181, 64],
        success: [26, 158, 90],
        warn: [230, 150, 50],
        danger: [200, 62, 62],
        border: [205, 215, 230],
        watermark: [210, 220, 240]
      };

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const fontLoaded = await loadFont(doc);
      if (!fontLoaded) {
        doc.setFont('helvetica', 'normal');
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Derived stats
      const participantCount = filteredScores.length;
      const totalQuestions = quizQuestions.length;
      const scoreList = filteredScores.map(s => calculateSubjectScores(s).totalCorrect);
      const highestScore = Math.max(...scoreList);
      const avgScore = scoreList.reduce((a, b) => a + b, 0) / participantCount;

      // Subject average calculations
      const subjectAverages: { subject: string; average: number; max: number }[] = subjects.map(subj => {
        let total = 0;
        filteredScores.forEach(s => {
          const { subjectScores } = calculateSubjectScores(s);
          total += subjectScores[subj] || 0;
        });
        return {
          subject: subj,
          average: participantCount ? total / participantCount : 0,
          max: quizQuestions.filter(q => q.subject === subj).length || 0
        };
      });

      // Decide orientation if many subjects
      const totalLeafColumns = 4 + subjects.length + 3;
      if (totalLeafColumns > 18) {
        // Already landscape; if still too many columns, reduce font size in table later.
      }

      // Gradient-like header effect
      const headerHeight = 34;
      const headerSegments = 50;
      for (let i = 0; i < headerSegments; i++) {
        const ratio = i / headerSegments;
        const r = colors.headerDark[0] + ratio * (colors.headerAccent[0] - colors.headerDark[0]);
        const g = colors.headerDark[1] + ratio * (colors.headerAccent[1] - colors.headerDark[1]);
        const b = colors.headerDark[2] + ratio * (colors.headerAccent[2] - colors.headerDark[2]);
        doc.setFillColor(r, g, b);
        doc.rect((pageWidth / headerSegments) * i, 0, pageWidth / headerSegments + 0.5, headerHeight, 'F');
      }

      // Title block
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(platformName, 12, 14);

      doc.setFontSize(13);
      doc.setFont(undefined, 'normal');
      doc.text(quizTitle || 'Assessment Results', 12, 23);

      doc.setFontSize(9);
      doc.setTextColor(230);
      doc.text(`Generated: ${new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })}`, 12, 29);

      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(currentDate, pageWidth - 12, 14, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Report Ref: QZ-${(quizId || 'NA').slice(0, 8).toUpperCase()}`, pageWidth - 12, 21, { align: 'right' });

      // Executive Summary Container
      let y = headerHeight + 6;
      const summaryWidth = pageWidth - 24;
      doc.setFillColor(...colors.backgroundAlt);
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.25);
      doc.roundedRect(12, y, summaryWidth, 30, 2, 2, 'FD');

      // KPI badges
      const badgeBaseX = 18;
      const badgeBaseY = y + 8;
      const badgeGap = 42;

      const drawBadge = (x: number, title: string, val: string, color: number[]) => {
        doc.setFillColor(...color);
        doc.roundedRect(x, badgeBaseY - 6, 38, 16, 3, 3, 'F');
        doc.setFontSize(6.3);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text(title.toUpperCase(), x + 19, badgeBaseY - 1.5, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(val, x + 19, badgeBaseY + 5, { align: 'center' });
      };

      drawBadge(badgeBaseX, 'Participants', String(participantCount), colors.accent);
      drawBadge(badgeBaseX + badgeGap, 'Avg Score', `${avgScore.toFixed(1)}/${totalQuestions}`, colors.success);
      drawBadge(badgeBaseX + badgeGap * 2, 'Top Score', `${highestScore}/${totalQuestions}`, colors.gold);
      drawBadge(badgeBaseX + badgeGap * 3, 'Questions', String(totalQuestions), colors.warn);

      // Additional summary text
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...colors.ink);
      doc.text('Executive Summary', 18, y + 25);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...colors.inkSoft);

      const summaryLines: string[] = [];
      summaryLines.push(
        `This report presents an official record of performance for the assessment "${quizTitle}". `
        + `It includes per-subject accuracy, aggregate statistics, and ranked participant outcomes.`
      );
      summaryLines.push(
        'Analysis sections provide insights into strengths and potential areas for improvement based on question distribution.'
      );

      const wrapText = (text: string, maxChars = 120) => {
        const words = text.split(' ');
        const lines: string[] = [];
        let line = '';
        words.forEach(w => {
          if ((line + w).length > maxChars) {
            lines.push(line.trim());
            line = '';
          }
          line += w + ' ';
        });
        if (line.trim()) lines.push(line.trim());
        return lines;
      };

      let txtY = y + 12;
      summaryLines.forEach(block => {
        const lines = wrapText(block);
        lines.forEach(l => {
          doc.text(l, badgeBaseX + badgeGap * 4 + 10, txtY);
          txtY += 4;
        });
      });

      // SUBJECT AVERAGE MINI-TABLE + BAR CHART
      const subjectBoxY = y + 34 + 4;
      const subjectBoxHeight = 38;
      doc.setFillColor(...colors.backgroundAlt);
      doc.setDrawColor(...colors.border);
      doc.roundedRect(12, subjectBoxY, (pageWidth / 2) - 18, subjectBoxHeight, 2, 2, 'FD');
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...colors.ink);
      doc.text('Subject Performance Averages', 18, subjectBoxY + 6);
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...colors.inkSoft);
      doc.text('Average correct answers per subject (with max possible).', 18, subjectBoxY + 11);

      // Table-like rendering
      let subjTableY = subjectBoxY + 16;
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...colors.ink);
      doc.text('Subject', 18, subjTableY);
      doc.text('Avg', 60, subjTableY);
      doc.text('Max', 72, subjTableY);
      doc.text('%', 84, subjTableY);
      doc.setDrawColor(...colors.border);
      doc.line(16, subjTableY + 2, 90, subjTableY + 2);
      doc.setFont(undefined, 'normal');

      subjTableY += 5;
      subjectAverages.forEach(sa => {
        const perc = sa.max ? (sa.average / sa.max) * 100 : 0;
        doc.setTextColor(...colors.ink);
        doc.text(sa.subject, 18, subjTableY);
        doc.text(sa.average.toFixed(1), 60, subjTableY, { align: 'right' });
        doc.text(String(sa.max), 74, subjTableY, { align: 'right' });
        doc.text(`${perc.toFixed(0)}%`, 88, subjTableY, { align: 'right' });
        subjTableY += 4;
      });

      // Bar chart on right side of subject averages box
      const chartX = (pageWidth / 2) - 18 + 8;
      doc.setFillColor(...colors.backgroundAlt);
      doc.setDrawColor(...colors.border);
      doc.roundedRect((pageWidth / 2) - 6, subjectBoxY, (pageWidth / 2) - 18, subjectBoxHeight, 2, 2, 'FD');
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...colors.ink);
      doc.text('Subject Accuracy Chart', chartX, subjectBoxY + 6);

      const barStartY = subjectBoxY + 14;
      const barHeight = 5;
      const barGap = 6;
      const barMaxWidth = (pageWidth / 2) - 40;
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');

      subjectAverages.forEach((sa, i) => {
        const perc = sa.max ? sa.average / sa.max : 0;
        const barY = barStartY + i * barGap;
        // Background bar
        doc.setFillColor(...colors.accentSoft);
        doc.rect(chartX, barY - barHeight + 2, barMaxWidth, barHeight, 'F');
        // Value bar
        const w = Math.max(0.5, perc * barMaxWidth);
        const gradRatio = perc;
        const r = colors.accent[0] + gradRatio * (colors.accentMid[0] - colors.accent[0]);
        const g = colors.accent[1] + gradRatio * (colors.accentMid[1] - colors.accent[1]);
        const b = colors.accent[2] + gradRatio * (colors.accentMid[2] - colors.accent[2]);
        doc.setFillColor(r, g, b);
        doc.rect(chartX, barY - barHeight + 2, w, barHeight, 'F');
        // Labels
        doc.setTextColor(...colors.ink);
        doc.text(sa.subject.length > 10 ? sa.subject.slice(0, 10) + '…' : sa.subject, chartX - 2, barY + 1, { align: 'right' });
        doc.setTextColor(...colors.inkSoft);
        doc.text(`${((perc)*100).toFixed(0)}%`, chartX + barMaxWidth + 4, barY + 1);
      });

      // MAIN RESULTS TABLE
      let tableStartY = subjectBoxY + subjectBoxHeight + 8;

      // Multi-level header for table
      const topRow: any[] = [
        {
          content: 'S.No',
          rowSpan: 2,
          styles: {
            fillColor: colors.headerDark,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
            valign: 'middle'
          }
        },
        {
          content: 'Student Name',
          rowSpan: 2,
          styles: {
            fillColor: colors.headerDark,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            valign: 'middle'
          }
        },
        {
          content: "Father's Name",
          rowSpan: 2,
          styles: {
            fillColor: colors.headerDark,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            valign: 'middle'
          }
        },
        {
          content: 'District',
          rowSpan: 2,
          styles: {
            fillColor: colors.headerDark,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            valign: 'middle'
          }
        },
        {
          content: 'Subject-wise Performance',
          colSpan: subjects.length,
          styles: {
            halign: 'center',
            fillColor: colors.headerAccent,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          }
        },
        {
          content: 'Overall',
          colSpan: 3,
          styles: {
            halign: 'center',
            fillColor: colors.headerAccent,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          }
        }
      ];

      const secondRow: any[] = [
        ...subjects.map(s => ({
          content: s,
          styles: {
            fillColor: colors.headerAccent,
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 2
          }
        })),
        {
          content: 'Correct',
          styles: {
            fillColor: colors.headerAccent,
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center'
          }
        },
        {
          content: 'Wrong',
            styles: {
            fillColor: colors.headerAccent,
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center'
          }
        },
        {
          content: 'Total',
          styles: {
            fillColor: colors.headerAccent,
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center'
          }
        }
      ];

      const head = [topRow, secondRow];

      const body = filteredScores.map((s, idx) => {
        const {
          subjectScores,
          totalCorrect,
          totalWrong,
          totalQuestions
        } = calculateSubjectScores(s);

        const perc = totalQuestions ? (totalCorrect / totalQuestions) * 100 : 0;
        let perfColor: number[];
        if (perc >= 80) perfColor = colors.success;
        else if (perc >= 60) perfColor = colors.warn;
        else perfColor = colors.danger;

        return [
          { content: idx + 1, styles: { halign: 'center', fontStyle: 'bold' } },
          s.name,
          s.fatherName,
          s.district,
          ...subjects.map(subj => ({
            content: subjectScores[subj] || 0,
            styles: { halign: 'center' }
          })),
          {
            content: totalCorrect,
            styles: {
              halign: 'center',
              textColor: perfColor,
              fontStyle: 'bold'
            }
          },
          {
            content: totalWrong,
            styles: { halign: 'center' }
          },
          {
            content: totalQuestions,
            styles: { halign: 'center', fontStyle: 'bold' }
          }
        ];
      });

      // Column sizing
      const columnStyles: Record<number, any> = {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 34 },
        2: { cellWidth: 34 },
        3: { cellWidth: 26 }
      };
      for (let i = 0; i < subjects.length; i++) {
        columnStyles[4 + i] = { cellWidth: 14, halign: 'center' };
      }
      const totalsStart = 4 + subjects.length;
      columnStyles[totalsStart] = { cellWidth: 16, halign: 'center' };
      columnStyles[totalsStart + 1] = { cellWidth: 16, halign: 'center' };
      columnStyles[totalsStart + 2] = { cellWidth: 16, halign: 'center' };

      // @ts-ignore
      doc.autoTable({
        head,
        body,
        startY: tableStartY,
        theme: 'grid',
        styles: {
          font: fontLoaded ? 'Roboto' : 'helvetica',
          fontSize: 7.2,
          cellPadding: 2.2,
          overflow: 'linebreak',
          lineColor: colors.border,
          lineWidth: 0.15,
          textColor: colors.ink
        },
        headStyles: {
          lineWidth: 0.15,
          lineColor: colors.gold,
          valign: 'middle'
        },
        bodyStyles: {
          textColor: colors.ink,
          fillColor: [255, 255, 255]
        },
        alternateRowStyles: {
          fillColor: colors.backgroundBand
        },
        columnStyles,
        rowPageBreak: 'auto',
        margin: { top: 10, right: 10, bottom: 20, left: 10 },
        didDrawPage: (data: any) => {
          const pageCount = doc.getNumberOfPages();

            // Footer background strip
            doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
            doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'normal');
            doc.text(`${platformName} • Official Performance Report`, 10, pageHeight - 6);
            doc.setFont(undefined, 'italic');
            doc.text('Confidential – Distribution Restricted', pageWidth / 2, pageHeight - 6, { align: 'center' });
            doc.setFont(undefined, 'normal');
            doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - 10, pageHeight - 6, { align: 'right' });

            // Header replication for continuing pages (compact header)
            if (data.pageNumber > 1) {
              doc.setFillColor(colors.headerDark[0], colors.headerDark[1], colors.headerDark[2]);
              doc.rect(0, 0, pageWidth, 14, 'F');
              doc.setFontSize(10);
              doc.setTextColor(255, 255, 255);
              doc.setFont(undefined, 'bold');
              doc.text(quizTitle.slice(0, 80), 10, 9);
              doc.setFontSize(8);
              doc.setFont(undefined, 'normal');
              doc.text(`Continued • ${platformName}`, pageWidth - 10, 9, { align: 'right' });
            }
        },
        didDrawCell: (data: any) => {
          if (data.section === 'head') {
            doc.setDrawColor(...colors.gold);
            doc.setLineWidth(0.15);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'S');
          }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || (pageHeight - 50);

      // WATERMARK (subtle)
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
      doc.setFontSize(72);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...colors.watermark);
      doc.text('OFFICIAL', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45
      });
      doc.setGState(new (doc as any).GState({ opacity: 1 }));

      // SIGNATURE & COMPLIANCE if space on last page
      if (finalY < pageHeight - 45) {
        const sigY = finalY + 12;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.25);
        // Left signature
        doc.line(20, sigY + 20, 80, sigY + 20);
        doc.setFontSize(8);
        doc.setTextColor(...colors.inkSoft);
        doc.text('Authorized Signature', 50, sigY + 25, { align: 'center' });

        // Right signature
        doc.line(pageWidth - 80, sigY + 20, pageWidth - 20, sigY + 20);
        doc.text('Date & Stamp', pageWidth - 50, sigY + 25, { align: 'center' });

        // Disclaimer
        doc.setFontSize(6.7);
        doc.setTextColor(...colors.inkSoft);
        const disclaimer =
          'This document is system-generated and intended solely for authorized academic evaluation. ' +
          'Any unauthorized alteration, duplication, or distribution is strictly prohibited.';
        const disclaimerLines = wrapText(disclaimer, 140);
        let dY = sigY + 34;
        disclaimerLines.forEach(line => {
          doc.text(line, 20, dY);
          dY += 3.2;
        });
      }

      doc.save(`${quizTitle.replace(/\s+/g, '_')}_Professional_Report.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. See console for details.');
    } finally {
      setGeneratingPDF(false);
    }
  }, [
    generatingPDF,
    filteredScores,
    subjects,
    calculateSubjectScores,
    quizTitle,
    quizQuestions,
    platformName,
    currentDate,
    quizId
  ]);

  return (
    <div className="p-8 min-h-screen bg-gradient-to-b from-blue-100 to-white">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push('/admin/results')}>
          ← Back to Results
        </Button>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">
                  Export Options
                </DialogTitle>
                <DialogDescription>
                  Configure on-screen meta and sorting. PDF & CSV reflect current filters (district/name).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subjectsLine"
                    checked={showSubjects}
                    onCheckedChange={v => setShowSubjects(Boolean(v))}
                  />
                  <label htmlFor="subjectsLine" className="font-medium">
                    Show Subjects line (screen only)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="chaptersLine"
                    checked={showChapters}
                    onCheckedChange={v => setShowChapters(Boolean(v))}
                  />
                  <label htmlFor="chaptersLine" className="font-medium">
                    Show Chapters line (screen only)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="font-medium">Sort By:</label>
                  <select
                    value={sortByScore}
                    onChange={e =>
                      setSortByScore(e.target.value as 'asc' | 'desc')
                    }
                    className="border px-2 py-1 rounded-md bg-gray-50"
                  >
                    <option value="desc">Highest Score</option>
                    <option value="asc">Lowest Score</option>
                  </select>
                </div>
                <div className="p-3 rounded-md bg-blue-50 border text-blue-900 text-xs leading-snug">
                  Professional PDF now includes KPI badges, subject averages table, subject performance bar chart, refined styling, and official footer & watermark.
                </div>
              </div>
              <DialogFooter className="flex flex-col gap-2">
                <Button
                  onClick={exportDataPDF}
                  className="bg-blue-600 hover:bg-blue-700 w-full disabled:opacity-60"
                  disabled={
                    generatingPDF || loading || filteredScores.length === 0
                  }
                >
                  {generatingPDF ? 'Generating Professional Report...' : 'Download Professional PDF'}
                </Button>
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="w-full disabled:opacity-60"
                  disabled={loading || filteredScores.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search by student name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="border-gray-300 focus:border-blue-500"
        />
        <Input
          placeholder="Filter by district..."
          value={districtFilter}
          onChange={e => setDistrictFilter(e.target.value)}
          className="border-gray-300 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span className="font-bold text-lg text-blue-800">
            {platformName}
          </span>
            <span className="text-gray-500">{currentDate}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-center text-blue-900">
          {quizTitle || 'Quiz'} Results
        </h1>
        {showSubjects && subjects.length > 0 && (
          <p className="text-center text-gray-700 text-lg">
            📚 <span className="font-semibold">Subjects:</span>{' '}
            {subjects.join(', ')}
          </p>
        )}
        {showChapters && chapters && (
          <p className="text-center text-gray-700 text-lg">
            📖 <span className="font-semibold">Chapters:</span> {chapters}
          </p>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </div>
        ) : filteredScores.length === 0 ? (
          <p className="text-center text-gray-500 text-lg">
            No results submitted for this quiz yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full mt-6 text-sm border-collapse table-fixed">
              <thead className="bg-blue-800 text-white">
                <tr>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-left font-semibold whitespace-normal break-words w-12"
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-left font-semibold whitespace-normal break-words w-40"
                  >
                    Name
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-left font-semibold whitespace-normal break-words w-40"
                  >
                    Father&apos;s Name
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-left font-semibold whitespace-normal break-words w-32"
                  >
                    District
                  </th>
                  <th
                    colSpan={subjects.length}
                    className="border border-blue-200 p-3 text-center font-semibold whitespace-normal break-words"
                  >
                    Correct Answers
                  </th>
                  <th
                    colSpan={3}
                    className="border border-blue-200 p-3 text-center font-semibold whitespace-normal break-words"
                  >
                    Totals
                  </th>
                </tr>
                <tr>
                  {subjects.map(subj => (
                    <th
                      key={subj}
                      className="border border-blue-200 p-2 text-center font-semibold whitespace-normal break-words w-16"
                      title={`${subj} Correct`}
                    >
                      {subj}
                    </th>
                  ))}
                  <th className="border border-blue-200 p-2 text-center font-semibold w-20 whitespace-normal break-words">
                    Correct
                  </th>
                  <th className="border border-blue-200 p-2 text-center font-semibold w-20 whitespace-normal break-words">
                    Wrong
                  </th>
                  <th className="border border-blue-200 p-2 text-center font-semibold w-24 whitespace-normal break-words">
                    Questions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredScores.map((s, index) => {
                  const {
                    subjectScores,
                    totalCorrect,
                    totalWrong,
                    totalQuestions
                  } = calculateSubjectScores(s);
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <td className="border border-gray-200 p-3">
                        {index + 1}
                      </td>
                      <td className="border border-gray-200 p-3">
                        {s.name}
                      </td>
                      <td className="border border-gray-200 p-3">
                        {s.fatherName}
                      </td>
                      <td className="border border-gray-200 p-3">
                        {s.district}
                      </td>
                      {subjects.map(subj => (
                        <td
                          key={subj}
                          className="border border-gray-200 p-3 text-center"
                        >
                          {subjectScores[subj] || 0}
                        </td>
                      ))}
                      <td className="border border-gray-200 p-3 text-center font-medium">
                        {totalCorrect}
                      </td>
                      <td className="border border-gray-200 p-3 text-center font-medium">
                        {totalWrong}
                      </td>
                      <td className="border border-gray-200 p-3 text-center font-medium">
                        {totalQuestions}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading && (
        <p className="text-center text-gray-500 mt-3">Loading...</p>
      )}
    </div>
  );
}
