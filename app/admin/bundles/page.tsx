'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { ArrowLeft, Edit, Plus, Trash2, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Bundle } from '@/types';
import { BundleModal } from '@/components/admin/bundles/BundleModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { glassmorphism } from '@/lib/design-tokens';

export default function BundlesPage() {
    const router = useRouter();
    const [bundles, setBundles] = useState<Bundle[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'bundles'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bundle));
            setBundles(data);
        });
        return () => unsubscribe();
    }, []);

    const handleEdit = (bundle: Bundle) => {
        setSelectedBundle(bundle);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this bundle?')) {
            try {
                await deleteDoc(doc(db, 'bundles', id));
                toast.success('Bundle deleted');
            } catch (error) {
                toast.error('Failed to delete bundle');
            }
        }
    };

    const handleCreate = () => {
        setSelectedBundle(null);
        setIsModalOpen(true);
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-blue-100 dark:border-blue-900`}>
                <div className="flex justify-between items-center">
                    <div>
                        <Button
                            variant="ghost"
                            className="mb-2 pl-0 hover:pl-2 transition-all"
                            onClick={() => router.push('/dashboard/admin')}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                        </Button>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <Package className="w-10 h-10 text-blue-600" />
                            Bundle Management
                        </h1>
                        <p className="text-slate-500 mt-2">Create packages of multiple series for unified enrollment.</p>
                    </div>
                    <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
                        <Plus className="mr-2 h-4 w-4" /> Create Bundle
                    </Button>
                </div>
            </div>

            {/* Bundles List */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Included Series</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bundles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                    No bundles found. Create your first bundle to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            bundles.map((bundle) => (
                                <TableRow key={bundle.id}>
                                    <TableCell className="font-medium">{bundle.name}</TableCell>
                                    <TableCell>Rs. {bundle.price}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{bundle.seriesIds?.length || 0} Series</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={bundle.active ? 'default' : 'destructive'} className={bundle.active ? 'bg-green-500' : ''}>
                                            {bundle.active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="icon" variant="ghost" onClick={() => handleEdit(bundle)}>
                                            <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => handleDelete(bundle.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <BundleModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                bundle={selectedBundle}
                onSuccess={() => setIsModalOpen(false)}
            />
        </div>
    );
}
