'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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

  // Core Data
  const [quizTitle, setQuizTitle] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  // UI / Filters
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showSubjectsLine, setShowSubjectsLine] = useState(true);
  const [showChaptersLine, setShowChaptersLine] = useState(true);
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

  /* -------------------- Helpers -------------------- */
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

  /* -------------------- Data Fetch -------------------- */
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

  /* -------------------- Derived Data -------------------- */
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

  const subjectQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    subjects.forEach(s => (counts[s] = 0));
    quizQuestions.forEach(q => {
      if (q.subject) counts[q.subject] = (counts[q.subject] || 0) + 1;
    });
    return counts;
  }, [subjects, quizQuestions]);

  const summaryStats = useMemo(() => {
    if (!filteredScores.length) return null;

    const totalQuestionsAll = quizQuestions.length;
    const perStudentTotals = filteredScores.map(s =>
      countCorrectAnswers(s.answers)
    );
    const highest = Math.max(...perStudentTotals);
    const lowest = Math.min(...perStudentTotals);
    const average =
      perStudentTotals.reduce((a, b) => a + b, 0) / perStudentTotals.length;

    // Per subject averages
    const subjTotals: Record<string, number> = {};
    subjects.forEach(s => (subjTotals[s] = 0));

    filteredScores.forEach(s => {
      const { subjectScores } = calculateSubjectScores(s);
      subjects.forEach(subj => {
        subjTotals[subj] += subjectScores[subj] || 0;
      });
    });

    const subjAverages = subjects.map(subj => {
      const count = subjectQuestionCounts[subj] || 0;
      const totalCorrectAcross = subjTotals[subj];
      const avgCorrect = totalCorrectAcross / filteredScores.length;
      const pct = count > 0 ? (avgCorrect / count) * 100 : 0;
      return {
        subject: subj,
        avgCorrect: Math.round(avgCorrect * 100) / 100,
        pct: Math.round(pct * 10) / 10
      };
    });

    return {
      studentCount: filteredScores.length,
      highest,
      lowest,
      average: Math.round(average * 100) / 100,
      totalQuestionsAll,
      subjAverages
    };
  }, [
    filteredScores,
    quizQuestions,
    subjects,
    calculateSubjectScores,
    countCorrectAnswers,
    subjectQuestionCounts
  ]);

  /* -------------------- CSV Export -------------------- */
  const exportToCSV = useCallback(() => {
    if (filteredScores.length === 0) {
      alert('No data to export.');
      return;
    }
    // Rank is based on current filtered order (already sorted)
    const headers = [
      'Rank',
      'S.No',
      'Name',
      "Father's Name",
      'District',
      ...subjects,
      'Total Correct',
      'Percentage',
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
      const pct = totalQuestions
        ? ((totalCorrect / totalQuestions) * 100).toFixed(2)
        : '0.00';
      return [
        index + 1,
        index + 1, // S.No same as rank if no deletion; separate keeps concept clear
        s.name,
        s.fatherName,
        s.district,
        ...subjects.map(subj => subjectScores[subj] || 0),
        totalCorrect,
        pct,
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

  /* -------------------- Advanced PDF Export -------------------- */
  const exportDataPDF = useCallback(async () => {
    if (generatingPDF) return;
    if (filteredScores.length === 0) {
      alert('No data to export.');
      return;
    }
    setGeneratingPDF(true);

    // CONFIG zone (tweak quickly)
    const CONFIG = {
      topPercentHighlight: 0.1,
      bottomPercentHighlight: 0.1,
      headerColor: [11, 59, 140] as [number, number, number], // deep blue
      zebraColor: [247, 250, 255] as [number, number, number],
      heatLight: [232, 240, 254] as [number, number, number],
      heatDark: [29, 78, 216] as [number, number, number],
      footerTextColor: 80 as number,
      maxFontSizeBody: 8
    };

    try {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      // Determine orientation
      const totalLeafColumns =
        1 + 1 + 1 + 1 + 1 + subjects.length + 4; // Rank + S.No + Name + Father's + District + subjects + Totals(4: Correct,% ,Wrong,Questions)
      const orientation = totalLeafColumns > 13 ? 'landscape' : 'portrait';

      const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4'
      });

      // ------------- Cover Page -------------
      const marginLeft = 18;
      doc.setFontSize(20);
      doc.setTextColor(20);
      doc.text(`${quizTitle || 'Quiz'} Results`, marginLeft, 25);

      doc.setFontSize(12);
      doc.setTextColor(60);
      doc.text(`${platformName} - ${currentDate}`, marginLeft, 34);

      let y = 48;
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text('Overview', marginLeft, y);
      y += 6;

      if (summaryStats) {
        doc.setFontSize(9);
        const lines = [
          `Total Students: ${summaryStats.studentCount}`,
          `Average Score: ${summaryStats.average} / ${summaryStats.totalQuestionsAll} (${(
            (summaryStats.average / summaryStats.totalQuestionsAll) *
            100
          ).toFixed(2)}%)`,
          `Highest Score: ${summaryStats.highest}`,
          `Lowest Score: ${summaryStats.lowest}`,
          chapters
            ? `Chapters: ${chapters.substring(0, 120)}${
                chapters.length > 120 ? '…' : ''
              }`
            : ''
        ].filter(Boolean);

        lines.forEach(line => {
          doc.text(line, marginLeft, y);
          y += 5;
        });

        // Per subject averages table (mini)
        y += 2;
        doc.setFontSize(10);
        doc.text('Per-Subject Averages', marginLeft, y);
        y += 4;

        doc.setFontSize(8);
        summaryStats.subjAverages.forEach(sa => {
          doc.text(
            `${sa.subject}: avg ${sa.avgCorrect} (${sa.pct}%) of ${
              subjectQuestionCounts[sa.subject] || 0
            }`,
            marginLeft,
            y
          );
          y += 4;
        });
      }

      y += 6;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        'This report includes ranking, subject accuracy heatmap, and performance highlights.',
        marginLeft,
        y
      );

      // Add a new page for the table
      doc.addPage();

      // ------------- Table Data Preparation -------------
      // Build data rows with rank & percentage
      const tableData = filteredScores.map((s, idx) => {
        const {
          subjectScores,
          totalCorrect,
          totalWrong,
          totalQuestions
        } = calculateSubjectScores(s);
        const pct = totalQuestions
          ? (totalCorrect / totalQuestions) * 100
          : 0;
        return {
          rank: idx + 1,
          sno: idx + 1,
          name: s.name,
          father: s.fatherName,
          district: s.district,
          subjectScores,
          totalCorrect,
            pct,
          totalWrong,
          totalQuestions
        };
      });

      const topCut = Math.ceil(tableData.length * CONFIG.topPercentHighlight);
      const bottomCut = Math.ceil(
        tableData.length * CONFIG.bottomPercentHighlight
      );

      // Multi-row header definition
      const topHeaderRow: any[] = [
        { content: 'Rank', rowSpan: 2 },
        { content: 'S.No', rowSpan: 2 },
        { content: 'Name', rowSpan: 2 },
        { content: "Father's Name", rowSpan: 2 },
        { content: 'District', rowSpan: 2 },
        {
          content: 'Correct Answers',
          colSpan: subjects.length,
          styles: { halign: 'center' }
        },
        {
          content: 'Totals',
          colSpan: 4,
          styles: { halign: 'center' }
        }
      ];

      const secondHeaderRow: any[] = [
        ...subjects.map(s => ({ content: s })),
        { content: 'Correct' },
        { content: '%' },
        { content: 'Wrong' },
        { content: 'Questions' }
      ];

      const head = [topHeaderRow, secondHeaderRow];

      // Build body rows (flat array)
      const body = tableData.map(row => [
        row.rank,
        row.sno,
        row.name,
        row.father,
        row.district,
        ...subjects.map(s => row.subjectScores[s] || 0),
        row.totalCorrect,
        row.pct.toFixed(2),
        row.totalWrong,
        row.totalQuestions
      ]);

      // Column styling
      // indexes:
      // 0 Rank, 1 S.No, 2 Name, 3 Father, 4 District,
      // 5...(5+subjects-1) subject columns,
      // last 4 = totals
      const columnStyles: Record<number, any> = {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 32 },
        3: { cellWidth: 32 },
        4: { cellWidth: 26 }
      };
      subjects.forEach((_, i) => {
        columnStyles[5 + i] = { cellWidth: 14, halign: 'center' };
      });
      const totalsStart = 5 + subjects.length;
      columnStyles[totalsStart] = { cellWidth: 18, halign: 'center' }; // Correct
      columnStyles[totalsStart + 1] = { cellWidth: 16, halign: 'center' }; // %
      columnStyles[totalsStart + 2] = { cellWidth: 18, halign: 'center' }; // Wrong
      columnStyles[totalsStart + 3] = { cellWidth: 22, halign: 'center' }; // Questions

      // Heatmap color helper
      function interpolateColor(
        ratio: number,
        light: [number, number, number],
        dark: [number, number, number]
      ): [number, number, number] {
        const clamp = Math.min(1, Math.max(0, ratio));
        const r = Math.round(light[0] + (dark[0] - light[0]) * clamp);
        const g = Math.round(light[1] + (dark[1] - light[1]) * clamp);
        const b = Math.round(light[2] + (dark[2] - light[2]) * clamp);
        return [r, g, b];
      }

      // ------------- Table Render -------------
      // @ts-ignore
      doc.autoTable({
        head,
        body,
        theme: 'grid',
        startY: 18,
        styles: {
          fontSize: CONFIG.maxFontSizeBody,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: CONFIG.headerColor,
          halign: 'center',
          fontStyle: 'bold',
          textColor: 255
        },
        bodyStyles: { valign: 'middle', textColor: 30 },
        alternateRowStyles: { fillColor: CONFIG.zebraColor },
        columnStyles,
        rowPageBreak: 'auto',
        didParseCell: (data: any) => {
          // data.section: 'head' | 'body' | 'foot'
          if (data.section === 'body') {
            const rowIndex = data.row.index;
            const colIndex = data.column.index;
            const rowObj = tableData[rowIndex];
            // Subject columns heatmap
            if (colIndex >= 5 && colIndex < 5 + subjects.length) {
              const subj = subjects[colIndex - 5];
              const subjTotal = subjectQuestionCounts[subj] || 0;
              if (subjTotal > 0) {
                const value = rowObj.subjectScores[subj] || 0;
                const ratio = value / subjTotal;
                const fill = interpolateColor(
                  ratio,
                  CONFIG.heatLight,
                  CONFIG.heatDark
                );
                data.cell.styles.fillColor = fill;
                if (ratio > 0.6) {
                  data.cell.styles.textColor = 255;
                }
              }
            }

            // Top performers highlight in 'Correct' column cell (or entire row)
            const isTop = rowObj.rank <= topCut;
            const isBottom = rowObj.rank > tableData.length - bottomCut;

            if (isTop) {
              // Light green tint overlay entire row
              data.row.cells[0].styles.fontStyle = 'bold';
              if (colIndex === 0) {
                data.cell.styles.fillColor = [225, 247, 232];
              }
            } else if (isBottom) {
              if (colIndex === 0) {
                data.cell.styles.fillColor = [255, 235, 235];
              }
            }

            // Bold total correct & percentage columns
            if (
              colIndex === totalsStart || // Correct
              colIndex === totalsStart + 1 // %
            ) {
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        didDrawPage: (data: any) => {
          // Footer
            const pageCount = doc.getNumberOfPages();
          const pageSize = doc.internal.pageSize;
          const pageWidth = pageSize.getWidth();
          const pageHeight = pageSize.getHeight();
          doc.setFontSize(8);
          doc.setTextColor(CONFIG.footerTextColor);
          doc.text(
            `${platformName} • Generated ${currentDate} • Page ${data.pageNumber} of ${pageCount}`,
            pageWidth / 2,
            pageHeight - 6,
            { align: 'center' }
          );
        }
      });

      doc.save(`${quizTitle.replace(/\s+/g, '_')}_Results_Advanced.pdf`);
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
    currentDate,
    subjectQuestionCounts,
    summaryStats
  ]);

  /* -------------------- UI -------------------- */
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
                Export (Advanced PDF / CSV)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">
                  Export Options
                </DialogTitle>
                <DialogDescription>
                  Advanced PDF includes cover page, ranking, subject heatmap & performance highlights. CSV matches current filters.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="subjectsLine"
                    checked={showSubjectsLine}
                    onCheckedChange={v => setShowSubjectsLine(Boolean(v))}
                  />
                  <label htmlFor="subjectsLine" className="font-medium">
                    Show Subjects line (screen only)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="chaptersLine"
                    checked={showChaptersLine}
                    onCheckedChange={v => setShowChaptersLine(Boolean(v))}
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
                <div className="p-3 rounded-md bg-blue-50 border text-blue-900 text-xs leading-relaxed">
                  Heatmap: darker = higher subject accuracy. Top 10% ranked highlighted. Cover page includes key metrics.
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
                  {generatingPDF ? 'Generating...' : 'Download Advanced PDF'}
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToCSV}
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

      {/* Summary cards (screen only) */}
      {summaryStats && !loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Students
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {summaryStats.studentCount}
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Average Score
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {summaryStats.average}
              <span className="text-sm text-gray-500 ml-1">
                / {summaryStats.totalQuestionsAll}
              </span>
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Highest
            </p>
            <p className="text-2xl font-bold text-green-600">
              {summaryStats.highest}
            </p>
          </div>
            <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Lowest
            </p>
            <p className="text-2xl font-bold text-red-500">
              {summaryStats.lowest}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span className="font-bold text-lg text-blue-800">{platformName}</span>
          <span className="text-gray-500">{currentDate}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-center text-blue-900">
          {quizTitle || 'Quiz'} Results
        </h1>
        {showSubjectsLine && subjects.length > 0 && (
          <p className="text-center text-gray-700 text-lg">
            📚 <span className="font-semibold">Subjects:</span>{' '}
            {subjects.join(', ')}
          </p>
        )}
        {showChaptersLine && chapters && (
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
            <table className="w-full mt-6 text-sm border-collapse">
              <thead className="bg-blue-800 text-white">
                <tr>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-center font-semibold"
                  >
                    Rank
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-center font-semibold"
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-left font-semibold"
                  >
                    Name
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-left font-semibold"
                  >
                    Father&apos;s Name
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-blue-200 p-3 text-left font-semibold"
                  >
                    District
                  </th>
                  <th
                    colSpan={subjects.length}
                    className="border border-blue-200 p-3 text-center font-semibold"
                  >
                    Correct Answers
                  </th>
                  <th
                    colSpan={4}
                    className="border border-blue-200 p-3 text-center font-semibold"
                  >
                    Totals
                  </th>
                </tr>
                <tr>
                  {subjects.map(subj => (
                    <th
                      key={subj}
                      className="border border-blue-200 p-2 text-center font-semibold"
                    >
                      {subj}
                    </th>
                  ))}
                  <th className="border border-blue-200 p-2 text-center font-semibold">
                    Correct
                  </th>
                  <th className="border border-blue-200 p-2 text-center font-semibold">
                    %
                  </th>
                  <th className="border border-blue-200 p-2 text-center font-semibold">
                    Wrong
                  </th>
                  <th className="border border-blue-200 p-2 text-center font-semibold">
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
                  const pct = totalQuestions
                    ? ((totalCorrect / totalQuestions) * 100).toFixed(2)
                    : '0.00';
                  return (
                    <tr
                      key={s.id}
                      className={
                        index < Math.ceil(filteredScores.length * 0.1)
                          ? 'bg-green-50'
                          : index >=
                            filteredScores.length -
                              Math.ceil(filteredScores.length * 0.1)
                          ? 'bg-red-50'
                          : 'hover:bg-blue-50'
                      }
                    >
                      <td className="border border-gray-200 p-3 text-center font-medium">
                        {index + 1}
                      </td>
                      <td className="border border-gray-200 p-3 text-center">
                        {index + 1}
                      </td>
                      <td className="border border-gray-200 p-3">{s.name}</td>
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
                      <td className="border border-gray-200 p-3 text-center font-semibold">
                        {totalCorrect}
                      </td>
                      <td className="border border-gray-200 p-3 text-center">
                        {pct}
                      </td>
                      <td className="border border-gray-200 p-3 text-center">
                        {totalWrong}
                      </td>
                      <td className="border border-gray-200 p-3 text-center">
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

/*
Notes:
- Ensure jsPDF 2.5.1 + jspdf-autotable 3.8.2 installed.
- If TypeScript complains about autoTable augmentation, create:
  types/jspdf-autotable.d.ts
  --------------------------------
  import 'jspdf';
  declare module 'jspdf' {
    interface jsPDF {
      autoTable: (options: any) => jsPDF;
    }
  }
  --------------------------------
*/
