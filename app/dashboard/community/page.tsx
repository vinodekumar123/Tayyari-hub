'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, where, updateDoc, doc, arrayUnion, arrayRemove, increment, startAfter } from 'firebase/firestore';
import { ForumPost, Subject } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from '@/components/RichTextEditor';
import parse from 'html-react-parser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageSquare, ThumbsUp, ThumbsDown, Search, Plus, Filter, Tag, CheckCircle, Lock, AlertCircle } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { awardPoints, POINTS } from '@/lib/community';

const PROVINCES = [
    'Punjab', 'Sindh', 'KPK', 'Balochistan',
    'Federal (Islamabad)', 'AJK', 'Gilgit Baltistan'
];

export default function CommunityPage() {
    const { user } = useUserStore();
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('all');

    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const POSTS_PER_PAGE = 20;

    // New Post Form
    const [isAsking, setAsking] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newSubject, setNewSubject] = useState('');
    const [newProvince, setNewProvince] = useState('');
    const [newChapter, setNewChapter] = useState('');

    // Derived State for Chapters
    const availableChapters = subjects.find(s => s.name === newSubject)?.chapters || [];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const postsQuery = query(
                collection(db, 'forum_posts'),
                orderBy('createdAt', 'desc'),
                limit(POSTS_PER_PAGE)
            );

            const [postsSnap, subjectsSnap] = await Promise.all([
                getDocs(postsQuery),
                getDocs(collection(db, 'subjects'))
            ]);

            const newPosts = postsSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as ForumPost))
                .filter(p => p.status !== 'deleted');
            setPosts(newPosts);
            setLastDoc(postsSnap.docs[postsSnap.docs.length - 1]);
            setHasMore(postsSnap.docs.length === POSTS_PER_PAGE);

            setSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
        } catch (error) {
            console.error(error);
            toast.error('Failed to load community feed');
        } finally {
            setLoading(false);
        }
    };

    const loadMorePosts = async () => {
        if (!lastDoc) return;

        try {
            const nextQuery = query(
                collection(db, 'forum_posts'),
                orderBy('createdAt', 'desc'),
                startAfter(lastDoc),
                limit(POSTS_PER_PAGE)
            );

            const snap = await getDocs(nextQuery);
            const newPosts = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as ForumPost))
                .filter(p => p.status !== 'deleted');

            setPosts(prev => [...prev, ...newPosts]);
            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length === POSTS_PER_PAGE);
        } catch (error) {
            toast.error("Could not load more posts");
        }
    };

    const handleCreatePost = async () => {
        if (!newTitle || !newContent || !newSubject) {
            toast.error('Please fill all fields');
            return;
        }

        try {
            setAsking(true);

            // Determine Role
            let role = 'student';
            if (user?.role === 'admin' || user?.admin) role = 'admin';
            else if (user?.role === 'teacher') role = 'teacher';

            const newPost: any = {
                title: newTitle,
                content: newContent,
                subject: newSubject,
                province: newProvince,
                chapter: newChapter,
                tags: [],
                authorId: user?.uid,
                authorName: user?.fullName || 'Student',
                authorRole: role,
                upvotes: 0,
                upvotedBy: [],
                replyCount: 0,
                isSolved: false,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'forum_posts'), newPost);

            toast.success('Question Posted!');
            setNewTitle('');
            setNewContent('');
            setNewSubject('');
            setNewProvince('');
            setNewChapter('');

            // Optimistically Prepend
            setPosts(prev => [{ ...newPost, id: docRef.id, createdAt: { toDate: () => new Date() } }, ...prev]);

            if (user?.uid) {
                await awardPoints(user.uid, POINTS.CREATE_POST, 'Created Question');
            }
        } catch (error) {
            toast.error('Failed to post');
        } finally {
            setAsking(false);
        }
    };

    const handleVote = async (postId: string, currentUpvotedBy: string[] = [], currentDownvotedBy: string[] = [], voteType: 'up' | 'down') => {
        if (!user) {
            toast.error("Please login to vote");
            return;
        }
        const uid = user.uid;
        const isUpvoted = currentUpvotedBy.includes(uid);
        const isDownvoted = currentDownvotedBy.includes(uid);

        const docRef = doc(db, 'forum_posts', postId);

        try {
            if (voteType === 'up') {
                if (isUpvoted) {
                    await updateDoc(docRef, { upvotes: increment(-1), upvotedBy: arrayRemove(uid) });
                    setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: Math.max(0, p.upvotes - 1), upvotedBy: p.upvotedBy.filter(u => u !== uid) } : p));
                } else {
                    const updates: any = { upvotes: increment(1), upvotedBy: arrayUnion(uid) };
                    if (isDownvoted) {
                        updates.downvotes = increment(-1);
                        updates.downvotedBy = arrayRemove(uid);
                    }
                    await updateDoc(docRef, updates);
                    setPosts(prev => prev.map(p => p.id === postId ? {
                        ...p,
                        upvotes: p.upvotes + 1,
                        upvotedBy: [...p.upvotedBy, uid],
                        downvotes: isDownvoted ? Math.max(0, (p.downvotes || 0) - 1) : (p.downvotes || 0),
                        downvotedBy: isDownvoted ? (p.downvotedBy || []).filter(u => u !== uid) : (p.downvotedBy || [])
                    } : p));
                }
            } else { // Downvote
                if (isDownvoted) {
                    await updateDoc(docRef, { downvotes: increment(-1), downvotedBy: arrayRemove(uid) });
                    setPosts(prev => prev.map(p => p.id === postId ? { ...p, downvotes: Math.max(0, (p.downvotes || 0) - 1), downvotedBy: (p.downvotedBy || []).filter(u => u !== uid) } : p));
                } else {
                    const updates: any = { downvotes: increment(1), downvotedBy: arrayUnion(uid) };
                    if (isUpvoted) {
                        updates.upvotes = increment(-1);
                        updates.upvotedBy = arrayRemove(uid);
                    }
                    await updateDoc(docRef, updates);
                    setPosts(prev => prev.map(p => p.id === postId ? {
                        ...p,
                        downvotes: (p.downvotes || 0) + 1,
                        downvotedBy: [...(p.downvotedBy || []), uid],
                        upvotes: isUpvoted ? Math.max(0, p.upvotes - 1) : p.upvotes,
                        upvotedBy: isUpvoted ? p.upvotedBy.filter(u => u !== uid) : p.upvotedBy
                    } : p));
                }
            }
        } catch (error) {
            console.error(error);
            toast.error('Action failed');
        }
    };

    const filteredPosts = posts.filter(p => {
        // Strip HTML tags for search
        const contentText = p.content.replace(/<[^>]*>?/gm, '');
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || contentText.toLowerCase().includes(search.toLowerCase());
        const matchSubject = subjectFilter === 'all' || p.subject === subjectFilter;
        return matchSearch && matchSubject;
    });

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#004AAD] to-[#00B4D8]">
                        Tayyari Community
                    </h1>
                    <p className="text-muted-foreground">Ask doubts, share knowledge, and learn together.</p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-[#004AAD] to-[#00B4D8] text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
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
                                <RichTextEditor
                                    value={newContent}
                                    onChange={setNewContent}
                                    placeholder="Describe your doubt in detail..."
                                />
                                <Button className="w-full" onClick={handleCreatePost} disabled={isAsking}>
                                    {isAsking ? 'Posting...' : 'Post Question'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>


            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search questions..."
                        className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 border-l pl-4">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                        <SelectTrigger className="w-[150px] border-none shadow-none focus:ring-0">
                            <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Subjects</SelectItem>
                            {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Posts List */}
            <div className="space-y-4">
                {filteredPosts.map(post => (
                    <Link href={`/dashboard/community/${post.id}`} key={post.id} className="block group">
                        <Card className="hover:border-purple-500/50 hover:shadow-lg transition-all duration-300">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    {/* Upvote/Downvote Box */}
                                    <div className="flex flex-col items-center gap-1 min-w-[40px]">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-8 w-8 p-0 rounded-full hover:bg-purple-50 hover:text-purple-600 ${post.upvotedBy?.includes(user?.uid || '') ? 'text-purple-600 bg-purple-50' : 'text-muted-foreground'}`}
                                            onClick={(e) => { e.preventDefault(); handleVote(post.id, post.upvotedBy, post.downvotedBy, 'up'); }}
                                        >
                                            <ThumbsUp className={`h-4 w-4 ${post.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                        </Button>
                                        <span className="font-bold text-sm text-foreground">{(post.upvotes || 0) - (post.downvotes || 0)}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-600 ${post.downvotedBy?.includes(user?.uid || '') ? 'text-red-600 bg-red-50' : 'text-muted-foreground'}`}
                                            onClick={(e) => { e.preventDefault(); handleVote(post.id, post.upvotedBy, post.downvotedBy, 'down'); }}
                                        >
                                            <ThumbsDown className={`h-4 w-4 ${post.downvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                        </Button>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline" className="text-xs font-normal bg-gray-50 dark:bg-gray-800">{post.subject}</Badge>
                                            <span className="text-xs text-muted-foreground">• Posted by {(post.authorName || 'User')}</span>
                                            <span className="text-xs text-muted-foreground">• {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate()) + ' ago' : 'Just now'}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-purple-600 transition-colors line-clamp-1">
                                            {post.title}
                                        </h3>
                                        <div className="text-muted-foreground text-sm line-clamp-2 mb-4 prose dark:prose-invert max-w-none">
                                            {parse(post.content)}
                                        </div>

                                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                            <div className="flex items-center gap-1 hover:text-foreground">
                                                <MessageSquare className="h-4 w-4" />
                                                {post.replyCount || 0} Answers
                                            </div>
                                            {(post.isSolved || post.status === 'answered') && (
                                                <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                                    <CheckCircle className="h-3 w-3" /> Solved
                                                </div>
                                            )}
                                            {post.status === 'closed' && (
                                                <div className="flex items-center gap-1 text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    <Lock className="h-3 w-3" /> Closed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}

                {filteredPosts.length === 0 && !loading && (
                    <div className="text-center py-20 text-muted-foreground">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <h3 className="text-xl font-bold">No questions found</h3>
                        <p>Be the first to ask a doubt!</p>
                    </div>
                )}

                {hasMore && !search && (
                    <div className="flex justify-center pt-4 pb-8">
                        <Button variant="outline" onClick={loadMorePosts}>
                            Load More Questions
                        </Button>
                    </div>
                )}
            </div>
        </div >
    );
}
