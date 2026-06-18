# Kaleidoscope Mode — Block 2: Keyframe Animation System + Timeline Editor (design)

**Date:** 2026-06-18
**Status:** Approved (brainstorm) — ready for implementation plan
**Scope:** Block 2 of 3 of the Kaleidoscope feature. Builds the reusable keyframe
animation system and an After Effects / Premiere–style timeline editor, wired to a
**single demo parameter** (kaleidoscope `globalRotation`) for live verification.

## Context & motivation

Block 1 shipped a static kaleidoscope engine driven by sliders (see
`2026-06-18-kaleidoscope-mode-block-1-design.md`). The kaleidoscope is explicitly
**not** audio-reactive; the designer wants to animate it with a **from-scratch
draggable-keyframe editor**, not the existing driver/progress animation system
(`animation.svelte.ts`), which morphs the composition's rings.

Block 2 builds that editor as a **reusable** system (data model + state + UI) and proves
it end-to-end by animating one real parameter. Block 3 will wire the remaining
kaleidoscope parameters and add WebM export.

## Decisions captured during brainstorming

1. **Block 2 boundary:** ship the reusable keyframe system + timeline UI, wired to **one
   demo parameter only — kaleidoscope `globalRotation`**. All other parameters and WebM
   export are Block 3.
2. **Clock:** reuse the **existing** animation clock in `animation.svelte.ts`
   (`durationSec`, play/pause, `loop`, `alternate`, `progress` 0..1). Keyframe tracks are
   sampled by the existing global `progress`. Pressing play moves the logo composition and
   the kaleidoscope together on one timeline.
   - **Required change to the existing clock:** today the clock refuses to start when there
     are no ring morph targets and no driver mode (`startNewAnimation` → `stopInternal`).
     It must also start/run when **enabled kaleidoscope keyframe tracks exist**. This is the
     only modification to the existing animation file; it is additive (a widened "is there
     anything to animate?" check + a per-tick apply step).
3. **Value-source model ("stopwatch", AE-style):** each animatable parameter has an
   **enabled (on/off)** flag.
   - **Off** → static value; the Block 1 slider owns the parameter (today's behaviour).
   - **On** → during playback the parameter is driven by its keyframe track. Moving the
     playhead to a time and changing the slider creates/updates a keyframe at that time.
4. **UI form:** After Effects / Premiere style — a **horizontal track timeline** plus a
   toggleable **Graph Editor** (value/time curves with draggable bezier handles).
5. **UI placement:** a **bottom, full-width, collapsible panel** beneath the preview
   (inside `SidebarInset`, below `<main>` in `+page.svelte`).
6. **Interpolation types (per keyframe):** **linear**, **bezier (ease, draggable
   handles)**, **hold (step)**.
7. **Persistence:** keyframe tracks persist to localStorage, consistent with the
   composition (`rune-sync` `localStorageSync`).

## Decomposition (the whole feature)

- **Block 1 (done):** Static kaleidoscope engine + section + controls + tile capture +
  PNG/SVG export.
- **Block 2 (this doc):** Reusable keyframe system + AE-style timeline editor (track view
  + graph editor), wired to `globalRotation` as the live demo target.
- **Block 3:** Wire all remaining kaleidoscope parameters to the keyframe editor + WebM
  export (reusing `canvas-export.ts`).

## Architecture (Block 2)

```
                 existing clock (animation.svelte.ts)
                 tick → progress (0..1)
                          │
                          ▼
            keyframes.svelte.ts: for each ENABLED track,
            value = sampleTrack(track, progress)
                          │
                          ▼
            apply to target param  (Block 2: setGlobalRotation)
                          │
                          ▼
            kaleidoscope renders (Block 1 engine, unchanged)

  TimelinePanel (bottom) ──reads/writes──▶ keyframes.svelte.ts
    ├─ TimelineRuler + playhead (reflects/scrubs progress)
    ├─ TimelineTrack rows (diamonds, drag in time)
    └─ KeyframeGraphEditor (value/time curves, draggable points + bezier handles)
```

### New modules / files

1. **`src/lib/animation/keyframes.ts`** — pure, no Svelte, no app state.
   - Types:
     ```ts
     type Interp = 'linear' | 'bezier' | 'hold';
     type Keyframe = {
       id: string;
       time: number;        // normalized position on the timeline, 0..1
       value: number;
       interp: Interp;      // interpolation OUT of this keyframe toward the next
       // bezier control handles (temporal+value), AE-style, normalized to the
       // segment; only meaningful when interp === 'bezier'.
       handleOut?: { dx: number; dy: number };
       handleIn?: { dx: number; dy: number };
     };
     type Track = {
       paramId: string;     // e.g. 'kaleidoscope.globalRotation'
       enabled: boolean;    // stopwatch
       keyframes: Keyframe[]; // kept sorted by time
     };
     ```
   - `sampleTrack(track, t): number | null` — evaluates the track at normalized time `t`:
     - empty track → `null` (caller keeps the static value).
     - `t` before first keyframe → first keyframe's value (clamped/hold at edges).
     - `t` after last keyframe → last keyframe's value.
     - between two keyframes → interpolate per the **left** keyframe's `interp`:
       - `linear`: lerp.
       - `hold`: left value until the next keyframe, then jump.
       - `bezier`: cubic-bezier easing between the two keyframes using `handleOut` of the
         left and `handleIn` of the right; default handles (no drag) behave as a smooth
         ease. Solve the cubic for the segment, value-over-time.
   - Pure helpers: `sortKeyframes`, `clampKeyframeTime`, default-handle generation. All
     deterministic and unit-tested.

2. **`src/lib/state/keyframes.svelte.ts`** — `$state` holding the tracks, persisted.
   - Shape: `tracks: Record<string, Track>` keyed by `paramId`.
   - Setters: `ensureTrack(paramId)`, `setTrackEnabled(paramId, on)`,
     `addKeyframe(paramId, { time, value })`, `moveKeyframe(paramId, id, { time?, value? })`
     (re-sorts, clamps time to 0..1), `deleteKeyframe(paramId, id)`,
     `setKeyframeInterp(paramId, id, interp)`, `setKeyframeHandle(paramId, id, which, dxdy)`.
   - Persistence: a `localStorageSync`-backed `$state` mirroring the composition pattern
     (`createPersistedComposition`). Key: `kaleidoscope-keyframes`. Nothing transient to
     strip (all fields are authored data).
   - A read API the clock uses: `sampleParam(paramId, t)` → `number | null` (delegates to
     `sampleTrack` only when the track exists **and** is enabled).

3. **Existing-clock integration** — in `animation.svelte.ts`:
   - Widen the "anything to animate?" gate so the clock starts/runs when there is at least
     one enabled keyframe track (in addition to ring morph targets / driver mode).
   - In `tick`, after `progress` is computed, apply enabled kaleidoscope keyframe tracks:
     for Block 2, `const r = sampleParam('kaleidoscope.globalRotation', progress); if (r !=
     null) setGlobalRotation(r);`. Keep this in a small, named apply function so Block 3 can
     extend it to the other parameters.
   - When playback stops/resets, the parameter returns to its static slider value (apply is
     simply not called while stopped). No change to morph/audio behaviour.

4. **`src/lib/components/TimelinePanel.svelte`** — bottom panel container.
   - Collapse/expand toggle; full width; lives at the bottom of `SidebarInset`.
   - Hosts the ruler + playhead, the track rows, and the Graph Editor toggle.

5. **`src/lib/components/TimelineRuler.svelte`** — time ruler with a draggable **playhead**.
   - Reflects current `progress`; dragging it scrubs (sets elapsed/progress) so the
     designer can position keyframes against a paused frame.

6. **`src/lib/components/TimelineTrack.svelte`** — one property row.
   - Renders keyframes as **diamonds** positioned by `time`; drag horizontally to retime
     (writes `moveKeyframe` time only). Click empty space to add; selected keyframe can be
     deleted and have its interpolation type set.

7. **`src/lib/components/KeyframeGraphEditor.svelte`** — curve view.
   - Plots value over time; keyframes are draggable points (time + value); bezier keyframes
     expose draggable **handles**. Writes `moveKeyframe` and `setKeyframeHandle`.

8. **`src/routes/+page.svelte`** — add `<TimelinePanel />` to the bottom of
   `SidebarInset` (vertical flex: header / main flex-1 / timeline panel).

9. **`src/lib/components/KaleidoscopeSection.svelte`** — add the **stopwatch toggle** for
   `globalRotation` ("anima rotazione globale") that calls `setTrackEnabled`.

### Data flow summary

- Authoring: timeline components write to `keyframes.svelte.ts`.
- Playback: existing clock tick reads `sampleParam` and applies to the kaleidoscope.
- Static: when a track is disabled (or stopped), the Block 1 slider value is used.

## Controls (timeline panel)

- **Panel:** collapse/expand.
- **Transport:** reuses existing play/pause/loop; playhead scrub.
- **Per track:** stopwatch (enable/disable animation), add/delete keyframe, set
  interpolation (linear/bezier/hold).
- **Graph Editor:** toggle; drag points (time+value) and bezier handles.

## What is NOT touched

`bend.ts`, `render-pipeline.ts`, the audio drivers, morph semantics, the Block 1
kaleidoscope engine and rendering, and the existing animation behaviour when no
kaleidoscope keyframe tracks are enabled. The only edit to `animation.svelte.ts` is the
additive start-gate widening + per-tick apply step described above.

## Edge cases & error handling

- **Empty track / disabled track** → `sampleParam` returns `null`; static slider value
  stands.
- **Single keyframe** → constant value at that keyframe for all `t`.
- **`t` outside [firstTime, lastTime]** → clamp to nearest edge keyframe value.
- **Two keyframes at (nearly) the same time** → `moveKeyframe` clamps time to 0..1 and
  keeps the array sorted; sampling is stable (no divide-by-zero; equal times → step to the
  later value).
- **Bezier handle math** → handles clamped so the segment stays a function of time (no
  vertical overhang causing multivalued time); default handles produce a smooth ease.
- **Clock start with only keyframes** → widened gate lets it run; stopping returns the
  parameter to its slider value.
- **No localStorage / SSR** → persistence is a no-op (guarded like
  `createPersistedComposition`).

## Testing strategy

- **Unit (vitest, node):** `keyframes.ts` exhaustively — linear/hold/bezier sampling,
  before-first / after-last clamping, single-keyframe, empty-track (`null`), sorting after
  `moveKeyframe`, time clamping, equal-time stability, default-handle ease shape
  (monotonic, endpoints exact).
- **State (vitest):** `keyframes.svelte.ts` setters — add/move/delete/enable, persistence
  round-trip shape, `sampleParam` gating on `enabled`.
- **Component (vitest, chromium — `*.svelte.spec.ts`):** track row renders diamonds at
  correct positions and a horizontal drag writes a new time; graph editor point drag writes
  time+value; stopwatch toggle writes `setTrackEnabled`; panel collapse. Remember to run
  the **full** chromium suite (composition mock regression).
- **Integration:** clock tick with one enabled `globalRotation` track applies the sampled
  value; disabling the track restores the slider value.
- **Manual live verify:** enable rotation animation; add 2–3 keyframes; set
  linear/bezier/hold; play; confirm the kaleidoscope rotates along the curve; scrub the
  playhead; collapse/expand the panel; reload and confirm keyframes persist.

## Out of scope (Block 3)

- Wiring the remaining kaleidoscope parameters (sectors, repeat, scale, offsets, rotations,
  mask, colors) to the keyframe editor.
- WebM export (reusing `canvas-export.ts`).
- Any change to composition authoring or audio behaviour.

## Open defaults to confirm in the plan

- Default `durationSec` already exists (3s) — keyframe `time` is normalized, so it follows
  the existing duration automatically.
- Default interpolation for a newly added keyframe (proposed: **linear**).
- Default panel state on first load (proposed: **collapsed**, to preserve today's layout).
- Bezier default-handle tangents (proposed: smooth ease ≈ AE "Easy Ease").
- Keyframe time snapping/quantization (proposed: none in Block 2; free drag).
