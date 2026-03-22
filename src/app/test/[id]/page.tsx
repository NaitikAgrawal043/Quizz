'use client';

import { useEffect, useCallback, useRef, use } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Clock, AlertTriangle, Shield, Camera, User, Users, Radio } from 'lucide-react';
import { useAntiCheat, ViolationType } from '@/hooks/useAntiCheat';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { WarningModal } from '@/components/ui/warning-modal';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { useTestSocket } from '@/hooks/useTestSocket';
import { useAttemptPlay } from '@/hooks/queries/useAttemptPlay';
import { useSaveAnswer } from '@/hooks/mutations/useSaveAnswer';
import { useSubmitTest } from '@/hooks/mutations/useSubmitTest';
import { useTestStore } from '@/stores/testStore';

export default function TestPlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    // ── Zustand store ──────────────────────────────────────────────
    const {
        answers,
        currentQIndex,
        isSubmitting,
        isLiveSession,
        liveTestId,
        setAnswer,
        clearAnswer,
        setCurrentQIndex,
        setIsSubmitting,
        setIsLiveSession,
        setLiveTestId,
        initAnswers,
        resetSession,
    } = useTestStore();

    // ── Local UI state (timer + face warning — truly local) ────────
    const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [faceWarningType, setFaceWarningType] = useState<ViolationType | null>(null);
    const lastFaceViolationRef = useRef<number>(0);
    const FACE_VIOLATION_COOLDOWN = 5000;

    // ── TanStack Query ─────────────────────────────────────────────
    const { data, isLoading: isDataLoading } = useAttemptPlay(id);
    const saveAnswerMutation = useSaveAnswer(id);
    const submitMutation = useSubmitTest(id);

    // ── Submit handler (defined early — referenced by useAntiCheat) ─
    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        flushDebouncedSaves();
        stopCamera();

        if (document.fullscreenElement) {
            try { await document.exitFullscreen(); } catch { /* ignore */ }
        }

        await submitMutation.mutateAsync();
        resetSession();
        router.push('/dashboard?submitted=true');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, router, isSubmitting]);

    // ── Anti-cheat ─────────────────────────────────────────────────
    const {
        isFullscreen,
        enterFullscreen,
        violationCount,
        maxViolations,
        showWarning,
        lastViolationType,
        dismissWarning,
    } = useAntiCheat({
        attemptId: id,
        onAutoSubmit: handleSubmit,
        enabled: !!data && !isSubmitting,
    });

    // ── Face detection ──────────────────────────────────────────────
    const {
        faceCount,
        isLoading: isFaceLoading,
        error: faceError,
        videoRef,
        startCamera,
        stopCamera,
        isCameraActive,
    } = useFaceDetection({ detectionInterval: 1000 });

    // ── Initialise store when query data arrives ───────────────────
    const hasInitialized = useRef(false);
    useEffect(() => {
        if (!data || hasInitialized.current) return;
        hasInitialized.current = true;

        const initialAnswers: Record<string, any> = {};
        data.attempt?.answers?.forEach((a: any) => {
            if (a.givenAnswer !== null && a.givenAnswer !== undefined && a.givenAnswer !== '') {
                initialAnswers[a.questionId] = a.givenAnswer;
            }
        });
        initAnswers(initialAnswers);

        if (data.questions?.length > 0) {
            setQuestionTimeLeft(data.questions[0].timeLimit || 60);
        }

        // Check for a live session
        const testId = data.attempt?.testId;
        if (testId) {
            setLiveTestId(testId);
            fetch(`/api/sessions/${testId}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((session) => {
                    if (session && (session.status === 'active' || session.status === 'paused')) {
                        setIsLiveSession(true);
                        setCurrentQIndex(session.currentQuestionIndex);
                    }
                })
                .catch(() => { });
        }
    }, [data]);

    // Reset store on unmount
    useEffect(() => {
        return () => {
            hasInitialized.current = false;
            resetSession();
        };
    }, []);

    // Start/stop camera with test lifecycle
    useEffect(() => {
        if (data && !isSubmitting) startCamera();
        return () => stopCamera();
    }, [data, isSubmitting]);

    // Monitor face detection
    useEffect(() => {
        if (!data || isSubmitting || !isCameraActive) return;
        const now = Date.now();
        if (now - lastFaceViolationRef.current < FACE_VIOLATION_COOLDOWN) return;

        if (faceCount === 0 && !isFaceLoading) {
            lastFaceViolationRef.current = now;
            recordFaceViolation('no_face');
        } else if (faceCount > 1) {
            lastFaceViolationRef.current = now;
            recordFaceViolation('multiple_faces');
        }
    }, [faceCount, data, isSubmitting, isCameraActive, isFaceLoading]);

    // Camera error violations
    useEffect(() => {
        if (faceError && data && !isSubmitting) {
            const now = Date.now();
            if (now - lastFaceViolationRef.current >= FACE_VIOLATION_COOLDOWN) {
                lastFaceViolationRef.current = now;
                recordFaceViolation('camera_disabled');
            }
        }
    }, [faceError, data, isSubmitting]);

    // Enter fullscreen once data is ready
    useEffect(() => {
        if (data && !isSubmitting) {
            const t = setTimeout(() => enterFullscreen(), 500);
            return () => clearTimeout(t);
        }
    }, [data, isSubmitting]);

    // Per-question countdown timer
    useEffect(() => {
        if (!data || isSubmitting) return;
        const timer = setInterval(() => {
            setQuestionTimeLeft((prev) => {
                if (prev === null) return null;
                if (prev <= 1) { handleQuestionTimeout(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [data, isSubmitting, currentQIndex]);

    // Reset timer on question change
    useEffect(() => {
        if (data?.questions?.[currentQIndex]) {
            setQuestionTimeLeft(data.questions[currentQIndex].timeLimit || 60);
        }
    }, [currentQIndex, data]);

    // WebSocket sync
    const { syncState } = useTestSocket(liveTestId || '');
    useEffect(() => {
        if (!isLiveSession || !syncState) return;
        // Flush any pending debounced text saves before the question changes
        flushDebouncedSaves();
        setCurrentQIndex(syncState.currentQuestionIndex);
        if (syncState.status === 'finished') handleSubmit();
    }, [syncState, isLiveSession]);

    // ── Helpers ────────────────────────────────────────────────────
    const recordFaceViolation = async (type: ViolationType) => {
        try {
            const res = await fetch(`/api/attempts/${id}/violation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type }),
            });
            const result = await res.json();
            if (result.shouldAutoSubmit) handleSubmit();
        } catch { /* ignore */ }
    };

    const handleQuestionTimeout = useCallback(() => {
        if (!data) return;
        if (currentQIndex < data.questions.length - 1) {
            setCurrentQIndex(currentQIndex + 1);
        } else {
            handleSubmit();
        }
    }, [currentQIndex, data, handleSubmit]);

    // Debounced saves for text inputs
    const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const saveAnswer = useCallback(async (questionId: string, value: any) => {
        setSaving(true);
        try {
            await saveAnswerMutation.mutateAsync({ questionId, givenAnswer: value });
        } catch { /* ignore */ } finally {
            setSaving(false);
        }
    }, [saveAnswerMutation]);

    const handleAnswerChange = (questionId: string, value: any, debounce = false) => {
        setAnswer(questionId, value);

        if (debounce) {
            if (debounceRef.current[questionId]) clearTimeout(debounceRef.current[questionId]);
            debounceRef.current[questionId] = setTimeout(() => {
                saveAnswer(questionId, value);
                delete debounceRef.current[questionId];
            }, 800);
        } else {
            saveAnswer(questionId, value);
        }
    };

    const flushDebouncedSaves = useCallback(() => {
        const pending = { ...debounceRef.current };
        debounceRef.current = {};
        Object.keys(pending).forEach((qId) => {
            clearTimeout(pending[qId]);
            // Fire the save immediately with the current answer from the store
            const value = useTestStore.getState().answers[qId] ?? null;
            saveAnswer(qId, value);
        });
    }, [saveAnswer]);

    const handleClearAnswer = (questionId: string) => {
        if (debounceRef.current[questionId]) {
            clearTimeout(debounceRef.current[questionId]);
            delete debounceRef.current[questionId];
        }
        clearAnswer(questionId);
        saveAnswer(questionId, null);
    };

    // ── Render guards ──────────────────────────────────────────────
    if (isDataLoading || !data) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div>;
    }

    const currentQ = data.questions[currentQIndex];
    if (!currentQ) {
        return (
            <div className="flex justify-center items-center h-screen flex-col gap-4">
                <AlertTriangle className="h-10 w-10 text-yellow-500" />
                <p>Question not found or invalid data.</p>
                <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
            </div>
        );
    }

    // Face status badge
    const getFaceStatus = () => {
        if (faceError) return { color: 'bg-red-500', icon: Camera, text: 'Camera Error' };
        if (!isCameraActive) return { color: 'bg-yellow-500', icon: Camera, text: 'Camera Off' };
        if (faceCount === 0) return { color: 'bg-yellow-500', icon: User, text: 'No Face' };
        if (faceCount > 1) return { color: 'bg-red-500', icon: Users, text: 'Multiple' };
        return { color: 'bg-green-500', icon: User, text: 'OK' };
    };
    const faceStatus = getFaceStatus();
    const FaceIcon = faceStatus.icon;

    return (
        <div className="flex h-screen flex-col">
            <WarningModal
                isOpen={showWarning}
                violationType={lastViolationType}
                violationCount={violationCount}
                maxViolations={maxViolations}
                onDismiss={dismissWarning}
            />

            {/* Header */}
            <header className="border-b p-4 flex justify-between items-center bg-background">
                <div className="flex items-center gap-4">
                    <h1 className="font-bold text-lg">{data.test.title}</h1>

                    {isLiveSession && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                            <Radio className="h-3 w-3" />
                            LIVE
                        </div>
                    )}

                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white ${faceStatus.color}`}>
                        <FaceIcon className="h-3 w-3" />
                        {faceStatus.text}
                    </div>

                    {violationCount > 0 && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${violationCount >= maxViolations - 1 ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'}`}>
                            <Shield className="h-3 w-3" />
                            {violationCount}/{maxViolations} warnings
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-black border-2 border-muted">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                        />
                        {!isCameraActive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                <Camera className="h-4 w-4 text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    <div className={`flex items-center gap-2 font-mono text-xl ${questionTimeLeft && questionTimeLeft < 10 ? 'text-red-500' : ''}`}>
                        <Clock className="h-5 w-5" />
                        {questionTimeLeft !== null
                            ? `${Math.floor(questionTimeLeft / 60)}:${(questionTimeLeft % 60).toString().padStart(2, '0')}`
                            : '--:--'}
                    </div>

                    <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Test'}
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Question palette */}
                <aside className="w-64 border-r p-4 overflow-y-auto hidden md:block">
                    <h3 className="font-semibold mb-4">Questions</h3>
                    <div className="grid grid-cols-4 gap-2">
                        {data.questions.map((q: any, i: number) => {
                            const answer = answers[q._id];
                            const isAnswered = answer !== undefined && answer !== null && answer !== '' &&
                                !(Array.isArray(answer) && answer.length === 0);
                            const isCurrent = currentQIndex === i;
                            return (
                                <Button
                                    key={q._id}
                                    variant={isCurrent ? 'default' : isAnswered ? 'secondary' : 'outline'}
                                    size="sm"
                                    className="w-full"
                                    onClick={() => setCurrentQIndex(i)}
                                    disabled={isLiveSession}
                                >
                                    {i + 1}
                                </Button>
                            );
                        })}
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                                Question {currentQIndex + 1} of {data.questions.length}
                            </span>
                            {saving && (
                                <span className="text-xs text-muted-foreground flex items-center">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...
                                </span>
                            )}
                        </div>

                        <Card>
                            <CardContent className="pt-6 space-y-6">
                                <MarkdownRenderer content={currentQ.stem} />

                                {currentQ.type === 'mcq' && (
                                    <>
                                        <RadioGroup
                                            value={answers[currentQ._id] || ''}
                                            onValueChange={(val) => handleAnswerChange(currentQ._id, val)}
                                        >
                                            {currentQ.options.map((opt: any) => (
                                                <div key={opt.id} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-accent cursor-pointer">
                                                    <RadioGroupItem value={opt.id} id={opt.id} />
                                                    <Label htmlFor={opt.id} className="flex-1 cursor-pointer">
                                                        <MarkdownRenderer content={opt.text} />
                                                    </Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                        {answers[currentQ._id] && (
                                            <Button variant="outline" size="sm" onClick={() => handleClearAnswer(currentQ._id)} className="mt-2">
                                                Clear Answer
                                            </Button>
                                        )}
                                    </>
                                )}

                                {currentQ.type === 'multi-mcq' && (
                                    <>
                                        <div className="space-y-2">
                                            {currentQ.options.map((opt: any) => {
                                                const selectedAnswers = answers[currentQ._id] || [];
                                                const isChecked = Array.isArray(selectedAnswers) && selectedAnswers.includes(opt.id);
                                                return (
                                                    <div
                                                        key={opt.id}
                                                        className="flex items-center space-x-3 border p-3 rounded-md hover:bg-accent cursor-pointer"
                                                        onClick={() => {
                                                            const current = answers[currentQ._id] || [];
                                                            const arr = Array.isArray(current) ? current : [];
                                                            const next = arr.includes(opt.id)
                                                                ? arr.filter((id: string) => id !== opt.id)
                                                                : [...arr, opt.id].sort();
                                                            handleAnswerChange(currentQ._id, next.length > 0 ? next : null);
                                                        }}
                                                    >
                                                        <Checkbox checked={isChecked} id={`multi-${currentQ._id}-${opt.id}`} />
                                                        <Label htmlFor={`multi-${currentQ._id}-${opt.id}`} className="flex-1 cursor-pointer">
                                                            <MarkdownRenderer content={opt.text} />
                                                        </Label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2">Select all correct answers</p>
                                        {answers[currentQ._id] && Array.isArray(answers[currentQ._id]) && answers[currentQ._id].length > 0 && (
                                            <Button variant="outline" size="sm" onClick={() => handleClearAnswer(currentQ._id)} className="mt-2">
                                                Clear Answer
                                            </Button>
                                        )}
                                    </>
                                )}

                                {currentQ.type === 'integer' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor={`integer-${currentQ._id}`}>Enter your answer (numeric)</Label>
                                            <Input
                                                id={`integer-${currentQ._id}`}
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Enter a number..."
                                                value={answers[currentQ._id] !== undefined && answers[currentQ._id] !== null ? answers[currentQ._id] : ''}
                                                onChange={(e) => {
                                                    const v = e.target.value.replace(/\s+/g, '');
                                                    handleAnswerChange(currentQ._id, v === '' ? null : v, true);
                                                }}
                                                className="max-w-xs"
                                            />
                                        </div>
                                        {answers[currentQ._id] !== undefined && answers[currentQ._id] !== null && answers[currentQ._id] !== '' && (
                                            <Button variant="outline" size="sm" onClick={() => handleClearAnswer(currentQ._id)} className="mt-2">
                                                Clear Answer
                                            </Button>
                                        )}
                                    </>
                                )}

                                {currentQ.type === 'short' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor={`short-${currentQ._id}`}>Enter your answer</Label>
                                            <Input
                                                id={`short-${currentQ._id}`}
                                                type="text"
                                                placeholder="Type your answer..."
                                                value={answers[currentQ._id] || ''}
                                                onChange={(e) => {
                                                    handleAnswerChange(currentQ._id, e.target.value || null, true);
                                                }}
                                                className="max-w-md"
                                            />
                                        </div>
                                        {answers[currentQ._id] && (
                                            <Button variant="outline" size="sm" onClick={() => handleClearAnswer(currentQ._id)} className="mt-2">
                                                Clear Answer
                                            </Button>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <div className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={() => setCurrentQIndex(Math.max(0, currentQIndex - 1))}
                                disabled={currentQIndex === 0 || isLiveSession}
                            >
                                Previous
                            </Button>
                            <Button
                                onClick={() => setCurrentQIndex(Math.min(data.questions.length - 1, currentQIndex + 1))}
                                disabled={currentQIndex === data.questions.length - 1 || isLiveSession}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
