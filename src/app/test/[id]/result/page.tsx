'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Bot, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, FileText, ArrowLeft, ChevronLeft, ChevronRight, MinusCircle } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { useAttemptResult } from '@/hooks/queries/useAttemptResult';
import { useAskAI } from '@/hooks/mutations/useAskAI';

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    // Pure UI state — question navigation and AI panel state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [aiExplanations, setAiExplanations] = useState<Record<number, string>>({});
    const [aiOpen, setAiOpen] = useState<Record<number, boolean>>({});

    const { data, isLoading } = useAttemptResult(id);
    const askAI = useAskAI();

    const parseLatex = (text: string) => {
        if (!text) return '';
        let parsed = text;
        parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        parsed = parsed.replace(/\$([^\$]+)\$/g, (match, formula) => {
            try {
                let p = formula;
                p = p.replace(/_{([^}]+)}/g, '<sub>$1</sub>');
                p = p.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
                p = p.replace(/\^{([^}]+)}/g, '<sup>$1</sup>');
                p = p.replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>');
                p = p.replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1/$2)');
                p = p.replace(/\\omega/g, 'ω');
                p = p.replace(/\\theta/g, 'θ');
                p = p.replace(/\\phi/g, 'φ');
                p = p.replace(/\\pi/g, 'π');
                return p;
            } catch { return match; }
        });
        parsed = parsed.replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
            try {
                let p = formula;
                p = p.replace(/_{([^}]+)}/g, '<sub>$1</sub>');
                p = p.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
                p = p.replace(/\^{([^}]+)}/g, '<sup>$1</sup>');
                p = p.replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>');
                return `<div class="text-center my-2 font-semibold">${p}</div>`;
            } catch { return match; }
        });
        parsed = parsed.replace(/\n/g, '<br>');
        return parsed;
    };

    const handleAskAI = async (questionIndex: number, question: any) => {
        setAiOpen((prev) => ({ ...prev, [questionIndex]: true }));
        askAI.mutate(
            { question: question.stem, correctAnswer: question.correctAnswer, explanation: question.explanation },
            {
                onSuccess: (result) => {
                    setAiExplanations((prev) => ({
                        ...prev,
                        [questionIndex]: parseLatex(result.explanation || 'Unable to generate explanation'),
                    }));
                },
                onError: () => {
                    setAiExplanations((prev) => ({
                        ...prev,
                        [questionIndex]: 'Failed to get AI explanation. Please try again.',
                    }));
                },
            }
        );
    };

    // ── Loading / grading states ───────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex justify-center flex-col items-center h-[50vh] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Retrieving examination report...</p>
            </div>
        );
    }

    if (data?._httpStatus === 202 || data?.grading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 min-h-[50vh]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">Grading in Progress</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    Your submission has been received. {data.message || 'Calculating your score...'}
                </p>
            </div>
        );
    }

    if (!data || data.message) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 min-h-[50vh]">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">{data?.message || 'Report not available.'}</p>
                <Link href="/dashboard"><Button variant="outline">Return to Dashboard</Button></Link>
            </div>
        );
    }

    // ── Derived values ─────────────────────────────────────────────
    const percentage = Math.round((data.score! / data.totalMarks!) * 100);
    const totalQuestions = data.results!.length;
    const correctCount = data.results!.filter((r: any) => r.isCorrect).length;
    const incorrectCount = data.results!.filter((r: any) => r.isAttempted && !r.isCorrect).length;
    const unattemptedCount = totalQuestions - correctCount - incorrectCount;
    const currentItem = data.results![currentIndex];

    const goTo = (idx: number) => {
        if (idx >= 0 && idx < totalQuestions) setCurrentIndex(idx);
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Compact Header Bar */}
            <div className="border-b bg-card sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Link href="/dashboard" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ArrowLeft className="h-4 w-4" /> Dashboard
                    </Link>

                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Score:</span>
                            <span className="font-bold text-primary">{data.score}/{data.totalMarks}</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5">
                            <span className="text-muted-foreground">Percentage:</span>
                            <span className={`font-bold ${percentage >= 35 ? 'text-green-600' : 'text-red-500'}`}>{percentage}%</span>
                        </div>
                        <div className="hidden md:flex items-center gap-3">
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3.5 w-3.5" /> {correctCount}
                            </span>
                            <span className="flex items-center gap-1 text-red-500">
                                <XCircle className="h-3.5 w-3.5" /> {incorrectCount}
                            </span>
                            <span className="flex items-center gap-1 text-gray-500">
                                <MinusCircle className="h-3.5 w-3.5" /> {unattemptedCount}
                            </span>
                        </div>
                        <Badge variant={percentage >= 35 ? 'default' : 'destructive'} className="text-xs">
                            {percentage >= 35 ? 'PASSED' : 'NEEDS IMPROVEMENT'}
                        </Badge>
                    </div>

                    <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden text-xs">
                        <FileText className="h-3.5 w-3.5" /> Print
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar — Question Navigator */}
                <div className="w-[220px] border-r bg-muted/20 p-4 overflow-y-auto shrink-0 hidden md:block">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Questions</h3>
                    <div className="grid grid-cols-5 gap-1.5">
                        {data.results!.map((item: any, i: number) => (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                className={`
                                    w-full aspect-square rounded-md text-xs font-medium flex items-center justify-center
                                    transition-all border cursor-pointer
                                    ${i === currentIndex ? 'ring-2 ring-primary ring-offset-1 scale-110 z-10' : 'hover:scale-105'}
                                    ${item.isCorrect
                                        ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300'
                                        : item.isAttempted
                                            ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300'
                                            : 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400'
                                    }
                                `}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                    <div className="mt-4 pt-3 border-t space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
                            Correct ({correctCount})
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" />
                            Incorrect ({incorrectCount})
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300" />
                            Unattempted ({unattemptedCount})
                        </div>
                    </div>
                </div>

                {/* Mobile Question Selector */}
                <div className="md:hidden border-b bg-muted/20 p-2 overflow-x-auto flex gap-1.5 shrink-0">
                    {data.results!.map((item: any, i: number) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            className={`
                                min-w-[32px] h-8 rounded-md text-xs font-medium flex items-center justify-center
                                transition-all border cursor-pointer shrink-0
                                ${i === currentIndex ? 'ring-2 ring-primary' : ''}
                                ${item.isCorrect
                                    ? 'bg-green-100 border-green-300 text-green-800'
                                    : item.isAttempted
                                        ? 'bg-red-100 border-red-300 text-red-800'
                                        : 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                }
                            `}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>

                {/* Question Detail View */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto p-6">
                        {/* Question Header and Navigation */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <span className="text-2xl font-bold text-muted-foreground">Q{currentIndex + 1}</span>
                                <Badge
                                    variant={currentItem.isCorrect ? 'outline' : currentItem.isAttempted ? 'destructive' : 'secondary'}
                                    className={`text-sm px-3 py-1 ${currentItem.isCorrect ? 'border-green-500 text-green-600 bg-green-50' : !currentItem.isAttempted ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' : ''}`}
                                >
                                    {currentItem.isCorrect ? '✓ Correct' : currentItem.isAttempted ? '✗ Incorrect' : '○ Unattempted'}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end bg-muted/30 border rounded-lg p-1.5 shadow-sm">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => goTo(currentIndex - 1)}
                                    disabled={currentIndex === 0}
                                    className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-background"
                                >
                                    <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
                                </Button>
                                <span className="text-sm text-muted-foreground font-medium px-3">
                                    {currentIndex + 1} / {totalQuestions}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => goTo(currentIndex + 1)}
                                    disabled={currentIndex === totalQuestions - 1}
                                    className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-background"
                                >
                                    <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Question Stem */}
                        <div className={`p-5 rounded-lg border-l-4 mb-6 bg-card border ${currentItem.isCorrect ? 'border-l-green-500' : currentItem.isAttempted ? 'border-l-red-500' : 'border-l-gray-400'}`}>
                            <MarkdownRenderer content={currentItem.question.stem} className="text-base" />
                        </div>

                        {/* MCQ Options */}
                        {currentItem.question.options && currentItem.question.options.length > 0 && (
                            <div className="space-y-2 mb-6">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Options</h4>
                                {currentItem.question.options.map((opt: any) => {
                                    const isUserAnswer = currentItem.userAnswer === opt.id ||
                                        (Array.isArray(currentItem.userAnswer) && currentItem.userAnswer.includes(opt.id));
                                    const isCorrectAnswer = currentItem.question.correctAnswer === opt.id ||
                                        (Array.isArray(currentItem.question.correctAnswer) && currentItem.question.correctAnswer.includes(opt.id));

                                    let optStyle = 'border bg-card';
                                    if (isCorrectAnswer) optStyle = 'border-green-400 bg-green-50/70 dark:bg-green-950/30';
                                    if (isUserAnswer && !isCorrectAnswer) optStyle = 'border-red-400 bg-red-50/70 dark:bg-red-950/30';

                                    return (
                                        <div key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg ${optStyle} transition-all`}>
                                            <span className={`
                                                font-bold text-sm w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
                                                ${isCorrectAnswer ? 'bg-green-500 text-white' : ''}
                                                ${isUserAnswer && !isCorrectAnswer ? 'bg-red-500 text-white' : ''}
                                                ${!isCorrectAnswer && !isUserAnswer ? 'bg-muted text-muted-foreground' : ''}
                                            `}>
                                                {opt.id.toUpperCase()}
                                            </span>
                                            <div className="flex-1 pt-0.5">
                                                <MarkdownRenderer content={opt.text} />
                                            </div>
                                            {isCorrectAnswer && <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-1" />}
                                            {isUserAnswer && !isCorrectAnswer && <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-1" />}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Short / Integer Answer */}
                        {(!currentItem.question.options || currentItem.question.options.length === 0) && (
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your Answer</span>
                                    <div className={`p-3 rounded-lg border font-medium ${currentItem.isCorrect ? 'bg-green-50/50 border-green-200 text-green-900' : 'bg-red-50/50 border-red-200 text-red-900'}`}>
                                        {currentItem.userAnswer !== null && currentItem.userAnswer !== undefined
                                            ? String(currentItem.userAnswer)
                                            : <span className="italic text-muted-foreground">Not Answered</span>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Correct Answer</span>
                                    <div className="p-3 rounded-lg border bg-muted/30 font-medium">
                                        {String(currentItem.question.correctAnswer)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Explanation + AI */}
                        {(currentItem.question.explanation || aiOpen[currentIndex]) && (
                            <div className="pt-4 border-t space-y-4 mb-6">
                                {currentItem.question.explanation && (
                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Explanation</h4>
                                        <MarkdownRenderer content={currentItem.question.explanation} className="text-sm text-foreground/90 leading-relaxed" />
                                    </div>
                                )}

                                {!aiExplanations[currentIndex] && !currentItem.isCorrect && (
                                    <div className="flex">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="gap-2 text-xs"
                                            onClick={() => handleAskAI(currentIndex, currentItem.question)}
                                            disabled={askAI.isPending}
                                        >
                                            {askAI.isPending ? (
                                                <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</>
                                            ) : (
                                                <><Bot className="h-3 w-3" /> Explain why I&apos;m wrong</>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {aiExplanations[currentIndex] && (
                                    <Collapsible
                                        open={aiOpen[currentIndex]}
                                        onOpenChange={(open) => setAiOpen((prev) => ({ ...prev, [currentIndex]: open }))}
                                        className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-md"
                                    >
                                        <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm" className="w-full flex justify-between items-center p-3 h-auto hover:bg-blue-100/50 dark:hover:bg-blue-900/40">
                                                <span className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                                                    <Bot className="h-4 w-4" /> AI Tutor Explanation
                                                </span>
                                                {aiOpen[currentIndex] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="p-4 pt-0 text-sm prose dark:prose-invert max-w-none">
                                                <div dangerouslySetInnerHTML={{ __html: aiExplanations[currentIndex] }} />
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
