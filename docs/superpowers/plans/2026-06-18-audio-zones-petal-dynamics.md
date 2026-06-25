# Audio Zones Petal Dynamics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `audioZones` petals react to sound with transient punch (per-band attack/release envelopes) and richer multi-axis deformation, porting the feel of the `mandala-bettona` sketch.

**Architecture:** Keep the existing data flow `readZones() → driver → ZoneDrive → applyZonesToPath → render`. Add per-band envelope state inside the driver (asymmetric lerp). Extend the `ZoneDrive` contract so each band deforms the petal on multiple axes, and enrich `applyZonesToPath` accordingly. Envelope coefficients are global config exposed as UI sliders.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vitest (node + browser), paper.js.

## Global Constraints

- Package manager: **bun**. Run tests with `bun run test:unit -- run <path>` (vitest, single run).
- Geometry only — no colour/brightness/scale/stroke coupling.
- Envelopes are **global** (per-band), never per-ring. Per-ring config stays intensity-only.
- Treble vibration is **fixed frequency**, amplitude scaled by treble level.
- Per-frame lerp (no `dt` normalisation) — assumes steady ~60fps rAF. Document inline.
- `audio-source.ts`, `render-pipeline.ts`, bend/morph are **untouched**.
- Pure functions stay pure (`applyZonesToPath` must never mutate input).

---

## File Structure

- `src/lib/types.ts` — add `EnvelopeParams`, extend `AudioZonesConfig` with `envelopes`, extend `ZoneDrive` to 4 fields.
- `src/lib/state/animation.svelte.ts` — default envelopes, `setAudioZonesEnvelope` setter, `getEnvelopes` driver dep.
- `src/lib/state/animation-drivers/audio-zones-driver.ts` — stateful per-band envelope; emit enriched `ZoneDrive`.
- `src/lib/geometry/zones.ts` — enriched `applyZonesToPath` (mid 2-axis, treble retract + vibrate).
- `src/lib/components/AnimationSection.svelte` — 6 envelope sliders.
- `src/lib/components/ZonePreview.svelte` — static preview updated to 4-field `ZoneDrive`.
- Specs: `audio-zones-driver.spec.ts`, `zones.spec.ts`, `AnimationSection.svelte.spec.ts`.

Task order keeps the tree compiling and green at every commit. Tasks 1–2 add the envelope (punch) with `ZoneDrive` unchanged. Task 3 makes the atomic `ZoneDrive` contract change (rich deformation) across geometry + driver + preview together.

---

## Task 1: Per-band envelope in the driver (punch)

Adds asymmetric attack/release smoothing per band inside the driver. `ZoneDrive` keeps its current 3 fields here.

**Files:**
- Modify: `src/lib/types.ts` (add `EnvelopeParams`, extend `AudioZonesConfig`)
- Modify: `src/lib/state/animation.svelte.ts` (defaults, setter, driver dep)
- Modify: `src/lib/state/animation-drivers/audio-zones-driver.ts`
- Test: `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`

**Interfaces:**
- Produces:
  - `type EnvelopeParams = { attack: number; release: number }`
  - `AudioZonesConfig = { defaultIntensity: ZoneIntensity; envelopes: { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams } }`
  - `setAudioZonesEnvelope(band: 'bass' | 'mid' | 'treble', next: Partial<EnvelopeParams>): void`
  - Driver dep `getEnvelopes: () => { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams }`
- Consumes: existing `ZoneDrive = { bassPush; midPush; treblePush }` (unchanged in this task).

- [ ] **Step 1: Add the envelope types**

In `src/lib/types.ts`, just below the existing zone types (after line 20):

```ts
export type EnvelopeParams = { attack: number; release: number };
export type AudioZonesConfig = {
  defaultIntensity: ZoneIntensity;
  envelopes: { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams };
};
```

(Replace the existing one-line `AudioZonesConfig` definition.)

- [ ] **Step 2: Add defaults + setter + driver dep in state**

In `src/lib/state/animation.svelte.ts`:

Replace `defaultAudioZonesConfig` (around line 43) with:

```ts
const defaultAudioZonesConfig: AudioZonesConfig = {
  defaultIntensity: { bass: 0.5, mid: 0.5, treble: 0.5 },
  envelopes: {
    bass: { attack: 0.35, release: 0.18 },
    mid: { attack: 0.5, release: 0.25 },
    treble: { attack: 0.8, release: 0.5 }
  }
};
```

Import `EnvelopeParams` in the type import on line 14:

```ts
import type { AudioZonesConfig, ZoneIntensity, EnvelopeParams } from '$lib/types';
```

Add `getEnvelopes` to the driver deps (in the `createAudioZonesDriver({ ... })` call near line 120):

```ts
getEnvelopes: () => animationState.audioZones.envelopes,
```

Add the setter next to `setAudioZonesDefaultIntensity` (around line 333):

```ts
export function setAudioZonesEnvelope(
  band: 'bass' | 'mid' | 'treble',
  next: Partial<EnvelopeParams>
): void {
  animationState.audioZones = {
    ...animationState.audioZones,
    envelopes: {
      ...animationState.audioZones.envelopes,
      [band]: { ...animationState.audioZones.envelopes[band], ...next }
    }
  };
}
```

- [ ] **Step 3: Write the failing envelope tests**

Replace the body of `src/lib/state/animation-drivers/audio-zones-driver.spec.ts` with the version below. It extends the `makeDriver` helper with `getEnvelopes` (default: instant — attack/release 1.0 — so the existing scaling tests still hold), and adds envelope ramp tests.

```ts
import { describe, expect, it } from 'vitest';
import type { Ring, ZoneIntensity, ZoneDrive, EnvelopeParams } from '$lib/types';
import { createAudioZonesDriver } from './audio-zones-driver';
import { ZONE_SCALE } from '$lib/geometry/zones';

const defaultIntensity: ZoneIntensity = { bass: 0.5, mid: 0.5, treble: 0.5 };
const instant: EnvelopeParams = { attack: 1, release: 1 };
const instantEnvelopes = { bass: instant, mid: instant, treble: instant };

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
  envelopes?: { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams };
  calls: DriveCall[];
  rings?: Ring[];
}) {
  const rings = overrides.rings ?? [];
  return createAudioZonesDriver({
    getDefaultIntensity: () => defaultIntensity,
    getRingCount: () => overrides.ringCount ?? 2,
    getRing: (i) => rings[i] ?? makeRing(),
    readZones: () => overrides.zones ?? { bass: 0.5, mid: 0.8, treble: 0.3 },
    getEnvelopes: () => overrides.envelopes ?? instantEnvelopes,
    applyRingZoneDrive: (index, drive) => overrides.calls.push({ index, drive })
  });
}

describe('createAudioZonesDriver', () => {
  it('frame() writes zoneDrive for every ring', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 2, calls });
    driver.init();
    driver.frame(0);
    expect(calls).toHaveLength(2);
    expect(calls[0].index).toBe(0);
    expect(calls[1].index).toBe(1);
    expect(calls[0].drive).not.toBeNull();
    expect(calls[1].drive).not.toBeNull();
  });

  it('frame() with instant attack scales bassPush by bass * intensity.bass * ZONE_SCALE', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0.5, mid: 0, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
  });

  it('frame() with instant attack scales midPush by mid * intensity.mid * ZONE_SCALE', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0.8, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.midPush).toBeCloseTo(0.8 * 0.5 * ZONE_SCALE, 4);
  });

  it('attack ramps the smoothed level toward raw on rising input', () => {
    const calls: DriveCall[] = [];
    // attack 0.5, raw bass = 1, intensity 0.5 → first frame smoothed = lerp(0,1,0.5)=0.5
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 1, mid: 0, treble: 0 },
      envelopes: { bass: { attack: 0.5, release: 0.5 }, mid: instant, treble: instant },
      calls
    });
    driver.init();
    driver.frame(0);
    // smoothed.bass = 0.5 → bassPush = 0.5 * 0.5(intensity) * ZONE_SCALE
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
    driver.frame(16);
    // smoothed.bass = lerp(0.5,1,0.5)=0.75 → bassPush = 0.75 * 0.5 * ZONE_SCALE
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.75 * 0.5 * ZONE_SCALE, 4);
  });

  it('release decays slower than attack rises (asymmetry)', () => {
    const calls: DriveCall[] = [];
    const driver = createAudioZonesDriver({
      getDefaultIntensity: () => defaultIntensity,
      getRingCount: () => 1,
      getRing: () => makeRing(),
      // raw bass: 1 then 0
      readZones: (() => {
        let n = 0;
        return () => ({ bass: n++ === 0 ? 1 : 0, mid: 0, treble: 0 });
      })(),
      getEnvelopes: () => ({
        bass: { attack: 1, release: 0.25 },
        mid: instant,
        treble: instant
      }),
      applyRingZoneDrive: (index, drive) => calls.push({ index, drive })
    });
    driver.init();
    driver.frame(0); // attack 1 → smoothed.bass = 1
    expect(calls[0].drive?.bassPush).toBeCloseTo(1 * 0.5 * ZONE_SCALE, 4);
    driver.frame(16); // raw 0, release 0.25 → smoothed = lerp(1,0,0.25)=0.75
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.75 * 0.5 * ZONE_SCALE, 4);
  });

  it('init() resets smoothed state between runs', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 1, mid: 0, treble: 0 },
      envelopes: { bass: { attack: 0.5, release: 0.5 }, mid: instant, treble: instant },
      calls
    });
    driver.init();
    driver.frame(0); // smoothed.bass = 0.5
    driver.init(); // reset to 0
    driver.frame(0); // smoothed.bass = 0.5 again, not 0.75
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
  });

  it('frame() applies per-ring zoneConfig override', () => {
    const calls: DriveCall[] = [];
    const override: ZoneIntensity = { bass: 1.0, mid: 0, treble: 0 };
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 0.5, mid: 0, treble: 0 },
      calls,
      rings: [makeRing(override)]
    });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 1.0 * ZONE_SCALE, 4);
  });

  it('frame() returns {}', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ calls });
    driver.init();
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
    driver.init();
    driver.frame(0);
    expect(calls.map((c) => c.index)).toEqual([0, 1]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-zones-driver.spec.ts`
Expected: FAIL — `getEnvelopes` missing on deps type; smoothed/init behavior not implemented.

- [ ] **Step 5: Implement the envelope in the driver**

Replace `src/lib/state/animation-drivers/audio-zones-driver.ts` with:

```ts
import type { Ring, ZoneIntensity, ZoneDrive, EnvelopeParams } from '$lib/types';
import { resolveZoneIntensity, ZONE_SCALE } from '$lib/geometry/zones';

const SHIMMER_FREQ = 8; // Hz — treble bobbing frequency

type AnimationDriver = {
  init: () => void;
  dispose: () => void;
  frame: (nowMs: number) => Record<number, number>;
};

type Envelopes = { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams };

type CreateAudioZonesDriverDeps = {
  getDefaultIntensity: () => ZoneIntensity;
  getRingCount: () => number;
  getRing: (index: number) => Ring;
  readZones: () => { bass: number; mid: number; treble: number };
  getEnvelopes: () => Envelopes;
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

// Asymmetric per-frame smoothing: rising input uses attack, falling uses release.
// Per-frame (no dt) — assumes steady ~60fps rAF, matching the source sketch's fixed-rate lerp.
function envelope(prev: number, raw: number, env: EnvelopeParams): number {
  const rate = raw > prev ? env.attack : env.release;
  return prev + (raw - prev) * rate;
}

export function createAudioZonesDriver(deps: CreateAudioZonesDriverDeps): AnimationDriver {
  let smoothed = { bass: 0, mid: 0, treble: 0 };

  return {
    init() {
      smoothed = { bass: 0, mid: 0, treble: 0 };
      deps.getDefaultIntensity();
    },

    dispose() {
      const ringCount = normalizeRingCount(deps.getRingCount());
      for (let i = 0; i < ringCount; i++) {
        deps.applyRingZoneDrive(i, null);
      }
    },

    frame(nowMs) {
      const raw = deps.readZones();
      const env = deps.getEnvelopes();
      smoothed = {
        bass: envelope(smoothed.bass, clamp01(raw.bass), env.bass),
        mid: envelope(smoothed.mid, clamp01(raw.mid), env.mid),
        treble: envelope(smoothed.treble, clamp01(raw.treble), env.treble)
      };

      const defaultIntensity = deps.getDefaultIntensity();
      const ringCount = normalizeRingCount(deps.getRingCount());
      const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;
      const shimmer = Math.sin(2 * Math.PI * SHIMMER_FREQ * nowSec);

      for (let i = 0; i < ringCount; i++) {
        const ring = deps.getRing(i);
        const cfg = resolveZoneIntensity(ring, defaultIntensity);
        deps.applyRingZoneDrive(i, {
          bassPush: smoothed.bass * cfg.bass * ZONE_SCALE,
          midPush: smoothed.mid * cfg.mid * ZONE_SCALE,
          treblePush: smoothed.treble * cfg.treble * ZONE_SCALE * shimmer
        });
      }

      return {};
    }
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-zones-driver.spec.ts`
Expected: PASS (all).

- [ ] **Step 7: Typecheck the whole project**

Run: `bun run check`
Expected: no errors. (`AnimationSection.svelte.spec.ts` mock lacks `envelopes` but it is not typechecked against the real config; if `bun run check` flags it, leave it — Task 2 updates that mock. If it errors here, add `envelopes` to the mock now as in Task 2 Step 1.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/state/animation.svelte.ts src/lib/state/animation-drivers/audio-zones-driver.ts src/lib/state/animation-drivers/audio-zones-driver.spec.ts
git commit -m "feat: per-band attack/release envelopes in audio-zones driver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Envelope UI sliders

Exposes the six envelope coefficients (attack + release × bass/mid/treble) as global sliders.

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `setAudioZonesEnvelope(band, { attack?, release? })` from Task 1; `animationState.audioZones.envelopes`.

- [ ] **Step 1: Update the test mock + write the failing test**

In `src/lib/components/AnimationSection.svelte.spec.ts`, add `envelopes` to the mocked `audioZones` (around line 31) and a `setAudioZonesEnvelope` mock (around line 42):

```ts
audioZones: {
  defaultIntensity: { bass: 0.5, mid: 0.5, treble: 0.5 },
  envelopes: {
    bass: { attack: 0.35, release: 0.18 },
    mid: { attack: 0.5, release: 0.25 },
    treble: { attack: 0.8, release: 0.5 }
  }
}
```

```ts
setAudioZonesEnvelope: vi.fn(),
```

Ensure the module mock re-exports it. Find the `vi.mock('$lib/state/animation.svelte', ...)` factory and add `setAudioZonesEnvelope: animationApi.setAudioZonesEnvelope` alongside `setAudioZonesDefaultIntensity`.

Add this test inside the top-level `describe` (put the component into `audioZones` mode first, mirroring existing zone tests in this file):

```ts
it('audioZones: dragging the bass attack slider calls setAudioZonesEnvelope', async () => {
  animationApi.animationState.mode = 'audioZones';
  render(AnimationSection);
  await tick();
  const slider = page.getByLabelText('Bass attack');
  await expect.element(slider).toBeInTheDocument();
  await userEvent.fill(slider, '0.6');
  expect(animationApi.setAudioZonesEnvelope).toHaveBeenCalledWith('bass', { attack: 0.6 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: FAIL — no element labelled "Bass attack".

- [ ] **Step 3: Add the slider block + import**

In `src/lib/components/AnimationSection.svelte`, add `setAudioZonesEnvelope` to the import from `$lib/state/animation.svelte` (line 13 region, next to `setAudioZonesDefaultIntensity`).

Immediately after the closing `</div>` of the "Zone intensities (global)" block (after line 371), insert:

```svelte
<div class="flex flex-col gap-2">
  <p class="text-[11px] font-medium text-muted-foreground">Zone response (global)</p>
  {#each [{ band: 'bass', label: 'Bass' }, { band: 'mid', label: 'Mid' }, { band: 'treble', label: 'Treble' }] as { band, label } (band)}
    <div class="flex flex-col gap-1">
      <Label for="zones-{band}-attack" class="text-xs">{label} attack</Label>
      <input
        id="zones-{band}-attack"
        aria-label="{label} attack"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={animationState.audioZones.envelopes[band as 'bass' | 'mid' | 'treble'].attack}
        oninput={(e) =>
          setAudioZonesEnvelope(band as 'bass' | 'mid' | 'treble', {
            attack: Number((e.target as HTMLInputElement).value)
          })}
      />
      <Label for="zones-{band}-release" class="text-xs">{label} release</Label>
      <input
        id="zones-{band}-release"
        aria-label="{label} release"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={animationState.audioZones.envelopes[band as 'bass' | 'mid' | 'treble'].release}
        oninput={(e) =>
          setAudioZonesEnvelope(band as 'bass' | 'mid' | 'treble', {
            release: Number((e.target as HTMLInputElement).value)
          })}
      />
    </div>
  {/each}
</div>
```

- [ ] **Step 4: Validate the Svelte with the autofixer**

Use the `svelte-autofixer` MCP tool on the edited `AnimationSection.svelte`. Apply fixes until it reports no issues (re-run after each change).

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: global per-band envelope sliders for audio zones

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Rich multi-axis deformation (ZoneDrive contract change)

Atomic change of the `ZoneDrive` contract from 3 to 4 fields, enriching `applyZonesToPath` (mid 2-axis, treble retract + vibrate), the driver output, and the preview together so the tree stays green.

**Files:**
- Modify: `src/lib/types.ts` (`ZoneDrive`)
- Modify: `src/lib/geometry/zones.ts`
- Modify: `src/lib/state/animation-drivers/audio-zones-driver.ts`
- Modify: `src/lib/components/ZonePreview.svelte`
- Test: `src/lib/geometry/zones.spec.ts`, `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`

**Interfaces:**
- Produces:
  - `type ZoneDrive = { bassPush: number; midPush: number; trebleRetract: number; trebleVibrate: number }`
  - `applyZonesToPath`: mid anchors move `dx = +midPush`, `dy = -midPush * MID_RADIAL_RATIO`; innermost anchor moves `dy = +trebleRetract`, `dx = trebleVibrate`. Constants `MID_RADIAL_RATIO = 0.4`, exported `ZONE_SCALE = 30` (unchanged).
  - Driver constants `VIBR_FREQ = 8` (Hz), `VIBR_AMT = 0.5`.
- Consumes: `smoothed` envelope levels from Task 1; `EnvelopeParams` deps unchanged.

- [ ] **Step 1: Change the ZoneDrive type**

In `src/lib/types.ts`, replace the `ZoneDrive` definition:

```ts
export type ZoneDrive = {
  bassPush: number; // outermost: radial-out magnitude
  midPush: number; // middle: tangential widen (drives radial too, ratio internal)
  trebleRetract: number; // innermost: steady inward magnitude
  trebleVibrate: number; // innermost: signed tangential oscillation
};
```

- [ ] **Step 2: Rewrite the zones.spec for the enriched behavior**

Replace the `applyZonesToPath` describe block in `src/lib/geometry/zones.spec.ts` (keep the `petal` fixture comment block, the `resolveZoneIntensity` and `ZONE_SCALE` describes as-is). New block:

```ts
describe('applyZonesToPath', () => {
  it('returns a new identical copy when all drive fields are 0', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    expect(result).not.toBe(petal);
    expect(result.crds).not.toBe(petal.crds);
    expect(result.crds).toEqual(petal.crds);
    expect(result.cmds).toEqual(petal.cmds);
  });

  it('preserves cmds array and crds length for any drive', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 10,
      midPush: 5,
      trebleRetract: 3,
      trebleVibrate: 2
    });
    expect(result.cmds).toEqual(petal.cmds);
    expect(result.crds).toHaveLength(petal.crds.length);
  });

  it('bass: moves outermost anchor (idx 6) + handles (idx 4, 8) down by bassPush', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 10,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    expect(result.crds[7]).toBeCloseTo(20, 6); // 30 - 10
    expect(result.crds[5]).toBeCloseTo(40, 6); // 50 - 10
    expect(result.crds[9]).toBeCloseTo(15, 6); // 25 - 10
    expect(result.crds[6]).toBe(petal.crds[6]); // X unchanged
    expect(result.crds[0]).toBe(petal.crds[0]); // M anchor unchanged
    expect(result.crds[1]).toBe(petal.crds[1]);
    expect(result.crds[12]).toBe(petal.crds[12]); // C2 anchor unchanged
    expect(result.crds[13]).toBe(petal.crds[13]);
  });

  it('mid: moves middle anchor (idx 12) right by midPush AND up by midPush*0.4', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 10,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    // X: 40 + 10 = 50
    expect(result.crds[12]).toBeCloseTo(50, 6);
    // Y: 60 - 10*0.4 = 56 (radial out = decrease Y)
    expect(result.crds[13]).toBeCloseTo(56, 6);
    // entry handle (idx 10,11): X 30+10=40, Y 30-4=26
    expect(result.crds[10]).toBeCloseTo(40, 6);
    expect(result.crds[11]).toBeCloseTo(26, 6);
    // C1 (outer) anchor unchanged
    expect(result.crds[6]).toBe(petal.crds[6]);
    expect(result.crds[7]).toBe(petal.crds[7]);
  });

  it('treble: retracts innermost anchor (idx 0) inward by trebleRetract AND shifts X by trebleVibrate', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 8,
      trebleVibrate: 3
    });
    // innermost is M anchor at (0,100): Y 100 + 8 = 108, X 0 + 3 = 3
    expect(result.crds[1]).toBeCloseTo(108, 6);
    expect(result.crds[0]).toBeCloseTo(3, 6);
    // exit handle (C1 cp1 idx 2,3): X 0+3=3, Y 80+8=88
    expect(result.crds[2]).toBeCloseTo(3, 6);
    expect(result.crds[3]).toBeCloseTo(88, 6);
    // C1 (outer) anchor unchanged
    expect(result.crds[6]).toBe(petal.crds[6]);
    expect(result.crds[7]).toBe(petal.crds[7]);
  });

  it('negative trebleVibrate shifts innermost X the other way', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: -5
    });
    expect(result.crds[0]).toBeCloseTo(-5, 6);
  });

  it('N=1: single anchor — bass wins', () => {
    const single: Path = { cmds: ['M'], crds: [10, 50] };
    const result = applyZonesToPath(single, {
      bassPush: 5,
      midPush: 3,
      trebleRetract: 2,
      trebleVibrate: 1
    });
    expect(result.crds[1]).toBeCloseTo(45, 6); // 50 - 5 (bass)
    expect(result.crds[0]).toBe(10);
  });

  it('N=2: outermost gets bass, innermost gets treble, no mid', () => {
    const two: Path = { cmds: ['M', 'L'], crds: [0, 100, 0, 30] };
    const result = applyZonesToPath(two, {
      bassPush: 10,
      midPush: 99,
      trebleRetract: 5,
      trebleVibrate: 4
    });
    expect(result.crds[3]).toBeCloseTo(20, 6); // outermost 30 - 10
    expect(result.crds[1]).toBeCloseTo(105, 6); // innermost 100 + 5 retract
    expect(result.crds[0]).toBeCloseTo(4, 6); // innermost X + vibrate
    expect(result.crds[2]).toBe(0); // outermost X unchanged
  });

  it('does not mutate the input path', () => {
    const original = [...petal.crds];
    applyZonesToPath(petal, {
      bassPush: 10,
      midPush: 5,
      trebleRetract: 3,
      trebleVibrate: 2
    });
    expect(petal.crds).toEqual(original);
  });
});
```

- [ ] **Step 3: Run zones tests to verify they fail**

Run: `bun run test:unit -- run src/lib/geometry/zones.spec.ts`
Expected: FAIL — `trebleRetract`/`trebleVibrate` not handled; mid only moves X.

- [ ] **Step 4: Enrich applyZonesToPath**

In `src/lib/geometry/zones.ts`, add the constant under `ZONE_SCALE`:

```ts
/** Fraction of mid tangential push also applied radially (outward). */
export const MID_RADIAL_RATIO = 0.4;
```

Replace the all-zero guard and the per-anchor deformation loop. The guard becomes:

```ts
if (
  drive.bassPush === 0 &&
  drive.midPush === 0 &&
  drive.trebleRetract === 0 &&
  drive.trebleVibrate === 0
) {
  return { cmds: [...path.cmds], crds: [...path.crds] };
}
```

Update the destructure at the top of the function:

```ts
const { bassPush, midPush, trebleRetract, trebleVibrate } = drive;
```

Replace the `for (let i = 0; i < sorted.length; i++)` body with:

```ts
for (let i = 0; i < sorted.length; i++) {
  const anchor = sorted[i];
  let dx = 0;
  let dy = 0;

  if (i === 0) {
    // Outermost — bass — radially outward (decrease Y)
    dy = -bassPush;
  } else if (i === sorted.length - 1) {
    // Innermost — treble — retract inward (increase Y) + tangential vibration
    dy = trebleRetract;
    dx = trebleVibrate;
  } else {
    // Middle — mid — tangential widening + slight radial push outward
    dx = midPush;
    dy = -midPush * MID_RADIAL_RATIO;
  }

  translate(anchor.anchorIdx, dx, dy);
  translate(anchor.entryHandleIdx, dx, dy);
  translate(anchor.exitHandleIdx, dx, dy);
}
```

- [ ] **Step 5: Run zones tests to verify they pass**

Run: `bun run test:unit -- run src/lib/geometry/zones.spec.ts`
Expected: PASS.

- [ ] **Step 6: Update the driver output to the 4-field drive**

In `src/lib/state/animation-drivers/audio-zones-driver.ts`, replace the `SHIMMER_FREQ` constant with the vibration constants:

```ts
const VIBR_FREQ = 8; // Hz — treble tangential vibration frequency (fixed)
const VIBR_AMT = 0.5; // fraction of treble push expressed as vibration amplitude
```

In `frame`, replace the `shimmer` line and the `applyRingZoneDrive` payload:

```ts
const vibratePhase = Math.sin(2 * Math.PI * VIBR_FREQ * nowSec);

for (let i = 0; i < ringCount; i++) {
  const ring = deps.getRing(i);
  const cfg = resolveZoneIntensity(ring, defaultIntensity);
  const trebleBase = smoothed.treble * cfg.treble * ZONE_SCALE;
  deps.applyRingZoneDrive(i, {
    bassPush: smoothed.bass * cfg.bass * ZONE_SCALE,
    midPush: smoothed.mid * cfg.mid * ZONE_SCALE,
    trebleRetract: trebleBase,
    trebleVibrate: trebleBase * VIBR_AMT * vibratePhase
  });
}
```

- [ ] **Step 7: Update the driver spec for the new drive fields**

In `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`, the existing tests assert `bassPush`/`midPush` which are unchanged — they still pass. Add two tests for treble inside the `describe`:

```ts
it('treble: trebleRetract = smoothed.treble * intensity * ZONE_SCALE', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
  driver.init();
  driver.frame(0);
  // instant attack → smoothed.treble = 0.4; intensity 0.5
  expect(calls[0].drive?.trebleRetract).toBeCloseTo(0.4 * 0.5 * ZONE_SCALE, 4);
});

it('treble: trebleVibrate sign follows sin(2*pi*8*t)', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
  driver.init();
  // at t = 1000ms/ (period 125ms) → nowSec=1.0, sin(2*pi*8*1)=0 → vibrate≈0
  driver.frame(1000);
  expect(calls[0].drive?.trebleVibrate).toBeCloseTo(0, 4);
  // at nowMs giving sin>0: t such that 8*t mod 1 = 0.25 → t=0.03125s = 31.25ms
  driver.frame(31.25);
  expect(calls[1].drive?.trebleVibrate ?? 0).toBeGreaterThan(0);
});
```

- [ ] **Step 8: Update ZonePreview to the 4-field drive**

In `src/lib/components/ZonePreview.svelte`, import `MID_RADIAL_RATIO` is not needed; update the import to include nothing new. Replace the `maxDrive` object (lines 53-57) with a static representative drive:

```ts
const maxDrive = {
  bassPush: intensity.bass * ZONE_SCALE,
  midPush: intensity.mid * ZONE_SCALE,
  trebleRetract: intensity.treble * ZONE_SCALE,
  trebleVibrate: intensity.treble * ZONE_SCALE * 0.5
};
```

- [ ] **Step 9: Validate ZonePreview + AnimationSection with the autofixer**

Use the `svelte-autofixer` MCP tool on `ZonePreview.svelte`. Apply fixes until no issues remain.

- [ ] **Step 10: Run the full unit suite + typecheck**

Run: `bun run test:unit -- run`
Expected: PASS (all).

Run: `bun run check`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/types.ts src/lib/geometry/zones.ts src/lib/geometry/zones.spec.ts src/lib/state/animation-drivers/audio-zones-driver.ts src/lib/state/animation-drivers/audio-zones-driver.spec.ts src/lib/components/ZonePreview.svelte
git commit -m "feat: multi-axis petal deformation per audio zone

Mid widens on two axes; treble retracts inward and vibrates
tangentially at fixed frequency. ZoneDrive extended to four fields.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual Verification (after Task 3)

- [ ] Run `bun run dev`, open the app, set animation mode to **Audio Zones**, source **Demo**. Petals should move on multiple axes; mid band visibly widens + pushes, treble shimmers and retracts.
- [ ] Drag a **release** slider high for bass → bass deformation should linger after the demo sine dips. Drag **attack** low → response softens/slows.
- [ ] Switch source to **mic**, play music near the mic → kicks snap the outer tips, hi-hats shimmer the inner points.
- [ ] Confirm the **Zone preview** thumbnails in the per-ring config still render the deformed reach shape.

---

## Self-Review Notes

- **Spec coverage:** envelope (Task 1) ✓; envelope UI sliders (Task 2) ✓; multi-axis deformation incl. mid 2-axis + treble retract/vibrate (Task 3) ✓; geometry-only ✓ (no colour touched); global envelopes ✓ (no per-ring envelope); fixed-freq vibration ✓; `audio-source.ts`/render-pipeline/bend untouched ✓; ZonePreview updated ✓; persistence — N/A (animation config is in-memory only, confirmed no localStorage).
- **Type consistency:** `ZoneDrive` is the only renamed contract; `treblePush` removed and replaced by `trebleRetract` + `trebleVibrate` in Task 3 across type, driver, zones, preview, and both specs. Task 1 deliberately keeps `treblePush` so its commit stays green; Task 3 makes the atomic swap.
- **Frame-rate:** per-frame lerp documented in `envelope()` comment; deferred `dt` normalisation is a stated non-goal.
