import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Question, Test } from '@/lib/db/models';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { id } = await params;
        const questions = await Question.find({ testId: id }).lean();
        return NextResponse.json(questions);
    } catch (error) {
        console.error('Fetch questions error:', error);
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { questions } = await req.json();
        const { id } = await params;
        const testId = id;

        // Validate and clean questions before insert
        const questionsWithTestId = questions.map((q: any) => ({
            ...q,
            testId,
            // Ensure options only contains valid entries
            options: q.options?.filter((opt: any) => opt.text?.trim()) || [],
        }));

        // Bulk insert questions
        const createdQuestions = await Question.insertMany(questionsWithTestId);

        // Update Test with sections (derived from questions)
        // This logic assumes sections are defined in the questions
        const sectionsMap = new Map();
        questions.forEach((q: any) => {
            if (q.section && !sectionsMap.has(q.section)) {
                sectionsMap.set(q.section, {
                    id: crypto.randomUUID(),
                    name: q.section,
                    order: sectionsMap.size + 1,
                });
            }
        });

        await Test.findByIdAndUpdate(testId, {
            $set: { sections: Array.from(sectionsMap.values()) }
        });

        return NextResponse.json({ success: true, count: createdQuestions.length });
    } catch (error: any) {
        console.error('Save questions error:', error);

        // Return detailed validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e: any) => e.message);
            return NextResponse.json({
                error: 'Validation failed',
                details: messages
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to save questions',
            details: error.message
        }, { status: 500 });
    }
}
