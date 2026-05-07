# Animation Simple Driver Default Design

Date: 2026-05-07
Status: Approved in chat, documented for planning

## Goal

Implement the data animation driver architecture while restoring the simple time-based driver as a first-class mode, and make `simple` the default active mode.

Immediate targets:

1. Keep the single-active-driver runtime architecture from the animation driver design.
2. Add `simple` as a dedicated driver mode (not a special-case runtime branch).
3. Make `simple` the default mode at startup.
4. Keep `None` as explicit no-animation mode.

Non-goals:

- No simple-driver advanced controls in v1 (no speed/direction UI).
- No multi-driver blending.
- No changes to composition as rendering source of truth.

## Chosen Approach

Use a first-class `simple` driver integrated into the existing runtime.

Why:

- Preserves architecture consistency (all behaviors are drivers).
- Keeps runtime orchestration generic and easier to maintain.
- Simplifies future extension with additional drivers.

## Architecture and State

### Driver type model

Extend animation mode/driver type union to include:

- `'simple' | 'audioBars' | 'dataSeries' | null`

`null` remains valid and represents explicit no-driver mode (`None` in UI).

### Runtime model

Runtime remains single-active-driver:

1. Active mode selects one driver instance.
2. Runtime calls active driver `frame(nowMs)`.
3. Runtime sanitizes/clamps each value to `[0..1]`.
4. Runtime applies values with `setRingMorphT`.
5. Missing ring outputs remain unchanged.

### Default behavior

Initial persisted/boot mode is `simple`.

- App starts with simple animation behavior available immediately.
- Users can still switch to `audioBars`, `dataSeries`, or `None`.

## Simple Driver Behavior

Create `simple-driver.ts` with standard driver contract:

- `init()`: capture `startedAtMs`.
- `dispose()`: clear runtime-only temporal state.
- `frame(nowMs)`: compute monotonically increasing normalized progress and emit it for all current rings.

Computation:

- `progress = ((nowMs - startedAtMs) / durationMs) % 1`
- `durationMs` is fixed constant in v1.
- Output map shape: `{ [ringIndex]: progress }` for each current ring index.

Design intent:

- No ring-specific mapping in `simple`; every ring receives the same `t`.
- Behavior is deterministic and minimal.
- No UI surface for tuning in v1.

## Data Flow and Topology Rules

Pipeline remains unchanged:

- `driver frame output -> runtime clamp/sanitize -> setRingMorphT -> render`

Topology behavior:

- Ring added: included next frame automatically.
- Ring removed: stale indices are ignored by runtime safety checks.
- Ring reordered: `simple` still applies same `t` to all indices, so reorder does not create mapping ambiguity.

## UI and UX

Mode selector options:

1. `Simple` (default selected)
2. `Audio Bars`
3. `Data Series`
4. `None`

UX principles:

- Keep simple mode zero-config in v1.
- Preserve explicit `None` for users wanting a static state.
- Keep current mode-switching mental model (single active mode).

## Testing Strategy

### Unit: simple driver

- Emits bounded values in `[0..1]`.
- `t` increases with time and wraps correctly.
- Applies output to all current rings.

### Unit: runtime

- `simple` mode outputs are applied when active.
- `null` mode applies nothing.
- Clamp/sanitize remains enforced for all modes.

### Controller integration

- Default mode initializes to `simple`.
- Existing play/pause and stop behavior remain safe.
- Composition/topology changes do not regress mode continuity behavior.

### UI tests

- Mode selector includes `Simple`.
- Initial selected mode is `simple`.
- Switching between `simple`, `audioBars`, `dataSeries`, and `None` updates runtime-facing state correctly.

## Migration Notes

1. Add `simple` to shared driver type contracts.
2. Add `simple-driver.ts` and tests.
3. Register `simple` in runtime bootstrap.
4. Set default animation mode to `simple`.
5. Update `AnimationSection` options order/labels and tests.

No composition data model migration is required.

## Risks and Mitigations

- Risk: confusion between `simple` and `None`.
  - Mitigation: explicit UI labels and tests validating default selection and no-animation behavior for `None`.
- Risk: behavior drift in topology change handling.
  - Mitigation: preserve and extend controller/runtime regression tests for composition changes.

