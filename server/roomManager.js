import GameLogic, { AI_PRESETS } from './gameLogic.js';

function generateRoomId() {
    // Generate 4-digit ID
    return Math.floor(1000 + Math.random() * 9000).toString();
}

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> Room Object
    }

    createRoom(hostId, playerName = '名無し') {
        let roomId = generateRoomId();
        while (this.rooms.has(roomId)) {
            roomId = generateRoomId();
        }

        const room = {
            id: roomId,
            players: [hostId],
            playerNames: { [hostId]: playerName },
            gameState: {
                status: 'waiting', // waiting, playing, finished
                turnIndex: 0,
                players: {} // playerId -> { hp, hand, etc }
            }
        };

        this.rooms.set(roomId, room);
        return roomId;
    }

    createSoloRoom(hostId, playerName = '名無し') {
        const roomId = this.createRoom(hostId, playerName);
        const room = this.rooms.get(roomId);
        room.isSolo = true;

        // Add AI Player
        const aiId = 'ai_player_' + Math.random().toString(36).substr(2, 5);
        room.players.push(aiId);
        room.playerNames[aiId] = 'AI (Super-Z)';
        if (!room.playerDeckSizes) room.playerDeckSizes = {};
        room.playerDeckSizes[aiId] = 15; // Standard deck size

        // [NEW] Generate Random AI Deck (Fisher-Yates Shuffle)
        const pool = [...AI_PRESETS];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        room.aiDeck = pool.slice(0, 15);
        console.log(`[AI] Generated random deck for ${aiId} in room ${roomId}`);

        return { roomId, aiId };
    }

    joinRoom(roomId, playerId, playerName = '名無し') {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };

        // [NEW] ID Takeover Logic for Reconnection (Only during active games)
        const isPlaying = room.gameState && room.gameState.status === 'playing';
        const existingPlayerId = Object.keys(room.playerNames).find(id => room.playerNames[id] === playerName);

        if (isPlaying && existingPlayerId && existingPlayerId !== playerId) {
            console.log(`[RECONNECT] Player ${playerName} taking over ID: ${existingPlayerId} -> ${playerId}`);

            // Update room.players list
            room.players = room.players.map(id => id === existingPlayerId ? playerId : id);

            // Update playerNames map
            delete room.playerNames[existingPlayerId];
            room.playerNames[playerId] = playerName;

            // Update deck size map if exists
            if (room.playerDeckSizes && room.playerDeckSizes[existingPlayerId]) {
                room.playerDeckSizes[playerId] = room.playerDeckSizes[existingPlayerId];
                delete room.playerDeckSizes[existingPlayerId];
            }

            // Update gameState if it exists
            if (room.gameState && room.gameState.players && room.gameState.players[existingPlayerId]) {
                const pData = room.gameState.players[existingPlayerId];
                pData.id = playerId;
                room.gameState.players[playerId] = pData;
                delete room.gameState.players[existingPlayerId];

                if (room.gameState.currentTurnPlayerId === existingPlayerId) {
                    room.gameState.currentTurnPlayerId = playerId;
                }
            }
            return { success: true, room };
        }

        if (room.players.length >= 4) return { error: 'Room full' }; // Max 4 for now

        if (!room.players.includes(playerId)) {
            room.players.push(playerId);
            room.playerNames[playerId] = playerName;
        }
        return { success: true, room };
    }

    getRoomIdAndState(playerId) {
        // [NEW] Search in reverse order to find the NEWEST room first
        const entries = Array.from(this.rooms.entries()).reverse();
        for (const [id, room] of entries) {
            if (room.players.includes(playerId)) {
                return { roomId: id, room };
            }
        }
        return null;
    }

    removePlayer(playerId) {
        const result = this.getRoomIdAndState(playerId);
        if (result) {
            const { roomId, room } = result;

            // [NEW] If game is in progress AND it's not a solo room, allow slot keeping.
            // In solo rooms, if the human host leaves, the room should die immediately.
            const isPlaying = room.gameState && room.gameState.status === 'playing';
            if (isPlaying && !room.isSolo) {
                console.log(`[DISCONNECT] Player ${playerId} disconnected during game. Keeping slot.`);
                return roomId;
            }

            // Remove player from list
            room.players = room.players.filter(id => id !== playerId);

            // Delete room if empty or if the host of a solo game left
            if (room.players.length === 0 || room.isSolo) {
                console.log(`[ROOM_DELETE] Deleting room ${roomId} (Reason: ${room.isSolo ? 'Solo host left' : 'Empty'})`);
                this.rooms.delete(roomId);
            }
            return roomId;
        }
        return null;
    }
}

export default new RoomManager();
