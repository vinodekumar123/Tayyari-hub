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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addHeader, addFooter, sanitizeText } from '@/utils/pdf-style-helper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Download,
  Printer,
  ArrowLeft,
  Search,
  Filter,
  TrendingUp,
  Users,
  Award,
  BookOpen,
  FileSpreadsheet,
  FileIcon,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// --- Interfaces ---

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

interface CalculatedScore {
  score: Score;
  subjectScores: Record<string, number>;
  totalCorrect: number;
  totalWrong: number;
  totalQuestions: number;
  percentage: number;
}

// --- Main Component ---

function QuizStudentScoresContent() {
  const router = useRouter();
  const params = useSearchParams();
  const quizId = params.get('id');

  // --- State ---
  const [quizTitle, setQuizTitle] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);

  const [allScores, setAllScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'name_asc'>('score_desc');

  // Export Options
  const [showSubjectsInExport, setShowSubjectsInExport] = useState(true);
  const [showStatsInExport, setShowStatsInExport] = useState(true);

  // --- Helpers ---

  const extractNames = (raw: any): string[] => {
    if (Array.isArray(raw)) {
      return raw.map((s: any) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean);
    }
    if (raw && typeof raw === 'object' && raw.name) return [raw.name];
    if (typeof raw === 'string') return [raw];
    return [];
  };

  const calculateStats = useCallback((score: Score): CalculatedScore => {
    const subjectScores: Record<string, number> = {};
    subjects.forEach(subj => (subjectScores[subj] = 0));

    let correct = 0;

    quizQuestions.forEach(q => {
      const isCorrect = score.answers[q.id] === q.correctAnswer;
      if (isCorrect) {
        correct++;
        if (q.subject) {
          subjectScores[q.subject] = (subjectScores[q.subject] || 0) + 1;
        }
      }
    });

    const totalQuestions = quizQuestions.length;
    const totalWrong = totalQuestions - correct;
    const percentage = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;

    return {
      score,
      subjectScores,
      totalCorrect: correct,
      totalWrong,
      totalQuestions,
      percentage
    };
  }, [quizQuestions, subjects]);

  // --- Data Fetching ---

  const fetchData = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);

    try {
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (!quizDoc.exists()) {
        console.error("Quiz not found");
        setLoading(false);
        return;
      }

      const data = quizDoc.data() as QuizData;
      setQuizTitle(data.title || 'Untitled Quiz');
      const extractedSubjects = extractNames(data.subjects || (data as any).subject);
      setSubjects(extractedSubjects);
      setChapters(extractNames(data.chapters || (data as any).chapter).join(', '));

      const qList = data.selectedQuestions || [];
      setQuizQuestions(qList);

      if (qList.length === 0) {
        setAllScores([]);
        setLoading(false);
        return;
      }

      const usersSnap = await getDocs(collection(db, 'users'));
      const promises = usersSnap.docs.map(async (uDoc) => {
        const uid = uDoc.id;
        const resRef = doc(db, 'users', uid, 'quizAttempts', quizId, 'results', quizId);
        try {
          const resSnap = await getDoc(resRef);
          if (resSnap.exists()) {
            const uData = uDoc.data();
            const rData = resSnap.data();
            return {
              id: uid,
              name: uData.fullName || 'Unknown Student',
              fatherName: uData.fatherName || '-',
              district: uData.district || '-',
              answers: rData.answers || {}
            } as Score;
          }
        } catch (e) {
          return null;
        }
        return null;
      });

      const results = (await Promise.all(promises)).filter((s): s is Score => s !== null);
      setAllScores(results);

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Derived State ---

  const processedData = useMemo(() => {
    let data = allScores.map(score => calculateStats(score));

    if (searchTerm) data = data.filter(d => d.score.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (districtFilter) data = data.filter(d => d.score.district.toLowerCase().includes(districtFilter.toLowerCase()));

    data.sort((a, b) => {
      if (sortBy === 'score_desc') return b.totalCorrect - a.totalCorrect;
      if (sortBy === 'score_asc') return a.totalCorrect - b.totalCorrect;
      if (sortBy === 'name_asc') return a.score.name.localeCompare(b.score.name);
      return 0;
    });

    return data;
  }, [allScores, searchTerm, districtFilter, sortBy, calculateStats]);

  const stats = useMemo(() => {
    if (processedData.length === 0) return { avg: 0, highest: 0, total: 0 };
    const total = processedData.length;
    const sum = processedData.reduce((acc, curr) => acc + curr.percentage, 0);
    const highest = Math.max(...processedData.map(d => d.percentage));
    return {
      total,
      avg: Math.round(sum / total),
      highest: Math.round(highest)
    };
  }, [processedData]);

  // --- Export PDF ---

  const handleExportPDF = async () => {
    if (processedData.length === 0) return;
    setGeneratingPDF(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // --- Header ---
      const subtitle = `Total Students: ${stats.total} | Average: ${stats.avg}% | Highest: ${stats.highest}%`;
      const currentY = addHeader(doc, quizTitle, subtitle);

      const head = [
        [
          { content: '#', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'Rank', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'Student Name', rowSpan: 2, styles: { valign: 'middle' as const } },
          { content: "Father's Name", rowSpan: 2, styles: { valign: 'middle' as const } },
          { content: 'District', rowSpan: 2, styles: { valign: 'middle' as const } },
          ...(showSubjectsInExport ? [{ content: 'Subject-wise Breakdown', colSpan: subjects.length, styles: { halign: 'center' as const } }] : []),
          { content: 'Performance (MCQs)', colSpan: 4, styles: { halign: 'center' as const } }
        ],
        [
          ...(showSubjectsInExport ? subjects.map(s => ({ content: s, styles: { halign: 'center' as const, fontSize: 8 } })) : []),
          { content: 'Correct', styles: { halign: 'center' as const, textColor: [22, 163, 74] as [number, number, number] } },
          { content: 'Wrong', styles: { halign: 'center' as const, textColor: [220, 38, 38] as [number, number, number] } },
          { content: 'Total', styles: { halign: 'center' as const } },
          { content: 'Score %', styles: { halign: 'center' as const, fontStyle: 'bold' } }
        ]
      ];

      const body = processedData.map((d, index) => {
        const row: any[] = [
          index + 1,
          index + 1,
          d.score.name,
          d.score.fatherName || '-',
          d.score.district
        ];

        if (showSubjectsInExport) {
          subjects.forEach(s => row.push(d.subjectScores[s] || 0));
        }

        row.push(d.totalCorrect);
        row.push(d.totalWrong);
        row.push(d.totalQuestions);
        row.push(`${d.percentage.toFixed(1)}%`);
        return row;
      });

      (autoTable as any)(doc, {
        head: head,
        body: body,
        startY: currentY + 5,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          textColor: [30, 41, 59],
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [30, 58, 138], // Dark Blue
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          lineColor: [30, 58, 138],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' as const }, // S.No
          1: { cellWidth: 10, halign: 'center' as const }, // Rank
          2: { cellWidth: 35 }, // Name
          3: { cellWidth: 35 }, // Father Name
          4: { cellWidth: 25 }  // District
        }
      });

      // --- Footer ---
      const pageCount = doc.getNumberOfPages();
      addFooter(doc, pageCount);

      doc.save(`${quizTitle.replace(/[^a-z0-9]/gi, '_')}_Result_Report.pdf`);
    } catch (err) {
      console.error(err);
      alert("PDF Export failed");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleExportCSV = () => {
    if (processedData.length === 0) return;
    const headers = ['Rank', 'Name', "Father's Name", 'District', ...subjects, 'Total Correct', 'Total Wrong', 'Total Questions', 'Percentage'];
    const rows = processedData.map((d, i) => {
      return [
        i + 1, d.score.name, d.score.fatherName, d.score.district,
        ...subjects.map(s => d.subjectScores[s] || 0),
        d.totalCorrect, d.totalWrong, d.totalQuestions, d.percentage.toFixed(1) + '%'
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quizTitle}_Results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">

      {/* Print Styles: Restore clean modern print view */}
      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 5mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          /* Hide non-printable elements */
          nav, aside, header, footer, .sidebar, .no-print, button, .filters {
            display: none !important;
          }

          /* Main content full width */
          main, div { 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            box-shadow: none !important;
            overflow: visible !important;
          }

          /* Force Table Visibility */
          table { width: 100% !important; border-collapse: collapse !important; font-size: 10pt; }
          th { background-color: #f1f5f9 !important; color: black !important; border: 1px solid #ddd !important; }
          td { border: 1px solid #ddd !important; color: black !important; }
          tr { break-inside: avoid; }
        }
      `}</style>

      {/* Top Navbar */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/admin/results')} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                {quizTitle || 'Loading...'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                <BookOpen className="w-3 h-3" />
                {subjects.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-2"> <Printer className="w-4 h-4" /> Print </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"> <Download className="w-4 h-4" /> Export </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Export Data</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Button variant="outline" onClick={handleExportPDF} disabled={generatingPDF} className="flex flex-col h-24 gap-2"> <FileIcon className="w-8 h-8 text-red-500" /> PDF </Button>
                  <Button variant="outline" onClick={handleExportCSV} className="flex flex-col h-24 gap-2"> <FileSpreadsheet className="w-8 h-8 text-green-600" /> CSV </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">

        {/* Stats Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
            <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-600">Total Students</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-white dark:from-slate-900 dark:to-slate-800">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Average Score</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.avg}%</div></CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50 to-white dark:from-slate-900 dark:to-slate-800">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-purple-600">Highest Score</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.highest}%</div></CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 no-print filters">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <div className="relative w-64">
            <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input placeholder="Filter District..." value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} className="pl-10" />
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /></div>
          ) : processedData.length === 0 ? (
            <div className="p-16 text-center text-slate-500">No Results Found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-left font-semibold text-slate-600 w-12">#</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Student Name</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">Father&apos;s Name</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-600">District</th>
                    {subjects.map(s => (
                      <th key={s} className="px-4 py-4 text-center font-semibold text-slate-600 text-xs uppercase tracking-wider">{s.slice(0, 4)}</th>
                    ))}
                    <th className="px-6 py-4 text-center font-semibold text-green-600 w-24">Correct</th>
                    <th className="px-6 py-4 text-center font-semibold text-red-600 w-24">Wrong</th>
                    <th className="px-6 py-4 text-center font-semibold text-blue-600 w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {processedData.map((d, i) => (
                    <tr key={d.score.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">{i + 1}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{d.score.name}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{d.score.fatherName}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-normal border-slate-200">{d.score.district}</Badge>
                      </td>
                      {subjects.map(s => (
                        <td key={s} className="px-4 py-4 text-center font-mono text-slate-600 border-l border-slate-100 first:border-l-0">{d.subjectScores[s] || 0}</td>
                      ))}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-xs">{d.totalCorrect}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-red-600 font-medium">{d.totalWrong}</td>
                      <td className="px-6 py-4 text-center text-slate-600">{d.totalQuestions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default function QuizStudentScores() {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <QuizStudentScoresContent />
    </React.Suspense>
  );
}
