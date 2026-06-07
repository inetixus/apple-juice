/**
 * roblox-detect.js — content script on roblox.com (isolated world).
 *
 * Responsibilities:
 *   1. Inject inject.js into the page's main world so it can observe the page's
 *      own purchase fetch/XHR traffic.
 *   2. Also run a DOM MutationObserver as a backup detector for Roblox's
 *      "purchase complete" confirmation UI.
 *   3. When a purchase is detected, POST the product id to apple-juice.online.
 *      The grant target is the user's authenticated Apple Juice session
 *      (Roblox-OAuth) on the server side — we send no identity here.
 *
 * The content script only READS the page; it never clicks buy buttons or
 * initiates purchases. The user completes the purchase through Roblox normally.
 */
(function () {
  "use strict";

  const TAG = "[AppleJuice]";
  const API_BASE = "https://apple-juice.online";
  const RELAY_ENDPOINT = `${API_BASE}/api/extension/purchase`;

  // De-dupe so we don't relay the same purchase multiple times.
  const seen = new Set();
  let lastRelayAt = 0;

  function injectPageScript() {
    try {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("inject.js");
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      console.debug(TAG, "inject failed", e);
    }
  }

  async function relayPurchase(productId, via) {
    if (!productId) return;
    const now = Date.now();
    // Throttle + de-dupe.
    if (seen.has(productId) && now - lastRelayAt < 60_000) return;
    seen.add(productId);
    lastRelayAt = now;

    try {
      const res = await fetch(RELAY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the user's apple-juice.online cookies so the server resolves
        // their authenticated Roblox userId. No identity is sent in the body.
        credentials: "include",
        body: JSON.stringify({ productId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        notify(data.message || "Purchase synced to Apple Juice!", "ok");
        chrome.storage?.local?.set?.({
          lastSync: { productId, message: data.message, at: now, via },
        });
      } else if (res.status === 401) {
        notify("Sign in to apple-juice.online first, then re-open this page.", "warn");
      } else {
        notify(data.message || "Couldn't sync this purchase yet.", "warn");
      }
    } catch (e) {
      console.debug(TAG, "relay error", e);
    }
  }

  // Lightweight on-page toast so the user gets feedback.
  function notify(message, kind) {
    try {
      const el = document.createElement("div");
      el.textContent = `🧃 ${message}`;
      el.style.cssText = [
        "position:fixed",
        "bottom:20px",
        "right:20px",
        "z-index:2147483647",
        "padding:12px 16px",
        "border-radius:12px",
        "font:600 13px/1.3 system-ui,sans-serif",
        "max-width:320px",
        "box-shadow:0 8px 30px rgba(0,0,0,.35)",
        kind === "ok"
          ? "background:#ccff00;color:#0a0a0c"
          : "background:#1a1c22;color:#fff;border:1px solid rgba(255,255,255,.12)",
      ].join(";");
      document.body.appendChild(el);
      setTimeout(() => {
        el.style.transition = "opacity .4s";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 400);
      }, 5000);
    } catch {
      /* ignore */
    }
  }

  // ── Listen for purchase signals from the injected page script ──
  window.addEventListener("message", (event) => {
    if (event.origin !== "https://www.roblox.com") return;
    const d = event.data;
    if (!d || d.source !== "apple-juice-extension") return;
    if (d.type === "PURCHASE_DETECTED") {
      relayPurchase(d.productId, d.via || "network");
    }
  });

  // ── Backup: DOM observer for the purchase-complete confirmation ──
  function scanNode(node) {
    if (!node || node.nodeType !== 1) return;
    const text = (node.textContent || "").toLowerCase();
    const purchasedMarkers =
      text.includes("purchase complete") ||
      text.includes("thanks for your purchase") ||
      text.includes("you now own") ||
      text.includes("subscription active") ||
      text.includes("you're subscribed");
    if (!purchasedMarkers) return;

    // Try to find a product id near the confirmation.
    const html = node.innerHTML || "";
    const exp = html.match(/EXP-\d+/);
    const num = html.match(/(?:itemId|productId|assetId)["':=\s]+(\d{5,})/i);
    const pid = (exp && exp[0]) || (num && num[1]) || null;
    if (pid) relayPurchase(pid, "dom");
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) scanNode(n);
    }
  });

  function start() {
    injectPageScript();
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    console.debug(TAG, "roblox detector active");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
