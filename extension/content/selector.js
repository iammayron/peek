(() => {
  const MAX_HTML = 12000;
  const MAX_TEXT = 2000;
  const MAX_NAME = 200;
  const STYLE_KEYS = [
    "display",
    "position",
    "box-sizing",
    "width",
    "height",
    "margin",
    "padding",
    "color",
    "background-color",
    "font",
    "font-size",
    "font-weight",
    "line-height",
    "border",
    "border-radius",
    "flex",
    "grid-template-columns",
    "overflow",
    "z-index",
    "opacity",
    "visibility",
    "text-align",
  ];

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^\w-]/g, (ch) => `\\${ch}`);
  }

  function isGeneratedId(id) {
    if (!id) return true;
    if (id.length > 80) return true;
    if (/^[:_]/u.test(id)) return true;
    if (/^ember\d/i.test(id)) return true;
    if (/^react-aria/i.test(id)) return true;
    if (/^:r[0-9a-z]+/i.test(id)) return true;
    if (/^[a-f0-9]{8,}$/i.test(id)) return true;
    if (/\d{6,}/.test(id)) return true;
    if (/^[A-Z0-9]{10,}$/.test(id)) return true;
    return false;
  }

  function rootOf(el) {
    const root = el.getRootNode();
    return root && root.nodeType ? root : document;
  }

  function uniqueIn(root, selector, el) {
    try {
      const hits = root.querySelectorAll(selector);
      return hits.length === 1 && hits[0] === el;
    } catch {
      return false;
    }
  }

  function attrSelector(attr, value) {
    return `[${attr}="${cssEscape(value)}"]`;
  }

  function nthOfType(el) {
    const tag = el.tagName.toLowerCase();
    const parent = el.parentElement;
    if (!parent) return tag;
    const same = [...parent.children].filter((c) => c.tagName === el.tagName);
    if (same.length === 1) return tag;
    return `${tag}:nth-of-type(${same.indexOf(el) + 1})`;
  }

  function cssPath(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 12) {
      if (node.id && !isGeneratedId(node.id)) {
        parts.unshift(`#${cssEscape(node.id)}`);
        break;
      }
      parts.unshift(nthOfType(node));
      const root = node.getRootNode();
      if (root instanceof ShadowRoot) {
        parts.unshift(":host");
        node = root.host;
        depth += 1;
        continue;
      }
      node = node.parentElement;
      depth += 1;
    }
    return parts.join(" > ");
  }

  function xpathFor(el) {
    if (el.id && !isGeneratedId(el.id)) {
      return `//*[@id=${JSON.stringify(el.id)}]`;
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const tag = node.nodeName.toLowerCase();
      let i = 1;
      for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
        if (sib.nodeName === node.nodeName) i += 1;
      }
      if (node.id && !isGeneratedId(node.id)) {
        const rest = parts.length ? "//" + parts.join("/") : "";
        return `//*[@id=${JSON.stringify(node.id)}]` + rest;
      }
      parts.unshift(`${tag}[${i}]`);
      const root = node.getRootNode();
      if (root instanceof ShadowRoot) {
        parts.unshift("shadow-host");
        node = root.host;
        continue;
      }
      node = node.parentElement;
    }
    return "/" + parts.join("/");
  }

  function bestSelector(el) {
    const root = rootOf(el);
    const testId =
      el.getAttribute("data-testid") ||
      el.getAttribute("data-test") ||
      el.getAttribute("data-cy") ||
      el.getAttribute("data-qa");
    if (testId) {
      for (const attr of ["data-testid", "data-test", "data-cy", "data-qa"]) {
        if (el.getAttribute(attr) === testId) {
          const sel = attrSelector(attr, testId);
          if (uniqueIn(root, sel, el)) {
            return { selector: sel, strategy: attr };
          }
        }
      }
    }
    if (el.id && !isGeneratedId(el.id)) {
      const sel = `#${cssEscape(el.id)}`;
      if (uniqueIn(root, sel, el) || uniqueIn(document, sel, el)) {
        return { selector: sel, strategy: "id" };
      }
    }
    const name = el.getAttribute("name");
    if (name) {
      const sel = `${el.tagName.toLowerCase()}${attrSelector("name", name)}`;
      if (uniqueIn(root, sel, el)) return { selector: sel, strategy: "name" };
    }
    const role = el.getAttribute("role") || implicitRole(el);
    const acc = accessibleName(el);
    if (role && acc) {
      const sel = `${el.tagName.toLowerCase()}[role="${cssEscape(role)}"]`;
      if (uniqueIn(root, sel, el)) return { selector: sel, strategy: "role" };
    }
    const path = cssPath(el);
    return { selector: path, strategy: "path" };
  }

  function implicitRole(el) {
    const tag = el.tagName.toLowerCase();
    const map = {
      button: "button",
      a: el.hasAttribute("href") ? "link" : "",
      nav: "navigation",
      main: "main",
      header: "banner",
      footer: "contentinfo",
      img: "img",
      input: el.type === "submit" || el.type === "button" ? "button" : "textbox",
      textarea: "textbox",
      select: "combobox",
      h1: "heading",
      h2: "heading",
      h3: "heading",
    };
    return map[tag] || "";
  }

  function accessibleName(el) {
    const labelled = el.getAttribute("aria-labelledby");
    if (labelled) {
      const text = labelled
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText?.trim())
        .filter(Boolean)
        .join(" ");
      if (text) return clip(text, MAX_NAME);
    }
    for (const attr of ["aria-label", "alt", "title", "placeholder"]) {
      const v = el.getAttribute(attr);
      if (v && v.trim()) return clip(v.trim(), MAX_NAME);
    }
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON") {
      const v = (el.value || el.innerText || "").trim();
      if (v) return clip(v, MAX_NAME);
    }
    const label = el.closest("label") || (el.id ? document.querySelector(`label[for="${cssEscape(el.id)}"]`) : null);
    if (label?.innerText) return clip(label.innerText.trim(), MAX_NAME);
    const text = (el.innerText || "").trim().split("\n")[0];
    return clip(text, MAX_NAME);
  }

  function clip(s, max) {
    if (!s) return "";
    if (s.length <= max) return s;
    return s.slice(0, max) + "…";
  }

  function computedSlice(el) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const key of STYLE_KEYS) out[key] = cs.getPropertyValue(key);
    return out;
  }

  function inShadow(el) {
    return el.getRootNode() instanceof ShadowRoot;
  }

  function describe(el) {
    const { selector, strategy } = bestSelector(el);
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clipped = rect.left < 0 || rect.top < 0 || rect.right > vw || rect.bottom > vh;
    const classes = [...el.classList].slice(0, 8);
    return {
      url: location.href,
      title: document.title,
      selector,
      strategy,
      xpath: xpathFor(el),
      tag: el.tagName.toLowerCase(),
      idAttr: el.id || "",
      classes,
      role: el.getAttribute("role") || implicitRole(el),
      name: accessibleName(el),
      innerText: clip((el.innerText || "").trim(), MAX_TEXT),
      outerHTML: clip(el.outerHTML || "", MAX_HTML),
      inShadow: inShadow(el),
      rect: {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        vw,
        vh,
        dpr: window.devicePixelRatio || 1,
      },
      styles: computedSlice(el),
      screenshotPaddingPx: 32,
      clipped,
    };
  }

  function deepElementFromPoint(x, y) {
    let el = document.elementFromPoint(x, y);
    const seen = new Set();
    while (el && el.shadowRoot && !seen.has(el)) {
      seen.add(el);
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }

  function chipLabel(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id && !isGeneratedId(el.id) ? `#${el.id}` : "";
    const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join("");
    return clip(`${tag}${id}${cls}`, 60);
  }

  globalThis.__PEEK_SELECTOR__ = {
    describe,
    deepElementFromPoint,
    chipLabel,
  };
})();
