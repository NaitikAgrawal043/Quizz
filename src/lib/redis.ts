import IORedis from 'ioredis';

// Create a shared Redis instance for the application
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
});

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
 * Get violation data for an attempt
 */
export async function getViolationData(attemptId: string): Promise<ViolationData> {
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
    const key = `violations:${attemptId}`;
    await redis.del(key);
}

/**
 * Get the maximum allowed violations
 */
export function getMaxViolations(): number {
    return MAX_VIOLATIONS;
}

export default redis;
