'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Clock, ArrowRight, Loader2, CheckCircle2, FileText, BarChart3 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Test {
    _id: string;
    title: string;
    durationSeconds: number;
    status: string;
    attempt: {
        _id: string;
        status: 'in_progress' | 'submitted' | 'graded' | 'grading';
        score?: number;
    } | null;
}

export default function UserDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (searchParams.get('submitted') === 'true') {
            toast({
                title: "Test Submitted Successfully",
                description: "Your answers have been recorded. Results will be available shortly.",
                variant: "default",
                className: "bg-green-50 border-green-200 text-green-900",
            });
            // Clear the param
            router.replace('/dashboard');
        }
    }, [searchParams, router, toast]);

    useEffect(() => {
        if (status === 'authenticated') {
            if (session?.user?.role === 'admin') {
                router.push('/admin');
                return;
            }

            fetch('/api/tests/user-attempts')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setTests(data);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
    }, [status, session, router]);

    if (status === 'loading' || loading) {
        return <div className="flex justify-center flex-col items-center h-[50vh] gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>;
    }

    if (status === 'unauthenticated') {
        return (
            <div className="container mx-auto p-6 text-center max-w-md mt-20">
                <h1 className="text-2xl font-bold mb-4">Please Log In</h1>
                <p className="text-muted-foreground mb-6">You need to be signed in to access your planned tests.</p>
                <Link href="/login">
                    <Button className="w-full">Go to Login</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Welcome back, {session?.user?.name}
                    </p>
                </div>
            </div>

            {tests.length === 0 ? (
                <div className="text-center py-20 border rounded-lg bg-muted/10 border-dashed">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Tests Assigned</h3>
                    <p className="text-muted-foreground">You don't have any pending tests right now.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {tests.map(test => (
                        <Card key={test._id} className="group hover:shadow-md transition-all duration-300 border-l-4 border-l-primary/20 hover:border-l-primary">
                            <CardHeader className="pb-3">
                                <CardTitle className="leading-tight text-xl">{test.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4" />
                                        <span>{Math.floor(test.durationSeconds / 60)} mins</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <FileText className="h-4 w-4" />
                                        <span>Exam</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-3 border-t bg-muted/5">
                                {!test.attempt ? (
                                    <Link href={`/test/${test._id}/start`} className="w-full">
                                        <Button className="w-full shadow-sm">
                                            Start Exam <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </Link>
                                ) : test.attempt.status === 'in_progress' ? (
                                    <Link href={`/test/${test.attempt._id}`} className="w-full">
                                        <Button className="w-full" variant="secondary">
                                            Resume Exam <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </Link>
                                ) : (
                                    <Link href={`/test/${test.attempt._id}/result`} className="w-full">
                                        <Button className="w-full" variant="outline">
                                            <BarChart3 className="mr-2 h-4 w-4" />
                                            View Report {(test.attempt.score !== undefined) &&
                                                <span className="ml-1 font-semibold text-foreground">
                                                    ({test.attempt.score})
                                                </span>
                                            }
                                        </Button>
                                    </Link>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
