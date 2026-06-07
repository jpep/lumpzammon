// devanture/firebase-config.js
// ─────────────────────────────────────────────────────────────────────────────
// Config Firebase pour la skin devanture standalone.
// Projet : gmmn-afd53 (Realtime DB en europe-west1).
//
// Ce fichier est INTENTIONNELLEMENT commité. Les Firebase web API keys sont
// publiques par design — elles se retrouvent dans n'importe quel bundle JS
// client (la React app de prod les expose déjà). La sécurité réelle vient
// des Realtime Database Rules + Authentication. La skin étant servie en
// statique (pas de build qui pourrait injecter des secrets), commiter la
// config est le moyen le plus simple de déployer.
//
// firebase-config.example.js reste comme modèle pour une réplication future
// (autre fork, autre projet Firebase).
// ─────────────────────────────────────────────────────────────────────────────

window.FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCRM9mU2e2UGmL2bWg1MzeKM_FsXnK_EWs',
  authDomain:        'gmmn-afd53.firebaseapp.com',
  databaseURL:       'https://gmmn-afd53-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'gmmn-afd53',
  storageBucket:     'gmmn-afd53.firebasestorage.app',
  messagingSenderId: '139967295907',
  appId:             '1:139967295907:web:7ef905568e02a899c5aa16',
  measurementId:     'G-05F5VYBNF1',
};
