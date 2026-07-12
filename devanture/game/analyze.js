// analyze.js — Analyse post-partie (autonome, expose `window.GameAnalyzer`).
//
// Prend UN enregistrement produit par GameLog (voir gamelog.js), rejoue la
// partie via Logic, et note chaque décision avec l'IA :
//   • perte d'équité par coup  = winProb(meilleur) − winProb(joué)  (≥ 0)
//   • coups "forcés" (1 seule séquence légale) exclus du jugement
//   • courbe de probabilité de victoire (blanc) coup par coup
//   • décisions de cube comparées à AI.cubeAction / AI.cubeTake
//
// Sortie = même forme que la maquette d'analyse : { game, players, timeline,
// keyMoments }. Dépend de Logic + AI (globaux). Aucune dépendance DOM.

(function (global) {
  'use strict';

  // Seuils de classification (en unités de probabilité de victoire).
  var T_BLUNDER = 0.06, T_ERROR = 0.03, T_DOUBTFUL = 0.012;
  var MAX_KEY = 8;          // nb de moments clés retournés
  var ENUM_CAP = 200;       // cap d'énumération des séquences candidates

  function toIdx(x) { return (x === 'bar' || x === 'off') ? x : x - 1; }   // 1-idx → Logic
  function lbl(x)   { return (x === 'bar' || x === 'off') ? x : x + 1; }   // Logic → 1-idx
  function fmtSeq(seq) {
    if (!seq || !seq.length) return '—';
    return seq.map(function (m) { return lbl(m.f) + '/' + lbl(m.t); }).join(' ');
  }
  function classify(loss, forced) {
    if (forced) return 'forced';
    if (loss >= T_BLUNDER)  return 'blunder';
    if (loss >= T_ERROR)    return 'error';
    if (loss >= T_DOUBTFUL) return 'doubtful';
    return 'ok';
  }

  function analyze(rec) {
    if (!rec || !rec.events) return null;

    var state = Logic.newGameState();
    var pending = null;                       // tour en cours de jeu (à noter)
    var rows = [], timeline = [], cubeRows = [];
    var ply = 0;

    function startTurn(pl, dice) {
      state.turn  = pl;
      state.dice  = dice.slice();
      state.moves = dice.slice();
      var cands = AI.enumerateSequences(state, pl, ENUM_CAP);
      var best = null, wpBest = -1;
      for (var i = 0; i < cands.length; i++) {
        var wp = AI.winProb(cands[i].state, pl, false);
        if (wp > wpBest) { wpBest = wp; best = cands[i]; }
      }
      pending = { pl: pl, dice: dice.slice(), forced: cands.length <= 1,
                  wpBest: wpBest, best: best, playedMoves: [] };
    }
    function finalizeTurn() {
      if (!pending) return;
      var pl = pending.pl;
      var wpPlayed = AI.winProb(state, pl, false);
      var loss = Math.max(0, pending.wpBest - wpPlayed);
      var sev = classify(loss, pending.forced);
      rows.push({
        pl: pl, dice: pending.dice, loss: loss, sev: sev, forced: pending.forced,
        playedMoves: pending.playedMoves.slice(),
        bestSeq: pending.best ? pending.best.seq : [],
        bestState: pending.best ? pending.best.state : null,
        playedState: Logic.clone(state),
      });
      ply++;
      var whiteOnRoll = (pl === 2);           // si black vient de jouer, white est sur le trait
      timeline.push({ ply: ply, who: pl === 1 ? 'white' : 'black',
                      winWhite: AI.winProb(state, 1, whiteOnRoll), loss: loss, sev: sev });
      pending = null;
    }
    function gradeCube(ev) {
      if (ev.ev === 'offer') {
        var pl = ev.by === 'white' ? 1 : 2;
        var ok = AI.cubeAction(state, pl, true) === 'double';
        cubeRows.push({ kind: 'offer', by: ev.by, ok: ok,
                        verdict: ok ? 'double justifié' : 'double prématuré' });
      } else if (ev.ev === 'take' || ev.ev === 'drop') {
        var pl2 = ev.by === 'white' ? 1 : 2;
        var shouldTake = AI.cubeTake(state, pl2, true);
        var took = ev.ev === 'take';
        var ok2 = (took === shouldTake);
        cubeRows.push({ kind: ev.ev, by: ev.by, ok: ok2,
                        verdict: ok2 ? (took ? 'prise correcte' : 'passe correcte')
                                     : (took ? 'prise de trop (passe attendue)' : 'passe de trop (prise attendue)') });
      }
    }

    for (var e = 0; e < rec.events.length; e++) {
      var ev = rec.events[e];
      if (ev.k === 'roll') {
        finalizeTurn();                       // clôt un tour resté ouvert (dés non tous joués)
        startTurn(ev.p === 'white' ? 1 : 2, ev.dice);
      } else if (ev.k === 'move') {
        for (var j = 0; j < ev.moves.length; j++) {
          var m = ev.moves[j];
          if (pending) pending.playedMoves.push({ f: m.f, t: m.t, d: m.d });
          state = Logic.applyMove(state, state.turn, { f: toIdx(m.f), t: toIdx(m.t), d: m.d });
        }
        if (state.moves.length === 0) finalizeTurn();
      } else if (ev.k === 'pass') {
        pending = null;                       // passe forcée : rien à juger
      } else if (ev.k === 'cube') {
        gradeCube(ev);
      }
    }
    finalizeTurn();

    // ── Agrégats par joueur ────────────────────────────────────────────────
    function blankP() { return { decisions: 0, forced: 0, blunders: 0, errors: 0,
                                 doubtful: 0, equityLost: 0, pr: 0 }; }
    var P = { white: blankP(), black: blankP() };
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], key = row.pl === 1 ? 'white' : 'black';
      if (row.forced) { P[key].forced++; continue; }
      P[key].decisions++;
      P[key].equityLost += row.loss;
      if (row.sev === 'blunder')  P[key].blunders++;
      else if (row.sev === 'error') P[key].errors++;
      else if (row.sev === 'doubtful') P[key].doubtful++;
    }
    ['white', 'black'].forEach(function (k) {
      P[k].equityLost = +P[k].equityLost.toFixed(3);
      P[k].pr = P[k].decisions ? +((P[k].equityLost / P[k].decisions) * 500).toFixed(1) : 0;
    });

    // Temps de réflexion moyen (think si présent, sinon dt) par joueur.
    var think = { white: [], black: [] };
    rec.events.forEach(function (ev) {
      if (ev.k === 'move') {
        var v = (typeof ev.think === 'number') ? ev.think : ev.dt;
        if (typeof v === 'number') think[ev.p].push(v);
      }
    });
    ['white', 'black'].forEach(function (k) {
      P[k].avgThinkMs = think[k].length
        ? Math.round(think[k].reduce(function (a, b) { return a + b; }, 0) / think[k].length) : 0;
    });

    // Cube par joueur.
    P.white.cube = { ok: 0, total: 0 };
    P.black.cube = { ok: 0, total: 0 };
    cubeRows.forEach(function (c) { var k = c.by; P[k].cube.total++; if (c.ok) P[k].cube.ok++; });

    // ── Moments clés (tous joueurs, triés par perte) ──────────────────────────
    var key = rows
      .filter(function (r) { return !r.forced && r.sev !== 'ok'; })
      .sort(function (a, b) { return b.loss - a.loss; })
      .slice(0, MAX_KEY)
      .map(function (r) {
        var opp = r.pl === 1 ? 2 : 1;
        var missedHit = r.bestState && r.bestState.bar[opp] > r.playedState.bar[opp];
        var note = missedHit
          ? 'Occasion de taper manquée — le meilleur coup envoie une fiche adverse à la barre.'
          : 'Coup sous-optimal (−' + r.loss.toFixed(2) + ' de probabilité de victoire).';
        return {
          turn: 0, who: r.pl === 1 ? 'white' : 'black',
          dice: r.dice.slice(0, 2).join('-'),
          played: fmtSeq(r.playedMoves), best: fmtSeq(r.bestSeq),
          loss: +r.loss.toFixed(3), sev: r.sev, note: note,
        };
      });

    return {
      game: {
        players: rec.players, mode: rec.mode, aiVersion: rec.aiVersion,
        result: rec.result, startedAt: rec.startedAt, durationMs: rec.durationMs,
      },
      players: P,
      timeline: timeline,
      cube: cubeRows,
      keyMoments: key,
    };
  }

  function analyzeLatest() {
    if (typeof GameLog === 'undefined') return null;
    var all = GameLog.all();
    return all.length ? analyze(all[all.length - 1]) : null;
  }

  // Résumé console lisible (pour debug / usage rapide).
  function report(rec) {
    var a = rec ? analyze(rec) : analyzeLatest();
    if (!a) { console.log('GameAnalyzer : aucune partie à analyser.'); return null; }
    var w = a.players.white;
    console.log('%cAnalyse — ' + (a.game.players ? a.game.players.white : 'white') +
      ' vs ' + (a.game.players ? a.game.players.black : 'black'), 'color:#6cf;font-weight:bold');
    console.log('  PR (blanc) : ' + w.pr + ' · décisions : ' + w.decisions +
      ' · graves : ' + w.blunders + ' · erreurs : ' + w.errors + ' · douteux : ' + w.doubtful);
    console.log('  Équité perdue : ' + w.equityLost + ' · cube : ' + w.cube.ok + '/' + w.cube.total +
      ' · ⌀ réflexion : ' + w.avgThinkMs + ' ms');
    console.log('  Moments clés :');
    a.keyMoments.forEach(function (m) {
      console.log('   · ' + m.who + ' ' + m.dice + ' [' + m.sev + ' −' + m.loss.toFixed(2) + '] joué ' +
        m.played + ' / meilleur ' + m.best);
    });
    return a;
  }

  // ── Métadonnées par partie (rejeu Logic seul, SANS IA → rapide) ───────────
  // Sortie plate, prête pour l'analyse / l'export CSV.
  function meta(rec) {
    if (!rec || !rec.events) return null;
    var state = Logic.newGameState();
    var pipStart = { white: Logic.calcPipCount(state, 1), black: Logic.calcPipCount(state, 2) };
    var hits = { white: 0, black: 0 }, doubles = { white: 0, black: 0 },
        rolls = { white: 0, black: 0 }, moves = { white: 0, black: 0 },
        passes = { white: 0, black: 0 }, danced = { white: 0, black: 0 },
        think = { white: [], black: [] };

    for (var i = 0; i < rec.events.length; i++) {
      var ev = rec.events[i];
      if (ev.k === 'roll') {
        state.turn = ev.p === 'white' ? 1 : 2;
        state.dice = ev.dice.slice(); state.moves = ev.dice.slice();
        rolls[ev.p]++;
        if (ev.dice.length > 2) doubles[ev.p]++;          // doubles = 4 dés
      } else if (ev.k === 'move') {
        var opp = state.turn === 1 ? 2 : 1, barBefore = state.bar[opp];
        for (var j = 0; j < ev.moves.length; j++) {
          var m = ev.moves[j];
          state = Logic.applyMove(state, state.turn, { f: toIdx(m.f), t: toIdx(m.t), d: m.d });
        }
        hits[ev.p] += Math.max(0, state.bar[opp] - barBefore);
        moves[ev.p]++;
        var v = (typeof ev.think === 'number') ? ev.think : ev.dt;
        if (typeof v === 'number') think[ev.p].push(v);
      } else if (ev.k === 'pass') {
        passes[ev.p]++;
        if (ev.reason === 'bar-blocked') danced[ev.p]++;
      }
    }

    var pipEnd = { white: Logic.calcPipCount(state, 1), black: Logic.calcPipCount(state, 2) };
    function avg(a) { return a.length ? Math.round(a.reduce(function (s, x) { return s + x; }, 0) / a.length) : 0; }
    function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }

    var tz = (typeof rec.tz === 'number') ? rec.tz : 0;
    var startMs = Date.parse(rec.startedAt);
    var loc = new Date(startMs + tz * 60000);
    var WD = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    var res = rec.result || {};

    return {
      id: rec.id, schemaVersion: rec.v, aiVersion: rec.aiVersion, mode: rec.mode,
      players: rec.players,
      startedAt: rec.startedAt, endedAt: rec.endedAt, tzOffsetMin: tz,
      hourLocal: isNaN(startMs) ? null : loc.getUTCHours(),
      weekday:   isNaN(startMs) ? null : WD[loc.getUTCDay()],
      durationMs: rec.durationMs || 0, durationSec: Math.round((rec.durationMs || 0) / 1000),
      result: { winner: res.winner || null, type: res.type || null, points: res.points || null, cube: res.cube || 1 },
      opening: rec.opening || null,
      plies: moves.white + moves.black, turns: rolls.white + rolls.black,
      pipStart: pipStart, pipEnd: pipEnd,
      pipReduced: { white: pipStart.white - pipEnd.white, black: pipStart.black - pipEnd.black },
      marginPips: (res.winner === 'white') ? pipEnd.black : (res.winner === 'black') ? pipEnd.white : null,
      borneOff: { white: state.off[1], black: state.off[2] },
      onBarEnd: { white: state.bar[1], black: state.bar[2] },
      hits: hits, doubles: doubles, rolls: rolls, moves: moves, passes: passes, danced: danced,
      think: { whiteAvgMs: avg(think.white), blackAvgMs: avg(think.black),
               whiteSumMs: sum(think.white), blackSumMs: sum(think.black) },
    };
  }

  function metaAll() {
    if (typeof GameLog === 'undefined') return [];
    return GameLog.all().map(meta);
  }

  // Export CSV : 1 ligne par partie, colonnes plates (idéal pour analyse externe).
  function exportMetaCSV() {
    var rows = metaAll();
    var cols = ['id','startedAt','hourLocal','weekday','mode','aiVersion','winner','type','points','cube',
      'durationSec','plies','turns','pipStartW','pipStartB','pipEndW','pipEndB','marginPips','offW','offB',
      'hitsW','hitsB','doublesW','doublesB','rollsW','rollsB','dancedW','dancedB','thinkAvgW','thinkAvgB',
      'openFirst','openW','openB'];
    function row(m) {
      var o = m.opening || {};
      return [m.id, m.startedAt, m.hourLocal, m.weekday, m.mode, m.aiVersion,
        m.result.winner, m.result.type, m.result.points, m.result.cube,
        m.durationSec, m.plies, m.turns,
        m.pipStart.white, m.pipStart.black, m.pipEnd.white, m.pipEnd.black, m.marginPips,
        m.borneOff.white, m.borneOff.black, m.hits.white, m.hits.black,
        m.doubles.white, m.doubles.black, m.rolls.white, m.rolls.black,
        m.danced.white, m.danced.black, m.think.whiteAvgMs, m.think.blackAvgMs,
        o.first || '', o.white || '', o.black || ''];
    }
    function esc(x) { if (x == null) return ''; x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
    var data = [cols.join(',')].concat(rows.map(function (m) { return row(m).map(esc).join(','); })).join('\n');
    if (typeof document === 'undefined' || typeof Blob === 'undefined') return data;
    var blob = new Blob([data], { type: 'text/csv' }), url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'devanture_meta_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return rows.length + ' partie(s) exportée(s) en CSV';
  }

  // ── Agrégat sur TOUTES les parties enregistrées (métadonnées, sans IA) ──────
  function stats() {
    var ms = metaAll();
    if (!ms.length) { if (global.console) console.log('GameAnalyzer.stats : aucune partie enregistrée.'); return { n: 0 }; }
    var n = ms.length;
    var byMode = {}, byVer = {}, byHour = {}, byWeekday = {};
    var humanWins = 0, aiWins = 0, aiGames = 0, gammons = 0, bgs = 0;
    var pliesSum = 0, durSum = 0, marginSum = 0, marginN = 0;
    var hitsW = 0, hitsB = 0, dblW = 0, dblB = 0;
    var thinkWsum = 0, thinkWn = 0, thinkBsum = 0, thinkBn = 0;
    var first = ms[0].startedAt, last = ms[0].startedAt;
    function inc(o, k) { if (k != null) o[k] = (o[k] || 0) + 1; }

    ms.forEach(function (m) {
      inc(byMode, m.mode); inc(byVer, m.aiVersion || '?');
      inc(byHour, m.hourLocal); inc(byWeekday, m.weekday);
      pliesSum += m.plies || 0; durSum += m.durationSec || 0;
      if (m.marginPips != null) { marginSum += m.marginPips; marginN++; }
      hitsW += m.hits.white; hitsB += m.hits.black;
      dblW += m.doubles.white; dblB += m.doubles.black;
      if (m.think) {
        if (m.think.whiteSumMs) { thinkWsum += m.think.whiteSumMs; thinkWn += m.moves ? 1 : 0; }
        if (m.think.blackSumMs) { thinkBsum += m.think.blackSumMs; thinkBn += m.moves ? 1 : 0; }
      }
      if (m.startedAt < first) first = m.startedAt;
      if (m.startedAt > last) last = m.startedAt;
      if (m.mode === 'ai') {
        aiGames++;
        if (m.result.winner === 'white') humanWins++;
        else if (m.result.winner === 'black') aiWins++;
        if (m.result.type === 'gammon') gammons++;
        else if (m.result.type === 'backgammon') bgs++;
      }
    });

    var out = {
      n: n, period: { from: first, to: last }, byMode: byMode, byEngine: byVer,
      vsAI: { games: aiGames, humanWins: humanWins, aiWins: aiWins,
              humanWinRate: (humanWins + aiWins) ? +(humanWins / (humanWins + aiWins)).toFixed(3) : null,
              gammons: gammons, backgammons: bgs },
      avgDurationSec: +(durSum / n).toFixed(0), avgPlies: +(pliesSum / n).toFixed(0),
      avgLoserMarginPips: marginN ? +(marginSum / marginN).toFixed(1) : null,
      hits: { white: hitsW, black: hitsB }, doublesRolled: { white: dblW, black: dblB },
      byHourLocal: byHour, byWeekday: byWeekday,
    };

    if (global.console) {
      console.log('%cStats — ' + n + ' partie(s) enregistrée(s)', 'font-weight:bold;color:#6cf');
      console.log('  période : ' + first.slice(0, 10) + ' → ' + last.slice(0, 10));
      console.log('  modes : ' + JSON.stringify(byMode) + ' · moteurs : ' + JSON.stringify(byVer));
      if (aiGames) {
        console.log('  vs IA (' + aiGames + ') : toi ' + humanWins + ' / IA ' + aiWins +
          ' → ton winrate = ' + (out.vsAI.humanWinRate != null ? Math.round(out.vsAI.humanWinRate * 100) + '%' : '—') +
          ' · gammons ' + gammons + ' · backgammons ' + bgs);
      }
      console.log('  durée moy. ' + out.avgDurationSec + 's · longueur moy. ' + out.avgPlies + ' demi-coups' +
        (out.avgLoserMarginPips != null ? ' · marge moy. perdant ' + out.avgLoserMarginPips + ' pips' : ''));
      console.log('  tapes (toi/IA) ' + hitsW + '/' + hitsB + ' · doubles dés (toi/IA) ' + dblW + '/' + dblB);
      console.log('  heures de jeu : ' + JSON.stringify(byHour));
    }
    return out;
  }

  global.GameAnalyzer = {
    analyze: analyze, analyzeLatest: analyzeLatest, report: report,
    meta: meta, metaAll: metaAll, exportMetaCSV: exportMetaCSV, stats: stats,
  };

})(typeof window !== 'undefined' ? window : this);
