done: false
---

## Parent PRD

prds/ring-canvas-editor/index.md

## What to build

When the editor loads a `templatePath`, inspect each `C` anchor's in-handle and out-handle vectors. If the angle between them is within ~0.5° of 180°, tag the node as *smooth*. When the user drags one handle of a smooth node, mirror the direction to the opposite handle (reflect angle through the anchor) while keeping the opposite handle's original length. Corner nodes remain unaffected — their handles move independently.

See **Collinearity** section in the parent PRD.

## Acceptance criteria

- [ ] At load time, each C anchor is classified as smooth (handles collinear within 0.5°) or corner
- [ ] Dragging one handle of a smooth node updates the opposite handle's direction to mirror through the anchor
- [ ] The opposite handle's length is unchanged when its direction is mirrored
- [ ] Corner nodes: dragging one handle does not affect the other (no regression)
- [ ] Collinearity classification updates when a new `templatePath` is loaded from outside
- [ ] Unit test: given a smooth node, simulate a handle drag delta and assert the opposite handle angle mirrors correctly
- [ ] Unit test: given a corner node, simulate a handle drag and assert the opposite handle is unchanged

## Blocked by

- Blocked by `prds/ring-canvas-editor/issues/04-handle-rendering-drag.md`

## User stories addressed

- User story 7 (smooth nodes stay smooth during handle drag)
- User story 8 (corner nodes have independent handles)
- User story 9 (collinearity detected automatically from imported path)
