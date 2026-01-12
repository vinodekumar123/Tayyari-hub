'use client';

import { useState, useEffect } from 'react';
import {
    collection, query, where, getDocs, updateDoc, doc, addDoc,
    onSnapshot, orderBy, Timestamp
} from 'firebase/firestore';
import { auth, db } from '@/app/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Sidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle, MessageSquare, Clock, ArrowRight, DollarSign, X
} from 'lucide-react';
import { Task, TaskComment } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { glassmorphism } from '@/lib/design-tokens';

export default function TeacherTasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);
                const q = query(collection(db, 'tasks'), where('assignedTo', '==', u.uid));
                const unsubTasks = onSnapshot(q, (snap) => {
                    const t = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
                    // Client-side sort if index missing
                    t.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setTasks(t);
                });
                return () => unsubTasks();
            }
        });
        return () => unsub();
    }, []);

    // Load comments when task selected
    useEffect(() => {
        if (selectedTask) {
            const q = query(collection(db, `tasks/${selectedTask.id}/comments`), orderBy('createdAt', 'asc'));
            const unsub = onSnapshot(q, (snap) => {
                setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskComment)));
            });
            return () => unsub();
        }
    }, [selectedTask]);

    const handleStatusUpdate = async (taskId: string, status: 'in_progress' | 'completed') => {
        try {
            await updateDoc(doc(db, 'tasks', taskId), { status });
            toast.success(`Task marked as ${status.replace('_', ' ')}`);
        } catch (e) {
            toast.error("Status update failed");
        }
    };

    const postComment = async () => {
        if (!selectedTask || !newComment.trim()) return;
        try {
            await addDoc(collection(db, `tasks/${selectedTask.id}/comments`), {
                userId: user.uid,
                userName: user.displayName || 'Teacher',
                text: newComment,
                createdAt: Timestamp.now()
            });
            setNewComment('');
        } catch (e) {
            toast.error("Failed to post comment");
        }
    };

    return (
        <div className="p-4 md:p-8 flex flex-col md:flex-row gap-6 h-full relative">

            {/* Task List */}
            <div className="flex-1 space-y-6">
                {/* Header */}
                <div className="relative group mb-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
                    <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2">
                                    My Tasks
                                </h1>
                                <p className="text-muted-foreground font-semibold flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]" />
                                    Manage your assigned work
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {tasks.map(task => (
                        <Card
                            key={task.id}
                            className={cn("cursor-pointer transition-all hover:shadow-md border-l-4",
                                selectedTask?.id === task.id ? "ring-2 ring-[#00B4D8]" : "",
                                task.status === 'completed' ? "border-l-[#00B4D8] opacity-75" : "border-l-[#004AAD]"
                            )}
                            onClick={() => setSelectedTask(task)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between">
                                    <CardTitle className="text-lg">{task.title}</CardTitle>
                                    <Badge variant={task.status === 'completed' ? 'secondary' : 'default'}>{task.status.replace('_', ' ')}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm line-clamp-2 text-muted-foreground">{task.description}</p>
                                <div className="flex items-center gap-4 mt-3 text-xs font-medium">
                                    <span className="flex items-center text-[#004AAD]"><DollarSign className="w-3 h-3 mr-1" />{task.paymentAmount}</span>
                                    <span className="flex items-center text-slate-500"><Clock className="w-3 h-3 mr-1" />Due: {task.endDate?.toDate().toLocaleDateString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {tasks.length === 0 && <p className="text-center text-muted-foreground p-10">No tasks assigned yet.</p>}
                </div>
            </div>

            {/* Task Details Sidebar */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 md:static md:z-auto w-full md:w-[400px] border-l-0 md:border-l bg-white dark:bg-slate-900 h-full overflow-y-auto p-6 shadow-xl animate-in slide-in-from-right-10 md:slide-in-from-right-0">
                    <div className="mb-6 pb-6 border-b">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-2xl font-bold">{selectedTask.title}</h2>
                            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedTask(null)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <Badge>{selectedTask.status.replace('_', ' ')}</Badge>
                            <Badge variant="outline" className="text-[#004AAD] border-[#004AAD]">${selectedTask.paymentAmount}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{selectedTask.description}</p>

                        <div className="mt-6 flex flex-col gap-2">
                            {selectedTask.status === 'pending' && (
                                <Button onClick={() => handleStatusUpdate(selectedTask.id, 'in_progress')} className="w-full">Start Task</Button>
                            )}
                            {selectedTask.status === 'in_progress' && (
                                <Button onClick={() => handleStatusUpdate(selectedTask.id, 'completed')} className="w-full bg-[#00B4D8] hover:bg-[#004AAD]">Mark as Completed</Button>
                            )}
                            {selectedTask.status === 'reviewed' && (
                                <div className="bg-yellow-50 p-3 rounded-lg mt-2 text-sm">
                                    <strong>Admin Review: </strong> {selectedTask.reviewFeedback} ({selectedTask.rating}★)
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Comments Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Discussion</h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {comments.map(c => (
                                <div key={c.id} className={cn("p-3 rounded-lg text-sm", c.userId === user.uid ? "bg-blue-50 ml-8 text-right" : "bg-gray-50 mr-8")}>
                                    <div className="font-bold text-xs mb-1">{c.userName}</div>
                                    {c.text}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Textarea
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Type a message..."
                                className="min-h-[60px]"
                            />
                            <Button size="icon" onClick={postComment} disabled={!newComment.trim()}><ArrowRight className="w-4 h-4" /></Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
