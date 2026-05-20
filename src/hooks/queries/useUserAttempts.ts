import { useQuery } from '@tanstack/react-query';

export interface UserTest {
    _id: string;
    title: string;
    durationSeconds: number;
    status: string;
    testDate?: string;
    batches?: Array<string | { _id: string; name: string }>;
    attempt: {
        _id: string;
        status: 'in_progress' | 'submitted' | 'graded' | 'grading';
        score?: number;
    } | null;
}

export function useUserAttempts(enabled = true) {
    return useQuery<UserTest[]>({
        queryKey: ['user-attempts'],
        queryFn: () => fetch('/api/tests/user-attempts').then((r) => r.json()),
        staleTime: 30 * 1000,
        enabled,
    });
}
