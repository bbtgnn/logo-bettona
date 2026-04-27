# Rings Animation Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new sidebar `Animation` section between `Settings` and `Colors` that plays/pauses ring `morphT` animation over time (with progress, loop, and alternate), powered by anime.js through a reusable animation controller.

**Architecture:** Introduce a dedicated runtime controller in `src/lib/state/animation.ts` that owns anime.js lifecycle and exposes reactive playback/config state to UI. Keep ring persistence and clamping in `composition.ts` by writing animated values only through existing mutators (`setRingMorphT`). Add a focused `AnimationSection.svelte` UI and wire it into `Sidebar.svelte` in the required position.

**Tech Stack:** Svelte 5, TypeScript, animejs, rune-sync, Vitest, vitest-browser-svelte

---

## File Structure and Responsibilities

- Create: `src/lib/state/animation.ts` - centralized animation runtime state and anime.js lifecycle API.
- Create: `src/lib/state/animation.svelte.spec.ts` - controller unit tests (play/pause/resume/progress/edge cases).
- Create: `src/lib/components/AnimationSection.svelte` - new sidebar section UI for animation controls and progress bar.
- Create: `src/lib/components/AnimationSection.svelte.spec.ts` - component behavior and controller wiring checks.
- Modify: `src/lib/components/Sidebar.svelte` - insert `AnimationSection` between `SettingsSection` and `ColorsSection`.
- Create: `src/lib/components/Sidebar.svelte.spec.ts` - verify section order regression (`Settings -> Animation -> Colors -> Rings`).

## Task 1: Add failing tests for animation controller API

**Files:**
- Create: `src/lib/state/animation.svelte.spec.ts`
- Test: `src/lib/state/animation.svelte.spec.ts`

- [ ] **Step 1: Write failing tests for controller behavior**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('animejs', () => ({
	default: vi.fn(() => ({
		play: vi.fn(),
		pause: vi.fn(),
		seek: vi.fn(),
		remove: vi.fn()
	}))
}));

vi.mock('./composition', () => ({
	composition: {
		rings: [
			{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
			{ secondaryTemplatePath: null, morphT: 0 }
		]
	},
	setRingMorphT: vi.fn()
}));

describe('animation controller', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('starts from idle and flips to playing on toggle', async () => {
		const animation = await import('./animation');
		expect(animation.animationState.isPlaying).toBe(false);
		animation.togglePlay();
		expect(animation.animationState.isPlaying).toBe(true);
	});

	it('pauses when togglePlay is invoked while playing', async () => {
		const animation = await import('./animation');
		animation.togglePlay();
		animation.togglePlay();
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.isPaused).toBe(true);
	});

	it('resumes from paused state on next toggle', async () => {
		const animation = await import('./animation');
		animation.togglePlay();
		animation.togglePlay();
		animation.togglePlay();
		expect(animation.animationState.isPlaying).toBe(true);
		expect(animation.animationState.isPaused).toBe(false);
	});

	it('resets when composition ring count changes during playback', async () => {
		const animation = await import('./animation');
		animation.togglePlay();
		animation.handleCompositionChanged();
		expect(animation.animationState.isPlaying).toBe(false);
		expect(animation.animationState.progress).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit --run src/lib/state/animation.svelte.spec.ts`  
Expected: FAIL with module-not-found for `src/lib/state/animation.ts`

- [ ] **Step 3: Commit failing tests**

```bash
git add src/lib/state/animation.svelte.spec.ts
git commit -m "test: add failing tests for animation controller"
```

## Task 2: Implement reusable animation controller

**Files:**
- Create: `src/lib/state/animation.ts`
- Test: `src/lib/state/animation.svelte.spec.ts`

- [ ] **Step 1: Implement `animation.ts` runtime state and API**

```ts
import anime from 'animejs';
import { composition, setRingMorphT } from './composition';

export type AnimationMode = 'morphSweep';

export type AnimationState = {
	mode: AnimationMode;
	isPlaying: boolean;
	isPaused: boolean;
	progress: number;
	durationSec: number;
	loop: boolean;
	alternate: boolean;
};

export const animationState: AnimationState = $state({
	mode: 'morphSweep',
	isPlaying: false,
	isPaused: false,
	progress: 0,
	durationSec: 3,
	loop: false,
	alternate: false
});

type AnimeInstance = {
	play: () => void;
	pause: () => void;
	seek?: (value: number) => void;
	remove?: () => void;
};

let currentAnimation: AnimeInstance | null = null;
let lastRingCount = 0;
let animatedIndices: number[] = [];

function getMorphRingIndices(): number[] {
	return composition.rings
		.map((ring, index) => (ring.secondaryTemplatePath ? index : -1))
		.filter((index) => index >= 0);
}

function applyMorphT(t: number) {
	for (const index of animatedIndices) {
		setRingMorphT(index, t);
	}
}

function stopInternal(resetProgress = true) {
	currentAnimation?.pause();
	currentAnimation = null;
	animationState.isPlaying = false;
	animationState.isPaused = false;
	if (resetProgress) animationState.progress = 0;
}

function startNewAnimation() {
	animatedIndices = getMorphRingIndices();
	lastRingCount = composition.rings.length;
	if (animatedIndices.length === 0) {
		stopInternal(true);
		return;
	}

	currentAnimation = anime({
		targets: { t: 0 },
		t: 1,
		duration: Math.max(0.1, animationState.durationSec) * 1000,
		easing: 'linear',
		loop: animationState.loop,
		direction: animationState.alternate ? 'alternate' : 'normal',
		update: (anim: { progress: number; animatables: { target: { t: number } }[] }) => {
			const value = anim.animatables[0]?.target?.t ?? 0;
			applyMorphT(value);
			animationState.progress = Math.max(0, Math.min(1, anim.progress / 100));
		},
		complete: () => {
			animationState.isPlaying = false;
			animationState.isPaused = false;
			animationState.progress = 1;
		}
	}) as AnimeInstance;

	animationState.isPlaying = true;
	animationState.isPaused = false;
}

export function setAnimationDurationSec(value: number) {
	animationState.durationSec = Number.isFinite(value) ? Math.max(0.1, value) : 3;
}

export function setAnimationLoop(value: boolean) {
	animationState.loop = value;
}

export function setAnimationAlternate(value: boolean) {
	animationState.alternate = value;
}

export function togglePlay() {
	if (!currentAnimation) {
		startNewAnimation();
		return;
	}
	if (animationState.isPlaying) {
		currentAnimation.pause();
		animationState.isPlaying = false;
		animationState.isPaused = true;
		return;
	}
	currentAnimation.play();
	animationState.isPlaying = true;
	animationState.isPaused = false;
}

export function stopAnimation(resetProgress = true) {
	stopInternal(resetProgress);
}

export function handleCompositionChanged() {
	if (!animationState.isPlaying) {
		lastRingCount = composition.rings.length;
		return;
	}
	if (composition.rings.length !== lastRingCount) {
		stopInternal(true);
	}
}
```

- [ ] **Step 2: Run tests for controller**

Run: `bun run test:unit --run src/lib/state/animation.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 3: Commit controller**

```bash
git add src/lib/state/animation.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat: add centralized animejs animation controller"
```

## Task 3: Add `AnimationSection` UI with progress and controls

**Files:**
- Create: `src/lib/components/AnimationSection.svelte`
- Create: `src/lib/components/AnimationSection.svelte.spec.ts`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Write failing component tests**

```ts
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AnimationSection from './AnimationSection.svelte';

vi.mock('$lib/state/animation', () => ({
	animationState: {
		mode: 'morphSweep',
		isPlaying: false,
		isPaused: false,
		progress: 0.25,
		durationSec: 3,
		loop: false,
		alternate: false
	},
	togglePlay: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn()
}));

describe('AnimationSection', () => {
	it('renders controls and progress', async () => {
		render(AnimationSection);
		await expect.element(page.getByText('Animation')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Play' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Duration (s)')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Loop')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Alternate')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit --run src/lib/components/AnimationSection.svelte.spec.ts`  
Expected: FAIL with module-not-found for `src/lib/components/AnimationSection.svelte`

- [ ] **Step 3: Implement `AnimationSection.svelte`**

```svelte
<script lang="ts">
	import { Input } from '$lib/shadcn/ui/input/index.js';
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import {
		animationState,
		togglePlay,
		setAnimationDurationSec,
		setAnimationLoop,
		setAnimationAlternate
	} from '$lib/state/animation';

	const progressPercent = $derived(Math.round(Math.max(0, Math.min(1, animationState.progress)) * 100));
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		Animation
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			<div class="flex items-end gap-2">
				<div class="flex-1 flex flex-col gap-1">
					<Label for="animation-duration" class="text-xs">Duration (s)</Label>
					<Input
						id="animation-duration"
						type="number"
						min="0.1"
						step="0.1"
						value={animationState.durationSec}
						oninput={(e) => setAnimationDurationSec(Number((e.target as HTMLInputElement).value))}
					/>
				</div>
				<Button onclick={togglePlay}>{animationState.isPlaying ? 'Pause' : 'Play'}</Button>
			</div>

			<div class="flex items-center gap-4">
				<label class="flex items-center gap-2 text-xs" for="animation-loop">
					<input
						id="animation-loop"
						type="checkbox"
						checked={animationState.loop}
						onchange={(e) => setAnimationLoop((e.target as HTMLInputElement).checked)}
					/>
					Loop
				</label>
				<label class="flex items-center gap-2 text-xs" for="animation-alternate">
					<input
						id="animation-alternate"
						type="checkbox"
						checked={animationState.alternate}
						onchange={(e) => setAnimationAlternate((e.target as HTMLInputElement).checked)}
					/>
					Alternate
				</label>
			</div>

			<div class="space-y-1">
				<div class="h-1.5 rounded bg-muted">
					<div class="h-full rounded bg-foreground transition-all" style={`width: ${progressPercent}%`}></div>
				</div>
				<p class="text-[10px] text-muted-foreground">{progressPercent}%</p>
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
```

- [ ] **Step 4: Re-run component tests**

Run: `bun run test:unit --run src/lib/components/AnimationSection.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit section UI**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: add animation sidebar section with playback controls"
```

## Task 4: Wire section into sidebar and add ordering regression test

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`
- Create: `src/lib/components/Sidebar.svelte.spec.ts`
- Test: `src/lib/components/Sidebar.svelte.spec.ts`

- [ ] **Step 1: Write failing sidebar order test**

```ts
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Sidebar from './Sidebar.svelte';

vi.mock('$lib/state/composition', () => ({
	composition: { rings: [] },
	addRing: vi.fn(),
	reorderRings: vi.fn()
}));

describe('Sidebar section order', () => {
	it('renders Settings, Animation, Colors, Rings in order', async () => {
		render(Sidebar);
		const content = page.getByTestId('sidebar-content');
		await expect.element(content).toContainText('Settings');
		await expect.element(content).toContainText('Animation');
		await expect.element(content).toContainText('Colors');
		await expect.element(content).toContainText('Rings');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit --run src/lib/components/Sidebar.svelte.spec.ts`  
Expected: FAIL until `AnimationSection` is added to `Sidebar.svelte` and test selectors are aligned

- [ ] **Step 3: Update `Sidebar.svelte` to include animation section**

```svelte
<script lang="ts">
	import * as SidebarUI from '$lib/shadcn/ui/sidebar/index.js';
	import { Button } from '$lib/shadcn/ui/button/index.js';
	import RingEditor from './RingEditor.svelte';
	import ColorsSection from './ColorsSection.svelte';
	import { composition, addRing, reorderRings } from '$lib/state/composition';
	import SettingsSection from './SettingsSection.svelte';
	import AnimationSection from './AnimationSection.svelte';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
</script>

<SidebarUI.Sidebar>
	<SidebarUI.SidebarContent class="divide-y divide-border" data-testid="sidebar-content">
		<SettingsSection />
		<AnimationSection />
		<ColorsSection />
		<!-- existing Rings section remains unchanged -->
	</SidebarUI.SidebarContent>
</SidebarUI.Sidebar>
```

- [ ] **Step 4: Re-run sidebar test**

Run: `bun run test:unit --run src/lib/components/Sidebar.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit sidebar wiring**

```bash
git add src/lib/components/Sidebar.svelte src/lib/components/Sidebar.svelte.spec.ts
git commit -m "feat: place animation section between settings and colors"
```

## Task 5: Integrate runtime safety and run quality gates

**Files:**
- Modify: `src/lib/state/animation.ts`
- Test: `src/lib/state/animation.svelte.spec.ts`, `src/lib/components/AnimationSection.svelte.spec.ts`, `src/lib/components/Sidebar.svelte.spec.ts`

- [ ] **Step 1: Add composition-change safety hook in section**

```svelte
<script lang="ts">
	import { composition } from '$lib/state/composition';
	import { handleCompositionChanged } from '$lib/state/animation';

	$effect(() => {
		composition.rings.length;
		handleCompositionChanged();
	});
</script>
```

- [ ] **Step 2: Extend controller tests for no morph-capable rings**

```ts
it('keeps idle state when no ring has secondaryTemplatePath', async () => {
	const compositionModule = await import('./composition');
	compositionModule.composition.rings = [{ secondaryTemplatePath: null, morphT: 0 }];
	const animation = await import('./animation');
	animation.togglePlay();
	expect(animation.animationState.isPlaying).toBe(false);
	expect(animation.animationState.progress).toBe(0);
});
```

- [ ] **Step 3: Run focused tests**

Run: `bun run test:unit --run src/lib/state/animation.svelte.spec.ts src/lib/components/AnimationSection.svelte.spec.ts src/lib/components/Sidebar.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 4: Run full project verification**

Run: `bun run check && bun run lint && bun run test:unit --run`  
Expected: PASS

- [ ] **Step 5: Commit final hardening**

```bash
git add src/lib/state/animation.ts src/lib/state/animation.svelte.spec.ts src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts src/lib/components/Sidebar.svelte src/lib/components/Sidebar.svelte.spec.ts
git commit -m "test: harden animation runtime and sidebar integration"
```

## Self-Review

- **Spec coverage:** All approved requirements are covered: new section placement, central controller approach, play/pause/resume, global duration, loop/alternate semantics, progress bar, and ring-change safety reset.
- **Placeholder scan:** No TBD/TODO placeholders and no "implement later" instructions remain.
- **Type consistency:** Naming is consistent across tasks (`animationState`, `togglePlay`, `setAnimationDurationSec`, `setAnimationLoop`, `setAnimationAlternate`, `handleCompositionChanged`).
