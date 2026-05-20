import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/connect';
import { Attempt, AttemptResult } from '@/lib/db/models';
import { ensureAttemptResultSnapshot, gradeAttempt } from '@/lib/grading';

const STUCK_GRADING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface SnapshotItem {
    stem: string;
    options: Array<{ id: string; text: string; image?: string }>;
    correctAnswer: unknown;
    explanation?: string;
    marks: number;
    userAnswer: unknown;
    isCorrect: boolean;
    isAttempted: boolean;
    awardedMarks: number;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = session.user.role === 'admin';
        const { id } = await params;
        const attemptId = id;
        let attempt = await Attempt.findById(attemptId).lean();

        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        const isOwner = attempt.userId.toString() === session.user.id;

        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (attempt.status === 'in_progress') {
            return NextResponse.json(
                { status: 'in_progress', message: 'This test has not been submitted yet.' },
            );
        }

        if (attempt.status === 'grading') {
            const submittedAt = attempt.submittedAt ? new Date(attempt.submittedAt).getTime() : 0;
            const isStuck = submittedAt > 0 && (Date.now() - submittedAt) > STUCK_GRADING_TIMEOUT_MS;

            if (isStuck) {
                // Auto-recover stuck grading attempts by grading on the spot
                console.warn(`[result] Attempt ${attemptId} stuck in grading for >5 min — auto-recovering`);
                await gradeAttempt(attemptId);
                attempt = await Attempt.findById(attemptId).lean();
                if (!attempt) {
                    return NextResponse.json({ error: 'Attempt not found after recovery' }, { status: 404 });
                }
            } else {
                return NextResponse.json(
                    { status: 'grading', message: 'Grading in progress' },
                    { status: 202 },
                );
            }
        }

        // Check visibility policy
        if (!isAdmin && (!attempt.resultVisibilityAt || new Date() < new Date(attempt.resultVisibilityAt))) {
            return NextResponse.json({
                status: attempt.status,
                message: 'Results are not yet visible'
            });
        }

        let snapshot = await AttemptResult.findOne({ attemptId: attempt._id }).lean();

        // Legacy attempts may not have a snapshot; lazily backfill once.
        if (!snapshot) {
            await ensureAttemptResultSnapshot(attemptId);
            snapshot = await AttemptResult.findOne({ attemptId: attempt._id }).lean();
        }

        if (!snapshot) {
            return NextResponse.json({ error: 'Failed to prepare attempt results' }, { status: 500 });
        }

        const results = (snapshot.items as SnapshotItem[]).map((item) => ({
            question: {
                stem: item.stem,
                options: item.options,
                correctAnswer: item.correctAnswer,
                explanation: item.explanation,
                marks: item.marks,
            },
            userAnswer: item.userAnswer,
            isCorrect: item.isCorrect,
            isAttempted: item.isAttempted,
            awardedMarks: item.awardedMarks,
        }));

        return NextResponse.json({
            score: snapshot.score,
            totalMarks: snapshot.totalMarks,
            results,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }
}
