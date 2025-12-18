import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/connect';
import { Attempt, User, Batch } from '@/lib/db/models';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await dbConnect();

        // Ensure models are registered
        // (User and Batch are imported which triggers registration if not done, 
        // effectively handled by dbConnect/models file usually, but import helps)

        const attempts = await Attempt.find({ testId: id, status: { $in: ['submitted', 'graded'] } })
            .populate({
                path: 'userId',
                select: 'name rollNumber batches',
                populate: {
                    path: 'batches',
                    select: 'name'
                }
            })
            .lean();

        // Transform and sort
        const results = attempts.map((attempt: any) => {
            const user = attempt.userId;
            // Assuming first batch if multiple, or join names
            const batchName = user?.batches?.map((b: any) => b.name).join(', ') || 'N/A';

            return {
                _id: attempt._id,
                user: {
                    name: user?.name || 'Unknown',
                    rollNumber: user?.rollNumber
                },
                batch: batchName,
                score: attempt.score || 0,
                submittedAt: attempt.submittedAt
            };
        });

        // Sort by roll number ascending
        results.sort((a, b) => {
            const rollA = a.user.rollNumber || Infinity; // Put no-roll-number at bottom
            const rollB = b.user.rollNumber || Infinity;
            return rollA - rollB;
        });

        return NextResponse.json(results);

    } catch (error) {
        console.error('Error fetching test results:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
