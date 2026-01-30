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
