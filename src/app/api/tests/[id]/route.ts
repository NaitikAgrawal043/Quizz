import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Test } from '@/lib/db/models';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    try {
        const { id } = await params;
        const test = await Test.findById(id).lean();
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }
        return NextResponse.json(test);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch test' }, { status: 500 });
    }
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();

  try {
    const { id } = await params;
    const body = await req.json();

    const updatedTest = await Test.findByIdAndUpdate(
      id,
      body,
      { new: true }
    ).lean();

    if (!updatedTest) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedTest);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update test' },
      { status: 500 }
    );
  }
}
