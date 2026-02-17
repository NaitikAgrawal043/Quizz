import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { Attempt, Question } from '@/lib/db/models';
import { extractPdfQuestions } from '@/lib/pdf-parse/extract';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

connection.on('error', (error) => {
    console.error('[redis] worker connection error:', error.message);
});

// Reuse the grading logic (should be extracted to a service)
async function gradeAttempt(attemptId: string) {
    const attempt = await Attempt.findById(attemptId);
    if (!attempt || attempt.status === 'graded') return;

    const questions = await Question.find({ testId: attempt.testId });
    let totalScore = 0;

    const gradedAnswers = attempt.answers.map((ans: { questionId: { toString: () => string }; givenAnswer: unknown } & Record<string, unknown>) => {
        const question = questions.find(q => q._id.toString() === ans.questionId.toString());
        if (!question) return ans;

        let isCorrect = false;
        if (JSON.stringify(ans.givenAnswer) === JSON.stringify(question.correctAnswer)) {
            isCorrect = true;
        }
        if (typeof ans.givenAnswer === 'string' && typeof question.correctAnswer === 'string') {
            isCorrect = ans.givenAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
        }

        const awardedMarks = isCorrect ? question.marks : (question.negativeMarks ? -question.negativeMarks : 0);
        totalScore += awardedMarks;

        return {
            ...ans,
            isMarkedCorrect: isCorrect,
            awardedMarks,
        };
    });

    attempt.answers = gradedAnswers;
    attempt.score = totalScore;
    attempt.status = 'graded';
    attempt.submittedAt = new Date();
    attempt.gradedAt = new Date();
    attempt.resultVisibilityAt = new Date(); // Immediate for MVP

    await attempt.save();
    console.log(`Attempt ${attemptId} auto-graded.`);
}

export const worker = new Worker('grading-queue', async job => {
    if (job.name === 'test-expiry') {
        const { attemptId } = job.data;
        console.log(`Processing expiry for attempt ${attemptId}`);

        // Connect DB if needed (worker might run in separate process)
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI!);
        }

        await gradeAttempt(attemptId);
    }
}, { connection });

worker.on('completed', job => {
    console.log(`${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.log(`${job?.id} has failed with ${err.message}`);
});

const parseWorkerConcurrency = Number.parseInt(process.env.PDF_PARSE_WORKER_CONCURRENCY || '2', 10) || 2;

export const pdfParseWorker = new Worker('pdf-parse-queue', async job => {
    if (job.name !== 'parse-pdf') return null;

    const {
        base64Data,
        sourceType,
        chapter,
        unit,
        chapterUnit,
        maxQuestions,
    } = job.data as {
        base64Data: string;
        sourceType: 'exam' | 'book';
        chapter: string;
        unit: string;
        chapterUnit: string;
        maxQuestions: number;
    };

    const questions = await extractPdfQuestions({
        base64Data,
        sourceType,
        chapter,
        unit,
        chapterUnit,
        maxQuestions,
    });

    return {
        questions,
        sourceType,
        extractedCount: questions.length,
    };
}, { connection, concurrency: parseWorkerConcurrency });

pdfParseWorker.on('completed', job => {
    console.log(`pdf-parse job ${job.id} completed`);
});

pdfParseWorker.on('failed', (job, err) => {
    console.log(`pdf-parse job ${job?.id} failed with ${err.message}`);
});
