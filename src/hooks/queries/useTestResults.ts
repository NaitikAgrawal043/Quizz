import { useQuery } from '@tanstack/react-query';

export interface TestResult {
    _id: string;
    user: {
        name: string;
        rollNumber?: number;
    };
    batch: string;
    score: number;
    submittedAt: string;
}

export function useTestResults(testId: string, enabled = true) {
    return useQuery<TestResult[]>({
        queryKey: ['test-results', testId],
        queryFn: () => fetch(`/api/tests/${testId}/results`).then((r) => r.json()),
        // Refetch when admin tabs back so new submissions appear automatically
        refetchOnWindowFocus: true,
        staleTime: 30 * 1000,
        enabled,
    });
}
