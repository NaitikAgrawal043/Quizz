'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WarningModalProps {
    isOpen: boolean;
    violationType: 'tab_switch' | 'minimize' | 'fullscreen_exit' | 'no_face' | 'multiple_faces' | 'camera_disabled' | null;
    violationCount: number;
    maxViolations: number;
    onDismiss: () => void;
}

const violationMessages: Record<string, { title: string; description: string }> = {
    tab_switch: {
        title: 'Tab Switch Detected!',
        description: 'You switched to another tab or window. This is not allowed during the test.',
    },
    minimize: {
        title: 'Window Minimized!',
        description: 'You minimized the browser window. This is not allowed during the test.',
    },
    fullscreen_exit: {
        title: 'Fullscreen Exited!',
        description: 'You exited fullscreen mode. This is not allowed during the test.',
    },
    no_face: {
        title: 'Face Not Detected!',
        description: 'Your face was not visible to the camera. Please ensure your face is clearly visible.',
    },
    multiple_faces: {
        title: 'Multiple Faces Detected!',
        description: 'More than one person was detected. Only you should be visible during the test.',
    },
    camera_disabled: {
        title: 'Camera Disabled!',
        description: 'Your camera was turned off or blocked. The camera must remain active during the test.',
    },
};

export function WarningModal({
    isOpen,
    violationType,
    violationCount,
    maxViolations,
    onDismiss,
}: WarningModalProps) {
    if (!isOpen || !violationType) return null;

    const message = violationMessages[violationType] || {
        title: 'Violation Detected!',
        description: 'An unauthorized action was detected.',
    };

    const isLastWarning = violationCount >= maxViolations - 1;
    const isAutoSubmitting = violationCount >= maxViolations;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200">
                <div className="bg-background border-2 border-red-500 rounded-xl shadow-2xl overflow-hidden">
                    {/* Header with warning stripe */}
                    <div className="bg-red-500 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-full animate-pulse">
                                <AlertTriangle className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {message.title}
                                </h2>
                                <p className="text-red-100 text-sm">
                                    Warning {violationCount} of {maxViolations}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        <p className="text-muted-foreground">
                            {message.description}
                        </p>

                        {/* Progress indicator */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Violations</span>
                                <span className={`font-medium ${isLastWarning ? 'text-red-500' : 'text-yellow-500'}`}>
                                    {violationCount} / {maxViolations}
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${isLastWarning ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}
                                    style={{ width: `${(violationCount / maxViolations) * 100}%` }}
                                />
                            </div>
                        </div>

                        {isAutoSubmitting ? (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <p className="text-red-500 font-medium text-center">
                                    Maximum violations reached. Your test is being submitted automatically.
                                </p>
                            </div>
                        ) : isLastWarning ? (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <p className="text-red-500 font-medium text-sm">
                                    ⚠️ This is your final warning! One more violation will automatically submit your test.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                <p className="text-yellow-600 dark:text-yellow-400 text-sm">
                                    Please stay in fullscreen mode and do not switch tabs during the test.
                                </p>
                            </div>
                        )}

                        {!isAutoSubmitting && (
                            <Button
                                onClick={onDismiss}
                                className="w-full bg-red-500 hover:bg-red-600 text-white"
                                size="lg"
                            >
                                Return to Test (Fullscreen)
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
