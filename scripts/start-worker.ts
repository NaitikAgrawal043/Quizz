/**
 * Standalone worker entry point for production.
 *
 * Run with:  npm run worker
 * (which maps to: npx tsx scripts/start-worker.ts)
 *
 * This loads environment variables, connects to MongoDB,
 * and starts the BullMQ workers (grading + PDF parsing).
 */

import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
    console.log('[start-worker] Starting workers...');

    // Connect to MongoDB first
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('[start-worker] MONGODB_URI is not set');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('[start-worker] Connected to MongoDB');
    } catch (err) {
        console.error('[start-worker] Failed to connect to MongoDB:', err);
        process.exit(1);
    }

    // Importing the worker module starts the workers
    // (they self-register with BullMQ on import)
    await import('../src/lib/queue/worker');

    console.log('[start-worker] Workers are running. Press Ctrl+C to stop.');
}

main().catch((err) => {
    console.error('[start-worker] Fatal error:', err);
    process.exit(1);
});
