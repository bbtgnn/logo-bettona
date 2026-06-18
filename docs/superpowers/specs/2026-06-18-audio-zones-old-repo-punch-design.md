# Audio-Zones Reactivity — Port Old-Repo Punch

**Date:** 2026-06-18
**Branch:** `feat/kaleidoscope`
**Status:** approved design, ready for implementation plan

## Problem

The `audioZones` animation mode feels like pudding ("budino") — petals hover at a
constant medium deformation regardless of the audio, with no transient snap. The
user wants the reactivity to feel like the old p5.js sketch
[`Utop-ia/mandala-bettona`](https://github.com/Utop-ia/mandala-bettona), where
petals stay still in silence and punch out hard on transients.

**Scope is narrow:** only the *behavior* in `audioZones` mode changes. The petal
shapes (authored template paths / the user's logo art) stay exactly as they are.
No other animation mode is touched.

## Diagnosis — why the current mode is mush

Compared the running tool against the old sketch's `renderMandala` (sketch.js
~lines 501–650). Three real differentiators (one earlier suspicion was wrong):

1. **No threshold-floor + expand mapping (the dominant fault).** The old sketch
   maps each band through `map(smoothBand, floor, sat, 0, push, true)` with
   floors/saturation on the 0–255 FFT scale (bass 60, mid 50, treble 70,
   saturation 220). Below the floor the band contributes **zero** deformation;
   above saturation it pins to the maximum. The tool feeds the raw normalized
   band (`reduceToZones` → `bandAvg` mean ÷255 ×gain, 0–1) straight into the
   envelope, so ambient/low signal always produces a medium push and loud signal
   never reaches an extreme → permanent medium = budino.

2. **Push magnitudes too small and flat.** `ZONE_SCALE = 30` template units,
   fixed. The old sketch's pushes are **space-relative**: bass reaches up to
   `spazioDisponibile` (screen edge − current outer radius, i.e. hundreds of px),
   mid/treble are fractions of that or of `currR`. Proportionally huge vs the
   petal; the tool's flat 30 is tiny.

3. **Generic anchor mapping (minor).** `applyZonesToPath` sorts anchors by Y and
   assigns outer→bass, inner→treble, middle→mid. Reasonable, but on an arbitrary
   authored path it does not crisply hit "tip / widen / base" the way the old
   sketch's named control radii (x1..x4, y2, y3) do. Expected to be adequate once
   the thresholded, space-relative pushes are large; flagged as a refinement.

**Corrected non-fault:** double-smoothing was *not* the problem. The old sketch
also used `p5.FFT(0.8, 256)` — identical analyser smoothing on top of its lerp
envelope. So `analyser.smoothingTimeConstant` is left as-is.

The per-band asymmetric attack/release envelope already exists in the driver
(`envelope()`), so it is reused, not rebuilt.

## Architecture

Zone deformation runs in **template space** in
`render-pipeline.ts` (~line 164), *before* `buildRingPath` scales the template to
the ring radius. In template space the **Y axis is radial** (lower Y = outer tip,
higher Y = inner base — per the existing `zones.ts` comment). This lets pushes be
expressed relative to the petal's own radial extent, making them proportionally
large and shape-independent.

Two units change; responsibilities stay separated:

- **`audio-zones-driver.ts`** — audio → numbers. Owns the response curve and the
  existing envelope. Emits a `ZoneDrive` of **normalized 0..1** pushes.
- **`zones.ts`** — numbers → geometry. Owns the petal radial extent and the
  REACH constants; converts normalized pushes into actual coordinate deltas and
  applies them. Stays pure (no input mutation).

### Data flow per band, per frame

```
raw band (0..1, from readZones)
  → respond(raw, floor, sat)        // threshold-floor + expand, fixed consts
  → envelope(prev, x, attack/release) // existing asymmetric smoothing
  → × ring zone intensity (cfg.bass/mid/treble)
  → normalized push in ZoneDrive (0..1-ish)
zones.ts:
  → × radialExtent × REACH constant  // space-relative magnitude
  → applied to structural anchors (Y-sort: outer/middle/inner)
```

## Component 1 — Response curve (driver)

New pure helper:

```ts
function respond(raw: number, floor: number, sat: number): number {
  if (sat <= floor) return 0;
  return clamp01((raw - floor) / (sat - floor));
}
```

Applied to each raw band **before** `envelope()`. Fixed constants, ported from the
old sketch's 0–255 thresholds divided by 255:

| band   | floor | sat   |
| ------ | ----- | ----- |
| bass   | 0.235 | 0.863 |
| mid    | 0.196 | 0.863 |
| treble | 0.275 | 0.863 |

Defined as named constants in the driver (e.g. `RESPONSE = { bass: {floor, sat}, … }`).

Result: silence (band < floor) → 0 → no deformation (still petals). Transients
that clear the floor snap upward; the envelope's fast attack / slow release then
shapes the punch-and-decay.

## Component 2 — Magnitude (zones.ts)

Remove the flat `ZONE_SCALE = 30`. Compute the petal's radial extent once per
call from the path's Y range:

```ts
radialExtent = maxY − minY   // over all anchor Y coords; 0 → no-op
```

`ZoneDrive` fields now carry **normalized** pushes (0..1). zones.ts converts them
to coordinate deltas via `radialExtent × REACH`:

| field           | gesture                              | constant            | value |
| --------------- | ------------------------------------ | ------------------- | ----- |
| `bassPush`      | outer tip outward (−Y)               | `BASS_REACH`        | 1.2   |
| `midPush` (X)   | widen tangentially (+X)              | `MID_X_REACH`       | 0.6   |
| `midPush` (Y)   | slight radial out (−Y)               | `MID_Y_REACH`       | 0.25  |
| `trebleRetract` | inner tip inward (+Y)                | `TREBLE_RETRACT`    | 0.5   |
| `trebleVibrate` | tangential jitter (±X)               | `VIBR_REACH`        | 0.3   |

REACH values mirror the old sketch's fractions (0.6 / 0.25 / 0.5 / 0.3); bass is
large (≈ a full petal-length) to match `spazioDisponibile`. All multiply
`radialExtent`, so magnitude scales with petal size. Tunable later if a band
reads too soft/strong.

## Component 3 — Structural mapping

Keep the existing Y-sort assignment in `applyZonesToPath`:
outermost anchor → bass, innermost → treble, middle anchors → mid. With the new
large, thresholded, extent-relative pushes this is expected to recover the old
gesture. If manual review still reads soft, refine to map by radial distance from
the petal center rather than raw Y-sort — listed as a follow-up, not in this scope.

## Component 4 — Treble vibration

Unchanged mechanism: fixed `VIBR_FREQ = 8 Hz`, phase = `sin(2π·f·t)`. Amplitude
becomes extent-relative: `treble01 × VIBR_REACH × radialExtent × phase`.

## Testing

Unit (vitest), all current 232 tests must stay green:

- `respond()` — below floor → 0; at/above sat → 1; midpoint → ~0.5; `sat ≤ floor`
  guard → 0; non-finite → 0.
- `zones.ts` magnitude — pushes scale with `radialExtent` (double the extent →
  double the delta); each band moves the correct anchor in the correct direction
  (bass −Y outer, mid +X / −Y middle, treble +Y inner + signed X jitter); zero
  drive → unchanged path; purity (input not mutated).
- driver pipeline — order is respond → envelope → intensity; silence input
  produces zero drive; sustained loud input converges toward the REACH-scaled max.

Manual: `bun run dev` → Animation = Audio Zones → source Demo/mic/file. Expect
still petals in silence, hard multi-axis snap on transients, per-band decay.

## Constraints honored (no regression)

- Geometry only — no colour/brightness/scale coupling.
- Change confined to `audioZones` mode; other modes untouched.
- Petal shapes (authored template paths) unchanged.
- Envelopes stay global per-band; per-ring config stays intensity-only.
- `applyZonesToPath` stays pure.
- `audio-source.ts`, `render-pipeline.ts` slot, bend/morph/wave untouched.
- No new UI (fixed constants per user decision).

## Out of scope / follow-ups

- Exposing thresholds or REACH as sliders.
- Radial-centroid structural mapping (only if Y-sort reads soft after review).
- Parametric petal mode (user explicitly kept authored shapes).
