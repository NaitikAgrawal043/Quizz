import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db/connect';
import { User } from '@/lib/db/models';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    await dbConnect();
    try {
        const { name, email, password, batchId, rollNumber } = await req.json();

        if (!name || !email || !password || !batchId || !rollNumber) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }

        const existingRollNumber = await User.findOne({ rollNumber });
        if (existingRollNumber) {
            return NextResponse.json({ error: 'Roll Number already in use' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            passwordHash,
            rollNumber,
            batches: [batchId],
            role: 'user', // Default to user
        });

        return NextResponse.json({ success: true, userId: user._id }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
