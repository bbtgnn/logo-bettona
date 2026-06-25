# Sidebar Shells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared shells for the animate sidebar's per-ring config items and audio layer sections, removing real duplication with zero behavior change.

**Architecture:** Three new presentational components — `RingConfigShell` (collapsible frame, used by all three ring items), `RingOverrideConfigItem` (shell + override checkbox + data-driven sliders, used by the Wave/Zone twins), and `AudioLayerSection` (the shared audio-section skeleton). The five existing components are rewritten thin on top of them. Pure refactor; existing specs are the regression net.

**Tech Stack:** SvelteKit, Svelte 5 runes, shadcn/svelte (Collapsible, Label), Tailwind, paraglide i18n, vitest-browser-svelte, bun.

## Global Constraints

- Package manager: **bun**. Types gate: `bun run check` → **0 errors, 0 warnings** (recompiles paraglide).
- Tab indentation. Commit trailer EXACTLY `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **DO NOT PUSH.** If near a session limit, commit and report BLOCKED.
- Do NOT run `prettier --write .` or `bun run lint` (pre-existing red, not a gate).
- Every `.svelte`/`.svelte.ts` written or modified MUST pass the Svelte MCP `svelte-autofixer` (load via ToolSearch `select:mcp__svelte__svelte-autofixer`) → `issues: []`. Ignore the known false-positive *suggestions* (rAF/function-call inside `$effect`).
- DOM/PointerEvent tests MUST be named `*.svelte.spec.ts` (browser/chromium project); plain `*.spec.ts` runs in node. `expect.requireAssertions: true` — every `it` must assert.
- Component specs run in a REAL browser with Tailwind inert → assert DOM/testid/role/text, NOT geometry.
- No new i18n keys — every label reuses an existing `m.*` message.
- Single unit run: `bun run test:unit -- run <path>`. Full: `bun run test:unit -- run`. e2e: `bunx playwright test`.
- **Invariants that MUST NOT change:** testids `ring-morph-config-{i}`, `ring-zone-config-{i}`, `layer-toggle-audioBars`, `layer-toggle-audioZones`; the element ids `wave-override-{i}`, `zone-override-{i}`, `ring-crests/amplitude/phase-speed-{i}`, `ring-bass/mid/treble-{i}`, `audio-source*`; slider ranges/steps/values; the exact `updateRing(...)` payloads; the override null/default toggle; the meter `role="meter"` + aria attrs.

---

### Task 1: RingConfigShell

**Files:**
- Create: `src/lib/components/RingConfigShell.svelte`
- Test: `src/lib/components/RingConfigShell.svelte.spec.ts`

**Interfaces:**
- Produces: `RingConfigShell` with props `{ index: number; badge?: boolean; testid?: string; content: Snippet }`. Renders the bordered collapsible frame with a caret + `Ring {index+1}` trigger, an optional `(custom)` badge, and the `content` snippet inside the collapsible body. `open` defaults to `false`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/RingConfigShell.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import RingConfigShell from './RingConfigShell.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

const body = createRawSnippet(() => ({ render: () => `<p>body marker</p>` }));

describe('RingConfigShell', () => {
	beforeEach(() => switchLocale('en'));

	it('shows the ring label and reveals content only after opening', async () => {
		render(RingConfigShell, { index: 0, content: body });
		await expect.element(page.getByText('Ring 1')).toBeInTheDocument();
		expect(page.getByText('body marker').query()).toBeNull();
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await expect.element(page.getByText('body marker')).toBeInTheDocument();
	});

	it('renders the custom badge only when badge is true', async () => {
		render(RingConfigShell, { index: 1, badge: true, content: body });
		await expect.element(page.getByText('(custom)')).toBeInTheDocument();
	});

	it('applies the testid to the wrapper when provided', async () => {
		render(RingConfigShell, { index: 2, testid: 'ring-x-config-2', content: body });
		expect(page.getByTestId('ring-x-config-2').query()).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/RingConfigShell.svelte.spec.ts`
Expected: FAIL (cannot resolve `./RingConfigShell.svelte`).

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/RingConfigShell.svelte -->
<script lang="ts">
	import * as Collapsible from '$lib/shadcn/ui/collapsible/index.js';
	import { CaretDown, CaretRight } from 'phosphor-svelte';
	import { m } from '$lib/paraglide/messages';
	import type { Snippet } from 'svelte';

	let {
		index,
		badge = false,
		testid,
		content
	}: {
		index: number;
		badge?: boolean;
		testid?: string;
		content: Snippet;
	} = $props();

	let open = $state(false);
</script>

<div class="rounded border bg-background" data-testid={testid}>
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
				{m.editor_ring_label({ index: index + 1 })}
				{#if badge}
					<span
						class="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground"
						>{m.animate_custom()}</span
					>
				{/if}
			</Collapsible.CollapsibleTrigger>
		</div>

		<Collapsible.CollapsibleContent class="space-y-3 px-3 pb-3">
			{@render content()}
		</Collapsible.CollapsibleContent>
	</Collapsible.Collapsible>
</div>
```

- [ ] **Step 4: Run the Svelte autofixer**

Load via ToolSearch `select:mcp__svelte__svelte-autofixer`, run it on `RingConfigShell.svelte`, fix until `issues: []` (ignore known false-positive suggestions).

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/RingConfigShell.svelte.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Types gate**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/RingConfigShell.svelte src/lib/components/RingConfigShell.svelte.spec.ts
git commit -m "$(cat <<'EOF'
feat(sidebar): add RingConfigShell collapsible frame

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: RingOverrideConfigItem

**Files:**
- Create: `src/lib/components/RingOverrideConfigItem.svelte`
- Test: `src/lib/components/RingOverrideConfigItem.svelte.spec.ts`

**Interfaces:**
- Consumes: `RingConfigShell` (Task 1).
- Produces: `RingOverrideConfigItem` with props
  `{ index: number; hasOverride: boolean; onToggle: (enabled: boolean) => void; overrideId: string; customizeLabel: string; sliders: SliderSpec[]; testid?: string; preview: Snippet }`
  where `SliderSpec = { id: string; label: string; min: number; max: number; step: number; value: number; oninput: (value: number) => void }`.
  Renders inside the shell: the `preview` snippet, an override checkbox (id `overrideId`) wired to `hasOverride`/`onToggle`, and — when `hasOverride` — the `sliders` as labelled native range inputs. The shell `badge` equals `hasOverride`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/RingOverrideConfigItem.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import RingOverrideConfigItem from './RingOverrideConfigItem.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

const preview = createRawSnippet(() => ({ render: () => `<p>preview marker</p>` }));

function open() {
	return userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
}

describe('RingOverrideConfigItem', () => {
	beforeEach(() => switchLocale('en'));

	it('toggling the checkbox calls onToggle with the checked state', async () => {
		let toggled: boolean | null = null;
		render(RingOverrideConfigItem, {
			index: 0,
			hasOverride: false,
			onToggle: (v: boolean) => (toggled = v),
			overrideId: 'x-override-0',
			customizeLabel: 'Customize',
			sliders: [],
			preview
		});
		await open();
		await userEvent.click(page.getByRole('checkbox'));
		expect(toggled).toBe(true);
	});

	it('hides sliders when hasOverride is false', async () => {
		render(RingOverrideConfigItem, {
			index: 0,
			hasOverride: false,
			onToggle: () => {},
			overrideId: 'x-override-0',
			customizeLabel: 'Customize',
			sliders: [{ id: 's1', label: 'Slider one', min: 0, max: 1, step: 0.1, value: 0.5, oninput: () => {} }],
			preview
		});
		await open();
		expect(page.getByLabelText('Slider one').query()).toBeNull();
	});

	it('shows sliders when hasOverride is true and reports numeric input', async () => {
		let got: number | null = null;
		render(RingOverrideConfigItem, {
			index: 0,
			hasOverride: true,
			onToggle: () => {},
			overrideId: 'x-override-0',
			customizeLabel: 'Customize',
			sliders: [{ id: 's1', label: 'Slider one', min: 0, max: 10, step: 1, value: 3, oninput: (v: number) => (got = v) }],
			preview
		});
		await open();
		const input = page.getByLabelText('Slider one');
		await expect.element(input).toBeInTheDocument();
		await userEvent.fill(input, '7');
		expect(got).toBe(7);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/RingOverrideConfigItem.svelte.spec.ts`
Expected: FAIL (cannot resolve `./RingOverrideConfigItem.svelte`).

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/RingOverrideConfigItem.svelte -->
<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import type { Snippet } from 'svelte';
	import RingConfigShell from './RingConfigShell.svelte';

	type SliderSpec = {
		id: string;
		label: string;
		min: number;
		max: number;
		step: number;
		value: number;
		oninput: (value: number) => void;
	};

	let {
		index,
		hasOverride,
		onToggle,
		overrideId,
		customizeLabel,
		sliders,
		testid,
		preview
	}: {
		index: number;
		hasOverride: boolean;
		onToggle: (enabled: boolean) => void;
		overrideId: string;
		customizeLabel: string;
		sliders: SliderSpec[];
		testid?: string;
		preview: Snippet;
	} = $props();
</script>

<RingConfigShell {index} {testid} badge={hasOverride}>
	{#snippet content()}
		{@render preview()}

		<div class="flex items-center gap-2">
			<input
				id={overrideId}
				type="checkbox"
				checked={hasOverride}
				onchange={(e) => onToggle((e.target as HTMLInputElement).checked)}
				class="h-4 w-4 cursor-pointer rounded border-input"
			/>
			<Label for={overrideId} class="cursor-pointer text-xs">{customizeLabel}</Label>
		</div>

		{#if hasOverride}
			{#each sliders as slider (slider.id)}
				<div class="flex flex-col gap-1">
					<Label for={slider.id} class="text-xs">{slider.label}</Label>
					<input
						id={slider.id}
						type="range"
						min={slider.min}
						max={slider.max}
						step={slider.step}
						value={slider.value}
						oninput={(e) => slider.oninput(Number((e.target as HTMLInputElement).value))}
					/>
				</div>
			{/each}
		{/if}
	{/snippet}
</RingConfigShell>
```

- [ ] **Step 4: Run the Svelte autofixer**

Run `svelte-autofixer` on `RingOverrideConfigItem.svelte` until `issues: []`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/RingOverrideConfigItem.svelte.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Types gate**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/RingOverrideConfigItem.svelte src/lib/components/RingOverrideConfigItem.svelte.spec.ts
git commit -m "$(cat <<'EOF'
feat(sidebar): add RingOverrideConfigItem (shell + override checkbox + sliders)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rewrite RingWaveConfigItem + RingZoneConfigItem on the override item

**Files:**
- Modify: `src/lib/components/RingWaveConfigItem.svelte` (full rewrite of markup/body)
- Modify: `src/lib/components/RingZoneConfigItem.svelte` (full rewrite of markup/body)
- Test: `src/lib/components/RingZoneConfigItem.svelte.spec.ts` (new — direct override-wiring coverage)

**Interfaces:**
- Consumes: `RingOverrideConfigItem` (Task 2), `updateRing` from `$lib/state/composition`, `resolveWaveConfig`/`resolveZoneIntensity`. Props unchanged: Wave `{ ring; index; globalDefault: WaveConfig }`, Zone `{ ring; index; globalDefault: ZoneIntensity }`.
- Produces: visually/behaviorally identical Wave and Zone config items. Preserves ids `wave-override-{i}`/`zone-override-{i}`, `ring-crests/amplitude/phase-speed-{i}`, `ring-bass/mid/treble-{i}`, and testid `ring-zone-config-{i}` (Wave keeps none).

- [ ] **Step 1: Write the failing test (zone override wiring)**

```ts
// src/lib/components/RingZoneConfigItem.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RingZoneConfigItem from './RingZoneConfigItem.svelte';
import { composition } from '$lib/state/composition';
import { switchLocale } from '$lib/state/locale.svelte';
import type { Ring } from '$lib/types';

const PATH = { cmds: ['M', 'L', 'Z'] as ('M' | 'L' | 'Z')[], crds: [0, 0, 10, 0] };
const DEFAULT = { bass: 0.5, mid: 0.5, treble: 0.5 };

function ring(withOverride: boolean): Ring {
	return {
		id: 'test-ring',
		copies: 4,
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.25,
		zoneConfig: withOverride ? { ...DEFAULT } : null
	};
}

describe('RingZoneConfigItem', () => {
	beforeEach(() => {
		switchLocale('en');
		composition.rings = [ring(false)];
	});

	it('enabling the override writes a zoneConfig from the default', async () => {
		render(RingZoneConfigItem, { ring: composition.rings[0], index: 0, globalDefault: DEFAULT });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await userEvent.click(page.getByLabelText('Customize zones for this ring'));
		expect(composition.rings[0].zoneConfig).not.toBeNull();
	});

	it('with an override, dragging the Bass slider updates zoneConfig.bass', async () => {
		composition.rings = [ring(true)];
		render(RingZoneConfigItem, { ring: composition.rings[0], index: 0, globalDefault: DEFAULT });
		await userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
		await userEvent.fill(page.getByLabelText('Bass intensity'), '0.8');
		expect(composition.rings[0].zoneConfig!.bass).toBeCloseTo(0.8);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/RingZoneConfigItem.svelte.spec.ts`
Expected: FAIL — the Bass slider has no `aria-label`/label association yet wired through the new item (label query finds nothing) or the override toggle label query fails against the old `for`-association. (If it happens to pass against the old markup, proceed — the rewrite must keep it green.)

- [ ] **Step 3: Rewrite RingWaveConfigItem**

```svelte
<!-- src/lib/components/RingWaveConfigItem.svelte -->
<script lang="ts">
	import { updateRing } from '$lib/state/composition';
	import { resolveWaveConfig } from '$lib/geometry/wave';
	import { m } from '$lib/paraglide/messages';
	import WavePreview from './WavePreview.svelte';
	import RingOverrideConfigItem from './RingOverrideConfigItem.svelte';
	import type { Ring, WaveConfig } from '$lib/types';

	let {
		ring,
		index,
		globalDefault
	}: {
		ring: Ring;
		index: number;
		globalDefault: WaveConfig;
	} = $props();

	const hasOverride = $derived(ring.waveConfig != null);
	const resolved = $derived(resolveWaveConfig(ring, globalDefault));

	function setOverride(enabled: boolean) {
		updateRing(index, { waveConfig: enabled ? { ...globalDefault } : null });
	}

	const sliders = $derived(
		hasOverride
			? [
					{
						id: `ring-crests-${index}`,
						label: m.animate_wave_crests(),
						min: 1,
						max: 8,
						step: 1,
						value: ring.waveConfig!.crests,
						oninput: (v: number) =>
							updateRing(index, { waveConfig: { ...ring.waveConfig!, crests: v } })
					},
					{
						id: `ring-amplitude-${index}`,
						label: m.animate_amplitude_gain(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.waveConfig!.amplitudeGain,
						oninput: (v: number) =>
							updateRing(index, { waveConfig: { ...ring.waveConfig!, amplitudeGain: v } })
					},
					{
						id: `ring-phase-speed-${index}`,
						label: m.animate_phase_speed(),
						min: 0,
						max: 6,
						step: 0.1,
						value: ring.waveConfig!.phaseSpeed,
						oninput: (v: number) =>
							updateRing(index, { waveConfig: { ...ring.waveConfig!, phaseSpeed: v } })
					}
				]
			: []
	);
</script>

<RingOverrideConfigItem
	{index}
	{hasOverride}
	onToggle={setOverride}
	overrideId="wave-override-{index}"
	customizeLabel={m.animate_customize_wave()}
	{sliders}
>
	{#snippet preview()}
		<WavePreview
			template={ring.templatePath ?? null}
			copies={ring.copies ?? 1}
			ringHeight={ring.ringHeight ?? 0.4}
			crests={resolved.crests}
			amplitude={resolved.amplitudeGain}
			phaseSpeed={resolved.phaseSpeed}
		/>
	{/snippet}
</RingOverrideConfigItem>
```

- [ ] **Step 4: Rewrite RingZoneConfigItem**

```svelte
<!-- src/lib/components/RingZoneConfigItem.svelte -->
<script lang="ts">
	import { updateRing } from '$lib/state/composition';
	import { resolveZoneIntensity } from '$lib/geometry/zones';
	import { m } from '$lib/paraglide/messages';
	import ZonePreview from './ZonePreview.svelte';
	import RingOverrideConfigItem from './RingOverrideConfigItem.svelte';
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

	const hasOverride = $derived(ring.zoneConfig != null);
	const resolved = $derived(resolveZoneIntensity(ring, globalDefault));

	function setOverride(enabled: boolean) {
		updateRing(index, { zoneConfig: enabled ? { ...globalDefault } : null });
	}

	const sliders = $derived(
		hasOverride
			? [
					{
						id: `ring-bass-${index}`,
						label: m.animate_ring_zone_bass(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.zoneConfig!.bass,
						oninput: (v: number) =>
							updateRing(index, { zoneConfig: { ...ring.zoneConfig!, bass: v } })
					},
					{
						id: `ring-mid-${index}`,
						label: m.animate_ring_zone_mid(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.zoneConfig!.mid,
						oninput: (v: number) =>
							updateRing(index, { zoneConfig: { ...ring.zoneConfig!, mid: v } })
					},
					{
						id: `ring-treble-${index}`,
						label: m.animate_ring_zone_treble(),
						min: 0,
						max: 1,
						step: 0.01,
						value: ring.zoneConfig!.treble,
						oninput: (v: number) =>
							updateRing(index, { zoneConfig: { ...ring.zoneConfig!, treble: v } })
					}
				]
			: []
	);
</script>

<RingOverrideConfigItem
	{index}
	{hasOverride}
	onToggle={setOverride}
	overrideId="zone-override-{index}"
	customizeLabel={m.animate_customize_zones()}
	testid="ring-zone-config-{index}"
	{sliders}
>
	{#snippet preview()}
		<ZonePreview
			template={ring.templatePath ?? null}
			copies={ring.copies ?? 1}
			ringHeight={ring.ringHeight ?? 0.4}
			intensity={resolved}
		/>
	{/snippet}
</RingOverrideConfigItem>
```

- [ ] **Step 5: Run the Svelte autofixer**

Run `svelte-autofixer` on both rewritten components until `issues: []`.

- [ ] **Step 6: Run the new + regression tests**

Run: `bun run test:unit -- run src/lib/components/RingZoneConfigItem.svelte.spec.ts src/lib/components/AudioZonesSection.svelte.spec.ts src/lib/components/AudioBarsSection.svelte.spec.ts`
Expected: PASS (new zone spec + both audio-section specs, which still find `ring-zone-config-0` and arm bars params).

- [ ] **Step 7: Types gate**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/RingWaveConfigItem.svelte src/lib/components/RingZoneConfigItem.svelte src/lib/components/RingZoneConfigItem.svelte.spec.ts
git commit -m "$(cat <<'EOF'
refactor(sidebar): Wave/Zone config items use RingOverrideConfigItem

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Rewrite RingMorphConfigItem on the shell

**Files:**
- Modify: `src/lib/components/RingMorphConfigItem.svelte` (replace the hand-rolled collapsible frame with `RingConfigShell`)

**Interfaces:**
- Consumes: `RingConfigShell` (Task 1). Props unchanged: `{ ring: Ring; index: number }`.
- Produces: behaviorally identical morph item, testid `ring-morph-config-{index}`, no badge. The local `open` state and the `Collapsible.*` imports/markup are removed; all morph logic (library, import, canvas, morphT slider) moves verbatim into the shell's `content` snippet.

- [ ] **Step 1: Confirm the regression net runs green first**

Run: `bun run test:unit -- run src/lib/components/RingMorphConfigItem.svelte.spec.ts src/lib/components/SimpleSection.svelte.spec.ts`
Expected: PASS (baseline before the rewrite).

- [ ] **Step 2: Rewrite the component**

Keep the entire `<script>` EXCEPT: remove `import * as Collapsible`, remove `import { CaretDown, CaretRight }`, remove `let open = $state(false);`. Add `import RingConfigShell from './RingConfigShell.svelte';`. Replace the whole template (the outer `<div data-testid=...>` … `</div>`) with:

```svelte
<RingConfigShell {index} testid="ring-morph-config-{index}">
	{#snippet content()}
		<div class="flex flex-col gap-1">
			<span class="text-xs text-muted-foreground">{m.animate_morph_primary_label()}</span>
			<RingMorphPreview
				path={ring.templatePath}
				copies={ring.copies}
				baseRadius={composition.baseRadius}
				ringIncrement={composition.ringIncrement}
				size={160}
			/>
		</div>

		{#if !ring.secondaryTemplatePath}
			<Button
				variant="outline"
				size="sm"
				onclick={() => {
					ringPathError = null;
					createRingMorph(index);
				}}
			>
				{m.editor_create_morph()}
			</Button>
		{:else}
			<RingMorphPreview
				path={ring.templatePath}
				secondaryPath={ring.secondaryTemplatePath}
				morphT={ring.morphT ?? 0}
				copies={ring.copies}
				baseRadius={composition.baseRadius}
				ringIncrement={composition.ringIncrement}
				size={200}
				showTry
			/>

			<RingCanvas
				templatePath={ring.secondaryTemplatePath}
				onchange={applyPathFromEditor}
				label={m.editor_path_editor_secondary()}
			/>

			{#if ringPathError}
				<p class="text-xs text-destructive">{ringPathError}</p>
			{/if}

			<div class="flex flex-col gap-1">
				<span class="text-xs text-muted-foreground">
					{m.editor_ring_label({ index: index + 1 })} ({(ring.morphT ?? 0).toFixed(2)})
				</span>
				<Slider
					type="single"
					min={0}
					max={1}
					step={0.01}
					value={ring.morphT ?? 0}
					onValueChange={(v) => setRingMorphT(index, v)}
				/>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Button variant="outline" size="sm" onclick={() => (libraryOpen = true)}>
					{m.editor_load_from_library()}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						ringPathError = null;
						removeRingMorph(index);
					}}
				>
					{m.editor_remove_morph()}
				</Button>
			</div>

			{#if libraryApplyError}
				<p class="text-xs text-destructive">{libraryApplyError}</p>
			{/if}

			<LibraryPickerSheet
				bind:open={libraryOpen}
				slots={['secondary', 'both']}
				onapply={handleApplyFromLibrary}
			/>

			<div class="flex flex-col gap-1">
				<Label for="morph-svg-upload-{index}" class="text-xs">{m.editor_import_svg()}</Label>
				<input
					id="morph-svg-upload-{index}"
					type="file"
					accept=".svg,image/svg+xml"
					onchange={handleFileChange}
					class="cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
				/>
				{#if importError}
					<p class="text-xs text-destructive">{importError}</p>
				{/if}
			</div>
		{/if}
	{/snippet}
</RingConfigShell>
```

- [ ] **Step 3: Run the Svelte autofixer**

Run `svelte-autofixer` on `RingMorphConfigItem.svelte` until `issues: []`.

- [ ] **Step 4: Run regression tests**

Run: `bun run test:unit -- run src/lib/components/RingMorphConfigItem.svelte.spec.ts src/lib/components/SimpleSection.svelte.spec.ts`
Expected: PASS (all morph specs; the `Ring 1` trigger, Create/Remove buttons, previews, and testid all still resolve).

- [ ] **Step 5: Types gate**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/RingMorphConfigItem.svelte
git commit -m "$(cat <<'EOF'
refactor(sidebar): RingMorphConfigItem uses RingConfigShell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: AudioLayerSection

**Files:**
- Create: `src/lib/components/AudioLayerSection.svelte`
- Test: `src/lib/components/AudioLayerSection.svelte.spec.ts`

**Interfaces:**
- Consumes: `SidebarCollapsible`, `AudioFilePanel`, `AnimatableSlider`, and `animationState`/`setLayerEnabled`/`setAudioSource`/`audioSource` from `$lib/state/animation`.
- Produces: `AudioLayerSection` with props
  `{ layerKey: 'audioBars' | 'audioZones'; title: string; params: AnimatableParam[]; inputHint: string; paramsLabel?: string; perRing: Snippet }`.
  Owns the layer-toggle checkbox (testid `layer-toggle-{layerKey}`), the audio-source `<select>` (id `audio-source-{layerKey}`), the input-level meter `$effect` + meter markup (gated on `animationState.layers[layerKey] && audioSource === 'mic'`), the mic hint, the `file` → `AudioFilePanel` branch, the `params` `AnimatableSlider` list (wrapped under `paramsLabel` when provided), then the `perRing` snippet.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/AudioLayerSection.svelte.spec.ts
import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import AudioLayerSection from './AudioLayerSection.svelte';
import { animationState, setLayerEnabled } from '$lib/state/animation';
import { keyframes } from '$lib/state/keyframes.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

const perRing = createRawSnippet(() => ({ render: () => `<p>per-ring marker</p>` }));

describe('AudioLayerSection', () => {
	beforeEach(() => {
		switchLocale('en');
		setLayerEnabled('audioBars', false);
	});
	afterEach(() => {
		for (const id of Object.keys(keyframes.tracks)) keyframes.setTrackEnabled(id, false);
	});

	it('the layer toggle flips the layer state', async () => {
		render(AudioLayerSection, {
			layerKey: 'audioBars',
			title: 'Audio Bars',
			params: [],
			inputHint: 'hint',
			perRing
		});
		await userEvent.click(page.getByTestId('layer-toggle-audioBars'));
		expect(animationState.layers.audioBars).toBe(true);
	});

	it('renders the audio-source select and the per-ring snippet', async () => {
		render(AudioLayerSection, {
			layerKey: 'audioBars',
			title: 'Audio Bars',
			params: [],
			inputHint: 'hint',
			perRing
		});
		expect(page.getByLabelText('Audio source').query()).not.toBeNull();
		await expect.element(page.getByText('per-ring marker')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- run src/lib/components/AudioLayerSection.svelte.spec.ts`
Expected: FAIL (cannot resolve `./AudioLayerSection.svelte`).

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/AudioLayerSection.svelte -->
<script lang="ts">
	import { Label } from '$lib/shadcn/ui/label/index.js';
	import {
		animationState,
		setLayerEnabled,
		setAudioSource,
		audioSource
	} from '$lib/state/animation';
	import { m } from '$lib/paraglide/messages';
	import SidebarCollapsible from './SidebarCollapsible.svelte';
	import AudioFilePanel from './AudioFilePanel.svelte';
	import AnimatableSlider from './AnimatableSlider.svelte';
	import type { AnimatableParam } from '$lib/state/animatable-params';
	import type { Snippet } from 'svelte';

	let {
		layerKey,
		title,
		params,
		inputHint,
		paramsLabel,
		perRing
	}: {
		layerKey: 'audioBars' | 'audioZones';
		title: string;
		params: AnimatableParam[];
		inputHint: string;
		paramsLabel?: string;
		perRing: Snippet;
	} = $props();

	const sourceId = $derived(`audio-source-${layerKey}`);

	const showInputLevel = $derived(
		animationState.layers[layerKey] && animationState.audioSource === 'mic'
	);

	// Live input meter: polls the analyser's raw peak each frame while a real source
	// is selected. Reads even when paused — it answers "is the source heard?".
	let inputLevel = $state(0);
	$effect(() => {
		if (!showInputLevel) {
			inputLevel = 0;
			return;
		}
		let raf = requestAnimationFrame(function loop() {
			inputLevel = audioSource.readLevel();
			raf = requestAnimationFrame(loop);
		});
		return () => cancelAnimationFrame(raf);
	});
	const inputLevelPercent = $derived(Math.round(Math.max(0, Math.min(1, inputLevel)) * 100));
</script>

<SidebarCollapsible>
	{#snippet trigger()}
		{title}
	{/snippet}

	{#snippet content()}
		<div class="space-y-3">
			<label class="flex items-center gap-2 text-xs font-medium">
				<input
					type="checkbox"
					data-testid="layer-toggle-{layerKey}"
					aria-label={m.animate_layer_toggle()}
					checked={animationState.layers[layerKey]}
					onchange={(e) => setLayerEnabled(layerKey, (e.target as HTMLInputElement).checked)}
				/>
				{title}
			</label>

			<div class="flex flex-col gap-2 rounded border border-border p-2">
				<div class="flex flex-col gap-1">
					<Label for={sourceId} class="text-xs">{m.animate_audio_source()}</Label>
					<select
						id={sourceId}
						class="h-9 w-full rounded-md border border-input bg-background py-1 text-xs"
						value={animationState.audioSource}
						onchange={(e) =>
							setAudioSource(
								(e.target as HTMLSelectElement).value as 'demo' | 'mic' | 'file' | 'off'
							)}
					>
						<option value="demo">{m.animate_source_demo()}</option>
						<option value="mic">{m.animate_source_microphone()}</option>
						<option value="file">{m.animate_source_file()}</option>
					</select>
				</div>

				{#if showInputLevel}
					<div class="flex flex-col gap-1">
						<Label class="text-xs">{m.animate_input_level()}</Label>
						<div
							class="h-1.5 rounded bg-muted"
							role="meter"
							aria-label={m.animate_input_level_aria()}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={inputLevelPercent}
						>
							<div class="h-full rounded bg-green-500" style:width={`${inputLevelPercent}%`}></div>
						</div>
						<p class="text-[10px] text-muted-foreground">{inputHint}</p>
					</div>
				{/if}

				{#if animationState.audioSource === 'mic'}
					<p class="text-[10px] text-muted-foreground">{m.animate_mic_listening()}</p>
				{/if}

				{#if animationState.audioSource === 'file'}
					<AudioFilePanel />
				{/if}

				{#if paramsLabel}
					<div class="flex flex-col gap-2">
						<p class="text-[11px] font-medium text-muted-foreground">{paramsLabel}</p>
						{#each params as param (param.id)}
							<AnimatableSlider {param} />
						{/each}
					</div>
				{:else}
					{#each params as param (param.id)}
						<AnimatableSlider {param} />
					{/each}
				{/if}

				{@render perRing()}
			</div>
		</div>
	{/snippet}
</SidebarCollapsible>
```

- [ ] **Step 4: Run the Svelte autofixer**

Run `svelte-autofixer` on `AudioLayerSection.svelte` until `issues: []` (ignore the known rAF-in-`$effect` false positive).

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- run src/lib/components/AudioLayerSection.svelte.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Types gate**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AudioLayerSection.svelte src/lib/components/AudioLayerSection.svelte.spec.ts
git commit -m "$(cat <<'EOF'
feat(sidebar): add AudioLayerSection shared audio-section shell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Rewrite AudioBarsSection + AudioZonesSection on AudioLayerSection

**Files:**
- Modify: `src/lib/components/AudioBarsSection.svelte` (full rewrite)
- Modify: `src/lib/components/AudioZonesSection.svelte` (full rewrite)

**Interfaces:**
- Consumes: `AudioLayerSection` (Task 5). No props (both are leaf sections rendered by the animate page).
- Produces: behaviorally identical sections. Bars passes no `paramsLabel`; Zones passes `m.animate_intensity_per_band()`. Each provides its `perRing` snippet (the per-ring label + `#each composition.rings` + its config item). Preserves testids `layer-toggle-audioBars`/`layer-toggle-audioZones` (now emitted by the shell).

- [ ] **Step 1: Confirm the regression net runs green first**

Run: `bun run test:unit -- run src/lib/components/AudioBarsSection.svelte.spec.ts src/lib/components/AudioZonesSection.svelte.spec.ts "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: PASS (baseline before the rewrite).

- [ ] **Step 2: Rewrite AudioBarsSection**

```svelte
<!-- src/lib/components/AudioBarsSection.svelte -->
<script lang="ts">
	import { animationState, getAudioBarsParams } from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import AudioLayerSection from './AudioLayerSection.svelte';
	import RingWaveConfigItem from './RingWaveConfigItem.svelte';
	import type { WaveConfig } from '$lib/types';

	const barsParams = getAudioBarsParams();

	const globalWaveDefault = $derived<WaveConfig>({
		crests: animationState.audioBars.waveCrests,
		amplitudeGain: animationState.audioBars.waveAmplitudeGain,
		phaseSpeed: animationState.audioBars.wavePhaseSpeed
	});
</script>

<AudioLayerSection
	layerKey="audioBars"
	title={m.animate_layer_audio_bars()}
	params={barsParams}
	inputHint={m.animate_input_hint_bars()}
>
	{#snippet perRing()}
		<div class="flex flex-col gap-1">
			<p class="text-[11px] font-medium text-muted-foreground">{m.animate_wave_per_ring()}</p>
			{#each composition.rings as ring, i (ring.id)}
				<RingWaveConfigItem {ring} index={i} globalDefault={globalWaveDefault} />
			{/each}
		</div>
	{/snippet}
</AudioLayerSection>
```

- [ ] **Step 3: Rewrite AudioZonesSection**

```svelte
<!-- src/lib/components/AudioZonesSection.svelte -->
<script lang="ts">
	import { animationState, getAudioZonesParams } from '$lib/state/animation';
	import { composition } from '$lib/state/composition';
	import { m } from '$lib/paraglide/messages';
	import AudioLayerSection from './AudioLayerSection.svelte';
	import RingZoneConfigItem from './RingZoneConfigItem.svelte';

	const zonesParams = getAudioZonesParams();
</script>

<AudioLayerSection
	layerKey="audioZones"
	title={m.animate_layer_audio_zones()}
	params={zonesParams}
	inputHint={m.animate_input_hint_zones()}
	paramsLabel={m.animate_intensity_per_band()}
>
	{#snippet perRing()}
		<div class="flex flex-col gap-1">
			<p class="text-[11px] font-medium text-muted-foreground">{m.animate_zones_per_ring()}</p>
			{#each composition.rings as ring, i (ring.id)}
				<RingZoneConfigItem
					{ring}
					index={i}
					globalDefault={animationState.audioZones.defaultIntensity}
				/>
			{/each}
		</div>
	{/snippet}
</AudioLayerSection>
```

- [ ] **Step 4: Run the Svelte autofixer**

Run `svelte-autofixer` on both rewritten sections until `issues: []`.

- [ ] **Step 5: Run the regression tests**

Run: `bun run test:unit -- run src/lib/components/AudioBarsSection.svelte.spec.ts src/lib/components/AudioZonesSection.svelte.spec.ts "src/routes/(app)/animate/page.svelte.spec.ts"`
Expected: PASS — bars toggle + param arming, zones toggle + `ring-zone-config-0`, and the animate page finding both layer toggles.

- [ ] **Step 6: Full unit + types + e2e**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

Run: `bun run test:unit -- run`
Expected: all green (~490+ tests).

Run: `bunx playwright test`
Expected: 6/6 pass (~33s; the pre-existing harmless `"file" is not a known CSS property` warning is fine).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AudioBarsSection.svelte src/lib/components/AudioZonesSection.svelte
git commit -m "$(cat <<'EOF'
refactor(sidebar): audio sections use AudioLayerSection shell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Group A shell shared by all three → Tasks 1, 3, 4. ✓
- Wave/Zone "tanto" (shell + checkbox + data-driven sliders) → Tasks 2, 3. ✓
- Audio section shell → Tasks 5, 6. ✓
- Testid/id invariants preserved → enforced in Tasks 1, 3, 4, 5, 6 + regression specs. ✓
- Zones' "intensity per band" label preserved → `paramsLabel` prop (Tasks 5, 6). ✓

**Placeholder scan:** none — every step carries full code or an exact command.

**Type consistency:** `SliderSpec` shape identical in Task 2 (definition) and Task 3 (construction); `RingConfigShell` props consumed identically in Tasks 2 and 4; `AudioLayerSection` props consumed identically in Task 6. `layerKey` union `'audioBars' | 'audioZones'` matches `animationState.layers` keys.

**Note on `id` collisions:** the override checkbox id is parameterised (`overrideId`) precisely so `wave-override-{i}` and `zone-override-{i}` stay distinct on the animate page (both sections render simultaneously). Slider ids already differ by effect (crests/amplitude/phase-speed vs bass/mid/treble).
