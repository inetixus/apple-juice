# 🧃 Apple Juice Purchase Sync (Chrome Extension)

Detects plan/refill purchases you make through Roblox's normal flow and unlocks
them on your Apple Juice account automatically — no leaving the experience, no
manual code entry.

## How it works

```
You buy on Roblox (normal flow)
        │
        ▼
inject.js  ── observes the page's own purchase fetch/XHR (read-only)
        │   + roblox-detect.js DOM observer (backup)
        ▼
roblox-detect.js  ── POSTs { productId } to apple-juice.online
        │            with your apple-juice.online cookies (credentials: include)
        ▼
/api/extension/purchase
        │   1. resolves YOUR Roblox userId from the authenticated session
        │   2. RE-VERIFIES the purchase with Roblox (gamepass / subscription)
        │   3. grants the plan/refill — fails closed if it can't confirm
        ▼
Plan unlocked on apple-juice.online
```

The extension is a **listener only**. It never clicks buy buttons or initiates a
purchase — Roblox processes the transaction exactly as normal. This keeps it
clear of automation rules; we only react to a purchase the user chose to make.

## Security model

The extension is public code, so it's treated as untrusted by the server:

- The account that gets the grant is **never** taken from the extension. It's
  the Roblox userId from the user's authenticated Apple Juice session (sign-in is
  Roblox OAuth), so a forged call can only ever affect the caller's own account.
- The server **independently re-verifies** ownership with Roblox before granting
  (gamepass ownership / active subscription via Open Cloud). If it can't confirm,
  it refuses.
- Dev-product refills can't be verified after the fact (Roblox has no ownership
  API for one-shot receipts), so they are **not** granted via the extension —
  those still unlock through the authoritative in-game ProcessReceipt webhook.

## Server requirements

Set these env vars on the web app for subscription verification:

```
ROBLOX_OPEN_CLOUD_KEY=   # Open Cloud API key with subscriptions:read
ROBLOX_UNIVERSE_ID=      # the universe that owns the subscription products
```

Gamepass verification needs no extra config.

## Install (development / unpacked)

1. Add PNG icons at `extension/icons/icon16.png`, `icon48.png`, `icon128.png`
   (any square brand icon works; the manifest references these sizes).
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Sign in at https://apple-juice.online/dashboard with Roblox, then make a
   purchase from the Apple Juice Shop. The popup shows the last synced purchase.

## Publishing to the Chrome Web Store

- Zip the `extension/` folder contents (not the parent folder).
- Submit via the Chrome Web Store Developer Dashboard.
- Justify permissions: `host_permissions` for roblox.com (detect purchases) and
  apple-juice.online (relay), `storage` (remember last sync for the popup).
