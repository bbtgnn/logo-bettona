# Animate: concurrent animation layers

**Date:** 2026-06-21
**Branch:** `feat/kaleidoscope`
**Status:** approved — ready for planning

## Context

The `animate` workspace currently models animation as a **single exclusive mode**:
`animationState.mode` is one of `simple | dataSeries | audioBars | audioZones | null`.
The "Reattività audio" checkbox swaps `mode` between an audio type and a motion type, so
Simple morph and audio reactivity can never run at the same time. The keyframe "stopwatch"
(⏱) exists only for kaleidoscope parameters (`KALEIDO_PARAMS`); the timeline and the
keyframe-apply loop are hardwired to that one registry. The per-ring morph control (the
`morphT` slider) lives in the editor's `RingEditor`.

We are moving to **concurrent animation layers**: each animation "class" (Simple, Data
Series, Audio Bars, Audio Zones, Kaleidoscope) becomes its own window in the animate
sidebar with an independent on/off switch. Multiple layers run together on the shared
timeline clock. The drivers write to **different ring properties** — Simple→`morphT`,
Audio Bars→`wave`, Audio Zones→`zoneDrive` — so they coexist without conflict. The user
accepts that mixing will be visually "confusionario" for now; refining the combined output
is explicitly out of scope.

## Goals

1. Replace the single `animationState.mode` with independent concurrent **layers**.
2. Split `AnimationSection` into separate windows, one per class, each with an on/off switch.
3. Let **Simple coexist with audio reactivity** (and any other layer).
4. Make the **Play** button (and spacebar) **always activatable**, regardless of whether any
   morph ring exists or any stopwatch is armed. The timeline always runs the clock.
5. Add the **stopwatch ⏱ to every animatable parameter** in Audio Bars (global + per-ring)
   and Audio Zones, via a generic parameter registry (the kaleidoscope pattern, generalized).
6. Move the per-ring **`morphT` slider** (static value) from the editor into the animate
   **Simple** window. The secondary-shape *drawing* stays in the editor.

## Non-goals

- Improving the *combined visual result* of mixed layers (will be revisited later).
- Implementing real Data Series behavior. Data Series becomes a **disabled placeholder**
  window ("modalità non ancora disponibile"), wired for a future data-source feature.
- Per-ring stopwatches on Simple `morphT` — Simple keeps its **auto-sweep** engine; the
  per-ring slider only sets the static value.
- Resolving the Simple↔Data Series shared-`morphT` conflict — Data Series is parked, so the
  conflict cannot occur yet.

## Design decisions (resolved during brainstorming)

| Decision | Choice |
|---|---|
| Sequencing | Single spec, implemented in safe committed phases. |
| Simple vs Data Series (both drive `morphT`) | Data Series parked as a disabled placeholder; no conflict. |
| What of the morph moves to animate | Only the per-ring `morphT` slider (static value). Drawing the secondary shape stays in editor. |
| Simple engine | Keep auto-sweep (set duration + loop, press play). No ⏱ on morph. Per-ring slider = static value. |
| Layer on/off UX | Explicit on/off switch in each window header. |
| Kaleidoscope as a layer | Gets a switch like the others. Off = ignore its keyframes (params stay at static slider values); the kaleidoscope still renders. |

## Architecture

### State model

Replace `mode: AnimationMode` on `AnimationState` with a layers record:

```ts
type AnimationLayers = {
	simple: boolean;
	audioBars: boolean;
	audioZones: boolean;
	dataSeries: boolean;   // always false (placeholder, not runnable)
	kaleidoscope: boolean; // off = skip applyKaleidoscopeKeyframes
};
```

- `audioSource`, `audioBars`, `audioZones`, `dataSeries` config objects stay as they are.
- A `setLayerEnabled(layer, on)` action replaces `setAnimationMode`. It must preserve the
  existing audio-source teardown: turning **off** the last audio layer stops `audioSource`;
  turning one **on** does not auto-start a source (mirrors current behaviour).
- Persistence/migration: **none needed.** `animationState` is not persisted (only
  `composition` and `keyframes` go to localStorage). The default `layers` value replaces the
  default `mode: 'simple'` — start with `{ simple: true, … }` matching today's default.

### Runtime: single mode → active set

`createAnimationRuntime` currently holds one `mode` and ticks one driver. Change to an
**active set** of driver types:

- `setActive(type, on)` (replacing `setMode`) maintains a `Set<AnimationDriverType>`,
  calling `init()`/`dispose()` on transitions exactly once (preserve the existing
  register-after-activate contract).
- `tick(nowMs)` iterates **every active driver**, applying each driver's frame map. Because
  drivers target different ring properties, the per-property writes do not collide.
- The animation state's `tick()` drives `runtime` from `animationState.layers` instead of a
  single `mode`. The morph auto-sweep (`simple` driver) and audio drivers can now all be
  active in the same frame.

### Generic parameter registry

Generalize the kaleidoscope `KaleidoParam` pattern into a shared shape so any slider can be
keyframed:

```ts
type AnimatableParam = {
	id: string;       // unique track key, e.g. "audioBars.inputGain", "audioZones.bass"
	label: string;
	min: number; max: number; step: number;
	get(): number;
	set(v: number): void;
};
```

- Keep `KALEIDO_PARAMS` as one registry. Add `AUDIO_BARS_PARAMS` (global: inputGain,
  waveCrests, waveAmplitudeGain, wavePhaseSpeed, smoothing) and `AUDIO_ZONES_PARAMS`
  (bass, mid, treble), with setters that route through `setAudioBarsConfig` /
  `setAudioZonesDefaultIntensity`.
- Per-ring Audio Bars wave overrides (`ring.waveConfig.{crests,amplitudeGain,phaseSpeed}`)
  are **dynamic** params (depend on ring count + whether the override is on). Provide a
  function that builds per-ring param descriptors with ids like `ring.{i}.wave.crests` whose
  setters route through `updateRing`. The timeline and apply-loop consume these alongside the
  static registries.
- A single `ALL_ANIMATABLE_PARAMS()` accessor (or a small list of registries) feeds:
  - the keyframe **apply loop** (rename `applyKaleidoscopeKeyframes` → a generic
    `applyKeyframes(progress)` that walks every registry; kaleidoscope params are gated by
    `layers.kaleidoscope`),
  - the **timeline** `armedParams` (`TimelinePanel` filters all registries, not just
    `KALEIDO_PARAMS`).
- `AnimatableSlider` already takes a generic `KaleidoParam`; retype its prop to
  `AnimatableParam` (structurally identical) and reuse it verbatim for audio sliders.

### Keyframes during audio: clock semantics

Audio layers run on a live, effectively infinite clock (the timeline shows elapsed, not a
fixed duration). The keyframe apply loop already runs every frame against
`getProgressFromElapsed`, so keyframed audio params sample by normalized `progress` exactly
like kaleidoscope params do today. With `loop` on, `progress` cycles 0→1; with `loop` off it
clamps at 1 and the keyframed value holds. This is accepted as-is ("messy for now").

## Components

### AnimationSection → per-class windows

`AnimationSection.svelte` is replaced by separate windows, each a `SidebarCollapsible` with
an on/off switch wired to `setLayerEnabled`:

- **SimpleSection** — switch; per-ring `morphT` slider list (only rings with
  `secondaryTemplatePath`); reuses `setRingMorphT`. Empty-state hint when no ring has a
  secondary shape ("disegna una seconda forma in editor").
- **DataSeriesSection** — switch **disabled**; placeholder copy "modalità non ancora
  disponibile".
- **AudioBarsSection** — current Audio Bars markup (source, gain, crests, amplitude, phase,
  smoothing, per-ring wave) with each slider wrapped so it carries a ⏱ via `AnimatableSlider`
  / the generic param.
- **AudioZonesSection** — current Audio Zones markup (bass/mid/treble) with ⏱ per slider.
- **KaleidoscopeSection** — unchanged sliders, **plus** an on/off switch bound to
  `layers.kaleidoscope`.

The animate route (`(app)/animate/+page.svelte`) renders the windows in order:
Simple, Data Series, Audio Bars, Audio Zones, Kaleidoscope.

### TimelinePanel: always-on Play

- Remove `blockPlayback` gating from the **Play** button `disabled` and from the spacebar
  handler. Play/spacebar always toggle the clock.
- The "Animation won't run until at least one ring has a secondary path" warning becomes a
  **non-blocking hint** (it no longer disables anything); keep it only inside the Simple
  window as guidance.
- `armedParams` is sourced from all registries (see above), so audio/zone tracks appear in
  the timeline once their ⏱ is armed.

### Editor: morph drawing stays, slider leaves

In `RingEditor.svelte`, remove the `morphT` **slider** (and the "Morph t:" readout). Keep
"Create morph target" / "Remove morph target" and the Primary/Secondary tabs + canvas —
defining the second shape stays an editor task. The slider now lives in SimpleSection.

## Phases (each a single commit, TDD red→green→refactor)

1. **Generic param registry** — extract `AnimatableParam`; add `AUDIO_BARS_PARAMS`,
   `AUDIO_ZONES_PARAMS`, and the per-ring wave param builder; rename
   `applyKaleidoscopeKeyframes` → `applyKeyframes` walking all registries. No UI/behavior
   change yet (kaleidoscope still the only armed params). Pure-logic, unit-tested.
2. **Layers model** — `mode`→`layers` on state; runtime single-mode→active-set;
   `setAnimationMode`→`setLayerEnabled`; tick drives all active drivers; migration/defaults.
   Unit tests for coexistence (simple+audioBars both apply) and audio-source teardown.
3. **Window split + switches** — replace `AnimationSection` with Simple / Data Series /
   Audio Bars / Audio Zones sections; add switch to KaleidoscopeSection; update animate
   route. Component tests per window (switch toggles layer; data-series switch disabled).
4. **Play always active** — drop `blockPlayback` gating in `TimelinePanel`; warning becomes
   a hint. Timeline-panel test: Play enabled with no morph ring and no armed track.
5. **Stopwatch on audio + morph slider move** — wire `AnimatableSlider` into Audio Bars /
   Audio Zones sliders; `armedParams` from all registries; move `morphT` slider editor→Simple.
   Tests: arming an audio param adds a timeline track and animates it; editor no longer
   renders the morphT slider; Simple window renders it.

(Phase 5 may split into 5a audio stopwatches / 5b morph move if it grows; the planner decides.)

## Testing

- **Unit (vitest):** runtime active-set transitions; concurrent driver application (distinct
  ring properties); generic apply-loop across registries; layer toggles + audio-source
  teardown; per-ring wave param setters.
- **Component (vitest browser):** each window's switch toggles its layer; Data Series switch
  disabled; KaleidoscopeSection switch gates keyframe application; Audio sliders show ⏱ and
  arming adds a timeline track; TimelinePanel Play enabled unconditionally; editor drops the
  morphT slider, Simple shows it. Tailwind is absent in vitest DOM → assert structure /
  testid / ARIA, never computed layout.
- Every `.svelte`/`.svelte.ts` must pass svelte-autofixer (`issues:[]`); `bun run check` 0
  errors; full `bun run test:unit -- run` green.

## Risks / notes

- Concurrent drivers writing the **same** property would conflict; current driver set targets
  distinct properties, so this is safe today. Re-check if a future driver targets `morphT`
  alongside Simple (the parked Data Series).
- Per-ring dynamic params (wave overrides) must stay in sync as rings are added/removed —
  build descriptors from live `composition.rings`, do not cache stale indices.
- Removing `blockPlayback` must not break the audio-mode elapsed vs timed-duration display in
  `TimelinePanel` (that branch keys off whether an audio layer is active, not off
  `blockPlayback`).
