done: false
---

## Parent PRD

prds/ring-canvas-editor/index.md

## What to build

For every `C` segment, render the in-handle and out-handle as small accent-colored circles connected to their anchor by a muted line, using `EDITOR_STYLE` values. Make each handle circle draggable with the same `PointTransform` / `clampPoint` pipeline used for anchors. On every mousemove, serialize the updated path and call `onchange`.

M and L segments continue to show no handles.

See **Segment handling** and **Visual style config** sections in the parent PRD.

## Acceptance criteria

- [ ] In-handle and out-handle of every `C` segment are rendered as accent-colored circles at the radius specified in `EDITOR_STYLE`
- [ ] A muted line connects each handle circle to its anchor
- [ ] Each handle is draggable; drag is clamped to the padded canvas bounds
- [ ] `onchange` is called with the updated `Path` on every mousemove during a handle drag
- [ ] M and L segments show no handles (no regression)
- [ ] The emitted `Path` correctly reflects the new handle coordinates for dragged `C` segments

## Blocked by

- Blocked by `prds/ring-canvas-editor/issues/03-anchor-drag-onchange-wiring.md`

## User stories addressed

- User story 2 (handles rendered as circles with connecting lines)
- User story 3 (drag a handle to reshape a curve)
- User story 14 (handle dots styled per EDITOR_STYLE, distinct from anchors)
