# Timeline Timecode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `m:ss.cs` current/total timecode to the non-audio timeline transport, with the current field editable to jump the playhead to a precise time.

**Architecture:** Two pure helpers (`formatTimecode`/`parseTimecode`) in `timeline-geometry.ts`, unit-tested; `TimelinePanel` renders an editable current-time input + read-only total that commits via the existing `scrubTo`. No state-layer change.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, paraglide i18n, Vitest (`vitest/browser`), bun.

## Global Constraints

- Package manager **bun**. Single spec: `bun run test:unit -- run <path>`. Full unit: `bun run test:unit -- run`. Types: `bun run check`.
- Tab indentation (NOT spaces).
- Touched `.svelte` MUST pass the Svelte MCP `svelte-autofixer` with `issues: []` (ignore known false-positive *suggestions* only).
- New message key in BOTH `messages/en.json` and `messages/it.json` (messages-parity test). `bun run check` recompiles paraglide; a first run after editing messages can transiently fail — rerun.
- Component tests run in a real browser; Tailwind NOT loaded — assert role/label/text/state. Specs asserting English UI call `switchLocale('en')` in `beforeEach`.
- Commit trailer EXACTLY: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do NOT run `prettier --write .` or `bun run lint`.
- Spec: `docs/superpowers/specs/2026-06-22-timeline-timecode-design.md`.

---

### Task 1: `formatTimecode` / `parseTimecode` helpers

**Files:**
- Modify: `src/lib/animation/timeline-geometry.ts`
- Test: `src/lib/animation/timeline-geometry.spec.ts`

**Interfaces:**
- Produces: `formatTimecode(sec: number): string` (→ `m:ss.cs`) and `parseTimecode(str: string): number | null`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/animation/timeline-geometry.spec.ts` — extend the import to include the two new functions, and add a new `describe`:

```ts
import {
	xFromTime,
	timeFromX,
	yFromValue,
	valueFromY,
	formatSeconds,
	snapProgressToFps,
	formatTimecode,
	parseTimecode
} from './timeline-geometry';

describe('timecode', () => {
	it('formats seconds as m:ss.cs', () => {
		expect(formatTimecode(0)).toBe('0:00.00');
		expect(formatTimecode(3.25)).toBe('0:03.25');
		expect(formatTimecode(65.5)).toBe('1:05.50');
	});

	it('carries centiseconds when rounding', () => {
		expect(formatTimecode(3.999)).toBe('0:04.00');
		expect(formatTimecode(59.999)).toBe('1:00.00');
	});

	it('clamps negative/non-finite to zero', () => {
		expect(formatTimecode(-1)).toBe('0:00.00');
		expect(formatTimecode(NaN)).toBe('0:00.00');
	});

	it('parses valid timecodes to seconds', () => {
		expect(parseTimecode('0:03.25')).toBeCloseTo(3.25, 5);
		expect(parseTimecode('1:05.5')).toBeCloseTo(65.5, 5);
		expect(parseTimecode('3.2')).toBeCloseTo(3.2, 5);
		expect(parseTimecode('7')).toBe(7);
	});

	it('returns null for invalid input', () => {
		expect(parseTimecode('')).toBeNull();
		expect(parseTimecode('abc')).toBeNull();
		expect(parseTimecode('-1')).toBeNull();
		expect(parseTimecode('1:2:3')).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/animation/timeline-geometry.spec.ts`
Expected: FAIL — `formatTimecode`/`parseTimecode` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/animation/timeline-geometry.ts`:

```ts
/** Formats seconds as `m:ss.cs` (centiseconds). Negative/non-finite → `0:00.00`. */
export function formatTimecode(sec: number): string {
	const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
	// Round to centiseconds first so carrying rolls seconds and minutes correctly.
	const totalCs = Math.round(safe * 100);
	const cs = totalCs % 100;
	const totalSec = Math.floor(totalCs / 100);
	const s = totalSec % 60;
	const min = Math.floor(totalSec / 60);
	return `${min}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Parses a user-typed time to seconds. Accepts `m:ss.cs`, `m:ss`, `ss.cs`, `ss`
 * (and a bare decimal). Returns null for empty, malformed, or negative input.
 */
export function parseTimecode(str: string): number | null {
	const t = str.trim();
	if (t === '') return null;
	let seconds: number;
	if (t.includes(':')) {
		const parts = t.split(':');
		if (parts.length !== 2) return null;
		const [minStr, restStr] = parts;
		if (!/^\d+$/.test(minStr)) return null;
		if (!/^\d+(\.\d+)?$/.test(restStr)) return null;
		seconds = Number(minStr) * 60 + Number(restStr);
	} else {
		if (!/^\d+(\.\d+)?$/.test(t)) return null;
		seconds = Number(t);
	}
	if (!Number.isFinite(seconds) || seconds < 0) return null;
	return seconds;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/animation/timeline-geometry.spec.ts`
Expected: PASS (all, including the pre-existing geometry tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/animation/timeline-geometry.ts src/lib/animation/timeline-geometry.spec.ts
git commit -m "feat(timeline): formatTimecode/parseTimecode helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Editable current/total timecode in the transport

**Files:**
- Modify: `messages/en.json`, `messages/it.json` (1 key)
- Modify: `src/lib/components/TimelinePanel.svelte`
- Test: `src/lib/components/TimelinePanel.svelte.spec.ts`

**Interfaces:**
- Consumes: `formatTimecode` / `parseTimecode` (Task 1); `scrubTo` (already imported in TimelinePanel); `animationState.progress` / `animationState.durationSec`.
- Produces: in non-audio mode, a current-time `<input>` (aria-label from `m.timeline_current_time()`) plus a read-only total; committing a valid time jumps the playhead.

- [ ] **Step 1: Add the message key (EN then IT)**

In `messages/en.json`, after `"timeline_duration_aria": "Duration seconds",` add:

```json
	"timeline_current_time": "Current time (type to jump)",
```

In `messages/it.json`, after the matching `"timeline_duration_aria": ...` add:

```json
	"timeline_current_time": "Tempo corrente (digita per saltare)",
```

- [ ] **Step 2: Recompile + parity**

Run: `bun run check` then `bun run test:unit -- run src/lib/messages-parity.spec.ts`
Expected: 0 errors; parity PASS.

- [ ] **Step 3: Write the failing tests**

Add to `src/lib/components/TimelinePanel.svelte.spec.ts` (inside the existing describe; `userEvent` and `animationState` are already imported there):

```ts
	it('jumps the playhead when a timecode is typed and committed', async () => {
		keyframes.ensureTrack('kaleidoscope.scale');
		keyframes.setTrackEnabled('kaleidoscope.scale', true);
		animationState.durationSec = 10;
		animationState.progress = 0;
		render(TimelinePanel);
		const input = page.getByLabelText('Current time (type to jump)');
		await userEvent.fill(input, '0:05.00');
		await userEvent.keyboard('{Enter}');
		expect(animationState.progress).toBeCloseTo(0.5, 2);
	});

	it('ignores an invalid timecode entry (playhead unchanged)', async () => {
		keyframes.ensureTrack('kaleidoscope.scale');
		keyframes.setTrackEnabled('kaleidoscope.scale', true);
		animationState.durationSec = 10;
		animationState.progress = 0.3;
		render(TimelinePanel);
		const input = page.getByLabelText('Current time (type to jump)');
		await userEvent.fill(input, 'abc');
		await userEvent.keyboard('{Enter}');
		expect(animationState.progress).toBeCloseTo(0.3, 2);
	});

	it('shows the total duration as a timecode', async () => {
		keyframes.ensureTrack('kaleidoscope.scale');
		keyframes.setTrackEnabled('kaleidoscope.scale', true);
		animationState.durationSec = 65.5;
		render(TimelinePanel);
		await expect.element(page.getByText('1:05.50')).toBeInTheDocument();
	});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: FAIL — no element labeled "Current time (type to jump)".

- [ ] **Step 5: Implement the control**

In `src/lib/components/TimelinePanel.svelte`:

Extend the timeline-geometry import to add the two helpers (the line currently importing `xFromTime, timeFromX, snapProgressToFps`):

```svelte
	import {
		xFromTime,
		timeFromX,
		snapProgressToFps,
		formatTimecode,
		parseTimecode
	} from '$lib/animation/timeline-geometry';
```

Add state + handlers in the `<script>` (place after the `playheadLeft` / playhead-drag block, near the other transport state):

```svelte
	// Editable current-time field (non-audio mode). While not focused it mirrors the live
	// playhead time; on focus it switches to an edit buffer; committing jumps via scrubTo.
	let editingTime = $state(false);
	let timeBuffer = $state('');
	const currentSec = $derived(animationState.progress * animationState.durationSec);
	function onTimeFocus() {
		editingTime = true;
		timeBuffer = formatTimecode(currentSec);
	}
	function commitTime() {
		if (!editingTime) return;
		const parsed = parseTimecode(timeBuffer);
		editingTime = false;
		if (parsed === null || !(animationState.durationSec > 0)) return;
		const clamped = Math.max(0, Math.min(parsed, animationState.durationSec));
		scrubTo(clamped / animationState.durationSec);
	}
	function onTimeKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.currentTarget as HTMLInputElement).blur();
		}
	}
```

In the transport markup, in the `{:else}` (non-audio) branch — which currently holds only
the Duration `<label>` — insert the timecode control immediately after `{:else}` and before
the Duration label:

```svelte
				{:else}
					<span class="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
						<input
							type="text"
							aria-label={m.timeline_current_time()}
							class="h-7 w-20 rounded border bg-background px-1 text-center text-xs tabular-nums"
							value={editingTime ? timeBuffer : formatTimecode(currentSec)}
							onfocus={onTimeFocus}
							oninput={(e) => (timeBuffer = (e.target as HTMLInputElement).value)}
							onkeydown={onTimeKeydown}
							onblur={commitTime}
						/>
						/ {formatTimecode(animationState.durationSec)}
					</span>
					<label class="flex items-center gap-1 text-xs text-muted-foreground">
						{m.timeline_duration_label()}
```

(Leave the rest of the Duration label — the `<Input>` and `{m.timeline_seconds_unit()}` —
unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun run test:unit -- run src/lib/components/TimelinePanel.svelte.spec.ts`
Expected: PASS (existing tests + 3 new).

- [ ] **Step 7: Run svelte-autofixer**

Run the Svelte MCP `svelte-autofixer` on `TimelinePanel.svelte`. Confirm `issues: []`.

- [ ] **Step 8: Commit**

```bash
git add messages/en.json messages/it.json src/lib/components/TimelinePanel.svelte src/lib/components/TimelinePanel.svelte.spec.ts
git commit -m "feat(timeline): editable current/total timecode with jump-to-time

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Type check** — Run: `bun run check` → Expected: 0 errors.
- [ ] **Step 2: Full unit suite** — Run: `bun run test:unit -- run` → Expected: all pass (a first run after the message edit may flake on the paraglide recompile race — rerun once).
- [ ] **Step 3: e2e** — Run: `bunx playwright test` → Expected: 6/6.
- [ ] **Step 4: Live verification (manual)** — controller confirms in a real browser: the non-audio timeline shows `current / total` in `m:ss.cs`; current updates during playback; typing a time + Enter jumps the playhead; out-of-range clamps; invalid is ignored; audio mode still shows the elapsed indicator unchanged.

## Self-Review

**Spec coverage:**
- Helpers `formatTimecode`/`parseTimecode` (format incl. carry/negatives; parse variants + null) → Task 1. ✓
- Editable current + read-only total in non-audio transport; live update; commit→scrubTo with clamp; invalid ignored → Task 2. ✓
- i18n key `timeline_current_time` EN+IT → Task 2. ✓
- Audio mode unchanged (control only in the `{:else}` branch) → Task 2. ✓
- Tests (unit + component) and gates → Tasks 1–3. ✓
- Out of scope (audio jump, frame numbers, ruler/kf-time labels) → untouched. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Full code in every code step. ✓

**Type consistency:** `formatTimecode(sec: number): string` and `parseTimecode(str: string): number | null` used consistently in Tasks 1 and 2. `scrubTo` is already imported in TimelinePanel (added with the playhead-drag feature). `m.timeline_current_time()` key matches the EN/IT add. ✓
