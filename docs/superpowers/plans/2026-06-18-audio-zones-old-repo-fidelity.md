# Audio-Zones Full Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `audioZones` petals snap open toward the canvas edge like the old `Utop-ia/mandala-bettona` repo and cut the control sprawl to source + 3 band intensities.

**Architecture:** The dominant "budino" cause is per-frame `fitToView` rescaling the whole mark every render, cancelling petal extension. We add an opt-in fixed-scale render path (`fitScale`) fed by a rest-pose measurement with reserved headroom, raise the deformation reach, bake the old repo's envelope/threshold dynamics into driver constants, give the Demo source a real beat, and remove the broken/excess sliders.

**Tech Stack:** TypeScript, Svelte 5 (runes), paper.js, vitest, bun.

## Global Constraints

- Package manager **bun**. Tests: `bun run test:unit -- run <path>`. Typecheck: `bun run check` (must stay 0 errors / 0 warnings).
- Only `audioZones` mode changes; Simple / Audio Bars / Data Series untouched.
- Authored petal shapes unchanged; `applyZonesToPath` stays pure (no input mutation).
- `fitScale` is opt-in; when absent, render behaves byte-for-byte as today (no regression to other modes/callers).
- mic/file source plumbing, bend/morph/wave, and persistence (`zoneDrive` strip) untouched.
- Any Svelte file edited MUST be run through the `svelte-autofixer` MCP tool until it returns no issues (per CLAUDE.md). Generic "$effect calls a function" suggestions for imperative paper.js canvas draws (no $state reassignment) are expected and may be left.
- Baked dynamics values are the old repo's (sketch.js): envelopes bass 0.35/0.18, mid 0.5/0.25, treble 0.8/0.5; response floors bass 0.235 / mid 0.196 / treble 0.275, saturation 0.863 (already in the driver).
- Coupled tuning constants: `BASS_REACH` (zones.ts) and `REST_FRACTION` (PreviewCanvas) — rest mark + max opening ≈ full frame. Proposed `BASS_REACH = 2.0`, `REST_FRACTION = 0.45`.

---

### Task 1: Raise bass reach

Bump `BASS_REACH` so a full-bass hit roughly triples the petal length (visible once Task 3/4 land the stable fit).

**Files:**
- Modify: `src/lib/geometry/zones.ts`
- Test: `src/lib/geometry/zones.spec.ts`

**Interfaces:**
- Produces: `BASS_REACH` constant value change (1.2 → 2.0). Other reach constants unchanged.

- [ ] **Step 1: Update the expectation in the existing bass tests**

In `src/lib/geometry/zones.spec.ts`, the `petal` fixture extent is 70. Find the two tests that use `BASS_REACH` in their expectation — `'bass pushes the outermost anchor ...'` and `'magnitude scales with radial extent ...'` and `'N=2: outermost gets bass ...'`. They already compute expectations from the imported `BASS_REACH` constant (e.g. `30 - RADIAL_EXTENT * BASS_REACH`), so they need NO numeric edits — they track the constant. Add one explicit guard test so the value change is intentional:

```ts
it('BASS_REACH is tuned for full-frame opening (2.0)', () => {
  expect(BASS_REACH).toBeCloseTo(2.0, 6);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/zones.spec.ts`
Expected: FAIL — `BASS_REACH` is still 1.2.

- [ ] **Step 3: Change the constant**

In `src/lib/geometry/zones.ts`:

```ts
/** Bass: outer tip reach as a multiple of petal radial extent. Tuned with REST_FRACTION so a full-bass hit fills the reserved headroom. */
export const BASS_REACH = 2.0;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/geometry/zones.spec.ts`
Expected: PASS (constant-tracking tests still hold; new guard passes).

- [ ] **Step 5: Typecheck + commit**

Run: `bun run check` → 0/0.
```bash
git add src/lib/geometry/zones.ts src/lib/geometry/zones.spec.ts
git commit -m "feat: raise BASS_REACH for full-frame petal opening"
```

---

### Task 2: Demo source with a beat

Replace the smooth-sine Demo zone signal with a transient-rich pulse pattern in a pure, testable helper, then wire it into the driver's demo branch.

**Files:**
- Create: `src/lib/state/animation-drivers/demo-zones.ts`
- Create: `src/lib/state/animation-drivers/demo-zones.spec.ts`
- Modify: `src/lib/state/animation.svelte.ts:131-138`

**Interfaces:**
- Produces: `demoZones(nowMs: number): { bass: number; mid: number; treble: number }` — values 0..1, sharp attack + exponential decay, NOT a pure sine.

- [ ] **Step 1: Write the failing test**

Create `src/lib/state/animation-drivers/demo-zones.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { demoZones } from './demo-zones';

describe('demoZones', () => {
  it('returns all bands within 0..1', () => {
    for (let ms = 0; ms < 2000; ms += 37) {
      const z = demoZones(ms);
      for (const v of [z.bass, z.mid, z.treble]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('bass spikes hard on the kick then decays (transient, not a smooth wave)', () => {
    // Kick period = 500 ms (2 Hz). At the kick the bass is near max; shortly after it has clearly dropped.
    const atKick = demoZones(0).bass;
    const justAfter = demoZones(120).bass;
    expect(atKick).toBeGreaterThan(0.8);
    expect(atKick - justAfter).toBeGreaterThan(0.3); // sharp decay, not gentle
  });

  it('treble spikes on the offbeat hat, distinct from the kick', () => {
    // Hat at offbeat (kick period/2 = 250 ms). Treble high there, low at the kick.
    expect(demoZones(250).treble).toBeGreaterThan(0.6);
    expect(demoZones(0).treble).toBeLessThan(0.4);
  });

  it('is not a pure sine (a frame-to-frame drop sharper than any sine of the same period exists)', () => {
    // A 2 Hz sine over a 16 ms step changes at most ~0.1; our decay drops far more right after a spike.
    const drop = demoZones(20).bass - demoZones(140).bass;
    expect(drop).toBeGreaterThan(0.25);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/demo-zones.spec.ts`
Expected: FAIL with "demoZones is not a function" / module not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/state/animation-drivers/demo-zones.ts`:

```ts
// Fake "music" for the Demo source: a 2 Hz kick (bass + a mid thud) and an
// offbeat hat (treble), each a sharp attack with exponential decay — NOT a
// smooth sine — so the audio-zones snap is visible without loading a file.

const KICK_PERIOD_MS = 500; // 2 Hz
const DECAY_MS = 90; // pulse e-folding time; smaller = snappier

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

// Pulse that hits 1 at phase 0 and decays exponentially over the period.
function pulse(nowMs: number, periodMs: number, offsetMs: number, decayMs: number): number {
  const phase = (((nowMs - offsetMs) % periodMs) + periodMs) % periodMs;
  return Math.exp(-phase / decayMs);
}

export function demoZones(nowMs: number): { bass: number; mid: number; treble: number } {
  const kick = pulse(nowMs, KICK_PERIOD_MS, 0, DECAY_MS);
  const hat = pulse(nowMs, KICK_PERIOD_MS, KICK_PERIOD_MS / 2, DECAY_MS * 0.7);
  return {
    bass: clamp01(kick),
    mid: clamp01(kick * 0.6 + hat * 0.2),
    treble: clamp01(hat)
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/demo-zones.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into the driver's demo branch**

In `src/lib/state/animation.svelte.ts`, add the import near the other driver imports at the top of the file:

```ts
import { demoZones } from './animation-drivers/demo-zones';
```

Replace the demo case in the `audioZones` driver's `readZones` (currently lines ~131-138):

```ts
				case 'demo':
					return demoZones(performance.now());
```

- [ ] **Step 6: Run full suite + typecheck**

Run: `bun run test:unit -- run` → all green.
Run: `bun run check` → 0/0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/state/animation-drivers/demo-zones.ts src/lib/state/animation-drivers/demo-zones.spec.ts src/lib/state/animation.svelte.ts
git commit -m "feat: transient-rich Demo source for audio-zones"
```

---

### Task 3: Render pipeline — fixed-scale primitives

Add an opt-in fixed-scale render path, a rest-pose measurement, and a pure scale helper. When `fitScale` is absent, behavior is unchanged.

**Files:**
- Modify: `src/lib/geometry/render-pipeline.ts`
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts`

**Interfaces:**
- Produces:
  - `RenderInput` gains `fitScale?: number` and `ignoreZoneDrive?: boolean`.
  - `RenderResult` gains `boundSide: number` (max side of the united layer bounds measured BEFORE fitting; 0 if empty).
  - `export function computeRestScale(boundSide: number, viewport: { width: number; height: number; padding?: number }, restFraction: number): number`.
- Consumes: `applyZonesToPath` (already imported).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/geometry/render-pipeline.svelte.spec.ts` (the `composition`, `scope`, `petalPath` fixtures already exist):

```ts
import { createRenderPipeline, RenderPipelineError, computeRestScale } from './render-pipeline';

describe('computeRestScale', () => {
  it('maps the rest bound to restFraction of the available square', () => {
    // available = min(600,600) - 2*32 = 536; restFraction 0.5 → target 268; boundSide 134 → scale 2.
    expect(computeRestScale(134, { width: 600, height: 600, padding: 32 }, 0.5)).toBeCloseTo(2, 6);
  });

  it('falls back to 1 for a degenerate bound or viewport', () => {
    expect(computeRestScale(0, { width: 600, height: 600, padding: 32 }, 0.45)).toBe(1);
    expect(computeRestScale(100, { width: 10, height: 10, padding: 32 }, 0.45)).toBe(1);
    expect(computeRestScale(Number.NaN, { width: 600, height: 600 }, 0.45)).toBe(1);
  });
});

describe('createRenderPipeline().render fixed scale', () => {
  it('returns a positive boundSide and still renders without fitScale', () => {
    const pipeline = createRenderPipeline();
    const result = pipeline.render({
      composition,
      scope,
      viewport: { width: 600, height: 600, padding: 32 }
    });
    expect(result.boundSide).toBeGreaterThan(0);
  });

  it('with fitScale, scales the layer by exactly fitScale and skips bounds-fit', () => {
    const pipeline = createRenderPipeline();
    // Rest render to learn the un-fitted bound side.
    const rest = pipeline.render({
      composition,
      scope,
      ignoreZoneDrive: true,
      viewport: { width: 600, height: 600, padding: 32 }
    });
    const scale = 0.5;
    pipeline.render({
      composition,
      scope,
      fitScale: scale,
      viewport: { width: 600, height: 600, padding: 32 }
    });
    const b = scope.project.activeLayer.bounds;
    expect(Math.max(b.width, b.height)).toBeCloseTo(rest.boundSide * scale, 4);
  });

  it('ignoreZoneDrive renders the rest pose (zoneDrive has no effect on boundSide)', () => {
    const pipeline = createRenderPipeline();
    const driven: Composition = {
      ...composition,
      rings: composition.rings.map((r) => ({
        ...r,
        templatePath: petalPath,
        zoneDrive: { bassPush: 1, midPush: 1, trebleRetract: 1, trebleVibrate: 1 }
      }))
    };
    const withDrive = pipeline.render({
      composition: driven,
      scope,
      viewport: { width: 600, height: 600, padding: 32 }
    });
    const ignored = pipeline.render({
      composition: driven,
      scope,
      ignoreZoneDrive: true,
      viewport: { width: 600, height: 600, padding: 32 }
    });
    expect(ignored.boundSide).toBeLessThan(withDrive.boundSide);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- run src/lib/geometry/render-pipeline.svelte.spec.ts`
Expected: FAIL — `computeRestScale` not exported; `result.boundSide` undefined; `fitScale`/`ignoreZoneDrive` not honored.

- [ ] **Step 3: Add the types and the pure helper**

In `src/lib/geometry/render-pipeline.ts`, extend the types:

```ts
export type RenderInput = {
	composition: Composition;
	scope: paper.PaperScope;
	viewport: RenderViewport;
	ignoreMorph?: boolean;
	/** When set (finite, >0), apply this fixed scale + recenter instead of bounds-fit. */
	fitScale?: number;
	/** When true, skip zone deformation so the rest pose can be measured. */
	ignoreZoneDrive?: boolean;
};

export type RenderResult = {
	renderedCount: number;
	skippedCount: number;
	warnings: string[];
	renderDurationMs: number;
	/** Max side of the united layer bounds BEFORE fitting; 0 when empty. */
	boundSide: number;
};
```

Add the pure helper near `fitToView`:

```ts
export function computeRestScale(
	boundSide: number,
	viewport: { width: number; height: number; padding?: number },
	restFraction: number
): number {
	const padding = viewport.padding ?? 32;
	const available = Math.min(viewport.width, viewport.height) - padding * 2;
	if (!Number.isFinite(boundSide) || boundSide <= 0 || available <= 0) return 1;
	return (available * restFraction) / boundSide;
}

function measureBoundSide(scope: paper.PaperScope): number {
	const items = scope.project.activeLayer.children;
	if (items.length === 0) return 0;
	let bounds = items[0].bounds.clone();
	for (let i = 1; i < items.length; i++) bounds = bounds.unite(items[i].bounds);
	return Math.max(bounds.width, bounds.height);
}

function applyFixedScale(scope: paper.PaperScope, fitScale: number): void {
	const items = scope.project.activeLayer.children;
	if (items.length === 0) return;
	let bounds = items[0].bounds.clone();
	for (let i = 1; i < items.length; i++) bounds = bounds.unite(items[i].bounds);
	scope.project.activeLayer.scale(fitScale, bounds.center);
	scope.project.activeLayer.position = scope.view.bounds.center;
}
```

- [ ] **Step 4: Honor `ignoreZoneDrive` in the build loop**

In `render-pipeline.ts`, change the zone-deformation guard (currently `if (effectiveRing.zoneDrive && effectiveRing.templatePath)`):

```ts
				// Apply zone deformation (audioZones mode) BEFORE bend mirrors/tiles — same slot as wave.
				if (!input.ignoreZoneDrive && effectiveRing.zoneDrive && effectiveRing.templatePath) {
					effectiveRing = {
						...effectiveRing,
						templatePath: applyZonesToPath(effectiveRing.templatePath, effectiveRing.zoneDrive)
					};
				}
```

- [ ] **Step 5: Measure + branch the finalize phase**

Replace the finalize block (`fitToView(scope, viewport); scope.view.update();`) and the return value:

```ts
			let boundSide = 0;
			try {
				boundSide = measureBoundSide(scope);
				if (input.fitScale && Number.isFinite(input.fitScale) && input.fitScale > 0) {
					applyFixedScale(scope, input.fitScale);
				} else {
					fitToView(scope, viewport);
				}
				scope.view.update();
			} catch (error) {
				throw toPipelineError(error, 'Render pipeline failed during finalize phase');
			}

			return {
				renderedCount,
				skippedCount,
				warnings,
				renderDurationMs: performance.now() - startedAt,
				boundSide
			};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun run test:unit -- run src/lib/geometry/render-pipeline.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 7: Full suite + typecheck + commit**

Run: `bun run test:unit -- run` → all green (existing render tests unaffected; they ignore the new `boundSide` field).
Run: `bun run check` → 0/0.
```bash
git add src/lib/geometry/render-pipeline.ts src/lib/geometry/render-pipeline.svelte.spec.ts
git commit -m "feat: opt-in fixed-scale render path + rest-pose measurement"
```

---

### Task 4: PreviewCanvas — stable fit in audio-zones

Wire the fixed scale: in `audioZones` mode, measure the rest pose each frame (drive ignored), compute the fixed scale with reserved headroom, then render the deformed pose at that scale. Other modes keep the current single auto-fit render.

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte`

**Interfaces:**
- Consumes: `computeRestScale` from `render-pipeline.ts`; `RenderInput.fitScale` / `ignoreZoneDrive`; `RenderResult.boundSide`.

- [ ] **Step 1: Update the render effect**

In `src/lib/components/PreviewCanvas.svelte`, add the import and a `REST_FRACTION` constant, and replace the `$effect` body. Two synchronous renders only in `audioZones` (a measurement pass then the real pass); the browser paints only the final one, so no flicker.

```ts
	import { createRenderPipeline, computeRestScale } from '$lib/geometry/render-pipeline';

	// Rest mark fills this fraction of the frame, leaving headroom for petals to
	// open toward the edge. Coupled with BASS_REACH (zones.ts).
	const REST_FRACTION = 0.45;
```

Replace the effect:

```ts
		$effect(() => {
			const comp = composition;
			const viewport = {
				width: scope.view.size.width,
				height: scope.view.size.height,
				padding: 32
			};
			// audioBars/audioZones ride the primary petal; bypass morph in the render only.
			const ignoreMorph =
				animationState.mode === 'audioBars' || animationState.mode === 'audioZones';

			if (animationState.mode === 'audioZones') {
				// Measure the rest pose (drive ignored), fix the scale with headroom,
				// then render the deformed pose at that fixed scale so opening petals
				// actually extend toward the reserved edge instead of being re-fitted away.
				const rest = renderPipeline.render({
					composition: comp,
					scope,
					ignoreMorph,
					ignoreZoneDrive: true,
					viewport
				});
				const fitScale = computeRestScale(rest.boundSide, viewport, REST_FRACTION);
				renderPipeline.render({ composition: comp, scope, ignoreMorph, viewport, fitScale });
			} else {
				renderPipeline.render({ composition: comp, scope, ignoreMorph, viewport });
			}
		});
```

- [ ] **Step 2: Run svelte-autofixer until clean**

Use the `svelte-autofixer` MCP tool on the full contents of `src/lib/components/PreviewCanvas.svelte`. Apply any real fixes and re-run until no issues. Generic "$effect calls `render`" suggestions are expected (the render only writes to the paper.js canvas, no `$state` reassignment) and may be left.

- [ ] **Step 3: Typecheck + full suite**

Run: `bun run check` → 0/0.
Run: `bun run test:unit -- run` → all green (PreviewCanvas has no unit spec; render contract is covered by Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/PreviewCanvas.svelte
git commit -m "feat: stable rest-pose fit for audio-zones petals"
```

---

### Task 5: Trim the audio-zones controls

Remove the broken Input gain slider, the six Zone response (attack/release) sliders, and the per-ring Zones section. Leave the envelope state in place for now (removed in Task 6) so this task compiles.

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: the `audioZones` control block now contains only audio source, input-level meter, mic/file hints, and the three Zone-intensity sliders.

- [ ] **Step 1: Remove the obsolete slider test + mock**

In `src/lib/components/AnimationSection.svelte.spec.ts`:
- Delete the whole test `it('audioZones: dragging the bass attack slider calls setAudioZonesEnvelope', ...)` (around lines 287-295).
- Remove the `setAudioZonesEnvelope: vi.fn(),` line from the animation-state mock (around line 48).

- [ ] **Step 2: Run the spec to confirm it still passes pre-change**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts`
Expected: PASS (we only removed a test + an unused mock field).

- [ ] **Step 3: Remove the three control groups from the markup**

In `src/lib/components/AnimationSection.svelte`, delete these three blocks from the `{#if animationState.mode === 'audioZones'}` section:

1. The Input gain group (currently lines ~317-329):
```svelte
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
```

2. The entire Zone response group (currently lines ~380-414): the `<div>` containing `Zone response (global)` and the `{#each zoneBands ...}` block.

3. The entire Zones per ring group (currently lines ~416-421): the `<div>` containing `Zones per ring` and the `{#each composition.rings ...}` block.

- [ ] **Step 4: Remove the now-dead script references**

In the same file's `<script>`:
- Remove `setAudioZonesEnvelope,` from the import of animation actions (line ~14).
- Remove `import RingZoneConfigItem from './RingZoneConfigItem.svelte';` (line ~21).
- Remove the `const zoneBands = [ ... ];` declaration (line ~31). (Keep `setAudioBarsConfig` — still used by the audioBars block.)

- [ ] **Step 5: Run svelte-autofixer until clean**

Use the `svelte-autofixer` MCP tool on the full contents of `src/lib/components/AnimationSection.svelte`. Apply real fixes, re-run until clean.

- [ ] **Step 6: Run spec + typecheck**

Run: `bun run test:unit -- run src/lib/components/AnimationSection.svelte.spec.ts` → PASS.
Run: `bun run check` → 0/0 (envelope state still exists, just unused by the UI).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: trim audio-zones controls to source + band intensities"
```

---

### Task 6: Bake the envelope, remove envelope state

Move the per-band attack/release into a driver constant (old repo values) and delete the now-unused envelope config, setter, type field, and driver dependency.

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-zones-driver.ts`
- Modify: `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/state/animation.svelte.ts`
- Modify: `src/lib/components/AnimationSection.svelte.spec.ts`
- Modify: `src/lib/components/Sidebar.svelte.spec.ts`

**Interfaces:**
- Produces: driver `CreateAudioZonesDriverDeps` no longer has `getEnvelopes`; `EnvelopeParams` stays in types but `AudioZonesConfig.envelopes` is removed; `setAudioZonesEnvelope` is deleted.

- [ ] **Step 1: Rewrite the driver tests for baked envelopes**

In `src/lib/state/animation-drivers/audio-zones-driver.spec.ts`:
- Remove the `instant` / `instantEnvelopes` consts and the `envelopes` field from `makeDriver`'s overrides type and from the returned deps object (delete `getEnvelopes: () => overrides.envelopes ?? instantEnvelopes,`).
- Add the baked constant mirror near the top:

```ts
const ENVELOPE = {
  bass: { attack: 0.35, release: 0.18 },
  mid: { attack: 0.5, release: 0.25 },
  treble: { attack: 0.8, release: 0.5 }
};
```

- Replace the attack/asymmetry/init tests (which injected envelopes) with baked-constant versions. The driver now always uses `ENVELOPE`. With raw bass = 1, `respond(1)=1`, so after one frame `smoothed.bass = 0 + (1-0)*0.35 = 0.35`:

```ts
it('attack uses the baked bass attack (0.35) on rising input', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({ ringCount: 1, zones: { bass: 1, mid: 0, treble: 0 }, calls });
  driver.init();
  driver.frame(0);
  expect(calls[0].drive?.bassPush).toBeCloseTo(ENVELOPE.bass.attack * defaultIntensity.bass, 6);
});

it('release uses the baked bass release (0.18) when input falls', () => {
  const calls: DriveCall[] = [];
  const driver = createAudioZonesDriver({
    getDefaultIntensity: () => defaultIntensity,
    getRingCount: () => 1,
    getRing: () => makeRing(),
    readZones: (() => {
      let n = 0;
      return () => ({ bass: n++ === 0 ? 1 : 0, mid: 0, treble: 0 });
    })(),
    applyRingZoneDrive: (index, drive) => calls.push({ index, drive })
  });
  driver.init();
  driver.frame(0); // smoothed = 0.35
  driver.frame(16); // raw 0 → respond 0, release 0.18 → 0.35 + (0-0.35)*0.18 = 0.287
  const expected = (0.35 + (0 - 0.35) * 0.18) * defaultIntensity.bass;
  expect(calls[1].drive?.bassPush).toBeCloseTo(expected, 6);
});

it('init() resets smoothed state between runs', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({ ringCount: 1, zones: { bass: 1, mid: 0, treble: 0 }, calls });
  driver.init();
  driver.frame(0); // smoothed.bass = 0.35
  driver.init();
  driver.frame(0); // 0.35 again, not compounding
  expect(calls[1].drive?.bassPush).toBeCloseTo(ENVELOPE.bass.attack * defaultIntensity.bass, 6);
});
```

Keep the floor/saturate/range, treble retract/vibrate, per-ring override, dispose, and ring-count tests — but for any of those that injected `envelopes`/`instantEnvelopes`, remove that injection (the driver no longer accepts it). For the treble tests, note one frame now yields `smoothed.treble = respond(raw)*ENVELOPE.treble.attack(0.8)`, so update their expectations to multiply by `0.8`. Example for the retract test (raw treble 0.4):

```ts
const responded = respondExpect(0.4, RESP.treble.floor, RESP.treble.sat);
const expected = responded * ENVELOPE.treble.attack * defaultIntensity.treble;
expect(calls[0].drive?.trebleRetract).toBeCloseTo(expected, 6);
```

And the vibrate test's `trebleNorm` becomes `responded * ENVELOPE.treble.attack * defaultIntensity.treble` (computed at the same frame the phase is sampled — call `frame(31.25)` after `frame(0)` so smoothed has advanced two attack steps; simplest is to assert the relationship `trebleVibrate === trebleRetract * sin` by reading both fields from the SAME call):

```ts
it('treble vibrate equals retract times the sine phase, same frame', () => {
  const calls: DriveCall[] = [];
  const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
  driver.init();
  driver.frame(31.25); // phase = sin(2*pi*8*0.03125)=sin(pi/2)=1
  const d = calls[0].drive!;
  expect(d.trebleVibrate).toBeCloseTo(d.trebleRetract * 1, 6);
});
```

- [ ] **Step 2: Run the driver spec to verify it fails**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-zones-driver.spec.ts`
Expected: FAIL — driver still reads `deps.getEnvelopes()`, and the deps no longer supply it.

- [ ] **Step 3: Bake the constant in the driver**

In `src/lib/state/animation-drivers/audio-zones-driver.ts`:
- Remove the `Envelopes` type alias and the `getEnvelopes: () => Envelopes;` field from `CreateAudioZonesDriverDeps`.
- Add the constant near `RESPONSE`:

```ts
// Per-band asymmetric attack/release, baked from the old p5 sketch (sketch.js 79-81).
const ENVELOPE = {
  bass: { attack: 0.35, release: 0.18 },
  mid: { attack: 0.5, release: 0.25 },
  treble: { attack: 0.8, release: 0.5 }
} as const;
```

- In `frame()`, delete `const env = deps.getEnvelopes();` and change the smoothing to read the constant:

```ts
      smoothed = {
        bass: envelope(smoothed.bass, responded.bass, ENVELOPE.bass),
        mid: envelope(smoothed.mid, responded.mid, ENVELOPE.mid),
        treble: envelope(smoothed.treble, responded.treble, ENVELOPE.treble)
      };
```

- [ ] **Step 4: Remove envelope state, setter, type field, driver dep**

In `src/lib/state/animation.svelte.ts`:
- In `defaultAudioZonesConfig` (lines ~43-50), remove the `envelopes: { ... }` block, leaving `{ defaultIntensity: { bass: 0.5, mid: 0.5, treble: 0.5 } }`.
- In the `audioZones` driver registration, remove the line `getEnvelopes: () => animationState.audioZones.envelopes,`.
- Delete the entire `setAudioZonesEnvelope` function (lines ~341-353).

In `src/lib/types.ts`, remove the `envelopes` line from `AudioZonesConfig` (line 28), leaving:

```ts
export type AudioZonesConfig = {
	defaultIntensity: ZoneIntensity;
};
```

(Keep `export type EnvelopeParams` — still used by the driver's `envelope()` param type.)

In `src/lib/components/AnimationSection.svelte.spec.ts` and `src/lib/components/Sidebar.svelte.spec.ts`, remove any remaining `setAudioZonesEnvelope: vi.fn(),` line from their module mocks (AnimationSection's was already removed in Task 5; Sidebar's at line ~46 remains).

- [ ] **Step 5: Run the driver spec to verify it passes**

Run: `bun run test:unit -- run src/lib/state/animation-drivers/audio-zones-driver.spec.ts`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run: `bun run test:unit -- run` → all green.
Run: `bun run check` → 0/0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/state/animation-drivers/audio-zones-driver.ts src/lib/state/animation-drivers/audio-zones-driver.spec.ts src/lib/types.ts src/lib/state/animation.svelte.ts src/lib/components/AnimationSection.svelte.spec.ts src/lib/components/Sidebar.svelte.spec.ts
git commit -m "feat: bake audio-zones envelope constants, drop envelope state"
```

---

### Task 7: Manual visual verification + live tuning

**Files:** none (runtime).

- [ ] **Step 1: Launch**

Run: `bun run dev`. Open the printed URL.

- [ ] **Step 2: Verify the snap on Demo**

Animation mode = Audio Zones, source = Demo, press play. Expect: a clear pulse on the beat — bass extends the petal tips toward the canvas edge, treble shimmer on the offbeat, no clipping at full opening, the mark auto-sized to fit. Controls present: source, play/pause, three intensity sliders only.

- [ ] **Step 3: Tune to match the old repo**

If petals open too far (clip) or too little (still soft), adjust the coupled constants and re-verify:
- `REST_FRACTION` in `src/lib/components/PreviewCanvas.svelte` (smaller → mark sits smaller, more headroom).
- `BASS_REACH` in `src/lib/geometry/zones.ts` (larger → petals open further).
After any change: `bun run test:unit -- run src/lib/geometry/zones.spec.ts` (update the `BASS_REACH` guard test value if changed) and `bun run check`. Commit if constants changed.

- [ ] **Step 4: Verify mic/file still work**

Switch source to Microphone and to File (load a track) — confirm petals react to real audio with the same snap.
