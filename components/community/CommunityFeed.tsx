'use client';

import { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, startAfter, QueryConstraint, where } from 'firebase/firestore';
import { safeGetDocs } from '@/lib/firestore-monitor';
import { ForumPost, Subject } from '@/types';
import { checkSeriesEnrollment, awardPoints, POINTS } from '@/lib/community';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Plus, Filter, Image as ImageIcon, X, Megaphone, Loader2 } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { PostCard } from './PostCard';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Skeleton } from '@/components/ui/skeleton';

const PROVINCES = [
    'Punjab', 'Sindh', 'KPK', 'Balochistan',
    'Federal (Islamabad)', 'AJK', 'Gilgit Baltistan'
];

interface CommunityFeedProps {
    role: 'student' | 'teacher' | 'admin';
    canCreate?: boolean;
    initialShowDeleted?: boolean;
}

export function CommunityFeed({ role, canCreate = true, initialShowDeleted = false }: CommunityFeedProps) {
    const { user } = useUserStore();
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showDeleted, setShowDeleted] = useState(initialShowDeleted);

    // New Post Form
    const [isAsking, setAsking] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newSubject, setNewSubject] = useState('');
    const [newProvince, setNewProvince] = useState('');
    const [newChapter, setNewChapter] = useState('');
    const [isAnnouncement, setIsAnnouncement] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Derived State for Chapters
    const selectedSubjectData = subjects.find(s => s.name === newSubject);
    const availableChapters = Array.isArray(selectedSubjectData?.chapters) ? selectedSubjectData.chapters : [];

    useEffect(() => {
        setNewChapter('');
    }, [newSubject]);

    const canMakeAnnouncement = role === 'admin' || role === 'teacher';

    useEffect(() => {
        // Fetch subjects once on mount
        const fetchSubjects = async () => {
            try {
                const subjectsSnap = await safeGetDocs(collection(db, 'subjects'), 'fetchSubjects');
                setSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
            } catch (error) {
                console.error("Failed to load subjects", error);
            }
        };
        fetchSubjects();
    }, []);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (sortBy !== 'newest' || showDeleted || subjectFilter !== 'all') {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy, showDeleted, subjectFilter]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size should be less than 5MB');
                return;
            }
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file');
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setSelectedFile(null);
        setImagePreview(null);
    };

    const fetchData = async (loadMore = false) => {
        try {
            if (!loadMore) {
                setLoading(true);
                setPosts([]);
            } else {
                setLoadingMore(true);
            }

            const constraints: QueryConstraint[] = [];

            if (!showDeleted) {
                constraints.push(where('isDeleted', '!=', true));
            }

            if (subjectFilter !== 'all') {
                constraints.push(where('subject', '==', subjectFilter));
            }

            switch (sortBy) {
                case 'newest':
                    constraints.push(orderBy('isPinned', 'desc'));
                    constraints.push(orderBy('createdAt', 'desc'));
                    break;
                case 'popular':
                    constraints.push(orderBy('upvotes', 'desc'));
                    constraints.push(orderBy('createdAt', 'desc'));
                    break;
                case 'replies':
                    constraints.push(orderBy('replyCount', 'desc'));
                    constraints.push(orderBy('createdAt', 'desc'));
                    break;
                case 'unanswered':
                    constraints.push(where('replyCount', '==', 0));
                    constraints.push(orderBy('createdAt', 'desc'));
                    break;
                case 'solved':
                    constraints.push(where('isSolved', '==', true));
                    constraints.push(orderBy('createdAt', 'desc'));
                    break;
                default:
                    constraints.push(orderBy('isPinned', 'desc'));
                    constraints.push(orderBy('createdAt', 'desc'));
            }

            constraints.push(limit(20));

            if (loadMore && lastVisible) {
                constraints.push(startAfter(lastVisible));
            }

            // OPTIMIZATION: Only fetch posts, subjects are already loaded
            const postsSnap = await safeGetDocs(query(collection(db, 'forum_posts'), ...constraints), 'fetchPosts');

            let newPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost));

            if (loadMore) {
                setPosts(prev => [...prev, ...newPosts]);
            } else {
                setPosts(newPosts);
            }

            setLastVisible(postsSnap.docs[postsSnap.docs.length - 1]);
            setHasMore(postsSnap.docs.length === 20);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load community feed');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleCreatePost = async () => {
        const strippedContent = newContent.replace(/<[^>]*>/g, '').trim();
        if (!newTitle.trim() || strippedContent.length === 0 || !newSubject) {
            toast.error('Please fill all fields');
            return;
        }

        if (!user) return;

        try {
            setAsking(true);

            if (role === 'student' && !isAnnouncement) {
                const canPost = await checkSeriesEnrollment(user.uid);
                if (!canPost) {
                    toast.error("Only Series Enrolled students can ask questions.");
                    setAsking(false);
                    return;
                }
            }

            let imageUrls: string[] = [];
            if (selectedFile) {
                setIsUploading(true);
                try {
                    const storageRef = ref(storage, `community/${user.uid}/${Date.now()}_${selectedFile.name}`);
                    const snapshot = await uploadBytes(storageRef, selectedFile);
                    const url = await getDownloadURL(snapshot.ref);
                    imageUrls.push(url);
                } catch (error: any) {
                    console.error("Image upload error:", error);
                    toast.error(`Image upload failed`);
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            const postType = isAnnouncement ? 'announcement' : (role === 'student' ? 'question' : 'discussion');

            await addDoc(collection(db, 'forum_posts'), {
                title: newTitle,
                content: newContent,
                subject: newSubject,
                province: newProvince,
                chapter: newChapter,
                type: postType,
                tags: [],
                images: imageUrls,
                authorId: user?.uid,
                authorName: user?.fullName || (role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Admin'),
                authorRole: role,
                upvotes: 0,
                upvotedBy: [],
                replyCount: 0,
                isSolved: false,
                isPinned: isAnnouncement, // Auto-pin announcements? Maybe logic for later.
                isDeleted: false,
                createdAt: serverTimestamp()
            });

            if (role === 'student' && !isAnnouncement) {
                await awardPoints(user.uid, POINTS.CREATE_POST, 'Created a question post');
                toast.success('Question Posted! +5 points');
            } else {
                toast.success(isAnnouncement ? 'Announcement Posted!' : 'Discussion Posted!');
            }

            setNewTitle('');
            setNewContent('');
            setNewSubject('');
            setNewProvince('');
            setNewChapter('');
            setSelectedFile(null);
            setImagePreview(null);
            setIsAnnouncement(false);
            setIsDialogOpen(false);

            fetchData();
        } catch (error) {
            toast.error('Failed to post');
        } finally {
            setAsking(false);
        }
    };

    const filteredPosts = posts.filter(p => {
        // Optimization: Subject is already filtered by Firestore query.
        // Only apply client-side search content filtering
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase());
        return matchSearch;
    });

    return (
        <div className="space-y-8">
            {/* Mobile Header Layout (2 Rows) */}
            <div className="md:hidden flex flex-col gap-3 mb-6">
                {/* Row 1: Search + Sort + Filter Toggle */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search..."
                            className="pl-10 h-10 w-full text-base rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[110px] h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs px-2">
                            <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="popular">Upvoted</SelectItem>
                            <SelectItem value="replies">Active</SelectItem>
                            <SelectItem value="unanswered">Unanswered</SelectItem>
                            <SelectItem value="solved">Solved</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Row 2: Ask Doubt + Subject Filter */}
                <div className="flex gap-2">
                    {canCreate && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
                                    <Plus className="h-5 w-5 mr-1.5" />
                                    <span className="font-medium text-sm">Ask Doubt</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">
                                        {role === 'student' && !isAnnouncement ? 'Ask the Community' : (isAnnouncement ? 'Create Announcement' : 'Start Discussion')}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-5 py-4">
                                    {canMakeAnnouncement && (
                                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                                            <Switch id="announcement-mode" checked={isAnnouncement} onCheckedChange={setIsAnnouncement} />
                                            <Label htmlFor="announcement-mode" className="font-semibold text-amber-800 dark:text-amber-200 cursor-pointer flex items-center gap-2">
                                                <Megaphone className="h-4 w-4" /> Post as Announcement
                                            </Label>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            value={newTitle}
                                            onChange={e => setNewTitle(e.target.value)}
                                            placeholder="What's your question?"
                                            className="text-lg font-medium"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Subject</Label>
                                            <Select value={newSubject} onValueChange={setNewSubject}>
                                                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                                <SelectContent>
                                                    {subjects.filter(s => s.name).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Province (Optional)</Label>
                                            <Select value={newProvince} onValueChange={setNewProvince}>
                                                <SelectTrigger><SelectValue placeholder="Select Province" /></SelectTrigger>
                                                <SelectContent>
                                                    {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {newSubject !== 'Other' && (
                                        <div className="space-y-2">
                                            <Label>Chapter (Optional)</Label>
                                            <Select value={newChapter} onValueChange={setNewChapter} disabled={!newSubject || availableChapters.length === 0}>
                                                <SelectTrigger><SelectValue placeholder={!newSubject ? "Select Subject First" : availableChapters.length === 0 ? "No Chapters" : "Select Chapter"} /></SelectTrigger>
                                                <SelectContent>
                                                    {availableChapters.map((c, i) => <SelectItem key={i} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Details</Label>
                                        <RichTextEditor
                                            value={newContent}
                                            onChange={setNewContent}
                                            placeholder="Explain your question in detail..."
                                            className="min-h-[200px]"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Attachment (Optional)</Label>
                                        {!imagePreview ? (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900/50"
                                            >
                                                <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
                                                <span className="text-sm text-slate-500 font-medium">Click to upload image</span>
                                                <Input
                                                    ref={fileInputRef}
                                                    id="image-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleFileSelect}
                                                />
                                            </div>
                                        ) : (
                                            <div className="relative w-full h-48 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group">
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={removeImage}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2">
                                        <Button
                                            className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
                                            onClick={handleCreatePost}
                                            disabled={isAsking || isUploading}
                                        >
                                            {isAsking || isUploading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    {isUploading ? 'Uploading Image...' : 'Posting Question...'}
                                                </>
                                            ) : (
                                                'Post Question'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                        <SelectTrigger className="w-[140px] h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs">
                            <div className="flex items-center gap-1.5 truncate">
                                <Filter className="h-3.5 w-3.5 opacity-70" />
                                <span className="truncate">{subjectFilter === 'all' ? 'Topics' : subjectFilter}</span>
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Topics</SelectItem>
                            {subjects.map((subject) => (
                                <SelectItem key={subject.id} value={subject.name}>{subject.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Desktop Action Bar (Hidden on Mobile) */}
            <div className="hidden md:flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                    <Input
                        placeholder="Search questions, topics..."
                        className="pl-10 h-12 text-base rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-shadow"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[160px] h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                            <SelectValue placeholder="Sort By" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="popular">Most Upvoted</SelectItem>
                            <SelectItem value="replies">Most Active</SelectItem>
                            <SelectItem value="unanswered">Unanswered</SelectItem>
                            <SelectItem value="solved">Solved</SelectItem>
                        </SelectContent>
                    </Select>

                    {role === 'admin' && (
                        <div className="flex items-center gap-2 px-4 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
                            <Label htmlFor="show-deleted" className="whitespace-nowrap cursor-pointer">Hidden</Label>
                        </div>
                    )}

                    {canCreate && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-12 w-12 md:w-auto px-0 md:px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105">
                                    <Plus className="h-6 w-6 md:mr-2" />
                                    <span className="hidden md:inline font-medium">Ask Question</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">
                                        {role === 'student' && !isAnnouncement ? 'Ask the Community' : (isAnnouncement ? 'Create Announcement' : 'Start Discussion')}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-5 py-4">
                                    {canMakeAnnouncement && (
                                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                                            <Switch id="announcement-mode" checked={isAnnouncement} onCheckedChange={setIsAnnouncement} />
                                            <Label htmlFor="announcement-mode" className="font-semibold text-amber-800 dark:text-amber-200 cursor-pointer flex items-center gap-2">
                                                <Megaphone className="h-4 w-4" /> Post as Announcement
                                            </Label>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            value={newTitle}
                                            onChange={e => setNewTitle(e.target.value)}
                                            placeholder="What's your question?"
                                            className="text-lg font-medium"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Subject</Label>
                                            <Select value={newSubject} onValueChange={setNewSubject}>
                                                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                                <SelectContent>
                                                    {subjects.filter(s => s.name).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Province (Optional)</Label>
                                            <Select value={newProvince} onValueChange={setNewProvince}>
                                                <SelectTrigger><SelectValue placeholder="Select Province" /></SelectTrigger>
                                                <SelectContent>
                                                    {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {newSubject !== 'Other' && (
                                        <div className="space-y-2">
                                            <Label>Chapter (Optional)</Label>
                                            <Select value={newChapter} onValueChange={setNewChapter} disabled={!newSubject || availableChapters.length === 0}>
                                                <SelectTrigger><SelectValue placeholder={!newSubject ? "Select Subject First" : availableChapters.length === 0 ? "No Chapters" : "Select Chapter"} /></SelectTrigger>
                                                <SelectContent>
                                                    {availableChapters.map((c, i) => <SelectItem key={i} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Details</Label>
                                        <RichTextEditor
                                            value={newContent}
                                            onChange={setNewContent}
                                            placeholder="Explain your question in detail..."
                                            className="min-h-[200px]"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Attachment (Optional)</Label>
                                        {!imagePreview ? (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900/50"
                                            >
                                                <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
                                                <span className="text-sm text-slate-500 font-medium">Click to upload image</span>
                                                <Input
                                                    ref={fileInputRef}
                                                    id="image-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleFileSelect}
                                                />
                                            </div>
                                        ) : (
                                            <div className="relative w-full h-48 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group">
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={removeImage}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2">
                                        <Button
                                            className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
                                            onClick={handleCreatePost}
                                            disabled={isAsking || isUploading}
                                        >
                                            {isAsking || isUploading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    {isUploading ? 'Uploading Image...' : 'Posting Question...'}
                                                </>
                                            ) : (
                                                'Post Question'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Subject Filters (Pills) - HIDDEN ON MOBILE */}
            <div className="hidden md:flex flex-wrap gap-2 pb-2">
                <button
                    onClick={() => setSubjectFilter('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                        ${subjectFilter === 'all'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                        }`}
                >
                    All Topics
                </button>
                {subjects.map((subject) => (
                    <button
                        key={subject.id}
                        onClick={() => setSubjectFilter(subject.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap
                            ${subjectFilter === subject.name
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                            }`}
                    >
                        {subject.name}
                    </button>
                ))}
            </div>

            {/* Content Feed */}
            <div className="space-y-4">
                {loading && posts.length === 0 ? (
                    // Loading Skeletons
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="p-6 rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                            <div className="flex gap-4">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="flex-1 space-y-3">
                                    <div className="flex gap-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <>
                        {filteredPosts.map(post => (
                            <PostCard key={post.id} post={post} currentUserId={user?.uid} />
                        ))}

                        {/* Load More */}
                        {hasMore && filteredPosts.length > 0 && (
                            <div className="flex justify-center pt-8 pb-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => fetchData(true)}
                                    disabled={loadingMore}
                                    className="min-w-[160px] rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                                >
                                    {loadingMore ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Show More Questions'
                                    )}
                                </Button>
                            </div>
                        )}

                        {filteredPosts.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                                    <Search className="h-10 w-10 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No questions found</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                                    We couldn't find any questions matching your filters. Try adjusting your search or start a new discussion.
                                </p>
                                <Button
                                    onClick={() => { setSearch(''); setSubjectFilter('all'); }}
                                    variant="outline"
                                    className="rounded-full"
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
