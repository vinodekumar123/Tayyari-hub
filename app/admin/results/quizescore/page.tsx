'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
import { Download, Printer } from 'lucide-react';

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

function QuizStudentScoresContent() {
  const router = useRouter();
  const params = useSearchParams();
  const quizId = params.get('id');

  // Refs
  const printRef = useRef<HTMLDivElement | null>(null);

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

      const title = `${quizTitle || 'Quiz'} Results`;
      const subtitle = `${platformName} - ${currentDate}`;

      doc.setFontSize(16);
      doc.text(title, 14, 16);
      doc.setFontSize(10);
      doc.text(subtitle, 14, 23);

      const topRow: any[] = [
        { content: 'S.No', rowSpan: 2 },
        { content: 'Name', rowSpan: 2 },
        { content: "Father's Name", rowSpan: 2 },
        { content: 'District', rowSpan: 2 },
        { content: 'Correct Answers', colSpan: subjects.length, styles: { halign: 'center' } },
        { content: 'Totals', colSpan: 3, styles: { halign: 'center' } }
      ];

      const secondRow: any[] = [
        ...subjects.map(s => ({ content: s })),
        { content: 'Correct' },
        { content: 'Wrong' },
        { content: 'Questions' }
      ];

      const head = [topRow, secondRow];

      const body = filteredScores.map((s, idx) => {
        const {
          subjectScores,
          totalCorrect,
          totalWrong,
          totalQuestions
        } = calculateSubjectScores(s);
        return [
          idx + 1,
          s.name,
          s.fatherName,
          s.district,
          ...subjects.map(subj => subjectScores[subj] || 0),
          totalCorrect,
          totalWrong,
          totalQuestions
        ];
      });

      const columnStyles: Record<number, any> = {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 24 }
      };
      for (let i = 0; i < subjects.length; i++) {
        columnStyles[4 + i] = { cellWidth: 14, halign: 'center' };
      }
      const totalsStart = 4 + subjects.length;
      columnStyles[totalsStart] = { cellWidth: 18, halign: 'center' };
      columnStyles[totalsStart + 1] = { cellWidth: 18, halign: 'center' };
      columnStyles[totalsStart + 2] = { cellWidth: 22, halign: 'center' };

      // @ts-ignore
      doc.autoTable({
        head,
        body,
        startY: 30,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [30, 64, 175],
          halign: 'center',
          fontStyle: 'bold',
          textColor: 255
        },
        bodyStyles: {
          valign: 'middle'
        },
        columnStyles,
        rowPageBreak: 'auto',
        didDrawPage: (data: any) => {
          const pageCount = doc.getNumberOfPages();
          const pageSize = doc.internal.pageSize;
          const pageWidth = pageSize.getWidth();
          const pageHeight = pageSize.getHeight();
          doc.setFontSize(9);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            pageWidth - 40,
            pageHeight - 10
          );
        }
      });

      doc.save(`${quizTitle.replace(/\s+/g, '_')}_Results.pdf`);
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
    platformName,
    currentDate
  ]);

  // OPTIONAL: High-fidelity visual PDF capture (commented out)
  // const exportVisualPDF = useCallback(async () => {
  //   if (!printRef.current) return;
  //   const { jsPDF } = await import('jspdf');
  //   const html2canvas = (await import('html2canvas')).default;
  //   const canvas = await html2canvas(printRef.current, {
  //     scale: 2,
  //     useCORS: true,
  //     backgroundColor: '#ffffff'
  //   });
  //   const imgData = canvas.toDataURL('image/png');
  //   const pdf = new jsPDF('p', 'mm', 'a4');
  //   const pdfWidth = pdf.internal.pageSize.getWidth();
  //   const imgProps = pdf.getImageProperties(imgData);
  //   const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  //   pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  //   pdf.save(`${quizTitle.replace(/\s+/g, '_')}_Visual.pdf`);
  // }, [quizTitle]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 min-h-screen bg-gradient-to-b from-blue-100 to-white print:p-0 print:bg-white">
      {/* Top Bar (hidden in print) */}
      <div className="flex justify-between items-center mb-6 no-print">
        <Button variant="outline" onClick={() => router.push('/admin/results')}>
          ← Back to Results
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
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
                    Show Subjects line (screen & print)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="chaptersLine"
                    checked={showChapters}
                    onCheckedChange={v => setShowChapters(Boolean(v))}
                  />
                  <label htmlFor="chaptersLine" className="font-medium">
                    Show Chapters line (screen & print)
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
                  The grouped header prevents column overlap and allows wrapping.
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
                  {generatingPDF ? 'Generating...' : 'Download Data PDF'}
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
                {/* <Button
                  onClick={exportVisualPDF}
                  variant="secondary"
                  className="w-full"
                >
                  Visual PDF (Exact Design)
                </Button> */}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters (hidden in print) */}
      <div className="flex gap-4 mb-6 no-print">
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

      <div
        ref={printRef}
        className="bg-white rounded-2xl p-8 shadow-xl space-y-6 print:shadow-none print:border print:border-gray-200 print:rounded-xl print-card"
      >
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
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full mt-6 text-sm border-collapse table-fixed print-table">
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
                      className="hover:bg-blue-50 transition-colors print:hover:bg-transparent"
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
        <p className="text-center text-gray-500 mt-3 no-print">Loading...</p>
      )}

      {/* Global Print Styles */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          /* Ensure gradient doesn't show as banded or washed out */
          .bg-gradient-to-b {
            background: #ffffff !important;
          }
          /* Preserve heading / brand colors */
          .print-card h1,
          .print-card .text-blue-900,
          .print-card .text-blue-800 {
            color: #1e3a8a !important;
          }
          /* Table header color */
          .print-table thead tr:first-child th,
          .print-table thead tr:nth-child(2) th {
            background-color: #1e40af !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
          }
          /* Optional zebra striping */
          .print-table tbody tr:nth-child(even) td {
            background-color: #f1f5f9 !important;
          }
          /* Remove hover background in print */
          .print-table tbody tr:hover td {
            background: transparent !important;
          }
          /* Card shadow off, border on (already handled by classes) */
          .print-card {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function QuizStudentScores() {
  return (
    <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <QuizStudentScoresContent />
    </React.Suspense>
  );
}
