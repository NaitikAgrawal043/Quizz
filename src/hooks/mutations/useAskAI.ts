import { useMutation } from '@tanstack/react-query';

interface AskAIVars {
    question: string;
    correctAnswer: unknown;
    explanation?: string;
}

interface AskAIResponse {
    explanation: string;
}

export function useAskAI() {
    return useMutation<AskAIResponse, Error, AskAIVars>({
        mutationFn: (vars) =>
            fetch('/api/ai/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vars),
            }).then((r) => {
                if (!r.ok) throw new Error('Failed to get AI explanation');
                return r.json();
            }),
    });
}
