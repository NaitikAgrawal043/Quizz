import { useMutation } from '@tanstack/react-query';

export function useStartTest(testId: string) {
    return useMutation({
        mutationFn: () =>
            fetch(`/api/tests/${testId}/start`, { method: 'POST' }).then((r) => r.json()),
    });
}
