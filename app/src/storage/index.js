import { createArtifactAdapter } from './artifactAdapter';
import { createFirebaseAdapter } from './firebaseAdapter';

function detectEnvironment() {
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

export async function sGet(key) { return getStorage().get(key); }
export async function sSet(key, value) { return getStorage().set(key, value); }
export async function sDel(key) { return getStorage().del(key); }
export async function sList(prefix) { return getStorage().list(prefix); }

export function sSubscribe(key, callback) {
  const s = getStorage();
  if (s.subscribe) return s.subscribe(key, callback);
  const iv = setInterval(async () => {
    const val = await s.get(key);
    callback(val);
  }, 1500);
  return () => clearInterval(iv);
}
