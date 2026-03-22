import { useMutation } from '@tanstack/react-query';

interface SaveAnswerVars {
    questionId: string;
    givenAnswer: any;
}

export function useSaveAnswer(attemptId: string) {
    return useMutation<unknown, Error, SaveAnswerVars>({
        mutationFn: ({ questionId, givenAnswer }) =>
            fetch(`/api/attempts/${attemptId}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId, givenAnswer }),
            }).then((r) => r.json()),
    });
}
