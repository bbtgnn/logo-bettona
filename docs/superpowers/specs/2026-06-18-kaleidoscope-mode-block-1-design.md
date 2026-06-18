# Kaleidoscope Mode — Block 1: Static Engine (design)

**Date:** 2026-06-18
**Status:** Approved (brainstorm) — ready for implementation plan
**Scope:** Block 1 of 3 of the Kaleidoscope feature. SVG export is **included** in Block 1.

## Context & motivation

The user (a designer) was inspired by an online kaleidoscope tool. That tool starts
from a single SVG logo and produces a kaleidoscope by: dividing the circle into N
**sectors**, drawing a repeated **carpet** of the logo inside each, **clipping** a
triangular wedge per sector, and **mirroring** alternate sectors so the edges meet.

Our tool already produces radial symmetry, but by a fundamentally different mechanism:
`bend.ts` **deforms** a base motif into a curved polar wedge band, mirrors it, and
tiles it `copies` times. Result: a flower/mandala of curved petals. The kaleidoscope
instead keeps the motif **undistorted**, tiles it in Cartesian space, and clips it into
mirrored wedges.

Therefore kaleidoscope mode is **not** a change to `bend.ts`. It is a **second render
path** that sits on top of the existing one and uses its output as an image tile.

## Decisions captured during brainstorming

1. **Base unit (tile) = the entire current composition** (the flower), not a single
   path. "A kaleidoscope of a kaleidoscope."
2. **The kaleidoscope layer is NOT audio-reactive.** It is configured with sliders and
   (later, Block 3) animated with loops/keyframes. Audio reactivity lives only inside
   the tile (the existing composition keeps reacting).
3. **Live vs static tile = a toggle.** "Live" re-reads the composition every frame so it
   keeps pulsing inside the sectors; "static" freezes a single snapshot.
4. **UI placement:** a new "Caleidoscopio" sidebar section + a mode toggle that swaps the
   preview between the normal flower and the kaleidoscope.
5. **Animation (Blocks 2 & 3):** the user wants a from-scratch **draggable-keyframe
   editor** (the existing animation system is driver/progress-based, not a keyframe-handle
   editor). This is explicitly **out of scope for Block 1**.
6. **Tile background = a toggle.** "Background on" → tile includes the composition's
   background color; "background off" → tile is transparent and a separate kaleidoscope
   background color shows behind.
7. **Control set:** full set (see Controls below).
8. **Export:** PNG **and** SVG in Block 1. SVG always uses the static snapshot of the
   tile (an SVG export is a frozen moment; "live" does not apply to it). The tile is
   vector (paper.js `exportSVG`), so the kaleidoscope SVG is genuinely vector.

## Decomposition (the whole feature)

- **Block 1 (this doc):** Static kaleidoscope engine + section + mode toggle + controls
  + tile capture (live/static, background toggle) + PNG/SVG export. No animation.
- **Block 2:** A reusable draggable-keyframe timeline editor (component + state), built
  from scratch.
- **Block 3:** Wire kaleidoscope parameters to the Block 2 keyframe editor + WebM export
  (reusing `canvas-export.ts`).

Each block is its own spec → plan → implementation.

## Architecture (Block 1)

```
composition (paper.js)  ──renders──▶  offscreen tile canvas (square)
                                              │
                                  (live: every frame / static: snapshot)
                                              ▼
visible <canvas> ◀── KaleidoscopeRenderer (Canvas 2D): sectors, mirror, carpet, mask
```

- When kaleidoscope mode is **OFF**: preview behaves exactly as today (paper.js draws the
  composition straight to the visible canvas). Nothing changes.
- When kaleidoscope mode is **ON**: the composition is rendered to an **offscreen** square
  canvas (the tile); the `KaleidoscopeRenderer` reads that tile and draws the kaleidoscope
  to the visible canvas.

### New modules / files

1. **`src/lib/geometry/kaleidoscope.ts`** — pure geometry, no Svelte, no app state.
   - `renderKaleidoscopeToCanvas(ctx, tile, params, size)`: draws sectors with alternating
     mirror, a `repeat`×`repeat` tiled carpet per wedge, offset/rotation/scale, optional
     circular mask, and background fill.
   - `generateKaleidoscopeSVG(tileSvg, params, size)`: the **twin** generator that emits an
     SVG string with the same geometry — `<clipPath>` wedges, `transform="scale(-1,1)"` on
     mirrored sectors, nested `<g>` for the carpet, embedding the composition SVG as the
     tile. Mirrors the structure of the reference tool's SVG generator.
   - Shared helpers (wedge angle, clip path math, per-sector transforms) used by both, so
     canvas and SVG stay in sync.

2. **`src/lib/state/kaleidoscope.svelte.ts`** — `$state` holding `KaleidoscopeState`
   (params + toggles) and setter functions, following the existing state-module pattern
   (`composition.ts`, `animation.svelte.ts`).

3. **`src/lib/components/KaleidoscopeSection.svelte`** — the sidebar section with all
   controls, following the existing section components (e.g. `CanvasSection.svelte`).

4. **Preview integration** — extend `PreviewCanvas.svelte` (or a sibling) so that when
   `kaleidoscope.enabled` is true it (a) renders the composition to an offscreen tile and
   (b) draws the kaleidoscope to the visible canvas; otherwise it renders as today.

### Data model

```ts
type KaleidoscopeState = {
  enabled: boolean;          // mode toggle (off = today's flower)
  sectors: number;           // 4..24, even
  repeat: number;            // 1..10, carpet tile levels
  offsetDistance: number;    // distance of carpet from center
  scale: number;             // global carpet scale
  tileSize: number;          // per-tile size (analog of their logoSize)
  tileRotation: number;      // rotation of the motif within the wedge (deg)
  carpetRotation: number;    // rotation of each carpet tile (deg)
  globalRotation: number;    // rotation of the whole kaleidoscope (deg)
  circularMask: boolean;     // clip to circle
  liveTile: boolean;         // true = re-read tile every frame; false = static snapshot
  tileBackground: boolean;   // true = bake composition bg into tile; false = transparent
  backgroundColor: string;   // kaleidoscope bg (used when tileBackground is false)
};
```

Persistence: follows the existing persistence approach for composition/animation state
(persist the configurable values; nothing transient needs stripping in Block 1).

### Tile capture

- The composition already renders via the existing render pipeline. For the tile we render
  the **same composition** into an **offscreen square paper scope/canvas**, so the tile is
  consistent regardless of the visible canvas aspect ratio.
- **Background toggle:** the render pipeline draws shapes only (no background rectangle —
  today's white is CSS). So "tile background ON" = fill the offscreen tile with the
  composition's background color before the shapes; "OFF" = leave it transparent.
- **Live:** inside the preview's animation frame, re-render the offscreen tile each frame
  and feed it to the renderer, so audio movement shows through.
- **Static:** snapshot the offscreen tile once into an image/canvas and reuse it. A
  **"Aggiorna istantanea"** button re-snapshots on demand.
- **SVG export** always takes a fresh static snapshot of the composition via paper
  `exportSVG` (ignores `liveTile`).

## Controls (KaleidoscopeSection)

- **Mode:** Kaleidoscope on/off (the master toggle).
- **Geometry:** Sectors (4–24, even) · Carpet repeat (1–10) · Offset distance.
- **Tile:** Global scale · Tile size · Tile rotation · Carpet rotation.
- **Global:** Global rotation · Circular mask (on/off).
- **Tile source:** Live/Static toggle (+ "Aggiorna istantanea" button when static).
- **Background:** Tile background on/off · Kaleidoscope background color (active when tile
  background is off).

Ranges and steps mirror the reference tool where applicable (sectors even 4–24, repeat
1–10, rotations 0–360 / 0–180 as appropriate). Exact steps to be finalized in the plan.

## Export (Block 1)

- **PNG:** `canvas.toBlob()` of the visible kaleidoscope canvas → download. Same empty-
  canvas no-op guard as the existing exports.
- **SVG:** `generateKaleidoscopeSVG()` using a fresh vector snapshot of the composition as
  the embedded tile → download. Genuinely vector. Always the static snapshot.

## What is NOT touched

`bend.ts`, `render-pipeline.ts`, the audio drivers, morph, the existing animation system,
and the current preview behaviour when kaleidoscope mode is off. Turning the mode off
returns the tool to exactly today's behaviour.

## Edge cases & error handling

- Empty composition → kaleidoscope renders just the background (and PNG/SVG export is a
  no-op, consistent with the existing export guards).
- `sectors` forced even and clamped to range; `repeat` clamped.
- Offscreen scope created/disposed with the preview lifecycle (mirror the existing
  `renderPipeline.dispose()` pattern); no leaks when toggling modes.
- Browser without `canvas.toBlob`/SVG support → guarded, with a small message (matches the
  existing "export non supportato" pattern).

## Testing strategy

- **Unit (vitest):** `kaleidoscope.ts` geometry — wedge angle for N sectors, alternating
  mirror parity, carpet tile count = `repeat²`, circular-mask presence, and that the SVG
  generator emits the expected clipPath/transform structure for representative params.
- **Component:** `KaleidoscopeSection` renders controls and writes through to state
  (follow `Sidebar.svelte.spec` / section spec patterns; remember the full chromium suite
  for the composition mock).
- **Manual live verify:** toggle mode on; sweep every slider; live vs static; tile
  background on/off; export a PNG and an SVG and open them.

## Out of scope (later blocks)

- Draggable-keyframe editor (Block 2).
- Kaleidoscope animation + WebM export (Block 3).
- Any change to how the composition itself is authored or to audio behaviour.

## Open defaults to confirm in the plan

- Default values for each slider (a pleasant starting kaleidoscope).
- Default of `liveTile` (proposed: **static**, lighter and more predictable on open).
- Default of `tileBackground` (proposed: **off**, for the "true kaleidoscope" look) with a
  sensible default `backgroundColor`.
