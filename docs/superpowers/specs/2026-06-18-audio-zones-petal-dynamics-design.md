# Audio Zones — Petal Dynamics Redesign

**Date:** 2026-06-18
**Status:** Approved design, ready for plan

## Problem

In `audioZones` animation mode the petals react to sound in a flat, lifeless
way. The current pipeline maps each frequency band to a single linear
translation:

```
push = level × intensity × ZONE_SCALE
```

`readZones()` is smoothed only by the Web Audio analyser's symmetric
`smoothingTimeConstant`, identical for every band. Two consequences:

1. **No transient punch.** A symmetric smoothing constant cannot make petals
   snap on a kick/transient and decay softly afterwards. Motion lags and feels
   mushy.
2. **Poor shape variety.** Each band performs exactly one anchor translation
   (bass tip out, mid widen, treble bob), so the petal silhouette barely
   changes character across the spectrum.

A previous p5.js sketch (`Utop-ia/mandala-bettona`) feels alive because of two
techniques this redesign ports:

- **Per-band attack/release envelopes** (its "FIX A"): asymmetric smoothing per
  band — fast attack + fast release on bass = punchy; fast attack + slow
  release on treble = shimmer that lingers.
- **Multi-axis deformation per band**: bass extends the tip, mid widens the body
  on two axes, treble retracts the inner point and vibrates the flanks.

## Goals

- Petals snap on transients and release with a per-band feel (punch).
- Each band deforms the petal on multiple axes/points (rich deformation).
- **Geometry only.** No colour, brightness, scale, or stroke coupling.
- Per-band envelope **attack + release exposed as global UI sliders**.

## Non-Goals

- No idle/at-rest morphing (petals may be still in silence).
- Treble vibration stays a **fixed frequency** — not scaled by treble energy.
- No change to `audio-source.ts`, the bend/morph/tile pipeline, or per-ring
  template authoring.
- Envelopes are **global**, not per-ring. Per-ring config keeps intensity only.

## Architecture

Data flow keeps its current shape; one new stateful step (envelope) sits inside
the driver, and the geometry step gains axes:

```
readZones() raw
  → DRIVER  (new: per-band envelope state, smoothed level)
  → ZoneDrive  (extended: 4 fields)
  → setRingZoneDrive  (transient ring.zoneDrive)
  → render-pipeline  → applyZonesToPath (enriched)
  → render
```

`audio-source.ts` is untouched. The driver envelope sits on top of the existing
`readZones()` output; the mild Web Audio pre-smoothing is left in place.

## Components

### 1. Envelope (driver) — `audio-zones-driver.ts`

The driver becomes stateful. It holds a smoothed level per band and applies an
asymmetric per-frame lerp:

```
smoothed[b] = lerp(smoothed[b], raw[b], raw[b] > smoothed[b] ? attack[b] : release[b])
```

- Rising input uses `attack`; falling uses `release`. Asymmetry produces the
  punch.
- Envelope coefficients come from a new dependency `getEnvelopes()`.
- `init()` zeroes the smoothed state. `dispose()` keeps clearing each ring's
  drive (as today).

**Frame-rate assumption:** the lerp coefficients are per-frame, matching the
source sketch (which ran at a fixed 30fps). This codebase drives frames from
`requestAnimationFrame` (~60fps, steady). We keep per-frame lerp for simplicity
and document the assumption inline. No `dt` normalisation in this iteration.

Default envelope coefficients (ported from the source sketch's FIX A):

| Band   | attack | release |
| ------ | ------ | ------- |
| bass   | 0.35   | 0.18    |
| mid    | 0.50   | 0.25    |
| treble | 0.80   | 0.50    |

### 2. Enriched deformation — `zones.ts`

`ZoneDrive` grows from three to four fields:

```ts
export type ZoneDrive = {
  bassPush: number;      // outermost: radial-out magnitude
  midPush: number;       // middle: drives tangential + radial (ratio internal)
  trebleRetract: number; // innermost: steady inward magnitude
  trebleVibrate: number; // innermost: signed tangential oscillation
};
```

`applyZonesToPath` keeps the Y-sorted anchor grouping (outer → inner). Per
group:

- **bass** (outermost anchor): `dy = -bassPush` — tip radially outward.
  *(unchanged)*
- **mid** (middle anchors): `dx = +midPush` (tangential widen) **and**
  `dy = -midPush * MID_RADIAL_RATIO` (slight radial push). `MID_RADIAL_RATIO`
  is a module constant ≈ `0.4`.
- **treble** (innermost anchor): `dy = +trebleRetract` (inward toward centre)
  **and** `dx = trebleVibrate` (signed tangential jitter).

Handles continue to follow their anchor by the same vector. The function stays
pure. The all-zero early-return guard updates to check all four fields.

The `trebleVibrate` **sign and oscillation** are produced in the driver, not in
`applyZonesToPath`:

```
trebleVibrate = smoothed.treble * VIBR_AMT * Math.sin(2π · VIBR_FREQ · nowSec)
```

`VIBR_AMT` and `VIBR_FREQ` are driver constants. This replaces the current
global `SHIMMER` sine. Amplitude scales with treble level; frequency is fixed.

`trebleRetract` is the steady (non-oscillating) part:
`smoothed.treble * cfg.treble * ZONE_SCALE`.

`ZONE_SCALE` is unchanged. `bassPush` / `midPush` keep
`smoothed[band] * cfg[band] * ZONE_SCALE`.

### 3. Types / state / defaults — `types.ts`, `animation.svelte.ts`

- `types.ts`:
  - `EnvelopeParams = { attack: number; release: number }`.
  - `AudioZonesConfig` gains
    `envelopes: { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams }`.
  - `ZoneDrive` extended as above.
- `animation.svelte.ts`:
  - `defaultAudioZonesConfig.envelopes` set to the FIX A table above.
  - New setter `setAudioZonesEnvelope(band, partial)` mirroring the existing
    `setAudioZonesDefaultIntensity` pattern (immutable update).
  - Driver deps gain `getEnvelopes: () => animationState.audioZones.envelopes`.
- Persistence: `envelopes` is config, so it persists alongside
  `defaultIntensity`. `ring.zoneDrive` stays transient and already stripped — no
  change needed there.

### 4. UI — `AnimationSection.svelte`

Below the existing "Zone intensities (global)" block, add a
**"Zone response (global)"** block. For each band (bass / mid / treble) two
range sliders: **attack** ("scatto") and **release** ("rilascio"), each
`0..1`, `step 0.01`, wired to `setAudioZonesEnvelope`. Six sliders total.

`RingZoneConfigItem.svelte` is unchanged — per-ring stays intensity-only.

### 5. Preview — `ZonePreview.svelte`

`ZonePreview` builds a static max-drive `ZoneDrive` to show the deformation
envelope in the config UI. Update it to the new four-field shape: set
`trebleRetract` and `trebleVibrate` to representative static values (e.g.
`treble * ZONE_SCALE` and `treble * ZONE_SCALE * VIBR_AMT`) so the preview shows
both retraction and vibration spread. No animation in the preview.

## Testing

- **`zones.spec.ts`** — `applyZonesToPath`:
  - mid anchors move on both X and Y (tangential + radial).
  - innermost anchor moves inward by `trebleRetract` and tangentially by
    `trebleVibrate`.
  - all-zero (four fields) early return preserved.
  - handles follow their anchors.
- **`audio-zones-driver.spec.ts`**:
  - rising input ramps `smoothed` at `attack` rate; falling input decays at
    `release` rate (assert asymmetry).
  - `trebleVibrate` sign follows `sin(2π·VIBR_FREQ·t)` for a given `nowMs`.
  - `init()` resets smoothed state; `dispose()` clears every ring's drive.
- Update existing specs that construct/assert the old three-field `ZoneDrive`.

## Blast Radius

`types.ts`, `animation.svelte.ts`, `audio-zones-driver.ts`, `zones.ts`,
`AnimationSection.svelte`, `ZonePreview.svelte`, plus their specs.
`audio-source.ts`, `render-pipeline.ts`, bend/morph untouched.
</content>
</invoke>
