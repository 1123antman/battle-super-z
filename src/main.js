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
};

function getPlayerName() {
  return localStorage.getItem('player_name') || '名無し';
}

function setPlayerName(name) {
  localStorage.setItem('player_name', name || '名無し');
}

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
let lastGameState = null; // [NEW] Track last known good state
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
  battleLogs.length = 0; // Clear logs when returning home
  showView('title');
};

// --- View Management ---

window.showView = function (viewName, contentHTML = '') {
  app.innerHTML = '';
  if (viewName === 'title') {
    app.appendChild(views.title);
    setupTitleEvents();
    const inputName = document.getElementById('input-player-name');
    if (inputName) inputName.value = getPlayerName();
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
  const name = data.playerName || data.playerId.slice(0, 4);
  battleLogs.push(`💬 <strong>${name}</strong>: ${data.msg}`);
  updateLogs();
});

// --- Title Screen Logic ---

function setupTitleEvents() {
  const btnCreate = document.getElementById('btn-create-room');
  const btnJoin = document.getElementById('btn-join-room');
  const inputRoom = document.getElementById('input-room-id');

  if (btnCreate) {
    btnCreate.onclick = () => {
      const playerName = getPlayerName();
      socket.emit('create_room', { playerName }, (response) => {
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
    btnDeckSelect.onclick = () => renderDeckEditor();
  }

  const inputName = document.getElementById('input-player-name');
  if (inputName) {
    inputName.onchange = (e) => setPlayerName(e.target.value);
  }

  if (btnJoin) {
    btnJoin.onclick = () => {
      const roomId = inputRoom.value;
      const playerName = getPlayerName();
      if (!roomId) return alert("ルームIDを入力してください");
      socket.emit('join_room', { roomId, playerName }, (response) => {
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
      <p>プレイヤー名: <span style="color:var(--primary-color)">${getPlayerName()}</span></p>
      <p>現在の人数: <span id="player-count">${playerCount}</span> / 4</p>
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
      socket.emit('start_game', { roomId: currentRoomId });
    };
  }
}

// --- Socket Events ---

socket.on('connect', () => {
  console.log("Connected to server:", socket.id);
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
  battleLogs.length = 0; // Reset logs for new game
  renderBattle(gameState);
});

function setupBattleEvents() {
  // Add battle-specific listeners here if needed in future
  console.log("Battle Events Setup");
}

// --- Battle Logic ---

window.endTurn = () => {
  if (!currentRoomId || isActing) return;
  isActing = true;
  // UI保護: 送信直後に全ボタンを無効化
  const buttons = document.querySelectorAll('.card-btn, .summon-btn');
  buttons.forEach(btn => btn.disabled = true);

  console.log(`[ACTION] End turn. Room: ${currentRoomId}. MyID: ${socket.id}`);
  socket.emit('end_turn', { roomId: currentRoomId });
};

socket.on('game_over', (data) => {
  const isWinner = data.winnerId === socket.id;
  saveWinLoss(isWinner ? 'win' : 'loss');
  alert(isWinner ? "勝利しました！" : "敗北...");
  battleLogs.length = 0; // Clear logs for next game
  goToHome();
});

const battleLogs = [];

socket.on('action_performed', (data) => {
  console.log("Action performed:", data);
  isActing = false;

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
  isActing = false;
  battleLogs.push(`--- ターン交代 ---`);
  if (data.logs) battleLogs.push(...data.logs); // Add decay logs etc.
  localUsedTypes = [];
  renderBattle(data.gameState);

  if (data.gameState.currentTurnPlayerId === socket.id) {
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
  console.warn("Server Error:", msg);
  isActing = false;
  alert("エラー: " + msg);
  const buttons = document.querySelectorAll('.card-btn, .summon-btn');
  buttons.forEach(btn => btn.disabled = false);

  // Re-render if we have a state
  if (lastGameState) renderBattle(lastGameState);
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

const ALL_PRESET_CARDS = [
  // Fire
  { id: 'p1', name: "火の剣", effectId: "attack", power: 12, element: "fire", cost: 2 },
  { id: 'p2', name: "爆炎烈破", effectId: "attack", power: 18, element: "fire", cost: 4 },
  { id: 'p3', name: "フレア・バースト", effectId: "attack", power: 15, element: "fire", cost: 3 },
  { id: 'p4', name: "プロミネンス", effectId: "attack", power: 20, element: "fire", cost: 5 },
  { id: 'p5', name: "焚き火", effectId: "heal", power: 8, element: "fire", cost: 2 },
  { id: 'p6', name: "火山弾", effectId: "attack", power: 14, element: "fire", cost: 3 },
  { id: 'p7', name: "ヒート・シールド", effectId: "defense", power: 12, element: "fire", cost: 2 },
  { id: 'p7_2', name: "イフリートの牙", effectId: "attack", power: 16, element: "fire", cost: 3 },

  // Water
  { id: 'p8', name: "水の壁", effectId: "defense", power: 15, element: "water", cost: 3 },
  { id: 'p9', name: "アクア・ヒール", effectId: "heal", power: 12, element: "water", cost: 2 },
  { id: 'p10', name: "激流", effectId: "attack", power: 14, element: "water", cost: 3 },
  { id: 'p11', name: "深海の囁き", effectId: "heal", power: 18, element: "water", cost: 4 },
  { id: 'p12', name: "氷結の波動", effectId: "attack", power: 10, element: "water", cost: 2 },
  { id: 'p13', name: "ミスト・スクリーン", effectId: "defense", power: 20, element: "water", cost: 4 },
  { id: 'p14', name: "バブル・ショット", effectId: "attack", power: 11, element: "water", cost: 2 },
  { id: 'p14_2', name: "海神の怒り", effectId: "attack", power: 19, element: "water", cost: 5 },

  // Wood
  { id: 'p15', name: "大盾", element: "wood", effectId: "defense", power: 20, cost: 4 },
  { id: 'p16', name: "森林の加護", effectId: "heal", power: 15, element: "wood", cost: 3 },
  { id: 'p17', name: "イバラの棘", effectId: "attack", power: 8, element: "wood", cost: 1 },
  { id: 'p18', name: "世界樹の種", effectId: "heal", power: 20, element: "wood", cost: 5 },
  { id: 'p19', name: "根の束縛", effectId: "defense", power: 10, element: "wood", cost: 2 },
  { id: 'p20', name: "木霊の舞", effectId: "attack", power: 12, element: "wood", cost: 2 },
  { id: 'p21', name: "リーフ・カッター", effectId: "attack", power: 13, element: "wood", cost: 2 },
  { id: 'p21_2', name: "精霊の息吹", effectId: "heal", power: 10, element: "wood", cost: 1 },

  // None
  { id: 'p22', name: "連撃", effectId: "attack", power: 8, element: "none", cost: 1 },
  { id: 'p23', name: "突撃", effectId: "attack", power: 12, element: "none", cost: 2 },
  { id: 'p24', name: "救急キット", effectId: "heal", power: 10, element: "none", cost: 2 }
];

function getMyCards() {
  const customDeck = JSON.parse(localStorage.getItem('my_custom_deck') || '[]');
  if (customDeck.length > 0) return customDeck;
  // デフォルトとして最初の10枚を返す
  return ALL_PRESET_CARDS.slice(0, 10);
}

function renderDeckEditor() {
  const myCards = JSON.parse(localStorage.getItem('my_cards') || '[]');
  const currentDeck = JSON.parse(localStorage.getItem('my_custom_deck') || '[]');
  const allAvailable = [...ALL_PRESET_CARDS, ...myCards];

  const html = `
    <div class="deck-editor-container">
      <h2>デッキ編成 (最大10枚)</h2>
      <p style="color: #aaa; margin-bottom: 20px;">デッキ内のカードは戦闘中に一度だけ使用可能です。<br>
      基本の「攻撃・シールド・回復」は何度でも使えます。</p>
      <div class="deck-editor-layout">
        <div class="available-cards card-list-section">
          <h3>所持カード</h3>
          <div class="card-grid">
            ${allAvailable.map(card => {
    const inDeck = currentDeck.some(c => c.id === card.id);
    return `
              <div class="editor-card ${inDeck ? 'card-selected' : ''}" onclick='${inDeck ? '' : `addToDeck(${JSON.stringify(card)})`}'>
                <div class="card-name">${card.name}</div>
                <div class="card-info">${card.element || 'none'} / ${card.effectId} (${card.power})</div>
                ${inDeck ? '<div class="card-tag">選択中</div>' : ''}
              </div>
            `}).join('')}
          </div>
        </div>
        <div class="current-deck card-list-section">
          <h3>現在のデッキ (<span id="deck-count">${currentDeck.length}</span> / 10)</h3>
          <div id="deck-grid" class="card-grid">
            ${currentDeck.map((card, idx) => `
              <div class="editor-card deck-card" onclick="removeFromDeck(${idx})">
                <div class="card-name">${card.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="editor-controls">
        <button onclick="saveDeck()">保存して戻る</button>
        <button onclick="showView('title')" class="secondary">キャンセル</button>
      </div>
    </div>
  `;
  showView('deck-editor', html);
}
window.renderDeckEditor = renderDeckEditor;

function addToDeck(card) {
  const deck = JSON.parse(localStorage.getItem('my_custom_deck') || '[]');
  if (deck.length >= 10) return alert("デッキは10枚までです");
  if (deck.some(c => c.id === card.id)) return alert("同じカードは1枚までです"); // Duplicate check
  deck.push(card);
  localStorage.setItem('my_custom_deck', JSON.stringify(deck));
  renderDeckEditor();
}
window.addToDeck = addToDeck;

function removeFromDeck(index) {
  const deck = JSON.parse(localStorage.getItem('my_custom_deck') || '[]');
  deck.splice(index, 1);
  localStorage.setItem('my_custom_deck', JSON.stringify(deck));
  renderDeckEditor();
}
window.removeFromDeck = removeFromDeck;

function saveDeck() {
  alert("デッキを保存しました");
  showView('title');
}
window.saveDeck = saveDeck;

function selectDeck(type) {
  // 後方互換性のため残すが、実質的には不要
  localStorage.setItem('selected_deck', type);
}
window.selectDeck = selectDeck;

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
  lastGameState = gameState; // Store updated state
  const myId = socket.id;
  console.log(`[RENDER] MyID: ${myId}, Turn: ${gameState.currentTurnPlayerId}`);

  const myPlayer = gameState.players[myId] || { hp: 0, energy: 0, shield: 0 };
  const isMyTurn = gameState.currentTurnPlayerId === myId;
  const opponents = Object.values(gameState.players).filter(p => p.id !== myId);

  const deckCards = getMyCards();
  const baseCards = [
    { id: 'base_atk', name: "基本攻撃", effectId: "attack", power: 10, target: "enemy", cost: 2 },
    { id: 'base_def', name: "基本シールド", effectId: "defense", power: 10, target: "self", cost: 2 },
    { id: 'base_heal', name: "基本回復", effectId: "heal", power: 10, target: "self", cost: 2 }
  ];
  const hand = [...baseCards, ...deckCards];

  const checkDisabled = (card) => {
    // 基本カード (base_) は何度でも使える
    if (card.id.startsWith('base_')) {
      return !isMyTurn || (myPlayer.energy < card.cost);
    }

    // デッキ内のカードは一度使うとバトル終了まで使えない (usedCardIds に含まれる場合)
    const alreadyUsed = myPlayer.usedCardIds && myPlayer.usedCardIds.includes(card.id);
    const cost = card.cost || Math.max(1, Math.floor(card.power / 5));
    return !isMyTurn || alreadyUsed || (myPlayer.energy < cost);
  };

  const sortedHand = [...hand];

  const html = `
    <div class="battle-container">
      <div class="turn-indicator ${isMyTurn ? 'my-turn' : ''}">${isMyTurn ? "あなたのターン" : "相手のターン"}</div>
      
      <div class="opponents-row">
        ${opponents.map(p => `
          <div class="player-card opponent" data-id="${p.id}">
            <div class="player-name">${p.playerName || `プレイヤー ${p.id.slice(0, 4)}`}</div>
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

      <div class="center-battle-ui">
        <div class="log-area" id="battle-log"></div>
        <div class="quick-chat">
           <button onclick="sendChat('よろしく！')">👋 よろしく！</button>
           <button onclick="sendChat('強い！')">🔥 強い！</button>
           <button onclick="sendChat('参りました')">🏳️ 参りました</button>
        </div>
      </div>

      <div class="my-area">
        <div class="player-card self">
          <div class="player-name">${myPlayer.playerName || "自分"}</div>
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
    const isBasic = card.id.startsWith('base_');
    return `
            <div class="card-wrapper ${isDisabled ? 'card-disabled' : ''}">
                <button class="card-btn" onclick='playCardWithObj(${JSON.stringify(card)}, "use")' ${isDisabled ? 'disabled' : ''} style="${card.image ? `background-image: url(${card.image}); background-size: cover; color: white; text-shadow: 1px 1px 2px black;` : ''}">
                  <div class="card-cost">${cost}</div>
                  ${!card.image ? card.name : ''}<br>
                  <small>${card.element && card.element !== 'none' ? `${card.element} ` : ''}${card.effectId} (${card.power})</small>
                </button>
                ${(card.effectId === 'attack' && !isBasic) ? `<button class="summon-btn" onclick='playCardWithObj(${JSON.stringify(card)}, "summon")' ${isDisabled || (myPlayer.usedEffectTypes && myPlayer.usedEffectTypes.includes("summon")) ? 'disabled' : ''}>召喚</button>` : ''}
            </div>`;
  }).join('')}
          <div class="card-wrapper">
            <button class="card-btn end-turn" onclick="endTurn()" ${!isMyTurn ? 'disabled' : ''}>ターン終了</button>
            <button onclick="goToHome(true)" class="home-btn-mini" style="margin-top:5px;">ホーム</button>
          </div>
        </div>
      </div>
    </div>`;
  showView('battle', html);
  updateLogs();
}

let isActing = false; // [NEW] Flag to prevent double-click / simultaneous sends

window.playCardWithObj = (card, actionType = 'use') => {
  if (!currentRoomId || isActing) return;

  isActing = true;
  const buttons = document.querySelectorAll('.card-btn, .summon-btn');
  buttons.forEach(btn => btn.disabled = true);

  let targetId = null;
  const opponent = document.querySelector('.player-card.opponent');
  if (opponent) targetId = opponent.dataset.id;

  console.log(`[ACTION] Playing card ${card.id} (${actionType}) to room ${currentRoomId}. MyID: ${socket.id}`);

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

  // isActing is reset in action_performed or error_message
};

setupTitleEvents();
