# Testing Patterns

**Analysis Date:** 2026-07-06

## Test Framework

**Runner:**

- Vitest with multi-project configuration in `vite.config.ts`: two projects, `client` and `server`, both extending the root config.
- Global enforcement: `expect: { requireAssertions: true }` (every test must assert something).

**Assertion Library:**

- Vitest built-in `expect`.

**Browser component testing:**

- `@vitest/browser-playwright` with Chromium headless provider (`instances: [{ browser: 'chromium', headless: true }]`).
- `vitest-browser-svelte` for rendering Svelte components in browser tests; `vitest/browser`'s `page` for locators (`page.getByTestId(...)`).

**Run Commands:**

```bash
npm run test:unit              # Vitest (watch mode by default)
npm run test:unit -- --run     # Single run of all Vitest projects
npm run test                   # Unit tests (--run) + Playwright e2e
npm run test:e2e               # Playwright suite
```

## Test File Organization

**Location:**

- Tests are co-located with source files under `src/lib/**` and `src/routes/**`.
- Examples: `src/lib/state/animation-drivers/audio-bars-driver.spec.ts`, `src/lib/geometry/kaleidoscope.spec.ts`, `src/routes/(app)/composition/page.svelte.spec.ts`.

**Naming / project split (from `vite.config.ts`):**

- `client` project — `include: ['src/**/*.svelte.{test,spec}.{js,ts}']`, browser/Chromium — i.e. any `*.svelte.spec.ts` (or `.test.ts`) file. Excludes `src/lib/server/**` and, explicitly, `src/lib/state/animation.svelte.spec.ts`.
- `server` project — `environment: 'node'`, `include: ['src/**/*.test.{js,ts}', 'src/**/!(*.svelte).spec.{js,ts}', 'src/lib/state/animation.svelte.spec.ts']` — i.e. every non-`.svelte` `*.spec.ts`, plus the one explicit exception below.
- **Documented exception:** `src/lib/state/animation.svelte.spec.ts` is named `*.svelte.spec.ts` (would normally land in `client`) but is force-excluded from `client` and force-included in `server`. The file itself carries `// @vitest-environment node` at the top, confirming the intent — the animation controller is pure state logic (mocks `./composition` and `requestAnimationFrame`/`cancelAnimationFrame`) and doesn't need a browser.
- Net rule of thumb: `*.svelte.spec.ts` → browser/`client`, plain `*.spec.ts` → node/`server`, except that one file.

**Structure (representative, not exhaustive):**

```
src/lib/
├── actions/draggable.svelte.spec.ts
├── animation/
│   ├── keyframes.spec.ts
│   └── timeline-geometry.spec.ts
├── color/apply.spec.ts
├── components/                          # ~30 *.svelte.spec.ts (browser project)
│   ├── AudioBarsSection.svelte.spec.ts
│   ├── AudioZonesSection.svelte.spec.ts
│   ├── DataSeriesSection.svelte.spec.ts
│   ├── KaleidoscopeAudioSection.svelte.spec.ts
│   ├── KaleidoscopePanel.svelte.spec.ts
│   ├── KeyframeGraphEditor.svelte.spec.ts
│   ├── PreviewCanvas.svelte.spec.ts
│   ├── preview-presenter.svelte.spec.ts
│   ├── preview-presenter.export.svelte.spec.ts
│   ├── RingEditor.svelte.spec.ts
│   ├── TimelinePanel.svelte.spec.ts
│   └── ... (Ring*ConfigItem, Timeline*, Library/Path pickers, SidebarNav, LanguageSwitcher)
├── export/canvas-export.spec.ts
├── geometry/
│   ├── aspect-ratio.spec.ts
│   ├── bend.svelte.spec.ts
│   ├── compose.svelte.spec.ts
│   ├── compose-ring.spec.ts
│   ├── kaleidoscope.spec.ts
│   ├── kaleidoscope-tile.svelte.spec.ts
│   ├── path-morph.svelte.spec.ts
│   ├── render-pipeline.svelte.spec.ts
│   ├── svg-import.svelte.spec.ts
│   ├── wave.spec.ts
│   └── zones.spec.ts
├── messages-parity.spec.ts              # en/it message-key parity
├── state/
│   ├── animation.svelte.spec.ts         # forced into node (see exception above)
│   ├── animation-drivers/
│   │   ├── audio-bars-driver.spec.ts
│   │   ├── audio-source.spec.ts
│   │   ├── audio-zones-driver.spec.ts
│   │   ├── data-series-driver.spec.ts
│   │   ├── demo-zones.spec.ts
│   │   ├── fallback-bars.spec.ts
│   │   └── runtime.spec.ts
│   ├── composition.svelte.spec.ts (+ .add-ring-with-path, .aspect-ratio variants)
│   ├── composition-persistence.svelte.spec.ts
│   ├── kaleidoscope.svelte.spec.ts
│   ├── keyframes.svelte.spec.ts
│   ├── path-library.svelte.spec.ts (+ .create-arc, .grid-options, .seed, .update-path variants)
│   └── ring-id.spec.ts
└── vitest-examples/ (Welcome.svelte.spec.ts, greet.spec.ts — scaffold examples)

src/routes/
├── (app)/
│   ├── animate/page.svelte.spec.ts
│   ├── composition/page.svelte.spec.ts
│   ├── editor/page.svelte.spec.ts
│   ├── layout.svelte.spec.ts
│   └── workspace-nav.e2e.ts
├── about/
│   ├── about-nav.e2e.ts
│   └── page.svelte.spec.ts
├── demo/playwright/page.svelte.e2e.ts
└── paths/
    ├── page.svelte.spec.ts
    └── path-manager.e2e.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('feature name', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('does one observable thing', async () => {
		const mod = await import('./feature');
		expect(mod.value).toBeDefined();
	});
});
```

**Patterns:**

- Reset module state with `vi.resetModules()` when module-level runes/state are under test (`src/lib/state/animation.svelte.spec.ts`, `src/lib/state/composition.svelte.spec.ts`, `src/lib/state/path-library.svelte.spec.ts`).
- Use dynamic `await import(...)` after `vi.mock(...)` calls to ensure tests consume mocked dependencies.
- Browser tests use `render(...)` (from `vitest-browser-svelte`), `page` (from `vitest/browser`), and `page.getByTestId(...)` locators for UI interaction (`src/lib/components/KeyframeGraphEditor.svelte.spec.ts`).
- `src/lib/state/animation.svelte.spec.ts` mocks `requestAnimationFrame`/`cancelAnimationFrame` with `vi.stubGlobal(...)` and a manual queue (`installRafMock`/`flushNextAnimationFrame`) to drive the animation loop deterministically.
- Rendering tests that rely on Paper.js create a real `paper.PaperScope` per test (`scope = new paper.PaperScope(); scope.setup(new paper.Size(...))`) rather than mocking Paper internals.

## Animation and Morph Coverage

The animation surface is now a controller plus a driver runtime, a keyframe engine, and audio-reactive drivers; coverage spreads across the subsystems below (animation/morph first, then the rest of the pipeline).

### Animation drivers (`src/lib/state/animation-drivers/`)

- `runtime.spec.ts` — `createAnimationRuntime`: `registerDriver`/`setActive`/`tick` orchestration.
- `audio-bars-driver.spec.ts`, `audio-zones-driver.spec.ts` — driver output shape (`WaveState` per ring) given fake ring configs and fake analyser data.
- `audio-source.spec.ts` — audio source lifecycle/analyser wiring.
- `data-series-driver.spec.ts` — data-series → wave mapping.
- `demo-zones.spec.ts`, `fallback-bars.spec.ts` — deterministic fallback/demo signal generation when no live input is present.
- `src/lib/state/animation.svelte.spec.ts` (node, see exception above) — the animate controller itself: mocks `./composition` and stubs `requestAnimationFrame`/`cancelAnimationFrame` (`installRafMock`/`flushNextAnimationFrame`) to drive the loop deterministically; covers idle→playing, pause/resume, no-op with no morph targets, progress updates, reset on ring-set change, loop/alternate edge cases, and rune reactivity via `$derived`.

### Keyframes (`src/lib/state/keyframes.svelte.ts`, `src/lib/animation/keyframes.ts`)

- `src/lib/state/keyframes.svelte.spec.ts` — track/keyframe CRUD (`ensureTrack`, `addKeyframe`, `deleteKeyframe`) and per-param track state.
- `src/lib/animation/keyframes.spec.ts` — keyframe evaluation/interpolation logic independent of Svelte state.
- `src/lib/animation/timeline-geometry.spec.ts` — timeline pixel/time coordinate mapping.
- `src/lib/components/KeyframeGraphEditor.svelte.spec.ts` — browser test: empty-state hint, curve + point rendering per keyframe, bezier handle rendering, driven through the real `keyframes` singleton (reset in `beforeEach`).
- `src/lib/components/TimelinePanel.svelte.spec.ts`, `TimelineRuler.svelte.spec.ts`, `TimelineTrack.svelte.spec.ts` — timeline UI wiring.

### Kaleidoscope (`src/lib/geometry/kaleidoscope.ts`, `kaleidoscope-tile.ts`, `state/kaleidoscope.svelte.ts`)

- `src/lib/geometry/kaleidoscope.spec.ts` — sector/mirror math (node).
- `src/lib/geometry/kaleidoscope-tile.svelte.spec.ts` — tile rendering via Paper.js (browser).
- `src/lib/state/kaleidoscope.svelte.spec.ts` — `kaleidoscope` singleton setters (`enabled`, `sectors`, `repeat`, `liveTile`, `circularMask`, ...).
- `src/lib/components/KaleidoscopePanel.svelte.spec.ts`, `KaleidoscopeAudioSection.svelte.spec.ts` — panel/audio-driven UI wiring.
- `src/lib/components/preview-presenter.svelte.spec.ts` — single-writer canvas contract: flat-composition `$effect` returns early when `kaleidoscope.enabled`; kaleidoscope rAF loop is the sole writer while enabled.

### Path library (`src/lib/state/path-library.ts`)

- `src/lib/state/path-library.svelte.spec.ts` — `saveEntry` id/name generation, mocks `rune-sync/localstorage`.
- `.create-arc.svelte.spec.ts`, `.grid-options.svelte.spec.ts`, `.seed.svelte.spec.ts`, `.update-path.svelte.spec.ts` — split-out behavior for arc creation, grid snapping options, seed data, and path updates.
- `src/lib/components/LibraryPickerSheet.svelte.spec.ts`, `PathThumbnail.svelte.spec.ts` — picker UI and thumbnail rendering.
- `src/routes/paths/page.svelte.spec.ts` + `src/routes/paths/path-manager.e2e.ts` — page-level and end-to-end coverage of the Tracciati (`/paths`) sibling route/shell.

### Wave / zones / aspect-ratio (`src/lib/geometry/`)

- `wave.spec.ts` — wave-state math for audio-bars-style ring deformation.
- `zones.spec.ts` — zone-drive math for audio-zones-style ring deformation.
- `aspect-ratio.spec.ts` — canvas/composition aspect-ratio computation.
- `src/lib/state/composition.aspect-ratio.spec.ts` — aspect ratio wired through composition state/actions.
- `compose.svelte.spec.ts`, `compose-ring.spec.ts`, `render-pipeline.svelte.spec.ts`, `path-morph.svelte.spec.ts`, `svg-import.svelte.spec.ts`, `path-codec.svelte.spec.ts`, `path-to-svg.spec.ts`, `path-transform.spec.ts`, `fit-to-view.spec.ts`, `grid-snap.spec.ts` — remaining geometry pipeline: ring composition, render pipeline interpolation/fallback, morph compatibility invariants, SVG import/export round-trips, grid snapping.

### Composition state (`src/lib/state/composition.ts`, `composition-persistence.svelte.ts`)

- `composition.svelte.spec.ts` (+ `.add-ring-with-path`, `.aspect-ratio` variants) — ring morph target lifecycle, path-compatibility enforcement, aspect ratio, mocks `rune-sync/localstorage`.
- `composition-persistence.svelte.spec.ts` — the `lsSync` persistence singleton itself.

### i18n / messages

- `src/lib/messages-parity.spec.ts` — asserts `messages/en.json` and `messages/it.json` define exactly the same key set (sorted key-array equality), independent of the generated `$lib/paraglide` output.
- `src/lib/components/LanguageSwitcher.svelte.spec.ts`, `src/lib/state/locale.svelte.spec.ts` — locale-switching UI and state.

### Routes / shell

- `src/routes/(app)/layout.svelte.spec.ts`, `.../animate/page.svelte.spec.ts`, `.../composition/page.svelte.spec.ts`, `.../editor/page.svelte.spec.ts` — the shared `(app)` shell and its three pages.
- `src/routes/about/page.svelte.spec.ts` + `about/about-nav.e2e.ts` — the `about` sibling route.
- `src/routes/(app)/workspace-nav.e2e.ts` — cross-tab navigation (`nav-editor`/`nav-composition`/`nav-animate`/`nav-paths` test ids), plus the `/` → `/paths` redirect.
- `src/routes/demo/playwright/page.svelte.e2e.ts` — scaffold Playwright demo page (from the SvelteKit/Playwright add-on template).

## Mocking

**Framework:** Vitest `vi.mock`, `vi.hoisted`, `vi.fn`, `vi.stubGlobal`, `vi.waitFor`, `vi.resetModules`.

**Patterns:**

```typescript
// Mock persistence (rune-sync/localstorage), keyed by localStorage key name
vi.mock('rune-sync/localstorage', () => ({
	lsSync: vi.fn((key: string) => {
		if (key === 'composition') return structuredClone(initialComposition);
		if (key === 'color-mode') return structuredClone(initialColorMode);
		if (key === 'composition-ui') return structuredClone({ expandedRings: {} });
		return {};
	}),
	localStorageSync: {
		read: vi.fn((key: string) => (key === 'composition' ? structuredClone(initialComposition) : null)),
		write: vi.fn(),
		subscribe: vi.fn(() => () => {})
	}
}));
```

```typescript
// Mock cross-module state boundaries (state/composition.ts) in animation-controller tests
vi.mock('./composition', () => ({
	composition: mockComposition,
	setRingMorphT: vi.fn(),
	removeRingFromComposition: vi.fn((index: number) => {
		mockComposition.rings = mockComposition.rings.filter((_, i) => i !== index);
	})
}));
```

```typescript
// Stub the rAF loop deterministically instead of mocking animejs's own timing
const requestAnimationFrameMock = vi.fn((cb: FrameRequestCallback) => {
	rafCallbacks.push(cb);
	return rafCallbacks.length;
});
vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);
```

**What to Mock:**

- Persistence (`rune-sync/localstorage`) for deterministic composition / path-library / kaleidoscope-param tests.
- Cross-module state boundaries (e.g. `./composition` from `state/animation.svelte.ts`) in controller-level tests.
- Timing primitives (`requestAnimationFrame`/`cancelAnimationFrame`) when a driver or the animate controller runs its own rAF loop.

**What NOT to Mock:**

- Paper.js internals in render-pipeline / kaleidoscope-tile tests; construct a real `paper.PaperScope` and assert on layer/path output.
- The `keyframes` singleton in `KeyframeGraphEditor.svelte.spec.ts` — tests drive the real state and reset it in `beforeEach` rather than mocking `$lib/state/keyframes.svelte`.

## Fixtures and Factories

**Test Data:**

```typescript
const initialComposition: Composition = {
	baseRadius: 100,
	ringIncrement: 50,
	aspectRatio: '1:1',
	rings: [],
	monochromePalettes: [{ primary: '#000000', secondary: '#ffffff', background: '#ffffff' }],
	fullPalettes: [{ colors: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'] }]
};
```

```typescript
function makeRing(waveConfig?: WaveConfig | null): Ring {
	return {
		id: 'test-ring',
		copies: 8,
		color: '#000000',
		templatePath: null,
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.4,
		waveConfig
	};
}
```

**Location:**

- Fixtures/factories are defined inline in each spec file (e.g. local `makeRing(...)`, `makeDriver(...)` helper functions); no shared fixture directory.

## Coverage

**Requirements:** No minimum coverage threshold is configured in `package.json`, `vite.config.ts`, or a dedicated coverage config.

**View Coverage:**

```bash
npm run test:unit -- --run --coverage
```

## Test Types

**Unit Tests:**

- Pure logic in Node (`src/lib/color/apply.spec.ts`, `src/lib/geometry/wave.spec.ts`, `src/lib/geometry/zones.spec.ts`, `src/lib/state/animation-drivers/*.spec.ts`, `src/lib/state/animation.svelte.spec.ts` via the explicit node inclusion).

**Integration Tests:**

- State and storage interactions (`src/lib/state/composition.svelte.spec.ts`, `src/lib/state/path-library.svelte.spec.ts`, `src/lib/state/composition-persistence.svelte.spec.ts`).
- Geometry + Paper render flow (`src/lib/geometry/render-pipeline.svelte.spec.ts`, `src/lib/geometry/kaleidoscope-tile.svelte.spec.ts`, `src/lib/geometry/compose.svelte.spec.ts`).
- Message-catalog parity across locales (`src/lib/messages-parity.spec.ts`).

**Component / Browser Tests:**

- UI behavior and wiring (`src/lib/components/KeyframeGraphEditor.svelte.spec.ts`, `src/lib/components/PreviewCanvas.svelte.spec.ts`, `src/lib/components/preview-presenter.svelte.spec.ts`, `src/lib/components/AudioBarsSection.svelte.spec.ts`, `src/lib/components/KaleidoscopePanel.svelte.spec.ts`, plus route-level `page.svelte.spec.ts` files under `src/routes/`).

**E2E Tests:**

- Playwright is configured in `playwright.config.ts` with `testMatch: '**/*.e2e.{ts,js}'` and a `webServer` that runs `npm run build && npm run preview` on port 4173.
- Real `*.e2e.ts` files: `src/routes/(app)/workspace-nav.e2e.ts` (tab navigation across Editor/Composition/Animate/Paths + root redirect), `src/routes/about/about-nav.e2e.ts`, `src/routes/paths/path-manager.e2e.ts`, `src/routes/demo/playwright/page.svelte.e2e.ts` (template scaffold demo).

## Common Patterns

**Async Testing:**

```typescript
await vi.waitFor(() => {
	expect(animationApi.handleCompositionChanged).toHaveBeenCalledOnce();
});
```

**Browser element assertions:**

```typescript
await expect.element(page.getByTestId('graph-empty')).toBeInTheDocument();
expect(page.getByTestId('graph-curve').query()).toBeNull();
```

**Error/edge-case Testing:**

```typescript
expect(() => animation.togglePlay()).not.toThrow();
expect(animation.animationState.isPlaying).toBe(true);
```

```typescript
expect(result.ok).toBe(false);
if (result.ok) throw new Error('expected failure');
expect(result.reason).toBe('Path commands must match exactly to interpolate');
```

---

*Testing analysis: 2026-07-06*
