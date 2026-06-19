# Kaleidoscope Mode — Block 3: Animate all parameters + WebM (design)

**Date:** 2026-06-19
**Status:** Approved (brainstorm) — ready for implementation plan
**Scope:** Block 3 of 3 of the Kaleidoscope feature. Builds on Block 1 (static engine)
and Block 2 (from-scratch keyframe timeline). After this block the kaleidoscope feature
is complete.

## Context & motivation

Block 2 shipped a from-scratch draggable-keyframe timeline (pure math in
`animation/keyframes.ts` + `animation/timeline-geometry.ts`, state in
`state/keyframes.svelte.ts`, UI in `TimelinePanel` / `TimelineRuler` / `TimelineTrack` /
`KeyframeGraphEditor`) and wired exactly **one** kaleidoscope parameter
(`globalRotation`) end-to-end as the proving demo.

Block 3 generalizes that single wired param to **every animatable kaleidoscope
parameter**, using an After-Effects-style **per-parameter stopwatch**, and adds animated
**WebM** export.

### Decisions captured during brainstorming

1. **Stopwatch, not a fixed track list.** Rather than pre-populating the timeline with
   every parameter, each slider in `KaleidoscopeSection` gets a stopwatch toggle next to
   its label (AE convention). Arming the stopwatch makes that parameter appear as a track
   in the timeline; disarming removes it. The timeline shows **only armed parameters** →
   minimal clutter, full user choice over what to animate.
2. **Which controls get a stopwatch:** all **sliders** — the fluid numeric ones
   (globalRotation, tileRotation, carpetRotation, scale, offsetDistance, tileSize) **and**
   the discrete ones (sectors, repeat). Booleans (circularMask, tileBackground, liveTile,
   enabled) and the background **color** do **not** get a stopwatch and remain static.
3. **Discrete params animate in integer steps.** `sectors` stays even (`clampSectors`),
   `repeat` stays integer (`clampRepeat`). A sampled float is rounded/clamped on apply via
   the existing setters. Interpolation between keyframes uses the same per-keyframe
   `Interp` (`linear` / `bezier` / `hold`) the user already picks; no new interp type.
4. **Graph editor handles multiple params via a selector.** The value/time curve shows
   one armed parameter at a time, chosen from a dropdown of armed params, each rendered
   with its own `min`/`max`.
5. **WebM reuses the existing path.** In kaleidoscope mode the visible canvas *is* the
   kaleidoscope (drawn by the kaleidoscope rAF loop). The existing **Export Animation**
   button already records the visible canvas while the clock plays, and the clock's `tick`
   already calls `applyKaleidoscopeKeyframes(progress)`. So animated WebM of the
   kaleidoscope is mostly **verification + small hardening** of the existing button in
   kaleidoscope mode, not a new pipeline.

## Architecture

The unifying idea is a **single source of truth** for the animatable kaleidoscope
parameters. Today the wiring for `globalRotation` is hand-written inline in three places
(sidebar control, apply function, timeline panel). Adding seven more params that way would
triple that duplication. Instead, define the param set once and derive all three consumers
from it.

### New module: `src/lib/state/kaleidoscope-params.ts`

A plain (non-Svelte) registry describing every animatable kaleidoscope parameter:

```ts
export type KaleidoParam = {
  id: string;        // e.g. 'kaleidoscope.sectors' — the keyframe track paramId
  label: string;     // Italian UI label, e.g. 'Settori'
  min: number;
  max: number;
  step: number;
  get(): number;        // reads the live kaleidoscope $state value
  set(v: number): void; // the existing setter (clamps/rounds where needed)
};

export const KALEIDO_PARAMS: KaleidoParam[];               // ordered for the sidebar
export const KALEIDO_PARAM_BY_ID: Record<string, KaleidoParam>;
```

Entries (8): `globalRotation` (0–360), `tileRotation` (0–360), `carpetRotation` (0–360),
`scale` (0.3–3), `offsetDistance` (0–1), `tileSize` (0.1–2), `sectors` (4–24 step 2),
`repeat` (1–10 step 1). `get`/`set` delegate to the existing `kaleidoscope` state and its
setters, so clamping/rounding stays in one place (`kaleidoscope.svelte.ts`).

The existing `KALEIDO_GLOBAL_ROTATION` constant in `keyframes.svelte.ts` stays defined
exactly as today (`'kaleidoscope.globalRotation'`), and the registry's `globalRotation`
entry uses the same id string — so Block 2 tests/imports keep working with no new import
coupling between the two modules.

### Consumer 1 — apply seam (`state/animation.svelte.ts`)

`applyKaleidoscopeKeyframes(progress)` is rewritten to loop the registry instead of
hard-coding `globalRotation`:

```ts
export function applyKaleidoscopeKeyframes(progress: number): void {
  for (const p of KALEIDO_PARAMS) {
    const v = keyframes.sampleParam(p.id, progress);
    if (v !== null) p.set(v);
  }
}
```

`sampleParam` already returns `null` for disabled/empty tracks, so only armed params are
applied; unarmed params keep their static slider value. The clock start-gate
(`hasEnabledKeyframeTracks`) and the call sites (tick + paused authoring re-apply) are
unchanged.

### Consumer 2 — sidebar (`KaleidoscopeSection.svelte`)

Each numeric slider row is replaced by a reusable **`AnimatableSlider.svelte`** child
driven by a `KaleidoParam`. The component renders: label + a stopwatch toggle button +
the range input. Behaviour (generalized from today's inline `globalRotation` logic):

- Stopwatch reflects `keyframes.tracks[id]?.enabled`. Toggling calls
  `keyframes.setTrackEnabled(id, on)` (and `ensureTrack(id)`).
- When **armed**, `oninput` calls `keyframes.upsertKeyframeAtTime(id, progress, value)` and,
  if `!isPlaying`, `applyKaleidoscopeKeyframes(progress)` so the paused preview updates.
- When **not armed**, `oninput` calls `param.set(value)` directly (today's behaviour).

The non-animatable controls (mode toggle, circular mask, live tile + refresh, tile
background, background color) stay exactly as they are today.

> Label-collision note (carried from Block 2): `getByLabelText` matches by substring. Give
> the stopwatch an `aria-label` that does not collide with the slider's own label
> (e.g. slider `aria-label="Rotazione globale"`, stopwatch
> `aria-label="Anima Rotazione globale"` is fine because the stopwatch is a distinct
> element; verify in tests that the intended element is selected).

### Consumer 3 — timeline (`TimelinePanel.svelte`)

The panel renders dynamically from armed tracks instead of the single hard-coded
`KALEIDO_GLOBAL_ROTATION`:

- Track view: `{#each armedParams as p}` → one `TimelineTrack paramId={p.id}
  label={p.label}`. `armedParams` is `$derived` from
  `KALEIDO_PARAMS.filter((p) => keyframes.tracks[p.id]?.enabled)`.
- Graph view: a `<select>` of `armedParams` chooses the active param; the
  `KeyframeGraphEditor` is rendered with that param's `id`, `min`, `max`. If nothing is
  armed, both views show a short empty-state hint ("Arma un cronometro nella sidebar per
  animare un parametro").
- The selected graph param falls back to the first armed param when its track is disarmed.

### Consumer 4 — WebM export (`PreviewCanvas.svelte`)

No new export pipeline. Verify and harden the existing **Export Animation** button in
kaleidoscope mode:

- The empty-composition guard (`activeLayer.children.length === 0`) already protects the
  tile source; keep it.
- `exportAnimation()` calls `togglePlay()` to start the clock; with at least one armed
  kaleidoscope track, `hasEnabledKeyframeTracks()` makes the clock start even when no
  driver/morph mode is active. The clock's `tick` calls `applyKaleidoscopeKeyframes`, the
  kaleidoscope rAF loop reads the updated params and redraws, and `exportCanvasAnimation`
  records `canvasEl`. This is the whole path.
- Audio: the "Includi audio" toggle stays available (a `liveTile` kaleidoscope pulses with
  audio), but is independent of keyframe animation.

## Implementation risk to address in the plan

**rAF effect thrash on animated `sectors`/`repeat`.** The kaleidoscope draw loop's
`$effect` currently touches `kaleidoscope.sectors` / `.repeat` / `.liveTile` to restart the
loop on change. If `sectors`/`repeat` are keyframed, they change every frame, so that
effect would cancel+restart the rAF loop continuously (and reset `staticTile`).
`drawKaleidoscope()` already reads `sectors`/`repeat` live each frame, so those reads are
**not** needed to keep the picture current. The plan must remove `sectors`/`repeat` from
that effect's reactive dependencies (keep `liveTile`, which genuinely needs a restart) so
animating them does not thrash the loop. Add a regression test or manual check.

## Data flow

```
sidebar stopwatch ──arm──▶ keyframes.setTrackEnabled(id)
sidebar slider (armed) ──▶ keyframes.upsertKeyframeAtTime(id, progress, v) ──▶ [paused] applyKaleidoscopeKeyframes
clock tick(progress) ──▶ applyKaleidoscopeKeyframes(progress) ──▶ for each armed param: param.set(sample)
                                                                            │
kaleidoscope rAF loop reads kaleidoscope.* live ──▶ drawKaleidoscope ──▶ visible canvas
Export Animation ──▶ togglePlay (clock runs) + exportCanvasAnimation(canvasEl) ──▶ WebM
TimelinePanel ──derive──▶ armedParams ──▶ TimelineTrack rows + graph-editor <select>
```

## What is NOT touched

`bend.ts`, `render-pipeline.ts`, audio drivers, morph, the Block-1 kaleidoscope geometry
(`geometry/kaleidoscope.ts`, `kaleidoscope-tile.ts`), the Block-2 keyframe math
(`animation/keyframes.ts`, `timeline-geometry.ts`) and keyframe state API
(`state/keyframes.svelte.ts`). Block 3 only adds the param registry, generalizes the three
`globalRotation` consumers, extracts `AnimatableSlider`, and hardens the rAF effect +
WebM button. Non-animatable kaleidoscope controls and PNG/SVG export are unchanged.

## Edge cases & error handling

- **Nothing armed:** timeline shows the empty-state hint; `applyKaleidoscopeKeyframes` is a
  no-op (all `sampleParam` return `null`); clock start-gate unaffected by kaleidoscope.
- **Discrete out-of-range sample:** rounded/clamped by `clampSectors`/`clampRepeat` inside
  the existing setters (even for sectors, integer for repeat); never produces an invalid
  geometry input.
- **Disarming the graph-selected param:** graph selector falls back to the first remaining
  armed param, or the empty state if none.
- **WebM unsupported browser:** existing `isAnimationExportSupported` guard + message,
  unchanged.
- **Animated sectors/repeat with static tile:** loop must not thrash (see risk above); the
  static tile is unaffected by sector/repeat changes, so no needless re-snapshot.

## Testing strategy

- **Unit (node):** `kaleidoscope-params.ts` registry — every entry's `get`/`set` round-trips
  through `kaleidoscope` state; `set` on `sectors`/`repeat` clamps/rounds; ids are unique
  and match the `keyframes` track ids.
- **Integration (`animation.svelte.spec.ts`, node, `vi.resetModules` + dynamic import):**
  arming two tracks and applying at a progress sets **both** params; an unarmed param keeps
  its static value; a discrete sampled float lands on a valid rounded value.
- **Component (chromium `*.svelte.spec.ts`):** `AnimatableSlider` — stopwatch toggles
  `track.enabled`; armed slider input upserts a keyframe (not a direct set); unarmed slider
  input sets directly. `TimelinePanel` — arming a param adds its track row; graph selector
  lists armed params. Remember the full chromium suite for the `Sidebar.svelte.spec`
  `vi.mock('$lib/state/animation', ...)` — if `KaleidoscopeSection`/`AnimatableSlider`
  transitively import any new export from `animation.svelte.ts`, add it to that mock.
- **rAF regression:** a check that changing `kaleidoscope.sectors` does not tear down the
  draw-loop effect (or at least that the kaleidoscope keeps drawing) — unit/behavioural as
  feasible given the headless-canvas caveat.
- **Manual live verify (designer):** arm several stopwatches, scrub + play, confirm each
  param animates; animate sectors/repeat (stepped); switch graph param; export a WebM and
  open it.

## Verification gates (carried from Block 2)

- `bun run test:unit -- run` green (currently 345; Block 3 adds tests).
- `bun run check` → 0 errors.
- Every edited `.svelte` passes `svelte-autofixer` MCP (`issues: []`), ignoring only the
  known false-positive "function inside `$effect`" class on the canvas/rAF functions.
- Headless playwright canvas is not faithful → trust unit tests for geometry, ask the
  designer for live visual confirmation.

## Out of scope

- Animating booleans (circular mask, tile background, live tile) and the background color.
- Any change to the Block-1/Block-2 engines beyond the generalization described.
- Global UI polish of the tool (explicitly parked by the designer).
- Merging `feat/kaleidoscope` → `main` (still the designer's separate call).
