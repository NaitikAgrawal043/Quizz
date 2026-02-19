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

export async function parseDocument(buffer: Buffer, fileType: 'docx' | 'pdf' | 'md' | 'txt'): Promise<ParseResult> {
    let text = '';
    console.log(`parseDocument called for ${fileType}`);

    try {
        if (fileType === 'docx') {
            console.log('Extracting text from DOCX...');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
            console.log('DOCX extraction success, length:', text.length);
        } else if (fileType === 'md') {
            console.log('Reading Markdown file...');
            text = buffer.toString('utf-8');
            console.log('Markdown read success, length:', text.length);
        } else if (fileType === 'txt') {
            console.log('Reading plain text file...');
            text = buffer.toString('utf-8');
            console.log('TXT read success, length:', text.length);
        } else if (fileType === 'pdf') {
            throw new Error('PDF parsing is currently not supported. Please convert your PDF to DOCX format or use the text template.');
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
    // Auto-detect format: if text contains markdown-style headers, use markdown parser
    const isMarkdownFormat = /^##\s+Question\s+\d+/im.test(text) ||
        /\*\*Question:\*\*/i.test(text) ||
        /\*\*Correct Answer:\*\*/i.test(text);

    if (isMarkdownFormat) {
        console.log('Detected markdown question format');
        return parseMarkdownFormat(text);
    }

    console.log('Using legacy template format');
    return parseLegacyFormat(text);
}

/**
 * Parses markdown-native question format:
 * ## Question N
 * **Question:** stem text (can be multi-line)
 * **Options:**
 * - (A) option text
 * - (B) option text
 * **Correct Answer:** (D) answer text
 * **Explanation:** explanation text (can be multi-line)
 * ---
 */
function parseMarkdownFormat(text: string): ParseResult {
    const questions: ParsedQuestion[] = [];
    const errors: string[] = [];

    // Split by --- or ## Question separators
    // First split by --- to get question blocks
    const blocks = text.split(/\n---+\n/).map(b => b.trim()).filter(b => b);

    // If no --- separators, try splitting by ## Question headers
    let questionBlocks: string[];
    if (blocks.length <= 1) {
        // Split by ## Question headers, keeping the header with each block
        questionBlocks = text.split(/(?=^##\s+Question\s+\d+)/im).map(b => b.trim()).filter(b => b);
    } else {
        questionBlocks = blocks;
    }

    for (let blockIdx = 0; blockIdx < questionBlocks.length; blockIdx++) {
        const block = questionBlocks[blockIdx];
        if (!block) continue;

        try {
            const q: Partial<ParsedQuestion> = {
                section: 'General',
                type: 'mcq',
                stem: '',
                options: [],
                marks: 1,
                negativeMarks: 0,
                correctAnswer: null,
            };

            const lines = block.split(/\r?\n/);

            let mode: 'stem' | 'options' | 'explanation' | 'none' = 'none';
            const stemLines: string[] = [];
            const explanationLines: string[] = [];

            for (const rawLine of lines) {
                const line = rawLine.trim();

                // Skip empty lines and question headers like "## Question 46"
                if (!line) continue;
                if (/^#{1,3}\s+Question\s+\d+/i.test(line)) continue;

                // Detect **Question:** prefix — start collecting stem
                const questionMatch = line.match(/^\*\*Question:\*\*\s*(.*)/i);
                if (questionMatch) {
                    mode = 'stem';
                    if (questionMatch[1].trim()) {
                        stemLines.push(questionMatch[1].trim());
                    }
                    continue;
                }

                // Detect **Options:** header
                if (/^\*\*Options:\*\*/i.test(line)) {
                    mode = 'options';
                    continue;
                }

                // Detect option line: - (A) text or * (A) text
                const optionMatch = line.match(/^[-*]\s*\(([A-Za-z])\)\s*(.+)/);
                if (optionMatch) {
                    mode = 'options';
                    q.options?.push({
                        id: optionMatch[1].toLowerCase(),
                        text: optionMatch[2].trim(),
                    });
                    continue;
                }

                // Detect **Correct Answer:** (D) 0.225 or **Correct Answer:** D
                const answerMatch = line.match(/^\*\*Correct Answer:\*\*\s*\(?([A-Za-z])\)?\s*(.*)/i);
                if (answerMatch) {
                    mode = 'none';
                    const ansLetter = answerMatch[1].toLowerCase();
                    // Determine if multi-select based on commas
                    if (ansLetter.includes(',')) {
                        q.type = 'multi-mcq';
                        q.correctAnswer = ansLetter.split(',').map(a => a.trim().toLowerCase());
                    } else {
                        q.correctAnswer = ansLetter;
                    }
                    continue;
                }

                // Also support "Answer: D" plain format within markdown blocks
                const plainAnswerMatch = line.match(/^Answer:\s*\(?([A-Za-z])\)?\s*/i);
                if (plainAnswerMatch) {
                    mode = 'none';
                    q.correctAnswer = plainAnswerMatch[1].toLowerCase();
                    continue;
                }

                // Detect **Explanation:** prefix
                const expMatch = line.match(/^\*\*Explanation:\*\*\s*(.*)/i);
                if (expMatch) {
                    mode = 'explanation';
                    if (expMatch[1].trim()) {
                        explanationLines.push(expMatch[1].trim());
                    }
                    continue;
                }

                // Accumulate multi-line content based on current mode
                if (mode === 'stem') {
                    stemLines.push(line);
                } else if (mode === 'explanation') {
                    explanationLines.push(line);
                }
            }

            q.stem = stemLines.join('\n');
            if (explanationLines.length > 0) {
                q.explanation = explanationLines.join('\n');
            }

            // Determine type from options count
            if (q.options && q.options.length > 0) {
                q.type = Array.isArray(q.correctAnswer) ? 'multi-mcq' : 'mcq';
            } else if (q.correctAnswer && !isNaN(Number(q.correctAnswer))) {
                q.type = 'integer';
            } else if (q.options?.length === 0) {
                q.type = 'short';
            }

            if (validateQuestion(q)) {
                questions.push(q as ParsedQuestion);
            } else if (q.stem) {
                errors.push(`Question ${blockIdx + 1}: Incomplete — missing answer or options`);
            }
        } catch (e) {
            errors.push(`Question ${blockIdx + 1}: Parse error`);
        }
    }

    return { questions, errors };
}

/**
 * Parses the legacy template format:
 * Q1. (mcq) stem text
 * A. option text
 * Answer: a
 * Explanation: text
 */
function parseLegacyFormat(text: string): ParseResult {
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

