import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import dbConnect from '@/lib/db/connect';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        // const { id } = await params; // Unused but keep if needed for future

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString('base64');

        // Use a strict schema to force valid JSON from Gemini
        const schema: Schema = {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    section: { type: SchemaType.STRING, description: "The section name (e.g. Physics, Math)" },
                    type: { type: SchemaType.STRING, format: "enum", enum: ["mcq", "multi-mcq", "integer", "short"], description: "The question type" },
                    stem: { type: SchemaType.STRING, description: "The full question text, including any code snippets. Ensure all characters are properly escaped." },
                    options: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.STRING, description: "Option identifier (e.g. A, B)" },
                                text: { type: SchemaType.STRING, description: "Option text" }
                            },
                            required: ["id", "text"]
                        }
                    },
                    correctAnswer: { type: SchemaType.STRING, description: "Correct answer (e.g. A, or [A,B] for multi), formatted as a string" },
                    marks: { type: SchemaType.NUMBER, description: "Default to 1" },
                    negativeMarks: { type: SchemaType.NUMBER, description: "Default to 0" },
                    explanation: { type: SchemaType.STRING, description: "Brief explanation" }
                },
                required: ["section", "type", "stem", "correctAnswer", "marks", "negativeMarks"]
            }
        };

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                responseSchema: schema,
            }
        });

        const prompt = `Analyze the provided PDF document and extract all questions into a JSON array.
Follow these rules strictly:
1. Identify all questions, options, and answers.
2. If there's an answer key table, use it to set the 'correctAnswer'.
3. Default marks: 1, Negative marks: 0.
4. Ensure the 'stem' contains the full question text.
5. Provide a valid JSON array matching the schema.`;

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    data: base64Data,
                    mimeType: 'application/pdf',
                },
            },
        ]);
        const response = await result.response;
        const text = response.text();

        try {
            let cleanText = text.trim();
            if (cleanText.includes('```')) {
                const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match) cleanText = match[1].trim();
            }

            let questionsArray;
            try {
                questionsArray = JSON.parse(cleanText);
            } catch (e) {
                // If parse fails, try to repair truncated JSON
                console.warn('Initial parse failed, attempting repair:', e);
                const repaired = repairTruncatedJson(cleanText);
                questionsArray = JSON.parse(repaired);
            }

            if (!Array.isArray(questionsArray)) {
                throw new Error('AI response is not an array');
            }

            // Consistency check and sanitization
            const validQuestions = questionsArray.map((q: any) => ({
                section: q.section || 'General',
                type: q.type || 'mcq',
                stem: q.stem || '',
                options: Array.isArray(q.options) ? q.options : [],
                correctAnswer: q.correctAnswer,
                marks: typeof q.marks === 'number' ? q.marks : 1,
                negativeMarks: typeof q.negativeMarks === 'number' ? q.negativeMarks : 0,
                explanation: q.explanation || ''
            }));

            return NextResponse.json({ questions: validQuestions });
        } catch (e) {
            console.error('Final JSON Parse Error:', e);
            return NextResponse.json({
                error: 'Final parsing attempt failed. The PDF structure might be too complex.',
                details: e instanceof Error ? e.message : 'Unknown error',
                raw: text
            }, { status: 500 });
        }

    } catch (error) {
        console.error('PDF Parse API Error:', error);
        return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
    }
}

function repairTruncatedJson(jsonString: string): string {
    let trimmed = jsonString.trim();

    // Check if it starts with [
    if (!trimmed.startsWith('[')) return '[]';

    // Find the last valid closing object brace that is followed by a comma or is just the end
    // We want to slice up to the last "}," or "}" that constitutes a complete object in the array

    // Simple heuristic: If it doesn't end with ], looks like it was cut off.
    // Let's look for the last '},' or '}'

    const lastObjectEnd = trimmed.lastIndexOf('}');

    if (lastObjectEnd === -1) return '[]'; // No objects found

    // Take substring up to the last object end
    // But wait, if valid is "[{...}, {...}, {...", we want to cut at the second "}"

    // Better approach: 
    // stack-based count of braces?
    // Or just regex: Look for the last completely closed object pattern `},` ?

    // Let's try to cut at the last `}` and append `]`
    // But we need to make sure we didn't cut inside a string or nested object.

    // Simplest robust way for an array of objects:
    // 1. Find the last index of "}," 
    // 2. Cut there.
    // 3. Append "}]" or "]" depending on context?

    // Let's assume the array structure is `[{...}, {...}, ...`
    // We want to find the last occurrence of `},` at the TOP level of the array.

    // Workaround: Iteratively try trimming from the end until it parses?
    // That's O(N^2) parse operations, might be slow but safe for 10-20 items.

    let current = trimmed;
    // Remove one char at a time from end until we find a '}'
    while (current.length > 2 && current[current.length - 1] !== '}') {
        current = current.substring(0, current.length - 1);
    }
    // Now current ends with '}'
    // Try adding ']' and clean up comma

    // This is getting complex. Let's try a regex for "}, \s* {" which signifies boundary.
    // Or just look for the last `},`

    const lastCommaBrace = current.lastIndexOf('},');
    if (lastCommaBrace !== -1) {
        // Cut off everything after the last `}`
        // `... }, { incomplete ...` -> `... }`
        // But we need to check if that `},` is top level. 
        // With schema enabled, formatting is usually pretty standard/pretty-printed.

        // Let's trust the brute force "Scan for last `},`"
        // It might fail if `},` appears in a string, but strict schema usually avoids that unless escaped.

        // A safer fallback:
        // Use the text up to the last `}` and append `]`

        const safeParams = current.substring(0, current.lastIndexOf('}') + 1);
        return safeParams + ']';
    }

    // If no `},` found, maybe only one object?
    if (current.endsWith('}')) {
        return current + ']';
    }

    return '[]';
}
