# Animate → Simple: primary reference + morph preview

**Date:** 2026-06-23
**Status:** Approved (design)

## Problem

In the Animate → Simple section, each ring's morph is configured through
`RingMorphConfigItem`. Today the panel exposes only a "Create morph" button and,
once a target exists, an editor for the **secondary** (target) path plus the
`morphT` slider. The user never sees the **primary** shape (the one authored in
the Editor) that the morph starts from, and there is no preview of the morphed
result. This makes it hard to author a target relative to a starting shape you
cannot see.

## Goals

1. Show the **primary** shape as a read-only starting reference inside the Simple
   morph panel (it is edited in the Editor, not here).
2. Keep the ability to create and edit the **target** (secondary) shape, as the
   panel already does.
3. Add a **live preview** of the morphed result, showing the blend at the current
   `morphT`, with an optional on-demand animated preview.

## Non-goals

- No primary-shape editing in the Simple panel (primary stays Editor-only; avoids
  duplicating where the base shape is edited).
- No change to how the Simple animation layer drives `morphT` during real
  playback. The "try" preview is local-only and does not touch global animation
  state or the main canvas.
- No change to `RingPreview` or its existing consumers (Paths page, library
  picker).

## Layout

Per-ring item inside `RingMorphConfigItem`'s collapsible content.

**Before a target exists:**

```
▸ Ring 1
   [ preview: primary shape only ]   (read-only reference)
   [ Create morph ]
```

**After a target exists:**

```
▸ Ring 1
   [ live morph preview ]  [ ▶ Try ]   (result at current morphT)
   Primary (read-only reference)
   Target (editable)        ← existing RingCanvas
   morphT  ●────────  (0.35)
   [ Load from library ] [ Remove morph ]
   Import SVG …
```

Order: preview on top, then primary reference, then editable target, slider,
actions, import.

## Components

### New: `RingMorphPreview.svelte`

Renders the morph result of a single ring and owns the "Try" animation.

- **Props:**
  - `path: Path` — primary template path.
  - `secondaryPath?: Path | null` — target path (null → preview shows the primary
    only).
  - `morphT?: number` — current blend value (default 0).
  - `copies?: number` — ring copies (default from the ring).
  - `baseRadius: number`, `ringIncrement: number` — composition geometry.
  - `size?: number` — canvas px (default consistent with `RingPreview`, e.g. 280).
  - `showTry?: boolean` — whether to render the ▶ Try / ⏸ Stop button
    (default false; true only when a target exists).
- **Rendering:** reuses `createRenderPipeline()` (same approach as `RingPreview`)
  to draw one ring `{ copies, templatePath: path, secondaryTemplatePath:
  secondaryPath, morphT: effectiveMorphT, … }`. Unlike `RingPreview` (which renders
  once on mount), this component **re-renders reactively** when `path`,
  `secondaryPath`, `morphT`, or `copies` change.
- **"Try" behaviour:** a local rAF loop animates an internal `t` from 0→1 looping
  (matching the real Simple driver, which maps progress 0→1 and loops via
  `progress % 1`). While running, `effectiveMorphT = t` (overrides the slider
  value) and the button shows Stop; on stop, reverts to the `morphT` prop. The
  loop is local-only: it never reads or writes global `animationState` or the main
  canvas. The rAF is cancelled on stop and on unmount (no orphan loops).
- **Error fallback:** same placeholder pattern as `RingPreview`
  (`ring-preview-placeholder` style) when the canvas or render fails.

### Modified: `RingMorphConfigItem.svelte`

- **No target yet:** show `RingMorphPreview` with `secondaryPath = null`,
  `showTry = false` (renders the primary only) above the existing "Create morph"
  button.
- **Target exists:** show `RingMorphPreview` with the ring's primary + secondary +
  `ring.morphT` + `ring.copies`, `showTry = true` at the top; below it a read-only
  primary reference; then the existing editable target `RingCanvas`, `morphT`
  slider, library / remove buttons, and SVG import — unchanged.
- The **primary read-only reference** is a second `RingMorphPreview` instance with
  `secondaryPath = null`, `morphT = 0`, `showTry = false` (it shows just the
  primary). No new editable surface for the primary.
- Geometry props (`baseRadius`, `ringIncrement`) come from `composition`.

## Data flow

- The config item reads `ring.templatePath` (primary), `ring.secondaryTemplatePath`
  (target), `ring.morphT`, `ring.copies`, and `composition.baseRadius` /
  `composition.ringIncrement`, and passes them to `RingMorphPreview`.
- Editing the target (`RingCanvas` → `updateRingPathVariant`) and moving the
  slider (`setRingMorphT`) update composition state; the preview re-renders
  reactively from the new props.
- The "Try" loop is internal to `RingMorphPreview` and leaves composition and
  animation state untouched.

## Error handling

- Missing/empty primary path: `RingMorphPreview` falls back to the placeholder,
  same as `RingPreview`.
- Render-pipeline throw: caught, placeholder shown, no crash.

## Testing

Component tests run in a real browser (vitest/browser) with Tailwind not loaded,
so assertions target DOM structure / testid / role / text, never Tailwind visuals
or pixel geometry.

- `RingMorphPreview.svelte.spec.ts`:
  - Mounts with primary + target + morphT → renders the preview canvas (no
    placeholder).
  - Changing `morphT` triggers a re-render (no error; canvas still present).
  - With `showTry` true, the Try button toggles play/stop label.
  - Unmount cancels the rAF loop (no orphan animation).
  - Missing primary → placeholder shown.
- `RingMorphConfigItem.svelte.spec.ts` (update):
  - No-target state shows a preview (primary-only) and the "Create morph" button.
  - Target state shows the morph preview, a read-only primary reference, and the
    editable target canvas, slider, and actions.

## Out of scope / future

- Auto-looping ambient preview (the chosen behaviour is static-at-slider plus an
  on-demand Try button).
- Reusing this preview in the Editor section.
