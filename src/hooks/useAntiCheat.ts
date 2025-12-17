'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type ViolationType = 'tab_switch' | 'minimize' | 'fullscreen_exit' | 'no_face' | 'multiple_faces' | 'camera_disabled';

interface UseAntiCheatOptions {
    attemptId: string;
    onAutoSubmit: () => void;
    enabled?: boolean;
}

interface UseAntiCheatReturn {
    isFullscreen: boolean;
    enterFullscreen: () => Promise<void>;
    exitFullscreen: () => Promise<void>;
    violationCount: number;
    maxViolations: number;
    showWarning: boolean;
    lastViolationType: ViolationType | null;
    dismissWarning: () => void;
}

export function useAntiCheat({
    attemptId,
    onAutoSubmit,
    enabled = true
}: UseAntiCheatOptions): UseAntiCheatReturn {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [violationCount, setViolationCount] = useState(0);
    const [maxViolations, setMaxViolations] = useState(3);
    const [showWarning, setShowWarning] = useState(false);
    const [lastViolationType, setLastViolationType] = useState<ViolationType | null>(null);

    // Track if we're currently processing a violation to prevent duplicates
    const processingViolation = useRef(false);
    // Track if the component is mounted
    const isMounted = useRef(true);
    // Track if we intentionally exited fullscreen (for submit)
    const intentionalExit = useRef(false);

    // Fetch initial violation count from server
    useEffect(() => {
        if (!enabled) return;

        isMounted.current = true;

        fetch(`/api/attempts/${attemptId}/violation`)
            .then(res => res.json())
            .then(data => {
                if (isMounted.current && data.count !== undefined) {
                    setViolationCount(data.count);
                    setMaxViolations(data.maxViolations || 3);
                }
            })
            .catch(console.error);

        return () => {
            isMounted.current = false;
        };
    }, [attemptId, enabled]);

    // Record violation to server
    const recordViolation = useCallback(async (type: ViolationType) => {
        if (processingViolation.current || !isMounted.current) return;

        processingViolation.current = true;
        setLastViolationType(type);
        setShowWarning(true);

        try {
            const res = await fetch(`/api/attempts/${attemptId}/violation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });

            const data = await res.json();

            if (isMounted.current) {
                setViolationCount(data.count);
                setMaxViolations(data.maxViolations || 3);

                if (data.shouldAutoSubmit) {
                    intentionalExit.current = true;
                    onAutoSubmit();
                }
            }
        } catch (error) {
            console.error('Failed to record violation:', error);
        } finally {
            processingViolation.current = false;
        }
    }, [attemptId, onAutoSubmit]);

    // Enter fullscreen
    const enterFullscreen = useCallback(async () => {
        try {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if ((elem as any).webkitRequestFullscreen) {
                await (elem as any).webkitRequestFullscreen();
            } else if ((elem as any).msRequestFullscreen) {
                await (elem as any).msRequestFullscreen();
            }
            setIsFullscreen(true);
        } catch (error) {
            console.error('Failed to enter fullscreen:', error);
        }
    }, []);

    // Exit fullscreen
    const exitFullscreen = useCallback(async () => {
        intentionalExit.current = true;
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                await (document as any).webkitExitFullscreen();
            } else if ((document as any).msExitFullscreen) {
                await (document as any).msExitFullscreen();
            }
            setIsFullscreen(false);
        } catch (error) {
            console.error('Failed to exit fullscreen:', error);
        }
    }, []);

    // Dismiss warning and re-enter fullscreen
    const dismissWarning = useCallback(() => {
        setShowWarning(false);
        enterFullscreen();
    }, [enterFullscreen]);

    // Listen for fullscreen changes
    useEffect(() => {
        if (!enabled) return;

        const handleFullscreenChange = () => {
            const isNowFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isNowFullscreen);

            // If exited fullscreen and it wasn't intentional, record violation
            if (!isNowFullscreen && !intentionalExit.current && isMounted.current) {
                recordViolation('fullscreen_exit');
            }
            intentionalExit.current = false;
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
        };
    }, [enabled, recordViolation]);

    // Listen for visibility changes (tab switch)
    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.hidden && isMounted.current) {
                recordViolation('tab_switch');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, recordViolation]);

    // Listen for window blur (minimize / alt-tab)
    useEffect(() => {
        if (!enabled) return;

        let blurTimeout: NodeJS.Timeout | null = null;

        const handleBlur = () => {
            // Use a small timeout to avoid false positives from fullscreen transitions
            blurTimeout = setTimeout(() => {
                if (!document.hidden && isMounted.current) {
                    // Only record minimize if tab is still visible (not a tab switch)
                    recordViolation('minimize');
                }
            }, 200);
        };

        const handleFocus = () => {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
                blurTimeout = null;
            }
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            if (blurTimeout) clearTimeout(blurTimeout);
        };
    }, [enabled, recordViolation]);

    return {
        isFullscreen,
        enterFullscreen,
        exitFullscreen,
        violationCount,
        maxViolations,
        showWarning,
        lastViolationType,
        dismissWarning
    };
}
