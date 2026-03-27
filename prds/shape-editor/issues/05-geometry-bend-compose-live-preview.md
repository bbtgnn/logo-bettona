done: false
---

## Parent PRD

prds/shape-editor/index.md

## What to build

Implement the core geometry and wire it to the live preview canvas. This is the heart of the app.

`bend.ts` takes a `Ring` and a `radius` and produces a complete paper.js path for that ring: the template path is bent over a circular arc of angle `alpha = π / copies` using the tangent-space transformation (radial + tangential decomposition), mirrored, and tiled `copies` times into one continuous closed path.

`compose.ts` iterates over all rings, computes each ring's effective radius (`baseRadius + ringIncrement * index`), calls `bend.ts`, and draws rings in reverse index order (highest index drawn first, index 0 on top). Rings with `templatePath: null` are silently skipped.

`PreviewCanvas` owns its own `PaperScope` and uses a Svelte `$effect` (no debounce) watching the full composition state to trigger a full clear-and-redraw. The composition is auto-scaled to fit the 600×600 canvas on every redraw.

See **Bending Math Detail**, **`geometry/bend.ts`**, **`geometry/compose.ts`**, and **`components/PreviewCanvas.svelte`** in the parent PRD.

## Acceptance criteria

- [ ] `bend.ts` produces a closed paper.js path for a ring with a valid `templatePath`
- [ ] Anchor points are correctly mapped: x → angular position along arc, y → radial distance interpolated by `ringHeight`
- [ ] Bezier handles are transformed using tangent-space decomposition (radial + tangential components)
- [ ] Collinear in/out handles through an anchor remain collinear after transformation
- [ ] The bent path is mirrored and tiled `copies` times into one continuous closed path
- [ ] Sharp corners at copy boundaries occur naturally when template endpoint handle angles are non-zero
- [ ] `compose.ts` draws rings in reverse index order (index 0 on top)
- [ ] Rings with `templatePath: null` are silently excluded from the preview
- [ ] `PreviewCanvas` redraws immediately (no debounce) on any composition state change
- [ ] The composition is auto-scaled to fit within the 600×600 canvas
- [ ] Each ring is drawn in its specified `color`

## Blocked by

- Blocked by `prds/shape-editor/issues/04-svg-import-per-ring-canvas.md`

## User stories addressed

- User story 15 (real-time 600×600 preview)
- User story 16 (immediate update on change)
- User story 17 (auto-scale to fit)
- User story 18 (rings with no path excluded silently)
- User story 24 (sharp corners at copy boundaries)
- User story 25 (smooth joins when endpoint handles are zero)
