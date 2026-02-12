'use client';

import { ForumPost } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, MessageSquare, Pin, Megaphone, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { db } from '@/app/firebase';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';

interface PostCardProps {
    post: ForumPost;
    currentUserId?: string;
}

export function PostCard({ post, currentUserId }: PostCardProps) {
    const isAnnouncement = post.type === 'announcement';
    const [isUpvoted, setIsUpvoted] = useState(post.upvotedBy?.includes(currentUserId || '') || false);
    const [upvoteCount, setUpvoteCount] = useState(post.upvotes || 0);

    // Extract first image if available or from content
    const featureImage = post.images?.[0] || extractFirstImage(post.content);
    const previewContent = post.content.replace(/<[^>]*>/g, '').substring(0, 140) + (post.content.length > 140 ? '...' : '');

    const handleUpvote = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUserId) {
            toast.error('Please login to upvote');
            return;
        }

        const newIsUpvoted = !isUpvoted;
        setIsUpvoted(newIsUpvoted);
        setUpvoteCount(prev => newIsUpvoted ? prev + 1 : prev - 1);

        try {
            const docRef = doc(db, 'forum_posts', post.id);
            await updateDoc(docRef, {
                upvotes: increment(newIsUpvoted ? 1 : -1),
                upvotedBy: newIsUpvoted ? arrayUnion(currentUserId) : arrayRemove(currentUserId)
            });
        } catch (error) {
            setIsUpvoted(!newIsUpvoted);
            setUpvoteCount(prev => !newIsUpvoted ? prev + 1 : prev - 1);
            toast.error('Failed to upvote');
        }
    };

    return (
        <Link href={`/dashboard/community/${post.id}`} className="block group w-full max-w-5xl mx-auto">
            <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                <Card className={`relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl
                    ${isAnnouncement
                        ? 'ring-1 ring-yellow-500/40 bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/10 dark:to-orange-900/10'
                        : 'border border-white/20 dark:border-white/5'
                    }
                `}>
                    {/* Announcement Glow */}
                    {isAnnouncement && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    )}

                    <div className="flex flex-col sm:flex-row h-full">
                        {/* Left Side (Content) */}
                        <div className="flex-1 p-6 md:p-8 flex flex-col gap-4">
                            {/* Meta Header */}
                            <div className="flex items-center gap-3 text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                <Avatar className="h-8 w-8 ring-2 ring-white dark:ring-slate-800 shadow-sm">
                                    <AvatarFallback className={`text-[10px] font-bold ${getRoleColor(post.authorRole)}`}>
                                        {post.authorName[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{post.authorName}</span>
                                {post.authorRole !== 'student' && (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal tracking-wide">
                                        {post.authorRole.toUpperCase()}
                                    </Badge>
                                )}
                                <span className="flex items-center gap-1 opacity-70">
                                    <Clock className="w-3 h-3" />
                                    {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                                </span>
                            </div>

                            {/* Main Content */}
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                    <h3 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 leading-tight">
                                        {post.isPinned && <Pin className="inline w-5 h-5 text-blue-500 mr-2 transform rotate-45" />}
                                        {isAnnouncement && <Megaphone className="inline w-5 h-5 text-yellow-500 mr-2" />}
                                        {post.title}
                                    </h3>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 line-clamp-2 md:line-clamp-3 leading-relaxed">
                                    {previewContent}
                                </p>
                            </div>

                            {/* Footer / Actions */}
                            <div className="mt-auto pt-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleUpvote}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                                            ${isUpvoted
                                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                            }`}
                                    >
                                        <ThumbsUp className={`w-3.5 h-3.5 ${isUpvoted ? "fill-current" : ""}`} />
                                        {upvoteCount}
                                    </button>

                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-xs font-medium">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        {post.replyCount} Replies
                                    </div>

                                    {post.subject && (
                                        <Badge variant="outline" className="hidden sm:inline-flex border-slate-200 dark:border-slate-700 text-slate-500">
                                            {post.subject}
                                        </Badge>
                                    )}
                                </div>

                                {post.isSolved && (
                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 border-0 shadow-none">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Solved
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Right Side (Feature Image - Desktop) */}
                        {featureImage && (
                            <div className="hidden sm:block w-48 h-auto relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/10 z-10" />
                                <img
                                    src={featureImage}
                                    alt="Preview"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            </div>
                        )}

                        {/* Mobile Image (Banner) */}
                        {featureImage && (
                            <div className="sm:hidden w-full h-40 relative overflow-hidden order-first">
                                <img
                                    src={featureImage}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}
                    </div>
                </Card>
            </motion.div>
        </Link>
    );
}

// Helper to extract first image src from HTML content
function extractFirstImage(htmlContent: string): string | null {
    if (!htmlContent) return null;
    const match = htmlContent.match(/<img[^>]+src="([^">]+)"/);
    return match ? match[1] : null;
}

function getRoleColor(role: string) {
    switch (role) {
        case 'teacher': return 'bg-indigo-100 text-indigo-700';
        case 'admin': return 'bg-rose-100 text-rose-700';
        default: return 'bg-gradient-to-br from-blue-500 to-purple-500 text-white';
    }
}
