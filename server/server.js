import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import RoomManager from './roomManager.js';
import GameLogic from './gameLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// [NEW] Simple in-memory leaderboard
const globalLeaderboard = {}; // { playerName: wins }

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
        const room = RoomManager.rooms.get(roomId); // Get the created room object
        socket.join(roomId);

        // Store deck size if provided
        if (data.deckSize !== undefined) {
            if (!room.playerDeckSizes) room.playerDeckSizes = {};
            room.playerDeckSizes[socket.id] = data.deckSize;
        }

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
            const room = RoomManager.rooms.get(roomId); // Get the room object after joining
            // Store deck size if provided
            if (data.deckSize !== undefined) {
                if (!room.playerDeckSizes) room.playerDeckSizes = {};
                room.playerDeckSizes[socket.id] = data.deckSize;
            }

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

        // Reset per-game data in room object
        // room.playerDeckSizes is now set during create/join, so no need to reset here
        // if (data.deckSize !== undefined) {
        //     room.playerDeckSizes[socket.id] = data.deckSize;
        // }

        const gameState = GameLogic.initializeGame(room);
        io.to(roomId).emit('game_started', gameState);
    });

    socket.on('play_card', (cardData) => {
        const result = RoomManager.getRoomIdAndState(socket.id);
        if (!result) {
            console.error(`[CARD_ERROR] Room not found for socket: ${socket.id}`);
            return;
        }
        const { roomId, room } = result;
        const skills = cardData.skills || [];
        console.log(`[PLAY_CARD] From: ${socket.id}, Card: ${cardData.name}, Skills: ${JSON.stringify(skills)}`);

        const actionResult = GameLogic.processCard(room, socket.id, cardData);
        if (actionResult.error) {
            console.warn(`[CARD_REJECTED] ${actionResult.error} (Actor: ${socket.id})`);
            socket.emit('error_message', actionResult.error);
        } else {
            io.to(roomId).emit('action_performed', {
                playerId: socket.id,
                cardData: cardData,
                logs: actionResult.logs,
                gameState: actionResult.gameState
            });
            console.log(`Action in ${roomId}:`, actionResult.logs);

            // Check Game Over
            const overCheck = GameLogic.checkGameOver(room.gameState);
            if (overCheck.finished) {
                const winnerName = overCheck.winnerName || '名無し';
                globalLeaderboard[winnerName] = (globalLeaderboard[winnerName] || 0) + 1;

                io.to(roomId).emit('game_over', {
                    winnerId: overCheck.winnerId,
                    winnerName: winnerName,
                    leaderboard: globalLeaderboard
                });
            }
        }
    });

    socket.on('end_turn', (data) => {
        const result = RoomManager.getRoomIdAndState(socket.id);
        if (!result) return;
        const { roomId, room } = result;

        console.log(`[END_TURN] From: ${socket.id}, CurrentTurn: ${room.gameState.currentTurnPlayerId}`);

        if (room.gameState.currentTurnPlayerId !== socket.id) {
            console.warn(`[TURN_REJECTED] Not actor's turn. Actor: ${socket.id}, Expected: ${room.gameState.currentTurnPlayerId}`);
            socket.emit('error_message', 'Not your turn (server check)');
            return;
        }

        const turnResult = GameLogic.endTurn(room);
        io.to(roomId).emit('turn_changed', turnResult);

        // Check Game Over (Penalty damage might kill a player)
        const overCheck = GameLogic.checkGameOver(room.gameState);
        if (overCheck.finished) {
            const winnerName = overCheck.winnerName || '名無し';
            globalLeaderboard[winnerName] = (globalLeaderboard[winnerName] || 0) + 1;

            io.to(roomId).emit('game_over', {
                winnerId: overCheck.winnerId,
                winnerName: winnerName,
                leaderboard: globalLeaderboard
            });
        }
    });

    socket.on('chat_message', (data) => {
        const result = RoomManager.getRoomIdAndState(socket.id);
        if (!result) return;
        const { roomId, room } = result;
        const playerName = room.playerNames[socket.id] || '名無し';

        io.to(roomId).emit('chat_received', {
            playerId: socket.id,
            playerName: playerName,
            msg: data.msg
        });
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
