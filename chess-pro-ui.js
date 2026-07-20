/* ============================================================================
 * chess-pro-ui.js — 전문 체스 기능을 라이브 보드에 배선(기존 함수 override).
 * script.js(코어) + chess-pro.js(엔진) 이후 로드. Go/퓨전/공유/계측/p6는 보존.
 * 기존 shared globals(chessBoard, chessCurrentPlayer, selected, legalTargets,
 * lastChessMove, chessGameOver, gameLog, fusionBuff)를 그대로 사용/갱신한다.
 * ==========================================================================*/
(function () {
  var CP = window.ChessPro;
  if (!CP) return;

  // --- 검증 완료 퍼즐 라이브러리(엔진 perft/솔루션 검증됨) ---
  var PUZZLES = [
    { id: 'm1a', fen: '6k1/5ppp/8/8/8/8/8/R6K w - -', sol: ['a1a8'], theme: '메이트', rating: 800, t: '백랙 외통 — 한 수' },
    { id: 'm1b', fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - -', sol: ['d1d8'], theme: '메이트', rating: 850, t: '퀸 외통' },
    { id: 'm1g', fen: '7k/5Q2/6K1/8/8/8/8/8 w - -', sol: ['f7g7'], theme: '메이트', rating: 900, t: '퀸 코너 외통' },
    { id: 'm1d', fen: '6k1/8/6K1/8/8/8/8/3Q4 w - -', sol: ['d1d8'], theme: '메이트', rating: 1000, t: '킹+퀸 협공 외통' },
    { id: 'm1e', fen: '6rk/6pp/7N/8/8/8/8/6K1 w - -', sol: ['h6f7'], theme: '메이트', rating: 1300, t: '질식 메이트' },
    { id: 'hg1', fen: '4k3/8/8/3b4/4P3/8/8/4K3 w - -', sol: ['e4d5'], theme: '무료기물', rating: 700, t: '무방비 비숍 포획' },
    { id: 'hg2', fen: '4k3/8/8/2q5/8/8/2R5/4K3 w - -', sol: ['c2c5'], theme: '무료기물', rating: 800, t: '무방비 퀸 포획' },
    { id: 'fk1', fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - -', sol: ['d5c7'], theme: '포크', rating: 1000, t: '나이트 포크로 룩 획득' },
    { id: 'sk1', fen: '7k/8/8/8/8/q7/8/R3K3 w - -', sol: ['a1a3'], theme: '스큐어', rating: 900, t: '무방비 퀸 획득' },
    { id: 'pn1', fen: '3rk3/8/8/8/8/8/3R4/3RK3 w - -', sol: ['d2d8'], theme: '핀', rating: 1100, t: '핀으로 룩 획득' },
    { id: 'pr1', fen: '4k3/P7/8/8/8/8/8/4K3 w - -', sol: ['a7a8q'], theme: '승진', rating: 700, t: '폰을 퀸으로 승진' }
  ];
  var THEMES = ['전체', '메이트', '포크', '무료기물', '스큐어', '핀', '승진', '오답복습'];

  // --- 세션 상태 ---
  var S = {
    st: CP.freshState(),
    hist: [],          // {fenBefore, uci, san, color, cap}
    sans: [],          // SAN 배열(오프닝 탐지용)
    mode: 'game',      // 'game' | 'puzzle'
    bot: null,
    rated: false,      // 이 대국 레이팅 반영 여부(끝나면 true)
    snaps: [],         // 무르기용 스냅샷 {board, st}
    puzzle: null, theme: '전체', rush: null, pending: null
  };

  function uci(m) { return CP.sqName(m.sx, m.sy) + CP.sqName(m.tx, m.ty) + (m.promo || ''); }
  function clone(b) { return b.map(function (r) { return r.slice(); }); }
  function setBoard(nb) { for (var y = 0; y < 8; y++) chessBoard[y] = nb[y]; }
  function selectedBotId() { try { return localStorage.getItem('gc-opponent') || 'mir'; } catch (e) { return 'mir'; } }

  // 승률 근사(Lichess 상수) — 정확도 추정용
  function winP(cp) { cp = Math.max(-1000, Math.min(1000, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }

  // ============================ 렌더 ============================
  window.renderChess = function () {
    var cells = document.querySelectorAll('#chess-grid .cell');
    if (!cells.length) return;
    var mover = S.st.turn;
    var checked = CP.inCheck(chessBoard, mover) ? mover : null;
    var kpos = checked ? kingPosLocal(mover) : null;
    cells.forEach(function (cell) {
      var x = +cell.dataset.x, y = +cell.dataset.y;
      cell.innerHTML = '';
      cell.classList.remove('buffed', 'selected', 'move-hint', 'capture-hint', 'last-move', 'in-check', 'cp-hint');
      cell.style.boxShadow = '';
      var piece = chessBoard[y][x];
      if (piece) { cell.textContent = PIECE_SYMBOLS[piece] || '?'; cell.style.color = piece[0] === 'w' ? '#f4f4ee' : '#20242e'; }
      else cell.textContent = '';
      if (selected && selected[0] === x && selected[1] === y) cell.classList.add('selected');
      var hint = legalTargets.find(function (t) { return t.x === x && t.y === y; });
      if (hint) cell.classList.add(hint.capture ? 'capture-hint' : 'move-hint');
      if (lastChessMove) {
        var f = lastChessMove.from, tt = lastChessMove.to;
        if ((f[0] === x && f[1] === y) || (tt[0] === x && tt[1] === y)) cell.classList.add('last-move');
      }
      if (kpos && kpos[0] === x && kpos[1] === y) cell.classList.add('in-check');
      if (fusionBuff.chessPower > 0 && piece && piece[0] === 'w') { cell.classList.add('buffed'); }
    });
  };
  function kingPosLocal(c) { for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) if (chessBoard[y][x] === c + 'k') return [x, y]; return null; }

  // ============================ 보드 초기화 + 프로 UI 주입 ============================
  window.initChess = function (keepLoaded) {
    var grid = document.getElementById('chess-grid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
    if (!keepLoaded || !chessBoard || chessBoard.length !== 8 || !Array.isArray(chessBoard[0])) {
      newGame(true);
    } else {
      // 저장 복원: 캐슬링 권리는 홈 스퀘어 기준 추정
      S.st = CP.deriveState(chessBoard, chessCurrentPlayer || 'w');
      S.mode = 'game'; S.bot = CP.botById(selectedBotId());
    }
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var cell = document.createElement('div');
      cell.className = 'cell ' + ((x + y) % 2 === 0 ? 'light' : 'dark');
      cell.dataset.x = x; cell.dataset.y = y;
      cell.onclick = (function (cx, cy) { return function () { handleChessClick(cx, cy); }; })(x, y);
      grid.appendChild(cell);
    }
    injectProUI();
    renderChess();
    refreshHeader();
    updateOpening();
    updateEvalBar();
  };

  function newGame(silent) {
    setBoard(CP.newBoard());
    S.st = CP.freshState();
    chessCurrentPlayer = 'w'; chessGameOver = false;
    selected = null; legalTargets = []; lastChessMove = null;
    S.hist = []; S.sans = []; S.snaps = []; S.mode = 'game'; S.rated = false;
    S.bot = CP.botById(selectedBotId());
    puzzleActive = false;
    if (!silent) { renderChess(); refreshHeader(); updateOpening(); updateEvalBar(); if (typeof hideShareBanner === 'function') hideShareBanner(); hidePanel('cp-review'); hidePanel('cp-puzzle'); }
  }

  window.resetChess = function () {
    newGame(false);
    fusionBuff.chessPower = 0;
    if (typeof renderFusionMiniChess === 'function') renderFusionMiniChess();
    if (typeof updateStatus === 'function') updateStatus('새 대국 시작 — 백(나) 차례');
    if (typeof updateFusionBuffsUI === 'function') updateFusionBuffsUI();
    if (typeof autoSave === 'function') autoSave();
  };

  // ============================ 클릭/수 처리 ============================
  window.handleChessClick = function (x, y) {
    if (S.mode === 'puzzle') return puzzleClick(x, y);
    if (chessGameOver) return;
    if (S.st.turn !== 'w') return; // AI 차례엔 입력 무시
    var piece = chessBoard[y][x];
    if (selected) {
      var legal = CP.genLegal(chessBoard, S.st, 'w');
      var matches = legal.filter(function (m) { return m.sx === selected[0] && m.sy === selected[1] && m.tx === x && m.ty === y; });
      if (matches.length) {
        if (matches.length > 1 && matches[0].promo) { openPromo(matches); return; }
        applyLive(matches[0]);
      } else if (piece && piece[0] === 'w') {
        selected = [x, y]; legalTargets = targetsFor(x, y); renderChess();
      } else { selected = null; legalTargets = []; renderChess(); }
    } else if (piece && piece[0] === 'w') {
      selected = [x, y]; legalTargets = targetsFor(x, y); renderChess();
    }
  };
  function targetsFor(sx, sy) {
    return CP.genLegal(chessBoard, S.st, S.st.turn)
      .filter(function (m) { return m.sx === sx && m.sy === sy; })
      .map(function (m) { return { x: m.tx, y: m.ty, capture: !!m.cap }; });
  }

  function pushHist(m, color) {
    var san = CP.toSAN(chessBoard, S.st, m);
    S.hist.push({ fenBefore: CP.boardToFen(chessBoard, S.st), uci: uci(m), san: san, color: color, cap: m.cap });
    S.sans.push(san);
    return san;
  }

  function applyLive(m) {
    S.snaps.push({ board: clone(chessBoard), st: JSON.parse(JSON.stringify(S.st)) });
    var isCapture = !!m.cap;
    pushHist(m, 'w');
    var r = CP.applyMove(chessBoard, S.st, m);
    setBoard(r.b); S.st = r.st; chessCurrentPlayer = S.st.turn;
    lastChessMove = { from: [m.sx, m.sy], to: [m.tx, m.ty] };
    if (isCapture) gameLog.push({ mode: 'chess', action: 'capture', piece: m.cap, by: 'w' });
    gameLog.push({ mode: 'chess', from: [m.sx, m.sy], to: [m.tx, m.ty], capture: isCapture, san: S.sans[S.sans.length - 1] });
    selected = null; legalTargets = [];
    renderChess(); updateOpening(); updateEvalBar();
    // p6 숨결 + 퓨전 크로스버프 보존
    try { var s = feedP4Breath(isCapture ? 1.1 : 0.35); if (isCapture && s > 0.2) p4Spore.ache = Math.min(4, p4Spore.ache + 1); birthAcheBreathEmergent('chess-capture'); } catch (e) {}
    if (isCapture || Math.random() < 0.22) fusionBuff.goBonus = (fusionBuff.goBonus || 0) + (isCapture ? 2 : 1);
    if (fusionBuff.chessPower > 0) fusionBuff.chessPower = Math.max(0, fusionBuff.chessPower - (Math.random() < 0.6 ? 1 : 0));
    if (typeof renderFusionMiniChess === 'function') renderFusionMiniChess();
    if (typeof updateFusionBuffsUI === 'function') updateFusionBuffsUI();
    if (evaluateChessEnd()) { updateStreakOnPlay(); autoSave(); return; }
    updateStatus(); updateStreakOnPlay(); autoSave();
    setTimeout(aiChessMove, 430);
  }

  // ============================ AI (엔진 탐색 + 정석 북) ============================
  window.aiChessMove = function () {
    if (chessCurrentPlayer !== 'b' || S.mode === 'puzzle' || chessGameOver) return;
    var bot = S.bot || CP.botById(selectedBotId());
    var m = bookReply(bot) || CP.botChooseMove(chessBoard, S.st, bot);
    if (!m) { evaluateChessEnd(); return; }
    var isCapture = !!m.cap;
    S.snaps.push({ board: clone(chessBoard), st: JSON.parse(JSON.stringify(S.st)) });
    pushHist(m, 'b');
    var r = CP.applyMove(chessBoard, S.st, m);
    setBoard(r.b); S.st = r.st; chessCurrentPlayer = S.st.turn;
    lastChessMove = { from: [m.sx, m.sy], to: [m.tx, m.ty] };
    if (isCapture) gameLog.push({ mode: 'chess', action: 'capture', piece: m.cap, by: 'b' });
    gameLog.push({ mode: 'chess', from: [m.sx, m.sy], to: [m.tx, m.ty], capture: isCapture, ai: true, san: S.sans[S.sans.length - 1] });
    renderChess(); updateOpening(); updateEvalBar();
    if (typeof renderFusionMiniChess === 'function') renderFusionMiniChess();
    if (evaluateChessEnd()) { autoSave(); return; }
    updateStatus(); autoSave();
  };
  // 정석 북 응수(중급+ 봇, 변화 다양성 — 실제 이론 라인만)
  function bookReply(bot) {
    if (!bot || bot.rating < 1200 || S.sans.length > 11) return null;
    var op = CP.detectOpening(S.sans);
    if (!op || !op.next || !op.next.length) return null;
    var want = op.next[Math.floor(Math.random() * op.next.length)]; // 이론 후보 중 무작위(변화 다양성)
    var legal = CP.genLegal(chessBoard, S.st, S.st.turn);
    for (var i = 0; i < legal.length; i++) if (CP.toSAN(chessBoard, S.st, legal[i]) === want) return (Math.random() < 0.85 ? legal[i] : null);
    return null;
  }

  // ============================ 종료 판정 + 레이팅 + 공유 ============================
  window.evaluateChessEnd = function () {
    var toMove = S.st.turn;
    var status = CP.statusFor(chessBoard, S.st);
    var sideKo = toMove === 'w' ? '백' : '흑';
    var winnerKo = toMove === 'w' ? '흑' : '백';
    if (status === 'checkmate') {
      chessGameOver = true;
      gameLog.push({ mode: 'chess', action: 'checkmate', winner: toMove === 'w' ? 'b' : 'w', ts: Date.now() });
      var playerWon = (toMove === 'b'); // 백=사람
      finishRated(playerWon ? 1 : 0);
      updateStatus('체크메이트! ' + winnerKo + ' 승리 — ' + sideKo + ' 킹이 잡혔습니다.');
      if (playerWon) { try { if (window.legionTrack) window.legionTrack('activate'); } catch (e) {} }
      showEndBanner(playerWon ? 'chess-win' : 'chess-loss', { margin: 'checkmate', winner: winnerKo }, (playerWon ? '♚ 체크메이트! 승리' : '체크메이트 — 패배') );
      renderChess();
      return true;
    }
    if (status === 'stalemate') {
      chessGameOver = true;
      gameLog.push({ mode: 'chess', action: 'stalemate', ts: Date.now() });
      finishRated(0.5);
      updateStatus('스테일메이트 — 무승부.');
      showEndBanner('chess-draw', {}, '½ 스테일메이트 — 무승부');
      renderChess();
      return true;
    }
    if (status === 'check') { updateStatus('체크! ' + sideKo + ' 킹이 공격받고 있습니다.'); return false; }
    return false;
  };
  function finishRated(result) {
    if (S.mode !== 'game' || S.rated || !S.bot) return;
    S.rated = true;
    var r = CP.updateRating(result, S.bot.rating);
    refreshHeader();
    var delta = ''; // 표시는 코드와 일치 — 정직
    setTimeout(function () { refreshHeader(); }, 50);
  }
  function showEndBanner(kind, data, headline) {
    if (typeof showShareBanner === 'function') {
      // 패배는 공유배너 대신 조용히(자랑거리 아님) — 리뷰 유도
      if (kind === 'chess-loss') { updateStatus(headline + ' · 게임 리뷰로 복기해 보세요'); flash('cp-review-btn'); return; }
      showShareBanner(kind === 'chess-win' ? 'chess-win' : 'chess-draw', data, headline);
      try { if (!window._peakWinShare && kind === 'chess-win') { window._peakWinShare = 1; setTimeout(function () { var b = document.getElementById('share-btn'); if (b) b.style.outline = '2px solid #c9a227'; if (window.legionTrack) legionTrack('peak_win_share', {}); }, 700); } } catch (e) {}
    }
    flash('cp-review-btn');
  }

  // ============================ 승진 선택 ============================
  function openPromo(matches) {
    S.pending = matches;
    var modal = document.getElementById('cp-promo');
    if (modal) modal.classList.remove('hidden');
  }
  function choosePromo(pr) {
    var modal = document.getElementById('cp-promo');
    if (modal) modal.classList.add('hidden');
    if (!S.pending) return;
    var m = S.pending.find(function (mm) { return mm.promo === pr; }) || S.pending[0];
    S.pending = null;
    applyLive(m);
  }

  // ============================ 오프닝 탐색기 ============================
  function updateOpening() {
    var el = document.getElementById('cp-opening');
    if (!el) return;
    if (S.mode !== 'game' || S.sans.length === 0) { el.innerHTML = '<span class="cp-dim">오프닝: 첫 수를 두면 정석을 안내합니다</span>'; return; }
    var op = CP.detectOpening(S.sans);
    if (!op) { el.innerHTML = '<span class="cp-dim">정석 이탈 — 나만의 수순</span>'; return; }
    var nextTxt = op.next && op.next.length ? ' · <span class="cp-dim">이론상 다음: ' + op.next.join(', ') + '</span>' : ' · <span class="cp-dim">정석 라인 종료</span>';
    el.innerHTML = '<b>' + op.name + '</b> <span class="cp-eco">' + op.eco + '</span>' + nextTxt;
  }

  // ============================ 형세 평가 바 ============================
  function updateEvalBar() {
    var fill = document.getElementById('cp-eval-fill');
    var num = document.getElementById('cp-eval-num');
    if (!fill) return;
    var cp = CP.evaluate(chessBoard); // 백 관점 센티폰(물질+위치)
    var pct = winP(cp);
    fill.style.width = Math.max(2, Math.min(98, pct)).toFixed(1) + '%';
    var v = (cp / 100);
    if (num) num.textContent = (v >= 0 ? '+' : '') + v.toFixed(1);
  }

  // ============================ 힌트 / 무르기 ============================
  function hint() {
    if (S.mode === 'puzzle') return puzzleHint();
    if (chessGameOver || S.st.turn !== 'w') return;
    var rs = CP.rootScores(chessBoard, S.st, 3);
    if (!rs.length) return;
    var m = rs[0].move;
    var cells = document.querySelectorAll('#chess-grid .cell');
    cells.forEach(function (c) {
      var x = +c.dataset.x, y = +c.dataset.y;
      if ((x === m.sx && y === m.sy) || (x === m.tx && y === m.ty)) c.classList.add('cp-hint');
    });
    toast('추천 수: ' + CP.toSAN(chessBoard, S.st, m));
    setTimeout(function () { document.querySelectorAll('#chess-grid .cell.cp-hint').forEach(function (c) { c.classList.remove('cp-hint'); }); }, 1400);
  }
  function takeback() {
    if (S.mode !== 'game' || chessGameOver && !S.snaps.length) { if (!S.snaps.length) return; }
    if (!S.snaps.length) { toast('되돌릴 수가 없습니다'); return; }
    // 사람+AI 한 쌍을 되돌린다
    var steps = (S.snaps.length >= 2 && S.hist.length >= 2 && S.hist[S.hist.length - 1].color === 'b') ? 2 : 1;
    for (var i = 0; i < steps; i++) {
      var snap = S.snaps.pop(); S.hist.pop(); S.sans.pop();
      if (snap) { setBoard(snap.board); S.st = snap.st; }
    }
    chessCurrentPlayer = S.st.turn; chessGameOver = false;
    selected = null; legalTargets = []; lastChessMove = null;
    renderChess(); updateOpening(); updateEvalBar(); updateStatus('무르기 완료 — 백(나) 차례'); autoSave();
    if (typeof renderFusionMiniChess === 'function') renderFusionMiniChess();
  }

  // ============================ 게임 리뷰 (수별 정확도/분류) ============================
  function classify(cpLoss, isBest) {
    if (isBest || cpLoss <= 15) return { k: '최선', c: 'best' };
    if (cpLoss <= 40) return { k: '좋음', c: 'good' };
    if (cpLoss <= 90) return { k: '부정확', c: 'inacc' };
    if (cpLoss <= 200) return { k: '실수', c: 'mist' };
    return { k: '블런더', c: 'blun' };
  }
  function runReview() {
    if (!S.hist.length) { toast('먼저 대국을 두세요'); return; }
    var panel = document.getElementById('cp-review');
    var body = document.getElementById('cp-review-body');
    if (!panel || !body) return;
    panel.classList.remove('hidden');
    body.innerHTML = '<div class="cp-dim" style="padding:8px 0">엔진 분석 중… (수별 정확도 계산)</div>';
    hidePanel('cp-puzzle');
    setTimeout(function () {
      var acc = { w: [], b: [] }, rows = [], counts = { best: 0, good: 0, inacc: 0, mist: 0, blun: 0 };
      for (var i = 0; i < S.hist.length; i++) {
        var h = S.hist[i];
        var pos = CP.fenToPosition(h.fenBefore);
        var st = { turn: pos.st.turn, cast: pos.st.cast, ep: pos.st.ep };
        var rs = CP.rootScores(pos.b, st, 2);
        if (!rs.length) continue;
        var bestScore = rs[0].score;
        var bestUci = uci(rs[0].move);
        var played = rs.find(function (r) { return uci(r.move) === h.uci; });
        var playedScore = played ? played.score : rs[rs.length - 1].score;
        var loss = Math.max(0, bestScore - playedScore);
        var cls = classify(loss, bestUci === h.uci);
        counts[cls.c]++;
        var moveAcc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * (winP(bestScore) - winP(playedScore))) - 3.1669));
        acc[h.color].push(moveAcc);
        var better = (cls.c === 'mist' || cls.c === 'blun') ? CP.toSAN(pos.b, st, rs[0].move) : null;
        rows.push({ n: Math.floor(i / 2) + 1, color: h.color, san: h.san, cls: cls, better: better });
      }
      function avg(a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : 100; }
      var accW = avg(acc.w), accB = avg(acc.b);
      var html = '';
      html += '<div class="cp-acc"><div class="cp-acc-box"><span class="cp-dim">내 정확도(추정)</span><b>' + accW + '%</b></div>'
            + '<div class="cp-acc-box"><span class="cp-dim">' + (S.bot ? S.bot.name : '상대') + '</span><b>' + accB + '%</b></div></div>';
      html += '<div class="cp-tags">최선 ' + counts.best + ' · 좋음 ' + counts.good + ' · 부정확 ' + counts.inacc + ' · <span class="cp-b-mist">실수 ' + counts.mist + '</span> · <span class="cp-b-blun">블런더 ' + counts.blun + '</span></div>';
      html += '<div class="cp-movelist">';
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        html += '<span class="cp-mv"><span class="cp-mv-n">' + (row.color === 'w' ? row.n + '.' : '') + '</span>'
             + '<span class="cp-badge cp-' + row.cls.c + '">' + row.san + '</span>'
             + (row.better ? '<span class="cp-better">→ ' + row.better + '</span>' : '') + '</span>';
      }
      html += '</div><div class="cp-dim" style="margin-top:8px;font-size:0.72rem">정확도는 내장 엔진(얕은 탐색) 기반 추정치입니다. 참고용.</div>';
      body.innerHTML = html;
      try { if (window.legionTrack) legionTrack('activate'); } catch (e) {}
    }, 40);
  }

  // ============================ PGN 내보내기 ============================
  function buildPGN() {
    var r = CP.getRating();
    var res = gameResult();
    var tags = '[Event "GoChess 가상 대국"]\n[Site "gochess"]\n[Date "' + new Date().toISOString().slice(0, 10) + '"]\n'
      + '[White "나 (' + r.elo + ')"]\n[Black "' + (S.bot ? S.bot.name : 'AI') + ' (' + (S.bot ? S.bot.rating : '') + ')"]\n[Result "' + res + '"]\n\n';
    var body = '';
    for (var i = 0; i < S.sans.length; i++) {
      if (i % 2 === 0) body += (i / 2 + 1) + '. ';
      body += S.sans[i] + ' ';
    }
    body += res;
    return tags + body.trim();
  }
  function gameResult() {
    var last = gameLog.slice().reverse().find(function (l) { return l.mode === 'chess' && (l.action === 'checkmate' || l.action === 'stalemate'); });
    if (!last) return '*';
    if (last.action === 'stalemate') return '1/2-1/2';
    return last.winner === 'w' ? '1-0' : '0-1';
  }
  function exportPGN() {
    if (!S.sans.length) { toast('기보가 비어있습니다'); return; }
    var pgn = buildPGN();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pgn).then(function () { toast('PGN 기보를 복사했어요'); }, function () { dlPGN(pgn); });
    else dlPGN(pgn);
    // 다운로드도 함께 제공
    dlPGN(pgn);
  }
  function dlPGN(pgn) {
    try {
      var blob = new Blob([pgn], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'gochess-' + Date.now() + '.pgn';
      document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 100);
    } catch (e) {}
  }

  // ============================ 퍼즐 훈련소 ============================
  function wrongQueue() { try { return JSON.parse(localStorage.getItem('gc-puzzle-wrong') || '[]'); } catch (e) { return []; } }
  function addWrong(id) { var q = wrongQueue(); if (q.indexOf(id) < 0) { q.push(id); try { localStorage.setItem('gc-puzzle-wrong', JSON.stringify(q)); } catch (e) {} } }
  function clearWrong(id) { var q = wrongQueue().filter(function (x) { return x !== id; }); try { localStorage.setItem('gc-puzzle-wrong', JSON.stringify(q)); } catch (e) {} }
  function themePool() {
    if (S.theme === '전체') return PUZZLES.slice();
    if (S.theme === '오답복습') { var q = wrongQueue(); return PUZZLES.filter(function (p) { return q.indexOf(p.id) >= 0; }); }
    return PUZZLES.filter(function (p) { return p.theme === S.theme; });
  }
  window.startDailyPuzzle = function () {
    switchMode('chess');
    setTimeout(function () { openPuzzleTrainer(); }, 60);
  };
  function openPuzzleTrainer() {
    injectProUI();
    hidePanel('cp-review');
    var panel = document.getElementById('cp-puzzle');
    if (panel) panel.classList.remove('hidden');
    S.rush = null;
    loadPuzzle(pickPuzzle());
    renderThemeChips();
    try { if (window.legionTrack) legionTrack('daily_focus', {}); } catch (e) {}
  }
  function pickPuzzle() {
    var pool = themePool();
    if (!pool.length) { toast('이 테마에 퍼즐이 없어요'); pool = PUZZLES.slice(); S.theme = '전체'; renderThemeChips(); }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  window.generatePuzzle = function () { openPuzzleTrainer(); };
  window.checkPuzzleSolution = function () {};

  function loadPuzzle(p) {
    S.puzzle = p; S.mode = 'puzzle'; puzzleActive = true; chessGameOver = false;
    var pos = CP.fenToPosition(p.fen);
    setBoard(pos.b); S.st = { turn: pos.st.turn, cast: pos.st.cast, ep: pos.st.ep };
    chessCurrentPlayer = S.st.turn;
    selected = null; legalTargets = []; lastChessMove = null;
    renderChess();
    var title = document.getElementById('cp-puz-title');
    var fb = document.getElementById('cp-puz-fb');
    if (title) title.innerHTML = '<b>' + p.t + '</b> <span class="cp-eco">' + p.theme + ' · ' + p.rating + '</span>';
    if (fb) { fb.textContent = (S.st.turn === 'w' ? '백' : '흑') + '이 둘 차례 — 최선의 한 수를 찾으세요.'; fb.className = 'cp-puz-fb'; }
    updateStatus('퍼즐: ' + p.t);
    var rushEl = document.getElementById('cp-rush-status');
    if (rushEl) rushEl.textContent = S.rush ? ('러시 · 생명 ' + '♥'.repeat(S.rush.lives) + ' · 해결 ' + S.rush.solved) : '';
  }
  function puzzleClick(x, y) {
    var piece = chessBoard[y][x];
    if (selected) {
      var legal = CP.genLegal(chessBoard, S.st, S.st.turn);
      var m = legal.find(function (mm) { return mm.sx === selected[0] && mm.sy === selected[1] && mm.tx === x && mm.ty === y; });
      if (m) {
        // 승진 퍼즐: 솔루션이 =q 이므로 자동 퀸(솔루션과 일치)
        var moveUci = uci(m);
        if (m.promo) moveUci = CP.sqName(m.sx, m.sy) + CP.sqName(m.tx, m.ty) + 'q', m = legal.find(function (mm) { return mm.sx === m.sx && mm.sy === m.sy && mm.tx === m.tx && mm.ty === m.ty && mm.promo === 'q'; }) || m;
        puzzleTry(moveUci, m);
      } else if (piece && piece[0] === S.st.turn) { selected = [x, y]; legalTargets = targetsFor(x, y); renderChess(); }
      else { selected = null; legalTargets = []; renderChess(); }
    } else if (piece && piece[0] === S.st.turn) { selected = [x, y]; legalTargets = targetsFor(x, y); renderChess(); }
  }
  function puzzleTry(moveUci, m) {
    var p = S.puzzle;
    var fb = document.getElementById('cp-puz-fb');
    var correct = p.sol.indexOf(moveUci) >= 0;
    // 솔루션은 아니지만 그래도 외통이면 정답 인정(메이트 퍼즐 다중해)
    var r = CP.applyMove(chessBoard, S.st, m);
    if (!correct && p.theme === '메이트' && CP.statusFor(r.b, r.st) === 'checkmate') correct = true;
    if (correct) {
      var sanTxt = CP.toSAN(chessBoard, S.st, m); // 적용 전 보드에서 SAN 계산(적용 후엔 출발칸이 비어 크래시)
      setBoard(r.b); S.st = r.st; lastChessMove = { from: [m.sx, m.sy], to: [m.tx, m.ty] };
      selected = null; legalTargets = []; renderChess();
      clearWrong(p.id);
      if (fb) { fb.textContent = '✅ 정답! ' + sanTxt.replace(/[+#]/, '') + ' — 훌륭합니다.'; fb.className = 'cp-puz-fb ok'; }
      try { if (window.legionTrack) window.legionTrack('activate'); } catch (e) {}
      gameLog.push({ mode: 'puzzle', solved: true, id: p.id, ts: Date.now() });
      if (typeof updateStreakOnPlay === 'function') updateStreakOnPlay();
      autoSave();
      if (S.rush) { S.rush.solved++; setTimeout(function () { nextRush(); }, 750); }
      else { if (typeof showShareBanner === 'function') showShareBanner('puzzle', {}, '✅ 퍼즐 해결!'); }
    } else {
      selected = null; legalTargets = []; renderChess();
      addWrong(p.id);
      if (fb) { fb.textContent = '❌ 아직 아니에요 — 다시 시도. (오답 복습 목록에 추가됨)'; fb.className = 'cp-puz-fb no'; }
      if (S.rush) { S.rush.lives--; if (S.rush.lives <= 0) return endRush(); var rushEl = document.getElementById('cp-rush-status'); if (rushEl) rushEl.textContent = '러시 · 생명 ' + '♥'.repeat(S.rush.lives) + ' · 해결 ' + S.rush.solved; setTimeout(function () { loadPuzzle(pickPuzzle()); }, 600); }
      else setTimeout(function () { loadPuzzle(p); }, 700); // 같은 퍼즐 재시도
    }
  }
  function puzzleHint() {
    var p = S.puzzle; if (!p) return;
    var fromU = p.sol[0].slice(0, 2);
    var fx = 'abcdefgh'.indexOf(fromU[0]), fy = 8 - (+fromU[1]);
    var cells = document.querySelectorAll('#chess-grid .cell');
    cells.forEach(function (c) { if (+c.dataset.x === fx && +c.dataset.y === fy) c.classList.add('cp-hint'); });
    setTimeout(function () { document.querySelectorAll('#chess-grid .cell.cp-hint').forEach(function (c) { c.classList.remove('cp-hint'); }); }, 1400);
    var fb = document.getElementById('cp-puz-fb'); if (fb) fb.textContent = '힌트: 이 말을 움직여 보세요.';
  }
  function startRush() {
    S.rush = { lives: 3, solved: 0 };
    S.theme = '전체'; renderThemeChips();
    loadPuzzle(pickPuzzle());
    var btn = document.getElementById('cp-rush-btn'); if (btn) btn.textContent = '러시 종료';
    try { if (window.legionTrack) legionTrack('activate'); } catch (e) {}
  }
  function nextRush() { if (!S.rush) return; loadPuzzle(pickPuzzle()); }
  function endRush() {
    var solved = S.rush ? S.rush.solved : 0;
    S.rush = null;
    var btn = document.getElementById('cp-rush-btn'); if (btn) btn.textContent = '퍼즐 러시';
    var fb = document.getElementById('cp-puz-fb'); if (fb) { fb.textContent = '러시 종료 — ' + solved + '문제 해결! 다시 도전하거나 공유해 보세요.'; fb.className = 'cp-puz-fb ok'; }
    if (typeof showShareBanner === 'function') showShareBanner('puzzle', { solved: solved }, '🔥 퍼즐 러시 ' + solved + '문제 해결!');
  }
  function exitPuzzle() {
    S.mode = 'game'; puzzleActive = false; S.rush = null;
    hidePanel('cp-puzzle');
    newGame(false);
    renderChess(); refreshHeader(); updateOpening(); updateEvalBar();
    updateStatus('일반 대국으로 — 백(나) 차례');
  }
  function renderThemeChips() {
    var wrap = document.getElementById('cp-theme-chips'); if (!wrap) return;
    var q = wrongQueue();
    wrap.innerHTML = '';
    THEMES.forEach(function (th) {
      if (th === '오답복습' && q.length === 0) return;
      var chip = document.createElement('button');
      chip.className = 'cp-chip' + (S.theme === th ? ' on' : '');
      chip.textContent = th + (th === '오답복습' ? ' (' + q.length + ')' : '');
      chip.onclick = function () { S.theme = th; renderThemeChips(); loadPuzzle(pickPuzzle()); };
      wrap.appendChild(chip);
    });
  }

  // ============================ 헤더(레이팅/상대) ============================
  function refreshHeader() {
    var r = CP.getRating();
    var badge = document.getElementById('cp-rating');
    if (badge) badge.innerHTML = '<span class="cp-rank">' + CP.rankTier(r.elo) + '</span> <b>' + r.elo + '</b> <span class="cp-dim">' + r.w + '승 ' + r.d + '무 ' + r.l + '패</span>';
    var sel = document.getElementById('cp-bot');
    if (sel && sel.value !== selectedBotId()) sel.value = selectedBotId();
  }

  // ============================ UI 주입 (1회) ============================
  function injectProUI() {
    var host = document.getElementById('chess-board');
    if (!host || document.getElementById('chess-pro')) { refreshHeader(); return; }
    var wrap = document.createElement('div');
    wrap.id = 'chess-pro';
    wrap.innerHTML =
      '<div class="cp-top">' +
        '<div id="cp-rating" class="cp-rating"></div>' +
        '<label class="cp-oppL">상대 <select id="cp-bot" class="cp-select"></select></label>' +
        '<button id="cp-newgame" class="cp-btn cp-accent">새 대국</button>' +
      '</div>' +
      '<div id="cp-opening" class="cp-opening"></div>' +
      '<div class="cp-evalbar"><div id="cp-eval-fill" class="cp-eval-fill"></div><span id="cp-eval-num" class="cp-eval-num">0.0</span></div>' +
      '<div class="cp-toolbar">' +
        '<button id="cp-hint-btn" class="cp-btn">힌트</button>' +
        '<button id="cp-undo-btn" class="cp-btn">무르기</button>' +
        '<button id="cp-pgn-btn" class="cp-btn">PGN</button>' +
        '<button id="cp-review-btn" class="cp-btn cp-accent">게임 리뷰</button>' +
      '</div>' +
      '<div id="cp-review" class="cp-panel hidden"><div class="cp-panel-h">📊 게임 리뷰<button class="cp-x" data-close="cp-review">✕</button></div><div id="cp-review-body"></div></div>' +
      '<div id="cp-puzzle" class="cp-panel hidden">' +
        '<div class="cp-panel-h">🧩 퍼즐 훈련소<button class="cp-x" data-close="cp-puzzle" data-exit="1">✕</button></div>' +
        '<div id="cp-theme-chips" class="cp-chips"></div>' +
        '<div id="cp-puz-title" class="cp-puz-title"></div>' +
        '<div id="cp-puz-fb" class="cp-puz-fb"></div>' +
        '<div id="cp-rush-status" class="cp-rush-status"></div>' +
        '<div class="cp-toolbar">' +
          '<button id="cp-puz-hint" class="cp-btn">힌트</button>' +
          '<button id="cp-puz-next" class="cp-btn">다음 퍼즐</button>' +
          '<button id="cp-rush-btn" class="cp-btn cp-accent">퍼즐 러시</button>' +
          '<button id="cp-puz-exit" class="cp-btn">대국으로</button>' +
        '</div>' +
      '</div>';
    // #chess-grid 다음, controls 앞에 삽입되도록 controls 앞에
    var controls = host.querySelector('.controls');
    if (controls) host.insertBefore(wrap, controls); else host.appendChild(wrap);

    // 봇 셀렉트 채우기
    var sel = document.getElementById('cp-bot');
    CP.BOTS.forEach(function (b) {
      var o = document.createElement('option'); o.value = b.id; o.textContent = b.name + ' · ' + b.rating; sel.appendChild(o);
    });
    sel.value = selectedBotId();
    sel.onchange = function () { try { localStorage.setItem('gc-opponent', sel.value); } catch (e) {} S.bot = CP.botById(sel.value); toast('상대 변경: ' + S.bot.name + ' — 새 대국을 시작하세요'); };

    document.getElementById('cp-newgame').onclick = function () { resetChess(); };
    document.getElementById('cp-hint-btn').onclick = hint;
    document.getElementById('cp-undo-btn').onclick = takeback;
    document.getElementById('cp-pgn-btn').onclick = exportPGN;
    document.getElementById('cp-review-btn').onclick = runReview;
    document.getElementById('cp-puz-hint').onclick = puzzleHint;
    document.getElementById('cp-puz-next').onclick = function () { if (S.rush) nextRush(); else loadPuzzle(pickPuzzle()); };
    document.getElementById('cp-rush-btn').onclick = function () { if (S.rush) endRush(); else startRush(); };
    document.getElementById('cp-puz-exit').onclick = exitPuzzle;
    wrap.querySelectorAll('.cp-x').forEach(function (x) { x.onclick = function () { if (x.dataset.exit) exitPuzzle(); else hidePanel(x.dataset.close); }; });

    // 승진 모달(1회)
    if (!document.getElementById('cp-promo')) {
      var pm = document.createElement('div');
      pm.id = 'cp-promo'; pm.className = 'cp-promo hidden';
      pm.innerHTML = '<div class="cp-promo-box"><div class="cp-promo-t">승진할 기물 선택</div><div class="cp-promo-row">' +
        '<button data-pr="q">♕</button><button data-pr="r">♖</button><button data-pr="b">♗</button><button data-pr="n">♘</button></div></div>';
      document.body.appendChild(pm);
      pm.querySelectorAll('button').forEach(function (btn) { btn.onclick = function () { choosePromo(btn.dataset.pr); }; });
    }
    refreshHeader();
  }
  function hidePanel(id) { var p = document.getElementById(id); if (p) p.classList.add('hidden'); }
  function flash(id) { var el = document.getElementById(id); if (!el) return; el.classList.add('cp-flash'); setTimeout(function () { el.classList.remove('cp-flash'); }, 1600); }
  function toast(msg) { if (typeof showToast === 'function') showToast(msg); }

})();
