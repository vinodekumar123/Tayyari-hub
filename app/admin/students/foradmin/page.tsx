'use client';

import { useEffect, useState, useMemo } from 'react';
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

/**
 * Admin Student Results
 *
 * Changes made:
 * - Corrected subject-wise analytics logic to strictly use quiz.selectedQuestions (or fallback to quiz.questions)
 *   and the student's answers object (keys = questionId, value = chosen answer).
 * - Aggregates for each subject across all attempts:
 *     attempted = number of questions student answered in that subject
 *     skipped   = number of questions student did not answer in that subject
 *     correct   = number of attempted questions answered correctly
 *     wrong     = number of attempted questions answered incorrectly
 *     accuracy  = Math.round((correct / attempted) * 100) or 0 when attempted == 0
 * - Print/export still does NOT include subject column and prints only student details + full results table.
 *
 * Notes:
 * - The code attempts to be tolerant of variations in property names for question id, subject and correct answer.
 * - If selectedQuestions is missing but per-question data can't be reconstructed, a best-effort fallback is used
 *   (this fallback is limited because we don't have reliable per-question subject/correct-answer pairs).
 */

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
  const [progressPoints, setProgressPoints] = useState<number[]>([]); // accuracy percentages in chronological order

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

      // subject aggregation map keyed by subject name
      const subjectMap: Record<
        string,
        { attempted: number; skipped: number; correct: number; wrong: number; totalQuestionsSum: number }
      > = {};

      // For progress chart
      const progressArray: { ts: number; accuracy: number }[] = [];

      const paths = [
        { attemptPath: 'quizAttempts', quizSource: 'quizzes', isMock: false },
        { attemptPath: 'mock-quizAttempts', quizSource: 'mock-quizzes', isMock: true },
      ];

      // helpers
      const getQId = (q: any, idx = 0) => q?.id ?? q?._id ?? q?.questionId ?? q?.qid ?? (typeof q === 'string' ? q : `idx_${idx}`);
      const getQSubject = (q: any, quizMeta: any) => {
        if (!q) return 'Unspecified';
        if (q.subject) return typeof q.subject === 'string' ? q.subject : q.subject?.name ?? 'Unspecified';
        if (q.subjectName) return q.subjectName;
        if (q.topic) return typeof q.topic === 'string' ? q.topic : q.topic?.name ?? 'Unspecified';
        // quiz-level fallbacks (rare here)
        if (quizMeta?.questionFilters?.subjects?.length) return quizMeta.questionFilters.subjects.join(', ');
        if (quizMeta?.subjects?.length) return Array.isArray(quizMeta.subjects) ? quizMeta.subjects.map((s:any)=>(typeof s==='string'?s:s?.name||'Unknown')).join(', ') : 'Unspecified';
        if (quizMeta?.subject?.name) return quizMeta.subject.name;
        if (typeof quizMeta?.subject === 'string') return quizMeta.subject;
        return 'Unspecified';
      };
      const getQCorrectAnswer = (q: any) => q?.correctAnswer ?? q?.correctOption ?? q?.answer ?? q?.solution ?? q?.correct ?? null;

      const answersEqual = (a: any, b: any) => {
        // normalize simple primitives and arrays/objects via JSON stringify where possible
        if (a === undefined) a = null;
        if (b === undefined) b = null;
        // treat numbers and numeric-strings equal if their numeric values equal
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

              // stored result doc for attempt and quiz meta (the bank)
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

              // Determine selectedQuestions array (preferred) with fallbacks
              let selectedQuestions: any[] = [];
              if (Array.isArray(quizMeta.selectedQuestions) && quizMeta.selectedQuestions.length) {
                selectedQuestions = quizMeta.selectedQuestions;
              } else if (Array.isArray(quizMeta.questions) && quizMeta.questions.length) {
                selectedQuestions = quizMeta.questions;
              } else if (Array.isArray(resultData.selectedQuestions) && resultData.selectedQuestions.length) {
                selectedQuestions = resultData.selectedQuestions;
              }

              // Build answers map:
              // Primary expectation: resultData.answers is an object where keys are questionId and value is student's chosen answer.
              // Fallbacks: array of { questionId, selected } entries or responses object where values are { selected }.
              const rawAnswers = resultData.answers ?? resultData.responses ?? resultData.perQuestion ?? resultData.attempts ?? resultData.answerMap;
              const answersMap: Record<string, any> = {};

              if (rawAnswers) {
                if (!Array.isArray(rawAnswers) && typeof rawAnswers === 'object') {
                  // keys are question ids
                  Object.entries(rawAnswers).forEach(([k, v]) => {
                    if (v && typeof v === 'object' && (v.selected !== undefined || v.answer !== undefined || v.value !== undefined || v.response !== undefined)) {
                      answersMap[k] = (v as any).selected ?? (v as any).answer ?? (v as any).value ?? (v as any).response ?? null;
                    } else {
                      // direct value
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

              // If we have selectedQuestions, iterate them to compute per-question subject stats
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
                // No per-question selectedQuestions available.
                // Fallback logic: attempt to attribute answersMap keys to a single subject if quizMeta provides one.
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
                  // We can know which questions were answered, but not correctness per-question reliably.
                  // We'll count attempted/skipped using answersMap keys. For correctness, if resultData.correct exists, use that proportionally.
                  subjectMap[overallSubject].attempted += answerKeys.length;
                  subjectMap[overallSubject].skipped += Math.max(0, (assumedTotal || 0) - answerKeys.length);
                  subjectMap[overallSubject].totalQuestionsSum += assumedTotal || answerKeys.length;

                  const overallCorrect = typeof resultData.correct === 'number' ? resultData.correct : typeof resultData.score === 'number' ? resultData.score : null;
                  if (overallCorrect !== null) {
                    // distribute correct/wrong counts into this subject (best-effort)
                    const correctCount = Math.min(overallCorrect, answerKeys.length);
                    const wrongCount = Math.max(0, answerKeys.length - correctCount);
                    subjectMap[overallSubject].correct += correctCount;
                    subjectMap[overallSubject].wrong += wrongCount;
                  } else {
                    // can't determine correctness -> treat all attempted as wrong (conservative) or leave correct=0
                    subjectMap[overallSubject].wrong += answerKeys.length;
                  }
                } else {
                  // No per-question data at all: use resultData.correct/total if present
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

              // Compute row-level overall correct/counts for table as best-effort (unchanged behavior)
              // Try using selectedQuestions + answersMap to compute correct & countedQuestions
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
                // fallback to using resultData.correct / totals for overall table
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
                // keep subject property in results for UI convenience (not printed)
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

      // Convert subjectMap into the requested array shape
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Derived memo for table rows (no subject column)
  const tableRows = useMemo(() => {
    return results.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.timestamp ? new Date(r.timestamp) : null,
      totalQuestions: r.countedQuestions && r.countedQuestions > 0 ? r.countedQuestions : r.currentTotal || 0,
      correct: r.correct || 0,
      accuracy: r.accuracy || 0,
      type: r.isMock ? 'By Own' : 'By Admin',
      // keep subject in data but not displayed in table
      subject: r.subject,
    }));
  }, [results]);

  // Simple SVG line chart for progress
  const ProgressChart = ({ points }: { points: number[] }) => {
    const width = 560;
    const height = 140;
    const padding = 20;
    if (!points || points.length === 0) {
      return <div className="text-sm text-gray-500 italic">No attempts to display progress yet.</div>;
    }

    const maxY = Math.max(100, ...points);
    const minY = Math.min(0, ...points);

    const stepX = (width - padding * 2) / (points.length - 1 || 1);
    const scaleY = (val: number) => {
      const ratio = (val - minY) / (maxY - minY || 1);
      return height - padding - ratio * (height - padding * 2);
    };

    const pointsAttr = points.map((p, i) => `${padding + i * stepX},${scaleY(p)}`).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="rounded-md bg-white/60 p-2 shadow-sm">
        {[0, 25, 50, 75, 100].map((g) => {
          const y = scaleY(g);
          return <line key={g} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e6edf3" strokeWidth="1" />;
        })}
        <polyline
          points={`${pointsAttr} ${width - padding},${height - padding} ${padding},${height - padding}`}
          fill="rgba(59,130,246,0.08)"
          stroke="none"
        />
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointsAttr}
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={padding + i * stepX} cy={scaleY(p)} r="3.5" fill="#1e40af" />
          </g>
        ))}
        <text x={padding} y={height - 4} fontSize="10" fill="#64748b">
          Start
        </text>
        <text x={width - padding - 30} y={height - 4} fontSize="10" fill="#64748b">
          Now
        </text>
      </svg>
    );
  };

  /**
   * printResults
   * Creates an HTML page as a Blob and opens it in a NEW TAB via an <a target="_blank"> click.
   * The printed page includes the student details and the full results table (without Subject column).
   */
  const printResults = (selectedResults = results) => {
    const printableTitle = `${studentName || 'Student'} - Results`;
    const style = `
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 24px; color:#0f172a }
      .card { border-radius: 12px; border: 1px solid #e6edf3; padding: 18px; margin-bottom: 18px; box-shadow: 0 6px 18px rgba(2,6,23,0.06) }
      .header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px }
      .title { font-size:18px; font-weight:700; }
      .meta { color:#475569; font-size:13px; }
      table { width:100%; border-collapse: collapse; margin-top:12px; }
      th, td { padding:10px 8px; border-bottom:1px solid #f1f5f9; text-align:left; font-size:13px }
      th { background: #f8fafc; color:#0f172a; font-weight:600 }
      .big-score { font-size:28px; font-weight:800; color:#1e40af }
      @media print {
        button { display:none; }
        body { -webkit-print-color-adjust: exact; }
      }
    `;

    const rowsHtml = (selectedResults || []).map((r) => {
      const dateStr = r.timestamp ? format(new Date(r.timestamp), 'dd MMM yyyy, hh:mm a') : 'N/A';
      const totalQ = r.countedQuestions && r.countedQuestions > 0 ? r.countedQuestions : r.currentTotal ?? r.total ?? 'N/A';
      const correct = r.correct ?? r.originalScore ?? 0;
      const accuracy = typeof r.accuracy === 'number' ? `${r.accuracy}%` : 'N/A';
      return `<tr>
        <td>${escapeHtml(r.title)}</td>
        <td>${dateStr}</td>
        <td style="text-align:right">${totalQ}</td>
        <td style="text-align:right">${correct}</td>
        <td style="text-align:right">${accuracy}</td>
      </tr>`;
    }).join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(printableTitle)}</title>
          <style>${style}</style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${escapeHtml(printableTitle)}</div>
              <div class="meta">Overall: ${analytics.scored} / ${analytics.total} (${analytics.average}%)</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;color:#64748b">Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</div>
              <div style="margin-top:8px"><button onclick="window.print()" style="padding:8px 12px;border-radius:8px;background:#2563eb;border:none;color:white;cursor:pointer">Print / Save as PDF</button></div>
            </div>
          </div>

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div>
                <div style="font-size:16px;font-weight:700">${escapeHtml(studentName)}</div>
                <div style="color:#475569;font-size:13px">Student results list below</div>
              </div>
              <div style="text-align:right">
                <div class="big-score">${analytics.average}%</div>
                <div style="font-size:12px;color:#64748b">Average Accuracy</div>
              </div>
            </div>

            <table>
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
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    try {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
    } catch (err) {
      console.error('Failed to open print page via blob URL. Falling back to window.open.', err);
      const w = window.open();
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      } else {
        alert('Unable to open print page. Your browser may be blocking popups. Try allowing popups or using the print button in the UI.');
      }
    }
  };

  // small utility to escape HTML for printed page
  function escapeHtml(text: any) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return (
    <div className="mx-auto py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-blue-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">📊 {studentName || 'Student'} — Results</h1>
          <p className="text-gray-600 mt-1">
            Overall: <span className="font-semibold text-gray-800">{analytics.scored}</span> /{' '}
            <span className="font-semibold text-gray-800">{analytics.total}</span>{' '}
            (<span className="text-blue-600 font-semibold">{analytics.average}%</span>)
          </p>
          <div className="mt-3 text-sm text-gray-500">
            Note: Scores & accuracy reflect the current quiz bank size when available. Printed export will contain student details and the full results table (Subject column omitted).
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push('/admin/students')}>
            ← Back
          </Button>
          <Button
            variant="outline"
            onClick={() => printResults()}
          >
            🖨️ Download / Print Results
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 w-full rounded-xl shadow-md">
              <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-gray-500 text-center text-base">No results found for this student.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="p-4">
              <CardHeader>
                <CardTitle>Progress Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ProgressChart points={progressPoints} />
                <div className="mt-3 text-sm text-gray-600">
                  Chart shows accuracy (%) per attempt in chronological order.
                </div>
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader>
                <CardTitle>Subject-wise Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                {subjectAnalytics.length === 0 ? (
                  <div className="text-sm text-gray-500">No subject analytics available.</div>
                ) : (
                  <div className="space-y-3">
                    {subjectAnalytics.map((s) => (
                      <div key={s.subject} className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{s.subject}</div>
                          <div className="text-xs text-gray-500">Attempted: {s.attempted} • Skipped: {s.skipped}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-blue-600 font-bold">{s.accuracy}%</div>
                          <div className="text-xs text-gray-500">Correct: {s.correct} • Wrong: {s.wrong}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="p-4">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 space-y-2">
                  <div><strong>Total Attempts:</strong> {results.length}</div>
                  <div><strong>Overall Accuracy:</strong> <span className="text-blue-600 font-semibold">{analytics.average}%</span></div>
                  <div><strong>Total Questions (current bank):</strong> {analytics.total}</div>
                  <div><strong>Total Correct (current calc):</strong> {analytics.scored}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="p-4">
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
                                if (single) printResults([single]);
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

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.slice(0, 6).map((result) => (
              <Card key={result.id} className="hover:shadow-xl transition-all border w-full rounded-xl border-gray-200 bg-white">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-xl p-4">
                  <CardTitle className="text-lg font-bold">{result.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 space-y-2 px-6 py-5">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-xs text-gray-300">Course</div>
                      <div className="font-semibold">{result.course}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-300">Accuracy</div>
                      <div className="text-blue-100 font-bold text-lg">{result.accuracy}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50/40 rounded-md p-2">
                      <div className="text-[11px] text-blue-700">Submitted</div>
                      <div className="mt-1 text-[12px] text-gray-800">
                        {result.timestamp ? format(new Date(result.timestamp), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-white/40 rounded-md p-2">
                      <div className="text-[11px] text-blue-700">Score</div>
                      <div className="mt-1 text-[12px] text-gray-800">
                        {result.correct} / {result.countedQuestions && result.countedQuestions > 0 ? result.countedQuestions : result.currentTotal}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        router.push(
                          `/admin/students/responses?id=${result.id}&mock=${result.isMock}&studentId=${studentId}`
                        )
                      }
                    >
                      View Responses
                    </Button>
                    <Button variant="outline" onClick={() => printResults([result])}>Print</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
