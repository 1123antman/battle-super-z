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
                energy: 3, // [NEW] Current energy
                maxEnergy: 10, // [NEW] Max energy cap
                energyPerTurn: 2, // [NEW] Energy recovered each turn
                status: [], // poison, paralysis, etc.
                handSize: 5,
                usedEffectTypes: [],
                field: {
                    summonedCard: null
                },
                usedCustomCardIds: []
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

        // [NEW] Check energy cost (default cost is power / 5, min 1)
        const cost = Math.max(1, Math.floor((parseInt(cardData.power) || 10) / 5));
        if (actor.energy < cost) {
            return { error: `エネルギーが不足しています (必要: ${cost}, 現在: ${actor.energy})` };
        }

        // [NEW] Check if this is a custom card and if it has been used before (1 per game)
        if (cardData.isCustom && actor.usedCustomCardIds.includes(cardData.id)) {
            return { error: 'このカードはこのゲームで既に使用されています' };
        }

        // Basic Effect Logic
        let resultLog = [];
        let targets = [];

        // Determine initial target
        let initialTarget = null;
        if (cardData.targetId) {
            initialTarget = state.players[cardData.targetId];
        } else if (cardData.effectId !== 'heal' && cardData.effectId !== 'defense') {
            const opponentId = Object.keys(state.players).find(id => id !== playerId);
            initialTarget = state.players[opponentId];
        }

        // Mitigation check: if target is a player and has a unit, unit takes the hit
        if (initialTarget && initialTarget.hp !== undefined && cardData.effectId === 'attack') {
            if (initialTarget.field && initialTarget.field.summonedCard) {
                targets = [{ type: 'unit', ownerId: initialTarget.id, unit: initialTarget.field.summonedCard }];
            } else {
                targets = [initialTarget];
            }
        } else if (initialTarget) {
            targets = [initialTarget];
        } else if (cardData.effectId === 'heal' || cardData.effectId === 'defense') {
            targets = [actor];
        } else {
            targets = [];
        }

        if (cardData.actionType === 'summon') {
            if (cardData.effectId !== 'attack') {
                return { error: 'Only Attack cards can be summoned' };
            }
            // Handle Summon Logic
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

                default:
                    resultLog.push(`Unknown effect ${cardData.effectId}`);
            }
        }

        // Track that this effect type has been used
        if (!actor.usedEffectTypes) actor.usedEffectTypes = [];
        const typeToTrack = (cardData.actionType === 'summon') ? 'summon' : cardData.effectId;
        actor.usedEffectTypes.push(typeToTrack);

        // Deduct energy
        actor.energy -= cost;

        // Track custom card usage
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
            const nextActor = state.players[state.currentTurnPlayerId];
            nextActor.usedEffectTypes = [];
            // [NEW] Recover energy
            nextActor.energy = Math.min(nextActor.maxEnergy, nextActor.energy + nextActor.energyPerTurn);
        }

        return {
            nextPlayerId: state.currentTurnPlayerId,
            gameState: state
        };
    }
}

export default new GameLogic();
