'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, storage } from '@/app/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUserStore } from '@/stores/useUserStore';
import { ForumPost, ForumReply } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { ArrowLeft, MoreHorizontal, ThumbsUp, MessageSquare, Share2, Flag, Trash2, Edit2, CheckCircle, Pin, Megaphone, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UnifiedHeader } from '@/components/unified-header';
import { RichTextEditor } from '@/components/RichTextEditor';
import { checkSeriesEnrollment, awardPoints, POINTS, sendNotification } from '@/lib/community';
import Image from 'next/image';
import { SanitizedContent } from '@/components/SanitizedContent';

export default function ThreadPage() {
    const { postId } = useParams();
    const router = useRouter();
    const { user } = useUserStore();
    const [post, setPost] = useState<ForumPost | null>(null);
    const [replies, setReplies] = useState<ForumReply[]>([]);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Edit Post State
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [editPostTitle, setEditPostTitle] = useState('');
    const [editPostContent, setEditPostContent] = useState('');
    const [editImage, setEditImage] = useState<string | null>(null);
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Edit Reply State
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    // Reply Image State
    const [replyImageFile, setReplyImageFile] = useState<File | null>(null);
    const [replyImagePreview, setReplyImagePreview] = useState<string | null>(null);
    const replyFileInputRef = useRef<HTMLInputElement>(null);

    const backLink = user?.role === 'student' ? '/dashboard/student/community' : '/dashboard/community';

    useEffect(() => { // Fetch Post
        if (!postId) return;
        const fetchPost = async () => {
            const docRef = doc(db, 'forum_posts', postId as string);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as ForumPost;
                setPost({ id: docSnap.id, ...data });
                setEditPostTitle(data.title);
                setEditPostContent(data.content);
                setEditImage(data.images && data.images.length > 0 ? data.images[0] : null);
            } else {
                toast.error('Post not found');
                router.push(backLink);
            }
            setLoading(false);
        };
        fetchPost();
    }, [postId, router, backLink]);

    useEffect(() => { // Live Replies
        if (!postId) return;
        const q = query(
            collection(db, 'forum_replies'),
            where('postId', '==', postId),
            orderBy('isVerified', 'desc'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const repliesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ForumReply));
            setReplies(repliesData);
        });

        return () => unsubscribe();
    }, [postId]);

    // Need to import 'where' from firestore?
    // Wait, I missed importing 'where' in the import list above.
    // I need to add 'where' to imports.

    const handleReplyImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size must be < 5MB');
                return;
            }
            setReplyImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setReplyImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeReplyImage = () => {
        setReplyImageFile(null);
        setReplyImagePreview(null);
    };

    const handleReply = async () => {
        if (!user || (!replyContent.trim() && !replyImageFile)) return;

        setIsSubmitting(true);
        try {
            if (user.role === 'student') {
                // Check logic if needed, usually responding is allowed if enrolled
            }

            let imageUrl = null;
            if (replyImageFile) {
                const storageRef = ref(storage, `community/replies/${user.uid}/${Date.now()}_${replyImageFile.name}`);
                const snapshot = await uploadBytes(storageRef, replyImageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            await addDoc(collection(db, 'forum_replies'), {
                postId,
                content: replyContent,
                imageUrl: imageUrl, // Save image URL if any
                authorId: user.uid,
                authorName: user.fullName || 'User',
                authorRole: user.role, // Use role from store
                isVerified: false,
                upvotes: 0,
                upvotedBy: [],
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'forum_posts', postId as string), {
                replyCount: increment(1)
            });

            if (user.role === 'student') {
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
            removeReplyImage();
        } catch (error) {
            console.error(error);
            toast.error('Failed to reply');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePost = async () => {
        if (!post || !user) return;

        // Soft Delete for Author, Hard Delete for Admin
        const isAuthor = user.uid === post.authorId;
        const isAdmin = user.role === 'admin';

        if (!isAuthor && !isAdmin) return;

        if (!confirm(isAdmin ? "Permanently delete this post?" : "Delete this post?")) return;

        try {
            if (isAdmin) {
                // Hard Delete
                await deleteDoc(doc(db, 'forum_posts', post.id));
                toast.success('Post permanently deleted');
            } else {
                // Soft Delete
                await updateDoc(doc(db, 'forum_posts', post.id), {
                    isDeleted: true
                });
                toast.success('Post deleted');
            }
            router.push(backLink);
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete post');
        }
    };

    const handleDeleteReply = async (replyId: string, authorId: string) => {
        if (!user) return;
        const canDelete = user.uid === authorId || user.role === 'admin' || user.role === 'teacher';
        if (!canDelete) return;

        if (!confirm('Delete this reply?')) return;

        try {
            await deleteDoc(doc(db, 'forum_replies', replyId));
            await updateDoc(doc(db, 'forum_posts', postId as string), {
                replyCount: increment(-1)
            });
            toast.success('Reply deleted');
        } catch (error) {
            toast.error('Failed to delete reply');
        }
    };

    const handleUpvote = async (collectionName: 'forum_posts' | 'forum_replies', id: string, currentUpvotedBy: string[]) => {
        if (!user) return;
        const isUpvoted = currentUpvotedBy.includes(user.uid);
        const docRef = doc(db, collectionName, id);

        // Optimistic UI update handled locally if we were using complex state, 
        // but here we rely on real-time listener for replies and 'post' state for post
        // We'll update state manually for instant feedback

        if (collectionName === 'forum_posts') {
            setPost(prev => prev ? {
                ...prev,
                upvotes: isUpvoted ? prev.upvotes - 1 : prev.upvotes + 1,
                upvotedBy: isUpvoted ? prev.upvotedBy.filter(u => u !== user.uid) : [...prev.upvotedBy, user.uid]
            } : null);
        }

        // Replies update via snapshot automatically, but for instant feel we can wait or just let it be

        try {
            await updateDoc(docRef, {
                upvotes: increment(isUpvoted ? -1 : 1),
                upvotedBy: isUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid)
            });
        } catch (error) {
            toast.error('Upvote failed');
            // Revert would go here
        }
    };

    const handleVerify = async (replyId: string) => {
        if (user?.role !== 'admin' && user?.role !== 'teacher') return;
        try {
            const reply = replies.find(r => r.id === replyId);
            const isVerifying = !reply?.isVerified;

            await updateDoc(doc(db, 'forum_replies', replyId), {
                isVerified: isVerifying
            });

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
        } catch (error) {
            toast.error('Failed to verify');
        }
    };

    const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size must be < 5MB');
                return;
            }
            setEditImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeEditImage = () => {
        setEditImageFile(null);
        setEditImage(null);
    };

    const submitEditPost = async () => {
        if (!editPostTitle.trim() || editPostContent.replace(/<[^>]*>/g, '').trim().length === 0) {
            toast.error("Title and content cannot be empty");
            return;
        }
        setIsUploading(true);
        try {
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
                images: finalImageUrl ? [finalImageUrl] : []
            } : null);

            setIsEditingPost(false);
            toast.success('Post updated');
        } catch (e) {
            console.error(e);
            toast.error('Update failed');
        } finally {
            setIsUploading(false);
        }
    };

    if (loading || !post) return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    );

    const isAnnouncement = post.type === 'announcement';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            <UnifiedHeader
                title="Community Discussion"
                subtitle="View post and answers"
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800"
            >
                {/* Desktop Back Button */}
                <Button variant="ghost" size="sm" onClick={() => router.push(backLink)} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hidden md:flex">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Feed
                </Button>
            </UnifiedHeader>

            {/* Mobile Back Button - Visible only on mobile */}
            <div className="md:hidden sticky top-16 z-30 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-2">
                <Button variant="ghost" size="sm" onClick={() => router.push(backLink)} className="text-slate-600 dark:text-slate-300 p-0 hover:bg-transparent">
                    <ArrowLeft className="h-5 w-5 mr-2" /> Back to Feed
                </Button>
            </div>

            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">

                {/* Main Post Card */}
                <Card className={`border-0 shadow-lg overflow-hidden
                    ${isAnnouncement
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20'
                        : 'bg-white dark:bg-slate-900'
                    }
                `}>
                    {/* Announcement Banner */}
                    {isAnnouncement && (
                        <div className="bg-amber-100/50 dark:bg-amber-900/30 px-6 py-2 flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                            <Megaphone className="w-4 h-4" /> Official Announcement
                        </div>
                    )}

                    <CardContent className="p-6 md:p-10 space-y-6">
                        {/* Header Meta */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 ring-2 ring-slate-100 dark:ring-slate-800">
                                    <AvatarFallback className={`text-sm font-bold ${post.authorRole === 'teacher' ? 'bg-indigo-100 text-indigo-700' : post.authorRole === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-600'}`}>
                                        {post.authorName[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        {post.authorName}
                                        {post.authorRole !== 'student' && <Badge variant="secondary" className="text-[10px] h-5">{post.authorRole}</Badge>}
                                    </h3>
                                    <p className="text-xs text-slate-500">{formatDistanceToNow(post.createdAt?.toDate ? post.createdAt.toDate() : new Date(), { addSuffix: true })}</p>
                                </div>
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                        <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {user?.uid === post.authorId && (
                                        <DropdownMenuItem onClick={() => setIsEditingPost(true)}>
                                            <Edit2 className="w-4 h-4 mr-2" /> Edit Post
                                        </DropdownMenuItem>
                                    )}
                                    {(user?.uid === post.authorId || user?.role === 'admin') && (
                                        <DropdownMenuItem onClick={handleDeletePost} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem>
                                        <Flag className="w-4 h-4 mr-2" /> Report
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Content */}
                        {isEditingPost ? (
                            <div className="space-y-4 border p-4 rounded-xl">
                                <Input value={editPostTitle} onChange={e => setEditPostTitle(e.target.value)} className="font-bold text-lg" />
                                <RichTextEditor value={editPostContent} onChange={setEditPostContent} />

                                {/* Edit Image Section */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Post Image</label>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => document.getElementById('edit-post-image')?.click()}
                                            className="text-slate-500 hover:text-blue-600"
                                        >
                                            <ImageIcon className="h-4 w-4 mr-2" />
                                            {editImage ? 'Change Image' : 'Add Image'}
                                        </Button>
                                        <Input
                                            id="edit-post-image"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleEditImageSelect}
                                        />

                                        {editImage && (
                                            <div className="relative group">
                                                <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100">
                                                    <img src={editImage} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                                <button
                                                    onClick={removeEditImage}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remove Image"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="ghost" onClick={() => setIsEditingPost(false)}>Cancel</Button>
                                    <Button onClick={submitEditPost} disabled={isUploading}>
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                                    {post.isPinned && <Pin className="inline w-6 h-6 text-blue-600 mr-2 rotate-45" />}
                                    {post.title}
                                </h1>
                                <div className="prose prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                                    <SanitizedContent content={post.content} />
                                </div>
                                {post.images && post.images.length > 0 && (
                                    <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <Image src={post.images[0]} alt="Attachment" width={800} height={600} className="w-full h-auto object-contain max-h-[500px]" unoptimized={!post.images[0].startsWith('https://firebasestorage')} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => handleUpvote('forum_posts', post.id, post.upvotedBy || [])}
                                    className={`rounded-full border-slate-200 dark:border-slate-700 ${post.upvotedBy?.includes(user?.uid || '') ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800' : ''}`}
                                >
                                    <ThumbsUp className={`mr-2 h-4 w-4 ${post.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                    {post.upvotes}
                                </Button>
                            </div>
                            {post.isSolved && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><CheckCircle className="w-3 h-3 mr-1" /> Solved</Badge>}
                        </div>
                    </CardContent>
                </Card>

                {/* Answers Section */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        {replies.length} Answers
                    </h3>

                    <div className="space-y-4">
                        {replies.map((reply) => (
                            <Card key={reply.id} className={`border-0 shadow-sm overflow-hidden transition-all
                                ${reply.isVerified
                                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800'}
                            `}>
                                <div className="p-6">
                                    <div className="flex items-start gap-4">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs font-bold">{reply.authorName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-900 dark:text-white">{reply.authorName}</span>
                                                        {reply.isVerified && (
                                                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 border-0">
                                                                <CheckCircle className="w-3 h-3 mr-1" /> Verified Answer
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500">{reply.createdAt?.toDate ? formatDistanceToNow(reply.createdAt.toDate(), { addSuffix: true }) : 'Just now'}</p>
                                                </div>

                                                {(user?.uid === reply.authorId || user?.role === 'admin' || user?.role === 'teacher') && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => handleDeleteReply(reply.id, reply.authorId)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="prose prose-sm dark:prose-invert text-slate-700 dark:text-slate-300">
                                                <SanitizedContent content={reply.content} />
                                            </div>

                                            {reply.imageUrl && (
                                                <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 w-fit max-w-full">
                                                    <img src={reply.imageUrl} alt="Reply attachment" className="max-h-64 object-contain" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mt-4 ml-12">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleUpvote('forum_replies', reply.id, reply.upvotedBy || [])}
                                            className={reply.upvotedBy?.includes(user?.uid || '') ? 'text-blue-600' : 'text-slate-500'}
                                        >
                                            <ThumbsUp className={`mr-2 h-3 w-3 ${reply.upvotedBy?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                                            {reply.upvotes}
                                        </Button>

                                        {(user?.role === 'teacher' || user?.role === 'admin') && !reply.isVerified && (
                                            <Button variant="ghost" size="sm" onClick={() => handleVerify(reply.id)} className="text-slate-500 hover:text-emerald-600">
                                                <CheckCircle className="mr-2 h-3 w-3" /> Verify Answer
                                            </Button>
                                        )}
                                        {(user?.role === 'teacher' || user?.role === 'admin') && reply.isVerified && (
                                            <Button variant="ghost" size="sm" onClick={() => handleVerify(reply.id)} className="text-emerald-600 hover:text-red-600">
                                                Un-verify
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Reply Input (Non-Sticky) */}
                <Card className="bg-white dark:bg-slate-900 border shadow-sm mt-8">
                    <CardHeader>
                        <CardTitle className="text-lg">Post your answer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <RichTextEditor
                            value={replyContent}
                            onChange={setReplyContent}
                            placeholder="Write your detailed answer here..."
                            className="min-h-[150px]"
                        />

                        {/* Image Upload for Reply */}
                        <div className="flex gap-4 items-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => replyFileInputRef.current?.click()}
                                className="text-slate-500 hover:text-blue-600"
                            >
                                <ImageIcon className="h-4 w-4 mr-2" />
                                {replyImageFile ? 'Change Image' : 'Add Image'}
                            </Button>
                            <Input
                                ref={replyFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleReplyImageSelect}
                            />
                            {replyImageFile && (
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs">
                                    <span className="truncate max-w-[150px]">{replyImageFile.name}</span>
                                    <button onClick={removeReplyImage} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            )}
                        </div>

                        {replyImagePreview && (
                            <div className="w-32 h-32 relative rounded-lg overflow-hidden border">
                                <img src={replyImagePreview} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleReply}
                                disabled={isSubmitting || (!replyContent.trim() && !replyImageFile)}
                                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post Answer'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}

// Missing imports? 'where' was added manually to the imports list in this content block.
