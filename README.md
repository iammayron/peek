<p align="center">
  <img src="extension/icons/icon-512.png" alt="Peek" width="96">
</p>

# Peek

Point at a DOM node in your real browser. Grok Build, Claude Code, Codex, and Cursor get the selector, the DOM, the computed CSS, the box metrics, and a cropped screenshot.

This is not a browser-driving agent. You pick. The model looks.

## What a pin carries

More than a screenshot. Every pin hands the agent:

| | |
|---|---|
| Where | Page URL and tab title |
| Selector | Best CSS selector, the strategy that produced it, and the XPath |
| Identity | Tag, `id`, first 8 classes, ARIA role, accessible name |
| Content | `innerText` (2,000 chars) and `outerHTML` (12,000 chars) |
| Layout | Bounding rect, viewport size, `devicePixelRatio`, and whether the element was clipped |
| CSS | 22 computed styles: box model, typography, color, flex/grid, overflow, `z-index`, opacity |
| Picture | PNG cropped from the visible tab around the element, with 32px of padding |
| Context | Whether the node sits in a shadow root, and the tab it came from |

Pin several elements before hitting **Done** and the agent gets all of them in one
session. Everything lands in `~/.peek/` at mode `0600`.

## Install

```bash
brew tap iammayron/tap
brew install peek
```

Or from this repo:

```bash
make install
# or
curl -fsSL https://raw.githubusercontent.com/iammayron/peek/main/install.sh | sh
```

Then:

1. Install the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/peek/afalnlminndnlfgnlphbelelpcblcbld)
2. Press **Alt+Shift+P** (or click the toolbar icon), click an element
3. In the agent: “look at this” / “this button is overflowing”

Working on Peek itself? `make install` runs `peek install --dev`, which prints an
unpacked extension dir to load from `chrome://extensions` with Developer mode on.

`peek doctor` tells you if the daemon, native host, and last pin are healthy.

## Commands

| | |
|---|---|
| `peek install [--dev]` | Native host, launchd/systemd, MCP, skills |
| `peek doctor` | Status |
| `peek latest [--md]` | Current pin |
| `peek wait` | Block until the next click (also arms the overlay) |
| `peek mcp` | stdio MCP server |

## Privacy

Everything stays on localhost. Pins live in `~/.peek/` (mode `0600`). No telemetry.

## Chrome Web Store

v1 is load-unpacked. A store listing is what makes the extension itself one-click; the native host still comes from brew/`install.sh`.
