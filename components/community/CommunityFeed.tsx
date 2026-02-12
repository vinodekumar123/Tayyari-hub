'use client';

import { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, startAfter, QueryConstraint, where } from 'firebase/firestore';
import { ForumPost, Subject } from '@/types';
import { checkSeriesEnrollment, awardPoints, POINTS } from '@/lib/community';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageSquare, Search, Plus, Filter, Image as ImageIcon, X, Megaphone, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserStore } from '@/stores/useUserStore';
import { PostCard } from './PostCard';
import { glassmorphism } from '@/lib/design-tokens';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';

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
    const [newContent, setNewContent] = useState(''); // Now Rich Text (HTML)
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

    // Reset chapter when subject changes
    useEffect(() => {
        setNewChapter('');
    }, [newSubject]);

    // Privileged roles for announcements
    const canMakeAnnouncement = role === 'admin' || role === 'teacher';

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (sortBy !== 'newest' || showDeleted) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy, showDeleted]);

    // Ref for file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
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
            if (!loadMore) setLoading(true);
            else setLoadingMore(true);

            const constraints: QueryConstraint[] = [];

            if (!showDeleted) {
                constraints.push(where('isDeleted', '!=', true));
            }

            // Prioritize pinned posts
            constraints.push(orderBy('isPinned', 'desc'));

            // Apply sorting
            switch (sortBy) {
                case 'newest':
                    constraints.push(orderBy('createdAt', 'desc'));
                    break;
                case 'popular':
                    constraints.push(orderBy('upvotes', 'desc'));
                    break;
                case 'replies':
                    constraints.push(orderBy('replyCount', 'desc'));
                    break;
                default:
                    constraints.push(orderBy('createdAt', 'desc'));
            }

            constraints.push(limit(20));

            if (loadMore && lastVisible) {
                constraints.push(startAfter(lastVisible));
            }

            const [postsSnap, subjectsSnap] = await Promise.all([
                getDocs(query(collection(db, 'forum_posts'), ...constraints)),
                !loadMore ? getDocs(collection(db, 'subjects')) : Promise.resolve({ docs: subjects.map(s => ({ id: s.id, data: () => s })) })
            ]);

            let newPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost));

            // Client-side filtering for special cases
            if (sortBy === 'unanswered') {
                newPosts = newPosts.filter(p => (p.replyCount || 0) === 0);
            } else if (sortBy === 'solved') {
                newPosts = newPosts.filter(p => p.isSolved === true);
            }

            if (loadMore) {
                setPosts(prev => [...prev, ...newPosts]);
            } else {
                setPosts(newPosts);
            }

            if (!loadMore) {
                setSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
            }

            // Update pagination state
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
        if (!newTitle || !newContent || !newSubject) {
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
                    toast.error(`Failed to upload image: ${error.message || 'Unknown error'}`);
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            // Determine post type
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

            // Award points for creating post (only for students, not announcements)
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
        // Basic naive search on content string (works for simple HTML)
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase());
        const matchSubject = subjectFilter === 'all' || p.subject === subjectFilter;
        return matchSearch && matchSubject;
    });

    return (
        <div className="space-y-6">
            {/* Header / Action Bar */}
            <div className={`sticky top-2 z-30 flex flex-col md:flex-row gap-4 justify-between items-center ${glassmorphism.light} p-4 rounded-xl border border-white/20 dark:border-white/10 shadow-sm backdrop-blur-md transition-all duration-300`}>
                {/* Search & Filter Group */}
                <div className="flex flex-col sm:flex-row flex-1 w-full gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search questions..."
                            className="pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:ring-purple-500 rounded-full"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Modern Subject Pills Filter */}
                    <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 scrollbar-hide">
                        <div className="flex gap-2 min-w-max">
                            <button
                                onClick={() => setSubjectFilter('all')}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                                    ${subjectFilter === 'all'
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-600 ring-offset-2 dark:ring-offset-slate-900'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                    }`}
                            >
                                All Topics
                            </button>
                            {subjects.map((subject) => (
                                <button
                                    key={subject.id}
                                    onClick={() => setSubjectFilter(subject.name)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
                                        ${subjectFilter === subject.name
                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-600 ring-offset-2 dark:ring-offset-slate-900'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    {subject.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                        <Select value={sortBy} onValueChange={(value) => {
                            setSortBy(value);
                            setPosts([]);
                            setLastVisible(null);
                            setHasMore(true);
                        }}>
                            <SelectTrigger className="w-full sm:w-[150px] bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest</SelectItem>
                                <SelectItem value="popular">Most Upvoted</SelectItem>
                                <SelectItem value="replies">Most Replies</SelectItem>
                                <SelectItem value="unanswered">Unanswered</SelectItem>
                                <SelectItem value="solved">Solved</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">

                    {/* Sort Filter - Compact */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[140px] h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                            <Filter className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="votes">Most Voted</SelectItem>
                            <SelectItem value="unanswered">Unanswered</SelectItem>
                        </SelectContent>
                    </Select>

                    {role === 'admin' && (
                        <div className="flex items-center gap-2 mr-2">
                            <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
                            <Label htmlFor="show-deleted" className="text-sm font-medium whitespace-nowrap cursor-pointer">
                                Hidden
                            </Label>
                        </div>
                    )}

                    {canCreate && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-lg shadow-purple-500/20 transition-all hover:scale-105">
                                    <Plus className="mr-2 h-5 w-5" />
                                    {role === 'student' ? 'Ask Doubt' : 'New Post'}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto sm:max-w-[700px] sm:h-auto rounded-xl">
                                <DialogHeader>
                                    <DialogTitle className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
                                        {role === 'student' && !isAnnouncement ? 'Ask a Doubt' : (isAnnouncement ? 'Create Announcement' : 'Start Discussion')}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {/* Announcement Toggle for Admin/Teacher */}
                                    {canMakeAnnouncement && (
                                        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                            <Switch
                                                id="announcement-mode"
                                                checked={isAnnouncement}
                                                onCheckedChange={setIsAnnouncement}
                                            />
                                            <Label htmlFor="announcement-mode" className="flex items-center gap-2 font-semibold cursor-pointer">
                                                <Megaphone className="h-4 w-4 text-yellow-600" />
                                                Post as Announcement
                                            </Label>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            value={newTitle}
                                            onChange={e => setNewTitle(e.target.value)}
                                            placeholder={role === 'student' ? "e.g. How to solve Integration by Parts?" : "Topic of discussion..."}
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

                                    {/* Only show chapters if not "Other" and subjects loaded */}
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
                                        <Label>Content</Label>
                                        <RichTextEditor
                                            value={newContent}
                                            onChange={setNewContent}
                                            placeholder="Describe your question or discussion in detail..."
                                            className="min-h-[200px]"
                                        />
                                    </div>

                                    {/* Image Upload */}
                                    <div className="space-y-2">
                                        <Label>Attachment (Optional)</Label>
                                        {!imagePreview ? (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                            >
                                                <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
                                                <span className="text-sm text-muted-foreground">Click to upload image</span>
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
                                            <div className="relative mt-2 w-full h-48 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border">
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md"
                                                    onClick={removeImage}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        className={`w-full text-lg py-6 ${isAnnouncement ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'}`}
                                        onClick={handleCreatePost}
                                        disabled={isAsking || isUploading}
                                    >
                                        {isAsking || isUploading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                {isUploading ? 'Uploading...' : 'Posting...'}
                                            </>
                                        ) : (
                                            isAnnouncement ? 'Post Announcement' : 'Post Question'
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Warning for Filtering */}
            {(search || subjectFilter !== 'all') && hasMore && (
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2 border border-blue-100 dark:border-blue-900">
                    <span className="font-bold">Info:</span>
                    Search applies to currently loaded posts. Scroll down to load more.
                </div>
            )}

            {/* Posts Grid */}
            <div className="space-y-4">
                {loading && posts.length === 0 ? (
                    // Loading Skeletons
                    <>
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="p-6 rounded-2xl border-white/20 shadow-sm">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-20" />
                                        </div>
                                        <Skeleton className="h-6 w-3/4" />
                                        <Skeleton className="h-24 w-full rounded-xl" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </>
                ) : (
                    <>
                        {filteredPosts.map(post => (
                            <PostCard key={post.id} post={post} currentUserId={user?.uid} />
                        ))}

                        {/* Load More */}
                        {hasMore && filteredPosts.length > 0 && (
                            <div className="flex justify-center pt-6 pb-4">
                                <Button
                                    variant="outline"
                                    onClick={() => fetchData(true)}
                                    disabled={loadingMore}
                                    className="min-w-[200px] rounded-full"
                                >
                                    {loadingMore ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More Questions'
                                    )}
                                </Button>
                            </div>
                        )}

                        {filteredPosts.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-white/40 dark:bg-white/5 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                                <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                                <h3 className="text-xl font-bold text-foreground">No posts found</h3>
                                <p>Be the first to start a discussion!</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
