'use client';

import { useState, useEffect } from 'react';
import { db, storage } from '@/app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, increment, startAfter, QueryConstraint, where } from 'firebase/firestore';
import { ForumPost, Subject } from '@/types';
import { checkSeriesEnrollment, awardPoints, POINTS } from '@/lib/community';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageSquare, ThumbsUp, Search, Plus, Filter, CheckCircle, Users, Pin, Image as ImageIcon, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserStore } from '@/stores/useUserStore';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { UnifiedHeader } from '@/components/unified-header';
import { glassmorphism } from '@/lib/design-tokens';

const PROVINCES = [
    'Punjab', 'Sindh', 'KPK', 'Balochistan',
    'Federal (Islamabad)', 'AJK', 'Gilgit Baltistan'
];

function StudentCommunityPage() {
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

    // New Post Form
    const [isAsking, setAsking] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newSubject, setNewSubject] = useState('');
    const [newProvince, setNewProvince] = useState('');
    const [newChapter, setNewChapter] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Derived State for Chapters
    const availableChapters = subjects.find(s => s.name === newSubject)?.chapters || [];

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        // Refetch when sorting changes
        if (sortBy !== 'newest') {
            fetchData();
        }
    }, [sortBy]);

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
            setLoading(!loadMore);
            setLoadingMore(loadMore);

            const constraints: QueryConstraint[] = [];

            // Filter out deleted posts for students
            constraints.push(where('isDeleted', '!=', true));

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
            const canPost = await checkSeriesEnrollment(user.uid);
            if (!canPost) {
                toast.error("Only Series Enrolled students can ask questions.");
                setAsking(false); // Reset loading state
                return;
            }

            let imageUrls: string[] = [];
            if (selectedFile) {
                setIsUploading(true);
                try {
                    const storageRef = ref(storage, `community/${user.uid}/${Date.now()}_${selectedFile.name}`);
                    const snapshot = await uploadBytes(storageRef, selectedFile);
                    const url = await getDownloadURL(snapshot.ref);
                    imageUrls.push(url);
                } catch (error) {
                    toast.error('Failed to upload image');
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            await addDoc(collection(db, 'forum_posts'), {
                title: newTitle,
                content: newContent,
                subject: newSubject,
                province: newProvince,
                chapter: newChapter,
                tags: [],
                images: imageUrls,
                authorId: user?.uid,
                authorName: user?.fullName || 'Student', // Fallback
                authorRole: 'student', // In real app, check claims
                upvotes: 0,
                upvotedBy: [],
                replyCount: 0,
                isSolved: false,
                createdAt: serverTimestamp()
            });

            // Award points for creating post
            await awardPoints(user.uid, POINTS.CREATE_POST, 'Created a question post');

            toast.success('Question Posted! +5 points');
            setNewTitle('');
            setNewContent('');
            setNewSubject('');
            setNewProvince('');
            setNewChapter('');
            setSelectedFile(null);
            setImagePreview(null);
            // Optimistically add to list or refetch
            fetchData();
        } catch (error) {
            toast.error('Failed to post');
        } finally {
            setAsking(false);
        }
    };

    const handleUpvote = async (postId: string, currentUpvotedBy: string[]) => {
        if (!user) return;
        const isUpvoted = currentUpvotedBy.includes(user.uid);
        const docRef = doc(db, 'forum_posts', postId);

        // Optimistic update
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: isUpvoted ? p.upvotes - 1 : p.upvotes + 1, upvotedBy: isUpvoted ? p.upvotedBy.filter(u => u !== user.uid) : [...p.upvotedBy, user.uid] } : p));

        try {
            if (isUpvoted) {
                await updateDoc(docRef, {
                    upvotes: increment(-1),
                    upvotedBy: arrayRemove(user.uid)
                });
            } else {
                await updateDoc(docRef, {
                    upvotes: increment(1),
                    upvotedBy: arrayUnion(user.uid)
                });
            }
        } catch (error) {
            // Rollback on failure
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: isUpvoted ? p.upvotes + 1 : p.upvotes - 1, upvotedBy: isUpvoted ? [...p.upvotedBy, user.uid] : p.upvotedBy.filter(u => u !== user.uid) } : p));
            toast.error('Action failed');
        }
    };

    const filteredPosts = posts.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase());
        const matchSubject = subjectFilter === 'all' || p.subject === subjectFilter;
        return matchSearch && matchSubject;
    });

    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950">
            <UnifiedHeader
                title="Student Community"
                subtitle="Ask doubts, share knowledge, and learn together"
                icon={<Users className="w-6 h-6" />}
            >
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-[#004AAD] to-[#0066FF] hover:shadow-lg hover:shadow-blue-500/25 transition-all text-white border-none">
                            <Plus className="mr-2 h-5 w-5" /> Ask a Doubt
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Ask a Doubt</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Question Title</label>
                                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. How to solve Integration by Parts?" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Subject</label>
                                <Select value={newSubject} onValueChange={setNewSubject}>
                                    <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                    <SelectContent>
                                        {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Province (Optional)</label>
                                    <Select value={newProvince} onValueChange={setNewProvince}>
                                        <SelectTrigger><SelectValue placeholder="Select Province" /></SelectTrigger>
                                        <SelectContent>
                                            {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Chapter (Optional)</label>
                                    <Select value={newChapter} onValueChange={setNewChapter} disabled={!newSubject || availableChapters.length === 0}>
                                        <SelectTrigger><SelectValue placeholder={!newSubject ? "Select Subject First" : availableChapters.length === 0 ? "No Chapters" : "Select Chapter"} /></SelectTrigger>
                                        <SelectContent>
                                            {availableChapters.map((c, i) => <SelectItem key={i} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Details</label>
                                <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Describe your doubt in detail..." className="min-h-[150px]" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Attachment (Optional)</label>
                                <div className="flex items-center gap-4">
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => document.getElementById('image-upload')?.click()}
                                        className="w-full flex items-center justify-center gap-2"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                        {selectedFile ? 'Change Image' : 'Add Image'}
                                    </Button>
                                    {selectedFile && (
                                        <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                                            {selectedFile.name}
                                        </span>
                                    )}
                                </div>
                                {imagePreview && (
                                    <div className="relative mt-2 w-full h-40 bg-gray-100 rounded-md overflow-hidden">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            className="absolute top-2 right-2 h-6 w-6 rounded-full"
                                            onClick={removeImage}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <Button className="w-full" onClick={handleCreatePost} disabled={isAsking}>
                                {isAsking ? 'Posting...' : 'Post Question'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </UnifiedHeader>
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">

                {/* Filters and Search */}
                <div className={`flex flex-col sm:flex-row gap-4 ${glassmorphism.light} p-4 rounded-xl border border-white/20 dark:border-white/10 shadow-sm`}>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search questions..."
                            className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 border-l pl-4 dark:border-gray-700">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                            <SelectTrigger className="w-[150px] border-none shadow-none focus:ring-0 bg-transparent">
                                <SelectValue placeholder="All Subjects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 border-l pl-4 dark:border-gray-700">
                        <Select value={sortBy} onValueChange={(value) => {
                            setSortBy(value);
                            setPosts([]);
                            setLastVisible(null);
                            setHasMore(true);
                        }}>
                            <SelectTrigger className="w-[150px] border-none shadow-none focus:ring-0 bg-transparent">
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

                {/* Search Warning */}
                {(search || subjectFilter !== 'all') && hasMore && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <span className="font-bold">Note:</span>
                        Search and filters only apply to currently loaded posts. Scroll down to load more content for better results.
                    </div>
                )}

                {/* Posts List */}
                <div className="space-y-4">
                    {loading && posts.length === 0 ? (
                        // Loading Skeletons
                        <>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Card key={i} className="p-6">
                                    <div className="flex items-start gap-4">
                                        <Skeleton className="h-16 w-16 rounded-xl" />
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-5 w-20" />
                                                <Skeleton className="h-4 w-32" />
                                            </div>
                                            <Skeleton className="h-6 w-3/4" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-2/3" />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </>
                    ) : (
                        <>
                            {filteredPosts.map(post => (
                                <Link href={`/dashboard/community/${post.id}`} key={post.id} className="block group">
                                    <Card className="hover:border-blue-500/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-6">
                                            <div className="flex items-start gap-4">
                                                {/* Upvote Box */}
                                                <div className="flex flex-col items-center gap-1 min-w-[50px]">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={`h-auto p-2 flex flex-col gap-1 rounded-xl hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 ${post.upvotedBy?.includes(user?.uid || '') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-muted-foreground'}`}
                                                        onClick={(e) => { e.preventDefault(); handleUpvote(post.id, post.upvotedBy || []); }}
                                                    >
                                                        <ThumbsUp className={`h-5 w-5 ${post.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                                        <span className="font-bold text-sm">{post.upvotes || 0}</span>
                                                    </Button>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="outline" className="text-xs font-normal bg-gray-50 dark:bg-gray-800">{post.subject}</Badge>
                                                        <span className="text-xs text-muted-foreground">• Posted by {post.authorName}</span>
                                                        <span className="text-xs text-muted-foreground">• {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate()) + ' ago' : 'Just now'}</span>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-blue-600 transition-colors line-clamp-1 flex items-center gap-2">
                                                        {post.isPinned && <Pin className="w-4 h-4 text-blue-500 fill-blue-500 transform rotate-45" />}
                                                        {post.title}
                                                    </h3>
                                                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                                                        {post.content}
                                                    </p>

                                                    {post.images && post.images.length > 0 && (
                                                        <div className="mb-4 rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-900">
                                                            <div className="aspect-video w-full relative">
                                                                <img
                                                                    src={post.images[0]}
                                                                    alt="Post attachment"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                                        <div className="flex items-center gap-1 hover:text-foreground">
                                                            <MessageSquare className="h-4 w-4" />
                                                            {post.replyCount || 0} Answers
                                                        </div>
                                                        {post.isSolved && (
                                                            <div className="flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                                                                <CheckCircle className="h-3 w-3" /> Solved
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}

                            {/* Load More Button */}
                            {hasMore && filteredPosts.length > 0 && (
                                <div className="flex justify-center pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => fetchData(true)}
                                        disabled={loadingMore}
                                        className="min-w-[200px]"
                                    >
                                        {loadingMore ? (
                                            <>
                                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                Loading...
                                            </>
                                        ) : (
                                            'Load More Questions'
                                        )}
                                    </Button>
                                </div>
                            )}

                            {filteredPosts.length === 0 && !loading && (
                                <div className="text-center py-20 text-muted-foreground">
                                    <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                    <h3 className="text-xl font-bold">No questions found</h3>
                                    <p>Be the first to ask a doubt!</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default StudentCommunityPage;
