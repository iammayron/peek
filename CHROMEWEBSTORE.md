# Chrome Web Store Listing — Peek

> Last Updated: 2026-08-25

Item ID: `afalnlminndnlfgnlphbelelpcblcbld`
Publisher: `iammayron`

The store rejects a manifest containing `key`. Package with:

```sh
rm -rf /tmp/peek-pkg && cp -R extension /tmp/peek-pkg
python3 -c "import json,pathlib,collections;p=pathlib.Path('/tmp/peek-pkg/manifest.json');\
m=json.loads(p.read_text(),object_pairs_hook=collections.OrderedDict);m.pop('key',None);\
p.write_text(json.dumps(m,indent=2)+'\n')"
cd /tmp/peek-pkg && zip -rq /tmp/peek.zip . -x "*.DS_Store"
```

## Store Listing

**Extension Name**
Peek

**Short Description**
Point at a page element and send it — selector, DOM, and a cropped screenshot — to your coding agent.

**Detailed Description**
Point at an element in your real browser and hand it to your coding agent. Click the Peek icon, click the elements you care about, hit Done. Peek copies a prompt containing a unique CSS selector, the XPath, the element HTML, its box and computed styles, and a cropped screenshot. Paste that into Claude Code, Codex, Cursor, or Grok Build and say what to change.

This is not a browser-driving agent. You pick. The model looks.

WHY IT HELPS
- Stop describing which button is broken. Point at it.
- The agent gets a real selector, so it can find the component in your code.
- The cropped screenshot shows the visual bug instead of the whole page.
- Pin several elements in one pass and send them together.

HOW IT WORKS
Peek talks to a small helper process on your own machine over 127.0.0.1. The helper registers an MCP server and an agent skill, so your agent can read the pinned elements directly instead of you pasting screenshots around.

REQUIRES THE PEEK CLI
curl -fsSL https://raw.githubusercontent.com/iammayron/peek/main/install.sh | sh

Source and docs: https://github.com/iammayron/peek

PRIVACY
Everything stays on localhost. Pinned elements are written to ~/.peek on your own machine with owner-only permissions. No accounts, no analytics, no telemetry, and nothing is sent to any server.

**Category**
Developer Tools

**Single Purpose**
Lets a developer point at a DOM node in their browser and send that node's selector, HTML, styles, and a cropped screenshot to a coding agent.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | assets/store/store-icon-128.png |
| Screenshot 1 | 1280×800 | ✅ Ready | assets/store/screenshot-1-pinned.png |
| Screenshot 2 | 1280×800 | ✅ Ready | assets/store/screenshot-2-armed.png |
| Screenshot 3 | 1280×800 | ✅ Ready | assets/store/screenshot-3-copied.png |
| Small Promo Tile | 440×280 | ✅ Ready | assets/store/promo-small-440x280.png |
| Marquee Promo Tile | 1400×560 | ✅ Ready | assets/store/promo-marquee-1400x560.png |

### Screenshot Notes
1. Pinned: highlight + chip on a live element, tray showing a pill.
2. Armed: crosshair overlay and empty tray, ready to pin.
3. Copied: toast after Done, prompt on the clipboard.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| activeTab | permissions | Arm the picker on the tab the user clicked the toolbar icon on. |
| tabs | permissions | Read the active tab URL/title so a pin records which page the node is on, and skip chrome:// / Web Store pages. |
| scripting | permissions | Inject the picker overlay when the user clicks the icon or presses Alt+Shift+P. |
| commands | permissions | Register Alt+Shift+P to toggle the picker. |
| clipboardWrite | permissions | Copy the "look at this" prompt when the user hits Done. |
| `<all_urls>` | host_permissions | The picker has to run on whatever page the developer is building, including localhost and file URLs. It only injects after an explicit toolbar click or shortcut. |

## Privacy & Data Use

**Does the extension collect user data?** No

Pins stay on the user's machine at `~/.peek/` (mode 0600) via a local helper on `127.0.0.1:17321`. Nothing is sent to a remote server.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

The listing declares that the extension does not collect or use user data. Support and source: https://github.com/iammayron/peek

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name**: iammayron
**Contact Email**: mayroonalves@gmail.com
**Support URL**: https://github.com/iammayron/peek/issues
**Homepage URL**: https://peek.mayronalves.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.2.5 | 2026-08-28 | Docked full-height pin rail that pushes the page, slide in/out, phosphor panel, screenshot thumbs with hover preview. | Pending review |
| 0.2.4 | 2026-08-25 | Enter finishes a pin session. Peek's own tray and HUD are excluded from hit-testing so they cannot be selected. | Pending review |
| 0.2.3 | 2026-08-25 | Skill documents the full pin payload. No extension code change. | Git tag |
| 0.2.2 | 2026-08-25 | Install help points store users at the listing instead of load-unpacked. No extension code change. | Git tag |
| 0.2.1 | 2026-08-25 | Store build talks to the daemon. Drop unused nativeMessaging/alarms. | Published |
| 0.2.0 | 2026-08-20 | Multi-pin tray, Done copies a prompt. | Published |

## Review Notes

Upload zip is `extension/` with `key` stripped. Do not zip the repo root.
