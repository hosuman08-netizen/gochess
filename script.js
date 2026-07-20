// GoChess - p4 Prototype
// Legion ALWAYS LEARNING: every game produces insights

let currentMode = 'go';
let goBoard = Array(19).fill().map(() => Array(19).fill(0)); // 0 empty, 1 black, 2 white
let goCurrentPlayer = 1;
let chessBoard = []; // 8x8
let chessCurrentPlayer = 'w';
let gameLog = [];
let fusionBuff = { goBonus: 0, chessPower: 0 }; // chessPower now level number for real buff
// Fusion cross-buffs: chess success feeds Go stone bonuses and Go territory feeds chess power. Study insights auto-recorded. Limited daily fusion plays for pacing.
let puzzleActive = false;
let puzzleSolution = null; // {from:[x,y], to:[x,y], type:'capture'}
// Legion FOMO fusion window
let fusionPlaysLeft = 5;
let goPassCount = 0; // for simple end game scoring
let lastGoMove = null; // [x,y] of the most recently placed stone (marker so AI reply is visible)

// === p6 Lung Surprise Eye + Ache-Breath + 창발 DNA (cross full implant) ===
// p6 breath = game tension phase. spore.wound = near-miss / loss ache history.
// Use for fusion power + study voice echo + Vitruvian surprise viz.
let p4Lung = { breath: 0, _prevBreath: 0, lastSurprise: 0, surpriseAge: 0 };
let p4Spore = { wound: 0.4, ache: 0 }; // wound from near-miss/capture fail, ache from user study pain words
let p4VoiceEchoes = []; // ALWAYS LEARNING notebook from "voice" (user text + p6 surprise synthesis)

// Calc surprise cross from p6 lung-surprise-eye logic (first-principles: deviation from expected)
function calcP4Surprise() {
  const expected = (p4Spore.wound || 0.5) * 0.008 * ((p4Lung.breath || 0) + 0.5);
  const actualDelta = Math.abs(((p4Lung.breath || 0) % 1) - (p4Lung._prevBreath || 0));
  p4Lung._prevBreath = p4Lung.breath || 0;
  const raw = Math.abs(actualDelta - expected);
  const surprise = Math.min(1, raw * 1.618);
  p4Lung.lastSurprise = surprise;
  p4Lung.surpriseAge = (p4Lung.surpriseAge || 0) + 1;
  return surprise;
}

// Feed breath from game state (tension = capture delta + territory variance)
function feedP4Breath(deltaTension) {
  p4Lung.breath = ((p4Lung.breath || 0) + deltaTension * 0.7) % 6.28;
  // Ache-Breath: if negative surprise (pain), increase spore wound
  const s = calcP4Surprise();
  if (s > 0.18) p4Spore.wound = Math.min(1, (p4Spore.wound || 0.4) + s * 0.06);
  if (s > 0.25) p4Spore.ache = Math.min(3, (p4Spore.ache || 0) + 1);
  // Expose for p6 eye if loaded
  try { window.p4CurrentSurprise = (window.p4CurrentSurprise||0)*0.7 + s*0.3; } catch(e){}
  return s;
}

// 깊은 승부처에서 문득 떠오르는 통찰 메모를 생성한다
function birthAcheBreathEmergent(context = '') {
  const s = p4Lung.lastSurprise || calcP4Surprise();
  if (s > 0.22 && p4Spore.ache > 1) {
    const glaze = {
      type: 'insight',
      ts: Date.now(),
      surprise: s.toFixed(3),
      ache: p4Spore.ache,
      context,
      text: `이 국면의 긴장 속에서 문득 새로운 수가 보였다. 잠시 멈추면 판이 더 넓게 보인다.`
    };
    p4VoiceEchoes.push(glaze);
    gameLog.push({mode:'study', emergent:'insight', ...glaze});
    return glaze;
  }
  return null;
}

// Persistence + streak
function saveP4() {
  try {
    const state = {
      goBoard, chessBoard, gameLog, currentMode,
      goCurrentPlayer, chessCurrentPlayer, fusionBuff, fusionPlaysLeft, goPassCount
    };
    localStorage.setItem('p4-gochess', JSON.stringify(state));
  } catch(e) {
    console.warn('[p4] save failed', e);
  }
}
function loadP4() {
  try {
    const s = localStorage.getItem('p4-gochess');
    if (!s) return false;
    const data = JSON.parse(s);
    if (!data || typeof data !== 'object') throw new Error('corrupt');
    goBoard = data.goBoard || goBoard;
    chessBoard = data.chessBoard || chessBoard;
    gameLog = Array.isArray(data.gameLog) ? data.gameLog : [];
    currentMode = data.currentMode || currentMode;
    goCurrentPlayer = data.goCurrentPlayer || 1;
    chessCurrentPlayer = data.chessCurrentPlayer || 'w';
    fusionBuff = data.fusionBuff || { goBonus: 0, chessPower: 0 };
    fusionPlaysLeft = (typeof data.fusionPlaysLeft === 'number') ? data.fusionPlaysLeft : 5;
    goPassCount = (typeof data.goPassCount === 'number') ? data.goPassCount : 0;
    return true;
  } catch(e) {
    console.warn('[p4] corrupted save or none. Resetting state.', e);
    localStorage.removeItem('p4-gochess');
    // reset to clean
    goBoard = Array(19).fill().map(() => Array(19).fill(0));
    chessBoard = [];
    gameLog = [];
    goCurrentPlayer = 1;
    chessCurrentPlayer = 'w';
    fusionBuff = { goBonus: 0, chessPower: 0 };
    fusionPlaysLeft = 5;
    goPassCount = 0;
    return false;
  }
}

function autoSave() { saveP4(); }

// Streak (FOMO daily play)
function getStreak() {
  try {
    const raw = localStorage.getItem('p4-streak');
    return raw ? JSON.parse(raw) : { lastDate: null, count: 0, days: 0 };
  } catch { return { lastDate: null, count: 0, days: 0 }; }
}
function updateStreakOnPlay() {
  const today = new Date().toISOString().slice(0,10);
  let s = getStreak();
  const isNewDay = (s.lastDate !== today);
  if (isNewDay) {
    // new day — FOMO reset
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    if (s.lastDate === yest) {
      s.days = (s.days || 0) + 1;
    } else {
      s.days = 1;
    }
    s.lastDate = today;
    s.count = 1;
    // FOMO fusion window refresh on new day (scarcity daily)
    fusionPlaysLeft = 5;
  } else {
    s.count = (s.count || 0) + 1;
  }
  localStorage.setItem('p4-streak', JSON.stringify(s));
  renderStreak();
  // sync FOMO UI if visible
  const fomoEl = document.getElementById('fusion-fomo');
  if (fomoEl) fomoEl.textContent = `오늘의 퓨전 기회: ${fusionPlaysLeft}회 남음`;
  return s;
}
function renderStreak() {
  const s = getStreak();
  const el = document.getElementById('streak-display');
  if (el) el.textContent = `🔥 연속 출석: ${s.days}일 • 오늘 ${s.count}수`;
}

// --- Mode Switching ---
function switchMode(mode) {
  document.getElementById('go-board').classList.add('hidden');
  document.getElementById('chess-board').classList.add('hidden');
  document.getElementById('fusion-panel').classList.add('hidden');
  document.getElementById('study-panel').classList.add('hidden');
  selected = null;

  if (mode === 'go') {
    document.getElementById('go-board').classList.remove('hidden');
    initGo();
  } else if (mode === 'chess') {
    document.getElementById('chess-board').classList.remove('hidden');
    initChess(true); // preserve loaded board if any
  } else if (mode === 'fusion') {
    document.getElementById('fusion-panel').classList.remove('hidden');
    initFusion();
  }
  currentMode = mode;
  updateStatus();
}

function updateStatus(text) {
  const el = document.getElementById('status');
  if (text) el.textContent = text;
  else if (currentMode === 'go') el.textContent = `바둑 • ${goCurrentPlayer === 1 ? '흑' : '백'} 턴`;
  else if (currentMode === 'chess') el.textContent = `체스 • ${chessCurrentPlayer === 'w' ? '백' : '흑'} 턴`;
  else el.textContent = `퓨전 모드 (실시간 교차 버프 • 남은 기회 ${fusionPlaysLeft}회)`;
  renderStreak();
}

// --- GO ---
function initGo() {
  const grid = document.getElementById('go-grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(19, 1fr)`;

  // Traditional 19x19 star points (화점 / hoshi): the one deliberate elegant touch
  const STAR = new Set([3,9,15].flatMap(sx => [3,9,15].map(sy => sx + ',' + sy)));
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      const cell = document.createElement('div');
      cell.className = STAR.has(x + ',' + y) ? 'cell star' : 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.onclick = () => placeGoStone(x, y, cell);
      grid.appendChild(cell);
    }
  }
  renderGo();
}

function renderGo() {
  const cells = document.querySelectorAll('#go-grid .cell');
  cells.forEach(cell => {
    const x = +cell.dataset.x;
    const y = +cell.dataset.y;
    cell.innerHTML = '';
    const val = goBoard[y][x];
    if (val) {
      const stone = document.createElement('div');
      let cls = `stone ${val === 1 ? 'black' : 'white'}`;
      if (lastGoMove && lastGoMove[0] === x && lastGoMove[1] === y) cls += ' last-go';
      stone.className = cls;
      cell.appendChild(stone);
    }
  });
}

// Liberties of the group containing (x,y) on a given board (0 = would be captured).
function groupLiberties(board, x, y) {
  const color = board[y][x];
  if (!color) return Infinity;
  const seen = Array(19).fill().map(() => Array(19).fill(false));
  const libs = new Set();
  const stack = [[x, y]];
  seen[y][x] = true;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19) continue;
      const v = board[ny][nx];
      if (v === 0) libs.add(nx + ',' + ny);
      else if (v === color && !seen[ny][nx]) { seen[ny][nx] = true; stack.push([nx, ny]); }
    }
  }
  return libs.size;
}

// Would placing `color` at (x,y) be an illegal suicide? (captures nothing AND
// the resulting own group has no liberties). Tests on a copy — no mutation.
function isSuicideGo(x, y, color) {
  if (goBoard[y][x] !== 0) return true;
  const b = goBoard.map(r => r.slice());
  b[y][x] = color;
  const opp = color === 1 ? 2 : 1;
  // Remove any opponent group left with zero liberties (this move captures it).
  let capturedAny = false;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= 19 || ny < 0 || ny >= 19) continue;
    if (b[ny][nx] === opp && groupLiberties(b, nx, ny) === 0) capturedAny = true;
  }
  if (capturedAny) return false; // capturing frees liberties → legal
  return groupLiberties(b, x, y) === 0;
}

function placeGoStone(x, y, cell) {
  if (goBoard[y][x] !== 0) return;
  // Enforce the real suicide rule: reject moves that self-capture with no gain.
  if (isSuicideGo(x, y, goCurrentPlayer)) {
    if (typeof showToast === 'function') showToast('자충수(자살수)는 둘 수 없어요 — 활로가 없는 자리입니다.');
    return;
  }

  goBoard[y][x] = goCurrentPlayer;
  lastGoMove = [x, y];
  gameLog.push({mode: 'go', x, y, player: goCurrentPlayer});

  // Simple capture + log
  const before = countStones();
  captureGoGroups(goCurrentPlayer === 1 ? 2 : 1);
  const after = countStones();
  const captured = before - after;
  if (captured > 0) {
    gameLog.push({mode: 'go', action: 'capture', count: captured, by: goCurrentPlayer});
  }

  renderGo();
  goCurrentPlayer = goCurrentPlayer === 1 ? 2 : 1;
  updateStatus();
  updateStreakOnPlay();
  autoSave();

  // Live sync to fusion mini if open (cross state link)
  renderFusionMiniGo();
  updateFusionBuffsUI();

  // Legion learning hook
  if (Math.random() < 0.2) {
    console.log('%c[GoChess Learning] 좋은 수를 두었습니다. 영역 형성 감각이 중요합니다.', 'color:#4a9eff');
  }

  // Auto live cross-buff (FUSION polish): Go place/capture -> occasional chessPower
  if (Math.random() < 0.28) {
    fusionBuff.chessPower = (fusionBuff.chessPower || 0) + 1;
  }
  // p6 DNA: feed breath on go action (창발 variance)
  feedP4Breath( (captured > 0 ? 0.9 : 0.3) + (Math.random()-0.5)*0.2 );
  birthAcheBreathEmergent('go-move');
  updateFusionBuffsUI();

  // AI opponent (Go) — always respond if AI turn
  if (goCurrentPlayer === 2) setTimeout(aiGoMove, 420);
}

function countStones() {
  let c = 0;
  for (let y=0; y<19; y++) for (let x=0; x<19; x++) if (goBoard[y][x]) c++;
  return c;
}

function captureGoGroups(opponent) {
  const visited = Array(19).fill().map(() => Array(19).fill(false));
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      if (goBoard[y][x] === opponent && !visited[y][x]) {
        const group = [];
        const liberties = new Set();
        dfsGo(x, y, opponent, visited, group, liberties);
        if (liberties.size === 0) {
          group.forEach(([gx, gy]) => goBoard[gy][gx] = 0);
        }
      }
    }
  }
}

function dfsGo(x, y, color, visited, group, liberties) {
  if (x < 0 || x >= 19 || y < 0 || y >= 19 || visited[y][x]) return;
  if (goBoard[y][x] !== color) return;
  visited[y][x] = true;
  group.push([x, y]);

  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let [dx, dy] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19) {
      if (goBoard[ny][nx] === 0) liberties.add(`${nx},${ny}`);
      else if (goBoard[ny][nx] === color) dfsGo(nx, ny, color, visited, group, liberties);
    }
  }
}

// ============================================================
// REAL GO SCORING — area scoring (Chinese rules): stones + territory.
// An empty region is territory for a color only if EVERY stone bordering
// the region is that color. Regions touching both colors (or no stones)
// are neutral (dame) and score for neither. This is genuine board judgment,
// not a stone count.
// ============================================================
function scoreGoTerritory() {
  const N = 19;
  const visited = Array(N).fill().map(() => Array(N).fill(false));
  let blackTerritory = 0, whiteTerritory = 0, neutral = 0;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (goBoard[y][x] !== 0 || visited[y][x]) continue;
      // Flood-fill this empty region, collecting its size and bordering colors.
      const region = [];
      const borders = new Set();
      const stack = [[x, y]];
      visited[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        region.push([cx, cy]);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
          const v = goBoard[ny][nx];
          if (v === 0) {
            if (!visited[ny][nx]) { visited[ny][nx] = true; stack.push([nx, ny]); }
          } else {
            borders.add(v); // 1 = black, 2 = white
          }
        }
      }
      if (borders.size === 1) {
        if (borders.has(1)) blackTerritory += region.length;
        else whiteTerritory += region.length;
      } else {
        neutral += region.length; // dame or open board
      }
    }
  }

  const blackStones = countStonesForColor(1);
  const whiteStones = countStonesForColor(2);
  // Chinese/area scoring: stones on board + surrounded territory.
  const blackArea = blackStones + blackTerritory;
  const whiteArea = whiteStones + whiteTerritory;
  return {
    blackStones, whiteStones, blackTerritory, whiteTerritory, neutral,
    blackArea, whiteArea,
    // 6.5 komi to white as a standard tiebreak (fictional-standard).
    whiteAreaKomi: whiteArea + 6.5,
    diff: blackArea - (whiteArea + 6.5),
  };
}

function passGo() {
  goPassCount = (goPassCount || 0) + 1;
  goCurrentPlayer = goCurrentPlayer === 1 ? 2 : 1;
  updateStatus();
  gameLog.push({mode: 'go', action: 'pass'});
  autoSave();
  if (goPassCount >= 2) {
    // REAL area scoring: stones + surrounded territory (not just stone count).
    const r = scoreGoTerritory();
    const winner = r.diff > 0 ? '흑' : (r.diff < 0 ? '백' : '무승부');
    gameLog.push({mode:'go', action:'end', score: r.diff, scoring: 'area', detail: r});
    alert(
      `바둑 종료 (연속 패스 2회) — 실제 집계산 (Area scoring)\n\n` +
      `흑: 돌 ${r.blackStones} + 집 ${r.blackTerritory} = ${r.blackArea}\n` +
      `백: 돌 ${r.whiteStones} + 집 ${r.whiteTerritory} = ${r.whiteArea} (+덤 6.5 = ${r.whiteAreaKomi})\n` +
      `중립(공배): ${r.neutral}\n\n` +
      `결과: ${winner === '무승부' ? '무승부' : winner + ' 승'} (차이 ${Math.abs(r.diff).toFixed(1)}집)`
    );
    if (winner === '무승부') {
      showShareBanner('go-draw', { diff: r.diff }, '바둑 종료 — 무승부');
    } else {
      try { if (window.legionTrack) window.legionTrack('activate'); } catch (e) {}
      showShareBanner('go-win', { winner, diff: r.diff }, `바둑 종료 — ${winner} 승`);
    }
    goPassCount = 0;
    setTimeout(endGameAndStudy, 300);
  }
  // AI respond if needed
  if (goCurrentPlayer === 2) setTimeout(aiGoMove, 300);
}

function resetGo() {
  goBoard = Array(19).fill().map(() => Array(19).fill(0));
  goCurrentPlayer = 1;
  lastGoMove = null;
  fusionBuff.goBonus = 0;
  goPassCount = 0;
  if (typeof hideShareBanner === 'function') hideShareBanner();
  // Preserve gameLog for ALWAYS LEARNING across resets (insights accumulate)
  renderGo();
  renderFusionMiniGo();
  updateStatus();
  updateFusionBuffsUI();
  autoSave();
}

// --- CHESS ---
const PIECE_SYMBOLS = {
  'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
  'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

function initChess(keepLoaded = false) {
  const grid = document.getElementById('chess-grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(8, 1fr)`;

  if (!keepLoaded || !chessBoard || chessBoard.length !== 8) {
    chessBoard = [
      ['br','bn','bb','bq','bk','bb','bn','br'],
      ['bp','bp','bp','bp','bp','bp','bp','bp'],
      Array(8).fill(''),
      Array(8).fill(''),
      Array(8).fill(''),
      Array(8).fill(''),
      ['wp','wp','wp','wp','wp','wp','wp','wp'],
      ['wr','wn','wb','wq','wk','wb','wn','wr']
    ];
    chessCurrentPlayer = 'w';
    chessGameOver = false;
  }

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const cell = document.createElement('div');
      cell.className = `cell ${(x + y) % 2 === 0 ? 'light' : 'dark'}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.onclick = () => handleChessClick(x, y, cell);
      grid.appendChild(cell);
    }
  }
  renderChess();
}

function renderChess() {
  const cells = document.querySelectorAll('#chess-grid .cell');
  // Which king (if any) is currently in check → glow it red
  const checkedColor = isInCheck(chessBoard, chessCurrentPlayer) ? chessCurrentPlayer : null;
  const checkedKingPos = checkedColor ? findKing(chessBoard, checkedColor) : null;
  cells.forEach(cell => {
    const x = +cell.dataset.x;
    const y = +cell.dataset.y;
    cell.innerHTML = '';
    cell.classList.remove('buffed', 'selected', 'move-hint', 'capture-hint', 'last-move', 'in-check');
    const piece = chessBoard[y][x];
    if (piece) {
      cell.textContent = PIECE_SYMBOLS[piece] || '?';
      cell.style.color = piece[0] === 'w' ? '#fff' : '#222';
    }
    // Selected piece
    if (selected && selected[0] === x && selected[1] === y) cell.classList.add('selected');
    // Legal-move hints for the selected piece (dot on empty, ring on capture)
    const hint = legalTargets.find(t => t.x === x && t.y === y);
    if (hint) cell.classList.add(hint.capture ? 'capture-hint' : 'move-hint');
    // Last-move trail (from + to)
    if (lastChessMove) {
      const [fx, fy] = lastChessMove.from, [ttx, tty] = lastChessMove.to;
      if ((fx === x && fy === y) || (ttx === x && tty === y)) cell.classList.add('last-move');
    }
    // King in check
    if (checkedKingPos && checkedKingPos[0] === x && checkedKingPos[1] === y) cell.classList.add('in-check');
    // Real buff UI: highlight potential power squares when chessBuff active (live cross)
    if (fusionBuff.chessPower > 0 && piece && piece[0] === chessCurrentPlayer) {
      cell.classList.add('buffed');
      cell.style.boxShadow = '0 0 6px #4a9eff';
    } else {
      cell.style.boxShadow = '';
    }
  });
}

let selected = null;
let legalTargets = [];        // [{x,y,capture}] destinations for the selected piece
let lastChessMove = null;     // {from:[x,y], to:[x,y]} — trail of the most recent move

// Every legal destination for the piece at (sx,sy), for on-board hinting.
function targetsForPiece(sx, sy) {
  const piece = chessBoard[sy] && chessBoard[sy][sx];
  if (!piece || piece[0] !== chessCurrentPlayer) return [];
  const out = [];
  for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
    if (isLegalChessMove(chessBoard, sx, sy, tx, ty, piece[0])) {
      out.push({ x: tx, y: ty, capture: !!chessBoard[ty][tx] });
    }
  }
  return out;
}

function handleChessClick(x, y, cell) {
  if (chessGameOver) return; // no play after checkmate/stalemate until reset
  const piece = chessBoard[y][x];

  if (selected) {
    const [sx, sy] = selected;
    if (isValidChessMove(sx, sy, x, y)) {
      lastChessMove = { from: [sx, sy], to: [x, y] };
      const target = chessBoard[y][x];
      const movedPiece = chessBoard[sy][sx];
      chessBoard[y][x] = movedPiece;
      chessBoard[sy][sx] = '';
      // Promotion: a pawn reaching the last rank becomes a queen
      if (movedPiece[1] === 'p' && (y === 0 || y === 7)) {
        chessBoard[y][x] = movedPiece[0] + 'q';
        gameLog.push({mode: 'chess', action: 'promote', to: 'q', by: movedPiece[0]});
      }
      const isCapture = !!target;
      gameLog.push({mode: 'chess', from: [sx,sy], to: [x,y], capture: isCapture ? target : null});
      if (isCapture) {
        gameLog.push({mode: 'chess', action: 'capture', piece: target, by: movedPiece[0]});
      }
      chessCurrentPlayer = chessCurrentPlayer === 'w' ? 'b' : 'w';
      selected = null;
      legalTargets = [];
      renderChess();
      // Real game-state judgment for the side now to move
      if (evaluateChessEnd()) { updateStreakOnPlay(); autoSave(); return; }
      updateStatus();
      updateStreakOnPlay();
      autoSave();
      // Real chessBuff application: if Go territory gave power, this player move gets "extra power" (near-miss variable consume)
      if (fusionBuff.chessPower > 0) {
        gameLog.push({mode: 'fusion', action: 'buffed_chess_move'});
        fusionBuff.chessPower = Math.max(0, fusionBuff.chessPower - (Math.random() < 0.6 ? 1 : 0));
      }
      // Live mini sync
      renderFusionMiniChess();
      // p6 DNA: feed breath + surprise on chess action (ache from capture)
      const cSur = feedP4Breath( isCapture ? 1.1 : 0.35 );
      if (isCapture && cSur > 0.2) p4Spore.ache = Math.min(4, p4Spore.ache + 1);
      birthAcheBreathEmergent('chess-capture');
      updateFusionBuffsUI();
      // Check puzzle solution if active
      if (puzzleActive && puzzleSolution) {
        checkPuzzleSolution([sx,sy], [x,y]);
      }
      // Auto live cross-buff (FUSION polish): chess capture/good -> goBonus (scarcity FOMO)
      if (isCapture || Math.random() < 0.22) {
        fusionBuff.goBonus = (fusionBuff.goBonus || 0) + (isCapture ? 2 : 1);
      }
      updateFusionBuffsUI();
      setTimeout(aiChessMove, 500); // AI turn
    } else if (piece && piece[0] === chessCurrentPlayer) {
      // Clicked another of own pieces → reselect it (show its hints)
      selected = [x, y];
      legalTargets = targetsForPiece(x, y);
      renderChess();
    } else {
      // Clicked an illegal square → deselect
      selected = null;
      legalTargets = [];
      renderChess();
    }
  } else if (piece && piece[0] === chessCurrentPlayer) {
    selected = [x, y];
    legalTargets = targetsForPiece(x, y);
    renderChess();
  }
}

// Path must be empty between source and target (exclusive) for sliding pieces,
// on the given board. Fixes real bug: rook/bishop/queen jumping over pieces.
function isPathClear(board, sx, sy, tx, ty) {
  const stepX = Math.sign(tx - sx);
  const stepY = Math.sign(ty - sy);
  let cx = sx + stepX, cy = sy + stepY;
  while (cx !== tx || cy !== ty) {
    if (board[cy][cx]) return false;
    cx += stepX; cy += stepY;
  }
  return true;
}

// Pseudo-legal: correct piece geometry + blocking, but ignores whether the
// move leaves your own king in check (that final filter lives in isLegalChessMove).
function isPseudoLegal(board, sx, sy, tx, ty) {
  const piece = board[sy][sx];
  const target = board[ty][tx];
  if (!piece) return false;
  if (sx === tx && sy === ty) return false; // no null move
  if (target && target[0] === piece[0]) return false;

  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  const type = piece[1];
  const dir = piece[0] === 'w' ? -1 : 1;

  if (type === 'p') {
    // single push
    if (tx === sx && ty === sy + dir && !target) return true;
    // double push from start row — intermediate square must also be empty
    if (tx === sx && sy === (piece[0]==='w'?6:1) && ty === sy + 2*dir
        && !target && !board[sy + dir][sx]) return true;
    // diagonal capture (must land on an enemy piece)
    if (dx === 1 && ty === sy + dir && target) return true;
    return false;
  }
  if (type === 'r' || type === 'q') if ((dx === 0 || dy === 0) && isPathClear(board, sx, sy, tx, ty)) return true; // straight
  if (type === 'b' || type === 'q') if (dx === dy && isPathClear(board, sx, sy, tx, ty)) return true; // diagonal
  if (type === 'n') if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) return true;
  if (type === 'k') if (dx <= 1 && dy <= 1) return true;

  return false;
}

// Full legality on the LIVE board for the side to move (player-facing).
// Enforces check rules: you cannot make a move that leaves your king attacked.
function isValidChessMove(sx, sy, tx, ty) {
  const piece = chessBoard[sy][sx];
  if (!piece) return false;
  return isLegalChessMove(chessBoard, sx, sy, tx, ty, piece[0]);
}

// ============================================================
// REAL CHESS RULES ENGINE — check / checkmate / stalemate
// Pure functions operate on an 8x8 board (array of rows). No globals mutated
// except where noted, so the AI can search hypothetical positions safely.
// ============================================================
let chessGameOver = false; // set when checkmate/stalemate reached

// Locate a king of a given color ('w'|'b') on a board. Returns [x,y] or null.
function findKing(board, color) {
  const k = color + 'k';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (board[y][x] === k) return [x, y];
  }
  return null;
}

// Geometric attack test: can `attacker` color hit square (tx,ty)?
// Independent of whose turn it is and of check legality (pure geometry),
// so it is safe to use inside legal-move generation without recursion.
function isSquareAttacked(board, tx, ty, attacker) {
  const dir = attacker === 'w' ? -1 : 1; // pawns move toward decreasing y for white
  // Pawn attacks: a white pawn on (px,py) attacks (px±1, py-1)
  for (const dx of [-1, 1]) {
    const px = tx + dx, py = ty - dir; // the square a pawn would sit on to attack (tx,ty)
    if (px >= 0 && px < 8 && py >= 0 && py < 8) {
      const p = board[py][px];
      if (p && p[0] === attacker && p[1] === 'p') return true;
    }
  }
  // Knight attacks
  const kn = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
  for (const [dx, dy] of kn) {
    const px = tx + dx, py = ty + dy;
    if (px >= 0 && px < 8 && py >= 0 && py < 8) {
      const p = board[py][px];
      if (p && p[0] === attacker && p[1] === 'n') return true;
    }
  }
  // King adjacency
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const px = tx + dx, py = ty + dy;
    if (px >= 0 && px < 8 && py >= 0 && py < 8) {
      const p = board[py][px];
      if (p && p[0] === attacker && p[1] === 'k') return true;
    }
  }
  // Sliding pieces: rook/queen orthogonal, bishop/queen diagonal
  const ortho = [[1,0],[-1,0],[0,1],[0,-1]];
  const diag = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const scan = (dirs, types) => {
    for (const [dx, dy] of dirs) {
      let px = tx + dx, py = ty + dy;
      while (px >= 0 && px < 8 && py >= 0 && py < 8) {
        const p = board[py][px];
        if (p) {
          if (p[0] === attacker && types.includes(p[1])) return true;
          break; // blocked by any piece
        }
        px += dx; py += dy;
      }
    }
    return false;
  };
  if (scan(ortho, ['r', 'q'])) return true;
  if (scan(diag, ['b', 'q'])) return true;
  return false;
}

// Is `color`'s king currently in check on `board`?
function isInCheck(board, color) {
  const kp = findKing(board, color);
  if (!kp) return false;
  return isSquareAttacked(board, kp[0], kp[1], color === 'w' ? 'b' : 'w');
}

// Apply a pseudo-legal move on a COPY and return the resulting board.
function applyMoveCopy(board, sx, sy, tx, ty) {
  const nb = board.map(row => row.slice());
  const piece = nb[sy][sx];
  nb[ty][tx] = piece;
  nb[sy][sx] = '';
  // Auto-queen promotion on last rank (keeps engine honest about material)
  if (piece && piece[1] === 'p' && (ty === 0 || ty === 7)) nb[ty][tx] = piece[0] + 'q';
  return nb;
}

// A move is fully legal iff it is pseudo-legal AND does not leave own king in check.
function isLegalChessMove(board, sx, sy, tx, ty, color) {
  const piece = board[sy][sx];
  if (!piece || piece[0] !== color) return false;
  if (!isPseudoLegal(board, sx, sy, tx, ty)) return false;
  const nb = applyMoveCopy(board, sx, sy, tx, ty);
  return !isInCheck(nb, color);
}

// Generate every fully-legal move for `color` on `board`.
function generateLegalMoves(board, color) {
  const moves = [];
  for (let sy = 0; sy < 8; sy++) for (let sx = 0; sx < 8; sx++) {
    const p = board[sy][sx];
    if (!p || p[0] !== color) continue;
    for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
      if (isLegalChessMove(board, sx, sy, tx, ty, color)) {
        moves.push({ sx, sy, tx, ty, capture: board[ty][tx] || null });
      }
    }
  }
  return moves;
}

// Post-move status. Returns 'checkmate' | 'stalemate' | 'check' | 'normal'
function chessPositionStatus(board, colorToMove) {
  const hasMove = generateLegalMoves(board, colorToMove).length > 0;
  const inCheck = isInCheck(board, colorToMove);
  if (!hasMove) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'normal';
}

// Enhanced AI: capture priority + basic material lookahead (simple 1-ply)
const PIECE_VALUES = { 'p':1, 'n':3, 'b':3, 'r':5, 'q':9, 'k':100 };

// Static material evaluation from black's perspective (AI is black).
// Higher = better for black. Used for real 1-ply lookahead that avoids blunders.
function evalMaterialForBlack(board) {
  let score = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const p = board[y][x];
    if (!p) continue;
    const v = PIECE_VALUES[p[1]] || 0;
    score += (p[0] === 'b') ? v : -v;
    // slight central control bonus for non-king pieces
    if (p[1] !== 'k') {
      const centerBonus = (3.5 - Math.abs(3.5 - x)) + (3.5 - Math.abs(3.5 - y));
      score += (p[0] === 'b' ? 1 : -1) * centerBonus * 0.05;
    }
  }
  return score;
}

// Best static reply value for `color` on `board` (used to detect if our move
// hangs the moved piece / allows a big recapture). Returns max capture value.
function bestCaptureValue(board, color) {
  const moves = generateLegalMoves(board, color);
  let best = 0;
  for (const m of moves) {
    const t = board[m.ty][m.tx];
    if (t) best = Math.max(best, PIECE_VALUES[t[1]] || 0);
  }
  return best;
}

function aiChessMove() {
  if (chessCurrentPlayer !== 'b' || puzzleActive || chessGameOver) return;

  // Only fully-legal moves (respects check pins/escapes). No illegal blunders.
  const legal = generateLegalMoves(chessBoard, 'b');
  if (legal.length === 0) { evaluateChessEnd(); return; }

  // Real 1-ply lookahead with opponent recapture awareness (no more piece hanging):
  // score = resulting material for black MINUS white's best immediate recapture.
  let scored = legal.map(m => {
    const nb = applyMoveCopy(chessBoard, m.sx, m.sy, m.tx, m.ty);
    let s = evalMaterialForBlack(nb);
    // Penalize by white's best reply capture (opponent will grab hanging material)
    s -= bestCaptureValue(nb, 'w') * 0.9;
    // Bonus if this move gives check (pressure)
    if (isInCheck(nb, 'w')) s += 0.6;
    return { ...m, score: s };
  });

  // Fusion buff from Go territory sharpens play: bias toward the very best lines.
  if (fusionBuff.chessPower > 0) {
    scored.forEach(m => { if (m.capture) m.score += Math.min(2, fusionBuff.chessPower * 0.4); });
    fusionBuff.chessPower = Math.max(0, fusionBuff.chessPower - 1); // consume buff
  }

  scored.sort((a, b) => b.score - a.score);
  // Pick among the best-scoring moves (tiny variety, but never a blunder)
  const top = scored.filter(m => m.score >= scored[0].score - 0.25);
  const chosen = top[Math.floor(Math.random() * top.length)];

  const { sx, sy, tx, ty } = chosen;
  const target = chessBoard[ty][tx];
  const moved = chessBoard[sy][sx];
  chessBoard[ty][tx] = moved;
  chessBoard[sy][sx] = '';
  if (moved[1] === 'p' && (ty === 0 || ty === 7)) chessBoard[ty][tx] = 'bq'; // AI promotes
  lastChessMove = { from: [sx, sy], to: [tx, ty] }; // show the AI's reply on the board
  if (target) gameLog.push({mode: 'chess', action: 'capture', piece: target, by: 'b'});
  gameLog.push({mode: 'chess', from: [sx,sy], to: [tx,ty], capture: !!target, ai: true});
  chessCurrentPlayer = 'w';
  renderChess();
  // Judge whether the AI just delivered mate / stalemate to the human
  if (evaluateChessEnd()) { autoSave(); return; }
  updateStatus();
  autoSave();
  // live cross if fusion visible
  renderFusionMiniChess();
  updateFusionBuffsUI();
}

// Central end-of-game judge. Reads the side now to move, announces
// check / checkmate / stalemate. Returns true if the game ended.
function evaluateChessEnd() {
  const toMove = chessCurrentPlayer;
  const status = chessPositionStatus(chessBoard, toMove);
  const sideKo = toMove === 'w' ? '백' : '흑';
  const winnerKo = toMove === 'w' ? '흑' : '백';
  if (status === 'checkmate') {
    chessGameOver = true;
    gameLog.push({mode: 'chess', action: 'checkmate', loser: toMove, winner: toMove === 'w' ? 'b' : 'w', ts: Date.now()});
    updateStatus(`체크메이트! ${winnerKo} 승리 — ${sideKo} 킹이 잡혔습니다. (초기화로 재시작)`);
    autoSave();
    setTimeout(() => alert(`♚ 체크메이트! ${winnerKo}의 승리입니다.\n${sideKo}은(는) 킹을 지킬 합법 수가 없습니다.\n초기화 버튼으로 새 게임을 시작하세요.`), 80);
    try { if (window.legionTrack) window.legionTrack('activate'); } catch (e) {}
    showShareBanner('chess-win', { margin: 'checkmate', winner: winnerKo }, `♚ 체크메이트! ${winnerKo} 승리`);
    setTimeout(endGameAndStudy, 400);
    return true;
  }
  if (status === 'stalemate') {
    chessGameOver = true;
    gameLog.push({mode: 'chess', action: 'stalemate', side: toMove, ts: Date.now()});
    updateStatus(`스테일메이트 — 무승부. ${sideKo}은(는) 체크가 아니지만 둘 수가 없습니다.`);
    autoSave();
    setTimeout(() => alert(`½ 스테일메이트 (무승부).\n${sideKo}은(는) 체크 상태는 아니지만 합법적인 수가 하나도 없습니다.`), 80);
    showShareBanner('chess-draw', {}, '½ 스테일메이트 — 무승부');
    setTimeout(endGameAndStudy, 400);
    return true;
  }
  if (status === 'check') {
    updateStatus(`체크! ${sideKo} 킹이 공격받고 있습니다 — 반드시 방어하세요. (${sideKo} 턴)`);
    return false;
  }
  return false;
}

function resetChess() {
  chessBoard = []; // force fresh starting position
  chessGameOver = false;
  selected = null;
  legalTargets = [];
  lastChessMove = null;
  if (typeof hideShareBanner === 'function') hideShareBanner();
  initChess();
  fusionBuff.chessPower = 0;
  puzzleActive = false;
  puzzleSolution = null;
  // Preserve gameLog for study insights (ALWAYS LEARNING)
  renderFusionMiniChess();
  updateStatus();
  updateFusionBuffsUI();
  autoSave();
}

// --- GO AI — upgraded: real captures, atari pressure, avoids self-atari/suicide,
//     and plays with contact (near existing stones) instead of scattering blindly. ---
function aiGoMove() {
  if (goCurrentPlayer !== 2 || puzzleActive) return; // player black=1, AI white
  const moves = [];
  // Only scan empty points that touch a stone (contact play) plus a sparse
  // sampling of open points — keeps 19x19 fast while playing sensibly.
  const board = goBoard;
  for (let y=0; y<19; y++) for (let x=0; x<19; x++) {
    if (board[y][x] !== 0) continue;
    // Skip suicidal points entirely (would self-capture for no gain).
    if (isSuicideGo(x, y, 2)) continue;

    // Test on a copy so heuristics are exact and side-effect free.
    const b = board.map(r => r.slice());
    b[y][x] = 2;
    // Resolve captures of black on the copy.
    let captured = 0;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy;
      if (nx<0||nx>=19||ny<0||ny>=19) continue;
      if (b[ny][nx]===1 && groupLiberties(b, nx, ny)===0) {
        // flood-remove that black group, counting stones
        const stack=[[nx,ny]];
        while (stack.length){
          const [cx,cy]=stack.pop();
          if (b[cy][cx]!==1) continue;
          b[cy][cx]=0; captured++;
          for (const [ex,ey] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const px=cx+ex, py=cy+ey;
            if (px>=0&&px<19&&py>=0&&py<19&&b[py][px]===1) stack.push([px,py]);
          }
        }
      }
    }

    // Liberties of our own resulting group (avoid self-atari).
    const ownLibs = groupLiberties(b, x, y);
    if (ownLibs === 0) continue; // shouldn't happen (suicide filtered) but guard

    // Atari bonus: does this move reduce an adjacent BLACK group to 1 liberty?
    let atari = 0;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy;
      if (nx<0||nx>=19||ny<0||ny>=19) continue;
      if (b[ny][nx]===1 && groupLiberties(b, nx, ny)===1) atari++;
    }

    // Contact: number of adjacent stones (either color) — reward engaged play.
    let contact = 0;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy;
      if (nx>=0&&nx<19&&ny>=0&&ny<19 && goBoard[ny][nx]!==0) contact++;
    }

    let score = captured*15 + atari*4 + Math.min(ownLibs,4)*1.2 + contact*0.9;
    // Mild center pull early; avoid the very first-line edges when scattering.
    const edge = Math.min(x, 18-x) + Math.min(y, 18-y);
    if (edge >= 2) score += 0.5;
    // Penalize self-atari (own group left with a single liberty) heavily.
    if (ownLibs === 1 && captured === 0) score -= 6;
    score += Math.random()*0.8; // small variety, never overriding a capture
    moves.push({x, y, score});
  }

  let chosen = null;
  if (moves.length) {
    moves.sort((a,b)=> b.score - a.score);
    // pick among near-top for slight non-determinism
    const top = moves.filter(m => m.score >= moves[0].score - 0.6);
    chosen = top[Math.floor(Math.random()*top.length)];
  }
  if (!chosen) {
    goCurrentPlayer = 1;
    gameLog.push({mode:'go', action:'ai-pass'});
    updateStatus(); autoSave(); return;
  }
  goBoard[chosen.y][chosen.x] = 2;
  lastGoMove = [chosen.x, chosen.y];
  gameLog.push({mode:'go', x:chosen.x, y:chosen.y, player:2, ai:true});
  const bef = countStones();
  captureGoGroups(1);
  const aft = countStones();
  if (bef > aft) gameLog.push({mode:'go', action:'capture', count: bef-aft, by:2});
  renderGo();
  goCurrentPlayer = 1;
  updateStatus();
  autoSave();
  renderFusionMiniGo();
  updateFusionBuffsUI();
}

function countStonesForColor(c) { let n=0; for(let y=0;y<19;y++)for(let x=0;x<19;x++)if(goBoard[y][x]===c)n++; return n; }
function countRoughLiberties(x,y,color) {
  const vis = Array(19).fill().map(()=>Array(19).fill(false));
  const ls = new Set();
  const ds = [[1,0],[-1,0],[0,1],[0,-1]];
  function d(cx,cy){
    if(cx<0||cx>=19||cy<0||cy>=19||vis[cy][cx])return;
    vis[cy][cx]=true;
    if(goBoard[cy][cx]===0){ls.add(cx+','+cy);return;}
    if(goBoard[cy][cx]!==color)return;
    for(let [dx,dy]of ds) d(cx+dx,cy+dy);
  }
  d(x,y); return ls.size;
}

// --- FUSION (LIVE cross-buffs, mini synced boards) ---
function initFusion() {
  const goContainer = document.getElementById('fusion-go');
  const chessContainer = document.getElementById('fusion-chess');
  goContainer.innerHTML = '';
  chessContainer.innerHTML = '';

  // Actual live mini Go board (synced to main goBoard state)
  const miniGo = document.createElement('div');
  miniGo.id = 'fusion-go-grid';
  miniGo.className = 'mini-board';
  miniGo.style.cssText = 'display:grid; gap:0; background:#654321; padding:3px; border:2px solid #3d2914; width:fit-content; margin:4px auto;';
  goContainer.appendChild(miniGo);

  // Actual live mini Chess board (synced to main chessBoard)
  const miniChess = document.createElement('div');
  miniChess.id = 'fusion-chess-grid';
  miniChess.className = 'mini-board';
  miniChess.style.cssText = 'display:grid; gap:0; background:#654321; padding:2px; border:2px solid #3d2914; width:fit-content; margin:4px auto;';
  chessContainer.appendChild(miniChess);

  // Legacy status kept for compat (below boards)
  const goStatus = document.createElement('div');
  goStatus.id = 'fusion-go-status';
  goStatus.style.cssText = 'font-size:11px; background:#1a1a2e; padding:4px; margin:4px 0; border-radius:3px;';
  goContainer.appendChild(goStatus);

  const chessStatus = document.createElement('div');
  chessStatus.id = 'fusion-chess-status';
  chessStatus.style.cssText = 'font-size:11px; background:#1a1a2e; padding:4px; margin:4px 0; border-radius:3px;';
  chessContainer.appendChild(chessStatus);

  // Buttons for influence (still useful for quick cross without full switch)
  const goBtn = document.createElement('button');
  goBtn.textContent = 'Go 착수 (영향력)';
  goBtn.onclick = () => { placeGoStone(Math.floor(Math.random()*19), Math.floor(Math.random()*19), null); renderFusionMiniGo(); updateFusionStatus(); updateFusionBuffsUI(); saveP4(); };
  goContainer.appendChild(goBtn);

  const chessBtn = document.createElement('button');
  chessBtn.textContent = 'Chess 수 (영향력)';
  chessBtn.onclick = () => { simulateChessMoveForFusion(); renderFusionMiniChess(); updateFusionStatus(); updateFusionBuffsUI(); saveP4(); };
  chessContainer.appendChild(chessBtn);

  // Initial live render of actual boards
  renderFusionMiniGo();
  renderFusionMiniChess();
  updateFusionStatus();
  updateFusionBuffsUI();
}

function renderFusionMiniGo() {
  const grid = document.getElementById('fusion-go-grid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(19, 8px)`;
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      const cell = document.createElement('div');
      cell.style.cssText = 'width:8px;height:8px;background:#c4a484;position:relative;';
      const val = goBoard[y] && goBoard[y][x];
      if (val) {
        const stone = document.createElement('div');
        stone.style.cssText = `position:absolute;top:1px;left:1px;width:6px;height:6px;border-radius:50%;background:${val===1?'#222':'#eee'};`;
        cell.appendChild(stone);
      }
      grid.appendChild(cell);
    }
  }
}

function renderFusionMiniChess() {
  const grid = document.getElementById('fusion-chess-grid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(8, 14px)`;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const cell = document.createElement('div');
      cell.style.cssText = `width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:10px;background:${(x+y)%2===0?'#f0d9b5':'#b58863'};`;
      const piece = chessBoard[y] && chessBoard[y][x];
      if (piece && PIECE_SYMBOLS[piece]) {
        cell.textContent = PIECE_SYMBOLS[piece];
        cell.style.color = piece[0] === 'w' ? '#fff' : '#222';
      }
      grid.appendChild(cell);
    }
  }
}

function updateFusionBuffsUI() {
  // Update the Legion UI elements (added in index)
  const buffsEl = document.getElementById('fusion-buffs');
  const fomoEl = document.getElementById('fusion-fomo');
  const power = fusionBuff.chessPower || 0;
  const bonus = fusionBuff.goBonus || 0;
  if (buffsEl) {
    buffsEl.innerHTML = `체스→바둑 보너스 대기: <b>${bonus}</b> | 바둑→체스 파워: <b>${power}</b> (실시간 교차)`;
  }
  if (fomoEl) {
    fomoEl.textContent = `오늘의 퓨전 기회: ${fusionPlaysLeft}회 남음`;
    if (fusionPlaysLeft <= 1) fomoEl.style.color = '#ff4444';
  }
}

function updateFusionStatus() {
  const goSt = document.getElementById('fusion-go-status');
  const chessSt = document.getElementById('fusion-chess-status');
  if (!goSt || !chessSt) return;
  const goPlaced = countStones ? countStones() : gameLog.filter(l => l.mode === 'go' && !l.action).length;
  goSt.innerHTML = `Go live stones: ${goPlaced} | 보너스: ${fusionBuff.goBonus || 0}`;
  const chessMoves = gameLog.filter(l => l.mode === 'chess').length;
  chessSt.innerHTML = `Chess 영향: ${chessMoves}수 | 파워 버프: ${fusionBuff.chessPower || 0}`;
}

function simulateChessMoveForFusion() {
  // Simulate "good" recent chess move for cross
  gameLog.push({mode: 'chess', from: [0,0], to: [1,1], quality: 'good'});
  if (Math.random() > 0.35) fusionBuff.goBonus = (fusionBuff.goBonus || 0) + 1;
  renderFusionMiniChess();
  autoSave();
}

function playFusionMove() {
  // FOMO limited window (Legion scarcity) — polish live
  if (fusionPlaysLeft <= 0) {
    alert('오늘의 퓨전 기회를 모두 사용했습니다. 내일 다시 채워지며, 바둑/체스를 플레이하면 버프를 모을 수 있어요.');
    return;
  }
  fusionPlaysLeft = Math.max(0, fusionPlaysLeft - 1);
  updateFusionBuffsUI();

  // p6 DNA: feed breath from current tension, calc surprise for fusion power
  const tension = (fusionBuff.goBonus || 0) + (fusionBuff.chessPower || 0) * 0.6 + (countStones() % 7) * 0.1;
  const surprise = feedP4Breath(tension * 0.018);
  // birth if 창발 ache
  birthAcheBreathEmergent('fusion-move');

  // Recent chess "good moves" from gameLog (recent + quality/capture count as good)
  const recentChess = gameLog.filter(l => l.mode === 'chess').slice(-6);
  const chessCount = recentChess.length;
  let applied = false;

  if (chessCount > 0) {
    // REAL stones to goBoard (live, linked state)
    // Legion variable bonus (near-miss style) + p6 BREATH/SURPRISE POWER
    let base = Math.min(4, Math.max(1, Math.floor(chessCount / 1.5) + (fusionBuff.goBonus || 0)));
    const sBoost = 1 + surprise * 2.2; // fusion moves powered by breath/spore surprise
    let bonus = Math.floor(base * sBoost);
    const r = Math.random();
    if (r < 0.12) bonus = Math.min(6, Math.floor(bonus + 2)); // rare jackpot
    else if (r < 0.28) bonus = Math.floor(bonus + 1);
    else if (r > 0.82) bonus = Math.max(1, Math.floor(bonus - 1)); // near-miss
    // else normal

    let added = 0;
    for (let i = 0; i < bonus; i++) {
      let placed = false;
      for (let t = 0; t < 25 && !placed; t++) { // edge: prevent infinite on full board
        const x = Math.floor(Math.random() * 19);
        const y = Math.floor(Math.random() * 19);
        if (goBoard[y] && goBoard[y][x] === 0) {
          goBoard[y][x] = goCurrentPlayer;
          added++;
          placed = true;
        }
      }
    }
    if (added > 0) {
      // render live main if visible
      if (!document.getElementById('go-board').classList.contains('hidden')) {
        renderGo();
      }
      // always live mini
      renderFusionMiniGo();
      gameLog.push({mode: 'fusion', action: 'chess_to_go', bonus: added, variable: bonus});
      // no alert spam: use console + status
      console.log(`[Fusion Live] Chess good moves → added ${added} real Go stones (var ${bonus})`);
      fusionBuff.goBonus = Math.max(0, (fusionBuff.goBonus || 0) - 1);
      applied = true;
    }
  }

  // Go territory (real count from board) → real chessBuff
  const goTerritory = countStones ? countStones() : gameLog.filter(l => l.mode === 'go' && !l.action).length;
  if (goTerritory > 1) {
    // real buff: numeric power level for AI/player use + highlight
    const buffGain = Math.min(4, Math.max(1, Math.floor(goTerritory / 4) + (Math.random() < 0.3 ? 1 : 0)));
    fusionBuff.chessPower = (fusionBuff.chessPower || 0) + buffGain;
    gameLog.push({mode: 'fusion', action: 'go_to_chess', buff: buffGain, power: fusionBuff.chessPower});
    // live highlight on chess will show when switch or re-render
    renderFusionMiniChess();
    if (!document.getElementById('chess-board').classList.contains('hidden')) {
      renderChess();
    }
    console.log(`[Fusion Live] Go territory ${goTerritory} → +${buffGain} chessPower (real buff applied)`);
    applied = true;
  }

  if (!applied) {
    // first-shot edge: empty boards - still allow small starter
    if (chessCount === 0 && goTerritory === 0) {
      // seed one stone for demo first-shot
      goBoard[9][9] = 1;
      renderFusionMiniGo();
      gameLog.push({mode:'fusion', action:'first-shot-seed'});
      console.log('[Fusion] First-shot edge handled: seeded starter stone');
    }
  }

  // Update UI with current buffs (live)
  updateFusionStatus();
  updateFusionBuffsUI();
  updateStreakOnPlay();
  saveP4();

  // Optionally trigger study insight prompt (Legion ALWAYS LEARNING)
  if (Math.random() < 0.35) {
    const insight = prompt('Fusion cross-buff insight? (optional - record for study)');
    if (insight && insight.trim()) {
      gameLog.push({mode: 'study', text: insight, context: 'fusion'});
      saveP4();
    }
  }

  console.log('%c[GoChess Learning] Fusion FULL LIVE cross-buffs. Chess good→real Go stones + Go territory→real chessBuff+highlight. ALWAYS LEARNING.', 'color:#4a9eff');
}

function showStudyP4() {
  showStudy(true); // unified strong ALWAYS LEARNING
}

function hideStudy() {
  const p = document.getElementById('study-panel');
  if (p) p.classList.add('hidden');
}

function recordUserInsight() {
  const k = prompt('⚡ 이번 플레이에서 얻은 개인 깨달음을 적어보세요:') || '(생략)';
  gameLog.push({mode:'study', userInsight: k, forced:true, ts:Date.now()});
  autoSave();
  alert('깨달음을 기록했습니다. 다음 복기에 반영됩니다.');
  // refresh current if open
  const panel = document.getElementById('study-panel');
  if (panel && !panel.classList.contains('hidden')) showStudy(true);
}

function showFullStudyLog() {
  const w = window.open('', '_blank');
  w.document.write(`<pre style="background:#111;color:#0f0;padding:16px;white-space:pre-wrap;">${JSON.stringify(gameLog.filter(l=>l.mode==='study'||l.mode==='puzzle'), null, 2)}</pre>`);
}

function endGameAndStudy() {
  // Legion: force post-game 2-3 insights always on end
  updateStatus('게임 종료 — 복기 분석 중...');
  setTimeout(() => {
    showStudy(true);
    // auto force a learning record
    gameLog.push({mode:'study', auto:'endGameTrigger', ts:Date.now()});
    autoSave();
  }, 120);
}

// --- Daily Puzzle (FOMO + ALWAYS LEARNING) ---
function generatePuzzle() {
  // Static capture opportunity: white pawn captures unprotected black pawn (simple reliable)
  puzzleActive = true;

  chessBoard = Array(8).fill().map(() => Array(8).fill(''));
  chessBoard[3][3] = 'bp'; // black pawn at d5 (target)
  chessBoard[4][2] = 'wp'; // white pawn at c4 ready to capture diag
  chessBoard[7][4] = 'wk';
  chessBoard[0][4] = 'bk';

  chessCurrentPlayer = 'w';
  // Solution: from c4 (col2,row4) -> d5 (col3,row3)
  puzzleSolution = { from:[2,4], to:[3,3], type:'capture' };

  const grid = document.getElementById('chess-grid');
  if (grid) {
    if (!grid.children.length || grid.children.length < 64) {
      initChess(true); // rebuilds using our board
    }
    renderChess();
  }
  updateStatus('오늘의 퍼즐 시작! 백 폰으로 흑 폰 포획 (c4→d5).');
  alert('오늘의 퍼즐: c4 백 폰으로 d5 흑 폰을 포획하세요! (연속 출석 기회)');
  autoSave();
}

function checkPuzzleSolution(from, to) {
  if (!puzzleActive || !puzzleSolution) return;
  const match = from[0]===puzzleSolution.from[0] && from[1]===puzzleSolution.from[1] &&
                to[0]===puzzleSolution.to[0] && to[1]===puzzleSolution.to[1];
  if (match) {
    puzzleActive = false;
    const s = getStreak();
    alert(`✅ 퍼즐 성공! 연속 출석 보너스 +1. 오늘 ${s.count}수. 포획 기회를 잘 포착했어요!`);
    gameLog.push({mode:'puzzle', solved: true, ts: Date.now()});
    autoSave();
    try { if (window.legionTrack) window.legionTrack('activate'); } catch (e) {}
    showShareBanner('puzzle', {}, '✅ 오늘의 퍼즐 클리어!');
    // Reset to normal play board after solve (or keep)
    setTimeout(() => {
      if (currentMode === 'chess') initChess();
    }, 1200);
  } else {
    // allow retry or wrong move continue
    console.log('[p4 puzzle] not solution move');
  }
}

function startDailyPuzzle() {
  switchMode('chess');
  setTimeout(() => {
    generatePuzzle();
  }, 60);
}

// 전략 코치 — 한 수 조언을 복기 노트에 기록
function crossLinkP3() {
  const coach = ['전략 코치', '노장 기사', '수읽기 도우미'][Math.floor(Math.random()*3)];
  const insight = `${coach}: "퓨전에서는 한쪽을 내주고 다른 쪽을 키우는 타이밍이 핵심입니다. 상대의 리듬을 흔들어 주도권을 잡으세요."`;
  gameLog.push({mode:'study', mentorInsight: insight, ts:Date.now()});
  autoSave();
  alert('전략 코치 조언을 공부 모드에 기록했습니다.');
  // show study to surface
  setTimeout(()=> showStudy(true), 400);
}

// --- Study / Learning Mode (ALWAYS LEARNING) - upgraded strong version + inline UI ---
function showStudy(fromP4 = false) {
  const total = gameLog.length;
  const panel = document.getElementById('study-panel');
  const content = document.getElementById('study-content');
  if (total === 0) {
    const msg = '아직 플레이 기록이 없습니다. 바둑/체스/퓨전을 먼저 플레이하세요.\n첫 게임 후 자동 인사이트 2-3개와 개인 깨달음을 기록할 수 있어요.';
    alert(msg);
    if (content) content.textContent = msg;
    if (panel) panel.classList.remove('hidden');
    return;
  }

  // Auto-generate 2-3+ insights from gameLog (ALWAYS LEARNING core)
  const goMoves = gameLog.filter(l => l.mode === 'go' && !l.action).length;
  const chessMoves = gameLog.filter(l => l.mode === 'chess' && !l.action).length;
  const fusionCount = gameLog.filter(l => l.mode === 'fusion').length;
  const goCaptures = gameLog.filter(l => l.mode === 'go' && l.action === 'capture').reduce((a,l)=>a+(l.count||1), 0);
  const chessCaptures = gameLog.filter(l => l.mode === 'chess' && l.action === 'capture').length;
  const studyEntries = gameLog.filter(l => l.mode === 'study').length;
  const puzzlesSolved = gameLog.filter(l => l.mode === 'puzzle' && l.solved).length;
  const aiGames = gameLog.filter(l => (l.ai || (l.mode==='chess'&&l.ai===true))).length;

  const insights = [];
  insights.push(`1. 교차 전략: 바둑 ${goMoves}수 + 체스 ${chessMoves}수. 퓨전 ${fusionCount}회 사용. 영향력 교환(체스→바둑 돌 / 바둑→체스 파워)이 핵심 레버입니다.`);
  if (goCaptures + chessCaptures > 0) {
    insights.push(`2. 포획: 총 ${goCaptures + chessCaptures}회 (바둑 ${goCaptures} / 체스 ${chessCaptures}). 아슬아슬한 승부의 압박을 체감. 대국 ${aiGames}회.`);
  } else {
    insights.push(`2. 포지션/영역: 포획이 적었습니다. 중앙·영토 확보와 활로(자유도) 관리가 다음 승리 공식입니다.`);
  }
  insights.push(`3. 퓨전 활용: ${fusionCount > 1 ? '퓨전 교차 버프가 승리 가속기입니다. 한쪽에서 성공하면 즉시 다른 보드를 강화하세요.' : '퓨전을 적게 썼습니다. 남은 기회를 적극 활용해 두 보드를 연결해 보세요.'}`);
  if (puzzlesSolved > 0) insights.push(`4. 오늘의 퍼즐: ${puzzlesSolved}회 해결. 연속 출석이 잘 이어지고 있습니다.`);
  // 복기 노트: 상황에 맞는 한 줄 코멘트 자동 추가
  const sNow = calcP4Surprise();
  if (sNow > 0.1) {
    const v = synthesizeVoiceEcho(sNow);
    insights.push(`복기: ${v.text}`);
    p4VoiceEchoes.push(v);
  }
  const autoBlock = insights.slice(0,3).join('\n'); // force 2-3 core
  // birth emergent on high ache
  birthAcheBreathEmergent('post-study');

  // ALWAYS FORCE record 2-3 auto insights + context
  const autoRecord = {
    mode: 'study',
    autoInsights: insights,
    stats: {go:goMoves, chess:chessMoves, fusion:fusionCount, captures:goCaptures+chessCaptures, puzzles:puzzlesSolved},
    forcedPostGame: true,
    ts: Date.now()
  };
  // avoid duplicate spam: only append if last not identical recent
  const last = gameLog[gameLog.length-1];
  if (!last || last.mode !== 'study' || !last.forcedPostGame) {
    gameLog.push(autoRecord);
  }

  // User force 깨달음 (if not just recorded in panel flow)
  // For inline we defer to button, but for direct call still prompt once
  let userKk = last && last.user ? last.user : '';
  if (!fromP4 || !userKk) {
    userKk = prompt('⚡ 이번 게임에서 얻은 개인 깨달음을 한 줄로 적어보세요') || '(다음엔 반드시 입력)';
    if (userKk && userKk !== '(다음엔 반드시 입력)') {
      gameLog.push({mode:'study', user: userKk, ts:Date.now()});
    }
  }
  autoSave();

  const studyHtml = `=== GoChess 복기 노트 ===\n` +
    `총 기록 ${total} | 바둑:${goMoves} 체스:${chessMoves} 퓨전:${fusionCount} | 연속출석:${getStreak().days} | 퍼즐:${puzzlesSolved}\n\n` +
    `=== 자동 인사이트 (2-3개) ===\n${autoBlock}\n\n` +
    `=== 최근 내 깨달음 ===\n${userKk || '(기록 버튼으로 입력)'}\n\n` +
    `이전 복기: ${studyEntries}회 | 남은 퓨전 기회: ${fusionPlaysLeft}\n` +
    `최근 기록: ${JSON.stringify(gameLog.slice(-4), null, 1)}`;

  // Inline UI (primary)
  if (content) content.textContent = studyHtml;
  if (panel) panel.classList.remove('hidden');

  // Also keep window for full export (prod ready)
  if (!fromP4) {
    const win = window.open('', '_blank');
    win.document.write(`<pre style="white-space:pre-wrap;font-family:monospace;background:#111;color:#0f0;padding:16px;line-height:1.4;">${studyHtml}</pre>`);
    win.document.title = 'GoChess 복기 노트';
  }
  updateStatus('복기 기록 완료');
}

// === p6 Voice Echo Notebook (study mode full advance) ===
// voice echo insights in study mode from p6: use surprise + ache to synthesize "spoken" reflections
// fusion moves powered by breath/spore surprise already wired
// Vitruvian + sfumato in eye viz + notebook
function showP6VoiceEcho() {
  const panel = document.getElementById('study-panel');
  const content = document.getElementById('study-content');
  const s = calcP4Surprise();
  const voiceInsight = synthesizeVoiceEcho(s);
  p4VoiceEchoes.push(voiceInsight);
  gameLog.push({mode:'study', voiceEcho: voiceInsight, ts:Date.now()});
  autoSave();

  const echoText = `=== 복기 노트 — 오늘의 한 수 ===\n\n${voiceInsight.text}\n\n다시 볼 때마다 새로운 깨달음이 보입니다.\n\n최근 메모:\n${p4VoiceEchoes.slice(-3).map(e=>e.text).join('\n---\n')}`;

  if (content) content.textContent = echoText;
  if (panel) panel.classList.remove('hidden');
  updateStatus('복기 노트에 오늘의 한 수를 기록했습니다');
}

function synthesizeVoiceEcho(surprise) {
  const base = [
    '이 수에서 영역이 살아나기 시작했다. 서두르지 말고 길게 보자.',
    '상대가 흔들릴 때 오히려 내 형세가 편안해졌다. 그게 승부처였다.',
    '거의 놓칠 뻔한 수 — 그 아쉬움이 다음 판을 키운다.',
    '퓨전에서 한쪽을 내주니 다른 쪽이 저절로 커졌다. 균형의 묘.',
  ];
  let txt = base[Math.floor(Math.random()*base.length)];
  if (surprise > 0.25) txt += ' 잠시 멈춰 판 전체를 바라보니 새로운 길이 보였다.';
  if (p4Spore.ache > 1) txt += ' 아쉬운 순간이 사실은 가장 큰 배움이다.';
  return { text: txt, surprise: surprise.toFixed(3), ts: Date.now() };
}

// Vitruvian board proportion helper (call on render if needed for layout hints)
function applyVitruvianProportion(el) {
  if (!el) return;
  el.style.width = '61.8%';
  el.style.margin = '0 auto';
}

// ============================================================
// 결과 공유 (바이럴 루프) — 유저용 깔끔한 공유 기능
// navigator.share(모바일 네이티브) → 실패시 클립보드 복사 + 토스트.
// 텍스트: 결과 요약 + 호기심 훅 + URL + 해시태그. 정직·친구톤·엔터테인먼트.
// 내부 크로스로직(p6/fusion 등)은 건드리지 않고, 유저 공유는 여기 신규 함수만 사용.
// ============================================================
const GOCHESS_URL = 'https://hosuman08-netizen.github.io/gochess/';

// 결과별 매력적인 공유 문안 생성 (과장·가짜수치 없이, 실제 결과만 요약)
function buildShareText(kind, data = {}) {
  data = data || {};
  const s = getStreak();
  const streakTail = (s.days > 1) ? ` (🔥 연속 ${s.days}일째)` : '';
  let line;
  switch (kind) {
    case 'chess-win':
      line = `체스에서 ${data.margin === 'checkmate' ? '체크메이트로 한 판 이겼다' : '한 판 이겼다'}! 바둑이랑 체스를 한 화면에서 두는 게임인데 은근 중독됨.`;
      break;
    case 'go-win': {
      const who = data.winner ? `${data.winner} 승` : '한 판 마무리';
      const diff = (data.diff != null) ? ` (${Math.abs(data.diff).toFixed(1)}집 차)` : '';
      line = `바둑 한 판 끝! 결과는 ${who}${diff}. 바둑+체스를 같이 두는 게임 발견했는데 판 짜는 재미가 있다.`;
      break;
    }
    case 'go-draw':
      line = `바둑 한 판 무승부로 끝! 아슬아슬했다. 바둑이랑 체스를 한 화면에서 두는 게임.`;
      break;
    case 'chess-draw':
      line = `체스 스테일메이트 무승부! 킹 하나 못 움직여서 비겼다. 바둑+체스 한 판 게임.`;
      break;
    case 'puzzle':
      line = `오늘의 퍼즐 클리어! 한 수로 상대 기물 포획하는 문제였다. 매일 새 퍼즐 나옴.`;
      break;
    default:
      line = `바둑이랑 체스를 한 화면에서 두는 웹 게임 발견. 설치 없이 바로 됨.`;
  }
  const hashtags = { 'chess-win':'#체스 #바둑', 'chess-draw':'#체스', 'go-win':'#바둑', 'go-draw':'#바둑', 'puzzle':'#퍼즐 #체스' }[kind] || '#바둑 #체스';
  return `${line}${streakTail}\n너도 해봐 → ${GOCHESS_URL} ${hashtags}`;
}

// 가벼운 토스트 (복사됨 등). 자동 소멸, 되돌림 불필요.
function showToast(msg) {
  let t = document.getElementById('gc-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'gc-toast';
    t.className = 'gc-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// 클립보드 복사 (navigator.share 실패/미지원시 폴백)
async function copyShareText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast('공유 문구가 복사됐어요 · 붙여넣기 하면 끝!');
      return true;
    }
  } catch (e) { /* fall through to legacy */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('공유 문구가 복사됐어요 · 붙여넣기 하면 끝!');
    return true;
  } catch (e) {
    showToast('복사에 실패했어요. 문구를 길게 눌러 직접 복사해 주세요.');
    return false;
  }
}

// 유저용 결과 공유: 네이티브 공유 우선 → 실패시 복사 + 토스트
async function shareResult(kind, data = {}) {
  const text = buildShareText(kind, data);
  try { if (window.legionTrack) window.legionTrack('share'); } catch (e) {}
  if (navigator.share) {
    try {
      await navigator.share({ title: 'GoChess', text, url: GOCHESS_URL });
      return;
    } catch (e) {
      // 사용자가 취소한 경우엔 아무것도 안 함 (복사 폴백 생략)
      if (e && e.name === 'AbortError') return;
      // 그 외 실패는 복사로 폴백
    }
  }
  await copyShareText(text);
}

// X(트위터) 인텐트 — 옵션 공유 경로
function shareResultToX(kind, data = {}) {
  const text = buildShareText(kind, data);
  try { if (window.legionTrack) { window.legionTrack('share'); window.legionTrack('share_x'); } } catch (e) {}
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
  window.open(url, '_blank', 'noopener,noreferrer');
}

// 결과 배너를 띄워 공유 버튼 노출 (승리/무승부/퍼즐완료 공통)
function showShareBanner(kind, data = {}, headline) {
  const banner = document.getElementById('share-banner');
  const head = document.getElementById('share-headline');
  const shareBtn = document.getElementById('share-btn');
  const xBtn = document.getElementById('share-x-btn');
  if (!banner || !shareBtn) return;
  if (head && headline) head.textContent = headline;
  shareBtn.onclick = () => shareResult(kind, data);
  if (xBtn) xBtn.onclick = () => shareResultToX(kind, data);
  banner.classList.remove('hidden');
}

function hideShareBanner() {
  const banner = document.getElementById('share-banner');
  if (banner) banner.classList.add('hidden');
}

// Boot - load first for persistence + edge cases
window.onload = () => {
  const hadSave = loadP4();
  // Initial UI
  initGo(); // always build grid (data may be restored)
  if (currentMode === 'chess') {
    document.getElementById('go-board').classList.add('hidden');
    document.getElementById('chess-board').classList.remove('hidden');
    initChess(true);
  } else if (currentMode === 'fusion') {
    document.getElementById('go-board').classList.add('hidden');
    document.getElementById('chess-board').classList.add('hidden');
    document.getElementById('fusion-panel').classList.remove('hidden');
    initFusion();
  } else {
    document.getElementById('chess-board').classList.add('hidden');
    document.getElementById('fusion-panel').classList.add('hidden');
  }
  updateStatus(hadSave ? 'GoChess 이어하기 (기록 복원됨)' : 'GoChess 시작 • 첫 플레이');
  renderStreak();
  updateFusionBuffsUI(); // always init Legion buffs display
  console.log('%c[GoChess] 로드 완료.', 'color:#4a9eff');
};