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
  // Optionally include rollNumber if your user documents contain it.
  rollNumber?: string;
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
            // If you store roll number in user docs, adjust key below (e.g., userData.rollNumber)
          rollNumber: (userData.rollNumber || userData.studentId || userId),
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

  // CSV export (unchanged)
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
   * NEW PROFESSIONAL / ELEGANT PDF TEMPLATE
   * Requirements Implemented:
   * - Modern academic look, generous white space
   * - Left-aligned institution logo (placeholder base64 string, replace as needed)
   * - Centered title "Student Results Report"
   * - Serif (Times) for headings, Sans (Helvetica) for body
   * - Refined table: Student Name | Roll Number | Subject | Marks | Grade | Remarks
   * - Alternating row shading, subtle dividers
   * - Professional palette (navy, charcoal, black, white)
   * - Slim footer with institution (left), page number (center), disclaimer (right)
   * - Leverages existing quiz data: subject correct counts become "Marks"
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

      // Color palette
      const palette = {
        navy: [15, 42, 85],
        charcoal: [51, 51, 51],
        lightLine: [200, 205, 210],
        headerFill: [240, 243, 247],
        altRow: [248, 250, 252],
        white: [255, 255, 255]
      };

      // Placeholder logo (transparent 1x1). Replace with real base64 PNG/JPEG.
      const institutionLogo =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 54; // generous side margin
      const topMargin = 60;
      const lineHeight = 14;

      // Precompute total questions per subject (for "Marks" denominator)
      const subjectQuestionTotals: Record<string, number> = {};
      quizQuestions.forEach(q => {
        if (!q.subject) return;
        subjectQuestionTotals[q.subject] = (subjectQuestionTotals[q.subject] || 0) + 1;
      });

      // Utility: grade calculation
      const getGrade = (percentage: number) => {
        if (percentage >= 90) return 'A+';
        if (percentage >= 80) return 'A';
        if (percentage >= 70) return 'B';
        if (percentage >= 60) return 'C';
        if (percentage >= 50) return 'D';
        return 'F';
      };

      const getRemarks = (grade: string) => {
        switch (grade) {
          case 'A+':
          case 'A':
            return 'Excellent performance';
          case 'B':
            return 'Very good';
          case 'C':
            return 'Satisfactory';
          case 'D':
            return 'Needs improvement';
          default:
            return 'At risk – intervention advised';
        }
      };

      // Flatten rows: one row per (student x subject)
      interface Row {
        studentName: string;
        rollNumber: string;
        subject: string;
        marksText: string; // "X / Y"
        grade: string;
        remarks: string;
      }
      const tableRows: Row[] = [];

      filteredScores.forEach(s => {
        const { subjectScores } = calculateSubjectScores(s);
        subjects.forEach(sub => {
          const obtained = subjectScores[sub] || 0;
            // avoid division by zero (subject absent)
          const totalForSub = subjectQuestionTotals[sub] || 0;
          if (totalForSub === 0) return;
          const percentage = (obtained / totalForSub) * 100;
          const grade = getGrade(percentage);
          tableRows.push({
            studentName: s.name,
            rollNumber: s.rollNumber || s.id,
            subject: sub,
            marksText: `${obtained} / ${totalForSub}`,
            grade,
            remarks: getRemarks(grade)
          });
        });
      });

      // Sort table rows optionally by student then subject
      tableRows.sort((a, b) => {
        if (a.studentName === b.studentName) {
          return a.subject.localeCompare(b.subject);
        }
        return a.studentName.localeCompare(b.studentName);
      });

      // HEADER
      const headerHeight = 90;
      const renderHeader = () => {
        // Background (optional subtle white, but we keep clean)
        // Logo
        const logoSize = 50;
        try {
          doc.addImage(
            institutionLogo,
            'PNG',
            margin,
            topMargin - 10,
            logoSize,
            logoSize
          );
        } catch {
          // Ignore if invalid logo
        }

        // Title
        doc.setFont('times', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(...palette.navy);
        doc.text('Student Results Report', pageWidth / 2, topMargin + 10, {
          align: 'center'
        });

        // Subtitle (quiz title & date)
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(...palette.charcoal);
        doc.text(
          `${quizTitle || 'Assessment'} • ${currentDate}`,
          pageWidth / 2,
          topMargin + 30,
          { align: 'center' }
        );

        // Thin accent line
        doc.setDrawColor(...palette.navy);
        doc.setLineWidth(0.6);
        doc.line(margin, topMargin + 42, pageWidth - margin, topMargin + 42);
      };

      // FOOTER
      const disclaimer =
        'This is a computer-generated report. No signature is required.';
      const renderFooter = (pageNum: number, totalPages: number) => {
        const footerY = pageHeight - 34;
        // Line
        doc.setDrawColor(...palette.lightLine);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...palette.navy);

        // Left: institution name
        doc.text(platformName, margin, footerY);

        // Center: page x of y
        doc.text(
          `Page ${pageNum} of ${totalPages}`,
          pageWidth / 2,
          footerY,
          { align: 'center' }
        );

        // Right: disclaimer
        doc.setFontSize(8.5);
        doc.setTextColor(80);
        const rightTextWidth = doc.getTextWidth(disclaimer);
        doc.text(
          disclaimer,
          pageWidth - margin,
          footerY,
          { align: 'right', maxWidth: pageWidth - margin * 2 - 120 }
        );
      };

      // First page header
      renderHeader();

      // Table column definitions
      const head = [
        [
          { content: 'Student Name', styles: { fontStyle: 'bold' } },
          { content: 'Roll Number', styles: { fontStyle: 'bold' } },
          { content: 'Subject', styles: { fontStyle: 'bold' } },
            // Marks in "obtained / total" format
          { content: 'Marks', styles: { fontStyle: 'bold' } },
          { content: 'Grade', styles: { fontStyle: 'bold' } },
          { content: 'Remarks', styles: { fontStyle: 'bold' } }
        ]
      ];

      const body = tableRows.map(r => [
        r.studentName,
        r.rollNumber,
        r.subject,
        r.marksText,
        r.grade,
        r.remarks
      ]);

      // Determine startY for table after header
      const tableStartY = topMargin + 60;

      // @ts-ignore
      doc.autoTable({
        head,
        body,
        startY: tableStartY,
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 9.5,
          textColor: palette.charcoal,
          cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
          lineColor: palette.lightLine,
          lineWidth: 0.4
        },
        headStyles: {
          fillColor: palette.headerFill,
          textColor: palette.navy,
          font: 'times',
          fontStyle: 'bold',
          lineWidth: 0.6,
          lineColor: palette.lightLine
        },
        bodyStyles: {
          lineWidth: 0.3,
          lineColor: palette.lightLine
        },
        alternateRowStyles: {
          fillColor: palette.altRow
        },
        columnStyles: {
          0: { cellWidth: 140 },
          1: { cellWidth: 90 },
          2: { cellWidth: 100 },
          3: { cellWidth: 70, halign: 'center' },
          4: { cellWidth: 60, halign: 'center' },
          5: { cellWidth: 'auto' }
        },
        didDrawPage: (data: any) => {
          // Header on subsequent pages
          if (data.pageNumber > 1) {
            renderHeader();
          }
          // Footer
          const totalPages = doc.getNumberOfPages();
          renderFooter(data.pageNumber, totalPages);
        }
      });

      // Optional summary (overall) after table if space
      const finalY = (doc as any).lastAutoTable.finalY;
      if (finalY < pageHeight - 140) {
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...palette.navy);
        doc.text('Summary Overview', margin, finalY + 36);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...palette.charcoal);

        const totalParticipants = filteredScores.length;

        // Average overall (across all subjects, per student)
        const perStudentAverages = filteredScores.map(s => {
          const { subjectScores } = calculateSubjectScores(s);
          let totalObt = 0;
          let totalMax = 0;
          subjects.forEach(sub => {
            const obt = subjectScores[sub] || 0;
            const max = subjectQuestionTotals[sub] || 0;
            if (max > 0) {
              totalObt += obt;
              totalMax += max;
            }
          });
          return totalMax > 0 ? (totalObt / totalMax) * 100 : 0;
        });
        const avgOverall =
          perStudentAverages.reduce((a, v) => a + v, 0) /
          (perStudentAverages.length || 1);

        const summaryLines = [
          `Total Participants: ${totalParticipants}`,
          `Subjects Assessed: ${subjects.join(', ') || 'N/A'}`,
          `Average Overall Performance: ${avgOverall.toFixed(1)}%`
        ];

        let y = finalY + 56;
        summaryLines.forEach(line => {
          doc.text(line, margin, y);
          y += lineHeight;
        });
      }

      doc.save(`${quizTitle.replace(/\s+/g, '_')}_Student_Results_Report.pdf`);
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
                  PDF now uses a polished academic format with per-subject entries.
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
                  {generatingPDF ? 'Generating Report...' : 'Download Professional PDF'}
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
