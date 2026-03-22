import { create } from 'zustand';

interface TestSessionState {
    answers: Record<string, any>;
    currentQIndex: number;
    isSubmitting: boolean;
    isLiveSession: boolean;
    liveTestId: string | null;

    setAnswer: (questionId: string, value: any) => void;
    clearAnswer: (questionId: string) => void;
    setCurrentQIndex: (index: number) => void;
    setIsSubmitting: (value: boolean) => void;
    setIsLiveSession: (value: boolean) => void;
    setLiveTestId: (id: string | null) => void;
    initAnswers: (answers: Record<string, any>) => void;
    resetSession: () => void;
}

const initialState = {
    answers: {},
    currentQIndex: 0,
    isSubmitting: false,
    isLiveSession: false,
    liveTestId: null,
};

export const useTestStore = create<TestSessionState>((set) => ({
    ...initialState,

    setAnswer: (questionId, value) =>
        set((state) => ({ answers: { ...state.answers, [questionId]: value } })),

    clearAnswer: (questionId) =>
        set((state) => {
            const next = { ...state.answers };
            delete next[questionId];
            return { answers: next };
        }),

    setCurrentQIndex: (index) => set({ currentQIndex: index }),
    setIsSubmitting: (value) => set({ isSubmitting: value }),
    setIsLiveSession: (value) => set({ isLiveSession: value }),
    setLiveTestId: (id) => set({ liveTestId: id }),
    initAnswers: (answers) => set({ answers }),
    resetSession: () => set(initialState),
}));
