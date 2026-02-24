/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * In development, this auto-starts the BullMQ workers so you don't
 * need a separate terminal. In production, you should run workers
 * separately via `npm run worker`.
 */
export async function register() {
    // Only run on the Node.js runtime, not on Edge
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Dynamically import the worker module to start all workers.
        // This is safe to call multiple times — BullMQ workers are idempotent.
        await import('./lib/queue/worker');
    }
}
