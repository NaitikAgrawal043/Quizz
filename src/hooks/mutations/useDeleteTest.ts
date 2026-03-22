import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TestSummary } from '@/hooks/queries/useTests';

export function useDeleteTest() {
    const queryClient = useQueryClient();

    return useMutation<unknown, Error, string>({
        mutationFn: (testId) =>
            fetch(`/api/tests/${testId}`, { method: 'DELETE' }).then((r) => r.json()),
        onSuccess: (_, testId) => {
            // Optimistically remove from cache — no need to re-fetch the full list
            queryClient.setQueryData<TestSummary[]>(['tests'], (old) =>
                old?.filter((t) => t._id !== testId) ?? []
            );
        },
    });
}
