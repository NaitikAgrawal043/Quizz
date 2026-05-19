import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/connect';
import { Attempt, Question } from '@/lib/db/models';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { questionId, isCorrect, awardedMarks } = body;

        if (!questionId || isCorrect === undefined || awardedMarks === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await dbConnect();

        const attempt = await Attempt.findById(id);
        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        // Find the specific answer
        const answerIndex = attempt.answers.findIndex((a: any) => a.questionId.toString() === questionId);
        if (answerIndex === -1) {
            return NextResponse.json({ error: 'Answer for this question not found in attempt' }, { status: 404 });
        }

        // Update the specific answer
        attempt.answers[answerIndex].isMarkedCorrect = isCorrect;
        attempt.answers[answerIndex].awardedMarks = Number(awardedMarks);
        attempt.answers[answerIndex].autoScored = false;

        // Recalculate total score
        let totalScore = 0;
        attempt.answers.forEach((ans: any) => {
            if (ans.awardedMarks) {
                totalScore += ans.awardedMarks;
            }
        });

        attempt.score = totalScore;
        await attempt.save();

        return NextResponse.json({
            message: 'Grade updated successfully',
            score: attempt.score
        });

    } catch (error) {
        console.error('Error updating grade:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
