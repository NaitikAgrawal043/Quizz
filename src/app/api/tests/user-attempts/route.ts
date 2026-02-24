import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Test, Attempt } from '@/lib/db/models';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        if (session.user.role === 'admin') {
            // Admins see everything
            const tests = await Test.find().sort({ createdAt: -1 }).lean();
            const testIds = tests.map(t => t._id);
            const attempts = await Attempt.find({
                testId: { $in: testIds },
                userId: session.user.id
            }).lean();

            const attemptMap = new Map();
            attempts.forEach(attempt => {
                attemptMap.set(attempt.testId.toString(), attempt);
            });

            const testsWithAttempts = tests.map(test => {
                const attempt = attemptMap.get(test._id.toString());
                return {
                    _id: test._id, title: test.title, description: test.description,
                    durationSeconds: test.durationSeconds, status: test.status,
                    attempt: attempt ? { _id: attempt._id, status: attempt.status, score: attempt.score, submittedAt: attempt.submittedAt } : null
                };
            });

            return NextResponse.json(testsWithAttempts);
        }

        // --- Student flow ---

        // 1. Published tests for the student's batches (new / available quizzes)
        const publishedTests = await Test.find({
            batches: { $in: session.user.batches },
            status: 'published'
        }).sort({ createdAt: -1 }).lean();

        // 2. All attempts by this student
        const allAttempts = await Attempt.find({ userId: session.user.id }).lean();

        // 3. Find tests the student attempted that are no longer published (e.g. auto-drafted)
        const publishedIds = new Set(publishedTests.map(t => t._id.toString()));
        const extraTestIds = [...new Set(allAttempts.map(a => a.testId.toString()))]
            .filter(id => !publishedIds.has(id));

        const attemptedDraftTests = extraTestIds.length > 0
            ? await Test.find({ _id: { $in: extraTestIds } }).sort({ createdAt: -1 }).lean()
            : [];

        // 4. Merge both lists
        const tests = [...publishedTests, ...attemptedDraftTests];

        // Build attempt map
        const attemptMap = new Map();
        allAttempts.forEach(attempt => {
            attemptMap.set(attempt.testId.toString(), attempt);
        });

        // Combine tests with their attempt status
        const testsWithAttempts = tests.map(test => {
            const attempt = attemptMap.get(test._id.toString());
            return {
                _id: test._id,
                title: test.title,
                description: test.description,
                durationSeconds: test.durationSeconds,
                status: test.status,
                attempt: attempt ? {
                    _id: attempt._id,
                    status: attempt.status,
                    score: attempt.score,
                    submittedAt: attempt.submittedAt
                } : null
            };
        });

        return NextResponse.json(testsWithAttempts);
    } catch (error) {
        console.error('Failed to fetch tests with attempts:', error);
        return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
    }
}
