# Audio-Zones Old-Repo Punch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `audioZones` mode react like the old p5.js mandala — still petals in silence, hard transient snap — by adding a threshold-floor response curve and petal-extent-relative push magnitudes.

**Architecture:** Two units change. `audio-zones-driver.ts` gains a per-band threshold→expand response curve before the existing envelope and now emits **normalized 0..1** pushes in `ZoneDrive`. `zones.ts` stops using a flat scale and instead multiplies those normalized pushes by the petal's own radial extent × per-band REACH constants. `ZonePreview.svelte` is updated to the new normalized drive and the dead constants are removed last so the build stays green at every task boundary.

**Tech Stack:** TypeScript, Svelte 5, vitest, bun, paper.js.

## Global Constraints

- Package manager **bun**. Tests: `bun run test:unit -- run <path>`. Typecheck: `bun run check`.
- All currently-passing unit tests (232) must stay green.
- Change confined to `audioZones` mode; no other animation mode touched.
- Petal shapes (authored template paths) unchanged.
- `applyZonesToPath` stays **pure** — never mutates its input path or crds.
- Envelopes stay global per-band; per-ring config stays intensity-only.
- No new UI; thresholds and reach are fixed named constants.
- `audio-source.ts`, the `render-pipeline.ts` zone slot, and bend/morph/wave are untouched.
- Any Svelte file written MUST be run through the `svelte-autofixer` MCP tool until clean (per CLAUDE.md).
- `ZoneDrive` field names are unchanged (`bassPush`, `midPush`, `trebleRetract`, `trebleVibrate`); only their **meaning** changes from absolute deltas to normalized 0..1 (`trebleVibrate` is signed −1..1, includes phase).

---

### Task 1: Driver — response curve + normalized output

Add the per-band threshold→expand response curve and switch the driver to emit
normalized 0..1 pushes (drop the `ZONE_SCALE`/`VIBR_AMT` multiply). `zones.ts`
still exports `ZONE_SCALE`/`VIBR_AMT` after this task, so `ZonePreview.svelte` and
`zones.spec.ts` keep compiling. Visual output is intentionally tiny until Task 2;
only unit behavior is asserted here.

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-zones-driver.ts`
- Test: `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`

**Interfaces:**
- Consumes: `EnvelopeParams`, `ZoneDrive`, `ZoneIntensity`, `Ring` (`$lib/types`); `resolveZoneIntensity` (`$lib/geometry/zones`); existing deps object (`getDefaultIntensity`, `getRingCount`, `getRing`, `readZones`, `getEnvelopes`, `applyRingZoneDrive`).
- Produces: `respond(raw: number, floor: number, sat: number): number` (module-local). `frame()` now emits a `ZoneDrive` whose fields are normalized: `bassPush`/`midPush`/`trebleRetract` in `0..1`, `trebleVibrate` in `-1..1`.

- [ ] **Step 1: Write the failing tests**

Replace the two existing `ZONE_SCALE`-based magnitude tests and add response-curve
tests. Open `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`.

Remove the import of `ZONE_SCALE`:

```ts
// DELETE this line:
import { ZONE_SCALE } from '$lib/geometry/zones';
```

Delete the existing test titled
`frame() with instant attack scales bassPush by bass * intensity.bass * ZONE_SCALE`
and any sibling test that multiplies an expectation by `ZONE_SCALE`.

Add these tests inside the `describe('createAudioZonesDriver', …)` block. They
import nothing new; `respond` is asserted indirectly through `frame()` output.

```ts
// Helper mirroring the driver's response curve, for expectations.
function respondExpect(raw: number, floor: number, sat: number): number {
  if (sat <= floor) return 0;
  return Math.max(0, Math.min(1, (raw - floor) / (sat - floor)));
}
const RESP = {
  bass: { floor: 0.235, sat: 0.863 },
  mid: { floor: 0.196, sat: 0.863 },
  treble: { floor: 0.275, sat: 0.863 }
};

it('frame() emits normalized bassPush = respond(raw) * intensity (instant attack)', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({
    ringCount: 1,
    zones: { bass: 0.5, mid: 0.0, treble: 0.0 },
    calls
  });
  driver.init();
  driver.frame(0);
  const expected = respondExpect(0.5, RESP.bass.floor, RESP.bass.sat) * defaultIntensity.bass;
  expect(calls[0].drive?.bassPush).toBeCloseTo(expected, 6);
});

it('frame() floors a sub-threshold band to zero deformation', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({
    ringCount: 1,
    zones: { bass: 0.1, mid: 0.1, treble: 0.1 }, // all below their floors
    calls
  });
  driver.init();
  driver.frame(0);
  expect(calls[0].drive?.bassPush).toBe(0);
  expect(calls[0].drive?.midPush).toBe(0);
  expect(calls[0].drive?.trebleRetract).toBe(0);
  expect(calls[0].drive?.trebleVibrate).toBe(0);
});

it('frame() saturates an above-sat band to intensity (1 * intensity)', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({
    ringCount: 1,
    zones: { bass: 1.0, mid: 0.0, treble: 0.0 },
    calls
  });
  driver.init();
  driver.frame(0);
  expect(calls[0].drive?.bassPush).toBeCloseTo(defaultIntensity.bass, 6);
});

it('frame() keeps all normalized fields within range', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({
    ringCount: 1,
    zones: { bass: 1.0, mid: 1.0, treble: 1.0 },
    calls
  });
  driver.init();
  driver.frame(0);
  const d = calls[0].drive!;
  expect(d.bassPush).toBeGreaterThanOrEqual(0);
  expect(d.bassPush).toBeLessThanOrEqual(1);
  expect(d.midPush).toBeLessThanOrEqual(1);
  expect(d.trebleRetract).toBeLessThanOrEqual(1);
  expect(Math.abs(d.trebleVibrate)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-zones-driver.spec.ts`
Expected: FAIL — current driver multiplies by `ZONE_SCALE` (so `bassPush` ≈ several units, not `respond×intensity`), and the sub-threshold test fails because the raw band is passed without a floor.

- [ ] **Step 3: Implement the response curve and normalized output**

Edit `src/lib/state/animation-drivers/audio-zones-driver.ts`.

Change the import line (drop `ZONE_SCALE`, `VIBR_AMT`):

```ts
import { resolveZoneIntensity } from '$lib/geometry/zones';
```

Add constants + helper near the top of the module (after `VIBR_FREQ`):

```ts
// Per-band threshold→expand response curve, ported from the old p5 sketch
// (0–255 thresholds bass 60 / mid 50 / treble 70, saturation 220, ÷255).
// Below floor → 0 (still petals); above sat → 1 (snap).
const RESPONSE = {
  bass: { floor: 0.235, sat: 0.863 },
  mid: { floor: 0.196, sat: 0.863 },
  treble: { floor: 0.275, sat: 0.863 }
} as const;

function respond(raw: number, floor: number, sat: number): number {
  if (sat <= floor) return 0;
  return clamp01((raw - floor) / (sat - floor));
}
```

Rewrite the body of `frame()` so the response curve runs before the envelope and
the emitted drive is normalized (no `ZONE_SCALE`):

```ts
    frame(nowMs) {
      const raw = deps.readZones();
      const env = deps.getEnvelopes();
      const responded = {
        bass: respond(clamp01(raw.bass), RESPONSE.bass.floor, RESPONSE.bass.sat),
        mid: respond(clamp01(raw.mid), RESPONSE.mid.floor, RESPONSE.mid.sat),
        treble: respond(clamp01(raw.treble), RESPONSE.treble.floor, RESPONSE.treble.sat)
      };
      smoothed = {
        bass: envelope(smoothed.bass, responded.bass, env.bass),
        mid: envelope(smoothed.mid, responded.mid, env.mid),
        treble: envelope(smoothed.treble, responded.treble, env.treble)
      };

      const defaultIntensity = deps.getDefaultIntensity();
      const ringCount = normalizeRingCount(deps.getRingCount());
      const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;
      const vibratePhase = Math.sin(2 * Math.PI * VIBR_FREQ * nowSec);

      for (let i = 0; i < ringCount; i++) {
        const ring = deps.getRing(i);
        const cfg = resolveZoneIntensity(ring, defaultIntensity);
        const trebleNorm = smoothed.treble * cfg.treble;
        deps.applyRingZoneDrive(i, {
          bassPush: smoothed.bass * cfg.bass,
          midPush: smoothed.mid * cfg.mid,
          trebleRetract: trebleNorm,
          trebleVibrate: trebleNorm * vibratePhase
        });
      }

      return {};
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-zones-driver.spec.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/animation-drivers/audio-zones-driver.ts src/lib/state/animation-drivers/audio-zones-driver.spec.ts
git commit -m "feat: per-band threshold response curve, normalized zone drive"
```

---

### Task 2: zones.ts — petal-extent-relative magnitude

Replace the flat `ZONE_SCALE` deformation with magnitudes proportional to the
petal's own radial extent, interpreting the now-normalized `ZoneDrive`. Keep
`ZONE_SCALE` and `VIBR_AMT` exported as unused stubs so `ZonePreview.svelte` keeps
compiling until Task 3.

**Files:**
- Modify: `src/lib/geometry/zones.ts`
- Test: `src/lib/geometry/zones.spec.ts`

**Interfaces:**
- Consumes: `ZoneDrive` with **normalized** fields (from Task 1).
- Produces: `applyZonesToPath(path: Path, drive: ZoneDrive): Path` (unchanged signature, new magnitude semantics). New exported reach constants `BASS_REACH`, `MID_X_REACH`, `MID_Y_REACH`, `TREBLE_RETRACT`, `VIBR_REACH`.

- [ ] **Step 1: Write the failing tests**

Edit `src/lib/geometry/zones.spec.ts`. The existing 3-anchor `petal` fixture has
Y values 30 (outer/bass), 60 (middle/mid), 100 (inner/treble), so
`radialExtent = 100 − 30 = 70`.

Update the import to pull the reach constants and drop `ZONE_SCALE`:

```ts
import {
  applyZonesToPath,
  resolveZoneIntensity,
  BASS_REACH,
  MID_X_REACH,
  MID_Y_REACH,
  TREBLE_RETRACT,
  VIBR_REACH
} from './zones';
```

Replace any existing test that referenced `ZONE_SCALE` magnitudes with these. The
two zero/length-preservation/purity tests already in the file stay as-is.

```ts
const RADIAL_EXTENT = 70; // 100 - 30 for the `petal` fixture

it('bass pushes the outermost anchor radially out by extent * BASS_REACH', () => {
  const result = applyZonesToPath(petal, {
    bassPush: 1,
    midPush: 0,
    trebleRetract: 0,
    trebleVibrate: 0
  });
  // outermost anchor = C1 anchor at idx 6,7 (Y=30). dy = -(1 * 70 * BASS_REACH).
  expect(result.crds[7]).toBeCloseTo(30 - RADIAL_EXTENT * BASS_REACH, 6);
  expect(result.crds[6]).toBeCloseTo(10, 6); // x unchanged for bass
});

it('mid widens the middle anchor in +x and nudges it out in -y', () => {
  const result = applyZonesToPath(petal, {
    bassPush: 0,
    midPush: 1,
    trebleRetract: 0,
    trebleVibrate: 0
  });
  // middle anchor = C2 anchor at idx 12,13 (Y=60).
  expect(result.crds[12]).toBeCloseTo(40 + RADIAL_EXTENT * MID_X_REACH, 6);
  expect(result.crds[13]).toBeCloseTo(60 - RADIAL_EXTENT * MID_Y_REACH, 6);
});

it('treble retracts the innermost anchor in +y and jitters it in x', () => {
  const result = applyZonesToPath(petal, {
    bassPush: 0,
    midPush: 0,
    trebleRetract: 1,
    trebleVibrate: 1
  });
  // innermost anchor = M anchor at idx 0,1 (Y=100).
  expect(result.crds[1]).toBeCloseTo(100 + RADIAL_EXTENT * TREBLE_RETRACT, 6);
  expect(result.crds[0]).toBeCloseTo(0 + RADIAL_EXTENT * VIBR_REACH, 6);
});

it('signed trebleVibrate moves the innermost anchor the other way', () => {
  const result = applyZonesToPath(petal, {
    bassPush: 0,
    midPush: 0,
    trebleRetract: 0,
    trebleVibrate: -1
  });
  expect(result.crds[0]).toBeCloseTo(0 - RADIAL_EXTENT * VIBR_REACH, 6);
});

it('magnitude scales with radial extent (double extent → double delta)', () => {
  // Same shape, Y doubled in span: outer 0, middle 60, inner 140 → extent 140.
  const tall: typeof petal = {
    cmds: ['M', 'C', 'C'],
    crds: [
      0, 140,
      0, 80, 5, 50, 10, 0,
      20, 25, 30, 30, 40, 60
    ]
  };
  const result = applyZonesToPath(tall, {
    bassPush: 1,
    midPush: 0,
    trebleRetract: 0,
    trebleVibrate: 0
  });
  // outermost is now C1 anchor (Y=0); extent = 140 - 0 = 140.
  expect(result.crds[7]).toBeCloseTo(0 - 140 * BASS_REACH, 6);
});

it('returns an unchanged copy when radial extent is zero', () => {
  const flat: typeof petal = {
    cmds: ['M', 'L'],
    crds: [0, 50, 20, 50] // both anchors same Y → extent 0
  };
  const result = applyZonesToPath(flat, {
    bassPush: 1,
    midPush: 1,
    trebleRetract: 1,
    trebleVibrate: 1
  });
  expect(result.crds).toEqual(flat.crds);
  expect(result.crds).not.toBe(flat.crds);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/geometry/zones.spec.ts`
Expected: FAIL — `BASS_REACH` et al. are not exported; magnitudes still use the flat `ZONE_SCALE` path.

- [ ] **Step 3: Implement extent-relative magnitude**

Edit `src/lib/geometry/zones.ts`.

Replace the three magnitude constants at the top. Keep `ZONE_SCALE` and `VIBR_AMT`
as deprecated stubs (removed in Task 3); remove `MID_RADIAL_RATIO` (internal only):

```ts
/** @deprecated unused after extent-relative rework; removed once ZonePreview migrates. */
export const ZONE_SCALE = 30;
/** @deprecated unused after extent-relative rework; removed once ZonePreview migrates. */
export const VIBR_AMT = 0.5;

/** Bass: outer tip reach as a multiple of petal radial extent (≈ full petal length). */
export const BASS_REACH = 1.2;
/** Mid: tangential widening as a fraction of radial extent. */
export const MID_X_REACH = 0.6;
/** Mid: slight radial-out nudge as a fraction of radial extent. */
export const MID_Y_REACH = 0.25;
/** Treble: inner-tip inward retraction as a fraction of radial extent. */
export const TREBLE_RETRACT = 0.5;
/** Treble: tangential vibration amplitude as a fraction of radial extent. */
export const VIBR_REACH = 0.3;
```

In `applyZonesToPath`, after `const sorted = [...anchors].sort(...)` and the
`const crds = [...path.crds];` line, compute the extent and the deltas. Replace the
per-anchor `dx`/`dy` assignment block (the `if (i === 0) … else if … else …`) with
extent-scaled values:

```ts
  // Radial extent of the petal (Y axis is radial; sorted ascending by Y).
  const minY = path.crds[sorted[0].anchorIdx + 1];
  const maxY = path.crds[sorted[sorted.length - 1].anchorIdx + 1];
  const radialExtent = maxY - minY;
  if (radialExtent === 0) return { cmds: [...path.cmds], crds };

  const bassDelta = bassPush * radialExtent * BASS_REACH;
  const midXDelta = midPush * radialExtent * MID_X_REACH;
  const midYDelta = midPush * radialExtent * MID_Y_REACH;
  const trebleRetractDelta = trebleRetract * radialExtent * TREBLE_RETRACT;
  const trebleVibrateDelta = trebleVibrate * radialExtent * VIBR_REACH;

  for (let i = 0; i < sorted.length; i++) {
    const anchor = sorted[i];
    let dx = 0;
    let dy = 0;

    if (i === 0) {
      // Outermost — bass — radially outward (decrease Y)
      dy = -bassDelta;
    } else if (i === sorted.length - 1) {
      // Innermost — treble — retract inward (increase Y) + tangential vibration
      dy = trebleRetractDelta;
      dx = trebleVibrateDelta;
    } else {
      // Middle — mid — tangential widening + slight radial push outward
      dx = midXDelta;
      dy = -midYDelta;
    }

    translate(anchor.anchorIdx, dx, dy);
    translate(anchor.entryHandleIdx, dx, dy);
    translate(anchor.exitHandleIdx, dx, dy);
  }
```

Update the function's doc comment to describe extent-relative deltas (replace the
old `dy = -bassPush` style lines): bass = `-extent·BASS_REACH` on the outermost
anchor, mid = `+extent·MID_X_REACH` (x) and `-extent·MID_Y_REACH` (y) on middles,
treble = `+extent·TREBLE_RETRACT` (y) and `±extent·VIBR_REACH` (x) on the
innermost. Note the early return when `radialExtent === 0`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/geometry/zones.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full unit suite + typecheck**

Run: `bun run test:unit -- run`
Expected: all green (ZonePreview still compiles via the stub exports).
Run: `bun run check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geometry/zones.ts src/lib/geometry/zones.spec.ts
git commit -m "feat: petal-extent-relative zone deformation magnitude"
```

---

### Task 3: ZonePreview migration + dead-constant cleanup

Migrate the static zone preview to the normalized drive and remove the deprecated
`ZONE_SCALE` / `VIBR_AMT` exports.

**Files:**
- Modify: `src/lib/components/ZonePreview.svelte`
- Modify: `src/lib/geometry/zones.ts`

**Interfaces:**
- Consumes: `applyZonesToPath`, reach constants from `zones.ts`; `ZoneIntensity` (`$lib/types`).
- Produces: none new.

- [ ] **Step 1: Update ZonePreview to the normalized drive**

Edit `src/lib/components/ZonePreview.svelte`.

Change the import (drop `ZONE_SCALE`, `VIBR_AMT`):

```ts
import { applyZonesToPath } from '$lib/geometry/zones';
```

Replace the `maxDrive` object (the drive now carries normalized 0..1 fields; the
preview shows full-amplitude reach, so vibration phase = 1):

```ts
				const maxDrive = {
					bassPush: intensity.bass,
					midPush: intensity.mid,
					trebleRetract: intensity.treble,
					trebleVibrate: intensity.treble
				};
```

- [ ] **Step 2: Run svelte-autofixer until clean**

Use the `svelte-autofixer` MCP tool on the full contents of
`src/lib/components/ZonePreview.svelte`. Apply any fixes it reports and re-run
until it returns no issues or suggestions.

- [ ] **Step 3: Remove the deprecated exports**

Edit `src/lib/geometry/zones.ts` — delete the two deprecated stubs:

```ts
// DELETE both:
export const ZONE_SCALE = 30;
export const VIBR_AMT = 0.5;
```

- [ ] **Step 4: Verify nothing else references the removed constants**

Run: `git grep -n "ZONE_SCALE\|VIBR_AMT" -- 'src/**'`
Expected: no matches (empty output). If any remain, update them to the reach
constants or remove the reference, then re-run.

- [ ] **Step 5: Full unit suite + typecheck**

Run: `bun run test:unit -- run`
Expected: all green.
Run: `bun run check`
Expected: 0 errors / 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ZonePreview.svelte src/lib/geometry/zones.ts
git commit -m "refactor: migrate ZonePreview to normalized drive, drop ZONE_SCALE/VIBR_AMT"
```

---

### Task 4: Manual visual verification

**Files:** none (runtime check).

- [ ] **Step 1: Launch the app**

Run: `bun run dev`
Open the printed local URL.

- [ ] **Step 2: Drive the audio-zones mode**

Set Animation mode = **Audio Zones**, source = Demo (or mic/file). Observe:
- Silence / low input → petals essentially still (response floor).
- Transients → hard, fast snap; bass extends the outer tip, mid widens the body, treble retracts the inner tip + shimmer.
- Decay follows the per-band release after each hit.

- [ ] **Step 3: Confirm vs the old repo feel**

Compare against the `Utop-ia/mandala-bettona` behavior. If a band reads too soft
or too strong, tune the reach constants in `zones.ts` (`BASS_REACH`, `MID_X_REACH`,
`MID_Y_REACH`, `TREBLE_RETRACT`, `VIBR_REACH`) or the `RESPONSE` floors in the
driver, then re-run `bun run test:unit -- run` and re-verify. No commit needed
unless constants change.
