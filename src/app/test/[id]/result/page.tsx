'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Bot, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, FileText, ArrowLeft } from 'lucide-react';


export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [aiExplanations, setAiExplanations] = useState<Record<number, string>>({});
    const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});
    const [aiOpen, setAiOpen] = useState<Record<number, boolean>>({});

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        const fetchResult = async () => {
            try {
                const res = await fetch(`/api/attempts/${id}/result`);
                const json = await res.json();

                if (cancelled) return;

                // 202 = still grading — retry in 2 s
                if (res.status === 202) {
                    setData({ grading: true, message: json.message });
                    timer = setTimeout(fetchResult, 2000);
                    return;
                }

                setData(json);
                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch results', err);
                if (!cancelled) setLoading(false);
            }
        };

        fetchResult();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [id]);

    // Function to convert LaTeX notation and markdown to readable format
    const parseLatex = (text: string) => {
        if (!text) return '';

        let parsed = text;

        // Replace **bold** with <strong> (only complete pairs)
        parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Replace inline math $...$ with HTML (only complete pairs)
        parsed = parsed.replace(/\$([^\$]+)\$/g, (match, formula) => {
            try {
                let processedFormula = formula;

                // Handle subscripts: _{...} or _x
                processedFormula = processedFormula.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
                processedFormula = processedFormula.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');

                // Handle superscripts: ^{...} or ^x
                processedFormula = processedFormula.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
                processedFormula = processedFormula.replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>');

                // Handle fractions
                processedFormula = processedFormula.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');

                // Handle common Greek letters
                processedFormula = processedFormula.replace(/\\omega/g, 'ω');
                processedFormula = processedFormula.replace(/\\theta/g, 'θ');
                processedFormula = processedFormula.replace(/\\phi/g, 'φ');
                processedFormula = processedFormula.replace(/\\pi/g, 'π');

                return processedFormula;
            } catch (e) {
                return match;
            }
        });

        // Replace display math $$...$$ with centered HTML
        parsed = parsed.replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
            try {
                let processedFormula = formula;
                processedFormula = processedFormula.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
                processedFormula = processedFormula.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
                processedFormula = processedFormula.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
                processedFormula = processedFormula.replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>');
                return `<div class="text-center my-2 font-semibold">${processedFormula}</div>`;
            } catch (e) {
                return match;
            }
        });

        // Replace newlines with <br>
        parsed = parsed.replace(/\n/g, '<br>');

        return parsed;
    };

    const handleAskAI = async (questionIndex: number, question: any) => {
        setAiLoading(prev => ({ ...prev, [questionIndex]: true }));
        setAiOpen(prev => ({ ...prev, [questionIndex]: true }));

        try {
            const response = await fetch('/api/ai/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question.stem,
                    correctAnswer: question.correctAnswer,
                    explanation: question.explanation
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get AI explanation');
            }

            const result = await response.json();
            const parsedExplanation = parseLatex(result.explanation || 'Unable to generate explanation');
            setAiExplanations(prev => ({ ...prev, [questionIndex]: parsedExplanation }));
            setAiLoading(prev => ({ ...prev, [questionIndex]: false }));
        } catch (error) {
            console.error('AI explanation error:', error);
            setAiExplanations(prev => ({ ...prev, [questionIndex]: 'Failed to get AI explanation. Please try again.' }));
            setAiLoading(prev => ({ ...prev, [questionIndex]: false }));
        }
    };

    if (loading) return <div className="flex justify-center flex-col items-center h-[50vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Retrieving examination report...</p>
    </div>;

    if (data?.grading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4 min-h-[50vh]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Grading in Progress</h2>
            <p className="text-muted-foreground text-center max-w-md">
                Your submission has been received. {data.message || 'Calculating your score...'}
            </p>
        </div>
    );

    if (!data || data.message) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4 min-h-[50vh]">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">{data?.message || 'Report not available.'}</p>
            <Link href="/dashboard"><Button variant="outline">Return to Dashboard</Button></Link>
        </div>
    );

    const percentage = Math.round((data.score / data.totalMarks) * 100);
    const totalQuestions = data.results.length;
    const correctCount = data.results.filter((r: any) => r.isCorrect).length;
    const incorrectCount = totalQuestions - correctCount;

    return (
        <div className="container mx-auto p-6 space-y-8">
            <Link href="/dashboard">
                <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
            </Link>

            <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-center text-3xl">Test Results</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <div className="text-6xl font-bold text-primary mb-2">{data.score} <span className="text-2xl text-muted-foreground">/ {data.totalMarks}</span></div>
                    <p className="text-muted-foreground">Total Score</p>
                </CardContent>
            </Card>

            {/* Score Card */}
            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                <div className="bg-muted/30 p-6 border-b">
                    <h1 className="text-2xl font-bold tracking-tight">Examination Report</h1>
                    <p className="text-muted-foreground">Performance Summary</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x border-b">
                    <div className="p-6 text-center">
                        <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium mb-1">Score</div>
                        <div className="text-3xl font-bold text-primary">{data.score} <span className="text-xl text-muted-foreground font-normal">/ {data.totalMarks}</span></div>
                    </div>
                    <div className="p-6 text-center">
                        <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium mb-1">Percentage</div>
                        <div className={`text-3xl font-bold ${percentage >= 35 ? 'text-green-600' : 'text-red-500'}`}>{percentage}%</div>
                    </div>
                    <div className="p-6 text-center">
                        <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium mb-1">Questions</div>
                        <div className="text-3xl font-bold">{totalQuestions}</div>
                    </div>
                    <div className="p-6 text-center">
                        <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium mb-1">Status</div>
                        <Badge variant={percentage >= 35 ? "default" : "destructive"} className="text-base px-4 py-1 mt-1">
                            {percentage >= 35 ? "PASSED" : "NEEDS IMPROVEMENT"}
                        </Badge>
                    </div>
                </div>

                <div className="bg-muted/10 p-4 flex justify-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{correctCount} Correct</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="font-medium">{incorrectCount} Incorrect</span>
                    </div>
                </div>
            </div>

            {/* Detailed Review */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold border-b pb-2">Detailed Review</h2>
                <div className="space-y-4">
                    {data.results?.map((item: any, i: number) => (
                        <div
                            key={i}
                            className={`group bg-card border rounded-lg overflow-hidden transition-all hover:shadow-md ${item.isCorrect ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start gap-4 mb-4">
                                    <div className="flex gap-3">
                                        <span className="font-mono text-muted-foreground font-medium pt-1">Q{i + 1}.</span>
                                        <div className="text-lg font-medium" dangerouslySetInnerHTML={{ __html: item.question.stem }} />
                                    </div>
                                    <Badge variant={item.isCorrect ? "outline" : "destructive"} className={item.isCorrect ? "border-green-500 text-green-600 bg-green-50" : ""}>
                                        {item.isCorrect ? "Correct" : "Incorrect"}
                                    </Badge>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 ml-8 md:ml-10 text-sm">
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Your Answer</span>
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

                                {/* Explanation Section */}
                                {(item.question.explanation || aiOpen[i]) && (
                                    <div className="mt-6 ml-8 md:ml-10 pt-4 border-t space-y-4">
                                        {item.question.explanation && (
                                            <div>
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Explanation</h4>
                                                <div className="text-sm text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.question.explanation }} />
                                            </div>
                                        )}

                                        {/* AI Integration */}
                                        {!aiExplanations[i] && !item.isCorrect && (
                                            <div className="flex">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="gap-2 text-xs"
                                                    onClick={() => handleAskAI(i, item.question)}
                                                    disabled={aiLoading[i]}
                                                >
                                                    {aiLoading[i] ? (
                                                        <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</>
                                                    ) : (
                                                        <><Bot className="h-3 w-3" /> Explain why I'm wrong</>
                                                    )}
                                                </Button>
                                            </div>
                                        )}

                                        {aiExplanations[i] && (
                                            <Collapsible
                                                open={aiOpen[i]}
                                                onOpenChange={(open) => setAiOpen(prev => ({ ...prev, [i]: open }))}
                                                className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-md"
                                            >
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="w-full flex justify-between items-center p-3 h-auto hover:bg-blue-100/50 dark:hover:bg-blue-900/40">
                                                        <span className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                                                            <Bot className="h-4 w-4" /> AI Tutor Explanation
                                                        </span>
                                                        {aiOpen[i] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <div className="p-4 pt-0 text-sm prose dark:prose-invert max-w-none">
                                                        <div dangerouslySetInnerHTML={{ __html: aiExplanations[i] }} />
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
