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

  // CSV unchanged
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
   * Redesigned Professional PDF per new specification.
   * Layout:
   * 1. Header (Centered): Logo Text, Subtitle, Pill "Test Series 2025"
   * 2. Main Card with blue border + top tab "FLP-2 RESULT"
   * 3. Data table (fixed columns order)
   * 4. Footer bar with website + contact
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

      // Define colors and constants
      const BLUE = [18, 74, 140];         // Deep academic blue
      const BLUE_SOFT = [230, 240, 250];  // Very light blue for fills
      const GRAY_ALT = [246, 248, 250];   // Alternating row background
      const TEXT_DARK = [20, 30, 40];
      const WHITE = [255, 255, 255];

      // Specific subject order & fallback counts
      const orderedSubjects = [
        'Biology',
        'Physics',
        'Chemistry',
        'English',
        'LR'
      ];

      // Build subject question counts (e.g., Biology (81))
      const subjectQuestionCounts: Record<string, number> = {};
      orderedSubjects.forEach(sub => {
        subjectQuestionCounts[sub] = quizQuestions.filter(q => q.subject?.toLowerCase() === sub.toLowerCase()).length;
      });

      // Compute global total questions (sum of all quiz questions)
      const totalQuestions = quizQuestions.length;

      // Orientation decision
      const orientation = 'landscape'; // 11 columns - landscape for clarity
      const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Utility
      const centerX = (x1: number, x2: number) => (x1 + x2) / 2;

      // HEADER SECTION
      // ---------------------------------
      let cursorY = 18;

      // "Logo" (text-based placeholder)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...BLUE);
      doc.text(platformName, pageWidth / 2, cursorY, { align: 'center' });

      // Subtitle
      cursorY += 8;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT_DARK);
      doc.text('MDCAT SELF ASSESSMENT', pageWidth / 2, cursorY, { align: 'center' });

      // Pill "Test Series 2025"
      cursorY += 8;
      const pillText = 'Test Series 2025';
      doc.setFontSize(10);
      const pillPaddingX = 6;
      const pillPaddingY = 3;
      const pillTextWidth =
        (doc.getStringUnitWidth(pillText) * doc.getFontSize()) / doc.internal.scaleFactor;
      const pillWidth = pillTextWidth + pillPaddingX * 2;
      const pillHeight = 8 + pillPaddingY * 2 - 6;
      const pillX = pageWidth / 2 - pillWidth / 2;
      const pillY = cursorY - 6;
      doc.setDrawColor(...BLUE);
      doc.setFillColor(...WHITE);
      doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 4, 4, 'FD');
      doc.setTextColor(...BLUE);
      doc.text(pillText, pageWidth / 2, cursorY, { align: 'center' });

      // MAIN RESULT CARD
      // ---------------------------------
      // Card bounding box
      const cardMarginX = 14;
      const cardTop = cursorY + 10;
      const cardWidth = pageWidth - cardMarginX * 2;
      const cardHeightMin = 100; // Will extend automatically with table
      const cardLeft = cardMarginX;

      // Draw card border (just outline first)
      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.8);
      doc.roundedRect(cardLeft, cardTop, cardWidth, cardHeightMin, 4, 4, 'S');

      // Tab "FLP-2 RESULT" overlapping top border
      const tabLabel = 'FLP-2 RESULT';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const tabPaddingX = 10;
      const tabPaddingY = 4;
      const tabTextWidth =
        (doc.getStringUnitWidth(tabLabel) * doc.getFontSize()) / doc.internal.scaleFactor;
      const tabWidth = tabTextWidth + tabPaddingX * 2;
      const tabHeight = 10 + tabPaddingY * 2 - 4;
      const tabX = pageWidth / 2 - tabWidth / 2;
      const tabY = cardTop - tabHeight / 2; // Overlap

      doc.setFillColor(...BLUE);
      doc.setDrawColor(...BLUE);
      doc.roundedRect(tabX, tabY, tabWidth, tabHeight, 4, 4, 'FD');
      doc.setTextColor(...WHITE);
      doc.text(tabLabel, pageWidth / 2, tabY + tabHeight / 2 + 2.2, {
        align: 'center'
      });

      // TABLE
      // ---------------------------------
      // Prepare table headers (fixed)
      // Column headers: S. No | Name | Father’s Name | District | Biology (X) | Physics (X) |
      // Chemistry (X) | English (X) | LR (X) | Obtained Score | Total Score
      const tableHeaders = [
        'S. No',
        'Name',
        "Father's Name",
        'District',
        ...orderedSubjects.map(
          sub => `${sub} (${subjectQuestionCounts[sub] || 0})`
        ),
        'Obtained Score',
        'Total Score'
      ];

      // Build rows
      const bodyRows = filteredScores.map((s, idx) => {
        const { subjectScores, totalCorrect } = calculateSubjectScores(s);
        const row = [
          String(idx + 1),
          s.name,
          s.fatherName,
          s.district,
          ...orderedSubjects.map(sub => String(subjectScores[sub] || 0)),
          String(totalCorrect),
          String(totalQuestions)
        ];
        return row;
      });

      // Column widths (approx sum must fit page)
      // We'll allocate flexible widths appropriate for landscape
      const colStyles: Record<number, any> = {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 38 }, // Name
        2: { cellWidth: 38 }, // Father Name
        3: { cellWidth: 28 }, // District
        4: { cellWidth: 20, halign: 'center' }, // Biology
        5: { cellWidth: 20, halign: 'center' }, // Physics
        6: { cellWidth: 22, halign: 'center' }, // Chemistry
        7: { cellWidth: 18, halign: 'center' }, // English
        8: { cellWidth: 16, halign: 'center' }, // LR
        9: { cellWidth: 28, halign: 'center' }, // Obtained
        10:{ cellWidth: 24, halign: 'center' }  // Total
      };

      // Use autoTable starting just below inside card
      // Adjust startY so header (tab) spacing remains clean
      const tableStartY = cardTop + 10;

      // @ts-ignore
      doc.autoTable({
        head: [tableHeaders],
        body: bodyRows,
        startY: tableStartY,
        styles: {
          font: 'helvetica',
          fontSize: 8.7,
          cellPadding: 3,
          textColor: TEXT_DARK,
          lineColor: BLUE,
          lineWidth: 0.15
        },
        headStyles: {
          fillColor: BLUE,
          textColor: WHITE,
          fontStyle: 'bold',
          halign: 'center',
          lineWidth: 0.2
        },
        alternateRowStyles: {
          fillColor: GRAY_ALT
        },
        bodyStyles: {
          valign: 'middle'
        },
        columnStyles: colStyles,
        didParseCell: data => {
          // Left align for some textual columns
          if (data.section === 'body') {
            if ([1, 2, 3].includes(data.column.index)) {
              data.cell.styles.halign = 'left';
            }
          }
          if (data.section === 'head') {
            if ([1, 2, 3].includes(data.column.index)) {
              data.cell.styles.halign = 'left';
            }
          }
        },
        margin: { left: cardLeft + 4, right: cardLeft + 4 },
        tableLineColor: BLUE,
        tableLineWidth: 0.2
      });

      // Extend card border height to cover table
      const finalTableY = (doc as any).lastAutoTable.finalY;
      const cardFinalHeight = Math.max(cardHeightMin, finalTableY - cardTop + 8);
      // Redraw border (cover previous) to ensure proper height
      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.8);
      doc.roundedRect(cardLeft, cardTop, cardWidth, cardFinalHeight, 4, 4, 'S');

      // FOOTER
      // ---------------------------------
      // Single blue bar with split content
      const footerHeight = 14;
      const footerY = pageHeight - footerHeight;

      doc.setFillColor(...BLUE);
      doc.rect(0, footerY, pageWidth, footerHeight, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);

      // Left text
      doc.text('Our Website: TayyariHub.com', 10, footerY + 9);

      // Right text
      doc.text('Contact Us: +92327507673', pageWidth - 10, footerY + 9, {
        align: 'right'
      });

      // Save
      const safeTitle = quizTitle ? quizTitle.replace(/\s+/g, '_') : 'Quiz';
      doc.save(`${safeTitle}_Result.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. See console for details.');
    } finally {
      setGeneratingPDF(false);
    }
  }, [
    generatingPDF,
    filteredScores,
    calculateSubjectScores,
    quizQuestions,
    quizTitle
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
                  PDF redesigned with academic layout: centered header, tabbed result card, fixed subject columns & footer.
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
                  {generatingPDF ? 'Generating Result PDF...' : 'Download Result PDF'}
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
