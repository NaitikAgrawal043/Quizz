import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Attempt, Question } from '@/lib/db/models';
import { gradeAttempt } from '@/lib/grading';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { id } = await params;
        const attemptId = id;
        let attempt = await Attempt.findById(attemptId).lean();

        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        // Auto-recover stuck 'grading' attempts — grade them on the spot
        if (attempt.status === 'grading') {
            await gradeAttempt(attemptId);
            attempt = await Attempt.findById(attemptId).lean();
            if (!attempt) {
                return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
            }
        }

        if (attempt.status === 'in_progress') {
            return NextResponse.json(
                { status: 'in_progress', message: 'This test has not been submitted yet.' },
            );
        }

        // Check visibility policy
        if (!attempt.resultVisibilityAt || new Date() < new Date(attempt.resultVisibilityAt)) {
            return NextResponse.json({
                status: attempt.status,
                message: 'Results are not yet visible'
            });
        }

        const questions = await Question.find({ testId: attempt.testId }).lean();

        // Merge questions with answers
        const results = questions.map((q: any) => {
            const answer = attempt.answers.find((a: any) => a.questionId.toString() === q._id.toString());
            return {
                question: {
                    stem: q.stem,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation,
                    marks: q.marks,
                },
                userAnswer: answer ? answer.givenAnswer : null,
                isCorrect: answer ? answer.isMarkedCorrect : false,
                awardedMarks: answer ? answer.awardedMarks : 0,
            };
        });

        return NextResponse.json({
            score: attempt.score,
            totalMarks: questions.reduce((acc: number, q: any) => acc + q.marks, 0),
            results,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }
}
