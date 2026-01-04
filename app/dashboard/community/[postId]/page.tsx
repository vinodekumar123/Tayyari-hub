'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ForumPost, ForumReply } from '@/types';
import { checkSeriesEnrollment } from '@/lib/community';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ThumbsUp, CheckCircle, ShieldCheck, ArrowLeft, MoreHorizontal, Trash2 } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export default function ThreadPage() {
    const { postId } = useParams();
    const { user } = useUserStore();
    const router = useRouter();

    const [post, setPost] = useState<ForumPost | null>(null);
    const [replies, setReplies] = useState<ForumReply[]>([]);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<'student' | 'admin' | 'teacher'>('student');

    const fetchThread = useCallback(async () => {
        try {
            if (typeof postId !== 'string') return;

            const postSnap = await getDoc(doc(db, 'forum_posts', postId));
            if (!postSnap.exists()) {
                toast.error('Post not found');
                router.push('/dashboard/community');
                return;
            }
            setPost({ id: postSnap.id, ...postSnap.data() } as ForumPost);

            const q = query(collection(db, 'forum_replies'), where('postId', '==', postId), orderBy('createdAt', 'asc')); // Oldest first like chat, or sorting by Verified first
            const replySnap = await getDocs(q);

            const fetchedReplies = replySnap.docs.map(d => ({ id: d.id, ...d.data() } as ForumReply));

            // Sort: Verified first, then by upvotes
            fetchedReplies.sort((a, b) => {
                if (a.isVerified && !b.isVerified) return -1;
                if (!a.isVerified && b.isVerified) return 1;
                return b.upvotes - a.upvotes;
            });

            setReplies(fetchedReplies);
        } catch (error) {
            console.error(error);
        }
    }, [postId, router]);

    useEffect(() => {
        if (postId && user) {
            // Check role - simplified for now, ideally strictly checked on backend or claims
            // In a real app we'd fetch the user's role from their profile claim or doc
            // For now, assume admin claim is on user object or we fetch doc
            const checkRole = async () => {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists() && snap.data().admin) setCurrentUserRole('admin');
            };
            checkRole();
            fetchThread();
        }
    }, [postId, user, fetchThread]);

    const handlePostReply = async () => {
        if (!replyContent.trim()) return;
        if (!user) return;

        setIsSubmitting(true);
        try {
            // Check enrollment
            const canPost = await checkSeriesEnrollment(user.uid);
            if (!canPost) {
                toast.error("Only Series Enrolled students can post answers.");
                setIsSubmitting(false);
                return;
            }

            await addDoc(collection(db, 'forum_replies'), {
                postId,
                content: replyContent,
                authorId: user?.uid,
                authorName: user?.fullName || 'Student',
                authorRole: currentUserRole,
                isVerified: false,
                upvotes: 0,
                upvotedBy: [],
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'forum_posts', postId as string), {
                replyCount: increment(1)
            });

            toast.success('Answer posted');
            setReplyContent('');
            fetchThread();
        } catch (error) {
            toast.error('Failed to reply');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerify = async (replyId: string) => {
        if (currentUserRole !== 'admin' && currentUserRole !== 'teacher') return;
        try {
            await updateDoc(doc(db, 'forum_replies', replyId), {
                isVerified: true
            });

            // Also mark post as solved
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                isSolved: true
            });

            toast.success('Answer Verified');
            fetchThread();
        } catch (error) {
            toast.error('Failed to verify');
        }
    };

    const handleUpvote = async (collectionName: 'forum_posts' | 'forum_replies', id: string, currentUpvotedBy: string[]) => {
        if (!user) return;

        // Check enrollment
        const canVote = await checkSeriesEnrollment(user.uid);
        if (!canVote) {
            toast.error("Only Series Enrolled students can vote.");
            return;
        }

        const isUpvoted = currentUpvotedBy.includes(user.uid);
        const docRef = doc(db, collectionName, id);

        try {
            if (isUpvoted) {
                await updateDoc(docRef, { upvotes: increment(-1), upvotedBy: arrayRemove(user.uid) });
            } else {
                await updateDoc(docRef, { upvotes: increment(1), upvotedBy: arrayUnion(user.uid) });
            }
            // Optimistic update
            if (collectionName === 'forum_posts') {
                setPost(prev => prev ? { ...prev, upvotes: isUpvoted ? prev.upvotes - 1 : prev.upvotes + 1, upvotedBy: isUpvoted ? prev.upvotedBy.filter(u => u !== user.uid) : [...prev.upvotedBy, user.uid] } : null);
            } else {
                setReplies(prev => prev.map(r => r.id === id ? { ...r, upvotes: isUpvoted ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: isUpvoted ? r.upvotedBy.filter(u => u !== user.uid) : [...r.upvotedBy, user.uid] } : r));
            }
        } catch (err) { console.error(err); }
    };

    if (!post) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
            <Link href="/dashboard/community">
                <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Feed
                </Button>
            </Link>

            {/* Main Question Post */}
            <Card className="border-l-4 border-l-purple-600 shadow-lg">
                <CardHeader className="flex flex-row gap-4 space-y-0 pb-2">
                    <Avatar className="h-10 w-10 border">
                        <AvatarFallback>{post.authorName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <h1 className="text-2xl font-black text-foreground">{post.title}</h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">{post.authorName}</span>
                            <span>•</span>
                            <span>{post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate()) + ' ago' : ''}</span>
                            <Badge variant="secondary" className="ml-2">{post.subject}</Badge>
                            {post.isSolved && <Badge className="bg-green-100 text-green-700 hover:bg-green-200 ml-2"><CheckCircle className="w-3 h-3 mr-1" /> Solved</Badge>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <p className="text-lg whitespace-pre-wrap leading-relaxed text-foreground/90">{post.content}</p>

                    <div className="flex items-center gap-4 mt-6 pt-4 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            className={`flex gap-2 ${post.upvotedBy?.includes(user?.uid || '') ? 'border-purple-200 bg-purple-50 text-purple-700' : ''}`}
                            onClick={() => handleUpvote('forum_posts', post.id, post.upvotedBy || [])}
                        >
                            <ThumbsUp className={`h-4 w-4 ${post.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                            {post.upvotes} Upvotes
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Answers Section */}
            <div className="space-y-6">
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400">
                    {replies.length} Answers
                </h3>

                {replies.map((reply) => (
                    <div key={reply.id} className={`group relative p-6 rounded-2xl border bg-card shadow-sm transition-all ${reply.isVerified ? 'border-green-500/50 bg-green-50/10 shadow-green-500/10' : 'hover:border-purple-200'}`}>
                        {reply.isVerified && (
                            <div className="absolute -top-3 -right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 animate-in zoom-in">
                                <ShieldCheck className="w-3 h-3" /> Faculty Verified
                            </div>
                        )}

                        <div className="flex items-start gap-4">
                            <Avatar className="h-8 w-8 mt-1">
                                <AvatarFallback className={reply.authorRole !== 'student' ? 'bg-purple-100 text-purple-700' : ''}>
                                    {reply.authorName[0]?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-sm mr-2">{reply.authorName}</span>
                                        {reply.authorRole !== 'student' && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{reply.authorRole.toUpperCase()}</Badge>}
                                        <div className="text-xs text-muted-foreground">{reply.createdAt?.toDate ? formatDistanceToNow(reply.createdAt.toDate()) + ' ago' : ''}</div>
                                    </div>
                                    {(currentUserRole === 'admin' || currentUserRole === 'teacher') && !reply.isVerified && (
                                        <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8" onClick={() => handleVerify(reply.id)}>
                                            <ShieldCheck className="w-4 h-4 mr-1" /> Verify Answer
                                        </Button>
                                    )}
                                </div>

                                <div className="mt-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                    {reply.content}
                                </div>

                                <div className="flex items-center gap-3 mt-4">
                                    <button
                                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${reply.upvotedBy?.includes(user?.uid || '') ? 'text-purple-600' : 'text-muted-foreground hover:text-foreground'}`}
                                        onClick={() => handleUpvote('forum_replies', reply.id, reply.upvotedBy || [])}
                                    >
                                        <ThumbsUp className={`w-3.5 h-3.5 ${reply.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                        {reply.upvotes} Helpful
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Reply Form */}
                <Card className="mt-8 border-t-2 border-t-purple-600">
                    <CardHeader>
                        <CardTitle className="text-lg">Your Answer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            value={replyContent}
                            onChange={e => setReplyContent(e.target.value)}
                            placeholder="Write a clear and helpful explanation..."
                            className="min-h-[120px] resize-y bg-background focus:bg-background"
                        />
                        <div className="flex justify-end">
                            <Button onClick={handlePostReply} disabled={isSubmitting || !replyContent.trim()} className="bg-purple-600 hover:bg-purple-700 font-semibold px-8">
                                {isSubmitting ? 'Posting...' : 'Post Answer'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
