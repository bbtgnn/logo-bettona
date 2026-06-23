# Design — Timeline trimming (In/Out points) + keyframable morphT

**Date:** 2026-06-23
**Branch:** `feat/kaleidoscope`
**Status:** approved, ready for plan

## Goal

Move the animation system two steps closer to an After-Effects-style timeline:

1. **Temporal trimming** — let a keyframe track be active only on a sub-range `[inPoint, outPoint]` instead of always covering the whole `0..1` timeline, with draggable handles on the timeline lane.
2. **Keyframable `morphT`** — promote each ring's morph parameter from a procedural linear ramp (the `simple` driver) to a real keyframable `AnimatableParam`. Creating a morph target auto-seeds a default `0 → 1` bezier-eased track, preserving today's look while making it editable and scrubbable. The `simple` driver is removed.

Hard rule throughout: keep the separation between **pure math** (`$lib/animation/*`) and **reactive state** (`$lib/state/*`). Geometry state (`composition.ts`) stays free of keyframe concerns.

---

## Task 1 — Temporal trimming (In/Out points)

### 1.1 Pure math — `src/lib/animation/keyframes.ts`

Extend the `Track` type with two optional normalized fields:

```ts
export type Track = {
	paramId: string;
	enabled: boolean;
	keyframes: Keyframe[];
	inPoint?: number;   // normalized 0..1; track inert before this time
	outPoint?: number;  // normalized 0..1; track inert after this time
};
```

`sampleTrack(track, t)` gains a leading guard, before the existing keyframe logic:

```ts
if (track.inPoint != null && t < track.inPoint) return null;
if (track.outPoint != null && t > track.outPoint) return null;
```

- Comparison is **strict** (`<` / `>`): at exactly `inPoint` or `outPoint` the track samples normally.
- Returning `null` means "this track does not contribute at this time" — identical to the disabled/empty path, so `applyKeyframes` leaves the static slider value in place. No special casing downstream.
- Undefined `inPoint`/`outPoint` ⇒ full-range behavior (back-compatible with every existing persisted track).

### 1.2 Reactive state — `src/lib/state/keyframes.svelte.ts`

Add two methods to the `keyframes` store:

```ts
setTrackInPoint(paramId: string, v: number)   // clamp01(v); if outPoint set, clamp to <= outPoint
setTrackOutPoint(paramId: string, v: number)  // clamp01(v); if inPoint set, clamp to >= inPoint
```

- Both call `track(paramId)` (auto-creates the track if missing, like the existing setters).
- The reciprocal clamp keeps `inPoint <= outPoint` invariant no matter which edge is dragged.
- Persistence is automatic: `localStorageSync` serializes the whole `state.tracks`, so the new fields round-trip with no extra wiring.

### 1.3 UI — `src/lib/components/TimelineTrack.svelte`

The track lane (`rowEl`, full width = time `0..1`) gains trim handles:

- Read `inPoint` (default `0`) and `outPoint` (default `1`) from `keyframes.tracks[paramId]`.
- **Dim overlays** on `[0, inPoint]` and `[outPoint, 1]`: muted, `pointer-events-none`, positioned via `xFromTime`. They make the trimmed-away span visually obvious.
- **Two draggable handle bars** at `xFromTime(inPoint)` and `xFromTime(outPoint)`: thin vertical grips, `cursor-ew-resize`, `data-testid="trim-in-{paramId}"` / `trim-out-{paramId}`, `aria-label` from new i18n keys. They reuse the same pointer-capture drag pattern as the keyframe diamonds (`setPointerCapture` on down, move → setter, up → release), and `stopPropagation` so they don't trigger the lane's double-click-to-add-keyframe.
- Drag In → `keyframes.setTrackInPoint(paramId, timeFromX(...))` then `refreshPreview()`. Drag Out → `setTrackOutPoint` symmetrically.
- Keyframe diamonds stay rendered **on top** and remain draggable across the full lane. A keyframe placed outside `[inPoint, outPoint]` simply stops contributing (it isn't deleted) — matching AE clip semantics.

No change to `timeline-geometry.ts`: `xFromTime`/`timeFromX` already map normalized time ↔ lane pixels.

---

## Task 2 — Keyframable `morphT`

### 2.1 Pure builder — `src/lib/state/animatable-params.ts`

New `buildRingMorphParams`, structurally mirroring `buildRingWaveParams` (dynamic, per-live-index, built fresh each call):

```ts
export function buildRingMorphParams(
	rings: Ring[],
	deps: {
		setMorphT: (index: number, v: number) => void;
		ringLabel: (index: number) => string;
	}
): AnimatableParam[]
```

- Emits a param **only** for rings where `ring.secondaryTemplatePath != null` (a morph target exists) — the exact gating pattern of `buildRingWaveParams` (`if (ring.waveConfig == null) return;`).
- One param per qualifying ring:
  - `id: "ring.${index}.morphT"`
  - `label: "${ringLabel(index)} · morph"` (literal suffix, matching the existing `· crests` / `· amplitude` style — those suffixes are not i18n'd)
  - `min: 0, max: 1, step: 0.01`
  - `get: () => rings[index].morphT`
  - `set: (v) => deps.setMorphT(index, v)`

### 2.2 Registry wiring — `src/lib/state/animation.svelte.ts`

In `getAllAnimatableParams()`, append:

```ts
...buildRingMorphParams(composition.rings, {
	setMorphT: setRingMorphT,
	ringLabel: (i) => m.editor_ring_label({ index: i + 1 })
})
```

`setRingMorphT` is already imported. No change to `applyKeyframes` — it already walks every param from `getAllAnimatableParams()` and applies the sampled value. The morph param therefore:
- shows up as a timeline lane once its track is armed,
- is driven every frame while playing,
- becomes **scrubbable** when paused (via `scrubTo`/`refreshPreview` → `applyKeyframes`), which it never was before.

### 2.3 Auto-seed on morph creation — `src/lib/state/animation.svelte.ts`

The "create morph" policy ("a morph *is* keyframes") lives in the animation orchestration layer, not in `composition.ts` (which stays pure geometry state). Add two wrappers:

```ts
export function createRingMorph(index: number): void {
	createRingMorphTarget(index);                 // composition.ts (unchanged)
	const id = `ring.${index}.morphT`;
	keyframes.ensureTrack(id);
	keyframes.setTrackEnabled(id, true);
	keyframes.addKeyframe(id, { time: 0, value: 0, interp: 'bezier' });
	keyframes.addKeyframe(id, { time: 1, value: 1, interp: 'bezier' });
	refreshPreview();
}

export function removeRingMorph(index: number): void {
	removeRingMorphTarget(index);                 // composition.ts (unchanged)
	keyframes.deleteTrack(`ring.${index}.morphT`); // new store method
	refreshPreview();
}
```

- Bezier easing: `addKeyframe` already initializes `handleOut = EASY_EASE_OUT` and `handleIn = EASY_EASE_IN`. The single `0 → 1` segment reads `a.handleOut` (first kf, ease-out) and `b.handleIn` (last kf, ease-in), so passing `interp: 'bezier'` is sufficient for the eased default — no extra handle plumbing.
- `keyframes.svelte.ts` gains a small `deleteTrack(paramId)` method (`delete state.tracks[paramId]`) so removing a morph target leaves no orphan track behind.
- `RingMorphConfigItem.svelte` is rewired to call `createRingMorph` / `removeRingMorph` instead of the bare `composition` functions.

### 2.4 Remove the `simple` driver

`simple-driver` existed only to push `morphT` each frame; that job is now the keyframe track's. Remove it cleanly:

- Delete `src/lib/state/animation-drivers/simple-driver.ts` and its `.spec.ts`.
- In `animation.svelte.ts`: drop the `createSimpleDriver` import and its `runtime.registerDriver('simple', …)` block.
- Remove `'simple'` from the `AnimationLayer` union, from `animationState.layers`, from `syncActiveDrivers`, and from the `setLayerEnabled` driver-sync branch.
- The `runtime` (and its `applyRingT` dep → `setRingMorphT`) stays: the audio drivers still register on it. Their `frame()` returns `{}` (they apply effects directly), so `applyRingT` is simply never invoked now — harmless, no signature change.
- `applyMorphT(0)` / `getMorphRingIndices` / `animatedIndices` bookkeeping stays: stop-zeroing morph rings is still valid and independent of the removed driver.

The shared timeline clock (`durationSec` / `loop` / `alternate` / `fps` in `getProgressFromElapsed`) is untouched — it never depended on the simple driver.

### 2.5 Rename the sidebar section — `src/lib/components/SimpleSection.svelte`

- Remove the `layer-toggle-simple` checkbox (and its `setLayerEnabled('simple', …)` handler) — the layer no longer exists.
- Rename the section heading from "Simple" to **"Morph"**: replace the `m.animate_layer_simple()` trigger with a new `m.animate_layer_morph()` key, added to **both** `messages/en.json` and `messages/it.json` (messages-parity test enforces equal key sets).
- The per-ring `RingMorphConfigItem` list stays — it is the home of the morph config + preview shipped earlier.
- Filename can stay `SimpleSection.svelte` to keep the diff focused (rename is cosmetic; optional follow-up).

---

## Data flow (after both tasks)

```
tick(nowMs)
  └─ runtime.tick(elapsed)         // audio drivers write wave/zone directly; return {}
  └─ applyKeyframes(progress)      // walks getAllAnimatableParams():
                                   //   kaleido + audio + per-ring wave + per-ring morphT
                                   //   each: v = sampleParam(id, progress); if v !== null → set(v)
```

`sampleParam → sampleTrack` now also honors `inPoint`/`outPoint`. `morphT` is driven exclusively by its keyframe track. No procedural writer competes for it, so there is no ordering conflict.

Scrubbing / paused edits go through the same `applyKeyframes`, so trimming and morph both respond live to the playhead.

---

## Testing

**Unit — `keyframes.spec.ts`**
- `sampleTrack` with `inPoint`/`outPoint`: `t` inside range samples normally; `t` exactly at `inPoint`/`outPoint` samples (not null); `t` strictly outside → `null`; undefined bounds → unchanged full-range behavior.

**Unit — `keyframes.svelte.ts` (via existing state spec)**
- `setTrackInPoint`/`setTrackOutPoint`: clamp01; reciprocal clamp keeps `in <= out` when either edge crosses the other.
- `deleteTrack` removes the track entry.

**Unit — `animatable-params.spec.ts`**
- `buildRingMorphParams`: emits a param only for rings with `secondaryTemplatePath`; correct `id`/range; `get` reads `morphT`; `set` calls `setMorphT` with the right index.

**Unit — animation integration (node-safe)**
- `createRingMorph` arms the track and seeds two bezier keyframes (`0→0`, `1→1`); `removeRingMorph` deletes the track.

**Component — `TimelineTrack.svelte.spec.ts`** (real browser; Tailwind inert ⇒ assert structure/testids/handler calls, not pixel geometry)
- In/Out handles render with their testids; pointer-drag invokes `setTrackInPoint`/`setTrackOutPoint`.

**Component — `SimpleSection.svelte.spec.ts`**
- No `layer-toggle-simple` checkbox; heading reads the new "Morph" message; per-ring items still render.

**Gates:** `bun run check` 0/0, full unit suite green, e2e 6/6, Svelte `svelte-autofixer` → `issues: []` on every changed `.svelte` / `.svelte.ts`.

---

## Known limits (out of scope, deferred)

- **Index-keyed ring params.** `buildRingMorphParams` keys tracks by live ring index, exactly like `buildRingWaveParams`. Adding/removing rings can misalign existing morph/wave tracks against the new index order. Pre-existing limitation; not addressed here.
- **No trim snapping.** Trim handles drag to any normalized time (no frame snapping). Could later reuse `snapProgressToFps` with a Shift modifier, mirroring the playhead.
- **`SimpleSection.svelte` filename** retained despite the "Morph" rename, to keep the diff small.
