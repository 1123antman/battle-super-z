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
        // Inefficient search, but fine for prototype
        for (const [id, room] of this.rooms) {
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
            // [NEW] If game is in progress, DON'T remove the player from the list.
            // This allows them to "Take over" their slot when they reconnect.
            if (room.gameState && room.gameState.status === 'playing') {
                console.log(`[DISCONNECT] Player ${playerId} disconnected during game. Keeping slot.`);
                return roomId;
            }

            room.players = room.players.filter(id => id !== playerId);
            if (room.players.length === 0) {
                this.rooms.delete(roomId);
            }
            return roomId;
        }
        return null;
    }
}

export default new RoomManager();
