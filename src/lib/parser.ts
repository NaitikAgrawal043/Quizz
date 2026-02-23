import mammoth from 'mammoth';

export interface ParsedQuestion {
    section: string;
    type: 'mcq' | 'multi-mcq' | 'integer' | 'short';
    stem: string;
    options: { id: string; text: string }[];
    correctAnswer: any;
    marks: number;
    negativeMarks?: number;
    explanation?: string;
    image?: string;
}

export interface ParseResult {
    questions: ParsedQuestion[];
    errors: string[];
}

export async function parseDocument(buffer: Buffer, fileType: 'docx' | 'pdf' | 'txt'): Promise<ParseResult> {
    let text = '';
    console.log(`parseDocument called for ${fileType}`);

    try {
        if (fileType === 'docx') {
            console.log('Extracting text from DOCX...');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
            console.log('DOCX extraction success, length:', text.length);
        } else if (fileType === 'txt') {
            console.log('Reading plain text file...');
            text = buffer.toString('utf-8');
            console.log('TXT read success, length:', text.length);
        } else if (fileType === 'pdf') {
            // PDF parsing via pdf-parse is disabled due to ReferenceError: DOMMatrix is not defined
            // We now use Gemini's native PDF support in the API routes for better reliability
            throw new Error('Please use the AI-assisted PDF parsing in the upload page.');
        }
    } catch (e) {
        console.error('Text extraction failed:', e);
        throw e;
    }

    console.log('--- Extracted text preview ---');
    console.log(text.substring(0, 500));
    console.log('--- End preview ---');

    return parseText(text);
}

function parseText(text: string): ParseResult {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const questions: ParsedQuestion[] = [];
    const errors: string[] = [];

    let currentSection = 'General';
    let currentQuestion: Partial<ParsedQuestion> | null = null;

    // --- Flexible Regex Patterns ---

    // Section: === SECTION: Name === OR --- SECTION: Name --- OR just SECTION: Name
    const sectionRegex = /^(?:={3,}|-{3,})?\s*SECTION\s*:\s*(.+?)\s*(?:={3,}|-{3,})?$/i;

    // Question start: Q1. or Q1) or 1. or 1) — with optional (MCQ/Multi-MCQ/Integer/Short) and [marks=N]
    // Uses greedy capture for stem and specific trailing pattern for marks
    const questionStartRegex = /^(?:Q|q)?(\d+)[.)]\s*(?:\(([^)]+)\)\s*)?(.+?)(?:\s*\[marks\s*=\s*(\d+)\])?\s*$/i;

    // Options: A) or a) or A. or a. or (A) or (a) — upper or lowercase
    const optionRegex = /^(?:\()?([A-Za-z])[.)]\)?\s*(.+)$/;

    // Answer: Answer: X or Ans: X or Ans : X (flexible spacing)
    const answerRegex = /^(?:Answer|Ans)\s*:\s*(.+)$/i;

    // Explanation: Explanation: X or Exp: X
    const explanationRegex = /^(?:Explanation|Exp)\s*:\s*(.+)$/i;

    // Image
    const imageRegex = /^Image\s*:\s*(.+)$/i;

    for (const line of lines) {
        // Check for section header
        const sectionMatch = line.match(sectionRegex);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            continue;
        }

        // Check for question start
        const qMatch = line.match(questionStartRegex);
        if (qMatch) {
            // Save previous question
            if (currentQuestion) {
                finalizeAndPush(currentQuestion, questions, errors, qMatch[1]);
            }

            const typeRaw = qMatch[2]?.toLowerCase() || '';
            let type: ParsedQuestion['type'] = 'mcq'; // default
            if (typeRaw.includes('multi')) type = 'multi-mcq';
            else if (typeRaw.includes('integer') || typeRaw.includes('int')) type = 'integer';
            else if (typeRaw.includes('short')) type = 'short';

            const marks = qMatch[4] ? parseInt(qMatch[4]) : 1;

            currentQuestion = {
                section: currentSection,
                type,
                stem: qMatch[3].trim(),
                options: [],
                marks,
                correctAnswer: null,
            };
            continue;
        }

        if (!currentQuestion) continue;

        // Check for option line
        const optMatch = line.match(optionRegex);
        if (optMatch && (currentQuestion.type === 'mcq' || currentQuestion.type === 'multi-mcq')) {
            currentQuestion.options?.push({
                id: optMatch[1].toLowerCase(),
                text: optMatch[2].trim()
            });
            continue;
        }

        // Check for answer line
        const ansMatch = line.match(answerRegex);
        if (ansMatch) {
            const ans = ansMatch[1].trim();
            resolveAnswer(currentQuestion, ans);
            continue;
        }

        // Check for explanation line
        const expMatch = line.match(explanationRegex);
        if (expMatch) {
            currentQuestion.explanation = expMatch[1].trim();
            continue;
        }

        // Check for image line
        const imgMatch = line.match(imageRegex);
        if (imgMatch) {
            currentQuestion.image = imgMatch[1].trim();
            continue;
        }

        // If none of the above matched, append to the current question's stem
        // (handles multi-line question stems)
        if (currentQuestion.stem && currentQuestion.options?.length === 0 && !currentQuestion.correctAnswer) {
            currentQuestion.stem += ' ' + line;
        }
    }

    // Don't forget the last question
    if (currentQuestion) {
        finalizeAndPush(currentQuestion, questions, errors);
    }

    // Post-processing: auto-detect type if no type annotation was provided
    for (const q of questions) {
        if (q.type === 'mcq' && q.options.length === 0) {
            // No options means it's likely a short/integer answer
            if (typeof q.correctAnswer === 'number' || /^\d+$/.test(String(q.correctAnswer))) {
                q.type = 'integer';
                q.correctAnswer = parseInt(String(q.correctAnswer));
            } else {
                q.type = 'short';
            }
        }
    }

    return { questions, errors };
}

/**
 * Resolve the answer value based on question type and content.
 * Handles cases like: "C", "A, C", "3", "option 3", numeric option indices, etc.
 */
function resolveAnswer(q: Partial<ParsedQuestion>, ans: string): void {
    if (q.type === 'integer') {
        q.correctAnswer = parseInt(ans);
        return;
    }

    if (q.type === 'short') {
        q.correctAnswer = ans;
        return;
    }

    if (q.type === 'multi-mcq') {
        // e.g., "A, C" or "a,c" or "1, 3"
        const parts = ans.split(/[,\s]+/).map(a => a.trim().toLowerCase()).filter(a => a);
        q.correctAnswer = parts.map(p => normalizeAnswerValue(p, q.options || []));
        return;
    }

    // MCQ — single answer
    q.correctAnswer = normalizeAnswerValue(ans.toLowerCase(), q.options || []);
}

/**
 * Normalize an answer value. If it's a number like "3", convert to the
 * corresponding option letter (e.g., 3 -> 'c'). If it's already a letter, use as-is.
 */
function normalizeAnswerValue(val: string, options: { id: string; text: string }[]): string {
    // If it's a single letter a-z, use directly
    if (/^[a-z]$/.test(val)) {
        return val;
    }

    // If it's a number, try converting to option letter (1=a, 2=b, 3=c, etc.)
    const num = parseInt(val);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
        return options[num - 1].id;
    }

    // Fallback: return as-is
    return val;
}

function finalizeAndPush(
    q: Partial<ParsedQuestion>,
    questions: ParsedQuestion[],
    errors: string[],
    nextQNum?: string
): void {
    if (validateQuestion(q)) {
        questions.push(q as ParsedQuestion);
    } else {
        const msg = nextQNum
            ? `Incomplete question before Q${nextQNum}`
            : 'Incomplete question at end of file';
        errors.push(msg);
        console.warn(msg, JSON.stringify(q));
    }
}

function validateQuestion(q: Partial<ParsedQuestion>): boolean {
    if (!q.stem || q.correctAnswer === null || q.correctAnswer === undefined) return false;
    if ((q.type === 'mcq' || q.type === 'multi-mcq') && (!q.options || q.options.length === 0)) return false;
    return true;
}
