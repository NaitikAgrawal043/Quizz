import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { getRedisSubscriber } from './lib/redis';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    // --- Socket.io Setup ---
    const io = new SocketIOServer(server, {
        path: '/api/socket',
        cors: { origin: '*' },
        // Increase timeout for stability
        pingTimeout: 60000,
    });

    // --- Redis Subscriber for cross-process events ---
    const redisSub = getRedisSubscriber();

    redisSub.subscribe('test-control', (err) => {
        if (err) {
            console.error('Failed to subscribe to test-control channel:', err);
        } else {
            console.log('✅ Subscribed to Redis channel: test-control');
        }
    });

    redisSub.on('message', (channel, message) => {
        if (channel === 'test-control') {
            try {
                const data = JSON.parse(message);
                // Broadcast to all clients in the specific test room
                io.to(`test:${data.testId}`).emit('state-change', {
                    currentQuestionIndex: data.currentQuestionIndex,
                    status: data.status,
                });
                console.log(`📡 Broadcast to test:${data.testId}`, data);
            } catch (e) {
                console.error('Failed to parse Redis message:', e);
            }
        }
    });

    // --- Socket.io Connection Handling ---
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Student joins a test room
        socket.on('join-test', (testId: string) => {
            socket.join(`test:${testId}`);
            console.log(`👤 ${socket.id} joined room test:${testId}`);

            // Send room count back to inform admin
            const room = io.sockets.adapter.rooms.get(`test:${testId}`);
            const count = room ? room.size : 0;
            io.to(`test:${testId}`).emit('room-count', { count });
        });

        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });

    const PORT = parseInt(process.env.PORT || '3000', 10);
    server.listen(PORT, () => {
        console.log(`> 🚀 Ready on http://localhost:${PORT}`);
        console.log(`> Socket.io path: /api/socket`);
    });
});
