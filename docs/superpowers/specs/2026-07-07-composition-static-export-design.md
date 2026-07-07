# Composition static export — design

**Date:** 2026-07-07
**Branch target:** off `main`
**Status:** approved design, ready for implementation plan

## Goal

Give the Composition section its exit to the world: export what is on the canvas
as **PNG** and **SVG**, in whichever layout mode is active (Poster or
Kaleidoscope), from a dedicated **Export panel in the Composition sidebar**.
Complete the print-format control stubbed in the Canvas panel. Export captures
the **static** composition — no dependency on audio or animation.

Reuse the export logic that already exists; move it, do not duplicate it.

## Current state (verified)

- **Static export already works.** `createPreviewPresenter()` in
  `src/lib/components/preview-presenter.svelte.ts` exposes `exportSvg({ includeBackground })`
  and `exportPng({ includeBackground, scale })`. Both branch poster (flat paper
  scene) vs kaleidoscope, both bypass morph (`ignoreMorph`) so they already
  photograph the static pose. No rewrite of this math is needed.
- **Export UI is in the wrong place.** The SVG/PNG buttons, the include-background
  checkbox, and the resolution select live in `PreviewCanvas.svelte`, which the
  `(app)/+layout.svelte` renders in the shared main pane — so static export
  currently shows on editor, composition, *and* animate.
- **Print-format stub.** `CanvasSection.svelte` (Composition sidebar) has a
  disabled `<select>` labelled `composition_print_format` showing "coming soon",
  sitting beside the aspect-ratio select.
- **Background color source.** `getCompositionBackgroundColor()` reads the active
  mono palette's `background` field. No export-time color control exists.
- **Presenter ownership.** The presenter is created inside `PreviewCanvas` and
  owns the visible canvas via its `attach` Svelte attachment. `PreviewCanvas`
  (inset) and the Composition sidebar are sibling subtrees, both under
  `(app)/+layout`'s `SidebarProvider`.
- `ratioToCanvasSize(ratio, longSide)` in `src/lib/geometry/aspect-ratio.ts`
  parses any `"W:H"` string numerically. `AspectRatio` is a fixed string-literal
  union of screen ratios.

## Decisions

### D1 — Print format sets the composition shape; format + DPI set PNG size

Print formats are paper presets: **A5, A4, A3, Letter**, plus **Digitale** (= no
paper format, `null`). Physical dimensions in millimetres drive two things:

- **Shape:** selecting a paper format sets the composition proportion to that
  paper (the live canvas reshapes). The screen aspect-ratio select is **disabled**
  (greyed, not hidden) while a paper format is active — the paper owns the shape.
  Choosing `Digitale` re-enables the aspect-ratio presets.
- **PNG size:** `px = paper_mm × DPI ÷ 25.4`. A4 @ 300 DPI → 2480 × 3508 px. A3 @
  300 shares A4's proportion but is larger. SVG ignores DPI (vector).

Paper dimensions (mm): A5 148×210, A4 210×297, A3 297×420, Letter 215.9×279.4.
Orientation toggle (Verticale / Orizzontale) swaps width/height; portrait default.
DPI presets 150 / 300 / 600, default 300.

`ratioToCanvasSize` already parses `"W:H"` numerically, so a paper proportion
(e.g. `"210:297"`) feeds the same sizing path. No change to the `AspectRatio`
union is required for canvas sizing — the paper proportion is computed from the
`PRINT_FORMATS` table and passed as a ratio string / explicit long side.

### D2 — Background color edits the composition

The Export panel's color picker writes the **active mono palette's `background`**
(the value `getCompositionBackgroundColor()` already reads). The change is live on
the canvas and the export inherits it — it is not an ephemeral export-only color.
Shown/enabled only when a mono palette is active; disabled in full-palette mode
(that mode has no background slot).

### D3 — Export UI moves to the Composition sidebar; presenter is shared via context

The static SVG/PNG buttons, include-background checkbox, and resolution control
are **removed from `PreviewCanvas`** and rebuilt in a new **`ExportSection`** in
the Composition sidebar. The **animation** export button + progress bar stay in
`PreviewCanvas` (main pane, /animate only).

To let the sidebar panel act on the live canvas that the presenter owns, the
presenter is **lifted into `(app)/+layout.svelte`** and provided via
`setContext('preview-presenter', presenter)`. `PreviewCanvas` consumes it for
`attach` + animation export; `ExportSection` consumes the same instance for
`exportSvg` / `exportPng`. One presenter, one canvas, two consumers. No duplicated
export logic, no cross-tree request/response state.

Export only appears on the Composition route (only `composition/+page.svelte`
renders `ExportSection`). Editor keeps its canvas but no export UI.

## Components / units

- `src/lib/geometry/print-format.ts` (new) — `PRINT_FORMATS` table (id, widthMm,
  heightMm), orientation handling, and pure helpers: paper → proportion string,
  and `(format, orientation, dpi) → { width, height }` pixel size. Unit-tested.
- `src/lib/state/composition.ts` — add `printFormat` + orientation to state with
  a setter that also drives the effective aspect used for canvas sizing; add a
  setter for the active mono palette `background`.
- `src/lib/components/CanvasSection.svelte` — replace the disabled stub with a
  real print-format select + orientation control; disable the aspect select when
  a paper format is active.
- `src/routes/(app)/+layout.svelte` — create the presenter, `setContext`.
- `src/lib/components/PreviewCanvas.svelte` — consume presenter from context;
  remove static-export UI; keep animation export + progress.
- `src/lib/components/ExportSection.svelte` (new) — sidebar panel:
  include-background + color, resolution (DPI presets under a paper format, ×1/×2/×4
  under Digitale) with a live computed-pixels readout, Esporta SVG / Esporta PNG.
- `src/routes/(app)/composition/+page.svelte` — render `ExportSection`.
- `preview-presenter.svelte.ts` — generalize PNG sizing so it accepts the explicit
  target long side / dimensions the panel computes (keep `scale` semantics for the
  Digitale path). Static export math otherwise unchanged.
- Paraglide messages for the new labels (resolution/DPI, orientation, background
  color, export panel title, print-format options).

## Data flow

1. User picks a print format in the Canvas panel → `composition.printFormat` set →
   live canvas reshapes to the paper proportion; aspect select disabled.
2. User adjusts include-background + color (color writes palette background, live).
3. User picks resolution (DPI when paper format active, else scale) → panel shows
   computed `→ W × H px`.
4. Esporta PNG → `presenter.exportPng({ includeBackground, <target size> })`;
   Esporta SVG → `presenter.exportSvg({ includeBackground })`.
5. Presenter renders the active mode's static scene offscreen and downloads.

## Error / edge handling

- Full-palette mode: background color control disabled (no background slot).
- Kaleidoscope mode: export already routes through the kaleidoscope path in the
  presenter; unchanged.
- Empty composition: existing `exportSvg` guard (no content → no-op) preserved.
- SVG under a paper format: proportion honored via viewBox; DPI ignored.
- Digitale format: aspect-ratio presets + ×1/×2/×4 scale, existing behavior.

## Testing

- Unit: `print-format.ts` helpers — proportion string per format, pixel size per
  (format, orientation, dpi), Letter's distinct proportion, orientation swap.
- Unit/state: `printFormat` setter drives effective aspect; palette-background
  setter updates `getCompositionBackgroundColor()`.
- Component (`*.svelte.spec.ts`, browser): `CanvasSection` disables aspect select
  when a paper format is active; `ExportSection` shows DPI vs scale by mode and
  the computed-pixels readout; buttons call the presenter export fns.
- Preserve existing `preview-presenter.export.svelte.spec.ts` behavior.

## Out of scope

- Multi-page / tiled print output, bleed/crop marks, CMYK.
- Export presets persistence beyond the composition's `printFormat`.
- Ephemeral (non-composition) background color.
- Any change to animation/WebM export beyond its relocation staying put.

## Commit plan (small, checks each step)

1. `print-format.ts` table + helpers + `printFormat`/orientation state + setter
   (pure, unit-tested).
2. Wire Canvas-panel print-format select + orientation; disable aspect select when
   a paper format is active.
3. Lift presenter to `(app)/+layout` context; `PreviewCanvas` consumes it (no
   behavior change).
4. New `ExportSection`; remove static-export UI from `PreviewCanvas`.
5. Bg-color picker → palette-background setter.
6. PNG export honors paper × DPI dimensions; resolution control adapts (DPI vs
   scale) with live pixel readout.

Paraglide messages folded into the step that needs them. Svelte MCP autofixer on
every component before hand-off. Lint / typecheck / tests run each commit.
Touched-files list at the end; the final commit is the user's.
