'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { ForumPost, ForumReply } from '@/types';
import { checkSeriesEnrollment, awardPoints, sendNotification, POINTS } from '@/lib/community';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ThumbsUp, CheckCircle, ShieldCheck, ArrowLeft, MoreHorizontal, Trash2, Edit2, Pin, Flag, Eye, EyeOff, XCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [editPostTitle, setEditPostTitle] = useState('');
    const [editPostContent, setEditPostContent] = useState('');

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
                    const userData = snap.data();
                    const role = userData.role;
                    if (role === 'admin' || role === 'superadmin') {
                        setCurrentUserRole('admin');
                    } else if (role === 'teacher') {
                        setCurrentUserRole('teacher');
                    }
                }
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

            // Award points for replying
            await awardPoints(user.uid, POINTS.CREATE_REPLY, 'Posted an answer');

            // Notify post author of new reply
            if (post && post.authorId !== user.uid) {
                await sendNotification(
                    post.authorId,
                    'New Answer',
                    `${user.fullName} answered your question: "${post.title}"`,
                    'info',
                    `/dashboard/community/${postId}`
                );
            }

            toast.success('Answer posted! +2 points');
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

            // Find the reply to get author info
            const reply = replies.find(r => r.id === replyId);
            if (reply) {
                // Award bonus points for verified answer
                await awardPoints(reply.authorId, POINTS.VERIFIED_ANSWER, 'Answer was verified by faculty');

                // Notify reply author
                await sendNotification(
                    reply.authorId,
                    'Answer Verified! 🎉',
                    `Your answer was verified by a faculty member. You earned ${POINTS.VERIFIED_ANSWER} points!`,
                    'success',
                    `/dashboard/community/${postId}`
                );

                // Notify post author
                if (post && post.authorId !== reply.authorId) {
                    await sendNotification(
                        post.authorId,
                        'Question Solved',
                        `Your question "${post.title}" has been solved!`,
                        'success',
                        `/dashboard/community/${postId}`
                    );
                }
            }

            toast.success('Answer Verified');
            fetchThread();
        } catch (error) {
            toast.error('Failed to verify');
        }
    };

    const handleDeleteReply = async (replyId: string, authorId: string) => {
        if (!user) return;

        // Check permissions: author can delete their own, admin/teacher can delete any
        const canDelete = user.uid === authorId || currentUserRole === 'admin' || currentUserRole === 'teacher';
        if (!canDelete) {
            toast.error('You cannot delete this reply');
            return;
        }

        if (!confirm('Are you sure you want to delete this reply?')) return;

        try {
            await deleteDoc(doc(db, 'forum_replies', replyId));
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                replyCount: increment(-1)
            });
            toast.success('Reply deleted');
            fetchThread();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete reply');
        }
    };

    const canEdit = (reply: ForumReply) => {
        if (!user || user.uid !== reply.authorId) return false;
        if (!reply.createdAt?.seconds) return false;

        const elapsed = Date.now() - reply.createdAt.seconds * 1000;
        return elapsed < 10 * 60 * 1000; // 10 minutes
    };

    const handleEditReply = async (replyId: string) => {
        if (!editContent.trim()) {
            toast.error('Reply content cannot be empty');
            return;
        }

        try {
            await updateDoc(doc(db, 'forum_replies', replyId), {
                content: editContent,
                editedAt: serverTimestamp()
            });

            // Update local state
            setReplies(prev => prev.map(r =>
                r.id === replyId
                    ? { ...r, content: editContent, editedAt: { seconds: Date.now() / 1000 } as any }
                    : r
            ));

            setEditingReplyId(null);
            setEditContent('');
            toast.success('Reply updated');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update reply');
        }
    };

    const canEditPost = (post: ForumPost) => {
        if (!user || user.uid !== post.authorId) return false;
        if (!post.createdAt?.seconds) return false;

        const elapsed = Date.now() - post.createdAt.seconds * 1000;
        return elapsed < 10 * 60 * 1000; // 10 minutes
    };

    const handleEditPost = async () => {
        if (!editPostTitle.trim() || !editPostContent.trim()) {
            toast.error('Title and content cannot be empty');
            return;
        }

        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                title: editPostTitle,
                content: editPostContent,
                editedAt: serverTimestamp()
            });

            setPost(prev => prev ? {
                ...prev,
                title: editPostTitle,
                content: editPostContent,
                editedAt: { seconds: Date.now() / 1000 }
            } : null);

            setIsEditingPost(false);
            toast.success('Post updated successfully');
        } catch (error) {
            toast.error('Failed to update post');
        }
    };

    // --- Moderation Functions ---

    const handleSoftDelete = async () => {
        if (!confirm('Are you sure you want to hide this post? It will be visible only to admins.')) return;
        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                isDeleted: true,
                deletedAt: serverTimestamp()
            });
            setPost(prev => prev ? { ...prev, isDeleted: true } : null);
            toast.success('Post hidden successfully');
            router.push('/dashboard/community');
        } catch (error) {
            toast.error('Failed to hide post');
        }
    };

    const handleRestore = async () => {
        try {
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                isDeleted: false,
                deletedAt: null
            });
            setPost(prev => prev ? { ...prev, isDeleted: false } : null);
            toast.success('Post restored successfully');
        } catch (error) {
            toast.error('Failed to restore post');
        }
    };

    const handlePermanentDelete = async () => {
        if (!confirm('Are you sure you want to PERMANENTLY delete this post? This cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, 'forum_posts', postId as string));
            toast.success('Post permanently deleted');
            router.push('/dashboard/community');
        } catch (error) {
            toast.error('Failed to delete post');
        }
    };

    const handlePinPost = async () => {
        if (!post) return;
        try {
            const newPinnedState = !post.isPinned;
            await updateDoc(doc(db, 'forum_posts', postId as string), { isPinned: newPinnedState });
            setPost(prev => prev ? { ...prev, isPinned: newPinnedState } : null);
            toast.success(newPinnedState ? 'Post pinned' : 'Post unpinned');
        } catch (error) {
            toast.error('Failed to update pin status');
        }
    };

    const handleFlagPost = async () => {
        if (!post) return;
        try {
            // Toggle flag
            const newFlaggedState = !post.isFlagged;
            await updateDoc(doc(db, 'forum_posts', postId as string), { isFlagged: newFlaggedState });
            setPost(prev => prev ? { ...prev, isFlagged: newFlaggedState } : null);
            toast.success(newFlaggedState ? 'Post flagged for review' : 'Flag removed');
        } catch (error) {
            toast.error('Failed to update flag status');
        }
    };

    const handleBanUser = async (userId: string) => {
        if (!confirm('Are you sure you want to BAN this user? They will not be able to post anymore.')) return;
        try {
            await updateDoc(doc(db, 'users', userId), { status: 'banned' });
            toast.success('User banned successfully');
        } catch (error) {
            toast.error('Failed to ban user');
        }
    };

    const handleUpvote = async (collectionName: 'forum_posts' | 'forum_replies', id: string, currentUpvotedBy: string[]) => {
        if (!user) return;

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
        } catch (err) {
            console.error(err);
            // Rollback optimistic update on error
            if (collectionName === 'forum_posts') {
                setPost(prev => prev ? { ...prev, upvotes: isUpvoted ? prev.upvotes + 1 : prev.upvotes - 1, upvotedBy: isUpvoted ? [...prev.upvotedBy, user.uid] : prev.upvotedBy.filter(u => u !== user.uid) } : null);
            } else {
                setReplies(prev => prev.map(r => r.id === id ? { ...r, upvotes: isUpvoted ? r.upvotes + 1 : r.upvotes - 1, upvotedBy: isUpvoted ? [...r.upvotedBy, user.uid] : r.upvotedBy.filter(u => u !== user.uid) } : r));
            }
            toast.error('Failed to update vote');
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
                        <AvatarFallback>{post.authorName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                </CardHeader>
                <CardContent className="pt-4">
                    {post.isDeleted && (
                        <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-md mb-4 flex items-center gap-2">
                            <EyeOff className="w-4 h-4" />
                            This post is hidden/deleted (Visible to Admins only)
                        </div>
                    )}

                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                                {post.isPinned && <Pin className="w-5 h-5 text-blue-500 fill-blue-500 transform rotate-45" />}
                                {isEditingPost ? (
                                    <Input
                                        value={editPostTitle}
                                        onChange={e => setEditPostTitle(e.target.value)}
                                        className="text-lg font-bold"
                                    />
                                ) : (
                                    post.title
                                )}
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span className="font-medium text-foreground">{post.authorName}</span>
                                <span>•</span>
                                <span>{post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate()) + ' ago' : ''}</span>
                                <Badge variant="secondary" className="ml-2">{post.subject}</Badge>
                                {post.isSolved && <Badge className="bg-green-100 text-green-700 hover:bg-green-200 ml-2"><CheckCircle className="w-3 h-3 mr-1" /> Solved</Badge>}
                                {post.isFlagged && (currentUserRole === 'admin' || currentUserRole === 'teacher') &&
                                    <Badge className="bg-yellow-100 text-yellow-700 ml-2"><Flag className="w-3 h-3 mr-1" /> Flagged</Badge>
                                }
                            </div>
                        </div>

                        {/* Dropdown Menu for Actions */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {/* Actions for Author */}
                                {user?.uid === post.authorId && !post.isDeleted && (
                                    <DropdownMenuItem onClick={handleSoftDelete} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete Post
                                    </DropdownMenuItem>
                                )}

                                {/* Edit Post (Author Only) */}
                                {canEditPost(post) && !post.isDeleted && !isEditingPost && (
                                    <DropdownMenuItem onClick={() => {
                                        setEditPostTitle(post.title);
                                        setEditPostContent(post.content);
                                        setIsEditingPost(true);
                                    }}>
                                        <Edit2 className="w-4 h-4 mr-2" /> Edit Post
                                    </DropdownMenuItem>
                                )}

                                {/* Actions for Everyone (Flagging) */}
                                {user?.uid !== post.authorId && (
                                    <DropdownMenuItem onClick={handleFlagPost}>
                                        <Flag className="w-4 h-4 mr-2" /> {post.isFlagged ? 'Unflag Post' : 'Flag Post'}
                                    </DropdownMenuItem>
                                )}

                                {/* Admin/Teacher Actions */}
                                {(currentUserRole === 'admin' || currentUserRole === 'teacher') && (
                                    <>
                                        <DropdownMenuItem onClick={handlePinPost}>
                                            <Pin className="w-4 h-4 mr-2" /> {post.isPinned ? 'Unpin Post' : 'Pin Post'}
                                        </DropdownMenuItem>

                                        {post.isDeleted ? (
                                            <>
                                                <DropdownMenuItem onClick={handleRestore} className="text-green-600 focus:text-green-600">
                                                    <Eye className="w-4 h-4 mr-2" /> Restore Post
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={handlePermanentDelete} className="text-red-700 focus:text-red-700 font-bold">
                                                    <XCircle className="w-4 h-4 mr-2" /> Delete Permanently
                                                </DropdownMenuItem>
                                            </>
                                        ) : (
                                            <DropdownMenuItem onClick={handleSoftDelete} className="text-red-600 focus:text-red-600">
                                                <EyeOff className="w-4 h-4 mr-2" /> Hide Post (Soft Delete)
                                            </DropdownMenuItem>
                                        )}

                                        {currentUserRole === 'admin' && (
                                            <DropdownMenuItem onClick={() => handleBanUser(post.authorId)} className="text-red-600 focus:text-red-600">
                                                <XCircle className="w-4 h-4 mr-2" /> Ban User
                                            </DropdownMenuItem>
                                        )}
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {isEditingPost ? (
                        <div className="space-y-4">
                            <Textarea
                                value={editPostContent}
                                onChange={e => setEditPostContent(e.target.value)}
                                className="min-h-[200px]"
                            />
                            <div className="flex gap-2">
                                <Button onClick={handleEditPost} size="sm">Save Changes</Button>
                                <Button onClick={() => setIsEditingPost(false)} variant="ghost" size="sm">Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-lg whitespace-pre-wrap leading-relaxed text-foreground/90">{post.content}</p>
                    )}

                    {/* Image Attachment */}
                    {post.images && post.images.length > 0 && (
                        <div className="mt-6 mb-6">
                            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Attachment</h3>
                            <div className="rounded-xl overflow-hidden border bg-gray-50 dark:bg-gray-900 inline-block">
                                <img
                                    src={post.images[0]}
                                    alt="Post attachment"
                                    className="w-full h-auto object-contain max-h-[600px]"
                                />
                            </div>
                        </div>
                    )}

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
                                    {editingReplyId === reply.id ? (
                                        <div className="space-y-3">
                                            <Textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="min-h-[100px] resize-y"
                                            />
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => handleEditReply(reply.id)}>
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setEditingReplyId(null);
                                                        setEditContent('');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p>{reply.content}</p>
                                            {reply.editedAt && (
                                                <span className="text-xs text-muted-foreground italic mt-1 inline-block">
                                                    (edited {reply.editedAt?.toDate ? formatDistanceToNow(reply.editedAt.toDate()) : ''} ago)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 mt-4">
                                    <button
                                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${reply.upvotedBy?.includes(user?.uid || '') ? 'text-purple-600' : 'text-muted-foreground hover:text-foreground'}`}
                                        onClick={() => handleUpvote('forum_replies', reply.id, reply.upvotedBy || [])}
                                    >
                                        <ThumbsUp className={`w-3.5 h-3.5 ${reply.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                        {reply.upvotes} Helpful
                                    </button>
                                    {canEdit(reply) && editingReplyId !== reply.id && (
                                        <button
                                            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                            onClick={() => {
                                                setEditingReplyId(reply.id);
                                                setEditContent(reply.content);
                                            }}
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            Edit
                                        </button>
                                    )}
                                    {(user?.uid === reply.authorId || currentUserRole === 'admin' || currentUserRole === 'teacher') && (
                                        <button
                                            className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                                            onClick={() => handleDeleteReply(reply.id, reply.authorId)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    )}
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
