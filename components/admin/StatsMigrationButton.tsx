'use client';

import { useState } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, Database, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from "@/components/ui/progress";

export function StatsMigrationButton() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processed, setProcessed] = useState(0);
    const [total, setTotal] = useState(0);

    const handleMigration = async () => {
        try {
            setLoading(true);
            setProgress(0);
            setProcessed(0);
            setTotal(0);

            toast.info("Starting stats migration...");

            // 1. Fetch all students
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('role', '==', 'student'));
            const snap = await getDocs(q);

            const totalUsers = snap.docs.length;
            setTotal(totalUsers);

            if (totalUsers === 0) {
                toast.warning("No students found to migrate.");
                setLoading(false);
                return;
            }

            // 2. Process in batches
            const BATCH_SIZE = 400; // Firestore batch limit is 500
            let batch = writeBatch(db);
            let count = 0;
            let totalProcessed = 0;

            for (const userDoc of snap.docs) {
                const data = userDoc.data();
                const stats = data.stats || {};

                // Calculate Grand Totals
                const adminCorrect = stats.totalCorrect || 0;
                const mockCorrect = stats.totalMockCorrect || 0;
                const adminQuestions = stats.totalQuestions || 0;
                const mockQuestions = stats.totalMockQuestions || 0;

                const grandTotalCorrect = adminCorrect + mockCorrect;
                const grandTotalQuestions = adminQuestions + mockQuestions;
                const grandTotalScore = grandTotalCorrect;

                const grandAccuracy = grandTotalQuestions > 0
                    ? Math.round((grandTotalCorrect / grandTotalQuestions) * 100)
                    : 0;

                // Update Stats Object
                const newStats = {
                    ...stats,
                    grandTotalCorrect,
                    grandTotalQuestions,
                    grandTotalScore,
                    grandAccuracy
                };

                // Add to batch
                const userRef = doc(db, 'users', userDoc.id);
                batch.update(userRef, { stats: newStats });

                count++;
                totalProcessed++;

                // Commit batch if limit reached
                if (count >= BATCH_SIZE) {
                    await batch.commit();
                    batch = writeBatch(db); // Reset batch
                    count = 0;
                    setProcessed(totalProcessed);
                    setProgress((totalProcessed / totalUsers) * 100);
                }
            }

            // Commit remaining
            if (count > 0) {
                await batch.commit();
                setProcessed(totalProcessed);
                setProgress(100);
            }

            toast.success(`Successfully migrated ${totalProcessed} users' stats!`);

        } catch (error) {
            console.error("Migration failed:", error);
            toast.error("Failed to migrate stats. Check console for details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Data Maintenance
                    </h3>
                    <p className="text-sm text-orange-600 dark:text-orange-300">
                        Recalculate leaderboard stats (Admin + Mock) for all students.
                    </p>
                </div>
                <Button
                    onClick={handleMigration}
                    disabled={loading}
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    {loading ? "Migrating..." : "Run Migration"}
                </Button>
            </div>

            {loading && (
                <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                        Processed {processed} / {total} users
                    </p>
                </div>
            )}
        </div>
    );
}
