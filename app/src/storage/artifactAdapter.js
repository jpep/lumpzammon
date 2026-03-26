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
