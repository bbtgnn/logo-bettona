# Path Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an append-only library of path snapshots, persisted in localStorage, browsable at `/paths`, with Save and Load controls in the Ring Editor that capture/apply paths to/from any ring.

**Architecture:** New `pathLibrary` state module backed by `rune-sync` `lsSync` (same pattern as `composition`). Pure geometry helpers convert internal `Path` → SVG `d` and compute bounding boxes for thumbnails. A reusable `PathThumbnail` component renders previews, used by both the `/paths` grid page and the RingEditor Load picker. Library entries are immutable snapshots — Save deep-clones from ring, Apply deep-clones into ring.

**Tech Stack:** Svelte 5 (runes), SvelteKit, TypeScript, `rune-sync/localstorage`, shadcn/svelte (`Sheet`, `Button`, `Label`), Tailwind, vitest, Playwright.

**Spec reference:** `docs/superpowers/specs/2026-05-22-path-manager-design.md`

---

## File Structure

Create:

- `src/lib/state/path-library.ts` — `pathLibrary` lsSync store; `saveEntry`, `applyEntryToRing` mutators.
- `src/lib/state/path-library.svelte.spec.ts` — Unit tests for state mutators.
- `src/lib/geometry/path-to-svg.ts` — `pathToSvgD`, `pathBoundingBox` pure helpers.
- `src/lib/geometry/path-to-svg.spec.ts` — Unit tests for helpers.
- `src/lib/components/PathThumbnail.svelte` — Reusable SVG preview of a `Path` (+ optional secondary overlay).
- `src/lib/components/PathThumbnail.svelte.spec.ts` — Component tests.
- `src/lib/components/LibraryPickerSheet.svelte` — Sheet UI for picking a library entry + slot, used inside RingEditor.
- `src/routes/paths/+page.svelte` — Library page: header, grid of `PathThumbnail` cards, empty state.
- `src/routes/paths/path-manager.e2e.ts` — Playwright: save from RingEditor → list at `/paths` → load back into a ring.

Modify:

- `src/lib/types.ts` — Add `PathLibraryEntry`, `PathLibrary`.
- `src/lib/components/RingEditor.svelte` — Add "Salva in libreria" button (+ inline status) and "Carica da libreria" button mounting `LibraryPickerSheet`.
- `src/routes/+page.svelte` — Add a `Paths` link in the header next to the existing `About` link.

No other files change. Existing `composition` / `animationState` stores are untouched.

---

## Task 1: Add library types

**Files:**

- Modify: `src/lib/types.ts`

- [ ] **Step 1: Append the new types to `src/lib/types.ts`**

Append (after the existing `Composition` type):

```ts
export type PathLibraryEntry = {
	id: string;
	name: string;
	createdAt: number;
	path: Path;
	secondaryPath: Path | null;
};

export type PathLibrary = {
	entries: PathLibraryEntry[];
};
```

- [ ] **Step 2: Type-check passes**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add PathLibraryEntry and PathLibrary"
```

---

## Task 2: `pathToSvgD` helper (TDD)

**Files:**

- Create: `src/lib/geometry/path-to-svg.ts`
- Test: `src/lib/geometry/path-to-svg.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/geometry/path-to-svg.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pathToSvgD } from './path-to-svg';
import type { Path } from '$lib/types';

describe('pathToSvgD', () => {
	it('emits M and L segments', () => {
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 20] };
		expect(pathToSvgD(path)).toBe('M 0 0 L 10 20');
	});

	it('emits a cubic C segment', () => {
		const path: Path = { cmds: ['M', 'C'], crds: [0, 0, 1, 2, 3, 4, 5, 6] };
		expect(pathToSvgD(path)).toBe('M 0 0 C 1 2 3 4 5 6');
	});

	it('emits a quadratic Q segment', () => {
		const path: Path = { cmds: ['M', 'Q'], crds: [0, 0, 1, 2, 3, 4] };
		expect(pathToSvgD(path)).toBe('M 0 0 Q 1 2 3 4');
	});

	it('emits a Z close segment', () => {
		const path: Path = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 10] };
		expect(pathToSvgD(path)).toBe('M 0 0 L 10 10 Z');
	});

	it('throws when crds arity does not match cmds', () => {
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10] }; // L expects 2 coords
		expect(() => pathToSvgD(path)).toThrow();
	});
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test:unit -- --run src/lib/geometry/path-to-svg.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `pathToSvgD`**

Create `src/lib/geometry/path-to-svg.ts`:

```ts
import type { Path } from '$lib/types';

const ARITY: Record<Path['cmds'][number], number> = {
	M: 2,
	L: 2,
	Q: 4,
	C: 6,
	Z: 0
};

export function pathToSvgD(path: Path): string {
	const expected = path.cmds.reduce((sum, c) => sum + ARITY[c], 0);
	if (expected !== path.crds.length) {
		throw new Error(
			`Path arity mismatch: cmds expect ${expected} coords, got ${path.crds.length}`
		);
	}
	const out: string[] = [];
	let i = 0;
	for (const cmd of path.cmds) {
		const n = ARITY[cmd];
		const coords = path.crds.slice(i, i + n);
		i += n;
		out.push(n === 0 ? cmd : `${cmd} ${coords.join(' ')}`);
	}
	return out.join(' ');
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `bun run test:unit -- --run src/lib/geometry/path-to-svg.spec.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/path-to-svg.ts src/lib/geometry/path-to-svg.spec.ts
git commit -m "feat(geometry): add pathToSvgD helper"
```

---

## Task 3: `pathBoundingBox` helper (TDD)

**Files:**

- Modify: `src/lib/geometry/path-to-svg.ts`
- Modify: `src/lib/geometry/path-to-svg.spec.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/lib/geometry/path-to-svg.spec.ts`:

```ts
import { pathBoundingBox } from './path-to-svg';

describe('pathBoundingBox', () => {
	it('returns 0-sized box for a single move', () => {
		const path: Path = { cmds: ['M'], crds: [5, 7] };
		expect(pathBoundingBox(path)).toEqual({ x: 5, y: 7, w: 0, h: 0 });
	});

	it('scans coordinate pairs for min/max', () => {
		const path: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 10, -3, 4, 8] };
		expect(pathBoundingBox(path)).toEqual({ x: 0, y: -3, w: 10, h: 11 });
	});

	it('includes Bezier handle coordinates', () => {
		const path: Path = { cmds: ['M', 'C'], crds: [0, 0, 5, 100, -2, 50, 10, 10] };
		expect(pathBoundingBox(path)).toEqual({ x: -2, y: 0, w: 12, h: 100 });
	});

	it('throws when crds length is odd', () => {
		const path: Path = { cmds: ['M'], crds: [1, 2, 3] };
		expect(() => pathBoundingBox(path)).toThrow();
	});
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test:unit -- --run src/lib/geometry/path-to-svg.spec.ts`
Expected: `pathBoundingBox` describe block FAILs (import resolves to undefined).

- [ ] **Step 3: Implement `pathBoundingBox`**

Append to `src/lib/geometry/path-to-svg.ts`:

```ts
export function pathBoundingBox(path: Path): { x: number; y: number; w: number; h: number } {
	if (path.crds.length % 2 !== 0) {
		throw new Error(`Path crds length must be even, got ${path.crds.length}`);
	}
	if (path.crds.length === 0) {
		return { x: 0, y: 0, w: 0, h: 0 };
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < path.crds.length; i += 2) {
		const x = path.crds[i];
		const y = path.crds[i + 1];
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `bun run test:unit -- --run src/lib/geometry/path-to-svg.spec.ts`
Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/path-to-svg.ts src/lib/geometry/path-to-svg.spec.ts
git commit -m "feat(geometry): add pathBoundingBox helper"
```

---

## Task 4: `path-library` state module — `saveEntry` (TDD)

**Files:**

- Create: `src/lib/state/path-library.ts`
- Test: `src/lib/state/path-library.svelte.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/state/path-library.svelte.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Path, PathLibrary } from '$lib/types';

const initialLibrary: PathLibrary = { entries: [] };

vi.mock('rune-sync/localstorage', () => ({
	lsSync: vi.fn((key: string) => {
		if (key === 'path-library') return structuredClone(initialLibrary);
		return {};
	})
}));

describe('saveEntry', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('appends a new entry with a unique id and auto name', async () => {
		const mod = await import('./path-library');
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };

		const a = mod.saveEntry(path, null);
		const b = mod.saveEntry(path, null);

		expect(mod.pathLibrary.entries).toHaveLength(2);
		expect(a.id).not.toBe(b.id);
		expect(a.name).toBe('Path 1');
		expect(b.name).toBe('Path 2');
		expect(a.secondaryPath).toBeNull();
	});

	it('deep-clones the stored path (mutating source does not change entry)', async () => {
		const mod = await import('./path-library');
		const path: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };
		const secondary: Path = { cmds: ['M', 'L'], crds: [1, 1, 5, 5] };

		const entry = mod.saveEntry(path, secondary);
		path.crds[0] = 999;
		secondary.crds[0] = 999;

		expect(entry.path.crds[0]).toBe(0);
		expect(entry.secondaryPath?.crds[0]).toBe(1);
	});
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test:unit -- --run src/lib/state/path-library.svelte.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement minimal `path-library` module**

Create `src/lib/state/path-library.ts`:

```ts
import { lsSync } from 'rune-sync/localstorage';
import type { Path, PathLibrary, PathLibraryEntry } from '$lib/types';

export const pathLibrary = lsSync<PathLibrary>('path-library', { entries: [] });

function clonePath(p: Path): Path {
	return { cmds: [...p.cmds], crds: [...p.crds] };
}

export function saveEntry(path: Path, secondaryPath: Path | null): PathLibraryEntry {
	const entry: PathLibraryEntry = {
		id: crypto.randomUUID(),
		name: `Path ${pathLibrary.entries.length + 1}`,
		createdAt: Date.now(),
		path: clonePath(path),
		secondaryPath: secondaryPath ? clonePath(secondaryPath) : null
	};
	pathLibrary.entries = [...pathLibrary.entries, entry];
	return entry;
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `bun run test:unit -- --run src/lib/state/path-library.svelte.spec.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/path-library.ts src/lib/state/path-library.svelte.spec.ts
git commit -m "feat(state): add path-library store with saveEntry"
```

---

## Task 5: `applyEntryToRing` helper (TDD)

**Files:**

- Modify: `src/lib/state/path-library.ts`
- Modify: `src/lib/state/path-library.svelte.spec.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/state/path-library.svelte.spec.ts`:

```ts
import type { Ring } from '$lib/types';

function makeRing(): Ring {
	return {
		copies: 1,
		color: '#000',
		templatePath: { cmds: ['M', 'L'], crds: [0, 0, 1, 1] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.1
	};
}

describe('applyEntryToRing', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('slot "template" overwrites templatePath only (deep clone)', async () => {
		const mod = await import('./path-library');
		const entry = mod.saveEntry(
			{ cmds: ['M', 'L'], crds: [5, 5, 6, 6] },
			{ cmds: ['M', 'L'], crds: [7, 7, 8, 8] }
		);
		const ring = makeRing();

		mod.applyEntryToRing(ring, entry, 'template');

		expect(ring.templatePath).toEqual({ cmds: ['M', 'L'], crds: [5, 5, 6, 6] });
		expect(ring.templatePath).not.toBe(entry.path);
		expect(ring.secondaryTemplatePath).toBeNull();
	});

	it('slot "secondary" writes entry.path (not entry.secondaryPath) into secondary slot', async () => {
		const mod = await import('./path-library');
		const entry = mod.saveEntry(
			{ cmds: ['M', 'L'], crds: [5, 5, 6, 6] },
			{ cmds: ['M', 'L'], crds: [7, 7, 8, 8] }
		);
		const ring = makeRing();

		mod.applyEntryToRing(ring, entry, 'secondary');

		expect(ring.secondaryTemplatePath).toEqual({ cmds: ['M', 'L'], crds: [5, 5, 6, 6] });
		expect(ring.secondaryTemplatePath).not.toBe(entry.path);
		expect(ring.templatePath).toEqual({ cmds: ['M', 'L'], crds: [0, 0, 1, 1] });
	});

	it('slot "both" writes path → template and secondaryPath → secondary', async () => {
		const mod = await import('./path-library');
		const entry = mod.saveEntry(
			{ cmds: ['M', 'L'], crds: [5, 5, 6, 6] },
			{ cmds: ['M', 'L'], crds: [7, 7, 8, 8] }
		);
		const ring = makeRing();

		mod.applyEntryToRing(ring, entry, 'both');

		expect(ring.templatePath).toEqual({ cmds: ['M', 'L'], crds: [5, 5, 6, 6] });
		expect(ring.secondaryTemplatePath).toEqual({ cmds: ['M', 'L'], crds: [7, 7, 8, 8] });
	});
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test:unit -- --run src/lib/state/path-library.svelte.spec.ts`
Expected: 3 new FAILs — `applyEntryToRing is not a function`.

- [ ] **Step 3: Implement `applyEntryToRing`**

Append to `src/lib/state/path-library.ts`:

```ts
import type { Ring } from '$lib/types';

export type ApplySlot = 'template' | 'secondary' | 'both';

export function applyEntryToRing(ring: Ring, entry: PathLibraryEntry, slot: ApplySlot): void {
	if (slot === 'template' || slot === 'both') {
		ring.templatePath = clonePath(entry.path);
	}
	if (slot === 'secondary') {
		ring.secondaryTemplatePath = clonePath(entry.path);
	}
	if (slot === 'both') {
		ring.secondaryTemplatePath = entry.secondaryPath ? clonePath(entry.secondaryPath) : null;
	}
}
```

(Note: `slot === 'both'` with a null `secondaryPath` is a caller misuse — the UI guard in Task 10 prevents it. If it happens, secondary becomes `null`, matching the entry.)

- [ ] **Step 4: Run tests, verify all pass**

Run: `bun run test:unit -- --run src/lib/state/path-library.svelte.spec.ts`
Expected: 5 passed total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/path-library.ts src/lib/state/path-library.svelte.spec.ts
git commit -m "feat(state): add applyEntryToRing helper"
```

---

## Task 6: `PathThumbnail` component (TDD)

**Files:**

- Create: `src/lib/components/PathThumbnail.svelte`
- Test: `src/lib/components/PathThumbnail.svelte.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/PathThumbnail.svelte.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PathThumbnail from './PathThumbnail.svelte';
import type { Path } from '$lib/types';

const primary: Path = { cmds: ['M', 'L'], crds: [0, 0, 10, 10] };
const secondary: Path = { cmds: ['M', 'L'], crds: [2, 2, 8, 8] };

describe('PathThumbnail', () => {
	it('renders an svg with the expected d attribute', async () => {
		const { container } = render(PathThumbnail, { path: primary });
		const paths = container.querySelectorAll('svg path');
		expect(paths.length).toBe(1);
		expect(paths[0].getAttribute('d')).toBe('M 0 0 L 10 10');
	});

	it('renders a secondary overlay path when secondaryPath is provided', async () => {
		const { container } = render(PathThumbnail, { path: primary, secondaryPath: secondary });
		const paths = container.querySelectorAll('svg path');
		expect(paths.length).toBe(2);
		expect(paths[1].getAttribute('d')).toBe('M 2 2 L 8 8');
	});

	it('renders placeholder when path helpers throw', async () => {
		const bad: Path = { cmds: ['M', 'L'], crds: [0, 0, 1] }; // bad arity
		const { container } = render(PathThumbnail, { path: bad });
		expect(container.querySelector('svg path')).toBeNull();
		expect(container.textContent).toContain('?');
	});
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test:unit -- --run src/lib/components/PathThumbnail.svelte.spec.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `PathThumbnail.svelte`**

Create `src/lib/components/PathThumbnail.svelte`:

```svelte
<script lang="ts">
	import type { Path } from '$lib/types';
	import { pathToSvgD, pathBoundingBox } from '$lib/geometry/path-to-svg';

	let {
		path,
		secondaryPath = null,
		size = 96
	}: { path: Path; secondaryPath?: Path | null; size?: number } = $props();

	type Rendered = { viewBox: string; d: string; secondaryD: string | null };

	const rendered = $derived.by<Rendered | null>(() => {
		try {
			const bbox = pathBoundingBox(path);
			const pad = Math.max(bbox.w, bbox.h, 1) * 0.1;
			const viewBox = `${bbox.x - pad} ${bbox.y - pad} ${bbox.w + pad * 2} ${bbox.h + pad * 2}`;
			const d = pathToSvgD(path);
			const secondaryD = secondaryPath ? pathToSvgD(secondaryPath) : null;
			return { viewBox, d, secondaryD };
		} catch {
			return null;
		}
	});
</script>

{#if rendered}
	<svg
		width={size}
		height={size}
		viewBox={rendered.viewBox}
		class="text-foreground"
		aria-hidden="true"
	>
		<path d={rendered.d} fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" />
		{#if rendered.secondaryD}
			<path
				d={rendered.secondaryD}
				fill="none"
				stroke="currentColor"
				stroke-opacity="0.4"
				stroke-width="2"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	</svg>
{:else}
	<div
		style:width="{size}px"
		style:height="{size}px"
		class="flex items-center justify-center border border-dashed text-muted-foreground text-sm"
	>
		?
	</div>
{/if}
```

- [ ] **Step 4: Run autofixer for Svelte best practices**

Use the `svelte-autofixer` MCP tool on the component contents until it reports no issues.

- [ ] **Step 5: Run tests, verify all pass**

Run: `bun run test:unit -- --run src/lib/components/PathThumbnail.svelte.spec.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/PathThumbnail.svelte src/lib/components/PathThumbnail.svelte.spec.ts
git commit -m "feat(components): add PathThumbnail with secondary overlay + placeholder"
```

---

## Task 7: `/paths` route page

**Files:**

- Create: `src/routes/paths/+page.svelte`

- [ ] **Step 1: Implement the page**

Create `src/routes/paths/+page.svelte`:

```svelte
<script lang="ts">
	import { pathLibrary } from '$lib/state/path-library';
	import PathThumbnail from '$lib/components/PathThumbnail.svelte';
</script>

<svelte:head><title>Path Library — logo-bettona</title></svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
	<header class="border-b">
		<div class="mx-auto flex max-w-[1100px] items-center px-6 py-3">
			<a
				href="/"
				class="text-sm text-muted-foreground hover:text-foreground"
				data-testid="paths-back-link"
			>
				← Back
			</a>
			<span class="ml-4 text-sm font-semibold">Path Library</span>
			<span class="ml-2 text-xs text-muted-foreground">
				({pathLibrary.entries.length})
			</span>
		</div>
	</header>

	<main class="mx-auto max-w-[1100px] px-6 py-8">
		{#if pathLibrary.entries.length === 0}
			<p
				class="text-sm text-muted-foreground"
				data-testid="paths-empty-state"
			>
				Nessun path salvato. Salva dal Ring Editor.
			</p>
		{:else}
			<ul
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
				data-testid="paths-grid"
			>
				{#each pathLibrary.entries as entry (entry.id)}
					<li class="flex flex-col items-center gap-2 rounded border p-3">
						<PathThumbnail
							path={entry.path}
							secondaryPath={entry.secondaryPath}
							size={120}
						/>
						<div class="flex w-full items-center justify-between text-xs">
							<span class="font-medium">{entry.name}</span>
							{#if entry.secondaryPath}
								<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
									secondary
								</span>
							{/if}
						</div>
						<span class="self-start text-[10px] text-muted-foreground">
							{new Date(entry.createdAt).toLocaleDateString()}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
```

- [ ] **Step 2: Run autofixer**

Use the `svelte-autofixer` MCP tool on the page contents until it reports no issues.

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`
Open: http://localhost:5173/paths
Expected: header with "Path Library (0)", `← Back` link, empty-state message. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/routes/paths/+page.svelte
git commit -m "feat(paths): add /paths route with empty state and grid"
```

---

## Task 8: Add `Paths` link to main header

**Files:**

- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Insert a Paths link next to the About link**

In `src/routes/+page.svelte`, find this block in the `<header>`:

```svelte
<a
	href="/about"
	class="ml-auto text-sm text-muted-foreground hover:text-foreground"
	data-testid="header-about-link"
>
	About
</a>
```

Replace with:

```svelte
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
```

- [ ] **Step 2: Manual smoke test**

Run: `bun run dev`
Open: http://localhost:5173/
Expected: header shows both `Paths` and `About` links right-aligned; clicking `Paths` navigates to `/paths`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(nav): add Paths link to main header"
```

---

## Task 9: "Salva in libreria" button in RingEditor

**Files:**

- Modify: `src/lib/components/RingEditor.svelte`

- [ ] **Step 1: Wire the save handler and status state**

In `src/lib/components/RingEditor.svelte`:

1. Add an import after the existing `svg-import` import (around line 20):

```ts
import { saveEntry } from '$lib/state/path-library';
```

2. Add new reactive state next to the existing `$state` declarations (around line 41):

```ts
let saveStatus = $state<string | null>(null);
let saveStatusTimer: ReturnType<typeof setTimeout> | null = null;

function showSaveStatus(msg: string) {
	saveStatus = msg;
	if (saveStatusTimer) clearTimeout(saveStatusTimer);
	saveStatusTimer = setTimeout(() => {
		saveStatus = null;
	}, 2000);
}

function handleSaveToLibrary() {
	if (!ring.templatePath) return;
	try {
		const entry = saveEntry(ring.templatePath, ring.secondaryTemplatePath);
		showSaveStatus(`Salvato come '${entry.name}'`);
	} catch {
		showSaveStatus('Libreria piena');
	}
}
```

3. In the markup, immediately above the existing `<div class="flex flex-col gap-1">` block that holds `Import SVG` (around line 189), insert:

```svelte
<div class="flex items-center gap-2">
	<Button
		variant="outline"
		size="sm"
		onclick={handleSaveToLibrary}
		disabled={!ring.templatePath}
		data-testid="ring-save-to-library-{index}"
	>
		Salva in libreria
	</Button>
	{#if saveStatus}
		<span class="text-xs text-muted-foreground" data-testid="ring-save-status-{index}">
			{saveStatus}
		</span>
	{/if}
</div>
```

- [ ] **Step 2: Run autofixer**

Use the `svelte-autofixer` MCP tool on the updated component until it reports no issues.

- [ ] **Step 3: Type-check passes**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`
Open: http://localhost:5173/
- Expand a ring in the sidebar. Click `Salva in libreria`.
- Expect status text `Salvato come 'Path 1'` for ~2s.
- Navigate to `/paths`. Expect one thumbnail visible.
Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/RingEditor.svelte
git commit -m "feat(ring-editor): add 'Salva in libreria' button with inline status"
```

---

## Task 10: "Carica da libreria" sheet picker

**Files:**

- Create: `src/lib/components/LibraryPickerSheet.svelte`
- Modify: `src/lib/components/RingEditor.svelte`

- [ ] **Step 1: Implement the picker sheet**

Create `src/lib/components/LibraryPickerSheet.svelte`:

```svelte
<script lang="ts">
	import * as Sheet from '$lib/shadcn/ui/sheet/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import PathThumbnail from './PathThumbnail.svelte';
	import { pathLibrary } from '$lib/state/path-library';
	import type { PathLibraryEntry } from '$lib/types';
	import type { ApplySlot } from '$lib/state/path-library';

	let {
		open = $bindable(false),
		onapply
	}: {
		open?: boolean;
		onapply: (entry: PathLibraryEntry, slot: ApplySlot) => void;
	} = $props();

	let selected = $state<PathLibraryEntry | null>(null);
	let slot = $state<ApplySlot>('template');

	$effect(() => {
		if (!open) {
			selected = null;
			slot = 'template';
		}
	});

	$effect(() => {
		if (selected && slot === 'both' && !selected.secondaryPath) {
			slot = 'template';
		}
	});

	function confirm() {
		if (!selected) return;
		onapply(selected, slot);
		open = false;
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-[420px] sm:w-[480px]">
		<Sheet.Header>
			<Sheet.Title>Carica da libreria</Sheet.Title>
			<Sheet.Description>
				Scegli un path salvato e lo slot da sovrascrivere.
			</Sheet.Description>
		</Sheet.Header>

		<div class="mt-4 space-y-4">
			{#if pathLibrary.entries.length === 0}
				<p class="text-sm text-muted-foreground" data-testid="library-picker-empty">
					Libreria vuota. Salva prima dal Ring Editor.
				</p>
			{:else if !selected}
				<ul
					class="grid grid-cols-2 gap-3 sm:grid-cols-3"
					data-testid="library-picker-grid"
				>
					{#each pathLibrary.entries as entry (entry.id)}
						<li>
							<button
								type="button"
								class="flex w-full flex-col items-center gap-1 rounded border p-2 hover:bg-muted"
								onclick={() => (selected = entry)}
								data-testid="library-picker-entry-{entry.id}"
							>
								<PathThumbnail
									path={entry.path}
									secondaryPath={entry.secondaryPath}
									size={80}
								/>
								<span class="text-xs">{entry.name}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="space-y-3">
					<div class="flex items-center gap-3 rounded border p-2">
						<PathThumbnail
							path={selected.path}
							secondaryPath={selected.secondaryPath}
							size={64}
						/>
						<div class="text-sm font-medium">{selected.name}</div>
					</div>

					<fieldset class="space-y-2">
						<legend class="text-xs font-medium">Slot</legend>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="apply-slot"
								value="template"
								checked={slot === 'template'}
								onchange={() => (slot = 'template')}
							/>
							Template
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="apply-slot"
								value="secondary"
								checked={slot === 'secondary'}
								onchange={() => (slot = 'secondary')}
							/>
							Secondary
						</label>
						<label class="flex items-center gap-2 text-sm" class:opacity-50={!selected.secondaryPath}>
							<input
								type="radio"
								name="apply-slot"
								value="both"
								disabled={!selected.secondaryPath}
								checked={slot === 'both'}
								onchange={() => (slot = 'both')}
							/>
							Entrambi
						</label>
					</fieldset>

					<div class="flex justify-end gap-2">
						<Button variant="outline" size="sm" onclick={() => (selected = null)}>
							Indietro
						</Button>
						<Button
							size="sm"
							onclick={confirm}
							data-testid="library-picker-confirm"
						>
							Applica
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
```

- [ ] **Step 2: Run autofixer on the sheet**

Use the `svelte-autofixer` MCP tool until it reports no issues.

- [ ] **Step 3: Wire the picker into RingEditor**

In `src/lib/components/RingEditor.svelte`:

1. Add imports near the other component imports (top of `<script>`):

```ts
import LibraryPickerSheet from './LibraryPickerSheet.svelte';
import type { PathLibraryEntry } from '$lib/types';
import type { ApplySlot } from '$lib/state/path-library';
```

Also extend the existing import from `$lib/state/composition` to include `createRingMorphTarget` and `removeRingMorphTarget` if not already present (both already imported in the current file — confirm and reuse).

2. Add reactive state next to `saveStatus`:

```ts
let libraryOpen = $state(false);
let libraryApplyError = $state<string | null>(null);

function clonePath(p: { cmds: string[]; crds: number[] }) {
	return { cmds: [...p.cmds], crds: [...p.crds] } as NonNullable<Ring['templatePath']>;
}

function handleApplyFromLibrary(entry: PathLibraryEntry, slot: ApplySlot) {
	libraryApplyError = null;

	// 'template' or 'both' → primary first (secondary check depends on new primary).
	if (slot === 'template' || slot === 'both') {
		const r1 = updateRingPathVariant(index, 'primary', clonePath(entry.path));
		if (!r1.ok) {
			libraryApplyError = r1.reason;
			return;
		}
	}

	if (slot === 'secondary') {
		const r2 = updateRingPathVariant(index, 'secondary', clonePath(entry.path));
		if (!r2.ok) libraryApplyError = r2.reason;
		return;
	}

	if (slot === 'both') {
		if (entry.secondaryPath) {
			const r3 = updateRingPathVariant(index, 'secondary', clonePath(entry.secondaryPath));
			if (!r3.ok) libraryApplyError = r3.reason;
		} else if (ring.secondaryTemplatePath) {
			// Entry has no secondary; clear ring's secondary to match entry.
			removeRingMorphTarget(index);
		}
	}
}
```

Note: `applyEntryToRing` exists as a pure helper for tests but is intentionally not used here — we want the validation that `updateRingPathVariant` provides (path compatibility between primary and secondary).

3. Replace the save button container from Task 9 with this version (adds the Load button + sheet):

```svelte
<div class="flex flex-wrap items-center gap-2">
	<Button
		variant="outline"
		size="sm"
		onclick={handleSaveToLibrary}
		disabled={!ring.templatePath}
		data-testid="ring-save-to-library-{index}"
	>
		Salva in libreria
	</Button>
	<Button
		variant="outline"
		size="sm"
		onclick={() => (libraryOpen = true)}
		data-testid="ring-load-from-library-{index}"
	>
		Carica da libreria
	</Button>
	{#if saveStatus}
		<span class="text-xs text-muted-foreground" data-testid="ring-save-status-{index}">
			{saveStatus}
		</span>
	{/if}
</div>

{#if libraryApplyError}
	<p class="text-xs text-destructive" data-testid="ring-library-apply-error-{index}">
		{libraryApplyError}
	</p>
{/if}

<LibraryPickerSheet bind:open={libraryOpen} onapply={handleApplyFromLibrary} />
```

- [ ] **Step 4: Type-check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `bun run dev`
Open: http://localhost:5173/
- Save one ring's path to the library (re-test Task 9 flow).
- On another ring, click `Carica da libreria`. Sheet opens, grid shows the saved entry.
- Click the entry. Slot picker appears with three options (`Entrambi` disabled if no secondary).
- Pick `Template`, click `Applica`. Sheet closes; the ring's primary path matches the saved entry.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LibraryPickerSheet.svelte src/lib/components/RingEditor.svelte
git commit -m "feat(ring-editor): add library picker sheet with slot selection"
```

---

## Task 11: End-to-end Playwright flow

**Files:**

- Create: `src/routes/paths/path-manager.e2e.ts`

- [ ] **Step 1: Write the e2e spec**

Create `src/routes/paths/path-manager.e2e.ts`:

```ts
import { test, expect } from '@playwright/test';

test('save a ring path then load it back via the library', async ({ page, context }) => {
	await context.clearCookies();
	await page.goto('/');

	// Open the sidebar (if not already), expand the first ring.
	// The exact selectors depend on the existing app; this assumes the first
	// Ring collapsible is accessible by its trigger text.
	await page.getByRole('button', { name: /Ring 1/ }).click();

	// Save current path to library.
	await page.getByTestId('ring-save-to-library-0').click();
	await expect(page.getByTestId('ring-save-status-0')).toContainText(/Salvato come 'Path 1'/);

	// Navigate to /paths and verify one entry.
	await page.getByTestId('header-paths-link').click();
	await expect(page).toHaveURL(/\/paths$/);
	await expect(page.getByTestId('paths-grid').locator('li')).toHaveCount(1);

	// Go back to editor and load the entry into the same ring.
	await page.getByTestId('paths-back-link').click();
	await page.getByRole('button', { name: /Ring 1/ }).click();
	await page.getByTestId('ring-load-from-library-0').click();
	// Click the first entry button in the picker.
	await page.locator('[data-testid^="library-picker-entry-"]').first().click();
	await page.getByTestId('library-picker-confirm').click();

	// Sheet should close; no error toast / status.
	await expect(page.getByText('Carica da libreria')).toBeHidden();
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `bun run test:e2e -- path-manager`
Expected: the new test passes. If selectors for `Ring 1` differ in the live UI, adjust the locator to match the actual element (use `data-testid` on the existing trigger if needed — add it in a follow-up if missing).

- [ ] **Step 3: Commit**

```bash
git add src/routes/paths/path-manager.e2e.ts
git commit -m "test(paths): e2e flow for save + load via library"
```

---

## Task 12: Full suite green + final cleanup

- [ ] **Step 1: Run unit tests**

Run: `bun run test:unit -- --run`
Expected: full suite passes (no regressions in existing tests).

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: clean.

- [ ] **Step 3: Run type-check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 4: Run e2e**

Run: `bun run test:e2e`
Expected: full suite passes.

- [ ] **Step 5: If anything fails, fix and re-run the affected command. Commit each fix with a focused message.**
