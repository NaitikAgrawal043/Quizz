import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { QueueEvents } from 'bullmq';
import { pdfParseQueue } from '@/lib/queue/client';
import { extractPdfQuestions, SourceType } from '@/lib/pdf-parse/extract';
import IORedis from 'ioredis';

const queueEvents = new QueueEvents('pdf-parse-queue', {
    connection: new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
    }),
});

function toPositiveInt(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

export async function POST(req: Request, _context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const sourceTypeRaw = (formData.get('sourceType') as string | null)?.toLowerCase();
        const sourceType: SourceType = sourceTypeRaw === 'book' ? 'book' : 'exam';
        const chapter = (formData.get('chapter') as string | null)?.trim() || '';
        const unit = (formData.get('unit') as string | null)?.trim() || '';
        const chapterUnit = (formData.get('chapterUnit') as string | null)?.trim() || '';
        const maxQuestions = toPositiveInt(formData.get('maxQuestions') as string | null, 30);

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString('base64');
        const useQueue = process.env.PDF_PARSE_QUEUE_ENABLED === 'true';

        if (!useQueue) {
            const questions = await extractPdfQuestions({
                base64Data,
                sourceType,
                chapter,
                unit,
                chapterUnit,
                maxQuestions,
            });
            return NextResponse.json({
                questions,
                sourceType,
                extractedCount: questions.length,
            });
        }

        const job = await pdfParseQueue.add('parse-pdf', {
            base64Data,
            sourceType,
            chapter,
            unit,
            chapterUnit,
            maxQuestions,
        }, {
            removeOnComplete: { age: 3600, count: 500 },
            removeOnFail: { age: 3600, count: 500 },
            attempts: 2,
            backoff: { type: 'exponential', delay: 1500 },
        });

        const waitMs = toPositiveInt(process.env.PDF_PARSE_WAIT_MS || null, 20000);
        try {
            const result = await job.waitUntilFinished(queueEvents, waitMs) as {
                questions: any[];
                sourceType: SourceType;
                extractedCount: number;
            };
            return NextResponse.json(result);
        } catch {
            return NextResponse.json({
                jobId: job.id,
                status: 'queued',
            }, { status: 202 });
        }

    } catch (error) {
        console.error('PDF Parse API Error:', error);
        return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await pdfParseQueue.getJob(jobId);
    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const state = await job.getState();
    if (state === 'completed') {
        return NextResponse.json({
            status: 'completed',
            ...(job.returnvalue || {}),
        });
    }

    if (state === 'failed') {
        return NextResponse.json({
            status: 'failed',
            error: job.failedReason || 'Failed to parse PDF',
        }, { status: 500 });
    }

    return NextResponse.json({ status: state });
}
