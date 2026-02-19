import { NextResponse } from 'next/server';
import { parseDocument } from '@/lib/parser';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        console.log('Upload API called');
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.log('No file found in formData');
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        console.log(`File received: ${file.name}, size: ${file.size}, type: ${file.type}`);

        const fileName = file.name.toLowerCase();
        let fileType: 'docx' | 'pdf' | 'txt';

        if (fileName.endsWith('.docx')) {
            fileType = 'docx';
        } else if (fileName.endsWith('.txt')) {
            fileType = 'txt';
        } else {
            return NextResponse.json({
                error: 'Only DOCX and TXT files are supported. Please use one of these formats.'
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        console.log(`Processing as ${fileType}`);

        const result = await parseDocument(buffer, fileType);
        console.log('Parsing complete', result);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Upload API Error:', error);
        return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
    }
}
