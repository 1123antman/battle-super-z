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
    socket.emit('leave_room', { roomId: currentRoomId });
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
  const btnRules = document.getElementById('btn-rules');
  const inputRoom = document.getElementById('input-room-id');
  const btnCreator = document.getElementById('btn-card-creator');
  const btnDeckEditor = document.getElementById('btn-deck-select');
  const btnGallery = document.getElementById('btn-gallery');

  if (btnCreate) {
    btnCreate.onclick = () => {
      const playerName = getPlayerName();
      const myCards = getMyCards();
      socket.emit('create_room', { playerName, deckSize: myCards.length }, (response) => {
        if (response.roomId) {
          currentRoomId = response.roomId;
          console.log("Room Created:", currentRoomId);
          renderLobby(currentRoomId, 1);
        }
      });
    };
  }

  if (btnRules) {
    btnRules.onclick = () => renderRules();
  }

  if (btnCreator) {
    btnCreator.onclick = () => renderCardCreator();
  }

  if (btnDeckEditor) {
    btnDeckEditor.onclick = () => renderDeckEditor();
  }

  if (btnGallery) {
    btnGallery.onclick = () => renderGallery();
  }

  const inputName = document.getElementById('input-player-name');
  if (inputName) {
    inputName.onchange = (e) => setPlayerName(e.target.value);
  }

  if (btnJoin) {
    btnJoin.onclick = () => {
      const roomId = inputRoom.value;
      const playerName = getPlayerName();
      const myCards = getMyCards();
      if (!roomId) return alert("ルームIDを入力してください");
      socket.emit('join_room', { roomId, playerName, deckSize: myCards.length }, (response) => {
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

window.renderRules = () => {
  const html = `
    <div class="rules-container">
      <h1>BATTLE SUPER Z ルール説明</h1>
      
      <section>
        <h2>1. デッキ編成のルール</h2>
        <ul>
          <li>デッキは<span class="highlight">最大15枚</span>のカードで構成されます。</li>
          <li>カードの<span class="highlight">合計コストは50以下</span>である必要があります。</li>
          <li>同じカード（IDが同じもの）はデッキに<span class="highlight">1枚</span>しか入れられません。</li>
          <li>基本アクション（攻撃・シールド・回復）はデッキに関わらず常に使用可能です。</li>
        </ul>
      </section>

      <section>
        <h2>2. オリジナルカード作成</h2>
        <ul>
          <li>攻撃力または効果値が<span class="danger">10以上</span>のカードを作る場合、コストは<span class="danger">5以上</span>に設定する必要があります。</li>
          <li>強力なカードには相応のエネルギー消費が求められます。</li>
        </ul>
      </section>

      <section>
        <h2>3. 召喚ユニットの仕様</h2>
        <ul>
          <li>攻撃カードを「召喚」としてプレイすると、場にユニットを配置できます。</li>
          <li><span class="highlight">削りダメージ</span>: ユニットを攻撃した際、一撃で倒せなくても、攻撃力の分だけユニットの威力を減少させられます。</li>
          <li><span class="highlight">自然減衰</span>: 召喚ユニットは持ち主のターンが終わるたびに、威力が<span class="danger">2減少</span>します。威力が0になると消滅します。</li>
        </ul>
      </section>

      <section>
        <h2>4. ペナルティと勝利条件</h2>
        <ul>
          <li>相手のHPを<span class="highlight">0</span>にすれば勝利です。</li>
          <li><span class="danger">手札枯渇ペナルティ</span>: デッキに入れた使い切りカードをすべて使い切ったプレイヤーは、毎ターン終了時に<span class="danger">5 HP</span>のダメージを受けます。</li>
        </ul>
      </section>

      <div style="margin-top: 30px; text-align: center;">
        <button class="menu-btn" onclick="goToHome()">タイトルに戻る</button>
      </div>
    </div>
  `;
  showView('rules', html);
};

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
  // Total Reset for New Game
  battleLogs.length = 0;
  localUsedTypes = [];
  lastGameState = null;
  isActing = false;

  window.safeRenderBattle(gameState);
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

  // [NEW] Fail-safe: Enable UI after 5 seconds if no response
  setTimeout(() => {
    if (isActing) {
      console.warn("[FAIL-SAFE] endTurn timeout. Resetting isActing.");
      isActing = false;
      const buttons = document.querySelectorAll('.card-btn, .summon-btn');
      buttons.forEach(btn => btn.disabled = false);
    }
  }, 5000);
};

socket.on('game_over', (data) => {
  const isWinner = data.winnerId === socket.id;
  const resultText = isWinner ? '【勝利】対戦に勝利しました！' : '【敗北】対戦に敗北しました...';
  battleLogs.push(`<div class="log-entry ${isWinner ? 'log-important' : 'log-danger'}" style="text-align:center; font-weight:bold; font-size:1.2rem; border:none; margin:10px 0">${resultText}</div>`);
  updateLogs();
  saveWinLoss(isWinner ? 'win' : 'loss');
  showGameOver(isWinner ? 'win' : 'lose');
});

function showGameOver(result) {
  const overlay = document.createElement('div');
  overlay.className = `game-over-overlay result-${result}`;
  overlay.innerHTML = `
    <div class="game-over-title">${result === 'win' ? 'VICTORY' : 'DEFEAT'}</div>
    <div class="game-over-subtitle">自動的にホームへ戻ります...</div>
  `;
  document.body.appendChild(overlay);

  // Auto home after 4 seconds
  setTimeout(() => {
    overlay.remove();
    battleLogs.length = 0;
    goToHome();
  }, 4000);
}

const battleLogs = [];

socket.on('action_performed', (data) => {
  console.log("Action performed:", data);
  isActing = false;

  // New visual feedback
  if (data.logs && data.logs.length > 0) {
    const logsText = data.logs.join(' ');
    const isAttack = logsText.includes('攻撃') || logsText.includes('💥') || logsText.includes('✨ 有効属性') || logsText.includes('💦 不利属性');

    if (isAttack) {
      triggerShake();
      const element = data.cardData.element || 'fire';
      // Find target DOM element (simplified: apply to all opponents or the one with specific ID if we had it)
      // For now, let's just trigger a global VFX or target-specific if we find it
      document.querySelectorAll('.player-card.opponent').forEach(el => {
        triggerVFX(element, el);
      });
      playSE('attack');
    } else if (logsText.includes('回復')) {
      playSE('heal');
    } else if (logsText.includes('召喚')) {
      playSE('summon');
    }
  }

  if (data.cardData) {
    let img = data.cardData.image;
    // [NEW] Recover image from local storage if it's a custom card and image is missing
    if (!img && data.cardData.isCustom) {
      const localCard = getCardById(data.cardData.id);
      if (localCard) img = localCard.image;
    }

    if (img) {
      battleLogs.push(`<div class="log-card"><img src="${img}" width="50" height="50"> <span>${data.cardData.name || 'Card'}</span> used!</div>`);
    } else {
      battleLogs.push(`<div class="log-entry">🃏 <span>${data.cardData.name || 'Card'}</span> used!</div>`);
    }
  }
  if (data.logs) {
    console.log('[LOG_DEBUG] Received logs:', data.logs);
    data.logs.forEach(log => {
      let cls = '';
      if (log.includes('有効属性') || log.includes('吸血') || log.includes('貫通') || log.includes('二連撃')) cls = 'log-important';
      if (log.includes('不利属性') || log.includes('ライフが 5 減少') || log.includes('毒のダメージ')) cls = 'log-danger';
      console.log('[LOG_DEBUG] Adding log:', log, 'with class:', cls);
      battleLogs.push(`<div class="log-entry ${cls}">${log}</div>`);
    });
    console.log('[LOG_DEBUG] Total battleLogs count:', battleLogs.length);
  }
  window.safeRenderBattle(data.gameState);
});

function triggerVFX(type, targetEl) {
  if (!targetEl) return;
  const vfx = document.createElement('div');
  vfx.className = `vfx-layer vfx-${type}`;
  targetEl.appendChild(vfx);
  setTimeout(() => vfx.remove(), 600);
}

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
  window.safeRenderBattle(data.gameState);

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
    // Keep only the last 20 logs for mobile performance
    const displayLogs = battleLogs.slice(-20);
    logDiv.innerHTML = displayLogs.map(l => `<div>${l}</div>`).join('');
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
               <option value="energy_gain">エネルギー獲得</option>
               <option value="status_clear">状態異常回復</option>
               <option value="stun_only">スタン付与</option>
               <option value="poison_only">毒付与</option>
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
             <label>フレーバーテキスト (説明文)</label>
             <input type="text" id="card-flavor" placeholder="伝説の始まり..." maxlength="40" oninput="updatePreview()">
          </div>
          <div class="input-group" style="align-items:flex-start">
             <label>スキル追加 (1つまで)</label>
             <div class="skill-selector">
                <input type="checkbox" id="skill-vampire" class="skill-checkbox" onchange="limitSkill(this); updatePreview()">
                <label for="skill-vampire" class="skill-label">🧛 吸血</label>
                
                <input type="checkbox" id="skill-piercing" class="skill-checkbox" onchange="limitSkill(this); updatePreview()">
                <label for="skill-piercing" class="skill-label">🎯 貫通</label>
                
                <input type="checkbox" id="skill-poison" class="skill-checkbox" onchange="limitSkill(this); updatePreview()">
                <label for="skill-poison" class="skill-label">🤢 毒付与</label>
                
                <input type="checkbox" id="skill-stun" class="skill-checkbox" onchange="limitSkill(this); updatePreview()">
                <label for="skill-stun" class="skill-label">😵 スタン付与</label>
                
                <input type="checkbox" id="skill-twin" class="skill-checkbox" onchange="limitSkill(this); updatePreview()">
                <label for="skill-twin" class="skill-label">⚔️ 二連撃</label>
             </div>
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
             <label>召喚時の役割 (召喚ユニット時)</label>
             <select id="summon-role" onchange="updatePreview()">
               <option value="attacker">アタッカー (標準・攻撃力重視)</option>
               <option value="guardian">ガーディアン (身代わり・防御重視)</option>
               <option value="energy">エネルギー供給 (毎ターン +1 エネルギー)</option>
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
          
          <hr style="margin: 30px 0; border: 1px solid rgba(255,255,255,0.1);">
          <h3 style="margin-bottom: 15px;">作成済みカード</h3>
          <div id="custom-cards-list" style="max-height: 300px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
          </div>
        </div>
        <div class="preview-area">
          <canvas id="card-canvas" width="200" height="300"></canvas>
        </div>
      </div>
    </div>
  `;
  showView('creator', html);
  renderCustomCardsList();

  // High-res setup: Internal resolution is 3x, Display size is the same
  const canvas = document.getElementById('card-canvas');
  if (canvas) {
    canvas.width = 600;
    canvas.height = 900;
    canvas.style.width = "200px";
    canvas.style.height = "300px";
  }

  setTimeout(updatePreview, 100); // Wait for DOM
}

window.renderCustomCardsList = () => {
  const myCards = JSON.parse(localStorage.getItem('my_cards') || '[]');
  const container = document.getElementById('custom-cards-list');
  if (!container) return;

  if (myCards.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center;">まだカードを作成していません</p>';
    return;
  }

  container.innerHTML = myCards.map((card, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.05); margin-bottom: 8px; border-radius: 6px;">
      <div>
        <strong>${card.name}</strong>
        <span style="color: #888; margin-left: 10px;">${card.effectId === 'attack' ? '⚔️' : card.effectId === 'heal' ? '❤️' : '🛡️'} ${card.power}</span>
        ${(card.skills && card.skills.length > 0) ? `<span style="color: var(--accent-color); margin-left: 10px;">${card.skills.join(', ')}</span>` : ''}
      </div>
      <button onclick="deleteCustomCard(${idx})" class="secondary" style="padding: 5px 15px; font-size: 0.8rem;">削除</button>
    </div>
  `).join('');
};

window.deleteCustomCard = (index) => {
  const myCards = JSON.parse(localStorage.getItem('my_cards') || '[]');
  const card = myCards[index];
  if (confirm(`「${card.name}」を削除しますか？この操作は取り消せません。`)) {
    myCards.splice(index, 1);
    localStorage.setItem('my_cards', JSON.stringify(myCards));
    renderCustomCardsList();
    alert('カードを削除しました');
  }
};

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
  // Fire - Aggressive with damage-focused skills
  { id: 'p1', name: "火の剣", effectId: "attack", power: 12, element: "fire", cost: 2, skills: [] },
  { id: 'p2', name: "爆炎烈破", effectId: "attack", power: 18, element: "fire", cost: 4, skills: ['piercing'] },
  { id: 'p3', name: "フレア・バースト", effectId: "attack", power: 15, element: "fire", cost: 3, skills: ['twinStrike'] },
  { id: 'p4', name: "プロミネンス", effectId: "attack", power: 20, element: "fire", cost: 5, skills: ['piercing'] },
  { id: 'p5', name: "焚き火", effectId: "heal", power: 8, element: "fire", cost: 2, skills: [] },
  { id: 'p6', name: "火山弾", effectId: "attack", power: 14, element: "fire", cost: 3, skills: [] },
  { id: 'p7', name: "ヒート・シールド", effectId: "defense", power: 12, element: "fire", cost: 2, skills: [] },
  { id: 'p7_2', name: "イフリートの牙", effectId: "attack", power: 16, element: "fire", cost: 3, skills: ['vampire'] },

  // Water - Control and debuff focused
  { id: 'p8', name: "水の壁", effectId: "defense", power: 15, element: "water", cost: 3, skills: [] },
  { id: 'p9', name: "アクア・ヒール", effectId: "heal", power: 12, element: "water", cost: 2, skills: [] },
  { id: 'p10', name: "激流", effectId: "attack", power: 14, element: "water", cost: 3, skills: ['stun'] },
  { id: 'p11', name: "深海の囁き", effectId: "heal", power: 18, element: "water", cost: 4, skills: [] },
  { id: 'p12', name: "氷結の波動", effectId: "attack", power: 10, element: "water", cost: 2, skills: [] },
  { id: 'p13', name: "ミスト・スクリーン", effectId: "defense", power: 20, element: "water", cost: 4, skills: [] },
  { id: 'p14', name: "バブル・ショット", effectId: "attack", power: 11, element: "water", cost: 2, skills: [] },
  { id: 'p14_2', name: "海神の怒り", effectId: "attack", power: 19, element: "water", cost: 5, skills: ['poison'] },

  // Wood - Sustain and poison focused
  { id: 'p15', name: "大盾", element: "wood", effectId: "defense", power: 20, cost: 4, skills: [] },
  { id: 'p16', name: "森林の加護", effectId: "heal", power: 15, element: "wood", cost: 3, skills: [] },
  { id: 'p17', name: "イバラの棘", effectId: "attack", power: 8, element: "wood", cost: 1, skills: ['poison'] },
  { id: 'p18', name: "世界樹の種", effectId: "heal", power: 20, element: "wood", cost: 5, skills: [] },
  { id: 'p19', name: "根の束縛", effectId: "defense", power: 10, element: "wood", cost: 2, skills: [] },
  { id: 'p20', name: "木霊の舞", effectId: "attack", power: 12, element: "wood", cost: 2, skills: [] },
  { id: 'p21', name: "リーフ・カッター", effectId: "attack", power: 13, element: "wood", cost: 2, skills: ['vampire'] },
  { id: 'p21_2', name: "精霊の息吹", effectId: "heal", power: 10, element: "wood", cost: 1, skills: [] },

  // None - Versatile with mixed skills
  { id: 'p22', name: "連撃", effectId: "attack", power: 8, element: "none", cost: 1, skills: ['twinStrike'] },
  { id: 'p23', name: "突撃", effectId: "attack", power: 12, element: "none", cost: 2, skills: [] },
  { id: 'p24', name: "救急キット", effectId: "heal", power: 10, element: "none", cost: 2, skills: [] }
];

// --- Card Management ---

window.getCardById = (id) => {
  const baseCards = [
    { id: 'base_atk', name: "基本攻撃", effectId: "attack", power: 10, target: "enemy", cost: 2 },
    { id: 'base_def', name: "基本シールド", effectId: "defense", power: 10, target: "self", cost: 2 },
    { id: 'base_heal', name: "基本回復", effectId: "heal", power: 10, target: "self", cost: 2 }
  ];
  const myCards = JSON.parse(localStorage.getItem('my_cards') || '[]');
  const all = [...baseCards, ...ALL_PRESET_CARDS, ...myCards];
  return all.find(c => String(c.id) === String(id));
};

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
      <h2>デッキ編成</h2>
      <p style="color: #aaa; margin-bottom: 20px;">制約: 最大15枚 かつ 合計コスト50以下<br>
      基本の「攻撃・シールド・回復」は何度でも使えます。</p>
      <div class="deck-editor-layout">
        <div class="available-cards card-list-section">
          <h3>所持カード</h3>
          <div class="card-grid">
            ${allAvailable.map(card => {
    const inDeck = currentDeck.some(c => c.id === card.id);
    return `
      <div class="card-btn glass ${inDeck ? 'card-selected' : ''}" onclick="${inDeck ? '' : `addToDeck('${card.id}')`}">
        <div class="card-cost">${card.cost || Math.max(1, Math.floor(card.power / 5))}</div>
        ${card.image ? `<img src="${card.image}">` : ''}
        <div class="card-name-label">${card.name}</div>
        <div class="card-power-label">${card.power}</div>
        <div class="skill-tags-mini">
           ${(card.skills || []).map(sk => `<div class="card-skill-tag">${sk}</div>`).join('')}
        </div>
        ${inDeck ? '<div class="card-tag">選択中</div>' : ''}
      </div>
    `;
  }).join('')}
          </div>
        </div>
        <div class="current-deck card-list-section">
          <h3>現在のデッキ (<span id="deck-count">${currentDeck.length}</span> / 15)</h3>
          <p>合計：<span id="deck-total-cost" style="color: ${currentDeck.reduce((sum, c) => sum + (c.cost || 0), 0) > 50 ? '#ff3333' : '#33ff33'}">${currentDeck.reduce((sum, c) => sum + (c.cost || 0), 0)}</span> / 50</p>
          <div id="deck-grid" class="card-grid">
            ${currentDeck.map((card, idx) => `
              <div class="editor-card" onclick="removeFromDeck(${idx})">
                <div style="font-size:0.8rem; font-weight:bold">${card.name}</div>
                <div style="font-size:0.7rem; color:#aaa">Cost: ${card.cost}</div>
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

function addToDeck(cardId) {
  const card = getCardById(cardId);
  if (!card) return;
  const deck = JSON.parse(localStorage.getItem('my_custom_deck') || '[]');
  const cardCost = card.cost || Math.max(1, Math.floor((card.power || 0) / 5));
  const currentTotalCost = deck.reduce((sum, c) => sum + (c.cost || 0), 0);

  if (deck.length >= 15) return alert("デッキは15枚までです");
  if (currentTotalCost + cardCost > 50) return alert("合計コストが50を超えてしまいます");
  if (deck.some(c => c.id === card.id)) return alert("同じカードは1枚までです");

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
  const effect = isSpecial ? document.getElementById('special-behavior').value : document.getElementById('card-effect').value;

  const powerInput = document.getElementById('card-power');
  const needsPower = ['attack', 'heal', 'defense'].includes(effect);

  if (!needsPower) {
    if (effect === 'energy_gain') {
      if (powerInput) powerInput.value = 5;
    } else {
      if (powerInput) powerInput.value = 1;
    }
    if (powerInput) powerInput.disabled = true;
  } else {
    if (powerInput) powerInput.disabled = false;
  }

  let power = powerInput ? (parseInt(powerInput.value) || 0) : 10;
  if (power > 20) { power = 20; if (powerInput) powerInput.value = 20; }

  const element = document.getElementById('card-element').value;
  const costInput = document.getElementById('card-cost');
  const cost = (costInput && costInput.value) ? parseInt(costInput.value) : Math.max(1, Math.floor(power / 5));
  const frame = document.getElementById('card-frame').value;
  const vfx = document.getElementById('card-vfx').value;

  // Scale everything by 3x for high quality (internal is 600x900)
  const scale = 3;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background (Fallback dark color)
  ctx.fillStyle = '#1a1a24';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Full-card Image logic
  if (loadedImage) {
    const targetRatio = canvas.width / canvas.height;
    const imgRatio = loadedImage.width / loadedImage.height;

    let sX, sY, sW, sH;
    if (imgRatio > targetRatio) {
      sH = loadedImage.height;
      sW = sH * targetRatio;
      sX = (loadedImage.width - sW) / 2;
      sY = 0;
    } else {
      sW = loadedImage.width;
      sH = sW / targetRatio;
      sX = 0;
      sY = (loadedImage.height - sH) / 2;
    }
    ctx.drawImage(loadedImage, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
  }

  // UI Overlays for Readability
  // Top overlay for name
  const topGrad = ctx.createLinearGradient(0, 0, 0, 50 * scale);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, canvas.width, 60 * scale);

  // Bottom overlay for stats
  const botGrad = ctx.createLinearGradient(0, canvas.height - 120 * scale, 0, canvas.height);
  botGrad.addColorStop(0, 'rgba(0,0,0,0)');
  botGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, canvas.height - 120 * scale, canvas.width, 120 * scale);

  // Frame
  ctx.lineWidth = 6 * scale;
  if (frame === 'gold') ctx.strokeStyle = '#ffd700';
  else if (frame === 'dark') ctx.strokeStyle = '#444';
  else ctx.strokeStyle = '#00ffcc';
  ctx.strokeRect(5 * scale, 5 * scale, 190 * scale, 290 * scale);

  // Text (Japanese localized) with shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4 * scale;
  ctx.shadowOffsetX = 2 * scale;
  ctx.shadowOffsetY = 2 * scale;

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `bold ${18 * scale}px Arial`;
  ctx.fillText(name, 100 * scale, 35 * scale);

  ctx.font = `bold ${32 * scale}px Arial`;
  ctx.fillText(power, 100 * scale, 230 * scale);

  ctx.font = `bold ${16 * scale}px Arial`;
  ctx.fillStyle = '#00aaff';
  ctx.fillText(`コスト: ${cost}`, 100 * scale, 255 * scale);

  ctx.font = `bold ${12 * scale}px Arial`;
  ctx.fillStyle = element === 'fire' ? '#ff4444' : (element === 'water' ? '#4444ff' : (element === 'wood' ? '#44ff44' : '#fff'));

  const elementJP = { fire: '火', water: '水', wood: '木', none: '無' }[element] || '無';
  const effectJP = { attack: '攻撃', heal: '回復', defense: '防御', energy_gain: 'エネ獲得', status_clear: '状態浄化', stun_only: 'スタン付与', poison_only: '毒付与' }[effect] || effect;
  ctx.fillText(`${elementJP}属性 / ${effectJP}`, 100 * scale, 270 * scale);

  // Flavor Text
  const flavor = document.getElementById('card-flavor')?.value || '';
  if (flavor) {
    ctx.font = `italic ${10 * scale}px Arial`;
    ctx.fillStyle = '#ccc';
    ctx.fillText(flavor.substring(0, 20), 100 * scale, 195 * scale);
    if (flavor.length > 20) {
      ctx.fillText(flavor.substring(20, 40), 100 * scale, 207 * scale);
    }
  }

  // Shadows off for skills/role icons
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Preview Role
  const role = document.getElementById('summon-role')?.value || 'attacker';
  const roleMap = { attacker: '🗡️ アタッカー', guardian: '🛡️ ガーディアン', energy: '🔋 エネ供給' };
  ctx.font = `bold ${12 * scale}px Arial`;
  ctx.fillStyle = '#ffea00';
  ctx.fillText(roleMap[role], 100 * scale, 285 * scale);

  // Preview Skills
  const skills = [];
  if (document.getElementById('skill-vampire')?.checked) skills.push('吸血');
  if (document.getElementById('skill-piercing')?.checked) skills.push('貫通');
  if (document.getElementById('skill-poison')?.checked) skills.push('毒付与');
  if (document.getElementById('skill-stun')?.checked) skills.push('スタン付与');
  if (document.getElementById('skill-twin')?.checked) skills.push('二連撃');

  if (skills.length > 0) {
    ctx.font = `${10 * scale}px Arial`;
    ctx.fillStyle = '#aaa';
    ctx.fillText(skills.join(' / '), 100 * scale, 292 * scale);
  }
};

window.limitSkill = (clicked) => {
  if (!clicked.checked) return;
  const checkboxes = document.querySelectorAll('.skill-checkbox');
  checkboxes.forEach(cb => {
    if (cb !== clicked) cb.checked = false;
  });
};

window.saveCustomCard = () => {
  const canvas = document.getElementById('card-canvas');
  if (!canvas) return;
  const isSpecial = document.getElementById('is-special').value === 'special';
  const name = document.getElementById('card-name').value;
  const effect = isSpecial ? document.getElementById('special-behavior').value : document.getElementById('card-effect').value;
  let power = parseInt(document.getElementById('card-power').value) || 0;

  if (effect === 'energy_gain') power = 5;
  else if (!['attack', 'heal', 'defense'].includes(effect)) power = 1;

  if (power > 20) power = 20;
  const element = document.getElementById('card-element').value;
  const costInput = document.getElementById('card-cost');
  let cost = parseInt(costInput.value) || Math.max(1, Math.floor(power / 5));

  // Power 10+ requires Cost 5+
  if (power >= 10 && cost < 5) {
    alert("攻撃力/効果値が10以上のカードは、コストを5以上に設定する必要があります");
    if (costInput) costInput.value = 5;
    return;
  }

  const frame = document.getElementById('card-frame').value;
  const vfx = document.getElementById('card-vfx').value;

  const skills = [];
  if (document.getElementById('skill-vampire')?.checked) skills.push('vampire');
  if (document.getElementById('skill-piercing')?.checked) skills.push('piercing');
  if (document.getElementById('skill-poison')?.checked) skills.push('poison');
  if (document.getElementById('skill-stun')?.checked) skills.push('stun');
  if (document.getElementById('skill-twin')?.checked) skills.push('twinStrike');

  const newCard = {
    id: 'c' + Date.now(),
    name, power, effectId: effect, element, cost, frame, vfx,
    skills,
    flavor: document.getElementById('card-flavor')?.value || "",
    isSpecial: isSpecial,
    summonRole: document.getElementById('summon-role').value,
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
          <div class="player-card opponent glass" data-id="${p.id}">
            <div class="player-name">
              ${p.element && p.element !== 'none' ? `<span class="element-icon el-${p.element}"></span>` : ''}
              ${p.playerName || `プレイヤー ${p.id.slice(0, 4)}`}
            </div>
            <div class="hp-bar"><div class="hp-fill" style="width: ${(p.hp / p.maxHp) * 100}%"></div></div>
            <div class="status-area">
               ${(p.status || []).map(s => `<div class="status-icon status-${s.id}" data-duration="${s.duration}">${s.id === 'poison' ? '🤢' : '😵'}</div>`).join('')}
            </div>
            <div class="stats">HP: ${p.hp} | Shield: ${p.shield}</div>
            <div class="summon-field">
                 ${p.field && p.field.summonedCard ? `
                   <div class="summoned-unit opponent-unit role-${p.field.summonedCard.role}" onclick="event.stopPropagation(); window.lastTargetId='${p.id}'; window.lastTargetType='unit'; playCardWithObjID_UNIT_CLICK()">
                     ${p.field.summonedCard.image ? `<img src="${p.field.summonedCard.image}" class="unit-img">` : ''}
                     <div class="unit-info">
                       ${p.field.summonedCard.role === 'guardian' ? '🛡️' : (p.field.summonedCard.role === 'energy' ? '🔋' : '⚔️')}
                       ${p.field.summonedCard.power} | ${p.field.summonedCard.name}
                     </div>
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
        <div class="player-card self glass">
          <div class="player-name">${myPlayer.playerName || "自分"}</div>
          <div class="hp-bar"><div class="hp-fill" style="width: ${(myPlayer.hp / myPlayer.maxHp) * 100}%"></div></div>
          <div class="status-area">
             ${(myPlayer.status || []).map(s => `<div class="status-icon status-${s.id}" data-duration="${s.duration}">${s.id === 'poison' ? '🤢' : '😵'}</div>`).join('')}
          </div>
          <div class="stats">HP: ${myPlayer.hp} | Shield: ${myPlayer.shield}</div>
          <div class="energy-display">🔋 エネルギー: ${myPlayer.energy} / ${myPlayer.maxEnergy || 10}</div>
          <div class="summon-field">
               ${myPlayer.field && myPlayer.field.summonedCard ? `
                 <div class="summoned-unit self-unit role-${myPlayer.field.summonedCard.role}">
                   ${myPlayer.field.summonedCard.image ? `<img src="${myPlayer.field.summonedCard.image}" class="unit-img">` : ''}
                   <div class="unit-info">
                     ${myPlayer.field.summonedCard.role === 'guardian' ? '🛡️' : (myPlayer.field.summonedCard.role === 'energy' ? '🔋' : '⚔️')}
                     ${myPlayer.field.summonedCard.power} | ${myPlayer.field.summonedCard.name}
                   </div>
                 </div>
               ` : '<div class="empty-field">空きフィールド</div>'}
          </div>
        </div>
        <div class="hand-area">
          ${sortedHand.map(card => {
    const isDisabled = checkDisabled(card);
    const cost = card.cost || Math.max(1, Math.floor(card.power / 5));
    const isBasic = card.id.startsWith('base_');
    const alreadyUsed = myPlayer.usedCardIds && myPlayer.usedCardIds.includes(card.id);

    return `
      <div class="card-btn glass ${isDisabled ? 'card-disabled' : ''}" onclick="${isDisabled ? '' : `playCardWithObjID('${card.id}', 'use')`}">
        <div class="card-cost">${cost}</div>
        ${card.image ? `<img src="${card.image}">` : ''}
        <div class="card-name-label">${card.name}</div>
        <div class="card-power-label">${card.power}</div>
        <div class="skill-tags-mini">
           ${(card.skills || []).map(sk => `<div class="card-skill-tag">${sk}</div>`).join('')}
        </div>
        ${(card.effectId === 'attack' && !isBasic && !card.isSpecial) ? `
          <button class="summon-btn-mini" onclick="event.stopPropagation(); playCardWithObjID('${card.id}', 'summon')" ${isDisabled ? 'disabled' : ''}>召喚</button>
        ` : ''}
        ${alreadyUsed ? '<div class="card-tag">使用済み</div>' : ''}
      </div>
    `;
  }).join('')}
        </div>
        <div style="text-align: center; margin-top: 10px;">
          <button class="primary" onclick="${!isMyTurn ? '' : 'endTurn()'}" ${!isMyTurn ? 'disabled' : ''}>ターン終了</button>
        </div>
      </div>
    </div>`;

  showView('battle', html);
  updateLogs();
}

// [NEW] Debounced render for mobile stability
let renderTimer = null;
window.safeRenderBattle = (state) => {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderBattle(state);
  }, 100);
};

let isActing = false; // [NEW] Flag to prevent double-click / simultaneous sends

window.playCardWithObjID = (cardId, actionType = 'use') => {
  const card = getCardById(cardId);
  console.log(`[DEBUG] Retrieved card:`, card);
  console.log(`[DEBUG] Card skills:`, card?.skills);
  if (!card) return;
  if (!currentRoomId || isActing) return;

  isActing = true;
  const buttons = document.querySelectorAll('.card-btn, .summon-btn');
  buttons.forEach(btn => btn.disabled = true);

  let targetId = window.lastTargetId || null;
  let targetType = window.lastTargetType || 'player';

  if (!targetId) {
    const opponent = document.querySelector('.player-card.opponent');
    if (opponent) targetId = opponent.dataset.id;
  }

  console.log(`[ACTION] Playing card ${card.id} (${actionType}) to ${targetType}:${targetId} with skills: ${JSON.stringify(card.skills || [])}`);

  socket.emit('play_card', {
    roomId: currentRoomId,
    effectId: card.effectId,
    power: card.power,
    targetId: targetId,
    targetType: targetType,
    name: card.name,
    // [OPTIMIZATION] Don't send heavy image data over socket to prevent freeze
    // image: card.image, 
    element: card.element || 'none',
    cost: card.cost || Math.max(1, Math.floor(card.power / 5)),
    isCustom: card.isCustom || false,
    isSpecial: card.isSpecial || false,
    summonRole: card.summonRole || 'attacker',
    id: card.id,
    actionType: actionType,
    skills: card.skills || []
  });

  // Reset targeting
  window.lastTargetId = null;
  window.lastTargetType = 'player';

  // isActing is reset in action_performed or error_message
  // [NEW] Fail-safe: Enable UI after 5 seconds if no response
  setTimeout(() => {
    if (isActing) {
      console.warn("[FAIL-SAFE] playCard timeout. Resetting isActing.");
      isActing = false;
      const buttons = document.querySelectorAll('.card-btn, .summon-btn');
      buttons.forEach(btn => btn.disabled = false);
    }
  }, 5000);
};

window.playCardWithObjID_UNIT_CLICK = () => {
  const logArea = document.getElementById('battle-log');
  if (logArea) {
    battleLogs.push(`<div class="log-entry" style="color:var(--accent-color); text-align:center; background:rgba(255,234,0,0.1)">🎯 ターゲットをユニットに変更しました</div>`);
    updateLogs();
  }
};

window.downloadCardImage = (imageData, fileName) => {
  const link = document.createElement('a');
  link.href = imageData;
  link.download = `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.renderGallery = () => {
  let myCards = [];
  try {
    myCards = JSON.parse(localStorage.getItem('my_cards') || '[]');
    if (!Array.isArray(myCards)) myCards = [];
  } catch (e) {
    console.error("Failed to parse my_cards", e);
    myCards = [];
  }

  // Clean up data: filter out nulls/undefined and ensure they are objects
  const validCards = myCards.filter(c => c && typeof c === 'object');

  const html = `
    <div class="gallery-container">
      <h2>カード図鑑（作成済みカード）</h2>
      <p style="color: #aaa; margin-bottom: 20px;">あなたが作成したオリジナルカードの一覧です。保存ボタンから画像をダウンロードできます。</p>
      
      <div class="gallery-grid">
        ${validCards.length === 0 ? '<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">まだカードを作成していません</p>' : ''}
        ${validCards.map((card, idx) => {
    const name = card.name || '無名のカード';
    const power = card.power || 0;
    const cost = card.cost || 0;
    const effectId = (card.effectId || 'attack').toLowerCase();
    const element = (card.element || 'none').toLowerCase();
    const skills = Array.isArray(card.skills) ? card.skills : [];
    const image = card.image || '';
    const flavor = card.flavor || '';

    const elementJP = { fire: '火', water: '水', wood: '木', none: '無' }[element] || '無';
    const effectJP = { attack: '攻撃', heal: '回復', defense: '防御', energy_gain: 'エネ獲得', status_clear: '状態浄化', stun_only: 'スタン付与', poison_only: '毒付与' }[effectId] || effectId;

    return `
            <div class="gallery-item glass">
              ${image ? `<img src="${image}" class="gallery-card-img">` : '<div class="no-img-placeholder">No Image</div>'}
              <div class="gallery-card-info">
                <div class="gallery-card-name">${name}</div>
                <div class="gallery-card-stats">
                  <span class="stat-power">${effectId === 'attack' ? '⚔️' : effectId === 'heal' ? '❤️' : '🛡️'} ${power}</span>
                  <span class="stat-cost">🔋 ${cost}</span>
                </div>
                ${flavor ? `<div style="font-size: 0.75rem; font-style: italic; color: #888; margin-bottom: 8px;">"${flavor}"</div>` : ''}
                <div class="gallery-card-skills">
                  ${skills.map(s => {
      const skillJP = { vampire: '吸血', piercing: '貫通', poison: '毒付与', stun: 'スタン付与', twinStrike: '二連撃' }[s] || s;
      return `<span class="gallery-skill-tag">${skillJP}</span>`;
    }).join('')}
                </div>
                <div class="gallery-card-meta">${elementJP}属性 | ${effectJP}</div>
                
                <div style="margin-top: 10px;">
                  <button class="secondary btn-dl-card" style="width: 100%; font-size: 0.8rem; padding: 5px;" 
                    data-idx="${idx}" ${!image ? 'disabled' : ''}>📥 画像を保存</button>
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <button onclick="goToHome()">タイトルに戻る</button>
      </div>
    </div>
  `;
  showView('gallery', html);

  document.querySelectorAll('.btn-dl-card').forEach(btn => {
    btn.onclick = (e) => {
      const idx = e.target.getAttribute('data-idx');
      const card = validCards[idx];
      if (card && card.image) {
        downloadCardImage(card.image, card.name || 'card');
      }
    };
  });
};

// Ensure title events are set up even if the module loads before the DOM is fully ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupTitleEvents);
} else {
  setupTitleEvents();
}
