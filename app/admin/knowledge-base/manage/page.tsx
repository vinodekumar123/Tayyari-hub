'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Trash2, Eye, RotateCcw, Search, ArrowLeft, FileText, Book, Database } from 'lucide-react';
import {
    getKnowledgeBaseDocuments,
    getKnowledgeBaseStats,
    deleteKnowledgeBaseDocument,
    deleteMultipleKnowledgeBaseDocuments,
    getDocumentById,
    getAllSubjectsWithChapters, // Changed from getUniqueSubjects
    KnowledgeBaseDocument
} from '@/app/actions/knowledgeBaseManagement';
import Link from 'next/link';

export default function ManageKnowledgeBasePage() {
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [subjects, setSubjects] = useState<{ id: string; name: string; chapters: Record<string, boolean> }[]>([]);

    // Filters
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [chapterFilter, setChapterFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Pagination
    const [lastDocId, setLastDocId] = useState<string | undefined>();
    const [hasMore, setHasMore] = useState(false);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modals
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; id?: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [docsRes, statsRes, subjectsRes] = await Promise.all([
                getKnowledgeBaseDocuments({ limit: 50 }),
                getKnowledgeBaseStats(),
                getAllSubjectsWithChapters()
            ]);

            if (docsRes.success) {
                setDocuments(docsRes.documents || []);
                setLastDocId(docsRes.lastDocId);
                setHasMore(docsRes.hasMore || false);
            }

            if (statsRes.success) {
                setStats(statsRes.stats);
            }

            if (subjectsRes.success) {
                setSubjects(subjectsRes.subjects);
            }

        } catch (error) {
            console.error(error);
            toast.error('Failed to load knowledge base');
        } finally {
            setLoading(false);
        }
    };

    const loadFiltered = async () => {
        setLoading(true);
        try {
            const docsRes = await getKnowledgeBaseDocuments({
                limit: 50,
                subjectFilter: subjectFilter !== 'all' ? subjectFilter : undefined,
                typeFilter: typeFilter !== 'all' ? typeFilter : undefined,
                chapterFilter: chapterFilter !== 'all' ? chapterFilter : undefined
            });

            if (docsRes.success) {
                setDocuments(docsRes.documents || []);
                setLastDocId(docsRes.lastDocId);
                setHasMore(docsRes.hasMore || false);
            }
        } catch (error) {
            toast.error('Failed to filter');
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!lastDocId || !hasMore) return;

        try {
            const docsRes = await getKnowledgeBaseDocuments({
                limit: 50,
                startAfter: lastDocId,
                subjectFilter: subjectFilter !== 'all' ? subjectFilter : undefined,
                typeFilter: typeFilter !== 'all' ? typeFilter : undefined,
                chapterFilter: chapterFilter !== 'all' ? chapterFilter : undefined
            });

            if (docsRes.success) {
                setDocuments(prev => [...prev, ...(docsRes.documents || [])]);
                setLastDocId(docsRes.lastDocId);
                setHasMore(docsRes.hasMore || false);
            }
        } catch (error) {
            toast.error('Failed to load more');
        }
    };

    const handlePreview = async (docId: string) => {
        const res = await getDocumentById(docId);
        if (res.success) {
            setPreviewDoc(res.document);
        } else {
            toast.error('Failed to load document');
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;

        setDeleteLoading(true);
        try {
            if (deleteConfirm.type === 'single' && deleteConfirm.id) {
                const res = await deleteKnowledgeBaseDocument(deleteConfirm.id);
                if (res.success) {
                    setDocuments(prev => prev.filter(d => d.id !== deleteConfirm.id));
                    toast.success('Document deleted');
                } else {
                    toast.error(res.error);
                }
            } else if (deleteConfirm.type === 'bulk') {
                const ids = Array.from(selectedIds);
                const res = await deleteMultipleKnowledgeBaseDocuments(ids);
                if (res.success) {
                    setDocuments(prev => prev.filter(d => !selectedIds.has(d.id)));
                    setSelectedIds(new Set());
                    toast.success(`Deleted ${res.deleted} documents`);
                } else {
                    toast.error(res.error);
                }
            }
        } catch (error) {
            toast.error('Delete failed');
        } finally {
            setDeleteLoading(false);
            setDeleteConfirm(null);
            loadData(); // Refresh stats
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === documents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(documents.map(d => d.id)));
        }
    };

    // Filter displayed documents by search
    const displayedDocs = searchQuery
        ? documents.filter(d =>
            d.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.metadata.bookName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.metadata.chapter.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : documents;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="w-8 h-8" />
                        Knowledge Base Manager
                    </h1>
                    <p className="text-slate-500">View, search, and manage uploaded documents</p>
                </div>
                <Link href="/admin/knowledge-base">
                    <Button variant="outline">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Upload More
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <div className="text-sm text-slate-500">Total Documents</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{stats.byType?.book || 0}</div>
                            <div className="text-sm text-slate-500">Books</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{stats.byType?.syllabus || 0}</div>
                            <div className="text-sm text-slate-500">Syllabus</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{Object.keys(stats.bySubject || {}).length}</div>
                            <div className="text-sm text-slate-500">Subjects</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters & Search */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Search content, book name, chapter..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Subjects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {subjects.map(s => (
                                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Chapter Filter */}
                        {subjectFilter !== 'all' && (
                            <Select value={chapterFilter} onValueChange={setChapterFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Chapters" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Chapters</SelectItem>
                                    {subjects.find(s => s.name === subjectFilter)?.chapters &&
                                        Object.keys(subjects.find(s => s.name === subjectFilter)?.chapters || {}).map(ch => (
                                            <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="book">Book</SelectItem>
                                <SelectItem value="syllabus">Syllabus</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={loadFiltered} variant="secondary">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Apply
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="font-medium">{selectedIds.size} selected</span>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConfirm({ type: 'bulk' })}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Selected
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                        Clear Selection
                    </Button>
                </div>
            )}

            {/* Documents Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Documents ({displayedDocs.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        </div>
                    ) : displayedDocs.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            No documents found. Upload some content first!
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={selectedIds.size === documents.length && documents.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Book</TableHead>
                                        <TableHead>Chapter</TableHead>
                                        <TableHead>Page</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Uploaded</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedDocs.map(doc => (
                                        <TableRow key={doc.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(doc.id)}
                                                    onCheckedChange={() => toggleSelect(doc.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{doc.metadata.subject}</TableCell>
                                            <TableCell>{doc.metadata.bookName}</TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={doc.metadata.chapter}>
                                                {doc.metadata.chapter}
                                            </TableCell>
                                            <TableCell>{doc.metadata.page}</TableCell>
                                            <TableCell>
                                                <Badge variant={doc.metadata.type === 'book' ? 'default' : 'secondary'}>
                                                    {doc.metadata.type === 'book' ? <Book className="w-3 h-3 mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
                                                    {doc.metadata.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-sm">
                                                {new Date(doc.metadata.uploadedAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handlePreview(doc.id)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-700"
                                                        onClick={() => setDeleteConfirm({ type: 'single', id: doc.id })}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {hasMore && (
                                <div className="mt-4 flex justify-center">
                                    <Button variant="outline" onClick={loadMore}>
                                        Load More
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Preview Dialog */}
            <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Document Preview</DialogTitle>
                        <DialogDescription>
                            {previewDoc?.metadata?.bookName} - {previewDoc?.metadata?.chapter}
                        </DialogDescription>
                    </DialogHeader>
                    {previewDoc && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><strong>Subject:</strong> {previewDoc.metadata.subject}</div>
                                <div><strong>Type:</strong> {previewDoc.metadata.type}</div>
                                <div><strong>Page:</strong> {previewDoc.metadata.page}</div>
                                <div><strong>Province:</strong> {previewDoc.metadata.province}</div>
                                <div><strong>Year:</strong> {previewDoc.metadata.year}</div>
                                <div><strong>File:</strong> {previewDoc.metadata.fileName}</div>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Content:</h4>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                                    {previewDoc.content}
                                </div>
                            </div>
                            {previewDoc.visual_description && (
                                <div>
                                    <h4 className="font-semibold mb-2">Visual Description:</h4>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm whitespace-pre-wrap">
                                        {previewDoc.visual_description}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                            {deleteConfirm?.type === 'bulk'
                                ? `Are you sure you want to delete ${selectedIds.size} documents? This action cannot be undone.`
                                : 'Are you sure you want to delete this document? This action cannot be undone.'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
