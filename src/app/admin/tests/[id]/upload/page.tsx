'use client';
import { useEffect, useRef } from 'react';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle, AlertTriangle, Download, BookOpen, FileText, Keyboard, Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { ImageUploadButton } from '@/components/ui/image-upload-button';
import { Toaster } from '@/components/ui/toaster';

interface ParsedQuestion {
    section: string;
    type: string;
    stem: string;
    options: { id: string; text: string }[];
    correctAnswer: any;
    marks: number;
    negativeMarks?: number;
    explanation?: string;
    timeLimit?: number;
    images?: { url: string; publicId: string }[];
}

export default function UploadPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bookFile, setBookFile] = useState<File | null>(null);
    const [chapter, setChapter] = useState('');
    const [unit, setUnit] = useState('');
    const [chapterUnit, setChapterUnit] = useState('');
    const [maxQuestions, setMaxQuestions] = useState(30);
    const [activeTab, setActiveTab] = useState('manual');
    const [numQuestions, setNumQuestions] = useState(5);

    // Refs for textareas to track cursor position for image insertion
    const stemRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
    const explanationRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
    const optionRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

    /**
     * Generic image upload handler — inserts cld:publicId at cursor position
     * in any textarea field (stem, explanation, or option).
     */
    const handleFieldImageUpload = (
        questionIndex: number,
        imageData: { url: string; publicId: string },
        textareaRef: HTMLTextAreaElement | null,
        currentValue: string,
        setValue: (newVal: string) => void
    ) => {
        const imageMarkdown = `![image](cld:${imageData.publicId})`;

        // Track the image metadata on the question
        const newQuestions = [...questions];
        const currentImages = newQuestions[questionIndex].images || [];
        newQuestions[questionIndex] = {
            ...newQuestions[questionIndex],
            images: [...currentImages, { url: imageData.publicId, publicId: imageData.publicId }],
        };
        setQuestions(newQuestions);

        if (textareaRef) {
            const cursorPos = textareaRef.selectionStart ?? currentValue.length;
            const before = currentValue.slice(0, cursorPos);
            const after = currentValue.slice(cursorPos);
            const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
            const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
            const newValue = before + prefix + imageMarkdown + suffix + after;
            setValue(newValue);

            const newCursorPos = (before + prefix + imageMarkdown + suffix).length;
            requestAnimationFrame(() => {
                textareaRef.focus();
                textareaRef.setSelectionRange(newCursorPos, newCursorPos);
            });
        } else {
            setValue(currentValue + (currentValue.length > 0 ? '\n' : '') + imageMarkdown);
        }
    };

    const pollParseJob = async (jobId: string) => {
        const maxPolls = 90;
        let polls = 0;

        while (polls < maxPolls) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const statusRes = await fetch(`/api/tests/${id}/parse-pdf?jobId=${encodeURIComponent(jobId)}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'completed' && statusData.questions) {
                const sanitizedQuestions = statusData.questions.map((q: any) => ({
                    ...q,
                    marks: q.marks ?? 1,
                    negativeMarks: q.negativeMarks ?? 0
                }));
                setQuestions(prev => [...prev, ...sanitizedQuestions]);
                return;
            }

            if (statusData.status === 'failed') {
                setErrors([statusData.error || 'Failed to parse PDF in worker']);
                return;
            }

            polls += 1;
        }

        setErrors(['Parsing is taking too long. Please try again in a bit.']);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setErrors([]);

        const formData = new FormData();
        formData.append('file', file);

        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const endpoint = isPdf ? `/api/tests/${id}/parse-pdf` : `/api/tests/${id}/upload`;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.questions) {
                // Ensure default values are applied just in case
                const sanitizedQuestions = data.questions.map((q: any) => ({
                    ...q,
                    marks: q.marks ?? 1,
                    negativeMarks: q.negativeMarks ?? 0
                }));
                setQuestions(prev => [...prev, ...sanitizedQuestions]);
                setErrors(data.errors || []);
            } else if (res.status === 202 && data.jobId) {
                await pollParseJob(String(data.jobId));
            } else {
                setErrors([data.error || 'Failed to parse file', data.details].filter(Boolean));
            }
        } catch (err) {
            setErrors(['Upload failed']);
        } finally {
            setLoading(false);
        }
    };

    const handleBookExtract = async () => {
        if (!bookFile) return;
        setLoading(true);
        setErrors([]);

        const formData = new FormData();
        formData.append('file', bookFile);
        formData.append('sourceType', 'book');
        formData.append('chapter', chapter.trim());
        formData.append('unit', unit.trim());
        formData.append('chapterUnit', chapterUnit.trim());
        formData.append('maxQuestions', String(maxQuestions || 30));

        try {
            const res = await fetch(`/api/tests/${id}/parse-pdf`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.questions) {
                const sanitizedQuestions = data.questions.map((q: any) => ({
                    ...q,
                    marks: q.marks ?? 1,
                    negativeMarks: q.negativeMarks ?? 0
                }));
                setQuestions(prev => [...prev, ...sanitizedQuestions]);
            } else if (res.status === 202 && data.jobId) {
                await pollParseJob(String(data.jobId));
            } else {
                setErrors([data.error || 'Failed to extract questions from book PDF', data.details].filter(Boolean));
            }
        } catch (err) {
            setErrors(['Book extraction failed']);
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
            explanation: '',
            timeLimit: 60
        }));
        setQuestions(prev => [...prev, ...newQuestions]);
        setErrors([]);
    };

    const addQuestion = () => {
        setQuestions(prev => [...prev, {
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
            explanation: '',
            timeLimit: 60
        }]);
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
            // const res = await fetch(`/api/tests/${id}/questions`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ questions: validatedQuestions }),
            // });
            const res = await fetch(`/api/tests/${id}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: validatedQuestions }),
            });



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

    const removeQuestion = (qIndex: number) => {
        setQuestions(questions.filter((_, i) => i !== qIndex));
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">Upload Questions</h1>

            <Tabs defaultValue="manual" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual">
                        <FileText className="mr-2 h-4 w-4" />
                        Upload File (DOCX/MD)
                    </TabsTrigger>
                    <TabsTrigger value="book">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Upload Book PDF
                    </TabsTrigger>
                    <TabsTrigger value="manual-type">
                        <Keyboard className="mr-2 h-4 w-4" />
                        Type Manually
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manual">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload Document (DOCX or Markdown)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <Input
                                    type="file"

                                    accept=".docx,.md,.txt"
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
                            <p className="text-xs text-muted-foreground mt-2">
                                Supported: DOCX and Markdown (.md) files.
                                For PDFs, use the "Upload Book PDF" tab.
                                Follow the standard template format for best results.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="book">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload Book PDF and Extract Exercise Questions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Book PDF</Label>
                                <Input
                                    type="file"
                                    accept=".pdf"
                                    onChange={e => setBookFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Chapter (Optional)</Label>
                                <Input
                                    placeholder="e.g., Chapter 6"
                                    value={chapter}
                                    onChange={e => setChapter(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Unit (Optional)</Label>
                                <Input
                                    placeholder="e.g., Unit 2"
                                    value={unit}
                                    onChange={e => setUnit(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Chapter/Unit Hint (Optional)</Label>
                                <Input
                                    placeholder="e.g., Gravitation exercises only"
                                    value={chapterUnit}
                                    onChange={e => setChapterUnit(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Questions</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={200}
                                    value={maxQuestions}
                                    onChange={e => setMaxQuestions(parseInt(e.target.value) || 30)}
                                />
                            </div>
                            <Button onClick={handleBookExtract} disabled={!bookFile || loading} className="w-full">
                                {loading ? <Loader2 className="animate-spin mr-2" /> : <BookOpen className="mr-2" />}
                                Extract Exercise Questions
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
                        <h2 className="text-xl font-semibold">Question Preview ({questions.length})</h2>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={addQuestion}>
                                <Plus className="mr-1 h-4 w-4" /> Add Question
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2" />}
                                Confirm & Save
                            </Button>
                        </div>
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive shrink-0"
                                                onClick={() => removeQuestion(i)}
                                                title="Delete question"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <Label>Stem (Markdown supported)</Label>
                                                <ImageUploadButton
                                                    onUpload={(data) => handleFieldImageUpload(
                                                        i, data,
                                                        stemRefs.current[i],
                                                        q.stem,
                                                        (val) => updateQuestion(i, 'stem', val)
                                                    )}
                                                />
                                            </div>
                                            <Textarea
                                                ref={(el) => { stemRefs.current[i] = el; }}
                                                value={q.stem}
                                                onChange={e => updateQuestion(i, 'stem', e.target.value)}
                                                rows={4}
                                                placeholder="Write your question using Markdown... e.g. **bold**, *italic*, ![image](url)"
                                            />
                                            {q.stem && (
                                                <div className="mt-2 p-3 border rounded-md bg-muted/30">
                                                    <p className="text-xs text-muted-foreground mb-1 font-medium">Preview</p>
                                                    <MarkdownRenderer content={q.stem} />
                                                </div>
                                            )}
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
                                            <div>
                                                <Label>Time Limit (sec)</Label>
                                                <Input
                                                    type="number"
                                                    min="10"
                                                    value={q.timeLimit || 60}
                                                    onChange={e => updateQuestion(i, 'timeLimit', parseInt(e.target.value))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <Label>Explanation (Markdown supported)</Label>
                                                <ImageUploadButton
                                                    onUpload={(data) => handleFieldImageUpload(
                                                        i, data,
                                                        explanationRefs.current[i],
                                                        q.explanation || '',
                                                        (val) => updateQuestion(i, 'explanation', val)
                                                    )}
                                                />
                                            </div>
                                            <Textarea
                                                ref={(el) => { explanationRefs.current[i] = el; }}
                                                value={q.explanation || ''}
                                                onChange={e => updateQuestion(i, 'explanation', e.target.value)}
                                                rows={3}
                                                placeholder="Explain the answer using Markdown..."
                                            />
                                            {q.explanation && (
                                                <div className="mt-2 p-3 border rounded-md bg-muted/30">
                                                    <p className="text-xs text-muted-foreground mb-1 font-medium">Preview</p>
                                                    <MarkdownRenderer content={q.explanation} />
                                                </div>
                                            )}
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
                                                        <span className="font-bold w-6 pt-2">{opt.id.toUpperCase()})</span>
                                                        <div className="flex-1 space-y-1">
                                                            <Textarea
                                                                ref={(el) => { optionRefs.current[`${i}-${j}`] = el; }}
                                                                value={opt.text}
                                                                onChange={e => {
                                                                    const newOpts = [...(q.options || [])];
                                                                    newOpts[j].text = e.target.value;
                                                                    updateQuestion(i, 'options', newOpts);
                                                                }}
                                                                rows={2}
                                                                placeholder="Option text (Markdown supported)"
                                                            />
                                                        </div>
                                                        <ImageUploadButton
                                                            onUpload={(data) => handleFieldImageUpload(
                                                                i, data,
                                                                optionRefs.current[`${i}-${j}`],
                                                                opt.text,
                                                                (val) => {
                                                                    const newOpts = [...(q.options || [])];
                                                                    newOpts[j].text = val;
                                                                    updateQuestion(i, 'options', newOpts);
                                                                }
                                                            )}
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

                    <Button variant="outline" onClick={addQuestion} className="w-full mt-2">
                        <Plus className="mr-1 h-4 w-4" /> Add Another Question
                    </Button>
                </div>
            )}

            <Toaster />
        </div>
    );
}


