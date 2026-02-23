import IORedis from 'ioredis';

/**
 * Factory for creating Redis connections used by BullMQ queues and workers.
 * Centralises connection config so it isn't duplicated across client / worker files.
 *
 * BullMQ requires `maxRetriesPerRequest: null` for both Queue and Worker connections.
 */

export function createRedisConnection(label = 'redis'): IORedis {
    const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        // Reconnect with exponential back-off capped at 10 s
        retryStrategy(times: number) {
            return Math.min(times * 200, 10_000);
        },
    });

    connection.on('error', (error) => {
        console.error(`[${label}] connection error:`, error.message);
    });

    connection.on('connect', () => {
        console.log(`[${label}] connected to Redis`);
    });

    return connection;
}
