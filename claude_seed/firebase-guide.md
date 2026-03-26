# Firebase Realtime Database — Setup Guide

## 1. Create a Firebase Project (2 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `backgammon-online`)
3. Disable Google Analytics (not needed) → **Create project**

## 2. Enable Realtime Database (1 min)

1. In sidebar: **Build → Realtime Database**
2. Click **Create Database**
3. Choose region (e.g. `us-central1`)
4. Start in **test mode** (open rules — fine for prototyping)
5. Click **Enable**

## 3. Get Your Config (1 min)

1. Click the **gear icon** → **Project settings**
2. Scroll down to **Your apps** → click **Web** (`</>` icon)
3. Register app (any nickname)
4. Copy the `firebaseConfig` object
5. Paste it into `src/storage/firebaseAdapter.js`

## 4. Database Rules (for prototyping)

In **Realtime Database → Rules**, use:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ This is wide open — fine for dev/prototyping. For production you'd add auth.

## 5. How It Maps

| window.storage (artifact) | Firebase Realtime DB       |
|---------------------------|----------------------------|
| `storage.get(key)`        | `get(ref(db, key))`        |
| `storage.set(key, val)`   | `set(ref(db, key), val)`   |
| `storage.delete(key)`     | `remove(ref(db, key))`     |
| `storage.list(prefix)`    | `query + orderByKey range` |
| polling (setInterval)     | `onValue` (real-time!)     |

## 6. Bonus: Real-Time Upgrade

Once on Firebase, you can replace all `setInterval` polling with
`onValue` listeners for instant updates. The storage layer already
exposes a `sSubscribe(key, callback)` helper for this.

Example upgrade in the online match poll:

```js
// Before (polling):
pollRef.current = setInterval(async () => {
  const d = await sGet(`bg:match:${matchId}`);
  // ...update state
}, 1500);

// After (real-time):
const unsub = sSubscribe(`bg:match:${matchId}`, (d) => {
  if (!d) return;
  // ...update state instantly
});
// cleanup: unsub();
```

## 7. Deploy Checklist

1. `npm run build` → creates `dist/`
2. Push to GitHub → Actions workflow auto-deploys to Pages
3. Your game is live at `https://<user>.github.io/backgammon-online/`
4. Two players open the URL → enter nicks → play online!
