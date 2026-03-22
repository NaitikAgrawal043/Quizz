import { useQuery } from '@tanstack/react-query';

interface AttemptResultResponse {
    score?: number;
    totalMarks?: number;
    results?: any[];
    grading?: boolean;
    message?: string;
    _httpStatus: number; // internal — used to drive polling
}

export function useAttemptResult(attemptId: string) {
    return useQuery<AttemptResultResponse>({
        queryKey: ['attempt-result', attemptId],
        queryFn: async () => {
            const res = await fetch(`/api/attempts/${attemptId}/result`);
            const json = await res.json();
            return { ...json, _httpStatus: res.status };
        },
        // Keep polling every 2s as long as grading is in progress (202)
        refetchInterval: (query) =>
            query.state.data?._httpStatus === 202 ? 2000 : false,
        // Once graded the result never changes — cache it for 10 minutes
        staleTime: (query) =>
            query.state.data?._httpStatus === 202 ? 0 : 10 * 60 * 1000,
        retry: 1,
    });
}
