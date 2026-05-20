'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useTest } from '@/hooks/queries/useTest';
import { useUpdateTest } from '@/hooks/mutations/useUpdateTest';

export default function EditTestPage() {
    const router = useRouter();
    const params = useParams();
    const testId = params.id as string;

    const { data: test, isLoading } = useTest(testId);
    const updateTest = useUpdateTest(testId);

    const [title, setTitle] = useState('');
    const [status, setStatus] = useState('draft');
    const [testDate, setTestDate] = useState('');

    // Populate form once data loads
    useEffect(() => {
        if (test) {
            setTitle(test.title);
            setStatus(test.status);
            if (test.testDate) {
                const date = new Date(test.testDate);
                const tzOffset = date.getTimezoneOffset() * 60000;
                const formatted = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
                setTestDate(formatted);
            } else {
                setTestDate('');
            }
        }
    }, [test]);

    const handleUpdate = async () => {
        try {
            await updateTest.mutateAsync({
                title,
                status,
                testDate: testDate ? new Date(testDate).toISOString() : undefined
            });
            router.push('/admin');
        } catch {
            alert('Failed to update test');
        }
    };

    if (isLoading) return (
        <div className="flex justify-center items-center h-[50vh]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
    );

    return (
        <div className="container mx-auto p-6 max-w-xl">
            <Card>
                <CardHeader>
                    <CardTitle>Edit Test</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Test Title</label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Status</label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Test Scheduled/Conducted Date</label>
                        <Input
                            type="datetime-local"
                            value={testDate}
                            onChange={(e) => setTestDate(e.target.value)}
                            required
                        />
                    </div>
                    <Button onClick={handleUpdate} disabled={updateTest.isPending}>
                        {updateTest.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : 'Update Test'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
