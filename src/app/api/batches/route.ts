import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Batch, IBatch } from '@/lib/db/models';

export async function GET(): Promise<NextResponse<IBatch[] | { error: string }>> {
    await dbConnect();
    try {
        const batches = await Batch.find({}).sort({ name: 1 }).lean() as IBatch[];
        return NextResponse.json(batches);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
    }
}

export async function POST(req: Request): Promise<NextResponse<IBatch | { error: string }>> {
    await dbConnect();
    try {
        const body = await req.json();
        const batch = await Batch.create(body);
        return NextResponse.json(batch as unknown as IBatch, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
    }
}
