'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import Image from 'next/image';

export default function Navbar() {
    const { data: session } = useSession();

    return (
        <nav className="border-b bg-background">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold">
                    <Image src="/image.png" alt="Logo" width={40} height={40} unoptimized priority />
                </Link>

                <div className="flex items-center gap-4">
                    {session?.user ? (
                        <>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span>{session.user.name || session.user.email}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => signOut({ callbackUrl: '/login' })}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout
                            </Button>
                        </>
                    ) : (
                        <div className="flex gap-2">
                            <Link href="/login">
                                <Button variant="ghost" size="sm">Login</Button>
                            </Link>
                            <Link href="/signup">
                                <Button size="sm">Sign Up</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
