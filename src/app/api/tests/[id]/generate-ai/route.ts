import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dbConnect from '@/lib/db/connect';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const promptText = formData.get('prompt') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Data = buffer.toString('base64');

        // Use gemini-1.5-flash for reliable PDF parsing
        // gemini-1.5-flash has issues with responseMimeType causing empty responses
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 8192,
            }
        });

        const prompt = `You are an expert exam creator. Create a test based on the provided document and the following instructions:

Instructions: ${promptText || 'Create a balanced test covering the key concepts in the document.'}

CRITICAL: You MUST respond with ONLY a valid JSON array, nothing else. No explanatory text before or after.

Output format (JSON array ONLY):
[
    {
        "section": "Section Name",
        "type": "mcq",
        "stem": "Question text",
        "options": [
            { "id": "a", "text": "Option A" },
            { "id": "b", "text": "Option B" },
            { "id": "c", "text": "Option C" },
            { "id": "d", "text": "Option D" }
        ],
        "correctAnswer": "a",
        "marks": 1,
        "negativeMarks": 0,
        "explanation": "Explanation for the correct answer"
    }
]`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type || 'application/pdf',
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        // Log the raw response for debugging
        console.log('=== RAW AI RESPONSE ===');
        console.log('Length:', text.length);
        console.log('First 500 chars:', text.substring(0, 500));
        console.log('Last 500 chars:', text.substring(Math.max(0, text.length - 500)));
        console.log('======================');

        try {
            let cleanText = text.trim();

            // Remove markdown code blocks if present
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/```/g, '').trim();
            }

            // Robust JSON extraction: find the first '[' and the last ']'
            const firstBracket = cleanText.indexOf('[');
            const lastBracket = cleanText.lastIndexOf(']');

            console.log('First bracket at:', firstBracket);
            console.log('Last bracket at:', lastBracket);

            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                cleanText = cleanText.substring(firstBracket, lastBracket + 1);
                console.log('Extracted JSON length:', cleanText.length);
            }

            const questions = JSON.parse(cleanText);

            if (!Array.isArray(questions)) {
                throw new Error('AI response is not an array');
            }

            // Filter out any null/undefined items and ensure basic validity
            const validQuestions = questions.filter(q => q && typeof q === 'object' && q.stem);

            console.log('Successfully parsed', validQuestions.length, 'questions');
            return NextResponse.json({ questions: validQuestions });
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.error('Failed to parse AI response. Full text:', text);
            return NextResponse.json({
                error: 'Failed to parse AI response',
                raw: text,
                parseError: e instanceof Error ? e.message : 'Unknown error'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('AI generation error:', error);
        return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
    }
}
