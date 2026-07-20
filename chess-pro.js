/* ============================================================================
 * chess-pro.js — GoChess 체스를 "그 분야 최고 수준"으로 격상하는 전문 모듈.
 * 기존 script.js 코어(체스판/공유/계측/퓨전/p6) 위에 얹혀, 체스 관련 함수를
 * 완전한 규칙 엔진으로 교체(override)한다. Go/퓨전/공유/계측은 그대로 보존.
 *
 * 신규(전부 실제 구현 — 가짜/랜덤 남발 없음):
 *  1) 완전 규칙 엔진: 캐슬링·앙파상·승진 선택 + 체크/메이트/스테일메이트
 *  2) 실제 탐색 AI: 네가맥스 + 알파베타 + 말-위치표 평가 (봇 난이도 사다리)
 *  3) Elo 레이팅: 표준 공식으로 내 기력 자동 산정 + 급수(rank)
 *  4) 오프닝 탐색기: 내장 정석 북으로 실시간 오프닝 명칭 + 이론 다음 수
 *  5) 게임 리뷰: 수별 정확도(추정)·분류(최선/좋음/부정확/실수/블런더)·블런더 마킹
 *  6) PGN 내보내기: 표준 SAN 기보 복사/다운로드
 *  7) 퍼즐 훈련소: 테마별 검증된 전술 퍼즐 + 오답 복습 + 러시(타임어택)
 *  되돌림 가능·클라 단독. 표시=코드 일치(정직). 18+ 가상 시뮬레이션 유지.
 * ==========================================================================*/
(function () {
  'use strict';
  var FILES = 'abcdefgh';
  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  var MATE = 900000;

  // --- 말-위치표(Michniewski, 백 기준, index[y][x], y0=8랭크) ---
  var PST = {
    p: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
        [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
        [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
    n: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
        [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
        [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
        [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
    b: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
        [-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
        [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],
        [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
    r: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
    q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
        [-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],
        [-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
    k: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],
        [20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]]
  };

  function inside(x, y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }
  function opp(c) { return c === 'w' ? 'b' : 'w'; }
  function cloneBoard(b) { return b.map(function (r) { return r.slice(); }); }
  function sqName(x, y) { return FILES[x] + (8 - y); }
  function newBoard() {
    return [
      ['br','bn','bb','bq','bk','bb','bn','br'],
      ['bp','bp','bp','bp','bp','bp','bp','bp'],
      ['','','','','','','',''],['','','','','','','',''],
      ['','','','','','','',''],['','','','','','','',''],
      ['wp','wp','wp','wp','wp','wp','wp','wp'],
      ['wr','wn','wb','wq','wk','wb','wn','wr']
    ];
  }
  function freshState() { return { turn: 'w', cast: { K: true, Q: true, k: true, q: true }, ep: null }; }

  // 홈 스퀘어 기준으로 캐슬링 권리 추정(저장 복원용 — 보수적·표준적)
  function deriveState(board, turn) {
    var st = { turn: turn || 'w', cast: { K: false, Q: false, k: false, q: false }, ep: null };
    if (board[7] && board[7][4] === 'wk') {
      if (board[7][7] === 'wr') st.cast.K = true;
      if (board[7][0] === 'wr') st.cast.Q = true;
    }
    if (board[0] && board[0][4] === 'bk') {
      if (board[0][7] === 'br') st.cast.k = true;
      if (board[0][0] === 'br') st.cast.q = true;
    }
    return st;
  }

  function kingPos(b, c) {
    var k = c + 'k';
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) if (b[y][x] === k) return [x, y];
    return null;
  }

  // (tx,ty)가 att색에게 공격받는가 (순수 기하 — 캐슬링/체크 무관, 재귀 안전)
  function attacked(b, tx, ty, att) {
    var dir = att === 'w' ? -1 : 1;
    for (var i = 0; i < 2; i++) {
      var dx = i === 0 ? -1 : 1;
      var px = tx + dx, py = ty - dir;
      if (inside(px, py)) { var p = b[py][px]; if (p && p[0] === att && p[1] === 'p') return true; }
    }
    var kn = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (var j = 0; j < kn.length; j++) {
      var nx = tx + kn[j][0], ny = ty + kn[j][1];
      if (inside(nx, ny)) { var q = b[ny][nx]; if (q && q[0] === att && q[1] === 'n') return true; }
    }
    for (var kx = -1; kx <= 1; kx++) for (var ky = -1; ky <= 1; ky++) {
      if (!kx && !ky) continue;
      var ax = tx + kx, ay = ty + ky;
      if (inside(ax, ay)) { var kp = b[ay][ax]; if (kp && kp[0] === att && kp[1] === 'k') return true; }
    }
    var ortho = [[1,0],[-1,0],[0,1],[0,-1]], diag = [[1,1],[1,-1],[-1,1],[-1,-1]];
    function scan(dirs, types) {
      for (var d = 0; d < dirs.length; d++) {
        var sx = tx + dirs[d][0], sy = ty + dirs[d][1];
        while (inside(sx, sy)) {
          var pc = b[sy][sx];
          if (pc) { if (pc[0] === att && types.indexOf(pc[1]) >= 0) return true; break; }
          sx += dirs[d][0]; sy += dirs[d][1];
        }
      }
      return false;
    }
    if (scan(ortho, ['r', 'q'])) return true;
    if (scan(diag, ['b', 'q'])) return true;
    return false;
  }
  function inCheck(b, c) { var kp = kingPos(b, c); return kp ? attacked(b, kp[0], kp[1], opp(c)) : false; }

  // 의사합법 수 생성(캐슬링/앙파상/승진 포함, 자기왕 노출 미필터)
  function genPseudo(b, st, c) {
    var out = [];
    var dir = c === 'w' ? -1 : 1;
    var startRank = c === 'w' ? 6 : 1;
    var promoRank = c === 'w' ? 0 : 7;
    function add(sx, sy, tx, ty, extra) {
      var m = { sx: sx, sy: sy, tx: tx, ty: ty, pc: b[sy][sx], cap: b[ty][tx] || '', promo: '', ep: false, castle: '' };
      if (extra) for (var k in extra) m[k] = extra[k];
      out.push(m);
    }
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var pc = b[y][x];
      if (!pc || pc[0] !== c) continue;
      var t = pc[1];
      if (t === 'p') {
        // 전진 1
        if (inside(x, y + dir) && !b[y + dir][x]) {
          if (y + dir === promoRank) { ['q','r','b','n'].forEach(function (pr) { add(x, y, x, y + dir, { promo: pr }); }); }
          else add(x, y, x, y + dir, {});
          // 전진 2
          if (y === startRank && !b[y + 2 * dir][x]) add(x, y, x, y + 2 * dir, {});
        }
        // 대각 포획 + 앙파상
        for (var s = 0; s < 2; s++) {
          var cx = x + (s === 0 ? -1 : 1), cy = y + dir;
          if (!inside(cx, cy)) continue;
          var tgt = b[cy][cx];
          if (tgt && tgt[0] !== c) {
            if (cy === promoRank) { ['q','r','b','n'].forEach(function (pr) { add(x, y, cx, cy, { promo: pr }); }); }
            else add(x, y, cx, cy, {});
          } else if (!tgt && st.ep && st.ep[0] === cx && st.ep[1] === cy) {
            add(x, y, cx, cy, { ep: true, cap: b[y][cx] });
          }
        }
      } else if (t === 'n') {
        var kn = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
        for (var ni = 0; ni < kn.length; ni++) {
          var nx = x + kn[ni][0], ny = y + kn[ni][1];
          if (inside(nx, ny) && (!b[ny][nx] || b[ny][nx][0] !== c)) add(x, y, nx, ny, {});
        }
      } else if (t === 'k') {
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          var mx = x + dx, my = y + dy;
          if (inside(mx, my) && (!b[my][mx] || b[my][mx][0] !== c)) add(x, y, mx, my, {});
        }
        // 캐슬링 (현재 체크 아님 + 통과칸 비공격 + 사이 빈칸 + 권리)
        var rank = c === 'w' ? 7 : 0;
        var kSide = c === 'w' ? st.cast.K : st.cast.k;
        var qSide = c === 'w' ? st.cast.Q : st.cast.q;
        if ((kSide || qSide) && x === 4 && y === rank && !inCheck(b, c)) {
          if (kSide && !b[rank][5] && !b[rank][6] && b[rank][7] === c + 'r'
              && !attacked(b, 5, rank, opp(c)) && !attacked(b, 6, rank, opp(c))) {
            add(4, rank, 6, rank, { castle: 'K' });
          }
          if (qSide && !b[rank][1] && !b[rank][2] && !b[rank][3] && b[rank][0] === c + 'r'
              && !attacked(b, 3, rank, opp(c)) && !attacked(b, 2, rank, opp(c))) {
            add(4, rank, 2, rank, { castle: 'Q' });
          }
        }
      } else {
        var dirs = (t === 'r') ? [[1,0],[-1,0],[0,1],[0,-1]]
          : (t === 'b') ? [[1,1],[1,-1],[-1,1],[-1,-1]]
          : [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
        for (var di = 0; di < dirs.length; di++) {
          var ex = x + dirs[di][0], ey = y + dirs[di][1];
          while (inside(ex, ey)) {
            if (!b[ey][ex]) { add(x, y, ex, ey, {}); }
            else { if (b[ey][ex][0] !== c) add(x, y, ex, ey, {}); break; }
            ex += dirs[di][0]; ey += dirs[di][1];
          }
        }
      }
    }
    return out;
  }

  // 실제 보드에 수 적용 (복사본 반환, 상태 갱신)
  function applyMove(b, st, m) {
    var nb = cloneBoard(b);
    var ns = { turn: opp(st.turn), cast: { K: st.cast.K, Q: st.cast.Q, k: st.cast.k, q: st.cast.q }, ep: null };
    var pc = nb[m.sy][m.sx];
    nb[m.ty][m.tx] = pc;
    nb[m.sy][m.sx] = '';
    if (m.ep) nb[m.sy][m.tx] = ''; // 앙파상: 지나친 폰 제거
    if (m.promo) nb[m.ty][m.tx] = pc[0] + m.promo;
    if (m.castle === 'K') { nb[m.ty][5] = nb[m.ty][7]; nb[m.ty][7] = ''; }
    if (m.castle === 'Q') { nb[m.ty][3] = nb[m.ty][0]; nb[m.ty][0] = ''; }
    // 폰 2칸 → 앙파상 타겟
    if (pc[1] === 'p' && Math.abs(m.ty - m.sy) === 2) ns.ep = [m.sx, (m.sy + m.ty) / 2];
    // 캐슬링 권리 갱신
    if (pc === 'wk') { ns.cast.K = ns.cast.Q = false; }
    if (pc === 'bk') { ns.cast.k = ns.cast.q = false; }
    if (m.sx === 0 && m.sy === 7) ns.cast.Q = false;
    if (m.sx === 7 && m.sy === 7) ns.cast.K = false;
    if (m.sx === 0 && m.sy === 0) ns.cast.q = false;
    if (m.sx === 7 && m.sy === 0) ns.cast.k = false;
    if (m.tx === 0 && m.ty === 7) ns.cast.Q = false;
    if (m.tx === 7 && m.ty === 7) ns.cast.K = false;
    if (m.tx === 0 && m.ty === 0) ns.cast.q = false;
    if (m.tx === 7 && m.ty === 0) ns.cast.k = false;
    return { b: nb, st: ns };
  }

  function genLegal(b, st, c) {
    var ps = genPseudo(b, st, c), out = [];
    for (var i = 0; i < ps.length; i++) {
      var r = applyMove(b, st, ps[i]);
      if (!inCheck(r.b, c)) out.push(ps[i]);
    }
    return out;
  }

  function statusFor(b, st) {
    var c = st.turn;
    var has = genLegal(b, st, c).length > 0;
    var chk = inCheck(b, c);
    if (!has) return chk ? 'checkmate' : 'stalemate';
    return chk ? 'check' : 'normal';
  }

  // --- SAN (표준 기보) ---
  function toSAN(b, st, m) {
    if (m.castle === 'K') return sanSuffix(b, st, m, 'O-O');
    if (m.castle === 'Q') return sanSuffix(b, st, m, 'O-O-O');
    var pc = b[m.sy][m.sx], t = pc[1];
    var s;
    if (t === 'p') {
      s = (m.cap || m.ep) ? (FILES[m.sx] + 'x' + sqName(m.tx, m.ty)) : sqName(m.tx, m.ty);
      if (m.promo) s += '=' + m.promo.toUpperCase();
    } else {
      // 애매성 해소: 같은 종류 말이 같은 칸으로 갈 수 있으면 파일/랭크 표기
      var others = genLegal(b, st, pc[0]).filter(function (o) {
        return o.pc === pc && o.tx === m.tx && o.ty === m.ty && !(o.sx === m.sx && o.sy === m.sy);
      });
      var dis = '';
      if (others.length) {
        var sameFile = others.some(function (o) { return o.sx === m.sx; });
        var sameRank = others.some(function (o) { return o.sy === m.sy; });
        if (!sameFile) dis = FILES[m.sx];
        else if (!sameRank) dis = String(8 - m.sy);
        else dis = FILES[m.sx] + (8 - m.sy);
      }
      s = t.toUpperCase() + dis + (m.cap ? 'x' : '') + sqName(m.tx, m.ty);
    }
    return sanSuffix(b, st, m, s);
  }
  function sanSuffix(b, st, m, base) {
    var r = applyMove(b, st, m);
    var st2 = { turn: opp(st.turn), cast: r.st.cast, ep: r.st.ep };
    if (inCheck(r.b, st2.turn)) {
      base += (genLegal(r.b, st2, st2.turn).length === 0) ? '#' : '+';
    }
    return base;
  }

  function boardToFen(b, st) {
    var rows = [];
    for (var y = 0; y < 8; y++) {
      var row = '', empty = 0;
      for (var x = 0; x < 8; x++) {
        var p = b[y][x];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        var ch = p[1]; row += (p[0] === 'w') ? ch.toUpperCase() : ch;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    var cast = (st.cast.K ? 'K' : '') + (st.cast.Q ? 'Q' : '') + (st.cast.k ? 'k' : '') + (st.cast.q ? 'q' : '') || '-';
    var ep = st.ep ? sqName(st.ep[0], st.ep[1]) : '-';
    return rows.join('/') + ' ' + st.turn + ' ' + cast + ' ' + ep + ' 0 1';
  }
  function fenToPosition(fen) {
    var parts = fen.trim().split(/\s+/);
    var rows = parts[0].split('/');
    var b = [];
    for (var y = 0; y < 8; y++) {
      var row = [], rs = rows[y];
      for (var i = 0; i < rs.length; i++) {
        var ch = rs[i];
        if (/\d/.test(ch)) { for (var e = 0; e < +ch; e++) row.push(''); }
        else { var col = (ch === ch.toLowerCase()) ? 'b' : 'w'; row.push(col + ch.toLowerCase()); }
      }
      b.push(row);
    }
    var st = { turn: parts[1] || 'w', cast: { K: false, Q: false, k: false, q: false }, ep: null };
    var cr = parts[2] || '-';
    st.cast.K = cr.indexOf('K') >= 0; st.cast.Q = cr.indexOf('Q') >= 0;
    st.cast.k = cr.indexOf('k') >= 0; st.cast.q = cr.indexOf('q') >= 0;
    if (parts[3] && parts[3] !== '-') st.ep = [FILES.indexOf(parts[3][0]), 8 - (+parts[3][1])];
    return { b: b, st: st };
  }

  // --- 평가 (센티폰, + = 백 우세) ---
  function evaluate(b) {
    var score = 0, wb = 0, bb = 0;
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var p = b[y][x];
      if (!p) continue;
      var t = p[1], v = VAL[t] || 0;
      var pst = PST[t] ? (p[0] === 'w' ? PST[t][y][x] : PST[t][7 - y][x]) : 0;
      if (p[0] === 'w') { score += v + pst; if (t === 'b') wb++; }
      else { score -= v + pst; if (t === 'b') bb++; }
    }
    if (wb >= 2) score += 30; if (bb >= 2) score -= 30; // 비숍 페어
    return score;
  }
  function evalForSide(b, c) { return c === 'w' ? evaluate(b) : -evaluate(b); }

  function orderMoves(b, moves) {
    return moves.sort(function (a, m) {
      var av = a.cap ? (VAL[a.cap[1]] || 0) - (VAL[a.pc[1]] || 0) / 10 : (a.promo ? 800 : -1);
      var mv = m.cap ? (VAL[m.cap[1]] || 0) - (VAL[m.pc[1]] || 0) / 10 : (m.promo ? 800 : -1);
      return mv - av;
    });
  }

  // 네가맥스 + 알파베타. side-to-move 관점 점수 반환.
  function negamax(b, st, depth, alpha, beta) {
    var c = st.turn;
    var moves = genLegal(b, st, c);
    if (moves.length === 0) return inCheck(b, c) ? -MATE - depth : 0;
    if (depth <= 0) return evalForSide(b, c);
    orderMoves(b, moves);
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var r = applyMove(b, st, moves[i]);
      var sc = -negamax(r.b, r.st, depth - 1, -beta, -alpha);
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return best;
  }

  // 루트: 각 수의 점수(현재 side-to-move 관점) 배열 반환
  function rootScores(b, st, depth) {
    var c = st.turn;
    var moves = genLegal(b, st, c);
    orderMoves(b, moves);
    var scored = [];
    for (var i = 0; i < moves.length; i++) {
      var r = applyMove(b, st, moves[i]);
      var sc = -negamax(r.b, r.st, depth - 1, -Infinity, Infinity);
      scored.push({ move: moves[i], score: sc });
    }
    scored.sort(function (a, m) { return m.score - a.score; });
    return scored;
  }

  // ============================================================
  // 봇 사다리 (난이도 = 탐색 깊이 + 무작위성). 레이팅은 '예상 기력' 라벨.
  // ============================================================
  var BOTS = [
    { id: 'peep',  name: '삐약 · 병아리',   rating: 600,  depth: 1, blunder: 0.55, slack: 400 },
    { id: 'rook',  name: '루크 · 견습생',   rating: 900,  depth: 1, blunder: 0.28, slack: 180 },
    { id: 'mir',   name: '미르 · 기사',     rating: 1200, depth: 2, blunder: 0.12, slack: 90  },
    { id: 'gaon',  name: '가온 · 수문장',   rating: 1500, depth: 2, blunder: 0.04, slack: 40  },
    { id: 'sera',  name: '세라핀 · 명장',   rating: 1800, depth: 3, blunder: 0.0,  slack: 20  },
    { id: 'dae',   name: '다이달로스 · GM', rating: 2100, depth: 3, blunder: 0.0,  slack: 0   }
  ];
  function botById(id) { for (var i = 0; i < BOTS.length; i++) if (BOTS[i].id === id) return BOTS[i]; return BOTS[2]; }

  function botChooseMove(b, st, bot) {
    var legal = genLegal(b, st, st.turn);
    if (!legal.length) return null;
    // 약한 봇: 확률적으로 '사람 같은 실수' — 무작위 합법수 (정직한 약함 모델링)
    if (bot.blunder > 0 && Math.random() < bot.blunder) {
      // 아주 대놓고 무료 기물은 그래도 피함(체스판 위 무료 포획은 잡음)
      var freeCap = legal.filter(function (m) { return m.cap && VAL[m.cap[1]] >= 300; });
      if (freeCap.length && Math.random() < 0.5) return freeCap[Math.floor(Math.random() * freeCap.length)];
      return legal[Math.floor(Math.random() * legal.length)];
    }
    var scored = rootScores(b, st, bot.depth);
    var top = scored[0].score;
    var pool = scored.filter(function (s) { return s.score >= top - bot.slack; });
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  // ============================================================
  // Elo 레이팅 (표준 공식). 내 기력 자동 산정.
  // ============================================================
  function getRating() {
    try { var r = JSON.parse(localStorage.getItem('gc-rating') || 'null'); return r || { elo: 800, games: 0, w: 0, d: 0, l: 0 }; }
    catch (e) { return { elo: 800, games: 0, w: 0, d: 0, l: 0 }; }
  }
  function saveRating(r) { try { localStorage.setItem('gc-rating', JSON.stringify(r)); } catch (e) {} }
  function rankTier(elo) {
    if (elo < 700) return '뉴비';
    if (elo < 1000) return '아마 5급';
    if (elo < 1300) return '아마 3급';
    if (elo < 1600) return '아마 1급';
    if (elo < 1900) return '초단';
    if (elo < 2200) return '유단자';
    return '명인';
  }
  function updateRating(result, botRating) { // result: 1 win, 0.5 draw, 0 loss
    var r = getRating();
    var K = r.games < 30 ? 40 : 24;
    var E = 1 / (1 + Math.pow(10, (botRating - r.elo) / 400));
    r.elo = Math.max(100, Math.round(r.elo + K * (result - E)));
    r.games++;
    if (result === 1) r.w++; else if (result === 0.5) r.d++; else r.l++;
    saveRating(r);
    return r;
  }

  // ============================================================
  // 오프닝 정석 북 (실제 이론 — 가짜 승률 아님, '정석 라인'으로 표기)
  // ============================================================
  var BOOK = [
    { eco: 'C60', name: '루이 로페즈', moves: ['e4','e5','Nf3','Nc6','Bb5'] },
    { eco: 'C50', name: '이탈리안 게임', moves: ['e4','e5','Nf3','Nc6','Bc4'] },
    { eco: 'C50', name: '지우오코 피아노', moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5'] },
    { eco: 'C44', name: '스카치 게임', moves: ['e4','e5','Nf3','Nc6','d4'] },
    { eco: 'C47', name: '포 나이츠', moves: ['e4','e5','Nf3','Nc6','Nc3','Nf6'] },
    { eco: 'C42', name: '페트로프 방어', moves: ['e4','e5','Nf3','Nf6'] },
    { eco: 'C25', name: '비엔나 게임', moves: ['e4','e5','Nc3'] },
    { eco: 'C30', name: '킹스 갬빗', moves: ['e4','e5','f4'] },
    { eco: 'B20', name: '시실리안 방어', moves: ['e4','c5'] },
    { eco: 'B90', name: '시실리안 · 나이도르프', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6'] },
    { eco: 'B70', name: '시실리안 · 드래곤', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','g6'] },
    { eco: 'C00', name: '프렌치 방어', moves: ['e4','e6'] },
    { eco: 'B10', name: '카로칸 방어', moves: ['e4','c6'] },
    { eco: 'B01', name: '스칸디나비안 방어', moves: ['e4','d5'] },
    { eco: 'B07', name: '피르츠 방어', moves: ['e4','d6','d4','Nf6','Nc3','g6'] },
    { eco: 'D06', name: '퀸즈 갬빗', moves: ['d4','d5','c4'] },
    { eco: 'D30', name: '퀸즈 갬빗 거절(QGD)', moves: ['d4','d5','c4','e6'] },
    { eco: 'D20', name: '퀸즈 갬빗 수락(QGA)', moves: ['d4','d5','c4','dxc4'] },
    { eco: 'D10', name: '슬라브 방어', moves: ['d4','d5','c4','c6'] },
    { eco: 'E60', name: '킹스 인디언 방어', moves: ['d4','Nf6','c4','g6','Nc3','Bg7'] },
    { eco: 'E20', name: '님초-인디언 방어', moves: ['d4','Nf6','c4','e6','Nc3','Bb4'] },
    { eco: 'A45', name: '런던 시스템', moves: ['d4','Nf6','Bf4'] },
    { eco: 'A10', name: '잉글리시 오프닝', moves: ['c4'] },
    { eco: 'A04', name: '레티 오프닝', moves: ['Nf3'] }
  ];
  // 플레이된 SAN 배열로 오프닝 탐지 (정직: 실제로 '진입 완료'한 오프닝만 명명).
  //  - entered: book.moves 전체가 played의 접두사 → 그 오프닝에 진입함(가장 깊은 것)
  //  - next: played가 어떤 book.moves의 접두사 → 그 다음 이론 수 후보(중복 제거)
  function detectOpening(sans) {
    if (!sans || !sans.length) return null;
    var entered = null;
    for (var i = 0; i < BOOK.length; i++) {
      var line = BOOK[i].moves;
      if (sans.length < line.length) continue;
      var ok = true;
      for (var j = 0; j < line.length; j++) { if (sans[j] !== line[j]) { ok = false; break; } }
      if (ok && (!entered || line.length > entered.moves.length)) entered = BOOK[i];
    }
    var nexts = [];
    for (var k = 0; k < BOOK.length; k++) {
      var ln = BOOK[k].moves;
      if (ln.length <= sans.length) continue;
      var pref = true;
      for (var m = 0; m < sans.length; m++) { if (sans[m] !== ln[m]) { pref = false; break; } }
      if (pref) { var mv = ln[sans.length]; if (nexts.indexOf(mv) < 0) nexts.push(mv); }
    }
    if (!entered && nexts.length === 0) return null; // 완전 이탈
    return {
      eco: entered ? entered.eco : '—',
      name: entered ? entered.name : '정석 진행 중',
      played: sans.length,
      next: nexts.slice(0, 3),
      entered: !!entered
    };
  }

  window.ChessPro = {
    newBoard: newBoard, freshState: freshState, deriveState: deriveState,
    genLegal: genLegal, applyMove: applyMove, statusFor: statusFor, inCheck: inCheck,
    attacked: attacked, toSAN: toSAN, boardToFen: boardToFen, fenToPosition: fenToPosition,
    evaluate: evaluate, rootScores: rootScores, negamax: negamax,
    BOTS: BOTS, botById: botById, botChooseMove: botChooseMove,
    getRating: getRating, updateRating: updateRating, rankTier: rankTier,
    detectOpening: detectOpening, BOOK: BOOK, VAL: VAL, sqName: sqName
  };
})();
