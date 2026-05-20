'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Batch {
    _id: string;
    name: string;
}

export default function CreateTestPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        durationSeconds: 3600,
        selectedBatches: [] as string[],
        status: 'draft' as 'draft' | 'published',
        testDate: '',
    });

    useEffect(() => {
        fetch('/api/batches')
            .then(res => res.json())
            .then(setBatches)
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch('/api/tests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: formData.title,
                description: formData.description,
                durationSeconds: formData.durationSeconds,
                batches: formData.selectedBatches, // Rename to match database field
                status: formData.status,
                testDate: formData.testDate ? new Date(formData.testDate).toISOString() : undefined,
                sections: [], // Initial empty sections
            }),
        });

        if (res.ok) {
            const test = await res.json();
            router.push(`/admin/tests/${test._id}/upload`);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Create New Test</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Test Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="duration">Duration (seconds)</Label>
                            <Input
                                id="duration"
                                type="number"
                                value={formData.durationSeconds}
                                onChange={e => setFormData({ ...formData, durationSeconds: parseInt(e.target.value) })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="testDate">Test Scheduled/Conducted Date</Label>
                            <Input
                                id="testDate"
                                type="datetime-local"
                                value={formData.testDate}
                                onChange={e => setFormData({ ...formData, testDate: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Assign Batches</Label>
                            <div className="flex flex-wrap gap-2">
                                {batches.map(batch => (
                                    <Button
                                        key={batch._id}
                                        type="button"
                                        variant={formData.selectedBatches.includes(batch._id) ? "default" : "outline"}
                                        onClick={() => {
                                            const newBatches = formData.selectedBatches.includes(batch._id)
                                                ? formData.selectedBatches.filter(id => id !== batch._id)
                                                : [...formData.selectedBatches, batch._id];
                                            setFormData({ ...formData, selectedBatches: newBatches });
                                        }}
                                        size="sm"
                                    >
                                        {batch.name}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <div className="flex gap-4">
                                <Button
                                    type="button"
                                    variant={formData.status === 'draft' ? "default" : "outline"}
                                    onClick={() => setFormData({ ...formData, status: 'draft' })}
                                    size="sm"
                                >
                                    Draft
                                </Button>
                                <Button
                                    type="button"
                                    variant={formData.status === 'published' ? "default" : "outline"}
                                    onClick={() => setFormData({ ...formData, status: 'published' })}
                                    size="sm"
                                >
                                    Published
                                </Button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full">Create & Continue to Upload</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
