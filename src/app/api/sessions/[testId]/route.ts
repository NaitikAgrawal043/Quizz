import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { TestSession, Test, Question } from '@/lib/db/models';

// GET: Fetch the current session state for a test
export async function GET(req: Request, { params }: { params: Promise<{ testId: string }> }) {
    await dbConnect();
    try {
        const { testId } = await params;
        const session = await TestSession.findOne({ testId }).lean();

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json(session);
    } catch (error) {
        console.error('Get session error:', error);
        return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }
}

// POST: Create a new live session for a test
export async function POST(req: Request, { params }: { params: Promise<{ testId: string }> }) {
    await dbConnect();
    try {
        const { testId } = await params;

        // Check if test exists
        const test = await Test.findById(testId);
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Check if session already exists
        let session = await TestSession.findOne({ testId });
        if (session) {
            // Reset the session
            session.status = 'waiting';
            session.currentQuestionIndex = 0;
            session.startedAt = undefined;
            session.updatedAt = new Date();
            await session.save();
            return NextResponse.json(session);
        }

        // Create new session
        session = await TestSession.create({
            testId,
            status: 'waiting',
            currentQuestionIndex: 0,
        });

        return NextResponse.json(session, { status: 201 });
    } catch (error) {
        console.error('Create session error:', error);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
}
