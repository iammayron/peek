(() => {
  const HOST_ID = "inspectai-host";

  if (globalThis.__inspectai) {
    globalThis.__inspectai.arm();
    return;
  }

  const sel = () => globalThis.__INSPECTAI_SELECTOR__;

  let armed = false;
  let host = null;
  let shadow = null;
  let box = null;
  let chip = null;
  let hud = null;
  let raf = 0;
  let lastEl = null;
  let lastPoint = { x: 0, y: 0 };

  function arm() {
    if (armed) return;
    armed = true;
    mount();
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, true);
  }

  function disarm() {
    if (!armed) return;
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
    unmount();
    chrome.runtime.sendMessage({ type: "inspectai:disarmed" }).catch(() => {});
  }

  function mount() {
    if (host) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-inspectai", "host");
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
          pointer-events: none;
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
          z-index: 5;
          pointer-events: none;
          text-transform: uppercase;
        }
      </style>
      <div class="layer" part="layer"></div>
      <div class="box" hidden>
        <span class="tick tl"></span><span class="tick tr"></span>
        <span class="tick bl"></span><span class="tick br"></span>
      </div>
      <div class="chip" hidden></div>
      <div class="hud">Click an element · <kbd>Esc</kbd> cancels</div>
    `;
    box = shadow.querySelector(".box");
    chip = shadow.querySelector(".chip");
    hud = shadow.querySelector(".hud");
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

  function hit(x, y) {
    const layer = shadow?.querySelector(".layer");
    if (layer) layer.style.pointerEvents = "none";
    const el = sel()?.deepElementFromPoint(x, y);
    if (layer) layer.style.pointerEvents = "auto";
    if (!el || el === document.documentElement || el === document.body) return null;
    if (el.id === HOST_ID || el.closest?.(`#${HOST_ID}`)) return null;
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

  function onDown(e) {
    if (!armed) return;
    e.preventDefault();
    e.stopPropagation();
  }

  async function onClick(e) {
    if (!armed) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = lastEl || hit(e.clientX, e.clientY);
    if (!el) return;
    const payload = sel()?.describe(el);
    if (!payload) return;
    hideForCapture();
    await twoFrames();
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: "inspectai:pin", payload });
    } catch (err) {
      res = { ok: false, error: err?.message || String(err) };
    }
    showToast(res?.ok ? "Pinned for AI" : `Pin failed · ${res?.error || "no daemon"}`);
    await sleep(1400);
    disarm();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      disarm();
    }
  }

  function hideForCapture() {
    if (host) host.style.opacity = "0";
  }

  function showToast(text) {
    if (!shadow) {
      mount();
    }
    if (host) host.style.opacity = "1";
    if (box) box.hidden = true;
    if (chip) chip.hidden = true;
    if (hud) hud.hidden = true;
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
    if (msg?.type === "inspectai:arm") {
      arm();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "inspectai:disarm") {
      disarm();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "inspectai:status") {
      sendResponse({ ok: true, armed });
    }
  });

  globalThis.__inspectai = { arm, disarm, isArmed: () => armed };
  arm();
})();
