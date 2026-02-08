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

    function cleanupOldRooms(playerId) {
        let count = 0;
        while (true) {
            const oldRoomId = RoomManager.removePlayer(playerId);
            if (!oldRoomId) break;
            socket.leave(oldRoomId);
            count++;
        }
        if (count > 0) {
            console.log(`[CLEANUP] Removed ${playerId} from ${count} old rooms. Total rooms remaining: ${RoomManager.rooms.size}`);
        }
    }

    socket.on('create_room', (data, callback) => {
        cleanupOldRooms(socket.id);

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

    socket.on('create_solo_room', (data, callback) => {
        cleanupOldRooms(socket.id);

        const playerName = data.playerName || '名無し';
        const { roomId, aiId } = RoomManager.createSoloRoom(socket.id, playerName);
        const room = RoomManager.rooms.get(roomId);
        socket.join(roomId);

        if (data.deckSize !== undefined) {
            if (!room.playerDeckSizes) room.playerDeckSizes = {};
            room.playerDeckSizes[socket.id] = data.deckSize;
        }

        if (typeof callback === 'function') {
            callback({ roomId });
        }
        console.log(`Solo Room created: ${roomId} by ${socket.id} (${playerName})`);

        // Automatically start game for solo mode
        const gameState = GameLogic.initializeGame(room);
        io.to(roomId).emit('game_started', gameState);

        // Check if it's AI's turn immediately
        checkAITurn(room, roomId);
    });

    socket.on('join_room', (data, callback) => {
        cleanupOldRooms(socket.id);

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
        const roomIdFromClient = data ? data.roomId : null;
        let roomObj = roomIdFromClient ? RoomManager.rooms.get(roomIdFromClient) : null;

        if (!roomObj) {
            const result = RoomManager.getRoomIdAndState(socket.id);
            if (!result) return;
            roomObj = result.room;
        }

        const gameState = GameLogic.initializeGame(roomObj);
        io.to(roomObj.id).emit('game_started', gameState);
    });

    socket.on('play_card', (cardData) => {
        const roomIdFromClient = cardData.roomId;
        let room = roomIdFromClient ? RoomManager.rooms.get(roomIdFromClient) : null;
        let roomId = roomIdFromClient;

        if (!room) {
            const result = RoomManager.getRoomIdAndState(socket.id);
            if (!result) {
                console.error(`[CARD_ERROR] Room not found for socket: ${socket.id}`);
                return;
            }
            room = result.room;
            roomId = result.roomId;
        }

        const skills = cardData.skills || [];
        console.log(`[PLAY_CARD] From: ${socket.id}, Room: ${roomId}, Card: ${cardData.name}`);

        const actionResult = GameLogic.processCard(room, socket.id, cardData);
        if (actionResult.error) {
            console.warn(`[CARD_REJECTED] ${actionResult.error} (Actor: ${socket.id}, CurrentTurn: ${room.gameState.currentTurnPlayerId})`);
            socket.emit('error_message', `${actionResult.error}`);
        } else {
            io.to(roomId).emit('action_performed', {
                playerId: socket.id,
                cardData: cardData,
                logs: actionResult.logs,
                gameState: actionResult.gameState
            });

            // Check Game Over
            const overCheck = GameLogic.checkGameOver(room.gameState);
            if (overCheck.finished) {
                const winnerName = overCheck.winnerName || '名無し';
                globalLeaderboard[winnerName] = (globalLeaderboard[winnerName] || 0) + 1;

                room.gameState.status = 'finished'; // [NEW] Ensure status is updated

                io.to(roomId).emit('game_over', {
                    winnerId: overCheck.winnerId,
                    winnerName: winnerName,
                    leaderboard: globalLeaderboard
                });
            } else {
                // If game not over, check for AI turn
                checkAITurn(room, roomId);
            }
        }
    });

    socket.on('end_turn', (data) => {
        const roomIdFromClient = data ? data.roomId : null;
        let room = roomIdFromClient ? RoomManager.rooms.get(roomIdFromClient) : null;
        let roomId = roomIdFromClient;

        if (!room) {
            const result = RoomManager.getRoomIdAndState(socket.id);
            if (!result) return;
            room = result.room;
            roomId = result.roomId;
        }

        console.log(`[END_TURN] From: ${socket.id}, Room: ${roomId}, CurrentTurn: ${room.gameState.currentTurnPlayerId}`);

        if (room.gameState.currentTurnPlayerId !== socket.id) {
            console.warn(`[TURN_REJECTED] Not actor's turn. Actor: ${socket.id}, Expected: ${room.gameState.currentTurnPlayerId}`);
            socket.emit('error_message', `自分のターンではありません (現在: ${room.gameState.currentTurnPlayerId})`);
            return;
        }

        const turnResult = GameLogic.endTurn(room);
        io.to(roomId).emit('turn_changed', turnResult);

        // Check Game Over (Penalty damage might kill a player)
        const overCheck = GameLogic.checkGameOver(room.gameState);
        if (overCheck.finished) {
            const winnerName = overCheck.winnerName || '名無し';
            globalLeaderboard[winnerName] = (globalLeaderboard[winnerName] || 0) + 1;

            room.gameState.status = 'finished'; // Double check

            io.to(roomId).emit('game_over', {
                winnerId: overCheck.winnerId,
                winnerName: winnerName,
                leaderboard: globalLeaderboard
            });
        } else {
            // If game not over, check for AI turn after turn change
            checkAITurn(room, roomId);
        }
    });

    socket.on('leave_room', (data) => {
        const roomId = cleanupOldRooms(socket.id);
        if (roomId) {
            console.log(`[LEAVE] ${socket.id} manually left room ${roomId}`);
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
        RoomManager.removePlayer(socket.id);
    });
});

async function checkAITurn(room, roomId) {
    if (!room.isSolo || !room.gameState || room.gameState.status !== 'playing') return;

    const currentPtrId = room.gameState.currentTurnPlayerId;
    console.log(`[AI_CHECK] CurrentTurn: ${currentPtrId}, RoomId: ${roomId}`);

    if (currentPtrId && currentPtrId.startsWith('ai_player_')) {
        // [SAFETY] Use a flag to prevent multiple triggers for the same AI turn
        if (room.isThinking) return;
        room.isThinking = true;

        console.log(`[AI] Thinking started for ${currentPtrId}...`);

        try {
            // Short delay to feel like "thinking"
            await new Promise(resolve => setTimeout(resolve, 1500));

            const aiResult = GameLogic.runAITurn(room, currentPtrId);
            if (aiResult) {
                console.log(`[AI] Actions executed: ${aiResult.actions.length}`);

                // Emit actions performed by AI
                aiResult.actions.forEach(action => {
                    io.to(roomId).emit('action_performed', {
                        playerId: currentPtrId,
                        cardData: action.cardData,
                        logs: action.logs,
                        gameState: action.gameState
                    });
                });

                // Emit turn changed
                if (aiResult.turnChanged) {
                    console.log(`[AI] End turn. Next up: ${aiResult.turnChanged.nextPlayerId}`);
                    io.to(roomId).emit('turn_changed', aiResult.turnChanged);
                }

                // Check Game Over after AI turn
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
        } catch (err) {
            console.error("[AI_ERROR] Critical failure in AI turn logic:", err);
            // Emergency turn end
            const turnResult = GameLogic.endTurn(room);
            io.to(roomId).emit('turn_changed', turnResult);
        } finally {
            room.isThinking = false;
        }
    }
}

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
