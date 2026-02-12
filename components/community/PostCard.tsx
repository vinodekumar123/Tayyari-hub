'use client';

import { ForumPost } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, ThumbsUp, Share2, MoreHorizontal, User, Shield, GraduationCap, MapPin, BookOpen, Clock, Megaphone, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
// import { useCommunityStore } from '@/stores/useCommunityStore'; // Removed
import { useState } from 'react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { glassmorphism } from '@/lib/design-tokens';
import DOMPurify from 'dompurify';
import { db } from '@/app/firebase';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';

interface PostCardProps {
    post: ForumPost;
    currentUserId?: string;
}

export function PostCard({ post, currentUserId }: PostCardProps) {
    // const { toggleUpvote } = useCommunityStore(); // Removed
    const [isUpvoted, setIsUpvoted] = useState(post.upvotedBy?.includes(currentUserId || '') || false);
    const [upvoteCount, setUpvoteCount] = useState(post.upvotes || 0);
    const [isHovered, setIsHovered] = useState(false);

    const handleUpvote = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUserId) {
            toast.error('Please login to upvote');
            return;
        }

        // Optimistic update
        const newIsUpvoted = !isUpvoted;
        setIsUpvoted(newIsUpvoted);
        setUpvoteCount(prev => newIsUpvoted ? prev + 1 : prev - 1);

        try {
            // await toggleUpvote(post.id, currentUserId);
            const docRef = doc(db, 'forum_posts', post.id);
            if (newIsUpvoted) {
                await updateDoc(docRef, {
                    upvotes: increment(1),
                    upvotedBy: arrayUnion(currentUserId)
                });
            } else {
                await updateDoc(docRef, {
                    upvotes: increment(-1),
                    upvotedBy: arrayRemove(currentUserId)
                });
            }
        } catch (error) {
            // Revert
            setIsUpvoted(!newIsUpvoted);
            setUpvoteCount(prev => !newIsUpvoted ? prev + 1 : prev - 1);
            toast.error('Failed to upvote');
        }
    };

    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(`${window.location.origin}/dashboard/community/${post.id}`);
        toast.success('Link copied to clipboard');
    };

    // Sanitize HTML content
    const sanitizedContent = DOMPurify.sanitize(post.content);

    // Helper to extract text from HTML for preview length check if needed
    // but for now relying on line-clamp and max-height logic in CSS/JS

    const isAnnouncement = post.type === 'announcement';

    return (
        <Link href={`/dashboard/community/${post.id}`} className="block group">
            <Card
                className={`overflow-hidden transition-all duration-300 border hover:border-purple-500/30
                ${isAnnouncement
                        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border-yellow-200 dark:border-yellow-800'
                        : 'bg-white/60 dark:bg-slate-900/40 border-white/20 dark:border-white/10 hover:shadow-lg hover:shadow-purple-500/5'
                    } backdrop-blur-md`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="p-5 sm:p-6">
                    {/* Header: Author & Meta */}
                    <div className="flex flex-wrap justify-between items-start mb-4 gap-2">
                        <div className="flex items-center gap-3">
                            <Avatar className={`h-10 w-10 border-2 ${isAnnouncement ? 'border-yellow-400' : 'border-white dark:border-slate-700'} shadow-sm`}>
                                <AvatarFallback className={`${post.authorRole === 'teacher' ? 'bg-indigo-100 text-indigo-700' : post.authorRole === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {post.authorName ? post.authorName.charAt(0) : '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-foreground">{post.authorName}</span>
                                    {post.authorRole === 'teacher' && <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-100"><GraduationCap className="w-3 h-3 mr-1" /> Teacher</Badge>}
                                    {post.authorRole === 'admin' && <Badge variant="secondary" className="text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-100"><Shield className="w-3 h-3 mr-1" /> Admin</Badge>}
                                    {isAnnouncement && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600 bg-yellow-50"><Megaphone className="w-3 h-3 mr-1" /> Announcement</Badge>}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}</span>
                                    {post.province && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {post.province}</span>}
                                </div>
                            </div>
                        </div>

                        {post.isSolved && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 gap-1 pl-1 pr-2">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Solved
                            </Badge>
                        )}
                    </div>

                    {/* Content */}
                    <div className="mb-4 space-y-2">
                        <h3 className={`text-lg font-bold leading-tight group-hover:text-purple-600 transition-colors ${isAnnouncement ? 'text-slate-900 dark:text-slate-100' : 'text-slate-800 dark:text-slate-100'}`}>
                            {post.title}
                        </h3>

                        <div className="text-sm text-muted-foreground line-clamp-3">
                            {/* Render sanitized HTML safely */}
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                                style={{ maxHeight: '100px', overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
                            />
                        </div>

                        {/* Subject Badge */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/50">
                                <BookOpen className="w-3 h-3 mr-1" /> {post.subject}
                            </Badge>
                            {post.chapter && (
                                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800">
                                    {post.chapter}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Image Preview (First one only) */}
                    {post.images && post.images.length > 0 && (
                        <div className="mb-4 rounded-xl overflow-hidden h-48 w-full bg-slate-100 dark:bg-slate-900 relative border border-slate-200 dark:border-slate-800">
                            <img src={post.images[0]} alt="Post attachment" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`gap-2 hover:bg-purple-50 hover:text-purple-600 ${isUpvoted ? 'text-purple-600 bg-purple-50/50' : 'text-muted-foreground'}`}
                                onClick={handleUpvote}
                            >
                                <ThumbsUp className={`h-4 w-4 ${isUpvoted ? 'fill-current' : ''}`} />
                                <span className={isUpvoted ? 'font-bold' : ''}>{upvoteCount}</span>
                                <span className="sr-only">Upvotes</span>
                            </Button>

                            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:bg-blue-50 hover:text-blue-600">
                                <MessageSquare className="h-4 w-4" />
                                <span>{post.replyCount || 0}</span>
                                <span className="sr-only">Replies</span>
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-slate-100 rounded-full" onClick={handleShare}>
                                <Share2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
