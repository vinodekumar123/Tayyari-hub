'use client';

import { useState, useEffect } from 'react';
import { db } from '@/app/firebase';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UnifiedHeader } from '@/components/unified-header';
import { Lock, Unlock, Plus, Trash2, Layers, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AccessRule {
    id: string;
    seriesId: string;
    seriesName: string;
    limitFrequency: 'daily' | 'weekly' | 'monthly';
    limitCount: number;
    isActive: boolean;
}

interface Series {
    id: string;
    name: string;
    year?: string;
}

export default function AccessControlPage() {
    const [rules, setRules] = useState<AccessRule[]>([]);
    const [allSeries, setAllSeries] = useState<Series[]>([]);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);

    // Form State
    const [selectedSeriesId, setSelectedSeriesId] = useState('');
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [limitCount, setLimitCount] = useState<number>(3);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Series
            const seriesSnap = await getDocs(collection(db, 'series'));
            setAllSeries(seriesSnap.docs.map(d => ({ id: d.id, name: d.data().name, year: d.data().year } as Series)));

            // 2. Fetch Rules
            const rulesSnap = await getDocs(collection(db, 'mock-test-access-rules'));
            setRules(rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRule)));

        } catch (error) {
            console.error(error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRule = async () => {
        if (!selectedSeriesId) {
            toast.error("Please select a series");
            return;
        }

        // Check if rule already exists for this series
        if (rules.some(r => r.seriesId === selectedSeriesId)) {
            toast.error("A rule already exists for this series. Delete it first to create a new one.") // Or allow editing
            return;
        }

        setFormLoading(true);
        try {
            const series = allSeries.find(s => s.id === selectedSeriesId);
            if (!series) throw new Error("Series not found");

            await addDoc(collection(db, 'mock-test-access-rules'), {
                seriesId: series.id,
                seriesName: series.name,
                limitFrequency: frequency,
                limitCount: Number(limitCount),
                isActive: true,
                createdAt: serverTimestamp()
            });

            toast.success("Rule created successfully");
            setSelectedSeriesId('');
            setLimitCount(3);
            fetchData(); // Refresh list

        } catch (error) {
            console.error(error);
            toast.error("Failed to create rule");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this rule? Access will be removed for this series.")) return;
        try {
            await deleteDoc(doc(db, 'mock-test-access-rules', id));
            toast.success("Rule deleted");
            setRules(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            toast.error("Failed to delete rule");
        }
    };

    const toggleStatus = async (rule: AccessRule) => {
        try {
            await updateDoc(doc(db, 'mock-test-access-rules', rule.id), { isActive: !rule.isActive });
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
        } catch (e) {
            toast.error("Failed to update status");
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            <UnifiedHeader
                studentName="Admin"
                subtitle="Manage access limits for 'Create Your Own Test'."
                greeting={false}
            />

            <div className="container mx-auto p-6 max-w-5xl space-y-8">

                {/* Info Card */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-200">How logic works</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Create rules to restrict the "Create Your Own Test" feature.
                            Students <strong>must be enrolled</strong> in the selected Series to access the feature.
                            Once enrolled, their usage is limited by the frequency you set (e.g., 2 tests per day).
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <div className="md:col-span-1">
                        <Card className="sticky top-24">
                            <CardHeader>
                                <CardTitle className="text-lg">Add Access Rule</CardTitle>
                                <CardDescription>Link a series to a usage limit.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Select Series</label>
                                    <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a series..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allSeries.map(s => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.name} <span className="text-muted-foreground text-xs">({s.year})</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Limit Frequency</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                                            <button
                                                key={freq}
                                                onClick={() => setFrequency(freq)}
                                                className={`px-2 py-1.5 text-xs font-semibold rounded-md border transition-all ${frequency === freq
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Max Tests per {frequency}</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={limitCount}
                                        onChange={(e) => setLimitCount(Number(e.target.value))}
                                    />
                                </div>

                                <Button
                                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700"
                                    onClick={handleCreateRule}
                                    disabled={formLoading || !selectedSeriesId}
                                >
                                    {formLoading ? 'Creating...' : 'Create Rule'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Rules List */}
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Layers className="w-5 h-5" /> Active Rules
                        </h3>

                        {loading ? (
                            <div className="text-center py-10 text-slate-400">Loading rules...</div>
                        ) : rules.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                                <Lock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>No access rules defined.</p>
                                <p className="text-xs mt-1">"Create Test" might be accessible to everyone or no one depending on default policy.</p>
                            </div>
                        ) : (
                            rules.map(rule => (
                                <Card key={rule.id} className="overflow-hidden">
                                    <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 w-full">
                                            <div className={`p-3 rounded-full ${rule.isActive ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                {rule.isActive ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-slate-100">{rule.seriesName}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800">
                                                        {rule.limitCount} tests / {rule.limitFrequency}
                                                    </Badge>
                                                    {!rule.isActive && <Badge variant="secondary">Inactive</Badge>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => toggleStatus(rule)}
                                                className={rule.isActive ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                                            >
                                                {rule.isActive ? 'Disable' : 'Enable'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(rule.id)}
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
