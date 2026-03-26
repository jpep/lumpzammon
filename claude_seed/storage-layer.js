// ============================================================
// FILE: src/storage/index.js
// Auto-selects the right adapter based on environment
// ============================================================

import { createArtifactAdapter } from './artifactAdapter';
import { createFirebaseAdapter } from './firebaseAdapter';

function detectEnvironment() {
  // Claude artifact sandbox exposes window.storage
  if (typeof window !== 'undefined' && window.storage) {
    return 'artifact';
  }
  return 'firebase';
}

let adapter = null;

export function getStorage() {
  if (!adapter) {
    const env = detectEnvironment();
    console.log(`[Storage] Using ${env} adapter`);
    adapter = env === 'artifact'
      ? createArtifactAdapter()
      : createFirebaseAdapter();
  }
  return adapter;
}

// Convenience exports matching the original sGet/sSet/sDel/sList API
export async function sGet(key) { return getStorage().get(key); }
export async function sSet(key, value) { return getStorage().set(key, value); }
export async function sDel(key) { return getStorage().del(key); }
export async function sList(prefix) { return getStorage().list(prefix); }

// Optional: real-time subscription (Firebase only, falls back to polling)
export function sSubscribe(key, callback) {
  const s = getStorage();
  if (s.subscribe) return s.subscribe(key, callback);
  // Fallback: poll every 1.5s
  const iv = setInterval(async () => {
    const val = await s.get(key);
    callback(val);
  }, 1500);
  return () => clearInterval(iv);
}


// ============================================================
// FILE: src/storage/artifactAdapter.js
// For running inside Claude's artifact sandbox
// ============================================================

export function createArtifactAdapter() {
  return {
    async get(key) {
      try {
        const r = await window.storage.get(key, true);
        return r ? JSON.parse(r.value) : null;
      } catch { return null; }
    },

    async set(key, value) {
      try {
        await window.storage.set(key, JSON.stringify(value), true);
        return true;
      } catch { return false; }
    },

    async del(key) {
      try { await window.storage.delete(key, true); }
      catch { /* ignore */ }
    },

    async list(prefix) {
      try {
        const r = await window.storage.list(prefix, true);
        return r?.keys || [];
      } catch { return []; }
    }
  };
}


// ============================================================
// FILE: src/storage/firebaseAdapter.js
// For hosted deployment (GitHub Pages, etc.)
// ============================================================

import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, get, set, remove, onValue,
  query, orderByKey, startAt, endAt
} from 'firebase/database';

// ----- REPLACE WITH YOUR FIREBASE CONFIG -----
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "YOUR_APP_ID"
};
// -----------------------------------------------

let db = null;

function getDb() {
  if (!db) {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
  return db;
}

// Firebase keys can't contain . $ # [ ] / so we sanitize
function sanitizeKey(key) {
  return key.replace(/[.$/\[\]#]/g, '_');
}

export function createFirebaseAdapter() {
  return {
    async get(key) {
      try {
        const snap = await get(ref(getDb(), sanitizeKey(key)));
        return snap.exists() ? snap.val() : null;
      } catch (e) {
        console.error('[Firebase] get error:', e);
        return null;
      }
    },

    async set(key, value) {
      try {
        await set(ref(getDb(), sanitizeKey(key)), value);
        return true;
      } catch (e) {
        console.error('[Firebase] set error:', e);
        return false;
      }
    },

    async del(key) {
      try {
        await remove(ref(getDb(), sanitizeKey(key)));
      } catch (e) {
        console.error('[Firebase] del error:', e);
      }
    },

    async list(prefix) {
      try {
        // Firebase doesn't have native prefix listing,
        // so we store all keys under a flat "keys" node
        // and query by range
        const sPrefix = sanitizeKey(prefix);
        const end = sPrefix.slice(0, -1) +
          String.fromCharCode(sPrefix.charCodeAt(sPrefix.length - 1) + 1);
        const q = query(
          ref(getDb()),
          orderByKey(),
          startAt(sPrefix),
          endAt(end)
        );
        const snap = await get(q);
        if (!snap.exists()) return [];
        return Object.keys(snap.val()).filter(k => k.startsWith(sPrefix));
      } catch (e) {
        console.error('[Firebase] list error:', e);
        return [];
      }
    },

    // Real-time subscription — replaces polling!
    subscribe(key, callback) {
      const unsubscribe = onValue(
        ref(getDb(), sanitizeKey(key)),
        (snap) => {
          callback(snap.exists() ? snap.val() : null);
        },
        (error) => {
          console.error('[Firebase] subscribe error:', error);
        }
      );
      return unsubscribe;
    }
  };
}
