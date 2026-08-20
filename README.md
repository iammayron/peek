# InspectAI

Point at a DOM node in your real browser. Grok Build, Claude Code, Codex, and Cursor get the selector, a slice of HTML, and a cropped screenshot.

This is not a browser-driving agent. You pick. The model looks.

## Install

```bash
brew tap iammayron/tap
brew install inspectai
```

Or from this repo:

```bash
make install
# or
curl -fsSL https://raw.githubusercontent.com/iammayron/inspectai/main/install.sh | sh
```

Then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → the path `inspectai install` printed (`…/inspectai/extension`, or `./extension` in `--dev`)
4. Press **Alt+Shift+I** (or click the toolbar icon), click an element
5. In the agent: “look at this” / “this button is overflowing”

`inspectai doctor` tells you if the daemon, native host, and last pin are healthy.

## Commands

| | |
|---|---|
| `inspectai install [--dev]` | Native host, launchd/systemd, MCP, skills |
| `inspectai doctor` | Status |
| `inspectai latest [--md]` | Current pin |
| `inspectai wait` | Block until the next click (also arms the overlay) |
| `inspectai mcp` | stdio MCP server |

## Privacy

Everything stays on localhost. Pins live in `~/.inspectai/` (mode `0600`). No telemetry.

## Chrome Web Store

v1 is load-unpacked. A store listing is what makes the extension itself one-click; the native host still comes from brew/`install.sh`.
