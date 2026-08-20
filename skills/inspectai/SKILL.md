---
name: inspectai
description: >
  Read the DOM element(s) the user pinned in their browser with InspectAI.
  Use when the user says "this", "these", "this element", "the selected/inspected/pinned
  elements", "look at this", "I selected", or runs /inspectai — before guessing
  at CSS or which component to edit.
---

# InspectAI

The user pins nodes with the InspectAI **browser extension UI**: toolbar icon, click elements on the page, pills in the corner panel, **Done** (copies a prompt) or **Cancel**.

Do not guess which node they mean. Fetch the session.

## When they already pinned

They often paste `look at this` (Done copies that) or just say "look at this".

Call MCP `get_picked_element`. That returns the current session: screenshots, selectors, HTML. If several pins, handle all of them.

## When they have not pinned yet

Do **not** tell them about Alt+Shift+I or Esc. Point them at the UI:

> Click the InspectAI icon in the browser toolbar. Click the elements in the page (they show up as pills). Hit **Done**, then paste here and say what to change.

If they are going to pin *now*, you may call `wait_for_pick` (arms the panel and waits until they hit Done). Do not busy-loop `get_picked_element`.

## How to use the pins

- Prefer `data-testid` / id selectors from the payload over inventing new ones.
- Use the screenshot for spacing, overflow, and visual bugs; HTML/CSS for structure.
- If `inShadow` is true, edit the host component, not a global CSS path.
- If `clipped` is true, the screenshot may miss part of the element.

## Do not

- Do not drive the browser (click, fill, navigate). This skill only receives pointed-at nodes.
- Do not ignore a fresh pin in favor of an old screenshot in the conversation.
- Do not lead with keyboard shortcuts. The panel is the product.
