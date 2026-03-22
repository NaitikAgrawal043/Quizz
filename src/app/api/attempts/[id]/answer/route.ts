import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Attempt } from '@/lib/db/models';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { questionId, givenAnswer } = await req.json();
        const { id } = await params;

        // Try to update an existing answer for this question.
        // Validation (status + expiry) is embedded in the filter — no separate findById needed.
        const updated = await Attempt.updateOne(
            {
                _id: id,
                status: 'in_progress',
                expiresAt: { $gt: new Date() },
                'answers.questionId': questionId,
            },
            {
                $set: {
                    'answers.$.givenAnswer': givenAnswer,
                    'answers.$.savedAt': new Date(),
                },
            }
        );

        if (updated.matchedCount === 0) {
            // Answer doesn't exist yet for this question — push a new one.
            // Filter still validates status + expiry so invalid attempts are rejected.
            const pushed = await Attempt.updateOne(
                {
                    _id: id,
                    status: 'in_progress',
                    expiresAt: { $gt: new Date() },
                },
                {
                    $push: {
                        answers: {
                            questionId,
                            givenAnswer,
                            savedAt: new Date(),
                            autoScored: true,
                        },
                    },
                }
            );

            if (pushed.matchedCount === 0) {
                return NextResponse.json(
                    { error: 'Attempt not found, expired, or already submitted' },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
    }
}
