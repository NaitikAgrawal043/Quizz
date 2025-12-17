'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Shield, AlertTriangle, Eye, Maximize, CheckCircle2,
    Camera, ArrowRight, Loader2
} from 'lucide-react';
import { FaceVerification } from '@/components/ui/face-verification';

// Step types for the multi-step flow
type Step = 'rules' | 'camera' | 'verified';

export default function StartTestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [test, setTest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [acknowledged, setAcknowledged] = useState(false);
    const [starting, setStarting] = useState(false);
    const [currentStep, setCurrentStep] = useState<Step>('rules');

    useEffect(() => {
        fetch(`/api/tests/${id}`)
            .then(res => res.json())
            .then(setTest)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    const handleStartTest = async () => {
        setStarting(true);
        try {
            const res = await fetch(`/api/tests/${id}/start`, { method: 'POST' });
            if (res.ok) {
                const attempt = await res.json();
                router.push(`/test/${attempt._id}`);
            }
        } catch (error) {
            console.error('Failed to start test:', error);
            setStarting(false);
        }
    };

    const handleProceedToCamera = () => {
        setCurrentStep('camera');
    };

    const handleFaceVerified = () => {
        setCurrentStep('verified');
    };

    const handleCancelVerification = () => {
        setCurrentStep('rules');
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
    if (!test) return <div className="flex justify-center items-center h-screen">Test not found</div>;

    // Rules for the test
    const rules = [
        {
            icon: Camera,
            title: 'Face Verification Required',
            description: 'Your face must be verified before starting. Keep your face visible throughout the test.',
        },
        {
            icon: Maximize,
            title: 'Fullscreen Mode Required',
            description: 'The test will automatically enter fullscreen mode. You must remain in fullscreen throughout.',
        },
        {
            icon: Eye,
            title: 'Tab Switching Prohibited',
            description: 'Switching to other browser tabs or windows is not allowed and will be detected.',
        },
        {
            icon: AlertTriangle,
            title: 'Continuous Monitoring',
            description: 'Your face and screen activity will be monitored. Multiple violations will auto-submit your test.',
        },
        {
            icon: Shield,
            title: '3-Strike Policy',
            description: 'After 3 violations (no face, multiple faces, tab switch, etc.), your test will be automatically submitted.',
        },
    ];

    // Step indicator
    const steps = [
        { key: 'rules', label: 'Rules', completed: currentStep !== 'rules' },
        { key: 'camera', label: 'Verify Face', completed: currentStep === 'verified' },
        { key: 'verified', label: 'Start Test', completed: false },
    ];

    return (
        <div className="container mx-auto p-6 max-w-3xl">
            <Card className="border-2">
                <CardHeader className="border-b bg-muted/50">
                    <CardTitle className="flex items-center gap-3">
                        <Shield className="h-6 w-6 text-primary" />
                        {test.title}
                    </CardTitle>
                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mt-4">
                        {steps.map((step, index) => (
                            <div key={step.key} className="flex items-center">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${step.completed
                                        ? 'bg-green-500 text-white'
                                        : currentStep === step.key
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {step.completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                                </div>
                                <span className={`ml-2 text-sm ${currentStep === step.key ? 'font-medium' : 'text-muted-foreground'
                                    }`}>
                                    {step.label}
                                </span>
                                {index < steps.length - 1 && (
                                    <ArrowRight className="h-4 w-4 mx-3 text-muted-foreground" />
                                )}
                            </div>
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                    {/* Step 1: Rules */}
                    {currentStep === 'rules' && (
                        <>
                            {/* Test Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground">Duration</p>
                                    <p className="font-semibold">{Math.floor(test.durationSeconds / 60)} minutes</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Sections</p>
                                    <p className="font-semibold">{test.sections?.length || 0} sections</p>
                                </div>
                            </div>

                            {test.description && (
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="text-muted-foreground">{test.description}</p>
                                </div>
                            )}

                            {/* Anti-Cheating Rules */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                    Important Test Rules
                                </h3>

                                <div className="grid gap-3">
                                    {rules.map((rule, index) => (
                                        <div
                                            key={index}
                                            className="flex gap-4 p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="shrink-0">
                                                <div className="p-2 rounded-full bg-primary/10">
                                                    <rule.icon className="h-5 w-5 text-primary" />
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-medium">{rule.title}</h4>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {rule.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Warning Alert */}
                            <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Warning</AlertTitle>
                                <AlertDescription>
                                    Your webcam will be used for face verification and monitoring.
                                    No video is recorded or uploaded. Only violation metadata is stored.
                                </AlertDescription>
                            </Alert>

                            {/* Acknowledgment Checkbox */}
                            <div
                                className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${acknowledged
                                        ? 'border-green-500 bg-green-500/10'
                                        : 'border-muted hover:border-primary/50'
                                    }`}
                                onClick={() => setAcknowledged(!acknowledged)}
                            >
                                <Checkbox
                                    id="acknowledge"
                                    checked={acknowledged}
                                    onCheckedChange={(checked) => setAcknowledged(checked === true)}
                                    className="mt-0.5"
                                />
                                <div className="space-y-1">
                                    <Label htmlFor="acknowledge" className="font-medium cursor-pointer">
                                        I understand and agree to the test rules
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        I agree to enable my webcam for face verification and consent to proctoring
                                        during the test.
                                    </p>
                                </div>
                            </div>

                            {/* Proceed to Camera Button */}
                            <Button
                                size="lg"
                                className="w-full h-14 text-lg font-semibold"
                                onClick={handleProceedToCamera}
                                disabled={!acknowledged}
                            >
                                {acknowledged ? (
                                    <>
                                        <Camera className="mr-2 h-5 w-5" />
                                        Start Proctored Test
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </>
                                ) : (
                                    'Please acknowledge the rules to continue'
                                )}
                            </Button>
                        </>
                    )}

                    {/* Step 2: Camera Verification */}
                    {currentStep === 'camera' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="text-xl font-semibold mb-2">Face Verification</h3>
                                <p className="text-muted-foreground">
                                    Position your face in the camera and remain still for 3 seconds
                                </p>
                            </div>

                            <FaceVerification
                                onVerified={handleFaceVerified}
                                onCancel={handleCancelVerification}
                                requiredStableTime={3000}
                            />
                        </div>
                    )}

                    {/* Step 3: Verified - Ready to Start */}
                    {currentStep === 'verified' && (
                        <div className="space-y-6 text-center">
                            <div className="flex justify-center">
                                <div className="p-4 rounded-full bg-green-500/20">
                                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">Face Verified Successfully!</h3>
                                <p className="text-muted-foreground">
                                    You are now ready to begin the test. The test will start in fullscreen mode
                                    and your face will be monitored throughout.
                                </p>
                            </div>

                            <Alert className="border-blue-500/50 bg-blue-500/10 text-left">
                                <Camera className="h-4 w-4" />
                                <AlertTitle>Reminder</AlertTitle>
                                <AlertDescription>
                                    Keep your face visible at all times. Looking away, multiple faces,
                                    or covering the camera will count as violations.
                                </AlertDescription>
                            </Alert>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep('camera')}
                                    className="flex-1"
                                >
                                    Re-verify Face
                                </Button>
                                <Button
                                    size="lg"
                                    className="flex-1 h-14 text-lg font-semibold bg-green-500 hover:bg-green-600"
                                    onClick={handleStartTest}
                                    disabled={starting}
                                >
                                    {starting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Starting...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="mr-2 h-5 w-5" />
                                            Begin Test Now
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
