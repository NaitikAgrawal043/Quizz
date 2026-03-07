import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json(
            { error: 'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.' },
            { status: 500 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 });
        }

        // Generate signed upload parameters
        const timestamp = Math.round(Date.now() / 1000);
        const folder = 'quizzapp';

        // Parameters that need to be included in signature (alphabetical order)
        const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
        const signature = crypto
            .createHash('sha1')
            .update(paramsToSign + apiSecret)
            .digest('hex');

        // Build the signed upload request
        const cloudinaryForm = new FormData();
        cloudinaryForm.append('file', file);
        cloudinaryForm.append('folder', folder);
        cloudinaryForm.append('timestamp', String(timestamp));
        cloudinaryForm.append('api_key', apiKey);
        cloudinaryForm.append('signature', signature);

        const cloudinaryRes = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            { method: 'POST', body: cloudinaryForm }
        );

        if (!cloudinaryRes.ok) {
            const errData = await cloudinaryRes.json();
            console.error('Cloudinary upload failed:', errData);
            return NextResponse.json(
                { error: 'Image upload failed' },
                { status: 500 }
            );
        }

        const result = await cloudinaryRes.json();

        return NextResponse.json({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
