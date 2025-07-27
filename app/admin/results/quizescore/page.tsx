'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  limit,
  startAfter
} from 'firebase/firestore';
import { db } from '@/app/firebase';
import { Card, CardContent } from '@/components/ui/card';
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

export default function QuizStudentScores() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState('');
  const [subjects, setSubjects] = useState('');
  const [chapters, setChapters] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const fetchedUserIdsRef = useRef<Set<string>>(new Set());
  const [showSubjects, setShowSubjects] = useState(true);
  const [showChapters, setShowChapters] = useState(true);
  const [sortByScore, setSortByScore] = useState<'desc' | 'asc'>('desc');
  const [districtFilter, setDistrictFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const params = useSearchParams();
  const router = useRouter();
  const quizId = params.get('id');
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const platformName = "Tayyari Hub";
  const currentDate = new Date().toLocaleDateString();

  const fetchMetadata = async () => {
    if (!quizId) return;
    const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
    if (!quizDoc.exists()) return;
    const data = quizDoc.data();
    setQuizTitle(data.title || 'Untitled');

    const extractNames = (raw: any) => {
      if (Array.isArray(raw)) return raw.map((s: any) => typeof s === 'string' ? s : s?.name || '[Invalid]').join(', ');
      if (typeof raw === 'object' && raw?.name) return raw.name;
      return typeof raw === 'string' ? raw : 'N/A';
    };

    setSubjects(extractNames(data.subjects || data.subject));
    setChapters(extractNames(data.chapters || data.chapter));
  };

  const fetchScores = async () => {
    if (!quizId) return;
    const usersQuery = query(collection(db, 'users'), limit(10), ...(lastVisible ? [startAfter(lastVisible)] : []));
    const usersSnap = await getDocs(usersQuery);
    const scoreList: any[] = [];
    const newFetchedIds = new Set<string>();

    const lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
    if (!lastDoc) setHasMore(false);
    else setLastVisible(lastDoc);

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      if (fetchedUserIdsRef.current.has(userId) || newFetchedIds.has(userId)) continue;

      const resultRef = doc(db, 'users', userId, 'quizAttempts', quizId, 'results', quizId);
      const resultSnap = await getDoc(resultRef);
      if (resultSnap.exists()) {
        const userData = userDoc.data();
        newFetchedIds.add(userId);
        scoreList.push({
          id: userId,
          name: userData.fullName || 'Unknown',
          fatherName: userData.fatherName || '-',
          district: userData.district || '-',
          ...resultSnap.data(),
        });
      }
    }

    newFetchedIds.forEach(id => fetchedUserIdsRef.current.add(id));
    setScores(prev => {
      const merged = [...prev, ...scoreList.filter(s => !prev.find(p => p.id === s.id))];
      return merged.sort((a, b) => sortByScore === 'desc' ? b.score - a.score : a.score - b.score);
    });

    setLoading(false);
    setInitialLoading(false);
  };

  const handleObserver = useCallback((entries: any[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading) {
      setLoading(true);
      fetchScores();
    }
  }, [hasMore, loading]);

  useEffect(() => {
    if (loaderRef.current) {
      const option = { root: null, rootMargin: '20px', threshold: 1.0 };
      const observer = new IntersectionObserver(handleObserver, option);
      observer.observe(loaderRef.current);
      return () => observer.disconnect();
    }
  }, [handleObserver]);

  useEffect(() => {
    fetchMetadata();
    fetchScores();
  }, [quizId, sortByScore]);

  const exportToPDF = async () => {
    if (!pdfRef.current) return;

    const html2pdf = (await import('html2pdf.js')).default;

    html2pdf(pdfRef.current, {
      margin: 10,
      filename: `${quizTitle.replace(/\s+/g, '_')}_Results.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    });
  };

  const filtered = scores.filter(s =>
    (!districtFilter || s.district?.toLowerCase().includes(districtFilter.toLowerCase())) &&
    (!searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-8 min-h-screen bg-gradient-to-b from-white to-blue-50">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push('/admin/results')}>
          ← Back to Results
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Export PDF</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Options</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="subjects" checked={showSubjects} onCheckedChange={setShowSubjects} />
                <label htmlFor="subjects" className="text-sm">Include Subjects</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="chapters" checked={showChapters} onCheckedChange={setShowChapters} />
                <label htmlFor="chapters" className="text-sm">Include Chapters</label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm">Sort By:</label>
                <select value={sortByScore} onChange={e => setSortByScore(e.target.value as 'asc' | 'desc')} className="border px-2 py-1 rounded">
                  <option value="desc">Highest Score</option>
                  <option value="asc">Lowest Score</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={exportToPDF}>Download</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-4">
        <Input placeholder="Search by student name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Input placeholder="Filter by district..." value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} />
      </div>

      <div ref={pdfRef} className="bg-white rounded-xl p-6 shadow-lg space-y-6">
        <div className="flex justify-between text-sm text-gray-600">
          <span className="font-bold">{platformName}</span>
          <span>{currentDate}</span>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-800">{quizTitle || 'Quiz'} Results</h1>
        {showSubjects && <p className="text-center text-gray-700">📚 Subjects: {subjects}</p>}
        {showChapters && <p className="text-center text-gray-700">📖 Chapters: {chapters}</p>}

        {initialLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500">No results submitted for this quiz yet.</p>
        ) : (
          <table className="w-full mt-6 text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 text-left">Name</th>
                <th className="border p-2 text-left">Father's Name</th>
                <th className="border p-2 text-left">District</th>
                <th className="border p-2 text-center">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="border p-2">{s.name}</td>
                  <td className="border p-2">{s.fatherName}</td>
                  <td className="border p-2">{s.district}</td>
                  <td className="border p-2 text-center font-medium">{s.score} / {s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div ref={loaderRef} className="h-10 mt-4" />
      {loading && !initialLoading && <p className="text-center text-gray-500 mt-2">Loading more...</p>}
    </div>
  );
}
