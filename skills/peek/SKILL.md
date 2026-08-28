---
name: peek
description: >
  Read the DOM element(s) the user pinned in their browser with Peek.
  Use when the user says "this", "these", "this element", "the selected/inspected/pinned
  elements", "take a peek", "look at this", "I selected", or runs /peek — before guessing
  at CSS or which component to edit.
---

# Peek

The user pins nodes with the Peek **browser extension UI**: toolbar icon, click elements on the page, pills in the corner panel, **Done** (copies a prompt) or **Cancel**.

Do not guess which node they mean. Fetch the session.

## When they already pinned

They often paste `Take a peek at 3 elements. I want to …` (Done copies that) or just say "take a peek".

Call MCP `get_picked_element`. That returns the whole session. If several pins, handle all of them.

## What the payload has

Each pin is more than a screenshot. Use the fields instead of re-deriving them:

| Field | Use it for |
|---|---|
| `url`, `title` | Which page and route the node is on |
| `selector`, `strategy` | The selector to reuse. `strategy` is how it was built, strongest first: the test-id attribute (`data-testid`, `data-test`, `data-cy`, `data-qa`), `id`, `name`, `role`, then `path`. A `path` selector is positional, so treat it as brittle |
| `xpath` | Fallback when the CSS selector will not survive a re-render |
| `tag`, `idAttr`, `classes` | Finding the component in the codebase. `classes` is the first 8 only |
| `role`, `name` | The accessible name and role. Use these to name the thing in your reply |
| `innerText` | The visible copy, clipped at 2,000 chars |
| `outerHTML` | Structure, clipped at 12,000 chars. If it ends mid-tag it was truncated, do not read that as the element ending there |
| `styles` | 22 computed properties, not the full computed style. A property missing here was never captured, it is not "unset" |
| `rect` | `w`/`h` are the rendered size, `vw`/`vh` the viewport, `dpr` the pixel ratio. Screenshot pixels are `dpr` times these |
| `inShadow` | The node is in a shadow root |
| `clipped` | The element ran past the viewport when captured |
| `screenshotPath` | PNG cropped around the element with 32px of padding |

## When they have not pinned yet

Do **not** tell them about Alt+Shift+P or Esc. Point them at the UI:

> Click the Peek icon in the browser toolbar. Click the elements in the page (they show up as pills). Hit **Done**, then paste here and say what to change.

If they are going to pin *now*, you may call `wait_for_pick` (arms the panel and waits until they hit Done). Do not busy-loop `get_picked_element`.

## How to use the pins

- Prefer `data-testid` / id selectors from the payload over inventing new ones.
- Use the screenshot for spacing, overflow, and visual bugs; `outerHTML` and `styles` for structure.
- Check `styles` before guessing at CSS. The reported `display`, `position`, `overflow`, and `z-index` are what the browser actually resolved, so a fix that contradicts them is wrong.
- Compare `rect.w`/`rect.h` against the intended size before believing a screenshot. A blurry or offset crop is usually `dpr`, not a layout bug.
- If `inShadow` is true, edit the host component, not a global CSS path.
- If `clipped` is true, the screenshot may miss part of the element. Trust `rect` and `outerHTML` over what you can see.
- `role` and `name` are the accessible identity. If they are empty on something interactive, that is worth reporting.

## Do not

- Do not drive the browser (click, fill, navigate). This skill only receives pointed-at nodes.
- Do not ignore a fresh pin in favor of an old screenshot in the conversation.
- Do not lead with keyboard shortcuts. The panel is the product.
