(() => {
  const HOST_ID = "peek-host";
  const PANEL = 350;
  const GAP = 18;
  const RAIL = PANEL + GAP * 2;
  const PEEK_MS = 480;

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
  let raf = 0;
  let lastEl = null;
  let lastPoint = { x: 0, y: 0 };
  let pins = [];
  let capturing = false;
  let finishing = false;
  let inflight = Promise.resolve();
  let unmountTimer = 0;
  let settleTimer = 0;
  let pushStyle = null;
  let confirmingId = "";

  async function arm() {
    if (armed) return;
    armed = true;
    finishing = false;
    pins = [];
    if (unmountTimer) {
      clearTimeout(unmountTimer);
      unmountTimer = 0;
    }
    mount();
    renderPills();
    const layer = shadow?.querySelector(".layer");
    if (layer) layer.style.pointerEvents = "auto";
    try {
      await chrome.runtime.sendMessage({ type: "peek:begin" });
    } catch {
      /* daemon down — pin will fail later */
    }
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, true);
    window.addEventListener("pagehide", onPageHide, true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!armed || !host) return;
        host.setAttribute("data-open", "");
        applyPush(true);
        clearTimeout(settleTimer);
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        settleTimer = setTimeout(() => {
          if (armed) host?.setAttribute("data-settled", "");
        }, reduce ? 0 : PEEK_MS);
      });
    });
  }

  function disarm(opts) {
    if (!armed && !finishing) return;
    const abandon = opts?.abandon !== false;
    armed = false;
    finishing = false;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll, true);
    window.removeEventListener("pagehide", onPageHide, true);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastEl = null;
    pins = [];
    closeRail();
    chrome.runtime.sendMessage({ type: "peek:disarmed", abandon }).catch(() => {});
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    clearTimeout(unmountTimer);
    unmountTimer = setTimeout(() => {
      unmountTimer = 0;
      if (!armed) {
        unmount();
        clearPush();
      }
    }, reduce ? 0 : PEEK_MS);
  }

  function closeRail() {
    clearTimeout(settleTimer);
    host?.removeAttribute("data-open");
    host?.removeAttribute("data-settled");
    applyPush(false);
    const layer = shadow?.querySelector(".layer");
    if (layer) layer.style.pointerEvents = "none";
    if (box) box.hidden = true;
    if (chip) chip.hidden = true;
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
    host.style.overflow = "visible";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          --ink: #242526;
          --mark: #6dff4d;
          --type: #e4e6e4;
          --mute: #8a8c8b;
          --wash: color-mix(in oklab, var(--mark) 12%, transparent);
          --gap: 18px;
          --panel: 350px;
          --rail-open: calc(var(--panel) + 2 * var(--gap));
          --rail-track: 0px;
          --peek-ease: cubic-bezier(0.22, 1, 0.36, 1);
          --peek-time: 480ms;
        }
        @property --rail-track {
          syntax: "<length>";
          inherits: true;
          initial-value: 0px;
        }
        :host {
          transition: --rail-track var(--peek-time) var(--peek-ease);
        }
        :host([data-open]) {
          --rail-track: var(--rail-open);
        }
        * { box-sizing: border-box; }
        .layer {
          position: fixed;
          inset: 0;
          inset-inline-end: var(--rail-track);
          pointer-events: auto;
          cursor: crosshair;
          z-index: 1;
        }
        .box {
          position: fixed;
          pointer-events: none;
          border: 1px solid var(--mark);
          background: var(--wash);
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
          background: var(--mark);
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
          background: var(--ink);
          color: var(--mark);
          font: 11px/1.2 "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
          letter-spacing: 0.04em;
          padding: 4px 8px;
          z-index: 3;
          white-space: nowrap;
          max-width: 70vw;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid var(--mark);
        }
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--ink);
          color: var(--mark);
          font: 12px/1.3 "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
          letter-spacing: 0.08em;
          padding: 8px 14px;
          border: 1px solid var(--mark);
          z-index: 20;
          pointer-events: none;
          text-transform: uppercase;
        }
        .rail {
          position: fixed;
          inset-block: 0;
          inset-inline-end: 0;
          inline-size: var(--rail-track);
          z-index: 12;
          pointer-events: auto;
          display: grid;
          justify-items: end;
          min-inline-size: 0;
          overflow: clip;
          padding-block: var(--gap);
          padding-inline: 0;
          transition: padding var(--peek-time) var(--peek-ease);
        }
        :host([data-open]) .rail {
          padding-inline: var(--gap);
        }
        :host([data-open][data-settled]) .rail {
          overflow: visible;
        }
        .panel {
          display: grid;
          inline-size: var(--panel);
          min-inline-size: var(--panel);
          block-size: 100%;
          min-block-size: 0;
          border: 0;
          border-radius: 28px;
          color: var(--type);
          font: 11px/1.35 "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
          filter:
            drop-shadow(-8px 0 18px rgb(20 18 14 / 0.18))
            drop-shadow(0 10px 28px rgb(20 18 14 / 0.22));
        }
        @supports (corner-shape: squircle) {
          .panel, .panel-face { corner-shape: squircle; }
        }
        .panel-face {
          display: flex;
          flex-direction: column;
          min-block-size: 0;
          background: var(--ink);
          border-radius: inherit;
          overflow: clip;
        }
        .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
          padding: 14px 14px 10px;
          color: var(--mark);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .panel-head .count { color: var(--mute); letter-spacing: 0.04em; }
        .pills {
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0 14px 12px;
          overflow: auto;
          overscroll-behavior: contain;
          min-block-size: 0;
        }
        .empty { color: var(--mute); }
        .pill-wrap {
          position: relative;
          overflow: clip;
          border: 1px solid var(--mark);
          transform-origin: 0 50%;
          transition:
            scale 280ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 140ms ease 90ms,
            block-size 240ms cubic-bezier(0.22, 1, 0.36, 1) 200ms,
            border-width 240ms cubic-bezier(0.22, 1, 0.36, 1) 200ms;
        }
        .pill-wrap.is-removing {
          scale: 0 1;
          opacity: 0;
          border-width: 0;
          pointer-events: none;
        }
        .pill-confirm {
          position: absolute;
          inset-block: 0;
          inset-inline-end: 0;
          z-index: 1;
          display: flex;
          background: var(--ink);
          translate: 100% 0;
          pointer-events: none;
          transition: translate 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .pill-wrap.is-confirming .pill-confirm {
          translate: 0;
          pointer-events: auto;
        }
        .pill-no, .pill-yes, .pill-x {
          inline-size: 40px;
          border: 0;
          font: 18px/1 "IBM Plex Mono", ui-monospace, monospace;
          cursor: pointer;
        }
        .pill-x {
          background: transparent;
          color: var(--mark);
          align-self: stretch;
          transition: opacity 160ms ease;
        }
        .pill-wrap.is-confirming .pill-x {
          opacity: 0;
          pointer-events: none;
        }
        .pill-no {
          background: transparent;
          color: #ff6b6b;
        }
        .pill-yes {
          background: var(--mark);
          color: var(--ink);
        }
        .pill {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          position: relative;
          background: var(--ink);
          color: var(--mark);
          padding: 4px;
        }
        .pill:hover { background: color-mix(in oklab, var(--mark) 12%, var(--ink)); }
        .pill-shot {
          inline-size: 40px;
          block-size: 40px;
          padding: 0;
          border: 0;
          background: color-mix(in oklab, var(--mark) 14%, var(--ink));
          overflow: clip;
          cursor: default;
        }
        .pill-shot img {
          display: block;
          inline-size: 100%;
          block-size: 100%;
          object-fit: cover;
          object-position: center;
        }
        .pill-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-inline-size: 0;
        }
        .panel-actions {
          display: grid;
          gap: 8px;
          padding: 12px 14px 14px;
          margin-block-start: auto;
        }
        .done, .cancel {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font: inherit;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 9px 12px;
          cursor: pointer;
        }
        .done {
          border: 0;
          background: var(--mark);
          color: var(--ink);
        }
        .done:disabled { opacity: 0.35; cursor: default; }
        .cancel {
          border: 1px solid var(--mark);
          background: transparent;
          color: var(--mark);
        }
        .done kbd, .cancel kbd {
          font: inherit;
          font-size: 9px;
          letter-spacing: 0.04em;
          line-height: 1.35;
          padding: 0 5px;
          border: 1px solid currentColor;
        }
        .shot-pop {
          inset: unset;
          margin: 0;
          padding: 4px;
          border: 0;
          background: var(--ink);
          color: var(--type);
          border-radius: 10px;
          transform-origin: 100% 0%;
          translate: 0;
          scale: 0.18;
          opacity: 0;
          filter:
            drop-shadow(-4px 0 12px rgb(20 18 14 / 0.2))
            drop-shadow(0 8px 24px rgb(20 18 14 / 0.22));
          transition-property: opacity, scale, display, overlay;
          transition-duration: 220ms;
          transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
          transition-behavior: allow-discrete;
        }
        .shot-pop:is(:popover-open, .\\:popover-open) {
          display: block;
          opacity: 1;
          scale: 1;
          @starting-style {
            opacity: 0;
            scale: 0.18;
          }
        }
        @supports (anchor-name: --peek-shot) {
          .shot-pop {
            position: fixed;
            right: anchor(left);
            top: anchor(top);
            translate: -6px 0;
            position-try: flip-inline, flip-block;
          }
        }
        .shot-pop img {
          display: block;
          max-inline-size: min(360px, 46vw);
          max-block-size: min(280px, 55dvb);
          inline-size: auto;
          block-size: auto;
          object-fit: contain;
          object-position: center;
          background: #111;
        }
        :host([data-capturing]) .box,
        :host([data-capturing]) .chip {
          visibility: hidden;
        }
        @media (prefers-reduced-motion: reduce) {
          :host, .rail, .shot-pop, .pill { transition: none; }
          .shot-pop { scale: 1; }
        }
      </style>
      <div class="layer" part="layer"></div>
      <div class="box" hidden>
        <span class="tick tl"></span><span class="tick tr"></span>
        <span class="tick bl"></span><span class="tick br"></span>
      </div>
      <div class="chip" hidden></div>
      <aside class="rail" id="rail">
        <section class="panel">
          <div class="panel-face">
            <div class="panel-head">
              <span>Pinned</span>
              <span class="count" id="count">0</span>
            </div>
            <div class="pills"><span class="empty">None yet</span></div>
            <div class="panel-actions">
              <button class="done" type="button" disabled aria-keyshortcuts="Enter">Done <kbd>Enter</kbd></button>
              <button class="cancel" type="button" aria-keyshortcuts="Escape">Cancel <kbd>Esc</kbd></button>
            </div>
          </div>
        </section>
      </aside>
    `;
    box = shadow.querySelector(".box");
    chip = shadow.querySelector(".chip");
    shadow.querySelector(".done").addEventListener("click", onDone);
    shadow.querySelector(".cancel").addEventListener("click", onCancel);
    document.documentElement.appendChild(host);
  }

  function unmount() {
    host?.remove();
    host = null;
    shadow = null;
    box = null;
    chip = null;
  }

  function applyPush(on) {
    const html = document.documentElement;
    if (!pushStyle) {
      pushStyle = document.createElement("style");
      pushStyle.id = "peek-push-style";
      pushStyle.textContent = `
html.peek-push { overflow-x: hidden !important; }
html.peek-push body {
  box-sizing: border-box !important;
  width: calc(100% - ${RAIL}px) !important;
  max-width: calc(100% - ${RAIL}px) !important;
  min-width: 0 !important;
  transform: translateX(0);
  overflow-x: hidden !important;
  transition: width ${PEEK_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
              max-width ${PEEK_MS}ms cubic-bezier(0.22, 1, 0.36, 1) !important;
}
html.peek-push body > * {
  max-width: 100% !important;
  min-width: 0 !important;
}
@media (prefers-reduced-motion: reduce) {
  html.peek-push body { transition: none !important; }
}`;
    }
    if (on) {
      if (!pushStyle.isConnected) html.appendChild(pushStyle);
      html.classList.add("peek-push");
      return;
    }
    html.classList.remove("peek-push");
  }

  function clearPush() {
    document.documentElement.classList.remove("peek-push");
    pushStyle?.remove();
    pushStyle = null;
  }

  function onMove(e) {
    lastPoint = { x: e.clientX, y: e.clientY };
    if (capturing) return;
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

  function hideBox() {
    if (box) box.hidden = true;
    if (chip) chip.hidden = true;
  }

  function isPinned(el) {
    return pins.some((p) => p.el === el);
  }

  function paint(x, y) {
    if (!armed || !box || capturing) return;
    const el = hit(x, y);
    lastEl = el;
    if (!el || isPinned(el)) {
      hideBox();
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
    const limit = window.innerWidth - (host?.hasAttribute("data-open") ? RAIL : 0);
    if (cx + 160 > limit) cx = Math.max(8, limit - 168);
    if (cx < 8) cx = 8;
    chip.style.left = `${cx}px`;
    chip.style.top = `${cy}px`;
  }

  function inChrome(e) {
    return e.composedPath().some((n) => {
      if (!n.classList) return false;
      return (
        n.classList.contains("rail") ||
        n.classList.contains("panel") ||
        n.classList.contains("panel-face") ||
        n.classList.contains("pill") ||
        n.classList.contains("pill-wrap") ||
        n.classList.contains("shot-pop")
      );
    });
  }

  function onDown(e) {
    if (!armed) return;
    if (inChrome(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  async function onClick(e) {
    if (!armed || capturing) return;
    if (inChrome(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = lastEl || hit(e.clientX, e.clientY);
    if (!el) return;
    if (pins.some((p) => p.el === el)) return;
    const payload = sel()?.describe(el);
    if (!payload) return;
    const tempId = `tmp-${Date.now()}-${pins.length}`;
    const pin = {
      id: tempId,
      el,
      label: sel()?.chipLabel(el) || el.tagName.toLowerCase(),
      selector: payload.selector,
      pending: true,
      preview: "",
    };
    pins.push(pin);
    renderPills();
    hideBox();
    const work = pinElement(payload, tempId);
    inflight = Promise.allSettled([inflight, work]);
    await work;
  }

  function applyPreview(clientId, preview) {
    const pin = pins.find((p) => p.id === clientId);
    if (!pin || !preview) return;
    pin.preview = preview;
    renderPills();
  }

  async function pinElement(payload, tempId) {
    capturing = true;
    hideForCapture(payload.rect);
    await twoFrames();
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: "peek:pin", payload, clientId: tempId });
    } catch (err) {
      res = { ok: false, error: err?.message || String(err) };
    }
    showAfterCapture();
    if (!res?.ok) {
      pins = pins.filter((p) => p.id !== tempId);
      renderPills();
      showToast(`Pin failed · ${res?.error || "no daemon"}`);
      return;
    }
    const still = pins.find((p) => p.id === tempId);
    if (!still) {
      if (res.id) chrome.runtime.sendMessage({ type: "peek:unpin", id: res.id }).catch(() => {});
      return;
    }
    still.id = res.id || tempId;
    still.pending = false;
    if (!still.preview) still.preview = res.preview || "";
    renderPills();
  }

  function renderPills() {
    const wrap = shadow?.querySelector(".pills");
    const doneBtn = shadow?.querySelector(".done");
    const countEl = shadow?.querySelector(".count");
    if (!wrap) return;
    const exiting = [...wrap.querySelectorAll(".pill-wrap.is-removing")].map((n) => ({
      node: n,
      index: [...wrap.children].indexOf(n),
    }));
    shadow.querySelectorAll(".shot-pop").forEach((n) => {
      if (exiting.some((row) => row.node.dataset.pop === n.id)) return;
      n.remove();
    });
    wrap.replaceChildren();
    if (countEl) countEl.textContent = String(pins.length);
    if (pins.length === 0 && exiting.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = "None yet";
      wrap.appendChild(empty);
      if (doneBtn) doneBtn.disabled = true;
      return;
    }
    if (doneBtn) doneBtn.disabled = pins.length === 0;
    for (const pin of pins) {
      const popId = `shot-${pin.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
      const anchor = `--${popId}`;
      const row = document.createElement("div");
      row.className = "pill-wrap";
      row.dataset.id = pin.id;
      row.dataset.pop = popId;
      if (confirmingId === pin.id) row.classList.add("is-confirming");
      const abort = document.createElement("button");
      abort.type = "button";
      abort.className = "pill-no";
      abort.setAttribute("aria-label", "Keep pin");
      abort.textContent = "×";
      abort.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        confirmingId = "";
        row.classList.remove("is-confirming");
      });
      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "pill-yes";
      yes.setAttribute("aria-label", "Confirm unpin");
      yes.textContent = "✓";
      yes.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (confirmingId === pin.id) confirmingId = "";
        beginRemove(row, pin);
      });
      const confirm = document.createElement("div");
      confirm.className = "pill-confirm";
      confirm.append(abort, yes);
      const pill = document.createElement("div");
      pill.className = "pill";
      const shot = document.createElement("button");
      shot.type = "button";
      shot.className = "pill-shot";
      shot.style.anchorName = anchor;
      shot.setAttribute("aria-label", `Preview ${pin.label}`);
      if (pin.preview) {
        const thumb = document.createElement("img");
        thumb.alt = "";
        thumb.src = pin.preview;
        shot.append(thumb);
      }
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
        shadow.querySelectorAll(".pill-wrap.is-confirming:not(.is-removing)").forEach((n) => n.classList.remove("is-confirming"));
        confirmingId = pin.id;
        row.classList.add("is-confirming");
      });
      const pop = document.createElement("div");
      pop.id = popId;
      pop.className = "shot-pop";
      pop.setAttribute("popover", "manual");
      pop.style.positionAnchor = anchor;
      if (pin.preview) {
        const full = document.createElement("img");
        full.alt = pin.label;
        full.src = pin.preview;
        pop.append(full);
      }
      shadow.append(pop);
      let hideT = 0;
      const show = () => {
        clearTimeout(hideT);
        if (pin.preview) pop.showPopover();
      };
      const hide = () => {
        hideT = setTimeout(() => pop.hidePopover(), 80);
      };
      shot.addEventListener("click", (ev) => ev.preventDefault());
      shot.addEventListener("pointerenter", show);
      shot.addEventListener("pointerleave", hide);
      pop.addEventListener("pointerenter", show);
      pop.addEventListener("pointerleave", hide);
      pill.addEventListener("pointerenter", () => highlightEl(pin.el));
      pill.addEventListener("pointerleave", () => {
        if (box) box.hidden = true;
        if (chip) chip.hidden = true;
      });
      pill.append(shot, label, x);
      row.append(pill, confirm);
      wrap.appendChild(row);
    }
    exiting.sort((a, b) => a.index - b.index);
    for (const { node, index } of exiting) {
      const kids = [...wrap.children];
      if (index >= kids.length) wrap.append(node);
      else wrap.insertBefore(node, kids[index]);
    }
  }

  function beginRemove(row, pin) {
    if (!row || row.classList.contains("is-removing")) return;
    const id = pin.id;
    const pop = row.dataset.pop ? shadow.getElementById(row.dataset.pop) : null;
    pop?.hidePopover();
    const h = Math.max(1, row.getBoundingClientRect().height);
    row.style.blockSize = `${h}px`;
    row.classList.add("is-removing");
    void row.offsetHeight;
    row.style.blockSize = "0px";
    pins = pins.filter((p) => p.id !== id);
    const countEl = shadow?.querySelector(".count");
    const doneBtn = shadow?.querySelector(".done");
    if (countEl) countEl.textContent = String(pins.length);
    if (doneBtn) doneBtn.disabled = pins.length === 0;
    if (!String(id).startsWith("tmp-")) {
      chrome.runtime.sendMessage({ type: "peek:unpin", id }).catch(() => {});
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pop?.remove();
      row.remove();
      if (pins.length === 0 && !shadow.querySelector(".pill-wrap.is-removing")) {
        renderPills();
      }
    };
    row.addEventListener("transitionend", (ev) => {
      if (ev.target !== row) return;
      if (ev.propertyName !== "block-size") return;
      finish();
    });
    setTimeout(finish, 560);
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
    if (String(id).startsWith("tmp-")) return;
    chrome.runtime.sendMessage({ type: "peek:unpin", id }).catch(() => {});
  }

  async function onDone(e) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!armed || finishing || pins.length === 0) return;
    await inflight;
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
    if (!armed) disarm();
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
    window.removeEventListener("pagehide", onPageHide, true);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastEl = null;
    pins = [];
    closeRail();
  }

  function onCancel(e) {
    e?.preventDefault();
    e?.stopPropagation();
    disarm();
  }

  function onPageHide() {
    if (armed && !finishing) disarm();
  }

  function onKey(e) {
    if (e.repeat) return;
    if (e.key === "Escape") {
      const confirming = shadow?.querySelector(".pill-wrap.is-confirming:not(.is-removing)");
      if (confirming) {
        e.preventDefault();
        e.stopPropagation();
        confirmingId = "";
        confirming.classList.remove("is-confirming");
        return;
      }
      const openPop = shadow?.querySelector("[popover]:popover-open");
      if (openPop) {
        e.preventDefault();
        e.stopPropagation();
        openPop.hidePopover();
        return;
      }
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

  function hideForCapture(rect) {
    if (!host) return;
    host.setAttribute("data-capturing", "");
    if (chromeOverlapsCrop(rect)) host.setAttribute("data-hide-chrome", "");
  }

  function showAfterCapture() {
    capturing = false;
    host?.removeAttribute("data-capturing");
    host?.removeAttribute("data-hide-chrome");
  }

  function chromeOverlapsCrop(rect) {
    if (!rect || !shadow) return false;
    const pad = 32;
    const crop = {
      x: (rect.x || 0) - pad,
      y: (rect.y || 0) - pad,
      w: (rect.w || 0) + pad * 2,
      h: (rect.h || 0) + pad * 2,
    };
    const rail = shadow.querySelector(".rail");
    if (!rail) return false;
    return rectsOverlap(rail.getBoundingClientRect(), crop);
  }

  function rectsOverlap(a, b) {
    const ax = a.x ?? a.left;
    const ay = a.y ?? a.top;
    const aw = a.width ?? a.w;
    const ah = a.height ?? a.h;
    const bx = b.x ?? b.left;
    const by = b.y ?? b.top;
    const bw = b.width ?? b.w;
    const bh = b.height ?? b.h;
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function showToast(text) {
    if (!shadow) mount();
    showAfterCapture();
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
      (async () => {
        await arm();
        sendResponse({ ok: true });
      })();
      return true;
    }
    if (msg?.type === "peek:disarm") {
      disarm({ abandon: msg.abandon !== false });
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "peek:captured") {
      showAfterCapture();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "peek:preview") {
      applyPreview(msg.clientId, msg.preview);
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "peek:status") {
      sendResponse({ ok: true, armed });
    }
  });

  globalThis.__peek = { arm, disarm, isArmed: () => armed };
  arm().catch(() => {});
})();
