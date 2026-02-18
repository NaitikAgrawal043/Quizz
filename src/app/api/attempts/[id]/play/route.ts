import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Attempt, Test, Question } from '@/lib/db/models';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { id } = await params;
        const attemptId = id;
        const attempt = await Attempt.findById(attemptId).lean();

        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        const test = await Test.findById(attempt.testId).lean();
        const questions = await Question.find({ testId: attempt.testId }).lean();

        // Sanitize questions (remove correct answers and explanations)
        const sanitizedQuestions = questions.map((q: any) => ({
            _id: q._id,
            section: q.section, // Assuming section is stored or derived
            type: q.type,
            stem: q.stem,
            options: q.options,
            marks: q.marks,
            timeLimit: q.timeLimit || 60, // Default to 60s if not set
            // correct answer and explanation removed
        }));

        return NextResponse.json({
            attempt,
            test: {
                title: test?.title,
                durationSeconds: test?.durationSeconds,
                sections: test?.sections,
            },
            questions: sanitizedQuestions,
            serverNow: new Date(),
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to load test data' }, { status: 500 });
    }
}
