'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTestSocket } from '@/hooks/useTestSocket';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    CircleStop,
    OctagonX,
    Radio,
    Users,
    Loader2,
    Wifi,
    WifiOff,
    RotateCcw,
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
    const [questions, setQuestions] = useState<any[]>([]);

    const { syncState, isConnected, roomCount } = useTestSocket(testId);

    useEffect(() => {
        const init = async () => {
            try {
                const testRes = await fetch(`/api/tests/${testId}`);
                const testData = await testRes.json();
                setTestTitle(testData.title || 'Untitled Test');

                const questionsRes = await fetch(`/api/tests/${testId}/questions`);
                const questionsData = await questionsRes.json();
                const qList = Array.isArray(questionsData) ? questionsData : [];
                setQuestions(qList);
                setTotalQuestions(qList.length);

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
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    <span className="text-sm text-muted-foreground">Loading live control...</span>
                </div>
            </div>
        );
    }

    const isActive = sessionStatus === 'active';
    const isPaused = sessionStatus === 'paused';
    const isFinished = sessionStatus === 'finished';
    const isWaiting = sessionStatus === 'waiting';

    const currentQ = questions[currentIndex];

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col">

            {/* ─── TOP BAR ─── */}
            <div className="bg-card border-b shadow-sm sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 py-3">
                    {/* Row 1: Back + Title + Status Indicators + Action */}
                    <div className="flex items-center gap-3">
                        {/* Back + Title */}
                        <Link href="/admin" className="shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-lg font-bold truncate">{testTitle}</h1>

                        {/* Status badge */}
                        <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : isPaused
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                                : isFinished
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}>
                            {isActive && <Radio className="h-3 w-3 animate-pulse" />}
                            {isActive ? 'LIVE' : isPaused ? 'PAUSED' : isFinished ? 'ENDED' : 'WAITING'}
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Connection & Students — compact corner pills */}
                        <div className="hidden sm:flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${isConnected
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500'
                                }`}>
                                {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {isConnected ? 'Connected' : 'Offline'}
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {roomCount}
                            </div>
                        </div>

                        {/* Primary Action Button */}
                        {isWaiting && (
                            <Button
                                size="sm"
                                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => sendAction('START')}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Start
                            </Button>
                        )}
                        {isActive && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                onClick={() => sendAction('PAUSE')}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                                Pause
                            </Button>
                        )}
                        {isPaused && (
                            <Button
                                size="sm"
                                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => sendAction('RESUME')}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Resume
                            </Button>
                        )}
                        {(isActive || isPaused) && (
                            <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5"
                                onClick={() => {
                                    if (confirm('End the test for all students?')) sendAction('FINISH');
                                }}
                                disabled={actionLoading}
                            >
                                <OctagonX className="h-4 w-4" />
                                End
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── MOBILE: Connection info (visible on small screens) ─── */}
            <div className="sm:hidden flex items-center justify-center gap-4 px-4 py-2 bg-card border-b text-xs">
                <div className={`flex items-center gap-1.5 ${isConnected ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {isConnected ? 'Connected' : 'Offline'}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {roomCount} {roomCount === 1 ? 'student' : 'students'}
                </div>
            </div>

            {/* ─── MAIN CONTENT ─── */}
            <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-4">

                {/* Question Palette */}
                {totalQuestions > 0 && (
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                                {Array.from({ length: totalQuestions }, (_, i) => {
                                    const isCurrent = i === currentIndex;
                                    const isPast = i < currentIndex;
                                    return (
                                        <button
                                            key={i}
                                            className={`
                                                shrink-0 w-9 h-9 rounded-lg text-xs font-bold
                                                transition-all duration-150
                                                ${isCurrent
                                                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 scale-110'
                                                    : isPast
                                                        ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                                                        : 'bg-muted/60 text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
                                                }
                                                ${(!isActive && !isPaused) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                                            `}
                                            disabled={!isActive && !isPaused}
                                            onClick={() => sendAction('GOTO', i)}
                                        >
                                            {i + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Question Content Card */}
                {currentQ ? (
                    <Card className="flex-1 border-0 shadow-lg">
                        <CardContent className="p-5 md:p-8 flex flex-col gap-5">
                            {/* Question header */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    Question {currentIndex + 1} of {totalQuestions}
                                </span>
                                {currentQ.type && (
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                                        {currentQ.type}
                                    </span>
                                )}
                            </div>

                            {/* Question stem */}
                            <p className="text-xl md:text-2xl font-semibold leading-relaxed">
                                {currentQ.stem}
                            </p>

                            {/* Options */}
                            {currentQ.options && currentQ.options.length > 0 && (
                                <div className="grid gap-2.5 mt-2">
                                    {currentQ.options.map((opt: any, idx: number) => (
                                        <div
                                            key={opt.id || idx}
                                            className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-colors"
                                        >
                                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                                                {(opt.id || String.fromCharCode(97 + idx)).toUpperCase()}
                                            </span>
                                            <span className="text-sm md:text-base">{opt.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Marks info */}
                            {currentQ.marks && (
                                <p className="text-xs text-muted-foreground mt-auto">
                                    {currentQ.marks} {currentQ.marks === 1 ? 'mark' : 'marks'}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="flex-1 border-0 shadow-lg">
                        <CardContent className="p-8 flex items-center justify-center text-muted-foreground">
                            No questions loaded
                        </CardContent>
                    </Card>
                )}

                {/* ─── BOTTOM NAV BAR ─── */}
                {(isActive || isPaused) && (
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            className="gap-2 rounded-xl px-5 h-11"
                            onClick={() => sendAction('PREV')}
                            disabled={actionLoading || currentIndex === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {currentIndex + 1} / {totalQuestions}
                        </span>
                        <Button
                            className="gap-2 rounded-xl px-5 h-11"
                            onClick={() => sendAction('NEXT')}
                            disabled={actionLoading || currentIndex >= totalQuestions - 1}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Finished state */}
                {isFinished && (
                    <Card className="border-0 shadow-lg">
                        <CardContent className="p-6 flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <CircleStop className="h-5 w-5" />
                                <p className="text-lg font-medium">Test has ended</p>
                            </div>
                            <Button
                                variant="outline"
                                className="gap-2 rounded-xl px-6 h-11"
                                onClick={() => sendAction('START')}
                                disabled={actionLoading}
                            >
                                <RotateCcw className="h-4 w-4" />
                                Restart Session
                            </Button>
                        </CardContent>
                    </Card>
                )}


            </div>
        </div>
    );
}
