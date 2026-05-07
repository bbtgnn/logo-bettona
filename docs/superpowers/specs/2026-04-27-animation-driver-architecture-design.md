# Animation Driver Architecture Design

Date: 2026-04-27
Status: Approved in chat, documented for planning

## Goal

Extend the animation system with a general architecture that supports current and future behaviors while staying simple.

Immediate target behaviors:

1. Audio reactivity (`audioBars`): uploaded audio -> FFT -> bars -> one bar per ring.
2. Data-driven (`dataSeries`): one discrete numeric series per ring, remapped to `[0..1]` and interpolated; series lengths may differ by ring.

Non-goals:

- No implementation in this step.
- No multi-driver blending.
- No graph editor or advanced signal bus UI.

## Chosen Architecture

### Runtime model

Use exactly one active driver at a time:

- `activeDriver.type`: `'audioBars' | 'dataSeries' | null`
- `activeDriver.config`: persisted, mode-specific configuration
- `activeDriver.runtime`: ephemeral runtime-only state (time cursor, FFT buffers, decoded audio references, interpolation caches)

Per frame:

1. Runtime asks the active driver for `frameTByRing: Record<number, number>`.
2. Runtime sanitizes and clamps each emitted value to `[0..1]`.
3. Runtime applies updates through existing composition actions (`setRingMorphT`).
4. Rings missing from `frameTByRing` are left unchanged.

Pause/stop:

- Stops frame updates.
- Keeps current ring `morphT` values (no implicit reset).

### Driver contracts

#### `audioBars`

- Input: uploaded audio + analysis settings.
- Output: one scalar `t` per ring index on each frame.
- Mapping rule: by ring index (ring 0 <- bar 0, ring 1 <- bar 1, ...), with explicit handling when ring count and bar count differ.

#### `dataSeries`

- Input: one numeric series per ring index (`1:1` fixed mapping).
- Different series lengths are allowed.
- Output: one scalar `t` per ring index on each frame.
- Missing series policy: **hold previous `t`** (no overwrite).

## Data Model and Persistence Boundaries

Persisted:

- `animationMode`: `'audioBars' | 'dataSeries' | null`
- `driverConfig.audioBars`
- `driverConfig.dataSeries.seriesByRingIndex`

Ephemeral (not persisted):

- Driver internals (FFT windows, decoded audio buffer references, interpolation cursor cache, frame-local scratch data)
- Playback runtime details (tick timing, running flags beyond persisted UX state)

Existing composition state remains the rendering source of truth:

- Ring `morphT` is still read by the render pipeline as today.
- Driver runtime is a producer layer, not a replacement for composition storage.

## Runtime Flow and Failure Rules

### Lifecycle

1. User selects driver mode.
2. Runtime validates config and initializes chosen driver.
3. Runtime ticks and applies frame output.
4. Runtime can pause/resume/stop without resetting ring values.

### Topology change rules

- Ring added:
  - `audioBars`: included automatically next frame.
  - `dataSeries`: no series by default -> ring `t` remains unchanged until provided.
- Ring removed:
  - Runtime ignores stale outputs for removed indices.
  - `dataSeries` cleanup may remove stale series keys lazily.
- Ring reorder:
  - V1 uses index-based mapping; reorder changes which series/bar affects which visual ring index.

### Error handling

- Driver init config invalid: driver remains inactive and exposes actionable UI error.
- Per-frame compute error: skip that frame, keep last ring state, keep runtime alive unless repeatedly fatal.
- Invalid numeric outputs (`NaN`, `Infinity`, out-of-range): sanitize + clamp.
- Data parse failure for one ring: skip that ring only; continue others.
- Audio decode/analysis failure: move driver to error state without blocking app.

## UI and UX Principles (Simplicity First)

- One active mode selector (`None`, `Audio Bars`, `Data Series`).
- No per-ring driver ownership matrix.
- `dataSeries` UI is direct per-ring editing (`ring i` <-> `series i`).
- Keep controls minimal and explicit; hide advanced tuning behind optional expanders.

## Testing Strategy

### Unit: driver contracts

- `audioBars` emits bounded values.
- `dataSeries` handles variable series lengths and interpolation correctly.
- Missing series leaves ring untouched.

### Unit: runtime

- Single active driver invariant.
- Clamp/sanitize behavior.
- Pause/stop behavior preserves ring state.
- Ring add/remove/reorder rules behave as specified.

### Integration

- End-to-end frame path: `driver -> setRingMorphT -> preview redraw`.
- Partial failure isolation (one ring fails, others continue).

### UI

- Mode switching updates runtime correctly.
- Series entry/validation behavior is clear and deterministic.
- Driver errors are visible and non-blocking.

## Migration Plan

1. Extract a generic runtime shell around current animation ticking.
2. Keep current behavior as temporary internal legacy driver.
3. Add `dataSeries` driver with 1:1 ring series model.
4. Add `audioBars` driver with upload/decode/FFT pipeline.
5. Simplify `AnimationSection` UI around single active mode.
6. Remove legacy-specific branching once new drivers are stable.

## Architectural Rationale

This design intentionally trades maximal flexibility for clarity and implementation safety:

- One active driver avoids ownership and blending complexity.
- Per-ring scalar output aligns with existing morph pipeline.
- Strict persisted-vs-ephemeral boundaries reduce reactive/persistence churn.
- The architecture remains extensible by adding new driver types later without changing render core contracts.

## Task 7 Verification Note (2026-04-27)

- Follow-up fix applied: driver modes no longer force-reset playback on topology changes in `handleCompositionChanged()`.
- Legacy mode (`mode = null`) still keeps conservative reset behavior on topology drift.
- Regression coverage now includes controller-level driver-mode continuity across topology changes.
