done: false
---

## Parent PRD

prds/ring-canvas-editor/index.md

## What to build

Render all anchor points (M, L, C segments) as interactive circles on the canvas using `EDITOR_STYLE` values. Make each anchor draggable using the `PointTransform` / `moveOnDrag` / `clampPoint` pipeline, clamping to the padded canvas bounds.

Add an `onchange?: (path: Path) => void` prop to `RingCanvas`. On every mousemove during a drag, serialize the current paper.js path back to the internal `Path` format and call `onchange`. `RingCanvas` does not touch state directly.

Wire `RingEditor` to pass an `onchange` callback that calls `updateRing(index, { templatePath: newPath })`, giving instant live feedback in the main preview.

See **Interaction model**, **Segment handling**, **Clamping**, **Write-back**, and **State updates** sections in the parent PRD.

## Acceptance criteria

- [ ] All anchor points (M, L, C) are rendered as white circles with black stroke at the radius specified in `EDITOR_STYLE`
- [ ] Each anchor is draggable; drag is clamped to the padded canvas bounds using the `PointTransform` pipeline
- [ ] `RingCanvas` accepts an optional `onchange: (path: Path) => void` prop
- [ ] `onchange` is called with the updated `Path` on every mousemove during a drag (no debouncing)
- [ ] `RingCanvas` does not import or call any state functions
- [ ] `RingEditor` passes an `onchange` callback that calls `updateRing`; the main preview updates in real time while dragging
- [ ] L and M segments preserve their type in the emitted `Path`
- [ ] Z commands are preserved in the emitted `Path` without any interactive element

## Blocked by

- Blocked by `prds/ring-canvas-editor/issues/02-display-transform-style-config-padding-rect.md`

## User stories addressed

- User story 1 (drag anchor points to reposition)
- User story 4 (all anchors visible at all times)
- User story 5 (main preview updates on every mousemove)
- User story 6 (L segments keep their type after anchor drag)
- User story 13 (anchor dots styled per EDITOR_STYLE)
- User story 18 (ring canvas isolated from other rings)
