class GameLogic {
    initializeGame(room) {
        room.gameState.status = 'playing';
        room.gameState.turnIndex = 0;
        room.gameState.players = {};

        // Initialize player stats
        room.players.forEach(playerId => {
            room.gameState.players[playerId] = {
                id: playerId,
                hp: 100,
                maxHp: 100,
                shield: 0,
                status: [], // poison, paralysis, etc.
                handSize: 5, // Logic for actual hand content depends on if server tracks cards
                // For this prototype, server tracks stats, client sends card data (verified by effectId)
                usedEffectTypes: [], // Track types of effects used this turn
                field: { // Summoned card area
                    summonedCard: null // Holds { name, power, image }
                }
            };
        });


        // Randomize starting player
        room.gameState.currentTurnPlayerId = room.players[Math.floor(Math.random() * room.players.length)];

        return room.gameState;
    }

    processCard(room, playerId, cardData) {
        // cardData = { effectId, power, targetId (optional) }
        const state = room.gameState;
        const actor = state.players[playerId];

        if (state.currentTurnPlayerId !== playerId) {
            return { error: 'Not your turn' };
        }

        // Check if this effect TYPE has already been used
        if (actor.usedEffectTypes && actor.usedEffectTypes.includes(cardData.effectId)) {
            return { error: `You have already used a ${cardData.effectId} card this turn` };
        }

        // Basic Effect Logic
        // In a full game, effectId would map to server-side logic.
        // For prototype, we interpret basic types.

        let resultLog = [];
        let targets = [];

        // Determine targets
        if (cardData.targetId) {
            targets = [state.players[cardData.targetId]];
        } else {
            // Default to all enemies or self depending on effect? 
            // For simplicity, let's assume client sends targetId for single target attacks.
            // If no targetId, might be self (heal) or global (AOE).
            if (cardData.effectId === 'heal' || cardData.effectId === 'defense') {
                targets = [actor];
            } else {
                // Pick a random enemy if not specified? Or error?
                // Let's assume client MUST specify target for attacks
            }
        }

        if (cardData.actionType === 'summon') {
            if (cardData.effectId !== 'attack') {
                return { error: 'Only Attack cards can be summoned' };
            }
            // Handle Summon Logic
            // Overwrite existing card? Yes, per plan.
            const previouslySummoned = actor.field.summonedCard;
            actor.field.summonedCard = {
                name: cardData.name || 'Summoned Unit',
                power: parseInt(cardData.power) || 0,
                image: cardData.image || null,
                effectId: cardData.effectId
            };
            resultLog.push(`${actor.id} summons ${actor.field.summonedCard.name} to the field!`);
            if (previouslySummoned) {
                resultLog.push(`(Replaced ${previouslySummoned.name})`);
            }
        } else {
            // Normal "Use" Logic
            switch (cardData.effectId) {
                case 'attack':
                    targets.forEach(target => {
                        let damage = parseInt(cardData.power) || 10;
                        // Apply Shield mitigation
                        if (target.shield > 0) {
                            if (target.shield >= damage) {
                                target.shield -= damage;
                                damage = 0;
                            } else {
                                damage -= target.shield;
                                target.shield = 0;
                            }
                        }
                        target.hp = Math.max(0, target.hp - damage);
                        resultLog.push(`${actor.id} deals ${damage} damage to ${target.id}`);
                    });
                    break;

                case 'heal':
                    let heal = parseInt(cardData.power) || 10;
                    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
                    resultLog.push(`${actor.id} heals ${heal} HP`);
                    break;

                case 'defense':
                    let shield = parseInt(cardData.power) || 10;
                    actor.shield += shield;
                    resultLog.push(`${actor.id} gains ${shield} Shield`);
                    break;

                // Add more effects here
                default:
                    resultLog.push(`Unknown effect ${cardData.effectId}`);
            }
        }

        // Track that this effect type has been used
        if (!actor.usedEffectTypes) actor.usedEffectTypes = [];
        const typeToTrack = (cardData.actionType === 'summon') ? 'summon' : cardData.effectId;
        actor.usedEffectTypes.push(typeToTrack);

        return {
            success: true,
            gameState: state,
            logs: resultLog
        };
    }

    endTurn(room) {
        const state = room.gameState;
        const currentIndex = room.players.indexOf(state.currentTurnPlayerId);
        const nextIndex = (currentIndex + 1) % room.players.length;
        state.currentTurnPlayerId = room.players[nextIndex];

        // Reset action tracking for the next player
        if (state.players[state.currentTurnPlayerId]) {
            state.players[state.currentTurnPlayerId].usedEffectTypes = [];
        }

        // Reset turn-based stats if needed (e.g. Shield might expire?)
        // For simplicity, keep shield until broken.

        return {
            nextPlayerId: state.currentTurnPlayerId,
            gameState: state
        };
    }
}

export default new GameLogic();
