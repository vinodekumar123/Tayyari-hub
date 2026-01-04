'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, getDocs, query, where, doc, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { StudyMaterial } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Video, Link as LinkIcon, Download, Eye, Star, Share2, Lock, GraduationCap } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
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
        try {
            setLoading(true);

            // 1. Fetch User Enrollments
            const enrolRef = collection(db, 'enrollments');
            const qEnrol = query(enrolRef, where('studentId', '==', user?.uid), where('status', '==', 'active'));
            const enrolSnap = await getDocs(qEnrol);
            const mySeries = new Set(enrolSnap.docs.map(d => d.data().seriesId));
            setEnrolledSeriesIds(mySeries);

            // 2. Fetch All Materials (Client-side filtering for simplicity, or complex query)
            // For scale, we would use an "in" query or multiple queries. For now, fetch all active materials.
            const matRef = collection(db, 'studyMaterials');
            const matSnap = await getDocs(matRef);

            const allMats = matSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudyMaterial));

            // 3. Filter Access: Free OR Enrolled in Series
            const accessibleMats = allMats.filter(m =>
                m.isFree || (m.seriesId && m.seriesId.some(sid => mySeries.has(sid)))
            );

            setMaterials(accessibleMats.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
        } catch (error) {
            console.error('Error loading study materials:', error);
            toast.error('Failed to load study materials');
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        if (user?.uid) {
            fetchData();
        }
    }, [fetchData, user?.uid]);

    const handleInteraction = async (material: StudyMaterial, action: 'view' | 'download') => {
        try {
            // 1. Open Link
            window.open(material.url, '_blank');

            // 2. Track Analytics
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

            // Fetch current ratings first to recalculate average strictly
            // Optimized approach: Firestore creates limitation on array updates inside objects without reading
            // We read-modify-write for safety here
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

            // Update local state to reflect change immediately
            setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, averageRating: avg } : m));
            toast.success('Rating submitted!');
        } catch (error) {
            toast.error('Failed to rate');
        }
    };

    const filteredMaterials = materials.filter(m => {
        if (filterType === 'pdf') return m.type === 'pdf';
        if (filterType === 'video') return m.type === 'video';
        return true;
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <UnifiedHeader
                title="Study Zone"
                subtitle="Access premium notes, video lectures, and resources tailored for your enrolled series."
                icon={<GraduationCap className="w-6 h-6" />}
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border">
                <Tabs value={filterType} onValueChange={setFilterType}>
                    <TabsList>
                        <TabsTrigger value="all">All Content</TabsTrigger>
                        <TabsTrigger value="pdf">Notes (PDF)</TabsTrigger>
                        <TabsTrigger value="video">Videos</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="text-sm text-muted-foreground font-medium">
                    Showing {filteredMaterials.length} resources
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredMaterials.map((mat) => (
                    <Card key={mat.id} className="group hover:scale-105 transition-all duration-300 border-none shadow-md hover:shadow-xl overflow-hidden bg-white dark:bg-gray-900">
                        <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
                        <CardHeader className="pb-3">
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
                            <CardTitle className="text-lg leading-tight line-clamp-2 min-h-[3rem]">
                                {mat.title}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 text-xs pt-1">
                                {mat.description}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="pb-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                <span>{mat.subject}</span>
                                <span>•</span>
                                <span>{mat.viewCount || 0} views</span>
                            </div>

                            {/* Rating Interaction */}
                            <div className="flex items-center gap-1 group-hover:opacity-100 opacity-50 transition-opacity">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button key={star} onClick={() => handleRate(mat.id, star)}>
                                        <Star
                                            className={`w-4 h-4 transition-colors ${(mat.averageRating || 0) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-400'
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </CardContent>

                        <CardFooter className="pt-0">
                            <Button
                                className={`w-full font-bold ${mat.type === 'pdf' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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

                {filteredMaterials.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center text-muted-foreground">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <h3 className="text-xl font-bold">No Materials Found</h3>
                        <p>Check back later for new uploads!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
