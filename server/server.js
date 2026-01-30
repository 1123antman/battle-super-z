import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import RoomManager from './roomManager.js';
import GameLogic from './gameLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();
const httpServer = http.createServer(app);

// Serve static files from the dist directory
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // --- Room Management ---

    socket.on('create_room', (callback) => {
        const roomId = RoomManager.createRoom(socket.id);
        socket.join(roomId);
        callback({ roomId });
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on('join_room', (roomId, callback) => {
        const result = RoomManager.joinRoom(roomId, socket.id);
        if (result.error) {
            callback({ error: result.error });
        } else {
            socket.join(roomId);
            callback({ success: true, room: result.room });
            io.to(roomId).emit('player_joined', { playerId: socket.id, total: result.room.players.length });
            console.log(`${socket.id} joined room ${roomId}`);
        }
    });

    // --- Game Loop ---

    socket.on('start_game', () => {
        const result = RoomManager.getRoomIdAndState(socket.id);
        if (!result) return;
        const { roomId, room } = result;

        // Only host (first player?) can start? 
        // For simplicity, anyone in room can start for now, or check index 0.
        if (room.players[0] !== socket.id) {
            // socket.emit('error', 'Only host can start game');
            // return;
        }

        const gameState = GameLogic.initializeGame(room);
        io.to(roomId).emit('game_started', gameState);
    });

    socket.on('play_card', (cardData) => {
        const result = RoomManager.getRoomIdAndState(socket.id);
        if (!result) return;
        const { roomId, room } = result;

        const actionResult = GameLogic.processCard(room, socket.id, cardData);
        if (actionResult.error) {
            socket.emit('error_message', actionResult.error);
        } else {
            io.to(roomId).emit('action_performed', {
                playerId: socket.id,
                cardData: cardData,
                logs: actionResult.logs,
                gameState: actionResult.gameState
            });
            console.log(`Action in ${roomId}:`, actionResult.logs);
        }
    });

    socket.on('end_turn', () => {
        const result = RoomManager.getRoomIdAndState(socket.id);
        if (!result) return;
        const { roomId, room } = result;

        if (room.gameState.currentTurnPlayerId !== socket.id) return;

        const turnResult = GameLogic.endTurn(room);
        io.to(roomId).emit('turn_changed', turnResult);
    });

    // --- Disconnect ---

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const roomId = RoomManager.removePlayer(socket.id);
        if (roomId) {
            io.to(roomId).emit('player_left', { playerId: socket.id });
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
