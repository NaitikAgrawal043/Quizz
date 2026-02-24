import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

connection.on('error', (error) => {
    console.error('[redis] queue connection error:', error.message);
});

export const gradingQueue = new Queue('grading-queue', { connection });
export const pdfParseQueue = new Queue('pdf-parse-queue', { connection });
