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

export async function parseDocument(buffer: Buffer, fileType: 'docx' | 'pdf' | 'md'): Promise<ParseResult> {
    let text = '';
    console.log(`parseDocument called for ${fileType}`);

    try {
        if (fileType === 'docx') {
            console.log('Extracting text from DOCX...');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
            console.log('DOCX extraction success');
        } else if (fileType === 'md') {
            console.log('Reading Markdown file...');
            text = buffer.toString('utf-8');
            console.log('Markdown read success');
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

    const sectionRegex = /^={3,}\s*SECTION:\s*(.+?)\s*={3,}$/i;
    const questionStartRegex = /^Q(\d+)\.\s*(\((.+?)\))?\s*(.+?)(\[marks=(\d+)\])?$/i;
    const optionRegex = /^([A-Z])[\.\\)]\s*(.+)$/;
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

