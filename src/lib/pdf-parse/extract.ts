import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export type SourceType = 'exam' | 'book';

export interface ExtractPdfQuestionsInput {
    base64Data: string;
    sourceType: SourceType;
    chapter: string;
    unit: string;
    chapterUnit: string;
    maxQuestions: number;
}

export interface ParsedQuestion {
    section: string;
    type: string;
    stem: string;
    options: { id: string; text: string }[];
    correctAnswer: string;
    marks: number;
    negativeMarks: number;
    explanation: string;
}

interface RawOption {
    id?: unknown;
    text?: unknown;
}

interface RawQuestion {
    section?: unknown;
    type?: unknown;
    stem?: unknown;
    options?: unknown;
    correctAnswer?: unknown;
    marks?: unknown;
    negativeMarks?: unknown;
    explanation?: unknown;
}

function buildPrompt(
    sourceType: SourceType,
    scope: { chapter: string; unit: string; chapterUnit: string; maxQuestions: number }
): string {
    const filters = [
        scope.chapterUnit ? `chapter/unit text: "${scope.chapterUnit}"` : '',
        scope.chapter ? `chapter: "${scope.chapter}"` : '',
        scope.unit ? `unit: "${scope.unit}"` : '',
    ].filter(Boolean);

    const scopeInstruction = filters.length > 0
        ? `Focus only on content matching: ${filters.join(', ')}.`
        : 'If no chapter/unit hint is provided, focus on clearly marked exercise/practice/problem sections.';

    if (sourceType === 'book') {
        return `Analyze the provided BOOK PDF and extract exercise questions into a JSON array.
Rules:
1. Extract only exercise/practice/end-of-chapter questions (not theory paragraphs).
2. ${scopeInstruction}
3. Return at most ${scope.maxQuestions} questions.
4. Keep full question stems.
5. Include options for objective questions when available.
6. If answer key exists, set correctAnswer from it; otherwise keep correctAnswer as an empty string.
7. Default marks: 1, Negative marks: 0.
8. Return valid JSON matching the schema only.`;
    }

    return `Analyze the provided PDF document and extract all questions into a JSON array.
Follow these rules strictly:
1. Identify all questions, options, and answers.
2. If there's an answer key table, use it to set the 'correctAnswer'.
3. Default marks: 1, Negative marks: 0.
4. Ensure the 'stem' contains the full question text.
5. Return at most ${scope.maxQuestions} questions.
6. Provide a valid JSON array matching the schema.`;
}

function repairTruncatedJson(jsonString: string): string {
    const trimmed = jsonString.trim();
    if (!trimmed.startsWith('[')) return '[]';

    let current = trimmed;
    while (current.length > 2 && current[current.length - 1] !== '}') {
        current = current.substring(0, current.length - 1);
    }

    const lastCommaBrace = current.lastIndexOf('},');
    if (lastCommaBrace !== -1) {
        const safeParams = current.substring(0, current.lastIndexOf('}') + 1);
        return safeParams + ']';
    }

    if (current.endsWith('}')) {
        return current + ']';
    }

    return '[]';
}

function buildSchema(): Schema {
    return {
        type: SchemaType.ARRAY,
        items: {
            type: SchemaType.OBJECT,
            properties: {
                section: { type: SchemaType.STRING, description: 'The section name (e.g. Physics, Math)' },
                type: { type: SchemaType.STRING, format: 'enum', enum: ['mcq', 'multi-mcq', 'integer', 'short'], description: 'The question type' },
                stem: { type: SchemaType.STRING, description: 'The full question text.' },
                options: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            id: { type: SchemaType.STRING, description: 'Option identifier (e.g. A, B)' },
                            text: { type: SchemaType.STRING, description: 'Option text' }
                        },
                        required: ['id', 'text']
                    }
                },
                correctAnswer: { type: SchemaType.STRING, description: 'Correct answer as a string' },
                marks: { type: SchemaType.NUMBER, description: 'Default to 1' },
                negativeMarks: { type: SchemaType.NUMBER, description: 'Default to 0' },
                explanation: { type: SchemaType.STRING, description: 'Brief explanation' }
            },
            required: ['section', 'type', 'stem', 'correctAnswer', 'marks', 'negativeMarks']
        }
    };
}

export async function extractPdfQuestions(input: ExtractPdfQuestionsInput): Promise<ParsedQuestion[]> {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: buildSchema(),
        }
    });

    const prompt = buildPrompt(input.sourceType, {
        chapter: input.chapter,
        unit: input.unit,
        chapterUnit: input.chapterUnit,
        maxQuestions: input.maxQuestions
    });

    const result = await model.generateContent([
        { text: prompt },
        {
            inlineData: {
                data: input.base64Data,
                mimeType: 'application/pdf',
            },
        },
    ]);

    const response = await result.response;
    const text = response.text();

    let cleanText = text.trim();
    if (cleanText.includes('```')) {
        const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) cleanText = match[1].trim();
    }

    let questionsArray: unknown[];
    try {
        questionsArray = JSON.parse(cleanText);
    } catch (e) {
        console.warn('Initial parse failed, attempting repair:', e);
        const repaired = repairTruncatedJson(cleanText);
        questionsArray = JSON.parse(repaired);
    }

    if (!Array.isArray(questionsArray)) {
        throw new Error('AI response is not an array');
    }

    const validQuestions = questionsArray.map((rawQuestion: unknown) => {
        const q = (rawQuestion || {}) as RawQuestion;
        const rawType = typeof q.type === 'string' ? q.type : '';
        const options = Array.isArray(q.options)
            ? (q.options as RawOption[]).map((opt: RawOption, idx: number) => ({
                id: String(opt?.id ?? String.fromCharCode(97 + idx)).toLowerCase(),
                text: String(opt?.text ?? '').trim(),
            }))
            : [];

        return {
            section: String(q.section || (input.sourceType === 'book' ? 'Book Exercises' : 'General')),
            type: ['mcq', 'multi-mcq', 'integer', 'short'].includes(rawType) ? rawType : 'mcq',
            stem: String(q.stem || ''),
            options,
            correctAnswer: String(q.correctAnswer ?? '').trim(),
            marks: typeof q.marks === 'number' ? q.marks : 1,
            negativeMarks: typeof q.negativeMarks === 'number' ? q.negativeMarks : 0,
            explanation: String(q.explanation || '')
        };
    })
        .filter((q) => q.stem?.trim())
        .slice(0, input.maxQuestions);

    return validQuestions;
}
