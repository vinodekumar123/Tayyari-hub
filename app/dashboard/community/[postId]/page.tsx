'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '@/app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { ForumPost, ForumReply } from '@/types';
import { checkSeriesEnrollment, awardPoints, sendNotification, POINTS } from '@/lib/community';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ThumbsUp, CheckCircle, ShieldCheck, ArrowLeft, MoreHorizontal, Trash2, Edit2, Pin, Flag, EyeOff, Share2, Megaphone, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useUserStore } from '@/stores/useUserStore';
import { formatDistanceToNow } from 'date-fns';
import DOMPurify from 'dompurify';
import { RichTextEditor } from '@/components/RichTextEditor';
import { UnifiedHeader } from '@/components/unified-header';

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
    const [editImage, setEditImage] = useState<string | null>(null);
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

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
                content: replyContent,
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
            const reply = replies.find(r => r.id === replyId);
            const isVerifying = !reply?.isVerified; // Toggle logic if needed, but usually verify is one-way or explicit toggle

            await updateDoc(doc(db, 'forum_replies', replyId), {
                isVerified: isVerifying
            });

            // Only set post to solved if verifying. If un-verifying, we might need to check if other replies are verified (complex), 
            // but simpler to just toggle post solved state if this was the only solution. 
            // For now, let's assume verifying sets Solved to true.
            if (isVerifying) {
                await updateDoc(doc(db, 'forum_posts', postId as string), {
                    isSolved: true
                });

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
            }

            toast.success(isVerifying ? 'Answer Verified' : 'Verification removed');
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
        if (!editPostTitle.trim() || editPostContent.replace(/<[^>]*>/g, '').trim().length === 0) {
            toast.error("Title and content cannot be empty");
            return;
        }

        try {
            setIsUploading(true);
            let finalImageUrl = editImage;

            if (editImageFile && user) {
                const storageRef = ref(storage, `community/${user.uid}/${Date.now()}_${editImageFile.name}`);
                const snapshot = await uploadBytes(storageRef, editImageFile);
                finalImageUrl = await getDownloadURL(snapshot.ref);
            }

            await updateDoc(doc(db, 'forum_posts', postId as string), {
                title: editPostTitle,
                content: editPostContent,
                images: finalImageUrl ? [finalImageUrl] : [],
                editedAt: serverTimestamp()
            });

            setPost(prev => prev ? {
                ...prev,
                title: editPostTitle,
                content: editPostContent,
                images: finalImageUrl ? [finalImageUrl] : [],
                editedAt: serverTimestamp() as any
            } : null);

            setIsEditingPost(false);
            setEditImageFile(null);
            toast.success('Post updated');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update post');
        } finally {
            setIsUploading(false);
        }
    };

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
            setEditImageFile(file);
            setEditImage(URL.createObjectURL(file));
        }
    };

    const handleUpvote = async (collectionName: 'forum_posts' | 'forum_replies', id: string, currentUpvotedBy: string[]) => {
        if (!user) return;
        const isUpvoted = currentUpvotedBy.includes(user.uid);
        const docRef = doc(db, collectionName, id);

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
            updateState(!isUpvoted);
            toast.error('Upvote failed');
        }
    };

    if (!post) return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
    );

    const isAnnouncement = post.type === 'announcement';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Simplified Header */}
            <UnifiedHeader
                title="Community Discussion"
                subtitle="View post and answers"
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800"
            >
                <Button variant="ghost" size="sm" onClick={() => router.push(backLink)} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Feed
                </Button>
            </UnifiedHeader>

            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">

                {/* Main Post */}
                <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative
                    ${isAnnouncement ? 'ring-2 ring-amber-400/50 shadow-amber-500/10' : ''}
                `}>
                    {isAnnouncement && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-2 flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 border-b border-amber-100 dark:border-amber-800/50">
                            <Megaphone className="w-4 h-4" /> Official Announcement
                        </div>
                    )}

                    <div className="p-6 md:p-10 space-y-6">
                        {/* Post Header Meta */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 ring-2 ring-slate-50 dark:ring-slate-800">
                                    <AvatarFallback className={`text-sm font-bold ${post.authorRole === 'teacher' ? 'bg-indigo-100 text-indigo-700' : post.authorRole === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-600'}`}>
                                        {post.authorName[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-900 dark:text-white">{post.authorName}</h3>
                                        {post.authorRole !== 'student' && (
                                            <Badge variant="secondary" className="text-[10px] h-5">{post.authorRole}</Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500">{formatDistanceToNow(post.createdAt?.toDate ? post.createdAt.toDate() : new Date(), { addSuffix: true })}</p>
                                </div>
                            </div>

                            {/* Actions Menu */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                        <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {user?.uid === post.authorId && (
                                        <>
                                            <DropdownMenuItem onClick={() => {
                                                setEditPostTitle(post.title);
                                                setEditPostContent(post.content);
                                                setEditImage(post.images && post.images.length > 0 ? post.images[0] : null);
                                                setIsEditingPost(true);
                                            }}>
                                                <Edit2 className="w-4 h-4 mr-2" /> Edit Post
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                                if (confirm('Delete this post?')) {
                                                    // Logic mostly placeholder for now in this refactor
                                                    toast.info("Delete logic here");
                                                }
                                            }} className="text-red-600">
                                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuItem>
                                        <Flag className="w-4 h-4 mr-2" /> Report
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Title & Edit Mode */}
                        {isEditingPost ? (
                            <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Title</label>
                                    <Input value={editPostTitle} onChange={e => setEditPostTitle(e.target.value)} className="font-bold text-lg" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Content</label>
                                    <RichTextEditor value={editPostContent} onChange={setEditPostContent} className="min-h-[200px]" />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" onClick={() => setIsEditingPost(false)}>Cancel</Button>
                                    <Button onClick={handleEditPost}>Save Changes</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                                    {post.isPinned && <Pin className="inline w-6 h-6 text-purple-600 mr-2 rotate-45 align-top" />}
                                    {post.title}
                                </h1>

                                <div className="prose prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 prose-p:leading-relaxed prose-headings:font-bold prose-a:text-purple-600 hover:prose-a:underline">
                                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} className="question-content" />
                                </div>

                                {post.images && post.images.length > 0 && (
                                    <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <Image
                                            src={post.images[0]}
                                            alt="Attachment"
                                            width={800}
                                            height={600}
                                            className="w-full h-auto max-h-[500px] object-contain"
                                            unoptimized={!post.images[0].startsWith('https://firebasestorage.googleapis.com')}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer Stats / Actions */}
                        <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => handleUpvote('forum_posts', post.id, post.upvotedBy || [])}
                                    className={`rounded-full border-slate-200 dark:border-slate-700 ${post.upvotedBy?.includes(user?.uid || '') ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800' : ''}`}
                                >
                                    <ThumbsUp className={`mr-2 h-4 w-4 ${post.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                    {post.upvotes} Upvotes
                                </Button>
                                <Button variant="ghost" className="rounded-full text-slate-500">
                                    <Share2 className="mr-2 h-4 w-4" /> Share
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-slate-500 border-slate-200 dark:border-slate-700">{post.subject}</Badge>
                                {post.isSolved && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><CheckCircle className="w-3 h-3 mr-1" /> Solved</Badge>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Answers Divider */}
                <div className="flex items-center gap-4 py-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 w-8 h-8 rounded-full flex items-center justify-center text-sm">{replies.length}</span>
                        Answers
                    </h2>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                </div>

                {/* Answers List */}
                <div className="space-y-6">
                    {replies.map((reply) => (
                        <div key={reply.id} className={`group relative p-6 md:p-8 rounded-3xl border transition-all duration-300
                            ${reply.isVerified
                                ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                            }
                        `}>
                            {reply.isVerified && (
                                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1.5 rounded-bl-2xl rounded-tr-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Answer
                                </div>
                            )}

                            <div className="flex gap-4">
                                <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-slate-900">
                                    <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold">{reply.authorName[0]}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1 space-y-3">
                                    {/* Reply Meta */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 dark:text-white">{reply.authorName}</span>
                                                {reply.authorRole !== 'student' && <Badge variant="secondary" className="text-[10px] h-5">{reply.authorRole}</Badge>}
                                            </div>
                                            <p className="text-xs text-slate-500">{reply.createdAt?.toDate ? formatDistanceToNow(reply.createdAt.toDate()) + ' ago' : ''}</p>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {(userRole === 'admin' || userRole === 'teacher') && (
                                                <Button size="sm" variant="ghost" onClick={() => handleVerify(reply.id)} className={reply.isVerified ? "text-emerald-600" : "text-slate-400 hover:text-emerald-600"}>
                                                    <ShieldCheck className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {(user?.uid === reply.authorId || userRole === 'admin') && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleDeleteReply(reply.id, reply.authorId)} className="text-red-600">Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reply Content */}
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reply.content) }} className="question-content" />
                                    </div>

                                    {/* Reply Actions */}
                                    <div className="pt-2 flex items-center gap-4">
                                        <button
                                            onClick={() => handleUpvote('forum_replies', reply.id, reply.upvotedBy || [])}
                                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors
                                                ${reply.upvotedBy?.includes(user?.uid || '')
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            <ThumbsUp className={`w-3.5 h-3.5 ${reply.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                            {reply.upvotes} Helpful
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sticky Post Answer Box */}
                <div className="sticky bottom-4 z-30">
                    <div className="absolute -inset-4 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent dark:from-slate-950 dark:via-slate-950/90 pointer-events-none" />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-200 dark:border-slate-800 p-4 ring-1 ring-black/5">
                        <div className="flex gap-4">
                            <Avatar className="h-8 w-8 hidden md:block">
                                <AvatarFallback className="bg-purple-100 text-purple-600 text-xs font-bold">You</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-3">
                                <RichTextEditor
                                    value={replyContent}
                                    onChange={setReplyContent}
                                    placeholder="Know the answer? Share your wisdom..."
                                    className="min-h-[100px] max-h-[200px] overflow-y-auto bg-slate-50 dark:bg-slate-950/50 border-0 focus-within:ring-0"
                                />
                                <div className="flex justify-end">
                                    <Button onClick={handlePostReply} disabled={isSubmitting || !replyContent} className="rounded-full bg-purple-600 hover:bg-purple-700 text-white">
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Answer'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
