'use client';

import { useEffect, useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Bot, ChevronDown, ChevronUp } from 'lucide-react';

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

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    if (data?.grading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">{data.message || 'Grading your answers…'}</p>
        </div>
    );
    if (!data || data.message) return <div className="p-10 text-center">{data?.message || 'No results available'}</div>;

    return (
        <div className="container mx-auto p-6 space-y-8">
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-center text-3xl">Test Results</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <div className="text-6xl font-bold text-primary mb-2">{data.score} <span className="text-2xl text-muted-foreground">/ {data.totalMarks}</span></div>
                    <p className="text-muted-foreground">Total Score</p>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold">Detailed Analysis</h2>
                {data.results?.map((item: any, i: number) => (
                    <Card key={i} className={item.isCorrect ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg flex gap-2">
                                    <span className="text-muted-foreground">Q{i + 1}.</span>
                                    <div dangerouslySetInnerHTML={{ __html: item.question.stem }} />
                                </CardTitle>
                                <Badge variant={item.isCorrect ? "default" : "destructive"}>
                                    {item.isCorrect ? "Correct" : "Incorrect"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-semibold">Your Answer:</span>
                                    <div className="p-2 bg-background rounded border mt-1">
                                        {JSON.stringify(item.userAnswer)}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-semibold">Correct Answer:</span>
                                    <div className="p-2 bg-background rounded border mt-1">
                                        {JSON.stringify(item.question.correctAnswer)}
                                    </div>
                                </div>
                            </div>

                            {item.question.explanation && (
                                <div className="bg-background p-4 rounded-lg border">
                                    <h4 className="font-semibold mb-2">Explanation:</h4>
                                    <div dangerouslySetInnerHTML={{ __html: item.question.explanation }} />
                                </div>
                            )}

                            {!aiExplanations[i] && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => handleAskAI(i, item.question)}
                                        disabled={aiLoading[i]}
                                    >
                                        {aiLoading[i] ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
                                        ) : (
                                            <><Bot className="h-4 w-4" /> Ask AI for more help</>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {aiExplanations[i] && (
                                <Collapsible
                                    open={aiOpen[i]}
                                    onOpenChange={(open) => setAiOpen(prev => ({ ...prev, [i]: open }))}
                                >
                                    <CollapsibleTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full gap-2">
                                            <Bot className="h-4 w-4" />
                                            AI Explanation
                                            {aiOpen[i] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2">
                                        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <div
                                                className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: aiExplanations[i] }}
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
