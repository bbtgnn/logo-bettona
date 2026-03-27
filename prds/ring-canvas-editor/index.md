done: false
---

## Problem Statement

A designer can import an SVG as a ring template, but once imported the path is fixed — there is no way to adjust it without going back to an external vector editor. Small tweaks (nudging an anchor, softening a handle) require a full round-trip: edit in Illustrator/Figma, re-export, re-upload. This breaks the creative flow and makes iterating on shapes slow and frustrating.

## Solution

Turn the per-ring preview canvas into a live bezier editor. Anchor points and cubic bezier handles are rendered as interactive dots directly on the canvas. The user drags them to reshape the template path; the main composition preview updates on every frame. No external tool needed for small adjustments.

## User Stories

1. As a designer, I want to drag any anchor point on the ring canvas so that I can reposition it without re-uploading a new SVG.
2. As a designer, I want bezier handles rendered as small circles connected to their anchor by a line so that I can see and grab them easily.
3. As a designer, I want to drag a bezier handle to reshape a curve segment so that I can fine-tune curvature interactively.
4. As a designer, I want all anchors and handles to be visible at all times (no click-to-select) so that I can start editing immediately without an extra click.
5. As a designer, I want the main composition preview to update on every mousemove while I drag so that I see the effect of my edits in real time.
6. As a designer, I want straight-line (L) segments to keep their type after I move their anchor so that I do not accidentally introduce curves.
7. As a designer, I want smooth nodes (collinear handles) to stay smooth when I drag one handle so that my curves remain continuous.
8. As a designer, I want corner nodes to have independent handles so that I can create intentional cusps and corners.
9. As a designer, I want smooth-node collinearity detected automatically from the imported path so that I do not have to manually mark nodes.
10. As a designer, I want drag positions clamped to a padded area inside the canvas so that I cannot accidentally drag a point off-screen.
11. As a designer, I want the clamping boundary visualized as a light rectangle so that I know where the draggable area ends.
12. As a designer, I want the canvas to stay centered on the path after I import an SVG, and to stop re-centering while I edit, so that the view does not jump while I drag.
13. As a designer, I want anchor dots rendered as white circles with a black stroke so that they are clearly visible against the path.
14. As a designer, I want handle dots rendered as smaller accent-colored circles so that I can distinguish them from anchors at a glance.
15. As a designer, I want all visual style values (sizes, colors) defined in a single config object so that the look can be changed in one place.
16. As a designer, I want multi-subpath SVGs (e.g. letters with holes) to be rejected with an inline error so that I understand why the import failed.
17. As a designer, I want the previously loaded path preserved when a multi-subpath SVG is rejected so that I do not lose my work.
18. As a designer, I want the ring canvas to remain isolated from other rings so that editing one ring does not affect the others.

## Implementation Decisions

### Coordinate space

Editing operates in original (pre-scale) coordinate space. A paper.js Group or view matrix applies the scale-and-center transform for display only. All drag deltas are computed in original space. Re-centering triggers only when `templatePath` changes from outside (new SVG import); it is suppressed while the user is dragging or has unsaved edits.

### Interaction model

Always-on: all anchors and handles are visible simultaneously. No selection state. Drag any visible dot directly.

### Segment handling

| Command | Anchor draggable | Handles shown | Output type |
|---------|-----------------|---------------|-------------|
| `M` | yes | no | `M` preserved |
| `L` | yes | no | `L` preserved |
| `C` | yes | yes (in + out) | `C` preserved |
| `Z` | — | — | `Z` preserved |

### Collinearity

- **Detection**: at load time, tag each anchor as *smooth* if the angle between its in-handle vector and out-handle vector is within ~0.5° of 180°.
- **Smooth drag**: dragging one handle of a smooth node mirrors the direction to the opposite handle (reflects angle through the anchor) while keeping the opposite handle's original length.
- **Corner nodes**: handles move fully independently.

### Clamping

Drag positions are clamped to the canvas bounds minus a configurable padding. The `PointTransform` / `moveOnDrag` / `clampPoint` composable pipeline (established in the experiments module) is reused. A light rectangle is drawn inside the canvas to visualize the padding boundary.

### Write-back

`RingCanvas` gains an optional `onchange?: (path: Path) => void` prop. It does not import or call any state functions. The parent (`RingEditor`) passes the callback and calls `updateRing` on each invocation. `onchange` fires on every mousemove during drag (no debouncing).

### Visual style config (`EDITOR_STYLE`)

| Element | Property | Value |
|---------|----------|-------|
| Anchor | fill | white |
| Anchor | stroke | black |
| Anchor | radius | 5 px |
| Handle | fill | accent (blue) |
| Handle | radius | 3 px |
| Handle line | stroke | muted, 1 px |
| Padding rect | stroke | very light |
| Padding rect | fill | none |

### Multi-subpath rejection

`svg-import.ts` returns `null` if the extracted path's `cmds` array contains more than one `M` command. The error surfaces via the existing `importError` mechanism in `RingEditor` (below the file input). The previous path is preserved.

### Modules affected

- **`RingCanvas.svelte`** — main change: add interactive editing layer above the display layer
- **`RingEditor.svelte`** — pass `onchange` callback to `RingCanvas`; call `updateRing` on each change
- **`geometry/svg-import.ts`** — add multi-subpath check; return `null` and surface error when more than one `M` is found

## Testing Decisions

Tests focus on external behavior only, not implementation details (no testing of internal paper.js objects or intermediate state).

### What makes a good test here

- Provide a known `Path` as input, simulate a drag delta, assert the output `Path` has the expected coordinates.
- Assert collinearity is preserved: given a smooth node, drag one handle and verify the opposite handle angle changed to match.
- Assert L segments preserve their type after anchor drag.
- Assert clamping: a drag that would move a point outside bounds produces coordinates at the boundary.

### Modules to test

- **`geometry/svg-import.ts`** — add a test case: a path string with two `M` commands returns `null`.
- **Path-editor logic** (if extracted into a pure utility) — unit test anchor drag, handle drag, collinearity mirror, and clamping without any DOM or paper.js canvas. Prior art: `geometry/svg-import.svelte.spec.ts`.

### Not tested

- `RingCanvas.svelte` and `RingEditor.svelte` UI interaction (paper.js drag events are not easily simulated in vitest; covered by manual testing).

## Out of Scope

- Adding or removing anchor points (only moving existing ones)
- Toggling a node between smooth and corner
- Keyboard nudging of anchors/handles
- Undo/redo
- Selecting multiple anchors
- Promoting L segments to C on handle drag
- Editing Q (quadratic) segments as quadratic (they may be converted to C by paper.js internally)
- Any server-side logic

## Further Notes

- `paper.js` must always be imported as `import paper from 'paper'` — never use the global.
- The `PointTransform` composable pattern (from `src/routes/experiments/paper.ts`) is the intended reuse point for clamping logic. Do not duplicate it.
- The `EDITOR_STYLE` config object should be co-located with `RingCanvas` (not a separate file) unless it grows large enough to warrant extraction.
- Collinearity threshold of 0.5° is a starting point; it may need tuning based on real SVG inputs.
