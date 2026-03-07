'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ImageUploadButtonProps {
    onUpload: (data: { url: string; publicId: string }) => void;
    disabled?: boolean;
}

export function ImageUploadButton({ onUpload, disabled }: ImageUploadButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({
                title: 'Invalid file type',
                description: 'Please select an image file (PNG, JPG, GIF, etc.)',
                variant: 'destructive',
            });
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: 'File too large',
                description: 'Image must be under 5MB.',
                variant: 'destructive',
            });
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            toast({
                title: '✅ Image uploaded',
                description: 'Image URL has been inserted into the question.',
            });

            onUpload({ url: data.url, publicId: data.publicId });
        } catch (error: any) {
            console.error('Upload error:', error);
            toast({
                title: 'Upload failed',
                description: error.message || 'Failed to upload image. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
            // Reset file input so the same file can be re-selected
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClick}
                disabled={disabled || uploading}
                title="Upload image"
                className="gap-1.5"
            >
                {uploading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <ImagePlus className="h-4 w-4" />
                        Image
                    </>
                )}
            </Button>
        </>
    );
}
