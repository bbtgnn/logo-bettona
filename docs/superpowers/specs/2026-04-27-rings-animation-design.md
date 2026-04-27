# Rings Animation Section Design

Date: 2026-04-27
Status: Approved for planning

## 1) Goal

Add a new `Animation` section in the sidebar between `Settings` and `Colors` that provides a first morph animation mode for rings.

Scope for this feature:
- Use `animejs` as the animation engine.
- Add play/pause control with pause/resume semantics.
- Animate ring `morphT` over a global duration in seconds.
- Show a compact progress bar for the current cycle.
- Support `loop` and `alternate` toggles with anime.js semantics.

## 2) Constraints and Decisions

- Chosen implementation approach is a central controller module (`src/lib/state/animation.ts`) instead of direct component-local animation logic.
- This first implementation animates only morph-capable rings (rings with `secondaryTemplatePath`).
- Duration is global for all animated rings in v1.
- Loop and alternate are independent toggles:
  - `loop=false, alternate=false`: one shot
  - `loop=true, alternate=false`: repeat forward cycles
  - `loop=true, alternate=true`: ping-pong cycles
- Pressing `Play` during playback behaves as pause/resume toggle (not restart).

## 3) Architecture

### New module: animation controller

Add `src/lib/state/animation.ts` to own animation lifecycle and reactive UI state.

Primary responsibilities:
- Create and manage anime.js instances.
- Expose play/pause/resume/stop behavior through a compact API.
- Track runtime state (`isPlaying`, `progress`, `durationSec`, `loop`, `alternate`).
- Write animated `morphT` values through existing composition state APIs (`setRingMorphT`).

### Responsibility boundaries

- **Animation state layer** (`src/lib/state/animation.ts`)
  - Owns runtime playback state and engine integration.
  - Owns animation mode selection and lifecycle contract.
- **Composition state layer** (`src/lib/state/composition.ts`)
  - Remains owner of persisted ring model (`morphT`, paths).
  - Receives updates only through existing mutators.
- **UI layer** (`src/lib/components/AnimationSection.svelte`)
  - Binds controls to animation controller state/actions.
  - Does not contain animation engine orchestration logic.

### Extensibility contract

Define internal mode adapters that can be expanded later for new animation types.

Suggested shape:
- `start(ctx)`
- `pause()`
- `resume()`
- `stop()`
- `dispose()`

Initial mode implementation is `morphSweep`. Future modes can plug into the same lifecycle without rewriting section UI.

## 4) Component and Data Flow

1. User interacts with `AnimationSection`.
2. `togglePlay()` in the animation controller either starts, pauses, or resumes based on current runtime state.
3. Anime.js updates progression; on each update tick, controller computes each target ring value and calls `setRingMorphT(index, t)`.
4. Existing preview render effect in `PreviewCanvas.svelte` reacts to composition updates and re-renders.
5. Controller updates a normalized `progress` (`0..1`) for the active cycle; UI maps it to progress bar width.

Sidebar order becomes:
1. `SettingsSection`
2. `AnimationSection` (new)
3. `ColorsSection`
4. `Rings`

## 5) UI/UX Behavior

Controls in the new `Animation` section:
- `Play/Pause` button (single toggle)
- `Duration (s)` input (global)
- `Loop` toggle
- `Alternate` toggle
- small progress bar

Behavior:
- If idle, pressing `Play` starts animation.
- If playing, pressing button pauses at current position.
- If paused, pressing button resumes from current position.
- On one-shot completion, `isPlaying` becomes false and progress reaches 100%.
- Looping modes continue according to anime.js configuration.

## 6) Engine Mapping (anime.js)

- Use anime.js timelines or animations with:
  - `duration = durationSec * 1000`
  - `loop = loop ? true : false`
  - `direction = alternate ? 'alternate' : 'normal'`
- Easing for v1 should be deterministic and simple (for example `linear`) unless changed later.
- Controller must maintain stable references so pause/resume operates on the same underlying anime instance.

## 7) Edge Cases and Runtime Safety

- **No morph-capable rings:** play action is disabled or guarded no-op; progress remains `0`.
- **Composition changes during playback:** stop current run and reset progress to avoid stale ring indices and invalid targets.
- **Duration/loop/alternate changed while running:** apply on next start in v1 for predictability and lower complexity.
- **Clamp safety:** all writes go through existing clamped composition mutator behavior for `morphT`.

## 8) Testing Strategy

### Unit tests (animation controller)

- Starts animation and updates only morph-capable rings.
- Pause/resume preserves position.
- One-shot completion transitions to idle state.
- Loop/alternate settings map to expected anime.js config.
- Composition mutation during playback triggers safe stop/reset behavior.

### Component tests

- `AnimationSection` renders expected controls.
- Play button label/state follows idle -> playing -> paused transitions.
- Progress bar reflects exposed `progress`.
- Sidebar section ordering includes animation between settings and colors.

### Regression expectations

- Existing per-ring manual morph editing behavior remains unchanged.
- Existing preview rendering behavior remains unchanged aside from expected frequent updates during playback.

## 9) Out of Scope

- Per-ring custom durations.
- Multiple simultaneous animation modes.
- Scrubbable timeline UI.
- Persisting runtime playback state to local storage.

## 10) Future Extension Notes

This design deliberately centralizes animation runtime in `src/lib/state/animation.ts` so future animation types can be added behind a mode adapter interface with minimal impact to sidebar UI and composition persistence boundaries.

## 11) Follow-up UX Guardrail (2026-04-27)

Add an inline warning in the `Animation` section when no rings are morph-capable (no ring has `secondaryTemplatePath`).

### Behavior contract

- Condition: `composition.rings.some((ring) => ring.secondaryTemplatePath)` is `false`.
- Warning visibility: always visible while condition is `false` (not tied to play attempts).
- Warning text: `Animation won’t run until at least one ring has a secondary path.`
- Play button: disabled while the condition is `false`.
- Existing controller guardrails remain in place (`togglePlay()` no-op path when no morph-capable rings) as runtime safety backup.

### UI intent

- Keep warning compact and visually subtle, using a small yellow tinted style to indicate caution instead of error.
- Place warning near the top of the animation controls so the reason for disabled play is immediately clear.
