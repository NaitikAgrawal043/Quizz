'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Download, Printer, Users, Trophy, Clock } from 'lucide-react';

interface Result {
    _id: string;
    user: {
        name: string;
        rollNumber?: number;
    };
    batch: string;
    score: number;
    submittedAt: string;
}

export default function TestResultsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { toast } = useToast();
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(true);
    const [testTitle, setTestTitle] = useState('Test');
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const res = await fetch(`/api/tests/${id}/results`);
                if (!res.ok) throw new Error('Failed to fetch results');
                const data = await res.json();
                setResults(data);
            } catch (error) {
                console.error(error);
                toast({
                    title: 'Error',
                    description: 'Failed to load test results',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [id, toast]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadCSV = () => {
        if (results.length === 0) return;

        const headers = ['Roll No', 'Name', 'Batch', 'Score', 'Submitted At'];
        const rows = results.map(r => [
            r.user.rollNumber || '-',
            r.user.name,
            r.batch,
            r.score,
            new Date(r.submittedAt).toLocaleString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `test-results-${id}.csv`;
        link.click();
    };

    // Stats
    const totalAttempts = results.length;
    const avgScore = totalAttempts > 0 ? (results.reduce((sum, r) => sum + r.score, 0) / totalAttempts).toFixed(1) : 0;
    const highestScore = totalAttempts > 0 ? Math.max(...results.map(r => r.score)) : 0;

    return (
        <div className="container mx-auto p-6 space-y-6 print:p-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            Test Results
                        </h1>
                        <p className="text-muted-foreground text-sm">View and export student performance</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleDownloadCSV} disabled={results.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button variant="default" onClick={handlePrint} disabled={results.length === 0}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print / PDF
                    </Button>
                </div>
            </div>

            {/* Print Header (only visible when printing) */}
            <div className="hidden print:block text-center mb-4">
                <h1 className="text-2xl font-bold">Test Results</h1>
                <p className="text-sm text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3 print:hidden">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalAttempts}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                        <Clock className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgScore}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
                        <Trophy className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{highestScore}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Results Table */}
            <Card className="print:shadow-none print:border-none">
                <CardHeader className="print:pb-2">
                    <CardTitle>Student Performance</CardTitle>
                    <CardDescription className="print:hidden">
                        Sorted by Roll Number (ascending)
                    </CardDescription>
                </CardHeader>
                <CardContent ref={tableRef}>
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-2 text-muted-foreground">Loading results...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No attempts found for this test.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-semibold">Roll No</TableHead>
                                        <TableHead className="font-semibold">Name</TableHead>
                                        <TableHead className="font-semibold">Batch</TableHead>
                                        <TableHead className="font-semibold text-center">Score</TableHead>
                                        <TableHead className="font-semibold print:hidden">Submitted</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map((result, index) => (
                                        <TableRow
                                            key={result._id}
                                            className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                                        >
                                            <TableCell className="font-medium tabular-nums">
                                                {result.user.rollNumber || '-'}
                                            </TableCell>
                                            <TableCell>{result.user.name}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                                                    {result.batch}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-semibold ${result.score >= highestScore ? 'text-green-600' : ''
                                                    }`}>
                                                    {result.score}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground print:hidden">
                                                {new Date(result.submittedAt).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .container, .container * {
                        visibility: visible;
                    }
                    .container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .hidden.print\\:block {
                        display: block !important;
                    }
                }
            `}</style>
        </div>
    );
}
