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

  // CSV (now subjects only; totals after)
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
      ...subjects,          // just subject names
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

  // Enhanced Professional PDF with elegant design
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

      const totalLeafColumns = 4 + subjects.length + 3;
      const orientation = totalLeafColumns > 11 ? 'landscape' : 'portrait';

      const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Professional color scheme
      const colors = {
        primary: [25, 45, 85],        // Deep navy blue
        secondary: [45, 65, 105],     // Medium blue
        accent: [235, 240, 250],      // Light blue-gray
        gold: [218, 165, 32],         // Gold accent
        text: [30, 30, 30],           // Dark gray text
        lightText: [90, 90, 90],      // Light gray text
        white: [255, 255, 255],
        border: [200, 210, 225]       // Soft border color
      };

      // Add elegant header with gradient effect simulation
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      // Add thin gold accent line
      doc.setDrawColor(...colors.gold);
      doc.setLineWidth(0.5);
      doc.line(0, 35, pageWidth, 35);

      // Platform name with elegant typography
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...colors.white);
      doc.text(platformName.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

      // Quiz title
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...colors.accent);
      doc.text(quizTitle || 'Assessment Results', pageWidth / 2, 25, { align: 'center' });

      // Date in corner
      doc.setFontSize(9);
      doc.setTextColor(...colors.accent);
      doc.text(currentDate, pageWidth - 14, 30, { align: 'right' });

      // Executive summary section
      let yPosition = 45;
      
      // Summary box with shadow effect
      doc.setFillColor(...colors.accent);
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(14, yPosition, pageWidth - 28, 25, 2, 2, 'FD');

      // Summary content
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...colors.primary);
      doc.text('EXECUTIVE SUMMARY', 20, yPosition + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colors.text);
      
      const summaryStats = {
        'Total Participants': filteredScores.length,
        'Assessment Subjects': subjects.join(', '),
        'Total Questions': quizQuestions.length,
        'Report Generated': new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      };

      let summaryY = yPosition + 13;
      Object.entries(summaryStats).forEach(([key, value], index) => {
        if (index < 2) {
          doc.setFont('helvetica', 'bold');
          doc.text(`${key}:`, 20, summaryY);
          doc.setFont('helvetica', 'normal');
          doc.text(String(value), 55, summaryY);
          summaryY += 5;
        }
      });

      // Performance statistics
      const avgCorrect = filteredScores.reduce((acc, s) => {
        const { totalCorrect } = calculateSubjectScores(s);
        return acc + totalCorrect;
      }, 0) / filteredScores.length;

      const topScore = Math.max(...filteredScores.map(s => {
        const { totalCorrect } = calculateSubjectScores(s);
        return totalCorrect;
      }));

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...colors.secondary);
      doc.text(`Average Score: ${avgCorrect.toFixed(1)}/${quizQuestions.length}`, pageWidth - 80, yPosition + 13);
      doc.text(`Highest Score: ${topScore}/${quizQuestions.length}`, pageWidth - 80, yPosition + 18);

      // Multi-level header for table
      const topRow: any[] = [
        { 
          content: 'S.No', 
          rowSpan: 2,
          styles: { 
            fillColor: colors.primary,
            textColor: colors.white,
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center'
          }
        },
        { 
          content: 'Student Name', 
          rowSpan: 2,
          styles: { 
            fillColor: colors.primary,
            textColor: colors.white,
            fontStyle: 'bold',
            fontSize: 9
          }
        },
        { 
          content: "Father's Name", 
          rowSpan: 2,
          styles: { 
            fillColor: colors.primary,
            textColor: colors.white,
            fontStyle: 'bold',
            fontSize: 9
          }
        },
        { 
          content: 'District', 
          rowSpan: 2,
          styles: { 
            fillColor: colors.primary,
            textColor: colors.white,
            fontStyle: 'bold',
            fontSize: 9
          }
        },
        { 
          content: 'Subject-wise Performance', 
          colSpan: subjects.length, 
          styles: { 
            halign: 'center',
            fillColor: colors.secondary,
            textColor: colors.white,
            fontStyle: 'bold',
            fontSize: 10
          }
        },
        { 
          content: 'Overall Results', 
          colSpan: 3, 
          styles: { 
            halign: 'center',
            fillColor: colors.secondary,
            textColor: colors.white,
            fontStyle: 'bold',
            fontSize: 10
          }
        }
      ];

      const secondRow: any[] = [
        ...subjects.map(s => ({ 
          content: s,
          styles: {
            fillColor: colors.secondary,
            textColor: colors.white,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          }
        })),
        { 
          content: 'Correct',
          styles: {
            fillColor: colors.secondary,
            textColor: colors.white,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          }
        },
        { 
          content: 'Wrong',
          styles: {
            fillColor: colors.secondary,
            textColor: colors.white,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          }
        },
        { 
          content: 'Total',
          styles: {
            fillColor: colors.secondary,
            textColor: colors.white,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center'
          }
        }
      ];

      const head = [topRow, secondRow];

      // Prepare body with alternating colors and performance indicators
      const body = filteredScores.map((s, idx) => {
        const {
          subjectScores,
          totalCorrect,
          totalWrong,
          totalQuestions
        } = calculateSubjectScores(s);
        
        const percentage = (totalCorrect / totalQuestions) * 100;
        const performanceColor = percentage >= 80 ? colors.text : 
                                percentage >= 60 ? colors.text : 
                                [180, 50, 50]; // Red for low scores

        return [
          {
            content: idx + 1,
            styles: { halign: 'center', fontStyle: 'bold' }
          },
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
              fontStyle: 'bold',
              textColor: performanceColor
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

      // Column styles with elegant proportions
      const columnStyles: Record<number, any> = {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 }
      };
      
      // Subject columns
      for (let i = 0; i < subjects.length; i++) {
        columnStyles[4 + i] = { cellWidth: 15, halign: 'center' };
      }
      
      const totalsStart = 4 + subjects.length;
      columnStyles[totalsStart] = { cellWidth: 18, halign: 'center' };
      columnStyles[totalsStart + 1] = { cellWidth: 18, halign: 'center' };
      columnStyles[totalsStart + 2] = { cellWidth: 18, halign: 'center' };

      // @ts-ignore
      doc.autoTable({
        head,
        body,
        startY: yPosition + 30,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: 'linebreak',
          lineColor: colors.border,
          lineWidth: 0.1,
          font: 'helvetica'
        },
        headStyles: {
          fillColor: colors.primary,
          textColor: colors.white,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          valign: 'middle',
          textColor: colors.text
        },
        alternateRowStyles: {
          fillColor: colors.accent
        },
        columnStyles,
        rowPageBreak: 'auto',
        margin: { top: 10, right: 14, bottom: 20, left: 14 },
        didDrawPage: (data: any) => {
          // Footer on each page
          const pageCount = doc.getNumberOfPages();
          
          // Footer background
          doc.setFillColor(...colors.primary);
          doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
          
          // Footer text
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...colors.white);
          
          // Left side - Platform info
          doc.text(`${platformName} | Assessment Report`, 14, pageHeight - 7);
          
          // Center - Confidential notice
          doc.setFont('helvetica', 'italic');
          doc.text('Confidential Document', pageWidth / 2, pageHeight - 7, { align: 'center' });
          
          // Right side - Page number
          doc.setFont('helvetica', 'normal');
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            pageWidth - 14,
            pageHeight - 7,
            { align: 'right' }
          );

          // Add header on subsequent pages
          if (data.pageNumber > 1) {
            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, pageWidth, 20, 'F');
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...colors.white);
            doc.text(`${quizTitle} - Continued`, pageWidth / 2, 12, { align: 'center' });
          }
        },
        didDrawCell: (data: any) => {
          // Add subtle borders for header cells
          if (data.section === 'head') {
            doc.setDrawColor(...colors.gold);
            doc.setLineWidth(0.1);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'S');
          }
        }
      });

      // Add signature section on last page if space permits
      const finalY = (doc as any).lastAutoTable.finalY || pageHeight - 50;
      
      if (finalY < pageHeight - 60) {
        // Signature section
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        
        // Left signature box
        doc.line(20, finalY + 30, 80, finalY + 30);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...colors.lightText);
        doc.text('Authorized Signature', 50, finalY + 35, { align: 'center' });
        
        // Right signature box
        doc.line(pageWidth - 80, finalY + 30, pageWidth - 20, finalY + 30);
        doc.text('Date & Stamp', pageWidth - 50, finalY + 35, { align: 'center' });
      }

      // Add watermark effect (subtle)
      doc.setGState(new doc.GState({ opacity: 0.1 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(60);
      doc.setTextColor(...colors.border);
      doc.text('OFFICIAL', pageWidth / 2, pageHeight / 2, { 
        align: 'center',
        angle: 45
      });
      doc.setGState(new doc.GState({ opacity: 1 }));

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
    currentDate
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
            <DialogContent className="sm:max-w-[480px]">
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
                <div className="p-3 rounded-md bg-blue-50 border text-blue-900">
                  Professional PDF includes executive summary, performance analytics, and official formatting.
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
            {/* table-fixed + wrapping headers */}
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
