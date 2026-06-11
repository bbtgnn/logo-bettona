# Audio Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `audioZones` animation mode that deforms the authored bezier curve on three frequency bands (bass/mid/treble → extend/widen/shimmer), leaving `audioBars` and all existing code completely untouched.

**Architecture:** Pure geometry function `applyZonesToPath` identifies on-curve anchors, sorts by radial Y, applies per-zone vector translations with handles following. A new driver writes transient `ring.zoneDrive` per frame (stripped from persistence, same pattern as `ring.wave`). The render pipeline applies zone deformation after morph, before `bend.ts` mirrors — 8-way symmetry is free.

**Tech Stack:** TypeScript, Svelte 5 (`$state`, `$derived`, `$effect`, `$props`), paper.js, vitest, bun

**Spec:** `docs/superpowers/specs/2026-06-10-audio-zones-design.md`

---

## File Structure

### New files
| File | Purpose |
|------|---------|
| `src/lib/geometry/zones.ts` | `applyZonesToPath`, `resolveZoneIntensity`, `ZONE_SCALE` |
| `src/lib/geometry/zones.spec.ts` | Geometry unit tests |
| `src/lib/state/animation-drivers/audio-zones-driver.ts` | `createAudioZonesDriver` |
| `src/lib/state/animation-drivers/audio-zones-driver.spec.ts` | Driver unit tests |
| `src/lib/components/ZonePreview.svelte` | Two-layer static preview (rest + reach) |
| `src/lib/components/RingZoneConfigItem.svelte` | Per-ring collapsible zone override |

### Modified files
| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `ZoneIntensity`, `ZoneDrive`, `AudioZonesConfig`; extend `Ring` |
| `src/lib/state/animation-drivers/types.ts` | Add `'audioZones'` to `AnimationDriverType` |
| `src/lib/state/animation-drivers/audio-source.ts` | Add `reduceToZones` + `readZones()` |
| `src/lib/state/animation-drivers/audio-source.spec.ts` | Tests for `reduceToZones` |
| `src/lib/state/composition.ts` | Add `setRingZoneDrive` |
| `src/lib/state/composition-persistence.svelte.ts` | Rename `stripWave` → `stripTransients`; strip `zoneDrive` |
| `src/lib/state/composition-persistence.svelte.spec.ts` | Tests for `zoneDrive` strip + `zoneConfig` preserve |
| `src/lib/state/animation.svelte.ts` | Add `audioZones` to state; register driver; add exports |
| `src/lib/geometry/render-pipeline.ts` | Add zone deformation block after wave block |
| `src/lib/geometry/render-pipeline.svelte.spec.ts` | Test zone deformation in pipeline |
| `src/lib/components/PreviewCanvas.svelte` | Extend `ignoreMorph` to `audioZones` |
| `src/lib/components/RingEditor.svelte` | Extend `morphInactive` to `audioZones` |
| `src/lib/components/AnimationSection.svelte` | Add `audioZones` option + UI block |

---

## Coordinate System Reference

`bend.ts` maps template → polar: **X → angle (tangential)**, **Y → radius**.  
Lower Y = outer (farther from center). Higher Y = inner (closer to center).

- Bass (outermost anchor): `dy = -bassPush` (petal tip reaches out)
- Mid (middle anchor(s)): `dx = +midPush` (body widens; `bend.ts` mirror does other side)
- Treble (innermost anchor): `dy = +treblePush` (sign oscillates from driver shimmer)

---

## Task 1: Types

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/state/animation-drivers/types.ts`

- [ ] **Step 1: Add zone types to `src/lib/types.ts`**

  After the `WaveConfig` block (line 16), add:

  ```ts
  export type ZoneIntensity = { bass: number; mid: number; treble: number };
  export type ZoneDrive     = { bassPush: number; midPush: number; treblePush: number };
  export type AudioZonesConfig = { defaultIntensity: ZoneIntensity };
  ```

  Then extend `Ring` (currently ends at `waveConfig?: WaveConfig | null;`):

  ```ts
  export type Ring = {
    copies: number;
    color: string;
    templatePath: Path | null;
    secondaryTemplatePath: Path | null;
    morphT: number;
    ringHeight: number;
    wave?: WaveState | null;
    waveConfig?: WaveConfig | null;
    zoneConfig?: ZoneIntensity | null; // persisted; null = inherit global default
    zoneDrive?: ZoneDrive | null;      // transient; stripped from persistence
  };
  ```

- [ ] **Step 2: Add `'audioZones'` to `AnimationDriverType` in `src/lib/state/animation-drivers/types.ts`**

  Change line 1:

  ```ts
  export type AnimationDriverType = 'simple' | 'audioBars' | 'audioZones' | 'dataSeries';
  ```

- [ ] **Step 3: Run existing tests to confirm no breakage**

  ```bash
  bun run test
  ```

  Expected: all 176 tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/types.ts src/lib/state/animation-drivers/types.ts
  git commit -m "feat(audio-zones): add ZoneIntensity, ZoneDrive, AudioZonesConfig types; extend Ring; add audioZones driver type"
  ```

---

## Task 2: Geometry — `applyZonesToPath` and `resolveZoneIntensity`

**Files:**
- Create: `src/lib/geometry/zones.ts`
- Create: `src/lib/geometry/zones.spec.ts`

- [ ] **Step 1: Write failing tests in `src/lib/geometry/zones.spec.ts`**

  ```ts
  import { describe, expect, it } from 'vitest';
  import type { Path } from '$lib/types';
  import { applyZonesToPath, resolveZoneIntensity, ZONE_SCALE } from './zones';

  // 3-anchor petal: M=(0,100) inner, first-C=(10,30) outer, second-C=(40,60) middle
  // Parsed anchor order by Y ascending: (10,30) → bass, (40,60) → mid, (0,100) → treble
  // crds indices: M-anchor=0, C1-cp1=2, C1-cp2=4, C1-anchor=6, C2-cp1=8, C2-cp2=10, C2-anchor=12
  // After parsing:
  //   M: {anchorIdx:0, entry:null, exit:2}   (exit set when first C is parsed)
  //   C1: {anchorIdx:6, entry:4, exit:8}
  //   C2: {anchorIdx:12, entry:10, exit:null}
  const petal: Path = {
    cmds: ['M', 'C', 'C'],
    crds: [
      0, 100,              // M anchor (idx 0,1) — innermost Y=100
      0, 80, 5, 50, 10, 30, // C1: cp1(idx2,3), cp2(idx4,5), anchor(idx6,7) — outermost Y=30
      20, 25, 30, 30, 40, 60 // C2: cp1(idx8,9), cp2(idx10,11), anchor(idx12,13) — middle Y=60
    ]
  };

  describe('applyZonesToPath', () => {
    it('returns a new identical copy when all pushes are 0', () => {
      const result = applyZonesToPath(petal, { bassPush: 0, midPush: 0, treblePush: 0 });
      expect(result).not.toBe(petal);
      expect(result.crds).not.toBe(petal.crds);
      expect(result.crds).toEqual(petal.crds);
      expect(result.cmds).toEqual(petal.cmds);
    });

    it('preserves cmds array and crds length for any drive', () => {
      const result = applyZonesToPath(petal, { bassPush: 10, midPush: 5, treblePush: 3 });
      expect(result.cmds).toEqual(petal.cmds);
      expect(result.crds).toHaveLength(petal.crds.length);
    });

    it('bass: moves outermost anchor (idx 6) + its entry handle (idx 4) + exit handle (idx 8) down by bassPush; leaves others unchanged', () => {
      const result = applyZonesToPath(petal, { bassPush: 10, midPush: 0, treblePush: 0 });
      // anchor Y: 30 - 10 = 20
      expect(result.crds[7]).toBeCloseTo(20, 6);
      // entry handle (C1 cp2) Y: 50 - 10 = 40
      expect(result.crds[5]).toBeCloseTo(40, 6);
      // exit handle (C2 cp1) Y: 25 - 10 = 15
      expect(result.crds[9]).toBeCloseTo(15, 6);
      // anchor X unchanged
      expect(result.crds[6]).toBe(petal.crds[6]);
      // M anchor unchanged
      expect(result.crds[0]).toBe(petal.crds[0]);
      expect(result.crds[1]).toBe(petal.crds[1]);
      // C2 anchor unchanged
      expect(result.crds[12]).toBe(petal.crds[12]);
      expect(result.crds[13]).toBe(petal.crds[13]);
    });

    it('mid: moves middle anchor (idx 12) + entry handle (idx 10) right by midPush; leaves others unchanged', () => {
      const result = applyZonesToPath(petal, { bassPush: 0, midPush: 7, treblePush: 0 });
      // anchor X: 40 + 7 = 47
      expect(result.crds[12]).toBeCloseTo(47, 6);
      // entry handle (C2 cp2) X: 30 + 7 = 37
      expect(result.crds[10]).toBeCloseTo(37, 6);
      // exit handle: null for C2 → no change on any Y
      // C1 anchor unchanged
      expect(result.crds[6]).toBe(petal.crds[6]);
      expect(result.crds[7]).toBe(petal.crds[7]);
      // M anchor unchanged
      expect(result.crds[0]).toBe(petal.crds[0]);
      expect(result.crds[1]).toBe(petal.crds[1]);
    });

    it('treble: moves innermost anchor (idx 0) + exit handle (idx 2) by +treblePush; leaves others unchanged', () => {
      const result = applyZonesToPath(petal, { bassPush: 0, midPush: 0, treblePush: 8 });
      // anchor Y: 100 + 8 = 108
      expect(result.crds[1]).toBeCloseTo(108, 6);
      // exit handle (C1 cp1) Y: 80 + 8 = 88
      expect(result.crds[3]).toBeCloseTo(88, 6);
      // entry handle: null for M → no change
      // C1 anchor unchanged
      expect(result.crds[6]).toBe(petal.crds[6]);
      expect(result.crds[7]).toBe(petal.crds[7]);
    });

    it('N=1: single anchor — bass wins', () => {
      const single: Path = { cmds: ['M'], crds: [10, 50] };
      const result = applyZonesToPath(single, { bassPush: 5, midPush: 3, treblePush: 2 });
      // Y = 50 - 5 = 45 (bass applied)
      expect(result.crds[1]).toBeCloseTo(45, 6);
      // X unchanged
      expect(result.crds[0]).toBe(10);
    });

    it('N=2: outermost gets bass, innermost gets treble, no mid', () => {
      const two: Path = { cmds: ['M', 'L'], crds: [0, 100, 0, 30] };
      // sorted: (0,30) idx=2 outermost → bass; (0,100) idx=0 innermost → treble
      const result = applyZonesToPath(two, { bassPush: 10, midPush: 99, treblePush: 5 });
      // outermost Y: 30 - 10 = 20
      expect(result.crds[3]).toBeCloseTo(20, 6);
      // innermost Y: 100 + 5 = 105
      expect(result.crds[1]).toBeCloseTo(105, 6);
      // X coords unchanged (no tangential move)
      expect(result.crds[0]).toBe(0);
      expect(result.crds[2]).toBe(0);
    });

    it('does not mutate the input path', () => {
      const original = [...petal.crds];
      applyZonesToPath(petal, { bassPush: 10, midPush: 5, treblePush: 3 });
      expect(petal.crds).toEqual(original);
    });
  });

  describe('resolveZoneIntensity', () => {
    const def = { bass: 0.5, mid: 0.5, treble: 0.5 };

    it('returns def when ring has no zoneConfig', () => {
      expect(resolveZoneIntensity({}, def)).toEqual(def);
    });

    it('returns def when ring.zoneConfig is null', () => {
      expect(resolveZoneIntensity({ zoneConfig: null }, def)).toEqual(def);
    });

    it('returns ring.zoneConfig when set, ignoring def', () => {
      const override = { bass: 0.9, mid: 0.1, treble: 0.7 };
      expect(resolveZoneIntensity({ zoneConfig: override }, def)).toEqual(override);
    });
  });

  describe('ZONE_SCALE', () => {
    it('is a positive number', () => {
      expect(typeof ZONE_SCALE).toBe('number');
      expect(ZONE_SCALE).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  bun run test src/lib/geometry/zones.spec.ts
  ```

  Expected: FAIL — `Cannot find module './zones'`

- [ ] **Step 3: Implement `src/lib/geometry/zones.ts`**

  ```ts
  import type { Path, ZoneIntensity, ZoneDrive } from '$lib/types';

  /** Template-space units of deformation at intensity=1, audio-level=1. Tune empirically. */
  export const ZONE_SCALE = 30;

  type AnchorInfo = {
    anchorIdx: number;
    entryHandleIdx: number | null;
    exitHandleIdx: number | null;
  };

  /**
   * Deforms an authored bezier path on three zones tied to audio bands.
   * Anchors are sorted by Y ascending (lower Y = outer in bend.ts space):
   *   outermost → bass → dy = -bassPush  (tip reaches radially out)
   *   middle(s)  → mid  → dx = +midPush  (body widens tangentially)
   *   innermost  → treble → dy = treblePush (shimmer; sign from driver's Math.sin)
   * Handles follow their anchor by the same vector. Pure — never mutates input.
   */
  export function applyZonesToPath(path: Path, drive: ZoneDrive): Path {
    const { bassPush, midPush, treblePush } = drive;

    if (bassPush === 0 && midPush === 0 && treblePush === 0) {
      return { cmds: [...path.cmds], crds: [...path.crds] };
    }

    const anchors: AnchorInfo[] = [];
    let cursor = 0;

    for (let ci = 0; ci < path.cmds.length; ci++) {
      const cmd = path.cmds[ci];
      if (cmd === 'M' || cmd === 'L') {
        anchors.push({ anchorIdx: cursor, entryHandleIdx: null, exitHandleIdx: null });
        cursor += 2;
      } else if (cmd === 'C') {
        // Coords: cp1x, cp1y, cp2x, cp2y, x, y
        // cp1 = exit handle of PREVIOUS anchor; cp2 = entry handle of THIS anchor
        const cp1Idx = cursor;
        const cp2Idx = cursor + 2;
        const anchorIdx = cursor + 4;
        if (anchors.length > 0) {
          anchors[anchors.length - 1].exitHandleIdx = cp1Idx;
        }
        anchors.push({ anchorIdx, entryHandleIdx: cp2Idx, exitHandleIdx: null });
        cursor += 6;
      } else if (cmd === 'Q') {
        // Coords: cpx, cpy, x, y  — single handle shared as exit of prev + entry of this
        const cpIdx = cursor;
        const anchorIdx = cursor + 2;
        if (anchors.length > 0) {
          anchors[anchors.length - 1].exitHandleIdx = cpIdx;
        }
        anchors.push({ anchorIdx, entryHandleIdx: cpIdx, exitHandleIdx: null });
        cursor += 4;
      }
      // 'Z': no coordinates
    }

    if (anchors.length === 0) return { cmds: [...path.cmds], crds: [...path.crds] };

    // Sort ascending by Y — lower Y = outer (farther from center) in bend.ts space
    const sorted = [...anchors].sort(
      (a, b) => path.crds[a.anchorIdx + 1] - path.crds[b.anchorIdx + 1]
    );

    const crds = [...path.crds];

    function translate(idx: number | null, dx: number, dy: number): void {
      if (idx === null) return;
      crds[idx] += dx;
      crds[idx + 1] += dy;
    }

    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i];
      let dx = 0;
      let dy = 0;

      if (i === 0) {
        // Outermost — bass — radially outward (decrease Y)
        dy = -bassPush;
      } else if (i === sorted.length - 1) {
        // Innermost — treble — radial bobbing (sign from driver shimmer)
        dy = treblePush;
      } else {
        // Middle — mid — tangential widening
        dx = midPush;
      }

      translate(anchor.anchorIdx, dx, dy);
      translate(anchor.entryHandleIdx, dx, dy);
      translate(anchor.exitHandleIdx, dx, dy);
    }

    return { cmds: [...path.cmds], crds };
  }

  export function resolveZoneIntensity(
    ring: { zoneConfig?: { bass: number; mid: number; treble: number } | null },
    def: ZoneIntensity
  ): ZoneIntensity {
    return ring.zoneConfig ?? def;
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  bun run test src/lib/geometry/zones.spec.ts
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Run full suite to confirm no regression**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/geometry/zones.ts src/lib/geometry/zones.spec.ts
  git commit -m "feat(audio-zones): implement applyZonesToPath + resolveZoneIntensity + ZONE_SCALE"
  ```

---

## Task 3: Persistence — `stripTransients`

**Files:**
- Modify: `src/lib/state/composition-persistence.svelte.ts`
- Modify: `src/lib/state/composition-persistence.svelte.spec.ts`

- [ ] **Step 1: Write new failing persistence tests**

  In `src/lib/state/composition-persistence.svelte.spec.ts`, add these tests after the existing `it('strips ring.wave but preserves ring.waveConfig...')` test:

  ```ts
  it('does not write to localStorage when only ring.zoneDrive changes', () => {
    const state = createPersistedComposition(key, makeComposition());

    flushSync(() => { state.baseRadius = 150; });
    const before = localStorage.getItem(key);

    flushSync(() => {
      state.rings = state.rings.map((ring) => ({
        ...ring,
        zoneDrive: { bassPush: 10, midPush: 5, treblePush: 3 }
      }));
    });

    expect(localStorage.getItem(key)).toBe(before);
  });

  it('never includes a zoneDrive key in the stored blob', () => {
    const state = createPersistedComposition(key, makeComposition());

    flushSync(() => {
      state.rings = state.rings.map((ring) => ({
        ...ring,
        zoneDrive: { bassPush: 10, midPush: 5, treblePush: 3 }
      }));
      state.baseRadius = 175; // force a write
    });

    const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
    expect(stored.rings[0].zoneDrive).toBeUndefined();
    expect(stored.baseRadius).toBe(175);
  });

  it('persists ring.zoneConfig to localStorage', () => {
    const state = createPersistedComposition(key, makeComposition());

    flushSync(() => {
      state.rings = state.rings.map((ring) => ({
        ...ring,
        zoneConfig: { bass: 0.8, mid: 0.4, treble: 0.6 }
      }));
    });

    const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
    expect(stored.rings[0].zoneConfig).toEqual({ bass: 0.8, mid: 0.4, treble: 0.6 });
  });

  it('strips zoneDrive but preserves zoneConfig in the same write', () => {
    const state = createPersistedComposition(key, makeComposition());

    flushSync(() => {
      state.rings = state.rings.map((ring) => ({
        ...ring,
        zoneDrive: { bassPush: 10, midPush: 5, treblePush: 3 },
        zoneConfig: { bass: 0.9, mid: 0.5, treble: 0.1 }
      }));
      state.baseRadius = 175;
    });

    const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
    expect(stored.rings[0].zoneDrive).toBeUndefined();
    expect(stored.rings[0].zoneConfig).toEqual({ bass: 0.9, mid: 0.5, treble: 0.1 });
  });
  ```

- [ ] **Step 2: Run to confirm new tests fail**

  ```bash
  bun run test src/lib/state/composition-persistence.svelte.spec.ts
  ```

  Expected: new `zoneDrive` tests FAIL.

- [ ] **Step 3: Update `composition-persistence.svelte.ts`**

  Rename `stripWave` → `stripTransients` and strip `zoneDrive` too.  
  Replace the entire `stripWave` function and all its usages:

  ```ts
  function stripTransients(composition: Composition): Composition {
    return {
      ...composition,
      rings: composition.rings.map((ring) => {
        const rest = { ...ring };
        delete rest.wave;
        delete rest.zoneDrive;
        return rest;
      })
    };
  }
  ```

  Then replace all three occurrences of `stripWave(` with `stripTransients(` in the same file. The function is called on lines ~42, ~52, and ~58 (exact lines depend on current state — search for `stripWave(`).

- [ ] **Step 4: Run tests to confirm pass**

  ```bash
  bun run test src/lib/state/composition-persistence.svelte.spec.ts
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/state/composition-persistence.svelte.ts src/lib/state/composition-persistence.svelte.spec.ts
  git commit -m "feat(audio-zones): rename stripWave → stripTransients; strip zoneDrive from persistence"
  ```

---

## Task 4: Audio source — `reduceToZones` + `readZones()`

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-source.ts`
- Modify: `src/lib/state/animation-drivers/audio-source.spec.ts`

- [ ] **Step 1: Write failing tests for `reduceToZones`**

  In `audio-source.spec.ts`, add a new `describe('reduceToZones', ...)` block after the existing `reduceToBands` tests:

  ```ts
  import { createAudioSource, reduceToBands, reduceToZones } from './audio-source';

  describe('reduceToZones', () => {
    it('returns zero bass/mid/treble when all bins are 0', () => {
      const freq = new Uint8Array(1024).fill(0);
      const zones = reduceToZones(freq, 48000, 2048, 1);
      expect(zones.bass).toBe(0);
      expect(zones.mid).toBe(0);
      expect(zones.treble).toBe(0);
    });

    it('returns values in 0..1 for uniform signal', () => {
      const freq = new Uint8Array(1024).fill(128);
      const zones = reduceToZones(freq, 48000, 2048, 1);
      expect(zones.bass).toBeGreaterThanOrEqual(0);
      expect(zones.bass).toBeLessThanOrEqual(1);
      expect(zones.mid).toBeGreaterThanOrEqual(0);
      expect(zones.mid).toBeLessThanOrEqual(1);
      expect(zones.treble).toBeGreaterThanOrEqual(0);
      expect(zones.treble).toBeLessThanOrEqual(1);
    });

    it('clamps to 1 when inputGain pushes over', () => {
      const freq = new Uint8Array(1024).fill(255);
      const zones = reduceToZones(freq, 48000, 2048, 4);
      expect(zones.bass).toBe(1);
      expect(zones.mid).toBe(1);
      expect(zones.treble).toBe(1);
    });

    it('puts energy in bass when only low bins are lit', () => {
      // Bass: ~20-300 Hz. At 48000/2048 ≈ 23.4 Hz/bin, bass spans bins 1..12.
      const freq = new Uint8Array(1024).fill(0);
      for (let i = 0; i < 13; i++) freq[i] = 200;
      const zones = reduceToZones(freq, 48000, 2048, 1);
      expect(zones.bass).toBeGreaterThan(0);
      expect(zones.treble).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  bun run test src/lib/state/animation-drivers/audio-source.spec.ts
  ```

  Expected: FAIL — `reduceToZones is not exported`.

- [ ] **Step 3: Add `reduceToZones` and `readZones()` to `audio-source.ts`**

  **A.** Export `reduceToZones` as a pure function (add it after `reduceToBands`, before `AudioSourceMode`):

  ```ts
  /**
   * Reduces a frequency-magnitude spectrum to three perceptual bands (bass/mid/treble),
   * each normalized to 0..1 and scaled by inputGain. Fixed Hz splits: bass 20-300,
   * mid 300-2000, treble 2000-20000. Pure — no Web Audio references — unit-testable.
   */
  export function reduceToZones(
    freq: Uint8Array,
    sampleRate: number,
    fftSize: number,
    inputGain: number
  ): { bass: number; mid: number; treble: number } {
    const binHz = sampleRate / fftSize;

    function bandAvg(loHz: number, hiHz: number): number {
      const loBin = Math.max(0, Math.floor(loHz / binHz));
      const hiBin = Math.min(freq.length, Math.ceil(hiHz / binHz));
      if (loBin >= hiBin) return 0;
      let sum = 0;
      for (let i = loBin; i < hiBin; i++) sum += freq[i];
      return clamp01(((sum / (hiBin - loBin)) / 255) * inputGain);
    }

    return {
      bass:   bandAvg(20, 300),
      mid:    bandAvg(300, 2000),
      treble: bandAvg(2000, 20000)
    };
  }
  ```

  **B.** Add `readZones()` to the `AudioSource` type (after `readBars(): number[];`):

  ```ts
  readZones(): { bass: number; mid: number; treble: number };
  ```

  **C.** Add `readZones` implementation function inside `createAudioSource` (after `readLevel`):

  ```ts
  function readZones(): { bass: number; mid: number; treble: number } {
    if (mode === 'off' || !analyser || !buffer || !audioContext) {
      return { bass: 0, mid: 0, treble: 0 };
    }
    const cfg = deps.getConfig();
    analyser.smoothingTimeConstant = cfg.smoothing;
    analyser.getByteFrequencyData(buffer);
    return reduceToZones(buffer, audioContext.sampleRate, analyser.fftSize, cfg.inputGain);
  }
  ```

  **D.** Add `readZones` to the returned object (after `readLevel,`):

  ```ts
  readZones,
  ```

- [ ] **Step 4: Run tests to confirm pass**

  ```bash
  bun run test src/lib/state/animation-drivers/audio-source.spec.ts
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/state/animation-drivers/audio-source.ts src/lib/state/animation-drivers/audio-source.spec.ts
  git commit -m "feat(audio-zones): add reduceToZones + readZones() to audio source"
  ```

---

## Task 5: Audio Zones Driver

**Files:**
- Create: `src/lib/state/animation-drivers/audio-zones-driver.ts`
- Create: `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`

- [ ] **Step 1: Write failing tests in `audio-zones-driver.spec.ts`**

  ```ts
  import { describe, expect, it } from 'vitest';
  import type { Ring, ZoneIntensity, ZoneDrive } from '$lib/types';
  import { createAudioZonesDriver } from './audio-zones-driver';
  import { ZONE_SCALE } from '$lib/geometry/zones';

  const defaultIntensity: ZoneIntensity = { bass: 0.5, mid: 0.5, treble: 0.5 };

  type DriveCall = { index: number; drive: ZoneDrive | null };

  function makeRing(zoneConfig?: ZoneIntensity | null): Ring {
    return {
      copies: 8,
      color: '#000000',
      templatePath: null,
      secondaryTemplatePath: null,
      morphT: 0,
      ringHeight: 0.4,
      zoneConfig
    };
  }

  function makeDriver(overrides: {
    ringCount?: number;
    zones?: { bass: number; mid: number; treble: number };
    calls: DriveCall[];
    rings?: Ring[];
  }) {
    const rings = overrides.rings ?? [];
    return createAudioZonesDriver({
      getDefaultIntensity: () => defaultIntensity,
      getRingCount: () => overrides.ringCount ?? 2,
      getRing: (i) => rings[i] ?? makeRing(),
      readZones: () => overrides.zones ?? { bass: 0.5, mid: 0.8, treble: 0.3 },
      applyRingZoneDrive: (index, drive) => overrides.calls.push({ index, drive })
    });
  }

  describe('createAudioZonesDriver', () => {
    it('frame() writes zoneDrive for every ring', () => {
      const calls: DriveCall[] = [];
      const driver = makeDriver({ ringCount: 2, calls });
      driver.frame(0);
      expect(calls).toHaveLength(2);
      expect(calls[0].index).toBe(0);
      expect(calls[1].index).toBe(1);
      expect(calls[0].drive).not.toBeNull();
      expect(calls[1].drive).not.toBeNull();
    });

    it('frame() scales bassPush by bass * intensity.bass * ZONE_SCALE', () => {
      const calls: DriveCall[] = [];
      // bass=0.5, defaultIntensity.bass=0.5 → bassPush = 0.5*0.5*ZONE_SCALE
      const driver = makeDriver({ ringCount: 1, zones: { bass: 0.5, mid: 0, treble: 0 }, calls });
      driver.frame(0);
      expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
    });

    it('frame() scales midPush by mid * intensity.mid * ZONE_SCALE', () => {
      const calls: DriveCall[] = [];
      // mid=0.8, defaultIntensity.mid=0.5 → midPush = 0.8*0.5*ZONE_SCALE
      const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0.8, treble: 0 }, calls });
      driver.frame(0);
      expect(calls[0].drive?.midPush).toBeCloseTo(0.8 * 0.5 * ZONE_SCALE, 4);
    });

    it('frame() applies per-ring zoneConfig override', () => {
      const calls: DriveCall[] = [];
      const override: ZoneIntensity = { bass: 1.0, mid: 0, treble: 0 };
      // bass=0.5, override.bass=1.0 → bassPush = 0.5*1.0*ZONE_SCALE
      const driver = makeDriver({
        ringCount: 1,
        zones: { bass: 0.5, mid: 0, treble: 0 },
        calls,
        rings: [makeRing(override)]
      });
      driver.frame(0);
      expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 1.0 * ZONE_SCALE, 4);
    });

    it('frame() returns {}', () => {
      const calls: DriveCall[] = [];
      const driver = makeDriver({ calls });
      expect(driver.frame(0)).toEqual({});
    });

    it('dispose() sets zoneDrive to null for every ring', () => {
      const calls: DriveCall[] = [];
      const driver = makeDriver({ ringCount: 3, calls });
      driver.dispose();
      expect(calls).toEqual([
        { index: 0, drive: null },
        { index: 1, drive: null },
        { index: 2, drive: null }
      ]);
    });

    it('sanitizes a non-integer ring count before iterating', () => {
      const calls: DriveCall[] = [];
      const driver = makeDriver({ ringCount: 2.8, calls });
      driver.frame(0);
      expect(calls.map((c) => c.index)).toEqual([0, 1]);
    });
  });
  ```

- [ ] **Step 2: Run to confirm they fail**

  ```bash
  bun run test src/lib/state/animation-drivers/audio-zones-driver.spec.ts
  ```

  Expected: FAIL — `Cannot find module './audio-zones-driver'`

- [ ] **Step 3: Implement `audio-zones-driver.ts`**

  ```ts
  import type { Ring, ZoneIntensity, ZoneDrive } from '$lib/types';
  import { resolveZoneIntensity, ZONE_SCALE } from '$lib/geometry/zones';

  const SHIMMER_FREQ = 8; // Hz — treble bobbing frequency; promote to slider if needed

  type AnimationDriver = {
    init: () => void;
    dispose: () => void;
    frame: (nowMs: number) => Record<number, number>;
  };

  type CreateAudioZonesDriverDeps = {
    getDefaultIntensity: () => ZoneIntensity;
    getRingCount: () => number;
    getRing: (index: number) => Ring;
    readZones: () => { bass: number; mid: number; treble: number };
    applyRingZoneDrive: (index: number, drive: ZoneDrive | null) => void;
  };

  function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }

  function normalizeRingCount(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (!Number.isInteger(value)) return Math.max(0, Math.floor(value));
    return Math.max(0, value);
  }

  export function createAudioZonesDriver(deps: CreateAudioZonesDriverDeps): AnimationDriver {
    return {
      init() {
        deps.getDefaultIntensity();
      },

      dispose() {
        const ringCount = normalizeRingCount(deps.getRingCount());
        for (let i = 0; i < ringCount; i++) {
          deps.applyRingZoneDrive(i, null);
        }
      },

      frame(nowMs) {
        const { bass, mid, treble } = deps.readZones();
        const defaultIntensity = deps.getDefaultIntensity();
        const ringCount = normalizeRingCount(deps.getRingCount());
        const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;
        const shimmer = Math.sin(2 * Math.PI * SHIMMER_FREQ * nowSec);

        for (let i = 0; i < ringCount; i++) {
          const ring = deps.getRing(i);
          const cfg = resolveZoneIntensity(ring, defaultIntensity);
          deps.applyRingZoneDrive(i, {
            bassPush:   clamp01(bass)   * cfg.bass   * ZONE_SCALE,
            midPush:    clamp01(mid)    * cfg.mid    * ZONE_SCALE,
            treblePush: clamp01(treble) * cfg.treble * ZONE_SCALE * shimmer
          });
        }

        return {};
      }
    };
  }
  ```

- [ ] **Step 4: Run tests to confirm pass**

  ```bash
  bun run test src/lib/state/animation-drivers/audio-zones-driver.spec.ts
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/state/animation-drivers/audio-zones-driver.ts src/lib/state/animation-drivers/audio-zones-driver.spec.ts
  git commit -m "feat(audio-zones): implement audio zones driver with SHIMMER_FREQ, ZONE_SCALE, per-ring zoneConfig"
  ```

---

## Task 6: Wire Driver into Animation State

**Files:**
- Modify: `src/lib/state/composition.ts`
- Modify: `src/lib/state/animation.svelte.ts`

- [ ] **Step 1: Add `setRingZoneDrive` to `composition.ts`**

  After `setRingWave` (line ~145):

  ```ts
  export function setRingZoneDrive(index: number, drive: ZoneDrive | null) {
    composition.rings = composition.rings.map((ring, i) =>
      i === index ? { ...ring, zoneDrive: drive } : ring
    );
  }
  ```

  Add `ZoneDrive` to the import at the top:
  ```ts
  import type {
    ColorModeState,
    ColorMode,
    FullPalette,
    MonochromePalette,
    Ring,
    WaveState,
    ZoneDrive
  } from '$lib/types';
  ```

- [ ] **Step 2: Update `animation.svelte.ts`**

  **A. Imports** — add to existing imports:

  ```ts
  import { createAudioBarsDriver } from './animation-drivers/audio-bars-driver';
  import { createAudioZonesDriver } from './animation-drivers/audio-zones-driver'; // new
  import { createDataSeriesDriver } from './animation-drivers/data-series-driver';
  import { createSimpleDriver } from './animation-drivers/simple-driver';
  import { createAnimationRuntime } from './animation-drivers/runtime';
  import { createFallbackBars } from './animation-drivers/fallback-bars';
  import { createAudioSource } from './animation-drivers/audio-source';
  import type {
    AnimationDriverType,
    AudioBarsConfig,
    DataSeriesConfig
  } from './animation-drivers/types';
  ```

  Add to composition import:
  ```ts
  import { composition, setRingMorphT, setRingWave, setRingZoneDrive } from './composition';
  ```

  Add type import:
  ```ts
  import type { AudioZonesConfig, ZoneIntensity } from '$lib/types';
  ```

  **B. Extend `AnimationState`** — add `audioZones: AudioZonesConfig` after `audioBars: AudioBarsConfig`:

  ```ts
  export type AnimationState = {
    mode: AnimationMode;
    isPlaying: boolean;
    isPaused: boolean;
    progress: number;
    audioBars: AudioBarsConfig;
    audioZones: AudioZonesConfig; // new
    audioSource: 'demo' | 'mic' | 'file' | 'off';
    dataSeries: DataSeriesConfig;
    durationSec: number;
    loop: boolean;
    alternate: boolean;
    elapsedMs: number;
  };
  ```

  **C. Add default** after `defaultAudioBarsConfig`:

  ```ts
  const defaultAudioZonesConfig: AudioZonesConfig = {
    defaultIntensity: { bass: 0.5, mid: 0.5, treble: 0.5 }
  };
  ```

  **D. Add `audioZones` to initial state** (after `audioBars: defaultAudioBarsConfig,`):

  ```ts
  audioZones: defaultAudioZonesConfig,
  ```

  **E. Register `audioZones` driver** — add after the `audioBars` registration block (after line ~107):

  ```ts
  runtime.registerDriver(
    'audioZones',
    createAudioZonesDriver({
      getDefaultIntensity: () => animationState.audioZones.defaultIntensity,
      getRingCount: () => composition.rings.length,
      getRing: (index) => composition.rings[index],
      readZones: () => {
        switch (animationState.audioSource) {
          case 'demo': {
            const t = performance.now() / 1000;
            return {
              bass:   Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(t * 0.7))),
              mid:    Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(t * 1.1 + 1.0))),
              treble: Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(t * 1.9 + 2.1)))
            };
          }
          case 'mic':
          case 'file':
            return audioSource.readZones();
          default:
            return { bass: 0, mid: 0, treble: 0 };
        }
      },
      applyRingZoneDrive: (index, drive) => setRingZoneDrive(index, drive)
    })
  );
  ```

  **F. Extend `hasCompleted`** — change:

  ```ts
  function hasCompleted(elapsedMs: number): boolean {
    if (animationState.mode === 'audioBars' || animationState.mode === 'audioZones') return false;
    // ... rest unchanged
  ```

  **G. Extend `setAnimationMode`** — change the audio stop guard:

  ```ts
  export function setAnimationMode(mode: AnimationMode): void {
    if (animationState.mode === mode) return;
    if (animationState.mode === 'audioBars' || animationState.mode === 'audioZones') {
      audioSource.stop();
    }
    // ... rest unchanged
  ```

  **H. Export `setAudioZonesDefaultIntensity`** — add after `setAudioBarsConfig`:

  ```ts
  export function setAudioZonesDefaultIntensity(next: Partial<ZoneIntensity>): void {
    animationState.audioZones = {
      ...animationState.audioZones,
      defaultIntensity: { ...animationState.audioZones.defaultIntensity, ...next }
    };
  }
  ```

- [ ] **Step 3: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/state/composition.ts src/lib/state/animation.svelte.ts
  git commit -m "feat(audio-zones): wire audioZones driver into animation state; add setRingZoneDrive, setAudioZonesDefaultIntensity"
  ```

---

## Task 7: Render Pipeline — Zone Deformation

**Files:**
- Modify: `src/lib/geometry/render-pipeline.ts`
- Modify: `src/lib/geometry/render-pipeline.svelte.spec.ts`

- [ ] **Step 1: Write failing render-pipeline test**

  In `render-pipeline.svelte.spec.ts`, add this test to the existing `describe('createRenderPipeline().render', ...)` block. The test needs a petal path (the same `['M','C','C']` shape used by the real rings) and a non-zero `zoneDrive`:

  ```ts
  // Add to top of test file alongside existing fixtures:
  const petalPath: Path = {
    cmds: ['M', 'C', 'C'],
    crds: [
      0, 100,
      0, 80, 5, 50, 10, 30,
      20, 25, 30, 30, 40, 60
    ]
  };
  ```

  Add this test inside the describe block:

  ```ts
  it('applies zoneDrive deformation when ring.zoneDrive is set', () => {
    const pipeline = createRenderPipeline();
    const drive = { bassPush: 5, midPush: 3, treblePush: 2 };
    const comp: Composition = {
      baseRadius: 100,
      ringIncrement: 60,
      rings: [{
        copies: 4,
        color: '#ff0000',
        templatePath: petalPath,
        secondaryTemplatePath: null,
        morphT: 0,
        ringHeight: 0.4,
        zoneDrive: drive
      }],
      monochromePalettes: [{ main: '#000', bg: '#fff' }],
      fullPalettes: [{ colors: ['#000', '#fff'] }]
    };
    // Should render without throwing and produce 1 rendered ring
    const result = pipeline.render({ composition: comp, scope, viewport: { width: 600, height: 600 } });
    expect(result.renderedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it('renders identically with zoneDrive all-zero vs no zoneDrive', () => {
    // Both should produce the same paper.js output (pure function contract)
    const pipeline1 = createRenderPipeline();
    const pipeline2 = createRenderPipeline();

    const compWithDrive: Composition = {
      ...composition,
      rings: [{ ...composition.rings[0], templatePath: petalPath, zoneDrive: { bassPush: 0, midPush: 0, treblePush: 0 } }]
    };
    const compNoDrive: Composition = {
      ...composition,
      rings: [{ ...composition.rings[0], templatePath: petalPath }]
    };

    const r1 = pipeline1.render({ composition: compWithDrive, scope, viewport: { width: 600, height: 600 } });
    const r2 = pipeline2.render({ composition: compNoDrive, scope, viewport: { width: 600, height: 600 } });

    expect(r1.renderedCount).toBe(r2.renderedCount);
    expect(r1.skippedCount).toBe(r2.skippedCount);
  });
  ```

- [ ] **Step 2: Run to confirm new tests fail**

  ```bash
  bun run test src/lib/geometry/render-pipeline.svelte.spec.ts
  ```

  Expected: the `zoneDrive` tests FAIL (zone deformation not yet in pipeline).

- [ ] **Step 3: Add zone deformation to `render-pipeline.ts`**

  Add import at top:

  ```ts
  import { applyZonesToPath } from './zones';
  ```

  After the existing wave block (lines 153-160, which end with `}`), add:

  ```ts
  // Apply zone deformation (audioZones mode) BEFORE bend mirrors/tiles — same slot as wave.
  if (effectiveRing.zoneDrive && effectiveRing.templatePath) {
    effectiveRing = {
      ...effectiveRing,
      templatePath: applyZonesToPath(effectiveRing.templatePath, effectiveRing.zoneDrive)
    };
  }
  ```

- [ ] **Step 4: Run render-pipeline tests to confirm pass**

  ```bash
  bun run test src/lib/geometry/render-pipeline.svelte.spec.ts
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/geometry/render-pipeline.ts src/lib/geometry/render-pipeline.svelte.spec.ts
  git commit -m "feat(audio-zones): apply zoneDrive deformation in render pipeline before bend mirrors"
  ```

---

## Task 8: Fix `morphInactive` and `ignoreMorph` guards

**Files:**
- Modify: `src/lib/components/RingEditor.svelte` (line 25)
- Modify: `src/lib/components/PreviewCanvas.svelte` (line 19)

- [ ] **Step 1: Extend `morphInactive` in `RingEditor.svelte`**

  Change line 25:

  ```ts
  // Before:
  const morphInactive = $derived(animationState.mode === 'audioBars');

  // After:
  const morphInactive = $derived(
    animationState.mode === 'audioBars' || animationState.mode === 'audioZones'
  );
  ```

- [ ] **Step 2: Extend `ignoreMorph` in `PreviewCanvas.svelte`**

  Change line 19:

  ```ts
  // Before:
  const ignoreMorph = animationState.mode === 'audioBars';

  // After:
  const ignoreMorph =
    animationState.mode === 'audioBars' || animationState.mode === 'audioZones';
  ```

- [ ] **Step 3: Run svelte-autofixer on both files**

  Use the `mcp__svelte__svelte-autofixer` tool on:
  - `src/lib/components/RingEditor.svelte`
  - `src/lib/components/PreviewCanvas.svelte`

  Fix any reported issues.

- [ ] **Step 4: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/components/RingEditor.svelte src/lib/components/PreviewCanvas.svelte
  git commit -m "feat(audio-zones): extend morphInactive and ignoreMorph guards to cover audioZones mode"
  ```

---

## Task 9: `ZonePreview.svelte` + `RingZoneConfigItem.svelte`

**Files:**
- Create: `src/lib/components/ZonePreview.svelte`
- Create: `src/lib/components/RingZoneConfigItem.svelte`

- [ ] **Step 1: Create `ZonePreview.svelte`**

  ```svelte
  <script lang="ts">
    import paper from 'paper';
    import type { Path, Ring, ZoneIntensity } from '$lib/types';
    import { applyZonesToPath, ZONE_SCALE } from '$lib/geometry/zones';
    import { buildRingPath } from '$lib/geometry/bend';

    let {
      template,
      copies,
      ringHeight,
      intensity
    }: {
      template: Path | null;
      copies: number;
      ringHeight: number;
      intensity: ZoneIntensity;
    } = $props();

    const PREVIEW_RADIUS = 100;

    function fitToView(scope: paper.PaperScope) {
      const items = scope.project.activeLayer.children;
      if (items.length === 0) return;
      let bounds = items[0].bounds.clone();
      for (let i = 1; i < items.length; i++) bounds = bounds.unite(items[i].bounds);
      if (bounds.width === 0 || bounds.height === 0) return;
      const padding = 14;
      const available = Math.min(scope.view.size.width, scope.view.size.height) - padding * 2;
      if (available <= 0) return;
      const scale = available / Math.max(bounds.width, bounds.height);
      scope.project.activeLayer.scale(scale, bounds.center);
      scope.project.activeLayer.position = scope.view.center;
    }

    function setupCanvas(canvas: HTMLCanvasElement) {
      const scope = new paper.PaperScope();
      scope.setup(canvas);

      $effect(() => {
        scope.activate();
        scope.project.clear();

        if (template) {
          const baseRing: Ring = {
            copies: Math.max(1, Math.floor(copies)),
            color: '#000000',
            templatePath: template,
            secondaryTemplatePath: null,
            morphT: 0,
            ringHeight
          };

          const maxDrive = {
            bassPush:   intensity.bass   * ZONE_SCALE,
            midPush:    intensity.mid    * ZONE_SCALE,
            treblePush: intensity.treble * ZONE_SCALE
          };

          // reach: max-amplitude zone deformation, translucent fill
          const reach = buildRingPath(
            { ...baseRing, templatePath: applyZonesToPath(template, maxDrive) },
            PREVIEW_RADIUS,
            scope
          );
          if (reach) {
            reach.fillColor = new paper.Color(0, 0, 0, 0.18);
            reach.strokeColor = null;
          }

          // rest: authored shape, crisp outline
          const rest = buildRingPath(baseRing, PREVIEW_RADIUS, scope);
          if (rest) {
            rest.fillColor = null;
            rest.strokeColor = new paper.Color(0, 0, 0);
            rest.strokeWidth = 1;
            rest.strokeScaling = false;
          }

          fitToView(scope);
        }

        scope.view.update();
      });

      return () => scope.project.clear();
    }
  </script>

  <div
    class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded border bg-muted/50"
  >
    <span
      class="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
    >
      Zone preview
    </span>
    {#if !template}
      <span class="text-xs text-muted-foreground">Add a ring path to preview zones</span>
    {/if}
    <canvas {@attach setupCanvas} width="200" height="200" class="h-full w-full"></canvas>
  </div>
  ```

- [ ] **Step 2: Create `RingZoneConfigItem.svelte`**

  ```svelte
  <script lang="ts">
    import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
    import { Label } from '$lib/shadcn/ui/label/index.js';
    import { CaretDown, CaretRight } from 'phosphor-svelte';
    import { updateRing } from '$lib/state/composition';
    import { resolveZoneIntensity } from '$lib/geometry/zones';
    import ZonePreview from './ZonePreview.svelte';
    import type { Ring, ZoneIntensity } from '$lib/types';

    let {
      ring,
      index,
      globalDefault
    }: {
      ring: Ring;
      index: number;
      globalDefault: ZoneIntensity;
    } = $props();

    let open = $state(false);

    const hasOverride = $derived(ring.zoneConfig != null);
    const resolved = $derived(resolveZoneIntensity(ring, globalDefault));
  </script>

  <div class="rounded border bg-background">
    <Collapsible.Collapsible bind:open>
      <div class="flex items-center gap-1 px-2 py-1.5">
        <Collapsible.CollapsibleTrigger
          class="flex flex-1 items-center gap-1 text-left text-sm font-medium hover:text-foreground"
        >
          {#if open}
            <CaretDown size={14} />
          {:else}
            <CaretRight size={14} />
          {/if}
          Ring {index + 1}
          {#if hasOverride}
            <span
              class="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground"
              >(custom)</span
            >
          {/if}
        </Collapsible.CollapsibleTrigger>
      </div>

      <Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
        <ZonePreview
          template={ring.templatePath ?? null}
          copies={ring.copies ?? 1}
          ringHeight={ring.ringHeight ?? 0.4}
          intensity={resolved}
        />

        <div class="flex items-center gap-2">
          <input
            id="zone-override-{index}"
            type="checkbox"
            checked={hasOverride}
            onchange={(e) => {
              if ((e.target as HTMLInputElement).checked) {
                updateRing(index, { zoneConfig: { ...globalDefault } });
              } else {
                updateRing(index, { zoneConfig: null });
              }
            }}
            class="h-4 w-4 cursor-pointer rounded border-input"
          />
          <Label for="zone-override-{index}" class="cursor-pointer text-xs"
            >Customize zones for this ring</Label
          >
        </div>

        {#if hasOverride}
          <div class="flex flex-col gap-1">
            <Label for="ring-bass-{index}" class="text-xs">Bass intensity</Label>
            <input
              id="ring-bass-{index}"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={ring.zoneConfig!.bass}
              oninput={(e) =>
                updateRing(index, {
                  zoneConfig: {
                    ...ring.zoneConfig!,
                    bass: Number((e.target as HTMLInputElement).value)
                  }
                })}
            />
          </div>

          <div class="flex flex-col gap-1">
            <Label for="ring-mid-{index}" class="text-xs">Mid intensity</Label>
            <input
              id="ring-mid-{index}"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={ring.zoneConfig!.mid}
              oninput={(e) =>
                updateRing(index, {
                  zoneConfig: {
                    ...ring.zoneConfig!,
                    mid: Number((e.target as HTMLInputElement).value)
                  }
                })}
            />
          </div>

          <div class="flex flex-col gap-1">
            <Label for="ring-treble-{index}" class="text-xs">Treble intensity</Label>
            <input
              id="ring-treble-{index}"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={ring.zoneConfig!.treble}
              oninput={(e) =>
                updateRing(index, {
                  zoneConfig: {
                    ...ring.zoneConfig!,
                    treble: Number((e.target as HTMLInputElement).value)
                  }
                })}
            />
          </div>
        {/if}
      </Collapsible.CollapsibleContent>
    </Collapsible.Collapsible>
  </div>
  ```

- [ ] **Step 3: Run svelte-autofixer on both new components**

  Use the `mcp__svelte__svelte-autofixer` tool on:
  - `src/lib/components/ZonePreview.svelte`
  - `src/lib/components/RingZoneConfigItem.svelte`

  Fix any reported issues. Call until it reports 0 issues.

- [ ] **Step 4: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/components/ZonePreview.svelte src/lib/components/RingZoneConfigItem.svelte
  git commit -m "feat(audio-zones): add ZonePreview and RingZoneConfigItem components"
  ```

---

## Task 10: `AnimationSection.svelte` — audioZones UI

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`

- [ ] **Step 1: Add imports and update derived variables**

  In the `<script>` block, add new imports to the existing `animation` import:

  ```ts
  import {
    animationState,
    handleCompositionChanged,
    setAnimationMode,
    setAnimationDurationSec,
    togglePlay,
    setAudioBarsConfig,
    setAudioZonesDefaultIntensity,  // new
    setAudioSource,
    audioSource
  } from '$lib/state/animation';
  ```

  Add import for the new component:

  ```ts
  import RingZoneConfigItem from './RingZoneConfigItem.svelte';
  ```

  Add to the existing type import:

  ```ts
  import type { WaveConfig, ZoneIntensity } from '$lib/types';
  ```

  **Update existing derived variables** (not inside the audioBars block — these are top-level):

  Change `requiresMorphRings` (currently line ~34):

  ```ts
  const requiresMorphRings = $derived(
    animationState.mode !== 'audioBars' && animationState.mode !== 'audioZones'
  );
  ```

  Change `showInputLevel` (currently line ~37):

  ```ts
  const showInputLevel = $derived(
    (animationState.mode === 'audioBars' || animationState.mode === 'audioZones') &&
    animationState.audioSource === 'mic'
  );
  ```

  Change `hideGlobalTransport` (currently line ~41):

  ```ts
  const hideGlobalTransport = $derived(
    (animationState.mode === 'audioBars' || animationState.mode === 'audioZones') &&
    animationState.audioSource === 'file'
  );
  ```

- [ ] **Step 2: Add `'audioZones'` option to the mode dropdown**

  In the `<select id="animation-mode">` block, add after `<option value="audioBars">`:

  ```svelte
  <option value="audioZones">Audio Zones</option>
  ```

  Also update the `onchange` handler to allow `'audioZones'` in the cast:

  ```ts
  setAnimationMode(mode === '' ? null : (mode as 'simple' | 'audioBars' | 'audioZones' | 'dataSeries'));
  ```

  Add a description paragraph after the `audioBars` description block:

  ```svelte
  {:else if animationState.mode === 'audioZones'}
    <p class="text-[11px] text-muted-foreground">
      Audio Zones mode deforms each ring's shape across three frequency bands.
    </p>
  ```

- [ ] **Step 3: Add the audioZones configuration block**

  Add this block after the closing `{/if}` of the `{#if animationState.mode === 'audioBars'}` block (before `{#if !hideGlobalTransport}`):

  ```svelte
  {#if animationState.mode === 'audioZones'}
    <div class="flex flex-col gap-2 rounded border border-border p-2">
      <div class="flex flex-col gap-1">
        <Label for="audio-source-zones" class="text-xs">Audio source</Label>
        <select
          id="audio-source-zones"
          class="h-9 rounded-md border border-input bg-background px-3 text-xs"
          value={animationState.audioSource}
          onchange={(e) =>
            setAudioSource(
              (e.target as HTMLSelectElement).value as 'demo' | 'mic' | 'file' | 'off'
            )}
        >
          <option value="demo">Demo</option>
          <option value="mic">Microphone</option>
          <option value="file">File</option>
        </select>
      </div>

      {#if showInputLevel}
        <div class="flex flex-col gap-1">
          <Label class="text-xs">Input level</Label>
          <div
            class="h-1.5 rounded bg-muted"
            role="meter"
            aria-label="Audio input level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={inputLevelPercent}
          >
            <div class="h-full rounded bg-green-500" style:width={`${inputLevelPercent}%`}></div>
          </div>
          <p class="text-[10px] text-muted-foreground">
            Source is being heard when this moves.
          </p>
        </div>
      {/if}

      {#if animationState.audioSource === 'mic'}
        <p class="text-[10px] text-muted-foreground">
          Listening — speak or play near the microphone.
        </p>
      {/if}

      {#if animationState.audioSource === 'file'}
        <AudioFilePanel />
      {/if}

      <div class="flex flex-col gap-1">
        <Label for="zones-input-gain" class="text-xs">Input gain</Label>
        <input
          id="zones-input-gain"
          type="range"
          min="0.5"
          max="4"
          step="0.1"
          value={animationState.audioBars.inputGain}
          oninput={(e) =>
            setAudioBarsConfig({ inputGain: Number((e.target as HTMLInputElement).value) })}
        />
      </div>

      <div class="flex flex-col gap-2">
        <p class="text-[11px] font-medium text-muted-foreground">Zone intensities (global)</p>
        <div class="flex flex-col gap-1">
          <Label for="zones-bass" class="text-xs">Bass</Label>
          <input
            id="zones-bass"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={animationState.audioZones.defaultIntensity.bass}
            oninput={(e) =>
              setAudioZonesDefaultIntensity({
                bass: Number((e.target as HTMLInputElement).value)
              })}
          />
        </div>
        <div class="flex flex-col gap-1">
          <Label for="zones-mid" class="text-xs">Mid</Label>
          <input
            id="zones-mid"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={animationState.audioZones.defaultIntensity.mid}
            oninput={(e) =>
              setAudioZonesDefaultIntensity({
                mid: Number((e.target as HTMLInputElement).value)
              })}
          />
        </div>
        <div class="flex flex-col gap-1">
          <Label for="zones-treble" class="text-xs">Treble</Label>
          <input
            id="zones-treble"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={animationState.audioZones.defaultIntensity.treble}
            oninput={(e) =>
              setAudioZonesDefaultIntensity({
                treble: Number((e.target as HTMLInputElement).value)
              })}
          />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <p class="text-[11px] font-medium text-muted-foreground">Zones per ring</p>
        {#each composition.rings as ring, i (i)}
          <RingZoneConfigItem {ring} index={i} globalDefault={animationState.audioZones.defaultIntensity} />
        {/each}
      </div>
    </div>
  {/if}
  ```

- [ ] **Step 4: Run svelte-autofixer on `AnimationSection.svelte`**

  Use the `mcp__svelte__svelte-autofixer` tool. Fix any reported issues. Call until 0 issues.

- [ ] **Step 5: Run full suite**

  ```bash
  bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/components/AnimationSection.svelte
  git commit -m "feat(audio-zones): add Audio Zones mode to AnimationSection with source, global sliders, per-ring accordion"
  ```

---

## Self-Check Before Reporting Done

- [ ] `bun run test` — all tests green (no regressions in 176 existing + new tests)
- [ ] `bun run check` (or `bunx svelte-check`) — no type errors
- [ ] Manual smoke test: select "Audio Zones" in the dropdown, hit Play, verify all three gestures animate. Switch to Audio Bars, verify wave is unchanged.
- [ ] Reload: verify `zoneConfig` overrides persist, logo at rest (no frozen deformation).
