import { io } from "socket.io-client";

console.log("Battle Super Z Client Loaded");

// Dynamically connect to the server
// In production (Render/Glitch), we serve from the same origin, so no URL needed.
// In development (Vite), we connect to port 3000.
const socketUrl = import.meta.env.PROD ? undefined : `http://${window.location.hostname}:3000`;
const socket = io(socketUrl);

// --- Stats Management ---
const saveWinLoss = (result) => {
  const stats = JSON.parse(localStorage.getItem('battle_stats') || '{"win":0, "loss":0}');
  if (result === 'win') stats.win++;
  if (result === 'loss') stats.loss++;
  localStorage.setItem('battle_stats', JSON.stringify(stats));
  console.log("Stats Updated:", stats);
};

// DOM Elements
const views = {
  title: document.getElementById('title-screen'),
  lobby: null,
  battle: null,
  banner: null // [NEW] Turn banner
};

// --- Sound System ---
const playSE = (type) => {
  // Placeholder for actual sound files
  console.log(`[SE] Playing: ${type}`);
  // const audio = new Audio(`/sounds/${type}.mp3`);
  // audio.play();
};

const app = document.getElementById('app');

// State
let currentRoomId = null;
let myPlayerId = null;
let localUsedTypes = []; // Client-side fallback: list of effectIds used this turn

// --- 画面遷移管理 ---

window.goToHome = (confirmRequired = false) => {
  if (confirmRequired && !confirm("タイトルに戻りますか？現在のゲーム（ルーム）から退出します。")) {
    return;
  }
  if (currentRoomId) {
    socket.emit('leave_room', currentRoomId);
  }
  currentRoomId = null;
  localUsedTypes = [];
  showView('title');
};

// --- View Management ---

window.showView = function (viewName, contentHTML = '') {
  app.innerHTML = '';
  if (viewName === 'title') {
    app.appendChild(views.title);
    setupTitleEvents(); // Re-attach listeners
  } else {
    const div = document.createElement('div');
    div.id = `${viewName}-screen`;
    div.innerHTML = contentHTML;
    app.appendChild(div);

    if (viewName === 'lobby') setupLobbyEvents();
    if (viewName === 'battle') setupBattleEvents();
  }
}

window.sendChat = (msg) => {
  socket.emit('chat_message', { roomId: currentRoomId, msg });
};

socket.on('chat_received', (data) => {
  battleLogs.push(`💬 ${data.playerId.slice(0, 4)}: ${data.msg}`);
  updateLogs();
});

// --- Title Screen Logic ---

function setupTitleEvents() {
  const btnCreate = document.getElementById('btn-create-room');
  const btnJoin = document.getElementById('btn-join-room');
  const inputRoom = document.getElementById('input-room-id');

  if (btnCreate) {
    btnCreate.onclick = () => {
      socket.emit('create_room', (response) => {
        if (response.roomId) {
          currentRoomId = response.roomId;
          console.log("Room Created:", currentRoomId);
          renderLobby(currentRoomId, 1);
        }
      });
    };
  }

  const btnCreator = document.getElementById('btn-card-creator');
  if (btnCreator) {
    btnCreator.onclick = () => renderCardCreator();
  }

  const btnDeckSelect = document.getElementById('btn-deck-select');
  if (btnDeckSelect) {
    btnDeckSelect.onclick = () => renderDeckSelection();
  }

  if (btnJoin) {
    btnJoin.onclick = () => {
      const roomId = inputRoom.value;
      if (!roomId) return alert("ルームIDを入力してください");
      socket.emit('join_room', roomId, (response) => {
        if (response.error) {
          alert("エラー: " + response.error);
        } else {
          currentRoomId = roomId;
          console.log("Joined Room:", currentRoomId);
          const playerCount = response.room.players.length;
          renderLobby(currentRoomId, playerCount);
        }
      });
    };
  }
}

// --- Lobby Logic ---

function renderLobby(roomId, playerCount) {
  const html = `
    <div class="center-box">
      <h2>ルーム ID: <span class="highlight">${roomId}</span></h2>
      <p>現在のプレイヤー: <span id="player-count">${playerCount}</span> / 4</p>
      <div class="lobby-status">
        <p>対戦相手を待っています...</p>
      </div>
      <button id="btn-start-game" ${playerCount < 2 ? 'disabled' : ''}>ゲーム開始</button>
      <button onclick="goToHome()" class="secondary" style="margin-top:10px;">タイトルに戻る</button>
    </div>
  `;
  showView('lobby', html);
}

function setupLobbyEvents() {
  const btnStart = document.getElementById('btn-start-game');
  if (btnStart) {
    btnStart.onclick = () => {
      socket.emit('start_game');
    };
  }
}

// --- Socket Events ---

socket.on('connect', () => {
  console.log("Connected to server:", socket.id);
  myPlayerId = socket.id;
});

socket.on('player_joined', (data) => {
  console.log("Player Joined:", data);
  const countSpan = document.getElementById('player-count');
  const btnStart = document.getElementById('btn-start-game');

  if (countSpan) countSpan.innerText = data.total;
  if (btnStart && data.total >= 2) btnStart.disabled = false;
});

socket.on('game_started', (gameState) => {
  console.log("Game Started!", gameState);
  renderBattle(gameState);
});

// --- Battle Logic ---

window.endTurn = () => {
  socket.emit('end_turn');
};

socket.on('game_over', (data) => {
  const isWinner = data.winnerId === myPlayerId;
  saveWinLoss(isWinner ? 'win' : 'loss');
  alert(isWinner ? "勝利しました！" : "敗北...");
  goToHome();
});

const battleLogs = [];

socket.on('action_performed', (data) => {
  console.log("Action:", data);

  // [NEW] Visual Feedback for impact
  if (data.logs && data.logs.length > 0) {
    const logsText = data.logs.join(' ');
    if (logsText.includes('攻撃') || logsText.includes('💥')) {
      triggerShake();
      playSE('attack');
    } else if (logsText.includes('回復')) {
      playSE('heal');
    } else if (logsText.includes('召喚')) {
      playSE('summon');
    }
  }

  if (data.cardData && data.cardData.image) {
    battleLogs.push(`<div class="log-card"><img src="${data.cardData.image}" width="50" height="50"> <span>${data.cardData.name || 'Card'}</span> used!</div>`);
  }
  if (data.logs) battleLogs.push(...data.logs);
  renderBattle(data.gameState);
});

function triggerShake() {
  const battle = document.querySelector('.battle-container');
  if (battle) {
    battle.classList.add('shake');
    setTimeout(() => battle.classList.remove('shake'), 500);
  }
}

socket.on('turn_changed', (data) => {
  console.log("Turn Changed:", data);
  battleLogs.push(`--- ターン交代 ---`);
  localUsedTypes = [];
  renderBattle(data.gameState);

  if (data.gameState.currentTurnPlayerId === myPlayerId) {
    showTurnBanner("自分のターン");
    playSE('turn_start');
  }
});

function showTurnBanner(text) {
  let banner = document.querySelector('.turn-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'turn-banner';
    document.body.appendChild(banner);
  }
  banner.innerText = text;
  banner.classList.remove('show');
  void banner.offsetWidth; // trigger reflow
  banner.classList.add('show');
}

socket.on('error_message', (msg) => {
  alert(msg);
  alert(msg);
  // localUsedTypes = []; // We might not want to reset ALL if partial fail, but simpler to reset on error or just trust user knows?
  // Actually, if error means "already used", we should KEEP it.
  // If error means "invalid target", we might want to allow retry.
  // For now, let's just reset the locked buttons so they can try again (or try another card).
  const buttons = document.querySelectorAll('.card-btn');
  buttons.forEach(btn => btn.disabled = false);

  // Ideally we remove the LAST attempted type from localUsedTypes if it failed.
  // But strictly, we don't know WHICH one failed here easily without tracking lastAction.
  // Let's just blindly re-enable UI. The server will reject invalid actions anyway.
  renderBattle(views.battle.lastGameState);
  // actually renderBattle triggers from action_performed usually. 
  // If error, we might be stuck. reload? 
  // Simple: just un-disable buttons manually or we need stored state.
  // For now, let's just reload the page or assume state is consistent.
  // Better: request state? or just accept that renderBattle usually has state.
  // Hack: The UI might be stuck disabled if we don't re-render.
  // Let's just reset allow user to try again by removing disabled attribute from buttons?
  const allButtons = document.querySelectorAll('.card-btn');
  allButtons.forEach(btn => btn.disabled = false);
});

function updateLogs() {
  const logDiv = document.getElementById('battle-log');
  if (logDiv) {
    logDiv.innerHTML = battleLogs.map(l => `<div>${l}</div>`).join('');
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}

// --- Card Creator Logic ---

function renderCardCreator() {
  const html = `
    <div class="creator-container">
      <h2>オリジナルカード作成</h2>
      <div class="creator-layout">
        <div class="form-area">
          <div class="input-group">
            <label>カード名</label>
            <input type="text" id="card-name" value="マイカード" oninput="updatePreview()">
          </div>
          <div class="input-group">
            <label>攻撃力 / 効果値 (最大 20)</label>
             <input type="number" id="card-power" value="10" max="20" min="1" oninput="updatePreview()">
          </div>
          <div class="input-group">
             <label>効果タイプ</label>
             <select id="card-effect" onchange="updatePreview()">
               <option value="attack">攻撃 (Attack)</option>
               <option value="heal">回復 (Heal)</option>
               <option value="defense">防御 (Defense)</option>
             </select>
          </div>
          <div id="special-sub-group" class="input-group" style="display:none;">
             <label>挙動タイプ</label>
             <select id="special-behavior" onchange="updatePreview()">
               <option value="attack">攻撃として扱う</option>
               <option value="heal">回復として扱う</option>
               <option value="defense">防御として扱う</option>
             </select>
          </div>
          <div class="input-group">
             <label>カード種別</label>
             <select id="is-special" onchange="toggleSpecialUI()">
               <option value="normal">通常カード</option>
               <option value="special">特殊カード</option>
             </select>
          </div>
          <div class="input-group">
             <label>属性 (エレメント)</label>
             <select id="card-element" onchange="updatePreview()">
               <option value="none">なし (None)</option>
               <option value="fire">火 (Fire)</option>
               <option value="water">水 (Water)</option>
               <option value="wood">木 (Wood)</option>
             </select>
          </div>
          <div class="input-group">
            <label>エネルギーコスト</label>
            <input type="number" id="card-cost" value="2" min="1" max="10" oninput="updatePreview()">
            <small>※未入力時はパワーに応じて自動計算されます</small>
          </div>
          <div class="input-group">
             <label>演出エフェクト</label>
             <select id="card-vfx" onchange="updatePreview()">
               <option value="default">標準</option>
               <option value="fire">爆炎</option>
               <option value="ice">氷結</option>
               <option value="thunder">雷撃</option>
             </select>
          </div>
          <div class="input-group">
             <label>フレームデザイン</label>
             <select id="card-frame" onchange="updatePreview()">
               <option value="neon">ネオン (標準)</option>
               <option value="gold">ゴールド (豪華)</option>
               <option value="dark">ダーク (漆黒)</option>
             </select>
          </div>
          <div class="input-group">
            <label>画像ファイル (正方形推奨)</label>
            <input type="file" id="card-image" accept="image/*" onchange="handleImageUpload(this)">
          </div>
          <button onclick="saveCustomCard()">保存して戻る</button>
          <button onclick="showView('title')" class="secondary">キャンセル</button>
        </div>
        <div class="preview-area">
          <canvas id="card-canvas" width="200" height="300"></canvas>
        </div>
      </div>
    </div>
  `;
  showView('creator', html);
  setTimeout(updatePreview, 100); // Wait for DOM
}

window.toggleSpecialUI = () => {
  const isSpecial = document.getElementById('is-special').value === 'special';
  document.getElementById('special-sub-group').style.display = isSpecial ? 'block' : 'none';
  document.getElementById('card-effect').parentElement.style.display = isSpecial ? 'none' : 'block';
  updatePreview();
};

let loadedImage = null;

window.handleImageUpload = (input) => {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        updatePreview();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

const STARTER_DECKS = {
  balance: [
    { id: 's1', name: "火の剣", effectId: "attack", power: 12, element: "fire", cost: 2 },
    { id: 's2', name: "水の壁", effectId: "defense", power: 15, element: "water", cost: 3 },
    { id: 's3', name: "救急キット", effectId: "heal", power: 10, cost: 2 }
  ],
  aggro: [
    { id: 's4', name: "爆炎", effectId: "attack", power: 18, element: "fire", cost: 4 },
    { id: 's5', name: "連撃", effectId: "attack", power: 8, element: "none", cost: 1 },
    { id: 's6', name: "突撃", effectId: "attack", power: 12, element: "fire", cost: 2 }
  ],
  tank: [
    { id: 's7', name: "大盾", element: "wood", effectId: "defense", power: 20, cost: 4 },
    { id: 's8', name: "森林の加護", effectId: "heal", power: 15, element: "wood", cost: 3 },
    { id: 's9', name: "イバラの棘", effectId: "attack", power: 8, element: "wood", cost: 1 }
  ]
};

function getMyCards() {
  const deckType = localStorage.getItem('selected_deck') || 'balance';
  const custom = JSON.parse(localStorage.getItem('my_cards') || '[]');
  if (deckType === 'custom') return custom.length > 0 ? custom : STARTER_DECKS.balance;
  return STARTER_DECKS[deckType] || STARTER_DECKS.balance;
}

window.renderDeckSelection = () => {
  const current = localStorage.getItem('selected_deck') || 'balance';
  const html = `
        <div class="deck-selection-container">
            <h2>デッキ選択</h2>
            <div class="deck-options">
                <div class="deck-option ${current === 'balance' ? 'selected' : ''}" onclick="selectDeck('balance')">
                    <h3>バランス型</h3><p>攻守のバランスが良いデッキ</p>
                </div>
                <div class="deck-option ${current === 'aggro' ? 'selected' : ''}" onclick="selectDeck('aggro')">
                    <h3>攻撃特化型</h3><p>高火力で攻めるデッキ</p>
                </div>
                <div class="deck-option ${current === 'tank' ? 'selected' : ''}" onclick="selectDeck('tank')">
                    <h3>防御・回復型</h3><p>粘り強く戦うデッキ</p>
                </div>
                <div class="deck-option ${current === 'custom' ? 'selected' : ''}" onclick="selectDeck('custom')">
                    <h3>カスタム</h3><p>全ての自作カードを使用</p>
                </div>
            </div>
            <button onclick="showView('title')" class="back-btn">タイトルに戻る</button>
        </div>
    `;
  showView('deck-selection', html);
};

window.selectDeck = (type) => {
  localStorage.setItem('selected_deck', type);
  renderDeckSelection();
};

window.updatePreview = () => {
  const canvas = document.getElementById('card-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isSpecial = document.getElementById('is-special').value === 'special';
  const nameInput = document.getElementById('card-name');
  const name = nameInput ? nameInput.value : "Card";
  const powerInput = document.getElementById('card-power');
  let power = powerInput ? (parseInt(powerInput.value) || 0) : 10;
  if (power > 20) { power = 20; if (powerInput) powerInput.value = 20; }

  const effect = isSpecial ? document.getElementById('special-behavior').value : document.getElementById('card-effect').value;
  const element = document.getElementById('card-element').value;
  const costInput = document.getElementById('card-cost');
  const cost = (costInput && costInput.value) ? parseInt(costInput.value) : Math.max(1, Math.floor(power / 5));
  const frame = document.getElementById('card-frame').value;
  const vfx = document.getElementById('card-vfx').value;

  // Background
  ctx.fillStyle = '#1a1a24';
  let bgApplied = false;
  if (element === 'fire') { ctx.fillStyle = '#3a1a1a'; bgApplied = true; }
  else if (element === 'water') { ctx.fillStyle = '#1a2e3a'; bgApplied = true; }
  else if (element === 'wood') { ctx.fillStyle = '#1a3a1a'; bgApplied = true; }

  if (!bgApplied) {
    if (effect === 'attack') ctx.fillStyle = '#331111';
    else if (effect === 'heal') ctx.fillStyle = '#113311';
    else if (effect === 'defense') ctx.fillStyle = '#111133';
  }
  ctx.fillRect(0, 0, 200, 300);

  // Image
  if (loadedImage) {
    ctx.drawImage(loadedImage, 10, 40, 180, 150);
  } else {
    ctx.fillStyle = '#333';
    ctx.fillRect(10, 40, 180, 150);
    ctx.fillStyle = '#555';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("No Image", 100, 120);
  }

  // Frame
  ctx.lineWidth = 6;
  if (frame === 'gold') ctx.strokeStyle = '#ffd700';
  else if (frame === 'dark') ctx.strokeStyle = '#444';
  else ctx.strokeStyle = '#00ffcc';
  ctx.strokeRect(5, 5, 190, 290);

  // Text
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(name, 100, 30);
  ctx.font = 'bold 24px Arial';
  ctx.fillText(power, 100, 230);
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#00aaff';
  ctx.fillText(`COST: ${cost}`, 100, 255);
  ctx.font = '12px Arial';
  ctx.fillStyle = element === 'fire' ? '#ff4444' : (element === 'water' ? '#4444ff' : (element === 'wood' ? '#44ff44' : '#fff'));
  ctx.fillText(`${element.toUpperCase()} ${effect.toUpperCase()}`, 100, 280);
};

window.saveCustomCard = () => {
  const canvas = document.getElementById('card-canvas');
  if (!canvas) return;
  const isSpecial = document.getElementById('is-special').value === 'special';
  const name = document.getElementById('card-name').value;
  let power = parseInt(document.getElementById('card-power').value) || 0;
  if (power > 20) power = 20;
  const effect = isSpecial ? document.getElementById('special-behavior').value : document.getElementById('card-effect').value;
  const element = document.getElementById('card-element').value;
  const cost = parseInt(document.getElementById('card-cost').value) || Math.max(1, Math.floor(power / 5));
  const frame = document.getElementById('card-frame').value;
  const vfx = document.getElementById('card-vfx').value;

  const newCard = {
    id: 'c' + Date.now(),
    name, power, effectId: effect, element, cost, frame, vfx,
    isCustom: true,
    image: canvas.toDataURL('image/png')
  };
  const stored = JSON.parse(localStorage.getItem('my_cards') || '[]');
  stored.push(newCard);
  localStorage.setItem('my_cards', JSON.stringify(stored));
  alert("カードを保存しました！");
  showView('title');
};


// --- Battle Rendering ---

function renderBattle(gameState) {
  const myPlayer = gameState.players[myPlayerId] || { hp: 0, energy: 0, shield: 0 };
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const opponents = Object.values(gameState.players).filter(p => p.id !== myPlayerId);

  const deckCards = getMyCards();
  const baseCards = [
    { id: 'base_atk', name: "基本攻撃", effectId: "attack", power: 10, target: "enemy", cost: 2 },
    { id: 'base_heal', name: "基本回復", effectId: "heal", power: 10, target: "self", cost: 2 }
  ];
  const hand = [...baseCards, ...deckCards];

  const checkDisabled = (card) => {
    const alreadyUsedType = myPlayer.usedEffectTypes && myPlayer.usedEffectTypes.includes(card.effectId);
    const alreadyUsedCustom = card.isCustom && myPlayer.usedCustomCardIds && myPlayer.usedCustomCardIds.includes(card.id);
    const cost = card.cost || Math.max(1, Math.floor(card.power / 5));
    return !isMyTurn || alreadyUsedType || alreadyUsedCustom || (myPlayer.energy < cost);
  };

  const sortedHand = [...hand]; //元の順序を維持

  const html = `
    <div class="battle-container">
      <div class="turn-indicator ${isMyTurn ? 'my-turn' : ''}">${isMyTurn ? "あなたのターン" : "相手のターン"}</div>
      <div class="opponents-row">
        ${opponents.map(p => `
          <div class="player-card opponent" data-id="${p.id}">
            <div class="player-name">プレイヤー ${p.id.slice(0, 4)}</div>
            <div class="hp-bar"><div class="hp-fill" style="width: ${(p.hp / p.maxHp) * 100}%"></div></div>
            <div class="stats">HP: ${p.hp} | Shield: ${p.shield}</div>
            <div class="summon-field">
               ${p.field && p.field.summonedCard ? `
                 <div class="summoned-unit">
                   ${p.field.summonedCard.image ? `<img src="${p.field.summonedCard.image}" class="unit-img">` : ''}
                   <div class="unit-info">⚔️ ${p.field.summonedCard.power} <br> ${p.field.summonedCard.name}</div>
                 </div>
               ` : '<div class="empty-field">空きフィールド</div>'}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="log-area" id="battle-log"></div>
      <div class="quick-chat">
         <button onclick="sendChat('よろしく！')">👋 よろしく！</button>
         <button onclick="sendChat('強い！')">🔥 強い！</button>
         <button onclick="sendChat('参りました')">🏳️ 参りました</button>
      </div>
      <div class="my-area">
        <div class="home-btn-container"><button onclick="goToHome(true)" class="home-btn-mini">ホーム</button></div>
        <div class="player-card self">
          <div class="player-name">自分</div>
          <div class="hp-bar"><div class="hp-fill" style="width: ${(myPlayer.hp / myPlayer.maxHp) * 100}%"></div></div>
          <div class="stats">HP: ${myPlayer.hp} | Shield: ${myPlayer.shield}</div>
          <div class="energy-display">🔋 エネルギー: ${myPlayer.energy} / ${myPlayer.maxEnergy || 10}</div>
          <div class="summon-field">
               ${myPlayer.field && myPlayer.field.summonedCard ? `
                 <div class="summoned-unit self-unit">
                   ${myPlayer.field.summonedCard.image ? `<img src="${myPlayer.field.summonedCard.image}" class="unit-img">` : ''}
                   <div class="unit-info">⚔️ ${myPlayer.field.summonedCard.power} <br> ${myPlayer.field.summonedCard.name}</div>
                 </div>
               ` : '<div class="empty-field">空きフィールド</div>'}
          </div>
        </div>
        <div class="hand-area">
          ${sortedHand.map(card => {
    const isDisabled = checkDisabled(card);
    const cost = card.cost || Math.max(1, Math.floor(card.power / 5));
    return `
            <div class="card-wrapper ${isDisabled ? 'card-disabled' : ''}">
                <button class="card-btn" onclick='playCardWithObj(${JSON.stringify(card)}, "use")' ${isDisabled ? 'disabled' : ''} style="${card.image ? `background-image: url(${card.image}); background-size: cover; color: white; text-shadow: 1px 1px 2px black;` : ''}">
                  <div class="card-cost">${cost}</div>
                  ${!card.image ? card.name : ''}<br>
                  <small>${card.element ? `${card.element} ` : ''}${card.effectId} (${card.power})</small>
                </button>
                ${card.effectId === 'attack' ? `<button class="summon-btn" onclick='playCardWithObj(${JSON.stringify(card)}, "summon")' ${isDisabled || (myPlayer.usedEffectTypes && myPlayer.usedEffectTypes.includes("summon")) ? 'disabled' : ''}>召喚</button>` : ''}
            </div>`;
  }).join('')}
          <button class="card-btn end-turn" onclick="endTurn()" ${!isMyTurn ? 'disabled' : ''}>ターン終了</button>
        </div>
      </div>
    </div>`;
  showView('battle', html);
  updateLogs();
}

window.playCardWithObj = (card, actionType = 'use') => {
  if (!currentRoomId) return;
  const buttons = document.querySelectorAll('.card-btn, .summon-btn');
  buttons.forEach(btn => btn.disabled = true);

  let targetId = null;
  const opponent = document.querySelector('.player-card.opponent');
  if (opponent) targetId = opponent.dataset.id;

  socket.emit('play_card', {
    roomId: currentRoomId,
    effectId: card.effectId,
    power: card.power,
    targetId: targetId,
    name: card.name,
    image: card.image,
    element: card.element || 'none',
    cost: card.cost || Math.max(1, Math.floor(card.power / 5)),
    isCustom: card.isCustom || false,
    id: card.id,
    actionType: actionType
  });
};

setupTitleEvents();
