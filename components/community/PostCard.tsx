'use client';

import { ForumPost } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, MessageSquare, Pin, Megaphone, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import NextImage from 'next/image';
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

    // Create preview content: Strip HTML -> Decode Entities -> Truncate
    const rawText = post.content.replace(/<[^>]*>/g, ' ');
    const decodedText = decodeHtmlEntities(rawText);
    const previewContent = decodedText.substring(0, 180) + (decodedText.length > 180 ? '...' : '');

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
        <Link href={`/dashboard/community/${post.id}`} className="block group w-full mx-auto">
            <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
                <Card className={`relative overflow-hidden border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-900/50 rounded-2xl
                    ${isAnnouncement ? 'bg-gradient-to-r from-sky-50/50 to-blue-50/50 dark:from-sky-950/10 dark:to-blue-950/10 border-l-4 border-l-blue-400' : ''}
                `}>
                    <div className="flex flex-col md:flex-row h-full">
                        {/* Main Content Side */}
                        <div className="flex-1 p-5 md:p-6 flex flex-col gap-3">

                            {/* Top Meta Row */}
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6 ring-1 ring-slate-100 dark:ring-slate-800">
                                        <AvatarFallback className={`text-[9px] font-bold ${getRoleColor(post.authorRole)}`}>
                                            {post.authorName[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium text-slate-700 dark:text-slate-300 hover:underline decoration-slate-300 underline-offset-2 transition-all">
                                        {post.authorName}
                                    </span>
                                    {post.authorRole !== 'student' && (
                                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-normal tracking-wide rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0">
                                            {post.authorRole}
                                        </Badge>
                                    )}
                                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                                    <span>{post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}</span>
                                </div>

                                {isAnnouncement && (
                                    <div className="flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase">
                                        <Megaphone className="w-3 h-3" /> Announcement
                                    </div>
                                )}
                            </div>

                            {/* Title & Preview */}
                            <div className="space-y-2">
                                <h3 className={`text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-start gap-2
                                    ${post.isPinned ? 'pr-8' : ''}
                                `}>
                                    {post.isPinned && <Pin className="w-5 h-5 text-blue-500 fill-blue-500/10 rotate-45 shrink-0 mt-1" />}
                                    {post.title}
                                </h3>
                                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 line-clamp-2 md:line-clamp-3 leading-relaxed">
                                    {previewContent}
                                </p>
                            </div>

                            {/* Tags / Subject */}
                            {post.subject && (
                                <div className="mt-1">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        {post.subject}
                                    </span>
                                </div>
                            )}

                            {/* Footer Actions */}
                            <div className="mt-auto pt-4 flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-500">
                                <button
                                    onClick={handleUpvote}
                                    className={`flex items-center gap-1.5 transition-colors group/upvote
                                        ${isUpvoted
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "hover:text-blue-600 dark:hover:text-blue-400"
                                        }`}
                                >
                                    <ThumbsUp className={`w-4 h-4 transition-transform group-hover/upvote:-translate-y-0.5 ${isUpvoted ? "fill-current" : ""}`} />
                                    <span>{upvoteCount}</span>
                                </button>

                                <div className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-300 transition-colors">
                                    <MessageSquare className="w-4 h-4" />
                                    <span>{post.replyCount}</span>
                                </div>

                                {post.isSolved && (
                                    <div className="ml-auto flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full text-xs">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        <span>Solved</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side Image (Desktop) */}
                        {featureImage && (
                            <div className="hidden md:block w-48 shrink-0 relative m-2 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800/50">
                                <NextImage
                                    src={featureImage}
                                    alt="Preview"
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    unoptimized={!featureImage.startsWith('https://firebasestorage.googleapis.com')}
                                />
                            </div>
                        )}

                        {/* Mobile Image (Banner) - Only show if no desktop image or generic fallback? Actually better to just standardise */}
                        {featureImage && (
                            <div className="md:hidden w-full h-48 relative overflow-hidden order-first bg-slate-100 dark:bg-slate-800">
                                <NextImage
                                    src={featureImage}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized={!featureImage.startsWith('https://firebasestorage.googleapis.com')}
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

// Helper to decode HTML entities
function decodeHtmlEntities(text: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

function getRoleColor(role: string) {
    switch (role) {
        case 'teacher': return 'bg-indigo-100 text-indigo-700';
        case 'admin': return 'bg-rose-100 text-rose-700';
        default: return 'bg-blue-100 text-blue-700'; // Student now uses nice blue
    }
}
