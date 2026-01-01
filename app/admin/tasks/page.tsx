'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    collection, query, where, getDocs, addDoc, updateDoc, doc,
    deleteDoc, Timestamp, orderBy, getDoc
} from 'firebase/firestore';
import { auth, db } from '@/app/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Sidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Plus, Calendar, DollarSign, Star, CheckCircle, Clock,
    AlertCircle, Search, Filter, MoreVertical, Trash2, Edit
} from 'lucide-react';
import { Task } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AdminTasksPage() {
    const router = useRouter();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState<{ uid: string, name: string, role?: string }[]>([]);

    // Auth State
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Filter State
    const [statusFilter, setStatusFilter] = useState('all');
    const [teacherFilter, setTeacherFilter] = useState('all');

    // Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Task>>({
        priority: 'medium',
        status: 'pending',
        paymentStatus: 'pending'
    });

    // Review State
    const [reviewData, setReviewData] = useState({ rating: 5, feedback: '' });

    // Review Stars Helper
    const renderStars = (rating: number) => {
        return Array(5).fill(0).map((_, i) => (
            <Star key={i} className={cn("w-4 h-4", i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />
        ));
    };

    // --- Init ---
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const isSup = data.role === 'superadmin' || data.superadmin === true;
                    setIsSuperAdmin(isSup);
                    if (data.role !== 'admin' && !isSup && data.admin !== true) {
                        router.push('/dashboard/teacher'); // Redirect if not admin
                    }
                }
                fetchData();
            } else {
                router.push('/');
            }
        });
        return () => unsub();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Potential Assignees
            // Teachers (Always)
            const teachersQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
            const teachersSnap = await getDocs(teachersQ);
            let assignees = teachersSnap.docs.map(d => ({
                uid: d.data().uid,
                name: d.data().fullName || d.data().email,
                role: 'Teacher'
            }));

            // If SuperAdmin, also fetch Admins
            if (isSuperAdmin) {
                // Fetch by role 'admin'
                const adminsQ = query(collection(db, 'users'), where('role', '==', 'admin'));
                const adminsSnap = await getDocs(adminsQ);
                // Also handle legacy 'admin: true' if separate? Assuming 'role' is migrated or main source.
                // Let's safe bet: users where admin == true
                const legacyAdminsQ = query(collection(db, 'users'), where('admin', '==', true));
                const legacyAdminsSnap = await getDocs(legacyAdminsQ);

                const adminDocs = [...adminsSnap.docs, ...legacyAdminsSnap.docs];
                // Dedup by uid
                const adminAssignees = adminDocs.map(d => ({
                    uid: d.data().uid,
                    name: d.data().fullName || d.data().email,
                    role: 'Admin'
                })).filter(a => !assignees.find(ex => ex.uid === a.uid)); // Avoid dupes if user has both

                assignees = [...assignees, ...adminAssignees];
            }

            setTeachers(assignees);

            // Fetch Tasks
            const tasksQ = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
            const tasksSnap = await getDocs(tasksQ);
            const loadedTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
            setTasks(loadedTasks);

        } catch (e) {
            console.error("Error fetching data", e);
            toast.error("Failed to load tasks");
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleCreateTask = async () => {
        if (!formData.title || !formData.assignedTo || !formData.paymentAmount) {
            toast.error("Please fill required fields (Title, Teacher, Payment)");
            return;
        }

        try {
            const assignedTeacher = teachers.find(t => t.uid === formData.assignedTo);

            const payload = {
                ...formData,
                assignedToName: assignedTeacher?.name || 'Unknown',
                assignedBy: currentUser.uid,
                status: 'pending',
                paymentStatus: 'pending',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                // Ensure dates are timestamps if set as strings (simplified for this example)
                startDate: formData.startDate ? Timestamp.fromDate(new Date(formData.startDate)) : Timestamp.now(),
                endDate: formData.endDate ? Timestamp.fromDate(new Date(formData.endDate)) : Timestamp.now(),
            };

            await addDoc(collection(db, 'tasks'), payload);
            toast.success("Task created successfully");
            setIsCreateOpen(false);
            setFormData({ priority: 'medium', paymentStatus: 'pending' });
            fetchData();
        } catch (e) {
            console.error("Create error", e);
            toast.error("Failed to create task");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteDoc(doc(db, 'tasks', id));
            toast.success("Task deleted");
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (e) {
            toast.error("Delete failed");
        }
    };

    const handleReviewSubmit = async () => {
        if (!selectedTask) return;
        try {
            await updateDoc(doc(db, 'tasks', selectedTask.id), {
                status: 'reviewed',
                rating: reviewData.rating,
                reviewFeedback: reviewData.feedback,
                updatedAt: Timestamp.now()
            });
            toast.success("Review submitted");
            setIsReviewOpen(false);
            fetchData();
        } catch (e) {
            toast.error("Review failed");
        }
    };

    const handleMarkPaid = async (task: Task) => {
        if (!isSuperAdmin) return;
        try {
            await updateDoc(doc(db, 'tasks', task.id), {
                paymentStatus: 'paid',
                paymentDate: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            toast.success("Marked as paid");
            fetchData();
        } catch (e) {
            toast.error("Update failed");
        }
    }

    // --- Derived Data ---
    const filteredTasks = tasks.filter(t => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (teacherFilter !== 'all' && t.assignedTo !== teacherFilter) return false;
        return true;
    });

    const totalRevenue = tasks.filter(t => t.paymentStatus === 'paid').reduce((acc, t) => acc + Number(t.paymentAmount || 0), 0);
    const pendingRevenue = tasks.filter(t => t.paymentStatus === 'pending').reduce((acc, t) => acc + Number(t.paymentAmount || 0), 0);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="mb-8">
                <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#004AAD] to-[#00B4D8]">
                    Task Management
                </h1>
                <p className="text-muted-foreground mt-2">Assign, review, and manage teacher payments.</p>
            </div>

            <Tabs defaultValue="tasks" className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="tasks">Tasks Board</TabsTrigger>
                    {isSuperAdmin && <TabsTrigger value="financials">Financials</TabsTrigger>}
                </TabsList>

                <TabsContent value="tasks" className="space-y-6">
                    {/* Filters & Actions */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="reviewed">Reviewed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Teachers" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Teachers</SelectItem>
                                    {teachers.map(t => <SelectItem key={t.uid} value={t.uid}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" /> Create Task
                        </Button>
                    </div>

                    {/* Task Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTasks.map(task => (
                            <Card key={task.id} className="hover:shadow-lg transition-all border-l-4" style={{
                                borderLeftColor: task.status === 'completed' ? '#10b981' : task.status === 'pending' ? '#f59e0b' : '#3b82f6'
                            }}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant={task.status === 'reviewed' ? 'default' : 'secondary'}>{task.status.replace('_', ' ')}</Badge>
                                        <div className="flex gap-2">
                                            {task.status === 'completed' && (
                                                <Button size="sm" variant="outline" onClick={() => { setSelectedTask(task); setIsReviewOpen(true); }}>
                                                    <Star className="w-4 h-4 text-yellow-500" />
                                                </Button>
                                            )}
                                            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(task.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg">{task.title}</CardTitle>
                                    <CardDescription>Assigned to: <span className="font-semibold text-blue-600">{task.assignedToName}</span></CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{task.description}</p>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center">
                                            <Calendar className="w-3 h-3 mr-1" />
                                            Due: {task.endDate?.toDate().toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center font-bold text-green-600">
                                            <DollarSign className="w-3 h-3 mr-1" />
                                            {task.paymentAmount}
                                        </div>
                                    </div>

                                    {task.status === 'reviewed' && (
                                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
                                            <div className="flex mb-1">{renderStars(task.rating || 0)}</div>
                                            <p className="text-xs italic">"{task.reviewFeedback}"</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="financials">
                    {isSuperAdmin ? (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="bg-green-50 border-green-200">
                                    <CardHeader><CardTitle className="text-green-700">Total Paid</CardTitle></CardHeader>
                                    <CardContent><div className="text-4xl font-bold text-green-800">${totalRevenue.toLocaleString()}</div></CardContent>
                                </Card>
                                <Card className="bg-amber-50 border-amber-200">
                                    <CardHeader><CardTitle className="text-amber-700">Pending Payments</CardTitle></CardHeader>
                                    <CardContent><div className="text-4xl font-bold text-amber-800">${pendingRevenue.toLocaleString()}</div></CardContent>
                                </Card>
                            </div>

                            {/* Payment Table */}
                            <Card>
                                <CardHeader><CardTitle>Payment Overview</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="relative w-full overflow-auto">
                                        <table className="w-full caption-bottom text-sm text-left">
                                            <thead className="[&_tr]:border-b">
                                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Task</th>
                                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Teacher</th>
                                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Amount</th>
                                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="[&_tr:last-child]:border-0">
                                                {tasks.map(t => (
                                                    <tr key={t.id} className="border-b transition-colors hover:bg-muted/50">
                                                        <td className="p-4">{t.title}</td>
                                                        <td className="p-4">{t.assignedToName}</td>
                                                        <td className="p-4 font-bold">${t.paymentAmount}</td>
                                                        <td className="p-4">
                                                            <Badge variant={t.paymentStatus === 'paid' ? 'outline' : 'destructive'} className={t.paymentStatus === 'paid' ? "text-green-600 border-green-600" : ""}>
                                                                {t.paymentStatus}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-4">
                                                            {t.paymentStatus === 'pending' && (
                                                                <Button size="sm" onClick={() => handleMarkPaid(t)}>Mark Paid</Button>
                                                            )}
                                                            {t.paymentStatus === 'paid' && (
                                                                <span className="text-xs text-muted-foreground">{t.paymentDate?.toDate().toLocaleDateString()}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-red-500">Access Restricted</div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Create Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input placeholder="Task Title" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        <Textarea placeholder="Instructions..." value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <Select onValueChange={v => setFormData({ ...formData, assignedTo: v })}>
                                <SelectTrigger><SelectValue placeholder="Assign Teacher" /></SelectTrigger>
                                <SelectContent>
                                    {teachers.map(t => <SelectItem key={t.uid} value={t.uid}>{t.name} ({t.role})</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select onValueChange={v => setFormData({ ...formData, priority: v as any })} defaultValue="medium">
                                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs mb-1 block">Start Date</label>
                                <Input type="date" onChange={e => setFormData({ ...formData, startDate: e.target.value as any })} />
                            </div>
                            <div>
                                <label className="text-xs mb-1 block">Due Date</label>
                                <Input type="date" onChange={e => setFormData({ ...formData, endDate: e.target.value as any })} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs mb-1 block">Payment Amount ($)</label>
                            <Input type="number" placeholder="0.00" onChange={e => setFormData({ ...formData, paymentAmount: Number(e.target.value) })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateTask}>Create Task</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review Modal */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Review Task</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex gap-2 justify-center">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                    key={star}
                                    className={cn("w-8 h-8 cursor-pointer", reviewData.rating >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-300")}
                                    onClick={() => setReviewData({ ...reviewData, rating: star })}
                                />
                            ))}
                        </div>
                        <Textarea placeholder="Feedback for teacher..." value={reviewData.feedback} onChange={e => setReviewData({ ...reviewData, feedback: e.target.value })} />
                    </div>
                    <DialogFooter>
                        <Button onClick={handleReviewSubmit}>Submit Review</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div >
    );
}
