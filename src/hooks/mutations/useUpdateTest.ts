import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UpdateTestVars {
    title: string;
    status: string;
    testDate?: string;
}

export function useUpdateTest(testId: string) {
    const queryClient = useQueryClient();

    return useMutation<unknown, Error, UpdateTestVars>({
        mutationFn: (vars) =>
            fetch(`/api/tests/${testId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vars),
            }).then((r) => r.json()),
        onSuccess: () => {
            // Invalidate both the individual test and the admin list
            queryClient.invalidateQueries({ queryKey: ['test', testId] });
            queryClient.invalidateQueries({ queryKey: ['tests'] });
        },
    });
}
