'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, FileText, Users } from 'lucide-react';

interface TestSummary {
    _id: string;
    title: string;
    status: string;
    createdAt: string;
    batches: string[];
}

export default function AdminDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [tests, setTests] = useState<TestSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (session?.user?.role !== 'admin') {
            router.push('/dashboard');
            return;
        }

        fetch('/api/tests')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setTests(data);
                } else {
                    console.error('Failed to fetch tests:', data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [status, session, router]);

    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <Link href="/admin/tests/create">
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Test
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tests.length}</div>
                    </CardContent>
                </Card>
                {/* Add more stats cards here */}
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Recent Tests</h2>
                {loading ? (
                    <div>Loading...</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {tests.map(test => (
                            <Card key={test._id} className="hover:bg-accent/50 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="flex justify-between items-start">
                                        <span>{test.title}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${test.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {test.status}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">
                                        Created: {new Date(test.createdAt).toLocaleDateString()}
                                    </p>
                                    <div className="mt-4 flex gap-2">
                                         <Link href={`/admin/tests/${test._id}/edit`}>
                                        {/* <Link href={`/admin/tests/${test._id}/upload`}> */}
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </Link>
                                        <Link href={`/admin/tests/${test._id}/results`}>
                                            <Button variant="secondary" size="sm">Results</Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
