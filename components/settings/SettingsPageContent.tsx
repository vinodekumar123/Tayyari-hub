'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
} from 'firebase/firestore';
import { db, auth } from '@/app/firebase';
import { toast } from 'sonner';
import type { FormState, SubjectItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, User, Mail, Phone, Book, GraduationCap, School, BookOpen, Layers, BarChart, Calendar } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';

interface SettingsPageContentProps {
    title?: string;
    role?: 'admin' | 'teacher';
}

export function SettingsPageContent({ title = "Profile Settings", role = 'admin' }: SettingsPageContentProps) {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<FormState>({
        fullName: '',
        email: '',
        phone: '',
        metadata: {
            course: '',
            courseId: '',
            subject: '',
            subjectId: '',
            chapter: '',
            chapterId: '',
            topic: '',
            difficulty: '',
            year: '',
            book: '',
            teacher: '',
        },
        subjects: [],
    });

    const [allCourses, setAllCourses] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [availableChapters, setAvailableChapters] = useState<string[]>([]);
    const difficulties = ['Easy', 'Medium', 'Hard'];
    const years = Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => (2000 + i).toString());

    const fetchCoursesFromFirestore = useCallback(async () => {
        const snapshot = await getDocs(collection(db, 'courses'));
        const courseData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        setAllCourses(courseData);
    }, []);

    const fetchAllSubjects = useCallback(async () => {
        const snapshot = await getDocs(collection(db, 'subjects'));
        const subjects = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: (doc.data() as any).name || '',
            ...(doc.data() as any),
        }));
        setAllSubjects(subjects);
        setAvailableSubjects(subjects.map((s: any) => s.name));
    }, []);

    const fetchUserData = useCallback(async (uid: string) => {
        try {
            const userRef = doc(db, 'users', uid);
            const snapshot = await getDoc(userRef);
            if (snapshot.exists()) {
                const data = snapshot.data();
                setForm((prev) => ({
                    ...prev,
                    ...data,
                    metadata: {
                        ...prev.metadata,
                        ...(data.metadata || {}),
                    },
                    subjects: Array.isArray(data.subjects) ? data.subjects : prev.subjects,
                }));

                // Initial filtering based on assigned subjects
                if (data.subjects && Array.isArray(data.subjects) && data.subjects.length > 0) {
                    const assignedIds = new Set(data.subjects);
                    const validSubjects = allSubjects.filter(s => assignedIds.has(s.id) || assignedIds.has(s.name));
                    if (validSubjects.length > 0) {
                        setAvailableSubjects(validSubjects.map(s => s.name));
                    } else {
                        setAvailableSubjects(data.subjects);
                    }
                }
            }
        } catch (err) {
            toast.error('Failed to load profile.');
        } finally {
            setLoading(false);
        }
    }, [allSubjects]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setForm((prev) => ({ ...prev, email: user.email || '' }));
                await fetchUserData(user.uid);
            } else {
                setLoading(false);
            }
        });

        fetchCoursesFromFirestore();
        fetchAllSubjects();

        return () => unsubscribe();
    }, [fetchUserData, fetchCoursesFromFirestore, fetchAllSubjects]);

    // Dependent Filters
    useEffect(() => {
        const assigned = (form as any).subjects;
        if (assigned && Array.isArray(assigned) && assigned.length > 0 && allSubjects.length > 0) {
            const assignedSet = new Set(assigned);
            const filtered = allSubjects.filter(s => assignedSet.has(s.id) || assignedSet.has(s.name));
            if (filtered.length > 0) {
                setAvailableSubjects(filtered.map(s => s.name));
            } else {
                setAvailableSubjects(assigned);
            }
        }
    }, [allSubjects, form, loading]);


    const handleInputChange = (field: string, value: any) => {
        setForm((prev) => ({
            ...prev,
            metadata: { ...prev.metadata, [field]: value },
        }));
    };

    const handleSave = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', userId), {
                ...form,
                metadata: {
                    ...form.metadata,
                    teacher: form.fullName, // Auto-update teacher name if using this profile
                },
                updatedAt: new Date(),
            });
            toast.success('✅ Profile updated successfully!');
        } catch (err) {
            console.error(err);
            toast.error('Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleCourseSelect = (courseName: string) => {
        const selected = allCourses.find((c) => c.name === courseName);
        if (!selected) return;

        handleInputChange('course', courseName);
        handleInputChange('courseId', selected.id);
        handleInputChange('subject', '');
        handleInputChange('subjectId', '');
        handleInputChange('chapter', '');
        handleInputChange('chapterId', '');
        setAvailableChapters([]);
    };

    const handleSubjectSelect = (subjectName: string) => {
        handleInputChange('subject', subjectName);
        handleInputChange('subjectId', '');
        handleInputChange('chapter', '');
        handleInputChange('chapterId', '');
        setAvailableChapters([]);

        const selectedSubject = allSubjects.find((s) => s.name === subjectName);
        if (!selectedSubject) return;

        handleInputChange('subjectId', selectedSubject.id);
        const chapters = selectedSubject.chapters || {};
        setAvailableChapters(Object.keys(chapters));
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-5xl py-8 space-y-8 animate-in fade-in duration-500">

            {/* Header Section */}
            <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl blur-xl opacity-20 transition-opacity duration-500" />
                <div className={`${glassmorphism.light} p-8 rounded-3xl border border-white/20 shadow-xl relative z-10`}>
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <User className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400">
                                {title}
                            </h1>
                            <p className="text-muted-foreground font-medium">
                                Manage your personal details and default teaching preferences.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Personal Info Card */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-black/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-500" />
                                Personal Info
                            </CardTitle>
                            <CardDescription>Your basic contact information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullname">Full Name</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="fullname"
                                        value={form.fullName}
                                        onChange={(e) => setForm(prev => ({ ...prev, fullName: e.target.value }))}
                                        className="pl-9 bg-white/50"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        value={form.email}
                                        readOnly
                                        disabled
                                        className="pl-9 bg-gray-100/50 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="phone"
                                        value={form.phone}
                                        onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                                        className="pl-9 bg-white/50"
                                        placeholder="+92 ..."
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        onClick={handleSave}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25 h-12 text-lg"
                        disabled={saving}
                    >
                        {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                        Save Changes
                    </Button>
                </div>

                {/* Metadata Defaults Card */}
                <div className="lg:col-span-2">
                    <Card className="border-0 shadow-lg bg-white/80 dark:bg-black/40 backdrop-blur-xl h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-purple-500" />
                                Question Metadata Defaults
                            </CardTitle>
                            <CardDescription>Set your default preferences for quick question creation</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-muted-foreground" /> Course
                                </Label>
                                <Select value={form.metadata?.course || ''} onValueChange={handleCourseSelect}>
                                    <SelectTrigger className="bg-white/50">
                                        <SelectValue placeholder="Select Course" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allCourses.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Book className="w-4 h-4 text-muted-foreground" /> Subject
                                </Label>
                                <Select value={form.metadata?.subject || ''} onValueChange={handleSubjectSelect}>
                                    <SelectTrigger className="bg-white/50">
                                        <SelectValue placeholder="Select Subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-muted-foreground" /> Chapter
                                </Label>
                                <Select
                                    value={form.metadata?.chapter || ''}
                                    onValueChange={(v) => {
                                        handleInputChange('chapter', v);
                                        handleInputChange('chapterId', v);
                                    }}
                                    disabled={!form.metadata?.subject}
                                >
                                    <SelectTrigger className="bg-white/50">
                                        <SelectValue placeholder="Select Chapter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableChapters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <BarChart className="w-4 h-4 text-muted-foreground" /> Difficulty
                                </Label>
                                <Select value={form.metadata?.difficulty || ''} onValueChange={(v) => handleInputChange('difficulty', v)}>
                                    <SelectTrigger className="bg-white/50">
                                        <SelectValue placeholder="Select Difficulty" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {difficulties.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted-foreground" /> Year
                                </Label>
                                <Select value={form.metadata?.year || ''} onValueChange={(v) => handleInputChange('year', v)}>
                                    <SelectTrigger className="bg-white/50">
                                        <SelectValue placeholder="Select Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <School className="w-4 h-4 text-muted-foreground" /> Book / Reference
                                </Label>
                                <Input
                                    value={form.metadata?.book || ''}
                                    onChange={(e) => handleInputChange('book', e.target.value)}
                                    className="bg-white/50"
                                    placeholder="e.g. Text Book Board"
                                />
                            </div>

                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
