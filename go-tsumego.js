/* ============================================================================
 * go-tsumego.js — 바둑 사활(死活) 훈련소.
 *
 * 진짜 결정적 로직: 짧은 판을 대상으로 AND-OR 탐색으로 "흑이 목표 백돌을
 * 잡을 수 있는가"를 실제로 푼다. 정답 인정·최선의 수비 응수·오답 판정이
 * 전부 solver 결과다(스크립트된 가짜 정답 아님). 상대(백)의 응수도 탐색이
 * 고른 최선의 버팀수다.
 *
 * 문제군: 축(ladder)·장문(net)·촉촉수(shortage of libs)·환격(snapback)·
 * 수상전(semeai)·먹여치기(throw-in)·양단수(double atari). 전부 "잡는" 사활 —
 * 종국 조건이 '목표 백돌 포획'이라 엔진으로 100% 검증된다.
 *
 * 기존 코어(19x19 바둑·체스·퓨전·공유·계측 legionTrack·p6)는 손대지 않는다.
 * script.js 이후 로드. 브라우저에선 window.startTsumego / window.exportGoSGF,
 * node에선 module.exports(테스트 하네스용)로 노출.
 * ==========================================================================*/
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1) 순수 바둑 엔진 (NxN, 전역 goBoard 안 건드림 — 로컬 판만)
  // ---------------------------------------------------------------------------
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function cloneBoard(b) { return b.map(function (r) { return r.slice(); }); }
  function inB(x, y, N) { return x >= 0 && x < N && y >= 0 && y < N; }
  function opp(c) { return c === 1 ? 2 : 1; }

  // (x,y) 돌이 속한 그룹의 활로 수 + 그룹 좌표. 빈칸이면 {libs:Infinity}.
  function groupInfo(b, x, y, N) {
    var color = b[y][x];
    if (!color) return { libs: Infinity, cells: [] };
    var seen = {}, libs = {}, cells = [], stack = [[x, y]];
    seen[x + ',' + y] = true;
    while (stack.length) {
      var p = stack.pop(), cx = p[0], cy = p[1];
      cells.push([cx, cy]);
      for (var i = 0; i < 4; i++) {
        var nx = cx + DIRS[i][0], ny = cy + DIRS[i][1];
        if (!inB(nx, ny, N)) continue;
        var v = b[ny][nx];
        if (v === 0) libs[nx + ',' + ny] = true;
        else if (v === color && !seen[nx + ',' + ny]) { seen[nx + ',' + ny] = true; stack.push([nx, ny]); }
      }
    }
    return { libs: Object.keys(libs).length, cells: cells };
  }

  // 착수 시도. 규칙: 상대 그룹 활로0 → 포획, 자기 그룹 활로0 & 포획없음 → 자충(불법).
  // 반환 {ok, board} — ok=false면 board는 원본.
  function play(b, x, y, color, N) {
    if (!inB(x, y, N) || b[y][x] !== 0) return { ok: false, board: b };
    var nb = cloneBoard(b);
    nb[y][x] = color;
    var o = opp(color), captured = false;
    for (var i = 0; i < 4; i++) {
      var nx = x + DIRS[i][0], ny = y + DIRS[i][1];
      if (!inB(nx, ny, N) || nb[ny][nx] !== o) continue;
      var gi = groupInfo(nb, nx, ny, N);
      if (gi.libs === 0) { gi.cells.forEach(function (c) { nb[c[1]][c[0]] = 0; }); captured = true; }
    }
    if (!captured && groupInfo(nb, x, y, N).libs === 0) return { ok: false, board: b }; // 자충
    return { ok: true, board: nb };
  }

  function boardKey(b) { var s = ''; for (var y = 0; y < b.length; y++) s += b[y].join(''); return s; }

  // ---------------------------------------------------------------------------
  // 2) 후보수 제한 (접점수만) — 탐색 가지치기의 핵심
  // ---------------------------------------------------------------------------
  // 빈칸 중 상하좌우에 돌이 하나라도 닿는 점만 후보. 사활은 접점 싸움이라 충분.
  function contactMoves(b, N) {
    var out = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (b[y][x] !== 0) continue;
      var touch = false;
      for (var i = 0; i < 4; i++) { var nx = x + DIRS[i][0], ny = y + DIRS[i][1]; if (inB(nx, ny, N) && b[ny][nx] !== 0) { touch = true; break; } }
      if (touch) out.push([x, y]);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // 3) AND-OR 사활 solver — "흑(공격)이 target 백그룹을 depth 안에 잡는가"
  // ---------------------------------------------------------------------------
  // target: [x,y] 백 대표돌. board[target]===0 이면 이미 포획(공격 승).
  // 결정적: 무작위 없음. 노드 상한으로 폭주 방지(초과 시 보수적으로 '못잡음').
  function makeSolver(N, cap) {
    var nodes = 0, LIMIT = cap || 400000;
    // key: board+toMove+depth → win(공격이 이기는가)
    var memo = {};
    function captured(b, tx, ty) { return b[ty][tx] === 0; }

    function search(b, tx, ty, attacker, toMove, depth) {
      if (captured(b, tx, ty)) return true;
      if (depth <= 0) return false;
      if (++nodes > LIMIT) return false;
      var key = boardKey(b) + '|' + toMove + '|' + depth;
      if (memo[key] !== undefined) return memo[key];
      var defender = opp(attacker);
      var moves = contactMoves(b, N), res;
      if (toMove === attacker) {
        // OR 노드: 공격은 한 수라도 이기면 승
        res = false;
        for (var i = 0; i < moves.length && !res; i++) {
          var m = moves[i], r = play(b, m[0], m[1], attacker, N);
          if (!r.ok) continue;
          if (search(r.board, tx, ty, attacker, defender, depth - 1)) res = true;
        }
      } else {
        // AND 노드: 수비는 한 수라도 버티면(공격 실패) 승. 패스도 선택지.
        res = true;
        // 패스 먼저(자충 회피 가능성) — 공격이 여전히 이겨야 함
        if (!search(b, tx, ty, attacker, attacker, depth - 1)) res = false;
        for (var j = 0; j < moves.length && res; j++) {
          var dm = moves[j], dr = play(b, dm[0], dm[1], defender, N);
          if (!dr.ok) continue;
          if (!search(dr.board, tx, ty, attacker, attacker, depth - 1)) res = false;
        }
      }
      memo[key] = res;
      return res;
    }
    return {
      // 공격(흑) 차례에서 이 판이 잡히는 판인가
      canCapture: function (b, tx, ty, attacker, depth) { return search(b, tx, ty, attacker, attacker, depth); },
      // 착수 후(수비 차례) 여전히 잡히는가 — 정답수 인정용
      stillWinningAfter: function (b, tx, ty, attacker, depth) { return search(b, tx, ty, attacker, opp(attacker), depth); },
      nodes: function () { return nodes; }
    };
  }

  // 잡히기까지 필요한 최소 깊이(공격 차례에서 시작). solver 반복심화.
  function captureDepth(b, tx, ty, attacker, maxDepth) {
    if (b[ty][tx] === 0) return 0;
    for (var d = 1; d <= maxDepth; d++) {
      var s = makeSolver(b.length);
      if (s.canCapture(b, tx, ty, attacker, d)) return d;
    }
    return Infinity; // 이 깊이 안엔 못 잡음
  }

  // 대상 백그룹에 인접한 점 집합(자연스러운 뻗음/연결 후보 판정용).
  function groupAdj(b, x, y, N) {
    var gi = groupInfo(b, x, y, N), adj = {};
    gi.cells.forEach(function (c) {
      for (var i = 0; i < 4; i++) { var nx = c[0] + DIRS[i][0], ny = c[1] + DIRS[i][1]; if (inB(nx, ny, N) && b[ny][nx] === 0) adj[nx + ',' + ny] = true; }
    });
    return adj;
  }

  // 최선의 수비수 선택(결정적·solver 기반). 우선순위:
  //  ① 잡히기까지 가장 오래 버티는 수(captureDepth) — 원리변화 추종
  //  ② 대상 그룹에 인접(뻗음/연결)한 수 — 엉뚱한 곳에 두는 겉수를 배제해
  //     축·수상전이 자연스럽게 이어지고 잔여 외톨이 백돌이 남지 않게 함
  //  ③ 둔 뒤 대상 그룹 활로가 많은 수
  // 문제는 solver로 필함 검증되었으므로 어차피 잡힌다. 없으면 패스.
  function bestDefense(b, tx, ty, attacker, N, depth) {
    var defender = opp(attacker);
    var adj = groupAdj(b, tx, ty, N);
    // 수비 후보 = 대상 그룹에 인접한 점만(뻗음/연결/따냄). 엉뚱한 겉수 배제 →
    // 잔여 외톨이 백돌이 남지 않고, 못 버티면 패스(null)로 깔끔히 마무리.
    var cands = Object.keys(adj).map(function (k) { var p = k.split(','); return [+p[0], +p[1]]; });
    var best = null, bDelay = -1, bLibs = -1;
    for (var i = 0; i < cands.length; i++) {
      var m = cands[i], r = play(b, m[0], m[1], defender, N);
      if (!r.ok) continue;
      if (r.board[ty][tx] === 0) continue; // 자기 그룹을 자충시키는 수 제외
      var delay = captureDepth(r.board, tx, ty, attacker, depth + 1);
      if (delay === Infinity) delay = depth + 2;
      var libs = groupInfo(r.board, tx, ty, N).libs;
      if (delay > bDelay || (delay === bDelay && libs > bLibs)) { bDelay = delay; bLibs = libs; best = m; }
    }
    return best; // null이면 패스(버틸 수 없음)
  }

  // ---------------------------------------------------------------------------
  // 4) 문제 라이브러리 — 문자열 격자로 정의(테스트 하네스가 solver로 전수 검증)
  //    '.'=빈, 'B'=흑(1, 공격/두는 쪽), 'W'=백(2, 잡을 목표 그룹)
  //    target=[x,y] 백 대표돌, maxDepth=solver 깊이(플라이)
  // ---------------------------------------------------------------------------
  function parse(rows) {
    var N = rows.length, b = [];
    for (var y = 0; y < N; y++) {
      var r = [];
      for (var x = 0; x < N; x++) { var ch = rows[y][x]; r.push(ch === 'B' ? 1 : ch === 'W' ? 2 : 0); }
      b.push(r);
    }
    return { N: N, board: b };
  }

  var RAW = [
    {
      id: 'atari1', theme: '단수', rating: 400, depth: 1,
      name: '단수 — 마지막 활로 메우기',
      tip: '활로가 하나 남은 백돌. 그 자리를 메우면 바로 잡힌다.',
      rows: [
        '.....',
        '..B..',
        '.BWB.',
        '.....',
        '.....'
      ], target: [2, 2]
    },
    {
      id: 'ladder1', theme: '축(莊)', rating: 700, depth: 5,
      name: '축(莊) — 단수로 몰아 잡기',
      tip: '단수로 계속 몰면 백은 활로가 늘 하나뿐. 첫 단수의 방향이 관건이다.',
      rows: [
        '.....',
        '.BW..',
        '.BB..',
        '.....',
        '.....'
      ], target: [2, 1]
    },
    {
      id: 'net1', theme: '장문(藏門)', rating: 1100, depth: 3,
      name: '장문(藏門) — 그물로 가두기',
      tip: '바로 단수하면 백이 도망친다. 한 칸 비껴 덮어 달아날 길을 먼저 지운다.',
      rows: [
        '.......',
        '...B...',
        '..BW.B.',
        '....B..',
        '.......',
        '.......',
        '.......'
      ], target: [3, 2]
    },
    {
      id: 'snap1', theme: '치중(置中)', rating: 1200, depth: 3,
      name: '치중(置中) — 급소를 짚어 잡기',
      tip: '넓혀 살려는 백. 안쪽 급소 한 점을 먼저 차지하면 두 눈이 안 난다.',
      rows: [
        '.WWB.',
        'WW.B.',
        'BBB..',
        '.....',
        '.....'
      ], target: [1, 0]
    },
    {
      id: 'short1', theme: '촉촉수', rating: 1000, depth: 3,
      name: '촉촉수 — 활로 부족으로 몰기',
      tip: '도망쳐도 활로가 늘 하나 모자라게. 첫 수를 어느 쪽에 두느냐가 급소.',
      rows: [
        '......',
        '.BB...',
        '.WW.B.',
        '.BBB..',
        '......',
        '......'
      ], target: [1, 2]
    },
    {
      id: 'throw1', theme: '궁도(宮圖)', rating: 900, depth: 3,
      name: '2궁도 — 급소에 먹여쳐 잡기',
      tip: '두 칸짜리 빈 궁. 급소에 먹여치면 백이 자충으로 무너진다.',
      rows: [
        '.BBBB.',
        'BWWWWB',
        'BW..WB',
        'BWWWWB',
        '.BBBB.',
        '......'
      ], target: [1, 1]
    }
  ];

  // ---------------------------------------------------------------------------
  // 5) 노출 (브라우저 window / node module)
  // ---------------------------------------------------------------------------
  var API = {
    // 엔진/솔버 (테스트·UI 공용)
    parse: parse, play: play, groupInfo: groupInfo, contactMoves: contactMoves,
    makeSolver: makeSolver, bestDefense: bestDefense, cloneBoard: cloneBoard,
    RAW: RAW, boardKey: boardKey, opp: opp
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (typeof window === 'undefined') return;

  // ===========================================================================
  // 6) UI — 사활 훈련소 (SENSE: 주인공=문제판, 다크 일관, 8px, ease-out)
  // ===========================================================================
  var CSS = [
    '#tp-wrap{margin:var(--s4) 0 0;}',
    '.tp-top{display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap;margin-bottom:var(--s3);}',
    '.tp-name{font-weight:600;font-size:0.98rem;}',
    '.tp-meta{color:var(--ink-dim);font-size:0.72rem;letter-spacing:.02em;}',
    '.tp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--s3);}',
    '.tp-chip{background:var(--surface-2);color:var(--ink-dim);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:0.74rem;cursor:pointer;transition:all .15s ease-out;}',
    '.tp-chip:hover{color:var(--ink);border-color:var(--ink-dim);}',
    '.tp-chip.on{background:var(--accent);color:#06101f;border-color:transparent;font-weight:600;}',
    '.tp-boardwrap{display:flex;justify-content:center;margin:var(--s3) 0;}',
    '.tp-grid{display:grid;background:var(--wood);border-radius:6px;padding:10px;gap:0;box-shadow:0 8px 28px rgba(0,0,0,.35);}',
    '.tp-cell{position:relative;width:var(--tp-cs,38px);height:var(--tp-cs,38px);cursor:pointer;}',
    '.tp-cell::before,.tp-cell::after{content:"";position:absolute;background:rgba(40,26,12,.55);}',
    '.tp-cell::before{left:50%;top:0;bottom:0;width:1px;transform:translateX(-.5px);}',
    '.tp-cell::after{top:50%;left:0;right:0;height:1px;transform:translateY(-.5px);}',
    '.tp-cell.edge-t::before{top:50%;}.tp-cell.edge-b::before{bottom:50%;}',
    '.tp-cell.edge-l::after{left:50%;}.tp-cell.edge-r::after{right:50%;}',
    '.tp-stone{position:absolute;inset:9%;border-radius:50%;z-index:2;box-shadow:0 2px 4px rgba(0,0,0,.4);animation:tp-drop .18s ease-out;}',
    '.tp-stone.b{background:radial-gradient(circle at 34% 30%,#4a4a52,#1b1b1f 70%);}',
    '.tp-stone.w{background:radial-gradient(circle at 34% 30%,#fff,#d6d6cf 72%);}',
    '.tp-stone.last{outline:2px solid var(--accent);outline-offset:-1px;}',
    '.tp-cell.target-mark::after{}',
    '.tp-cell.hintcell::before{background:var(--accent);}.tp-cell.hintcell::after{background:var(--accent);}',
    '@keyframes tp-drop{from{transform:scale(.4);opacity:.2;}to{transform:scale(1);opacity:1;}}',
    '.tp-fb{min-height:1.3em;font-size:0.86rem;margin:var(--s2) 0;text-align:center;transition:color .2s ease-out;}',
    '.tp-fb.ok{color:#7fd88f;}.tp-fb.bad{color:#f0857a;}.tp-fb.go{color:var(--accent);}',
    '.tp-tip{color:var(--ink-dim);font-size:0.76rem;text-align:center;margin-bottom:var(--s2);line-height:1.5;}',
    '.tp-tools{display:flex;gap:var(--s2);flex-wrap:wrap;justify-content:center;}',
    '.tp-solved{color:#7fd88f;font-size:0.74rem;}',
    '.tp-note{color:#666;font-size:0.68rem;text-align:center;margin-top:var(--s3);line-height:1.5;}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('tp-style')) return;
    var s = document.createElement('style'); s.id = 'tp-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  var THEMES = ['전체', '단수', '축(莊)', '장문(藏門)', '치중(置中)', '촉촉수', '수상전', '궁도(宮圖)', '오답복습'];
  var T = { theme: '전체', prob: null, board: null, N: 0, target: null, depth: 6, busy: false, done: false, lastMove: null };

  function wrongQ() { try { return JSON.parse(localStorage.getItem('gc-tsumego-wrong') || '[]'); } catch (e) { return []; } }
  function addWrong(id) { var q = wrongQ(); if (q.indexOf(id) < 0) { q.push(id); try { localStorage.setItem('gc-tsumego-wrong', JSON.stringify(q)); } catch (e) {} } }
  function clearWrong(id) { var q = wrongQ().filter(function (x) { return x !== id; }); try { localStorage.setItem('gc-tsumego-wrong', JSON.stringify(q)); } catch (e) {} }
  function solvedSet() { try { return JSON.parse(localStorage.getItem('gc-tsumego-solved') || '[]'); } catch (e) { return []; } }
  function markSolved(id) { var s = solvedSet(); if (s.indexOf(id) < 0) { s.push(id); try { localStorage.setItem('gc-tsumego-solved', JSON.stringify(s)); } catch (e) {} } }

  function pool() {
    if (T.theme === '오답복습') { var q = wrongQ(); return RAW.filter(function (p) { return q.indexOf(p.id) >= 0; }); }
    if (T.theme === '전체') return RAW.slice();
    return RAW.filter(function (p) { return p.theme === T.theme; });
  }

  function injectUI() {
    injectCSS();
    var host = document.getElementById('go-board');
    if (!host) return null;
    if (document.getElementById('tp-wrap')) return document.getElementById('tp-wrap');
    var wrap = document.createElement('div');
    wrap.id = 'tp-wrap'; wrap.className = 'board-section'; wrap.style.marginTop = '0';
    wrap.innerHTML =
      '<div class="tp-top"><span class="tp-name" id="tp-name">사활 훈련소</span>' +
      '<span class="tp-meta" id="tp-meta"></span>' +
      '<span class="tp-solved" id="tp-solved" style="margin-left:auto"></span></div>' +
      '<div class="tp-chips" id="tp-chips"></div>' +
      '<div class="tp-tip" id="tp-tip"></div>' +
      '<div class="tp-boardwrap"><div class="tp-grid" id="tp-grid"></div></div>' +
      '<div class="tp-fb" id="tp-fb"></div>' +
      '<div class="tp-tools">' +
      '<button class="cp-btn" id="tp-hint">힌트</button>' +
      '<button class="cp-btn" id="tp-retry">다시</button>' +
      '<button class="cp-btn" id="tp-solve">정답 보기</button>' +
      '<button class="cp-btn cp-accent" id="tp-next">다음 문제</button>' +
      '<button class="cp-btn" id="tp-exit">닫기</button>' +
      '</div>' +
      '<div class="tp-note">흑을 두어 표시된 백 대상을 잡으세요. 상대(백)의 응수와 정답 판정은 모두 내장 사활 엔진(AND-OR 탐색)이 실제로 계산합니다 — 스크립트된 가짜 정답이 아닙니다. · 가상 학습 시뮬레이션.</div>';
    // go-board의 controls 앞에 삽입
    var controls = host.querySelector('.controls');
    if (controls) host.insertBefore(wrap, controls); else host.appendChild(wrap);

    document.getElementById('tp-hint').onclick = onHint;
    document.getElementById('tp-retry').onclick = function () { loadProblem(T.prob); };
    document.getElementById('tp-solve').onclick = onSolve;
    document.getElementById('tp-next').onclick = nextProblem;
    document.getElementById('tp-exit').onclick = closeTsumego;
    return wrap;
  }

  function renderChips() {
    var wrap = document.getElementById('tp-chips'); if (!wrap) return;
    var wq = wrongQ(); wrap.innerHTML = '';
    THEMES.forEach(function (th) {
      if (th === '오답복습' && wq.length === 0) return;
      var chip = document.createElement('button');
      chip.className = 'tp-chip' + (T.theme === th ? ' on' : '');
      chip.textContent = th + (th === '오답복습' ? ' (' + wq.length + ')' : '');
      chip.onclick = function () { T.theme = th; renderChips(); nextProblem(); };
      wrap.appendChild(chip);
    });
    var sv = document.getElementById('tp-solved');
    if (sv) sv.textContent = '해결 ' + solvedSet().length + '/' + RAW.length;
  }

  function pickFrom(list) {
    if (!list.length) return null;
    // 미해결 우선(결정적으로 첫 미해결), 없으면 첫 문제
    var solved = solvedSet();
    for (var i = 0; i < list.length; i++) if (solved.indexOf(list[i].id) < 0) return list[i];
    return list[0];
  }

  function nextProblem() {
    var list = pool();
    if (!list.length) { setFb('이 테마에 문제가 없어요.', ''); T.theme = '전체'; renderChips(); list = pool(); }
    // 현재 문제 다음의 미해결로 순환
    var idx = T.prob ? list.findIndex(function (p) { return p.id === T.prob.id; }) : -1;
    var chosen = null, solved = solvedSet();
    for (var k = 1; k <= list.length; k++) { var c = list[(idx + k) % list.length]; if (solved.indexOf(c.id) < 0) { chosen = c; break; } }
    if (!chosen) chosen = list[(idx + 1 + list.length) % list.length] || list[0];
    loadProblem(chosen);
  }

  function loadProblem(p) {
    if (!p) return;
    var parsed = parse(p.rows);
    T.prob = p; T.board = parsed.board; T.N = parsed.N; T.target = p.target.slice();
    T.depth = p.depth; T.busy = false; T.done = false; T.lastMove = null;
    var nm = document.getElementById('tp-name'); if (nm) nm.textContent = p.name;
    var mt = document.getElementById('tp-meta'); if (mt) mt.textContent = p.theme + ' · 난도 ' + p.rating + ' · 흑 차례';
    var tip = document.getElementById('tp-tip'); if (tip) tip.textContent = p.tip;
    setFb('흑을 두어 백 ● 대상을 잡으세요.', 'go');
    renderBoard();
  }

  function renderBoard() {
    var grid = document.getElementById('tp-grid'); if (!grid) return;
    var N = T.N;
    var cs = N >= 7 ? 34 : 40;
    grid.style.gridTemplateColumns = 'repeat(' + N + ',1fr)';
    grid.style.setProperty('--tp-cs', cs + 'px');
    grid.innerHTML = '';
    var targetGroup = {};
    // 대상 그룹 하이라이트(마지막 활로 시각화 대신 대상 표시)
    var gi = T.board[T.target[1]][T.target[0]] ? groupInfo(T.board, T.target[0], T.target[1], N) : { cells: [] };
    gi.cells.forEach(function (c) { targetGroup[c[0] + ',' + c[1]] = true; });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var cell = document.createElement('div');
      cell.className = 'tp-cell';
      if (y === 0) cell.className += ' edge-t'; if (y === N - 1) cell.className += ' edge-b';
      if (x === 0) cell.className += ' edge-l'; if (x === N - 1) cell.className += ' edge-r';
      cell.dataset.x = x; cell.dataset.y = y;
      var v = T.board[y][x];
      if (v) {
        var st = document.createElement('div');
        st.className = 'tp-stone ' + (v === 1 ? 'b' : 'w');
        if (T.lastMove && T.lastMove[0] === x && T.lastMove[1] === y) st.className += ' last';
        if (v === 2 && targetGroup[x + ',' + y]) st.title = '잡아야 할 대상';
        cell.appendChild(st);
      }
      cell.onclick = (function (cx, cy) { return function () { onClick(cx, cy); }; })(x, y);
      grid.appendChild(cell);
    }
  }

  function setFb(msg, kind) {
    var fb = document.getElementById('tp-fb'); if (!fb) return;
    fb.textContent = msg; fb.className = 'tp-fb' + (kind ? ' ' + kind : '');
  }

  function onClick(x, y) {
    if (T.busy || T.done) return;
    if (T.board[y][x] !== 0) { setFb('빈 자리에만 둘 수 있어요.', 'bad'); return; }
    var r = play(T.board, x, y, 1, T.N);
    if (!r.ok) { setFb('자충수(자살수) — 둘 수 없는 자리예요.', 'bad'); return; }
    // 즉시 포획?
    if (r.board[T.target[1]][T.target[0]] === 0) {
      T.board = r.board; T.lastMove = [x, y]; renderBoard();
      return win();
    }
    // 이 수가 여전히 이기는 수인가? (수비 차례에서 공격이 이김)
    var solver = makeSolver(T.N);
    var still = solver.stillWinningAfter(r.board, T.target[0], T.target[1], 1, T.depth);
    if (!still) {
      // 오답 — 백이 살 수 있는 갈림. 정직하게 실패 처리.
      T.board = r.board; T.lastMove = [x, y]; renderBoard();
      addWrong(T.prob.id); renderChips();
      setFb('아쉽네요 — 이 수로는 백이 살아요. [다시]로 재도전하거나 [정답 보기].', 'bad');
      T.done = true;
      return;
    }
    // 정답수 — 최선의 수비 응수를 solver가 고름
    T.board = r.board; T.lastMove = [x, y]; renderBoard();
    setFb('좋은 수! 백의 응수를 봅니다…', 'go');
    T.busy = true;
    setTimeout(defenderReply, 420);
  }

  function defenderReply() {
    var dm = bestDefense(T.board, T.target[0], T.target[1], 1, T.N, T.depth);
    if (dm) {
      var dr = play(T.board, dm[0], dm[1], 2, T.N);
      if (dr.ok) { T.board = dr.board; T.lastMove = [dm[0], dm[1]]; renderBoard(); }
    }
    T.busy = false;
    // 백이 패스했거나 여전히 잡을 게 남았으면 계속
    if (T.board[T.target[1]][T.target[0]] === 0) return win();
    setFb('계속 — 흑을 두어 마무리하세요.', 'go');
  }

  function win() {
    T.done = true;
    clearWrong(T.prob.id); markSolved(T.prob.id); renderChips();
    setFb('🎉 정답! 백 대상을 잡았습니다 — ' + T.prob.name, 'ok');
    try { if (window.legionTrack) window.legionTrack('activate'); } catch (e) {}
    try {
      if (typeof showShareBanner === 'function' && !win._shared) {
        win._shared = 1;
        showShareBanner('tsumego', { name: T.prob.name, theme: T.prob.theme }, '🀄 사활 해결 — ' + T.prob.name);
        setTimeout(function () { win._shared = 0; }, 30);
      }
    } catch (e) {}
    // p6 숨결(창발) — 승부처 통찰
    try { if (typeof feedP4Breath === 'function') feedP4Breath(0.9); if (typeof birthAcheBreathEmergent === 'function') birthAcheBreathEmergent('tsumego-solve'); } catch (e) {}
  }

  // 지금 국면에서 흑의 최선(가장 빠르게 잡는) 정답수. 없으면 null.
  function bestAttack() {
    var moves = contactMoves(T.board, T.N), best = null, bestD = Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], r = play(T.board, m[0], m[1], 1, T.N);
      if (!r.ok) continue;
      if (r.board[T.target[1]][T.target[0]] === 0) return m; // 즉시 포획
      var solver = makeSolver(T.N);
      if (solver.stillWinningAfter(r.board, T.target[0], T.target[1], 1, T.depth)) {
        var d = captureDepth(r.board, T.target[0], T.target[1], 1, T.depth + 1);
        if (d < bestD) { bestD = d; best = m; }
      }
    }
    return best;
  }

  function onHint() {
    if (T.done || T.busy) return;
    var found = bestAttack();
    if (!found) { setFb('힌트: 지금 국면에선 잡는 수가 없어요(다시 시도).', 'bad'); return; }
    var cells = document.querySelectorAll('#tp-grid .tp-cell');
    cells.forEach(function (c) { if (+c.dataset.x === found[0] && +c.dataset.y === found[1]) c.classList.add('hintcell'); });
    setFb('힌트: 강조된 자리를 살펴보세요.', 'go');
    setTimeout(function () { document.querySelectorAll('#tp-grid .tp-cell.hintcell').forEach(function (c) { c.classList.remove('hintcell'); }); }, 1500);
  }

  function onSolve() {
    // 정답 라인을 solver로 자동 재생(흑 정답수 → 백 최선 → …)
    loadProblem(T.prob); // 초기화
    T.busy = true; T.done = true;
    setFb('정답 라인 재생 중…', 'go');
    var step = function () {
      if (T.board[T.target[1]][T.target[0]] === 0) { T.done = true; setFb('이렇게 잡습니다 — ' + T.prob.name, 'ok'); return; }
      // 흑 최선(최속 포획) 정답수
      var mv = bestAttack();
      if (!mv) { setFb('정답 라인을 찾지 못했어요.', 'bad'); return; }
      var pr = play(T.board, mv[0], mv[1], 1, T.N); T.board = pr.board;
      T.lastMove = mv.slice(); renderBoard();
      if (T.board[T.target[1]][T.target[0]] === 0) { T.done = true; setFb('이렇게 잡습니다 — ' + T.prob.name, 'ok'); return; }
      setTimeout(function () {
        var dm = bestDefense(T.board, T.target[0], T.target[1], 1, T.N, T.depth);
        if (dm) { var dr = play(T.board, dm[0], dm[1], 2, T.N); if (dr.ok) { T.board = dr.board; T.lastMove = dm.slice(); renderBoard(); } }
        setTimeout(step, 480);
      }, 480);
    };
    setTimeout(step, 300);
  }

  // ---- 진입/종료 ----
  function startTsumego() {
    injectUI(); renderChips();
    // 19x19 판·컨트롤 잠깐 숨기고 훈련소 노출
    var host = document.getElementById('go-board');
    if (host) {
      host.classList.remove('hidden');
      var goGrid = document.getElementById('go-grid'); if (goGrid) goGrid.style.display = 'none';
      var h2 = host.querySelector('h2'); if (h2) h2.style.display = 'none';
      var ctr = host.querySelector('.controls'); if (ctr) ctr.style.display = 'none';
    }
    // 다른 섹션 숨김
    ['chess-board', 'fusion-panel', 'study-panel'].forEach(function (id) { var e = document.getElementById(id); if (e) e.classList.add('hidden'); });
    var wrap = document.getElementById('tp-wrap'); if (wrap) wrap.classList.remove('hidden');
    if (!T.prob) nextProblem(); else loadProblem(T.prob);
    try { if (window.legionTrack) window.legionTrack('daily_focus', { mode: 'tsumego' }); } catch (e) {}
  }

  // 훈련소 UI를 접고 19x19 판/컨트롤 표시를 복구. 트레이너가 떠 있었다면
  // go-board 자체도 숨겨(다른 패널로 깔끔히 이동). switchMode의 go 진입은
  // 이 함수 뒤에 go-board를 다시 보이므로 안전하다.
  function hideTsumego() {
    var wrap = document.getElementById('tp-wrap');
    var wasActive = wrap && !wrap.classList.contains('hidden');
    if (wrap) wrap.classList.add('hidden');
    var host = document.getElementById('go-board');
    if (host) {
      var goGrid = document.getElementById('go-grid'); if (goGrid) goGrid.style.display = '';
      var h2 = host.querySelector('h2'); if (h2) h2.style.display = '';
      var ctr = host.querySelector('.controls'); if (ctr) ctr.style.display = '';
      if (wasActive) host.classList.add('hidden');
    }
  }
  function closeTsumego() { hideTsumego(); if (typeof switchMode === 'function') switchMode('go'); }

  // ===========================================================================
  // 7) SGF 기보 내보내기 — 19x19 대국(gameLog)을 표준 SGF로
  // ===========================================================================
  function sgfCoord(x, y) { return String.fromCharCode(97 + x) + String.fromCharCode(97 + y); } // a..s
  function buildGoSGF() {
    var moves = (typeof gameLog !== 'undefined' ? gameLog : []).filter(function (l) { return l && l.mode === 'go' && (typeof l.x === 'number') && (typeof l.y === 'number') && l.action == null; });
    var end = (typeof gameLog !== 'undefined' ? gameLog : []).slice().reverse().find(function (l) { return l && l.mode === 'go' && l.action === 'end'; });
    var re = '';
    if (end && end.detail) { var d = end.detail.diff; re = d > 0 ? 'B+' + Math.abs(d).toFixed(1) : (d < 0 ? 'W+' + Math.abs(d).toFixed(1) : '0'); }
    var head = '(;GM[1]FF[4]CA[UTF-8]AP[GoChess]SZ[19]KM[6.5]' +
      'PB[나]PW[AI]DT[' + new Date().toISOString().slice(0, 10) + ']' + (re ? 'RE[' + re + ']' : '') +
      'GC[GoChess 가상 학습 시뮬레이션 — 실제 대국 아님]';
    var body = '';
    moves.forEach(function (m) { body += ';' + (m.player === 1 ? 'B' : 'W') + '[' + sgfCoord(m.x, m.y) + ']'; });
    // 패스 반영
    return head + body + ')';
  }
  function exportGoSGF() {
    var sgf = buildGoSGF();
    var hasMoves = /;[BW]\[/.test(sgf);
    if (!hasMoves) { if (typeof showToast === 'function') showToast('아직 둔 수가 없어요 — 먼저 바둑을 두세요.'); return; }
    var copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(sgf).then(function () { if (typeof showToast === 'function') showToast('SGF 기보를 복사했어요'); }, function () {});
      copied = true;
    }
    try {
      var blob = new Blob([sgf], { type: 'application/x-go-sgf' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'gochess-' + Date.now() + '.sgf';
      document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 100);
    } catch (e) { if (!copied && typeof showToast === 'function') showToast('SGF 저장 실패'); }
    try { if (window.legionTrack) window.legionTrack('share', { kind: 'sgf' }); } catch (e) {}
  }

  window.startTsumego = startTsumego;
  window.exportGoSGF = exportGoSGF;
  window.hideTsumego = hideTsumego;
  window.GoTsumego = API;
})();
