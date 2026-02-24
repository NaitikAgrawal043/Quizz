'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
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
import { useTestSocket } from '@/hooks/useTestSocket';

export default function TestPlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    // Removed global timeLeft
    const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLiveSession, setIsLiveSession] = useState(false);
    const [liveTestId, setLiveTestId] = useState<string | null>(null);

    // Face detection state
    const [faceWarningType, setFaceWarningType] = useState<ViolationType | null>(null);
    const lastFaceViolationRef = useRef<number>(0);
    const FACE_VIOLATION_COOLDOWN = 5000; // 5 seconds between face violations

    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        // Flush any pending debounced text-input saves
        flushDebouncedSaves();

        // Stop camera
        stopCamera();

        // Exit fullscreen before navigating
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch (e) {
                // Ignore errors
            }
        }

        await fetch(`/api/attempts/${id}/submit`, { method: 'POST' });
        router.push('/dashboard?submitted=true');
    }, [id, router, isSubmitting]);

    // Anti-cheat hook
    const {
        isFullscreen,
        enterFullscreen,
        violationCount,
        maxViolations,
        showWarning,
        lastViolationType,
        dismissWarning
    } = useAntiCheat({
        attemptId: id,
        onAutoSubmit: handleSubmit,
        enabled: !!data && !isSubmitting
    });

    // Face detection hook
    const {
        faceCount,
        isLoading: isFaceLoading,
        error: faceError,
        videoRef,
        startCamera,
        stopCamera,
        isCameraActive
    } = useFaceDetection({
        detectionInterval: 1000 // 1 FPS during test for performance
    });

    // Start camera when test loads
    useEffect(() => {
        if (data && !isSubmitting) {
            startCamera();
        }
        return () => {
            stopCamera();
        };
    }, [data, isSubmitting, startCamera, stopCamera]);

    // Monitor face detection during test
    useEffect(() => {
        if (!data || isSubmitting || !isCameraActive) return;

        const now = Date.now();
        if (now - lastFaceViolationRef.current < FACE_VIOLATION_COOLDOWN) return;

        if (faceCount === 0 && !isFaceLoading) {
            // No face detected - record violation
            lastFaceViolationRef.current = now;
            recordFaceViolation('no_face');
        } else if (faceCount > 1) {
            // Multiple faces detected - record violation
            lastFaceViolationRef.current = now;
            recordFaceViolation('multiple_faces');
        }
    }, [faceCount, data, isSubmitting, isCameraActive, isFaceLoading]);

    // Check for camera errors
    useEffect(() => {
        if (faceError && data && !isSubmitting) {
            const now = Date.now();
            if (now - lastFaceViolationRef.current >= FACE_VIOLATION_COOLDOWN) {
                lastFaceViolationRef.current = now;
                recordFaceViolation('camera_disabled');
            }
        }
    }, [faceError, data, isSubmitting]);

    // Record face violation to server
    const recordFaceViolation = async (type: ViolationType) => {
        try {
            const res = await fetch(`/api/attempts/${id}/violation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            const result = await res.json();
            if (result.shouldAutoSubmit) {
                handleSubmit();
            }
        } catch (error) {
            console.error('Failed to record face violation:', error);
        }
    };

    // Enter fullscreen on mount
    useEffect(() => {
        if (data && !isSubmitting) {
            const timer = setTimeout(() => {
                enterFullscreen();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [data, enterFullscreen, isSubmitting]);

    useEffect(() => {
        fetch(`/api/attempts/${id}/play`)
            .then(res => res.json())
            .then(data => {
                setData(data);
                const initialAnswers: Record<string, any> = {};
                if (data.attempt.answers && data.attempt.answers.length > 0) {
                    data.attempt.answers.forEach((a: any) => {
                        if (a.givenAnswer !== null && a.givenAnswer !== undefined && a.givenAnswer !== '') {
                            initialAnswers[a.questionId] = a.givenAnswer;
                        }
                    });
                }
                setAnswers(initialAnswers);

                // Initialize timer for the first question
                if (data.questions && data.questions.length > 0) {
                    setQuestionTimeLeft(data.questions[0].timeLimit || 60);
                }

                // Check if there's a live session for this test
                const testId = data.attempt?.testId;
                if (testId) {
                    setLiveTestId(testId);
                    fetch(`/api/sessions/${testId}`)
                        .then(res => res.ok ? res.json() : null)
                        .then(session => {
                            if (session && (session.status === 'active' || session.status === 'paused')) {
                                setIsLiveSession(true);
                                setCurrentQIndex(session.currentQuestionIndex);
                            }
                        })
                        .catch(() => { }); // No live session, that's fine
                }
            })
            .catch(err => {
                console.error('Failed to load test data', err);
            });
    }, [id]);

    const handleQuestionTimeout = useCallback(() => {
        // Auto-save current answer (already handled by onChange mostly, but maybe force save?)
        // Move to next question or submit
        if (!data) return;

        if (currentQIndex < data.questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
        } else {
            // Last question - auto submit
            handleSubmit();
        }
    }, [currentQIndex, data, handleSubmit]);

    // Timer logic for per-question time
    useEffect(() => {
        if (!data || isSubmitting) return;

        const timer = setInterval(() => {
            setQuestionTimeLeft((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    // Time's up for this question
                    handleQuestionTimeout();
                    return 0; // Stick at 0 or reset
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [data, isSubmitting, currentQIndex]); // Dependencies need to be careful here

    // Reset timer when question changes
    useEffect(() => {
        if (data && data.questions && data.questions[currentQIndex]) {
            setQuestionTimeLeft(data.questions[currentQIndex].timeLimit || 60);
        }
    }, [currentQIndex, data]);

    // --- Real-Time Sync (WebSocket) ---
    const { syncState } = useTestSocket(liveTestId || '');

    useEffect(() => {
        if (!isLiveSession || !syncState) return;

        // Update question index from teacher's broadcast
        setCurrentQIndex(syncState.currentQuestionIndex);

        // If teacher ended the test, auto-submit
        if (syncState.status === 'finished') {
            handleSubmit();
        }
    }, [syncState, isLiveSession]);


    const saveAnswer = useCallback(async (questionId: string, value: any) => {
        setSaving(true);
        try {
            await fetch(`/api/attempts/${id}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId, givenAnswer: value }),
            });
        } catch (err) {
            console.error('Autosave failed', err);
        } finally {
            setSaving(false);
        }
    }, [id]);

    // Debounce timer ref for text inputs (integer / short)
    const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const handleAnswerChange = (questionId: string, value: any, debounce = false) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));

        if (debounce) {
            // Clear previous timer for this question
            if (debounceRef.current[questionId]) {
                clearTimeout(debounceRef.current[questionId]);
            }
            debounceRef.current[questionId] = setTimeout(() => {
                saveAnswer(questionId, value);
                delete debounceRef.current[questionId];
            }, 800);
        } else {
            saveAnswer(questionId, value);
        }
    };

    // Flush any pending debounced saves before unmount / submit
    const flushDebouncedSaves = useCallback(() => {
        Object.keys(debounceRef.current).forEach(qId => {
            clearTimeout(debounceRef.current[qId]);
            delete debounceRef.current[qId];
        });
    }, []);

    const handleClearAnswer = (questionId: string) => {
        // Clear any pending debounce for this question
        if (debounceRef.current[questionId]) {
            clearTimeout(debounceRef.current[questionId]);
            delete debounceRef.current[questionId];
        }
        setAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers[questionId];
            return newAnswers;
        });
        saveAnswer(questionId, null);
    };

    if (!data) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div>;

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

    // Face status indicator
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
            {/* Warning Modal */}
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

                    {/* Live session indicator */}
                    {isLiveSession && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-500 text-white animate-pulse">
                            <Radio className="h-3 w-3" />
                            LIVE
                        </div>
                    )}

                    {/* Face status indicator */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white ${faceStatus.color}`}>
                        <FaceIcon className="h-3 w-3" />
                        {faceStatus.text}
                    </div>

                    {/* Violation indicator */}
                    {violationCount > 0 && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${violationCount >= maxViolations - 1
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                            }`}>
                            <Shield className="h-3 w-3" />
                            {violationCount}/{maxViolations} warnings
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Small camera preview */}
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
                        {questionTimeLeft !== null ? `${Math.floor(questionTimeLeft / 60)}:${(questionTimeLeft % 60).toString().padStart(2, '0')}` : '--:--'}
                    </div>
                    <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Test'}
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Question Palette) */}
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
                                    variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
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

                {/* Main Content */}
                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Question {currentQIndex + 1} of {data.questions.length}</span>
                            {saving && <span className="text-xs text-muted-foreground flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</span>}
                        </div>

                        <Card>
                            <CardContent className="pt-6 space-y-6">
                                <div className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: currentQ.stem }} />

                                {currentQ.type === 'mcq' && (
                                    <>
                                        <RadioGroup
                                            value={answers[currentQ._id] || ''}
                                            onValueChange={(val) => handleAnswerChange(currentQ._id, val)}
                                        >
                                            {currentQ.options.map((opt: any) => (
                                                <div key={opt.id} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-accent cursor-pointer">
                                                    <RadioGroupItem value={opt.id} id={opt.id} />
                                                    <Label htmlFor={opt.id} className="flex-1 cursor-pointer">{opt.text}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>

                                        {answers[currentQ._id] && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleClearAnswer(currentQ._id)}
                                                className="mt-2"
                                            >
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
                                                            const currentArray = Array.isArray(current) ? current : [];
                                                            let newAnswers;
                                                            if (currentArray.includes(opt.id)) {
                                                                newAnswers = currentArray.filter((id: string) => id !== opt.id);
                                                            } else {
                                                                newAnswers = [...currentArray, opt.id].sort();
                                                            }
                                                            handleAnswerChange(currentQ._id, newAnswers.length > 0 ? newAnswers : null);
                                                        }}
                                                    >
                                                        <Checkbox
                                                            checked={isChecked}
                                                            id={`multi-${currentQ._id}-${opt.id}`}
                                                        />
                                                        <Label htmlFor={`multi-${currentQ._id}-${opt.id}`} className="flex-1 cursor-pointer">
                                                            {opt.text}
                                                        </Label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2">
                                            Select all correct answers
                                        </p>

                                        {answers[currentQ._id] && Array.isArray(answers[currentQ._id]) && answers[currentQ._id].length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleClearAnswer(currentQ._id)}
                                                className="mt-2"
                                            >
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
                                                    const value = e.target.value.replace(/\s+/g, '');
                                                    if (value === '') {
                                                        handleAnswerChange(currentQ._id, null, true);
                                                    } else {
                                                        handleAnswerChange(currentQ._id, value, true);
                                                    }
                                                }}
                                                className="max-w-xs"
                                            />
                                        </div>

                                        {answers[currentQ._id] !== undefined && answers[currentQ._id] !== null && answers[currentQ._id] !== '' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleClearAnswer(currentQ._id)}
                                                className="mt-2"
                                            >
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
                                                    const value = e.target.value;
                                                    handleAnswerChange(currentQ._id, value || null, true);
                                                }}
                                                className="max-w-md"
                                            />
                                        </div>

                                        {answers[currentQ._id] && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleClearAnswer(currentQ._id)}
                                                className="mt-2"
                                            >
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
