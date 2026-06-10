# Audio Zones — Design Spec

**Date:** 2026-06-10  
**Branch:** `feat/add-audiozones` (to be cut from `feat/add-audioreactive` or `main` after PR merges)  
**Status:** Approved, ready for implementation plan

---

## Overview

Add a new animation mode `audioZones` alongside the existing `audioBars` mode. The two modes are independent and switchable via the mode dropdown. `audioBars` and all its logic are untouched.

Instead of rippling the path with a single wave, `audioZones` deforms the authored bezier curve on three zones — each tied to an audio frequency band and a distinct gesture. The deformation rides the primary ring shape (morph ignored). `bend.ts` is not touched: deformation applied before mirror/tile → 8-way symmetry automatic.

---

## Constraints

- Do not touch `audioBars`, `applyWaveToPath`, `bend.ts`, `simple` driver, `dataSeries` driver.
- No new dependencies.
- Backward compatibility: rings without `zoneConfig`/`zoneDrive` render unchanged. On reload, mark is at rest (no frozen deformation). Saved compositions load identically.
- All 176 existing unit tests stay green.
- `lint`/typecheck clean; `svelte-autofixer` passes on all `.svelte` files.

---

## Coordinate System (confirmed from `bend.ts`)

Template space: X → angle (tangential), Y → radius.  
Lower Y = outer (far from center). Higher Y = inner (close to center).

- "Radial outward" = subtract from Y (`dy = -bassPush`)
- "Tangential widen" = add to X (`dx = +midPush`); `bend.ts` mirror handles opposite side

---

## Section 1: Geometry

**New file:** `src/lib/geometry/zones.ts`

```ts
export type ZoneDrive = { bassPush: number; midPush: number; treblePush: number };

export function applyZonesToPath(path: Path, drive: ZoneDrive): Path
export function resolveZoneIntensity(ring: Ring, def: ZoneIntensity): ZoneIntensity
```

### Anchor identification

Parse `cmds`/`crds` once to collect on-curve anchors with handle indices:

| Command | Anchor coords | Entry handle | Exit handle |
|---------|--------------|--------------|-------------|
| `'M'`   | +0,+1        | none         | cp1 of next `'C'` |
| `'L'`   | +0,+1        | none         | cp1 of next `'C'` |
| `'C'` (6 coords: cp1x,cp1y,cp2x,cp2y,x,y) | +4,+5 | +2,+3 (cp2) | cp1 of next `'C'` (+0,+1) |
| `'Z'`   | none         | —            | — |

### Zone assignment (anchors sorted ascending by Y)

| Position | Band   | Gesture                                      | Delta            |
|----------|--------|----------------------------------------------|------------------|
| Lowest Y (outermost) | Bass   | Extend radially outward (petal tip reaches)  | `dy = -bassPush` |
| Middle(s) | Mid    | Widen tangentially (body fattens)             | `dx = +midPush`  |
| Highest Y (innermost) | Treble | Radial bobbing (shimmer near center)         | `dy = +treblePush` (sign oscillates from driver) |

**N ≠ 3 rule:** innermost → treble, outermost → bass, all intermediate → mid.  
N=1: single anchor is both outermost and innermost; bass wins (only bass applied).  
N=2: outermost=bass, innermost=treble, no mid.

### Handle translation

For each moved anchor, translate both its entry handle and exit handle by the same `(dx, dy)` vector. Keeps curve smooth — no kinks.

### Pure function contract

- All pushes = 0 → output path byte-identical to input
- Never mutates input path
- `crds` length and `cmds` array unchanged

---

## Section 2: Data Model

**Additions to `src/lib/types.ts`:**

```ts
export type ZoneIntensity  = { bass: number; mid: number; treble: number };
export type ZoneDrive      = { bassPush: number; midPush: number; treblePush: number };
export type AudioZonesConfig = { defaultIntensity: ZoneIntensity };
```

**`Ring` new fields:**

```ts
zoneConfig?: ZoneIntensity | null;  // persisted; null = inherit global default
zoneDrive?:  ZoneDrive     | null;  // transient; stripped from persistence
```

**`AnimationMode`:** add `'audioZones'` to union.

**`AnimationState`:** add `audioZones: AudioZonesConfig` alongside `audioBars`.

**Default global intensities:** `{ bass: 0.5, mid: 0.5, treble: 0.5 }` (balanced starting point).

**Persistence (`composition-persistence.svelte.ts`):**  
Rename `stripWave` → `stripTransients`. Strip both `ring.wave` and `ring.zoneDrive` before save. `ring.zoneConfig` and `animationState.audioZones` persist normally.

---

## Section 3: Driver + Audio Source

**`readZones()` on existing audio source:**  
Small new method on the shared audio source; reads 3 perceptual bands from the existing `AnalyserNode` (no new node). Returns `{ bass, mid, treble }` each 0..1, smoothed via existing smoothing infrastructure.

Frequency splits:
- Bass: ~20–300 Hz
- Mid: ~300–2000 Hz  
- Treble: ~2000–20000 Hz

**New file `src/lib/state/animation-drivers/audio-zones-driver.ts`:**

```ts
const SHIMMER_FREQ = 8;  // Hz — treble bobbing frequency; promote to slider later if needed
const SCALE = 30;        // px push at intensity=1, level=1; tune empirically

// frame(nowMs):
//   { bass, mid, treble } = audioSource.readZones()
//   for each ring:
//     cfg = resolveZoneIntensity(ring, animationState.audioZones.defaultIntensity)
//     ring.zoneDrive = {
//       bassPush:   bass   * cfg.bass   * SCALE,
//       midPush:    mid    * cfg.mid    * SCALE,
//       treblePush: treble * cfg.treble * SCALE
//                   * Math.sin(2 * Math.PI * SHIMMER_FREQ * nowMs / 1000),
//     }

// dispose():
//   all rings → ring.zoneDrive = null
```

Registered in driver registry alongside `audioBars`/`simple`/`dataSeries`.

**`render-pipeline.ts`** — insertion after morph block, before `buildRingPath`, same slot as wave:

```ts
if (mode === 'audioZones' && ring.zoneDrive) {
  effectivePath = applyZonesToPath(effectivePath, ring.zoneDrive);
}
```

`ignoreMorph` flag: extend to activate when `mode === 'audioZones'` (same as `audioBars`).

---

## Section 4: UI

**`AnimationSection.svelte`:**
- Add `<option value="audioZones">Audio Zones</option>` to mode dropdown
- New `{#if animationState.mode === 'audioZones'}` block:
  - Three global sliders: Bass / Mid / Treble intensity (0–1), bound to `animationState.audioZones.defaultIntensity`
  - Per-ring accordion using `RingZoneConfigItem`
- `morphInactive` extended: `mode === 'audioBars' || mode === 'audioZones'`

**New `src/lib/components/RingZoneConfigItem.svelte`:**
- Accordion per ring (ring name + color chip, collapse toggle)
- "Customize" toggle:
  - On → shows bass/mid/treble sliders seeded from global default, sets `ring.zoneConfig`
  - Off → `ring.zoneConfig = null` (inherits global)
- Inline `ZonePreview`

**New `src/lib/components/ZonePreview.svelte`:**
- Layer 1 (rest): `ring.templatePath` → `buildRingPath`, crisp stroke
- Layer 2 (reach): `applyZonesToPath(templatePath, maxDrive)` where `maxDrive = { bassPush: cfg.bass * SCALE, midPush: cfg.mid * SCALE, treblePush: cfg.treble * SCALE }` — translucent fill
- Static (no rAF — treble shimmer is driver-side; preview shows max radial extent)
- Redraws reactively when `ring.templatePath` or intensities change

**`RingEditor.svelte`:** no new changes (morphInactive extension handled in AnimationSection).

---

## Section 5: Testing

### `src/lib/geometry/zones.spec.ts` (new)

- `push=0` → output byte-identical to input (all coords unchanged)
- `bassPush=N` → outermost anchor Y − N, entry+exit handles Y − N, others unchanged
- `midPush=N` → middle anchor X + N, handles follow, others unchanged
- `treblePush=N` → innermost anchor Y + N, handles follow, others unchanged
- `cmds` array and `crds.length` unchanged after any call
- N=1: bass applied to sole anchor
- N=2: bass on outermost, treble on innermost, mid skipped

### Driver + model tests

- `resolveZoneIntensity`: ring with `zoneConfig` → returns it; ring with `null` → returns default
- Driver `frame()`: writes `zoneDrive` with correct scaling per ring
- Driver `dispose()`: all rings have `zoneDrive === null`

### Persistence tests (extend existing spec)

- `ring.zoneDrive` absent from serialized output
- `ring.zoneConfig` present in serialized output
- `animationState.audioZones.defaultIntensity` present in serialized output

---

## Suggested Build Order

1. `applyZonesToPath` + tests — riskiest, validate geometry first
2. Data model + driver + mode option + global sliders only — see it move in browser
3. Per-ring accordion + `ZonePreview` — per-ring override + preview envelope

---

## Acceptance Criteria (visual/auditory)

Select "Audio Zones": deformation starts from authored curve. On bass, tip extends radially. On mid, body widens. On treble, inner point shimmers while center stays fixed. Full signal activates all three gestures simultaneously. Customize one ring — only that ring changes. Reload → overrides persist, mark at rest. Switch to `audioBars` → original wave identical to before.
