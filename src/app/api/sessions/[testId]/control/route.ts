import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { TestSession, Question } from '@/lib/db/models';
import { getRedisPublisher } from '@/lib/redis';

export async function POST(req: Request, { params }: { params: Promise<{ testId: string }> }) {
    await dbConnect();
    try {
        const { testId } = await params;
        const { action, index } = await req.json();
        // action: 'START' | 'NEXT' | 'PREV' | 'GOTO' | 'PAUSE' | 'FINISH'

        const session = await TestSession.findOne({ testId });
        if (!session) {
            return NextResponse.json({ error: 'Session not found. Create one first.' }, { status: 404 });
        }

        // Get total question count for bounds checking
        const totalQuestions = await Question.countDocuments({ testId });

        switch (action) {
            case 'START':
                session.status = 'active';
                session.startedAt = new Date();
                session.currentQuestionIndex = 0;
                break;
            case 'NEXT':
                if (session.currentQuestionIndex < totalQuestions - 1) {
                    session.currentQuestionIndex += 1;
                }
                break;
            case 'PREV':
                session.currentQuestionIndex = Math.max(0, session.currentQuestionIndex - 1);
                break;
            case 'GOTO':
                if (typeof index === 'number' && index >= 0 && index < totalQuestions) {
                    session.currentQuestionIndex = index;
                }
                break;
            case 'PAUSE':
                session.status = 'paused';
                break;
            case 'RESUME':
                session.status = 'active';
                break;
            case 'FINISH':
                session.status = 'finished';
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        session.updatedAt = new Date();
        await session.save();

        // Publish event to Redis → Socket.io server picks it up and broadcasts
        const redisPub = getRedisPublisher();
        await redisPub.publish('test-control', JSON.stringify({
            testId,
            currentQuestionIndex: session.currentQuestionIndex,
            status: session.status,
        }));

        return NextResponse.json({
            success: true,
            session: {
                status: session.status,
                currentQuestionIndex: session.currentQuestionIndex,
            },
            totalQuestions,
        });
    } catch (error) {
        console.error('Control session error:', error);
        return NextResponse.json({ error: 'Failed to control session' }, { status: 500 });
    }
}
