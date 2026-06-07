/**
 * inject.js — runs in the PAGE (main world) context on roblox.com.
 *
 * Content scripts live in an isolated world and can't see the page's own
 * fetch/XHR traffic, so we patch fetch + XMLHttpRequest here to OBSERVE (never
 * modify) Roblox's purchase responses. When we see a successful purchase /
 * subscribe call, we extract the product id and hand it to the content script
 * via window.postMessage. We do not initiate or alter any purchase — purely a
 * read-only listener over the user's own normal Roblox flow.
 */
(function () {
  "use strict";

  const TAG = "[AppleJuice]";

  // URL fragments that indicate a purchase / subscribe action.
  const PURCHASE_HINTS = [
    "/purchase",
    "purchase-product",
    "/subscribe",
    "subscriptions",
    "/buy",
    "transaction",
  ];

  function looksLikePurchaseUrl(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    return PURCHASE_HINTS.some((h) => u.includes(h));
  }

  /** Pull a plausible product id out of a URL and/or request body. */
  function extractProductId(url, body) {
    // Subscription ids look like EXP-1234...
    const hay = `${url || ""} ${typeof body === "string" ? body : ""}`;
    const exp = hay.match(/EXP-\d+/);
    if (exp) return exp[0];

    // Numeric product/asset/subscription id in the path or body.
    const pathNum =
      (url && url.match(/(?:product|productId|assetId|subscriptionId|id)[/=:]\s*"?(\d{5,})/i)) ||
      null;
    if (pathNum) return pathNum[1];

    // Body JSON fields.
    if (body && typeof body === "string") {
      try {
        const j = JSON.parse(body);
        const cand =
          j.productId || j.assetId || j.subscriptionId || j.expectedProductId || j.id;
        if (cand) return cand.toString();
      } catch {
        /* not json */
      }
    }
    // Trailing numeric id in the path.
    const trailing = url && url.match(/\/(\d{5,})(?:[/?]|$)/);
    if (trailing) return trailing[1];
    return null;
  }

  /** Did the response payload indicate a successful purchase? */
  function responseLooksSuccessful(status, text) {
    if (status < 200 || status >= 300) return false;
    if (!text) return true; // 2xx with empty body — assume ok
    const t = text.toLowerCase();
    if (t.includes('"purchased":true')) return true;
    if (t.includes('"purchased": true')) return true;
    if (t.includes("success") && !t.includes('"success":false')) return true;
    if (t.includes('"state":"subscribed"') || t.includes("subscription_state_subscribed")) return true;
    // Roblox purchase responses often return { purchased: true, ... } or a receipt.
    if (t.includes("receipt") || t.includes("subscribed")) return true;
    // A 2xx with no obvious failure marker.
    return !t.includes('"purchased":false') && !t.includes("error");
  }

  function report(productId, source) {
    if (!productId) return;
    window.postMessage(
      { source: "apple-juice-extension", type: "PURCHASE_DETECTED", productId: String(productId), via: source },
      "https://www.roblox.com",
    );
  }

  // ── Patch fetch ──
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const isPurchase = looksLikePurchaseUrl(url);
    const reqBody = init && init.body ? init.body : undefined;

    const res = await origFetch.apply(this, arguments);
    if (isPurchase) {
      try {
        const clone = res.clone();
        const text = await clone.text();
        if (responseLooksSuccessful(res.status, text)) {
          const pid = extractProductId(url, reqBody) || extractProductId(url, text);
          report(pid, "fetch");
        }
      } catch {
        /* ignore observation errors */
      }
    }
    return res;
  };

  // ── Patch XMLHttpRequest ──
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__aj_url = url;
    this.__aj_isPurchase = looksLikePurchaseUrl(url);
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__aj_isPurchase) {
      this.addEventListener("load", () => {
        try {
          if (responseLooksSuccessful(this.status, this.responseText)) {
            const pid =
              extractProductId(this.__aj_url, body) ||
              extractProductId(this.__aj_url, this.responseText);
            report(pid, "xhr");
          }
        } catch {
          /* ignore */
        }
      });
    }
    return origSend.apply(this, arguments);
  };

  console.debug(TAG, "purchase listener installed");
})();
