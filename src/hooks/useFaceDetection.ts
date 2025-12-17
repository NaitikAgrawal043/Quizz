'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Types for MediaPipe face detection
interface Detection {
    boundingBox: {
        xCenter: number;
        yCenter: number;
        width: number;
        height: number;
    };
}

interface FaceDetectionResults {
    detections: Detection[];
}

interface UseFaceDetectionOptions {
    /** Detection interval in ms (default: 500ms = 2 FPS) */
    detectionInterval?: number;
    /** Model selection: 0 = short range, 1 = full range */
    modelSelection?: number;
    /** Minimum confidence threshold (0-1) */
    minDetectionConfidence?: number;
}

interface UseFaceDetectionReturn {
    /** Number of faces currently detected */
    faceCount: number;
    /** Whether the camera/detection is loading */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Reference to attach to video element */
    videoRef: React.RefObject<HTMLVideoElement | null>;
    /** Start camera and face detection */
    startCamera: () => Promise<void>;
    /** Stop camera and face detection */
    stopCamera: () => void;
    /** Whether camera is active */
    isCameraActive: boolean;
}

/**
 * Custom hook for face detection using MediaPipe.
 * Runs detection at a throttled rate to balance performance and accuracy.
 */
export function useFaceDetection({
    detectionInterval = 500, // ~2 FPS
    modelSelection = 0, // Short range (best for webcam)
    minDetectionConfidence = 0.5
}: UseFaceDetectionOptions = {}): UseFaceDetectionReturn {
    const [faceCount, setFaceCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceDetectionRef = useRef<any>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isMounted = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            stopCamera();
        };
    }, []);

    /**
     * Initialize MediaPipe Face Detection
     */
    const initializeFaceDetection = useCallback(async () => {
        try {
            // Dynamic import for client-side only
            const { FaceDetection } = await import('@mediapipe/face_detection');

            const faceDetection = new FaceDetection({
                locateFile: (file: string) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
                }
            });

            // Configure detection
            faceDetection.setOptions({
                model: modelSelection === 0 ? 'short' : 'full',
                minDetectionConfidence
            });

            // Set up results callback
            faceDetection.onResults((results: FaceDetectionResults) => {
                if (isMounted.current) {
                    setFaceCount(results.detections?.length || 0);
                }
            });

            await faceDetection.initialize();
            faceDetectionRef.current = faceDetection;

            return faceDetection;
        } catch (err) {
            console.error('Failed to initialize face detection:', err);
            throw new Error('Failed to initialize face detection');
        }
    }, [modelSelection, minDetectionConfidence]);

    /**
     * Run detection on current video frame
     */
    const runDetection = useCallback(async () => {
        if (!videoRef.current || !faceDetectionRef.current) return;

        const video = videoRef.current;
        if (video.readyState !== 4) return; // Video not ready

        try {
            await faceDetectionRef.current.send({ image: video });
        } catch (err) {
            console.error('Detection error:', err);
        }
    }, []);

    /**
     * Start camera and face detection
     */
    const startCamera = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Request camera permission
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            if (!isMounted.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = stream;

            // Attach stream to video element
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Initialize face detection
            await initializeFaceDetection();

            // Start detection loop
            detectionIntervalRef.current = setInterval(runDetection, detectionInterval);

            if (isMounted.current) {
                setIsCameraActive(true);
                setIsLoading(false);
            }
        } catch (err: any) {
            console.error('Camera error:', err);
            if (isMounted.current) {
                if (err.name === 'NotAllowedError') {
                    setError('Camera access denied. Please allow camera access to proceed.');
                } else if (err.name === 'NotFoundError') {
                    setError('No camera found. Please connect a camera.');
                } else {
                    setError('Failed to start camera. Please try again.');
                }
                setIsLoading(false);
            }
        }
    }, [initializeFaceDetection, runDetection, detectionInterval]);

    /**
     * Stop camera and face detection
     */
    const stopCamera = useCallback(() => {
        // Stop detection interval
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }

        // Stop media stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Clear video element
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        // Close face detection
        if (faceDetectionRef.current) {
            faceDetectionRef.current.close?.();
            faceDetectionRef.current = null;
        }

        if (isMounted.current) {
            setIsCameraActive(false);
            setFaceCount(0);
        }
    }, []);

    return {
        faceCount,
        isLoading,
        error,
        videoRef,
        startCamera,
        stopCamera,
        isCameraActive
    };
}
