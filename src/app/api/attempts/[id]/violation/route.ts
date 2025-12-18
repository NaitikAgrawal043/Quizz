import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/connect';
import { Attempt } from '@/lib/db/models';
import { recordViolation, getViolationData, getMaxViolations } from '@/lib/redis';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const { type } = await request.json();

        if (!type || !['tab_switch', 'minimize', 'fullscreen_exit', 'no_face', 'multiple_faces', 'camera_disabled'].includes(type)) {
            return NextResponse.json({ error: 'Invalid violation type' }, { status: 400 });
        }

        await dbConnect();

        // Get the attempt to verify ownership and get remaining time
        const attempt = await Attempt.findById(id);
        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        if (attempt.userId.toString() !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (attempt.status !== 'in_progress') {
            return NextResponse.json({ error: 'Test already completed' }, { status: 400 });
        }

        // Calculate remaining TTL
        const expiresAt = new Date(attempt.expiresAt).getTime();
        const now = Date.now();
        const ttlSeconds = Math.max(60, Math.ceil((expiresAt - now) / 1000)); // Minimum 60 seconds

        // Record the violation
        const { data, shouldAutoSubmit } = await recordViolation(id, type, ttlSeconds);

        // If max violations reached, auto-submit the test
        if (shouldAutoSubmit) {
            attempt.status = 'submitted';
            attempt.submittedAt = new Date();
            await attempt.save();
            // TODO: Trigger grading queue if needed
        }

        return NextResponse.json({
            count: data.count,
            maxViolations: getMaxViolations(),
            shouldAutoSubmit,
            violations: data.violations
        });
    } catch (error) {
        console.error('Error recording violation:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        await dbConnect();

        // Verify attempt ownership
        const attempt = await Attempt.findById(id);
        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        if (attempt.userId.toString() !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await getViolationData(id);

        return NextResponse.json({
            count: data.count,
            maxViolations: getMaxViolations(),
            violations: data.violations
        });
    } catch (error) {
        console.error('Error getting violations:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
