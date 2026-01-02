'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ForumPost, ForumReply } from '@/types';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ThumbsUp, ThumbsDown, CheckCircle, ShieldCheck, ArrowLeft, MoreVertical, Trash2, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { awardPoints, sendNotification, POINTS } from '@/lib/community';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.admin) setCurrentUserRole('admin');
                    else if (data.role === 'teacher') setCurrentUserRole('teacher');
                }
            };
            checkRole();
            fetchThread();
        }
    }, [postId, user, fetchThread]);

    const handlePostReply = async () => {
        if (!replyContent.trim()) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'forum_replies'), {
                postId,
                content: replyContent,
                authorId: user?.uid,
                authorName: user?.fullName || 'Student',
                authorRole: currentUserRole, // Uses the state determined in useEffect
                isVerified: false,
                upvotes: 0,
                upvotedBy: [],
                downvotes: 0,
                downvotedBy: [],
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'forum_posts', postId as string), {
                replyCount: increment(1)
            });

            toast.success('Answer posted');
            setReplyContent('');
            if (user?.uid) {
                awardPoints(user.uid, POINTS.CREATE_REPLY, 'Answered Question');
            }
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
                isSolved: true,
                status: 'answered'
            });

            toast.success('Answer Verified');

            // Awards and Notifications
            const reply = replies.find(r => r.id === replyId);
            if (reply && post) {
                awardPoints(reply.authorId, POINTS.VERIFIED_ANSWER, 'Verified Answer');
                sendNotification(reply.authorId, 'Answer Verified!', `Your answer on "${post.title}" has been verified by faculty.`, 'success', `/dashboard/community/${postId}`);
                if (reply.authorId !== post.authorId) {
                    sendNotification(post.authorId, 'Question Solved!', `Your question "${post.title}" has a verified answer.`, 'success', `/dashboard/community/${postId}`);
                }
            }

            fetchThread();
        } catch (error) {
            toast.error('Failed to verify');
        }
    };

    const handleVote = async (collectionName: 'forum_posts' | 'forum_replies', id: string, currentUpvotedBy: string[] = [], currentDownvotedBy: string[] = [], voteType: 'up' | 'down') => {
        if (!user) {
            toast.error("Please login to vote");
            return;
        }
        const uid = user.uid;
        const isUpvoted = currentUpvotedBy.includes(uid);
        const isDownvoted = currentDownvotedBy.includes(uid);

        const docRef = doc(db, collectionName, id);

        // Optimistic Update
        if (collectionName === 'forum_posts' && post) {
            const newPost = { ...post };
            if (voteType === 'up') {
                if (isUpvoted) {
                    newPost.upvotes = Math.max(0, (newPost.upvotes || 0) - 1);
                    newPost.upvotedBy = newPost.upvotedBy.filter(u => u !== uid);
                } else {
                    newPost.upvotes = (newPost.upvotes || 0) + 1;
                    newPost.upvotedBy = [...newPost.upvotedBy, uid];
                    if (isDownvoted) {
                        newPost.downvotes = Math.max(0, (newPost.downvotes || 0) - 1);
                        newPost.downvotedBy = (newPost.downvotedBy || []).filter(u => u !== uid);
                    }
                }
            } else {
                if (isDownvoted) {
                    newPost.downvotes = Math.max(0, (newPost.downvotes || 0) - 1);
                    newPost.downvotedBy = (newPost.downvotedBy || []).filter(u => u !== uid);
                } else {
                    newPost.downvotes = (newPost.downvotes || 0) + 1;
                    newPost.downvotedBy = [...(newPost.downvotedBy || []), uid];
                    if (isUpvoted) {
                        newPost.upvotes = Math.max(0, (newPost.upvotes || 0) - 1);
                        newPost.upvotedBy = newPost.upvotedBy.filter(u => u !== uid);
                    }
                }
            }
            setPost(newPost);
        } else if (collectionName === 'forum_replies') {
            setReplies(prev => prev.map(r => {
                if (r.id !== id) return r;
                const newReply = { ...r };
                if (voteType === 'up') {
                    if (isUpvoted) {
                        newReply.upvotes = Math.max(0, (newReply.upvotes || 0) - 1);
                        newReply.upvotedBy = newReply.upvotedBy.filter(u => u !== uid);
                    } else {
                        newReply.upvotes = (newReply.upvotes || 0) + 1;
                        newReply.upvotedBy = [...newReply.upvotedBy, uid];
                        if (isDownvoted) {
                            newReply.downvotes = Math.max(0, (newReply.downvotes || 0) - 1);
                            newReply.downvotedBy = (newReply.downvotedBy || []).filter(u => u !== uid);
                        }
                    }
                } else {
                    if (isDownvoted) {
                        newReply.downvotes = Math.max(0, (newReply.downvotes || 0) - 1);
                        newReply.downvotedBy = (newReply.downvotedBy || []).filter(u => u !== uid);
                    } else {
                        newReply.downvotes = (newReply.downvotes || 0) + 1;
                        newReply.downvotedBy = [...(newReply.downvotedBy || []), uid];
                        if (isUpvoted) {
                            newReply.upvotes = Math.max(0, (newReply.upvotes || 0) - 1);
                            newReply.upvotedBy = newReply.upvotedBy.filter(u => u !== uid);
                        }
                    }
                }
                return newReply;
            }));
        }

        try {
            if (voteType === 'up') {
                if (isUpvoted) {
                    await updateDoc(docRef, { upvotes: increment(-1), upvotedBy: arrayRemove(uid) });
                } else {
                    const updates: any = { upvotes: increment(1), upvotedBy: arrayUnion(uid) };
                    if (isDownvoted) {
                        updates.downvotes = increment(-1);
                        updates.downvotedBy = arrayRemove(uid);
                    }
                    await updateDoc(docRef, updates);
                }
            } else { // Downvote
                if (isDownvoted) {
                    await updateDoc(docRef, { downvotes: increment(-1), downvotedBy: arrayRemove(uid) });
                } else {
                    const updates: any = { downvotes: increment(1), downvotedBy: arrayUnion(uid) };
                    if (isUpvoted) {
                        updates.upvotes = increment(-1);
                        updates.upvotedBy = arrayRemove(uid);
                    }
                    await updateDoc(docRef, updates);
                }
            }
            // fetchThread(); // No need to refetch if optimistic works
        } catch (err) {
            console.error(err);
            toast.error("Failed to vote");
            fetchThread(); // Revert on error
        }
    };

    const handleStatusChange = async (newStatus: 'open' | 'closed' | 'answered') => {
        if (!post) return;
        try {
            const updates: any = { status: newStatus };
            if (newStatus === 'answered') updates.isSolved = true;
            if (newStatus === 'open') updates.isSolved = false;

            await updateDoc(doc(db, 'forum_posts', post.id), updates);
            toast.success(`Post marked as ${newStatus}`);
            fetchThread();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleDeletePost = async () => {
        if (!post) return;
        try {
            await updateDoc(doc(db, 'forum_posts', post.id), { status: 'deleted' });
            // Optionally actually delete: await deleteDoc(doc(db, 'forum_posts', post.id)); 
            // But soft delete is often better for references. 
            // For now, let's just mark as deleted and redirect.
            toast.success("Post deleted");
            router.push('/dashboard/community');
        } catch (error) {
            toast.error("Failed to delete post");
        }
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
                        <AvatarFallback>{(post.authorName || '?')[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h1 className="text-2xl font-black text-foreground">{post.title}</h1>
                            {(currentUserRole === 'admin' || currentUserRole === 'teacher' || user?.uid === post.authorId) && (
                                <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Manage Post</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {post.status !== 'answered' && (
                                                <DropdownMenuItem onClick={() => handleStatusChange('answered')}>
                                                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Mark as Answered
                                                </DropdownMenuItem>
                                            )}
                                            {post.status === 'open' ? (
                                                <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
                                                    <Lock className="mr-2 h-4 w-4 text-orange-500" /> Close Thread
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem onClick={() => handleStatusChange('open')}>
                                                    <RefreshCw className="mr-2 h-4 w-4 text-blue-500" /> Re-open Thread
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-red-600 focus:text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Post
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete your forum post.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeletePost} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">{post.authorName || 'Unknown'}</span>
                            <span>•</span>
                            <span>{post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate()) + ' ago' : ''}</span>
                            <Badge variant="secondary" className="ml-2">{post.subject}</Badge>
                            {post.status === 'answered' && <Badge className="bg-green-100 text-green-700 hover:bg-green-200 ml-2"><CheckCircle className="w-3 h-3 mr-1" /> Answered</Badge>}
                            {post.status === 'closed' && <Badge className="bg-gray-100 text-gray-700 ml-2"><Lock className="w-3 h-3 mr-1" /> Closed</Badge>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <p className="text-lg whitespace-pre-wrap leading-relaxed text-foreground/90">{post.content}</p>

                    <div className="flex items-center gap-2 mt-6 pt-4 border-t">
                        <div className="flex items-center rounded-md border bg-background overflow-hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 px-3 rounded-none border-r ${post.upvotedBy?.includes(user?.uid || '') ? 'bg-purple-50 text-purple-700' : 'hover:bg-muted'}`}
                                onClick={() => handleVote('forum_posts', post.id, post.upvotedBy, post.downvotedBy, 'up')}
                            >
                                <ThumbsUp className={`h-4 w-4 mr-1.5 ${post.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                <span className="font-medium">{post.upvotes || 0}</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 px-3 rounded-none ${post.downvotedBy?.includes(user?.uid || '') ? 'bg-red-50 text-red-700' : 'hover:bg-muted'}`}
                                onClick={() => handleVote('forum_posts', post.id, post.upvotedBy, post.downvotedBy, 'down')}
                            >
                                <ThumbsDown className={`h-4 w-4 ${post.downvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                            </Button>
                        </div>
                        {post.downvotes > 0 && <span className="text-xs text-muted-foreground ml-2">{post.downvotes} downvotes</span>}
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
                                <Avatar className="h-8 w-8 mt-1">
                                    <AvatarFallback className={reply.authorRole !== 'student' ? 'bg-purple-100 text-purple-700' : ''}>
                                        {(reply.authorName || '?')[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
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
                                    <div className="flex items-center rounded-md border bg-background/50 overflow-hidden h-7">
                                        <button
                                            className={`flex items-center gap-1.5 px-2 h-full text-xs font-medium transition-colors border-r ${reply.upvotedBy?.includes(user?.uid || '') ? 'bg-purple-50 text-purple-600' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                                            onClick={() => handleVote('forum_replies', reply.id, reply.upvotedBy, reply.downvotedBy, 'up')}
                                        >
                                            <ThumbsUp className={`w-3 h-3 ${reply.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                            {reply.upvotes || 0}
                                        </button>
                                        <button
                                            className={`flex items-center gap-1.5 px-2 h-full text-xs font-medium transition-colors ${reply.downvotedBy?.includes(user?.uid || '') ? 'bg-red-50 text-red-600' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                                            onClick={() => handleVote('forum_replies', reply.id, reply.upvotedBy, reply.downvotedBy, 'down')}
                                        >
                                            <ThumbsDown className={`w-3 h-3 ${reply.downvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                        </button>
                                    </div>
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
