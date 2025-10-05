'use client';

import { useEffect, useState, useRef } from 'react';
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
  DialogFooter
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
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState('');
  const [showSubjects, setShowSubjects] = useState(true);
  const [showChapters, setShowChapters] = useState(true);
  const [sortByScore, setSortByScore] = useState<'desc' | 'asc'>('desc');
  const [districtFilter, setDistrictFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const pdfRef = useRef<HTMLDivElement>(null);

  const params = useSearchParams();
  const router = useRouter();
  const quizId = params.get('id');

  const platformName = "Tayyari Hub";
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const fetchMetadata = async () => {
    if (!quizId) return;
    const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
    if (!quizDoc.exists()) return;
    const data = quizDoc.data() as QuizData;
    setQuizTitle(data.title || 'Untitled');

    const extractNames = (raw: any) => {
      if (Array.isArray(raw)) return raw.map((s: any) => typeof s === 'string' ? s : s?.name || '[Invalid]').filter(Boolean);
      if (typeof raw === 'object' && raw?.name) return [raw.name];
      return typeof raw === 'string' ? [raw] : [];
    };

    setSubjects(extractNames(data.subjects || (data as any).subject));
    setChapters(extractNames(data.chapters || (data as any).chapter).join(', '));
    setQuizQuestions(data.selectedQuestions || []);
  };

  const countCorrectAnswers = (answers: Record<string, string>, questions: Question[]) => {
    return questions.filter(q => answers[q.id] === q.correctAnswer).length;
  };

  const calculateSubjectScores = (score: Score) => {
    const subjectScores: Record<string, number> = {};
    subjects.forEach(subj => subjectScores[subj] = 0);

    quizQuestions.forEach(q => {
      if (q.subject && q.correctAnswer && score.answers[q.id] === q.correctAnswer) {
        subjectScores[q.subject] = (subjectScores[q.subject] || 0) + 1;
      }
    });

    const totalCorrect = countCorrectAnswers(score.answers, quizQuestions);
    const totalWrong = quizQuestions.length - totalCorrect;
    const totalQuestions = quizQuestions.length;

    return { subjectScores, totalCorrect, totalWrong, totalQuestions };
  };

  const fetchScores = async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const scorePromises = usersSnap.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        const resultRef = doc(db, 'users', userId, 'quizAttempts', quizId, 'results', quizId);
        const resultSnap = await getDoc(resultRef);
        if (resultSnap.exists()) {
          const userData = userDoc.data();
            // resultData can include answers
          const resultData = resultSnap.data();
          return {
            id: userId,
            name: userData.fullName || 'Unknown',
            fatherName: userData.fatherName || '-',
            district: userData.district || '-',
            answers: resultData.answers || {},
          };
        }
        return null;
      });

      const scoreList = (await Promise.all(scorePromises)).filter((score): score is Score => score !== null);

      // Sort using current quizQuestions
      const sorted = scoreList.sort((a, b) => {
        const aCorrect = countCorrectAnswers(a.answers, quizQuestions);
        const bCorrect = countCorrectAnswers(b.answers, quizQuestions);
        return sortByScore === 'desc' ? bCorrect - aCorrect : aCorrect - bCorrect;
      });

      setScores(sorted);
    } catch (error) {
      console.error('Error fetching scores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [quizId]);

  useEffect(() => {
    if (quizQuestions.length > 0) fetchScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizQuestions, sortByScore]);

  // OPTION A: Improved html2pdf visual export (still screenshot-based)
  const exportVisualPDF = async () => {
    if (!pdfRef.current) return;
    const html2pdf = (await import('html2pdf.js')).default;

    // Decide orientation by column count
    const columnCount = 4 + subjects.length + 3; // base columns + subjects + totals
    const orientation = columnCount > 10 ? 'landscape' : 'portrait';

    // Allow splitting pages by removing 'avoid-all'
    html2pdf()
      .set({
        margin: 10,
        filename: `${quizTitle.replace(/\s+/g, '_')}_VisualResults.pdf`,
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation },
        // Let html2pdf decide page breaks; you can add CSS classes for precise control
        pagebreak: {
          mode: ['css', 'legacy']
          // You can add: avoid: '.no-break'
        }
      })
      .from(pdfRef.current)
      .save();
  };

  // OPTION B: Data-first jsPDF + autoTable export (recommended)
  const exportDataPDF = async () => {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const columnCount = 4 + subjects.length + 3;
    const orientation = columnCount > 10 ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation });

    const leftMargin = 14;
    doc.setFontSize(16);
    doc.text(`${quizTitle || 'Quiz'} Results`, leftMargin, 16);
    doc.setFontSize(10);
    doc.text(`${platformName} - ${currentDate}`, leftMargin, 23);

    // Header row
    const head = [
      'S.No',
      'Name',
      "Father's Name",
      'District',
      ...subjects.map(s => `${s} Correct`),
      'Total Correct',
      'Total Wrong',
      'Total Questions'
    ];

    // Body rows
    const body = filtered.map((s, index) => {
      const { subjectScores, totalCorrect, totalWrong, totalQuestions } = calculateSubjectScores(s);
      return [
        index + 1,
        s.name,
        s.fatherName,
        s.district,
        ...subjects.map(subj => subjectScores[subj] || 0),
        totalCorrect,
        totalWrong,
        totalQuestions
      ];
    });

    // @ts-ignore - autoTable injected by side effect
    doc.autoTable({
      head: [head],
      body,
      startY: 30,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [30, 64, 175], // Tailwind blue-800-ish
        halign: 'center'
      },
      bodyStyles: {
        valign: 'middle'
      },
      didDrawPage: (data: any) => {
        // Footer with page number
        const pageCount = doc.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.getHeight();
        doc.setFontSize(9);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageSize.getWidth() - 40,
          pageHeight - 10
        );
      }
    });

    doc.save(`${quizTitle.replace(/\s+/g, '_')}_Results.pdf`);
  };

  const exportToCSV = () => {
    const headers = ['S.No', 'Name', "Father's Name", 'District', ...subjects.map(s => `${s} Correct`), 'Total Correct', 'Total Wrong', 'Total Questions'];
    const rows = filtered.map((s, index) => {
      const { subjectScores, totalCorrect, totalWrong, totalQuestions } = calculateSubjectScores(s);
      return [
        index + 1,
        s.name,
        s.fatherName,
        s.district,
        ...subjects.map(subj => subjectScores[subj] || 0),
        totalCorrect,
        totalWrong,
        totalQuestions
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${quizTitle.replace(/\s+/g, '_')}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filtered = scores.filter(s =>
    (!districtFilter || s.district?.toLowerCase().includes(districtFilter.toLowerCase())) &&
    (!searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
                <Download className="mr-2 h-4 w-4" /> Export PDF
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Export PDF Options</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox id="subjects" checked={showSubjects} onCheckedChange={setShowSubjects} />
                  <label htmlFor="subjects" className="font-medium">Include Subjects (visual block)</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="chapters" checked={showChapters} onCheckedChange={setShowChapters} />
                  <label htmlFor="chapters" className="font-medium">Include Chapters (visual block)</label>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="font-medium">Sort By:</label>
                  <select
                    value={sortByScore}
                    onChange={e => setSortByScore(e.target.value as 'asc' | 'desc')}
                    className="border px-2 py-1 rounded-md bg-gray-50"
                  >
                    <option value="desc">Highest Score</option>
                    <option value="asc">Lowest Score</option>
                  </select>
                </div>
                <div className="p-3 rounded-md bg-blue-50 border text-blue-900">
                  Recommended: Data PDF (autoTable) for long tables. Visual PDF keeps styling but may truncate huge pages.
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button onClick={exportDataPDF} className="bg-blue-600 hover:bg-blue-700 w-full">
                  Download Data PDF
                </Button>
                <Button variant="outline" onClick={exportVisualPDF} className="w-full">
                  Visual (Screenshot) PDF
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
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

      <div ref={pdfRef} className="bg-white rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span className="font-bold text-lg text-blue-800">{platformName}</span>
          <span className="text-gray-500">{currentDate}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-center text-blue-900">{quizTitle || 'Quiz'} Results</h1>
        {showSubjects && (
          <p className="text-center text-gray-700 text-lg">
            📚 <span className="font-semibold">Subjects:</span> {subjects.join(', ')}
          </p>
        )}
        {showChapters && (
          <p className="text-center text-gray-700 text-lg">
            📖 <span className="font-semibold">Chapters:</span> {chapters}
          </p>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 text-lg">No results submitted for this quiz yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full mt-6 text-sm border-collapse">
              <thead className="bg-blue-50">
                <tr>
                  <th className="border border-gray-200 p-3 text-left font-semibold text-blue-900">S.No</th>
                  <th className="border border-gray-200 p-3 text-left font-semibold text-blue-900">Name</th>
                  <th className="border border-gray-200 p-3 text-left font-semibold text-blue-900">Father's Name</th>
                  <th className="border border-gray-200 p-3 text-left font-semibold text-blue-900">District</th>
                  {subjects.map(subj => (
                    <th key={subj} className="border border-gray-200 p-3 text-center font-semibold text-blue-900">
                      {subj} Correct
                    </th>
                  ))}
                  <th className="border border-gray-200 p-3 text-center font-semibold text-blue-900">Total Correct</th>
                  <th className="border border-gray-200 p-3 text-center font-semibold text-blue-900">Total Wrong</th>
                  <th className="border border-gray-200 p-3 text-center font-semibold text-blue-900">Total Questions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, index) => {
                  const { subjectScores, totalCorrect, totalWrong, totalQuestions } = calculateSubjectScores(s);
                  return (
                    <tr key={s.id} className="hover:bg-blue-50">
                      <td className="border border-gray-200 p-3">{index + 1}</td>
                      <td className="border border-gray-200 p-3">{s.name}</td>
                      <td className="border border-gray-200 p-3">{s.fatherName}</td>
                      <td className="border border-gray-200 p-3">{s.district}</td>
                      {subjects.map(subj => (
                        <td key={subj} className="border border-gray-200 p-3 text-center">
                          {subjectScores[subj] || 0}
                        </td>
                      ))}
                      <td className="border border-gray-200 p-3 text-center font-medium">{totalCorrect}</td>
                      <td className="border border-gray-200 p-3 text-center font-medium">{totalWrong}</td>
                      <td className="border border-gray-200 p-3 text-center font-medium">{totalQuestions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading && <p className="text-center text-gray-500 mt-2">Loading...</p>}
    </div>
  );
}
