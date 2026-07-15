// GoChess - p4 Prototype
// Legion ALWAYS LEARNING: every game produces insights

let currentMode = 'go';
let goBoard = Array(19).fill().map(() => Array(19).fill(0)); // 0 empty, 1 black, 2 white
let goCurrentPlayer = 1;
let chessBoard = []; // 8x8
let chessCurrentPlayer = 'w';
let gameLog = [];
let fusionBuff = { goBonus: 0, chessPower: 0 }; // chessPower now level number for real buff
// Da Vinci + full-cheat + ALWAYS (Morpheus/legion-agent-orchestrator): fusion = Vitruvian anatomy cross-buffs (proportions = power). Cast p5 synergy. Notebook insights auto. Variable near-miss FOMO limited plays. Sense UI.
let puzzleActive = false;
let puzzleSolution = null; // {from:[x,y], to:[x,y], type:'capture'}
// Legion FOMO fusion window
let fusionPlaysLeft = 5;
let goPassCount = 0; // for simple end game scoring

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

// Birth emergent: when high surprise + ache, "10th Glaze" (unpainted smile) insight spawns
function birthAcheBreathEmergent(context = '') {
  const s = p4Lung.lastSurprise || calcP4Surprise();
  if (s > 0.22 && p4Spore.ache > 1) {
    const glaze = {
      type: '10th-glaze',
      ts: Date.now(),
      surprise: s.toFixed(3),
      ache: p4Spore.ache,
      context,
      text: `창발: ${context}의 아픈 호흡 속에서 10번째 스모크가 스스로 피어남. (unpainted — 관찰만으로 나타남)`
    };
    p4VoiceEchoes.push(glaze);
    gameLog.push({mode:'study', emergent:'10th-glaze', ...glaze});
    console.log('%c[IGNIS p4×p6] EMERGENT BIRTH: 10th Glaze Ache-Breath Codex', 'color:#c5a46e');
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
  if (fomoEl) fomoEl.textContent = `Limited Fusion Window: ${fusionPlaysLeft} plays left (FOMO - scarcity)`;
  return s;
}
function renderStreak() {
  const s = getStreak();
  const el = document.getElementById('streak-display');
  if (el) el.textContent = `🔥 Streak: ${s.days}일 • 오늘 ${s.count}수 (FOMO)`;
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
  else el.textContent = `퓨전 모드 (LIVE cross-buffs • FOMO window ${fusionPlaysLeft})`;
  renderStreak();
}

// --- GO ---
function initGo() {
  const grid = document.getElementById('go-grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(19, 28px)`;

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
      stone.className = `stone ${val === 1 ? 'black' : 'white'}`;
      cell.appendChild(stone);
    }
  });
}

function placeGoStone(x, y, cell) {
  if (goBoard[y][x] !== 0) return;

  goBoard[y][x] = goCurrentPlayer;
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
    goPassCount = 0;
    setTimeout(endGameAndStudy, 300);
  }
  // AI respond if needed
  if (goCurrentPlayer === 2) setTimeout(aiGoMove, 300);
}

function resetGo() {
  goBoard = Array(19).fill().map(() => Array(19).fill(0));
  goCurrentPlayer = 1;
  fusionBuff.goBonus = 0;
  goPassCount = 0;
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
  grid.style.gridTemplateColumns = `repeat(8, 52px)`;

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
  cells.forEach(cell => {
    const x = +cell.dataset.x;
    const y = +cell.dataset.y;
    cell.innerHTML = '';
    cell.classList.remove('buffed');
    const piece = chessBoard[y][x];
    if (piece) {
      cell.textContent = PIECE_SYMBOLS[piece] || '?';
      cell.style.color = piece[0] === 'w' ? '#fff' : '#222';
    }
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

function handleChessClick(x, y, cell) {
  if (chessGameOver) return; // no play after checkmate/stalemate until reset
  const piece = chessBoard[y][x];

  if (selected) {
    const [sx, sy] = selected;
    if (isValidChessMove(sx, sy, x, y)) {
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
    } else {
      selected = null;
      renderChess();
    }
  } else if (piece && piece[0] === chessCurrentPlayer) {
    selected = [x, y];
    renderChess();
    cell.classList.add('selected');
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
    setTimeout(endGameAndStudy, 400);
    return true;
  }
  if (status === 'stalemate') {
    chessGameOver = true;
    gameLog.push({mode: 'chess', action: 'stalemate', side: toMove, ts: Date.now()});
    updateStatus(`스테일메이트 — 무승부. ${sideKo}은(는) 체크가 아니지만 둘 수가 없습니다.`);
    autoSave();
    setTimeout(() => alert(`½ 스테일메이트 (무승부).\n${sideKo}은(는) 체크 상태는 아니지만 합법적인 수가 하나도 없습니다.`), 80);
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

// --- GO AI (simple opponent: capture priority + random valid + basic liberty check) Legion upgrade ---
function aiGoMove() {
  if (goCurrentPlayer !== 2 || puzzleActive) return; // player black=1, AI white
  const captureMoves = [];
  const validMoves = [];
  for (let y=0; y<19; y++) for (let x=0; x<19; x++) {
    if (goBoard[y][x] !== 0) continue;
    // test place
    goBoard[y][x] = 2;
    const before = countStonesForColor(1);
    captureGoGroups(1);
    const after = countStonesForColor(1);
    const cap = before - after;
    goBoard[y][x] = 0; // revert for test (real capture on commit)
    if (cap > 0) {
      captureMoves.push({x, y, score: cap*12});
    } else {
      const libs = countRoughLiberties(x, y, 2);
      if (libs > 0) validMoves.push({x, y, score: libs + (Math.random()*1.5)});
    }
  }
  let chosen = null;
  if (captureMoves.length) {
    captureMoves.sort((a,b)=> b.score - a.score);
    chosen = captureMoves[0];
  } else if (validMoves.length) {
    validMoves.sort((a,b)=> b.score - a.score);
    chosen = validMoves[0]; // top biased
  }
  if (!chosen) {
    goCurrentPlayer = 1;
    gameLog.push({mode:'go', action:'ai-pass'});
    updateStatus(); autoSave(); return;
  }
  goBoard[chosen.y][chosen.x] = 2;
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
    buffsEl.innerHTML = `Chess→Go 보너스 대기: <b>${bonus}</b> | Go→Chess 파워: <b>${power}</b> (live cross) <span style="opacity:.6">| LungSurprise:${(p4Lung.lastSurprise||0).toFixed(2)}</span>`;
  }
  if (fomoEl) {
    fomoEl.textContent = `Limited Fusion Window: ${fusionPlaysLeft} plays left (FOMO - scarcity)`;
    if (fusionPlaysLeft <= 1) fomoEl.style.color = '#ff4444';
  }
  // p6 Lung Surprise Eye cross viz (sfumato golden eye on fusion panel if present)
  const fus = document.getElementById('fusion-panel');
  if (fus && !fus.classList.contains('hidden') && window.p6LungSurpriseEye) {
    // create tiny overlay canvas once
    let eyeC = document.getElementById('p6-eye-canvas');
    if (!eyeC) {
      eyeC = document.createElement('canvas');
      eyeC.id = 'p6-eye-canvas';
      eyeC.width = 180; eyeC.height = 42;
      eyeC.style.cssText = 'position:absolute;opacity:0.85;margin-left:8px;pointer-events:none;';
      fus.appendChild(eyeC);
    }
    const ectx = eyeC.getContext('2d');
    ectx.clearRect(0,0,eyeC.width,eyeC.height);
    // feed current lung to p6 eye (Vitruvian 0.618 + sfumato)
    window.p6LungSurpriseEye(ectx, eyeC.width, eyeC.height/2, p4Lung, (fusionBuff.chessPower||0)*0.2 + 0.6, p4Spore);
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
    alert('Fusion window CLOSED (FOMO limited). Daily reset or play main modes for more scarcity leverage.');
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
  const k = prompt('⚡ ALWAYS LEARNING: 이번 플레이 개인 깨달음 (강제 — Legion 업그레이드):') || '(생략)';
  gameLog.push({mode:'study', userInsight: k, forced:true, ts:Date.now()});
  autoSave();
  alert('깨달음 기록 완료. 다음 study에 반영.');
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
  updateStatus('게임 종료 — ALWAYS LEARNING 분석 중...');
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
  updateStatus('Daily Puzzle 활성! 백 폰으로 흑 폰 포획 (c4→d5).');
  alert('Daily Puzzle: c4 백 폰으로 d5 흑 폰 포획하세요! (FOMO streak 기회)');
  autoSave();
}

function checkPuzzleSolution(from, to) {
  if (!puzzleActive || !puzzleSolution) return;
  const match = from[0]===puzzleSolution.from[0] && from[1]===puzzleSolution.from[1] &&
                to[0]===puzzleSolution.to[0] && to[1]===puzzleSolution.to[1];
  if (match) {
    puzzleActive = false;
    const s = getStreak();
    alert(`✅ Puzzle Solved! +1 streak bonus. 오늘 ${s.count}수. ALWAYS LEARNING: 포획 기회 포착!`);
    gameLog.push({mode:'puzzle', solved: true, ts: Date.now()});
    autoSave();
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

// Cross-Legion p3 link + mentor insight injection (ALWAYS LEARNING synergy)
function crossLinkP3() {
  // Open p3 if possible (sibling), else simulate mentor
  try {
    const p3win = window.open('../p3-companion/index.html', '_blank');
    if (p3win) {
      // inject Legion cross note
      setTimeout(() => {
        try { p3win.focus(); } catch(e){}
      }, 800);
    }
  } catch(e) {}
  // ALWAYS inject p3-style mentor insight into current gameLog for study
  const mentor = ['Aria Voss (p3)', 'Selene Nyx', 'Bunny Spark'][Math.floor(Math.random()*3)];
  const insight = `${mentor} 전략 스승: "퓨전에서 한쪽을 희생해 다른쪽을 키우는 타이밍이 핵심. Variable ratio로 상대를 흔들라." (p3 cross-link)`;
  gameLog.push({mode:'study', mentorInsight: insight, from:'p3', ts:Date.now()});
  autoSave();
  alert('p3 AI Companion Mentor 호출됨 — 전략 스승 인사이트 gameLog + study에 기록. Cross-Legion ALWAYS LEARNING.');
  // show study to surface
  setTimeout(()=> showStudy(true), 400);
}

// --- Study / Learning Mode (ALWAYS LEARNING) - upgraded strong version + inline UI ---
function showStudy(fromP4 = false) {
  const total = gameLog.length;
  const panel = document.getElementById('study-panel');
  const content = document.getElementById('study-content');
  if (total === 0) {
    const msg = '아직 플레이 기록 없음. 바둑/체스/퓨전 먼저 플레이하세요.\nLegion ALWAYS LEARNING: 첫 게임 후 2-3 자동인사이트 + 강제 깨달음 기록 필수.';
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
  insights.push(`1. 교차 전략: Go ${goMoves}수 + Chess ${chessMoves}수. Fusion ${fusionCount}회 사용. 영향력 교환(Chess→Go stones / Go→Chess power)이 핵심 레버.`);
  if (goCaptures + chessCaptures > 0) {
    insights.push(`2. 포획/Variable: 총 ${goCaptures + chessCaptures} 포획 (Go ${goCaptures} / Chess ${chessCaptures}). Near-miss + scarcity로 압박 체감. AI 대국 ${aiGames}회.`);
  } else {
    insights.push(`2. 포지션/영역: 포획 적음. 중앙/영토 확보 + liberty 관리 = 다음 승리 공식.`);
  }
  insights.push(`3. Fusion + FOMO: ${fusionCount > 1 ? '퓨전 크로스 버프가 승리 가속기. 한쪽 성공 즉시 다른 보드 강화' : '퓨전 적게 씀. Limited playsLeft 적극 소모 + cross로 dominance.'} (ALWAYS LEARNING)`);
  if (puzzlesSolved > 0) insights.push(`4. Daily Puzzle: ${puzzlesSolved}회 해결. Streak + FOMO hook 강력 작동.`);
  // p6 cross DNA voice echo auto
  const sNow = calcP4Surprise();
  if (sNow > 0.1) {
    const v = synthesizeVoiceEcho(sNow);
    insights.push(`p6 Voice: ${v.text}`);
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
    userKk = prompt('⚡ ALWAYS LEARNING 강제: 개인 깨달음 1줄 기록 (Legion 자율 업그레이드)') || '(다음엔 반드시 입력)';
    if (userKk && userKk !== '(다음엔 반드시 입력)') {
      gameLog.push({mode:'study', user: userKk, ts:Date.now()});
    }
  }
  autoSave();

  const studyHtml = `=== GoChess STUDY (Legion ALWAYS LEARNING) ===\n` +
    `총 기록 ${total} | Go:${goMoves} Chess:${chessMoves} Fusion:${fusionCount} | Streak:${getStreak().days} | Puzzle:${puzzlesSolved}\n\n` +
    `=== 자동 인사이트 (2-3 강제) ===\n${autoBlock}\n\n` +
    `=== 최근 내 깨달음 ===\n${userKk || '(기록 버튼으로 강제 입력)'}\n\n` +
    `이전 study: ${studyEntries}회 | FOMO playsLeft: ${fusionPlaysLeft}\n` +
    `Raw 최근: ${JSON.stringify(gameLog.slice(-4), null, 1)}`;

  // Inline UI (primary)
  if (content) content.textContent = studyHtml;
  if (panel) panel.classList.remove('hidden');

  // Also keep window for full export (prod ready)
  if (!fromP4) {
    const win = window.open('', '_blank');
    win.document.write(`<pre style="white-space:pre-wrap;font-family:monospace;background:#111;color:#0f0;padding:16px;line-height:1.4;">${studyHtml}</pre>`);
    win.document.title = 'GoChess Study - ALWAYS LEARNING';
  }
  updateStatus('ALWAYS LEARNING 기록 완료 — Legion 강화됨');
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
  gameLog.push({mode:'study', voiceEcho: voiceInsight, fromP6: true, surprise: s, ts:Date.now()});
  autoSave();

  const echoText = `=== p6 Lung Echo Notebook (Voice + 창발) ===\nSurprise:${s.toFixed(3)} | Ache:${p4Spore.ache} | Wound:${p4Spore.wound.toFixed(2)}\n\n${voiceInsight.text}\n\nRe-listen evolves. 10th glaze births on deep ache.\n\n최근 Echoes:\n${p4VoiceEchoes.slice(-3).map(e=>e.text).join('\n---\n')}`;

  if (content) content.textContent = echoText;
  if (panel) panel.classList.remove('hidden');
  updateStatus('p6 Voice Echo 주입 — ALWAYS LEARNING notebook from voice');
}

function synthesizeVoiceEcho(surprise) {
  const base = [
    '이 수에서 영역이 숨을 쉬기 시작했다. 긴 호흡이 필요하다.',
    '상대가 아파할 때 내 숨이 편안해졌다. 그게 승리였다.',
    '거의 놓친 수 — 그 아픔이 spore가 되어 다음을 키운다.',
    '퓨전에서 한쪽을 포기하니 다른 쪽이 스스로 피어났다. 창발.',
  ];
  let txt = base[Math.floor(Math.random()*base.length)];
  if (surprise > 0.25) txt += ' (10th glaze: 관찰만으로 미소가 피어남 — Mona의 unpainted breath)';
  if (p4Spore.ache > 1) txt += ' Ache-Breath: 아픈 멈춤이 진짜 가르침.';
  return { text: txt, surprise: surprise.toFixed(3), ts: Date.now() };
}

// Vitruvian board proportion helper (call on render if needed for layout hints)
function applyVitruvianProportion(el) {
  if (!el) return;
  el.style.width = '61.8%';
  el.style.margin = '0 auto';
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
  updateStatus(hadSave ? 'GoChess 복원됨 (ALWAYS LEARNING)' : 'GoChess 시작 • 첫 플레이');
  renderStreak();
  updateFusionBuffsUI(); // always init Legion buffs display
  console.log('%c[Legion] p4 GoChess 로드. ALWAYS LEARNING + persistence + streak. Edge cases handled.', 'color:#4a9eff');
};