# Audio-Zones — Full Fidelity to the Old Mandala + Control Simplification

**Date:** 2026-06-18
**Branch:** `feat/kaleidoscope`
**Status:** approved design, ready for implementation plan

## Problem (plain language)

The `audioZones` mode still feels like pudding ("budino") and is buried under too
many sliders (some broken). The designer wants the wave-petals ("petali-onda") to
behave **exactly** like the old p5.js test repo
[`Utop-ia/mandala-bettona`](https://github.com/Utop-ia/mandala-bettona): petals
sit still in silence and snap open toward the canvas edge on the beat. Resizing
the brand mark so the fully-open petals fit the canvas is explicitly allowed.

The brand mark stays the user's authored petal shapes (decided in brainstorming) —
only the *motion* and the *controls* in this one mode change.

## Root causes (why the previous fix didn't land)

1. **Per-frame re-fit cancels the motion (dominant cause).** `render-pipeline.ts`
   calls `fitToView` on every frame (line ~191), rescaling the whole composition
   to the viewport each render. When a petal extends, total bounds grow, the scale
   shrinks to compensate, and the petal *appears* not to grow — pudding. No
   deformation magnitude can survive this. The old repo drew on a fixed canvas and
   let petals reach a fixed edge.
2. **Timid reach.** Deformation is scaled to the petal's small radial extent, not
   to the canvas/ring scale the old repo used (bass reaches `spazioDisponibile`,
   nearly the screen edge).
3. **The Demo source is intrinsically mushy.** `animation.svelte.ts` Demo signal is
   `0.5 + 0.5·sin(...)` per band — a slow smooth wave with no transients, so the
   petals can only ooze. Punch is invisible without a real audio file.
4. **Control sprawl + a real bug.** The mode shows ~10 controls: a broken "Input
   gain" (it reads/writes `audioBars.inputGain`, not zones), 3 band intensities, 6
   attack/release sliders, and a per-ring zones section. The old repo had
   essentially no audio knobs — the response was baked in.

## Goal & scope

In `audioZones` mode only:
- Petals snap open toward the canvas edge on transients and settle in silence,
  matching the old repo's feel.
- The brand mark is auto-sized so fully-open petals fit the canvas.
- Controls reduce to: **audio source**, **play/pause**, and **three band-intensity
  sliders** (bass/mid/treble). Everything else is removed and its dynamics baked
  into code constants.
- The Demo source gains a beat so the snap is visible without a file.

Out of scope: other animation modes, the authored petal shapes, mic/file plumbing,
parametric/generated petals.

This builds on the current branch's already-merged response curve and normalized
`ZoneDrive` (commits up to `1c1273e`); it keeps the threshold response curve and
changes the fit behavior, reach, baked envelopes, controls, and Demo.

## Component 1 — Stable fit (the core fix)

**Behavior:** In `audioZones` mode the render must NOT re-fit to the deformed
bounds each frame. Instead it applies a **fixed scale** derived from the
undeformed (rest) composition, reserving headroom for maximum petal opening, and
re-centers (centering each frame is fine — the flower is radially symmetric).

**Interface (`render-pipeline.ts`):**
- Add optional `fitScale?: number` to `RenderInput`.
  - When `fitScale` is a finite positive number, the finalize phase applies that
    scale to `activeLayer` about its bounds center and sets
    `activeLayer.position = scope.view.bounds.center` — it does NOT call the
    bounds-derived `fitToView`.
  - When `fitScale` is absent, behavior is unchanged (current per-frame
    `fitToView`). All non-audio-zones callers omit it → no regression.
- Export a pure helper to compute the rest scale:
  ```ts
  // Available square side = min(width,height) - 2·padding.
  // restScale = (available · restFraction) / maxRestBoundSide
  // restFraction (< 1) reserves headroom for opening; see Component 3.
  export function computeRestScale(
    maxRestBoundSide: number,
    viewport: { width: number; height: number; padding?: number },
    restFraction: number
  ): number;
  ```

**Controller (`PreviewCanvas.svelte`):** When mode is `audioZones`, measure the
rest composition's bounds once whenever composition/viewport change (render with
zone drive stripped — i.e. an undeformed pass — to read united bounds), compute
`fitScale = computeRestScale(maxRestBoundSide, viewport, REST_FRACTION)`, cache
it, and pass it on every animation frame. Recompute only on
composition/viewport/mode change, not per frame. Other modes pass no `fitScale`.

This is the "resize the mark" mechanism: the mark sits at `REST_FRACTION` of the
frame so opened petals extend into the reserved space toward the edge.

## Component 2 — Baked dynamics (no knobs)

Move the per-band asymmetric attack/release envelope from runtime config to **code
constants in the driver**, using the old repo's values, and keep the existing
threshold→expand response curve (already in `audio-zones-driver.ts`):

```ts
// Old repo p5 sketch values (sketch.js lines 79-81).
const ENVELOPE = {
  bass: { attack: 0.35, release: 0.18 },
  mid: { attack: 0.5, release: 0.25 },
  treble: { attack: 0.8, release: 0.5 }
} as const;
```

The driver reads these constants instead of `deps.getEnvelopes()`. The
`RESPONSE` floors/saturation already present stay as-is. Per-band **intensity**
remains runtime (the three kept sliders) and still multiplies after smoothing.

## Component 3 — Reach / opening magnitude

Petals must open dramatically toward the reserved edge. Keep the existing
extent-relative deformation in `applyZonesToPath` (normalized drive × radial
extent × REACH) but raise the reach so a full-bass hit roughly doubles–triples the
petal length, mirroring the old proportions (bass large; mid 0.6 wide / 0.25 out;
treble 0.5 retract / 0.3 vibrate). Concretely:

- `BASS_REACH` increases from 1.2 to a value that, combined with `REST_FRACTION`,
  makes a full-bass petal reach near the reserved edge. Proposed `BASS_REACH = 2.0`
  with `REST_FRACTION = 0.45` (rest mark fills ~45% of the frame; a 2×-extent
  opening then fills it). Both are single named constants, tuned live in Task "visual".
- `MID_X_REACH`, `MID_Y_REACH`, `TREBLE_RETRACT`, `VIBR_REACH` keep their old-faithful
  ratios (0.6 / 0.25 / 0.5 / 0.3) unless live tuning says otherwise.

`REST_FRACTION` and `BASS_REACH` are the two coupled tuning constants; document the
relationship inline (rest mark + max opening ≈ full frame).

## Component 4 — Controls trimmed

In `AnimationSection.svelte`, the `audioZones` block keeps only:
- **Audio source** dropdown (existing, correctly wired to zones source).
- **Play/pause** + elapsed (existing shared control).
- **Zone intensities (global)**: the three bass/mid/treble sliders.

Remove from the `audioZones` block:
- The broken **Input gain** slider (the one bound to `audioBars.inputGain`).
- The six **Zone response** attack/release sliders.
- The **Zones per ring** section (`RingZoneConfigItem` usage in this block).

## Component 5 — Demo with a beat

Replace the Demo zone signal in `animation.svelte.ts` (~lines 134-136) with a
transient-rich pattern so the snap is visible without a file:
- A periodic kick (~2 Hz) drives a sharp bass spike with fast decay.
- An offbeat hat drives a sharp treble spike.
- Mid gets a moderate spike on the kick.
Each spike is a short exponential-decay pulse (rise to ~1, decay over ~150-250 ms),
clamped 0..1 — NOT a smooth sine. The exact pattern lives in one pure helper so it
is unit-testable (returns `{bass,mid,treble}` for a given time).

## State / type changes

- `AudioZonesConfig`: remove the `envelopes` field (now baked constants). Keep
  `defaultIntensity`.
- `animation.svelte.ts`: remove `setAudioZonesEnvelope`, the `getEnvelopes` driver
  dep, and the envelope defaults. Driver no longer takes `getEnvelopes`.
- `audio-zones-driver.ts`: drop the `getEnvelopes` dep + `Envelopes` type; use the
  `ENVELOPE` constant.
- Per-ring `zoneConfig` (on `Ring`) and `resolveZoneIntensity`'s fallback STAY (the
  driver still resolves to the global default); only the per-ring UI is removed.
- `ZonePreview.svelte` static preview: still valid (uses global intensity); it does
  not depend on envelopes or fit.

## Testing

Unit (vitest), keep the suite green:
- `computeRestScale`: scale = available·restFraction / maxRestBoundSide; padding
  applied; non-finite/zero bound → safe (no NaN/Infinity; return a sane fallback or
  0 handled by caller).
- render-pipeline: with `fitScale` provided, `fitToView` is NOT used and the layer
  is scaled by exactly `fitScale` and centered; without it, current behavior
  unchanged (existing tests stay green).
- driver: envelopes now come from the `ENVELOPE` constant (update/replace the
  envelope tests to assert the baked attack/release; remove `getEnvelopes` from the
  test deps). Response curve + intensity multiply unchanged.
- Demo signal helper: silence-to-spike-to-decay shape — a kick frame yields high
  bass then a lower bass a few frames later (decay), values clamped 0..1, not a
  pure sine (assert a sharp frame-to-frame drop exists).
- `applyZonesToPath`: existing extent-relative tests stay; only the REACH constant
  values change (update expected numbers).

Manual (Task "visual"): `bun run dev` → Audio Zones → Demo shows a clear snap on
the beat; petals open toward the edge without clipping; mark auto-sized. Tune
`REST_FRACTION` / `BASS_REACH` live until it matches the old repo feel. Then mic/file.

## Constraints honored (no regression)

- Only `audioZones` mode changes; Simple / Audio Bars / Data Series untouched.
- Authored petal shapes unchanged; `applyZonesToPath` stays pure.
- `fitScale` is opt-in; absent for all non-audio-zones callers → their fit
  behavior is byte-for-byte unchanged.
- mic/file source plumbing, bend/morph/wave, persistence (`zoneDrive` strip) untouched.
- Package manager bun; `bun run check` must stay 0/0; any Svelte file edited runs
  through the svelte-autofixer MCP tool until clean.

## Out of scope / follow-ups

- Per-ring audio reactivity (removed; can return as an "advanced" toggle later).
- A master sensitivity knob (the three intensity sliders cover gain for now).
- Parametric/generated petals (mark stays the authored shapes).
