// npm install react-chartjs-2 chart.js

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  getFirestore,
  doc,
  getDoc,
} from 'firebase/firestore';
import { app } from '@/app/firebase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
// Chart imports
import {
  Line,
  Bar,
} from 'react-chartjs-2';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

// Section keys for printing
const PRINT_SECTIONS = [
  { key: 'summary', label: 'Summary Cards (Best/Worst Test, Consistency)' },
  { key: 'subjectCharts', label: 'Subject Charts' },
  { key: 'subjectRemarks', label: 'Subject-wise Remarks' },
  { key: 'testCharts', label: 'Test Charts' },
  { key: 'testRemarks', label: 'Test-wise Remarks' },
  { key: 'allTests', label: 'All Tests Table' },
];

export default function ForAdminStudentResults() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [analytics, setAnalytics] = useState<{ total: number; scored: number; average: number }>({
    total: 0,
    scored: 0,
    average: 0,
  });
  const [subjectAnalytics, setSubjectAnalytics] = useState<
    { subject: string; attempted: number; skipped: number; correct: number; wrong: number; accuracy: number }[]
  >([]);
  const [progressPoints, setProgressPoints] = useState<number[]>([]);
  const [printSelection, setPrintSelection] = useState<string[]>(PRINT_SECTIONS.map(s => s.key));

  // Chart refs for exporting images
  const subjectBarRef = useRef<any>();
  const subjectLineRef = useRef<any>();
  const testBarRef = useRef<any>();

  const router = useRouter();
  const db = getFirestore(app);
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');

  useEffect(() => {
    const fetchStudentResults = async () => {
      if (!studentId) return;

      setLoading(true);
      setResults([]);
      setSubjectAnalytics([]);
      setProgressPoints([]);
      setAnalytics({ total: 0, scored: 0, average: 0 });

      try {
        const userSnap = await getDoc(doc(db, 'users', studentId));
        if (userSnap.exists()) {
          setStudentName(userSnap.data().fullName || 'Unknown');
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }

      const allResults: any[] = [];
      let totalCorrectAcrossAll = 0;
      let totalQuestionsAcrossAll = 0;

      const subjectMap: Record<
        string,
        { attempted: number; skipped: number; correct: number; wrong: number; totalQuestionsSum: number }
      > = {};
      const progressArray: { ts: number; accuracy: number }[] = [];

      const paths = [
        { attemptPath: 'quizAttempts', quizSource: 'quizzes', isMock: false },
        { attemptPath: 'mock-quizAttempts', quizSource: 'mock-quizzes', isMock: true },
      ];

      const getQId = (q: any, idx = 0) => q?.id ?? q?._id ?? q?.questionId ?? q?.qid ?? (typeof q === 'string' ? q : `idx_${idx}`);
      const getQSubject = (q: any, quizMeta: any) => {
        if (!q) return 'Unspecified';
        if (q.subject) return typeof q.subject === 'string' ? q.subject : q.subject?.name ?? 'Unspecified';
        if (q.subjectName) return q.subjectName;
        if (q.topic) return typeof q.topic === 'string' ? q.topic : q.topic?.name ?? 'Unspecified';
        if (quizMeta?.questionFilters?.subjects?.length) return quizMeta.questionFilters.subjects.join(', ');
        if (quizMeta?.subjects?.length) return Array.isArray(quizMeta.subjects) ? quizMeta.subjects.map((s:any)=>(typeof s==='string'?s:s?.name||'Unknown')).join(', ') : 'Unspecified';
        if (quizMeta?.subject?.name) return quizMeta.subject.name;
        if (typeof quizMeta?.subject === 'string') return quizMeta.subject;
        return 'Unspecified';
      };
      const getQCorrectAnswer = (q: any) => q?.correctAnswer ?? q?.correctOption ?? q?.answer ?? q?.solution ?? q?.correct ?? null;

      const answersEqual = (a: any, b: any) => {
        if (a === undefined) a = null;
        if (b === undefined) b = null;
        if ((typeof a === 'string' || typeof a === 'number') && (typeof b === 'string' || typeof b === 'number')) {
          const na = Number(a);
          const nb = Number(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
        }
        try {
          return JSON.stringify(a) === JSON.stringify(b);
        } catch {
          return a === b;
        }
      };

      for (const { attemptPath, quizSource, isMock } of paths) {
        try {
          const attemptsRef = collection(db, 'users', studentId, attemptPath);
          const attemptsSnap = await getDocs(attemptsRef);

          await Promise.all(
            attemptsSnap.docs.map(async (attemptDoc) => {
              const quizId = attemptDoc.id;

              const [resultSnap, quizSnap] = await Promise.all([
                getDoc(doc(db, 'users', studentId, attemptPath, quizId, 'results', quizId)),
                getDoc(
                  quizSource === 'mock-quizzes'
                    ? doc(db, 'users', studentId, 'mock-quizzes', quizId)
                    : doc(db, 'quizzes', quizId)
                ),
              ]);

              if (!resultSnap.exists()) return;
              const resultData: any = resultSnap.data() || {};
              const quizMeta: any = quizSnap.exists() ? quizSnap.data() : {};

              let selectedQuestions: any[] = [];
              if (Array.isArray(quizMeta.selectedQuestions) && quizMeta.selectedQuestions.length) {
                selectedQuestions = quizMeta.selectedQuestions;
              } else if (Array.isArray(quizMeta.questions) && quizMeta.questions.length) {
                selectedQuestions = quizMeta.questions;
              } else if (Array.isArray(resultData.selectedQuestions) && resultData.selectedQuestions.length) {
                selectedQuestions = resultData.selectedQuestions;
              }

              const rawAnswers = resultData.answers ?? resultData.responses ?? resultData.perQuestion ?? resultData.attempts ?? resultData.answerMap;
              const answersMap: Record<string, any> = {};

              if (rawAnswers) {
                if (!Array.isArray(rawAnswers) && typeof rawAnswers === 'object') {
                  Object.entries(rawAnswers).forEach(([k, v]) => {
                    if (v && typeof v === 'object' && (v.selected !== undefined || v.answer !== undefined || v.value !== undefined || v.response !== undefined)) {
                      answersMap[k] = (v as any).selected ?? (v as any).answer ?? (v as any).value ?? (v as any).response ?? null;
                    } else {
                      answersMap[k] = v;
                    }
                  });
                } else if (Array.isArray(rawAnswers)) {
                  rawAnswers.forEach((entry: any, idx: number) => {
                    const qid = entry?.questionId || entry?.id || entry?.qid || entry?.question || `idx_${idx}`;
                    const val = entry?.selected ?? entry?.answer ?? entry?.value ?? entry?.response ?? null;
                    if (qid) answersMap[qid] = val;
                  });
                }
              }

              if (Array.isArray(selectedQuestions) && selectedQuestions.length > 0) {
                selectedQuestions.forEach((q: any, idx: number) => {
                  const qid = getQId(q, idx);
                  const subj = getQSubject(q, quizMeta);
                  const correctAns = getQCorrectAnswer(q);

                  if (!subjectMap[subj]) subjectMap[subj] = { attempted: 0, skipped: 0, correct: 0, wrong: 0, totalQuestionsSum: 0 };

                  subjectMap[subj].totalQuestionsSum += 1;

                  const studentAns = answersMap[qid];

                  const answered =
                    !(studentAns === undefined || studentAns === null || (typeof studentAns === 'string' && studentAns.trim() === ''));

                  if (answered) {
                    subjectMap[subj].attempted += 1;
                    const isCorrect = correctAns !== null ? answersEqual(studentAns, correctAns) : false;
                    if (isCorrect) subjectMap[subj].correct += 1;
                    else subjectMap[subj].wrong += 1;
                  } else {
                    subjectMap[subj].skipped += 1;
                  }
                });
              } else {
                let overallSubject = 'Unspecified';
                if (quizMeta?.questionFilters?.subjects?.length) {
                  overallSubject = quizMeta.questionFilters.subjects.join(', ');
                } else if (quizMeta?.subjects?.length) {
                  overallSubject = Array.isArray(quizMeta.subjects) ? quizMeta.subjects.map((s:any)=>(typeof s==='string'?s:s?.name||'Unknown')).join(', ') : 'Unspecified';
                } else if (quizMeta?.subject?.name) {
                  overallSubject = quizMeta.subject.name;
                } else if (typeof quizMeta?.subject === 'string') {
                  overallSubject = quizMeta.subject;
                }

                if (!subjectMap[overallSubject]) subjectMap[overallSubject] = { attempted: 0, skipped: 0, correct: 0, wrong: 0, totalQuestionsSum: 0 };

                const answerKeys = Object.keys(answersMap);
                const assumedTotal = quizMeta?.questions?.length ?? quizMeta?.selectedQuestions?.length ?? resultData.total ?? 0;

                if (answerKeys.length > 0) {
                  subjectMap[overallSubject].attempted += answerKeys.length;
                  subjectMap[overallSubject].skipped += Math.max(0, (assumedTotal || 0) - answerKeys.length);
                  subjectMap[overallSubject].totalQuestionsSum += assumedTotal || answerKeys.length;

                  const overallCorrect = typeof resultData.correct === 'number' ? resultData.correct : typeof resultData.score === 'number' ? resultData.score : null;
                  if (overallCorrect !== null) {
                    const correctCount = Math.min(overallCorrect, answerKeys.length);
                    const wrongCount = Math.max(0, answerKeys.length - correctCount);
                    subjectMap[overallSubject].correct += correctCount;
                    subjectMap[overallSubject].wrong += wrongCount;
                  } else {
                    subjectMap[overallSubject].wrong += answerKeys.length;
                  }
                } else {
                  const assumedCorrect = typeof resultData.correct === 'number' ? resultData.correct : typeof resultData.score === 'number' ? resultData.score : 0;
                  const assumedAttempted = typeof resultData.attempted === 'number' ? resultData.attempted : (assumedTotal || 0);
                  const wrongCount = Math.max(0, assumedAttempted - assumedCorrect);

                  subjectMap[overallSubject].attempted += assumedAttempted;
                  subjectMap[overallSubject].correct += assumedCorrect;
                  subjectMap[overallSubject].wrong += wrongCount;
                  subjectMap[overallSubject].skipped += Math.max(0, (assumedTotal || assumedAttempted) - assumedAttempted);
                  subjectMap[overallSubject].totalQuestionsSum += assumedTotal || assumedAttempted;
                }
              }

              let correctCountOverall = 0;
              let countedQuestionsOverall = 0;

              if (Array.isArray(selectedQuestions) && selectedQuestions.length > 0) {
                selectedQuestions.forEach((q: any, idx: number) => {
                  const qid = getQId(q, idx);
                  const correctAns = getQCorrectAnswer(q);
                  const studentAns = answersMap[qid];
                  const answered = !(studentAns === undefined || studentAns === null || (typeof studentAns === 'string' && studentAns.trim() === ''));
                  if (answered) {
                    countedQuestionsOverall += 1;
                    if (correctAns !== null && answersEqual(studentAns, correctAns)) correctCountOverall += 1;
                  }
                });
              } else {
                if (typeof resultData.correct === 'number') {
                  correctCountOverall = resultData.correct;
                } else if (typeof resultData.score === 'number') {
                  correctCountOverall = resultData.score;
                }
                countedQuestionsOverall = resultData.total ?? quizMeta?.questions?.length ?? quizMeta?.selectedQuestions?.length ?? 0;
              }

              const accuracy = countedQuestionsOverall > 0 ? (correctCountOverall / countedQuestionsOverall) * 100 : 0;

              const ts =
                resultData.timestamp?.seconds
                  ? resultData.timestamp.seconds * 1000
                  : typeof resultData.timestamp === 'number'
                  ? resultData.timestamp
                  : resultData.timestamp || Date.now();

              allResults.push({
                id: quizId,
                ...resultData,
                title: quizMeta.title || 'Untitled Quiz',
                subject:
                  Array.isArray(selectedQuestions) && selectedQuestions.length
                    ? selectedQuestions.map((q:any)=>(getQSubject(q, quizMeta))).join(', ')
                    : (quizMeta.subject || 'Unspecified'),
                chapter: quizMeta.chapter?.name || quizMeta.chapter || 'N/A',
                course: quizMeta.course?.name || quizMeta.course || 'Unknown',
                isMock,
                timestamp: ts,
                currentTotal: quizMeta?.questions?.length ?? quizMeta?.selectedQuestions?.length ?? resultData.total ?? 0,
                correct: correctCountOverall,
                countedQuestions: countedQuestionsOverall,
                accuracy: parseFloat(accuracy.toFixed(2)),
                displayedScore: `${correctCountOverall} / ${countedQuestionsOverall || (quizMeta?.questions?.length ?? quizMeta?.selectedQuestions?.length) || 'N/A'}`,
                originalScore: resultData.score ?? null,
                originalTotal: resultData.total ?? null,
              });

              totalCorrectAcrossAll += correctCountOverall;
              totalQuestionsAcrossAll += countedQuestionsOverall > 0 ? countedQuestionsOverall : (quizMeta?.questions?.length ?? quizMeta?.selectedQuestions?.length ?? 0);

              progressArray.push({ ts, accuracy: parseFloat(accuracy.toFixed(2)) });
            })
          );
        } catch (err) {
          console.error('Error reading attempts for path', attemptPath, err);
        }
      }

      allResults.sort((a, b) => b.timestamp - a.timestamp);
      progressArray.sort((a, b) => a.ts - b.ts);
      const progressValues = progressArray.map((p) => p.accuracy);

      const subjectsArr = Object.entries(subjectMap).map(([subject, v]) => {
        const attempted = v.attempted || 0;
        const skipped = v.skipped || 0;
        const correct = v.correct || 0;
        const wrong = v.wrong || 0;
        const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
        return {
          subject,
          attempted,
          skipped,
          correct,
          wrong,
          accuracy,
        };
      });

      setResults(allResults);
      setProgressPoints(progressValues);
      setSubjectAnalytics(subjectsArr);

      setAnalytics({
        total: totalQuestionsAcrossAll,
        scored: totalCorrectAcrossAll,
        average: totalQuestionsAcrossAll > 0 ? parseFloat(((totalCorrectAcrossAll / totalQuestionsAcrossAll) * 100).toFixed(2)) : 0,
      });

      setLoading(false);
    };

    fetchStudentResults();
  }, [studentId]);

  // Premium Analytics
  const bestTest = useMemo(() => results.length ? results.reduce((a, b) => a.accuracy > b.accuracy ? a : b) : null, [results]);
  const weakestTest = useMemo(() => results.length ? results.reduce((a, b) => a.accuracy < b.accuracy ? a : b) : null, [results]);
  const bestSubject = useMemo(() => subjectAnalytics.length ? subjectAnalytics.reduce((a, b) => a.accuracy > b.accuracy ? a : b) : null, [subjectAnalytics]);
  const weakestSubject = useMemo(() => subjectAnalytics.length ? subjectAnalytics.reduce((a, b) => a.accuracy < b.accuracy ? a : b) : null, [subjectAnalytics]);
  const subjectOverTimeData = useMemo(() => {
    const map = {};
    results.forEach(r => {
      const date = r.timestamp ? format(new Date(r.timestamp), 'dd MMM') : '';
      (r.subject?.split(',') || ['Unspecified']).forEach(subject => {
        subject = subject.trim();
        if (!map[subject]) map[subject] = [];
        map[subject].push({ date, accuracy: r.accuracy });
      });
    });
    return map;
  }, [results]);
  const consistency = useMemo(() => {
    if (!results.length) return 0;
    const mean = results.reduce((a, b) => a + b.accuracy, 0) / results.length;
    const variance = results.reduce((a, b) => a + Math.pow(b.accuracy - mean, 2), 0) / results.length;
    return Math.round(Math.sqrt(variance) * 100) / 100;
  }, [results]);
  const improvement = useMemo(() => {
    if (progressPoints.length < 2) return 0;
    return Math.round(progressPoints[progressPoints.length - 1] - progressPoints[0]);
  }, [progressPoints]);
  function getTestRemark(test) {
    if (test.accuracy >= 90) return "🌟 Outstanding!";
    if (test.accuracy >= 75) return "👏 Good job!";
    if (test.accuracy >= 60) return "🙂 Fair, some improvement needed.";
    if (test.accuracy >= 40) return "⚠️ Needs improvement.";
    return "🚨 Weak attempt, review recommended.";
  }
  function getSubjectRemark(subj) {
    if (subj.accuracy >= 90) return "🌟 Mastery!";
    if (subj.accuracy >= 75) return "👍 Strong area.";
    if (subj.accuracy >= 60) return "🙂 Moderate.";
    if (subj.accuracy >= 40) return "⚠️ Weak spot.";
    return "🚨 Needs urgent focus.";
  }
  const subjectChartData = useMemo(() => ({
    labels: subjectAnalytics.map(s => s.subject),
    datasets: [{
      label: 'Accuracy (%)',
      data: subjectAnalytics.map(s => s.accuracy),
      backgroundColor: subjectAnalytics.map((s,i)=>`rgba(${50+i*20},${100+i*10},${200-i*10},0.7)`),
      borderWidth: 1,
    }]
  }), [subjectAnalytics]);
  const testBarData = useMemo(() => ({
    labels: results.map(r => r.title),
    datasets: [{
      label: 'Test Accuracy (%)',
      data: results.map(r => r.accuracy),
      backgroundColor: results.map((r,i)=>`rgba(59,130,246,${0.6+0.1*i})`)
    }]
  }), [results]);
  const subjectTrendLineData = useMemo(() => {
    const subjects = Object.keys(subjectOverTimeData);
    return {
      labels: results.map(r => r.timestamp ? format(new Date(r.timestamp), 'dd MMM') : ''),
      datasets: subjects.map((subject, idx) => ({
        label: subject,
        data: subjectOverTimeData[subject].map(d => d.accuracy),
        fill: false,
        borderColor: `hsl(${idx * 60}, 60%, 55%)`,
        backgroundColor: `hsl(${idx * 60}, 75%, 70%)`,
        tension: 0.4
      }))
    };
  }, [subjectOverTimeData, results]);
  const tableRows = useMemo(() => {
    return results.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.timestamp ? new Date(r.timestamp) : null,
      totalQuestions: r.countedQuestions && r.countedQuestions > 0 ? r.countedQuestions : r.currentTotal || 0,
      correct: r.correct || 0,
      accuracy: r.accuracy || 0,
      type: r.isMock ? 'By Own' : 'By Admin',
      subject: r.subject,
    }));
  }, [results]);

  // Print function with charts
  function escapeHtml(text: any) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  async function printSelectedSectionsWithCharts(sections: string[]) {
    // Get chart images as Data URLs
    let subjectBarImg = '';
    let subjectLineImg = '';
    let testBarImg = '';
    // Wait for chart refs to be loaded
    if (sections.includes('subjectCharts') && subjectBarRef.current) {
      subjectBarImg = subjectBarRef.current.toBase64Image();
    }
    if (sections.includes('subjectCharts') && subjectLineRef.current) {
      subjectLineImg = subjectLineRef.current.toBase64Image();
    }
    if (sections.includes('testCharts') && testBarRef.current) {
      testBarImg = testBarRef.current.toBase64Image();
    }

    const printableTitle = `${studentName || 'Student'} - Analytics`;
    const style = `
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 24px; color:#0f172a }
      h2 { font-size: 22px; margin-top: 30px }
      .card { border-radius: 12px; border: 1px solid #e6edf3; padding: 18px; margin-bottom: 18px; box-shadow: 0 6px 18px rgba(2,6,23,0.06) }
      table { width:100%; border-collapse: collapse; margin-top:12px; }
      th, td { padding:10px 8px; border-bottom:1px solid #f1f5f9; text-align:left; font-size:13px }
      th { background: #f8fafc; color:#0f172a; font-weight:600 }
      .big-score { font-size:28px; font-weight:800; color:#1e40af }
      .remark { font-size:16px; margin-top:6px }
      img.chart { max-width: 100%; margin: 18px 0; border-radius: 12px; box-shadow: 0 4px 14px rgba(2,6,23,0.11); }
      @media print {
        button { display:none; }
        body { -webkit-print-color-adjust: exact; }
      }
    `;
    let html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(printableTitle)}</title>
          <style>${style}</style>
        </head>
        <body>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:24px;font-weight:700;">${escapeHtml(printableTitle)}</div>
              <div style="color:#475569;font-size:15px;">
                Overall: ${analytics.scored} / ${analytics.total} (${analytics.average}%)
              </div>
              <div style="margin-top:8px;font-size:12px;color:#64748b">Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</div>
            </div>
            <div style="text-align:right">
              <div class="big-score">${analytics.average}%</div>
              <div style="font-size:12px;color:#64748b">Average Accuracy</div>
            </div>
          </div>
    `;

    // Print summary cards
    if (sections.includes('summary')) {
      html += `<h2>Summary Cards</h2>
        <div class="card">
          <div><strong>Best Test:</strong> ${bestTest ? escapeHtml(bestTest.title) : 'N/A'} (${bestTest ? bestTest.accuracy+'%' : ''}) <span class="remark">${bestTest ? getTestRemark(bestTest) : ''}</span></div>
          <div><strong>Weakest Test:</strong> ${weakestTest ? escapeHtml(weakestTest.title) : 'N/A'} (${weakestTest ? weakestTest.accuracy+'%' : ''}) <span class="remark">${weakestTest ? getTestRemark(weakestTest) : ''}</span></div>
          <div><strong>Consistency:</strong> ${consistency}</div>
          <div><strong>Improvement:</strong> ${improvement >= 0 ? '↑' : '↓'} ${Math.abs(improvement)}%</div>
        </div>
      `;
    }
    // Print subject charts
    if (sections.includes('subjectCharts')) {
      html += `<h2>Subject-wise Accuracy Chart</h2>
        <div class="card">
          ${subjectBarImg ? `<img src="${subjectBarImg}" class="chart" alt="Subject Accuracy Bar Chart"/>` : '<div>[Chart not available]</div>'}
        </div>
        <h2>Subject Trend Over Time</h2>
        <div class="card">
          ${subjectLineImg ? `<img src="${subjectLineImg}" class="chart" alt="Subject Trend Line Chart"/>` : '<div>[Chart not available]</div>'}
        </div>`;
    }
    // Print subject remarks
    if (sections.includes('subjectRemarks')) {
      html += `<h2>Subject-wise Remarks</h2><div class="card"><table>
        <thead>
          <tr>
            <th>Subject</th>
            <th style="text-align:right">Accuracy</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${subjectAnalytics.map(subj => `
            <tr>
              <td>${escapeHtml(subj.subject)}</td>
              <td style="text-align:right">${subj.accuracy}%</td>
              <td class="remark">${getSubjectRemark(subj)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>`;
    }
    // Print test charts
    if (sections.includes('testCharts')) {
      html += `<h2>Test Accuracy Comparison Chart</h2>
        <div class="card">
          ${testBarImg ? `<img src="${testBarImg}" class="chart" alt="Test Accuracy Bar Chart"/>` : '<div>[Chart not available]</div>'}
        </div>`;
    }
    // Print test remarks
    if (sections.includes('testRemarks')) {
      html += `<h2>Test-wise Remarks & Analytics</h2><div class="card"><table>
        <thead>
          <tr>
            <th>Test</th>
            <th style="text-align:right">Accuracy</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(test => `
            <tr>
              <td>${escapeHtml(test.title)}</td>
              <td style="text-align:right">${test.accuracy}%</td>
              <td class="remark">${getTestRemark(test)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>`;
    }
    // Print all tests table
    if (sections.includes('allTests')) {
      html += `<h2>All Tests Table</h2><div class="card"><table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Submitted</th>
            <th style="text-align:right">Total Q</th>
            <th style="text-align:right">Correct</th>
            <th style="text-align:right">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => {
            const dateStr = r.timestamp ? format(new Date(r.timestamp), 'dd MMM yyyy, hh:mm a') : 'N/A';
            const totalQ = r.countedQuestions && r.countedQuestions > 0 ? r.countedQuestions : r.currentTotal ?? r.total ?? 'N/A';
            const correct = r.correct ?? r.originalScore ?? 0;
            const accuracy = typeof r.accuracy === 'number' ? `${r.accuracy}%` : 'N/A';
            return `
              <tr>
                <td>${escapeHtml(r.title)}</td>
                <td>${dateStr}</td>
                <td style="text-align:right">${totalQ}</td>
                <td style="text-align:right">${correct}</td>
                <td style="text-align:right">${accuracy}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table></div>`;
    }

    // Final
    html += `</body></html>`;

    // Open in new tab (not popup)
    const printWindow = window.open();
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      alert('Unable to open print page. Your browser may be blocking popups.');
    }
  }

  // UI
  return (
    <div className="mx-auto py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-blue-50 min-h-screen">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">✨ {studentName || 'Student'} — Premium Analytics</h1>
          <p className="text-gray-600 mt-1">
            Overall: <span className="font-semibold text-gray-800">{analytics.scored}</span> /{' '}
            <span className="font-semibold text-gray-800">{analytics.total}</span>{' '}
            (<span className="text-blue-600 font-semibold">{analytics.average}%</span>)
          </p>
          <div className="mt-3 text-sm text-gray-500">
            Premium features: Subject graphs, test ranking, remarks, consistency, improvement trend, and more!
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex flex-wrap gap-2">
            {PRINT_SECTIONS.map(section => (
              <label key={section.key} className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                <input
                  type="checkbox"
                  checked={printSelection.includes(section.key)}
                  onChange={e => {
                    setPrintSelection(sel =>
                      e.target.checked
                        ? [...sel, section.key]
                        : sel.filter(k => k !== section.key)
                    );
                  }}
                  className="mr-2"
                />
                {section.label}
              </label>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => printSelectedSectionsWithCharts(printSelection)}
            disabled={printSelection.length === 0}
          >
            🖨️ Print Selected Analytics
          </Button>
        </div>
      </div>

      {/* Advanced analytics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" id="summary-print">
        <Card className="p-4 bg-gradient-to-r from-indigo-50 to-blue-100 shadow">
          <CardHeader>
            <CardTitle>Best Test</CardTitle>
          </CardHeader>
          <CardContent>
            {bestTest ? (
              <>
                <div className="font-semibold text-lg">{bestTest.title}</div>
                <div className="text-sm text-gray-600">Accuracy: <span className="font-bold text-green-700">{bestTest.accuracy}%</span></div>
                <div className="mt-2 text-md">{getTestRemark(bestTest)}</div>
              </>
            ) : <div>No attempts</div>}
          </CardContent>
        </Card>
        <Card className="p-4 bg-gradient-to-r from-pink-50 to-red-100 shadow">
          <CardHeader>
            <CardTitle>Weakest Test</CardTitle>
          </CardHeader>
          <CardContent>
            {weakestTest ? (
              <>
                <div className="font-semibold text-lg">{weakestTest.title}</div>
                <div className="text-sm text-gray-600">Accuracy: <span className="font-bold text-red-700">{weakestTest.accuracy}%</span></div>
                <div className="mt-2 text-md">{getTestRemark(weakestTest)}</div>
              </>
            ) : <div>No attempts</div>}
          </CardContent>
        </Card>
        <Card className="p-4 bg-gradient-to-r from-green-50 to-lime-100 shadow">
          <CardHeader>
            <CardTitle>Consistency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{consistency}</div>
            <div className="text-sm text-gray-600">Std. deviation of accuracy</div>
            <div className="mt-2 text-md">Improvement: <span className={`font-bold ${improvement >= 0 ? 'text-green-700' : 'text-red-700'}`}>{improvement >= 0 ? `↑ ${improvement}%` : `↓ ${Math.abs(improvement)}%`}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise analytics with chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8" id="subjectCharts-print">
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Subject-wise Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <Bar ref={subjectBarRef} data={subjectChartData} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { min: 0, max: 100 } }
            }} />
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Subject Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <Line ref={subjectLineRef} data={subjectTrendLineData} options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { min: 0, max: 100 } }
            }} />
          </CardContent>
        </Card>
      </div>

      {/* Subject ranking and remarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8" id="subjectRemarks-print">
        <Card className="p-4 bg-gradient-to-r from-cyan-50 to-teal-100">
          <CardHeader>
            <CardTitle>Best Subject</CardTitle>
          </CardHeader>
          <CardContent>
            {bestSubject ? (
              <>
                <div className="font-semibold text-lg">{bestSubject.subject}</div>
                <div className="text-sm text-gray-600">Accuracy: <span className="font-bold text-green-700">{bestSubject.accuracy}%</span></div>
                <div className="mt-2 text-md">{getSubjectRemark(bestSubject)}</div>
              </>
            ) : <div>No subjects</div>}
          </CardContent>
        </Card>
        <Card className="p-4 bg-gradient-to-r from-yellow-50 to-orange-100">
          <CardHeader>
            <CardTitle>Weakest Subject</CardTitle>
          </CardHeader>
          <CardContent>
            {weakestSubject ? (
              <>
                <div className="font-semibold text-lg">{weakestSubject.subject}</div>
                <div className="text-sm text-gray-600">Accuracy: <span className="font-bold text-red-700">{weakestSubject.accuracy}%</span></div>
                <div className="mt-2 text-md">{getSubjectRemark(weakestSubject)}</div>
              </>
            ) : <div>No subjects</div>}
          </CardContent>
        </Card>
      </div>

      {/* Test-wise bar chart */}
      <Card className="p-4 mb-8" id="testCharts-print">
        <CardHeader>
          <CardTitle>Test Accuracy Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Bar ref={testBarRef} data={testBarData} options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: 0, max: 100 } }
          }} />
        </CardContent>
      </Card>

      {/* Test-wise remarks table */}
      <Card className="p-4 mb-8" id="testRemarks-print">
        <CardHeader>
          <CardTitle>Test-wise Remarks & Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Accuracy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map(test => (
                <tr key={test.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{test.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-700 text-right">{test.accuracy}%</td>
                  <td className="px-4 py-3 whitespace-nowrap text-md">{getTestRemark(test)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Subject-wise remarks */}
      <Card className="p-4 mb-8" id="subjectRemarks-table-print">
        <CardHeader>
          <CardTitle>Subject-wise Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Accuracy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subjectAnalytics.map(subj => (
                <tr key={subj.subject}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{subj.subject}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-700 text-right">{subj.accuracy}%</td>
                  <td className="px-4 py-3 whitespace-nowrap text-md">{getSubjectRemark(subj)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* All Tests Table */}
      <Card className="p-4 mb-8" id="allTests-print">
        <CardHeader>
          <CardTitle>All Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Qs</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Correct</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{row.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {row.date ? format(row.date, 'dd MMM yyyy, hh:mm a') : 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{row.totalQuestions}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{row.correct}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-700 text-right">{row.accuracy}%</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-600">{row.type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            router.push(
                              `/admin/students/responses?id=${row.id}&mock=${row.type === 'By Own'}&studentId=${studentId}`
                            )
                          }
                        >
                          🔎 View
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const single = results.find((r) => r.id === row.id);
                            if (single) printSelectedSectionsWithCharts(['allTests']);
                          }}
                        >
                          🖨️ Print
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
