# Kaleidoscope Block 2 — Keyframe System + Timeline Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable keyframe animation system + an After Effects / Premiere–style bottom timeline editor (track view + graph editor), wired to the kaleidoscope `globalRotation` as the live demo parameter.

**Architecture:** Pure keyframe math (`keyframes.ts`) + pure coordinate mapping (`timeline-geometry.ts`) carry all logic and are node-tested. A `$state` store (`keyframes.svelte.ts`) holds tracks and persists them. The **existing** animation clock (`animation.svelte.ts`) is widened to start when keyframe tracks are enabled and, each tick, applies the sampled value to the kaleidoscope. Svelte components render the bottom panel and write through the store; their drag handlers delegate to the pure coordinate helpers, so component tests cover click/select/add/delete while drag math is unit-tested.

**Tech Stack:** TypeScript, Svelte 5 (runes), SvelteKit, vitest (node + chromium browser projects), rune-sync `localStorageSync`, Tailwind, shadcn/svelte.

## Global Constraints

- Package manager **bun**. Run a single spec: `bun run test:unit -- run <path>`. Run the FULL suite before each commit: `bun run test:unit -- run` (a Sidebar/composition-mock regression only surfaces in the full chromium run). Type check: `bun run check`.
- **vitest project routing** (`vite.config.ts`): browser/chromium project includes only `src/**/*.svelte.{test,spec}.{js,ts}`; node project includes `*.test.{js,ts}` and `*.!(*.svelte).spec.{js,ts}` PLUS the special-cased `src/lib/state/animation.svelte.spec.ts`. Therefore: pure/node tests are `*.spec.ts`; tests needing DOM/`window`/`localStorage` are `*.svelte.spec.ts`. The animation integration test stays in `animation.svelte.spec.ts` (already routed to node).
- **Tab indentation** in all `.svelte` and `.ts` files.
- Every `.svelte` file edited MUST pass the `svelte-autofixer` MCP (`issues: []` is the gate). The "function declared inside $effect" suggestion on canvas/rAF/pointer side-effect functions is a KNOWN false positive — ignore only that class.
- `$state`-bearing state modules MUST guard persistence with `typeof window === 'undefined'` early-return so node imports (the animation integration test) don't touch `localStorage`.
- Italian UI copy (designer-facing), English code/identifiers/commit messages.
- Do NOT touch `bend.ts`, `render-pipeline.ts`, audio drivers, morph semantics, or the Block 1 kaleidoscope engine/rendering. The only edit to `animation.svelte.ts` is the additive start-gate widening + per-tick apply step.
- Spec reference: `docs/superpowers/specs/2026-06-18-kaleidoscope-mode-block-2-design.md`.

---

### Task 1: Pure keyframe types + helpers + linear/hold/edge sampling

**Files:**
- Create: `src/lib/animation/keyframes.ts`
- Test: `src/lib/animation/keyframes.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Interp = 'linear' | 'bezier' | 'hold'`
  - `type Handle = { dx: number; dy: number }`
  - `type Keyframe = { id: string; time: number; value: number; interp: Interp; handleOut: Handle; handleIn: Handle }`
  - `type Track = { paramId: string; enabled: boolean; keyframes: Keyframe[] }`
  - `const EASY_EASE_OUT: Handle` (= `{ dx: 1/3, dy: 0 }`), `const EASY_EASE_IN: Handle` (= `{ dx: -1/3, dy: 0 }`)
  - `clamp01(n: number): number`
  - `sortKeyframes(kfs: Keyframe[]): Keyframe[]` (stable, ascending `time`)
  - `sampleTrack(track: Track, t: number): number | null` (bezier path stubbed to linear here; replaced in Task 2)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/animation/keyframes.spec.ts
import { describe, it, expect } from 'vitest';
import { clamp01, sortKeyframes, sampleTrack, type Track, type Keyframe } from './keyframes';

const kf = (time: number, value: number, interp: Keyframe['interp'] = 'linear'): Keyframe => ({
	id: `${time}`,
	time,
	value,
	interp,
	handleOut: { dx: 1 / 3, dy: 0 },
	handleIn: { dx: -1 / 3, dy: 0 }
});

const track = (keyframes: Keyframe[], enabled = true): Track => ({
	paramId: 'p',
	enabled,
	keyframes
});

describe('keyframes pure', () => {
	it('clamps to 0..1', () => {
		expect(clamp01(-2)).toBe(0);
		expect(clamp01(2)).toBe(1);
		expect(clamp01(0.4)).toBe(0.4);
		expect(clamp01(NaN)).toBe(0);
	});

	it('sorts keyframes ascending by time', () => {
		const sorted = sortKeyframes([kf(0.8, 1), kf(0.2, 2), kf(0.5, 3)]);
		expect(sorted.map((k) => k.time)).toEqual([0.2, 0.5, 0.8]);
	});

	it('returns null for an empty track', () => {
		expect(sampleTrack(track([]), 0.5)).toBeNull();
	});

	it('returns the single keyframe value everywhere', () => {
		const tr = track([kf(0.3, 42)]);
		expect(sampleTrack(tr, 0)).toBe(42);
		expect(sampleTrack(tr, 1)).toBe(42);
	});

	it('clamps before first and after last keyframe', () => {
		const tr = track([kf(0.2, 10), kf(0.8, 20)]);
		expect(sampleTrack(tr, 0)).toBe(10);
		expect(sampleTrack(tr, 1)).toBe(20);
	});

	it('interpolates linearly between two keyframes', () => {
		const tr = track([kf(0, 0, 'linear'), kf(1, 100, 'linear')]);
		expect(sampleTrack(tr, 0.25)).toBeCloseTo(25, 6);
		expect(sampleTrack(tr, 0.5)).toBeCloseTo(50, 6);
	});

	it('holds the left value across a hold segment then jumps', () => {
		const tr = track([kf(0, 10, 'hold'), kf(1, 20, 'hold')]);
		expect(sampleTrack(tr, 0.99)).toBe(10);
		expect(sampleTrack(tr, 1)).toBe(20);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/animation/keyframes.spec.ts`
Expected: FAIL (module `./keyframes` not found / exports undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/animation/keyframes.ts
export type Interp = 'linear' | 'bezier' | 'hold';
export type Handle = { dx: number; dy: number };
export type Keyframe = {
	id: string;
	time: number;
	value: number;
	interp: Interp;
	handleOut: Handle;
	handleIn: Handle;
};
export type Track = {
	paramId: string;
	enabled: boolean;
	keyframes: Keyframe[];
};

export const EASY_EASE_OUT: Handle = { dx: 1 / 3, dy: 0 };
export const EASY_EASE_IN: Handle = { dx: -1 / 3, dy: 0 };

export function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

export function sortKeyframes(kfs: Keyframe[]): Keyframe[] {
	return [...kfs].sort((a, b) => a.time - b.time);
}

function lerp(a: number, b: number, u: number): number {
	return a + (b - a) * u;
}

// Bezier path is added in Task 2; until then it falls back to linear.
function sampleSegment(a: Keyframe, b: Keyframe, t: number): number {
	if (a.interp === 'hold') return t >= b.time ? b.value : a.value;
	const span = b.time - a.time;
	const u = span <= 0 ? 1 : (t - a.time) / span;
	return lerp(a.value, b.value, u);
}

export function sampleTrack(track: Track, t: number): number | null {
	const kfs = sortKeyframes(track.keyframes);
	if (kfs.length === 0) return null;
	if (kfs.length === 1) return kfs[0].value;
	if (t <= kfs[0].time) return kfs[0].value;
	if (t >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
	for (let i = 0; i < kfs.length - 1; i++) {
		const a = kfs[i];
		const b = kfs[i + 1];
		if (t >= a.time && t <= b.time) return sampleSegment(a, b, t);
	}
	return kfs[kfs.length - 1].value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/animation/keyframes.spec.ts`
Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/animation/keyframes.ts src/lib/animation/keyframes.spec.ts
git commit -m "feat: pure keyframe types + linear/hold/edge sampling"
```

---

### Task 2: Bezier segment sampling

**Files:**
- Modify: `src/lib/animation/keyframes.ts`
- Test: `src/lib/animation/keyframes.spec.ts`

**Interfaces:**
- Consumes: `Keyframe`, `Handle` from Task 1.
- Produces: `sampleBezierSegment(a: Keyframe, b: Keyframe, t: number): number` (also routed through `sampleTrack` when `a.interp === 'bezier'`).

**Bezier model:** a cubic Bézier in (time, value) space between keyframe `a` and `b`:
- `P0 = (a.time, a.value)`
- `P1 = (a.time + clampDx(a.handleOut.dx) * span, a.value + a.handleOut.dy * dv)`
- `P2 = (b.time + clampDxIn(b.handleIn.dx) * span, b.value + b.handleIn.dy * dv)`
- `P3 = (b.time, b.value)`
where `span = b.time - a.time`, `dv = b.value - a.value`, `clampDx` keeps `dx` in `[0, 1]` (out) / `[-1, 0]` (in) so X stays monotonic. Given query time `t`, bisection-solve `X(u) = t` for `u ∈ [0,1]`, then return `Y(u)`. Default easy-ease handles (`dy = 0`) give a symmetric S-curve.

- [ ] **Step 1: Write the failing test (append to keyframes.spec.ts)**

```ts
import { sampleBezierSegment } from './keyframes';

describe('keyframes bezier', () => {
	const a = (interp: 'bezier') => kf(0, 0, interp);
	const b = kf(1, 100, 'bezier');

	it('hits the endpoints exactly', () => {
		expect(sampleBezierSegment(a('bezier'), b, 0)).toBeCloseTo(0, 6);
		expect(sampleBezierSegment(a('bezier'), b, 1)).toBeCloseTo(100, 6);
	});

	it('easy-ease is symmetric: midpoint is the mid value', () => {
		expect(sampleBezierSegment(a('bezier'), b, 0.5)).toBeCloseTo(50, 1);
	});

	it('easy-ease eases in (slower than linear early)', () => {
		// At t=0.25 an ease-in curve sits below the linear value (25).
		expect(sampleBezierSegment(a('bezier'), b, 0.25)).toBeLessThan(25);
	});

	it('is monotonic increasing across the segment', () => {
		let prev = -Infinity;
		for (let t = 0; t <= 1; t += 0.05) {
			const v = sampleBezierSegment(a('bezier'), b, t);
			expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
			prev = v;
		}
	});

	it('sampleTrack routes bezier keyframes through the bezier curve', () => {
		const tr = track([kf(0, 0, 'bezier'), kf(1, 100, 'bezier')]);
		expect(sampleTrack(tr, 0.25)).toBeLessThan(25);
		expect(sampleTrack(tr, 0)).toBeCloseTo(0, 6);
		expect(sampleTrack(tr, 1)).toBeCloseTo(100, 6);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/animation/keyframes.spec.ts`
Expected: FAIL (`sampleBezierSegment` is not exported).

- [ ] **Step 3: Write minimal implementation (add to keyframes.ts; replace the bezier branch in `sampleSegment`)**

```ts
function cubic(p0: number, p1: number, p2: number, p3: number, u: number): number {
	const v = 1 - u;
	return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
}

export function sampleBezierSegment(a: Keyframe, b: Keyframe, t: number): number {
	const span = b.time - a.time;
	if (span <= 0) return b.value;
	const dv = b.value - a.value;

	const outDx = Math.max(0, Math.min(1, a.handleOut.dx));
	const inDx = Math.max(-1, Math.min(0, b.handleIn.dx));

	const x0 = a.time;
	const x1 = a.time + outDx * span;
	const x2 = b.time + inDx * span;
	const x3 = b.time;

	const y0 = a.value;
	const y1 = a.value + a.handleOut.dy * dv;
	const y2 = b.value + b.handleIn.dy * dv;
	const y3 = b.value;

	if (t <= a.time) return a.value;
	if (t >= b.time) return b.value;

	// Bisection solve X(u) = t (X is monotonic given the dx clamps above).
	let lo = 0;
	let hi = 1;
	let u = (t - a.time) / span;
	for (let i = 0; i < 40; i++) {
		const x = cubic(x0, x1, x2, x3, u);
		if (Math.abs(x - t) < 1e-7) break;
		if (x < t) lo = u;
		else hi = u;
		u = (lo + hi) / 2;
	}
	return cubic(y0, y1, y2, y3, u);
}
```

Then change `sampleSegment` to route bezier:

```ts
function sampleSegment(a: Keyframe, b: Keyframe, t: number): number {
	if (a.interp === 'hold') return t >= b.time ? b.value : a.value;
	if (a.interp === 'bezier') return sampleBezierSegment(a, b, t);
	const span = b.time - a.time;
	const u = span <= 0 ? 1 : (t - a.time) / span;
	return lerp(a.value, b.value, u);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/animation/keyframes.spec.ts`
Expected: PASS (all bezier + earlier tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/animation/keyframes.ts src/lib/animation/keyframes.spec.ts
git commit -m "feat: cubic-bezier keyframe segment sampling"
```

---

### Task 3: Timeline coordinate mapping (pure)

**Files:**
- Create: `src/lib/animation/timeline-geometry.ts`
- Test: `src/lib/animation/timeline-geometry.spec.ts`

**Interfaces:**
- Consumes: `clamp01` from `keyframes.ts`.
- Produces:
  - `xFromTime(t: number, width: number): number`
  - `timeFromX(x: number, width: number): number` (clamped 0..1)
  - `yFromValue(value: number, min: number, max: number, height: number): number` (value increases upward)
  - `valueFromY(y: number, min: number, max: number, height: number): number` (clamped to [min,max])

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/animation/timeline-geometry.spec.ts
import { describe, it, expect } from 'vitest';
import { xFromTime, timeFromX, yFromValue, valueFromY } from './timeline-geometry';

describe('timeline geometry', () => {
	it('maps time to x and back', () => {
		expect(xFromTime(0.5, 200)).toBe(100);
		expect(timeFromX(100, 200)).toBe(0.5);
	});

	it('clamps time from x to 0..1', () => {
		expect(timeFromX(-10, 200)).toBe(0);
		expect(timeFromX(999, 200)).toBe(1);
	});

	it('guards zero width', () => {
		expect(timeFromX(50, 0)).toBe(0);
	});

	it('maps value to y inverted (max at top = y 0)', () => {
		expect(yFromValue(360, 0, 360, 100)).toBe(0);
		expect(yFromValue(0, 0, 360, 100)).toBe(100);
		expect(yFromValue(180, 0, 360, 100)).toBe(50);
	});

	it('maps y back to value, clamped to range', () => {
		expect(valueFromY(0, 0, 360, 100)).toBeCloseTo(360, 6);
		expect(valueFromY(100, 0, 360, 100)).toBeCloseTo(0, 6);
		expect(valueFromY(-50, 0, 360, 100)).toBe(360);
		expect(valueFromY(150, 0, 360, 100)).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/animation/timeline-geometry.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/animation/timeline-geometry.ts
import { clamp01 } from './keyframes';

export function xFromTime(t: number, width: number): number {
	return clamp01(t) * width;
}

export function timeFromX(x: number, width: number): number {
	if (!Number.isFinite(width) || width <= 0) return 0;
	return clamp01(x / width);
}

export function yFromValue(value: number, min: number, max: number, height: number): number {
	const span = max - min || 1;
	const frac = (value - min) / span;
	return height - clamp01(frac) * height;
}

export function valueFromY(y: number, min: number, max: number, height: number): number {
	if (!Number.isFinite(height) || height <= 0) return min;
	const frac = 1 - clamp01(y / height);
	return min + frac * (max - min);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/animation/timeline-geometry.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/animation/timeline-geometry.ts src/lib/animation/timeline-geometry.spec.ts
git commit -m "feat: pure timeline coordinate mapping helpers"
```

---

### Task 4: Keyframe `$state` store + setters + persistence

**Files:**
- Create: `src/lib/state/keyframes.svelte.ts`
- Test: `src/lib/state/keyframes.svelte.spec.ts`

**Interfaces:**
- Consumes: `Track`, `Keyframe`, `Interp`, `Handle`, `EASY_EASE_OUT`, `EASY_EASE_IN`, `sampleTrack`, `clamp01` from `$lib/animation/keyframes`.
- Produces (the singleton `keyframes` object, all methods):
  - `const KALEIDO_GLOBAL_ROTATION = 'kaleidoscope.globalRotation'`
  - `keyframes.tracks: Record<string, Track>` (getter)
  - `keyframes.ensureTrack(paramId: string): void`
  - `keyframes.setTrackEnabled(paramId: string, on: boolean): void`
  - `keyframes.addKeyframe(paramId: string, init: { time: number; value: number; interp?: Interp }): string` (returns new id)
  - `keyframes.upsertKeyframeAtTime(paramId: string, time: number, value: number): void`
  - `keyframes.moveKeyframe(paramId: string, id: string, next: { time?: number; value?: number }): void`
  - `keyframes.deleteKeyframe(paramId: string, id: string): void`
  - `keyframes.setKeyframeInterp(paramId: string, id: string, interp: Interp): void`
  - `keyframes.setKeyframeHandle(paramId: string, id: string, which: 'in' | 'out', handle: Handle): void`
  - `keyframes.sampleParam(paramId: string, t: number): number | null` (null unless track exists AND enabled)
  - `keyframes.hasEnabledTracks(): boolean`

**Note:** persistence key `kaleidoscope-keyframes`; window-guarded so node imports are safe. `upsertKeyframeAtTime` updates the value of a keyframe within an epsilon of `time`, else adds one.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/state/keyframes.svelte.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from './keyframes.svelte';

describe('keyframes store', () => {
	beforeEach(() => {
		// Reset the track between tests.
		keyframes.ensureTrack(ROT);
		for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
		keyframes.setTrackEnabled(ROT, false);
	});

	it('ensures a track exists, disabled, empty', () => {
		expect(keyframes.tracks[ROT]).toBeDefined();
		expect(keyframes.tracks[ROT].enabled).toBe(false);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(0);
	});

	it('adds a keyframe and returns its id', () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 90 });
		const kf = keyframes.tracks[ROT].keyframes.find((k) => k.id === id);
		expect(kf).toBeDefined();
		expect(kf!.value).toBe(90);
		expect(kf!.interp).toBe('linear');
	});

	it('keeps keyframes sorted by time after add', () => {
		keyframes.addKeyframe(ROT, { time: 0.8, value: 10 });
		keyframes.addKeyframe(ROT, { time: 0.2, value: 20 });
		expect(keyframes.tracks[ROT].keyframes.map((k) => k.time)).toEqual([0.2, 0.8]);
	});

	it('moveKeyframe clamps time to 0..1 and re-sorts', () => {
		const a = keyframes.addKeyframe(ROT, { time: 0.2, value: 0 });
		keyframes.addKeyframe(ROT, { time: 0.6, value: 0 });
		keyframes.moveKeyframe(ROT, a, { time: 9 });
		expect(keyframes.tracks[ROT].keyframes.map((k) => k.time)).toEqual([0.6, 1]);
	});

	it('deleteKeyframe removes it', () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 1 });
		keyframes.deleteKeyframe(ROT, id);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(0);
	});

	it('setKeyframeInterp updates the type', () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 1 });
		keyframes.setKeyframeInterp(ROT, id, 'hold');
		expect(keyframes.tracks[ROT].keyframes[0].interp).toBe('hold');
	});

	it('upsertKeyframeAtTime updates an existing near-time keyframe instead of adding', () => {
		keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		keyframes.upsertKeyframeAtTime(ROT, 0.5, 99);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(1);
		expect(keyframes.tracks[ROT].keyframes[0].value).toBe(99);
	});

	it('sampleParam returns null when the track is disabled', () => {
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 100 });
		expect(keyframes.sampleParam(ROT, 0.5)).toBeNull();
		keyframes.setTrackEnabled(ROT, true);
		expect(keyframes.sampleParam(ROT, 0.5)).toBeCloseTo(50, 6);
	});

	it('hasEnabledTracks reflects enabled state', () => {
		expect(keyframes.hasEnabledTracks()).toBe(false);
		keyframes.setTrackEnabled(ROT, true);
		expect(keyframes.hasEnabledTracks()).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/state/keyframes.svelte.ts
import { untrack } from 'svelte';
import { localStorageSync } from 'rune-sync/localstorage';
import {
	sampleTrack,
	sortKeyframes,
	clamp01,
	EASY_EASE_OUT,
	EASY_EASE_IN,
	type Track,
	type Keyframe,
	type Interp,
	type Handle
} from '$lib/animation/keyframes';

export const KALEIDO_GLOBAL_ROTATION = 'kaleidoscope.globalRotation';

const PERSIST_KEY = 'kaleidoscope-keyframes';
const SAME_TIME_EPS = 1e-4;

type TracksState = { tracks: Record<string, Track> };

const state = $state<TracksState>({ tracks: {} });

function newId(): string {
	const c = (globalThis as { crypto?: Crypto }).crypto;
	if (c && 'randomUUID' in c) return c.randomUUID();
	return `kf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function track(paramId: string): Track {
	if (!state.tracks[paramId]) {
		state.tracks[paramId] = { paramId, enabled: false, keyframes: [] };
	}
	return state.tracks[paramId];
}

function resort(paramId: string) {
	state.tracks[paramId].keyframes = sortKeyframes(state.tracks[paramId].keyframes);
}

export const keyframes = {
	get tracks() {
		return state.tracks;
	},
	ensureTrack(paramId: string) {
		track(paramId);
	},
	setTrackEnabled(paramId: string, on: boolean) {
		track(paramId).enabled = on;
	},
	addKeyframe(paramId: string, init: { time: number; value: number; interp?: Interp }): string {
		const t = track(paramId);
		const kf: Keyframe = {
			id: newId(),
			time: clamp01(init.time),
			value: init.value,
			interp: init.interp ?? 'linear',
			handleOut: { ...EASY_EASE_OUT },
			handleIn: { ...EASY_EASE_IN }
		};
		t.keyframes.push(kf);
		resort(paramId);
		return kf.id;
	},
	upsertKeyframeAtTime(paramId: string, time: number, value: number) {
		const t = track(paramId);
		const existing = t.keyframes.find((k) => Math.abs(k.time - clamp01(time)) <= SAME_TIME_EPS);
		if (existing) {
			existing.value = value;
			return;
		}
		this.addKeyframe(paramId, { time, value });
	},
	moveKeyframe(paramId: string, id: string, next: { time?: number; value?: number }) {
		const kf = track(paramId).keyframes.find((k) => k.id === id);
		if (!kf) return;
		if (next.time !== undefined) kf.time = clamp01(next.time);
		if (next.value !== undefined) kf.value = next.value;
		resort(paramId);
	},
	deleteKeyframe(paramId: string, id: string) {
		const t = track(paramId);
		t.keyframes = t.keyframes.filter((k) => k.id !== id);
	},
	setKeyframeInterp(paramId: string, id: string, interp: Interp) {
		const kf = track(paramId).keyframes.find((k) => k.id === id);
		if (kf) kf.interp = interp;
	},
	setKeyframeHandle(paramId: string, id: string, which: 'in' | 'out', handle: Handle) {
		const kf = track(paramId).keyframes.find((k) => k.id === id);
		if (!kf) return;
		if (which === 'out') kf.handleOut = handle;
		else kf.handleIn = handle;
	},
	sampleParam(paramId: string, t: number): number | null {
		const tr = state.tracks[paramId];
		if (!tr || !tr.enabled) return null;
		return sampleTrack(tr, t);
	},
	hasEnabledTracks(): boolean {
		return Object.values(state.tracks).some((t) => t.enabled && t.keyframes.length > 0);
	}
};

// Persistence: window-guarded so node imports (animation integration test) stay clean.
if (typeof window !== 'undefined') {
	$effect.root(() => {
		let lastSaved: string;
		untrack(() => {
			const saved = localStorageSync.read<TracksState>(PERSIST_KEY);
			if (saved?.tracks) state.tracks = saved.tracks;
			lastSaved = JSON.stringify($state.snapshot(state));
		});
		$effect(() => {
			const serialized = JSON.stringify($state.snapshot(state));
			if (serialized === lastSaved) return;
			untrack(() => {
				localStorageSync.write(PERSIST_KEY, $state.snapshot(state));
				lastSaved = serialized;
			});
		});
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/state/keyframes.svelte.spec.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/keyframes.svelte.ts src/lib/state/keyframes.svelte.spec.ts
git commit -m "feat: keyframe state store with setters + localStorage persistence"
```

---

### Task 5: Wire keyframe sampling into the existing animation clock

**Files:**
- Modify: `src/lib/state/animation.svelte.ts`
- Test: `src/lib/state/animation.svelte.spec.ts`

**Interfaces:**
- Consumes: `keyframes`, `KALEIDO_GLOBAL_ROTATION` from `./keyframes.svelte`; `setGlobalRotation` from `./kaleidoscope.svelte`.
- Produces: `applyKaleidoscopeKeyframes(progress: number): void` (exported for test); widened start gate so the clock runs when `keyframes.hasEnabledTracks()` is true.

- [ ] **Step 1: Write the failing test (append to animation.svelte.spec.ts)**

```ts
import { applyKaleidoscopeKeyframes } from './animation.svelte';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from './keyframes.svelte';
import { kaleidoscope, setGlobalRotation } from './kaleidoscope.svelte';

describe('kaleidoscope keyframe application', () => {
	beforeEach(() => {
		keyframes.ensureTrack(ROT);
		for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
		keyframes.setTrackEnabled(ROT, false);
		setGlobalRotation(0);
	});

	it('does nothing when the track is disabled (slider value stands)', () => {
		setGlobalRotation(33);
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		applyKaleidoscopeKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBe(33);
	});

	it('applies the sampled rotation when the track is enabled', () => {
		keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		keyframes.setTrackEnabled(ROT, true);
		applyKaleidoscopeKeyframes(0.5);
		expect(kaleidoscope.globalRotation).toBeCloseTo(180, 4);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: FAIL (`applyKaleidoscopeKeyframes` not exported).

- [ ] **Step 3: Write minimal implementation**

Add imports near the top of `animation.svelte.ts`:

```ts
import { keyframes, KALEIDO_GLOBAL_ROTATION } from './keyframes.svelte';
import { setGlobalRotation } from './kaleidoscope.svelte';
```

Add the apply function and gate helper (place beside `hasMorphTargets`):

```ts
export function applyKaleidoscopeKeyframes(progress: number): void {
	const rotation = keyframes.sampleParam(KALEIDO_GLOBAL_ROTATION, progress);
	if (rotation !== null) setGlobalRotation(rotation);
}

function hasEnabledKeyframeTracks(): boolean {
	return keyframes.hasEnabledTracks();
}
```

Widen the two start gates. In `startNewAnimation`:

```ts
	if (!hasRunnableMode() && !hasMorphTargets() && !hasEnabledKeyframeTracks()) {
		stopInternal(true);
		return;
	}
```

In `togglePlay` (the resume branch):

```ts
	if (!hasRunnableMode() && !hasMorphTargets() && !hasEnabledKeyframeTracks()) {
		stopInternal(true);
		return;
	}
```

In `tick`, after `const progress = getProgressFromElapsed(logicalElapsedMs);` and inside the existing `if (hasRunnableMode()) { ... } else { ... }` — add the apply call right after that block (so it runs every frame regardless of mode):

```ts
	applyKaleidoscopeKeyframes(progress);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/state/animation.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: all pass, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat: apply kaleidoscope keyframes on the existing animation clock"
```

---

### Task 6: Stopwatch toggle + keyframe authoring on the rotation slider

**Files:**
- Modify: `src/lib/components/KaleidoscopeSection.svelte`
- Test: `src/lib/components/KaleidoscopeSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `keyframes`, `KALEIDO_GLOBAL_ROTATION` from `$lib/state/keyframes.svelte`; `animationState` from `$lib/state/animation`; existing `setGlobalRotation`, `kaleidoscope`.
- Produces: a checkbox labeled `Anima rotazione globale` that calls `keyframes.setTrackEnabled(KALEIDO_GLOBAL_ROTATION, ...)`; the rotation slider, when the track is enabled, calls `keyframes.upsertKeyframeAtTime(KALEIDO_GLOBAL_ROTATION, animationState.progress, value)` instead of `setGlobalRotation`.

- [ ] **Step 1: Write the failing test (append cases to KaleidoscopeSection.svelte.spec.ts)**

```ts
import { animationState } from '$lib/state/animation';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from '$lib/state/keyframes.svelte';

describe('KaleidoscopeSection rotation keyframing', () => {
	beforeEach(() => {
		keyframes.ensureTrack(ROT);
		for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
		keyframes.setTrackEnabled(ROT, false);
		animationState.progress = 0;
	});

	it('enables the rotation track via the stopwatch checkbox', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Anima rotazione globale'));
		expect(keyframes.tracks[ROT].enabled).toBe(true);
	});

	it('writes a keyframe at the playhead when the track is enabled', async () => {
		keyframes.setTrackEnabled(ROT, true);
		animationState.progress = 0.5;
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Rotazione globale'), '120');
		const kf = keyframes.tracks[ROT].keyframes.find((k) => Math.abs(k.time - 0.5) < 1e-3);
		expect(kf?.value).toBe(120);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts`
Expected: FAIL (`Anima rotazione globale` not found / keyframe not written).

- [ ] **Step 3: Write minimal implementation**

Add to the `<script>` imports:

```ts
	import { animationState } from '$lib/state/animation';
	import { keyframes, KALEIDO_GLOBAL_ROTATION } from '$lib/state/keyframes.svelte';
```

Ensure the track exists at module use (add after the helper consts):

```ts
	keyframes.ensureTrack(KALEIDO_GLOBAL_ROTATION);
	const rotationAnimated = $derived(keyframes.tracks[KALEIDO_GLOBAL_ROTATION]?.enabled ?? false);

	function onRotationInput(value: number) {
		if (rotationAnimated) {
			keyframes.upsertKeyframeAtTime(KALEIDO_GLOBAL_ROTATION, animationState.progress, value);
		} else {
			setGlobalRotation(value);
		}
	}
```

Replace the global-rotation control block (the existing `k-globalrot` slider) so its `oninput` calls `onRotationInput(num(e))`, and add the stopwatch checkbox directly above it:

```svelte
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label="Anima rotazione globale"
					checked={rotationAnimated}
					onchange={(e) => keyframes.setTrackEnabled(KALEIDO_GLOBAL_ROTATION, checked(e))}
				/>
				Anima rotazione globale
			</label>

			<div class="flex flex-col gap-1">
				<Label for="k-globalrot" class="text-xs">Rotazione globale</Label>
				<input
					id="k-globalrot"
					aria-label="Rotazione globale"
					type="range"
					min="0"
					max="360"
					step="1"
					value={kaleidoscope.globalRotation}
					oninput={(e) => onRotationInput(num(e))}
				/>
			</div>
```

- [ ] **Step 4: Run svelte-autofixer**

Run the `svelte-autofixer` MCP on `KaleidoscopeSection.svelte`. Fix everything until `issues: []`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts`
Expected: PASS. Then full suite: `bun run test:unit -- run`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/KaleidoscopeSection.svelte src/lib/components/KaleidoscopeSection.svelte.spec.ts
git commit -m "feat: rotation stopwatch + playhead keyframe authoring in KaleidoscopeSection"
```

---

### Task 7: TimelinePanel container + page wiring + collapse

**Files:**
- Create: `src/lib/components/TimelinePanel.svelte`
- Modify: `src/routes/+page.svelte`
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: `keyframes`, `KALEIDO_GLOBAL_ROTATION` (to render the demo track row); `animationState`, `togglePlay` from `$lib/state/animation`. Child components (`TimelineRuler`, `TimelineTrack`, `KeyframeGraphEditor`) are added in later tasks; for this task the panel renders a placeholder track area.
- Produces: a collapsible bottom panel with `data-testid="timeline-panel"`, a toggle button labeled `Timeline`, and a body that mounts/unmounts on toggle. Exposes a `graphMode` local toggle (button `Graph Editor`) used by Task 10.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/TimelinePanel.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelinePanel from './TimelinePanel.svelte';

describe('TimelinePanel', () => {
	it('starts collapsed and expands on toggle', async () => {
		render(TimelinePanel);
		expect(page.getByTestId('timeline-body').query()).toBeNull();
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await expect.element(page.getByTestId('timeline-body')).toBeInTheDocument();
	});

	it('toggles the graph editor mode', async () => {
		render(TimelinePanel);
		await userEvent.click(page.getByRole('button', { name: 'Timeline' }));
		await userEvent.click(page.getByRole('button', { name: 'Graph Editor' }));
		await expect.element(page.getByTestId('timeline-graph')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- src/lib/components/TimelinePanel.svelte -->
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes, KALEIDO_GLOBAL_ROTATION } from '$lib/state/keyframes.svelte';

	keyframes.ensureTrack(KALEIDO_GLOBAL_ROTATION);

	let open = $state(false);
	let graphMode = $state(false);
</script>

<section data-testid="timeline-panel" class="w-full border-t bg-background">
	<div class="flex items-center gap-2 p-2">
		<Button variant="ghost" size="sm" onclick={() => (open = !open)}>Timeline</Button>
		{#if open}
			<Button
				variant={graphMode ? 'default' : 'ghost'}
				size="sm"
				onclick={() => (graphMode = !graphMode)}
			>
				Graph Editor
			</Button>
		{/if}
	</div>

	{#if open}
		<div data-testid="timeline-body" class="flex flex-col gap-1 p-2">
			{#if graphMode}
				<div data-testid="timeline-graph" class="h-40 w-full">
					<!-- KeyframeGraphEditor mounts here in Task 10 -->
				</div>
			{:else}
				<div data-testid="timeline-tracks" class="flex flex-col gap-1">
					<!-- TimelineRuler + TimelineTrack mount here in Tasks 8-9 -->
				</div>
			{/if}
		</div>
	{/if}
</section>
```

Wire into the page — modify `src/routes/+page.svelte`. Import and place `<TimelinePanel />` at the bottom of `SidebarInset`, after `<main>`:

```svelte
<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import PreviewCanvas from '$lib/components/PreviewCanvas.svelte';
	import TimelinePanel from '$lib/components/TimelinePanel.svelte';
</script>

<SidebarUI.SidebarProvider>
	<Sidebar />

	<SidebarUI.SidebarInset>
		<header class="flex items-center gap-2 border-b p-4">
			<SidebarUI.SidebarTrigger />
			<span class="text-sm font-semibold">Shape Editor</span>
			<a
				href="/paths"
				class="ml-auto text-sm text-muted-foreground hover:text-foreground"
				data-testid="header-paths-link"
			>
				Paths
			</a>
			<a
				href="/about"
				class="ml-4 text-sm text-muted-foreground hover:text-foreground"
				data-testid="header-about-link"
			>
				About
			</a>
		</header>
		<main class="flex flex-1 items-center justify-center p-8">
			<PreviewCanvas />
		</main>
		<TimelinePanel />
	</SidebarUI.SidebarInset>
</SidebarUI.SidebarProvider>
```

- [ ] **Step 4: Run svelte-autofixer**

Run `svelte-autofixer` on `TimelinePanel.svelte` and `+page.svelte` until `issues: []`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS. Then full suite: `bun run test:unit -- run`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/TimelinePanel.svelte src/lib/components/TimelinePanel.svelte.spec.ts src/routes/+page.svelte
git commit -m "feat: collapsible bottom timeline panel + page wiring"
```

---

### Task 8: TimelineRuler + draggable playhead

**Files:**
- Create: `src/lib/components/TimelineRuler.svelte`
- Modify: `src/lib/components/TimelinePanel.svelte` (mount the ruler in the tracks body)
- Test: `src/lib/components/TimelineRuler.svelte.spec.ts`

**Interfaces:**
- Consumes: `timeFromX`, `xFromTime` from `$lib/animation/timeline-geometry`; `animationState` from `$lib/state/animation`.
- Produces: a ruler with `data-testid="timeline-ruler"` and a playhead element `data-testid="playhead"` positioned by `animationState.progress`. Clicking the ruler sets `animationState.progress` (scrub) via `timeFromX`. Pointer-drag uses the same helper.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/TimelineRuler.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineRuler from './TimelineRuler.svelte';
import { animationState } from '$lib/state/animation';

describe('TimelineRuler', () => {
	beforeEach(() => {
		animationState.progress = 0;
	});

	it('renders a playhead positioned from progress', async () => {
		animationState.progress = 0.5;
		render(TimelineRuler);
		await expect.element(page.getByTestId('playhead')).toBeInTheDocument();
	});

	it('scrubs progress on ruler click', async () => {
		render(TimelineRuler);
		const ruler = page.getByTestId('timeline-ruler').element() as HTMLElement;
		const rect = ruler.getBoundingClientRect();
		ruler.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: rect.left + rect.width / 2
			})
		);
		expect(animationState.progress).toBeCloseTo(0.5, 1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelineRuler.svelte.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- src/lib/components/TimelineRuler.svelte -->
<script lang="ts">
	import { animationState } from '$lib/state/animation';
	import { timeFromX, xFromTime } from '$lib/animation/timeline-geometry';

	let rulerEl: HTMLDivElement;

	function scrubFromEvent(clientX: number) {
		const rect = rulerEl.getBoundingClientRect();
		animationState.progress = timeFromX(clientX - rect.left, rect.width);
	}

	function onPointerDown(e: PointerEvent) {
		rulerEl.setPointerCapture(e.pointerId);
		scrubFromEvent(e.clientX);
	}

	function onPointerMove(e: PointerEvent) {
		if (!rulerEl.hasPointerCapture(e.pointerId)) return;
		scrubFromEvent(e.clientX);
	}

	function onPointerUp(e: PointerEvent) {
		if (rulerEl.hasPointerCapture(e.pointerId)) rulerEl.releasePointerCapture(e.pointerId);
	}
</script>

<div
	bind:this={rulerEl}
	data-testid="timeline-ruler"
	class="relative h-6 w-full cursor-col-resize select-none rounded bg-muted"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	<div
		data-testid="playhead"
		class="absolute top-0 h-full w-0.5 bg-primary"
		style="left: {xFromTime(animationState.progress, rulerEl?.clientWidth ?? 0)}px"
	></div>
</div>
```

Mount the ruler in `TimelinePanel.svelte` — replace the `timeline-tracks` placeholder body:

```svelte
				<div data-testid="timeline-tracks" class="flex flex-col gap-1">
					<TimelineRuler />
				</div>
```

and add the import in `TimelinePanel.svelte`:

```ts
	import TimelineRuler from './TimelineRuler.svelte';
```

- [ ] **Step 4: Run svelte-autofixer**

Run `svelte-autofixer` on `TimelineRuler.svelte` and `TimelinePanel.svelte` until `issues: []` (ignore only the known "function inside handler" false positive on pointer side-effect fns).

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelineRuler.svelte.spec.ts`
Expected: PASS. Then full suite: `bun run test:unit -- run`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/TimelineRuler.svelte src/lib/components/TimelinePanel.svelte src/lib/components/TimelineRuler.svelte.spec.ts
git commit -m "feat: timeline ruler with draggable playhead scrub"
```

---

### Task 9: TimelineTrack — diamonds, add/select/delete, interpolation, retime drag

**Files:**
- Create: `src/lib/components/TimelineTrack.svelte`
- Modify: `src/lib/components/TimelinePanel.svelte` (mount one track row for `KALEIDO_GLOBAL_ROTATION`)
- Test: `src/lib/components/TimelineTrack.svelte.spec.ts`

**Interfaces:**
- Consumes: `keyframes` store + setters; `timeFromX`, `xFromTime` from `$lib/animation/timeline-geometry`. Props: `paramId: string`, `label: string`.
- Produces: a row with `data-testid="track-{paramId}"`; keyframe diamonds (`data-testid="kf-{id}"`); double-click on empty row adds a keyframe at that time (value 0); clicking a diamond selects it; a delete button (`Elimina keyframe`) removes the selected; an interpolation `<select>` (`aria-label="Interpolazione keyframe"`) sets the selected keyframe's interp; horizontal pointer-drag of a diamond retimes via `moveKeyframe` (time only).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/TimelineTrack.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TimelineTrack from './TimelineTrack.svelte';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from '$lib/state/keyframes.svelte';

function reset() {
	keyframes.ensureTrack(ROT);
	for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
}

describe('TimelineTrack', () => {
	beforeEach(reset);

	it('renders a diamond per keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		await expect.element(page.getByTestId(`kf-${id}`)).toBeInTheDocument();
	});

	it('adds a keyframe on double-click of the empty row', async () => {
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		const row = page.getByTestId(`track-${ROT}`).element() as HTMLElement;
		const rect = row.getBoundingClientRect();
		row.dispatchEvent(
			new MouseEvent('dblclick', { bubbles: true, clientX: rect.left + rect.width / 2 })
		);
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(1);
		expect(keyframes.tracks[ROT].keyframes[0].time).toBeCloseTo(0.5, 1);
	});

	it('selects a diamond then deletes it', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		await userEvent.click(page.getByTestId(`kf-${id}`));
		await userEvent.click(page.getByRole('button', { name: 'Elimina keyframe' }));
		expect(keyframes.tracks[ROT].keyframes).toHaveLength(0);
	});

	it('sets interpolation of the selected keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.5, value: 10 });
		render(TimelineTrack, { paramId: ROT, label: 'Rotazione' });
		await userEvent.click(page.getByTestId(`kf-${id}`));
		await userEvent.selectOptions(page.getByLabelText('Interpolazione keyframe'), 'hold');
		expect(keyframes.tracks[ROT].keyframes[0].interp).toBe('hold');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- src/lib/components/TimelineTrack.svelte -->
<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { timeFromX, xFromTime } from '$lib/animation/timeline-geometry';
	import type { Interp } from '$lib/animation/keyframes';

	let { paramId, label }: { paramId: string; label: string } = $props();

	let rowEl: HTMLDivElement;
	let selectedId = $state<string | null>(null);
	let draggingId: string | null = null;

	const kfs = $derived(keyframes.tracks[paramId]?.keyframes ?? []);
	const selected = $derived(kfs.find((k) => k.id === selectedId) ?? null);

	function rowWidth(): number {
		return rowEl?.clientWidth ?? 0;
	}

	function onDblClick(e: MouseEvent) {
		const rect = rowEl.getBoundingClientRect();
		const time = timeFromX(e.clientX - rect.left, rect.width);
		selectedId = keyframes.addKeyframe(paramId, { time, value: 0 });
	}

	function onDiamondDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		selectedId = id;
		draggingId = id;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onDiamondMove(e: PointerEvent) {
		if (!draggingId) return;
		const rect = rowEl.getBoundingClientRect();
		keyframes.moveKeyframe(paramId, draggingId, {
			time: timeFromX(e.clientX - rect.left, rect.width)
		});
	}

	function onDiamondUp(e: PointerEvent) {
		draggingId = null;
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}

	function deleteSelected() {
		if (selectedId) {
			keyframes.deleteKeyframe(paramId, selectedId);
			selectedId = null;
		}
	}

	function setInterp(value: string) {
		if (selectedId) keyframes.setKeyframeInterp(paramId, selectedId, value as Interp);
	}
</script>

<div class="flex items-center gap-2">
	<span class="w-28 shrink-0 truncate text-xs">{label}</span>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={rowEl}
		data-testid="track-{paramId}"
		class="relative h-7 flex-1 rounded bg-muted/60"
		ondblclick={onDblClick}
	>
		{#each kfs as kf (kf.id)}
			<button
				type="button"
				data-testid="kf-{kf.id}"
				aria-label="Keyframe"
				class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border {kf.id ===
				selectedId
					? 'bg-primary'
					: 'bg-foreground'}"
				style="left: {xFromTime(kf.time, rowWidth())}px"
				onpointerdown={(e) => onDiamondDown(e, kf.id)}
				onpointermove={onDiamondMove}
				onpointerup={onDiamondUp}
			></button>
		{/each}
	</div>

	<select
		aria-label="Interpolazione keyframe"
		class="h-7 rounded border bg-background text-xs"
		disabled={!selected}
		value={selected?.interp ?? 'linear'}
		onchange={(e) => setInterp((e.target as HTMLSelectElement).value)}
	>
		<option value="linear">Lineare</option>
		<option value="bezier">Bezier</option>
		<option value="hold">Hold</option>
	</select>

	<Button variant="ghost" size="sm" disabled={!selected} onclick={deleteSelected}>
		Elimina keyframe
	</Button>
</div>
```

Mount in `TimelinePanel.svelte` — add inside the `timeline-tracks` body, below `<TimelineRuler />`:

```svelte
					<TimelineTrack paramId={KALEIDO_GLOBAL_ROTATION} label="Rotazione globale" />
```

and import in `TimelinePanel.svelte`:

```ts
	import TimelineTrack from './TimelineTrack.svelte';
```

- [ ] **Step 4: Run svelte-autofixer**

Run `svelte-autofixer` on `TimelineTrack.svelte` and `TimelinePanel.svelte` until `issues: []` (ignore only the pointer-handler false positive).

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/TimelineTrack.svelte.spec.ts`
Expected: PASS. Then full suite: `bun run test:unit -- run`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/TimelineTrack.svelte src/lib/components/TimelinePanel.svelte src/lib/components/TimelineTrack.svelte.spec.ts
git commit -m "feat: timeline track row (diamonds, add/select/delete, interp, retime)"
```

---

### Task 10: KeyframeGraphEditor — value/time curve with draggable points + bezier handles

**Files:**
- Create: `src/lib/components/KeyframeGraphEditor.svelte`
- Modify: `src/lib/components/TimelinePanel.svelte` (mount in the graph body)
- Test: `src/lib/components/KeyframeGraphEditor.svelte.spec.ts`

**Interfaces:**
- Consumes: `keyframes` store; `sampleTrack` from `$lib/animation/keyframes`; `xFromTime`, `timeFromX`, `yFromValue`, `valueFromY` from `$lib/animation/timeline-geometry`. Props: `paramId: string`, `min: number`, `max: number`. The demo row uses `min=0 max=360`.
- Produces: an SVG (`data-testid="graph-{paramId}"`) plotting the sampled curve as a `<polyline>` (`data-testid="graph-curve"`) and a draggable point per keyframe (`data-testid="graph-pt-{id}"`); dragging a point writes `moveKeyframe` (time + value); a bezier keyframe also renders an out-handle (`data-testid="graph-handle-{id}"`) that writes `setKeyframeHandle`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/KeyframeGraphEditor.svelte.spec.ts
import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';
import { keyframes, KALEIDO_GLOBAL_ROTATION as ROT } from '$lib/state/keyframes.svelte';

function reset() {
	keyframes.ensureTrack(ROT);
	for (const k of [...keyframes.tracks[ROT].keyframes]) keyframes.deleteKeyframe(ROT, k.id);
}

describe('KeyframeGraphEditor', () => {
	beforeEach(reset);

	it('draws the curve and a point per keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0, value: 0 });
		keyframes.addKeyframe(ROT, { time: 1, value: 360 });
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		await expect.element(page.getByTestId('graph-curve')).toBeInTheDocument();
		await expect.element(page.getByTestId(`graph-pt-${id}`)).toBeInTheDocument();
	});

	it('renders a handle for a bezier keyframe', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0, value: 0, interp: 'bezier' });
		keyframes.addKeyframe(ROT, { time: 1, value: 360, interp: 'bezier' });
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		await expect.element(page.getByTestId(`graph-handle-${id}`)).toBeInTheDocument();
	});

	it('drags a point to a new time and value', async () => {
		const id = keyframes.addKeyframe(ROT, { time: 0.2, value: 0 });
		keyframes.addKeyframe(ROT, { time: 0.9, value: 360 });
		render(KeyframeGraphEditor, { paramId: ROT, min: 0, max: 360 });
		const svg = page.getByTestId(`graph-${ROT}`).element() as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const pt = page.getByTestId(`graph-pt-${id}`).element() as SVGElement;
		pt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
		svg.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				pointerId: 1,
				clientX: rect.left + rect.width / 2,
				clientY: rect.top
			})
		);
		svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
		const moved = keyframes.tracks[ROT].keyframes.find((k) => k.id === id)!;
		expect(moved.time).toBeCloseTo(0.5, 1);
		expect(moved.value).toBeCloseTo(360, 0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/KeyframeGraphEditor.svelte.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- src/lib/components/KeyframeGraphEditor.svelte -->
<script lang="ts">
	import { keyframes } from '$lib/state/keyframes.svelte';
	import { sampleTrack, type Track } from '$lib/animation/keyframes';
	import { xFromTime, timeFromX, yFromValue, valueFromY } from '$lib/animation/timeline-geometry';

	let { paramId, min, max }: { paramId: string; min: number; max: number } = $props();

	const W = 600;
	const H = 160;

	let svgEl: SVGSVGElement;
	let dragKind: 'point' | 'handle' | null = null;
	let dragId: string | null = null;

	const track = $derived<Track>(
		keyframes.tracks[paramId] ?? { paramId, enabled: false, keyframes: [] }
	);
	const kfs = $derived(track.keyframes);

	const curve = $derived.by(() => {
		if (kfs.length === 0) return '';
		const pts: string[] = [];
		for (let i = 0; i <= 60; i++) {
			const t = i / 60;
			const v = sampleTrack(track, t);
			if (v === null) continue;
			pts.push(`${xFromTime(t, W)},${yFromValue(v, min, max, H)}`);
		}
		return pts.join(' ');
	});

	function localXY(e: PointerEvent): { x: number; y: number } {
		const rect = svgEl.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	function onPointDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		dragKind = 'point';
		dragId = id;
		svgEl.setPointerCapture(e.pointerId);
	}

	function onHandleDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		dragKind = 'handle';
		dragId = id;
		svgEl.setPointerCapture(e.pointerId);
	}

	function onMove(e: PointerEvent) {
		if (!dragKind || !dragId) return;
		const { x, y } = localXY(e);
		if (dragKind === 'point') {
			keyframes.moveKeyframe(paramId, dragId, {
				time: timeFromX(x, W),
				value: valueFromY(y, min, max, H)
			});
		} else {
			const kf = kfs.find((k) => k.id === dragId);
			if (!kf) return;
			const dx = Math.max(0, Math.min(1, timeFromX(x, W) - kf.time));
			const span = max - min || 1;
			const dy = (valueFromY(y, min, max, H) - kf.value) / span;
			keyframes.setKeyframeHandle(paramId, dragId, 'out', { dx, dy });
		}
	}

	function onUp(e: PointerEvent) {
		dragKind = null;
		dragId = null;
		if (svgEl.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
	}
</script>

<svg
	bind:this={svgEl}
	data-testid="graph-{paramId}"
	viewBox="0 0 {W} {H}"
	class="h-40 w-full rounded bg-muted/40"
	onpointermove={onMove}
	onpointerup={onUp}
>
	<polyline data-testid="graph-curve" points={curve} fill="none" stroke="currentColor" stroke-width="1.5" />

	{#each kfs as kf (kf.id)}
		{@const px = xFromTime(kf.time, W)}
		{@const py = yFromValue(kf.value, min, max, H)}
		{#if kf.interp === 'bezier'}
			{@const hx = xFromTime(kf.time + kf.handleOut.dx * 0.15, W)}
			{@const hy = yFromValue(kf.value + kf.handleOut.dy * (max - min), min, max, H)}
			<line x1={px} y1={py} x2={hx} y2={hy} stroke="currentColor" stroke-width="1" opacity="0.5" />
			<circle
				data-testid="graph-handle-{kf.id}"
				cx={hx}
				cy={hy}
				r="4"
				class="cursor-pointer fill-primary"
				onpointerdown={(e) => onHandleDown(e, kf.id)}
			/>
		{/if}
		<rect
			data-testid="graph-pt-{kf.id}"
			x={px - 4}
			y={py - 4}
			width="8"
			height="8"
			class="cursor-pointer fill-foreground"
			onpointerdown={(e) => onPointDown(e, kf.id)}
		/>
	{/each}
</svg>
```

Mount in `TimelinePanel.svelte` — replace the `timeline-graph` placeholder body:

```svelte
				<div data-testid="timeline-graph" class="w-full">
					<KeyframeGraphEditor paramId={KALEIDO_GLOBAL_ROTATION} min={0} max={360} />
				</div>
```

and import in `TimelinePanel.svelte`:

```ts
	import KeyframeGraphEditor from './KeyframeGraphEditor.svelte';
```

- [ ] **Step 4: Run svelte-autofixer**

Run `svelte-autofixer` on `KeyframeGraphEditor.svelte` and `TimelinePanel.svelte` until `issues: []` (ignore only the pointer-handler false positive; add `a11y` ignore comments where the autofixer flags interactive SVG elements without roles, matching the codebase style).

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/KeyframeGraphEditor.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the FULL suite + type check**

Run: `bun run test:unit -- run` then `bun run check`
Expected: all pass, 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/KeyframeGraphEditor.svelte src/lib/components/TimelinePanel.svelte src/lib/components/KeyframeGraphEditor.svelte.spec.ts
git commit -m "feat: keyframe graph editor (value/time curve, draggable points + bezier handles)"
```

---

### Task 11: Manual live verification

**Files:** none (manual).

- [ ] **Step 1: Start the dev server**

Run: `bun run dev` → open http://localhost:5173/ (hard reload Cmd+Shift+R).

- [ ] **Step 2: Verify the flow**

- Turn on `Modalità caleidoscopio` in the sidebar.
- Check `Anima rotazione globale`.
- Open the bottom `Timeline` panel.
- Add 2–3 keyframes on the rotation track (double-click the row, or move the playhead + drag the rotation slider).
- Set one keyframe to `Lineare`, one to `Bezier`, one to `Hold`.
- Press play (existing transport): confirm the kaleidoscope rotates along the curve; bezier eases, hold steps.
- Open `Graph Editor`: drag a point (time+value) and a bezier handle; confirm the curve updates and playback follows.
- Scrub the playhead on the ruler while paused; confirm the rotation tracks the playhead.
- Toggle `Anima rotazione globale` off: the rotation slider drives the value statically again (Block 1 behaviour).
- Reload the page: confirm the keyframes persist.

- [ ] **Step 3: Final full verification**

Run: `bun run test:unit -- run` and `bun run check`
Expected: all green.

---

## Self-Review

**Spec coverage:**
- Reusable keyframe system → Tasks 1–4. ✓
- Reuse existing clock + widened start gate + per-tick apply → Task 5. ✓
- Stopwatch value-source model → Task 6. ✓
- AE-style track timeline (diamonds, retime, add/delete, interp) → Tasks 7–9. ✓
- Graph editor (curves + bezier handles) → Task 10. ✓
- Bottom collapsible full-width panel + page placement → Task 7. ✓
- Interpolation linear/bezier/hold → Tasks 1, 2, 9. ✓
- Persistence (localStorage) → Task 4. ✓
- Demo wiring to `globalRotation` only → Tasks 5, 6, 9, 10. ✓
- Edge cases (empty/disabled/single/clamp/equal-time/handle clamp/SSR guard) → Tasks 1–4. ✓
- Testing strategy (node pure, browser components, animation integration in node) → all tasks + Task 11. ✓
- Out of scope (other params, WebM) → not implemented, correct. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type consistency:** `Track`/`Keyframe`/`Handle`/`Interp` defined in Task 1, reused verbatim in 2–4, 9, 10. Store method names (`ensureTrack`, `setTrackEnabled`, `addKeyframe`, `upsertKeyframeAtTime`, `moveKeyframe`, `deleteKeyframe`, `setKeyframeInterp`, `setKeyframeHandle`, `sampleParam`, `hasEnabledTracks`) consistent across Tasks 4–10. `KALEIDO_GLOBAL_ROTATION` constant defined in Task 4, imported everywhere after. Geometry helpers (`xFromTime`/`timeFromX`/`yFromValue`/`valueFromY`) defined Task 3, used in 8–10. ✓
