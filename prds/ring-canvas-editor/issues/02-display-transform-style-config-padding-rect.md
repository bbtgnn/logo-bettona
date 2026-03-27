done: false
---

## Parent PRD

prds/ring-canvas-editor/index.md

## What to build

Refactor `RingCanvas` so that the scale-and-center transform is applied via a paper.js Group (or view matrix) rather than by mutating path coordinates directly. All subsequent editing logic will operate in original coordinate space; only the Group transform changes for display.

Add an `EDITOR_STYLE` config object co-located with `RingCanvas` that holds all visual constants (anchor size/color, handle size/color, handle line style, padding amount, padding rect style).

Draw a light padding rectangle inside the canvas to visualize the draggable boundary. Re-centering (fitting the path into the padded area) only triggers when `templatePath` changes from outside; it is suppressed during editing.

See **Coordinate space**, **Clamping**, and **Visual style config** sections in the parent PRD.

## Acceptance criteria

- [ ] The displayed path is visually identical to before the refactor (no regression in appearance)
- [ ] The scale+center transform is applied to a Group, not by mutating path segment coordinates
- [ ] An `EDITOR_STYLE` config object defines all visual constants in one place
- [ ] A light padding rectangle is drawn inside the canvas using `EDITOR_STYLE` values
- [ ] Re-centering does not fire during a drag (groundwork: a flag or condition is in place even if drag isn't wired yet)

## Blocked by

None — can start immediately (parallel with issue 01).

## User stories addressed

- User story 10 (clamping boundary visualized as padding rect)
- User story 11 (draggable area clearly visible)
- User story 12 (canvas stays centered on import; does not re-center during edit)
- User story 15 (visual style constants in a single config object)
