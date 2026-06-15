# Per-ring static rotation — design

Date: 2026-06-15
Status: approved (pending spec review)

## Summary

Add the first user-configurable kaleidoscope knob: a **static per-ring rotation
offset**. It rotates an entire ring (all its `copies` together) by one angle, so
rings can be staggered relative to one another. It is **authored config** (it
persists), not audio-driven.

Global rotation and tiling are separate, later tasks and are explicitly out of
scope here.

## Background

The mark is an 8-fold dihedral kaleidoscope. `buildRingPath` in
`src/lib/geometry/bend.ts`:

1. maps a template path's bbox into a polar half-arc spanning `[0, alpha]`,
2. mirrors it about the petal axis,
3. tiles the assembled copy `ring.copies` times around the circle via
   `buildOneCopy(k * fullCopyAngle)`, where `fullCopyAngle = 2π / copies`.

`buildOneCopy(rotationAngle)` already rotates its anchors and handles about the
origin `(0,0)`. Audio-reactivity lives on the petal **template** (`wave.ts`,
`zones.ts`, applied in `render-pipeline.ts` **before** bend) and must stay
untouched.

## Decision: rotation stored as fraction-of-sector

`rotation` is a normalized fraction of one sector, range `0..1`, **not** degrees.

- `0` = today's behavior.
- `1` = one full sector (`360 / copies`°), which is the ring's rotational
  symmetry period — so `0..1` spans exactly all visually-distinct offsets.
- Copies-independent in storage: changing `copies` does not require rescaling the
  stored value, and no value is ever a visual duplicate of a smaller one.
- No degrees↔radians conversion in the geometry path.

## Scope

### 1. Type (`src/lib/types.ts`)

Add an optional field to `Ring`:

```ts
rotation?: number; // 0..1, fraction of one full sector. absent/undefined = 0 = today's behavior
```

Optional so existing persisted compositions load unchanged.

### 2. Geometry (`src/lib/geometry/bend.ts`)

In `buildRingPath`, after `fullCopyAngle` is computed, add a constant offset
applied identically to every copy `k`:

```ts
const ringRotation = (ring.rotation ?? 0) * fullCopyAngle;
// ...
const copySegs = buildOneCopy(k * fullCopyAngle + ringRotation);
```

`buildOneCopy` already rotates segments by its argument, so this rigidly rotates
the whole assembled ring. The mirror / half-arc / seam logic is unchanged — the
wave taper depends on it.

### 3. UI (`src/lib/components/RingEditor.svelte`)

Add a control directly after the existing "Ring height" slider, same Label +
Slider pattern:

- Label `Rotation`, value shown in degrees for readability, guarding against a
  transient `copies=0` during editing (`|| 1` denominator avoids NaN/Infinity):
  `{(((ring.rotation ?? 0) * 360) / (ring.copies || 1)).toFixed(0)}°`
- `Slider type="single" min={0} max={1} step={0.01}`
- `value={ring.rotation ?? 0}`
- `onValueChange={(v) => updateRing(index, { rotation: v })}`

Uses the existing `updateRing` — no new setter.

### 4. Defaults

`DEFAULT_RING` (`composition.ts`) and `DEFAULT_COMPOSITION` (`default.ts`) stay
**unchanged**. The optional field defaults via `?? 0`, so the default mark stays
byte-identical. This also proves backward-compatibility.

### 5. Persistence

No change. `rotation` is authored config and must persist. `stripTransients` in
`composition-persistence.svelte.ts` strips only `wave` and `zoneDrive`; do not
add `rotation` to it.

### 6. Test (`src/lib/geometry/bend.svelte.spec.ts`)

Add one minimal test asserting a **rotation invariant** rather than an
index-by-index anchor comparison (segment order may not line up after rotation,
producing a false failure at the mirror-symmetric half-sector angle):

Build a ring at `rotation=0` and the same ring at `rotation=0.5` (half a sector).
Assert, within a small epsilon:

- `path.bounds.center` stays at the origin `(0,0)` — rotation about origin can't
  move the centroid of a symmetric assembly,
- `path.length` is unchanged vs `rotation=0` — rigid rotation preserves arc
  length.

(Optionally also a set-equality check: every `rotation=0.5` anchor matches some
`rotation=0` anchor rotated by `π / copies` about origin. The invariant alone is
sufficient. `0.5 * fullCopyAngle = 0.5 * 2π/copies = π/copies`.)

## Constraints

- Do not touch `wave.ts`, `zones.ts`, the audio drivers, or morph interpolation.
- A ring with `rotation` absent or `0` must render identical to today.
- Do not implement global (composition-level) rotation or tiling.

## Verification

Run `bun dev`. With the default composition, drag Ring 2's Rotation slider and
confirm that **only** that ring turns — staggering against the other rings —
while the petal shape and audio-reactive behavior are unchanged. Set it back to
`0` and confirm the mark is identical to before.
