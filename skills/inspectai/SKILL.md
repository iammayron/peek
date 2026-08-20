---
name: inspectai
description: >
  Read the DOM element the user pinned in their browser with InspectAI.
  Use when the user says "this", "this element", "the selected/inspected/pinned
  element", "look at this", "I selected", or runs /inspectai — before guessing
  at CSS or which component to edit.
---

# InspectAI

The user points at elements in their real browser (Chrome/Brave/Edge/Arc). Do not guess which node they mean — fetch the pin.

## When they already picked

Call MCP tool `get_picked_element` (or run `inspectai latest` if MCP is unavailable).

The tool returns a cropped screenshot plus selector, XPath, role/name, box, computed style, and truncated HTML. Treat that as ground truth.

## When they have not picked yet

Call `wait_for_pick`. That arms the overlay in their browser. Tell them:

> Click the element in the browser (Alt+Shift+I if the overlay is not up). Esc cancels.

Default wait is 60s. Do not busy-loop `get_picked_element`.

## How to use the pin

- Prefer `data-testid` / id selectors from the payload over inventing new ones.
- Use the screenshot to judge spacing, overflow, and visual bugs; use HTML/CSS for structure.
- If `inShadow` is true, the node is inside shadow DOM — edit the host component, not a global CSS path.
- If `clipped` is true, the screenshot may miss part of the element.

## Do not

- Do not drive the browser (click, fill, navigate). This skill only receives a pointed-at node.
- Do not ignore a fresh pin in favor of an old screenshot in the conversation.
