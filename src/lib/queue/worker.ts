import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { gradeAttempt } from '@/lib/grading';
import { extractPdfQuestions } from '@/lib/pdf-parse/extract';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

connection.on('error', (error) => {
    console.error('[redis] worker connection error:', error.message);
});

// ─── Grading worker ──────────────────────────────────────────────────
// Handles both 'grade-attempt' (user submit) and 'test-expiry' (auto-submit)

const gradingConcurrency = Number.parseInt(process.env.GRADING_WORKER_CONCURRENCY || '5', 10) || 5;

export const worker = new Worker('grading-queue', async job => {
    // Ensure DB connection (worker may run in separate process)
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI!);
    }

    if (job.name === 'grade-attempt' || job.name === 'test-expiry') {
        const { attemptId } = job.data;
        console.log(`[grading-worker] Processing ${job.name} for attempt ${attemptId}`);
        await gradeAttempt(attemptId);
    }
}, { connection, concurrency: gradingConcurrency });

worker.on('completed', job => {
    console.log(`[grading-worker] ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`[grading-worker] ${job?.id} failed: ${err.message}`);
});

// ─── PDF parse worker ────────────────────────────────────────────────

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
    console.log(`[pdf-parse-worker] ${job.id} completed`);
});

pdfParseWorker.on('failed', (job, err) => {
    console.error(`[pdf-parse-worker] ${job?.id} failed: ${err.message}`);
});
