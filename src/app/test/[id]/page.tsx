'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function TestPlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`/api/attempts/${id}/play`)
            .then(res => res.json())
            .then(data => {
                setData(data);
                // Initialize answers ONLY from saved answers (not all questions)
                const initialAnswers: Record<string, any> = {};
                if (data.attempt.answers && data.attempt.answers.length > 0) {
                    data.attempt.answers.forEach((a: any) => {
                        // Only add if user actually provided an answer
                        if (a.givenAnswer !== null && a.givenAnswer !== undefined && a.givenAnswer !== '') {
                            initialAnswers[a.questionId] = a.givenAnswer;
                        }
                    });
                }
                setAnswers(initialAnswers);

                // Calculate time left
                const expiresAt = new Date(data.attempt.expiresAt).getTime();
                const serverNow = new Date(data.serverNow).getTime();
                const clientNow = Date.now();
                const offset = serverNow - clientNow; // Approx offset

                const updateTimer = () => {
                    const now = Date.now() + offset;
                    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
                    setTimeLeft(remaining);
                    if (remaining <= 0) {
                        // Auto submit
                        handleSubmit();
                    }
                };

                updateTimer();
                const interval = setInterval(updateTimer, 1000);
                return () => clearInterval(interval);
            })
            .catch(err => {
                console.error('Failed to load test data', err);
            });
    }, [id]);

    const handleAnswerChange = (questionId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
        // Debounced autosave could go here
        saveAnswer(questionId, value);
    };

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

    const handleClearAnswer = (questionId: string) => {
        // Remove answer from local state
        setAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers[questionId];
            return newAnswers;
        });
        // Save empty answer to server
        saveAnswer(questionId, null);
    };

    const handleSubmit = async () => {
        await fetch(`/api/attempts/${id}/submit`, { method: 'POST' });
        router.push(`/test/${id}/result`);
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

    return (
        <div className="flex h-screen flex-col">
            {/* Header */}
            <header className="border-b p-4 flex justify-between items-center bg-background">
                <h1 className="font-bold text-lg">{data.test.title}</h1>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 font-mono text-xl ${timeLeft && timeLeft < 300 ? 'text-red-500' : ''}`}>
                        <Clock className="h-5 w-5" />
                        {timeLeft ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : '--:--'}
                    </div>
                    <Button variant="destructive" onClick={handleSubmit}>Submit Test</Button>
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
                                                    // Trim all whitespaces (start, end, and internal)
                                                    const value = e.target.value.replace(/\s+/g, '');
                                                    if (value === '') {
                                                        handleAnswerChange(currentQ._id, null);
                                                    } else {
                                                        // Store as string to match database format
                                                        handleAnswerChange(currentQ._id, value);
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
                                                    handleAnswerChange(currentQ._id, value || null);
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
                                disabled={currentQIndex === 0}
                            >
                                Previous
                            </Button>
                            <Button
                                onClick={() => setCurrentQIndex(Math.min(data.questions.length - 1, currentQIndex + 1))}
                                disabled={currentQIndex === data.questions.length - 1}
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
