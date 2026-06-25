# composeRingTemplate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the template-space transform prep (morph-interpolate → wave) out of the paper.js-bound render pipeline into one pure `composeRingTemplate`, reuse it in WavePreview, and delete the dead template-space zone code — concentrating the "how a ring's authored template is prepared before bend" knowledge in one directly-testable place.

**Architecture:** A Ring's effects run in two stages (see ADR-0001 / CONTEXT.md). **Template space** = morph + wave on the authored `(x,y)` path, BEFORE bend. **Polar space** = zone deformation, applied inside `buildRingPath` after the angle/radius mapping. This plan unifies only the template-space stage into `composeRingTemplate` (pure, no paper.js). Zone stays in `buildRingPath` by geometric necessity — the template-space implementation (`zones.ts:applyZonesToPath`) was abandoned and is deleted here.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, paper.js, bun, vitest (+ vitest-browser-svelte for components).

## Global Constraints

- Package manager **bun**. Types: `bun run check` (recompiles paraglide; must be 0 errors / 0 warnings). Single unit spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`.
- **TAB indentation** everywhere. No `prettier --write .` / `bun run lint` (pre-existing red — not a gate).
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Every changed `.svelte` MUST pass the Svelte MCP `svelte-autofixer` → `issues: []` (load via ToolSearch `select:mcp__svelte__svelte-autofixer`). Ignore known false-positive *suggestions* (function-call/rAF inside `$effect`, `bind:this`→attachment).
- No new user-facing copy → no `messages/*.json` changes.
- **Zone deformation stays in polar space inside `buildRingPath`.** Do NOT move zone deformation into `composeRingTemplate` or revive a template-space zone transform — it is re-absorbed by bend's bbox normalization (ADR-0001).
- `RenderResult.warnings` has NO production consumer (only `render-pipeline.spec.ts` asserts it); the morph-fallback warning text `Ring <i> morph fallback: <reason>` must be preserved byte-identical for those tests.
- Render output must be unchanged: morph→wave ordering and the wave-applies-only-when-`amplitude > 0` guard are behavior to preserve exactly.

---

### Task 1: Pure `composeRingTemplate`

**Files:**
- Create: `src/lib/geometry/compose-ring.ts`
- Create: `src/lib/geometry/compose-ring.spec.ts`

**Interfaces:**
- Consumes: `interpolatePath`, `validatePathCompatibility` (from `./path-morph`), `applyWaveToPath` (from `./wave`), types `Path`, `Ring`, `WaveState`.
- Produces: `composeRingTemplate(ring: Ring, opts?: { ignoreMorph?: boolean }): { path: Path | null; morphWarning: string | null }` and the exported type `ComposedRingTemplate`. Later tasks (pipeline, WavePreview) call this.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/geometry/compose-ring.spec.ts`. The fixtures use morph-compatible paths (same `cmds`, same coord count) and an incompatible pair (different `cmds`):

```ts
import { describe, it, expect } from 'vitest';
import { composeRingTemplate } from './compose-ring';
import { applyWaveToPath } from './wave';
import { interpolatePath } from './path-morph';
import type { Path, Ring } from '$lib/types';

const A: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 10, 0, 10, 10] };
const B: Path = { cmds: ['M', 'L', 'L'], crds: [0, 0, 20, 0, 20, 20] };
const INCOMPAT: Path = { cmds: ['M', 'C'], crds: [0, 0, 1, 1, 2, 2, 3, 3] };

const ring = (over: Partial<Ring>): Ring =>
	({
		id: 'r',
		copies: 8,
		color: '#000',
		templatePath: A,
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.12,
		...over
	}) as Ring;

describe('composeRingTemplate', () => {
	it('returns null path when the ring has no template', () => {
		const out = composeRingTemplate(ring({ templatePath: null }));
		expect(out.path).toBeNull();
		expect(out.morphWarning).toBeNull();
	});

	it('passes the primary template through untouched when no secondary and no wave', () => {
		const out = composeRingTemplate(ring({}));
		expect(out.path).toEqual(A);
		expect(out.morphWarning).toBeNull();
	});

	it('morph-interpolates toward the secondary at morphT', () => {
		const out = composeRingTemplate(ring({ secondaryTemplatePath: B, morphT: 0.5 }));
		expect(out.path).toEqual(interpolatePath(A, B, 0.5));
		expect(out.morphWarning).toBeNull();
	});

	it('skips morph and reports a warning when paths are incompatible', () => {
		const out = composeRingTemplate(ring({ secondaryTemplatePath: INCOMPAT, morphT: 0.5 }));
		expect(out.path).toEqual(A); // primary, unchanged
		expect(out.morphWarning).toBeTypeOf('string');
		expect(out.morphWarning!.length).toBeGreaterThan(0);
	});

	it('ignoreMorph bypasses the secondary even when compatible', () => {
		const out = composeRingTemplate(ring({ secondaryTemplatePath: B, morphT: 0.5 }), {
			ignoreMorph: true
		});
		expect(out.path).toEqual(A);
		expect(out.morphWarning).toBeNull();
	});

	it('applies the wave on top of the (morphed) template', () => {
		const wave = { amplitude: 0.3, crests: 2, phase: 0 };
		const out = composeRingTemplate(ring({ secondaryTemplatePath: B, morphT: 0.5, wave }));
		expect(out.path).toEqual(applyWaveToPath(interpolatePath(A, B, 0.5), wave));
	});

	it('does not apply the wave when amplitude is 0', () => {
		const out = composeRingTemplate(ring({ wave: { amplitude: 0, crests: 2, phase: 0 } }));
		expect(out.path).toEqual(A);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test:unit -- run src/lib/geometry/compose-ring.spec.ts`
Expected: FAIL — cannot resolve `./compose-ring`.

- [ ] **Step 3: Implement `composeRingTemplate`**

Create `src/lib/geometry/compose-ring.ts`:

```ts
import type { Path, Ring } from '$lib/types';
import { interpolatePath, validatePathCompatibility } from './path-morph';
import { applyWaveToPath } from './wave';

export type ComposedRingTemplate = {
	path: Path | null;
	morphWarning: string | null;
};

/**
 * Template-space prep for one ring: morph-interpolate toward its secondary path
 * (when present and compatible), then apply the cymatic wave. PURE — no paper.js,
 * so the morph→wave ordering is unit-testable without a render scope.
 *
 * Zone deformation is deliberately NOT here: it lives in polar space inside
 * buildRingPath (driven by ring.zoneDrive). A template-space zone transform is
 * re-absorbed by bend's bbox normalization — see ADR-0001.
 *
 * morphWarning carries the reason morph was requested (secondary present,
 * !ignoreMorph) but skipped due to path incompatibility; the primary template is
 * then used unchanged before the wave step. The render pipeline maps it to a
 * RenderResult warning; previews ignore it.
 */
export function composeRingTemplate(
	ring: Ring,
	opts?: { ignoreMorph?: boolean }
): ComposedRingTemplate {
	let path = ring.templatePath;
	if (!path) return { path: null, morphWarning: null };

	let morphWarning: string | null = null;
	if (!opts?.ignoreMorph && ring.secondaryTemplatePath) {
		const compatibility = validatePathCompatibility(path, ring.secondaryTemplatePath);
		if (compatibility.ok) {
			path = interpolatePath(path, ring.secondaryTemplatePath, ring.morphT ?? 0);
		} else {
			morphWarning = compatibility.reason;
		}
	}

	if (ring.wave && ring.wave.amplitude > 0) {
		path = applyWaveToPath(path, ring.wave);
	}

	return { path, morphWarning };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test:unit -- run src/lib/geometry/compose-ring.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Verify types**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geometry/compose-ring.ts src/lib/geometry/compose-ring.spec.ts
git commit -m "feat(geometry): add pure composeRingTemplate (morph + wave, template space)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Render pipeline consumes `composeRingTemplate`

**Files:**
- Modify: `src/lib/geometry/render-pipeline.ts:1-5` (imports), `:164-224` (per-ring loop body)
- Test: `src/lib/geometry/render-pipeline.svelte.spec.ts` (no new tests; existing suite must stay green)

**Interfaces:**
- Consumes: `composeRingTemplate` (Task 1).
- Produces: no signature change. `RenderResult.warnings` still contains `Ring <i> morph fallback: <reason>` byte-identical.

- [ ] **Step 1: Replace the inline morph+wave prep with the call**

In `src/lib/geometry/render-pipeline.ts`, update imports (lines 1-5): remove `interpolatePath`, `validatePathCompatibility` (from `./path-morph`) and `applyWaveToPath` (from `./wave`), and add `composeRingTemplate`. Keep `buildRingPath`. Result:

```ts
import paper from 'paper';
import type { Composition, Ring } from '$lib/types';
import { buildRingPath } from './bend';
import { composeRingTemplate } from './compose-ring';
```

(`Ring` is added to the type import so the loop can annotate `effectiveRing`.)

Then in `renderOnce`, replace the morph block (lines 171-198) AND the zone-strip comment block up to the `buildRingPath` call. Specifically, replace this span:

```ts
				let effectiveRing = ring;
				if (!input.ignoreMorph && ring.templatePath && ring.secondaryTemplatePath) {
					const compatibility = validatePathCompatibility(
						ring.templatePath,
						ring.secondaryTemplatePath
					);
					if (compatibility.ok) {
						effectiveRing = {
							...ring,
							templatePath: interpolatePath(
								ring.templatePath,
								ring.secondaryTemplatePath,
								ring.morphT ?? 0
							)
						};
					} else {
						warnings.push(`Ring ${i} morph fallback: ${compatibility.reason}`);
					}
				}

				// Apply the cymatic wave to the (already morph-interpolated) template
				// BEFORE bend mirrors/tiles it, so the ripple is coherent on every copy.
				if (effectiveRing.wave && effectiveRing.wave.amplitude > 0 && effectiveRing.templatePath) {
					effectiveRing = {
						...effectiveRing,
						templatePath: applyWaveToPath(effectiveRing.templatePath, effectiveRing.wave)
					};
				}
```

with:

```ts
				// Template-space prep (morph → wave) is pure; zone deformation stays in
				// polar space inside buildRingPath below. See compose-ring.ts / ADR-0001.
				const composed = composeRingTemplate(ring, { ignoreMorph: input.ignoreMorph });
				if (composed.morphWarning) {
					warnings.push(`Ring ${i} morph fallback: ${composed.morphWarning}`);
				}
				let effectiveRing: Ring = { ...ring, templatePath: composed.path };
```

Leave the following block (the `input.ignoreZoneDrive` strip, the `radius` computation, and `buildRingPath(effectiveRing, radius, scope)`) exactly as-is.

- [ ] **Step 2: Run the pipeline spec to verify no regression**

Run: `bun run test:unit -- run src/lib/geometry/render-pipeline.svelte.spec.ts`
Expected: PASS (all existing tests, including morph-fallback warning and wave-applied assertions). If a morph-fallback warning test fails on the exact string, re-check that the pushed text is `` `Ring ${i} morph fallback: ${composed.morphWarning}` `` — unchanged from before.

- [ ] **Step 3: Verify types (catches the now-unused imports)**

Run: `bun run check`
Expected: 0 errors, 0 warnings. (A leftover unused import would surface here.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/geometry/render-pipeline.ts
git commit -m "refactor(geometry): render pipeline uses composeRingTemplate for template prep

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: WavePreview consumes `composeRingTemplate`

**Files:**
- Modify: `src/lib/components/WavePreview.svelte` (import + the `reach` build at lines ~82-86)
- Test: `src/lib/components/WavePreview.svelte.spec.ts` if present (must stay green)

**Interfaces:**
- Consumes: `composeRingTemplate` (Task 1).

- [ ] **Step 1: Swap the inline wave call for composeRingTemplate**

In `src/lib/components/WavePreview.svelte`:

Update the imports — remove `import { applyWaveToPath } from '$lib/geometry/wave';` (line 4; it is only used at the `reach` build) and add:

```ts
	import { composeRingTemplate } from '$lib/geometry/compose-ring';
```

Replace the `reach` build (lines 82-86):

```ts
				const reach = buildRingPath(
					{ ...baseRing, templatePath: applyWaveToPath(template, { amplitude, crests, phase }) },
					PREVIEW_RADIUS,
					scope
				);
```

with:

```ts
				const reach = buildRingPath(
					{
						...baseRing,
						templatePath: composeRingTemplate({
							...baseRing,
							wave: { amplitude, crests, phase }
						}).path
					},
					PREVIEW_RADIUS,
					scope
				);
```

(`baseRing.secondaryTemplatePath` is `null`, so composeRingTemplate skips morph and applies only the wave — identical output to the old `applyWaveToPath(template, …)`, since `baseRing.templatePath === template`.)

- [ ] **Step 2: Verify `applyWaveToPath` is no longer referenced in the file**

Run: `grep -n applyWaveToPath src/lib/components/WavePreview.svelte`
Expected: no output (import removal in Step 1 is safe). If any reference remains, keep the import; otherwise it stays removed.

- [ ] **Step 3: Run the autofixer**

Load `mcp__svelte__svelte-autofixer` via ToolSearch, run it on the full text of `src/lib/components/WavePreview.svelte`, apply fixes until `issues: []` (ignore known false-positive suggestions).

- [ ] **Step 4: Verify types + the WavePreview spec**

Run: `bun run check`
Expected: 0 errors, 0 warnings.
Run: `bun run test:unit -- run src/lib/components/WavePreview.svelte.spec.ts`
Expected: PASS (component tests run in a real browser; Tailwind inert — they assert DOM/testid/role, not geometry, so the equivalent template change should not affect them).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/WavePreview.svelte
git commit -m "refactor(geometry): WavePreview uses composeRingTemplate instead of inline wave

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Delete dead template-space zone code

**Files:**
- Modify: `src/lib/geometry/zones.ts` (remove `applyZonesToPath`, the 5 `*_REACH`/`*_RETRACT` constants, and the `AnchorInfo` type — keep `resolveZoneIntensity`)
- Modify or delete: `src/lib/geometry/zones.spec.ts` (remove the `applyZonesToPath` tests; keep any `resolveZoneIntensity` tests — delete the file only if nothing remains)

**Interfaces:**
- `resolveZoneIntensity` keeps the same signature and stays importable from `$lib/geometry/zones` — its two consumers (`audio-zones-driver.ts`, `RingZoneConfigItem.svelte`) are untouched.

- [ ] **Step 1: Confirm `applyZonesToPath` has no production caller**

Run: `grep -rn "applyZonesToPath" src --include="*.ts" --include="*.svelte" | grep -v "zones.ts\|zones.spec"`
Expected: no output (only `zones.ts` defines it and `zones.spec.ts` tests it — dead in production, per ADR-0001).

- [ ] **Step 2: Remove the dead code from `zones.ts`**

Edit `src/lib/geometry/zones.ts` so it retains ONLY the `resolveZoneIntensity` function and the imports it needs. Delete: the five exported constants (`BASS_REACH`, `MID_X_REACH`, `MID_Y_REACH`, `TREBLE_RETRACT`, `VIBR_REACH`), the `AnchorInfo` type, and the entire `applyZonesToPath` function. The resulting file is:

```ts
import type { ZoneIntensity } from '$lib/types';

export function resolveZoneIntensity(
	ring: { zoneConfig?: { bass: number; mid: number; treble: number } | null },
	def: ZoneIntensity
): ZoneIntensity {
	return ring.zoneConfig ?? def;
}
```

(Drop the now-unused `Path` and `ZoneDrive` from the type import — only `ZoneIntensity` remains.)

- [ ] **Step 3: Trim the spec**

Open `src/lib/geometry/zones.spec.ts`. Remove every `describe`/`it` that exercises `applyZonesToPath` and remove its import. Keep any test for `resolveZoneIntensity`. If, after removal, the file has no remaining tests, delete the file entirely:

```bash
git rm src/lib/geometry/zones.spec.ts
```

Otherwise edit it to keep only the `resolveZoneIntensity` tests.

- [ ] **Step 4: Verify types + the full unit suite**

Run: `bun run check`
Expected: 0 errors, 0 warnings (catches any lingering import of the removed symbols).
Run: `bun run test:unit -- run`
Expected: all green (the removed `applyZonesToPath` tests are gone; everything else passes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/zones.ts src/lib/geometry/zones.spec.ts
git commit -m "chore(geometry): delete dead template-space applyZonesToPath (zone lives in polar bend, ADR-0001)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Final verification (after all tasks)

- [ ] **Types:** `bun run check` → 0 errors, 0 warnings.
- [ ] **Full unit:** `bun run test:unit -- run` → all green (≥ 491 prior − removed applyZonesToPath tests + 7 new compose-ring tests). If the first run flakes a single paraglide-dependent test, RERUN once.
- [ ] **e2e:** `bunx playwright test` → 6/6 (pre-existing harmless `"file" is not a known CSS property` warning is fine).
- [ ] **Manual browser pass (dev :5174):** `bun run dev`; confirm the rendered composition looks identical (morph + wave still applied), and the Wave preview popover still shows the rest outline + translucent wave reach.

## Notes for the implementer

- **Do not touch zone/bend.** Zone deformation stays in `buildRingPath` (polar space). `composeRingTemplate` is template-space only (morph + wave). This split is geometric necessity, recorded in ADR-0001 and CONTEXT.md (template space / polar space).
- **Render output must be byte-equivalent.** The only structural change is *where* the morph→wave prep lives, not *what* it computes. The morph-fallback warning string and the `wave.amplitude > 0` guard are preserved deliberately.
- **`ignoreMorph` mapping:** the pipeline's `input.ignoreMorph` (audioBars rest-on-primary mode) maps directly to `composeRingTemplate`'s `opts.ignoreMorph`.
