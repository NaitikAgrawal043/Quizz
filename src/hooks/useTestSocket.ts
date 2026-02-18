'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SyncState {
    currentQuestionIndex: number;
    status: string;
}

export function useTestSocket(testId: string) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [syncState, setSyncState] = useState<SyncState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [roomCount, setRoomCount] = useState(0);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const s = io({
            path: '/api/socket',
            transports: ['websocket', 'polling'],
        });

        socketRef.current = s;
        setSocket(s);

        s.on('connect', () => {
            setIsConnected(true);
            s.emit('join-test', testId);
        });

        s.on('disconnect', () => {
            setIsConnected(false);
        });

        s.on('state-change', (data: SyncState) => {
            setSyncState(data);
        });

        s.on('room-count', (data: { count: number }) => {
            setRoomCount(data.count);
        });

        return () => {
            s.disconnect();
            socketRef.current = null;
        };
    }, [testId]);

    return { syncState, isConnected, roomCount, socket };
}
