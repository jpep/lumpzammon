// devanture/firebase-config.example.js
// ─────────────────────────────────────────────────────────────────────────────
// Modèle pour devanture/firebase-config.js (gitignoré).
//
// Pourquoi un fichier séparé ? La skin devanture est servie en standalone
// (pas de bundler Vite, juste des scripts dans index.html), donc on ne peut
// pas lire import.meta.env.VITE_FIREBASE_* comme dans la React app. On
// expose la config sur window.FIREBASE_CONFIG, lue ensuite par firebase.js.
//
// Les valeurs viennent de la console Firebase :
//   Project settings → Your apps → Web (</>) → SDK setup → Config
//
// Note sécurité : les Firebase web API keys sont PUBLIQUES par design
// (visibles dans n'importe quel bundle JS client). La sécurité réelle vient
// des Database Rules. Ce fichier est gitignoré uniquement pour rester aligné
// avec le pattern .env de la React app — pas par exigence cryptographique.
//
// Setup :
//   cp devanture/firebase-config.example.js devanture/firebase-config.js
//   # puis éditer firebase-config.js avec les vraies valeurs
// ─────────────────────────────────────────────────────────────────────────────

window.FIREBASE_CONFIG = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'your-project.firebaseapp.com',
  databaseURL:       'https://your-project-default-rtdb.firebaseio.com',
  projectId:         'your-project',
  storageBucket:     'your-project.appspot.com',
  messagingSenderId: '000000000000',
  appId:             '1:000000000000:web:abcdef0123456789',
};
