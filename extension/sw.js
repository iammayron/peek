const BRIDGE = "http://127.0.0.1:17321";
const PADDING = 32;
const MAX_EDGE = 1600;

let bridging = false;

chrome.action.onClicked.addListener((tab) => {
  togglePicker(tab).catch((err) => console.error("peek toggle", err));
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "toggle-picker") return;
  (async () => {
    const target = tab || (await activeTab());
    if (target) await togglePicker(target);
  })().catch((err) => console.error("peek command", err));
});

chrome.runtime.onInstalled.addListener(() => {
  keepBridge();
});

chrome.runtime.onStartup.addListener(() => {
  keepBridge();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "peek:pin") {
    (async () => {
      try {
        const tab = sender.tab;
        if (!tab?.id) throw new Error("no tab");
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
        revealOverlay(tab.id);
        const canvas = await cropToCanvas(dataUrl, message.payload);
        const preview = await previewFromCanvas(canvas);
        notifyPreview(tab.id, message.clientId, preview);
        const b64 = await encodeFull(canvas);
        const pin = await sendPin(message.payload, b64, tab);
        await flashBadge(true);
        sendResponse({ ok: true, id: pin?.id || "", preview: preview || "" });
      } catch (err) {
        console.error("peek pin", err);
        if (sender.tab?.id) revealOverlay(sender.tab.id);
        await flashBadge(false);
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
  if (message?.type === "peek:begin") {
    (async () => {
      try {
        await fetch(`${BRIDGE}/session/begin`, {
          method: "POST",
          headers: { "X-Peek": "1" },
        });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
  if (message?.type === "peek:disarmed") {
    chrome.action.setBadgeText({ text: "" });
    if (message.abandon !== false) {
      fetch(`${BRIDGE}/session/abandon`, {
        method: "POST",
        headers: { "X-Peek": "1" },
      }).catch(() => {});
    }
  }
  if (message?.type === "peek:unpin") {
    (async () => {
      try {
        await fetch(`${BRIDGE}/pin?id=${encodeURIComponent(message.id || "")}`, {
          method: "DELETE",
          headers: { "X-Peek": "1" },
        });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
  if (message?.type === "peek:done") {
    (async () => {
      try {
        const res = await fetch(`${BRIDGE}/done`, {
          method: "POST",
          headers: { "X-Peek": "1" },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || res.statusText);
        sendResponse({ ok: true, text: body.text || "", count: body.count || 0 });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
});

keepBridge();

async function sendPin(payload, pngBase64, tab) {
  const msg = {
    type: "pin",
    payload: {
      ...payload,
      tabId: tab.id,
      windowId: tab.windowId,
    },
    pngBase64,
  };
  try {
    const http = await fetch(`${BRIDGE}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Peek": "1" },
      body: JSON.stringify(msg),
    });
    if (http.ok) return await http.json();
  } catch (err) {
    console.warn("peek http pin", err);
  }
  throw new Error("bridge failed — is peek daemon running on 127.0.0.1:17321?");
}

async function keepBridge() {
  if (bridging) return;
  bridging = true;
  for (;;) {
    try {
      const res = await fetch(`${BRIDGE}/arm?timeout=20`, { headers: { "X-Peek": "1" } });
      if (!res.ok) {
        await sleep(1500);
        continue;
      }
      const msg = await res.json();
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Peek — pick an element (Alt+Shift+P)" });
      if (msg?.type === "arm") {
        await armActiveTab();
      }
    } catch {
      chrome.action.setBadgeBackgroundColor({ color: "#C45C26" });
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setTitle({ title: "Peek: daemon not reachable on 127.0.0.1:17321" });
      await sleep(1500);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function togglePicker(tab) {
  if (!tab?.id) return;
  if (await isRestricted(tab)) {
    await flashBadge(false);
    return;
  }
  const status = await pingContent(tab.id);
  if (status?.armed) {
    await chrome.tabs.sendMessage(tab.id, { type: "peek:disarm" });
    return;
  }
  await armTab(tab);
}

async function armActiveTab() {
  const tab = await activeTab();
  if (tab) await armTab(tab);
}

async function armTab(tab) {
  if (!tab?.id) return;
  if (await isRestricted(tab)) return;
  await disarmOtherTabs(tab.id);
  const status = await pingContent(tab.id);
  if (status?.ok) {
    await chrome.tabs.sendMessage(tab.id, { type: "peek:arm" });
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content/selector.js", "content/picker.js"],
  });
}

async function disarmOtherTabs(exceptTabId) {
  let tabs;
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  await Promise.all(
    tabs.map(async (t) => {
      if (!t.id || t.id === exceptTabId) return;
      const status = await pingContent(t.id);
      if (!status?.armed) return;
      try {
        await chrome.tabs.sendMessage(t.id, { type: "peek:disarm", abandon: false });
      } catch {
        /* tab has no picker */
      }
    }),
  );
}

async function pingContent(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "peek:status" });
  } catch {
    return null;
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

async function isRestricted(tab) {
  const url = tab.url || "";
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com/")
  );
}

function revealOverlay(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "peek:captured" }).catch(() => {});
}

function notifyPreview(tabId, clientId, preview) {
  if (!preview) return;
  chrome.tabs.sendMessage(tabId, { type: "peek:preview", clientId, preview }).catch(() => {});
}

async function cropToCanvas(dataUrl, payload) {
  const rect = payload.rect || {};
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const vw = rect.vw || bitmap.width;
  const vh = rect.vh || bitmap.height;
  const scaleX = bitmap.width / vw;
  const scaleY = bitmap.height / vh;
  const pad = payload.screenshotPaddingPx || PADDING;
  let sx = (rect.x - pad) * scaleX;
  let sy = (rect.y - pad) * scaleY;
  let sw = (rect.w + pad * 2) * scaleX;
  let sh = (rect.h + pad * 2) * scaleY;
  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > bitmap.width) sw = bitmap.width - sx;
  if (sy + sh > bitmap.height) sh = bitmap.height - sy;
  sw = Math.max(1, sw);
  sh = Math.max(1, sh);

  let dw = sw;
  let dh = sh;
  const longEdge = Math.max(dw, dh);
  if (longEdge > MAX_EDGE) {
    const scale = MAX_EDGE / longEdge;
    dw = Math.max(1, Math.round(dw * scale));
    dh = Math.max(1, Math.round(dh * scale));
  }

  const canvas = new OffscreenCanvas(Math.round(dw), Math.round(dh));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function previewFromCanvas(canvas) {
  let previewCanvas = canvas;
  const long = Math.max(canvas.width, canvas.height);
  if (long > 560) {
    const s = 560 / long;
    previewCanvas = new OffscreenCanvas(
      Math.max(1, Math.round(canvas.width * s)),
      Math.max(1, Math.round(canvas.height * s)),
    );
    previewCanvas.getContext("2d").drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
  }
  const previewBlob = await previewCanvas.convertToBlob({ type: "image/jpeg", quality: 0.72 });
  return blobToDataUrl(previewBlob);
}

async function encodeFull(canvas) {
  let out = await canvas.convertToBlob({ type: "image/png" });
  if (out.size > 700_000) {
    out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
  }
  return blobToBase64(out);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.error) {
        reject(reader.error);
        return;
      }
      resolve(String(reader.result || ""));
    };
    reader.readAsDataURL(blob);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.error) {
        reject(reader.error);
        return;
      }
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : "");
    };
    reader.readAsDataURL(blob);
  });
}

async function flashBadge(ok) {
  await chrome.action.setBadgeBackgroundColor({ color: ok ? "#C8FF4D" : "#C45C26" });
  await chrome.action.setBadgeText({ text: ok ? "OK" : "!" });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 2500);
}
