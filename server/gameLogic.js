const AI_PRESETS = [
    // Fire
    { id: 'ap1', name: "獄炎剣", effectId: "attack", power: 14, element: "fire", cost: 3, skills: [] },
    { id: 'ap2', name: "大爆発", effectId: "attack", power: 18, element: "fire", cost: 4, skills: ['piercing'] },
    { id: 'ap3', name: "不浄の火", effectId: "attack", power: 12, element: "fire", cost: 3, skills: ['poison'] },
    { id: 'ap4', name: "火霊召喚", effectId: "attack", power: 10, element: "fire", cost: 2, actionType: 'summon', summonRole: 'attacker' },
    { id: 'ap21', name: "バーニング・レイ", effectId: "attack", power: 15, element: "fire", cost: 3, skills: ['vampire'] },
    { id: 'ap22', name: "マグマの壁", effectId: "defense", power: 18, element: "fire", cost: 3, actionType: 'use' },
    { id: 'ap23', name: "フレア・ドローン", effectId: "attack", power: 8, element: "fire", cost: 2, actionType: 'summon', summonRole: 'energy' },

    // Water
    { id: 'ap5', name: "波状攻撃", effectId: "attack", power: 12, element: "water", cost: 3, skills: ['twinStrike'] },
    { id: 'ap6', name: "絶対零度", effectId: "attack", power: 15, element: "water", cost: 4, skills: ['stun'] },
    { id: 'ap7', name: "治癒の水", effectId: "heal", power: 15, element: "water", cost: 4, skills: [] },
    { id: 'ap8', name: "水壁展開", effectId: "defense", power: 15, element: "water", cost: 3, actionType: 'use' },
    { id: 'ap9', name: "アクア・ガード", effectId: "attack", power: 10, element: "water", cost: 2, actionType: 'summon', summonRole: 'guardian' },
    { id: 'ap24', name: "氷の矢", effectId: "attack", power: 14, element: "water", cost: 3, skills: ['piercing'] },
    { id: 'ap25', name: "タイダル・ウェーブ", effectId: "attack", power: 20, element: "water", cost: 5, skills: ['stun'] },
    { id: 'ap26', name: "ミスト・ドローン", effectId: "attack", power: 8, element: "water", cost: 2, actionType: 'summon', summonRole: 'energy' },

    // Wood
    { id: 'ap10', name: "呪いの蔦", effectId: "attack", power: 10, element: "wood", cost: 2, skills: ['poison'] },
    { id: 'ap11', name: "深緑の盾", effectId: "defense", power: 20, element: "wood", cost: 4, skills: [] },
    { id: 'ap12', name: "生命の種", effectId: "heal", power: 12, element: "wood", cost: 3, skills: ['vampire'] },
    { id: 'ap13', name: "森の賢者", effectId: "attack", power: 8, element: "wood", cost: 2, actionType: 'summon', summonRole: 'energy' },
    { id: 'ap27', name: "茨の鎧", effectId: "defense", power: 14, element: "wood", cost: 2, skills: [] },
    { id: 'ap28', name: "リーフ・ストーム", effectId: "attack", power: 14, element: "wood", cost: 3, skills: ['twinStrike'] },
    { id: 'ap29', name: "古木の守護者", effectId: "attack", power: 12, element: "wood", cost: 3, actionType: 'summon', summonRole: 'guardian' },
    { id: 'ap30', name: "光合成", effectId: "energy_gain", power: 10, element: "wood", cost: 2, actionType: 'use' },

    // None / Special
    { id: 'ap14', name: "精密射撃", effectId: "attack", power: 12, element: "none", cost: 3, skills: ['piercing'] },
    { id: 'ap15', name: "神速の連打", effectId: "attack", power: 8, element: "none", cost: 2, skills: ['twinStrike'] },
    { id: 'ap16', name: "マナ・チャージ", effectId: "energy_gain", power: 10, element: "none", cost: 2, actionType: 'use' },
    { id: 'ap17', name: "虚空の剣", effectId: "attack", power: 16, element: "none", cost: 4, skills: ['piercing'] },
    { id: 'ap18', name: "オメガ・バースト", effectId: "attack", power: 20, element: "none", cost: 6, skills: ['twinStrike'] },
    { id: 'ap19', name: "リサイクル", effectId: "status_clear", power: 1, element: "none", cost: 1, actionType: 'use' },
    { id: 'ap20', name: "ドローン配置", effectId: "attack", power: 8, element: "none", cost: 2, actionType: 'summon', summonRole: 'energy' },
    { id: 'ap31', name: "加速装置", effectId: "energy_gain", power: 12, element: "none", cost: 3, actionType: 'use' },
    { id: 'ap32', name: "ポイズン・ダガー", effectId: "attack", power: 6, element: "none", cost: 1, skills: ['poison'] },
    { id: 'ap33', name: "ヘビー・シールド", effectId: "defense", power: 25, element: "none", cost: 5, actionType: 'use' },
    { id: 'ap34', name: "ガード・ビット", effectId: "attack", power: 10, element: "none", cost: 2, actionType: 'summon', summonRole: 'guardian' },
    { id: 'ap35', name: "スタン・バトン", effectId: "attack", power: 10, element: "none", cost: 3, skills: ['stun'] },
    { id: 'ap36', name: "ソニック・ブレード", effectId: "attack", power: 14, element: "none", cost: 3, skills: ['twinStrike'] },
    { id: 'ap37', name: "リペア・ナノ", effectId: "heal", power: 20, element: "none", cost: 5, actionType: 'use' },
    { id: 'ap38', name: "エネルギー・ドレイン", effectId: "attack", power: 12, element: "none", cost: 4, skills: ['vampire'] },
    { id: 'ap39', name: "ジャミ・ドローン", effectId: "attack", power: 8, element: "none", cost: 2, actionType: 'summon', summonRole: 'energy' },
    { id: 'ap40', name: "ラスト・リゾート", effectId: "attack", power: 25, element: "none", cost: 7, skills: ['piercing', 'twinStrike'] }
];

class GameLogic {
    initializeGame(room) {
        // [NEW] Thorough reset of gameState
        room.gameState = {
            status: 'playing',
            turnIndex: 0,
            players: {},
            currentTurnPlayerId: room.players[Math.floor(Math.random() * room.players.length)]
        };

        const state = room.gameState;

        // Initialize player stats
        room.players.forEach(playerId => {
            const isAI = playerId.startsWith('ai_player_');
            const deckSize = room.playerDeckSizes ? (room.playerDeckSizes[playerId] ?? 15) : 15;

            console.log(`[INIT] Initializing player ${playerId} (IsAI: ${isAI}, DeckSize: ${deckSize})`);

            state.players[playerId] = {
                id: playerId,
                playerName: room.playerNames ? room.playerNames[playerId] : (isAI ? 'AI' : '名無し'),
                hp: 100,
                maxHp: 100,
                shield: 0,
                energy: (room.isSolo && isAI) ? 5 : 3,
                maxEnergy: 10,
                energyPerTurn: (room.isSolo && isAI) ? 3 : 2,
                status: [],
                handSize: 5,
                usedEffectTypes: [],
                field: {
                    summonedCard: null
                },
                usedCardIds: [], // CRITICAL RESET
                usedBasicAction: false,
                deckSize: deckSize,
                passiveBonuses: { attack: 0, defense: 0 }
            };
        });

        return state;
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
            if (actor.usedCardIds && actor.usedCardIds.map(String).includes(String(cardData.id))) {
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

            // [NEW] Passive Bonus Calculation
            this.recalculatePassives(actor);
            if (actor.passiveBonuses.attack > 0 || actor.passiveBonuses.defense > 0) {
                resultLog.push(`✨ パッシブ効果発動！攻撃+${actor.passiveBonuses.attack} / 防御+${actor.passiveBonuses.defense}`);
            }
        } else {
            // Normal "Use" Logic
            switch (cardData.effectId) {
                case 'attack':
                    const processAttack = (actor, target, cardData) => {
                        let damage = (parseInt(cardData.power) || 10) + (actor.passiveBonuses?.attack || 0);
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
                    let shield = (parseInt(cardData.power) || 10) + (actor.passiveBonuses?.defense || 0);
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
            actor.usedCardIds.push(String(cardData.id));
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
                this.recalculatePassives(currentActor); // Recalculate on expiration
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

    recalculatePassives(player) {
        player.passiveBonuses = { attack: 0, defense: 0 };
        if (player.field && player.field.summonedCard) {
            const role = player.field.summonedCard.role;
            if (role === 'passive_atk') player.passiveBonuses.attack = 5;
            if (role === 'passive_def') player.passiveBonuses.defense = 5;
            // You can add more complex passive calculation here
        }
    }

    checkGameOver(state) {
        const players = Object.values(state.players);
        const loser = players.find(p => p.hp <= 0);
        if (loser) {
            const winner = players.find(p => p.id !== loser.id);
            state.status = 'finished'; // [NEW] Mark game as finished
            return {
                finished: true,
                winnerId: winner ? winner.id : null,
                winnerName: winner ? winner.playerName : '名無し'
            };
        }
        return { finished: false };
    }

    runAITurn(room, aiId) {
        const state = room.gameState;
        const ai = state.players[aiId];
        const actions = [];

        console.log(`[AI_LOG] Starting turn for ${aiId}. Energy: ${ai.energy}`);

        // AI's Deck: Use room-specific deck or fall back to presets
        let deckPool = room.aiDeck || AI_PRESETS;

        // Basics are always available (similar to player)
        const basics = [
            { id: 'base_attack', name: '基本攻撃', effectId: 'attack', power: 10, cost: 2, actionType: 'use' },
            { id: 'base_shield', name: 'シールド', effectId: 'defense', power: 10, cost: 2, actionType: 'use' },
            { id: 'base_heal', name: '基本回復', effectId: 'heal', power: 10, cost: 2, actionType: 'use' }
        ];

        let loopCount = 0;
        const pickedIdsInThisTurn = [];

        while (ai.energy >= 1 && loopCount < 5) {
            loopCount++;
            let chosen = null;

            // Helper to check if card has been used EITHER in previous turns or this turn
            const alreadyUsed = (cardId) => {
                const usedInPrevious = ai.usedCardIds.some(uid => uid === cardId || uid.startsWith(cardId + '_'));
                return usedInPrevious || pickedIdsInThisTurn.includes(cardId);
            };

            // --- Priority Logic ---

            // 1. Critical Heal
            if (ai.hp < 40 && !ai.usedBasicAction) {
                chosen = basics.find(i => i.effectId === 'heal' && ai.energy >= i.cost);
                if (!chosen) {
                    chosen = deckPool.find(i => i.effectId === 'heal' && ai.energy >= i.cost && !alreadyUsed(i.id));
                }
            }

            // 2. Summon Weighting (Don't always summon if field empty)
            if (!chosen && (!ai.field || !ai.field.summonedCard)) {
                const summonables = deckPool.filter(i => i.actionType === 'summon' && ai.energy >= i.cost && !alreadyUsed(i.id));
                if (summonables.length > 0) {
                    const opponentId = Object.keys(state.players).find(id => id !== aiId);
                    const hasStrongAttack = deckPool.some(i => i.effectId === 'attack' && i.power >= 15 && ai.energy >= i.cost && !alreadyUsed(i.id));

                    // 70% chance to summon if empty, but 30% chance to skip and go for direct attack if we have a strong one
                    if (!hasStrongAttack || Math.random() < 0.7) {
                        summonables.sort((a, b) => b.cost - a.cost);
                        chosen = summonables[0];
                    }
                }
            }

            // 3. High Damage / Special Skills
            if (!chosen) {
                const candidates = deckPool.filter(i => {
                    if (ai.energy < i.cost) return false;
                    if (alreadyUsed(i.id)) return false;
                    return true;
                });

                if (candidates.length > 0) {
                    // Sort by power and skill weight
                    candidates.sort((a, b) => {
                        const scoreA = (a.power || 0) + (a.skills?.length || 0) * 5;
                        const scoreB = (b.power || 0) + (b.skills?.length || 0) * 5;
                        return scoreB - scoreA;
                    });

                    // Add slight randomness to top 2 to avoid repetitiveness
                    const pool = candidates.slice(0, 2);
                    chosen = pool[Math.floor(Math.random() * pool.length)];
                }
            }

            // 4. Basic Actions as fallback
            if (!chosen && !ai.usedBasicAction) {
                const affordableBasics = basics.filter(i => ai.energy >= i.cost);
                if (affordableBasics.length > 0) {
                    if (ai.hp < 50) {
                        chosen = affordableBasics.find(i => i.effectId === 'defense') || affordableBasics.find(i => i.effectId === 'heal') || affordableBasics[0];
                    } else {
                        chosen = affordableBasics.find(i => i.effectId === 'attack') || affordableBasics[0];
                    }
                }
            }

            if (chosen) {
                console.log(`[AI_LOG] Selected: ${chosen.name} (Cost: ${chosen.cost}, ID: ${chosen.id})`);

                const cardToPlay = { ...chosen };
                if (!cardToPlay.id.startsWith('base_')) {
                    pickedIdsInThisTurn.push(chosen.id); // Local tracking for this loop
                    const uniqueId = cardToPlay.id + '_' + Date.now() + '_' + Math.random();
                    cardToPlay.id = uniqueId;
                }

                const result = this.processCard(room, aiId, cardToPlay);
                if (result.success) {
                    actions.push({
                        cardData: cardToPlay,
                        logs: result.logs,
                        gameState: result.gameState
                    });
                } else {
                    console.log(`[AI_LOG] Action failed: ${result.error}`);
                    break;
                }
            } else {
                console.log(`[AI_LOG] No affordable action found.`);
                break;
            }
        }

        // End AI Turn
        console.log(`[AI_LOG] Ending AI turn.`);
        const turnResult = this.endTurn(room);
        return {
            actions,
            turnChanged: turnResult
        };
    }
}

export { AI_PRESETS };
export default new GameLogic();
