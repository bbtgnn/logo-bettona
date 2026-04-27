# Animation No-Secondary-Path Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a compact yellow warning in the Animation panel whenever no rings have `secondaryTemplatePath`, and disable the Play button in that same state.

**Architecture:** Keep the change localized to `AnimationSection` UI logic by deriving morph-capable ring availability directly from `composition.rings`. Preserve existing animation controller safety behavior (no-op when there are no morph-capable rings) as a backend guard, while adding explicit UX affordances in the panel.

**Tech Stack:** Svelte 5, TypeScript, Tailwind utility classes, Vitest browser tests

---

## File Structure and Responsibilities

- Modify: `src/lib/components/AnimationSection.svelte` - derive `hasMorphRings`, render warning banner, disable play button.
- Modify: `src/lib/components/AnimationSection.svelte.spec.ts` - verify warning visibility and play disabled state when no secondary paths exist.
- Test: `src/lib/components/AnimationSection.svelte.spec.ts` - focused regression coverage for animation panel UX.

### Task 1: Add failing UI behavior tests first

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte.spec.ts`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Add failing tests for warning and disabled Play**

```ts
it('shows warning and disables Play when no rings have secondary paths', async () => {
	compositionApi.composition.rings = [
		{ secondaryTemplatePath: null, morphT: 0 },
		{ secondaryTemplatePath: null, morphT: 0.2 }
	];

	render(AnimationSection);

	await expect
		.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
		.toBeInTheDocument();
	await expect.element(page.getByRole('button', { name: 'Play' })).toBeDisabled();
});

it('hides warning and enables Play when at least one ring has a secondary path', async () => {
	compositionApi.composition.rings = [
		{ secondaryTemplatePath: { cmds: ['M'], crds: [0, 0] }, morphT: 0 },
		{ secondaryTemplatePath: null, morphT: 0.2 }
	];

	render(AnimationSection);

	await expect
		.element(page.getByText('Animation won’t run until at least one ring has a secondary path.'))
		.not.toBeInTheDocument();
	await expect.element(page.getByRole('button', { name: 'Play' })).toBeEnabled();
});
```

- [ ] **Step 2: Run focused test to verify failure**

Run: `bun run test:unit --run src/lib/components/AnimationSection.svelte.spec.ts`  
Expected: FAIL because warning text and disabled state are not implemented yet.

- [ ] **Step 3: Commit failing test changes**

```bash
git add src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "test: define animation warning and disabled-play behavior"
```

### Task 2: Implement warning banner and Play button disable behavior

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Derive morph-capable ring availability in the component**

```ts
const hasMorphRings = $derived(
	composition.rings.some((ring) => ring.secondaryTemplatePath !== null)
);
```

- [ ] **Step 2: Render compact yellow warning when no morph-capable rings exist**

```svelte
{#if !hasMorphRings}
	<p class="rounded border border-yellow-300 bg-yellow-100 px-2 py-1 text-[11px] text-yellow-900">
		Animation won’t run until at least one ring has a secondary path.
	</p>
{/if}
```

- [ ] **Step 3: Disable Play button when warning condition is active**

```svelte
<Button
	onclick={togglePlay}
	aria-pressed={animationState.isPlaying}
	disabled={!hasMorphRings}
>
	{animationState.isPlaying ? 'Pause' : 'Play'}
</Button>
```

- [ ] **Step 4: Re-run focused test and verify pass**

Run: `bun run test:unit --run src/lib/components/AnimationSection.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit implementation**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: warn and disable animation play without secondary paths"
```

### Task 3: Final verification gate

**Files:**
- Test: `src/lib/components/AnimationSection.svelte.spec.ts`

- [ ] **Step 1: Run related suite for regressions**

Run: `bun run test:unit --run src/lib/components/AnimationSection.svelte.spec.ts src/lib/components/Sidebar.svelte.spec.ts`  
Expected: PASS

- [ ] **Step 2: Run lint/check for edited files**

Run: `bun run check && bun run lint`  
Expected: PASS

- [ ] **Step 3: Commit verification checkpoint**

```bash
git add -A
git commit -m "chore: verify animation warning UX changes"
```

## Self-Review

- **Spec coverage:** Covers both approved requirements: always-visible warning under the condition and disabled Play in the same state.
- **Placeholder scan:** No TODO/TBD placeholders or vague implementation instructions remain.
- **Type consistency:** Uses existing naming (`composition`, `secondaryTemplatePath`, `togglePlay`, `animationState`) to avoid API drift.
