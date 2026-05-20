import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { Test } from '@/lib/db/models';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let query = {};
        if (session.user.role !== 'admin') {
            // Users only see tests for their batches
            // Ensure batches is an array of strings (ObjectIds)
            query = {
                batches: { $in: session.user.batches },
                status: 'published'
            };
        }

        const tests = await Test.find(query).populate('batches', 'name').sort({ createdAt: -1 }).lean();
        return NextResponse.json(tests);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();

        if (!body.title || !body.durationSeconds) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const test = await Test.create({
            ...body,
            createdBy: session.user.id
        });
        return NextResponse.json(test, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
    }
}
