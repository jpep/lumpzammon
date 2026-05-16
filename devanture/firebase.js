// devanture/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// Couche Firebase pour la skin devanture (standalone, sans bundler).
//
// Architecture :
//   - SDK chargé via les scripts compat dans index.html (window.firebase)
//   - Config exposée par firebase-config.js sur window.FIREBASE_CONFIG
//   - Auth anonyme automatique au boot → UID stable côté session navigateur
//   - Realtime Database : namespace /players/<nick>/
//
// Schéma /players/<nick> :
//   {
//     firstPlay:   '2026-05-16T14:30:00.000Z',   // ISO date du premier match
//     totalGames:  number,                        // parties jouées (toutes issues)
//     wins:        number,                        // victoires
//     winPercent:  number,                        // wins / totalGames (0..1)
//     recentGames: [                              // append-only, capé à 50
//       { youScore, oppScore, opponent, delta, playedAt },
//       ...
//     ],
//     scoreHistory: [                             // courbe d'évolution
//       { date: '2026-05-16', score: 12 },
//       ...
//     ],
//   }
//
// Le nick est utilisé comme clé après sanitisation (Firebase RTDB rejette
// . $ # [ ] /). Voir sanitizeNick().
//
// API publique (toutes les fonctions sont async) :
//   await Devanture.firebase.init()
//   await Devanture.firebase.getPlayer(nick)
//   await Devanture.firebase.appendGame(nick, gameResult)
//   Devanture.firebase.isReady()
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const RECENT_GAMES_CAP = 50;

  let _app  = null;
  let _db   = null;
  let _uid  = null;
  let _ready = false;
  let _initPromise = null;

  function sanitizeNick(nick) {
    // Firebase RTDB clés : pas de . $ # [ ] /  — on remplace par _
    return String(nick || '').toLowerCase().replace(/[.$#\[\]/]/g, '_').trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayDate() {
    return nowIso().slice(0, 10);
  }

  function _checkSdk() {
    if (typeof firebase === 'undefined') {
      throw new Error('[devanture/firebase] SDK non chargé. Vérifie les <script> compat dans index.html.');
    }
    if (!window.FIREBASE_CONFIG) {
      throw new Error('[devanture/firebase] window.FIREBASE_CONFIG manquant. Copie firebase-config.example.js vers firebase-config.js.');
    }
  }

  async function init() {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      _checkSdk();
      _app = firebase.initializeApp(window.FIREBASE_CONFIG);
      _db  = firebase.database();

      // Auth anonyme : crée un UID stable par navigateur. Persisté localement
      // par le SDK Firebase Auth donc on retombe sur le même UID au rechargement.
      const credential = await firebase.auth().signInAnonymously();
      _uid = credential.user.uid;
      _ready = true;
      console.log('[devanture/firebase] ready, uid=' + _uid);
      return { uid: _uid };
    })();
    return _initPromise;
  }

  function isReady() {
    return _ready;
  }

  async function getPlayer(nick) {
    if (!_ready) await init();
    const key = sanitizeNick(nick);
    if (!key) return null;
    const snap = await _db.ref('players/' + key).once('value');
    return snap.exists() ? snap.val() : null;
  }

  // Crée le profil si absent. Renvoie le profil (existant ou créé).
  async function ensurePlayer(nick) {
    if (!_ready) await init();
    const key = sanitizeNick(nick);
    if (!key) return null;
    const ref = _db.ref('players/' + key);
    const snap = await ref.once('value');
    if (snap.exists()) return snap.val();
    const fresh = {
      firstPlay:    nowIso(),
      totalGames:   0,
      wins:         0,
      winPercent:   0,
      recentGames:  [],
      scoreHistory: [ { date: todayDate(), score: 0 } ],
    };
    await ref.set(fresh);
    return fresh;
  }

  // gameResult :
  //   { youScore, oppScore, opponent, delta, didWin, playedAt? }
  // Met à jour totalGames, wins, winPercent, recentGames (capé), scoreHistory.
  async function appendGame(nick, gameResult) {
    if (!_ready) await init();
    const key = sanitizeNick(nick);
    if (!key) return null;
    const ref = _db.ref('players/' + key);
    const snap = await ref.once('value');
    const profile = snap.exists()
      ? snap.val()
      : {
          firstPlay:    nowIso(),
          totalGames:   0,
          wins:         0,
          winPercent:   0,
          recentGames:  [],
          scoreHistory: [],
        };

    const playedAt = gameResult.playedAt || nowIso();
    const newEntry = {
      youScore: Number(gameResult.youScore) || 0,
      oppScore: Number(gameResult.oppScore) || 0,
      opponent: String(gameResult.opponent || 'AI'),
      delta:    Number(gameResult.delta) || 0,
      playedAt,
    };

    profile.totalGames = (profile.totalGames || 0) + 1;
    if (gameResult.didWin) profile.wins = (profile.wins || 0) + 1;
    profile.winPercent = profile.totalGames > 0
      ? profile.wins / profile.totalGames
      : 0;

    profile.recentGames = Array.isArray(profile.recentGames)
      ? [newEntry, ...profile.recentGames].slice(0, RECENT_GAMES_CAP)
      : [newEntry];

    // scoreHistory : cumul de delta par jour ; agrège si même date que le dernier point
    const dayKey = playedAt.slice(0, 10);
    if (!Array.isArray(profile.scoreHistory) || profile.scoreHistory.length === 0) {
      profile.scoreHistory = [ { date: dayKey, score: newEntry.delta } ];
    } else {
      const last = profile.scoreHistory[profile.scoreHistory.length - 1];
      const cumulFromLast = (last.score || 0) + newEntry.delta;
      if (last.date === dayKey) {
        last.score = cumulFromLast;
      } else {
        profile.scoreHistory.push({ date: dayKey, score: cumulFromLast });
      }
    }

    await ref.set(profile);
    return profile;
  }

  // Exposition publique (namespace pour éviter de polluer le global)
  window.Devanture = window.Devanture || {};
  window.Devanture.firebase = {
    init,
    isReady,
    getPlayer,
    ensurePlayer,
    appendGame,
    sanitizeNick,
  };
})();
