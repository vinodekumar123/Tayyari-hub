'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase';
import { collection, getDocs, query, where, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { StudyMaterial } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { FileText, Download, Eye, Star, GraduationCap, Search } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { UnifiedHeader } from '@/components/unified-header';

export default function StudentStudyZone() {
    const { user } = useUserStore();
    const [materials, setMaterials] = useState<StudyMaterial[]>([]);
    const [enrolledSeriesIds, setEnrolledSeriesIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [search, setSearch] = useState('');

    const fetchData = useCallback(async () => {
        if (!user?.uid) return;

        try {
            setLoading(true);

            // 1. Fetch User Enrollments
            const enrolRef = collection(db, 'enrollments');
            const qEnrol = query(enrolRef, where('studentId', '==', user.uid), where('status', '==', 'active'));
            const enrolSnap = await getDocs(qEnrol);
            const mySeries = new Set(enrolSnap.docs.map(d => d.data().seriesId));
            setEnrolledSeriesIds(mySeries);

            const matRef = collection(db, 'studyMaterials');
            const promises = [];

            // Query 1: Always fetch Free materials
            promises.push(getDocs(query(matRef, where('isFree', '==', true))));

            // Query 2: Fetch materials for enrolled series (chunked for Firestore limits)
            if (mySeries.size > 0) {
                const seriesArray = Array.from(mySeries);
                // Firestore 'array-contains-any' is limited to 10 values
                for (let i = 0; i < seriesArray.length; i += 10) {
                    const chunk = seriesArray.slice(i, i + 10);
                    promises.push(getDocs(query(matRef, where('seriesId', 'array-contains-any', chunk))));
                }
            }

            const snapshots = await Promise.all(promises);
            const allDocs = new Map<string, StudyMaterial>();

            snapshots.forEach(snap => {
                snap.docs.forEach(d => {
                    allDocs.set(d.id, { id: d.id, ...d.data() } as StudyMaterial);
                });
            });

            const uniqueMaterials = Array.from(allDocs.values());
            setMaterials(uniqueMaterials.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));

        } catch (error) {
            console.error('Error loading study materials:', error);
            toast.error('Failed to load study materials');
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInteraction = async (material: StudyMaterial, action: 'view' | 'download') => {
        try {
            window.open(material.url, '_blank');
            const docRef = doc(db, 'studyMaterials', material.id);
            if (action === 'download') {
                await updateDoc(docRef, { downloadCount: increment(1) });
            } else {
                await updateDoc(docRef, { viewCount: increment(1) });
            }
        } catch (error) {
            console.error('Analytics tracking failed', error);
        }
    };

    const handleRate = async (materialId: string, rating: number) => {
        try {
            if (!materialId) return;
            const docRef = doc(db, 'studyMaterials', materialId);
            const d = await getDoc(docRef);
            if (!d.exists()) return;

            const currentData = d.data() as StudyMaterial;
            const existingRatings = currentData.ratings || [];
            const userRatingIndex = existingRatings.findIndex(r => r.userId === user?.uid);

            let newRatings = [...existingRatings];
            if (userRatingIndex >= 0) {
                newRatings[userRatingIndex].rating = rating;
            } else {
                newRatings.push({ userId: user?.uid!, rating });
            }

            const avg = newRatings.reduce((acc, curr) => acc + curr.rating, 0) / newRatings.length;

            await updateDoc(docRef, {
                ratings: newRatings,
                averageRating: avg
            });

            setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, averageRating: avg } : m));
            toast.success('Rating submitted!');
        } catch (error) {
            toast.error('Failed to rate');
        }
    };

    const filteredMaterials = materials.filter(m => {
        const matchesType =
            filterType === 'all' ? true :
                filterType === 'pdf' ? m.type === 'pdf' :
                    filterType === 'video' ? m.type === 'video' : true;

        const matchesSearch =
            search === '' ? true :
                m.title.toLowerCase().includes(search.toLowerCase()) ||
                m.subject?.toLowerCase().includes(search.toLowerCase()) ||
                m.description?.toLowerCase().includes(search.toLowerCase());

        return matchesType && matchesSearch;
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <UnifiedHeader
                title="Study Zone"
                subtitle="Access premium notes, video lectures, and resources tailored for your enrolled series."
                icon={<GraduationCap className="w-6 h-6" />}
            />

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search materials by title or subject..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
                    <Tabs value={filterType} onValueChange={setFilterType} className="w-full md:w-auto">
                        <TabsList className="bg-slate-100 dark:bg-slate-900">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pdf">Notes</TabsTrigger>
                            <TabsTrigger value="video">Videos</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="text-sm text-muted-foreground font-medium whitespace-nowrap hidden lg:block border-l pl-4 ml-2">
                        {loading ? 'Loading...' : `${filteredMaterials.length} resources`}
                    </div>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <Card key={i} className="overflow-hidden border-none shadow-md bg-white dark:bg-gray-900">
                            <Skeleton className="h-2 w-full" />
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start mb-2 gap-2">
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-5 w-10 rounded-full" />
                                </div>
                                <Skeleton className="h-6 w-3/4 mb-2" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-4 w-1/2" />
                                <div className="flex gap-1 pt-2">
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-10 w-full rounded-md" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredMaterials.map((mat) => (
                        <Card key={mat.id} className="group hover:scale-105 transition-all duration-300 border-none shadow-md hover:shadow-xl overflow-hidden bg-white dark:bg-gray-900 flex flex-col">
                            <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
                            <CardHeader className="pb-3 flex-shrink-0">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="outline" className={`${mat.type === 'pdf' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                        {mat.type === 'pdf' ? 'PDF Note' : 'Video Lecture'}
                                    </Badge>
                                    {mat.averageRating > 0 && (
                                        <div className="flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                                            <Star className="w-3 h-3 fill-yellow-500" /> {mat.averageRating.toFixed(1)}
                                        </div>
                                    )}
                                </div>
                                <CardTitle className="text-lg leading-tight line-clamp-2 min-h-[3rem]" title={mat.title}>
                                    {mat.title}
                                </CardTitle>
                                {mat.description && (
                                    <CardDescription className="line-clamp-2 text-xs pt-1">
                                        {mat.description}
                                    </CardDescription>
                                )}
                            </CardHeader>

                            <CardContent className="pb-3 flex-grow">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                    <span className="truncate max-w-[120px]">{mat.subject || 'General'}</span>
                                    <span>•</span>
                                    <span>{mat.viewCount || 0} views</span>
                                </div>

                                <div className="flex items-center gap-1 group-hover:opacity-100 opacity-60 transition-opacity">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button key={star} onClick={() => handleRate(mat.id, star)} type="button" aria-label={`Rate ${star} stars`}>
                                            <Star
                                                className={`w-4 h-4 transition-colors ${(mat.averageRating || 0) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-400'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </CardContent>

                            <CardFooter className="pt-0 mt-auto">
                                <Button
                                    className={`w-full font-bold shadow-sm ${mat.type === 'pdf' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    onClick={() => handleInteraction(mat, mat.type === 'pdf' ? 'download' : 'view')}
                                >
                                    {mat.type === 'pdf' ? (
                                        <> <Download className="mr-2 h-4 w-4" /> Download PDF </>
                                    ) : (
                                        <> <Eye className="mr-2 h-4 w-4" /> Watch Video </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}

                    {filteredMaterials.length === 0 && (
                        <div className="col-span-full py-20 text-center text-muted-foreground">
                            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <h3 className="text-xl font-bold">No Materials Found</h3>
                            <p>Try adjusting your search or filters.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

