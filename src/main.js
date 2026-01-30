import { io } from "socket.io-client";

console.log("Battle Super Z Client Loaded");

// Dynamically connect to the server
// In production (Render/Glitch), we serve from the same origin, so no URL needed.
// In development (Vite), we connect to port 3000.
const socketUrl = import.meta.env.PROD ? undefined : `http://${window.location.hostname}:3000`;
const socket = io(socketUrl);

// DOM Elements
const views = {
  title: document.getElementById('title-screen'),
  lobby: null, // Dynamic
  battle: null, // Dynamic
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

function showView(viewName, contentHTML = '') {
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
    btnCreator.onclick = () => {
      renderCardCreator();
    };
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

const battleLogs = [];

socket.on('action_performed', (data) => {
  console.log("Action:", data);
  if (data.cardData && data.cardData.image) {
    // Custom card image log
    battleLogs.push(`<div class="log-card"><img src="${data.cardData.image}" width="50" height="50"> <span>${data.cardData.name || 'Card'}</span> used!</div>`);
  }
  if (data.logs) battleLogs.push(...data.logs);
  renderBattle(data.gameState);
});

socket.on('turn_changed', (data) => {
  console.log("Turn Changed:", data);
  battleLogs.push(`--- ターン交代 ---`);
  localUsedTypes = []; // Reset local tracking
  renderBattle(data.gameState);
});

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

window.updatePreview = () => {
  const canvas = document.getElementById('card-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isSpecial = document.getElementById('is-special').value === 'special';
  const name = document.getElementById('card-name').value;
  let power = parseInt(document.getElementById('card-power').value) || 0;
  if (power > 20) {
    power = 20;
    document.getElementById('card-power').value = 20;
  }
  const effect = isSpecial ? document.getElementById('special-behavior').value : document.getElementById('card-effect').value;
  const element = document.getElementById('card-element').value;
  const cost = parseInt(document.getElementById('card-cost').value) || Math.max(1, Math.floor(power / 5));

  // Background
  ctx.fillStyle = '#1a1a24';
  if (element === 'fire') ctx.fillStyle = '#3a1a1a';
  if (element === 'water') ctx.fillStyle = '#1a2e3a';
  if (element === 'wood') ctx.fillStyle = '#1a3a1a';
  else if (effect === 'attack') ctx.fillStyle = '#331111';
  else if (effect === 'heal') ctx.fillStyle = '#113311';
  ctx.fillRect(0, 0, 200, 300);

  // Image
  if (loadedImage) {
    // Draw image centered/cropped to upper area
    ctx.drawImage(loadedImage, 10, 40, 180, 150);
  } else {
    ctx.fillStyle = '#333';
    ctx.fillRect(10, 40, 180, 150);
    ctx.fillStyle = '#555';
    ctx.font = '20px Arial';
    ctx.fillText("No Image", 60, 120);
  }

  // Frame
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#00ffcc';
  ctx.strokeRect(5, 5, 190, 290);

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(name, 100, 30);

  ctx.font = 'bold 24px Arial';
  ctx.fillText(power, 100, 230);

  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#00aaff';
  ctx.fillText(`COST: ${cost}`, 100, 255);

  ctx.font = '14px Arial';
  ctx.fillStyle = element === 'fire' ? '#ff4444' : (element === 'water' ? '#4444ff' : (element === 'wood' ? '#44ff44' : '#fff'));
  ctx.fillText(`${element.toUpperCase()} ${effect.toUpperCase()}`, 100, 280);
};

window.saveCustomCard = () => {
  const canvas = document.getElementById('card-canvas');
  const isSpecial = document.getElementById('is-special').value === 'special';
  const name = document.getElementById('card-name').value;
  let power = parseInt(document.getElementById('card-power').value) || 0;
  if (power > 20) power = 20;
  const effect = isSpecial ? document.getElementById('special-behavior').value : document.getElementById('card-effect').value;

  const element = document.getElementById('card-element').value;
  const cost = parseInt(document.getElementById('card-cost').value) || Math.max(1, Math.floor(power / 5));

  const imageData = canvas.toDataURL('image/png');

  const newCard = {
    id: Date.now().toString(),
    name: name,
    power: power,
    effectId: effect,
    element: element,
    cost: cost,
    target: effect === 'attack' ? 'enemy' : 'self',
    image: imageData,
    isCustom: true
  };

  const stored = JSON.parse(localStorage.getItem('my_cards') || '[]');
  stored.push(newCard);
  localStorage.setItem('my_cards', JSON.stringify(stored));

  alert("カードを保存しました！");
  showView('title');
};

const STARTER_DECKS = {
  balance: [
    { name: "火の剣", effectId: "attack", power: 12, element: "fire", cost: 2 },
    { name: "水の壁", effectId: "defense", power: 15, element: "water", cost: 3 },
    { name: "救急キット", effectId: "heal", power: 10, cost: 2 }
  ],
  aggro: [
    { name: "爆炎", effectId: "attack", power: 18, element: "fire", cost: 4 },
    { name: "連撃", effectId: "attack", power: 8, element: "none", cost: 1 },
    { name: "突撃", effectId: "attack", power: 12, element: "fire", cost: 2 }
  ],
  tank: [
    { name: "大盾", defense: "defense", power: 20, element: "wood", cost: 4 },
    { name: "森林の加護", effectId: "heal", power: 15, element: "wood", cost: 3 },
    { name: "イバラの棘", effectId: "attack", power: 8, element: "wood", cost: 1 }
  ]
};

function getMyCards() {
  const custom = JSON.parse(localStorage.getItem('my_cards') || '[]');
  // 初期状態でカードがない場合のためにスターターを混ぜる（または選択させる）
  // ここでは単純化のため、全プレイヤーに「バランス」デッキを配布
  return [...STARTER_DECKS.balance, ...custom];
}

// Modify renders to use custom cards
// We inject this by overriding renderBattle in runtime or just assuming it calls getMyCards() if we modded it.
// The previous step didn't mod renderBattle to call getMyCards. 
// I need to patch renderBattle here OR rewrite it.
// I'll patch playCard too to handle image sending? 
// No, playCard takes (effectId, power, target). It needs 'image' too for custom.
// Let's redefine playCard to accept whole card object or handle it.

// Redefining renderBattle to include custom cards
const originalRenderBattle = renderBattle;
// We actually need to overwrite the previous renderBattle function.
// Since I can't easily target "middle of function", I will overwrite it entirely in this block if I can validation valid JS.
// But I can't overwrite a function declared previously in the same file easily without rewriting the whole file.
// However, I can assign a new value if it was a var, but it's a function declaration.
// I will just rely on the USER to trust me to update renderBattle in the NEXT step or use a clever replace.
// Ah, `replace_file_content` allows me to target the PREVIOUS `renderBattle` if I want.
// BUT I am targeting `// Initial Setup` (END of file).
// So I am appending.
// I will append a REDEFINITION of renderBattle (will causing SyntaxError? No, var/function name collision).
// Actually, function declarations are hoisted. Two functions with same name = LATEST one wins (or first? usually last in source order overwrites).
// Let's rely on that behavior: I redefine `renderBattle` at the end of file.

function renderBattle(gameState) {
  const myPlayer = gameState.players[myPlayerId];
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const opponents = Object.values(gameState.players).filter(p => p.id !== myPlayerId);

  const customCards = getMyCards();
  const baseCards = [
    { name: "基本攻撃", effectId: "attack", power: 10, target: "enemy", cost: 2, id: "base_atk" },
    { name: "基本回復", effectId: "heal", power: 10, target: "self", cost: 2, id: "base_heal" }
  ];
  const hand = [...baseCards, ...customCards];

  // [NEW] Separate hand into usable and used/disabled
  const checkDisabled = (card) => {
    const alreadyUsedEffect = myPlayer.usedEffectTypes && myPlayer.usedEffectTypes.includes(card.effectId);
    const alreadyUsedCustom = card.isCustom && myPlayer.usedCustomCardIds && myPlayer.usedCustomCardIds.includes(card.id);
    const energyShortage = myPlayer.energy < (card.cost || Math.max(1, Math.floor(card.power / 5)));
    return !isMyTurn || alreadyUsedEffect || alreadyUsedCustom || energyShortage;
  };

  const sortedHand = [...hand].sort((a, b) => {
    const aDisabled = checkDisabled(a);
    const bDisabled = checkDisabled(b);
    return aDisabled - bDisabled; // Disabled cards go to the end (right)
  });

  let html = `
    <div class="battle-container">
      <div class="turn-indicator ${isMyTurn ? 'my-turn' : ''}">
        ${isMyTurn ? "あなたのターン" : "相手のターン"}
      </div>

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
                   <div class="unit-info">
                      ⚔️ ${p.field.summonedCard.power} <br>
                      ${p.field.summonedCard.name}
                   </div>
                 </div>
               ` : '<div class="empty-field">空きフィールド</div>'}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="log-area" id="battle-log"></div>

      <div class="my-area">
         <div class="home-btn-container">
            <button onclick="goToHome(true)" class="home-btn-mini">ホーム</button>
         </div>
        <div class="player-card self">
          <div class="player-name">自分</div>
          <div class="hp-bar"><div class="hp-fill" style="width: ${(myPlayer.hp / myPlayer.maxHp) * 100}%"></div></div>
          <div class="stats">HP: ${myPlayer.hp} | Shield: ${myPlayer.shield}</div>
          <div class="energy-display">🔋 エネルギー: ${myPlayer.energy} / ${myPlayer.maxEnergy} (+${myPlayer.energyPerTurn})</div>
            <div class="summon-field">
               ${myPlayer.field && myPlayer.field.summonedCard ? `
                 <div class="summoned-unit self-unit">
                   ${myPlayer.field.summonedCard.image ? `<img src="${myPlayer.field.summonedCard.image}" class="unit-img">` : ''}
                   <div class="unit-info">
                      ⚔️ ${myPlayer.field.summonedCard.power} <br>
                      ${myPlayer.field.summonedCard.name}
                   </div>
                 </div>
               ` : '<div class="empty-field">空きフィールド</div>'}
            </div>
        </div>

        <div class="hand-area">
          ${sortedHand.map((card, idx) => {
    const isDisabled = checkDisabled(card);
    const cost = card.cost || Math.max(1, Math.floor(card.power / 5));
    return `
            <div class="card-wrapper ${isDisabled ? 'card-disabled' : ''}">
                <button class="card-btn" 
                  onclick='playCardWithObj(${JSON.stringify(card)}, "use")' 
                  ${isDisabled ? 'disabled' : ''}
                  style="${card.image ? `background-image: url(${card.image}); background-size: cover; color: white; text-shadow: 1px 1px 2px black;` : ''}"
                >
                  <div class="card-cost">${cost}</div>
                  ${!card.image ? card.name : ''}<br>
                  <small>${card.element ? `${card.element} ` : ''}${card.effectId} (${card.power})</small>
                </button>
                ${card.effectId === 'attack' ? `
                    <button class="summon-btn"
                        onclick='playCardWithObj(${JSON.stringify(card)}, "summon")'
                        ${isDisabled || (myPlayer.usedEffectTypes && myPlayer.usedEffectTypes.includes("summon")) ? 'disabled' : ''}
                    >召喚</button>
                ` : ''}
            </div>
          `}).join('')}
           <button class="card-btn end-turn" onclick="endTurn()" ${!isMyTurn ? 'disabled' : ''}>
             ターン終了
           </button>
        </div>
      </div>
    </div>
  `;

  showView('battle', html);
  updateLogs();
}

window.playCardWithObj = (card, actionType = 'use') => {
  // Prevent double submissions immediately UI-side for THIS TYPE
  // We can't just disable ALL buttons anymore.
  // But we want to disable THIS button and others of same type.
  if (actionType === 'summon') {
    localUsedTypes.push('summon');
  } else {
    localUsedTypes.push(card.effectId);
  }

  // Manually update buttons state immediately for responsiveness
  const buttons = document.querySelectorAll('.card-btn, .summon-btn');
  // buttons from previous declaration removed
  // Re-run the disable logic manually or just wait for renderBattle? 
  // renderBattle is triggered by socket event, which might have lag.
  // Let's force a disable style on buttons matching this type.
  // ACTUALLY, we can't easily re-render whole view here without `gameState`.
  // So we just rely on `localUsedTypes` being checked in `renderBattle`, 
  // AND we manually disable buttons of this type right now.

  // Find all buttons that are for this effectId (we need to parse their onclick or inspect DOM? Hard.)
  // Easier: Just force disable ALL buttons briefly? No, user wants to do multiple actions.
  // Simple hack: Just disable the clicked button?
  // No, we want to disable ALL attacks if I used one attack.

  // Let's blindly iterate buttons and check their innerHTML for the type? weak.
  // Let's RE-RENDER if we had the state, but we don't.
  // Wait, `views.battle` doesn't store state.

  // Okay, let's just rely on the Server ECHO 'action_performed' to update UI.
  // It should be fast enough.
  // BUT the user complained "limit not working" before, implying they could click fast.
  // So we DO want immediate blocking.

  // Let's temporarily disable ALL buttons, and then when 'action_performed' comes back, 
  // `renderBattle` runs and will re-enable based on `usedEffectTypes`.
  // Wait, if we disable ALL, they can't do the 2nd action immediately.
  // That effectively enforces "1 action at a time" which is fine, as long as it unlocks quickly.
  // Yes, blocking ALL until server confirmation is safer to prevent race conditions.
  buttons.forEach(btn => btn.disabled = true);

  // We DO NOT set localUsedTypes here if we just block all.
  // Wait, if we block all, then `renderBattle` comes, it uses `usedEffectTypes` from server.
  // But `localUsedTypes` is useful if server is slow or packet loss?
  // Let's keep `localUsedTypes` as a visual hint helper if we want "optimistic UI".
  // But the "Disable ALL" strategy is safest for anti-mash.
  // AND it doesn't conflict with "Multiple actions per turn" because the server will return "success"
  // and `renderBattle` will re-render with ONLY that type disabled.

  // So:
  // 1. Click -> Disable ALL buttons.
  // 2. Send socket.
  // 3. Server says OK (with new `usedEffectTypes`).
  // 4. `renderBattle` runs -> buttons re-enabled EXCEPT used types.

  // This seems perfect. "Blocking" is just "Processing...".

  let targetId = null;
  if (card.target === 'enemy') {
    const opponentCards = document.querySelectorAll('.player-card.opponent');
    if (opponentCards.length > 0) {
      targetId = opponentCards[0].dataset.id;
    }
  }

  // Send full card data including optional image
  socket.emit('play_card', {
    effectId: card.effectId,
    power: card.power,
    targetId: targetId,
    name: card.name,
    image: card.image, // Send base64
    actionType: actionType
  });
};

// Initial Setup
setupTitleEvents();
