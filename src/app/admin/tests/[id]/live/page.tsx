'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTestSocket } from '@/hooks/useTestSocket';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Square,
    Radio,
    Users,
    Loader2,
} from 'lucide-react';

export default function LiveControlPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: testId } = use(params);
    const router = useRouter();
    const [testTitle, setTestTitle] = useState('');
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [sessionStatus, setSessionStatus] = useState<string>('waiting');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const { syncState, isConnected, roomCount } = useTestSocket(testId);

    // Fetch test info and create/get session
    useEffect(() => {
        const init = async () => {
            try {
                // Fetch test info
                const testRes = await fetch(`/api/tests/${testId}`);
                const testData = await testRes.json();
                setTestTitle(testData.title || 'Untitled Test');

                // Fetch question count
                const questionsRes = await fetch(`/api/tests/${testId}/questions`);
                const questionsData = await questionsRes.json();
                setTotalQuestions(Array.isArray(questionsData) ? questionsData.length : 0);

                // Create or get session
                const sessionRes = await fetch(`/api/sessions/${testId}`, { method: 'POST' });
                const sessionData = await sessionRes.json();
                setSessionStatus(sessionData.status || 'waiting');
                setCurrentIndex(sessionData.currentQuestionIndex || 0);
            } catch (err) {
                console.error('Failed to initialize live control:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [testId]);

    // Keep UI in sync with WebSocket events
    useEffect(() => {
        if (syncState) {
            setCurrentIndex(syncState.currentQuestionIndex);
            setSessionStatus(syncState.status);
        }
    }, [syncState]);

    const sendAction = async (action: string, index?: number) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/sessions/${testId}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, index }),
            });
            const data = await res.json();
            if (data.success) {
                setSessionStatus(data.session.status);
                setCurrentIndex(data.session.currentQuestionIndex);
                if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
            }
        } catch (err) {
            console.error('Action failed:', err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        );
    }

    const isActive = sessionStatus === 'active';
    const isPaused = sessionStatus === 'paused';
    const isFinished = sessionStatus === 'finished';
    const isWaiting = sessionStatus === 'waiting';

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-3xl">
            {/* Back link */}
            <Link href="/admin">
                <Button variant="ghost" className="pl-0 hover:pl-2 transition-all">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Admin
                </Button>
            </Link>

            {/* Title & status */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{testTitle}</h1>
                    <p className="text-muted-foreground mt-1">Live Test Control</p>
                </div>
                <Badge
                    variant={isActive ? 'default' : isPaused ? 'secondary' : isFinished ? 'destructive' : 'outline'}
                    className="text-sm px-3 py-1"
                >
                    {isActive && <Radio className="mr-1 h-3 w-3 animate-pulse" />}
                    {sessionStatus.toUpperCase()}
                </Badge>
            </div>

            {/* Connection & student count */}
            <div className="flex gap-4">
                <Card className="flex-1">
                    <CardContent className="pt-6 flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">{isConnected ? 'Socket Connected' : 'Disconnected'}</span>
                    </CardContent>
                </Card>
                <Card className="flex-1">
                    <CardContent className="pt-6 flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">{roomCount} students online</span>
                    </CardContent>
                </Card>
            </div>

            {/* Current Question Display */}
            <Card className="border-2 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-center text-lg text-muted-foreground">Current Question</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <div className="text-7xl font-bold text-primary mb-2">
                        {currentIndex + 1}
                    </div>
                    <p className="text-muted-foreground">of {totalQuestions}</p>
                </CardContent>
            </Card>

            {/* Question Palette */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Question Palette</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: totalQuestions }, (_, i) => (
                            <Button
                                key={i}
                                size="sm"
                                variant={i === currentIndex ? 'default' : 'outline'}
                                className="w-10 h-10"
                                disabled={!isActive && !isPaused}
                                onClick={() => sendAction('GOTO', i)}
                            >
                                {i + 1}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Control Buttons */}
            <div className="flex justify-center gap-4 flex-wrap">
                {isWaiting && (
                    <Button
                        size="lg"
                        className="gap-2"
                        onClick={() => sendAction('START')}
                        disabled={actionLoading}
                    >
                        <Play className="h-5 w-5" />
                        Start Test
                    </Button>
                )}

                {(isActive || isPaused) && (
                    <>
                        <Button
                            size="lg"
                            variant="outline"
                            className="gap-2"
                            onClick={() => sendAction('PREV')}
                            disabled={actionLoading || currentIndex === 0}
                        >
                            <ChevronLeft className="h-5 w-5" />
                            Previous
                        </Button>

                        <Button
                            size="lg"
                            className="gap-2"
                            onClick={() => sendAction('NEXT')}
                            disabled={actionLoading || currentIndex >= totalQuestions - 1}
                        >
                            Next
                            <ChevronRight className="h-5 w-5" />
                        </Button>

                        {isActive ? (
                            <Button
                                size="lg"
                                variant="secondary"
                                className="gap-2"
                                onClick={() => sendAction('PAUSE')}
                                disabled={actionLoading}
                            >
                                <Pause className="h-5 w-5" />
                                Pause
                            </Button>
                        ) : (
                            <Button
                                size="lg"
                                variant="secondary"
                                className="gap-2"
                                onClick={() => sendAction('RESUME')}
                                disabled={actionLoading}
                            >
                                <Play className="h-5 w-5" />
                                Resume
                            </Button>
                        )}

                        <Button
                            size="lg"
                            variant="destructive"
                            className="gap-2"
                            onClick={() => {
                                if (confirm('Are you sure you want to end the test for all students?')) {
                                    sendAction('FINISH');
                                }
                            }}
                            disabled={actionLoading}
                        >
                            <Square className="h-5 w-5" />
                            End Test
                        </Button>
                    </>
                )}

                {isFinished && (
                    <div className="text-center space-y-4">
                        <p className="text-lg font-medium text-muted-foreground">Test has ended.</p>
                        <Button
                            variant="outline"
                            onClick={() => sendAction('START')}
                            disabled={actionLoading}
                        >
                            Restart Session
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
