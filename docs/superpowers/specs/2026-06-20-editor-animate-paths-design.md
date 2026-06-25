# Design — Editor colors, Animate export/timeline, Paths nav & library

**Date:** 2026-06-20
**Branch:** `feat/kaleidoscope`
**Status:** approved (design), pending spec review

Five scoped UI changes across the three workspace pages, plus the *shell* of a
library dropdown. The animation-preset feature behind "Anim Library" is **out of
scope** — it gets its own spec later; here we only build the empty placeholder.

---

## 1. Editor — unified color model

### Goal
Collapse the three places a colour is chosen today into one **Colors** model, and
stop one colour doing two jobs.

Today the monochrome palette is `{ main, bg }`. Rings alternate `main`/`bg` from the
outermost inward, and `bg` *also* paints the canvas/kaleidoscope background. On top of
that the Kaleidoscope section has its own manual "Sfondo caleidoscopio" colour picker
(`kaleidoscope.backgroundColor`) that paints the carpet background — a third,
disconnected source.

### Target
Monochrome palette becomes `{ primary, secondary, background }`:

- **primary / secondary** — the two colours rings alternate between (outermost =
  primary, alternating inward). Same alternation rule as today, renamed and split.
- **background** — the *only* canvas / kaleidoscope background. It no longer colours
  any ring. It replaces **both** old background sources (the alternating `bg` ring
  colour duty is gone, and the manual kaleidoscope picker is removed).

### Changes
- `src/lib/types.ts` — `MonochromePalette`: `{ main, bg }` → `{ primary, secondary, background }`.
- `src/lib/state/default.ts` — default palette `{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }`.
- `src/lib/color/apply.ts` — `applyMonochrome` alternates `primary`/`secondary`
  (outermost = primary). `background` is not used for ring colours.
- `src/lib/state/composition.ts`
  - `getCompositionBackgroundColor()` returns `mono?.background ?? '#ffffff'`.
  - `addMonochromePalette` default updated to the new shape.
- `src/lib/state/composition-persistence.svelte.ts` — **migration**: when reading
  persisted state (initial read *and* cross-tab subscribe), normalise any
  monochrome palette still in the old shape. Map `{ main, bg }` →
  `{ primary: main, secondary: bg, background: bg }`. This preserves the existing
  on-screen look exactly (rings still alternate the same two colours; canvas bg
  unchanged). Normalisation is idempotent on already-migrated data.
- `src/lib/components/MonochromePaletteEditor.svelte` — three swatches in the list
  row (primary, secondary, background) and three labelled colour inputs in the
  editor. Field names follow the new shape.
- `src/lib/state/kaleidoscope.svelte.ts` — remove `backgroundColor` field and
  `setKaleidoscopeBackgroundColor`. Keep `tileBackground` and the derived
  `drawBackground` getter unchanged.
- `src/lib/geometry/kaleidoscope.ts` — `KaleidoscopeParams.backgroundColor` stays as
  a render param, but is **supplied by the caller** from composition background, not
  read off kaleidoscope state.
- `src/lib/components/preview-presenter.svelte.ts` — build the kaleidoscope params as
  `{ ...kaleidoscope, backgroundColor: getCompositionBackgroundColor() }` so the
  carpet background uses the palette background. (The tile-background path already
  reads `getCompositionBackgroundColor()`; both are now the same source.)
- `src/lib/components/KaleidoscopeSection.svelte` — remove the "Sfondo caleidoscopio"
  `Label` + colour input and its `{#if !kaleidoscope.tileBackground}` wrapper. Keep
  the "Sfondo tessera" checkbox.

### Tests
- `apply.ts` unit: alternation uses primary/secondary; background excluded.
- composition / persistence: migration of old `{ main, bg }` blobs.
- `MonochromePaletteEditor` spec: three inputs, correct setters.
- `kaleidoscope.svelte.spec` / `kaleidoscope.spec`: drop the removed field; carpet
  background sourced from composition.

---

## 2. Animate — export animation

### Goal
Add a real animation (video) export next to the existing SVG export, with a
rendering progress bar. The WebM engine already exists
(`src/lib/export/canvas-export.ts`, `exportCanvasAnimation`) and is currently unwired.

### Decision
**Keep both** buttons: `Export SVG` (static frame, unchanged) **and**
`Export animation` (WebM video).

### Changes
- `src/lib/components/preview-presenter.svelte.ts`
  - Add `exportAnimation()`: calls `exportCanvasAnimation({ canvas, durationSec:
    animationState.durationSec, fps: animationState.fps, audioStream:
    getExportAudioStream(), onProgress })`.
  - Expose a reactive `exportProgress` (`$state`, 0..1) updated from `onProgress`,
    and set `exportStatus.rendering` true for the duration of the capture
    (false in `finally`).
  - Guard with `isAnimationExportSupported()`; if unsupported, the button is
    disabled with a hint.
- `src/lib/components/PreviewCanvas.svelte`
  - Keep the `Export SVG` button.
  - Add an `Export animation` button **on the `/animate` route only** (it captures a
    timed animation; the editor has no timeline). Below it, a progress bar +
    percentage bound to `exportProgress`, visible while `exportStatus.rendering`.
  - Disable both export buttons while rendering.

### Tests
- `canvas-export` unit already covers progress/mime; add presenter-level coverage
  that `exportStatus.rendering` toggles and progress is surfaced (mock the export).
- `PreviewCanvas` spec: animation button + progressbar present on animate; SVG button
  still present.

---

## 3. Animate — timeline redesign

### Goal
Make the bottom timeline panel the home of playback transport, and tidy its layout.

### Target layout
Transport bar at the **top** of the timeline panel:

```
▸ Timeline   [▶ Play][■ Stop]   Dur:[3.0]s   fps:[30▾]        [ Timeline | Graph ]
─────────────────────────────────────────────────────────────────────────────────
0      1s      2s      3s        ← per-second ticks
<param tracks>  /  <graph editor>      (both views same fixed height)
```

### Changes
- `src/lib/state/animation.svelte.ts`
  - Add `fps: number` (default 30) to `AnimationState`.
  - Add `setAnimationFps(n)` clamping to the allowed set `{25, 30, 50, 60}`
    (invalid → 30).
- `src/lib/components/TimelinePanel.svelte`
  - **Transport bar in the header**, always visible (independent of armed tracks):
    `Play/Pause` + `Stop` (calls `togglePlay` / `stopAnimation`), the `Duration (s)`
    input (timed modes) or an elapsed-time counter (audio modes — `audioBars` /
    `audioZones`), and the `fps` selector. Keep the existing Timeline/Graph view
    toggle.
  - **Spacebar = Play/Pause**: a `window` keydown listener (added in an `$effect`,
    removed on teardown) that toggles play, ignored when the focused element is an
    `input` / `select` / `textarea` / `contenteditable`.
  - **Equal height**: wrap the tracks view and the graph view in a container with a
    fixed `min-height` so switching views doesn't resize the panel.
  - The `blockPlayback` rule (needs a ring with a secondary path) is computed here to
    disable Play, mirroring today's logic.
- `src/lib/components/TimelineRuler.svelte` — ticks at **each integer second** up to
  `durationSec` (labelled), replacing the current quarter-fraction ticks. Scrubbing
  behaviour unchanged.
- `src/lib/components/AnimationSection.svelte` — **remove** the transport block
  (`{#if !hideGlobalTransport}` … duration field, Play/Pause, progress bar, elapsed
  counter). That responsibility moves to the timeline. The audio-config controls
  (source, gains, zones, per-ring wave) stay. The `blockPlayback` warning banner may
  stay in the sidebar (it's about composition validity).

### Notes
- The old sidebar playback progress bar is dropped; the ruler playhead is the
  position indicator.
- `fps` only affects the exported video (§2). On-screen preview stays real-time
  (rAF), matching AE/Premiere comp-fps behaviour.

### Tests
- `TimelinePanel` spec: transport present (Play/Stop, duration/elapsed, fps); spacebar
  toggles play; both views render at the same height container.
- `TimelineRuler` spec: per-second ticks/labels for a given duration.
- `AnimationSection` spec: transport controls no longer present.
- `animation.svelte.spec`: `setAnimationFps` clamps to the allowed set.

---

## 4. Paths — nav alignment & sidebar width

### Goal
The workspace nav (Editor / Animate / Paths) starts at a different x on Paths (no
sidebar, nav hard-left) than on Editor/Animate (pushed right by the 16rem sidebar +
trigger). Align them, and give the sidebar more room.

### Changes
- `src/lib/shadcn/ui/sidebar/constants.ts` — `SIDEBAR_WIDTH` `16rem` → `18rem`.
- `src/routes/paths/+page.svelte` — indent the page header so the nav begins at the
  sidebar offset: left padding of `18rem` (`pl-72`) on the header content, matching
  the Editor/Animate nav start. (Approximate when the sidebar is collapsed; aligns in
  the default expanded state.)
- `about` page is left as-is (separate centered layout, not part of the workspace nav
  alignment).

### Tests
- `paths/page.svelte.spec` — header nav present; existing tests still pass with the
  indent.
- Sidebar width change is a constant; covered by existing layout specs not asserting a
  hardcoded 16rem.

---

## 5. Paths — library dropdown (shell only)

### Goal
Turn the static "Path Library" title into a dropdown choosing between **Path Library**
and **Anim Library**. Anim Library (animation presets) is a future feature — here it's
a placeholder.

### Changes
- `src/routes/paths/+page.svelte`
  - Replace the `Path Library` label with a `<select>` bound to local state
    `libraryKind: 'path' | 'anim'` (default `'path'`).
  - `'path'` → the current list + preview + apply flow, unchanged.
  - `'anim'` → a placeholder empty state: e.g. "Anim Library — preset di animazioni,
    in arrivo." No list, no apply. No new state module.
- No changes to `path-library.ts`; no anim-preset persistence yet.

### Tests
- `paths/page.svelte.spec` — dropdown present with both options; selecting `anim`
  shows the placeholder and hides the path list; `path` restores it.

---

## Out of scope (next spec)
- The actual **Anim Library**: what an animation preset stores (mode, durationSec,
  fps, audio config, keyframe tracks, kaleidoscope params?), how it's created from the
  current animation, and how it's applied. Drives a follow-up brainstorm.

## Cross-cutting constraints (carried)
- **bun.** Unit: `bun run test:unit -- run [path]`. Types: `bun run check`.
- Every changed `.svelte` / `.svelte.ts` must pass `svelte-autofixer` (`issues: []`).
- Tab indentation. Tailwind not in vitest DOM → assert structure/testid/ARIA only.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
