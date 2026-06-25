# Kaleidoscope Mode — Block 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static kaleidoscope render mode that uses the current composition as a repeated, mirrored tile, configured by sliders, with PNG and (vector) SVG export — without touching the existing flower/audio engine.

**Architecture:** A pure geometry module (`kaleidoscope.ts`) draws sectors + mirrored carpet onto a Canvas 2D and emits a twin SVG string. A `$state` module holds the controls. When the mode is on, `PreviewCanvas` renders the composition to an offscreen square canvas (the tile) and feeds it to the renderer; when off, the preview behaves exactly as today.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, paper.js (composition tile only), Canvas 2D + SVG string (kaleidoscope), vitest (browser/chromium), bun.

## Global Constraints

- Package manager is **bun**. Unit tests: `bun run test:unit -- run <path>`. Type check: `bun run check`. Run the **full** unit suite before each commit (a UI mock regression only surfaces in the full chromium run).
- **Tab** indentation in all `.ts`/`.svelte` files.
- Every `.svelte` file created/edited MUST pass the `svelte-autofixer` MCP tool before it is considered done. (The "function inside $effect" suggestion on PreviewCanvas's paper render is a known false positive — ignore only that one.)
- **Do NOT modify** `bend.ts`, `render-pipeline.ts`, the audio drivers, morph, or the existing animation system. Kaleidoscope sits on top and consumes their output.
- Kaleidoscope parameters are **resolution-independent**: `offsetDistance` is a fraction of canvas size (0..1), `tileSize` and `scale` are unitless multipliers. This lets export at any size match the preview.
- `sectors`: integer, even, clamped 4..24. `repeat`: integer, clamped 1..10.
- Mirrored sectors are the **even-indexed** ones (parity matches the reference tool).

---

### Task 1: Kaleidoscope geometry helpers (pure)

**Files:**
- Create: `src/lib/geometry/kaleidoscope.ts`
- Test: `src/lib/geometry/kaleidoscope.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type KaleidoscopeParams = { sectors: number; repeat: number; offsetDistance: number; scale: number; tileSize: number; tileRotation: number; carpetRotation: number; globalRotation: number; circularMask: boolean; backgroundColor: string; drawBackground: boolean }`
  - `clampSectors(n: number): number`
  - `clampRepeat(n: number): number`
  - `wedgeAngle(sectors: number): number` (radians, full angle per sector = 2π/sectors)
  - `isSectorMirrored(index: number): boolean`
  - `degToRad(deg: number): number`
  - `type TileOffset = { x: number; y: number }`
  - `carpetTileOffsets(repeat: number, tileW: number, tileH: number): TileOffset[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/geometry/kaleidoscope.spec.ts
import { describe, it, expect } from 'vitest';
import {
	clampSectors,
	clampRepeat,
	wedgeAngle,
	isSectorMirrored,
	degToRad,
	carpetTileOffsets
} from './kaleidoscope';

describe('kaleidoscope geometry helpers', () => {
	it('clampSectors forces even and clamps to 4..24', () => {
		expect(clampSectors(1)).toBe(4);
		expect(clampSectors(7)).toBe(6);
		expect(clampSectors(8)).toBe(8);
		expect(clampSectors(99)).toBe(24);
	});

	it('clampRepeat clamps to integer 1..10', () => {
		expect(clampRepeat(0)).toBe(1);
		expect(clampRepeat(3.7)).toBe(3);
		expect(clampRepeat(50)).toBe(10);
	});

	it('wedgeAngle is 2π / sectors', () => {
		expect(wedgeAngle(6)).toBeCloseTo((2 * Math.PI) / 6, 10);
	});

	it('isSectorMirrored mirrors even indices', () => {
		expect(isSectorMirrored(0)).toBe(true);
		expect(isSectorMirrored(1)).toBe(false);
		expect(isSectorMirrored(2)).toBe(true);
	});

	it('degToRad converts degrees to radians', () => {
		expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
	});

	it('carpetTileOffsets returns repeat² centered offsets', () => {
		const offsets = carpetTileOffsets(2, 10, 20);
		expect(offsets).toHaveLength(4);
		const sumX = offsets.reduce((a, o) => a + o.x, 0);
		const sumY = offsets.reduce((a, o) => a + o.y, 0);
		expect(sumX).toBeCloseTo(0, 10);
		expect(sumY).toBeCloseTo(0, 10);
		expect(offsets).toContainEqual({ x: -5, y: -10 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope.spec.ts`
Expected: FAIL (module `./kaleidoscope` has no such exports).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/geometry/kaleidoscope.ts
export type KaleidoscopeParams = {
	sectors: number;
	repeat: number;
	offsetDistance: number; // fraction of canvas size (0..1)
	scale: number; // unitless multiplier
	tileSize: number; // unitless multiplier (tile size relative to canvas)
	tileRotation: number; // degrees
	carpetRotation: number; // degrees
	globalRotation: number; // degrees
	circularMask: boolean;
	backgroundColor: string;
	drawBackground: boolean;
};

export type TileOffset = { x: number; y: number };

export function clampSectors(n: number): number {
	const v = Number.isFinite(n) ? Math.round(n) : 4;
	const even = v % 2 === 0 ? v : v - 1;
	return Math.max(4, Math.min(24, even));
}

export function clampRepeat(n: number): number {
	const v = Number.isFinite(n) ? Math.floor(n) : 1;
	return Math.max(1, Math.min(10, v));
}

export function wedgeAngle(sectors: number): number {
	return (2 * Math.PI) / clampSectors(sectors);
}

export function isSectorMirrored(index: number): boolean {
	return index % 2 === 0;
}

export function degToRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

export function carpetTileOffsets(repeat: number, tileW: number, tileH: number): TileOffset[] {
	const r = clampRepeat(repeat);
	const offsets: TileOffset[] = [];
	for (let row = 0; row < r; row++) {
		for (let col = 0; col < r; col++) {
			offsets.push({
				x: (col - (r - 1) / 2) * tileW,
				y: (row - (r - 1) / 2) * tileH
			});
		}
	}
	return offsets;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/kaleidoscope.ts src/lib/geometry/kaleidoscope.spec.ts
git commit -m "feat: kaleidoscope geometry helpers"
```

---

### Task 2: Canvas renderer

**Files:**
- Modify: `src/lib/geometry/kaleidoscope.ts`
- Test: `src/lib/geometry/kaleidoscope.spec.ts`

**Interfaces:**
- Consumes: `KaleidoscopeParams`, `clampSectors`, `clampRepeat`, `wedgeAngle`, `isSectorMirrored`, `degToRad`, `carpetTileOffsets` (Task 1).
- Produces: `renderKaleidoscopeToCanvas(ctx: CanvasRenderingContext2D, tile: CanvasImageSource, tileW: number, tileH: number, params: KaleidoscopeParams, size: number): void`

- [ ] **Step 1: Write the failing test** (append to `kaleidoscope.spec.ts`)

```ts
import { renderKaleidoscopeToCanvas } from './kaleidoscope';
import type { KaleidoscopeParams } from './kaleidoscope';

function makeRecordingCtx() {
	const calls: Record<string, number> = {};
	const rec = (name: string) => (calls[name] = (calls[name] ?? 0) + 1);
	const ctx = {
		calls,
		fillStyle: '',
		globalCompositeOperation: 'source-over',
		save: () => rec('save'),
		restore: () => rec('restore'),
		translate: () => rec('translate'),
		rotate: () => rec('rotate'),
		scale: () => rec('scale'),
		beginPath: () => rec('beginPath'),
		moveTo: () => rec('moveTo'),
		arc: () => rec('arc'),
		closePath: () => rec('closePath'),
		clip: () => rec('clip'),
		fill: () => rec('fill'),
		fillRect: () => rec('fillRect'),
		clearRect: () => rec('clearRect'),
		drawImage: () => rec('drawImage')
	};
	return ctx as unknown as CanvasRenderingContext2D & { calls: Record<string, number> };
}

const baseParams: KaleidoscopeParams = {
	sectors: 6,
	repeat: 2,
	offsetDistance: 0.1,
	scale: 1,
	tileSize: 0.5,
	tileRotation: 0,
	carpetRotation: 0,
	globalRotation: 0,
	circularMask: false,
	backgroundColor: '#000000',
	drawBackground: false
};

describe('renderKaleidoscopeToCanvas', () => {
	it('clips once per sector and draws repeat² tiles per sector', () => {
		const ctx = makeRecordingCtx() as ReturnType<typeof makeRecordingCtx>;
		const tile = {} as CanvasImageSource;
		renderKaleidoscopeToCanvas(ctx, tile, 100, 100, baseParams, 600);
		expect(ctx.calls.clip).toBe(6);
		expect(ctx.calls.drawImage).toBe(6 * 4);
		expect(ctx.calls.save).toBe(ctx.calls.restore);
	});

	it('paints background when drawBackground is true', () => {
		const ctx = makeRecordingCtx() as ReturnType<typeof makeRecordingCtx>;
		renderKaleidoscopeToCanvas(ctx, {} as CanvasImageSource, 100, 100, { ...baseParams, drawBackground: true }, 600);
		expect(ctx.calls.fillRect).toBe(1);
	});

	it('applies the circular mask when enabled', () => {
		const ctx = makeRecordingCtx() as ReturnType<typeof makeRecordingCtx>;
		renderKaleidoscopeToCanvas(ctx, {} as CanvasImageSource, 100, 100, { ...baseParams, circularMask: true }, 600);
		expect(ctx.calls.fill).toBeGreaterThanOrEqual(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope.spec.ts`
Expected: FAIL (`renderKaleidoscopeToCanvas` not exported).

- [ ] **Step 3: Write minimal implementation** (append to `kaleidoscope.ts`)

```ts
export function renderKaleidoscopeToCanvas(
	ctx: CanvasRenderingContext2D,
	tile: CanvasImageSource,
	tileW: number,
	tileH: number,
	params: KaleidoscopeParams,
	size: number
): void {
	const sectors = clampSectors(params.sectors);
	const wedge = wedgeAngle(sectors);
	const cx = size / 2;
	const cy = size / 2;
	const maxSide = Math.max(tileW, tileH) || 1;
	const drawW = size * params.tileSize * (tileW / maxSide);
	const drawH = size * params.tileSize * (tileH / maxSide);
	const offsetPx = params.offsetDistance * size;
	const clipRadius = size * 1.5;

	ctx.clearRect(0, 0, size, size);
	if (params.drawBackground) {
		ctx.fillStyle = params.backgroundColor;
		ctx.fillRect(0, 0, size, size);
	}

	ctx.save();
	if (params.globalRotation) {
		ctx.translate(cx, cy);
		ctx.rotate(degToRad(params.globalRotation));
		ctx.translate(-cx, -cy);
	}

	const offsets = carpetTileOffsets(params.repeat, drawW, drawH);

	for (let i = 0; i < sectors; i++) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(i * wedge);

		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.arc(0, 0, clipRadius, -wedge / 2, wedge / 2);
		ctx.closePath();
		ctx.clip();

		if (isSectorMirrored(i)) ctx.scale(-1, 1);
		ctx.translate(offsetPx, 0);
		ctx.rotate(degToRad(params.tileRotation));
		ctx.scale(params.scale, params.scale);

		for (const off of offsets) {
			ctx.save();
			ctx.translate(off.x, off.y);
			if (params.carpetRotation) ctx.rotate(degToRad(params.carpetRotation));
			ctx.drawImage(tile, -drawW / 2, -drawH / 2, drawW, drawH);
			ctx.restore();
		}

		ctx.restore();
	}

	ctx.restore();

	if (params.circularMask) {
		ctx.save();
		ctx.globalCompositeOperation = 'destination-in';
		ctx.beginPath();
		ctx.arc(cx, cy, size / 2, 0, 2 * Math.PI);
		ctx.closePath();
		ctx.fillStyle = '#000000';
		ctx.fill();
		ctx.restore();
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/kaleidoscope.ts src/lib/geometry/kaleidoscope.spec.ts
git commit -m "feat: kaleidoscope canvas renderer"
```

---

### Task 3: SVG generator (twin of the canvas renderer)

**Files:**
- Modify: `src/lib/geometry/kaleidoscope.ts`
- Test: `src/lib/geometry/kaleidoscope.spec.ts`

**Interfaces:**
- Consumes: Task 1 helpers + `KaleidoscopeParams`.
- Produces:
  - `extractSvgParts(svg: string): { inner: string; viewBox: string }`
  - `generateKaleidoscopeSVG(tileSvg: string, params: KaleidoscopeParams, size: number): string`

Note: SVG uses unit tile geometry derived from the tile's viewBox. `drawW`/`drawH` are computed from the viewBox aspect the same way the canvas uses `tileW`/`tileH`, so the two stay visually aligned.

- [ ] **Step 1: Write the failing test** (append to `kaleidoscope.spec.ts`)

```ts
import { extractSvgParts, generateKaleidoscopeSVG } from './kaleidoscope';

const tileSvg =
	'<svg width="100" height="50" viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="50" fill="#0f0"/></svg>';

describe('extractSvgParts', () => {
	it('pulls inner markup and viewBox', () => {
		const { inner, viewBox } = extractSvgParts(tileSvg);
		expect(viewBox).toBe('0 0 100 50');
		expect(inner).toContain('<rect');
	});
});

describe('generateKaleidoscopeSVG', () => {
	it('emits one wedge clip use per sector and repeat² tile uses each', () => {
		const out = generateKaleidoscopeSVG(tileSvg, baseParams, 600);
		expect((out.match(/clip-path="url\(#kaleido-wedge\)"/g) ?? [])).toHaveLength(6);
		expect((out.match(/<use href="#kaleido-tile"/g) ?? [])).toHaveLength(6 * 4);
	});

	it('mirrors even sectors and includes background + mask when enabled', () => {
		const out = generateKaleidoscopeSVG(
			tileSvg,
			{ ...baseParams, drawBackground: true, circularMask: true },
			600
		);
		expect(out).toContain('scale(-1,1)');
		expect(out).toContain('<rect');
		expect(out).toContain('clip-path="url(#kaleido-outer)"');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope.spec.ts`
Expected: FAIL (`extractSvgParts`/`generateKaleidoscopeSVG` not exported).

- [ ] **Step 3: Write minimal implementation** (append to `kaleidoscope.ts`)

```ts
export function extractSvgParts(svg: string): { inner: string; viewBox: string } {
	const innerMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
	const inner = innerMatch && innerMatch[1] ? innerMatch[1].trim() : '';
	const vbMatch = svg.match(/viewBox="([^"]+)"/);
	let viewBox = vbMatch ? vbMatch[1] : '';
	if (!viewBox) {
		const w = svg.match(/width="([\d.]+)"/);
		const h = svg.match(/height="([\d.]+)"/);
		viewBox = `0 0 ${w ? w[1] : 100} ${h ? h[1] : 100}`;
	}
	return { inner, viewBox };
}

export function generateKaleidoscopeSVG(
	tileSvg: string,
	params: KaleidoscopeParams,
	size: number
): string {
	const { inner, viewBox } = extractSvgParts(tileSvg);
	const [, , vbWStr, vbHStr] = viewBox.split(' ');
	const vbW = Number(vbWStr) || 1;
	const vbH = Number(vbHStr) || 1;
	const sectors = clampSectors(params.sectors);
	const wedgeDeg = 360 / sectors;
	const wedgeRad = wedgeAngle(sectors);
	const cx = size / 2;
	const cy = size / 2;
	const maxSide = Math.max(vbW, vbH) || 1;
	const drawW = size * params.tileSize * (vbW / maxSide);
	const drawH = size * params.tileSize * (vbH / maxSide);
	const offsetPx = params.offsetDistance * size;
	const clipR = size * 1.5;
	const f = (n: number) => n.toFixed(4);

	// Wedge clip path (centered at origin, the per-sector group translates to center).
	const x0 = clipR * Math.cos(-wedgeRad / 2);
	const y0 = clipR * Math.sin(-wedgeRad / 2);
	const x1 = clipR * Math.cos(wedgeRad / 2);
	const y1 = clipR * Math.sin(wedgeRad / 2);
	const largeArc = wedgeRad > Math.PI ? 1 : 0;

	const offsets = carpetTileOffsets(params.repeat, drawW, drawH);
	const carpet = offsets
		.map((off) => {
			const rot = params.carpetRotation ? ` rotate(${f(params.carpetRotation)})` : '';
			return (
				`<g transform="translate(${f(off.x)},${f(off.y)})${rot}">` +
				`<use href="#kaleido-tile" x="${f(-drawW / 2)}" y="${f(-drawH / 2)}" width="${f(drawW)}" height="${f(drawH)}"/>` +
				`</g>`
			);
		})
		.join('');

	let sectorsSvg = '';
	for (let i = 0; i < sectors; i++) {
		const mirror = isSectorMirrored(i) ? '<g transform="scale(-1,1)">' : '<g>';
		sectorsSvg +=
			`<g transform="translate(${f(cx)},${f(cy)}) rotate(${f(i * wedgeDeg)})">` +
			`<g clip-path="url(#kaleido-wedge)">` +
			mirror +
			`<g transform="translate(${f(offsetPx)},0) rotate(${f(params.tileRotation)}) scale(${f(params.scale)})">` +
			carpet +
			`</g></g></g></g>`;
	}

	const defs =
		`<defs>` +
		`<symbol id="kaleido-tile" viewBox="${viewBox}" overflow="visible">${inner}</symbol>` +
		`<clipPath id="kaleido-wedge"><path d="M 0,0 L ${f(x0)},${f(y0)} A ${f(clipR)},${f(clipR)} 0 ${largeArc} 1 ${f(x1)},${f(y1)} Z"/></clipPath>` +
		(params.circularMask
			? `<clipPath id="kaleido-outer"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(size / 2)}"/></clipPath>`
			: '') +
		`</defs>`;

	const bg = params.drawBackground
		? `<rect width="${size}" height="${size}" fill="${params.backgroundColor}"/>`
		: '';

	const globalOpen = params.globalRotation
		? `<g transform="translate(${f(cx)},${f(cy)}) rotate(${f(params.globalRotation)}) translate(${f(-cx)},${f(-cy)})">`
		: '<g>';
	const maskOpen = params.circularMask ? '<g clip-path="url(#kaleido-outer)">' : '<g>';

	return (
		`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">` +
		defs +
		bg +
		globalOpen +
		maskOpen +
		sectorsSvg +
		`</g></g></svg>`
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/kaleidoscope.ts src/lib/geometry/kaleidoscope.spec.ts
git commit -m "feat: kaleidoscope vector SVG generator"
```

---

### Task 4: Kaleidoscope state module

**Files:**
- Create: `src/lib/state/kaleidoscope.svelte.ts`
- Test: `src/lib/state/kaleidoscope.svelte.spec.ts`

**Interfaces:**
- Consumes: `clampSectors`, `clampRepeat`, `KaleidoscopeParams` (Task 1).
- Produces:
  - `type KaleidoscopeState = KaleidoscopeParams & { enabled: boolean; liveTile: boolean; tileBackground: boolean }`
  - `kaleidoscope: KaleidoscopeState` (`$state`)
  - setters: `setKaleidoscopeEnabled(v: boolean)`, `setSectors(n)`, `setRepeat(n)`, `setOffsetDistance(n)`, `setScale(n)`, `setTileSize(n)`, `setTileRotation(n)`, `setCarpetRotation(n)`, `setGlobalRotation(n)`, `setCircularMask(v)`, `setLiveTile(v)`, `setTileBackground(v)`, `setKaleidoscopeBackgroundColor(c: string)`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/state/kaleidoscope.svelte.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
	kaleidoscope,
	setKaleidoscopeEnabled,
	setSectors,
	setRepeat,
	setTileBackground,
	setKaleidoscopeBackgroundColor
} from './kaleidoscope.svelte';

describe('kaleidoscope state', () => {
	beforeEach(() => {
		setKaleidoscopeEnabled(false);
		setSectors(6);
		setRepeat(2);
		setTileBackground(false);
	});

	it('toggles enabled', () => {
		setKaleidoscopeEnabled(true);
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('clamps sectors to even 4..24', () => {
		setSectors(7);
		expect(kaleidoscope.sectors).toBe(6);
		setSectors(100);
		expect(kaleidoscope.sectors).toBe(24);
	});

	it('clamps repeat to 1..10', () => {
		setRepeat(99);
		expect(kaleidoscope.repeat).toBe(10);
	});

	it('stores background color and tile-background flag', () => {
		setTileBackground(true);
		setKaleidoscopeBackgroundColor('#123456');
		expect(kaleidoscope.tileBackground).toBe(true);
		expect(kaleidoscope.backgroundColor).toBe('#123456');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/state/kaleidoscope.svelte.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/state/kaleidoscope.svelte.ts
import { clampSectors, clampRepeat, type KaleidoscopeParams } from '$lib/geometry/kaleidoscope';

export type KaleidoscopeState = KaleidoscopeParams & {
	enabled: boolean;
	liveTile: boolean;
	tileBackground: boolean;
};

export const kaleidoscope = $state<KaleidoscopeState>({
	enabled: false,
	sectors: 8,
	repeat: 3,
	offsetDistance: 0,
	scale: 1,
	tileSize: 0.6,
	tileRotation: 0,
	carpetRotation: 0,
	globalRotation: 0,
	circularMask: true,
	backgroundColor: '#ffffff',
	drawBackground: true, // mirrors !tileBackground; see setTileBackground
	liveTile: false,
	tileBackground: false
});

export function setKaleidoscopeEnabled(v: boolean) {
	kaleidoscope.enabled = v;
}
export function setSectors(n: number) {
	kaleidoscope.sectors = clampSectors(n);
}
export function setRepeat(n: number) {
	kaleidoscope.repeat = clampRepeat(n);
}
export function setOffsetDistance(n: number) {
	kaleidoscope.offsetDistance = Number.isFinite(n) ? n : 0;
}
export function setScale(n: number) {
	kaleidoscope.scale = Number.isFinite(n) && n > 0 ? n : 1;
}
export function setTileSize(n: number) {
	kaleidoscope.tileSize = Number.isFinite(n) && n > 0 ? n : 0.6;
}
export function setTileRotation(n: number) {
	kaleidoscope.tileRotation = Number.isFinite(n) ? n : 0;
}
export function setCarpetRotation(n: number) {
	kaleidoscope.carpetRotation = Number.isFinite(n) ? n : 0;
}
export function setGlobalRotation(n: number) {
	kaleidoscope.globalRotation = Number.isFinite(n) ? n : 0;
}
export function setCircularMask(v: boolean) {
	kaleidoscope.circularMask = v;
}
export function setLiveTile(v: boolean) {
	kaleidoscope.liveTile = v;
}
export function setTileBackground(v: boolean) {
	kaleidoscope.tileBackground = v;
	// When the tile carries its own background, the kaleidoscope must NOT paint its own.
	kaleidoscope.drawBackground = !v;
}
export function setKaleidoscopeBackgroundColor(c: string) {
	kaleidoscope.backgroundColor = c;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/state/kaleidoscope.svelte.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/kaleidoscope.svelte.ts src/lib/state/kaleidoscope.svelte.spec.ts
git commit -m "feat: kaleidoscope state module"
```

---

### Task 5: Tile compositing helper + composition background color

**Files:**
- Create: `src/lib/geometry/kaleidoscope-tile.ts`
- Test: `src/lib/geometry/kaleidoscope-tile.spec.ts`
- Modify: `src/lib/state/composition.ts` (add `getCompositionBackgroundColor`)

**Interfaces:**
- Consumes: nothing from earlier kaleidoscope tasks.
- Produces:
  - `composeTileWithBackground(source: HTMLCanvasElement, backgroundColor: string | null): HTMLCanvasElement` — returns a same-size canvas; when `backgroundColor` is non-null, fills it first, then draws `source` on top; when null, returns `source` unchanged.
  - `getCompositionBackgroundColor(): string` (in `composition.ts`) — the active monochrome palette's `bg`, default `#ffffff`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/geometry/kaleidoscope-tile.spec.ts
import { describe, it, expect } from 'vitest';
import { composeTileWithBackground } from './kaleidoscope-tile';

function solidAlphaCanvas(): HTMLCanvasElement {
	const c = document.createElement('canvas');
	c.width = 4;
	c.height = 4;
	// leave fully transparent
	return c;
}

describe('composeTileWithBackground', () => {
	it('returns the source unchanged when background is null', () => {
		const src = solidAlphaCanvas();
		expect(composeTileWithBackground(src, null)).toBe(src);
	});

	it('paints an opaque background behind the source', () => {
		const src = solidAlphaCanvas();
		const out = composeTileWithBackground(src, '#ff0000');
		expect(out).not.toBe(src);
		const data = out.getContext('2d')!.getImageData(0, 0, 1, 1).data;
		expect(data[0]).toBe(255); // red
		expect(data[3]).toBe(255); // opaque
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope-tile.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/geometry/kaleidoscope-tile.ts
/**
 * Returns a tile canvas with an opaque background painted behind the source shapes.
 * When `backgroundColor` is null the source is returned unchanged (transparent tile).
 */
export function composeTileWithBackground(
	source: HTMLCanvasElement,
	backgroundColor: string | null
): HTMLCanvasElement {
	if (backgroundColor === null) return source;
	const out = document.createElement('canvas');
	out.width = source.width;
	out.height = source.height;
	const ctx = out.getContext('2d');
	if (!ctx) return source;
	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0, 0, out.width, out.height);
	ctx.drawImage(source, 0, 0);
	return out;
}
```

Then add to `src/lib/state/composition.ts` (after `setAspectRatio`):

```ts
export function getCompositionBackgroundColor(): string {
	const mono = composition.monochromePalettes[colorMode.palette];
	return mono?.bg ?? '#ffffff';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/geometry/kaleidoscope-tile.spec.ts`
Expected: PASS. Then `bun run check` — expect 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/kaleidoscope-tile.ts src/lib/geometry/kaleidoscope-tile.spec.ts src/lib/state/composition.ts
git commit -m "feat: kaleidoscope tile compositing + composition bg color"
```

---

### Task 6: Kaleidoscope sidebar section

**Files:**
- Create: `src/lib/components/KaleidoscopeSection.svelte`
- Modify: `src/lib/components/Sidebar.svelte` (import + place section)
- Test: `src/lib/components/KaleidoscopeSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `kaleidoscope` state + setters (Task 4).
- Produces: a `<SidebarCollapsible>` titled "Caleidoscopio" with all controls.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/KaleidoscopeSection.svelte.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopeSection from './KaleidoscopeSection.svelte';
import { kaleidoscope, setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';

describe('KaleidoscopeSection', () => {
	beforeEach(() => setKaleidoscopeEnabled(false));

	it('toggles kaleidoscope mode through the enable checkbox', async () => {
		const screen = render(KaleidoscopeSection);
		const toggle = screen.getByLabelText('Modalità caleidoscopio');
		await toggle.click();
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('updates sectors from the range input', async () => {
		const screen = render(KaleidoscopeSection);
		const sectors = screen.getByLabelText('Settori');
		await sectors.fill('12');
		expect(kaleidoscope.sectors).toBe(12);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts`
Expected: FAIL (component not found).

- [ ] **Step 3: Write minimal implementation**

```svelte
<!-- src/lib/components/KaleidoscopeSection.svelte -->
<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import {
		kaleidoscope,
		setKaleidoscopeEnabled,
		setSectors,
		setRepeat,
		setOffsetDistance,
		setScale,
		setTileSize,
		setTileRotation,
		setCarpetRotation,
		setGlobalRotation,
		setCircularMask,
		setLiveTile,
		setTileBackground,
		setKaleidoscopeBackgroundColor
	} from '$lib/state/kaleidoscope.svelte';

	let { onRefreshTile }: { onRefreshTile?: () => void } = $props();

	const num = (e: Event) => Number((e.target as HTMLInputElement).value);
	const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Caleidoscopio
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					aria-label="Modalità caleidoscopio"
					checked={kaleidoscope.enabled}
					onchange={(e) => setKaleidoscopeEnabled(checked(e))}
				/>
				Modalità caleidoscopio
			</label>

			<div class="flex flex-col gap-1">
				<Label for="k-sectors" class="text-xs">Settori ({kaleidoscope.sectors})</Label>
				<input id="k-sectors" aria-label="Settori" type="range" min="4" max="24" step="2"
					value={kaleidoscope.sectors} oninput={(e) => setSectors(num(e))} />
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-repeat" class="text-xs">Ripetizioni ({kaleidoscope.repeat})</Label>
				<input id="k-repeat" aria-label="Ripetizioni" type="range" min="1" max="10" step="1"
					value={kaleidoscope.repeat} oninput={(e) => setRepeat(num(e))} />
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-offset" class="text-xs">Distanza dal centro</Label>
				<input id="k-offset" aria-label="Distanza dal centro" type="range" min="0" max="1" step="0.01"
					value={kaleidoscope.offsetDistance} oninput={(e) => setOffsetDistance(num(e))} />
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-scale" class="text-xs">Scala globale</Label>
				<input id="k-scale" aria-label="Scala globale" type="range" min="0.3" max="3" step="0.05"
					value={kaleidoscope.scale} oninput={(e) => setScale(num(e))} />
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-tilesize" class="text-xs">Dimensione tessera</Label>
				<input id="k-tilesize" aria-label="Dimensione tessera" type="range" min="0.1" max="2" step="0.05"
					value={kaleidoscope.tileSize} oninput={(e) => setTileSize(num(e))} />
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-tilerot" class="text-xs">Rotazione tessera</Label>
				<input id="k-tilerot" aria-label="Rotazione tessera" type="range" min="0" max="360" step="1"
					value={kaleidoscope.tileRotation} oninput={(e) => setTileRotation(num(e))} />
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-carpetrot" class="text-xs">Rotazione tappeto</Label>
				<input id="k-carpetrot" aria-label="Rotazione tappeto" type="range" min="0" max="360" step="1"
					value={kaleidoscope.carpetRotation} oninput={(e) => setCarpetRotation(num(e))} />
			</div>

			<div class="flex flex-col gap-1">
				<Label for="k-globalrot" class="text-xs">Rotazione globale</Label>
				<input id="k-globalrot" aria-label="Rotazione globale" type="range" min="0" max="360" step="1"
					value={kaleidoscope.globalRotation} oninput={(e) => setGlobalRotation(num(e))} />
			</div>

			<label class="flex items-center gap-2 text-xs">
				<input type="checkbox" aria-label="Maschera circolare"
					checked={kaleidoscope.circularMask} onchange={(e) => setCircularMask(checked(e))} />
				Maschera circolare
			</label>

			<label class="flex items-center gap-2 text-xs">
				<input type="checkbox" aria-label="Tessera viva"
					checked={kaleidoscope.liveTile} onchange={(e) => setLiveTile(checked(e))} />
				Tessera viva (audio)
			</label>

			{#if !kaleidoscope.liveTile}
				<Button variant="outline" class="w-full" onclick={() => onRefreshTile?.()}>
					Aggiorna istantanea
				</Button>
			{/if}

			<label class="flex items-center gap-2 text-xs">
				<input type="checkbox" aria-label="Sfondo tessera"
					checked={kaleidoscope.tileBackground} onchange={(e) => setTileBackground(checked(e))} />
				Sfondo tessera
			</label>

			{#if !kaleidoscope.tileBackground}
				<div class="flex items-center gap-2">
					<Label for="k-bg" class="text-xs">Sfondo caleidoscopio</Label>
					<input id="k-bg" aria-label="Sfondo caleidoscopio" type="color"
						value={kaleidoscope.backgroundColor}
						oninput={(e) => setKaleidoscopeBackgroundColor((e.target as HTMLInputElement).value)} />
				</div>
			{/if}
		</div>
	{/snippet}
</SidebarCollapsible>
```

Then in `src/lib/components/Sidebar.svelte`: add the import next to the other section imports —

```ts
import KaleidoscopeSection from './KaleidoscopeSection.svelte';
```

— and place `<KaleidoscopeSection />` directly after `<CanvasSection />` (line 40):

```svelte
	<CanvasSection />

	<KaleidoscopeSection />
```

- [ ] **Step 4: Run test + autofixer**

Run: `bun run test:unit -- run src/lib/components/KaleidoscopeSection.svelte.spec.ts`
Expected: PASS.
Then run the `svelte-autofixer` MCP tool on `KaleidoscopeSection.svelte` and `Sidebar.svelte`; apply fixes until clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/KaleidoscopeSection.svelte src/lib/components/Sidebar.svelte src/lib/components/KaleidoscopeSection.svelte.spec.ts
git commit -m "feat: Caleidoscopio sidebar section"
```

---

### Task 7: Preview integration + PNG/SVG export

**Files:**
- Modify: `src/lib/components/PreviewCanvas.svelte`
- Test: `src/lib/components/PreviewCanvas.svelte.spec.ts` (extend)

**Interfaces:**
- Consumes: `kaleidoscope` (Task 4), `renderKaleidoscopeToCanvas` + `generateKaleidoscopeSVG` (Tasks 2–3), `composeTileWithBackground` (Task 5), `getCompositionBackgroundColor` (Task 5), existing render pipeline + paper scope.
- Produces: a preview that swaps to the kaleidoscope when `kaleidoscope.enabled`, a refresh-snapshot handler passed to `KaleidoscopeSection`, and "Esporta PNG (caleidoscopio)" / "Esporta SVG (caleidoscopio)" buttons.

This task wires several pieces; below is the design, then the concrete edits. Keep the existing (mode-off) path exactly as today.

**Design**
- Add a second, offscreen paper scope + canvas (square, `TILE_PX = 600`) used only to render the composition as a tile when kaleidoscope mode is on. Reuse the same `renderPipeline`.
- A `renderTile()` function: render the composition into the offscreen scope, read its canvas, and `composeTileWithBackground(offscreenCanvas, kaleidoscope.tileBackground ? getCompositionBackgroundColor() : null)`.
- An `$effect` that, when `kaleidoscope.enabled`, drives a `requestAnimationFrame` loop: each frame, if `kaleidoscope.liveTile` re-run `renderTile()`, else reuse the cached static tile; then `renderKaleidoscopeToCanvas(visibleCtx, tile, tile.width, tile.height, kaleidoscope, size)`. When disabled, cancel the loop and let the existing paper effect own the canvas again.
- "Aggiorna istantanea" (`onRefreshTile`) re-runs `renderTile()` and caches it.

- [ ] **Step 1: Write the failing test** (extend `PreviewCanvas.svelte.spec.ts`)

```ts
import { kaleidoscope, setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';

it('shows kaleidoscope export buttons when mode is enabled', async () => {
	const screen = render(PreviewCanvas);
	setKaleidoscopeEnabled(true);
	const png = screen.getByText('Esporta PNG (caleidoscopio)');
	const svg = screen.getByText('Esporta SVG (caleidoscopio)');
	await expect.element(png).toBeInTheDocument();
	await expect.element(svg).toBeInTheDocument();
	setKaleidoscopeEnabled(false);
});
```

(If the existing spec has no top-level `render` import/setup, mirror its existing pattern; only add this `it` block inside the existing `describe`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: FAIL (buttons not present).

- [ ] **Step 3: Implement the integration**

In `PreviewCanvas.svelte` `<script>`, add imports:

```ts
import { kaleidoscope } from '$lib/state/kaleidoscope.svelte';
import { renderKaleidoscopeToCanvas, generateKaleidoscopeSVG } from '$lib/geometry/kaleidoscope';
import { composeTileWithBackground } from '$lib/geometry/kaleidoscope-tile';
import { getCompositionBackgroundColor } from '$lib/state/composition';
```

Add module-local state + helpers (inside `<script>`, after the existing `let` declarations):

```ts
const TILE_PX = 600;
let tileScope: paper.PaperScope | undefined;
let tileCanvas: HTMLCanvasElement | undefined;
let staticTile: HTMLCanvasElement | undefined;
let kaleidoFrame: number | null = null;

function ensureTileScope() {
	if (tileScope) return;
	tileCanvas = document.createElement('canvas');
	tileCanvas.width = TILE_PX;
	tileCanvas.height = TILE_PX;
	tileScope = new paper.PaperScope();
	tileScope.setup(tileCanvas);
}

function renderTile(): HTMLCanvasElement {
	ensureTileScope();
	const viewport = { width: TILE_PX, height: TILE_PX, padding: 32 };
	const ignoreMorph =
		animationState.mode === 'audioBars' || animationState.mode === 'audioZones';
	renderPipeline.render({ composition, scope: tileScope!, ignoreMorph, viewport });
	const bg = kaleidoscope.tileBackground ? getCompositionBackgroundColor() : null;
	return composeTileWithBackground(tileCanvas!, bg);
}

function refreshTile() {
	staticTile = renderTile();
}

function drawKaleidoscope() {
	if (!canvasEl) return;
	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;
	const tile = kaleidoscope.liveTile ? renderTile() : (staticTile ??= renderTile());
	const size = Math.min(canvasEl.width, canvasEl.height);
	renderKaleidoscopeToCanvas(ctx, tile, tile.width, tile.height, kaleidoscope, size);
}

function exportKaleidoscopePng() {
	if (!canvasEl) return;
	canvasEl.toBlob((blob) => {
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'kaleidoscope.png';
		a.click();
		URL.revokeObjectURL(url);
	}, 'image/png');
}

function exportKaleidoscopeSvg() {
	ensureTileScope();
	renderTile();
	tileScope!.activate();
	const tileSvg = tileScope!.project.exportSVG({ asString: true }) as string;
	const size = canvasEl ? Math.min(canvasEl.width, canvasEl.height) : TILE_PX;
	const svg = generateKaleidoscopeSVG(tileSvg, kaleidoscope, size);
	const blob = new Blob([svg], { type: 'image/svg+xml' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'kaleidoscope.svg';
	a.click();
	URL.revokeObjectURL(url);
}

$effect(() => {
	if (!kaleidoscope.enabled) {
		if (kaleidoFrame !== null) {
			cancelAnimationFrame(kaleidoFrame);
			kaleidoFrame = null;
		}
		return;
	}
	// Touch reactive params so the loop restarts when they change.
	void kaleidoscope.sectors;
	void kaleidoscope.repeat;
	void kaleidoscope.liveTile;
	staticTile = undefined;
	const loop = () => {
		drawKaleidoscope();
		kaleidoFrame = requestAnimationFrame(loop);
	};
	kaleidoFrame = requestAnimationFrame(loop);
	return () => {
		if (kaleidoFrame !== null) {
			cancelAnimationFrame(kaleidoFrame);
			kaleidoFrame = null;
		}
	};
});
```

In the markup, add the kaleidoscope export buttons (after the existing `Export SVG` button, gated on the mode):

```svelte
	{#if kaleidoscope.enabled}
		<Button variant="outline" onclick={exportKaleidoscopePng} class="w-full max-w-[600px]">
			Esporta PNG (caleidoscopio)
		</Button>
		<Button variant="outline" onclick={exportKaleidoscopeSvg} class="w-full max-w-[600px]">
			Esporta SVG (caleidoscopio)
		</Button>
	{/if}
```

Wire the refresh handler: `KaleidoscopeSection` is rendered from the Sidebar, not here. Pass the refresh through the shared state by exporting `refreshTile` via a module-level callback registry, OR (simpler, chosen here) move the "Aggiorna istantanea" trigger to a shared `$state` flag.

Add to `kaleidoscope.svelte.ts`:

```ts
export function requestTileRefresh() {
	kaleidoscope.refreshNonce++;
}
```

and add `refreshNonce: 0` to the `KaleidoscopeState` type and initial `$state`. In `KaleidoscopeSection.svelte`, replace `onclick={() => onRefreshTile?.()}` with `onclick={() => requestTileRefresh()}` (import it) and drop the `onRefreshTile` prop. In `PreviewCanvas.svelte`, react to it:

```ts
$effect(() => {
	void kaleidoscope.refreshNonce;
	if (kaleidoscope.enabled && !kaleidoscope.liveTile) refreshTile();
});
```

Update the Task 6 test reference to `requestTileRefresh` if needed; the section test does not assert refresh behaviour, so no change required there.

- [ ] **Step 4: Run tests + autofixer + check**

Run: `bun run test:unit -- run src/lib/components/PreviewCanvas.svelte.spec.ts`
Expected: PASS.
Run the `svelte-autofixer` MCP tool on `PreviewCanvas.svelte` until clean (ignore only the known "function inside $effect" false positive on the paper render).
Run: `bun run check` — expected 0 errors.

- [ ] **Step 5: Run the FULL suite, then commit**

Run: `bun run test:unit -- run`
Expected: all green (watch for the Sidebar composition-mock regression noted in Global Constraints).

```bash
git add src/lib/components/PreviewCanvas.svelte src/lib/components/PreviewCanvas.svelte.spec.ts src/lib/components/KaleidoscopeSection.svelte src/lib/state/kaleidoscope.svelte.ts
git commit -m "feat: kaleidoscope preview integration + PNG/SVG export"
```

- [ ] **Step 6: Manual live verification (`bun run dev`, hard-reload)**

Confirm:
- Toggle "Modalità caleidoscopio" on → preview swaps to kaleidoscope; off → back to today's flower exactly.
- Sweep every slider (settori even-only, ripetizioni, distanza, scala, dimensione, rotazioni, maschera) — all visibly affect the result.
- "Tessera viva" on with an audio source → motif pulses inside the sectors; off → frozen; "Aggiorna istantanea" re-snapshots.
- "Sfondo tessera" on → tile shows its own background; off → kaleidoscope background color shows behind, and changing the color updates it.
- "Esporta PNG (caleidoscopio)" downloads a correct PNG; "Esporta SVG (caleidoscopio)" downloads an SVG that opens and matches the preview (static snapshot).

---

## Self-Review

**Spec coverage**
- Tile = whole composition; mode toggle swaps preview → Task 7. ✓
- Kaleidoscope not audio-reactive; audio only via the tile → Task 7 (`liveTile` re-renders the composition which carries audio; kaleidoscope params are slider-driven). ✓
- Live/static toggle (+ refresh) → Tasks 4, 6, 7. ✓
- New "Caleidoscopio" section + placement → Task 6. ✓
- Tile background toggle + separate kaleidoscope bg color → Tasks 4, 5, 6, 7. ✓
- Full control set → Tasks 4, 6. ✓
- PNG + SVG export, SVG vector & static → Tasks 3, 7. ✓
- Do not touch bend/pipeline/audio → respected (only additive + a read-only helper in composition.ts). ✓
- Resolution-independent params → enforced in Tasks 1–3 (offset as fraction, scale/tileSize multipliers). ✓
- Out of scope: keyframe editor + WebM (Blocks 2–3) → not present. ✓

**Placeholder scan:** none — every code step contains full code. Slider ranges/steps are concrete in Task 6. Defaults are concrete in Task 4.

**Type consistency:** `KaleidoscopeParams` (Task 1) is extended by `KaleidoscopeState` (Task 4) which adds `enabled`, `liveTile`, `tileBackground`, and `refreshNonce` (Task 7). `renderKaleidoscopeToCanvas`/`generateKaleidoscopeSVG` accept `KaleidoscopeParams`; `kaleidoscope` (a `KaleidoscopeState`) is a structural superset, so passing it is type-safe. Setter names match between Tasks 4, 6, 7. `composeTileWithBackground` signature matches between Tasks 5 and 7. `getCompositionBackgroundColor` matches between Tasks 5 and 7.

> Note (Task 7): `refreshNonce` must be added to both the `KaleidoscopeState` type and the initial `$state` object in `kaleidoscope.svelte.ts`, alongside `requestTileRefresh`. This is the one cross-task edit to the Task 4 module — apply it as part of Task 7.
