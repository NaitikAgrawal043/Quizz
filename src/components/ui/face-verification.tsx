'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, AlertTriangle, Users, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFaceDetection } from '@/hooks/useFaceDetection';

interface FaceVerificationProps {
    /** Called when face verification is successful */
    onVerified: () => void;
    /** Called when user wants to cancel */
    onCancel: () => void;
    /** Required stable time in ms (default: 3000) */
    requiredStableTime?: number;
}

type VerificationStatus = 'idle' | 'loading' | 'no_face' | 'multiple_faces' | 'verifying' | 'verified' | 'error';

/**
 * Face verification component for pre-test identity confirmation.
 * Requires exactly one face to be stable for 3 seconds.
 */
export function FaceVerification({
    onVerified,
    onCancel,
    requiredStableTime = 3000
}: FaceVerificationProps) {
    const [status, setStatus] = useState<VerificationStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [countdown, setCountdown] = useState(3);

    const verificationStartRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const {
        faceCount,
        isLoading,
        error,
        videoRef,
        startCamera,
        stopCamera,
        isCameraActive
    } = useFaceDetection({
        detectionInterval: 500 // 2 FPS
    });

    // Handle starting camera
    const handleStartCamera = async () => {
        setStatus('loading');
        await startCamera();
    };

    // Update status based on face count
    useEffect(() => {
        if (!isCameraActive) return;

        if (error) {
            setStatus('error');
            return;
        }

        if (isLoading) {
            setStatus('loading');
            return;
        }

        if (faceCount === 0) {
            setStatus('no_face');
            verificationStartRef.current = null;
            setProgress(0);
            setCountdown(3);
        } else if (faceCount > 1) {
            setStatus('multiple_faces');
            verificationStartRef.current = null;
            setProgress(0);
            setCountdown(3);
        } else if (faceCount === 1) {
            if (status !== 'verifying' && status !== 'verified') {
                setStatus('verifying');
                verificationStartRef.current = Date.now();
            }
        }
    }, [faceCount, isCameraActive, isLoading, error, status]);

    // Handle verification countdown
    useEffect(() => {
        if (status !== 'verifying') {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
            return;
        }

        progressIntervalRef.current = setInterval(() => {
            if (!verificationStartRef.current) return;

            const elapsed = Date.now() - verificationStartRef.current;
            const newProgress = Math.min((elapsed / requiredStableTime) * 100, 100);
            const remaining = Math.ceil((requiredStableTime - elapsed) / 1000);

            setProgress(newProgress);
            setCountdown(Math.max(0, remaining));

            if (elapsed >= requiredStableTime) {
                setStatus('verified');
                clearInterval(progressIntervalRef.current!);
                progressIntervalRef.current = null;
            }
        }, 100);

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [status, requiredStableTime]);

    // Cleanup
    useEffect(() => {
        return () => {
            stopCamera();
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [stopCamera]);

    const statusConfig = {
        idle: {
            icon: Camera,
            color: 'text-muted-foreground',
            bgColor: 'bg-muted',
            message: 'Click to start camera'
        },
        loading: {
            icon: Loader2,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
            message: 'Starting camera...'
        },
        no_face: {
            icon: XCircle,
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-500/10',
            message: 'No face detected'
        },
        multiple_faces: {
            icon: Users,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
            message: 'Multiple faces detected'
        },
        verifying: {
            icon: Loader2,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
            message: `Hold still... ${countdown}s`
        },
        verified: {
            icon: CheckCircle,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
            message: 'Face verified!'
        },
        error: {
            icon: AlertTriangle,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
            message: error || 'Camera error'
        }
    };

    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
        <div className="space-y-4">
            {/* Camera Preview */}
            <div className="relative aspect-video w-full max-w-md mx-auto rounded-xl overflow-hidden bg-black">
                {/* Video element */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                    style={{ transform: 'scaleX(-1)' }} // Mirror the video
                />

                {/* Overlay for idle state */}
                {!isCameraActive && (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={handleStartCamera}
                    >
                        <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground font-medium">Click to start camera</p>
                    </div>
                )}

                {/* Face detection overlay */}
                {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Border indicator */}
                        <div className={`absolute inset-4 border-4 rounded-xl transition-colors duration-300 ${status === 'verified' ? 'border-green-500' :
                                status === 'verifying' ? 'border-blue-500' :
                                    status === 'no_face' ? 'border-yellow-500' :
                                        status === 'multiple_faces' ? 'border-red-500' :
                                            'border-transparent'
                            }`} />

                        {/* Progress bar for verification */}
                        {status === 'verifying' && (
                            <div className="absolute bottom-4 left-4 right-4">
                                <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-100"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Status indicator */}
            <div className={`flex items-center justify-center gap-3 p-4 rounded-lg ${config.bgColor}`}>
                <StatusIcon className={`h-5 w-5 ${config.color} ${status === 'loading' || status === 'verifying' ? 'animate-spin' : ''}`} />
                <span className={`font-medium ${config.color}`}>{config.message}</span>
            </div>

            {/* Instructions */}
            {isCameraActive && status !== 'verified' && (
                <p className="text-sm text-muted-foreground text-center">
                    Position your face in the center and remain still for verification
                </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    onClick={() => {
                        stopCamera();
                        onCancel();
                    }}
                    className="flex-1"
                >
                    Cancel
                </Button>

                {status === 'verified' && (
                    <Button
                        onClick={() => {
                            onVerified();
                        }}
                        className="flex-1 bg-green-500 hover:bg-green-600"
                    >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Begin Test
                    </Button>
                )}

                {status === 'error' && (
                    <Button
                        onClick={handleStartCamera}
                        className="flex-1"
                    >
                        Try Again
                    </Button>
                )}
            </div>
        </div>
    );
}
