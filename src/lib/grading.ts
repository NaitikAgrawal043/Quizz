import mongoose from 'mongoose';
import { Attempt, AttemptResult, Question } from '@/lib/db/models';
import redis from '@/lib/redis';

// ─── Answer-comparison helpers ───────────────────────────────────────

/**
 * Normalise any answer value to a canonical, comparable form.
 *
 *  • strings  → trimmed + lowercased
 *  • arrays   → each element normalised, then sorted alphabetically
 *  • numbers  → left as-is
 *  • null/undefined → null
 */
function normalise(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return null;

    if (Array.isArray(value)) {
        return value
            .map(v => (typeof v === 'string' ? v.trim().toLowerCase() : v))
            .sort();
    }

    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'number') return value;

    // Fallback – stringify for exotic types
    return JSON.stringify(value);
}

/**
 * Compare a user's given answer with the correct answer.
 *
 * Works for every question type the app supports:
 *   mcq        → single string  ("b")
 *   multi-mcq  → array of strings (["a","b","d"])  — ORDER INSENSITIVE
 *   integer    → number
 *   short      → free-text string
 */
export function compareAnswers(
    givenAnswer: unknown,
    correctAnswer: unknown,
    _questionType: string,
): boolean {
    const normGiven = normalise(givenAnswer);
    const normCorrect = normalise(correctAnswer);

    // Both null / empty → unanswered, not correct
    if (normGiven === null || normCorrect === null) return false;

    // Array comparison (multi-mcq) – both are now sorted
    if (Array.isArray(normGiven) && Array.isArray(normCorrect)) {
        if (normGiven.length !== normCorrect.length) return false;
        return normGiven.every((v, i) => v === normCorrect[i]);
    }

    // Numeric comparison (integer type, or when both happen to be numbers)
    if (typeof normGiven === 'number' && typeof normCorrect === 'number') {
        return normGiven === normCorrect;
    }

    // Coerce number ↔ string so "42" matches 42
    if (typeof normGiven === 'number' || typeof normCorrect === 'number') {
        return Number(normGiven) === Number(normCorrect);
    }

    return normGiven === normCorrect;
}

// ─── Redis answer-key cache ──────────────────────────────────────────

const ANSWER_KEY_PREFIX = 'answer-key:';
const ANSWER_KEY_TTL = 60 * 60; // 1 hour

interface CachedQuestion {
    _id: string;
    type: string;
    correctAnswer: unknown;
    marks: number;
    negativeMarks: number;
}

interface SnapshotQuestion {
    _id: mongoose.Types.ObjectId;
    stem: string;
    options: Array<{ id: string; text: string; image?: string }>;
    correctAnswer: unknown;
    explanation?: string;
    marks: number;
    negativeMarks: number;
}

interface SnapshotAnswer {
    questionId: mongoose.Types.ObjectId;
    givenAnswer?: unknown;
    isMarkedCorrect?: boolean;
    awardedMarks?: number;
}

interface AttemptSnapshotSource {
    _id: mongoose.Types.ObjectId;
    testId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    answers: SnapshotAnswer[];
    score?: number;
    gradedAt?: Date;
    resultVisibilityAt?: Date;
}

function isAnswerProvided(answer: unknown): boolean {
    return (
        answer !== null &&
        answer !== undefined &&
        answer !== '' &&
        !(Array.isArray(answer) && answer.length === 0)
    );
}

/**
 * Fetch question answer-keys for a test.
 *
 * First checks Redis; on a miss (or Redis unavailable) it reads from MongoDB.
 * Redis caching is best-effort — grading still works if Redis is down.
 */
async function getAnswerKey(testId: string): Promise<CachedQuestion[]> {
    const cacheKey = `${ANSWER_KEY_PREFIX}${testId}`;

    // Try Redis cache (best-effort)
    try {
        // Ensure the lazy-connect client is actually connected
        if (redis.status !== 'ready') {
            await redis.connect();
        }

        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached) as CachedQuestion[];
        }
    } catch (err) {
        console.warn('[grading] Redis cache unavailable, falling back to MongoDB:', (err as Error).message);
    }

    // Cache miss or Redis unavailable — query MongoDB
    const questions = await Question.find(
        { testId },
        { _id: 1, type: 1, correctAnswer: 1, marks: 1, negativeMarks: 1 },
    ).lean();

    const answerKey: CachedQuestion[] = questions.map((q: any) => ({
        _id: q._id.toString(),
        type: q.type,
        correctAnswer: q.correctAnswer,
        marks: q.marks ?? 1,
        negativeMarks: q.negativeMarks ?? 0,
    }));

    // Try to cache for subsequent grading jobs (best-effort)
    try {
        if (redis.status === 'ready') {
            await redis.set(cacheKey, JSON.stringify(answerKey), 'EX', ANSWER_KEY_TTL);
        }
    } catch {
        // Caching failure is non-fatal
    }

    return answerKey;
}

export async function upsertAttemptResultSnapshot(source: AttemptSnapshotSource): Promise<void> {
    const questions = await Question.find(
        { testId: source.testId },
        { _id: 1, stem: 1, options: 1, correctAnswer: 1, explanation: 1, marks: 1, negativeMarks: 1 },
    ).lean<SnapshotQuestion[]>();

    const orderedQuestions = [...questions].sort((a, b) => {
        return a._id.toString().localeCompare(b._id.toString());
    });

    const answerMap = new Map<string, SnapshotAnswer>();
    source.answers.forEach((answer) => {
        answerMap.set(answer.questionId.toString(), answer);
    });

    const items = orderedQuestions.map((question) => {
        const answer = answerMap.get(question._id.toString());
        const wasAnswered = isAnswerProvided(answer?.givenAnswer);

        return {
            questionId: question._id,
            stem: question.stem,
            options: question.options || [],
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            marks: question.marks ?? 1,
            negativeMarks: question.negativeMarks ?? 0,
            userAnswer: answer?.givenAnswer ?? null,
            isCorrect: answer ? !!answer.isMarkedCorrect : false,
            isAttempted: wasAnswered,
            awardedMarks: answer?.awardedMarks ?? 0,
        };
    });

    const totalMarks = items.reduce((acc, item) => acc + item.marks, 0);
    const correctCount = items.filter((item) => item.isCorrect).length;
    const incorrectCount = items.filter((item) => item.isAttempted && !item.isCorrect).length;
    const unattemptedCount = items.length - correctCount - incorrectCount;
    const score = source.score ?? items.reduce((acc, item) => acc + item.awardedMarks, 0);
    const gradedAt = source.gradedAt ?? new Date();
    const resultVisibilityAt = source.resultVisibilityAt ?? gradedAt;

    await AttemptResult.updateOne(
        { attemptId: source._id },
        {
            $set: {
                attemptId: source._id,
                testId: source.testId,
                userId: source.userId,
                score,
                totalMarks,
                correctCount,
                incorrectCount,
                unattemptedCount,
                gradedAt,
                resultVisibilityAt,
                schemaVersion: 1,
                items,
            },
        },
        { upsert: true },
    );
}

export async function ensureAttemptResultSnapshot(attemptId: string): Promise<void> {
    const attempt = await Attempt.findById(attemptId).lean();
    if (!attempt) return;
    await upsertAttemptResultSnapshot(attempt as unknown as AttemptSnapshotSource);
}

// ─── Main grading function ───────────────────────────────────────────

/**
 * Grade an attempt end-to-end.
 *
 * 1. Loads the answer key (from Redis cache or MongoDB).
 * 2. Compares each answer using order-insensitive, case-insensitive logic.
 * 3. Persists the graded result back into the Attempt document.
 */
export async function gradeAttempt(attemptId: string): Promise<void> {
    // Ensure DB connection (worker may run in a separate process)
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI!);
    }

    const attempt = await Attempt.findById(attemptId);
    if (!attempt || attempt.status === 'graded') return;

    const answerKey = await getAnswerKey(attempt.testId.toString());
    let totalScore = 0;

    const gradedAnswers = attempt.answers.map(
        (rawAns: any) => {
            // Convert Mongoose subdocument to plain object so spread works
            const ans = typeof rawAns.toObject === 'function' ? rawAns.toObject() : rawAns;
            const question = answerKey.find(q => q._id === ans.questionId.toString());
            if (!question) return ans;

            // Check if the student actually answered
            const wasAnswered =
                ans.givenAnswer !== null &&
                ans.givenAnswer !== undefined &&
                ans.givenAnswer !== '' &&
                !(Array.isArray(ans.givenAnswer) && ans.givenAnswer.length === 0);

            let isCorrect = false;
            let awardedMarks = 0;

            if (wasAnswered) {
                isCorrect = compareAnswers(ans.givenAnswer, question.correctAnswer, question.type);
                awardedMarks = isCorrect ? question.marks : -(question.negativeMarks || 0);
            }

            totalScore += awardedMarks;

            return {
                ...ans,
                isMarkedCorrect: isCorrect,
                awardedMarks,
            };
        },
    );

    attempt.answers = gradedAnswers;
    attempt.score = totalScore;
    attempt.status = 'graded';
    attempt.submittedAt = attempt.submittedAt ?? new Date();
    attempt.gradedAt = new Date();
    attempt.resultVisibilityAt = new Date(); // Immediate for now

    await attempt.save();
    await upsertAttemptResultSnapshot(attempt.toObject() as AttemptSnapshotSource);
    console.log(`[grading] Attempt ${attemptId} graded — score ${totalScore}`);
}
