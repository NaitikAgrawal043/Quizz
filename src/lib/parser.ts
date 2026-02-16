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

export async function parseDocument(buffer: Buffer, fileType: 'docx' | 'pdf'): Promise<ParseResult> {
    let text = '';
    console.log(`parseDocument called for ${fileType}`);

    try {
        if (fileType === 'docx') {
            console.log('Extracting text from DOCX...');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
            console.log('DOCX extraction success');
        } else if (fileType === 'pdf') {
            // PDF parsing via pdf-parse is disabled due to ReferenceError: DOMMatrix is not defined
            // We now use Gemini's native PDF support in the API routes for better reliability
            throw new Error('Please use the AI-assisted PDF parsing in the upload page.');
        }
    } catch (e) {
        console.error('Text extraction failed:', e);
        throw e;
    }

    return parseText(text);
}

function parseText(text: string): ParseResult {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const questions: ParsedQuestion[] = [];
    const errors: string[] = [];

    let currentSection = 'General';
    let currentQuestion: Partial<ParsedQuestion> | null = null;

    const sectionRegex = /^={3,}\s*SECTION:\s*(.+?)\s*={3,}$/i;
    const questionStartRegex = /^Q(\d+)\.\s*(\((.+?)\))?\s*(.+?)(\[marks=(\d+)\])?$/i;
    const optionRegex = /^([A-Z])[\.\)]\s*(.+)$/;
    const answerRegex = /^Answer:\s*(.+)$/i;
    const explanationRegex = /^Explanation:\s*(.+)$/i;
    const imageRegex = /^Image:\s*(.+)$/i;

    for (const line of lines) {
        const sectionMatch = line.match(sectionRegex);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            continue;
        }

        const qMatch = line.match(questionStartRegex);
        if (qMatch) {
            if (currentQuestion) {
                if (validateQuestion(currentQuestion)) {
                    questions.push(currentQuestion as ParsedQuestion);
                } else {
                    errors.push(`Incomplete question before Q${qMatch[1]}`);
                }
            }

            const typeRaw = qMatch[3]?.toLowerCase() || 'mcq';
            let type: ParsedQuestion['type'] = 'mcq';
            if (typeRaw.includes('multi')) type = 'multi-mcq';
            else if (typeRaw.includes('integer')) type = 'integer';
            else if (typeRaw.includes('short')) type = 'short';

            const marks = qMatch[6] ? parseInt(qMatch[6]) : 1;

            currentQuestion = {
                section: currentSection,
                type,
                stem: qMatch[4].trim(),
                options: [],
                marks,
                correctAnswer: null,
            };
            continue;
        }

        if (!currentQuestion) continue;

        const optMatch = line.match(optionRegex);
        if (optMatch && (currentQuestion.type === 'mcq' || currentQuestion.type === 'multi-mcq')) {
            currentQuestion.options?.push({
                id: optMatch[1].toLowerCase(),
                text: optMatch[2].trim()
            });
            continue;
        }

        const ansMatch = line.match(answerRegex);
        if (ansMatch) {
            let ans = ansMatch[1].trim();
            if (currentQuestion.type === 'mcq') {
                currentQuestion.correctAnswer = ans.toLowerCase();
            } else if (currentQuestion.type === 'multi-mcq') {
                currentQuestion.correctAnswer = ans.split(',').map(a => a.trim().toLowerCase());
            } else if (currentQuestion.type === 'integer') {
                currentQuestion.correctAnswer = parseInt(ans);
            } else {
                currentQuestion.correctAnswer = ans;
            }
            continue;
        }

        const expMatch = line.match(explanationRegex);
        if (expMatch) {
            currentQuestion.explanation = expMatch[1].trim();
            continue;
        }

        const imgMatch = line.match(imageRegex);
        if (imgMatch) {
            currentQuestion.image = imgMatch[1].trim();
            continue;
        }
    }

    if (currentQuestion) {
        if (validateQuestion(currentQuestion)) {
            questions.push(currentQuestion as ParsedQuestion);
        } else {
            errors.push('Incomplete question at end of file');
        }
    }

    return { questions, errors };
}

function validateQuestion(q: Partial<ParsedQuestion>): boolean {
    if (!q.stem || !q.correctAnswer) return false;
    if ((q.type === 'mcq' || q.type === 'multi-mcq') && (!q.options || q.options.length === 0)) return false;
    return true;
}
