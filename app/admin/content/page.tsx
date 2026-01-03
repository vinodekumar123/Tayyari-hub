'use client';

import { useState, useEffect } from 'react';
import { db, auth, storage } from '@/app/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { StudyMaterial, Series, Subject } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, Video, Link as LinkIcon, Trash2, Edit, Eye, Download, Star } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { useUserStore } from '@/stores/useUserStore';

export default function ContentManagementPage() {
    const { user } = useUserStore();
    const [materials, setMaterials] = useState<StudyMaterial[]>([]);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('list');

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'pdf' | 'video' | 'link'>('pdf');
    const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [isFree, setIsFree] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [matSnap, seriesSnap, subSnap] = await Promise.all([
                getDocs(query(collection(db, 'studyMaterials'), orderBy('createdAt', 'desc'))),
                getDocs(collection(db, 'series')),
                getDocs(collection(db, 'subjects'))
            ]);

            setMaterials(matSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudyMaterial)));
            setSeriesList(seriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Series)));
            setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load content');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!title || !selectedSubject) {
            toast.error('Title and Subject are required');
            return;
        }

        if (type === 'pdf' && !file) {
            toast.error('Please select a PDF file');
            return;
        }

        if ((type === 'video' || type === 'link') && !url) {
            toast.error('Please enter a valid URL');
            return;
        }

        setUploading(true);
        try {
            let finalUrl = url;

            if (type === 'pdf' && file) {
                const storageRef = ref(storage, `materials/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                finalUrl = await getDownloadURL(storageRef);
            }

            await addDoc(collection(db, 'studyMaterials'), {
                title,
                description,
                type,
                url: finalUrl,
                seriesId: selectedSeries,
                subject: selectedSubject,
                isFree,
                uploadedBy: {
                    uid: user?.uid || 'unknown',
                    name: user?.fullName || 'Admin',
                    role: 'admin'
                },
                downloadCount: 0,
                viewCount: 0,
                ratings: [],
                averageRating: 0,
                createdAt: serverTimestamp()
            });

            toast.success('Material uploaded successfully');
            resetForm();
            fetchData();
            setActiveTab('list');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setType('pdf');
        setSelectedSeries([]);
        setSelectedSubject('');
        setIsFree(false);
        setFile(null);
        setUrl('');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this material?')) return;
        try {
            await deleteDoc(doc(db, 'studyMaterials', id));
            setMaterials(prev => prev.filter(m => m.id !== id));
            toast.success('Deleted successfully');
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
                <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2">
                                Study Material Hub
                            </h1>
                            <p className="text-muted-foreground font-semibold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]" />
                                Manage notes, videos, and resources
                            </p>
                        </div>
                        <Button
                            onClick={() => { setActiveTab('upload'); resetForm(); }}
                            className="bg-gradient-to-r from-[#004AAD] to-[#0066FF] hover:shadow-lg hover:shadow-blue-500/25 transition-all text-white border-none"
                        >
                            <Upload className="mr-2 h-4 w-4" /> Upload New
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="list">All Content</TabsTrigger>
                    <TabsTrigger value="upload">Upload</TabsTrigger>
                </TabsList>

                <TabsContent value="list">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {materials.map(mat => (
                            <Card key={mat.id} className={`${glassmorphism.light} hover:shadow-lg transition-all`}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <Badge variant={mat.isFree ? "secondary" : "default"}>
                                            {mat.isFree ? "Free" : "Premium"}
                                        </Badge>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(mat.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg line-clamp-1 flex items-center gap-2">
                                        {mat.type === 'pdf' ? <FileText className="h-5 w-5 text-red-500" /> :
                                            mat.type === 'video' ? <Video className="h-5 w-5 text-blue-500" /> :
                                                <LinkIcon className="h-5 w-5 text-green-500" />}
                                        {mat.title}
                                    </CardTitle>
                                    <CardDescription className="line-clamp-2 text-xs">
                                        {mat.description || "No description"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Subject:</span>
                                            <span className="font-medium text-foreground">{mat.subject}</span>
                                        </div>
                                        {/* Analytics Section */}
                                        <div className="grid grid-cols-3 gap-2 py-2 bg-muted/50 rounded-lg text-center">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Views</p>
                                                <p className="font-bold flex justify-center items-center gap-1">
                                                    <Eye className="h-3 w-3" /> {mat.viewCount || 0}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Downloads</p>
                                                <p className="font-bold flex justify-center items-center gap-1">
                                                    <Download className="h-3 w-3" /> {mat.downloadCount || 0}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Rating</p>
                                                <p className="font-bold flex justify-center items-center gap-1 text-yellow-600">
                                                    <Star className="h-3 w-3 fill-yellow-500" /> {mat.averageRating?.toFixed(1) || '-'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground pt-2 border-t">
                                            Uploaded by <span className="font-medium">{mat.uploadedBy?.name}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {materials.length === 0 && !loading && (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                No materials found. Upload something to get started!
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="upload">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle>Upload Content</CardTitle>
                            <CardDescription>Share knowledge with your students.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Physics Chapter 1 Notes" />
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief summary..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Select Subject</Label>
                                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                        <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                                        <SelectContent>
                                            {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Material Type</Label>
                                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pdf">PDF Document</SelectItem>
                                            <SelectItem value="video">Video URL</SelectItem>
                                            <SelectItem value="link">External Link</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Dynamic Input based on Type */}
                            <div className="space-y-2">
                                <Label>{type === 'pdf' ? 'Upload PDF' : 'Resource URL'}</Label>
                                {type === 'pdf' ? (
                                    <Input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                                ) : (
                                    <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/..." />
                                )}
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Free for Everyone?</Label>
                                        <p className="text-xs text-muted-foreground">If unchecked, allows restricted access via Series.</p>
                                    </div>
                                    <Switch checked={isFree} onCheckedChange={setIsFree} />
                                </div>

                                {!isFree && (
                                    <div className="space-y-2">
                                        <Label>Link to Series (Optional)</Label>
                                        <Select onValueChange={(v) => !selectedSeries.includes(v) && setSelectedSeries([...selectedSeries, v])}>
                                            <SelectTrigger><SelectValue placeholder="Select Series to grant access" /></SelectTrigger>
                                            <SelectContent>
                                                {seriesList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {selectedSeries.map(sid => {
                                                const s = seriesList.find(x => x.id === sid);
                                                return (
                                                    <Badge key={sid} variant="secondary" className="cursor-pointer" onClick={() => setSelectedSeries(prev => prev.filter(x => x !== sid))}>
                                                        {s?.name} <span className="ml-1">×</span>
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button className="w-full" onClick={handleUpload} disabled={uploading}>
                                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                {uploading ? 'Uploading...' : 'Publish Content'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
