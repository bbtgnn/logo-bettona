# audioBars Indefinite Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `durationSec` stop condition from audioBars mode so the logo reacts for the full duration of the audio input (indefinitely for mic/demo; for the file's full length in file mode), and replace the global Duration+progress UI with a Play/Pause + elapsed-time counter for audioBars mic/demo sources.

**Architecture:** Single-line `hasCompleted` guard makes audioBars never self-stop. `logicalElapsedMs` (already computed each tick) is mirrored into `animationState.elapsedMs` for reactive display. `AnimationSection.svelte` splits the transport block into two branches: audioBars (elapsed counter) vs. all other modes (existing duration + progress bar).

**Tech Stack:** Svelte 5 (`$state`, `$derived`), TypeScript, Vitest (node env for state tests, browser env for component tests via vitest-browser-svelte).

---

## File Map

| File | Change |
|------|--------|
| `src/lib/state/animation.svelte.ts` | Add `elapsedMs` to type + state; patch `hasCompleted`; set `elapsedMs` in `tick` + `stopInternal` |
| `src/lib/state/animation.svelte.spec.ts` | Add `setRingWave` to composition mock; 3 new tests |
| `src/lib/components/AnimationSection.svelte` | Add `formatElapsed` helper; split transport block into 2 branches |
| `src/lib/components/AnimationSection.svelte.spec.ts` | Add `elapsedMs` to mock; update 1 existing test; 1 new test |

---

## Task 1: Patch `animation.svelte.ts` and its tests

**Files:**
- Modify: `src/lib/state/animation.svelte.ts`
- Modify (tests): `src/lib/state/animation.svelte.spec.ts`

---

- [ ] **Step 1: Add `setRingWave` to composition mock**

The composition mock in `animation.svelte.spec.ts` is missing `setRingWave`. The audioBars driver calls it each frame — without the mock, tests that tick the audioBars driver will crash with "setRingWave is not a function".

In `src/lib/state/animation.svelte.spec.ts`, update the `vi.mock('./composition', ...)` factory:

```typescript
vi.mock('./composition', () => ({
    composition: mockComposition,
    setRingMorphT: vi.fn(),
    setRingWave: vi.fn()
}));
```

---

- [ ] **Step 2: Write three failing tests**

Append to the `'animation runtime integration'` describe block in `src/lib/state/animation.svelte.spec.ts`:

```typescript
it('audioBars mode does not stop after durationSec elapses', async () => {
    const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
    const animation = await import('./animation');
    animation.setAnimationMode('audioBars');
    animation.togglePlay();
    flushNextAnimationFrame(0);
    flushNextAnimationFrame(3000); // default durationSec = 3 s
    expect(animation.animationState.isPlaying).toBe(true);
    void requestAnimationFrameMock;
    void cancelAnimationFrameMock;
    vi.unstubAllGlobals();
});

it('elapsedMs increments each frame in audioBars mode', async () => {
    const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
    const animation = await import('./animation');
    animation.setAnimationMode('audioBars');
    animation.togglePlay();
    flushNextAnimationFrame(0);
    flushNextAnimationFrame(1200);
    expect(animation.animationState.elapsedMs).toBe(1200);
    void requestAnimationFrameMock;
    void cancelAnimationFrameMock;
    vi.unstubAllGlobals();
});

it('elapsedMs resets to 0 when stopAnimation is called', async () => {
    const { requestAnimationFrameMock, cancelAnimationFrameMock } = installRafMock();
    const animation = await import('./animation');
    animation.setAnimationMode('audioBars');
    animation.togglePlay();
    flushNextAnimationFrame(0);
    flushNextAnimationFrame(1500);
    expect(animation.animationState.elapsedMs).toBe(1500);
    animation.stopAnimation();
    expect(animation.animationState.elapsedMs).toBe(0);
    void requestAnimationFrameMock;
    void cancelAnimationFrameMock;
    vi.unstubAllGlobals();
});
```

---

- [ ] **Step 3: Run new tests to confirm they fail**

```bash
cd /Users/tommaso/Documents/GitHub/logo-bettona
bun run vitest run src/lib/state/animation.svelte.spec.ts
```

Expected: the three new tests FAIL. `audioBars mode does not stop` fails because `isPlaying` is false after 3000 ms. `elapsedMs` tests fail because the property does not exist yet.

---

- [ ] **Step 4: Add `elapsedMs` to `AnimationState` type**

In `src/lib/state/animation.svelte.ts`, add `elapsedMs` to the `AnimationState` type (after `durationSec`):

```typescript
export type AnimationState = {
    mode: AnimationMode;
    isPlaying: boolean;
    isPaused: boolean;
    progress: number;
    audioBars: AudioBarsConfig;
    audioSource: 'demo' | 'mic' | 'file' | 'off';
    dataSeries: DataSeriesConfig;
    durationSec: number;
    loop: boolean;
    alternate: boolean;
    elapsedMs: number;
};
```

Add the initial value in the `$state` object (after `alternate: false`):

```typescript
export const animationState = $state<AnimationState>({
    mode: 'simple',
    isPlaying: false,
    isPaused: false,
    progress: 0,
    audioBars: defaultAudioBarsConfig,
    audioSource: 'demo',
    dataSeries: defaultDataSeriesConfig,
    durationSec: 3,
    loop: false,
    alternate: false,
    elapsedMs: 0
});
```

---

- [ ] **Step 5: Patch `hasCompleted` to return `false` for audioBars**

In `src/lib/state/animation.svelte.ts`, add an early return at the top of `hasCompleted`:

```typescript
function hasCompleted(elapsedMs: number): boolean {
    if (animationState.mode === 'audioBars') return false;
    if (animationState.loop) return false;
    const durationMs = Math.max(0.1, animationState.durationSec) * 1000;
    const cycles = Math.max(0, elapsedMs / durationMs);
    return cycles >= (animationState.alternate ? 2 : 1);
}
```

---

- [ ] **Step 6: Mirror `logicalElapsedMs` into `animationState.elapsedMs` in `tick`**

In `tick`, after the `if (lastTickNowMs !== null)` block that updates `logicalElapsedMs`, add one line:

```typescript
if (lastTickNowMs !== null) {
    logicalElapsedMs += Math.max(0, nowMs - lastTickNowMs);
}
lastTickNowMs = nowMs;
animationState.elapsedMs = logicalElapsedMs;   // ← add this line
const progress = getProgressFromElapsed(logicalElapsedMs);
```

---

- [ ] **Step 7: Reset `elapsedMs` in `stopInternal`**

In `stopInternal`, after `logicalElapsedMs = 0`, add:

```typescript
lastTickNowMs = null;
logicalElapsedMs = 0;
animationState.elapsedMs = 0;   // ← add this line
animationState.isPlaying = false;
animationState.isPaused = false;
```

---

- [ ] **Step 8: Run tests to confirm all pass**

```bash
bun run vitest run src/lib/state/animation.svelte.spec.ts
```

Expected: all tests PASS, including the 3 new ones.

---

- [ ] **Step 9: Commit**

```bash
git add src/lib/state/animation.svelte.ts src/lib/state/animation.svelte.spec.ts
git commit -m "feat: audioBars mode runs indefinitely; add elapsedMs to animation state"
```

---

## Task 2: Update `AnimationSection.svelte` transport and tests

**Files:**
- Modify: `src/lib/components/AnimationSection.svelte`
- Modify (tests): `src/lib/components/AnimationSection.svelte.spec.ts`

---

- [ ] **Step 1: Add `elapsedMs` to the animation mock in the component spec**

In `src/lib/components/AnimationSection.svelte.spec.ts`, add `elapsedMs: 0` to `animationApi.animationState`:

```typescript
const animationApi = vi.hoisted(() => ({
    animationState: {
        mode: null as 'simple' | 'audioBars' | 'dataSeries' | null,
        isPlaying: false,
        isPaused: false,
        progress: 0.25,
        durationSec: 3,
        loop: false,
        alternate: false,
        audioSource: 'demo' as 'demo' | 'mic' | 'file' | 'off',
        elapsedMs: 0,
        audioBars: {
            smoothing: 0.5,
            minHz: 20,
            maxHz: 20000,
            waveCrests: 3,
            waveAmplitudeGain: 0.3,
            wavePhaseSpeed: 2.2,
            inputGain: 1
        }
    },
    // ... rest of mock unchanged
```

---

- [ ] **Step 2: Update the existing broken test and add a new one**

Find the test named `'shows the global progress bar in audioBars + mic mode'` and replace it entirely. Also add a test for audioBars + demo. Both go in `src/lib/components/AnimationSection.svelte.spec.ts`:

```typescript
it('shows elapsed counter and no progress bar in audioBars + mic mode', async () => {
    animationApi.animationState.mode = 'audioBars';
    animationApi.animationState.audioSource = 'mic';
    animationApi.animationState.elapsedMs = 0;
    render(AnimationSection);
    await expect.element(page.getByLabelText('Elapsed time')).toBeInTheDocument();
    await expect.element(page.getByText('0:00')).toBeInTheDocument();
    await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument();
    await expect.element(page.getByLabelText('Duration (s)')).not.toBeInTheDocument();
});

it('formats elapsed time correctly in audioBars + demo mode', async () => {
    animationApi.animationState.mode = 'audioBars';
    animationApi.animationState.audioSource = 'demo';
    animationApi.animationState.elapsedMs = 65000; // 1 min 5 s
    render(AnimationSection);
    await expect.element(page.getByText('1:05')).toBeInTheDocument();
    await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument();
    await expect.element(page.getByLabelText('Duration (s)')).not.toBeInTheDocument();
});
```

---

- [ ] **Step 3: Run component tests to confirm updated + new tests fail**

```bash
bun run vitest run src/lib/components/AnimationSection.svelte.spec.ts
```

Expected: the two modified/new tests FAIL (counter and absence of progressbar not yet in DOM).

---

- [ ] **Step 4: Add `formatElapsed` helper to `AnimationSection.svelte`**

In the `<script>` block of `src/lib/components/AnimationSection.svelte`, add this function (after the `$effect` blocks):

```typescript
function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
```

---

- [ ] **Step 5: Split the transport block in the template**

In `src/lib/components/AnimationSection.svelte`, replace the existing `{#if !hideGlobalTransport}` block (which currently contains the Duration + Play + progress bar) with:

```svelte
{#if !hideGlobalTransport}
    {#if animationState.mode === 'audioBars'}
        <!-- audioBars mic/demo: Play/Pause + elapsed counter (no duration, no progress bar) -->
        <div class="flex items-center gap-2">
            <Button
                onclick={togglePlay}
                aria-pressed={animationState.isPlaying}
                disabled={blockPlayback}
            >{animationState.isPlaying ? 'Pause' : 'Play'}</Button>
            <span
                class="tabular-nums text-xs text-muted-foreground"
                aria-label="Elapsed time"
            >{formatElapsed(animationState.elapsedMs)}</span>
        </div>
    {:else}
        <!-- all other modes: duration field + Play/Pause + progress bar -->
        <div class="flex items-end gap-2">
            <div class="flex flex-1 flex-col gap-1">
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
            <Button
                onclick={togglePlay}
                aria-pressed={animationState.isPlaying}
                disabled={blockPlayback}>{animationState.isPlaying ? 'Pause' : 'Play'}</Button
            >
        </div>

        <div class="space-y-1">
            <div
                class="h-1.5 rounded bg-muted"
                role="progressbar"
                aria-label="Animation progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progressPercent}
            >
                <div
                    class="h-full rounded bg-foreground transition-all"
                    style:width={`${progressPercent}%`}
                ></div>
            </div>
            <p class="text-[10px] text-muted-foreground">{progressPercent}%</p>
        </div>
    {/if}
{/if}
```

---

- [ ] **Step 6: Run the full component test suite to confirm all pass**

```bash
bun run vitest run src/lib/components/AnimationSection.svelte.spec.ts
```

Expected: all tests PASS including the two new/updated ones.

---

- [ ] **Step 7: Run the full test suite**

```bash
bun run vitest run
```

Expected: all existing tests still pass, no regressions. Pre-existing failures (`.mock` typing error in `animation.svelte.spec.ts:270`, `runtime.spec.ts:34`, 4 shadcn button typecheck errors) are unchanged.

---

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/AnimationSection.svelte src/lib/components/AnimationSection.svelte.spec.ts
git commit -m "feat: show elapsed counter instead of progress bar in audioBars mic/demo mode"
```

---

## Post-implementation QA checklist

Manual verification with `bun dev`:

- [ ] Select audioBars + demo → logo reacts → elapsed counter counts up → runs indefinitely
- [ ] Select audioBars + mic → elapsed counter counts up → runs indefinitely (after granting permission)
- [ ] Select audioBars + file → global transport hidden → AudioFilePanel owns playback
- [ ] Switch to simple mode → Duration field + progress bar reappear
- [ ] Start audioBars + demo, Pause → counter freezes; Resume → counter continues from frozen value
- [ ] Stop via mode switch → counter resets to 0:00
