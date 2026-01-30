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

    socket.on('create_room', (data, callback) => {
        // Handle both older callback-only and newer object-based args
        if (typeof data === 'function') {
            callback = data;
            data = {};
        }
        const playerName = data.playerName || '名無し';
        const roomId = RoomManager.createRoom(socket.id, playerName);
        socket.join(roomId);

        if (typeof callback === 'function') {
            callback({ roomId });
        }
        console.log(`Room created: ${roomId} by ${socket.id} (${playerName})`);
    });

    socket.on('join_room', (data, callback) => {
        // Handle both (roomId, callback) and ({roomId, playerName}, callback)
        let roomId, playerName;
        if (typeof data === 'string') {
            roomId = data;
            playerName = '名無し';
        } else {
            roomId = data.roomId;
            playerName = data.playerName || '名無し';
        }

        const result = RoomManager.joinRoom(roomId, socket.id, playerName);
        if (result.error) {
            if (typeof callback === 'function') callback({ error: result.error });
        } else {
            socket.join(roomId);
            if (typeof callback === 'function') callback({ success: true, room: result.room });
            io.to(roomId).emit('player_joined', {
                playerId: socket.id,
                playerName: playerName,
                total: result.room.players.length
            });
            console.log(`${socket.id} (${playerName}) joined room ${roomId}`);
        }
    });

    // --- Game Loop ---

    socket.on('start_game', (data) => {
        const result = RoomManager.getRoomIdAndState(socket.id);
        if (!result) return;
        const { roomId, room } = result;

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

    socket.on('end_turn', (data) => {
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
