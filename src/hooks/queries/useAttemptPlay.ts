import { useQuery } from '@tanstack/react-query';

export function useAttemptPlay(id: string) {
    return useQuery({
        queryKey: ['attempt-play', id],
        queryFn: () => fetch(`/api/attempts/${id}/play`).then((r) => r.json()),
        staleTime: Infinity, // test data never goes stale during the session
        gcTime: 0,           // clear from cache immediately on unmount
        retry: 1,
    });
}
