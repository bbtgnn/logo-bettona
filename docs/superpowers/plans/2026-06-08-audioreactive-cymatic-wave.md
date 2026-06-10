# Cymatic Wave in `audioBars` Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make petals ripple like a travelling wave in the existing `audioBars` animation mode, driven by a deterministic dev fallback signal, applied to each ring's template curve before `bend.ts` mirrors/tiles it.

**Architecture:** A pure `applyWaveToPath(path, wave)` deforms the template's x-coordinates with a smooth sine; `render-pipeline` calls it after morph and before `buildRingPath`, so the ripple appears coherently on every mirrored copy and exports for free. The `audioBars` driver maps per-ring band energy → wave amplitude via an injected `applyRingWave` side-effect (returns `{}`, leaving `morphT` untouched). `wave` lives on `Ring` but is stripped from localStorage persistence so it never churns to disk or restores stale on reload.

**Tech Stack:** SvelteKit, TypeScript, paper.js, rune-sync, vitest (client=chromium browser project, server=node project), bun.

**Spec:** `docs/superpowers/specs/2026-06-08-audioreactive-cymatic-wave-design.md`

**Scope:** Tasks A–C + dev fallback. Mic capture (Task D) and UI sliders (Task E) are deferred.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/types.ts` | Add `WaveState`; `Ring.wave?` | Modify |
| `src/lib/geometry/wave.ts` | Pure `applyWaveToPath` | Create |
| `src/lib/geometry/wave.spec.ts` | Tests for wave geometry (server project) | Create |
| `src/lib/geometry/render-pipeline.ts` | Apply wave after morph, before `buildRingPath` | Modify |
| `src/lib/geometry/render-pipeline.svelte.spec.ts` | Wave integration cases (client project) | Modify |
| `src/lib/state/composition-persistence.svelte.ts` | Persisted `composition` rune, wave-stripped | Create |
| `src/lib/state/composition-persistence.svelte.spec.ts` | Persistence gating tests (client project) | Create |
| `src/lib/state/composition.ts` | Re-export `composition`; add `setRingWave` | Modify |
| `src/lib/state/animation-drivers/types.ts` | Extend `AudioBarsConfig` | Modify |
| `src/lib/state/animation-drivers/audio-bars-driver.ts` | Drive wave via `applyRingWave`, return `{}` | Modify |
| `src/lib/state/animation-drivers/audio-bars-driver.spec.ts` | Rewrite driver tests (server project) | Modify |
| `src/lib/state/animation-drivers/fallback-bars.ts` | Deterministic dev bar source | Create |
| `src/lib/state/animation-drivers/fallback-bars.spec.ts` | Fallback tests (server project) | Create |
| `src/lib/state/animation.svelte.ts` | Defaults + driver wiring | Modify |

**Test routing (from `vite.config.ts`):** plain `*.spec.ts` → **server** (node); `*.svelte.spec.ts` → **client** (chromium, has `localStorage`/canvas). Run a single file with `npx vitest run <path>` (vitest auto-routes to the matching project).

---

## Task 1: Data model — `WaveState` and `Ring.wave`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add the `WaveState` type and the optional `Ring.wave` field**

In `src/lib/types.ts`, add after the `Path` type:

```ts
export type WaveState = {
	amplitude: number; // 0..1, fraction of the template width
	crests: number; // integer >= 1, number of periods along the petal
	phase: number; // radians
};
```

Then add the optional field to `Ring` (place it after `ringHeight`):

```ts
export type Ring = {
	copies: number;
	color: string;
	templatePath: Path | null;
	secondaryTemplatePath: Path | null;
	morphT: number;
	ringHeight: number;
	wave?: WaveState | null; // absent/null → no wave → renders identical to today
};
```

- [ ] **Step 2: Verify the project still typechecks**

Run: `npm run check`
Expected: PASS (no type errors). The optional field is backward-compatible with all existing `Ring` literals.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add WaveState type and optional Ring.wave field"
```

---

## Task 2: Pure geometry — `applyWaveToPath`

**Files:**
- Create: `src/lib/geometry/wave.ts`
- Test: `src/lib/geometry/wave.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/geometry/wave.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Path, WaveState } from '$lib/types';
import { applyWaveToPath } from './wave';

const square: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 100, 0, 100]
};

describe('applyWaveToPath', () => {
	it('returns an unchanged copy when amplitude is 0', () => {
		const wave: WaveState = { amplitude: 0, crests: 3, phase: 0 };
		const result = applyWaveToPath(square, wave);

		expect(result).not.toBe(square);
		expect(result.crds).not.toBe(square.crds);
		expect(result.crds).toEqual(square.crds);
		expect(result.cmds).toEqual(square.cmds);
	});

	it('shifts x by amplitude*width*sin(crests*pi*ny + phase), y unchanged', () => {
		// width = 100, height = 100, minX = 0, minY = 0.
		// phase = pi/2 so sin(crests*pi*ny + pi/2) = cos(crests*pi*ny).
		const wave: WaveState = { amplitude: 0.5, crests: 1, phase: Math.PI / 2 };
		const result = applyWaveToPath(square, wave);

		// Point (0,0): ny=0 → cos(0)=1 → dx = 0.5*100*1 = 50 → x = 50.
		expect(result.crds[0]).toBeCloseTo(50, 6);
		expect(result.crds[1]).toBe(0); // y unchanged
		// Point (100,100): ny=1 → cos(pi) = -1 → dx = 0.5*100*-1 = -50 → x = 50.
		expect(result.crds[4]).toBeCloseTo(50, 6);
		expect(result.crds[5]).toBe(100); // y unchanged
	});

	it('preserves command list and coordinate length', () => {
		const wave: WaveState = { amplitude: 0.3, crests: 4, phase: 1 };
		const result = applyWaveToPath(square, wave);

		expect(result.cmds).toEqual(square.cmds);
		expect(result.cmds).not.toBe(square.cmds);
		expect(result.crds).toHaveLength(square.crds.length);
	});

	it('is deterministic for the same input', () => {
		const wave: WaveState = { amplitude: 0.3, crests: 4, phase: 1 };
		expect(applyWaveToPath(square, wave).crds).toEqual(applyWaveToPath(square, wave).crds);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/geometry/wave.spec.ts`
Expected: FAIL — `applyWaveToPath` is not defined / module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/geometry/wave.ts`:

```ts
import type { Path, WaveState } from '$lib/types';

const EPSILON = 1e-6;

/**
 * Ripples a template path by shifting every x-coordinate with a smooth sine
 * whose argument runs along the normalized y-axis of the path.
 *
 * Why x: in bend.ts `anchorToPolar`, template x → angle (the wobble direction)
 * and y → radius (base ↔ tip of the petal). Perturbing x therefore moves points
 * tangentially. Anchors AND control points are perturbed with the same smooth
 * function, so the cubic/quadratic handles stay coherent.
 *
 * Pure: never mutates the input. amplitude <= 0 returns an unchanged copy, so a
 * ring without a wave (or at rest) renders identical to before.
 */
export function applyWaveToPath(path: Path, wave: WaveState): Path {
	if (!path || wave.amplitude <= 0) {
		return { cmds: [...path.cmds], crds: [...path.crds] };
	}

	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (let i = 0; i + 1 < path.crds.length; i += 2) {
		const x = path.crds[i];
		const y = path.crds[i + 1];
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}

	const width = Math.max(maxX - minX, EPSILON);
	const height = Math.max(maxY - minY, EPSILON);

	const crds = [...path.crds];
	for (let i = 0; i + 1 < crds.length; i += 2) {
		const x = crds[i];
		const y = crds[i + 1];
		const ny = (y - minY) / height;
		const dx = wave.amplitude * width * Math.sin(wave.crests * Math.PI * ny + wave.phase);
		crds[i] = x + dx;
		// y unchanged
	}

	return { cmds: [...path.cmds], crds };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/geometry/wave.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/wave.ts src/lib/geometry/wave.spec.ts
git commit -m "feat: add pure applyWaveToPath geometry deformation"
```

---

## Task 3: Wire wave into `render-pipeline`

**Files:**
- Modify: `src/lib/geometry/render-pipeline.ts` (import + insertion at the morph block, around lines 1-4 and 125-143)
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append these two tests inside the `describe('createRenderPipeline().render', ...)` block in `src/lib/geometry/render-pipeline.svelte.spec.ts` (before the closing `});` at line 294):

```ts
	it('applies wave deformation to ring geometry when ring.wave is set', () => {
		const pipeline = createRenderPipeline();
		const viewport = { width: 600, height: 600, padding: 32 };
		const oneRing = { ...composition, rings: [composition.rings[0]] };

		pipeline.render({ composition: oneRing, scope, viewport });
		const withoutWave = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		pipeline.render({
			composition: {
				...oneRing,
				rings: [{ ...composition.rings[0], wave: { amplitude: 0.3, crests: 3, phase: 0 } }]
			},
			scope,
			viewport
		});
		const withWave = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		expect(withWave).not.toBe(withoutWave);
	});

	it('renders identically when ring.wave is null or amplitude 0', () => {
		const pipeline = createRenderPipeline();
		const viewport = { width: 600, height: 600, padding: 32 };
		const oneRing = { ...composition, rings: [composition.rings[0]] };

		pipeline.render({ composition: oneRing, scope, viewport });
		const baseline = (scope.project.activeLayer.children[0] as paper.Path).pathData;

		pipeline.render({
			composition: { ...oneRing, rings: [{ ...composition.rings[0], wave: null }] },
			scope,
			viewport
		});
		expect((scope.project.activeLayer.children[0] as paper.Path).pathData).toBe(baseline);

		pipeline.render({
			composition: {
				...oneRing,
				rings: [{ ...composition.rings[0], wave: { amplitude: 0, crests: 3, phase: 1 } }]
			},
			scope,
			viewport
		});
		expect((scope.project.activeLayer.children[0] as paper.Path).pathData).toBe(baseline);
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/geometry/render-pipeline.svelte.spec.ts`
Expected: FAIL — `withWave` equals `withoutWave` (wave not applied yet).

- [ ] **Step 3: Add the import**

In `src/lib/geometry/render-pipeline.ts`, add to the imports at the top (after the `path-morph` import on line 4):

```ts
import { applyWaveToPath } from './wave';
```

- [ ] **Step 4: Insert wave application before `buildRingPath`**

In `src/lib/geometry/render-pipeline.ts`, find this block (currently lines 142-143):

```ts
				const radius = composition.baseRadius + composition.ringIncrement * i;
				const ringPath = buildRingPath(effectiveRing, radius, scope);
```

Replace it with:

```ts
				// Apply the cymatic wave to the (already morph-interpolated) template
				// BEFORE bend mirrors/tiles it, so the ripple is coherent on every copy.
				if (effectiveRing.wave && effectiveRing.wave.amplitude > 0 && effectiveRing.templatePath) {
					effectiveRing = {
						...effectiveRing,
						templatePath: applyWaveToPath(effectiveRing.templatePath, effectiveRing.wave)
					};
				}

				const radius = composition.baseRadius + composition.ringIncrement * i;
				const ringPath = buildRingPath(effectiveRing, radius, scope);
```

Note: `effectiveRing` is declared with `let` at line 125, so reassignment is valid.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/geometry/render-pipeline.svelte.spec.ts`
Expected: PASS (all existing cases + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/geometry/render-pipeline.ts src/lib/geometry/render-pipeline.svelte.spec.ts
git commit -m "feat: apply cymatic wave in render pipeline before bend"
```

---

## Task 4: Wave-stripped composition persistence + `setRingWave`

**Files:**
- Create: `src/lib/state/composition-persistence.svelte.ts`
- Test: `src/lib/state/composition-persistence.svelte.spec.ts`
- Modify: `src/lib/state/composition.ts` (lines 1-12 imports, line 39 composition export, add `setRingWave`)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/state/composition-persistence.svelte.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import type { Composition } from '$lib/types';
import { createPersistedComposition } from './composition-persistence.svelte';

function makeComposition(): Composition {
	return {
		baseRadius: 100,
		ringIncrement: 60,
		rings: [
			{
				copies: 4,
				color: '#000000',
				templatePath: { cmds: ['M', 'L'], crds: [0, 0, 10, 10] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.4
			}
		],
		monochromePalettes: [{ main: '#000', bg: '#fff' }],
		fullPalettes: [{ colors: ['#000', '#fff'] }]
	};
}

let key = '';
let counter = 0;

beforeEach(() => {
	counter += 1;
	key = `test-composition-${counter}`;
	localStorage.clear();
});

describe('createPersistedComposition', () => {
	it('persists non-wave changes to localStorage under the given key', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.baseRadius = 200;
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.baseRadius).toBe(200);
	});

	it('does not write to localStorage when only ring.wave changes', () => {
		const state = createPersistedComposition(key, makeComposition());

		// Establish a known stored baseline via a non-wave change.
		flushSync(() => {
			state.baseRadius = 150;
		});
		const before = localStorage.getItem(key);

		// Mutating only wave must not change what is stored.
		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				wave: { amplitude: 0.4, crests: 3, phase: 1.2 }
			}));
		});

		expect(localStorage.getItem(key)).toBe(before);
	});

	it('never includes a wave key in the stored blob', () => {
		const state = createPersistedComposition(key, makeComposition());

		flushSync(() => {
			state.rings = state.rings.map((ring) => ({
				...ring,
				wave: { amplitude: 0.4, crests: 3, phase: 1.2 }
			}));
			state.baseRadius = 175; // force a write
		});

		const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
		expect(stored.rings[0].wave).toBeUndefined();
		expect(stored.baseRadius).toBe(175);
	});

	it('loads a previously stored wave-less composition unchanged', () => {
		const saved = makeComposition();
		saved.baseRadius = 321;
		localStorage.setItem(key, JSON.stringify(saved));

		const state = createPersistedComposition(key, makeComposition());
		expect(state.baseRadius).toBe(321);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/state/composition-persistence.svelte.spec.ts`
Expected: FAIL — module / `createPersistedComposition` not found.

- [ ] **Step 3: Write the persistence module**

Create `src/lib/state/composition-persistence.svelte.ts`:

```ts
import { untrack } from 'svelte';
import { localStorageSync } from 'rune-sync/localstorage';
import type { Composition } from '$lib/types';
import { DEFAULT_COMPOSITION } from './default';

/**
 * Returns a copy of the composition with the transient `wave` field removed from
 * every ring. Persistence and the dirty-check both operate on this shape, so the
 * audio-driven wave never reaches localStorage and a reload never restores a
 * rippled logo. The stored shape is byte-identical to the pre-wave format.
 */
function stripWave(composition: Composition): Composition {
	return {
		...composition,
		rings: composition.rings.map(({ wave: _wave, ...rest }) => rest)
	};
}

/**
 * Creates a `$state` composition synced to localStorage via the genuine
 * `localStorageSync` driver, but with the dirty-check gated on the wave-stripped
 * snapshot: a frame that changes only `ring.wave` performs no `setItem`.
 *
 * Modeled on rune-sync's createSyncState lifecycle (effect root + read on init +
 * cross-tab subscribe), narrowed to our stripping requirement.
 */
export function createPersistedComposition(key: string, initial: Composition): Composition {
	const state = $state<Composition>(structuredClone(initial));

	if (typeof window === 'undefined') return state;

	$effect.root(() => {
		let lastSavedStripped: string;

		untrack(() => {
			const saved = localStorageSync.read<Composition>(key);
			if (saved) Object.assign(state, saved);
			lastSavedStripped = JSON.stringify(stripWave($state.snapshot(state) as Composition));
		});

		if (localStorageSync.subscribe) {
			localStorageSync.subscribe<Composition>(key, (remote) => {
				untrack(() => {
					Object.assign(state, remote);
					lastSavedStripped = JSON.stringify(stripWave($state.snapshot(state) as Composition));
				});
			});
		}

		$effect(() => {
			const stripped = stripWave($state.snapshot(state) as Composition);
			const serialized = JSON.stringify(stripped);
			if (serialized === lastSavedStripped) return; // wave-only change → no write
			untrack(() => {
				localStorageSync.write(key, stripped);
				lastSavedStripped = serialized;
			});
		});
	});

	return state;
}

export const composition = createPersistedComposition('composition', DEFAULT_COMPOSITION);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/state/composition-persistence.svelte.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Switch `composition.ts` to the new persisted rune and add `setRingWave`**

In `src/lib/state/composition.ts`:

(a) Update the type imports (lines 2-9) to include `WaveState`:

```ts
import type {
	ColorModeState,
	ColorMode,
	Composition,
	FullPalette,
	MonochromePalette,
	Ring,
	WaveState
} from '$lib/types';
```

(b) Add the re-export import near the top (after the `DEFAULT_COMPOSITION` import on line 12):

```ts
import { composition } from './composition-persistence.svelte';
```

(c) Replace the old composition declaration (line 39):

```ts
export const composition = lsSync<Composition>('composition', DEFAULT_COMPOSITION);
```

with a re-export of the imported rune:

```ts
export { composition };
```

Leave `colorMode` (line 14) and `uiState` (line 41) on `lsSync` unchanged.

(d) Add the mutator after `setRingMorphT` (after line 143). It mirrors `setRingMorphT`'s immutable rings map:

```ts
export function setRingWave(index: number, wave: WaveState | null) {
	composition.rings = composition.rings.map((ring, i) =>
		i === index ? { ...ring, wave } : ring
	);
}
```

- [ ] **Step 6: Verify composition tests + typecheck still pass**

Run: `npx vitest run src/lib/state/composition.svelte.spec.ts`
Expected: PASS (existing composition tests unaffected).

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/state/composition-persistence.svelte.ts src/lib/state/composition-persistence.svelte.spec.ts src/lib/state/composition.ts
git commit -m "feat: persist composition with wave stripped from storage"
```

---

## Task 5: Extend `AudioBarsConfig` with wave params + defaults

**Files:**
- Modify: `src/lib/state/animation-drivers/types.ts` (lines 9-13)
- Modify: `src/lib/state/animation.svelte.ts` (lines 26-30 `defaultAudioBarsConfig`)

- [ ] **Step 1: Extend the config type**

In `src/lib/state/animation-drivers/types.ts`, replace the `AudioBarsConfig` type (lines 9-13):

```ts
export type AudioBarsConfig = {
	smoothing: number;
	minHz: number;
	maxHz: number;
};
```

with:

```ts
export type AudioBarsConfig = {
	smoothing: number;
	minHz: number;
	maxHz: number;
	waveCrests: number; // integer >= 1, periods along the petal
	waveAmplitudeGain: number; // band energy (0..1) → wave amplitude
	wavePhaseSpeed: number; // rad/sec, travel speed of the wave
};
```

- [ ] **Step 2: Add the default values**

In `src/lib/state/animation.svelte.ts`, replace `defaultAudioBarsConfig` (lines 26-30):

```ts
const defaultAudioBarsConfig: AudioBarsConfig = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 20000
};
```

with:

```ts
const defaultAudioBarsConfig: AudioBarsConfig = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 20000,
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2
};
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run check`
Expected: PASS. (The driver itself does not yet read the new fields; that is Task 6. `animation.svelte.ts` still compiles because the driver dep shape is unchanged until Task 6.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/state/animation-drivers/types.ts src/lib/state/animation.svelte.ts
git commit -m "feat: add wave params to AudioBarsConfig and defaults"
```

---

## Task 6: Rewrite the `audioBars` driver to drive the wave

**Files:**
- Modify: `src/lib/state/animation-drivers/audio-bars-driver.ts` (full rewrite)
- Test: `src/lib/state/animation-drivers/audio-bars-driver.spec.ts` (full rewrite)

- [ ] **Step 1: Rewrite the test**

Replace the entire contents of `src/lib/state/animation-drivers/audio-bars-driver.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { WaveState } from '$lib/types';
import type { AudioBarsConfig } from './types';
import { createAudioBarsDriver } from './audio-bars-driver';

const config: AudioBarsConfig = {
	smoothing: 0.5,
	minHz: 20,
	maxHz: 16000,
	waveCrests: 3,
	waveAmplitudeGain: 0.3,
	wavePhaseSpeed: 2.2
};

type WaveCall = { index: number; wave: WaveState | null };

function makeDriver(overrides: {
	ringCount?: number;
	bars?: number[];
	calls: WaveCall[];
}) {
	return createAudioBarsDriver({
		getConfig: () => config,
		getRingCount: () => overrides.ringCount ?? 2,
		readBars: () => overrides.bars ?? [0.5, 1.1],
		applyRingWave: (index, wave) => overrides.calls.push({ index, wave })
	});
}

describe('createAudioBarsDriver', () => {
	it('applies a wave per ring with amplitude from bands and phase from time', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 2, bars: [0.5, 1.1], calls });

		driver.init();
		const result = driver.frame(1000); // 1s → phaseBase = 1 * 2.2 = 2.2

		expect(result).toEqual({}); // morphT untouched in this mode
		expect(calls).toHaveLength(2);

		// ring 0: amplitude = clamp01(0.5) * 0.3 = 0.15, phase = 2.2 + 0*0.4
		expect(calls[0].index).toBe(0);
		expect(calls[0].wave?.amplitude).toBeCloseTo(0.15, 6);
		expect(calls[0].wave?.crests).toBe(3);
		expect(calls[0].wave?.phase).toBeCloseTo(2.2, 6);

		// ring 1: amplitude = clamp01(1.1) * 0.3 = 0.3, phase = 2.2 + 1*0.4 = 2.6
		expect(calls[1].index).toBe(1);
		expect(calls[1].wave?.amplitude).toBeCloseTo(0.3, 6);
		expect(calls[1].wave?.phase).toBeCloseTo(2.6, 6);
	});

	it('treats missing/non-finite band values as 0 amplitude', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 2, bars: [], calls });

		driver.frame(0);

		expect(calls[0].wave?.amplitude).toBe(0);
		expect(calls[1].wave?.amplitude).toBe(0);
	});

	it('sanitizes a non-integer ring count before iterating', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 2.8, bars: [0.2, 0.4, 0.6], calls });

		driver.frame(0);

		expect(calls.map((c) => c.index)).toEqual([0, 1]);
	});

	it('clears the wave on every ring when disposed', () => {
		const calls: WaveCall[] = [];
		const driver = makeDriver({ ringCount: 3, calls });

		driver.dispose();

		expect(calls).toEqual([
			{ index: 0, wave: null },
			{ index: 1, wave: null },
			{ index: 2, wave: null }
		]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/state/animation-drivers/audio-bars-driver.spec.ts`
Expected: FAIL — driver does not accept `applyRingWave` / still returns the old morphT frame.

- [ ] **Step 3: Rewrite the driver**

Replace the entire contents of `src/lib/state/animation-drivers/audio-bars-driver.ts`:

```ts
import type { WaveState } from '$lib/types';
import type { AudioBarsConfig } from './types';

type AnimationDriver = {
	init: () => void;
	dispose: () => void;
	frame: (nowMs: number) => Record<number, number>;
};

type CreateAudioBarsDriverDeps = {
	getConfig: () => AudioBarsConfig;
	getRingCount: () => number;
	readBars: () => number[];
	applyRingWave: (index: number, wave: WaveState | null) => void;
};

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeRingCount(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (!Number.isInteger(value)) return Math.max(0, Math.floor(value));
	return Math.max(0, value);
}

/**
 * In `audioBars` mode, per-band energy drives the corresponding ring's wave
 * AMPLITUDE; the phase scrolls over time (travelling wave → sense of rotation);
 * crests are constant from config. We pilot the wave only — `morphT`/breathing is
 * a separate concern, so `frame` returns `{}` (the runtime applies returned values
 * as morphT) and the wave is pushed via the injected `applyRingWave` side-effect.
 * A small per-ring phase offset makes the rings feel more organic.
 */
export function createAudioBarsDriver(deps: CreateAudioBarsDriverDeps): AnimationDriver {
	return {
		init() {
			deps.getConfig();
		},
		dispose() {
			const ringCount = normalizeRingCount(deps.getRingCount());
			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				deps.applyRingWave(ringIndex, null);
			}
		},
		frame(nowMs) {
			const cfg = deps.getConfig();
			const ringCount = normalizeRingCount(deps.getRingCount());
			const bars = deps.readBars();
			const phaseBase = ((Number.isFinite(nowMs) ? nowMs : 0) / 1000) * cfg.wavePhaseSpeed;

			for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
				deps.applyRingWave(ringIndex, {
					amplitude: clamp01(bars[ringIndex] ?? 0) * cfg.waveAmplitudeGain,
					crests: cfg.waveCrests,
					phase: phaseBase + ringIndex * 0.4
				});
			}

			return {};
		}
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/state/animation-drivers/audio-bars-driver.spec.ts`
Expected: PASS (4 tests).

Note: `npm run check` will report a type error in `animation.svelte.ts` (the driver now requires `applyRingWave`) until Task 8. That is expected and fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/audio-bars-driver.ts src/lib/state/animation-drivers/audio-bars-driver.spec.ts
git commit -m "feat: drive cymatic wave from audioBars driver"
```

---

## Task 7: Deterministic dev fallback bar source

**Files:**
- Create: `src/lib/state/animation-drivers/fallback-bars.ts`
- Test: `src/lib/state/animation-drivers/fallback-bars.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/state/animation-drivers/fallback-bars.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFallbackBars } from './fallback-bars';

describe('createFallbackBars', () => {
	it('returns one value per ring in the 0..1 range', () => {
		const source = createFallbackBars({ getRingCount: () => 5 });
		const bars = source.readBars();

		expect(bars).toHaveLength(5);
		for (const value of bars) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	it('adapts length to the current ring count', () => {
		let count = 2;
		const source = createFallbackBars({ getRingCount: () => count });
		expect(source.readBars()).toHaveLength(2);
		count = 4;
		expect(source.readBars()).toHaveLength(4);
	});

	it('returns an empty array for a non-positive ring count', () => {
		const source = createFallbackBars({ getRingCount: () => 0 });
		expect(source.readBars()).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/state/animation-drivers/fallback-bars.spec.ts`
Expected: FAIL — module / `createFallbackBars` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/state/animation-drivers/fallback-bars.ts`:

```ts
type CreateFallbackBarsDeps = {
	getRingCount: () => number;
};

/**
 * Deterministic, dependency-free dev signal so the cymatic wave visibly animates
 * without a microphone. Each ring gets a smooth value in 0..1 from a sum of slow
 * sines of `performance.now()` and the ring index. This is the seam for Task D:
 * the real Web Audio source will expose the same `readBars(): number[]` contract.
 */
export function createFallbackBars(deps: CreateFallbackBarsDeps): { readBars: () => number[] } {
	return {
		readBars() {
			const count = Math.max(0, Math.floor(deps.getRingCount()));
			const t = performance.now() / 1000;
			const bars: number[] = [];
			for (let i = 0; i < count; i += 1) {
				// a + b stays within [-1, 1] (0.6 + 0.4 = 1), so the result is in 0..1.
				const a = 0.6 * Math.sin(t * 1.3 + i * 0.9);
				const b = 0.4 * Math.sin(t * 0.7 + i * 1.7 + 1.1);
				bars.push(0.5 + 0.5 * (a + b));
			}
			return bars;
		}
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/state/animation-drivers/fallback-bars.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation-drivers/fallback-bars.ts src/lib/state/animation-drivers/fallback-bars.spec.ts
git commit -m "feat: add deterministic dev fallback bar source"
```

---

## Task 8: Wire the driver in `animation.svelte.ts`

**Files:**
- Modify: `src/lib/state/animation.svelte.ts` (lines 1-2 imports, lines 69-76 driver registration)

- [ ] **Step 1: Add imports**

In `src/lib/state/animation.svelte.ts`, update the composition import (line 1) to include `setRingWave`:

```ts
import { composition, setRingMorphT, setRingWave } from './composition';
```

Add the fallback-source import after the existing driver imports (after line 5):

```ts
import { createFallbackBars } from './animation-drivers/fallback-bars';
```

- [ ] **Step 2: Construct the fallback source**

In `src/lib/state/animation.svelte.ts`, add this right after the `runtime` is created (after line 58, before the first `runtime.registerDriver(...)`):

```ts
const fallbackBars = createFallbackBars({
	getRingCount: () => composition.rings.length
});
```

- [ ] **Step 3: Wire the audioBars driver deps**

Replace the `audioBars` driver registration (lines 69-76):

```ts
runtime.registerDriver(
	'audioBars',
	createAudioBarsDriver({
		getConfig: () => animationState.audioBars,
		getRingCount: () => composition.rings.length,
		readBars: () => []
	})
);
```

with:

```ts
runtime.registerDriver(
	'audioBars',
	createAudioBarsDriver({
		getConfig: () => animationState.audioBars,
		getRingCount: () => composition.rings.length,
		readBars: () => fallbackBars.readBars(),
		applyRingWave: (index, wave) => setRingWave(index, wave)
	})
);
```

- [ ] **Step 4: Verify the whole project typechecks and the animation tests pass**

Run: `npm run check`
Expected: PASS (the driver dep error from Task 6 is now resolved).

Run: `npx vitest run src/lib/state/animation.svelte.spec.ts`
Expected: PASS (existing animation tests unaffected — `audioBars` still registers and `morphT` modes behave as before).

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/animation.svelte.ts
git commit -m "feat: wire fallback bars and wave into audioBars driver"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit -- --run`
Expected: PASS — all suites green (both client and server projects), including the new `wave`, `fallback-bars`, `composition-persistence` suites and the rewritten `audio-bars-driver` suite.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Lint + format check**

Run: `npm run lint`
Expected: PASS. If Prettier reports formatting, run `npm run format`, then re-run `npm run lint`, then commit the formatting:

```bash
git add -A
git commit -m "style: format wave feature files"
```

- [ ] **Step 4: Manual visual check (optional but recommended)**

Run: `npm run dev`, open the app, set the animation mode to `audioBars`, and press play. Confirm: petals ripple, the ripple travels (slight rotation), amplitude varies over time (fallback signal), and stopping the animation returns the mark to rest. Reload the page and confirm the logo loads un-rippled (wave not persisted).

---

## Self-Review notes (resolved)

- **Spec coverage:** Task A → T1; Task B → T2/T3; Task C → T5/T6; fallback → T7; persistence decision → T4; wiring → T8; tests → embedded per task + T9. All spec sections mapped.
- **Type consistency:** `WaveState` (T1) used identically in `wave.ts` (T2), driver (T6), `setRingWave` (T4), wiring (T8). `applyRingWave(index, wave)` signature matches between driver deps (T6) and `setRingWave` (T4/T8). `AudioBarsConfig` fields `waveCrests`/`waveAmplitudeGain`/`wavePhaseSpeed` consistent across T5/T6.
- **Ordering caveat:** after T6 and before T8, `npm run check` is intentionally red (driver requires the new dep); resolved in T8. Each task's own unit test stays green throughout.
