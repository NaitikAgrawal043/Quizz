'use client';
import { useEffect } from 'react';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle, AlertTriangle, Download, Bot, FileText, Keyboard, Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

interface ParsedQuestion {
    section: string;
    type: string;
    stem: string;
    options: { id: string; text: string }[];
    correctAnswer: any;
    marks: number;
    negativeMarks?: number;
    explanation?: string;
}

export default function UploadPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [activeTab, setActiveTab] = useState('manual');
    const [numQuestions, setNumQuestions] = useState(5);

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setErrors([]);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/tests/${id}/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.questions) {
                setQuestions(data.questions);
                setErrors(data.errors || []);
            } else {
                setErrors(['Failed to parse file']);
            }
        } catch (err) {
            setErrors(['Upload failed']);
        } finally {
            setLoading(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!file) return;
        setLoading(true);
        setErrors([]);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('prompt', aiPrompt);

        try {
            const res = await fetch(`/api/tests/${id}/generate-ai`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.questions) {
                setQuestions(data.questions);
            } else {
                setErrors([data.error || 'Failed to generate questions']);
            }
        } catch (err) {
            setErrors(['AI generation failed']);
        } finally {
            setLoading(false);
        }
    };

    const handleManualStart = () => {
        const newQuestions: ParsedQuestion[] = Array(numQuestions).fill(null).map(() => ({
            section: 'General',
            type: 'mcq',
            stem: '',
            options: [
                { id: 'a', text: '' },
                { id: 'b', text: '' },
                { id: 'c', text: '' },
                { id: 'd', text: '' }
            ],
            correctAnswer: '',
            marks: 1,
            negativeMarks: 0,
            explanation: ''
        }));
        setQuestions(newQuestions);
        setErrors([]);
    };

    const handleSave = async () => {
        // Validate questions before saving
        const validationErrors: string[] = [];

        const validatedQuestions = questions.map((q, i) => {
            if (!q.stem?.trim()) {
                validationErrors.push(`Q${i + 1}: Question stem is required`);
            }

            if ((q.type === 'mcq' || q.type === 'multi-mcq')) {
                // Filter out empty options
                const validOptions = q.options?.filter(opt => opt.text?.trim()) || [];

                if (validOptions.length < 2) {
                    validationErrors.push(`Q${i + 1}: At least 2 options with text are required`);
                }

                if (!q.correctAnswer || (Array.isArray(q.correctAnswer) && q.correctAnswer.length === 0)) {
                    validationErrors.push(`Q${i + 1}: Please select the correct answer`);
                }

                return { ...q, options: validOptions };
            }

            if ((q.type === 'short' || q.type === 'integer') && !q.correctAnswer) {
                validationErrors.push(`Q${i + 1}: Correct answer is required`);
            }

            return q;
        });

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/tests/${id}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: validatedQuestions }),
            });
            // const res = await fetch(`/api/tests/${id}`, {
            //     method: 'PUT',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({
            //         questions: validatedQuestions
            //     }),
            // });


            if (res.ok) {
                router.push('/admin'); // Redirect to dashboard
            } else {
                const data = await res.json();
                if (data.details) {
                    setErrors(Array.isArray(data.details) ? data.details : [data.details]);
                } else {
                    setErrors([data.error || 'Failed to save questions']);
                }
            }
        } catch (err) {
            setErrors(['Save failed']);
        } finally {
            setSaving(false);
        }
    };

    const updateQuestion = (index: number, field: keyof ParsedQuestion, value: any) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setQuestions(newQuestions);
    };

    const changeQuestionType = (index: number, type: string) => {
        const newQuestions = [...questions];
        const q = newQuestions[index];
        q.type = type;

        // Reset options based on type
        if (type === 'mcq' || type === 'multi-mcq') {
            if (!q.options || q.options.length === 0) {
                q.options = [
                    { id: 'a', text: '' },
                    { id: 'b', text: '' },
                    { id: 'c', text: '' },
                    { id: 'd', text: '' }
                ];
            }
        } else {
            // Clear options for non-option types if desired, or keep them hidden
            // q.options = []; 
        }
        setQuestions(newQuestions);
    };

    const addOption = (qIndex: number) => {
        const newQuestions = [...questions];
        const q = newQuestions[qIndex];
        const lastId = q.options?.length ? q.options[q.options.length - 1].id : '`'; // '`' is char before 'a'
        // Simple alpha increment logic (a->b, z->aa etc is complex, just doing basic char code increment for now)
        // Assuming single char ids for simplicity or just use next char
        const nextId = String.fromCharCode(lastId.charCodeAt(0) + 1);

        q.options.push({ id: nextId, text: '' });
        setQuestions(newQuestions);
    };
    useEffect(() => {
        const loadTest = async () => {
            const res = await fetch(`/api/tests/${id}`);
            const data = await res.json();

            if (data.questions) {
                setQuestions(data.questions);
            }
        };

        loadTest();
    }, [id]);

    const removeOption = (qIndex: number, optIndex: number) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options.splice(optIndex, 1);
        setQuestions(newQuestions);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">Upload Questions</h1>

            <Tabs defaultValue="manual" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual">
                        <FileText className="mr-2 h-4 w-4" />
                        Manual Upload (DOCX)
                    </TabsTrigger>
                    <TabsTrigger value="ai">
                        <Bot className="mr-2 h-4 w-4" />
                        Generate with AI (PDF)
                    </TabsTrigger>
                    <TabsTrigger value="manual-type">
                        <Keyboard className="mr-2 h-4 w-4" />
                        Type Manually
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manual">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <Input
                                    type="file"
                                    accept=".docx"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                />
                                <Button onClick={handleUpload} disabled={!file || loading}>
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
                                    Upload & Parse
                                </Button>
                                <a href="/api/template/download" download="quiz_template.txt">
                                    <Button variant="outline">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Template
                                    </Button>
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ai">
                    <Card>
                        <CardHeader>
                            <CardTitle>Generate Questions from PDF</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Upload PDF Document</Label>
                                <Input
                                    type="file"
                                    accept=".pdf"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Instructions for AI (Optional)</Label>
                                <Textarea
                                    placeholder="e.g., Create 10 hard physics questions focusing on mechanics..."
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleAiGenerate} disabled={!file || loading} className="w-full">
                                {loading ? <Loader2 className="animate-spin mr-2" /> : <Bot className="mr-2" />}
                                Generate Questions
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="manual-type">
                    <Card>
                        <CardHeader>
                            <CardTitle>Manual Entry</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Number of Questions</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={numQuestions}
                                    onChange={e => setNumQuestions(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <Button onClick={handleManualStart} className="w-full">
                                <Keyboard className="mr-2" />
                                Start Typing
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {errors.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Issues Found</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-4">
                            {errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Preview Section */}
            {questions.length > 0 && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Parsed Questions ({questions.length})</h2>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2" />}
                            Confirm & Save
                        </Button>
                    </div>

                    <div className="grid gap-4">
                        {questions.map((q, i) => {
                            if (!q) return null;
                            return (
                                <Card key={i}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-center gap-4">
                                            <CardTitle className="text-lg whitespace-nowrap">Q{i + 1}</CardTitle>
                                            <Select
                                                value={q.type}
                                                onValueChange={(val) => changeQuestionType(i, val)}
                                            >
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Question Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                                                    <SelectItem value="multi-mcq">Multi-Select</SelectItem>
                                                    <SelectItem value="short">Short Answer</SelectItem>
                                                    <SelectItem value="integer">Integer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                className="w-full"
                                                placeholder="Section"
                                                value={q.section}
                                                onChange={e => updateQuestion(i, 'section', e.target.value)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <Label>Stem</Label>
                                            <Textarea
                                                value={q.stem}
                                                onChange={e => updateQuestion(i, 'stem', e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            {(q.type === 'short' || q.type === 'integer') && (
                                                <div>
                                                    <Label>Correct Answer</Label>
                                                    <Input
                                                        value={q.correctAnswer}
                                                        onChange={e => updateQuestion(i, 'correctAnswer', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <Label>Marks</Label>
                                                <Input
                                                    type="number"
                                                    value={q.marks}
                                                    onChange={e => updateQuestion(i, 'marks', parseInt(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Negative Marks</Label>
                                                <Input
                                                    type="number"
                                                    step="0.25"
                                                    value={q.negativeMarks || 0}
                                                    onChange={e => updateQuestion(i, 'negativeMarks', parseFloat(e.target.value))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Explanation</Label>
                                            <Textarea
                                                value={q.explanation || ''}
                                                onChange={e => updateQuestion(i, 'explanation', e.target.value)}
                                            />
                                        </div>

                                        {/* Options with inline correct answer selection */}
                                        {(q.type === 'mcq' || q.type === 'multi-mcq') && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <Label>Options {q.type === 'mcq' ? '(Select one correct)' : '(Select all correct)'}</Label>
                                                    <Button variant="outline" size="sm" onClick={() => addOption(i)}>
                                                        <Plus className="h-4 w-4 mr-1" /> Add Option
                                                    </Button>
                                                </div>
                                                {q.options?.map((opt, j) => (
                                                    <div key={j} className="flex gap-2 items-center">
                                                        {q.type === 'mcq' ? (
                                                            <input
                                                                type="radio"
                                                                name={`correct-${i}`}
                                                                checked={q.correctAnswer === opt.id}
                                                                onChange={() => updateQuestion(i, 'correctAnswer', opt.id)}
                                                                className="h-4 w-4"
                                                            />
                                                        ) : (
                                                            <Checkbox
                                                                checked={Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt.id)}
                                                                onCheckedChange={(checked: boolean) => {
                                                                    const current = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                                                                    if (checked) {
                                                                        updateQuestion(i, 'correctAnswer', [...current, opt.id]);
                                                                    } else {
                                                                        updateQuestion(i, 'correctAnswer', current.filter((id: string) => id !== opt.id));
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                        <span className="font-bold w-6">{opt.id.toUpperCase()})</span>
                                                        <Input
                                                            value={opt.text}
                                                            onChange={e => {
                                                                const newOpts = [...(q.options || [])];
                                                                newOpts[j].text = e.target.value;
                                                                updateQuestion(i, 'options', newOpts);
                                                            }}
                                                        />
                                                        <Button variant="ghost" size="icon" onClick={() => removeOption(i, j)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}


