'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { ForumPost, ForumReply } from '@/types';
import { checkSeriesEnrollment, awardPoints, sendNotification, POINTS } from '@/lib/community';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ThumbsUp, CheckCircle, ShieldCheck, ArrowLeft, MoreHorizontal, Trash2, Edit2, Pin, Flag, EyeOff, Share2, Megaphone, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUserStore } from '@/stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';
import { glassmorphism } from '@/lib/design-tokens';
import DOMPurify from 'dompurify';
import { RichTextEditor } from '@/components/RichTextEditor';

export default function ThreadPage() {
    const { postId } = useParams();
    const { user } = useUserStore();
    const router = useRouter();

    const [post, setPost] = useState<ForumPost | null>(null);
    const [replies, setReplies] = useState<ForumReply[]>([]);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [editPostTitle, setEditPostTitle] = useState('');
    const [editPostContent, setEditPostContent] = useState('');

    // Determine back link and role based on user
    const userRole = user?.role || 'student';
    const backLink = userRole === 'admin' ? '/dashboard/admin/community' :
        userRole === 'teacher' ? '/dashboard/teacher/community' :
            '/dashboard/student/community';

    const fetchThread = useCallback(async () => {
        try {
            if (typeof postId !== 'string') return;

            const postSnap = await getDoc(doc(db, 'forum_posts', postId));
            if (!postSnap.exists()) {
                toast.error('Post not found');
                router.push(backLink);
                return;
            }
            setPost({ id: postSnap.id, ...postSnap.data() } as ForumPost);

            const q = query(collection(db, 'forum_replies'), where('postId', '==', postId), orderBy('createdAt', 'asc'));
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
            toast.error("Failed to load thread");
        }
    }, [postId, router, backLink]);

    useEffect(() => {
        if (postId) {
            fetchThread();
        }
    }, [postId, fetchThread]);

    const handlePostReply = async () => {
        // Simple HTML check - basic tags are okay, but empty check might need text extraction
        // For now, strict check on length
        if (replyContent.replace(/<[^>]*>/g, '').trim().length === 0) {
            toast.error("Please write a meaningful answer");
            return;
        }

        if (!user) return;

        setIsSubmitting(true);
        try {
            if (userRole === 'student') {
                const canPost = await checkSeriesEnrollment(user.uid);
                if (!canPost) {
                    toast.error("Only Series Enrolled students can post answers.");
                    setIsSubmitting(false);
                    return;
                }
            }

            await addDoc(collection(db, 'forum_replies'), {
                postId,
                content: replyContent, // Rich text
                authorId: user?.uid,
                authorName: user?.fullName || 'User',
                authorRole: userRole,
                isVerified: false,
                upvotes: 0,
                upvotedBy: [],
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'forum_posts', postId as string), {
                replyCount: increment(1)
            });

            if (userRole === 'student') {
                await awardPoints(user.uid, POINTS.CREATE_REPLY, 'Posted an answer');
            }

            // Notify post author
            if (post && post.authorId !== user.uid) {
                await sendNotification(
                    post.authorId,
                    'New Answer',
                    `${user.fullName} answered your question: "${post.title}"`,
                    'info',
                    `/dashboard/community/${postId}`
                );
            }

            toast.success('Answer posted!');
            setReplyContent('');
            fetchThread();
        } catch (error) {
            toast.error('Failed to reply');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerify = async (replyId: string) => {
        if (userRole !== 'admin' && userRole !== 'teacher') return;
        try {
            await updateDoc(doc(db, 'forum_replies', replyId), {
                isVerified: true
            });

            await updateDoc(doc(db, 'forum_posts', postId as string), {
                isSolved: true
            });

            const reply = replies.find(r => r.id === replyId);
            if (reply) {
                await awardPoints(reply.authorId, POINTS.VERIFIED_ANSWER, 'Answer was verified by faculty');

                await sendNotification(
                    reply.authorId,
                    'Answer Verified! 🎉',
                    `Your answer was verified by a faculty member. You earned ${POINTS.VERIFIED_ANSWER} points!`,
                    'success',
                    `/dashboard/community/${postId}`
                );
            }

            toast.success('Answer Verified');
            fetchThread();
        } catch (error) {
            toast.error('Failed to verify');
        }
    };

    const handleDeleteReply = async (replyId: string, authorId: string) => {
        if (!user) return;
        const canDelete = user.uid === authorId || userRole === 'admin' || userRole === 'teacher';
        if (!canDelete) return;

        if (!confirm('Delete this reply?')) return;

        try {
            await deleteDoc(doc(db, 'forum_replies', replyId));
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                replyCount: increment(-1)
            });
            toast.success('Reply deleted');
            fetchThread();
        } catch (error) {
            toast.error('Failed to delete reply');
        }
    };

    const handleEditReply = async (replyId: string) => {
        if (editContent.replace(/<[^>]*>/g, '').trim().length === 0) return;
        try {
            await updateDoc(doc(db, 'forum_replies', replyId), {
                content: editContent,
                editedAt: serverTimestamp()
            });
            setReplies(prev => prev.map(r => r.id === replyId ? { ...r, content: editContent, editedAt: { seconds: Date.now() / 1000 } as any } : r));
            setEditingReplyId(null);
            setEditContent('');
            toast.success('Reply updated');
        } catch (error) {
            toast.error('Failed to update reply');
        }
    };

    const handleEditPost = async () => {
        if (!editPostTitle.trim() || editPostContent.replace(/<[^>]*>/g, '').trim().length === 0) return;
        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                title: editPostTitle,
                content: editPostContent,
                editedAt: serverTimestamp()
            });
            setPost(prev => prev ? { ...prev, title: editPostTitle, content: editPostContent, editedAt: { seconds: Date.now() / 1000 } } : null);
            setIsEditingPost(false);
            toast.success('Post updated');
        } catch (error) {
            toast.error('Failed to update post');
        }
    };

    const handleSoftDelete = async () => {
        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), { isDeleted: true, deletedAt: serverTimestamp() });
            setPost(prev => prev ? { ...prev, isDeleted: true } : null);
            toast.success('Post hidden');
            router.push(backLink);
        } catch (error) {
            toast.error('Failed to hide post');
        }
    };

    const handleRestore = async () => {
        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), { isDeleted: false, deletedAt: null });
            setPost(prev => prev ? { ...prev, isDeleted: false } : null);
            toast.success('Post restored');
        } catch (error) {
            toast.error('Failed to restore post');
        }
    };

    const handlePermanentDelete = async () => {
        if (!confirm('PERMANENTLY delete this post? This cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, 'forum_posts', postId as string));
            toast.success('Post deleted');
            router.push(backLink);
        } catch (error) {
            toast.error('Failed to delete post');
        }
    };

    const handlePinPost = async () => {
        if (!post) return;
        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), { isPinned: !post.isPinned });
            setPost(prev => prev ? { ...prev, isPinned: !prev.isPinned } : null);
            toast.success('Pin status updated');
        } catch (error) {
            toast.error('Failed to update pin');
        }
    };

    const handleFlagPost = async () => {
        if (!post) return;
        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), { isFlagged: !post.isFlagged });
            setPost(prev => prev ? { ...prev, isFlagged: !prev.isFlagged } : null);
            toast.success('Flag status updated');
        } catch (error) {
            toast.error('Failed to update flag');
        }
    };

    const handleUpvote = async (collectionName: 'forum_posts' | 'forum_replies', id: string, currentUpvotedBy: string[]) => {
        if (!user) return;
        const isUpvoted = currentUpvotedBy.includes(user.uid);
        const docRef = doc(db, collectionName, id);

        // Optimistic UI
        const updateState = (isUpvoted: boolean) => {
            if (collectionName === 'forum_posts') {
                setPost(prev => prev ? { ...prev, upvotes: isUpvoted ? prev.upvotes - 1 : prev.upvotes + 1, upvotedBy: isUpvoted ? prev.upvotedBy.filter(u => u !== user.uid) : [...prev.upvotedBy, user.uid] } : null);
            } else {
                setReplies(prev => prev.map(r => r.id === id ? { ...r, upvotes: isUpvoted ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: isUpvoted ? r.upvotedBy.filter(u => u !== user.uid) : [...r.upvotedBy, user.uid] } : r));
            }
        };

        updateState(isUpvoted);

        try {
            await updateDoc(docRef, {
                upvotes: increment(isUpvoted ? -1 : 1),
                upvotedBy: isUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid)
            });
        } catch (error) {
            updateState(!isUpvoted); // Rollback
            toast.error('Upvote failed');
        }
    };

    if (!post) return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    );

    const isAnnouncement = post.type === 'announcement';

    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950 p-4 md:p-8 pt-16 md:pt-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <Button
                    variant="ghost"
                    className="pl-0 hover:pl-2 transition-all hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => router.push(backLink)}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Discussions
                </Button>

                {/* Main Post Card */}
                <Card className={`overflow-hidden shadow-lg border hover:border-purple-500/20 transition-colors
                    ${isAnnouncement
                        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border-yellow-200 dark:border-yellow-800'
                        : 'bg-white/80 dark:bg-slate-900/50 border-white/20 dark:border-white/10'
                    } backdrop-blur-md`}>

                    <CardHeader className="flex flex-row items-start gap-4 pb-4">
                        <Avatar className={`h-12 w-12 border-2 ${isAnnouncement ? 'border-yellow-400' : 'border-white dark:border-slate-700'} shadow-sm`}>
                            <AvatarFallback className={`text-lg ${post.authorRole === 'teacher' ? 'bg-indigo-100 text-indigo-700' : post.authorRole === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'}`}>
                                {post.authorName[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="font-bold text-foreground">{post.authorName}</span>
                                {post.authorRole !== 'student' && (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                        {post.authorRole.toUpperCase()}
                                    </Badge>
                                )}
                                {isAnnouncement && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600 bg-yellow-50"><Megaphone className="w-3 h-3 mr-1" /> Announcement</Badge>}
                                <span className="text-xs text-muted-foreground">• {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight tracking-tight">
                                {post.isPinned && <Pin className="inline w-6 h-6 text-blue-500 mr-2 transform rotate-45" />}
                                {post.title}
                            </h1>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {user?.uid === post.authorId && (
                                    <DropdownMenuItem onClick={() => {
                                        setEditPostTitle(post.title);
                                        setEditPostContent(post.content);
                                        setIsEditingPost(true);
                                    }}>
                                        <Edit2 className="w-4 h-4 mr-2" /> Edit Post
                                    </DropdownMenuItem>
                                )}
                                {(userRole === 'admin' || userRole === 'teacher') && (
                                    <>
                                        <DropdownMenuItem onClick={handlePinPost}>
                                            <Pin className="w-4 h-4 mr-2" /> {post.isPinned ? 'Unpin Post' : 'Pin Post'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleSoftDelete} className="text-orange-600">
                                            <EyeOff className="w-4 h-4 mr-2" /> Hide Post
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {userRole === 'admin' && (
                                    <DropdownMenuItem onClick={handlePermanentDelete} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete Permanently
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={handleFlagPost}>
                                    <Flag className="w-4 h-4 mr-2" /> {post.isFlagged ? 'Unflag' : 'Report'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {isEditingPost ? (
                            <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Title</label>
                                    <Input value={editPostTitle} onChange={e => setEditPostTitle(e.target.value)} className="text-lg font-bold bg-white dark:bg-slate-950" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Content</label>
                                    <RichTextEditor
                                        value={editPostContent}
                                        onChange={setEditPostContent}
                                        className="min-h-[200px]"
                                    />
                                </div>
                                <div className="flex gap-2 justify-end pt-2">
                                    <Button variant="ghost" onClick={() => setIsEditingPost(false)}>Cancel</Button>
                                    <Button onClick={handleEditPost} className="bg-purple-600 hover:bg-purple-700 text-white">Save Changes</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="prose prose-lg dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-blue-600">
                                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} />
                            </div>
                        )}

                        {post.images && post.images.length > 0 && (
                            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shadow-sm">
                                <img src={post.images[0]} alt="Attachment" className="max-h-[600px] w-auto mx-auto object-contain cursor-zoom-in hover:scale-[1.01] transition-transform duration-300" />
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800/50">
                            <div className="flex gap-3">
                                <Button
                                    variant={post.upvotedBy?.includes(user?.uid || '') ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => handleUpvote('forum_posts', post.id, post.upvotedBy || [])}
                                    className={`rounded-full px-4 ${post.upvotedBy?.includes(user?.uid || '') ? "text-purple-600 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                                >
                                    <ThumbsUp className={`w-4 h-4 mr-2 ${post.upvotedBy?.includes(user?.uid || '') ? "fill-current" : ""}`} />
                                    {post.upvotes} <span className="hidden sm:inline ml-1">Upvotes</span>
                                </Button>
                                <Button variant="outline" size="sm" className="rounded-full px-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <Share2 className="w-4 h-4 mr-2" /> Share
                                </Button>
                            </div>

                            <div className="flex gap-2 flex-wrap justify-end">
                                <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-900 px-3 py-1">{post.subject}</Badge>
                                {post.isSolved && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs px-3 py-1 shadow-green-200 dark:shadow-none shadow-sm"><CheckCircle className="w-3 h-3 mr-1" /> Solved</Badge>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Answers Section */}
                <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            {replies.length} Answers
                        </h3>
                    </div>

                    {replies.map((reply) => (
                        <div key={reply.id} className={`group relative p-6 rounded-2xl border bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700
                            ${reply.isVerified ? 'border-green-500/50 ring-1 ring-green-500/20 bg-green-50/10 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-800'}`}>

                            {reply.isVerified && (
                                <div className="absolute -top-3 -right-2 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 animate-in zoom-in slide-in-from-bottom-2">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Faculty Verified
                                </div>
                            )}

                            <div className="flex gap-4">
                                <Avatar className="h-10 w-10 mt-1 border border-slate-200 dark:border-slate-800">
                                    <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                        {reply.authorName[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 space-y-2 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <span className="font-bold text-sm text-foreground">{reply.authorName}</span>
                                            <div className="flex items-center gap-2">
                                                {reply.authorRole !== 'student' && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">{reply.authorRole.toUpperCase()}</Badge>}
                                                <span className="text-xs text-muted-foreground">{reply.createdAt?.toDate ? formatDistanceToNow(reply.createdAt.toDate()) + ' ago' : ''}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {(userRole === 'admin' || userRole === 'teacher') && !reply.isVerified && (
                                                <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 text-xs border-green-200" onClick={() => handleVerify(reply.id)}>
                                                    <ShieldCheck className="w-3 h-3 mr-1" /> Verify
                                                </Button>
                                            )}

                                            {(user?.uid === reply.authorId || userRole === 'admin' || userRole === 'teacher') && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                            <MoreHorizontal className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {user?.uid === reply.authorId && (
                                                            <DropdownMenuItem onClick={() => { setEditingReplyId(reply.id); setEditContent(reply.content); }}>
                                                                <Edit2 className="w-4 h-4 mr-2" /> Edit
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => handleDeleteReply(reply.id, reply.authorId)} className="text-red-600">
                                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </div>

                                    {editingReplyId === reply.id ? (
                                        <div className="space-y-4 p-4 border rounded-xl bg-slate-50 dark:bg-slate-900 border-dashed">
                                            <RichTextEditor
                                                value={editContent}
                                                onChange={setEditContent}
                                                className="min-h-[150px]"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="ghost" onClick={() => setEditingReplyId(null)}>Cancel</Button>
                                                <Button size="sm" onClick={() => handleEditReply(reply.id)}>Save Updates</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reply.content) }}
                                        />
                                    )}

                                    <div className="flex items-center gap-4 pt-3">
                                        <button
                                            className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-3 rounded-full transition-all 
                                                ${reply.upvotedBy?.includes(user?.uid || '')
                                                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                                    : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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

                    <div className="sticky bottom-6 pt-4">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent dark:from-slate-950 dark:via-slate-950/80 pointer-events-none -mb-8" />
                        <Card className="relative border-none shadow-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl ring-1 ring-slate-200 dark:ring-slate-800">
                            <CardContent className="pt-6 space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 text-foreground">
                                    <Avatar className="h-6 w-6 border"><AvatarFallback className="text-[10px]">{user?.fullName?.[0]}</AvatarFallback></Avatar>
                                    Your Answer
                                </h4>
                                <RichTextEditor
                                    value={replyContent}
                                    onChange={setReplyContent}
                                    placeholder="Write a clear and helpful explanation..."
                                    className="min-h-[150px] bg-white dark:bg-slate-950"
                                />
                                <div className="flex justify-end pt-2">
                                    <Button
                                        onClick={handlePostReply}
                                        disabled={isSubmitting || !replyContent}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-blue-500/20 transition-all text-white rounded-full px-6"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Posting...
                                            </>
                                        ) : (
                                            'Post Answer'
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
