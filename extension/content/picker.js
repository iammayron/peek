(() => {
  const HOST_ID = "peek-host";

  if (globalThis.__peek) {
    globalThis.__peek.arm();
    return;
  }

  const sel = () => globalThis.__PEEK_SELECTOR__;

  let armed = false;
  let host = null;
  let shadow = null;
  let box = null;
  let chip = null;
  let hud = null;
  let raf = 0;
  let lastEl = null;
  let lastPoint = { x: 0, y: 0 };
  let pins = [];
  let pinning = false;
  let finishing = false;

  function arm() {
    if (armed) return;
    armed = true;
    finishing = false;
    mount();
    const tray = shadow?.querySelector(".tray");
    if (tray) tray.hidden = false;
    const layer = shadow?.querySelector(".layer");
    if (layer) layer.style.pointerEvents = "auto";
    if (hud) hud.hidden = false;
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, true);
  }

  function disarm() {
    if (!armed && !finishing) return;
    armed = false;
    finishing = false;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll, true);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastEl = null;
    pins = [];
    unmount();
    chrome.runtime.sendMessage({ type: "peek:disarmed" }).catch(() => {});
  }

  function mount() {
    if (host) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-peek", "host");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .layer {
          position: fixed;
          inset: 0;
          pointer-events: auto;
          cursor: crosshair;
          z-index: 1;
        }
        .box {
          position: fixed;
          pointer-events: none;
          border: 1px solid #C8FF4D;
          background: rgba(200, 255, 77, 0.08);
          box-shadow: 0 0 0 1px #111, inset 0 0 0 1px rgba(17,17,17,0.6);
          z-index: 2;
        }
        .tick {
          position: absolute;
          width: 8px;
          height: 8px;
          pointer-events: none;
        }
        .tick::before, .tick::after {
          content: "";
          position: absolute;
          background: #C8FF4D;
        }
        .tick.tl { top: -1px; left: -1px; }
        .tick.tr { top: -1px; right: -1px; }
        .tick.bl { bottom: -1px; left: -1px; }
        .tick.br { bottom: -1px; right: -1px; }
        .tick.tl::before, .tick.bl::before, .tick.tr::before, .tick.br::before {
          width: 8px; height: 1px; left: 0; top: 0;
        }
        .tick.tl::after, .tick.tr::after, .tick.bl::after, .tick.br::after {
          width: 1px; height: 8px; left: 0; top: 0;
        }
        .tick.tr::before, .tick.br::before { left: auto; right: 0; }
        .tick.tr::after { left: auto; right: 0; }
        .tick.bl::after, .tick.br::after { top: auto; bottom: 0; }
        .tick.br::after { left: auto; right: 0; }
        .chip {
          position: fixed;
          pointer-events: none;
          background: #14120E;
          color: #C8FF4D;
          font: 11px/1.2 "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
          letter-spacing: 0.04em;
          padding: 4px 8px;
          z-index: 3;
          white-space: nowrap;
          max-width: 70vw;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid #C8FF4D;
        }
        .hud {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: auto;
          background: #14120E;
          color: #F4F1EA;
          font: 12px/1.3 "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
          letter-spacing: 0.06em;
          padding: 7px 12px;
          border: 1px solid #C8FF4D;
          z-index: 4;
          text-transform: uppercase;
        }
        .hud kbd {
          color: #C8FF4D;
          font: inherit;
        }
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #14120E;
          color: #C8FF4D;
          font: 12px/1.3 "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
          letter-spacing: 0.08em;
          padding: 8px 14px;
          border: 1px solid #C8FF4D;
          z-index: 20;
          pointer-events: none;
          text-transform: uppercase;
        }
        .tray {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 12;
          pointer-events: auto;
          width: min(320px, calc(100vw - 32px));
          background: #14120E;
          color: #F4F1EA;
          border: 1px solid #C8FF4D;
          padding: 10px;
          font: 11px/1.35 "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
        }
        .tray-title {
          color: #C8FF4D;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-height: 24px;
        }
        .empty {
          color: #8a867c;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 100%;
          border: 1px solid #C8FF4D;
          color: #C8FF4D;
          background: transparent;
          padding: 3px 4px 3px 7px;
          cursor: default;
        }
        .pill:hover {
          background: rgba(200, 255, 77, 0.12);
        }
        .pill-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
        }
        .pill-x {
          border: 0;
          background: transparent;
          color: #C8FF4D;
          cursor: pointer;
          font: inherit;
          padding: 0 4px;
          line-height: 1;
        }
        .tray-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 10px;
        }
        .cancel, .done {
          font: inherit;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 12px;
          cursor: pointer;
        }
        .cancel {
          border: 1px solid #C8FF4D;
          background: transparent;
          color: #C8FF4D;
        }
        .done {
          border: 0;
          background: #C8FF4D;
          color: #14120E;
        }
        .done:disabled {
          opacity: 0.35;
          cursor: default;
        }
      </style>
      <div class="layer" part="layer"></div>
      <div class="box" hidden>
        <span class="tick tl"></span><span class="tick tr"></span>
        <span class="tick bl"></span><span class="tick br"></span>
      </div>
      <div class="chip" hidden></div>
      <div class="hud">Click to pin · <kbd>Enter</kbd> done · <kbd>Esc</kbd> cancel</div>
      <aside class="tray">
        <div class="tray-title">Pinned</div>
        <div class="pills"><span class="empty">None yet</span></div>
        <div class="tray-actions">
          <button class="done" type="button" disabled>Done</button>
          <button class="cancel" type="button">Cancel</button>
        </div>
      </aside>
    `;
    box = shadow.querySelector(".box");
    chip = shadow.querySelector(".chip");
    hud = shadow.querySelector(".hud");
    const doneBtn = shadow.querySelector(".done");
    const cancelBtn = shadow.querySelector(".cancel");
    doneBtn.addEventListener("click", onDone);
    cancelBtn.addEventListener("click", onCancel);
    document.documentElement.appendChild(host);
  }

  function unmount() {
    host?.remove();
    host = null;
    shadow = null;
    box = null;
    chip = null;
    hud = null;
  }

  function onMove(e) {
    lastPoint = { x: e.clientX, y: e.clientY };
    if (inChrome(e)) {
      lastEl = null;
      const overPill = e.composedPath().some((n) => n.classList?.contains?.("pill"));
      if (!overPill) {
        if (box) box.hidden = true;
        if (chip) chip.hidden = true;
      }
      return;
    }
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      paint(lastPoint.x, lastPoint.y);
    });
  }

  function onScroll() {
    if (!armed) return;
    paint(lastPoint.x, lastPoint.y);
  }

  function isPeekUi(el) {
    if (!el) return false;
    if (el === host || el.id === HOST_ID) return true;
    if (shadow && el.getRootNode?.() === shadow) return true;
    return false;
  }

  function hit(x, y) {
    const layer = shadow?.querySelector(".layer");
    if (layer) layer.style.pointerEvents = "none";
    const el = sel()?.deepElementFromPoint(x, y);
    if (layer) layer.style.pointerEvents = "auto";
    if (!el || el === document.documentElement || el === document.body) return null;
    if (isPeekUi(el)) return null;
    return el;
  }

  function paint(x, y) {
    if (!armed || !box) return;
    const el = hit(x, y);
    lastEl = el;
    if (!el) {
      box.hidden = true;
      chip.hidden = true;
      return;
    }
    const r = el.getBoundingClientRect();
    box.hidden = false;
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    box.style.width = `${Math.max(1, r.width)}px`;
    box.style.height = `${Math.max(1, r.height)}px`;
    chip.hidden = false;
    chip.textContent = sel()?.chipLabel(el) || el.tagName.toLowerCase();
    let cx = r.x;
    let cy = r.y - 22;
    if (cy < 8) cy = r.bottom + 6;
    if (cx + 160 > window.innerWidth) cx = window.innerWidth - 168;
    if (cx < 8) cx = 8;
    chip.style.left = `${cx}px`;
    chip.style.top = `${cy}px`;
  }

  function inChrome(e) {
    return e.composedPath().some((n) => {
      if (!n.classList) return false;
      return n.classList.contains("tray") || n.classList.contains("hud");
    });
  }

  function onDown(e) {
    if (!armed) return;
    if (inChrome(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  async function onClick(e) {
    if (!armed || pinning) return;
    if (inChrome(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = lastEl || hit(e.clientX, e.clientY);
    if (!el) return;
    if (pins.some((p) => p.el === el)) return;
    const payload = sel()?.describe(el);
    if (!payload) return;
    pinning = true;
    hideForCapture();
    await twoFrames();
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: "peek:pin", payload });
    } catch (err) {
      res = { ok: false, error: err?.message || String(err) };
    }
    if (host) host.style.opacity = "1";
    pinning = false;
    if (!res?.ok) {
      showToast(`Pin failed · ${res?.error || "no daemon"}`);
      return;
    }
    pins.push({
      id: res.id || String(pins.length + 1),
      el,
      label: sel()?.chipLabel(el) || el.tagName.toLowerCase(),
      selector: payload.selector,
    });
    renderPills();
  }

  function renderPills() {
    const wrap = shadow?.querySelector(".pills");
    const doneBtn = shadow?.querySelector(".done");
    if (!wrap) return;
    wrap.replaceChildren();
    if (pins.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = "None yet";
      wrap.appendChild(empty);
      if (doneBtn) doneBtn.disabled = true;
      return;
    }
    if (doneBtn) doneBtn.disabled = false;
    for (const pin of pins) {
      const pill = document.createElement("div");
      pill.className = "pill";
      const label = document.createElement("span");
      label.className = "pill-label";
      label.textContent = pin.label;
      const x = document.createElement("button");
      x.type = "button";
      x.className = "pill-x";
      x.setAttribute("aria-label", "Unpin");
      x.textContent = "×";
      x.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        unpin(pin.id);
      });
      pill.addEventListener("pointerenter", () => highlightEl(pin.el));
      pill.addEventListener("pointerleave", () => {
        if (box) box.hidden = true;
        if (chip) chip.hidden = true;
      });
      pill.append(label, x);
      wrap.appendChild(pill);
    }
  }

  function highlightEl(el) {
    if (!el?.isConnected || !box) return;
    const r = el.getBoundingClientRect();
    box.hidden = false;
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    box.style.width = `${Math.max(1, r.width)}px`;
    box.style.height = `${Math.max(1, r.height)}px`;
    chip.hidden = false;
    chip.textContent = sel()?.chipLabel(el) || el.tagName.toLowerCase();
    chip.style.left = `${Math.max(8, r.x)}px`;
    chip.style.top = `${r.y < 28 ? r.bottom + 6 : r.y - 22}px`;
  }

  function unpin(id) {
    pins = pins.filter((p) => p.id !== id);
    renderPills();
    chrome.runtime.sendMessage({ type: "peek:unpin", id }).catch(() => {});
  }

  async function onDone(e) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!armed || finishing || pins.length === 0) return;
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: "peek:done" });
    } catch (err) {
      res = { ok: false, error: err?.message || String(err) };
    }
    if (res?.text) {
      try {
        await navigator.clipboard.writeText(res.text);
      } catch {
        /* still show the hint */
      }
    }
    showToast(res?.ok
      ? "Copied. Paste into the agent, then say what to change."
      : `Done failed · ${res?.error || "no daemon"}`);
    if (!res?.ok) return;
    hidePicker();
    await sleep(3000);
    disarm();
  }

  function hidePicker() {
    finishing = true;
    armed = false;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll, true);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastEl = null;
    const tray = shadow?.querySelector(".tray");
    if (tray) tray.hidden = true;
    const layer = shadow?.querySelector(".layer");
    if (layer) layer.style.pointerEvents = "none";
    if (box) box.hidden = true;
    if (chip) chip.hidden = true;
    if (hud) hud.hidden = true;
  }

  function onCancel(e) {
    e?.preventDefault();
    e?.stopPropagation();
    disarm();
  }

  function onKey(e) {
    if (e.repeat) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel(e);
      return;
    }
    if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      onDone(e);
    }
  }

  function hideForCapture() {
    if (host) host.style.opacity = "0";
  }

  function showToast(text) {
    if (!shadow) mount();
    if (host) host.style.opacity = "1";
    const old = shadow.querySelector(".toast");
    old?.remove();
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    shadow.appendChild(t);
  }

  function twoFrames() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "peek:arm") {
      arm();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "peek:disarm") {
      disarm();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "peek:status") {
      sendResponse({ ok: true, armed });
    }
  });

  globalThis.__peek = { arm, disarm, isArmed: () => armed };
  arm();
})();
