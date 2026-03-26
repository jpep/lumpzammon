import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, get, set, remove, onValue,
  query, orderByKey, startAt, endAt
} from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let db = null;

function getDb() {
  if (!db) {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
  return db;
}

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
