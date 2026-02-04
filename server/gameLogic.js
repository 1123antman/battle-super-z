class GameLogic {
    initializeGame(room) {
        room.gameState.status = 'playing';
        room.gameState.turnIndex = 0;
        room.gameState.players = {};

        // Initialize player stats
        room.players.forEach(playerId => {
            room.gameState.players[playerId] = {
                id: playerId,
                playerName: room.playerNames ? room.playerNames[playerId] : '名無し',
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
                usedCardIds: [], // [NEW] Track used deck cards
                usedBasicAction: false, // [NEW] Track if basic action was used this turn
                deckSize: room.playerDeckSizes ? (room.playerDeckSizes[playerId] ?? 15) : 15
            };
        });


        // Randomize starting player
        room.gameState.currentTurnPlayerId = room.players[Math.floor(Math.random() * room.players.length)];

        return room.gameState;
    }

    processCard(room, playerId, cardData) {
        // cardData = { effectId, power, targetId (optional), id, cost, actionType }
        const state = room.gameState;
        const actor = state.players[playerId];

        if (state.currentTurnPlayerId !== playerId) {
            return { error: 'Not your turn (logic check)' };
        }

        // Check Stun
        const actorStatus = actor.status || [];
        if (actorStatus.some(s => s.id === 'stun')) {
            return { error: 'スタン状態のため行動できません' };
        }

        const isBasic = cardData.id && cardData.id.startsWith('base_');

        // Check energy cost
        const cost = cardData.cost || Math.max(1, Math.floor((parseInt(cardData.power) || 10) / 5));
        if (actor.energy < cost) {
            return { error: `エネルギーが不足しています (必要: ${cost}, 現在: ${actor.energy})` };
        }

        // [NEW] Check if this card has been used before (Only for Non-basic cards)
        if (!isBasic) {
            if (actor.usedCardIds && actor.usedCardIds.includes(cardData.id)) {
                return { error: 'このカードはこのバトルで既に使用されています' };
            }
        } else {
            // [NEW] Check basic action limit
            if (actor.usedBasicAction) {
                return { error: '基本行動（攻撃・シールド・回復）は1ターンに1回までです' };
            }
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

        // Mitigation check
        if (initialTarget && initialTarget.hp !== undefined && cardData.effectId === 'attack') {
            // If user explicitly targets a unit, attack that unit
            if (cardData.targetType === 'unit' && initialTarget.field && initialTarget.field.summonedCard) {
                targets = [{ type: 'unit', ownerId: initialTarget.id, unit: initialTarget.field.summonedCard }];
            }
            // Otherwise, if target has ANY summoned unit, it automatically intercepts
            else if (initialTarget.field && initialTarget.field.summonedCard) {
                targets = [{ type: 'unit', ownerId: initialTarget.id, unit: initialTarget.field.summonedCard }];
                resultLog.push(`🛡️ ${initialTarget.field.summonedCard.name} が攻撃を受け止めた！`);
            }
            // No unit, attack player directly
            else {
                targets = [initialTarget];
            }
        } else if (initialTarget) {
            targets = [initialTarget];
        } else if (cardData.effectId === 'heal' || cardData.effectId === 'defense') {
            targets = [actor];
        }

        const actorName = actor.playerName || actor.id.slice(0, 4);

        if (cardData.actionType === 'summon') {
            if (cardData.effectId !== 'attack' || cardData.isSpecial) {
                return { error: 'このカードは召喚できません' };
            }
            const previouslySummoned = actor.field.summonedCard;
            actor.field.summonedCard = {
                name: cardData.name || 'Summoned Unit',
                power: parseInt(cardData.power) || 0,
                image: cardData.image || null,
                effectId: cardData.effectId,
                role: cardData.summonRole || 'attacker'
            };
            const roleLabels = { attacker: 'アタッカー', guardian: 'ガーディアン', energy: 'エネルギー生産者' };
            resultLog.push(`【召喚】${actorName} が ${actor.field.summonedCard.name} (${roleLabels[actor.field.summonedCard.role] || 'ユニット'}) を召喚！`);
            if (previouslySummoned) {
                resultLog.push(`(以前のカード ${previouslySummoned.name} は破壊されました)`);
            }
        } else {
            // Normal "Use" Logic
            switch (cardData.effectId) {
                case 'attack':
                    const processAttack = (actor, target, cardData) => {
                        let damage = parseInt(cardData.power) || 10;
                        const skills = cardData.skills || [];
                        const targetName = target.playerName || (target.id ? target.id.slice(0, 4) : 'Unknown');

                        // 1. Affinity Calculation
                        let multiplier = 1.0;
                        const attackerEl = cardData.element;
                        const defenderEl = target.element || 'none';
                        if (attackerEl && defenderEl !== 'none') {
                            if ((attackerEl === 'fire' && defenderEl === 'wood') ||
                                (attackerEl === 'wood' && defenderEl === 'water') ||
                                (attackerEl === 'water' && defenderEl === 'fire')) {
                                multiplier = 1.5;
                                resultLog.push(`✨ 有効属性！威力 1.5 倍！`);
                            } else if ((attackerEl === 'fire' && defenderEl === 'water') ||
                                (attackerEl === 'wood' && defenderEl === 'fire') ||
                                (attackerEl === 'water' && defenderEl === 'wood')) {
                                multiplier = 0.5;
                                resultLog.push(`💦 不利属性... 威力 0.5 倍...`);
                            }
                        }
                        damage = Math.floor(damage * multiplier);

                        // 2. Piercing check (before shield)
                        const isPiercing = skills.includes('piercing');

                        // 3. Apply Damage
                        if (target.type === 'unit') {
                            const unit = target.unit;
                            const owner = state.players[target.ownerId];
                            const ownerName = owner.playerName || owner.id.slice(0, 4);
                            resultLog.push(`【攻撃】${actorName} が ${ownerName} の召喚ユニット「${unit.name}」を攻撃！`);

                            // [NEW] Counter-attack logic: Capture power BEFORE damage
                            const preAttackPower = unit.power;

                            unit.power -= damage;
                            if (unit.power <= 0) {
                                resultLog.push(`💥 威力 ${damage} により、${unit.name} は破壊された！`);
                                owner.field.summonedCard = null;
                            } else {
                                resultLog.push(`🛡️ ${unit.name} は耐えたが、残存威力は ${unit.power} に減少した。`);

                                // [DEBUG] Log unit role for debugging
                                console.log(`[COUNTER-ATTACK CHECK] Unit: ${unit.name}, Role: ${unit.role}, Power before attack: ${preAttackPower}`);

                                // Attacker units counter-attack when they survive
                                const role = (unit.role || 'attacker').toLowerCase(); // Default to attacker if undefined
                                console.log(`[COUNTER-ATTACK CHECK] Normalized role: ${role}`);

                                if (role === 'attacker') {
                                    const counterDamage = Math.max(0, preAttackPower);
                                    console.log(`[COUNTER-ATTACK] Triggering counter-attack with damage: ${counterDamage}`);

                                    // Target priority for counter-attack: Attacker's unit > Attacker player
                                    if (actor.field && actor.field.summonedCard) {
                                        const actorUnit = actor.field.summonedCard;
                                        actorUnit.power -= counterDamage;
                                        resultLog.push(`⚔️ ${unit.name} の反撃！ ${actorName} のユニット「${actorUnit.name}」に ${counterDamage} ダメージ！`);
                                        if (actorUnit.power <= 0) {
                                            resultLog.push(`💥 ${actorUnit.name} は反撃により破壊された！`);
                                            actor.field.summonedCard = null;
                                        }
                                    } else {
                                        actor.hp = Math.max(0, actor.hp - counterDamage);
                                        resultLog.push(`⚔️ ${unit.name} の反撃！ ${actorName} は ${counterDamage} ダメージ受けた。 (残りHP: ${actor.hp})`);
                                    }
                                } else {
                                    console.log(`[COUNTER-ATTACK] Skipped - unit role is not attacker`);
                                }
                            }
                            // Units don't receive status effects, but Vampire can still heal attacker?
                            // Let's allow Vampire when hitting unit
                        } else {
                            const originalDamage = damage;
                            if (!isPiercing && target.shield > 0) {
                                if (target.shield >= damage) {
                                    target.shield -= damage;
                                    damage = 0;
                                } else {
                                    damage -= target.shield;
                                    target.shield = 0;
                                }
                            } else if (isPiercing && target.shield > 0) {
                                resultLog.push(`🎯 貫通！シールドを無視して攻撃！`);
                            }

                            target.hp = Math.max(0, target.hp - damage);
                            resultLog.push(`【攻撃】${actorName} が ${targetName} に威力 ${originalDamage} の攻撃！`);
                            if (originalDamage > damage && !isPiercing) {
                                resultLog.push(`(シールドにより減少: ${originalDamage - damage})`);
                            }
                            resultLog.push(`  → ${targetName} の残りHP: ${target.hp}`);

                            // Apply Status Skills only to players
                            if (skills.includes('poison')) {
                                if (!target.status) target.status = [];
                                target.status.push({ id: 'poison', duration: 3 });
                                resultLog.push(`🤢 ${targetName} は毒になった！`);
                            }
                            if (skills.includes('stun')) {
                                if (!target.status) target.status = [];
                                target.status.push({ id: 'stun', duration: 1 });
                                resultLog.push(`😵 ${targetName} はスタンした！`);
                            }
                        }

                        // Vampire (trigger always if damage > 0, whether unit or player)
                        if (skills.includes('vampire') && damage > 0) {
                            const healAmt = Math.floor(damage / 2);
                            actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
                            resultLog.push(`🧛 吸血！${actorName} は ${healAmt} HP 回復！`);
                        }
                    };

                    console.log(`[SKILL_DEBUG] Processing attack with skills:`, cardData.skills);
                    targets.forEach(target => {
                        processAttack(actor, target, cardData);
                        // Skill: Twin Strike
                        if (cardData.skills && cardData.skills.includes('twinStrike')) {
                            console.log(`[SKILL_DEBUG] Twin Strike activated!`);
                            resultLog.push(`⚔️ 二連撃！`);
                            processAttack(actor, target, cardData);
                        }
                    });
                    break;

                case 'heal':
                    let heal = parseInt(cardData.power) || 10;
                    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
                    resultLog.push(`【回復】${actorName} が ${heal} HP 回復！ (現在HP: ${actor.hp})`);
                    break;

                case 'defense':
                    let shield = parseInt(cardData.power) || 10;
                    actor.shield += shield;
                    resultLog.push(`【防御】${actorName} がシールドを ${shield} 獲得！ (現在シールド: ${actor.shield})`);
                    break;
                case 'energy_gain':
                    let gain = Math.floor((parseInt(cardData.power) || 10) / 2);
                    actor.energy = Math.min(actor.maxEnergy, actor.energy + gain);
                    resultLog.push(`【チャージ】${actorName} がエネルギーを ${gain} 獲得！ (現在: ${actor.energy})`);
                    break;
                case 'status_clear':
                    actor.status = [];
                    resultLog.push(`【クリア】${actorName} の全ての状態異常が回復した！`);
                    break;
                case 'stun_only':
                    targets.forEach(target => {
                        if (!target.status) target.status = [];
                        target.status.push({ id: 'stun', duration: 1 });
                        const targetName = target.playerName || (target.id ? target.id.slice(0, 4) : 'Unknown');
                        resultLog.push(`【妨害】${targetName} はスタンした！`);
                    });
                    break;
                case 'poison_only':
                    targets.forEach(target => {
                        if (!target.status) target.status = [];
                        target.status.push({ id: 'poison', duration: 3 });
                        const targetName = target.playerName || (target.id ? target.id.slice(0, 4) : 'Unknown');
                        resultLog.push(`【毒】${targetName} は毒になった！`);
                    });
                    break;
            }
        }

        // Deduct energy
        actor.energy -= cost;

        // Track usage (Non-basic cards)
        if (!isBasic) {
            if (!actor.usedCardIds) actor.usedCardIds = [];
            actor.usedCardIds.push(cardData.id);
        } else {
            // [NEW] Track basic action usage
            actor.usedBasicAction = true;
        }

        return {
            success: true,
            gameState: state,
            logs: resultLog
        };
    }

    endTurn(room) {
        const state = room.gameState;
        const resultLogs = [];

        // Decay logic for the actor WHO JUST FINISHED their turn
        const currentActor = state.players[state.currentTurnPlayerId];
        if (currentActor && currentActor.field.summonedCard) {
            const unit = currentActor.field.summonedCard;
            unit.power -= 2;
            resultLogs.push(`⏳ ターン経過により ${unit.name} の威力が 2 減少。 (残り: ${unit.power})`);
            if (unit.power <= 0) {
                resultLogs.push(`💀 ${unit.name} は消滅した。`);
                currentActor.field.summonedCard = null;
            }
        }

        // Status Effects Processing (End of Actor's turn)
        if (currentActor && currentActor.status) {
            currentActor.status = currentActor.status.filter(s => {
                if (s.id === 'poison') {
                    const dmg = 3;
                    currentActor.hp = Math.max(0, currentActor.hp - dmg);
                    resultLogs.push(`🤮 毒のダメージ！ ${currentActor.playerName || currentActor.id.slice(0, 4)} は ${dmg} ダメージ受けた。 (残りHP: ${currentActor.hp})`);
                }

                s.duration--;
                if (s.duration <= 0) {
                    resultLogs.push(`✨ ${currentActor.playerName || currentActor.id.slice(0, 4)} の ${s.id} 状態が解除された。`);
                    return false;
                }
                return true;
            });
        }

        // Penalty for empty hand (exhausted deck cards) - Applied to ALL players at the end of every turn
        Object.values(state.players).forEach(player => {
            if (player.usedCardIds && player.usedCardIds.length >= player.deckSize) {
                player.hp = Math.max(0, player.hp - 5);
                resultLogs.push(`🥀 手札が枯渇しているため、${player.playerName || player.id.slice(0, 4)} のライフが 5 減少！ (残りHP: ${player.hp})`);
            }
        });

        const currentIndex = room.players.indexOf(state.currentTurnPlayerId);
        const nextIndex = (currentIndex + 1) % room.players.length;
        state.currentTurnPlayerId = room.players[nextIndex];

        if (state.players[state.currentTurnPlayerId]) {
            const nextActor = state.players[state.currentTurnPlayerId];
            // Recover energy
            let recovery = nextActor.energyPerTurn;
            if (nextActor.field.summonedCard && nextActor.field.summonedCard.role === 'energy') {
                recovery += 1;
                resultLogs.push(`🔋 ${nextActor.field.summonedCard.name} によりエネルギー充填！ (+1)`);
            }
            nextActor.energy = Math.min(nextActor.maxEnergy, nextActor.energy + recovery);
            // [NEW] Reset basic action flag for the next player
            nextActor.usedBasicAction = false;
        }

        return {
            nextPlayerId: state.currentTurnPlayerId,
            gameState: state,
            logs: resultLogs
        };
    }

    checkGameOver(state) {
        const players = Object.values(state.players);
        const loser = players.find(p => p.hp <= 0);
        if (loser) {
            const winner = players.find(p => p.id !== loser.id);
            return {
                finished: true,
                winnerId: winner ? winner.id : null
            };
        }
        return { finished: false };
    }
}

export default new GameLogic();
