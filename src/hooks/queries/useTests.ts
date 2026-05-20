import { useQuery } from '@tanstack/react-query';

export interface TestSummary {
    _id: string;
    title: string;
    status: string;
    createdAt: string;
    batches: Array<string | { _id: string; name: string }>;
    testDate?: string;
}

export function useTests(enabled = true) {
    return useQuery<TestSummary[]>({
        queryKey: ['tests'],
        queryFn: () => fetch('/api/tests').then((r) => r.json()),
        staleTime: 30 * 1000, // 30 seconds
        enabled,
    });
}
