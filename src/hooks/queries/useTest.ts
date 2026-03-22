import { useQuery } from '@tanstack/react-query';

export function useTest(id: string, enabled = true) {
    return useQuery({
        queryKey: ['test', id],
        queryFn: () => fetch(`/api/tests/${id}`).then((r) => r.json()),
        staleTime: 60 * 1000,
        enabled: !!id && enabled,
    });
}
