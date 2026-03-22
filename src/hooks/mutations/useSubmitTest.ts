import { useMutation } from '@tanstack/react-query';

export function useSubmitTest(attemptId: string) {
    return useMutation({
        mutationFn: () =>
            fetch(`/api/attempts/${attemptId}/submit`, { method: 'POST' }).then((r) => r.json()),
    });
}
