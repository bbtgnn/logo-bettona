# Flat preview background fill — design

**Date:** 2026-06-21
**Branch:** `feat/kaleidoscope`
**Status:** approved (design)

## Problem

In the editor with kaleidoscope mode OFF (the "flat" path), the visible preview
renders only the rings onto a transparent paper.js canvas. The canvas shows its
CSS `bg-white` instead of the palette's background color. The palette background
(`getCompositionBackgroundColor()`) only appears in:

- kaleidoscope mode (the carpet, via `composeTileWithBackground` /
  `kaleidoParams().backgroundColor`), and
- the kaleidoscope SVG/animation exports.

The flat path has **no** background anywhere:

- **Visible preview** — `attach` flat `$effect` in
  `src/lib/components/preview-presenter.svelte.ts` (~line 154) renders rings via
  `pipeline.render(...)`; paper clears the canvas to transparent and never paints
  a background. The `<canvas>` CSS `bg-white` shows through.
- **Flat SVG export** — `exportSvg()` exports `scope.project.exportSVG()`, which
  contains only the ring paths. No background rect.
- **Flat WebM export** — `exportAnimation()` records the visible canvas pixels,
  which are transparent over CSS white.

Pre-existing, not introduced by the i18n work.

## Goal

The monochrome palette background color appears behind the rings in the flat path
across all three surfaces: visible preview, SVG export, WebM export. Behavior must
match the background already shown in kaleidoscope mode (same source function,
`getCompositionBackgroundColor()`).

Out of scope: kaleidoscope mode (already correct); full-palette / non-monochrome
background semantics (unchanged — `getCompositionBackgroundColor()` keeps its
current behavior, background sourced from `monochromePalettes[palette].background`
with `#ffffff` fallback, identical to what kaleidoscope already consumes).

## Approach

Paint the background as a paper.js rectangle inside the visible scene, on the
presenter side — **not** in the render pipeline.

Rationale: the SVG export reads the same `scope.project`, and the WebM export
captures the same visible canvas, so adding the rect to the scene after each flat
render covers all three surfaces from one place. The render pipeline stays pure,
so the kaleidoscope tile (which calls `pipeline.render` and composes its
background separately via `composeTileWithBackground`) is untouched.

Rejected alternatives:

- **`background` param in `render-pipeline.ts`** — more invasive; must guard the
  kaleidoscope-tile caller from double-painting and touches pipeline tests. Same
  result, more risk.
- **Separate paper background layer** — over-engineered for one rect.

## Changes

### 1. `src/lib/components/preview-presenter.svelte.ts` — flat `$effect`

After `pipeline!.render(...)` inside the flat `$effect` (the
`if (kaleidoscope.enabled) return;` branch, ~line 154–168):

- `scope!.activate()`
- create `new paper.Path.Rectangle(scope!.view.bounds)` with
  `fillColor = new paper.Color(getCompositionBackgroundColor())`
- `rect.sendToBack()`
- `scope!.view.update()`

`pipeline.render` calls `scope.project.clear()` at the start of every render, so
the rect is re-added on every change (palette, ring edits, aspect ratio). The
effect re-runs reactively because `getCompositionBackgroundColor()` reads tracked
state (`composition.monochromePalettes`, `colorMode.palette`) inside the effect.

Import `getCompositionBackgroundColor` is already present (used by `kaleidoParams`
/ `renderTile`).

### 2. `src/lib/components/PreviewCanvas.svelte`

Drop `bg-white` from the `<canvas>` class (background is now real pixels, not
CSS). Keep `rounded-lg border`.

### 3. `exportSvg()` — preserve the empty-content guard

`exportSvg()` currently early-returns when
`scope.project.activeLayer.children.length > 0` is false. With a background rect
always present that count is never zero. Capture the ring/content count BEFORE the
background rect is added (or check it independently) so a no-rings composition
still exports nothing, preserving current behavior.

Implementation note: simplest is to read the content presence from the render
result / ring count rather than `children.length`. The exact mechanism is left to
implementation, but the observable contract is: **flat SVG export with zero
renderable rings produces no download.**

### 4. Exports otherwise unchanged

`exportSvg` (flat branch) and `exportAnimation` need no further change — they read
the current scene / canvas, which now carries the background rect.

## Testing

`src/lib/components/preview-presenter.svelte.spec.ts` (browser mode):

- With kaleidoscope OFF, after `attach`, the visible scope contains a background
  item filled with the palette background color, positioned behind the ring
  paths (back-most in the scene).
- Changing the active palette updates the background item's color.
- Flat SVG export with zero renderable rings still produces no download (guard
  preserved).

Locale pinning not required (no UI text asserted). Follow existing browser-spec
conventions in the repo.

## Verification

- `bun run test:unit -- run src/lib/components/preview-presenter.svelte.spec.ts`
- `bun run check`
- svelte-autofixer on `PreviewCanvas.svelte` (gate on `issues: []`)
- Live browser check (Playwright-inside-repo + screenshot): flat preview shows
  palette background; switch palette → background updates; kaleidoscope mode
  unchanged.
