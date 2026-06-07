/** Shows the most recent synced purchase, if any. */
(function () {
  const el = document.getElementById("status");
  try {
    chrome.storage.local.get("lastSync", (res) => {
      const s = res && res.lastSync;
      if (s && s.at) {
        const when = new Date(s.at).toLocaleString();
        el.innerHTML =
          `<span class="ok">Last synced:</span> ${s.message || "Purchase unlocked"}<br/>` +
          `<span style="opacity:.5">${when}</span>`;
      }
    });
  } catch {
    /* storage unavailable */
  }
})();
