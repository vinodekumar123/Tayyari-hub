'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Bundle, Series } from '@/types';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { toast } from 'react-hot-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface BundleModalProps {
    isOpen: boolean;
    onClose: () => void;
    bundle?: Bundle | null;
    onSuccess: () => void;
}

export const BundleModal = ({ isOpen, onClose, bundle, onSuccess }: BundleModalProps) => {
    const [loading, setLoading] = useState(false);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [formData, setFormData] = useState<Partial<Bundle>>({
        name: '',
        description: '',
        price: 0,
        active: true,
        seriesIds: []
    });

    useEffect(() => {
        const fetchSeries = async () => {
            try {
                const snap = await getDocs(collection(db, 'series'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Series));
                setSeriesList(list);
            } catch (error) {
                console.error("Error fetching series:", error);
                toast.error("Failed to load series list.");
            }
        };
        if (isOpen) {
            fetchSeries();
        }
    }, [isOpen]);

    useEffect(() => {
        if (bundle) {
            setFormData(bundle);
        } else {
            setFormData({
                name: '',
                description: '',
                price: 0,
                active: true,
                seriesIds: []
            });
        }
    }, [bundle, isOpen]);

    const handleSave = async () => {
        if (!formData.name || !formData.price || formData.seriesIds?.length === 0) {
            toast.error('Please fill required fields and select at least one series.');
            return;
        }

        setLoading(true);
        try {
            if (bundle?.id) {
                await updateDoc(doc(db, 'bundles', bundle.id), formData);
                toast.success('Bundle updated successfully');
            } else {
                await addDoc(collection(db, 'bundles'), {
                    ...formData,
                    createdAt: new Date().toISOString()
                });
                toast.success('Bundle created successfully');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error saving bundle:", error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleSeriesSelection = (seriesId: string) => {
        const currentIds = new Set(formData.seriesIds || []);
        if (currentIds.has(seriesId)) {
            currentIds.delete(seriesId);
        } else {
            currentIds.add(seriesId);
        }
        setFormData({ ...formData, seriesIds: Array.from(currentIds) });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{bundle ? 'Edit Bundle' : 'Create New Bundle'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bundle Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Freshers Complete Bundle"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Price (Rs.)</Label>
                            <Input
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Bundle details..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Select Series to Include</Label>
                        <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                            {seriesList.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No series found. Create series first.</p>
                            ) : (
                                seriesList.map((series) => (
                                    <div key={series.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`series-${series.id}`}
                                            checked={formData.seriesIds?.includes(series.id)}
                                            onCheckedChange={() => toggleSeriesSelection(series.id)}
                                        />
                                        <Label htmlFor={`series-${series.id}`} className="cursor-pointer flex-1">
                                            <span className="font-medium">{series.name}</span>
                                            <span className="text-muted-foreground text-xs ml-2">({series.uniqueId})</span>
                                        </Label>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                        <Label>Active Status</Label>
                        <Switch
                            checked={formData.active}
                            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Bundle'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
