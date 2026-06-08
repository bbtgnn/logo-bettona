# Real audio source (Task D) + UI controls (Task E)

**Date:** 2026-06-08
**Branch:** `feat/add-audioreactive`
**Status:** Approved design
**Builds on:** `2026-06-08-audioreactive-cymatic-wave-design.md` (Tasks A–C + fallback, already shipped)

## Objective

Connect real audio to the cymatic wave by reusing the exact same `readBars(): number[]`
contract (one 0..1 value per ring) that the dev fallback already satisfies, and add live
tuning sliders. Two real sources — **microphone** (live) and **file** (real Bettona
recordings, including bells). The dev fallback stays as a soft "Demo" degradation.

The animation driver and Tasks A–C are **not touched**: only what feeds `readBars` changes.

## Architecture

```
UI (AnimationSection)  ──gestures──>  setAudioSource / audioSource.{loadFile,play,pause}
        │                                          │
        │ setAudioBarsConfig                       ▼
        ▼                                   createAudioSource  (Web Audio: 1 AudioContext + 1 AnalyserNode)
 animationState.audioBars (config)                 │ readBars(): number[]
 animationState.audioSource ('demo'|...)           │
        │                                          │
        ▼   source-aware readBars                  │
 audioBars driver  ◄───────────────────────────────┘  (or fallbackBars.readBars for 'demo', [] for 'off')
        │ applyRingWave (unchanged)
        ▼
 render-pipeline → wave → bend (unchanged)
```

Decomposition:
- `reduceToBands(...)` — pure spectrum → bands function (no Web Audio refs), independently testable.
- `createAudioSource(...)` — owns all Web Audio nodes + lifecycle; same `readBars` contract.
- `animation.svelte.ts` — source-aware `readBars` routing, mutators, lifecycle coordination.
- `AnimationSection.svelte` — source selector, file controls, 5 sliders.
- `fallbackBars` (existing) — unchanged; reused as the "Demo" source.

Constraints: **no new dependencies** (native Web Audio only); the `audioBars` driver and
`wave.ts` / `render-pipeline.ts` / `bend.ts` are untouched; resume the `AudioContext` inside a
user gesture; the **mic is never routed to `destination`** (feedback); the **file IS routed
to `destination`** (audible while tuning); denied permission / no file → no crash, logo at
rest or Demo.

## Task D — `src/lib/state/animation-drivers/audio-source.ts`

### Pure band reducer (exported, unit-tested without Web Audio)

```ts
export function reduceToBands(
	freq: Uint8Array,        // analyser.getByteFrequencyData output, length = fftSize/2
	ringCount: number,
	minHz: number,
	maxHz: number,
	sampleRate: number,
	fftSize: number,
	inputGain: number
): number[]
```

Logic:
- `ringCount <= 0` → `[]`.
- Bin `i` of `freq` covers frequency `i * sampleRate / fftSize`.
- Split `[minHz, maxHz]` into `ringCount` **log-spaced** sub-ranges (log spacing reads voice
  and ambience better than linear). Band `b` spans `[edge[b], edge[b+1])` where
  `edge[b] = minHz * (maxHz / minHz) ** (b / ringCount)`.
- For each band, average the magnitudes of the bins whose center frequency falls in its range
  (if a band has no bins, use the nearest single bin so it is never NaN), then
  `value = clamp01((avg / 255) * inputGain)`.
- Return `ringCount` values in `0..1`.

### Web Audio source

```ts
export function createAudioSource(deps: {
	getRingCount: () => number;
	getConfig: () => AudioBarsConfig; // uses smoothing / minHz / maxHz / inputGain
}): {
	setMode(mode: 'mic' | 'file' | 'off'): Promise<void>;
	loadFile(file: File): Promise<void>;
	play(): Promise<void>;
	pause(): void;
	stop(): void;
	readBars(): number[];
};
```

- One lazily-created `AudioContext` (created on first `setMode`, not at module load — avoids
  autoplay warnings) and one `AnalyserNode` (`fftSize = 2048`,
  `smoothingTimeConstant = getConfig().smoothing`, refreshed on each `readBars`/`setMode`).
- A reused `Uint8Array(analyser.frequencyBinCount)` buffer.
- `setMode(mode)`:
  - Ensure context exists; `await audioContext.resume()` (gesture-driven caller).
  - Disconnect/release the previous source node.
  - `mic`: `await navigator.mediaDevices.getUserMedia({ audio: true })` →
    `createMediaStreamSource(stream)` → `analyser`. **Do NOT** connect analyser to
    `destination`. Keep the `MediaStream` for `stop()`.
  - `file`: ensure an `HTMLAudioElement` exists; `createMediaElementSource(audio)` →
    `analyser` → `audioContext.destination` (so the file is audible). (Create the
    `MediaElementSourceNode` once per element — creating it twice throws.)
  - `off`: disconnect nodes; do not tear down the context.
  - Rejections (no `getUserMedia`, denied, unsupported context) propagate — the caller reverts
    the selector to Demo.
- `loadFile(file)`: `audio.src = URL.createObjectURL(file)` (revoke any previous object URL).
- `play()`: `await audioContext.resume()` then `await audio.play()`.
- `pause()`: `audio.pause()`.
- `stop()`: stop all `MediaStreamTrack`s, disconnect source + analyser, pause audio. Context
  may stay (reused next time) but is left `suspend`-able; safe to leave.
- `readBars()`: if an analyser + active source is ready, set
  `analyser.smoothingTimeConstant = cfg.smoothing`, `getByteFrequencyData(buf)`, then
  `reduceToBands(buf, getRingCount(), cfg.minHz, cfg.maxHz, audioContext.sampleRate, fftSize, cfg.inputGain)`.
  Otherwise return `[]` (logo at rest). Never throws.

## Task D — config (`src/lib/state/animation-drivers/types.ts`)

`AudioBarsConfig` gains:

```ts
inputGain: number; // multiplies raw band magnitudes before clamp (boost quiet recordings)
```

`defaultAudioBarsConfig` in `animation.svelte.ts` adds `inputGain: 1`.

## Task D — wiring (`src/lib/state/animation.svelte.ts`)

The driver and its `applyRingWave` contract are unchanged; only `readBars` routing changes.

- Add `audioSource` singleton:
  `const audioSource = createAudioSource({ getRingCount: () => composition.rings.length, getConfig: () => animationState.audioBars });`
  (keep the existing `fallbackBars`).
- `AnimationState` gains `audioSource: 'demo' | 'mic' | 'file' | 'off'` (ephemeral; not
  persisted — `animationState` is plain `$state`). Default `'demo'`.
- **Source-aware readBars** wired into the driver registration:
  ```ts
  readBars: () => {
    switch (animationState.audioSource) {
      case 'demo': return fallbackBars.readBars();
      case 'mic':
      case 'file': return audioSource.readBars();
      default: return []; // 'off' → at rest
    }
  }
  ```
- New exported mutators:
  - `setAudioBarsConfig(next: Partial<AudioBarsConfig>)` — `animationState.audioBars = { ...animationState.audioBars, ...next }` (mirrors `setDataSeriesConfig`).
  - `setAudioSource(mode)` — sets `animationState.audioSource = mode`; for `'demo'` calls
    `audioSource.setMode('off')`; for `'mic'`/`'file'` calls `audioSource.setMode(mode)` and on
    rejection reverts `animationState.audioSource = 'demo'` + `audioSource.setMode('off')`.
- Re-export `audioSource` (so the UI can call `loadFile` / `play` / `pause`).
- Lifecycle: call `audioSource.stop()` when leaving `audioBars` (in `setAnimationMode` when the
  new mode is not `audioBars`, and in `stopInternal`).

## Task E — UI (`src/lib/components/AnimationSection.svelte`)

Rendered only when `animationState.mode === 'audioBars'`:

- **Source selector** — native `<select>`: Microphone / File / Demo, bound to
  `setAudioSource`.
- **File controls** (only when source is `file`): `<input type="file" accept="audio/*">`
  calling `audioSource.loadFile(file)` on change; Play / Pause buttons calling
  `audioSource.play()` / `audioSource.pause()` (both are user gestures).
- **5 native range sliders**, each calling `setAudioBarsConfig({ ... })`:
  - `waveCrests` (min 1, max 8, step 1)
  - `waveAmplitudeGain` (min 0, max 1, step 0.01)
  - `wavePhaseSpeed` (min 0, max 6, step 0.1)
  - `smoothing` (min 0, max 0.95, step 0.05)
  - `inputGain` (min 0.5, max 4, step 0.1)
- **Fix the latent play gate:** today `disabled={!hasMorphRings}` and the "needs a secondary
  path" warning block audioBars, which drives the wave (not morphT) and needs no secondary
  path. Change the disabled condition and the warning visibility to
  `... && animationState.mode !== 'audioBars'` so audioBars can play freely. (`simple`/`null`
  behavior unchanged.)
- After editing this `.svelte` file, run the `svelte-autofixer` MCP tool until it reports no
  issues (per `CLAUDE.md`).

## Testing

- `src/lib/state/animation-drivers/audio-source.spec.ts` (new):
  - **Pure `reduceToBands`** (no mocks): a known `Uint8Array` → exactly `getRingCount` values,
    all within `0..1`; `ringCount = 0` → `[]`; a ramped spectrum yields higher values in the
    matching log band; `inputGain` scales values and the result still clamps at 1.
  - **`createAudioSource`** with mocked `AudioContext` / `AnalyserNode` /
    `navigator.mediaDevices` (no real audio): `readBars()` returns `getRingCount()` values when
    a source is active; returns `[]` when `'off'`; `setMode('mic')` rejection does not throw out
    of `readBars` (degradation).
- `src/lib/components/AnimationSection.svelte.spec.ts` (extend): in `audioBars` mode the source
  selector and the 5 sliders render and invoke `setAudioSource` / `setAudioBarsConfig`; the
  Play button is enabled with no morph rings. Use the existing hoisted-mock pattern.
- All existing tests stay green.

## Acceptance

- Selecting Microphone and speaking, or loading a Bettona recording and pressing Play, makes
  the petals ripple in time with the sound, coherent on all axes; silence → still; a bell
  transient → a visible wave that grows and decays; the sliders tune the behavior live; the
  file is audible while tuning, the mic is not fed back.
- Mic denied → reverts to Demo, no crash. `off` / no file → logo at rest.
- No new dependencies; `lint` and typecheck clean (modulo the 2 pre-existing unrelated
  test-spec errors in `animation.svelte.spec.ts` and `runtime.spec.ts`).
