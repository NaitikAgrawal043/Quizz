'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function DetailedResultPage({ params }: { params: Promise<{ id: string, attemptId: string }> }) {
    const { id, attemptId } = use(params);
    const router = useRouter();
    const { toast } = useToast();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updatingGrade, setUpdatingGrade] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const res = await fetch(`/api/attempts/${attemptId}/result`);
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error('Failed to fetch results', err);
                toast({
                    title: 'Error',
                    description: 'Failed to load detailed results',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [attemptId, toast]);

    const handleUpdateGrade = async (questionId: string, isCorrect: boolean, originalMarks: number) => {
        setUpdatingGrade(prev => ({ ...prev, [questionId]: true }));
        try {
            const awardedMarks = isCorrect ? originalMarks : 0;
            const res = await fetch(`/api/admin/attempts/${attemptId}/grade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId, isCorrect, awardedMarks }),
            });

            if (!res.ok) throw new Error('Failed to update grade');

            const json = await res.json();
            
            // Update local state
            setData((prevData: any) => {
                const newResults = prevData.results.map((item: any) => {
                    if (item.questionId === questionId) {
                        return { ...item, isCorrect, awardedMarks };
                    }
                    return item;
                });
                return { ...prevData, score: json.score, results: newResults };
            });

            toast({ title: 'Success', description: 'Grade updated successfully' });
        } catch (err) {
            console.error(err);
            toast({
                title: 'Error',
                description: 'Failed to update grade',
                variant: 'destructive',
            });
        } finally {
            setUpdatingGrade(prev => ({ ...prev, [questionId]: false }));
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center flex-col items-center h-[50vh] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Retrieving detailed report...</p>
            </div>
        );
    }

    if (!data || data.error) {
        return (
            <div className="container mx-auto p-6">
                <p className="text-red-500">Failed to load results. {data?.error}</p>
                <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
            </div>
        );
    }

    const totalQuestions = data.results?.length || 0;
    const correctCount = data.results?.filter((r: any) => r.isCorrect).length || 0;
    const incorrectCount = totalQuestions - correctCount;

    return (
        <div className="container mx-auto p-6 space-y-8">
            <Button variant="ghost" className="mb-4 pl-0" onClick={() => router.push(`/admin/tests/${id}/results`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Results
            </Button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Detailed Analysis
                    </h1>
                    <p className="text-muted-foreground">Review and manually override student grades</p>
                </div>
                <Card className="bg-primary/5 border-primary/20 w-full md:w-auto">
                    <CardContent className="p-4 flex items-center justify-between gap-8">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Total Score</p>
                            <div className="text-3xl font-bold text-primary">{data.score} <span className="text-lg text-muted-foreground">/ {data.totalMarks}</span></div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <span className="font-medium">{correctCount} Correct</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <XCircle className="h-5 w-5 text-red-500" />
                                <span className="font-medium">{incorrectCount} Incorrect</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Review */}
            <div className="space-y-6">
                {data.results?.map((item: any, i: number) => (
                    <div
                        key={i}
                        className={`group bg-card border rounded-lg overflow-hidden transition-all shadow-sm ${item.isCorrect ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"}`}
                    >
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <div className="flex gap-3">
                                    <span className="font-mono text-muted-foreground font-medium pt-1">Q{i + 1}.</span>
                                    <div className="text-lg font-medium" dangerouslySetInnerHTML={{ __html: item.question.stem }} />
                                </div>
                                
                                <div className="flex items-center gap-3 shrink-0 bg-muted/50 p-2 rounded-lg">
                                    <span className="text-sm font-medium mr-2">Grade Override:</span>
                                    <Button
                                        size="sm"
                                        variant={item.isCorrect ? "default" : "outline"}
                                        className={item.isCorrect ? "bg-green-600 hover:bg-green-700" : ""}
                                        onClick={() => handleUpdateGrade(item.questionId, true, item.question.marks)}
                                        disabled={updatingGrade[item.questionId] || item.isCorrect}
                                    >
                                        {updatingGrade[item.questionId] && !item.isCorrect ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                        Correct
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={!item.isCorrect ? "default" : "outline"}
                                        className={!item.isCorrect ? "bg-red-600 hover:bg-red-700" : ""}
                                        onClick={() => handleUpdateGrade(item.questionId, false, item.question.marks)}
                                        disabled={updatingGrade[item.questionId] || !item.isCorrect}
                                    >
                                        {updatingGrade[item.questionId] && item.isCorrect ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                                        Incorrect
                                    </Button>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 ml-8 md:ml-10 text-sm">
                                <div className="space-y-1">
                                    <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Student's Answer</span>
                                    <div className={`p-3 rounded border font-medium ${item.isCorrect ? 'bg-green-50/50 border-green-200 text-green-900' : 'bg-red-50/50 border-red-200 text-red-900'}`}>
                                        {item.userAnswer !== null && item.userAnswer !== undefined ? JSON.stringify(item.userAnswer) : <span className="italic text-muted-foreground">Not Answered</span>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Correct Answer</span>
                                    <div className="p-3 rounded border bg-muted/30 font-medium">
                                        {JSON.stringify(item.question.correctAnswer)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
