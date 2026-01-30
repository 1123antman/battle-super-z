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
                },
                usedCustomCardIds: [] // [NEW] Track custom cards used this game
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

        // [NEW] Check if this is a custom card and if it has been used before (1 per game)
        if (cardData.isCustom && actor.usedCustomCardIds.includes(cardData.id)) {
            return { error: 'This custom card can only be used once per game' };
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
                // [NEW] Handle Summoned Unit Mitigation for single attacks
                // Find primary opponent (for 1v1 prototype)
                const opponentId = Object.keys(state.players).find(id => id !== playerId);
                const opponent = state.players[opponentId];

                if (opponent && opponent.field && opponent.field.summonedCard) {
                    // Attack hits the summoned unit first
                    targets = [{ type: 'unit', ownerId: opponentId, unit: opponent.field.summonedCard }];
                } else if (opponent) {
                    targets = [opponent];
                }
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
            resultLog.push(`【召喚】${actor.id.slice(0, 4)} が ${actor.field.summonedCard.name} (ATK: ${actor.field.summonedCard.power}) を召喚！`);
            if (previouslySummoned) {
                resultLog.push(`(以前のカード ${previouslySummoned.name} は破壊されました)`);
            }
        } else {
            // Normal "Use" Logic
            switch (cardData.effectId) {
                case 'attack':
                    targets.forEach(target => {
                        let damage = parseInt(cardData.power) || 10;

                        // [NEW] Handle unit target
                        if (target.type === 'unit') {
                            const unit = target.unit;
                            const owner = state.players[target.ownerId];
                            resultLog.push(`【攻撃】${actor.id.slice(0, 4)} が ${owner.id.slice(0, 4)} の召喚ユニット「${unit.name}」を攻撃！`);
                            if (damage > unit.power) {
                                resultLog.push(`💥 威力 ${damage} > ユニット攻撃力 ${unit.power} により、${unit.name} は破壊された！`);
                                owner.field.summonedCard = null;
                            } else {
                                resultLog.push(`🛡️ ${unit.name} は攻撃を耐え抜いた。（威力不足）`);
                            }
                            return;
                        }

                        // Apply Shield mitigation
                        const originalDamage = damage;
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
                        resultLog.push(`【攻撃】${actor.id.slice(0, 4)} が ${target.id.slice(0, 4)} に威力 ${originalDamage} の攻撃！`);
                        if (originalDamage > damage) {
                            resultLog.push(`(シールドによりダメージが ${damage} に軽減された)`);
                        }
                        resultLog.push(`  → ${target.id.slice(0, 4)} の残りHP: ${target.hp}`);
                    });
                    break;

                case 'heal':
                    let heal = parseInt(cardData.power) || 10;
                    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
                    resultLog.push(`【回復】${actor.id.slice(0, 4)} が ${heal} HP 回復！ (現在HP: ${actor.hp})`);
                    break;

                case 'defense':
                    let shield = parseInt(cardData.power) || 10;
                    actor.shield += shield;
                    resultLog.push(`【防御】${actor.id.slice(0, 4)} がシールドを ${shield} 獲得！ (現在シールド: ${actor.shield})`);
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

        // [NEW] Track custom card usage
        if (cardData.isCustom) {
            actor.usedCustomCardIds.push(cardData.id);
        }

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
