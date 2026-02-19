import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_RETRIES = 3;

let redisAvailable: boolean | null = null; // null = unknown yet

/**
 * Common retry strategy: stop retrying after MAX_RETRIES so we don't
 * flood the console when Redis isn't running.
 */
function retryStrategy(times: number): number | null {
    if (times > MAX_RETRIES) {
        if (redisAvailable !== false) {
            console.warn('⚠️  Redis is not available — real-time sync and violation tracking will be disabled.');
            redisAvailable = false;
        }
        return null; // stop retrying
    }
    return Math.min(times * 200, 2000);
}

// Create a shared Redis instance for the application
const redis = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy,
});

redis.on('connect', () => { redisAvailable = true; });
redis.on('error', () => { /* handled by retryStrategy */ });

// Violation tracking functions
export interface ViolationData {
    count: number;
    violations: {
        type: string;
        timestamp: number;
    }[];
}

const MAX_VIOLATIONS = 5;

/**
 * Check whether Redis is connected and available
 */
export function isRedisAvailable(): boolean {
    return redisAvailable === true && redis.status === 'ready';
}

/**
 * Safely connect the main Redis client (no-op if already connected or unavailable)
 */
async function ensureConnected(): Promise<boolean> {
    if (redis.status === 'ready') return true;
    if (redisAvailable === false) return false;
    try {
        await redis.connect();
        redisAvailable = true;
        return true;
    } catch {
        return false;
    }
}

/**
 * Get violation data for an attempt
 */
export async function getViolationData(attemptId: string): Promise<ViolationData> {
    if (!(await ensureConnected())) return { count: 0, violations: [] };
    const key = `violations:${attemptId}`;
    const data = await redis.get(key);
    if (!data) {
        return { count: 0, violations: [] };
    }
    return JSON.parse(data);
}

/**
 * Record a violation for an attempt
 * @param attemptId - The attempt ID
 * @param type - Type of violation (tab_switch, minimize, fullscreen_exit)
 * @param ttlSeconds - Time to live in seconds (should match remaining test time)
 * @returns Updated violation data and whether auto-submit should trigger
 */
export async function recordViolation(
    attemptId: string,
    type: string,
    ttlSeconds: number
): Promise<{ data: ViolationData; shouldAutoSubmit: boolean }> {
    if (!(await ensureConnected())) {
        return { data: { count: 0, violations: [] }, shouldAutoSubmit: false };
    }
    const key = `violations:${attemptId}`;
    const current = await getViolationData(attemptId);

    const updated: ViolationData = {
        count: current.count + 1,
        violations: [
            ...current.violations,
            { type, timestamp: Date.now() }
        ]
    };

    // Set with TTL
    await redis.set(key, JSON.stringify(updated), 'EX', ttlSeconds);

    return {
        data: updated,
        shouldAutoSubmit: updated.count >= MAX_VIOLATIONS
    };
}

/**
 * Reset violations for an attempt
 */
export async function resetViolations(attemptId: string): Promise<void> {
    if (!(await ensureConnected())) return;
    const key = `violations:${attemptId}`;
    await redis.del(key);
}

/**
 * Get the maximum allowed violations
 */
export function getMaxViolations(): number {
    return MAX_VIOLATIONS;
}

// --- Pub/Sub for Real-Time Sync ---

let redisPub: IORedis | null = null;
let redisSub: IORedis | null = null;

/**
 * Get a dedicated Redis publisher instance for pub/sub
 * (separate from the main client to avoid conflicts)
 */
export function getRedisPublisher(): IORedis {
    if (!redisPub) {
        redisPub = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            retryStrategy,
        });
        redisPub.on('error', () => { /* handled by retryStrategy */ });
    }
    return redisPub;
}

/**
 * Get a dedicated Redis subscriber instance for pub/sub
 * (a Redis client in subscribe mode cannot do other commands)
 */
export function getRedisSubscriber(): IORedis {
    if (!redisSub) {
        redisSub = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            retryStrategy,
        });
        redisSub.on('error', () => { /* handled by retryStrategy */ });
    }
    return redisSub;
}

export default redis;
