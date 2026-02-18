import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Attempt } from '@/lib/db/models';
import { gradeAttempt } from '@/lib/grading';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { id } = await params;
        const attemptId = id;
        const attempt = await Attempt.findById(attemptId);

        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        if (attempt.status === 'graded') {
            return NextResponse.json({ error: 'Attempt already graded' }, { status: 400 });
        }

        // Grade synchronously — the comparison logic is in-memory and
        // the answer key is cached in Redis, so this is fast even at scale.
        await gradeAttempt(attemptId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to submit attempt' }, { status: 500 });
    }
}
