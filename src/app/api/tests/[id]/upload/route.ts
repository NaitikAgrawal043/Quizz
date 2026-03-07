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

        if (!fileName.endsWith('.docx') && !fileName.endsWith('.md')) {
            return NextResponse.json({
                error: 'Only DOCX and Markdown (.md) files are supported for direct upload.'
            }, { status: 400 });
        }

        let fileType: 'docx' | 'md';
        if (fileName.endsWith('.md')) {
            fileType = 'md';
        } else {
            fileType = 'docx';
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
